module.exports = Storage

var fs = require('fs')
var BitField = require('bitfield')
var BlockStream = require('block-stream')
var debug = require('debug')('webtorrent:storage')
var dezalgo = require('dezalgo')
var eos = require('end-of-stream')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var FileStream = require('./file-stream')
var inherits = require('inherits')
var MultiStream = require('multistream')
var once = require('once')
var sha1 = require('simple-sha1')

var BLOCK_LENGTH = 16 * 1024


function Piece(index, storage) {
    this.index = index
    this.storage = storage
    this.path = storage.getPath() + "/" + index
}

Piece.read = function(offset, length, cb) {
    fs.open(this.path, 'r', function(err, fd) {
        if (err) return cb(err)
        var buf = new Buffer(length)
        fs.read(fd, buf, offset, length, 0, function(err, bytesRead, buf) {
            if (!err && bytesRead !== length) {
                err = new Error("Short read")
            }
            
            fs.close(fd, function() {
                cb(err, buf)
            })
        })
    })
}

Piece.write = function(offset, data, cb) {
    fs.open(this.path, 'w', function(err, fd) {
        if (err) return cb(err)
        
        fs.write(fd, data, offset, data.length, 0, function(err, bytesWritten, buf) {
            if (!err && bytesWritten !== data.length) {
                err = new Error("Short write")
            }
            
            fs.close(fd, function() {
                cb(err)
            })
        })
    })
}

inherits(Storage, EventEmitter)

function Storage (options) {
    EventEmitter.call(self)

    this.pieceLength = options.pieceLength
    this.bitfield = new BitField(0, { grow: Infinity })
    this.reserved = new BitField(0, { grow: Infinity })
}

Storage.prototype.getPiece = function(index) {
    return new Piece(index, this)
}

Storage.prototype.getPath = function (index, offset, length) {
    return this.root + "/" + this.infoHash
}

/**
 * Reads a block from a piece.
 *
 * @param {number}    index    piece index
 * @param {number}    offset   byte offset within piece
 * @param {number}    length   length in bytes to read from piece
 * @param {function}  cb
 */
Storage.prototype.readPiece = function (index, offset, length, cb) {
    var piece = this.getPiece(index)
    if (piece) {
        piece.read(offset, length, cb)
    } else {
        cb(new Error('No such piece ' + index))
    }
}

Storage.prototype.read = function (offset, length, cb) {
    var index = Math.floor(offset / this.pieceLength)
    offset -= index * this.pieceLength
    var bufs = []
    var run = function () {
        if (length < 1) {
            if (bufs.length == 1) {
                return cb(null, bufs[0])
            } else {
                return cb(null, Buffer.concat(bufs))
            }
        }
        
        this.readPiece(index, offset, length, function(err, data) {
            data = data.slice(offset, offset + length)
            bufs.push(data)
            offset += data.length
            length -= data.length
            // recurse:
            run()
        })
    }.bind(this)
    
    run()
}

/**
 * Writes a block to a piece.
 *
 * @param {number}  index    piece index
 * @param {number}  offset   byte offset within piece
 * @param {Buffer}  buffer   buffer to write
 * @param {function}  cb
 */
Storage.prototype.writePiece = function (index, offset, buf, cb) {
    var piece = this.getPiece(index)
    if (piece) {
        piece.read(offset, length, cb)
    } else {
        cb(new Error('No such piece ' + index))
    }
}

Storage.prototype.write = function (offset, data, cb) {
    var index = Math.floor(offset / this.pieceLength)
    offset -= index * this.pieceLength
    var run = function () {
        if (data.length < 1) {
            return cb()
        }

        var data1 = data.slice(offset, Math.min(this.pieceLength - offset, data.length))
        data = data.slice(data1.length)
        offset = 0
        this.writePiece(index, offset, data1, function(err) {
            if (err) {
                return cb(err)
            }
            // recurse:
            run()
        })
    }.bind(this)
    
    run()
}

/**
 * Reads a piece or a range of a piece.
 *
 * @param {number}   index         piece index
 * @param {Object=}  range         optional range within piece
 * @param {number}   range.offset  byte offset within piece
 * @param {number}   range.length  length in bytes to read from piece
 * @param {function} cb
 * @param {boolean}  force         optionally overrides default check preventing reading
 *                                 from unverified piece
 */
// Storage.prototype.read = function (index, range, cb, force) {
//   var self = this

//   if (typeof range === 'function') {
//     force = cb
//     cb = range
//     range = null
//   }
//   cb = dezalgo(cb)

//   var piece = self.pieces[index]
//   if (!piece) {
//     return cb(new Error('invalid piece index ' + index))
//   }

//   if (!piece.verified && !force) {
//     return cb(new Error('Storage.read called on incomplete piece ' + index))
//   }

//   var offset = 0
//   var length = piece.length

//   if (range) {
//     offset = range.offset || 0
//     length = range.length || length
//   }

//   if (piece.buffer) {
//     // shortcut for piece with static backing buffer
//     return cb(null, piece.buffer.slice(offset, offset + length))
//   }

//   var blocks = []
//   function readNextBlock () {
//     if (length <= 0) return cb(null, Buffer.concat(blocks))

//     var blockOffset = offset
//     var blockLength = Math.min(BLOCK_LENGTH, length)

//     offset += blockLength
//     length -= blockLength

//     self.readBlock(index, blockOffset, blockLength, function (err, block) {
//       if (err) return cb(err)

//       blocks.push(block)
//       readNextBlock()
//     })
//   }

//   readNextBlock()
// }

// /**
//  * Reserves a block from the given piece.
//  *
//  * @param {number}  index    piece index
//  * @param {Boolean} endGame  whether or not end game mode is enabled
//  *
//  * @returns {Object|null} reservation with offset and length or null if failed.
//  */
// Storage.prototype.reserveBlock = function (index, endGame) {
//   var self = this
//   var piece = self.pieces[index]
//   if (!piece) return null

//   return piece.reserveBlock(endGame)
// }

// /**
//  * Cancels a previous block reservation from the given piece.
//  *
//  * @param {number}  index   piece index
//  * @param {number}  offset  byte offset of block in piece
//  *
//  * @returns {Boolean}
//  */
// Storage.prototype.cancelBlock = function (index, offset) {
//   var self = this
//   var piece = self.pieces[index]
//   if (!piece) return false

//   return piece.cancelBlock(offset)
// }

Storage.prototype.isInterestedIn = function(bitfield) {
    for(var i = 0; i < this.bitfield.length && i < bitfield.length; i++) {
        // they have one we don't have yet
        if (bitfield.get(i) && !this.bitfield.get(i)) {
            return true
        }
    }
    return false
}

Storage.prototype.nextToDownload = function(bitfield) {
    // TODO: for Peer#canRequest()
    return []
}

