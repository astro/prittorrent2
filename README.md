Bitlovemaker
Prittorrent
Bithorse
Btpublish
Bitcovery

# Synopsis

A .torrent publishing pipeline: hasher + seeder

# Use-cases

Parentheses denote optional features.

## Bitlove.org backend

- [ ] Hasher driven by loop talking to PostgreSQL
- [ ] HTTP client: writes to disk cache, moves once info_hash is known
- [ ] (Hasher: make Webseeding url-list optional)
- [ ] Disk cache, Web-seeded
  - [ ] Main knob: disk space to keep free
- Seeders
  - [ ] (Slaves?)

## BitTorrent publishing pipeline

- [ ] Metadata in a DB:
  - [ ] Hashed torrents by this instance/cached
  - [ ] (Stats)
- [x] Webseed Hasher:
  - [x] HTTP API for publishing, serving .torrent files
  - [ ] Feed hashed data into disk cache
  - [ ] (HTTP client: SOCKS5 support)
  - [ ] (File-system backed storage?)
- [x] Tracker
  - [x] Serves local seeders adresses
- [ ] Seeder
  - [ ] Disk cache
  - [ ] (Foreign trackers?)

## Content Distribution Network

- [ ] Seeder/HTTP server:
  - [ ] Streaming downloads
  - [ ] RFC 6249: Metalink/HTTP: Mirrors and Hashes
  - [ ] Slave redirector
  - [ ] (Bandwidth limits)
  - [ ] (Fair queueing)
  - [x] Built-in tracker
  - [ ] E-tag = InfoHash?
  - [ ] (HTTPS support)
  - [ ] (Public Dashboard for a complete Bitlove replacement)

- [ ] (Slave support:)
  - [ ] C/S connection
  - [ ] Shared password
  - [ ] Slave serves files of any servers
    - [ ] BitTorrent: By id (ask all masters)
    - [ ] HTTP: By path (conflict avoidance by grouping torrents into
      sets? servers publish sets to slaves?)
    - [ ] Emit statistics
  - [ ] Master reuses trusted slaves' addresses to:
    - [ ] Redirect HTTP for load-balancing
      - [ ] (by load & GeoIP distance)
      - [ ] Include in tracker responses
  - [ ] Controlled shutdown: deregister synchronously from master, wait
    for HTTP downloads to finish


