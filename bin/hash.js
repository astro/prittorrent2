var fs = require('fs');
var ProgressBar = require('progress');
var PT = require('..');

process.on('uncaughtException', function(err) {
    console.error(err.stack);
    process.exit(1);
});

if (process.argv.length !== 4) {
      process.exit(1);
}

var bar = new ProgressBar('Hashing: :percent [:bar] :etas', {
    total: 1,
    width: 40,
    complete: ".",
    incomplete: " "
});

var m = process.argv[2].match(/^(https?:\/\/.+\/)([^\/]+)$/);
PT.hasher({
    root: m[1],
    files: [m[2]],
    callback: function(err, torrent) {
        bar.terminate();
        if (err) {
            console.error(err.stack);
            process.exit(1);
        }

        console.log("Writing " + torrent.length + " bytes to torrent file");
        fs.writeFile(process.argv[3], torrent, function(err) {
            if (err) {
                console.error(err.stack);
                process.exit(1);
            }
            
            console.log("Done");
        });
    },
    progress: function(progress) {
        bar.total = progress.total;
        bar.tick(progress.delta);
    }
});
