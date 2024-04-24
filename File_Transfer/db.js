const mongoose = require("mongoose");

const peer = new mongoose.Schema({
    session: String,
    name: String,
    sdp: String
})

const network_group = new mongoose.Schema({
    addr4: String,
    addr6: String,
    peers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Peer"
        }
    ]
})

const Peer = mongoose.model('Peer', peer)
const NetworkGroup = mongoose.model('Network_Users', network_group)

module.exports = {
    Peer: Peer,
    NetworkGroup: NetworkGroup
}