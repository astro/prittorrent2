var net = require('net')
var util = require('util')
var hat = require('hat')
var Wire = require('bittorrent-protocol')
var ut_metadata = require('ut_metadata')
var ut_pex = require('ut_pex') // browser exclude

var version = require('../package.json').version
        .split(".")
        .map(function(s) {
            return parseInt(s, 10)
        })
while(version.length < 4)
    version.push(0)

// From BEP-0020
var VERSION_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-"

function generatePeerId() {
    function v(n) {
        if (n < VERSION_CHARS.length) {
            return VERSION_CHARS[n]
        } else {
            throw ("Invalid version number: " + n)
        }
    }
    return Buffer.concat([
        new Buffer("-<3" + version.map(v).join("") + "-"),
        new Buffer(hat(96), 'hex')
    ]).toString('hex')
}

function Seeder(options) {
    this.peerId = generatePeerId()
    this.peers = []
    this.getTorrent = options.getTorrent
    this.storage = options.storage
    
    var server = net.createServer(this._onConnection.bind(this))
    server.on('error', function(err) {
        throw err
    })
    server.listen(options.port, options.bind)
}
module.exports = Seeder

Seeder.prototype._onConnection = function(conn) {
    var addr = conn.remoteAddress + ':' + conn.remotePort
    console.log("new peer: " + addr)
    var peer = new Peer(conn, {
          peerId: this.peerId,
          storage: this.storage
    })
    peer.on('handshake', function(infoHash, respond) {
        if (Buffer.isBuffer(infoHash))
            infoHash = infoHash.toString('hex')
        this.getTorrent(infoHash, respond)
    }.bind(this))
            
    this.peers.push(peer)
    conn.on('end', function() {
        console.log("end peer: " + addr)
        // May remove torrent:
        // TODO: if (torrent.peers.length < 1) delete torrent
        // Remove peer:
        var pos = this.peers.indexOf(peer)
        this.peers.splice(pos, 1)
    }.bind(this))
}


util.inherits(Peer, process.EventEmitter)
function Peer(conn, options) {
    process.EventEmitter.call(this)

    var oldWrite = conn.write
    conn.write = function(data) {
        console.log("conn.write", data)
        oldWrite.apply(conn, arguments)
    }

    this.storage = options.storage
    this.storage.on('block_complete', this.canInterest.bind(this))

    this.wire = new Wire()
    conn.pipe(this.wire).pipe(conn)
    this.wire.setKeepAlive(true)
    this.wire.on('handshake', function(infoHash, peerId, extensions) {
        if (peerId === options.peerId) {
            // Connected to ourselves?
            setImmediate(function() {
                this.wire.end()
            })
            return
        }
        
        console.log("Handshake", infoHash, peerId, extensions)
        this.emit('handshake', infoHash, function respond(err, info) {
            if (err) {
                console.error("handshake response", err.stack)
                this.wire.end()
                return
            }

            console.log("send handshake")
            // this.wire.handshake(infoHash, options.peerId, null)
            this.wire.use(ut_metadata(info))
            // this.wire.use(ut_pex())
            console.log("Handshake sent")
        }.bind(this))
        this.wire.handshake(infoHash, options.peerId, null)
    }.bind(this))
    this.wire.on('extended', function() {
        console.log("extended", arguments)
    })
    this.wire.on('bitfield', function(bitfield) {
        this.canInterest()
        // unchoke by default:
        this.unchoke()
    })
    this.wire.on('unchoke', this.canRequest.bind(this))
    this.wire.on('request', function(index, offset, length, respond) {
        var cb = function(err, buffer) {
            if (err) {
                console.error(err)
            }
            respond(cb)
            if (err) {
                this.wire.end()
            }
        }.bind(this)

        if (length > 32 * 1024) {
            cb(new Error('request size too large'))
        } else {
            this.storage.readBlock(index, offset, length, cb)
        }
    }.bind(this))
    this.wire.on('error', function(e) {
        console.error(e.stack)
    })
}

Peer.prototype.canInterest = function() {
    if (this.storage.isInterestedIn(this.wire.peerPieces)) {
        this.wire.interested()
    } else {
        this.wire.uninterested()
    }
}

Peer.prototype.canRequest = function() {
    var reqs = this.storage.nextToDownload(this.wire.peerPieces);
}
