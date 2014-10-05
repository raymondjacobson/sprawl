// Provides functionality for torrenting
// Works via the WebTorrent module

var WebTorrent = require('webtorrent')
  , contact = require('concat-stream')
  , prettysize = require('prettysize');

client = new WebTorrent();

// Downloads the torrent for a given assetURL
var download = function(assetURL) {
  client.add({

  });
}