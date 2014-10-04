// Provides functionality for torrenting
// Works via the WebTorrent module

var WebTorrent = require('webtorrent')
  , contact = require('concat-stream')
  , prettysize = require('prettysize');

client = new WebTorrent();