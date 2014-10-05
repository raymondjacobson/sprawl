// Provides functionality for torrenting
// Works via the WebTorrent module

var WebTorrent = require('webtorrent')
  , contact = require('concat-stream')
  , prettysize = require('prettysize')
  , request = require('request')
  , toBuffer = require('typedarray-to-buffer');

var kvStoreURL = "http://raymondjacobson.com:3000/";

client = new WebTorrent();

// Downloads the torrent for a given assetURL
var download = function(assetURL) {
  // First, get the hash_info for the torrent file
  var getUrl = kvStoreURL + "get/" + assetURL;
  request(getUrl, function(error, resp, body) {
    if (!error && response.statusCode == 200) {
      // Download the torrent
      client.add({
        infoHash: body,
        announce: [ 'wss://tracker.webtorrent.io' ]
      }, onTorrentDownload);
    }
    else {
      return -1;
    }
  });
}

// Download handler, to send callbacks
var onTorrentDownload = function(torrent) {
  console.log(torrent.infoHash);
  console.log(torrent.swarm);
  torrent.swarm.on('download', function () {
    var progress = (100 * torrent.downloaded / torrent.parsedTorrent.length).toFixed(1)
    console.log('progress: ' + progress + '% -- download speed: ' + prettysize(torrent.swarm.downloadSpeed()) + '/s')
  });
  files = [];
  torrent.files.forEach(function (file) {
    files.push(file);
    file.createReadStream().pipe(concat(function (buf) {
      // Download of file is done
      console.log(file.name);
      // var a = document.createElement('a');
      // a.download = file.name;
      // a.href = URL.createObjectURL(new Blob([ buf ]));
      // a.textContent = 'download ' + file.name;
      // document.getElementById("dragdrop").innerHTML += "<p>" + a.outerHTML + "</p>";
    }));
  });
}

// Uploads the torrent given an assetURL
var upload = function(assetURL) {
  var xhr=new XMLHttpRequest;
  xhr.responseType='blob';
  xhr.open('GET',assetURL,true);
  xhr.send();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      bb = xhr.response;
      bb.name = url.split('/').pop(); 
      bb.lastModifiedDate = 0;
      var reader = new FileReader();
      reader.addEventListener('load', function (e) {
        var buffer = toBuffer(new Uint8Array(e.target.result))
        bb.buffer = buffer;
        new_url = URL.createObjectURL(bb);
        client.seed([bb], function(torrent) {
          var putUrl = kvStoreURL + "put/" + assetURL + "/" + torrent.infoHash;
          request(putUrl, function(error, resp, body) {});
        }));
      });
      reader.addEventListener('error', function (err) {
        console.error('FileReader error' + err);
      });
      reader.readAsArrayBuffer(bb);
    }
  }
}