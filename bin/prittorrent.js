#!/usr/bin/env node

var path = require('path')
var os = require('os')
var TrackerServer = require('bittorrent-tracker').Server
var express = require('express')
var readTorrent = require('read-torrent');
var hat = require('hat')

var PT = require('..')

var IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/
var IPV6_RE = /^[0-9a-fA-F:]+$/
var IPV6_LL_RE = /^fe[89ab].:/

if (process.argv.length !== 3) {
    console.error('Pass config.js')
    process.exit(1)
}

var configPath = process.argv[2]
var config = require(/^\//.test(configPath) ?
                     configPath :
                     process.cwd() + "/" + configPath
                    )
var model = new PT.Model(config.model)
var app = express()

function handleErr(err, res) {
    if (err) {
        res.status(500)
        res.set('Content-Type', 'text/html')
        res.write(err.stack)
        res.end()
        return true
    }
    return false
}

/* Hasher API */

// TODO:
// * Auth!
// * Progress updates?
app.post('/hash', function(req, res) {
    console.log("hash req", req.params, req.query);
    var root = req.query.root
    var files = req.query.file
    files = typeof files == 'array' ?
        files :
        [files]
    if (!root) {
        console.log("Seeking root for: " + files.join(" "))
        files.forEach(function(file) {
            if (!root) root = path.dirname(file) + "/"
            while(file.slice(0, root.length) !== root) {
                root = root.replace(/\/+$/, "")
                    .replace(/\/[^\/]+$/, "/")
            }
        })
        files = files.map(function(file) {
            return file.slice(root.length)
        })
        console.log("New root:", root)
    }
    
    var pieceLength = req.query.piece_length
    if (pieceLength) pieceLength = parseInt(pieceLength, 10)

    PT.hasher({
        root: root,
        files: files,
        pieceLength: pieceLength,
        announceList: config.hasher.announceList,
        callback: function(err, torrent) {
            if (handleErr(err, res)) return

            readTorrent(torrent, function(err, parsed) {
                if (handleErr(err, res)) return
                
                var infoHash = parsed.infoHash
                model.addTorrent(infoHash, torrent, function(err) {
                    if (handleErr(err, res)) return
                    
                    res.status(201)
                    res.set('Content-Type', 'application/x-bittorrent')
                    res.set('Location', "/torrent/" + infoHash)
                    res.end()
                })
            })
        }
    });
});

app.get("/torrent/:infoHash", function(req, res) {
    model.getTorrent(req.params.infoHash, function(err, torrent) {
        if (handleErr(err, res)) return

        res.status(200)
        res.set('Content-Type', 'application/x-bittorrent')
        res.write(torrent)
        res.end()
    })
})

/* Torrent tracker */

var superPeers = []
function updateSuperPeers() {
    var newSuperPeers = []
    function addAddress(address) {
        newSuperPeers.push({
            ip: address,
            port: config.seeder.port,
            // TODO: get from seeder
            'peer id': hat(160)
        })
    }
    var interfaces = os.networkInterfaces()
    config.seeder.addresses.forEach(function(address) {
        if (IPV4_RE.test(address) || IPV6_RE.test(address)) {
            addAddress(address)
        } else {
            (interfaces[address] || []).forEach(function(conf) {
                if (!IPV6_LL_RE.test(conf.address)) {
                    addAddress(conf.address)
                }
            })
        }
    })
    superPeers = newSuperPeers
}
updateSuperPeers()
console.log("My superPeers:", superPeers)
setInterval(updateSuperPeers, 60 * 1000)

    
var tracker = new TrackerServer({
  http: false, // we do our own
  udp: true
})
var origGetSwarm = tracker.getSwarm.bind(tracker)
tracker.getSwarm = function(infoHash) {
    var swarm = origGetSwarm(infoHash)
    var origGetPeers = swarm._getPeers.bind(swarm)
    swarm._getPeers = function(numwant) {
        return origGetPeers(numwant).concat(superPeers)
    }
    return swarm
}

var onHttpRequest = tracker.onHttpRequest.bind(tracker)
app.get('/announce', onHttpRequest)
app.get('/scrape', onHttpRequest)


app.listen(config.httpPort, "::")
