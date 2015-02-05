var request = require('request');
var createTorrent = require('create-torrent');
var series = require('run-series');

var MIN_PIECE_LENGTH = 128 * 1024;
var OPTIMAL_PIECE_COUNT = 1000;


function hash(options) {
    options.callback = options.callback || function() {};
    
    getFileSizes(options.files.map(function(file) {
        return options.root + file;
    }), function(err, sizes) {
        if (err) {
            return options.cb(err);
        }
        
        var total = sizes.reduce(function(total, size) {
            return total + (typeof size === 'number' ? size : 0);
        });
        var pieceLength = Math.max(MIN_PIECE_LENGTH,
                                   Math.pow(2, Math.floor(Math.log(total / OPTIMAL_PIECE_COUNT) * Math.LOG2E)));
        createTorrent(options.files.map(function(file) {
            var url = options.root + file;
            var stream = request.get(url);
            stream.name = file;
            return stream;
        }), {
            pieceLength: pieceLength,
            urlList: [options.root]
        }, options.callback);
    });
}

module.exports = hash;



function getFileSizes(files, cb) {
    series(files.map(function(file) {
        return function(cb) {
            request({
                method: 'HEAD',
                uri: file
            }, function(err, res, body) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, parseInt(res.headers['content-length'], 10));
                }
            });
        };
    }), cb);
}