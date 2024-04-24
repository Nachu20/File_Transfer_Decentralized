const { app, DBACTION } = require('./app')
const WebSocketServer = require('ws')
const http = require('http')
const ipv6Expand = require("./ipv6expand")
const db = require('./db')

const server = http.createServer()
//console.log()
const ws = new WebSocketServer.Server({
    server: server,
    perMessageDeflate: false
})

server.on('request', app)

ws.peers = {}
let DBAction = new DBACTION();
DBAction.deleteAll()


ws.on('connection', (conn) => {
    console.log("recieved a connection");

    conn.on('message', async (message) => {
        try {
            message = message.toString()
            message = JSON.parse(message)
            conn.pause()
            if (message.operation == 'reqpair') {
                let peerSession = (await DBAction.getPeer(message.name)).session
                ws.peers[peerSession].send(JSON.stringify({ operation: 'reqpair', name: conn.peer.name, filedata: message.filedata }))
            }
            else if (message.operation == 'acceptreq') {
                let peerSession = (await DBAction.getPeer(message.name))
                ws.peers[peerSession.session].send(JSON.stringify({ operation: 'acceptreq', name: conn.peer.name }))
            }
            else if (message.operation == 'rejectreq') {
                let peerSession = (await DBAction.getPeer(message.name))
                ws.peers[peerSession.session].send(JSON.stringify({ operation: 'rejectreq', name: conn.peer.name }))
            }
            else if (message.operation == 'sendoffer') {
                let peerSession = (await DBAction.getPeer(message.name))
                ws.peers[peerSession.session].send(JSON.stringify({ operation: 'recvoffer', name: conn.peer.name, offer: message.offer }))
            }
            else if (message.operation == 'sendanswer') {
                let peerSession = (await DBAction.getPeer(message.name))
                ws.peers[peerSession.session].send(JSON.stringify({ operation: 'recvanswer', name: conn.peer.name, answer: message.answer }))
            }
            else if (message.operation == 'createhost') {
                if (message.network['ipv6'] != 400) {
                    message.network['ipv6'] = ipv6Expand(message.network['ipv6']).slice(0, 19);
                }
                res = await DBAction.addUser(message.network)
                conn.peer = res.peer
                conn.network = res.network
                ws.peers[conn.peer.session] = conn
                let otherHosts = await DBAction.getNetworkPeers(conn.network, conn.peer);
                let namelist = []
                otherHosts.forEach(element => {
                    ws.peers[element.session].send(JSON.stringify({
                        operation: 'newhost',
                        name: conn.peer.name
                    }))
                    namelist.push(element.name)
                });
                conn.send(JSON.stringify({
                    operation: 'beginhosts',
                    namelist: namelist,
                    name: conn.peer.name
                }))
            }
            else if (message.operation == 'onicecandidate') {

                let peerSession = (await DBAction.getPeer(message.name))
                ws.peers[peerSession.session].send(JSON.stringify({ operation: 'updateIce', name: conn.peer.name, ice: message.sdp }))

            }
            conn.resume()
        }
        catch (err) {

        }
    })

    conn.on('close', async () => {
        try{
        if (conn.network != undefined) {
            let otherHosts = await DBAction.getNetworkPeers(conn.network, conn.peer);
            otherHosts.forEach(element => {
                ws.peers[element.session].send(JSON.stringify({
                    operation: 'hostleft',
                    name: conn.peer.name
                }))
            });
            delete ws.peers[conn.peer.session]
            DBAction.popPeer(conn.network, conn.peer)
        }
    }
    catch(err){
        
    }
    })
})

server.listen(80,()=>console.log("Listening on port 80"));