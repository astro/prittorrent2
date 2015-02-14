var level = require('level')
var sublevel = require('sublevel')


function Model(config) {
    this.db = level(config.path, {
        valueEncoding: 'binary'
    })
}
module.exports = Model


Model.prototype.addTorrent = function(infoHash, torrent, cb) {
    sublevel(this.db, 'torrents').put(infoHash, torrent, cb)
}

Model.prototype.getTorrent = function(infoHash, cb) {
    sublevel(this.db, 'torrents').get(infoHash, cb)
}
