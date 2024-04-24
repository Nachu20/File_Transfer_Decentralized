const express = require('express');
//const dotenv=require("dotenv").config();
class DBACTION {
    constructor() {
        this.mongoose = require("mongoose");
        this.db = require("./db")
        this.Moniker = require('moniker');
        this.crypto = require('crypto');
        this.mongoose.connect(
            "mongodb://127.0.0.1:27017/File_Transfer",
            {   useNewUrlParser: true,
                useUnifiedTopology: true,
            }
        )
    }
    generate_key = function () {
        return this.crypto.randomBytes(16).toString('base64');
    };

    addUser = async (network) => {
        // It checks if the randomly chosen name already exists in the database. If it does, the loop continues until a unique name is found.
        do {
            var name = this.Moniker.choose();
        }
        while ((await this.db.Peer.find({ name: name })).length != 0)

        do {
            var session = this.generate_key();
        }
        while ((await this.db.Peer.find({ session: session })).length != 0)
            //The code snippet checks if a peer's IP address (either IPv4 or IPv6) already exists in the database
        let peernew = new this.db.Peer({ session: session, name: name })
        await peernew.save();
        var networkgroup = await this.db.NetworkGroup.find({
            $or: [
                { addr4: network['ipv4'] },
                { addr6: network['ipv6'] }
            ]
        })

        //this logic ensures that the new peer is associated with the correct NetworkGroup based on its IPv4 or IPv6 address. If no matching group exists, a new group is created, and if a group already exists, the new peer is added to that group.
        let networkgroupLen = networkgroup.length
        if (networkgroupLen == 0) {
            networkgroup = new this.db.NetworkGroup({ addr4: network['ipv4'],addr6: network['ipv6'], peers: [peernew] })
            await networkgroup.save();
        }
        else {

            await this.db.NetworkGroup.updateOne({ 
                $or : [
                    {addr4:network['ipv4']},
                    {addr6:network['ipv6']}
                ]
             },
                {
                    $set:{
                        addr4:network['ipv4'],
                        addr6:network['ipv6']
                    },
                    $push: {
                        peers: peernew
                    }
                }
            ).exec()

        }

//This code queries the NetworkGroup collection to find a specific network group that matches either the IPv4 or IPv6 address of the network passed in as network.
        var networkgroup = await this.db.NetworkGroup.findOne({ 
            $or : [
                {addr4:network['ipv4']},
                {addr6:network['ipv6']},
            ]
         })

        return { peer: peernew, network: networkgroup }
    }
    //updateNetwork is an async function that updates the SDP (Session Description Protocol) information for a peer in the database.
   updateNetwork = async (peer, sdp) => {
    try {
        await this.db.Peer.updateOne(
            { session: peer.session },
            { $set: { sdp: sdp } }
        ).exec();
    } catch (error) {
        console.error('Error updating network:', error);
        // Handle the error as needed, such as logging or notifying the user
    }
}
//This function ensures the integrity of the network groups by removing peers properly and deleting empty network groups when necessary.
popPeer = async (network, peer) => {
    try {
        await this.db.NetworkGroup.updateOne(
            { $or: [{ addr4: network.addr4 }, { addr6: network.addr6 }] },
            { $pullAll: { peers: [{ _id: peer._id }] } }
        ).exec();

        let netgrp = await this.db.NetworkGroup.findOne(
            { $or: [{ addr4: network.addr4 }, { addr6: network.addr6 }] }
        ).exec();

        if (netgrp.peers.length == 0) {
            await netgrp.deleteOne();
        }

        await this.db.Peer.deleteOne({ _id: peer._id }).exec();
    } catch (error) {
        console.error('Error popping peer:', error);
        // Handle the error as needed, such as logging or notifying the user
    }
}

getNetworkPeers = async (network, currPeer) => {
    try {
        const peersDB = (await this.db.NetworkGroup.findOne(
            { $or: [{ addr4: network.addr4 }, { addr6: network.addr6 }] }
        )).peers;

        const currentSession = currPeer.session;
        const peers = [];

        for (let i = 0; i < peersDB.length; i++) {
            const peer = await this.db.Peer.findOne({ _id: peersDB[i]._id });
            if (peer.session != currentSession) {
                peers.push(peer);
            }
        }

        return peers;
    } catch (error) {
        console.error('Error getting network peers:', error);
        return []; // Return an empty array or handle the error as needed
    }
}

deleteAll = async () => {
    try {
        await this.db.NetworkGroup.deleteMany().exec();
        await this.db.Peer.deleteMany().exec();
    } catch (error) {
        console.error('Error deleting all:', error);
        // Handle the error as needed, such as logging or notifying the user
    }
}

getPeer = async (name) => {
    try {
        return await this.db.Peer.findOne({ name: name }).exec();
    } catch (error) {
        console.error('Error getting peer:', error);
        return null; // Return null or handle the error as needed
    }
}
}

var app = express();


app.get('/', function (req, res) {
    res.sendFile(__dirname + '/templates/index.html')
});

app.use(express.static(__dirname + '/static'))

module.exports = { app: app, DBACTION: DBACTION };