/* Provides functionality for torrenting
 Works via the WebTorrent module */

var WebTorrent = require('webtorrent')
  , concat = require('concat-stream')
  , prettysize = require('prettysize')
  , request = require('request')
  , toBuffer = require('typedarray-to-buffer')
  , md5 = require('MD5');

var kvStoreURL = 'http://raymondjacobson.com:3000/';

client = new WebTorrent();

/* Download handler, to send callbacks */
var onTorrentDownload = function(torrent, callback) {
  // console.log(torrent.infoHash);
  console.log(torrent.swarm);
  torrent.swarm.on('download', function () {
    var progress = (100 * torrent.downloaded / torrent.parsedTorrent.length).toFixed(1)
    console.log('%c progress: ' + progress + '% -- download speed: ' + prettysize(torrent.swarm.downloadSpeed()) + '/s', 'color: #3B6F25');
  });
  files = [];
  torrent.files.forEach(function (file) {
    files.push(file);
    file.createReadStream().pipe(concat(function (buf) {
      /* Download of file is done */
      new_url = URL.createObjectURL(new Blob([ buf ]));
      callback(new_url);
    }));
  });
}

/* Downloads the torrent for a given assetURL */
module.exports = {
 download: function(assetURL, callback) {
  /* First, get the hash_info for the torrent file */
  var getUrl = kvStoreURL + 'get/' + md5(assetURL);
  request(getUrl, function(error, resp, body) {
    if (body.length >= 1) {
      /* Download the torrent */
      // console.log(body);
      client.add({
        infoHash: body,
        announce: [ 'wss://tracker.webtorrent.io' ]
      }, function(torrent) {
        onTorrentDownload(torrent, callback);
      });
    }
    /* Return out -1 if we couldn't look up in KV Store */
    else {
      callback(-1);
    }
  });
},


/* Uploads the torrent given an assetURL */
upload: function(assetURL) {
  var xhr=new XMLHttpRequest;
  xhr.responseType='blob';
  xhr.open('GET',assetURL,true);
  xhr.send();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      bb = xhr.response;
      bb.name = assetURL.split('/').pop(); 
      bb.lastModifiedDate = 0;
      var reader = new FileReader();
      reader.addEventListener('load', function (e) {
        var buffer = toBuffer(new Uint8Array(e.target.result))
        bb.buffer = buffer;
        new_url = URL.createObjectURL(bb);
        // console.log(new_url);
        client.seed([bb], function(torrent) {
          var putUrl = kvStoreURL + 'put/' + md5(assetURL) + '/' + torrent.infoHash;
          // console.log(putUrl);
          console.log(torrent);
          torrent.swarm.on('upload', function (){
            console.log('%c Upload Speed: ' + prettysize(client.uploadSpeed()) + '/s',  'color: #502F8E')
          });
          request(putUrl, function(error, resp, body) {});
        });
      });
      reader.addEventListener('error', function (err) {
        console.error('FileReader error' + err);
      });
      reader.readAsArrayBuffer(bb);
    }
  }
}
}