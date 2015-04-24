module.exports.storage = {
    path: '/tmp/prittorrent',
    minDiskFree: 1 * 1024 * 1024 * 1024
}

module.exports.hasher = {
    announceList: [[
        "http://localhost:8080/announce"
    ]]
}

module.exports.seeder = {
    addresses: ["lo", "eth0", "eth1", "eth2", "wlan0"],
    bind: "::",
    port: 6881
}

module.exports.model = {
    path: '/tmp/prittorrent-db'
}

module.exports.httpPort = 8080
