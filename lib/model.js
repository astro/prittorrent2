var level = require('level')
var sublevel = require('sublevel')


function Model(config) {
    this.db = level(config.path, {
        valueEncoding: 'binary'
    })
}
module.exports = Model


Model.prototype.addTorrentInfo = function(infoHash, data, cb) {
    sublevel(this.db, 'torrent.info').put(infoHash, data, cb)
}

Model.prototype.getTorrentInfo = function(infoHash, cb) {
    sublevel(this.db, 'torrent.info').get(infoHash, cb)
}
