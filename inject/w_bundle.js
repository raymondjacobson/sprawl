(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/raymond/code/hackupstate-fall-2014/sprawl/inject/torrent.js":[function(require,module,exports){
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
},{"MD5":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/md5.js","concat-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/index.js","prettysize":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/prettysize/index.js","request":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/index.js","typedarray-to-buffer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/typedarray-to-buffer/index.js","webtorrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/inject/worker.js":[function(require,module,exports){
var torrent = require('./torrent');

self.addEventListener('message', function(e) {
    var data = e.data;

    switch (data.cmd) {
        case 'start':
            self.postMessage('Worker Started');
        break;
        case 'stop':
            self.postMessage('Worker Stopped');
            self.close();
        break;
        case 'image':
            handle(e.data.url,self.postMessage);
        break;
        default:
            self.postMessage('Unknown command: ' + data.msg);
    };
}, false);


function handle (url,callback) {

    callback({ cmd: 'message', message: 'received url, retrieving data...'});

/*
    $.get(url,function (res) {
        callback({ cmd: 'response', url: url, data: res, type: 'server'});
    });
*/

    torrent.download(url, function (res) {
        if (res === -1) {
            torrent.upload(url);
            callback({ cmd: 'response', url: -1, type: 'server'});
        }
        else {
            callback({ cmd: 'response', url: res, type: 'torrent'});
        }
    });


}

},{"./torrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/inject/torrent.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/md5.js":[function(require,module,exports){
(function (Buffer){
(function(){
  var crypt = require('crypt'),
      utf8 = require('charenc').utf8,
      bin = require('charenc').bin,

  // The core
  md5 = function (message, options) {
    // Convert to byte array
    if (message.constructor == String)
      if (options && options.encoding === 'binary')
        message = bin.stringToBytes(message);
      else
        message = utf8.stringToBytes(message);
    else if (typeof Buffer != 'undefined' &&
        typeof Buffer.isBuffer == 'function' && Buffer.isBuffer(message))
      message = Array.prototype.slice.call(message, 0);
    else if (!Array.isArray(message))
      message = message.toString();
    // else, assume byte array already

    var m = crypt.bytesToWords(message),
        l = message.length * 8,
        a =  1732584193,
        b = -271733879,
        c = -1732584194,
        d =  271733878;

    // Swap endian
    for (var i = 0; i < m.length; i++) {
      m[i] = ((m[i] <<  8) | (m[i] >>> 24)) & 0x00FF00FF |
             ((m[i] << 24) | (m[i] >>>  8)) & 0xFF00FF00;
    }

    // Padding
    m[l >>> 5] |= 0x80 << (l % 32);
    m[(((l + 64) >>> 9) << 4) + 14] = l;

    // Method shortcuts
    var FF = md5._ff,
        GG = md5._gg,
        HH = md5._hh,
        II = md5._ii;

    for (var i = 0; i < m.length; i += 16) {

      var aa = a,
          bb = b,
          cc = c,
          dd = d;

      a = FF(a, b, c, d, m[i+ 0],  7, -680876936);
      d = FF(d, a, b, c, m[i+ 1], 12, -389564586);
      c = FF(c, d, a, b, m[i+ 2], 17,  606105819);
      b = FF(b, c, d, a, m[i+ 3], 22, -1044525330);
      a = FF(a, b, c, d, m[i+ 4],  7, -176418897);
      d = FF(d, a, b, c, m[i+ 5], 12,  1200080426);
      c = FF(c, d, a, b, m[i+ 6], 17, -1473231341);
      b = FF(b, c, d, a, m[i+ 7], 22, -45705983);
      a = FF(a, b, c, d, m[i+ 8],  7,  1770035416);
      d = FF(d, a, b, c, m[i+ 9], 12, -1958414417);
      c = FF(c, d, a, b, m[i+10], 17, -42063);
      b = FF(b, c, d, a, m[i+11], 22, -1990404162);
      a = FF(a, b, c, d, m[i+12],  7,  1804603682);
      d = FF(d, a, b, c, m[i+13], 12, -40341101);
      c = FF(c, d, a, b, m[i+14], 17, -1502002290);
      b = FF(b, c, d, a, m[i+15], 22,  1236535329);

      a = GG(a, b, c, d, m[i+ 1],  5, -165796510);
      d = GG(d, a, b, c, m[i+ 6],  9, -1069501632);
      c = GG(c, d, a, b, m[i+11], 14,  643717713);
      b = GG(b, c, d, a, m[i+ 0], 20, -373897302);
      a = GG(a, b, c, d, m[i+ 5],  5, -701558691);
      d = GG(d, a, b, c, m[i+10],  9,  38016083);
      c = GG(c, d, a, b, m[i+15], 14, -660478335);
      b = GG(b, c, d, a, m[i+ 4], 20, -405537848);
      a = GG(a, b, c, d, m[i+ 9],  5,  568446438);
      d = GG(d, a, b, c, m[i+14],  9, -1019803690);
      c = GG(c, d, a, b, m[i+ 3], 14, -187363961);
      b = GG(b, c, d, a, m[i+ 8], 20,  1163531501);
      a = GG(a, b, c, d, m[i+13],  5, -1444681467);
      d = GG(d, a, b, c, m[i+ 2],  9, -51403784);
      c = GG(c, d, a, b, m[i+ 7], 14,  1735328473);
      b = GG(b, c, d, a, m[i+12], 20, -1926607734);

      a = HH(a, b, c, d, m[i+ 5],  4, -378558);
      d = HH(d, a, b, c, m[i+ 8], 11, -2022574463);
      c = HH(c, d, a, b, m[i+11], 16,  1839030562);
      b = HH(b, c, d, a, m[i+14], 23, -35309556);
      a = HH(a, b, c, d, m[i+ 1],  4, -1530992060);
      d = HH(d, a, b, c, m[i+ 4], 11,  1272893353);
      c = HH(c, d, a, b, m[i+ 7], 16, -155497632);
      b = HH(b, c, d, a, m[i+10], 23, -1094730640);
      a = HH(a, b, c, d, m[i+13],  4,  681279174);
      d = HH(d, a, b, c, m[i+ 0], 11, -358537222);
      c = HH(c, d, a, b, m[i+ 3], 16, -722521979);
      b = HH(b, c, d, a, m[i+ 6], 23,  76029189);
      a = HH(a, b, c, d, m[i+ 9],  4, -640364487);
      d = HH(d, a, b, c, m[i+12], 11, -421815835);
      c = HH(c, d, a, b, m[i+15], 16,  530742520);
      b = HH(b, c, d, a, m[i+ 2], 23, -995338651);

      a = II(a, b, c, d, m[i+ 0],  6, -198630844);
      d = II(d, a, b, c, m[i+ 7], 10,  1126891415);
      c = II(c, d, a, b, m[i+14], 15, -1416354905);
      b = II(b, c, d, a, m[i+ 5], 21, -57434055);
      a = II(a, b, c, d, m[i+12],  6,  1700485571);
      d = II(d, a, b, c, m[i+ 3], 10, -1894986606);
      c = II(c, d, a, b, m[i+10], 15, -1051523);
      b = II(b, c, d, a, m[i+ 1], 21, -2054922799);
      a = II(a, b, c, d, m[i+ 8],  6,  1873313359);
      d = II(d, a, b, c, m[i+15], 10, -30611744);
      c = II(c, d, a, b, m[i+ 6], 15, -1560198380);
      b = II(b, c, d, a, m[i+13], 21,  1309151649);
      a = II(a, b, c, d, m[i+ 4],  6, -145523070);
      d = II(d, a, b, c, m[i+11], 10, -1120210379);
      c = II(c, d, a, b, m[i+ 2], 15,  718787259);
      b = II(b, c, d, a, m[i+ 9], 21, -343485551);

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return crypt.endian([a, b, c, d]);
  };

  // Auxiliary functions
  md5._ff  = function (a, b, c, d, x, s, t) {
    var n = a + (b & c | ~b & d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._gg  = function (a, b, c, d, x, s, t) {
    var n = a + (b & d | c & ~d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._hh  = function (a, b, c, d, x, s, t) {
    var n = a + (b ^ c ^ d) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };
  md5._ii  = function (a, b, c, d, x, s, t) {
    var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  };

  // Package private blocksize
  md5._blocksize = 16;
  md5._digestsize = 16;

  module.exports = function (message, options) {
    if(typeof message == 'undefined')
      return;

    var digestbytes = crypt.wordsToBytes(md5(message, options));
    return options && options.asBytes ? digestbytes :
        options && options.asString ? bin.bytesToString(digestbytes) :
        crypt.bytesToHex(digestbytes);
  };

})();

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","charenc":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/node_modules/charenc/charenc.js","crypt":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/node_modules/crypt/crypt.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/node_modules/charenc/charenc.js":[function(require,module,exports){
var charenc = {
  // UTF-8 encoding
  utf8: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
    }
  },

  // Binary encoding
  bin: {
    // Convert a string to a byte array
    stringToBytes: function(str) {
      for (var bytes = [], i = 0; i < str.length; i++)
        bytes.push(str.charCodeAt(i) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function(bytes) {
      for (var str = [], i = 0; i < bytes.length; i++)
        str.push(String.fromCharCode(bytes[i]));
      return str.join('');
    }
  }
};

module.exports = charenc;

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/MD5/node_modules/crypt/crypt.js":[function(require,module,exports){
(function() {
  var base64map
      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

  crypt = {
    // Bit-wise rotation left
    rotl: function(n, b) {
      return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotation right
    rotr: function(n, b) {
      return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function(n) {
      // If number given, swap endian
      if (n.constructor == Number) {
        return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
      }

      // Else, assume array and swap all items
      for (var i = 0; i < n.length; i++)
        n[i] = crypt.endian(n[i]);
      return n;
    },

    // Generate an array of any length of random bytes
    randomBytes: function(n) {
      for (var bytes = []; n > 0; n--)
        bytes.push(Math.floor(Math.random() * 256));
      return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function(bytes) {
      for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
        words[b >>> 5] |= bytes[i] << (24 - b % 32);
      return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function(words) {
      for (var bytes = [], b = 0; b < words.length * 32; b += 8)
        bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
      return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function(bytes) {
      for (var hex = [], i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
      }
      return hex.join('');
    },

    // Convert a hex string to a byte array
    hexToBytes: function(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function(bytes) {
      for (var base64 = [], i = 0; i < bytes.length; i += 3) {
        var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        for (var j = 0; j < 4; j++)
          if (i * 8 + j * 6 <= bytes.length * 8)
            base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
          else
            base64.push('=');
      }
      return base64.join('');
    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function(base64) {
      // Remove non-base-64 characters
      base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

      for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
          imod4 = ++i % 4) {
        if (imod4 == 0) continue;
        bytes.push(((base64map.indexOf(base64.charAt(i - 1))
            & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
            | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
      }
      return bytes;
    }
  };

  module.exports = crypt;
})();

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/index.js":[function(require,module,exports){
(function (Buffer){
var Writable = require('readable-stream').Writable
var inherits = require('inherits')
var TA = require('typedarray')
var U8 = typeof Uint8Array !== 'undefined' ? Uint8Array : TA.Uint8Array

function ConcatStream(opts, cb) {
  if (!(this instanceof ConcatStream)) return new ConcatStream(opts, cb)

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  if (!opts) opts = {}

  var encoding = opts.encoding
  var shouldInferEncoding = false

  if (!encoding) {
    shouldInferEncoding = true
  } else {
    encoding =  String(encoding).toLowerCase()
    if (encoding === 'u8' || encoding === 'uint8') {
      encoding = 'uint8array'
    }
  }

  Writable.call(this, { objectMode: true })

  this.encoding = encoding
  this.shouldInferEncoding = shouldInferEncoding

  if (cb) this.on('finish', function () { cb(this.getBody()) })
  this.body = []
}

module.exports = ConcatStream
inherits(ConcatStream, Writable)

ConcatStream.prototype._write = function(chunk, enc, next) {
  this.body.push(chunk)
  next()
}

ConcatStream.prototype.inferEncoding = function (buff) {
  var firstBuffer = buff === undefined ? this.body[0] : buff;
  if (Buffer.isBuffer(firstBuffer)) return 'buffer'
  if (typeof Uint8Array !== 'undefined' && firstBuffer instanceof Uint8Array) return 'uint8array'
  if (Array.isArray(firstBuffer)) return 'array'
  if (typeof firstBuffer === 'string') return 'string'
  if (Object.prototype.toString.call(firstBuffer) === "[object Object]") return 'object'
  return 'buffer'
}

ConcatStream.prototype.getBody = function () {
  if (!this.encoding && this.body.length === 0) return []
  if (this.shouldInferEncoding) this.encoding = this.inferEncoding()
  if (this.encoding === 'array') return arrayConcat(this.body)
  if (this.encoding === 'string') return stringConcat(this.body)
  if (this.encoding === 'buffer') return bufferConcat(this.body)
  if (this.encoding === 'uint8array') return u8Concat(this.body)
  return this.body
}

var isArray = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}

function isArrayish (arr) {
  return /Array\]$/.test(Object.prototype.toString.call(arr))
}

function stringConcat (parts) {
  var strings = []
  var needsToString = false
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (typeof p === 'string') {
      strings.push(p)
    } else if (Buffer.isBuffer(p)) {
      strings.push(p)
    } else {
      strings.push(Buffer(p))
    }
  }
  if (Buffer.isBuffer(parts[0])) {
    strings = Buffer.concat(strings)
    strings = strings.toString('utf8')
  } else {
    strings = strings.join('')
  }
  return strings
}

function bufferConcat (parts) {
  var bufs = []
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i]
    if (Buffer.isBuffer(p)) {
      bufs.push(p)
    } else if (typeof p === 'string' || isArrayish(p)
    || (p && typeof p.subarray === 'function')) {
      bufs.push(Buffer(p))
    } else bufs.push(Buffer(String(p)))
  }
  return Buffer.concat(bufs)
}

function arrayConcat (parts) {
  var res = []
  for (var i = 0; i < parts.length; i++) {
    res.push.apply(res, parts[i])
  }
  return res
}

function u8Concat (parts) {
  var len = 0
  for (var i = 0; i < parts.length; i++) {
    if (typeof parts[i] === 'string') {
      parts[i] = Buffer(parts[i])
    }
    len += parts[i].length
  }
  var u8 = new U8(len)
  for (var i = 0, offset = 0; i < parts.length; i++) {
    var part = parts[i]
    for (var j = 0; j < part.length; j++) {
      u8[offset++] = part[j]
    }
  }
  return u8
}

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js","readable-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/readable.js","typedarray":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/typedarray/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))
},{"./_stream_readable":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_readable.js","./_stream_writable":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_writable.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_passthrough.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_transform.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_readable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;


/*<replacement>*/
var debug = require('util');
if (debug && debug.debuglog) {
  debug = debug.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/


util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (util.isString(chunk) && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (util.isNullOrUndefined(chunk)) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || util.isNull(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (!util.isNumber(n) || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (util.isNull(ret)) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (!util.isNull(ret))
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      process.nextTick(function() {
        emitReadable_(stream);
      });
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      debug('false write response, pause',
            src._readableState.awaitDrain);
      src._readableState.awaitDrain++;
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        var self = this;
        process.nextTick(function() {
          debug('readable nexttick read 0');
          self.read(0);
        });
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    if (!state.reading) {
      debug('resume read 0');
      this.read(0);
    }
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(function() {
      resume_(stream, state);
    });
  }
}

function resume_(stream, state) {
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"./_stream_duplex":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js","isarray":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/isarray/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","string_decoder/":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/string_decoder/index.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_transform.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (!util.isNullOrUndefined(data))
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('prefinish', function() {
    if (util.isFunction(this._flush))
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_writable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (util.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (!util.isFunction(cb))
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.buffer.length)
      clearBuffer(this, state);
  }
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      util.isString(chunk)) {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (util.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, false, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      state.pendingcb--;
      cb(er);
    });
  else {
    state.pendingcb--;
    cb(er);
  }

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.buffer.length) {
      clearBuffer(stream, state);
    }

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  if (stream._writev && state.buffer.length > 1) {
    // Fast case, write everything using _writev()
    var cbs = [];
    for (var c = 0; c < state.buffer.length; c++)
      cbs.push(state.buffer[c].callback);

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
    state.buffer = [];
  } else {
    // Slow case, write chunks one-by-one
    for (var c = 0; c < state.buffer.length; c++) {
      var entry = state.buffer[c];
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }

  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));

};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (util.isFunction(chunk)) {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (!util.isNullOrUndefined(chunk))
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else
      prefinish(stream, state);
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js":[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/isarray/index.js":[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/string_decoder/index.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/readable.js":[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = require('stream');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js","./lib/_stream_passthrough.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_passthrough.js","./lib/_stream_readable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_readable.js","./lib/_stream_transform.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_transform.js","./lib/_stream_writable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_writable.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/typedarray/index.js":[function(require,module,exports){
var undefined = (void 0); // Paranoia

// Beyond this value, index getters/setters (i.e. array[0], array[1]) are so slow to
// create, and consume so much memory, that the browser appears frozen.
var MAX_ARRAY_LENGTH = 1e5;

// Approximations of internal ECMAScript conversion functions
var ECMAScript = (function() {
  // Stash a copy in case other scripts modify these
  var opts = Object.prototype.toString,
      ophop = Object.prototype.hasOwnProperty;

  return {
    // Class returns internal [[Class]] property, used to avoid cross-frame instanceof issues:
    Class: function(v) { return opts.call(v).replace(/^\[object *|\]$/g, ''); },
    HasProperty: function(o, p) { return p in o; },
    HasOwnProperty: function(o, p) { return ophop.call(o, p); },
    IsCallable: function(o) { return typeof o === 'function'; },
    ToInt32: function(v) { return v >> 0; },
    ToUint32: function(v) { return v >>> 0; }
  };
}());

// Snapshot intrinsics
var LN2 = Math.LN2,
    abs = Math.abs,
    floor = Math.floor,
    log = Math.log,
    min = Math.min,
    pow = Math.pow,
    round = Math.round;

// ES5: lock down object properties
function configureProperties(obj) {
  if (getOwnPropNames && defineProp) {
    var props = getOwnPropNames(obj), i;
    for (i = 0; i < props.length; i += 1) {
      defineProp(obj, props[i], {
        value: obj[props[i]],
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
  }
}

// emulate ES5 getter/setter API using legacy APIs
// http://blogs.msdn.com/b/ie/archive/2010/09/07/transitioning-existing-code-to-the-es5-getter-setter-apis.aspx
// (second clause tests for Object.defineProperty() in IE<9 that only supports extending DOM prototypes, but
// note that IE<9 does not support __defineGetter__ or __defineSetter__ so it just renders the method harmless)
var defineProp
if (Object.defineProperty && (function() {
      try {
        Object.defineProperty({}, 'x', {});
        return true;
      } catch (e) {
        return false;
      }
    })()) {
  defineProp = Object.defineProperty;
} else {
  defineProp = function(o, p, desc) {
    if (!o === Object(o)) throw new TypeError("Object.defineProperty called on non-object");
    if (ECMAScript.HasProperty(desc, 'get') && Object.prototype.__defineGetter__) { Object.prototype.__defineGetter__.call(o, p, desc.get); }
    if (ECMAScript.HasProperty(desc, 'set') && Object.prototype.__defineSetter__) { Object.prototype.__defineSetter__.call(o, p, desc.set); }
    if (ECMAScript.HasProperty(desc, 'value')) { o[p] = desc.value; }
    return o;
  };
}

var getOwnPropNames = Object.getOwnPropertyNames || function (o) {
  if (o !== Object(o)) throw new TypeError("Object.getOwnPropertyNames called on non-object");
  var props = [], p;
  for (p in o) {
    if (ECMAScript.HasOwnProperty(o, p)) {
      props.push(p);
    }
  }
  return props;
};

// ES5: Make obj[index] an alias for obj._getter(index)/obj._setter(index, value)
// for index in 0 ... obj.length
function makeArrayAccessors(obj) {
  if (!defineProp) { return; }

  if (obj.length > MAX_ARRAY_LENGTH) throw new RangeError("Array too large for polyfill");

  function makeArrayAccessor(index) {
    defineProp(obj, index, {
      'get': function() { return obj._getter(index); },
      'set': function(v) { obj._setter(index, v); },
      enumerable: true,
      configurable: false
    });
  }

  var i;
  for (i = 0; i < obj.length; i += 1) {
    makeArrayAccessor(i);
  }
}

// Internal conversion functions:
//    pack<Type>()   - take a number (interpreted as Type), output a byte array
//    unpack<Type>() - take a byte array, output a Type-like number

function as_signed(value, bits) { var s = 32 - bits; return (value << s) >> s; }
function as_unsigned(value, bits) { var s = 32 - bits; return (value << s) >>> s; }

function packI8(n) { return [n & 0xff]; }
function unpackI8(bytes) { return as_signed(bytes[0], 8); }

function packU8(n) { return [n & 0xff]; }
function unpackU8(bytes) { return as_unsigned(bytes[0], 8); }

function packU8Clamped(n) { n = round(Number(n)); return [n < 0 ? 0 : n > 0xff ? 0xff : n & 0xff]; }

function packI16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackI16(bytes) { return as_signed(bytes[0] << 8 | bytes[1], 16); }

function packU16(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function unpackU16(bytes) { return as_unsigned(bytes[0] << 8 | bytes[1], 16); }

function packI32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackI32(bytes) { return as_signed(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packU32(n) { return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]; }
function unpackU32(bytes) { return as_unsigned(bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], 32); }

function packIEEE754(v, ebits, fbits) {

  var bias = (1 << (ebits - 1)) - 1,
      s, e, f, ln,
      i, bits, str, bytes;

  function roundToEven(n) {
    var w = floor(n), f = n - w;
    if (f < 0.5)
      return w;
    if (f > 0.5)
      return w + 1;
    return w % 2 ? w + 1 : w;
  }

  // Compute sign, exponent, fraction
  if (v !== v) {
    // NaN
    // http://dev.w3.org/2006/webapi/WebIDL/#es-type-mapping
    e = (1 << ebits) - 1; f = pow(2, fbits - 1); s = 0;
  } else if (v === Infinity || v === -Infinity) {
    e = (1 << ebits) - 1; f = 0; s = (v < 0) ? 1 : 0;
  } else if (v === 0) {
    e = 0; f = 0; s = (1 / v === -Infinity) ? 1 : 0;
  } else {
    s = v < 0;
    v = abs(v);

    if (v >= pow(2, 1 - bias)) {
      e = min(floor(log(v) / LN2), 1023);
      f = roundToEven(v / pow(2, e) * pow(2, fbits));
      if (f / pow(2, fbits) >= 2) {
        e = e + 1;
        f = 1;
      }
      if (e > bias) {
        // Overflow
        e = (1 << ebits) - 1;
        f = 0;
      } else {
        // Normalized
        e = e + bias;
        f = f - pow(2, fbits);
      }
    } else {
      // Denormalized
      e = 0;
      f = roundToEven(v / pow(2, 1 - bias - fbits));
    }
  }

  // Pack sign, exponent, fraction
  bits = [];
  for (i = fbits; i; i -= 1) { bits.push(f % 2 ? 1 : 0); f = floor(f / 2); }
  for (i = ebits; i; i -= 1) { bits.push(e % 2 ? 1 : 0); e = floor(e / 2); }
  bits.push(s ? 1 : 0);
  bits.reverse();
  str = bits.join('');

  // Bits to bytes
  bytes = [];
  while (str.length) {
    bytes.push(parseInt(str.substring(0, 8), 2));
    str = str.substring(8);
  }
  return bytes;
}

function unpackIEEE754(bytes, ebits, fbits) {

  // Bytes to bits
  var bits = [], i, j, b, str,
      bias, s, e, f;

  for (i = bytes.length; i; i -= 1) {
    b = bytes[i - 1];
    for (j = 8; j; j -= 1) {
      bits.push(b % 2 ? 1 : 0); b = b >> 1;
    }
  }
  bits.reverse();
  str = bits.join('');

  // Unpack sign, exponent, fraction
  bias = (1 << (ebits - 1)) - 1;
  s = parseInt(str.substring(0, 1), 2) ? -1 : 1;
  e = parseInt(str.substring(1, 1 + ebits), 2);
  f = parseInt(str.substring(1 + ebits), 2);

  // Produce number
  if (e === (1 << ebits) - 1) {
    return f !== 0 ? NaN : s * Infinity;
  } else if (e > 0) {
    // Normalized
    return s * pow(2, e - bias) * (1 + f / pow(2, fbits));
  } else if (f !== 0) {
    // Denormalized
    return s * pow(2, -(bias - 1)) * (f / pow(2, fbits));
  } else {
    return s < 0 ? -0 : 0;
  }
}

function unpackF64(b) { return unpackIEEE754(b, 11, 52); }
function packF64(v) { return packIEEE754(v, 11, 52); }
function unpackF32(b) { return unpackIEEE754(b, 8, 23); }
function packF32(v) { return packIEEE754(v, 8, 23); }


//
// 3 The ArrayBuffer Type
//

(function() {

  /** @constructor */
  var ArrayBuffer = function ArrayBuffer(length) {
    length = ECMAScript.ToInt32(length);
    if (length < 0) throw new RangeError('ArrayBuffer size is not a small enough positive integer');

    this.byteLength = length;
    this._bytes = [];
    this._bytes.length = length;

    var i;
    for (i = 0; i < this.byteLength; i += 1) {
      this._bytes[i] = 0;
    }

    configureProperties(this);
  };

  exports.ArrayBuffer = exports.ArrayBuffer || ArrayBuffer;

  //
  // 4 The ArrayBufferView Type
  //

  // NOTE: this constructor is not exported
  /** @constructor */
  var ArrayBufferView = function ArrayBufferView() {
    //this.buffer = null;
    //this.byteOffset = 0;
    //this.byteLength = 0;
  };

  //
  // 5 The Typed Array View Types
  //

  function makeConstructor(bytesPerElement, pack, unpack) {
    // Each TypedArray type requires a distinct constructor instance with
    // identical logic, which this produces.

    var ctor;
    ctor = function(buffer, byteOffset, length) {
      var array, sequence, i, s;

      if (!arguments.length || typeof arguments[0] === 'number') {
        // Constructor(unsigned long length)
        this.length = ECMAScript.ToInt32(arguments[0]);
        if (length < 0) throw new RangeError('ArrayBufferView size is not a small enough positive integer');

        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;
      } else if (typeof arguments[0] === 'object' && arguments[0].constructor === ctor) {
        // Constructor(TypedArray array)
        array = arguments[0];

        this.length = array.length;
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          this._setter(i, array._getter(i));
        }
      } else if (typeof arguments[0] === 'object' &&
                 !(arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(sequence<type> array)
        sequence = arguments[0];

        this.length = ECMAScript.ToUint32(sequence.length);
        this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        this.buffer = new ArrayBuffer(this.byteLength);
        this.byteOffset = 0;

        for (i = 0; i < this.length; i += 1) {
          s = sequence[i];
          this._setter(i, Number(s));
        }
      } else if (typeof arguments[0] === 'object' &&
                 (arguments[0] instanceof ArrayBuffer || ECMAScript.Class(arguments[0]) === 'ArrayBuffer')) {
        // Constructor(ArrayBuffer buffer,
        //             optional unsigned long byteOffset, optional unsigned long length)
        this.buffer = buffer;

        this.byteOffset = ECMAScript.ToUint32(byteOffset);
        if (this.byteOffset > this.buffer.byteLength) {
          throw new RangeError("byteOffset out of range");
        }

        if (this.byteOffset % this.BYTES_PER_ELEMENT) {
          // The given byteOffset must be a multiple of the element
          // size of the specific type, otherwise an exception is raised.
          throw new RangeError("ArrayBuffer length minus the byteOffset is not a multiple of the element size.");
        }

        if (arguments.length < 3) {
          this.byteLength = this.buffer.byteLength - this.byteOffset;

          if (this.byteLength % this.BYTES_PER_ELEMENT) {
            throw new RangeError("length of buffer minus byteOffset not a multiple of the element size");
          }
          this.length = this.byteLength / this.BYTES_PER_ELEMENT;
        } else {
          this.length = ECMAScript.ToUint32(length);
          this.byteLength = this.length * this.BYTES_PER_ELEMENT;
        }

        if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
          throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }

      this.constructor = ctor;

      configureProperties(this);
      makeArrayAccessors(this);
    };

    ctor.prototype = new ArrayBufferView();
    ctor.prototype.BYTES_PER_ELEMENT = bytesPerElement;
    ctor.prototype._pack = pack;
    ctor.prototype._unpack = unpack;
    ctor.BYTES_PER_ELEMENT = bytesPerElement;

    // getter type (unsigned long index);
    ctor.prototype._getter = function(index) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = [], i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        bytes.push(this.buffer._bytes[o]);
      }
      return this._unpack(bytes);
    };

    // NONSTANDARD: convenience alias for getter: type get(unsigned long index);
    ctor.prototype.get = ctor.prototype._getter;

    // setter void (unsigned long index, type value);
    ctor.prototype._setter = function(index, value) {
      if (arguments.length < 2) throw new SyntaxError("Not enough arguments");

      index = ECMAScript.ToUint32(index);
      if (index >= this.length) {
        return undefined;
      }

      var bytes = this._pack(value), i, o;
      for (i = 0, o = this.byteOffset + index * this.BYTES_PER_ELEMENT;
           i < this.BYTES_PER_ELEMENT;
           i += 1, o += 1) {
        this.buffer._bytes[o] = bytes[i];
      }
    };

    // void set(TypedArray array, optional unsigned long offset);
    // void set(sequence<type> array, optional unsigned long offset);
    ctor.prototype.set = function(index, value) {
      if (arguments.length < 1) throw new SyntaxError("Not enough arguments");
      var array, sequence, offset, len,
          i, s, d,
          byteOffset, byteLength, tmp;

      if (typeof arguments[0] === 'object' && arguments[0].constructor === this.constructor) {
        // void set(TypedArray array, optional unsigned long offset);
        array = arguments[0];
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + array.length > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        byteOffset = this.byteOffset + offset * this.BYTES_PER_ELEMENT;
        byteLength = array.length * this.BYTES_PER_ELEMENT;

        if (array.buffer === this.buffer) {
          tmp = [];
          for (i = 0, s = array.byteOffset; i < byteLength; i += 1, s += 1) {
            tmp[i] = array.buffer._bytes[s];
          }
          for (i = 0, d = byteOffset; i < byteLength; i += 1, d += 1) {
            this.buffer._bytes[d] = tmp[i];
          }
        } else {
          for (i = 0, s = array.byteOffset, d = byteOffset;
               i < byteLength; i += 1, s += 1, d += 1) {
            this.buffer._bytes[d] = array.buffer._bytes[s];
          }
        }
      } else if (typeof arguments[0] === 'object' && typeof arguments[0].length !== 'undefined') {
        // void set(sequence<type> array, optional unsigned long offset);
        sequence = arguments[0];
        len = ECMAScript.ToUint32(sequence.length);
        offset = ECMAScript.ToUint32(arguments[1]);

        if (offset + len > this.length) {
          throw new RangeError("Offset plus length of array is out of range");
        }

        for (i = 0; i < len; i += 1) {
          s = sequence[i];
          this._setter(offset + i, Number(s));
        }
      } else {
        throw new TypeError("Unexpected argument type(s)");
      }
    };

    // TypedArray subarray(long begin, optional long end);
    ctor.prototype.subarray = function(start, end) {
      function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

      start = ECMAScript.ToInt32(start);
      end = ECMAScript.ToInt32(end);

      if (arguments.length < 1) { start = 0; }
      if (arguments.length < 2) { end = this.length; }

      if (start < 0) { start = this.length + start; }
      if (end < 0) { end = this.length + end; }

      start = clamp(start, 0, this.length);
      end = clamp(end, 0, this.length);

      var len = end - start;
      if (len < 0) {
        len = 0;
      }

      return new this.constructor(
        this.buffer, this.byteOffset + start * this.BYTES_PER_ELEMENT, len);
    };

    return ctor;
  }

  var Int8Array = makeConstructor(1, packI8, unpackI8);
  var Uint8Array = makeConstructor(1, packU8, unpackU8);
  var Uint8ClampedArray = makeConstructor(1, packU8Clamped, unpackU8);
  var Int16Array = makeConstructor(2, packI16, unpackI16);
  var Uint16Array = makeConstructor(2, packU16, unpackU16);
  var Int32Array = makeConstructor(4, packI32, unpackI32);
  var Uint32Array = makeConstructor(4, packU32, unpackU32);
  var Float32Array = makeConstructor(4, packF32, unpackF32);
  var Float64Array = makeConstructor(8, packF64, unpackF64);

  exports.Int8Array = exports.Int8Array || Int8Array;
  exports.Uint8Array = exports.Uint8Array || Uint8Array;
  exports.Uint8ClampedArray = exports.Uint8ClampedArray || Uint8ClampedArray;
  exports.Int16Array = exports.Int16Array || Int16Array;
  exports.Uint16Array = exports.Uint16Array || Uint16Array;
  exports.Int32Array = exports.Int32Array || Int32Array;
  exports.Uint32Array = exports.Uint32Array || Uint32Array;
  exports.Float32Array = exports.Float32Array || Float32Array;
  exports.Float64Array = exports.Float64Array || Float64Array;
}());

//
// 6 The DataView View Type
//

(function() {
  function r(array, index) {
    return ECMAScript.IsCallable(array.get) ? array.get(index) : array[index];
  }

  var IS_BIG_ENDIAN = (function() {
    var u16array = new(exports.Uint16Array)([0x1234]),
        u8array = new(exports.Uint8Array)(u16array.buffer);
    return r(u8array, 0) === 0x12;
  }());

  // Constructor(ArrayBuffer buffer,
  //             optional unsigned long byteOffset,
  //             optional unsigned long byteLength)
  /** @constructor */
  var DataView = function DataView(buffer, byteOffset, byteLength) {
    if (arguments.length === 0) {
      buffer = new exports.ArrayBuffer(0);
    } else if (!(buffer instanceof exports.ArrayBuffer || ECMAScript.Class(buffer) === 'ArrayBuffer')) {
      throw new TypeError("TypeError");
    }

    this.buffer = buffer || new exports.ArrayBuffer(0);

    this.byteOffset = ECMAScript.ToUint32(byteOffset);
    if (this.byteOffset > this.buffer.byteLength) {
      throw new RangeError("byteOffset out of range");
    }

    if (arguments.length < 3) {
      this.byteLength = this.buffer.byteLength - this.byteOffset;
    } else {
      this.byteLength = ECMAScript.ToUint32(byteLength);
    }

    if ((this.byteOffset + this.byteLength) > this.buffer.byteLength) {
      throw new RangeError("byteOffset and length reference an area beyond the end of the buffer");
    }

    configureProperties(this);
  };

  function makeGetter(arrayType) {
    return function(byteOffset, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);

      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }
      byteOffset += this.byteOffset;

      var uint8Array = new exports.Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT),
          bytes = [], i;
      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(uint8Array, i));
      }

      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      return r(new arrayType(new exports.Uint8Array(bytes).buffer), 0);
    };
  }

  DataView.prototype.getUint8 = makeGetter(exports.Uint8Array);
  DataView.prototype.getInt8 = makeGetter(exports.Int8Array);
  DataView.prototype.getUint16 = makeGetter(exports.Uint16Array);
  DataView.prototype.getInt16 = makeGetter(exports.Int16Array);
  DataView.prototype.getUint32 = makeGetter(exports.Uint32Array);
  DataView.prototype.getInt32 = makeGetter(exports.Int32Array);
  DataView.prototype.getFloat32 = makeGetter(exports.Float32Array);
  DataView.prototype.getFloat64 = makeGetter(exports.Float64Array);

  function makeSetter(arrayType) {
    return function(byteOffset, value, littleEndian) {

      byteOffset = ECMAScript.ToUint32(byteOffset);
      if (byteOffset + arrayType.BYTES_PER_ELEMENT > this.byteLength) {
        throw new RangeError("Array index out of range");
      }

      // Get bytes
      var typeArray = new arrayType([value]),
          byteArray = new exports.Uint8Array(typeArray.buffer),
          bytes = [], i, byteView;

      for (i = 0; i < arrayType.BYTES_PER_ELEMENT; i += 1) {
        bytes.push(r(byteArray, i));
      }

      // Flip if necessary
      if (Boolean(littleEndian) === Boolean(IS_BIG_ENDIAN)) {
        bytes.reverse();
      }

      // Write them
      byteView = new exports.Uint8Array(this.buffer, byteOffset, arrayType.BYTES_PER_ELEMENT);
      byteView.set(bytes);
    };
  }

  DataView.prototype.setUint8 = makeSetter(exports.Uint8Array);
  DataView.prototype.setInt8 = makeSetter(exports.Int8Array);
  DataView.prototype.setUint16 = makeSetter(exports.Uint16Array);
  DataView.prototype.setInt16 = makeSetter(exports.Int16Array);
  DataView.prototype.setUint32 = makeSetter(exports.Uint32Array);
  DataView.prototype.setInt32 = makeSetter(exports.Int32Array);
  DataView.prototype.setFloat32 = makeSetter(exports.Float32Array);
  DataView.prototype.setFloat64 = makeSetter(exports.Float64Array);

  exports.DataView = exports.DataView || DataView;

}());

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/prettysize/index.js":[function(require,module,exports){
/*
Copyright (c) 2013, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://yuilibrary.com/license/
*/

var sizes = [
    'Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'
];

/**
Pretty print a size from bytes
@method pretty
@param {Number} size The number to pretty print
@param {Boolean} [nospace=false] Don't print a space
@param {Boolean} [one=false] Only print one character
*/

module.exports = function(size, nospace, one) {
    var mysize, f;

    sizes.forEach(function(f, id) {
        if (one) {
            f = f.slice(0, 1);
        }
        var s = Math.pow(1024, id),
            fixed;
        if (size >= s) {
            fixed = String((size / s).toFixed(1));
            if (fixed.indexOf('.0') === fixed.length - 2) {
                fixed = fixed.slice(0, -2);
            }
            mysize = fixed + (nospace ? '' : ' ') + f;
        }
    });

    // zero handling
    // always prints in Bytes
    if (!mysize) {
        f = (one ? sizes[0].slice(0, 1) : sizes[0]);
        mysize = '0' + (nospace ? '' : ' ') + f;
    }

    return mysize;
};

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/index.js":[function(require,module,exports){
(function (process){
// Copyright 2010-2012 Mikeal Rogers
//
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.

var extend                = require('util')._extend
  , cookies               = require('./lib/cookies')
  , copy                  = require('./lib/copy')
  , helpers               = require('./lib/helpers')
  , isFunction            = helpers.isFunction
  , constructObject       = helpers.constructObject
  , filterForCallback     = helpers.filterForCallback
  , constructOptionsFrom  = helpers.constructOptionsFrom
  , paramsHaveRequestBody = helpers.paramsHaveRequestBody
  ;

// organize params for patch, post, put, head, del
function initParams(uri, options, callback) {
  callback = filterForCallback([options, callback])
  options = constructOptionsFrom(uri, options)

  return constructObject()
    .extend({callback: callback})
    .extend({options: options})
    .extend({uri: options.uri})
    .done()
}

function request (uri, options, callback) {
  if (typeof uri === 'undefined')
    throw new Error('undefined is not a valid uri or options object.')

  var params = initParams(uri, options, callback)
  options = params.options
  options.callback = params.callback
  options.uri = params.uri

  return new request.Request(options)
}

function requester(params) {
  if(typeof params.options._requester === 'function')
    return params.options._requester
  return request
}

request.get = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'GET'
  return requester(params)(params.uri || null, params.options, params.callback)
}

request.head = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'HEAD'

  if (paramsHaveRequestBody(params))
    throw new Error("HTTP HEAD requests MUST NOT include a request body.")

  return requester(params)(params.uri || null, params.options, params.callback)
}

request.post = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'POST'
  return requester(params)(params.uri || null, params.options, params.callback)
}

request.put = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'PUT'
  return requester(params)(params.uri || null, params.options, params.callback)
}

request.patch = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'PATCH'
  return requester(params)(params.uri || null, params.options, params.callback)
}

request.del = function (uri, options, callback) {
  var params = initParams(uri, options, callback)
  params.options.method = 'DELETE'
  return requester(params)(params.uri || null, params.options, params.callback)
}

request.jar = function () {
  return cookies.jar()
}

request.cookie = function (str) {
  return cookies.parse(str)
}

request.defaults = function (options, requester) {

  var wrap = function (method) {
    var headerlessOptions = function (options) {
      options = extend({}, options)
      delete options.headers
      return options
    }

    var getHeaders = function (params, options) {
      return constructObject()
        .extend(options.headers)
        .extend(params.options.headers)
        .done()
    }

    return function (uri, opts, callback) {
      var params = initParams(uri, opts, callback)
      params.options = extend(headerlessOptions(options), params.options)

      if (options.headers)
        params.options.headers = getHeaders(params, options)

      if (isFunction(requester)) {
        if (method === request) {
          method = requester
        } else {
          params.options._requester = requester
        }
      }

      return method(params.options, params.callback)
    }
  }

  defaults          = wrap(this)
  defaults.get      = wrap(this.get)
  defaults.patch    = wrap(this.patch)
  defaults.post     = wrap(this.post)
  defaults.put      = wrap(this.put)
  defaults.head     = wrap(this.head)
  defaults.del      = wrap(this.del)
  defaults.cookie   = wrap(this.cookie)
  defaults.jar      = this.jar
  defaults.defaults = this.defaults
  return defaults
}

request.forever = function (agentOptions, optionsArg) {
  var options = constructObject()
  if (optionsArg) options.extend(optionsArg)
  if (agentOptions) options.agentOptions = agentOptions

  options.extend({forever: true})
  return request.defaults(options.done())
}

// Exports

module.exports = request
request.Request = require('./request')
request.debug = process.env.NODE_DEBUG && /\brequest\b/.test(process.env.NODE_DEBUG)
request.initParams = initParams

}).call(this,require('_process'))
},{"./lib/cookies":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/cookies.js","./lib/copy":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/copy.js","./lib/helpers":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/helpers.js","./request":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/request.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/cookies.js":[function(require,module,exports){
var optional = require('./optional')
  , tough = optional('tough-cookie')
  , Cookie = tough && tough.Cookie
  , CookieJar = tough && tough.CookieJar
  ;

exports.parse = function(str) {
  if (str && str.uri) str = str.uri
  if (typeof str !== 'string') throw new Error("The cookie function only accepts STRING as param")
  if (!Cookie) {
    return null;
  }
  return Cookie.parse(str)
};

exports.jar = function() {
  if (!CookieJar) {
    // tough-cookie not loaded, return a stub object:
    return {
      setCookieSync: function(){},
      getCookieStringSync: function(){},
      getCookiesSync: function(){}
    };
  }
  var jar = new CookieJar();
  jar._jar = jar;  // For backwards compatibility
  return jar;
};

},{"./optional":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/optional.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/copy.js":[function(require,module,exports){
module.exports =
function copy (obj) {
  var o = {}
  Object.keys(obj).forEach(function (i) {
    o[i] = obj[i]
  })
  return o
}
},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/debug.js":[function(require,module,exports){
var util = require('util')
  , request = require('../index')
  ;

module.exports = function debug() {
  if (request.debug) {
    console.error('REQUEST %s', util.format.apply(util, arguments))
  }
}

},{"../index":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/index.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/helpers.js":[function(require,module,exports){
var extend = require('util')._extend

function constructObject(initialObject) {
  initialObject = initialObject || {}

  return {
    extend: function (object) {
      return constructObject(extend(initialObject, object))
    },
    done: function () {
      return initialObject
    }
  }
}

function constructOptionsFrom(uri, options) {
  var params = constructObject()
  if (typeof options === 'object') {
    params.extend(options).extend({uri: uri})
  } else if (typeof uri === 'string') {
    params.extend({uri: uri})
  } else {
    params.extend(uri)
  }
  return params.done()
}

function filterForCallback(values) {
  var callbacks = values.filter(isFunction)
  return callbacks[0]
}

function isFunction(value) {
  return typeof value === 'function'
}

function paramsHaveRequestBody(params) {
  return (
    params.options.body ||
    params.options.requestBodyStream ||
    (params.options.json && typeof params.options.json !== 'boolean') ||
    params.options.multipart
  )
}

exports.isFunction            = isFunction
exports.constructObject       = constructObject
exports.constructOptionsFrom  = constructOptionsFrom
exports.filterForCallback     = filterForCallback
exports.paramsHaveRequestBody = paramsHaveRequestBody

},{"util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/optional.js":[function(require,module,exports){
module.exports = function(moduleName) {
  try {
    return module.parent.require(moduleName);
  } catch (e) {
    // This could mean that we are in a browser context.
    // Add another try catch like it used to be, for backwards compability
    // and browserify reasons.
    try {
      return require(moduleName);
    }
    catch (e) {}
  }
};

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/bl.js":[function(require,module,exports){
(function (Buffer){
var DuplexStream = require('readable-stream').Duplex
  , util         = require('util')

function BufferList (callback) {
  if (!(this instanceof BufferList))
    return new BufferList(callback)

  this._bufs  = []
  this.length = 0

  if (typeof callback == 'function') {
    this._callback = callback

    var piper = function (err) {
      if (this._callback) {
        this._callback(err)
        this._callback = null
      }
    }.bind(this)

    this.on('pipe', function (src) {
      src.on('error', piper)
    })
    this.on('unpipe', function (src) {
      src.removeListener('error', piper)
    })
  }
  else if (Buffer.isBuffer(callback))
    this.append(callback)
  else if (Array.isArray(callback)) {
    callback.forEach(function (b) {
      Buffer.isBuffer(b) && this.append(b)
    }.bind(this))
  }

  DuplexStream.call(this)
}

util.inherits(BufferList, DuplexStream)

BufferList.prototype._offset = function (offset) {
  var tot = 0, i = 0, _t
  for (; i < this._bufs.length; i++) {
    _t = tot + this._bufs[i].length
    if (offset < _t)
      return [ i, offset - tot ]
    tot = _t
  }
}

BufferList.prototype.append = function (buf) {
  var isBuffer = Buffer.isBuffer(buf) ||
                 buf instanceof BufferList

  this._bufs.push(isBuffer ? buf : new Buffer(buf))
  this.length += buf.length
  return this
}

BufferList.prototype._write = function (buf, encoding, callback) {
  this.append(buf)
  if (callback)
    callback()
}

BufferList.prototype._read = function (size) {
  if (!this.length)
    return this.push(null)
  size = Math.min(size, this.length)
  this.push(this.slice(0, size))
  this.consume(size)
}

BufferList.prototype.end = function (chunk) {
  DuplexStream.prototype.end.call(this, chunk)

  if (this._callback) {
    this._callback(null, this.slice())
    this._callback = null
  }
}

BufferList.prototype.get = function (index) {
  return this.slice(index, index + 1)[0]
}

BufferList.prototype.slice = function (start, end) {
  return this.copy(null, 0, start, end)
}

BufferList.prototype.copy = function (dst, dstStart, srcStart, srcEnd) {
  if (typeof srcStart != 'number' || srcStart < 0)
    srcStart = 0
  if (typeof srcEnd != 'number' || srcEnd > this.length)
    srcEnd = this.length
  if (srcStart >= this.length)
    return dst || new Buffer(0)
  if (srcEnd <= 0)
    return dst || new Buffer(0)

  var copy   = !!dst
    , off    = this._offset(srcStart)
    , len    = srcEnd - srcStart
    , bytes  = len
    , bufoff = (copy && dstStart) || 0
    , start  = off[1]
    , l
    , i

  // copy/slice everything
  if (srcStart === 0 && srcEnd == this.length) {
    if (!copy) // slice, just return a full concat
      return Buffer.concat(this._bufs)

    // copy, need to copy individual buffers
    for (i = 0; i < this._bufs.length; i++) {
      this._bufs[i].copy(dst, bufoff)
      bufoff += this._bufs[i].length
    }

    return dst
  }

  // easy, cheap case where it's a subset of one of the buffers
  if (bytes <= this._bufs[off[0]].length - start) {
    return copy
      ? this._bufs[off[0]].copy(dst, dstStart, start, start + bytes)
      : this._bufs[off[0]].slice(start, start + bytes)
  }

  if (!copy) // a slice, we need something to copy in to
    dst = new Buffer(len)

  for (i = off[0]; i < this._bufs.length; i++) {
    l = this._bufs[i].length - start

    if (bytes > l) {
      this._bufs[i].copy(dst, bufoff, start)
    } else {
      this._bufs[i].copy(dst, bufoff, start, start + bytes)
      break
    }

    bufoff += l
    bytes -= l

    if (start)
      start = 0
  }

  return dst
}

BufferList.prototype.toString = function (encoding, start, end) {
  return this.slice(start, end).toString(encoding)
}

BufferList.prototype.consume = function (bytes) {
  while (this._bufs.length) {
    if (bytes > this._bufs[0].length) {
      bytes -= this._bufs[0].length
      this.length -= this._bufs[0].length
      this._bufs.shift()
    } else {
      this._bufs[0] = this._bufs[0].slice(bytes)
      this.length -= bytes
      break
    }
  }
  return this
}

BufferList.prototype.duplicate = function () {
  var i = 0
    , copy = new BufferList()

  for (; i < this._bufs.length; i++)
    copy.append(this._bufs[i])

  return copy
}

BufferList.prototype.destroy = function () {
  this._bufs.length = 0;
  this.length = 0;
  this.push(null);
}

;(function () {
  var methods = {
      'readDoubleBE' : 8
    , 'readDoubleLE' : 8
    , 'readFloatBE'  : 4
    , 'readFloatLE'  : 4
    , 'readInt32BE'  : 4
    , 'readInt32LE'  : 4
    , 'readUInt32BE' : 4
    , 'readUInt32LE' : 4
    , 'readInt16BE'  : 2
    , 'readInt16LE'  : 2
    , 'readUInt16BE' : 2
    , 'readUInt16LE' : 2
    , 'readInt8'     : 1
    , 'readUInt8'    : 1
  }

  for (var m in methods) {
    (function (m) {
      BufferList.prototype[m] = function (offset) {
        return this.slice(offset, offset + methods[m])[m](0)
      }
    }(m))
  }
}())

module.exports = BufferList

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","readable-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/readable.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_duplex.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_passthrough.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_passthrough.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_passthrough.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/lib/_stream_passthrough.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_readable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;
  var ret;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    ret = null;

    // In cases where the decoder did not receive enough data
    // to produce a full chunk, then immediately received an
    // EOF, state.buffer will contain [<Buffer >, <Buffer 00 ...>].
    // howMuchToRead will see this and coerce the amount to
    // read to zero (because it's looking at the length of the
    // first <Buffer > in state.buffer), and we'll end up here.
    //
    // This can only happen via state.decoder -- no other venue
    // exists for pushing a zero-length chunk into state.buffer
    // and triggering this behavior. In this case, we return our
    // remaining data and end the stream, if appropriate.
    if (state.length > 0 && state.decoder) {
      ret = fromList(n, state);
      state.length -= ret.length;
    }

    if (state.length === 0)
      endReadable(this);

    return ret;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    process.nextTick(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    //if (state.objectMode && util.isNullOrUndefined(chunk))
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js","isarray":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/isarray/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","string_decoder/":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/string_decoder/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_transform.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_writable.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      cb(er);
    });
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","core-util-is":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/core-util-is/lib/util.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/core-util-is/lib/util.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/core-util-is/lib/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/isarray/index.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/isarray/index.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/isarray/index.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/isarray/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/string_decoder/index.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/string_decoder/index.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/string_decoder/index.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/concat-stream/node_modules/readable-stream/node_modules/string_decoder/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/readable.js":[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js","./lib/_stream_passthrough.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_passthrough.js","./lib/_stream_readable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_readable.js","./lib/_stream_transform.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_transform.js","./lib/_stream_writable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_writable.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/caseless/index.js":[function(require,module,exports){
function Caseless (dict) {
  this.dict = dict
}
Caseless.prototype.set = function (name, value, clobber) {
  if (typeof name === 'object') {
    for (var i in name) {
      this.set(i, name[i], value)
    }
  } else {
    if (typeof clobber === 'undefined') clobber = true
    var has = this.has(name)

    if (!clobber && has) this.dict[has] = this.dict[has] + ',' + value
    else this.dict[has || name] = value
    return has
  }
}
Caseless.prototype.has = function (name) {
  var keys = Object.keys(this.dict)
    , name = name.toLowerCase()
    ;
  for (var i=0;i<keys.length;i++) {
    if (keys[i].toLowerCase() === name) return keys[i]
  }
  return false
}
Caseless.prototype.get = function (name) {
  var result, re, match
  var headers = this.dict
  Object.keys(headers).forEach(function (key) {
    re = new RegExp(name, 'i')
    match = key.match(re)
    if (match) result = headers[key]
  })
  return result
}
Caseless.prototype.swap = function (name) {
  var has = this.has(name)
  if (!has) throw new Error('There is no header than matches "'+name+'"')
  this.dict[name] = this.dict[has]
  delete this.dict[has]
}
Caseless.prototype.del = function (name) {
  var has = this.has(name)
  return delete this.dict[has || name]
}

module.exports = function (dict) {return new Caseless(dict)}
module.exports.httpify = function (resp, headers) {
  var c = new Caseless(headers)
  resp.setHeader = function (key, value, clobber) {
    return c.set(key, value, clobber)
  }
  resp.hasHeader = function (key) {
    return c.has(key)
  }
  resp.getHeader = function (key) {
    return c.get(key)
  }
  resp.removeHeader = function (key) {
    return c.del(key)
  }
  resp.headers = c.dict
  return c
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/forever-agent/index.js":[function(require,module,exports){
module.exports = ForeverAgent
ForeverAgent.SSL = ForeverAgentSSL

var util = require('util')
  , Agent = require('http').Agent
  , net = require('net')
  , tls = require('tls')
  , AgentSSL = require('https').Agent

function ForeverAgent(options) {
  var self = this
  self.options = options || {}
  self.requests = {}
  self.sockets = {}
  self.freeSockets = {}
  self.maxSockets = self.options.maxSockets || Agent.defaultMaxSockets
  self.minSockets = self.options.minSockets || ForeverAgent.defaultMinSockets
  self.on('free', function(socket, host, port) {
    var name = host + ':' + port
    if (self.requests[name] && self.requests[name].length) {
      self.requests[name].shift().onSocket(socket)
    } else if (self.sockets[name].length < self.minSockets) {
      if (!self.freeSockets[name]) self.freeSockets[name] = []
      self.freeSockets[name].push(socket)
      
      // if an error happens while we don't use the socket anyway, meh, throw the socket away
      var onIdleError = function() {
        socket.destroy()
      }
      socket._onIdleError = onIdleError
      socket.on('error', onIdleError)
    } else {
      // If there are no pending requests just destroy the
      // socket and it will get removed from the pool. This
      // gets us out of timeout issues and allows us to
      // default to Connection:keep-alive.
      socket.destroy()
    }
  })

}
util.inherits(ForeverAgent, Agent)

ForeverAgent.defaultMinSockets = 5


ForeverAgent.prototype.createConnection = net.createConnection
ForeverAgent.prototype.addRequestNoreuse = Agent.prototype.addRequest
ForeverAgent.prototype.addRequest = function(req, host, port) {
  var name = host + ':' + port
  if (this.freeSockets[name] && this.freeSockets[name].length > 0 && !req.useChunkedEncodingByDefault) {
    var idleSocket = this.freeSockets[name].pop()
    idleSocket.removeListener('error', idleSocket._onIdleError)
    delete idleSocket._onIdleError
    req._reusedSocket = true
    req.onSocket(idleSocket)
  } else {
    this.addRequestNoreuse(req, host, port)
  }
}

ForeverAgent.prototype.removeSocket = function(s, name, host, port) {
  if (this.sockets[name]) {
    var index = this.sockets[name].indexOf(s)
    if (index !== -1) {
      this.sockets[name].splice(index, 1)
    }
  } else if (this.sockets[name] && this.sockets[name].length === 0) {
    // don't leak
    delete this.sockets[name]
    delete this.requests[name]
  }
  
  if (this.freeSockets[name]) {
    var index = this.freeSockets[name].indexOf(s)
    if (index !== -1) {
      this.freeSockets[name].splice(index, 1)
      if (this.freeSockets[name].length === 0) {
        delete this.freeSockets[name]
      }
    }
  }

  if (this.requests[name] && this.requests[name].length) {
    // If we have pending requests and a socket gets closed a new one
    // needs to be created to take over in the pool for the one that closed.
    this.createSocket(name, host, port).emit('free')
  }
}

function ForeverAgentSSL (options) {
  ForeverAgent.call(this, options)
}
util.inherits(ForeverAgentSSL, ForeverAgent)

ForeverAgentSSL.prototype.createConnection = createConnectionSSL
ForeverAgentSSL.prototype.addRequestNoreuse = AgentSSL.prototype.addRequest

function createConnectionSSL (port, host, options) {
  if (typeof port === 'object') {
    options = port;
  } else if (typeof host === 'object') {
    options = host;
  } else if (typeof options === 'object') {
    options = options;
  } else {
    options = {};
  }

  if (typeof port === 'number') {
    options.port = port;
  }

  if (typeof host === 'string') {
    options.host = host;
  }

  return tls.connect(options);
}

},{"http":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/index.js","https":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/https-browserify/index.js","net":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","tls":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/json-stringify-safe/stringify.js":[function(require,module,exports){
module.exports = stringify;

function getSerialize (fn, decycle) {
  var seen = [], keys = [];
  decycle = decycle || function(key, value) {
    return '[Circular ' + getPath(value, seen, keys) + ']'
  };
  return function(key, value) {
    var ret = value;
    if (typeof value === 'object' && value) {
      if (seen.indexOf(value) !== -1)
        ret = decycle(key, value);
      else {
        seen.push(value);
        keys.push(key);
      }
    }
    if (fn) ret = fn(key, ret);
    return ret;
  }
}

function getPath (value, seen, keys) {
  var index = seen.indexOf(value);
  var path = [ keys[index] ];
  for (index--; index >= 0; index--) {
    if (seen[index][ path[0] ] === value) {
      value = seen[index];
      path.unshift(keys[index]);
    }
  }
  return '~' + path.join('.');
}

function stringify(obj, fn, spaces, decycle) {
  return JSON.stringify(obj, getSerialize(fn, decycle), spaces);
}

stringify.getSerialize = getSerialize;

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/custom.json":[function(require,module,exports){
module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports={
  "text/jade": [
    "jade"
  ],
  "text/stylus": [
    "stylus",
    "styl"
  ],
  "text/less": [
    "less"
  ],
  "text/x-sass": [
    "sass"
  ],
  "text/x-scss": [
    "scss"
  ],
  "text/coffeescript": [
    "coffee"
  ],
  "text/x-handlebars-template": [
    "hbs"
  ],
  "text/jsx": [
    "jsx"
  ]
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/index.js":[function(require,module,exports){

// types[extension] = type
exports.types = Object.create(null)
// extensions[type] = [extensions]
exports.extensions = Object.create(null)
// define more mime types
exports.define = define

// store the json files
exports.json = {
  mime: require('./mime.json'),
  node: require('./node.json'),
  custom: require('./custom.json'),
}

exports.lookup = function (string) {
  if (!string || typeof string !== "string") return false
  string = string.replace(/.*[\.\/\\]/, '').toLowerCase()
  if (!string) return false
  return exports.types[string] || false
}

exports.extension = function (type) {
  if (!type || typeof type !== "string") return false
  type = type.match(/^\s*([^;\s]*)(?:;|\s|$)/)
  if (!type) return false
  var exts = exports.extensions[type[1].toLowerCase()]
  if (!exts || !exts.length) return false
  return exts[0]
}

// type has to be an exact mime type
exports.charset = function (type) {
  // special cases
  switch (type) {
    case 'application/json': return 'UTF-8'
    case 'application/javascript': return 'UTF-8'
  }

  // default text/* to utf-8
  if (/^text\//.test(type)) return 'UTF-8'

  return false
}

// backwards compatibility
exports.charsets = {
  lookup: exports.charset
}

exports.contentType = function (type) {
  if (!type || typeof type !== "string") return false
  if (!~type.indexOf('/')) type = exports.lookup(type)
  if (!type) return false
  if (!~type.indexOf('charset')) {
    var charset = exports.charset(type)
    if (charset) type += '; charset=' + charset.toLowerCase()
  }
  return type
}

define(exports.json.mime)
define(exports.json.node)
define(exports.json.custom)

function define(json) {
  Object.keys(json).forEach(function (type) {
    var exts = json[type] || []
    exports.extensions[type] = exports.extensions[type] || []
    exts.forEach(function (ext) {
      if (!~exports.extensions[type].indexOf(ext)) exports.extensions[type].push(ext)
      exports.types[ext] = type
    })
  })
}

},{"./custom.json":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/custom.json","./mime.json":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/mime.json","./node.json":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/node.json"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/mime.json":[function(require,module,exports){
module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports={
  "application/1d-interleaved-parityfec": [],
  "application/3gpp-ims+xml": [],
  "application/activemessage": [],
  "application/andrew-inset": [
    "ez"
  ],
  "application/applefile": [],
  "application/applixware": [
    "aw"
  ],
  "application/atom+xml": [
    "atom"
  ],
  "application/atomcat+xml": [
    "atomcat"
  ],
  "application/atomicmail": [],
  "application/atomsvc+xml": [
    "atomsvc"
  ],
  "application/auth-policy+xml": [],
  "application/batch-smtp": [],
  "application/beep+xml": [],
  "application/calendar+xml": [],
  "application/cals-1840": [],
  "application/ccmp+xml": [],
  "application/ccxml+xml": [
    "ccxml"
  ],
  "application/cdmi-capability": [
    "cdmia"
  ],
  "application/cdmi-container": [
    "cdmic"
  ],
  "application/cdmi-domain": [
    "cdmid"
  ],
  "application/cdmi-object": [
    "cdmio"
  ],
  "application/cdmi-queue": [
    "cdmiq"
  ],
  "application/cea-2018+xml": [],
  "application/cellml+xml": [],
  "application/cfw": [],
  "application/cnrp+xml": [],
  "application/commonground": [],
  "application/conference-info+xml": [],
  "application/cpl+xml": [],
  "application/csta+xml": [],
  "application/cstadata+xml": [],
  "application/cu-seeme": [
    "cu"
  ],
  "application/cybercash": [],
  "application/davmount+xml": [
    "davmount"
  ],
  "application/dca-rft": [],
  "application/dec-dx": [],
  "application/dialog-info+xml": [],
  "application/dicom": [],
  "application/dns": [],
  "application/docbook+xml": [
    "dbk"
  ],
  "application/dskpp+xml": [],
  "application/dssc+der": [
    "dssc"
  ],
  "application/dssc+xml": [
    "xdssc"
  ],
  "application/dvcs": [],
  "application/ecmascript": [
    "ecma"
  ],
  "application/edi-consent": [],
  "application/edi-x12": [],
  "application/edifact": [],
  "application/emma+xml": [
    "emma"
  ],
  "application/epp+xml": [],
  "application/epub+zip": [
    "epub"
  ],
  "application/eshop": [],
  "application/example": [],
  "application/exi": [
    "exi"
  ],
  "application/fastinfoset": [],
  "application/fastsoap": [],
  "application/fits": [],
  "application/font-tdpfr": [
    "pfr"
  ],
  "application/framework-attributes+xml": [],
  "application/gml+xml": [
    "gml"
  ],
  "application/gpx+xml": [
    "gpx"
  ],
  "application/gxf": [
    "gxf"
  ],
  "application/h224": [],
  "application/held+xml": [],
  "application/http": [],
  "application/hyperstudio": [
    "stk"
  ],
  "application/ibe-key-request+xml": [],
  "application/ibe-pkg-reply+xml": [],
  "application/ibe-pp-data": [],
  "application/iges": [],
  "application/im-iscomposing+xml": [],
  "application/index": [],
  "application/index.cmd": [],
  "application/index.obj": [],
  "application/index.response": [],
  "application/index.vnd": [],
  "application/inkml+xml": [
    "ink",
    "inkml"
  ],
  "application/iotp": [],
  "application/ipfix": [
    "ipfix"
  ],
  "application/ipp": [],
  "application/isup": [],
  "application/java-archive": [
    "jar"
  ],
  "application/java-serialized-object": [
    "ser"
  ],
  "application/java-vm": [
    "class"
  ],
  "application/javascript": [
    "js"
  ],
  "application/json": [
    "json"
  ],
  "application/jsonml+json": [
    "jsonml"
  ],
  "application/kpml-request+xml": [],
  "application/kpml-response+xml": [],
  "application/lost+xml": [
    "lostxml"
  ],
  "application/mac-binhex40": [
    "hqx"
  ],
  "application/mac-compactpro": [
    "cpt"
  ],
  "application/macwriteii": [],
  "application/mads+xml": [
    "mads"
  ],
  "application/marc": [
    "mrc"
  ],
  "application/marcxml+xml": [
    "mrcx"
  ],
  "application/mathematica": [
    "ma",
    "nb",
    "mb"
  ],
  "application/mathml-content+xml": [],
  "application/mathml-presentation+xml": [],
  "application/mathml+xml": [
    "mathml"
  ],
  "application/mbms-associated-procedure-description+xml": [],
  "application/mbms-deregister+xml": [],
  "application/mbms-envelope+xml": [],
  "application/mbms-msk+xml": [],
  "application/mbms-msk-response+xml": [],
  "application/mbms-protection-description+xml": [],
  "application/mbms-reception-report+xml": [],
  "application/mbms-register+xml": [],
  "application/mbms-register-response+xml": [],
  "application/mbms-user-service-description+xml": [],
  "application/mbox": [
    "mbox"
  ],
  "application/media_control+xml": [],
  "application/mediaservercontrol+xml": [
    "mscml"
  ],
  "application/metalink+xml": [
    "metalink"
  ],
  "application/metalink4+xml": [
    "meta4"
  ],
  "application/mets+xml": [
    "mets"
  ],
  "application/mikey": [],
  "application/mods+xml": [
    "mods"
  ],
  "application/moss-keys": [],
  "application/moss-signature": [],
  "application/mosskey-data": [],
  "application/mosskey-request": [],
  "application/mp21": [
    "m21",
    "mp21"
  ],
  "application/mp4": [
    "mp4s"
  ],
  "application/mpeg4-generic": [],
  "application/mpeg4-iod": [],
  "application/mpeg4-iod-xmt": [],
  "application/msc-ivr+xml": [],
  "application/msc-mixer+xml": [],
  "application/msword": [
    "doc",
    "dot"
  ],
  "application/mxf": [
    "mxf"
  ],
  "application/nasdata": [],
  "application/news-checkgroups": [],
  "application/news-groupinfo": [],
  "application/news-transmission": [],
  "application/nss": [],
  "application/ocsp-request": [],
  "application/ocsp-response": [],
  "application/octet-stream": [
    "bin",
    "dms",
    "lrf",
    "mar",
    "so",
    "dist",
    "distz",
    "pkg",
    "bpk",
    "dump",
    "elc",
    "deploy"
  ],
  "application/oda": [
    "oda"
  ],
  "application/oebps-package+xml": [
    "opf"
  ],
  "application/ogg": [
    "ogx"
  ],
  "application/omdoc+xml": [
    "omdoc"
  ],
  "application/onenote": [
    "onetoc",
    "onetoc2",
    "onetmp",
    "onepkg"
  ],
  "application/oxps": [
    "oxps"
  ],
  "application/parityfec": [],
  "application/patch-ops-error+xml": [
    "xer"
  ],
  "application/pdf": [
    "pdf"
  ],
  "application/pgp-encrypted": [
    "pgp"
  ],
  "application/pgp-keys": [],
  "application/pgp-signature": [
    "asc",
    "sig"
  ],
  "application/pics-rules": [
    "prf"
  ],
  "application/pidf+xml": [],
  "application/pidf-diff+xml": [],
  "application/pkcs10": [
    "p10"
  ],
  "application/pkcs7-mime": [
    "p7m",
    "p7c"
  ],
  "application/pkcs7-signature": [
    "p7s"
  ],
  "application/pkcs8": [
    "p8"
  ],
  "application/pkix-attr-cert": [
    "ac"
  ],
  "application/pkix-cert": [
    "cer"
  ],
  "application/pkix-crl": [
    "crl"
  ],
  "application/pkix-pkipath": [
    "pkipath"
  ],
  "application/pkixcmp": [
    "pki"
  ],
  "application/pls+xml": [
    "pls"
  ],
  "application/poc-settings+xml": [],
  "application/postscript": [
    "ai",
    "eps",
    "ps"
  ],
  "application/prs.alvestrand.titrax-sheet": [],
  "application/prs.cww": [
    "cww"
  ],
  "application/prs.nprend": [],
  "application/prs.plucker": [],
  "application/prs.rdf-xml-crypt": [],
  "application/prs.xsf+xml": [],
  "application/pskc+xml": [
    "pskcxml"
  ],
  "application/qsig": [],
  "application/rdf+xml": [
    "rdf"
  ],
  "application/reginfo+xml": [
    "rif"
  ],
  "application/relax-ng-compact-syntax": [
    "rnc"
  ],
  "application/remote-printing": [],
  "application/resource-lists+xml": [
    "rl"
  ],
  "application/resource-lists-diff+xml": [
    "rld"
  ],
  "application/riscos": [],
  "application/rlmi+xml": [],
  "application/rls-services+xml": [
    "rs"
  ],
  "application/rpki-ghostbusters": [
    "gbr"
  ],
  "application/rpki-manifest": [
    "mft"
  ],
  "application/rpki-roa": [
    "roa"
  ],
  "application/rpki-updown": [],
  "application/rsd+xml": [
    "rsd"
  ],
  "application/rss+xml": [
    "rss"
  ],
  "application/rtf": [
    "rtf"
  ],
  "application/rtx": [],
  "application/samlassertion+xml": [],
  "application/samlmetadata+xml": [],
  "application/sbml+xml": [
    "sbml"
  ],
  "application/scvp-cv-request": [
    "scq"
  ],
  "application/scvp-cv-response": [
    "scs"
  ],
  "application/scvp-vp-request": [
    "spq"
  ],
  "application/scvp-vp-response": [
    "spp"
  ],
  "application/sdp": [
    "sdp"
  ],
  "application/set-payment": [],
  "application/set-payment-initiation": [
    "setpay"
  ],
  "application/set-registration": [],
  "application/set-registration-initiation": [
    "setreg"
  ],
  "application/sgml": [],
  "application/sgml-open-catalog": [],
  "application/shf+xml": [
    "shf"
  ],
  "application/sieve": [],
  "application/simple-filter+xml": [],
  "application/simple-message-summary": [],
  "application/simplesymbolcontainer": [],
  "application/slate": [],
  "application/smil": [],
  "application/smil+xml": [
    "smi",
    "smil"
  ],
  "application/soap+fastinfoset": [],
  "application/soap+xml": [],
  "application/sparql-query": [
    "rq"
  ],
  "application/sparql-results+xml": [
    "srx"
  ],
  "application/spirits-event+xml": [],
  "application/srgs": [
    "gram"
  ],
  "application/srgs+xml": [
    "grxml"
  ],
  "application/sru+xml": [
    "sru"
  ],
  "application/ssdl+xml": [
    "ssdl"
  ],
  "application/ssml+xml": [
    "ssml"
  ],
  "application/tamp-apex-update": [],
  "application/tamp-apex-update-confirm": [],
  "application/tamp-community-update": [],
  "application/tamp-community-update-confirm": [],
  "application/tamp-error": [],
  "application/tamp-sequence-adjust": [],
  "application/tamp-sequence-adjust-confirm": [],
  "application/tamp-status-query": [],
  "application/tamp-status-response": [],
  "application/tamp-update": [],
  "application/tamp-update-confirm": [],
  "application/tei+xml": [
    "tei",
    "teicorpus"
  ],
  "application/thraud+xml": [
    "tfi"
  ],
  "application/timestamp-query": [],
  "application/timestamp-reply": [],
  "application/timestamped-data": [
    "tsd"
  ],
  "application/tve-trigger": [],
  "application/ulpfec": [],
  "application/vcard+xml": [],
  "application/vemmi": [],
  "application/vividence.scriptfile": [],
  "application/vnd.3gpp.bsf+xml": [],
  "application/vnd.3gpp.pic-bw-large": [
    "plb"
  ],
  "application/vnd.3gpp.pic-bw-small": [
    "psb"
  ],
  "application/vnd.3gpp.pic-bw-var": [
    "pvb"
  ],
  "application/vnd.3gpp.sms": [],
  "application/vnd.3gpp2.bcmcsinfo+xml": [],
  "application/vnd.3gpp2.sms": [],
  "application/vnd.3gpp2.tcap": [
    "tcap"
  ],
  "application/vnd.3m.post-it-notes": [
    "pwn"
  ],
  "application/vnd.accpac.simply.aso": [
    "aso"
  ],
  "application/vnd.accpac.simply.imp": [
    "imp"
  ],
  "application/vnd.acucobol": [
    "acu"
  ],
  "application/vnd.acucorp": [
    "atc",
    "acutc"
  ],
  "application/vnd.adobe.air-application-installer-package+zip": [
    "air"
  ],
  "application/vnd.adobe.formscentral.fcdt": [
    "fcdt"
  ],
  "application/vnd.adobe.fxp": [
    "fxp",
    "fxpl"
  ],
  "application/vnd.adobe.partial-upload": [],
  "application/vnd.adobe.xdp+xml": [
    "xdp"
  ],
  "application/vnd.adobe.xfdf": [
    "xfdf"
  ],
  "application/vnd.aether.imp": [],
  "application/vnd.ah-barcode": [],
  "application/vnd.ahead.space": [
    "ahead"
  ],
  "application/vnd.airzip.filesecure.azf": [
    "azf"
  ],
  "application/vnd.airzip.filesecure.azs": [
    "azs"
  ],
  "application/vnd.amazon.ebook": [
    "azw"
  ],
  "application/vnd.americandynamics.acc": [
    "acc"
  ],
  "application/vnd.amiga.ami": [
    "ami"
  ],
  "application/vnd.amundsen.maze+xml": [],
  "application/vnd.android.package-archive": [
    "apk"
  ],
  "application/vnd.anser-web-certificate-issue-initiation": [
    "cii"
  ],
  "application/vnd.anser-web-funds-transfer-initiation": [
    "fti"
  ],
  "application/vnd.antix.game-component": [
    "atx"
  ],
  "application/vnd.apple.installer+xml": [
    "mpkg"
  ],
  "application/vnd.apple.mpegurl": [
    "m3u8"
  ],
  "application/vnd.arastra.swi": [],
  "application/vnd.aristanetworks.swi": [
    "swi"
  ],
  "application/vnd.astraea-software.iota": [
    "iota"
  ],
  "application/vnd.audiograph": [
    "aep"
  ],
  "application/vnd.autopackage": [],
  "application/vnd.avistar+xml": [],
  "application/vnd.blueice.multipass": [
    "mpm"
  ],
  "application/vnd.bluetooth.ep.oob": [],
  "application/vnd.bmi": [
    "bmi"
  ],
  "application/vnd.businessobjects": [
    "rep"
  ],
  "application/vnd.cab-jscript": [],
  "application/vnd.canon-cpdl": [],
  "application/vnd.canon-lips": [],
  "application/vnd.cendio.thinlinc.clientconf": [],
  "application/vnd.chemdraw+xml": [
    "cdxml"
  ],
  "application/vnd.chipnuts.karaoke-mmd": [
    "mmd"
  ],
  "application/vnd.cinderella": [
    "cdy"
  ],
  "application/vnd.cirpack.isdn-ext": [],
  "application/vnd.claymore": [
    "cla"
  ],
  "application/vnd.cloanto.rp9": [
    "rp9"
  ],
  "application/vnd.clonk.c4group": [
    "c4g",
    "c4d",
    "c4f",
    "c4p",
    "c4u"
  ],
  "application/vnd.cluetrust.cartomobile-config": [
    "c11amc"
  ],
  "application/vnd.cluetrust.cartomobile-config-pkg": [
    "c11amz"
  ],
  "application/vnd.collection+json": [],
  "application/vnd.commerce-battelle": [],
  "application/vnd.commonspace": [
    "csp"
  ],
  "application/vnd.contact.cmsg": [
    "cdbcmsg"
  ],
  "application/vnd.cosmocaller": [
    "cmc"
  ],
  "application/vnd.crick.clicker": [
    "clkx"
  ],
  "application/vnd.crick.clicker.keyboard": [
    "clkk"
  ],
  "application/vnd.crick.clicker.palette": [
    "clkp"
  ],
  "application/vnd.crick.clicker.template": [
    "clkt"
  ],
  "application/vnd.crick.clicker.wordbank": [
    "clkw"
  ],
  "application/vnd.criticaltools.wbs+xml": [
    "wbs"
  ],
  "application/vnd.ctc-posml": [
    "pml"
  ],
  "application/vnd.ctct.ws+xml": [],
  "application/vnd.cups-pdf": [],
  "application/vnd.cups-postscript": [],
  "application/vnd.cups-ppd": [
    "ppd"
  ],
  "application/vnd.cups-raster": [],
  "application/vnd.cups-raw": [],
  "application/vnd.curl": [],
  "application/vnd.curl.car": [
    "car"
  ],
  "application/vnd.curl.pcurl": [
    "pcurl"
  ],
  "application/vnd.cybank": [],
  "application/vnd.dart": [
    "dart"
  ],
  "application/vnd.data-vision.rdz": [
    "rdz"
  ],
  "application/vnd.dece.data": [
    "uvf",
    "uvvf",
    "uvd",
    "uvvd"
  ],
  "application/vnd.dece.ttml+xml": [
    "uvt",
    "uvvt"
  ],
  "application/vnd.dece.unspecified": [
    "uvx",
    "uvvx"
  ],
  "application/vnd.dece.zip": [
    "uvz",
    "uvvz"
  ],
  "application/vnd.denovo.fcselayout-link": [
    "fe_launch"
  ],
  "application/vnd.dir-bi.plate-dl-nosuffix": [],
  "application/vnd.dna": [
    "dna"
  ],
  "application/vnd.dolby.mlp": [
    "mlp"
  ],
  "application/vnd.dolby.mobile.1": [],
  "application/vnd.dolby.mobile.2": [],
  "application/vnd.dpgraph": [
    "dpg"
  ],
  "application/vnd.dreamfactory": [
    "dfac"
  ],
  "application/vnd.ds-keypoint": [
    "kpxx"
  ],
  "application/vnd.dvb.ait": [
    "ait"
  ],
  "application/vnd.dvb.dvbj": [],
  "application/vnd.dvb.esgcontainer": [],
  "application/vnd.dvb.ipdcdftnotifaccess": [],
  "application/vnd.dvb.ipdcesgaccess": [],
  "application/vnd.dvb.ipdcesgaccess2": [],
  "application/vnd.dvb.ipdcesgpdd": [],
  "application/vnd.dvb.ipdcroaming": [],
  "application/vnd.dvb.iptv.alfec-base": [],
  "application/vnd.dvb.iptv.alfec-enhancement": [],
  "application/vnd.dvb.notif-aggregate-root+xml": [],
  "application/vnd.dvb.notif-container+xml": [],
  "application/vnd.dvb.notif-generic+xml": [],
  "application/vnd.dvb.notif-ia-msglist+xml": [],
  "application/vnd.dvb.notif-ia-registration-request+xml": [],
  "application/vnd.dvb.notif-ia-registration-response+xml": [],
  "application/vnd.dvb.notif-init+xml": [],
  "application/vnd.dvb.pfr": [],
  "application/vnd.dvb.service": [
    "svc"
  ],
  "application/vnd.dxr": [],
  "application/vnd.dynageo": [
    "geo"
  ],
  "application/vnd.easykaraoke.cdgdownload": [],
  "application/vnd.ecdis-update": [],
  "application/vnd.ecowin.chart": [
    "mag"
  ],
  "application/vnd.ecowin.filerequest": [],
  "application/vnd.ecowin.fileupdate": [],
  "application/vnd.ecowin.series": [],
  "application/vnd.ecowin.seriesrequest": [],
  "application/vnd.ecowin.seriesupdate": [],
  "application/vnd.emclient.accessrequest+xml": [],
  "application/vnd.enliven": [
    "nml"
  ],
  "application/vnd.eprints.data+xml": [],
  "application/vnd.epson.esf": [
    "esf"
  ],
  "application/vnd.epson.msf": [
    "msf"
  ],
  "application/vnd.epson.quickanime": [
    "qam"
  ],
  "application/vnd.epson.salt": [
    "slt"
  ],
  "application/vnd.epson.ssf": [
    "ssf"
  ],
  "application/vnd.ericsson.quickcall": [],
  "application/vnd.eszigno3+xml": [
    "es3",
    "et3"
  ],
  "application/vnd.etsi.aoc+xml": [],
  "application/vnd.etsi.cug+xml": [],
  "application/vnd.etsi.iptvcommand+xml": [],
  "application/vnd.etsi.iptvdiscovery+xml": [],
  "application/vnd.etsi.iptvprofile+xml": [],
  "application/vnd.etsi.iptvsad-bc+xml": [],
  "application/vnd.etsi.iptvsad-cod+xml": [],
  "application/vnd.etsi.iptvsad-npvr+xml": [],
  "application/vnd.etsi.iptvservice+xml": [],
  "application/vnd.etsi.iptvsync+xml": [],
  "application/vnd.etsi.iptvueprofile+xml": [],
  "application/vnd.etsi.mcid+xml": [],
  "application/vnd.etsi.overload-control-policy-dataset+xml": [],
  "application/vnd.etsi.sci+xml": [],
  "application/vnd.etsi.simservs+xml": [],
  "application/vnd.etsi.tsl+xml": [],
  "application/vnd.etsi.tsl.der": [],
  "application/vnd.eudora.data": [],
  "application/vnd.ezpix-album": [
    "ez2"
  ],
  "application/vnd.ezpix-package": [
    "ez3"
  ],
  "application/vnd.f-secure.mobile": [],
  "application/vnd.fdf": [
    "fdf"
  ],
  "application/vnd.fdsn.mseed": [
    "mseed"
  ],
  "application/vnd.fdsn.seed": [
    "seed",
    "dataless"
  ],
  "application/vnd.ffsns": [],
  "application/vnd.fints": [],
  "application/vnd.flographit": [
    "gph"
  ],
  "application/vnd.fluxtime.clip": [
    "ftc"
  ],
  "application/vnd.font-fontforge-sfd": [],
  "application/vnd.framemaker": [
    "fm",
    "frame",
    "maker",
    "book"
  ],
  "application/vnd.frogans.fnc": [
    "fnc"
  ],
  "application/vnd.frogans.ltf": [
    "ltf"
  ],
  "application/vnd.fsc.weblaunch": [
    "fsc"
  ],
  "application/vnd.fujitsu.oasys": [
    "oas"
  ],
  "application/vnd.fujitsu.oasys2": [
    "oa2"
  ],
  "application/vnd.fujitsu.oasys3": [
    "oa3"
  ],
  "application/vnd.fujitsu.oasysgp": [
    "fg5"
  ],
  "application/vnd.fujitsu.oasysprs": [
    "bh2"
  ],
  "application/vnd.fujixerox.art-ex": [],
  "application/vnd.fujixerox.art4": [],
  "application/vnd.fujixerox.hbpl": [],
  "application/vnd.fujixerox.ddd": [
    "ddd"
  ],
  "application/vnd.fujixerox.docuworks": [
    "xdw"
  ],
  "application/vnd.fujixerox.docuworks.binder": [
    "xbd"
  ],
  "application/vnd.fut-misnet": [],
  "application/vnd.fuzzysheet": [
    "fzs"
  ],
  "application/vnd.genomatix.tuxedo": [
    "txd"
  ],
  "application/vnd.geocube+xml": [],
  "application/vnd.geogebra.file": [
    "ggb"
  ],
  "application/vnd.geogebra.tool": [
    "ggt"
  ],
  "application/vnd.geometry-explorer": [
    "gex",
    "gre"
  ],
  "application/vnd.geonext": [
    "gxt"
  ],
  "application/vnd.geoplan": [
    "g2w"
  ],
  "application/vnd.geospace": [
    "g3w"
  ],
  "application/vnd.globalplatform.card-content-mgt": [],
  "application/vnd.globalplatform.card-content-mgt-response": [],
  "application/vnd.gmx": [
    "gmx"
  ],
  "application/vnd.google-earth.kml+xml": [
    "kml"
  ],
  "application/vnd.google-earth.kmz": [
    "kmz"
  ],
  "application/vnd.grafeq": [
    "gqf",
    "gqs"
  ],
  "application/vnd.gridmp": [],
  "application/vnd.groove-account": [
    "gac"
  ],
  "application/vnd.groove-help": [
    "ghf"
  ],
  "application/vnd.groove-identity-message": [
    "gim"
  ],
  "application/vnd.groove-injector": [
    "grv"
  ],
  "application/vnd.groove-tool-message": [
    "gtm"
  ],
  "application/vnd.groove-tool-template": [
    "tpl"
  ],
  "application/vnd.groove-vcard": [
    "vcg"
  ],
  "application/vnd.hal+json": [],
  "application/vnd.hal+xml": [
    "hal"
  ],
  "application/vnd.handheld-entertainment+xml": [
    "zmm"
  ],
  "application/vnd.hbci": [
    "hbci"
  ],
  "application/vnd.hcl-bireports": [],
  "application/vnd.hhe.lesson-player": [
    "les"
  ],
  "application/vnd.hp-hpgl": [
    "hpgl"
  ],
  "application/vnd.hp-hpid": [
    "hpid"
  ],
  "application/vnd.hp-hps": [
    "hps"
  ],
  "application/vnd.hp-jlyt": [
    "jlt"
  ],
  "application/vnd.hp-pcl": [
    "pcl"
  ],
  "application/vnd.hp-pclxl": [
    "pclxl"
  ],
  "application/vnd.httphone": [],
  "application/vnd.hzn-3d-crossword": [],
  "application/vnd.ibm.afplinedata": [],
  "application/vnd.ibm.electronic-media": [],
  "application/vnd.ibm.minipay": [
    "mpy"
  ],
  "application/vnd.ibm.modcap": [
    "afp",
    "listafp",
    "list3820"
  ],
  "application/vnd.ibm.rights-management": [
    "irm"
  ],
  "application/vnd.ibm.secure-container": [
    "sc"
  ],
  "application/vnd.iccprofile": [
    "icc",
    "icm"
  ],
  "application/vnd.igloader": [
    "igl"
  ],
  "application/vnd.immervision-ivp": [
    "ivp"
  ],
  "application/vnd.immervision-ivu": [
    "ivu"
  ],
  "application/vnd.informedcontrol.rms+xml": [],
  "application/vnd.informix-visionary": [],
  "application/vnd.infotech.project": [],
  "application/vnd.infotech.project+xml": [],
  "application/vnd.innopath.wamp.notification": [],
  "application/vnd.insors.igm": [
    "igm"
  ],
  "application/vnd.intercon.formnet": [
    "xpw",
    "xpx"
  ],
  "application/vnd.intergeo": [
    "i2g"
  ],
  "application/vnd.intertrust.digibox": [],
  "application/vnd.intertrust.nncp": [],
  "application/vnd.intu.qbo": [
    "qbo"
  ],
  "application/vnd.intu.qfx": [
    "qfx"
  ],
  "application/vnd.iptc.g2.conceptitem+xml": [],
  "application/vnd.iptc.g2.knowledgeitem+xml": [],
  "application/vnd.iptc.g2.newsitem+xml": [],
  "application/vnd.iptc.g2.newsmessage+xml": [],
  "application/vnd.iptc.g2.packageitem+xml": [],
  "application/vnd.iptc.g2.planningitem+xml": [],
  "application/vnd.ipunplugged.rcprofile": [
    "rcprofile"
  ],
  "application/vnd.irepository.package+xml": [
    "irp"
  ],
  "application/vnd.is-xpr": [
    "xpr"
  ],
  "application/vnd.isac.fcs": [
    "fcs"
  ],
  "application/vnd.jam": [
    "jam"
  ],
  "application/vnd.japannet-directory-service": [],
  "application/vnd.japannet-jpnstore-wakeup": [],
  "application/vnd.japannet-payment-wakeup": [],
  "application/vnd.japannet-registration": [],
  "application/vnd.japannet-registration-wakeup": [],
  "application/vnd.japannet-setstore-wakeup": [],
  "application/vnd.japannet-verification": [],
  "application/vnd.japannet-verification-wakeup": [],
  "application/vnd.jcp.javame.midlet-rms": [
    "rms"
  ],
  "application/vnd.jisp": [
    "jisp"
  ],
  "application/vnd.joost.joda-archive": [
    "joda"
  ],
  "application/vnd.kahootz": [
    "ktz",
    "ktr"
  ],
  "application/vnd.kde.karbon": [
    "karbon"
  ],
  "application/vnd.kde.kchart": [
    "chrt"
  ],
  "application/vnd.kde.kformula": [
    "kfo"
  ],
  "application/vnd.kde.kivio": [
    "flw"
  ],
  "application/vnd.kde.kontour": [
    "kon"
  ],
  "application/vnd.kde.kpresenter": [
    "kpr",
    "kpt"
  ],
  "application/vnd.kde.kspread": [
    "ksp"
  ],
  "application/vnd.kde.kword": [
    "kwd",
    "kwt"
  ],
  "application/vnd.kenameaapp": [
    "htke"
  ],
  "application/vnd.kidspiration": [
    "kia"
  ],
  "application/vnd.kinar": [
    "kne",
    "knp"
  ],
  "application/vnd.koan": [
    "skp",
    "skd",
    "skt",
    "skm"
  ],
  "application/vnd.kodak-descriptor": [
    "sse"
  ],
  "application/vnd.las.las+xml": [
    "lasxml"
  ],
  "application/vnd.liberty-request+xml": [],
  "application/vnd.llamagraphics.life-balance.desktop": [
    "lbd"
  ],
  "application/vnd.llamagraphics.life-balance.exchange+xml": [
    "lbe"
  ],
  "application/vnd.lotus-1-2-3": [
    "123"
  ],
  "application/vnd.lotus-approach": [
    "apr"
  ],
  "application/vnd.lotus-freelance": [
    "pre"
  ],
  "application/vnd.lotus-notes": [
    "nsf"
  ],
  "application/vnd.lotus-organizer": [
    "org"
  ],
  "application/vnd.lotus-screencam": [
    "scm"
  ],
  "application/vnd.lotus-wordpro": [
    "lwp"
  ],
  "application/vnd.macports.portpkg": [
    "portpkg"
  ],
  "application/vnd.marlin.drm.actiontoken+xml": [],
  "application/vnd.marlin.drm.conftoken+xml": [],
  "application/vnd.marlin.drm.license+xml": [],
  "application/vnd.marlin.drm.mdcf": [],
  "application/vnd.mcd": [
    "mcd"
  ],
  "application/vnd.medcalcdata": [
    "mc1"
  ],
  "application/vnd.mediastation.cdkey": [
    "cdkey"
  ],
  "application/vnd.meridian-slingshot": [],
  "application/vnd.mfer": [
    "mwf"
  ],
  "application/vnd.mfmp": [
    "mfm"
  ],
  "application/vnd.micrografx.flo": [
    "flo"
  ],
  "application/vnd.micrografx.igx": [
    "igx"
  ],
  "application/vnd.mif": [
    "mif"
  ],
  "application/vnd.minisoft-hp3000-save": [],
  "application/vnd.mitsubishi.misty-guard.trustweb": [],
  "application/vnd.mobius.daf": [
    "daf"
  ],
  "application/vnd.mobius.dis": [
    "dis"
  ],
  "application/vnd.mobius.mbk": [
    "mbk"
  ],
  "application/vnd.mobius.mqy": [
    "mqy"
  ],
  "application/vnd.mobius.msl": [
    "msl"
  ],
  "application/vnd.mobius.plc": [
    "plc"
  ],
  "application/vnd.mobius.txf": [
    "txf"
  ],
  "application/vnd.mophun.application": [
    "mpn"
  ],
  "application/vnd.mophun.certificate": [
    "mpc"
  ],
  "application/vnd.motorola.flexsuite": [],
  "application/vnd.motorola.flexsuite.adsi": [],
  "application/vnd.motorola.flexsuite.fis": [],
  "application/vnd.motorola.flexsuite.gotap": [],
  "application/vnd.motorola.flexsuite.kmr": [],
  "application/vnd.motorola.flexsuite.ttc": [],
  "application/vnd.motorola.flexsuite.wem": [],
  "application/vnd.motorola.iprm": [],
  "application/vnd.mozilla.xul+xml": [
    "xul"
  ],
  "application/vnd.ms-artgalry": [
    "cil"
  ],
  "application/vnd.ms-asf": [],
  "application/vnd.ms-cab-compressed": [
    "cab"
  ],
  "application/vnd.ms-color.iccprofile": [],
  "application/vnd.ms-excel": [
    "xls",
    "xlm",
    "xla",
    "xlc",
    "xlt",
    "xlw"
  ],
  "application/vnd.ms-excel.addin.macroenabled.12": [
    "xlam"
  ],
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": [
    "xlsb"
  ],
  "application/vnd.ms-excel.sheet.macroenabled.12": [
    "xlsm"
  ],
  "application/vnd.ms-excel.template.macroenabled.12": [
    "xltm"
  ],
  "application/vnd.ms-fontobject": [
    "eot"
  ],
  "application/vnd.ms-htmlhelp": [
    "chm"
  ],
  "application/vnd.ms-ims": [
    "ims"
  ],
  "application/vnd.ms-lrm": [
    "lrm"
  ],
  "application/vnd.ms-office.activex+xml": [],
  "application/vnd.ms-officetheme": [
    "thmx"
  ],
  "application/vnd.ms-opentype": [],
  "application/vnd.ms-package.obfuscated-opentype": [],
  "application/vnd.ms-pki.seccat": [
    "cat"
  ],
  "application/vnd.ms-pki.stl": [
    "stl"
  ],
  "application/vnd.ms-playready.initiator+xml": [],
  "application/vnd.ms-powerpoint": [
    "ppt",
    "pps",
    "pot"
  ],
  "application/vnd.ms-powerpoint.addin.macroenabled.12": [
    "ppam"
  ],
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": [
    "pptm"
  ],
  "application/vnd.ms-powerpoint.slide.macroenabled.12": [
    "sldm"
  ],
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": [
    "ppsm"
  ],
  "application/vnd.ms-powerpoint.template.macroenabled.12": [
    "potm"
  ],
  "application/vnd.ms-printing.printticket+xml": [],
  "application/vnd.ms-project": [
    "mpp",
    "mpt"
  ],
  "application/vnd.ms-tnef": [],
  "application/vnd.ms-wmdrm.lic-chlg-req": [],
  "application/vnd.ms-wmdrm.lic-resp": [],
  "application/vnd.ms-wmdrm.meter-chlg-req": [],
  "application/vnd.ms-wmdrm.meter-resp": [],
  "application/vnd.ms-word.document.macroenabled.12": [
    "docm"
  ],
  "application/vnd.ms-word.template.macroenabled.12": [
    "dotm"
  ],
  "application/vnd.ms-works": [
    "wps",
    "wks",
    "wcm",
    "wdb"
  ],
  "application/vnd.ms-wpl": [
    "wpl"
  ],
  "application/vnd.ms-xpsdocument": [
    "xps"
  ],
  "application/vnd.mseq": [
    "mseq"
  ],
  "application/vnd.msign": [],
  "application/vnd.multiad.creator": [],
  "application/vnd.multiad.creator.cif": [],
  "application/vnd.music-niff": [],
  "application/vnd.musician": [
    "mus"
  ],
  "application/vnd.muvee.style": [
    "msty"
  ],
  "application/vnd.mynfc": [
    "taglet"
  ],
  "application/vnd.ncd.control": [],
  "application/vnd.ncd.reference": [],
  "application/vnd.nervana": [],
  "application/vnd.netfpx": [],
  "application/vnd.neurolanguage.nlu": [
    "nlu"
  ],
  "application/vnd.nitf": [
    "ntf",
    "nitf"
  ],
  "application/vnd.noblenet-directory": [
    "nnd"
  ],
  "application/vnd.noblenet-sealer": [
    "nns"
  ],
  "application/vnd.noblenet-web": [
    "nnw"
  ],
  "application/vnd.nokia.catalogs": [],
  "application/vnd.nokia.conml+wbxml": [],
  "application/vnd.nokia.conml+xml": [],
  "application/vnd.nokia.isds-radio-presets": [],
  "application/vnd.nokia.iptv.config+xml": [],
  "application/vnd.nokia.landmark+wbxml": [],
  "application/vnd.nokia.landmark+xml": [],
  "application/vnd.nokia.landmarkcollection+xml": [],
  "application/vnd.nokia.n-gage.ac+xml": [],
  "application/vnd.nokia.n-gage.data": [
    "ngdat"
  ],
  "application/vnd.nokia.ncd": [],
  "application/vnd.nokia.pcd+wbxml": [],
  "application/vnd.nokia.pcd+xml": [],
  "application/vnd.nokia.radio-preset": [
    "rpst"
  ],
  "application/vnd.nokia.radio-presets": [
    "rpss"
  ],
  "application/vnd.novadigm.edm": [
    "edm"
  ],
  "application/vnd.novadigm.edx": [
    "edx"
  ],
  "application/vnd.novadigm.ext": [
    "ext"
  ],
  "application/vnd.ntt-local.file-transfer": [],
  "application/vnd.ntt-local.sip-ta_remote": [],
  "application/vnd.ntt-local.sip-ta_tcp_stream": [],
  "application/vnd.oasis.opendocument.chart": [
    "odc"
  ],
  "application/vnd.oasis.opendocument.chart-template": [
    "otc"
  ],
  "application/vnd.oasis.opendocument.database": [
    "odb"
  ],
  "application/vnd.oasis.opendocument.formula": [
    "odf"
  ],
  "application/vnd.oasis.opendocument.formula-template": [
    "odft"
  ],
  "application/vnd.oasis.opendocument.graphics": [
    "odg"
  ],
  "application/vnd.oasis.opendocument.graphics-template": [
    "otg"
  ],
  "application/vnd.oasis.opendocument.image": [
    "odi"
  ],
  "application/vnd.oasis.opendocument.image-template": [
    "oti"
  ],
  "application/vnd.oasis.opendocument.presentation": [
    "odp"
  ],
  "application/vnd.oasis.opendocument.presentation-template": [
    "otp"
  ],
  "application/vnd.oasis.opendocument.spreadsheet": [
    "ods"
  ],
  "application/vnd.oasis.opendocument.spreadsheet-template": [
    "ots"
  ],
  "application/vnd.oasis.opendocument.text": [
    "odt"
  ],
  "application/vnd.oasis.opendocument.text-master": [
    "odm"
  ],
  "application/vnd.oasis.opendocument.text-template": [
    "ott"
  ],
  "application/vnd.oasis.opendocument.text-web": [
    "oth"
  ],
  "application/vnd.obn": [],
  "application/vnd.oftn.l10n+json": [],
  "application/vnd.oipf.contentaccessdownload+xml": [],
  "application/vnd.oipf.contentaccessstreaming+xml": [],
  "application/vnd.oipf.cspg-hexbinary": [],
  "application/vnd.oipf.dae.svg+xml": [],
  "application/vnd.oipf.dae.xhtml+xml": [],
  "application/vnd.oipf.mippvcontrolmessage+xml": [],
  "application/vnd.oipf.pae.gem": [],
  "application/vnd.oipf.spdiscovery+xml": [],
  "application/vnd.oipf.spdlist+xml": [],
  "application/vnd.oipf.ueprofile+xml": [],
  "application/vnd.oipf.userprofile+xml": [],
  "application/vnd.olpc-sugar": [
    "xo"
  ],
  "application/vnd.oma-scws-config": [],
  "application/vnd.oma-scws-http-request": [],
  "application/vnd.oma-scws-http-response": [],
  "application/vnd.oma.bcast.associated-procedure-parameter+xml": [],
  "application/vnd.oma.bcast.drm-trigger+xml": [],
  "application/vnd.oma.bcast.imd+xml": [],
  "application/vnd.oma.bcast.ltkm": [],
  "application/vnd.oma.bcast.notification+xml": [],
  "application/vnd.oma.bcast.provisioningtrigger": [],
  "application/vnd.oma.bcast.sgboot": [],
  "application/vnd.oma.bcast.sgdd+xml": [],
  "application/vnd.oma.bcast.sgdu": [],
  "application/vnd.oma.bcast.simple-symbol-container": [],
  "application/vnd.oma.bcast.smartcard-trigger+xml": [],
  "application/vnd.oma.bcast.sprov+xml": [],
  "application/vnd.oma.bcast.stkm": [],
  "application/vnd.oma.cab-address-book+xml": [],
  "application/vnd.oma.cab-feature-handler+xml": [],
  "application/vnd.oma.cab-pcc+xml": [],
  "application/vnd.oma.cab-user-prefs+xml": [],
  "application/vnd.oma.dcd": [],
  "application/vnd.oma.dcdc": [],
  "application/vnd.oma.dd2+xml": [
    "dd2"
  ],
  "application/vnd.oma.drm.risd+xml": [],
  "application/vnd.oma.group-usage-list+xml": [],
  "application/vnd.oma.pal+xml": [],
  "application/vnd.oma.poc.detailed-progress-report+xml": [],
  "application/vnd.oma.poc.final-report+xml": [],
  "application/vnd.oma.poc.groups+xml": [],
  "application/vnd.oma.poc.invocation-descriptor+xml": [],
  "application/vnd.oma.poc.optimized-progress-report+xml": [],
  "application/vnd.oma.push": [],
  "application/vnd.oma.scidm.messages+xml": [],
  "application/vnd.oma.xcap-directory+xml": [],
  "application/vnd.omads-email+xml": [],
  "application/vnd.omads-file+xml": [],
  "application/vnd.omads-folder+xml": [],
  "application/vnd.omaloc-supl-init": [],
  "application/vnd.openofficeorg.extension": [
    "oxt"
  ],
  "application/vnd.openxmlformats-officedocument.custom-properties+xml": [],
  "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": [],
  "application/vnd.openxmlformats-officedocument.drawing+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": [],
  "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": [],
  "application/vnd.openxmlformats-officedocument.extended-properties+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx"
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.slide": [
    "sldx"
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": [
    "ppsx"
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.template": [
    "potx"
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": [],
  "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "xlsx"
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": [
    "xltx"
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": [],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": [],
  "application/vnd.openxmlformats-officedocument.theme+xml": [],
  "application/vnd.openxmlformats-officedocument.themeoverride+xml": [],
  "application/vnd.openxmlformats-officedocument.vmldrawing": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx"
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": [
    "dotx"
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": [],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": [],
  "application/vnd.openxmlformats-package.core-properties+xml": [],
  "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": [],
  "application/vnd.openxmlformats-package.relationships+xml": [],
  "application/vnd.quobject-quoxdocument": [],
  "application/vnd.osa.netdeploy": [],
  "application/vnd.osgeo.mapguide.package": [
    "mgp"
  ],
  "application/vnd.osgi.bundle": [],
  "application/vnd.osgi.dp": [
    "dp"
  ],
  "application/vnd.osgi.subsystem": [
    "esa"
  ],
  "application/vnd.otps.ct-kip+xml": [],
  "application/vnd.palm": [
    "pdb",
    "pqa",
    "oprc"
  ],
  "application/vnd.paos.xml": [],
  "application/vnd.pawaafile": [
    "paw"
  ],
  "application/vnd.pg.format": [
    "str"
  ],
  "application/vnd.pg.osasli": [
    "ei6"
  ],
  "application/vnd.piaccess.application-licence": [],
  "application/vnd.picsel": [
    "efif"
  ],
  "application/vnd.pmi.widget": [
    "wg"
  ],
  "application/vnd.poc.group-advertisement+xml": [],
  "application/vnd.pocketlearn": [
    "plf"
  ],
  "application/vnd.powerbuilder6": [
    "pbd"
  ],
  "application/vnd.powerbuilder6-s": [],
  "application/vnd.powerbuilder7": [],
  "application/vnd.powerbuilder7-s": [],
  "application/vnd.powerbuilder75": [],
  "application/vnd.powerbuilder75-s": [],
  "application/vnd.preminet": [],
  "application/vnd.previewsystems.box": [
    "box"
  ],
  "application/vnd.proteus.magazine": [
    "mgz"
  ],
  "application/vnd.publishare-delta-tree": [
    "qps"
  ],
  "application/vnd.pvi.ptid1": [
    "ptid"
  ],
  "application/vnd.pwg-multiplexed": [],
  "application/vnd.pwg-xhtml-print+xml": [],
  "application/vnd.qualcomm.brew-app-res": [],
  "application/vnd.quark.quarkxpress": [
    "qxd",
    "qxt",
    "qwd",
    "qwt",
    "qxl",
    "qxb"
  ],
  "application/vnd.radisys.moml+xml": [],
  "application/vnd.radisys.msml+xml": [],
  "application/vnd.radisys.msml-audit+xml": [],
  "application/vnd.radisys.msml-audit-conf+xml": [],
  "application/vnd.radisys.msml-audit-conn+xml": [],
  "application/vnd.radisys.msml-audit-dialog+xml": [],
  "application/vnd.radisys.msml-audit-stream+xml": [],
  "application/vnd.radisys.msml-conf+xml": [],
  "application/vnd.radisys.msml-dialog+xml": [],
  "application/vnd.radisys.msml-dialog-base+xml": [],
  "application/vnd.radisys.msml-dialog-fax-detect+xml": [],
  "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": [],
  "application/vnd.radisys.msml-dialog-group+xml": [],
  "application/vnd.radisys.msml-dialog-speech+xml": [],
  "application/vnd.radisys.msml-dialog-transform+xml": [],
  "application/vnd.rainstor.data": [],
  "application/vnd.rapid": [],
  "application/vnd.realvnc.bed": [
    "bed"
  ],
  "application/vnd.recordare.musicxml": [
    "mxl"
  ],
  "application/vnd.recordare.musicxml+xml": [
    "musicxml"
  ],
  "application/vnd.renlearn.rlprint": [],
  "application/vnd.rig.cryptonote": [
    "cryptonote"
  ],
  "application/vnd.rim.cod": [
    "cod"
  ],
  "application/vnd.rn-realmedia": [
    "rm"
  ],
  "application/vnd.rn-realmedia-vbr": [
    "rmvb"
  ],
  "application/vnd.route66.link66+xml": [
    "link66"
  ],
  "application/vnd.rs-274x": [],
  "application/vnd.ruckus.download": [],
  "application/vnd.s3sms": [],
  "application/vnd.sailingtracker.track": [
    "st"
  ],
  "application/vnd.sbm.cid": [],
  "application/vnd.sbm.mid2": [],
  "application/vnd.scribus": [],
  "application/vnd.sealed.3df": [],
  "application/vnd.sealed.csf": [],
  "application/vnd.sealed.doc": [],
  "application/vnd.sealed.eml": [],
  "application/vnd.sealed.mht": [],
  "application/vnd.sealed.net": [],
  "application/vnd.sealed.ppt": [],
  "application/vnd.sealed.tiff": [],
  "application/vnd.sealed.xls": [],
  "application/vnd.sealedmedia.softseal.html": [],
  "application/vnd.sealedmedia.softseal.pdf": [],
  "application/vnd.seemail": [
    "see"
  ],
  "application/vnd.sema": [
    "sema"
  ],
  "application/vnd.semd": [
    "semd"
  ],
  "application/vnd.semf": [
    "semf"
  ],
  "application/vnd.shana.informed.formdata": [
    "ifm"
  ],
  "application/vnd.shana.informed.formtemplate": [
    "itp"
  ],
  "application/vnd.shana.informed.interchange": [
    "iif"
  ],
  "application/vnd.shana.informed.package": [
    "ipk"
  ],
  "application/vnd.simtech-mindmapper": [
    "twd",
    "twds"
  ],
  "application/vnd.smaf": [
    "mmf"
  ],
  "application/vnd.smart.notebook": [],
  "application/vnd.smart.teacher": [
    "teacher"
  ],
  "application/vnd.software602.filler.form+xml": [],
  "application/vnd.software602.filler.form-xml-zip": [],
  "application/vnd.solent.sdkm+xml": [
    "sdkm",
    "sdkd"
  ],
  "application/vnd.spotfire.dxp": [
    "dxp"
  ],
  "application/vnd.spotfire.sfs": [
    "sfs"
  ],
  "application/vnd.sss-cod": [],
  "application/vnd.sss-dtf": [],
  "application/vnd.sss-ntf": [],
  "application/vnd.stardivision.calc": [
    "sdc"
  ],
  "application/vnd.stardivision.draw": [
    "sda"
  ],
  "application/vnd.stardivision.impress": [
    "sdd"
  ],
  "application/vnd.stardivision.math": [
    "smf"
  ],
  "application/vnd.stardivision.writer": [
    "sdw",
    "vor"
  ],
  "application/vnd.stardivision.writer-global": [
    "sgl"
  ],
  "application/vnd.stepmania.package": [
    "smzip"
  ],
  "application/vnd.stepmania.stepchart": [
    "sm"
  ],
  "application/vnd.street-stream": [],
  "application/vnd.sun.xml.calc": [
    "sxc"
  ],
  "application/vnd.sun.xml.calc.template": [
    "stc"
  ],
  "application/vnd.sun.xml.draw": [
    "sxd"
  ],
  "application/vnd.sun.xml.draw.template": [
    "std"
  ],
  "application/vnd.sun.xml.impress": [
    "sxi"
  ],
  "application/vnd.sun.xml.impress.template": [
    "sti"
  ],
  "application/vnd.sun.xml.math": [
    "sxm"
  ],
  "application/vnd.sun.xml.writer": [
    "sxw"
  ],
  "application/vnd.sun.xml.writer.global": [
    "sxg"
  ],
  "application/vnd.sun.xml.writer.template": [
    "stw"
  ],
  "application/vnd.sun.wadl+xml": [],
  "application/vnd.sus-calendar": [
    "sus",
    "susp"
  ],
  "application/vnd.svd": [
    "svd"
  ],
  "application/vnd.swiftview-ics": [],
  "application/vnd.symbian.install": [
    "sis",
    "sisx"
  ],
  "application/vnd.syncml+xml": [
    "xsm"
  ],
  "application/vnd.syncml.dm+wbxml": [
    "bdm"
  ],
  "application/vnd.syncml.dm+xml": [
    "xdm"
  ],
  "application/vnd.syncml.dm.notification": [],
  "application/vnd.syncml.ds.notification": [],
  "application/vnd.tao.intent-module-archive": [
    "tao"
  ],
  "application/vnd.tcpdump.pcap": [
    "pcap",
    "cap",
    "dmp"
  ],
  "application/vnd.tmobile-livetv": [
    "tmo"
  ],
  "application/vnd.trid.tpt": [
    "tpt"
  ],
  "application/vnd.triscape.mxs": [
    "mxs"
  ],
  "application/vnd.trueapp": [
    "tra"
  ],
  "application/vnd.truedoc": [],
  "application/vnd.ubisoft.webplayer": [],
  "application/vnd.ufdl": [
    "ufd",
    "ufdl"
  ],
  "application/vnd.uiq.theme": [
    "utz"
  ],
  "application/vnd.umajin": [
    "umj"
  ],
  "application/vnd.unity": [
    "unityweb"
  ],
  "application/vnd.uoml+xml": [
    "uoml"
  ],
  "application/vnd.uplanet.alert": [],
  "application/vnd.uplanet.alert-wbxml": [],
  "application/vnd.uplanet.bearer-choice": [],
  "application/vnd.uplanet.bearer-choice-wbxml": [],
  "application/vnd.uplanet.cacheop": [],
  "application/vnd.uplanet.cacheop-wbxml": [],
  "application/vnd.uplanet.channel": [],
  "application/vnd.uplanet.channel-wbxml": [],
  "application/vnd.uplanet.list": [],
  "application/vnd.uplanet.list-wbxml": [],
  "application/vnd.uplanet.listcmd": [],
  "application/vnd.uplanet.listcmd-wbxml": [],
  "application/vnd.uplanet.signal": [],
  "application/vnd.vcx": [
    "vcx"
  ],
  "application/vnd.vd-study": [],
  "application/vnd.vectorworks": [],
  "application/vnd.verimatrix.vcas": [],
  "application/vnd.vidsoft.vidconference": [],
  "application/vnd.visio": [
    "vsd",
    "vst",
    "vss",
    "vsw"
  ],
  "application/vnd.visionary": [
    "vis"
  ],
  "application/vnd.vividence.scriptfile": [],
  "application/vnd.vsf": [
    "vsf"
  ],
  "application/vnd.wap.sic": [],
  "application/vnd.wap.slc": [],
  "application/vnd.wap.wbxml": [
    "wbxml"
  ],
  "application/vnd.wap.wmlc": [
    "wmlc"
  ],
  "application/vnd.wap.wmlscriptc": [
    "wmlsc"
  ],
  "application/vnd.webturbo": [
    "wtb"
  ],
  "application/vnd.wfa.wsc": [],
  "application/vnd.wmc": [],
  "application/vnd.wmf.bootstrap": [],
  "application/vnd.wolfram.mathematica": [],
  "application/vnd.wolfram.mathematica.package": [],
  "application/vnd.wolfram.player": [
    "nbp"
  ],
  "application/vnd.wordperfect": [
    "wpd"
  ],
  "application/vnd.wqd": [
    "wqd"
  ],
  "application/vnd.wrq-hp3000-labelled": [],
  "application/vnd.wt.stf": [
    "stf"
  ],
  "application/vnd.wv.csp+wbxml": [],
  "application/vnd.wv.csp+xml": [],
  "application/vnd.wv.ssp+xml": [],
  "application/vnd.xara": [
    "xar"
  ],
  "application/vnd.xfdl": [
    "xfdl"
  ],
  "application/vnd.xfdl.webform": [],
  "application/vnd.xmi+xml": [],
  "application/vnd.xmpie.cpkg": [],
  "application/vnd.xmpie.dpkg": [],
  "application/vnd.xmpie.plan": [],
  "application/vnd.xmpie.ppkg": [],
  "application/vnd.xmpie.xlim": [],
  "application/vnd.yamaha.hv-dic": [
    "hvd"
  ],
  "application/vnd.yamaha.hv-script": [
    "hvs"
  ],
  "application/vnd.yamaha.hv-voice": [
    "hvp"
  ],
  "application/vnd.yamaha.openscoreformat": [
    "osf"
  ],
  "application/vnd.yamaha.openscoreformat.osfpvg+xml": [
    "osfpvg"
  ],
  "application/vnd.yamaha.remote-setup": [],
  "application/vnd.yamaha.smaf-audio": [
    "saf"
  ],
  "application/vnd.yamaha.smaf-phrase": [
    "spf"
  ],
  "application/vnd.yamaha.through-ngn": [],
  "application/vnd.yamaha.tunnel-udpencap": [],
  "application/vnd.yellowriver-custom-menu": [
    "cmp"
  ],
  "application/vnd.zul": [
    "zir",
    "zirz"
  ],
  "application/vnd.zzazz.deck+xml": [
    "zaz"
  ],
  "application/voicexml+xml": [
    "vxml"
  ],
  "application/vq-rtcpxr": [],
  "application/watcherinfo+xml": [],
  "application/whoispp-query": [],
  "application/whoispp-response": [],
  "application/widget": [
    "wgt"
  ],
  "application/winhlp": [
    "hlp"
  ],
  "application/wita": [],
  "application/wordperfect5.1": [],
  "application/wsdl+xml": [
    "wsdl"
  ],
  "application/wspolicy+xml": [
    "wspolicy"
  ],
  "application/x-7z-compressed": [
    "7z"
  ],
  "application/x-abiword": [
    "abw"
  ],
  "application/x-ace-compressed": [
    "ace"
  ],
  "application/x-amf": [],
  "application/x-apple-diskimage": [
    "dmg"
  ],
  "application/x-authorware-bin": [
    "aab",
    "x32",
    "u32",
    "vox"
  ],
  "application/x-authorware-map": [
    "aam"
  ],
  "application/x-authorware-seg": [
    "aas"
  ],
  "application/x-bcpio": [
    "bcpio"
  ],
  "application/x-bittorrent": [
    "torrent"
  ],
  "application/x-blorb": [
    "blb",
    "blorb"
  ],
  "application/x-bzip": [
    "bz"
  ],
  "application/x-bzip2": [
    "bz2",
    "boz"
  ],
  "application/x-cbr": [
    "cbr",
    "cba",
    "cbt",
    "cbz",
    "cb7"
  ],
  "application/x-cdlink": [
    "vcd"
  ],
  "application/x-cfs-compressed": [
    "cfs"
  ],
  "application/x-chat": [
    "chat"
  ],
  "application/x-chess-pgn": [
    "pgn"
  ],
  "application/x-conference": [
    "nsc"
  ],
  "application/x-compress": [],
  "application/x-cpio": [
    "cpio"
  ],
  "application/x-csh": [
    "csh"
  ],
  "application/x-debian-package": [
    "deb",
    "udeb"
  ],
  "application/x-dgc-compressed": [
    "dgc"
  ],
  "application/x-director": [
    "dir",
    "dcr",
    "dxr",
    "cst",
    "cct",
    "cxt",
    "w3d",
    "fgd",
    "swa"
  ],
  "application/x-doom": [
    "wad"
  ],
  "application/x-dtbncx+xml": [
    "ncx"
  ],
  "application/x-dtbook+xml": [
    "dtb"
  ],
  "application/x-dtbresource+xml": [
    "res"
  ],
  "application/x-dvi": [
    "dvi"
  ],
  "application/x-envoy": [
    "evy"
  ],
  "application/x-eva": [
    "eva"
  ],
  "application/x-font-bdf": [
    "bdf"
  ],
  "application/x-font-dos": [],
  "application/x-font-framemaker": [],
  "application/x-font-ghostscript": [
    "gsf"
  ],
  "application/x-font-libgrx": [],
  "application/x-font-linux-psf": [
    "psf"
  ],
  "application/x-font-otf": [
    "otf"
  ],
  "application/x-font-pcf": [
    "pcf"
  ],
  "application/x-font-snf": [
    "snf"
  ],
  "application/x-font-speedo": [],
  "application/x-font-sunos-news": [],
  "application/x-font-ttf": [
    "ttf",
    "ttc"
  ],
  "application/x-font-type1": [
    "pfa",
    "pfb",
    "pfm",
    "afm"
  ],
  "application/font-woff": [
    "woff"
  ],
  "application/x-font-vfont": [],
  "application/x-freearc": [
    "arc"
  ],
  "application/x-futuresplash": [
    "spl"
  ],
  "application/x-gca-compressed": [
    "gca"
  ],
  "application/x-glulx": [
    "ulx"
  ],
  "application/x-gnumeric": [
    "gnumeric"
  ],
  "application/x-gramps-xml": [
    "gramps"
  ],
  "application/x-gtar": [
    "gtar"
  ],
  "application/x-gzip": [],
  "application/x-hdf": [
    "hdf"
  ],
  "application/x-install-instructions": [
    "install"
  ],
  "application/x-iso9660-image": [
    "iso"
  ],
  "application/x-java-jnlp-file": [
    "jnlp"
  ],
  "application/x-latex": [
    "latex"
  ],
  "application/x-lzh-compressed": [
    "lzh",
    "lha"
  ],
  "application/x-mie": [
    "mie"
  ],
  "application/x-mobipocket-ebook": [
    "prc",
    "mobi"
  ],
  "application/x-ms-application": [
    "application"
  ],
  "application/x-ms-shortcut": [
    "lnk"
  ],
  "application/x-ms-wmd": [
    "wmd"
  ],
  "application/x-ms-wmz": [
    "wmz"
  ],
  "application/x-ms-xbap": [
    "xbap"
  ],
  "application/x-msaccess": [
    "mdb"
  ],
  "application/x-msbinder": [
    "obd"
  ],
  "application/x-mscardfile": [
    "crd"
  ],
  "application/x-msclip": [
    "clp"
  ],
  "application/x-msdownload": [
    "exe",
    "dll",
    "com",
    "bat",
    "msi"
  ],
  "application/x-msmediaview": [
    "mvb",
    "m13",
    "m14"
  ],
  "application/x-msmetafile": [
    "wmf",
    "wmz",
    "emf",
    "emz"
  ],
  "application/x-msmoney": [
    "mny"
  ],
  "application/x-mspublisher": [
    "pub"
  ],
  "application/x-msschedule": [
    "scd"
  ],
  "application/x-msterminal": [
    "trm"
  ],
  "application/x-mswrite": [
    "wri"
  ],
  "application/x-netcdf": [
    "nc",
    "cdf"
  ],
  "application/x-nzb": [
    "nzb"
  ],
  "application/x-pkcs12": [
    "p12",
    "pfx"
  ],
  "application/x-pkcs7-certificates": [
    "p7b",
    "spc"
  ],
  "application/x-pkcs7-certreqresp": [
    "p7r"
  ],
  "application/x-rar-compressed": [
    "rar"
  ],
  "application/x-research-info-systems": [
    "ris"
  ],
  "application/x-sh": [
    "sh"
  ],
  "application/x-shar": [
    "shar"
  ],
  "application/x-shockwave-flash": [
    "swf"
  ],
  "application/x-silverlight-app": [
    "xap"
  ],
  "application/x-sql": [
    "sql"
  ],
  "application/x-stuffit": [
    "sit"
  ],
  "application/x-stuffitx": [
    "sitx"
  ],
  "application/x-subrip": [
    "srt"
  ],
  "application/x-sv4cpio": [
    "sv4cpio"
  ],
  "application/x-sv4crc": [
    "sv4crc"
  ],
  "application/x-t3vm-image": [
    "t3"
  ],
  "application/x-tads": [
    "gam"
  ],
  "application/x-tar": [
    "tar"
  ],
  "application/x-tcl": [
    "tcl"
  ],
  "application/x-tex": [
    "tex"
  ],
  "application/x-tex-tfm": [
    "tfm"
  ],
  "application/x-texinfo": [
    "texinfo",
    "texi"
  ],
  "application/x-tgif": [
    "obj"
  ],
  "application/x-ustar": [
    "ustar"
  ],
  "application/x-wais-source": [
    "src"
  ],
  "application/x-x509-ca-cert": [
    "der",
    "crt"
  ],
  "application/x-xfig": [
    "fig"
  ],
  "application/x-xliff+xml": [
    "xlf"
  ],
  "application/x-xpinstall": [
    "xpi"
  ],
  "application/x-xz": [
    "xz"
  ],
  "application/x-zmachine": [
    "z1",
    "z2",
    "z3",
    "z4",
    "z5",
    "z6",
    "z7",
    "z8"
  ],
  "application/x400-bp": [],
  "application/xaml+xml": [
    "xaml"
  ],
  "application/xcap-att+xml": [],
  "application/xcap-caps+xml": [],
  "application/xcap-diff+xml": [
    "xdf"
  ],
  "application/xcap-el+xml": [],
  "application/xcap-error+xml": [],
  "application/xcap-ns+xml": [],
  "application/xcon-conference-info-diff+xml": [],
  "application/xcon-conference-info+xml": [],
  "application/xenc+xml": [
    "xenc"
  ],
  "application/xhtml+xml": [
    "xhtml",
    "xht"
  ],
  "application/xhtml-voice+xml": [],
  "application/xml": [
    "xml",
    "xsl"
  ],
  "application/xml-dtd": [
    "dtd"
  ],
  "application/xml-external-parsed-entity": [],
  "application/xmpp+xml": [],
  "application/xop+xml": [
    "xop"
  ],
  "application/xproc+xml": [
    "xpl"
  ],
  "application/xslt+xml": [
    "xslt"
  ],
  "application/xspf+xml": [
    "xspf"
  ],
  "application/xv+xml": [
    "mxml",
    "xhvml",
    "xvml",
    "xvm"
  ],
  "application/yang": [
    "yang"
  ],
  "application/yin+xml": [
    "yin"
  ],
  "application/zip": [
    "zip"
  ],
  "audio/1d-interleaved-parityfec": [],
  "audio/32kadpcm": [],
  "audio/3gpp": [],
  "audio/3gpp2": [],
  "audio/ac3": [],
  "audio/adpcm": [
    "adp"
  ],
  "audio/amr": [],
  "audio/amr-wb": [],
  "audio/amr-wb+": [],
  "audio/asc": [],
  "audio/atrac-advanced-lossless": [],
  "audio/atrac-x": [],
  "audio/atrac3": [],
  "audio/basic": [
    "au",
    "snd"
  ],
  "audio/bv16": [],
  "audio/bv32": [],
  "audio/clearmode": [],
  "audio/cn": [],
  "audio/dat12": [],
  "audio/dls": [],
  "audio/dsr-es201108": [],
  "audio/dsr-es202050": [],
  "audio/dsr-es202211": [],
  "audio/dsr-es202212": [],
  "audio/dv": [],
  "audio/dvi4": [],
  "audio/eac3": [],
  "audio/evrc": [],
  "audio/evrc-qcp": [],
  "audio/evrc0": [],
  "audio/evrc1": [],
  "audio/evrcb": [],
  "audio/evrcb0": [],
  "audio/evrcb1": [],
  "audio/evrcwb": [],
  "audio/evrcwb0": [],
  "audio/evrcwb1": [],
  "audio/example": [],
  "audio/fwdred": [],
  "audio/g719": [],
  "audio/g722": [],
  "audio/g7221": [],
  "audio/g723": [],
  "audio/g726-16": [],
  "audio/g726-24": [],
  "audio/g726-32": [],
  "audio/g726-40": [],
  "audio/g728": [],
  "audio/g729": [],
  "audio/g7291": [],
  "audio/g729d": [],
  "audio/g729e": [],
  "audio/gsm": [],
  "audio/gsm-efr": [],
  "audio/gsm-hr-08": [],
  "audio/ilbc": [],
  "audio/ip-mr_v2.5": [],
  "audio/isac": [],
  "audio/l16": [],
  "audio/l20": [],
  "audio/l24": [],
  "audio/l8": [],
  "audio/lpc": [],
  "audio/midi": [
    "mid",
    "midi",
    "kar",
    "rmi"
  ],
  "audio/mobile-xmf": [],
  "audio/mp4": [
    "mp4a"
  ],
  "audio/mp4a-latm": [],
  "audio/mpa": [],
  "audio/mpa-robust": [],
  "audio/mpeg": [
    "mpga",
    "mp2",
    "mp2a",
    "mp3",
    "m2a",
    "m3a"
  ],
  "audio/mpeg4-generic": [],
  "audio/musepack": [],
  "audio/ogg": [
    "oga",
    "ogg",
    "spx"
  ],
  "audio/opus": [],
  "audio/parityfec": [],
  "audio/pcma": [],
  "audio/pcma-wb": [],
  "audio/pcmu-wb": [],
  "audio/pcmu": [],
  "audio/prs.sid": [],
  "audio/qcelp": [],
  "audio/red": [],
  "audio/rtp-enc-aescm128": [],
  "audio/rtp-midi": [],
  "audio/rtx": [],
  "audio/s3m": [
    "s3m"
  ],
  "audio/silk": [
    "sil"
  ],
  "audio/smv": [],
  "audio/smv0": [],
  "audio/smv-qcp": [],
  "audio/sp-midi": [],
  "audio/speex": [],
  "audio/t140c": [],
  "audio/t38": [],
  "audio/telephone-event": [],
  "audio/tone": [],
  "audio/uemclip": [],
  "audio/ulpfec": [],
  "audio/vdvi": [],
  "audio/vmr-wb": [],
  "audio/vnd.3gpp.iufp": [],
  "audio/vnd.4sb": [],
  "audio/vnd.audiokoz": [],
  "audio/vnd.celp": [],
  "audio/vnd.cisco.nse": [],
  "audio/vnd.cmles.radio-events": [],
  "audio/vnd.cns.anp1": [],
  "audio/vnd.cns.inf1": [],
  "audio/vnd.dece.audio": [
    "uva",
    "uvva"
  ],
  "audio/vnd.digital-winds": [
    "eol"
  ],
  "audio/vnd.dlna.adts": [],
  "audio/vnd.dolby.heaac.1": [],
  "audio/vnd.dolby.heaac.2": [],
  "audio/vnd.dolby.mlp": [],
  "audio/vnd.dolby.mps": [],
  "audio/vnd.dolby.pl2": [],
  "audio/vnd.dolby.pl2x": [],
  "audio/vnd.dolby.pl2z": [],
  "audio/vnd.dolby.pulse.1": [],
  "audio/vnd.dra": [
    "dra"
  ],
  "audio/vnd.dts": [
    "dts"
  ],
  "audio/vnd.dts.hd": [
    "dtshd"
  ],
  "audio/vnd.dvb.file": [],
  "audio/vnd.everad.plj": [],
  "audio/vnd.hns.audio": [],
  "audio/vnd.lucent.voice": [
    "lvp"
  ],
  "audio/vnd.ms-playready.media.pya": [
    "pya"
  ],
  "audio/vnd.nokia.mobile-xmf": [],
  "audio/vnd.nortel.vbk": [],
  "audio/vnd.nuera.ecelp4800": [
    "ecelp4800"
  ],
  "audio/vnd.nuera.ecelp7470": [
    "ecelp7470"
  ],
  "audio/vnd.nuera.ecelp9600": [
    "ecelp9600"
  ],
  "audio/vnd.octel.sbc": [],
  "audio/vnd.qcelp": [],
  "audio/vnd.rhetorex.32kadpcm": [],
  "audio/vnd.rip": [
    "rip"
  ],
  "audio/vnd.sealedmedia.softseal.mpeg": [],
  "audio/vnd.vmx.cvsd": [],
  "audio/vorbis": [],
  "audio/vorbis-config": [],
  "audio/webm": [
    "weba"
  ],
  "audio/x-aac": [
    "aac"
  ],
  "audio/x-aiff": [
    "aif",
    "aiff",
    "aifc"
  ],
  "audio/x-caf": [
    "caf"
  ],
  "audio/x-flac": [
    "flac"
  ],
  "audio/x-matroska": [
    "mka"
  ],
  "audio/x-mpegurl": [
    "m3u"
  ],
  "audio/x-ms-wax": [
    "wax"
  ],
  "audio/x-ms-wma": [
    "wma"
  ],
  "audio/x-pn-realaudio": [
    "ram",
    "ra"
  ],
  "audio/x-pn-realaudio-plugin": [
    "rmp"
  ],
  "audio/x-tta": [],
  "audio/x-wav": [
    "wav"
  ],
  "audio/xm": [
    "xm"
  ],
  "chemical/x-cdx": [
    "cdx"
  ],
  "chemical/x-cif": [
    "cif"
  ],
  "chemical/x-cmdf": [
    "cmdf"
  ],
  "chemical/x-cml": [
    "cml"
  ],
  "chemical/x-csml": [
    "csml"
  ],
  "chemical/x-pdb": [],
  "chemical/x-xyz": [
    "xyz"
  ],
  "image/bmp": [
    "bmp"
  ],
  "image/cgm": [
    "cgm"
  ],
  "image/example": [],
  "image/fits": [],
  "image/g3fax": [
    "g3"
  ],
  "image/gif": [
    "gif"
  ],
  "image/ief": [
    "ief"
  ],
  "image/jp2": [],
  "image/jpeg": [
    "jpeg",
    "jpg",
    "jpe"
  ],
  "image/jpm": [],
  "image/jpx": [],
  "image/ktx": [
    "ktx"
  ],
  "image/naplps": [],
  "image/png": [
    "png"
  ],
  "image/prs.btif": [
    "btif"
  ],
  "image/prs.pti": [],
  "image/sgi": [
    "sgi"
  ],
  "image/svg+xml": [
    "svg",
    "svgz"
  ],
  "image/t38": [],
  "image/tiff": [
    "tiff",
    "tif"
  ],
  "image/tiff-fx": [],
  "image/vnd.adobe.photoshop": [
    "psd"
  ],
  "image/vnd.cns.inf2": [],
  "image/vnd.dece.graphic": [
    "uvi",
    "uvvi",
    "uvg",
    "uvvg"
  ],
  "image/vnd.dvb.subtitle": [
    "sub"
  ],
  "image/vnd.djvu": [
    "djvu",
    "djv"
  ],
  "image/vnd.dwg": [
    "dwg"
  ],
  "image/vnd.dxf": [
    "dxf"
  ],
  "image/vnd.fastbidsheet": [
    "fbs"
  ],
  "image/vnd.fpx": [
    "fpx"
  ],
  "image/vnd.fst": [
    "fst"
  ],
  "image/vnd.fujixerox.edmics-mmr": [
    "mmr"
  ],
  "image/vnd.fujixerox.edmics-rlc": [
    "rlc"
  ],
  "image/vnd.globalgraphics.pgb": [],
  "image/vnd.microsoft.icon": [],
  "image/vnd.mix": [],
  "image/vnd.ms-modi": [
    "mdi"
  ],
  "image/vnd.ms-photo": [
    "wdp"
  ],
  "image/vnd.net-fpx": [
    "npx"
  ],
  "image/vnd.radiance": [],
  "image/vnd.sealed.png": [],
  "image/vnd.sealedmedia.softseal.gif": [],
  "image/vnd.sealedmedia.softseal.jpg": [],
  "image/vnd.svf": [],
  "image/vnd.wap.wbmp": [
    "wbmp"
  ],
  "image/vnd.xiff": [
    "xif"
  ],
  "image/webp": [
    "webp"
  ],
  "image/x-3ds": [
    "3ds"
  ],
  "image/x-cmu-raster": [
    "ras"
  ],
  "image/x-cmx": [
    "cmx"
  ],
  "image/x-freehand": [
    "fh",
    "fhc",
    "fh4",
    "fh5",
    "fh7"
  ],
  "image/x-icon": [
    "ico"
  ],
  "image/x-mrsid-image": [
    "sid"
  ],
  "image/x-pcx": [
    "pcx"
  ],
  "image/x-pict": [
    "pic",
    "pct"
  ],
  "image/x-portable-anymap": [
    "pnm"
  ],
  "image/x-portable-bitmap": [
    "pbm"
  ],
  "image/x-portable-graymap": [
    "pgm"
  ],
  "image/x-portable-pixmap": [
    "ppm"
  ],
  "image/x-rgb": [
    "rgb"
  ],
  "image/x-tga": [
    "tga"
  ],
  "image/x-xbitmap": [
    "xbm"
  ],
  "image/x-xpixmap": [
    "xpm"
  ],
  "image/x-xwindowdump": [
    "xwd"
  ],
  "message/cpim": [],
  "message/delivery-status": [],
  "message/disposition-notification": [],
  "message/example": [],
  "message/external-body": [],
  "message/feedback-report": [],
  "message/global": [],
  "message/global-delivery-status": [],
  "message/global-disposition-notification": [],
  "message/global-headers": [],
  "message/http": [],
  "message/imdn+xml": [],
  "message/news": [],
  "message/partial": [],
  "message/rfc822": [
    "eml",
    "mime"
  ],
  "message/s-http": [],
  "message/sip": [],
  "message/sipfrag": [],
  "message/tracking-status": [],
  "message/vnd.si.simp": [],
  "model/example": [],
  "model/iges": [
    "igs",
    "iges"
  ],
  "model/mesh": [
    "msh",
    "mesh",
    "silo"
  ],
  "model/vnd.collada+xml": [
    "dae"
  ],
  "model/vnd.dwf": [
    "dwf"
  ],
  "model/vnd.flatland.3dml": [],
  "model/vnd.gdl": [
    "gdl"
  ],
  "model/vnd.gs-gdl": [],
  "model/vnd.gs.gdl": [],
  "model/vnd.gtw": [
    "gtw"
  ],
  "model/vnd.moml+xml": [],
  "model/vnd.mts": [
    "mts"
  ],
  "model/vnd.parasolid.transmit.binary": [],
  "model/vnd.parasolid.transmit.text": [],
  "model/vnd.vtu": [
    "vtu"
  ],
  "model/vrml": [
    "wrl",
    "vrml"
  ],
  "model/x3d+binary": [
    "x3db",
    "x3dbz"
  ],
  "model/x3d+vrml": [
    "x3dv",
    "x3dvz"
  ],
  "model/x3d+xml": [
    "x3d",
    "x3dz"
  ],
  "multipart/alternative": [],
  "multipart/appledouble": [],
  "multipart/byteranges": [],
  "multipart/digest": [],
  "multipart/encrypted": [],
  "multipart/example": [],
  "multipart/form-data": [],
  "multipart/header-set": [],
  "multipart/mixed": [],
  "multipart/parallel": [],
  "multipart/related": [],
  "multipart/report": [],
  "multipart/signed": [],
  "multipart/voice-message": [],
  "text/1d-interleaved-parityfec": [],
  "text/cache-manifest": [
    "appcache"
  ],
  "text/calendar": [
    "ics",
    "ifb"
  ],
  "text/css": [
    "css"
  ],
  "text/csv": [
    "csv"
  ],
  "text/directory": [],
  "text/dns": [],
  "text/ecmascript": [],
  "text/enriched": [],
  "text/example": [],
  "text/fwdred": [],
  "text/html": [
    "html",
    "htm"
  ],
  "text/javascript": [],
  "text/n3": [
    "n3"
  ],
  "text/parityfec": [],
  "text/plain": [
    "txt",
    "text",
    "conf",
    "def",
    "list",
    "log",
    "in"
  ],
  "text/prs.fallenstein.rst": [],
  "text/prs.lines.tag": [
    "dsc"
  ],
  "text/vnd.radisys.msml-basic-layout": [],
  "text/red": [],
  "text/rfc822-headers": [],
  "text/richtext": [
    "rtx"
  ],
  "text/rtf": [],
  "text/rtp-enc-aescm128": [],
  "text/rtx": [],
  "text/sgml": [
    "sgml",
    "sgm"
  ],
  "text/t140": [],
  "text/tab-separated-values": [
    "tsv"
  ],
  "text/troff": [
    "t",
    "tr",
    "roff",
    "man",
    "me",
    "ms"
  ],
  "text/turtle": [
    "ttl"
  ],
  "text/ulpfec": [],
  "text/uri-list": [
    "uri",
    "uris",
    "urls"
  ],
  "text/vcard": [
    "vcard"
  ],
  "text/vnd.abc": [],
  "text/vnd.curl": [
    "curl"
  ],
  "text/vnd.curl.dcurl": [
    "dcurl"
  ],
  "text/vnd.curl.scurl": [
    "scurl"
  ],
  "text/vnd.curl.mcurl": [
    "mcurl"
  ],
  "text/vnd.dmclientscript": [],
  "text/vnd.dvb.subtitle": [
    "sub"
  ],
  "text/vnd.esmertec.theme-descriptor": [],
  "text/vnd.fly": [
    "fly"
  ],
  "text/vnd.fmi.flexstor": [
    "flx"
  ],
  "text/vnd.graphviz": [
    "gv"
  ],
  "text/vnd.in3d.3dml": [
    "3dml"
  ],
  "text/vnd.in3d.spot": [
    "spot"
  ],
  "text/vnd.iptc.newsml": [],
  "text/vnd.iptc.nitf": [],
  "text/vnd.latex-z": [],
  "text/vnd.motorola.reflex": [],
  "text/vnd.ms-mediapackage": [],
  "text/vnd.net2phone.commcenter.command": [],
  "text/vnd.si.uricatalogue": [],
  "text/vnd.sun.j2me.app-descriptor": [
    "jad"
  ],
  "text/vnd.trolltech.linguist": [],
  "text/vnd.wap.si": [],
  "text/vnd.wap.sl": [],
  "text/vnd.wap.wml": [
    "wml"
  ],
  "text/vnd.wap.wmlscript": [
    "wmls"
  ],
  "text/x-asm": [
    "s",
    "asm"
  ],
  "text/x-c": [
    "c",
    "cc",
    "cxx",
    "cpp",
    "h",
    "hh",
    "dic"
  ],
  "text/x-fortran": [
    "f",
    "for",
    "f77",
    "f90"
  ],
  "text/x-java-source": [
    "java"
  ],
  "text/x-opml": [
    "opml"
  ],
  "text/x-pascal": [
    "p",
    "pas"
  ],
  "text/x-nfo": [
    "nfo"
  ],
  "text/x-setext": [
    "etx"
  ],
  "text/x-sfv": [
    "sfv"
  ],
  "text/x-uuencode": [
    "uu"
  ],
  "text/x-vcalendar": [
    "vcs"
  ],
  "text/x-vcard": [
    "vcf"
  ],
  "text/xml": [],
  "text/xml-external-parsed-entity": [],
  "video/1d-interleaved-parityfec": [],
  "video/3gpp": [
    "3gp"
  ],
  "video/3gpp-tt": [],
  "video/3gpp2": [
    "3g2"
  ],
  "video/bmpeg": [],
  "video/bt656": [],
  "video/celb": [],
  "video/dv": [],
  "video/example": [],
  "video/h261": [
    "h261"
  ],
  "video/h263": [
    "h263"
  ],
  "video/h263-1998": [],
  "video/h263-2000": [],
  "video/h264": [
    "h264"
  ],
  "video/h264-rcdo": [],
  "video/h264-svc": [],
  "video/jpeg": [
    "jpgv"
  ],
  "video/jpeg2000": [],
  "video/jpm": [
    "jpm",
    "jpgm"
  ],
  "video/mj2": [
    "mj2",
    "mjp2"
  ],
  "video/mp1s": [],
  "video/mp2p": [],
  "video/mp2t": [],
  "video/mp4": [
    "mp4",
    "mp4v",
    "mpg4"
  ],
  "video/mp4v-es": [],
  "video/mpeg": [
    "mpeg",
    "mpg",
    "mpe",
    "m1v",
    "m2v"
  ],
  "video/mpeg4-generic": [],
  "video/mpv": [],
  "video/nv": [],
  "video/ogg": [
    "ogv"
  ],
  "video/parityfec": [],
  "video/pointer": [],
  "video/quicktime": [
    "qt",
    "mov"
  ],
  "video/raw": [],
  "video/rtp-enc-aescm128": [],
  "video/rtx": [],
  "video/smpte292m": [],
  "video/ulpfec": [],
  "video/vc1": [],
  "video/vnd.cctv": [],
  "video/vnd.dece.hd": [
    "uvh",
    "uvvh"
  ],
  "video/vnd.dece.mobile": [
    "uvm",
    "uvvm"
  ],
  "video/vnd.dece.mp4": [],
  "video/vnd.dece.pd": [
    "uvp",
    "uvvp"
  ],
  "video/vnd.dece.sd": [
    "uvs",
    "uvvs"
  ],
  "video/vnd.dece.video": [
    "uvv",
    "uvvv"
  ],
  "video/vnd.directv.mpeg": [],
  "video/vnd.directv.mpeg-tts": [],
  "video/vnd.dlna.mpeg-tts": [],
  "video/vnd.dvb.file": [
    "dvb"
  ],
  "video/vnd.fvt": [
    "fvt"
  ],
  "video/vnd.hns.video": [],
  "video/vnd.iptvforum.1dparityfec-1010": [],
  "video/vnd.iptvforum.1dparityfec-2005": [],
  "video/vnd.iptvforum.2dparityfec-1010": [],
  "video/vnd.iptvforum.2dparityfec-2005": [],
  "video/vnd.iptvforum.ttsavc": [],
  "video/vnd.iptvforum.ttsmpeg2": [],
  "video/vnd.motorola.video": [],
  "video/vnd.motorola.videop": [],
  "video/vnd.mpegurl": [
    "mxu",
    "m4u"
  ],
  "video/vnd.ms-playready.media.pyv": [
    "pyv"
  ],
  "video/vnd.nokia.interleaved-multimedia": [],
  "video/vnd.nokia.videovoip": [],
  "video/vnd.objectvideo": [],
  "video/vnd.sealed.mpeg1": [],
  "video/vnd.sealed.mpeg4": [],
  "video/vnd.sealed.swf": [],
  "video/vnd.sealedmedia.softseal.mov": [],
  "video/vnd.uvvu.mp4": [
    "uvu",
    "uvvu"
  ],
  "video/vnd.vivo": [
    "viv"
  ],
  "video/webm": [
    "webm"
  ],
  "video/x-f4v": [
    "f4v"
  ],
  "video/x-fli": [
    "fli"
  ],
  "video/x-flv": [
    "flv"
  ],
  "video/x-m4v": [
    "m4v"
  ],
  "video/x-matroska": [
    "mkv",
    "mk3d",
    "mks"
  ],
  "video/x-mng": [
    "mng"
  ],
  "video/x-ms-asf": [
    "asf",
    "asx"
  ],
  "video/x-ms-vob": [
    "vob"
  ],
  "video/x-ms-wm": [
    "wm"
  ],
  "video/x-ms-wmv": [
    "wmv"
  ],
  "video/x-ms-wmx": [
    "wmx"
  ],
  "video/x-ms-wvx": [
    "wvx"
  ],
  "video/x-msvideo": [
    "avi"
  ],
  "video/x-sgi-movie": [
    "movie"
  ],
  "video/x-smv": [
    "smv"
  ],
  "x-conference/x-cooltalk": [
    "ice"
  ]
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/node.json":[function(require,module,exports){
module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports=module.exports={
  "text/vtt": [
    "vtt"
  ],
  "application/x-chrome-extension": [
    "crx"
  ],
  "text/x-component": [
    "htc"
  ],
  "text/cache-manifest": [
    "manifest"
  ],
  "application/octet-stream": [
    "buffer"
  ],
  "application/mp4": [
    "m4p"
  ],
  "audio/mp4": [
    "m4a"
  ],
  "video/MP2T": [
    "ts"
  ],
  "application/x-web-app-manifest+json": [
    "webapp"
  ],
  "text/x-lua": [
    "lua"
  ],
  "application/x-lua-bytecode": [
    "luac"
  ],
  "text/x-markdown": [
    "markdown",
    "md",
    "mkd"
  ],
  "text/plain": [
    "ini"
  ],
  "application/dash+xml": [
    "mdp"
  ],
  "font/opentype": [
    "otf"
  ],
  "application/json": [
    "map"
  ],
  "application/xml": [
    "xsd"
  ]
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/node-uuid/uuid.js":[function(require,module,exports){
(function (Buffer){
//     uuid.js
//
//     Copyright (c) 2010-2012 Robert Kieffer
//     MIT License - http://opensource.org/licenses/mit-license.php

(function() {
  var _global = this;

  // Unique ID creation requires a high quality random # generator.  We feature
  // detect to determine the best RNG source, normalizing to a function that
  // returns 128-bits of randomness, since that's what's usually required
  var _rng;

  // Node.js crypto-based RNG - http://nodejs.org/docs/v0.6.2/api/crypto.html
  //
  // Moderately fast, high quality
  if (typeof(require) == 'function') {
    try {
      var _rb = require('crypto').randomBytes;
      _rng = _rb && function() {return _rb(16);};
    } catch(e) {}
  }

  if (!_rng && _global.crypto && crypto.getRandomValues) {
    // WHATWG crypto-based RNG - http://wiki.whatwg.org/wiki/Crypto
    //
    // Moderately fast, high quality
    var _rnds8 = new Uint8Array(16);
    _rng = function whatwgRNG() {
      crypto.getRandomValues(_rnds8);
      return _rnds8;
    };
  }

  if (!_rng) {
    // Math.random()-based (RNG)
    //
    // If all else fails, use Math.random().  It's fast, but is of unspecified
    // quality.
    var  _rnds = new Array(16);
    _rng = function() {
      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
        _rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return _rnds;
    };
  }

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  // **`parse()` - Parse a UUID into it's component bytes**
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(oct) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[oct];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  // **`unparse()` - Convert UUID byte array (ala parse()) into a string**
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // **`v1()` - Generate time-based UUID**
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng();

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  // See https://github.com/broofa/node-uuid for API details
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || [];

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // `time_low`
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // `time_mid`
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // `clock_seq_low`
    b[i++] = clockseq & 0xff;

    // `node`
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  // **`v4()` - Generate random UUID**

  // See https://github.com/broofa/node-uuid for API details
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;

    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }
    options = options || {};

    var rnds = options.random || (options.rng || _rng)();

    // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  // Export public API
  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  if (typeof define === 'function' && define.amd) {
    // Publish as AMD module
    define(function() {return uuid;});
  } else if (typeof(module) != 'undefined' && module.exports) {
    // Publish as node.js module
    module.exports = uuid;
  } else {
    // Publish as global (in browsers)
    var _previousRoot = _global.uuid;

    // **`noConflict()` - (browser only) to reset global 'uuid' var**
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    };

    _global.uuid = uuid;
  }
}).call(this);

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","crypto":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/index.js":[function(require,module,exports){
module.exports = require('./lib');

},{"./lib":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/index.js":[function(require,module,exports){
// Load modules

var Stringify = require('./stringify');
var Parse = require('./parse');


// Declare internals

var internals = {};


module.exports = {
    stringify: Stringify,
    parse: Parse
};

},{"./parse":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/parse.js","./stringify":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/stringify.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/parse.js":[function(require,module,exports){
// Load modules

var Utils = require('./utils');


// Declare internals

var internals = {
    delimiter: '&',
    depth: 5,
    arrayLimit: 20,
    parametersLimit: 1000
};


internals.parseValues = function (str, delimiter) {

    delimiter = typeof delimiter === 'string' ? delimiter : internals.delimiter;

    var obj = {};
    var parts = str.split(delimiter, internals.parametersLimit);

    for (var i = 0, il = parts.length; i < il; ++i) {
        var part = parts[i];
        var pos = part.indexOf(']=') === -1 ? part.indexOf('=') : part.indexOf(']=') + 1;

        if (pos === -1) {
            obj[Utils.decode(part)] = '';
        }
        else {
            var key = Utils.decode(part.slice(0, pos));
            var val = Utils.decode(part.slice(pos + 1));

            if (!obj[key]) {
                obj[key] = val;
            }
            else {
                obj[key] = [].concat(obj[key]).concat(val);
            }
        }
    }

    return obj;
};


internals.parseObject = function (chain, val) {

    if (!chain.length) {
        return val;
    }

    var root = chain.shift();

    var obj = {};
    if (root === '[]') {
        obj = [];
        obj = obj.concat(internals.parseObject(chain, val));
    }
    else {
        var cleanRoot = root[0] === '[' && root[root.length - 1] === ']' ? root.slice(1, root.length - 1) : root;
        var index = parseInt(cleanRoot, 10);
        if (!isNaN(index) &&
            root !== cleanRoot &&
            index <= internals.arrayLimit) {

            obj = [];
            obj[index] = internals.parseObject(chain, val);
        }
        else {
            obj[cleanRoot] = internals.parseObject(chain, val);
        }
    }

    return obj;
};


internals.parseKeys = function (key, val, depth) {

    if (!key) {
        return;
    }

    // The regex chunks

    var parent = /^([^\[\]]*)/;
    var child = /(\[[^\[\]]*\])/g;

    // Get the parent

    var segment = parent.exec(key);

    // Don't allow them to overwrite object prototype properties

    if (Object.prototype.hasOwnProperty(segment[1])) {
        return;
    }

    // Stash the parent if it exists

    var keys = [];
    if (segment[1]) {
        keys.push(segment[1]);
    }

    // Loop through children appending to the array until we hit depth

    var i = 0;
    while ((segment = child.exec(key)) !== null && i < depth) {

        ++i;
        if (!Object.prototype.hasOwnProperty(segment[1].replace(/\[|\]/g, ''))) {
            keys.push(segment[1]);
        }
    }

    // If there's a remainder, just add whatever is left

    if (segment) {
        keys.push('[' + key.slice(segment.index) + ']');
    }

    return internals.parseObject(keys, val);
};


module.exports = function (str, depth, delimiter) {

    if (str === '' ||
        str === null ||
        typeof str === 'undefined') {

        return {};
    }

    if (typeof depth !== 'number') {
        delimiter = depth;
        depth = internals.depth;
    }

    var tempObj = typeof str === 'string' ? internals.parseValues(str, delimiter) : Utils.clone(str);
    var obj = {};

    // Iterate over the keys and setup the new object
    //
    for (var key in tempObj) {
        if (tempObj.hasOwnProperty(key)) {
            var newObj = internals.parseKeys(key, tempObj[key], depth);
            obj = Utils.merge(obj, newObj);
        }
    }

    return Utils.compact(obj);
};

},{"./utils":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/utils.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/stringify.js":[function(require,module,exports){
(function (Buffer){
// Load modules


// Declare internals

var internals = {
    delimiter: '&'
};


internals.stringify = function (obj, prefix) {

    if (Buffer.isBuffer(obj)) {
        obj = obj.toString();
    }
    else if (obj instanceof Date) {
        obj = obj.toISOString();
    }
    else if (obj === null) {
        obj = '';
    }

    if (typeof obj === 'string' ||
        typeof obj === 'number' ||
        typeof obj === 'boolean') {

        return [encodeURIComponent(prefix) + '=' + encodeURIComponent(obj)];
    }

    var values = [];

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            values = values.concat(internals.stringify(obj[key], prefix + '[' + key + ']'));
        }
    }

    return values;
};


module.exports = function (obj, delimiter) {

    delimiter = typeof delimiter === 'undefined' ? internals.delimiter : delimiter;

    var keys = [];

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys = keys.concat(internals.stringify(obj[key], key));
        }
    }

    return keys.join(delimiter);
};

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/lib/utils.js":[function(require,module,exports){
(function (Buffer){
// Load modules


// Declare internals

var internals = {};


exports.arrayToObject = function (source) {

    var obj = {};
    for (var i = 0, il = source.length; i < il; ++i) {
        if (typeof source[i] !== 'undefined') {

            obj[i] = source[i];
        }
    }

    return obj;
};


exports.clone = function (source) {

    if (typeof source !== 'object' ||
        source === null) {

        return source;
    }

    if (Buffer.isBuffer(source)) {
        return source.toString();
    }

    var obj = Array.isArray(source) ? [] : {};
    for (var i in source) {
        if (source.hasOwnProperty(i)) {
            obj[i] = exports.clone(source[i]);
        }
    }

    return obj;
};


exports.merge = function (target, source) {

    if (!source) {
        return target;
    }

    var obj = exports.clone(target);

    if (Array.isArray(source)) {
        for (var i = 0, il = source.length; i < il; ++i) {
            if (typeof source[i] !== 'undefined') {
                if (typeof obj[i] === 'object') {
                    obj[i] = exports.merge(obj[i], source[i]);
                }
                else {
                    obj[i] = source[i];
                }
            }
        }

        return obj;
    }

    if (Array.isArray(obj)) {
        obj = exports.arrayToObject(obj);
    }

    var keys = Object.keys(source);
    for (var k = 0, kl = keys.length; k < kl; ++k) {
        var key = keys[k];
        var value = source[key];

        if (value &&
            typeof value === 'object') {

            if (!obj[key]) {
                obj[key] = exports.clone(value);
            }
            else {
                obj[key] = exports.merge(obj[key], value);
            }
        }
        else {
            obj[key] = value;
        }
    }

    return obj;
};


exports.decode = function (str) {

    try {
        return decodeURIComponent(str.replace(/\+/g, ' '));
    } catch (e) {
        return str;
    }
};


exports.compact = function (obj) {

    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    var compacted = {};

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (Array.isArray(obj[key])) {
                compacted[key] = [];

                for (var i = 0, l = obj[key].length; i < l; i++) {
                    if (typeof obj[key][i] !== 'undefined') {
                        compacted[key].push(obj[key][i]);
                    }
                }
            }
            else {
                compacted[key] = exports.compact(obj[key]);
            }
        }
    }

    return compacted;
};

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/tunnel-agent/index.js":[function(require,module,exports){
(function (process,Buffer){
'use strict'

var net = require('net')
  , tls = require('tls')
  , http = require('http')
  , https = require('https')
  , events = require('events')
  , assert = require('assert')
  , util = require('util')
  ;

exports.httpOverHttp = httpOverHttp
exports.httpsOverHttp = httpsOverHttp
exports.httpOverHttps = httpOverHttps
exports.httpsOverHttps = httpsOverHttps


function httpOverHttp(options) {
  var agent = new TunnelingAgent(options)
  agent.request = http.request
  return agent
}

function httpsOverHttp(options) {
  var agent = new TunnelingAgent(options)
  agent.request = http.request
  agent.createSocket = createSecureSocket
  return agent
}

function httpOverHttps(options) {
  var agent = new TunnelingAgent(options)
  agent.request = https.request
  return agent
}

function httpsOverHttps(options) {
  var agent = new TunnelingAgent(options)
  agent.request = https.request
  agent.createSocket = createSecureSocket
  return agent
}


function TunnelingAgent(options) {
  var self = this
  self.options = options || {}
  self.proxyOptions = self.options.proxy || {}
  self.maxSockets = self.options.maxSockets || http.Agent.defaultMaxSockets
  self.requests = []
  self.sockets = []

  self.on('free', function onFree(socket, host, port) {
    for (var i = 0, len = self.requests.length; i < len; ++i) {
      var pending = self.requests[i]
      if (pending.host === host && pending.port === port) {
        // Detect the request to connect same origin server,
        // reuse the connection.
        self.requests.splice(i, 1)
        pending.request.onSocket(socket)
        return
      }
    }
    socket.destroy()
    self.removeSocket(socket)
  })
}
util.inherits(TunnelingAgent, events.EventEmitter)

TunnelingAgent.prototype.addRequest = function addRequest(req, options) {
  var self = this

   // Legacy API: addRequest(req, host, port, path)
  if (typeof options === 'string') {
    options = {
      host: options,
      port: arguments[2],
      path: arguments[3]
    };
  }

  if (self.sockets.length >= this.maxSockets) {
    // We are over limit so we'll add it to the queue.
    self.requests.push({host: host, port: port, request: req})
    return
  }

  // If we are under maxSockets create a new one.
  self.createSocket({host: options.host, port: options.port, request: req}, function(socket) {
    socket.on('free', onFree)
    socket.on('close', onCloseOrRemove)
    socket.on('agentRemove', onCloseOrRemove)
    req.onSocket(socket)

    function onFree() {
      self.emit('free', socket, options.host, options.port)
    }

    function onCloseOrRemove(err) {
      self.removeSocket()
      socket.removeListener('free', onFree)
      socket.removeListener('close', onCloseOrRemove)
      socket.removeListener('agentRemove', onCloseOrRemove)
    }
  })
}

TunnelingAgent.prototype.createSocket = function createSocket(options, cb) {
  var self = this
  var placeholder = {}
  self.sockets.push(placeholder)

  var connectOptions = mergeOptions({}, self.proxyOptions, 
    { method: 'CONNECT'
    , path: options.host + ':' + options.port
    , agent: false
    }
  )
  if (connectOptions.proxyAuth) {
    connectOptions.headers = connectOptions.headers || {}
    connectOptions.headers['Proxy-Authorization'] = 'Basic ' +
        new Buffer(connectOptions.proxyAuth).toString('base64')
  }

  debug('making CONNECT request')
  var connectReq = self.request(connectOptions)
  connectReq.useChunkedEncodingByDefault = false // for v0.6
  connectReq.once('response', onResponse) // for v0.6
  connectReq.once('upgrade', onUpgrade)   // for v0.6
  connectReq.once('connect', onConnect)   // for v0.7 or later
  connectReq.once('error', onError)
  connectReq.end()

  function onResponse(res) {
    // Very hacky. This is necessary to avoid http-parser leaks.
    res.upgrade = true
  }

  function onUpgrade(res, socket, head) {
    // Hacky.
    process.nextTick(function() {
      onConnect(res, socket, head)
    })
  }

  function onConnect(res, socket, head) {
    connectReq.removeAllListeners()
    socket.removeAllListeners()

    if (res.statusCode === 200) {
      assert.equal(head.length, 0)
      debug('tunneling connection has established')
      self.sockets[self.sockets.indexOf(placeholder)] = socket
      cb(socket)
    } else {
      debug('tunneling socket could not be established, statusCode=%d', res.statusCode)
      var error = new Error('tunneling socket could not be established, ' + 'statusCode=' + res.statusCode)
      error.code = 'ECONNRESET'
      options.request.emit('error', error)
      self.removeSocket(placeholder)
    }
  }

  function onError(cause) {
    connectReq.removeAllListeners()

    debug('tunneling socket could not be established, cause=%s\n', cause.message, cause.stack)
    var error = new Error('tunneling socket could not be established, ' + 'cause=' + cause.message)
    error.code = 'ECONNRESET'
    options.request.emit('error', error)
    self.removeSocket(placeholder)
  }
}

TunnelingAgent.prototype.removeSocket = function removeSocket(socket) {
  var pos = this.sockets.indexOf(socket)
  if (pos === -1) return
  
  this.sockets.splice(pos, 1)

  var pending = this.requests.shift()
  if (pending) {
    // If we have pending requests and a socket gets closed a new one
    // needs to be created to take over in the pool for the one that closed.
    this.createSocket(pending, function(socket) {
      pending.request.onSocket(socket)
    })
  }
}

function createSecureSocket(options, cb) {
  var self = this
  TunnelingAgent.prototype.createSocket.call(self, options, function(socket) {
    // 0 is dummy port for v0.6
    var secureSocket = tls.connect(0, mergeOptions({}, self.options, 
      { servername: options.host
      , socket: socket
      }
    ))
    cb(secureSocket)
  })
}


function mergeOptions(target) {
  for (var i = 1, len = arguments.length; i < len; ++i) {
    var overrides = arguments[i]
    if (typeof overrides === 'object') {
      var keys = Object.keys(overrides)
      for (var j = 0, keyLen = keys.length; j < keyLen; ++j) {
        var k = keys[j]
        if (overrides[k] !== undefined) {
          target[k] = overrides[k]
        }
      }
    }
  }
  return target
}


var debug
if (process.env.NODE_DEBUG && /\btunnel\b/.test(process.env.NODE_DEBUG)) {
  debug = function() {
    var args = Array.prototype.slice.call(arguments)
    if (typeof args[0] === 'string') {
      args[0] = 'TUNNEL: ' + args[0]
    } else {
      args.unshift('TUNNEL:')
    }
    console.error.apply(console, args)
  }
} else {
  debug = function() {}
}
exports.debug = debug // for test

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","http":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/index.js","https":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/https-browserify/index.js","net":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","tls":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/request.js":[function(require,module,exports){
(function (process,Buffer){
var optional = require('./lib/optional')
  , http = require('http')
  , https = optional('https')
  , tls = optional('tls')
  , url = require('url')
  , util = require('util')
  , stream = require('stream')
  , qs = require('qs')
  , querystring = require('querystring')
  , crypto = require('crypto')
  , zlib = require('zlib')

  , bl = require('bl')
  , oauth = optional('oauth-sign')
  , hawk = optional('hawk')
  , aws = optional('aws-sign2')
  , httpSignature = optional('http-signature')
  , uuid = require('node-uuid')
  , mime = require('mime-types')
  , tunnel = require('tunnel-agent')
  , _safeStringify = require('json-stringify-safe')
  , stringstream = optional('stringstream')
  , caseless = require('caseless')

  , ForeverAgent = require('forever-agent')
  , FormData = optional('form-data')

  , cookies = require('./lib/cookies')
  , globalCookieJar = cookies.jar()

  , copy = require('./lib/copy')
  , debug = require('./lib/debug')
  , net = require('net')
  ;

function safeStringify (obj) {
  var ret
  try { ret = JSON.stringify(obj) }
  catch (e) { ret = _safeStringify(obj) }
  return ret
}

var globalPool = {}
var isUrl = /^https?:|^unix:/

var defaultProxyHeaderWhiteList = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'accept-ranges',
  'cache-control',
  'content-encoding',
  'content-language',
  'content-length',
  'content-location',
  'content-md5',
  'content-range',
  'content-type',
  'connection',
  'date',
  'expect',
  'max-forwards',
  'pragma',
  'proxy-authorization',
  'referer',
  'te',
  'transfer-encoding',
  'user-agent',
  'via'
]

function isReadStream (rs) {
  return rs.readable && rs.path && rs.mode;
}

function toBase64 (str) {
  return (new Buffer(str || "", "ascii")).toString("base64")
}

function md5 (str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

// Return a simpler request object to allow serialization
function requestToJSON() {
  return {
    uri: this.uri,
    method: this.method,
    headers: this.headers
  }
}

// Return a simpler response object to allow serialization
function responseToJSON() {
  return {
    statusCode: this.statusCode,
    body: this.body,
    headers: this.headers,
    request: requestToJSON.call(this.request)
  }
}

function Request (options) {
  stream.Stream.call(this)
  this.readable = true
  this.writable = true

  if (typeof options === 'string') {
    options = {uri:options}
  }

  var reserved = Object.keys(Request.prototype)
  for (var i in options) {
    if (reserved.indexOf(i) === -1) {
      this[i] = options[i]
    } else {
      if (typeof options[i] === 'function') {
        delete options[i]
      }
    }
  }

  if (options.method) {
    this.explicitMethod = true
  }

  // Assume that we're not going to tunnel unless we need to
  if (typeof options.tunnel === 'undefined') options.tunnel = false

  this.init(options)
}
util.inherits(Request, stream.Stream)


// Set up the tunneling agent if necessary
Request.prototype.setupTunnel = function () {
  var self = this
  if (typeof self.proxy == 'string') self.proxy = url.parse(self.proxy)

  if (!self.proxy) return false

  // Don't need to use a tunneling proxy
  if (!self.tunnel && self.uri.protocol !== 'https:')
    return

  // do the HTTP CONNECT dance using koichik/node-tunnel

  // The host to tell the proxy to CONNECT to
  var proxyHost = self.uri.hostname + ':'
  if (self.uri.port)
    proxyHost += self.uri.port
  else if (self.uri.protocol === 'https:')
    proxyHost += '443'
  else
    proxyHost += '80'

  if (!self.proxyHeaderWhiteList)
    self.proxyHeaderWhiteList = defaultProxyHeaderWhiteList

  // Only send the proxy the whitelisted header names.
  var proxyHeaders = Object.keys(self.headers).filter(function (h) {
    return self.proxyHeaderWhiteList.indexOf(h.toLowerCase()) !== -1
  }).reduce(function (set, h) {
    set[h] = self.headers[h]
    return set
  }, {})

  proxyHeaders.host = proxyHost

  var tunnelFnName =
    (self.uri.protocol === 'https:' ? 'https' : 'http') +
    'Over' +
    (self.proxy.protocol === 'https:' ? 'Https' : 'Http')

  var tunnelFn = tunnel[tunnelFnName]

  var proxyAuth
  if (self.proxy.auth)
    proxyAuth = self.proxy.auth
  else if (self.proxyAuthorization)
    proxyHeaders['Proxy-Authorization'] = self.proxyAuthorization

  var tunnelOptions = { proxy: { host: self.proxy.hostname
                               , port: +self.proxy.port
                               , proxyAuth: proxyAuth
                               , headers: proxyHeaders }
                      , rejectUnauthorized: self.rejectUnauthorized
                      , headers: self.headers
                      , ca: self.ca
                      , cert: self.cert
                      , key: self.key}

  self.agent = tunnelFn(tunnelOptions)

  // At this point, we know that the proxy will support tunneling
  // (or fail miserably), so we're going to tunnel all proxied requests
  // from here on out.
  self.tunnel = true

  return true
}




Request.prototype.init = function (options) {
  // init() contains all the code to setup the request object.
  // the actual outgoing request is not started until start() is called
  // this function is called from both the constructor and on redirect.
  var self = this
  if (!options) options = {}
  self.headers = self.headers ? copy(self.headers) : {}

  caseless.httpify(self, self.headers)

  // Never send proxy-auth to the endpoint!
  if (self.hasHeader('proxy-authorization')) {
    self.proxyAuthorization = self.getHeader('proxy-authorization')
    self.removeHeader('proxy-authorization')
  }

  if (!self.method) self.method = options.method || 'GET'
  self.localAddress = options.localAddress

  debug(options)
  if (!self.pool && self.pool !== false) self.pool = globalPool
  self.dests = self.dests || []
  self.__isRequestRequest = true

  // Protect against double callback
  if (!self._callback && self.callback) {
    self._callback = self.callback
    self.callback = function () {
      if (self._callbackCalled) return // Print a warning maybe?
      self._callbackCalled = true
      self._callback.apply(self, arguments)
    }
    self.on('error', self.callback.bind())
    self.on('complete', self.callback.bind(self, null))
  }

  if (self.url && !self.uri) {
    // People use this property instead all the time so why not just support it.
    self.uri = self.url
    delete self.url
  }

  if (!self.uri) {
    // this will throw if unhandled but is handleable when in a redirect
    return self.emit('error', new Error("options.uri is a required argument"))
  } else {
    if (typeof self.uri == "string") self.uri = url.parse(self.uri)
  }

  if (self.strictSSL === false) {
    self.rejectUnauthorized = false
  }

  if(!self.hasOwnProperty('proxy')) {
    // check for HTTP(S)_PROXY environment variables
    if(self.uri.protocol == "http:") {
        self.proxy = process.env.HTTP_PROXY || process.env.http_proxy || null;
    } else if(self.uri.protocol == "https:") {
        self.proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                     process.env.HTTP_PROXY || process.env.http_proxy || null;
    }
  }

  // Pass in `tunnel:true` to *always* tunnel through proxies
  self.tunnel = !!options.tunnel
  if (self.proxy) {
    self.setupTunnel()
  }

  if (!self.uri.pathname) {self.uri.pathname = '/'}

  if (!self.uri.host && !self.protocol=='unix:') {
    // Invalid URI: it may generate lot of bad errors, like "TypeError: Cannot call method 'indexOf' of undefined" in CookieJar
    // Detect and reject it as soon as possible
    var faultyUri = url.format(self.uri)
    var message = 'Invalid URI "' + faultyUri + '"'
    if (Object.keys(options).length === 0) {
      // No option ? This can be the sign of a redirect
      // As this is a case where the user cannot do anything (they didn't call request directly with this URL)
      // they should be warned that it can be caused by a redirection (can save some hair)
      message += '. This can be caused by a crappy redirection.'
    }
    self.emit('error', new Error(message))
    return // This error was fatal
  }

  self._redirectsFollowed = self._redirectsFollowed || 0
  self.maxRedirects = (self.maxRedirects !== undefined) ? self.maxRedirects : 10
  self.allowRedirect = (typeof self.followRedirect === 'function') ? self.followRedirect : function(response) {
    return true;
  };
  self.followRedirect = (self.followRedirect !== undefined) ? !!self.followRedirect : true
  self.followAllRedirects = (self.followAllRedirects !== undefined) ? self.followAllRedirects : false
  if (self.followRedirect || self.followAllRedirects)
    self.redirects = self.redirects || []

  self.setHost = false
  if (!self.hasHeader('host')) {
    self.setHeader('host', self.uri.hostname)
    if (self.uri.port) {
      if ( !(self.uri.port === 80 && self.uri.protocol === 'http:') &&
           !(self.uri.port === 443 && self.uri.protocol === 'https:') )
      self.setHeader('host', self.getHeader('host') + (':'+self.uri.port) )
    }
    self.setHost = true
  }

  self.jar(self._jar || options.jar)

  if (!self.uri.port) {
    if (self.uri.protocol == 'http:') {self.uri.port = 80}
    else if (self.uri.protocol == 'https:') {self.uri.port = 443}
  }

  if (self.proxy && !self.tunnel) {
    self.port = self.proxy.port
    self.host = self.proxy.hostname
  } else {
    self.port = self.uri.port
    self.host = self.uri.hostname
  }

  self.clientErrorHandler = function (error) {
    if (self._aborted) return
    if (self.req && self.req._reusedSocket && error.code === 'ECONNRESET'
        && self.agent.addRequestNoreuse) {
      self.agent = { addRequest: self.agent.addRequestNoreuse.bind(self.agent) }
      self.start()
      self.req.end()
      return
    }
    if (self.timeout && self.timeoutTimer) {
      clearTimeout(self.timeoutTimer)
      self.timeoutTimer = null
    }
    self.emit('error', error)
  }

  self._parserErrorHandler = function (error) {
    if (this.res) {
      if (this.res.request) {
        this.res.request.emit('error', error)
      } else {
        this.res.emit('error', error)
      }
    } else {
      this._httpMessage.emit('error', error)
    }
  }

  self._buildRequest = function(){
    var self = this;

    if (options.form) {
      self.form(options.form)
    }

    if (options.qs) self.qs(options.qs)

    if (self.uri.path) {
      self.path = self.uri.path
    } else {
      self.path = self.uri.pathname + (self.uri.search || "")
    }

    if (self.path.length === 0) self.path = '/'


    // Auth must happen last in case signing is dependent on other headers
    if (options.oauth) {
      self.oauth(options.oauth)
    }

    if (options.aws) {
      self.aws(options.aws)
    }

    if (options.hawk) {
      self.hawk(options.hawk)
    }

    if (options.httpSignature) {
      self.httpSignature(options.httpSignature)
    }

    if (options.auth) {
      if (Object.prototype.hasOwnProperty.call(options.auth, 'username')) options.auth.user = options.auth.username
      if (Object.prototype.hasOwnProperty.call(options.auth, 'password')) options.auth.pass = options.auth.password

      self.auth(
        options.auth.user,
        options.auth.pass,
        options.auth.sendImmediately,
        options.auth.bearer
      )
    }

    if (self.gzip && !self.hasHeader('accept-encoding')) {
      self.setHeader('accept-encoding', 'gzip')
    }

    if (self.uri.auth && !self.hasHeader('authorization')) {
      var authPieces = self.uri.auth.split(':').map(function(item){ return querystring.unescape(item) })
      self.auth(authPieces[0], authPieces.slice(1).join(':'), true)
    }

    if (self.proxy && !self.tunnel) {
      if (self.proxy.auth && !self.proxyAuthorization) {
        var authPieces = self.proxy.auth.split(':').map(function(item){
          return querystring.unescape(item)
        })
        var authHeader = 'Basic ' + toBase64(authPieces.join(':'))
        self.proxyAuthorization = authHeader
      }
      if (self.proxyAuthorization)
        self.setHeader('proxy-authorization', self.proxyAuthorization)
    }

    if (self.proxy && !self.tunnel) self.path = (self.uri.protocol + '//' + self.uri.host + self.path)

    if (options.json) {
      self.json(options.json)
    } else if (options.multipart) {
      self.boundary = uuid()
      self.multipart(options.multipart)
    }

    if (self.body) {
      var length = 0
      if (!Buffer.isBuffer(self.body)) {
        if (Array.isArray(self.body)) {
          for (var i = 0; i < self.body.length; i++) {
            length += self.body[i].length
          }
        } else {
          self.body = new Buffer(self.body)
          length = self.body.length
        }
      } else {
        length = self.body.length
      }
      if (length) {
        if (!self.hasHeader('content-length')) self.setHeader('content-length', length)
      } else {
        throw new Error('Argument error, options.body.')
      }
    }

    var protocol = self.proxy && !self.tunnel ? self.proxy.protocol : self.uri.protocol
      , defaultModules = {'http:':http, 'https:':https, 'unix:':http}
      , httpModules = self.httpModules || {}
      ;
    self.httpModule = httpModules[protocol] || defaultModules[protocol]

    if (!self.httpModule) return this.emit('error', new Error("Invalid protocol: " + protocol))

    if (options.ca) self.ca = options.ca

    if (!self.agent) {
      if (options.agentOptions) self.agentOptions = options.agentOptions

      if (options.agentClass) {
        self.agentClass = options.agentClass
      } else if (options.forever) {
        self.agentClass = protocol === 'http:' ? ForeverAgent : ForeverAgent.SSL
      } else {
        self.agentClass = self.httpModule.Agent
      }
    }

    if (self.pool === false) {
      self.agent = false
    } else {
      self.agent = self.agent || self.getAgent()
      if (self.maxSockets) {
        // Don't use our pooling if node has the refactored client
        self.agent.maxSockets = self.maxSockets
      }
      if (self.pool.maxSockets) {
        // Don't use our pooling if node has the refactored client
        self.agent.maxSockets = self.pool.maxSockets
      }
    }

    self.on('pipe', function (src) {
      if (self.ntick && self._started) throw new Error("You cannot pipe to this stream after the outbound request has started.")
      self.src = src
      if (isReadStream(src)) {
        if (!self.hasHeader('content-type')) self.setHeader('content-type', mime.lookup(src.path))
      } else {
        if (src.headers) {
          for (var i in src.headers) {
            if (!self.hasHeader(i)) {
              self.setHeader(i, src.headers[i])
            }
          }
        }
        if (self._json && !self.hasHeader('content-type'))
          self.setHeader('content-type', 'application/json')
        if (src.method && !self.explicitMethod) {
          self.method = src.method
        }
      }

      // self.on('pipe', function () {
      //   console.error("You have already piped to this stream. Pipeing twice is likely to break the request.")
      // })
    })

    process.nextTick(function () {
      if (self._aborted) return

      var end = function () {
        if (self._form) {
          self._form.pipe(self)
        }
        if (self.body) {
          if (Array.isArray(self.body)) {
            self.body.forEach(function (part) {
              self.write(part)
            })
          } else {
            self.write(self.body)
          }
          self.end()
        } else if (self.requestBodyStream) {
          console.warn("options.requestBodyStream is deprecated, please pass the request object to stream.pipe.")
          self.requestBodyStream.pipe(self)
        } else if (!self.src) {
          if (self.method !== 'GET' && typeof self.method !== 'undefined') {
            self.setHeader('content-length', 0)
          }
          self.end()
        }
      }

      if (self._form && !self.hasHeader('content-length')) {
        // Before ending the request, we had to compute the length of the whole form, asyncly
        self.setHeader(self._form.getHeaders())
        self._form.getLength(function (err, length) {
          if (!err) {
            self.setHeader('content-length', length)
          }
          end()
        })
      } else {
        end()
      }

      self.ntick = true
    })

  } // End _buildRequest

  self._handleUnixSocketURI = function(self){
    // Parse URI and extract a socket path (tested as a valid socket using net.connect), and a http style path suffix
    // Thus http requests can be made to a socket using the uri unix://tmp/my.socket/urlpath
    // and a request for '/urlpath' will be sent to the unix socket at /tmp/my.socket

    self.unixsocket = true;

    var full_path = self.uri.href.replace(self.uri.protocol+'/', '');

    var lookup = full_path.split('/');
    var error_connecting = true;

    var lookup_table = {};
    do { lookup_table[lookup.join('/')]={} } while(lookup.pop())
    for (r in lookup_table){
      try_next(r);
    }

    function try_next(table_row){
      var client = net.connect( table_row );
      client.path = table_row
      client.on('error', function(){ lookup_table[this.path].error_connecting=true; this.end(); });
      client.on('connect', function(){ lookup_table[this.path].error_connecting=false; this.end(); });
      table_row.client = client;
    }

    wait_for_socket_response();

    response_counter = 0;

    function wait_for_socket_response(){
      var detach;
      if('undefined' == typeof setImmediate ) detach = process.nextTick
      else detach = setImmediate;
      detach(function(){
        // counter to prevent infinite blocking waiting for an open socket to be found.
        response_counter++;
        var trying = false;
        for (r in lookup_table){
          if('undefined' == typeof lookup_table[r].error_connecting)
            trying = true;
        }
        if(trying && response_counter<1000)
          wait_for_socket_response()
        else
          set_socket_properties();
      })
    }

    function set_socket_properties(){
      var host;
      for (r in lookup_table){
        if(lookup_table[r].error_connecting === false){
          host = r
        }
      }
      if(!host){
        self.emit('error', new Error("Failed to connect to any socket in "+full_path))
      }
      var path = full_path.replace(host, '')

      self.socketPath = host
      self.uri.pathname = path
      self.uri.href = path
      self.uri.path = path
      self.host = ''
      self.hostname = ''
      delete self.host
      delete self.hostname
      self._buildRequest();
    }
  }

  // Intercept UNIX protocol requests to change properties to match socket
  if(/^unix:/.test(self.uri.protocol)){
    self._handleUnixSocketURI(self);
  } else {
    self._buildRequest();
  }

}

// Must call this when following a redirect from https to http or vice versa
// Attempts to keep everything as identical as possible, but update the
// httpModule, Tunneling agent, and/or Forever Agent in use.
Request.prototype._updateProtocol = function () {
  var self = this
  var protocol = self.uri.protocol

  if (protocol === 'https:' || self.tunnel) {
    // previously was doing http, now doing https
    // if it's https, then we might need to tunnel now.
    if (self.proxy) {
      if (self.setupTunnel()) return
    }

    self.httpModule = https
    switch (self.agentClass) {
      case ForeverAgent:
        self.agentClass = ForeverAgent.SSL
        break
      case http.Agent:
        self.agentClass = https.Agent
        break
      default:
        // nothing we can do.  Just hope for the best.
        return
    }

    // if there's an agent, we need to get a new one.
    if (self.agent) self.agent = self.getAgent()

  } else {
    // previously was doing https, now doing http
    self.httpModule = http
    switch (self.agentClass) {
      case ForeverAgent.SSL:
        self.agentClass = ForeverAgent
        break
      case https.Agent:
        self.agentClass = http.Agent
        break
      default:
        // nothing we can do.  just hope for the best
        return
    }

    // if there's an agent, then get a new one.
    if (self.agent) {
      self.agent = null
      self.agent = self.getAgent()
    }
  }
}

Request.prototype.getAgent = function () {
  var Agent = this.agentClass
  var options = {}
  if (this.agentOptions) {
    for (var i in this.agentOptions) {
      options[i] = this.agentOptions[i]
    }
  }
  if (this.ca) options.ca = this.ca
  if (this.ciphers) options.ciphers = this.ciphers
  if (this.secureProtocol) options.secureProtocol = this.secureProtocol
  if (this.secureOptions) options.secureOptions = this.secureOptions
  if (typeof this.rejectUnauthorized !== 'undefined') options.rejectUnauthorized = this.rejectUnauthorized

  if (this.cert && this.key) {
    options.key = this.key
    options.cert = this.cert
  }

  var poolKey = ''

  // different types of agents are in different pools
  if (Agent !== this.httpModule.Agent) {
    poolKey += Agent.name
  }

  if (!this.httpModule.globalAgent) {
    // node 0.4.x
    options.host = this.host
    options.port = this.port
    if (poolKey) poolKey += ':'
    poolKey += this.host + ':' + this.port
  }

  // ca option is only relevant if proxy or destination are https
  var proxy = this.proxy
  if (typeof proxy === 'string') proxy = url.parse(proxy)
  var isHttps = (proxy && proxy.protocol === 'https:') || this.uri.protocol === 'https:'
  if (isHttps) {
    if (options.ca) {
      if (poolKey) poolKey += ':'
      poolKey += options.ca
    }

    if (typeof options.rejectUnauthorized !== 'undefined') {
      if (poolKey) poolKey += ':'
      poolKey += options.rejectUnauthorized
    }

    if (options.cert)
      poolKey += options.cert.toString('ascii') + options.key.toString('ascii')

    if (options.ciphers) {
      if (poolKey) poolKey += ':'
      poolKey += options.ciphers
    }

    if (options.secureProtocol) {
      if (poolKey) poolKey += ':'
      poolKey += options.secureProtocol
    }

    if (options.secureOptions) {
      if (poolKey) poolKey += ':'
      poolKey += options.secureOptions
    }
  }

  if (this.pool === globalPool && !poolKey && Object.keys(options).length === 0 && this.httpModule.globalAgent) {
    // not doing anything special.  Use the globalAgent
    return this.httpModule.globalAgent
  }

  // we're using a stored agent.  Make sure it's protocol-specific
  poolKey = this.uri.protocol + poolKey

  // already generated an agent for this setting
  if (this.pool[poolKey]) return this.pool[poolKey]

  return this.pool[poolKey] = new Agent(options)
}

Request.prototype.start = function () {
  // start() is called once we are ready to send the outgoing HTTP request.
  // this is usually called on the first write(), end() or on nextTick()
  var self = this

  if (self._aborted) return

  self._started = true
  self.method = self.method || 'GET'
  self.href = self.uri.href

  if (self.src && self.src.stat && self.src.stat.size && !self.hasHeader('content-length')) {
    self.setHeader('content-length', self.src.stat.size)
  }
  if (self._aws) {
    self.aws(self._aws, true)
  }

  // We have a method named auth, which is completely different from the http.request
  // auth option.  If we don't remove it, we're gonna have a bad time.
  var reqOptions = copy(self)
  delete reqOptions.auth

  debug('make request', self.uri.href)
  self.req = self.httpModule.request(reqOptions, self.onResponse.bind(self))

  if (self.timeout && !self.timeoutTimer) {
    self.timeoutTimer = setTimeout(function () {
      self.req.abort()
      var e = new Error("ETIMEDOUT")
      e.code = "ETIMEDOUT"
      self.emit("error", e)
    }, self.timeout)

    // Set additional timeout on socket - in case if remote
    // server freeze after sending headers
    if (self.req.setTimeout) { // only works on node 0.6+
      self.req.setTimeout(self.timeout, function () {
        if (self.req) {
          self.req.abort()
          var e = new Error("ESOCKETTIMEDOUT")
          e.code = "ESOCKETTIMEDOUT"
          self.emit("error", e)
        }
      })
    }
  }

  self.req.on('error', self.clientErrorHandler)
  self.req.on('drain', function() {
    self.emit('drain')
  })
  self.on('end', function() {
    if ( self.req.connection ) self.req.connection.removeListener('error', self._parserErrorHandler)
  })
  self.emit('request', self.req)
}
Request.prototype.onResponse = function (response) {
  var self = this
  debug('onResponse', self.uri.href, response.statusCode, response.headers)
  response.on('end', function() {
    debug('response end', self.uri.href, response.statusCode, response.headers)
  });

  // The check on response.connection is a workaround for browserify.
  if (response.connection && response.connection.listeners('error').indexOf(self._parserErrorHandler) === -1) {
    response.connection.setMaxListeners(0)
    response.connection.once('error', self._parserErrorHandler)
  }
  if (self._aborted) {
    debug('aborted', self.uri.href)
    response.resume()
    return
  }
  if (self._paused) response.pause()
  // Check that response.resume is defined. Workaround for browserify.
  else response.resume && response.resume()

  self.response = response
  response.request = self
  response.toJSON = responseToJSON

  // XXX This is different on 0.10, because SSL is strict by default
  if (self.httpModule === https &&
      self.strictSSL && (!response.hasOwnProperty('client') ||
      !response.client.authorized)) {
    debug('strict ssl error', self.uri.href)
    var sslErr = response.hasOwnProperty('client') ? response.client.authorizationError : self.uri.href + " does not support SSL";
    self.emit('error', new Error('SSL Error: '+ sslErr))
    return
  }

  if (self.setHost) self.removeHeader('host')
  if (self.timeout && self.timeoutTimer) {
    clearTimeout(self.timeoutTimer)
    self.timeoutTimer = null
  }

  var targetCookieJar = (self._jar && self._jar.setCookieSync)?self._jar:globalCookieJar;
  var addCookie = function (cookie) {
    //set the cookie if it's domain in the href's domain.
    try {
      targetCookieJar.setCookieSync(cookie, self.uri.href, {ignoreError: true});
    } catch (e) {
      self.emit('error', e);
    }
  }

  response.caseless = caseless(response.headers)

  if (response.caseless.has('set-cookie') && (!self._disableCookies)) {
    var headerName = response.caseless.has('set-cookie')
    if (Array.isArray(response.headers[headerName])) response.headers[headerName].forEach(addCookie)
    else addCookie(response.headers[headerName])
  }

  var redirectTo = null
  if (response.statusCode >= 300 && response.statusCode < 400 && response.caseless.has('location')) {
    var location = response.caseless.get('location')
    debug('redirect', location)

    if (self.followAllRedirects) {
      redirectTo = location
    } else if (self.followRedirect) {
      switch (self.method) {
        case 'PATCH':
        case 'PUT':
        case 'POST':
        case 'DELETE':
          // Do not follow redirects
          break
        default:
          redirectTo = location
          break
      }
    }
  } else if (response.statusCode == 401 && self._hasAuth && !self._sentAuth) {
    var authHeader = response.caseless.get('www-authenticate')
    var authVerb = authHeader && authHeader.split(' ')[0].toLowerCase()
    debug('reauth', authVerb)

    switch (authVerb) {
      case 'basic':
        self.auth(self._user, self._pass, true)
        redirectTo = self.uri
        break

      case 'bearer':
        self.auth(null, null, true, self._bearer)
        redirectTo = self.uri
        break

      case 'digest':
        // TODO: More complete implementation of RFC 2617.
        //   - check challenge.algorithm
        //   - support algorithm="MD5-sess"
        //   - handle challenge.domain
        //   - support qop="auth-int" only
        //   - handle Authentication-Info (not necessarily?)
        //   - check challenge.stale (not necessarily?)
        //   - increase nc (not necessarily?)
        // For reference:
        // http://tools.ietf.org/html/rfc2617#section-3
        // https://github.com/bagder/curl/blob/master/lib/http_digest.c

        var challenge = {}
        var re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi
        for (;;) {
          var match = re.exec(authHeader)
          if (!match) break
          challenge[match[1]] = match[2] || match[3];
        }

        var ha1 = md5(self._user + ':' + challenge.realm + ':' + self._pass)
        var ha2 = md5(self.method + ':' + self.uri.path)
        var qop = /(^|,)\s*auth\s*($|,)/.test(challenge.qop) && 'auth'
        var nc = qop && '00000001'
        var cnonce = qop && uuid().replace(/-/g, '')
        var digestResponse = qop ? md5(ha1 + ':' + challenge.nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2) : md5(ha1 + ':' + challenge.nonce + ':' + ha2)
        var authValues = {
          username: self._user,
          realm: challenge.realm,
          nonce: challenge.nonce,
          uri: self.uri.path,
          qop: qop,
          response: digestResponse,
          nc: nc,
          cnonce: cnonce,
          algorithm: challenge.algorithm,
          opaque: challenge.opaque
        }

        authHeader = []
        for (var k in authValues) {
          if (!authValues[k]) {
            //ignore
          } else if (k === 'qop' || k === 'nc' || k === 'algorithm') {
            authHeader.push(k + '=' + authValues[k])
          } else {
            authHeader.push(k + '="' + authValues[k] + '"')
          }
        }
        authHeader = 'Digest ' + authHeader.join(', ')
        self.setHeader('authorization', authHeader)
        self._sentAuth = true

        redirectTo = self.uri
        break
    }
  }

  if (redirectTo && self.allowRedirect.call(self, response)) {
    debug('redirect to', redirectTo)

    // ignore any potential response body.  it cannot possibly be useful
    // to us at this point.
    if (self._paused) response.resume()

    if (self._redirectsFollowed >= self.maxRedirects) {
      self.emit('error', new Error("Exceeded maxRedirects. Probably stuck in a redirect loop "+self.uri.href))
      return
    }
    self._redirectsFollowed += 1

    if (!isUrl.test(redirectTo)) {
      redirectTo = url.resolve(self.uri.href, redirectTo)
    }

    var uriPrev = self.uri
    self.uri = url.parse(redirectTo)

    // handle the case where we change protocol from https to http or vice versa
    if (self.uri.protocol !== uriPrev.protocol) {
      self._updateProtocol()
    }

    self.redirects.push(
      { statusCode : response.statusCode
      , redirectUri: redirectTo
      }
    )
    if (self.followAllRedirects && response.statusCode != 401 && response.statusCode != 307) self.method = 'GET'
    // self.method = 'GET' // Force all redirects to use GET || commented out fixes #215
    delete self.src
    delete self.req
    delete self.agent
    delete self._started
    if (response.statusCode != 401 && response.statusCode != 307) {
      // Remove parameters from the previous response, unless this is the second request
      // for a server that requires digest authentication.
      delete self.body
      delete self._form
      if (self.headers) {
        self.removeHeader('host')
        self.removeHeader('content-type')
        self.removeHeader('content-length')
      }
    }

    self.emit('redirect');

    self.init()
    return // Ignore the rest of the response
  } else {
    self._redirectsFollowed = self._redirectsFollowed || 0
    // Be a good stream and emit end when the response is finished.
    // Hack to emit end on close because of a core bug that never fires end
    response.on('close', function () {
      if (!self._ended) self.response.emit('end')
    })

    response.on('end', function () {
      self._ended = true
    })

    var dataStream
    if (self.gzip) {
      var contentEncoding = response.headers["content-encoding"] || "identity"
      contentEncoding = contentEncoding.trim().toLowerCase()

      if (contentEncoding === "gzip") {
        dataStream = zlib.createGunzip()
        response.pipe(dataStream)
      } else {
        // Since previous versions didn't check for Content-Encoding header,
        // ignore any invalid values to preserve backwards-compatibility
        if (contentEncoding !== "identity") {
          debug("ignoring unrecognized Content-Encoding " + contentEncoding)
        }
        dataStream = response
      }
    } else {
      dataStream = response
    }

    if (self.encoding) {
      if (self.dests.length !== 0) {
        console.error("Ignoring encoding parameter as this stream is being piped to another stream which makes the encoding option invalid.")
      } else if (dataStream.setEncoding) {
        dataStream.setEncoding(self.encoding)
      } else {
        // Should only occur on node pre-v0.9.4 (joyent/node@9b5abe5) with
        // zlib streams.
        // If/When support for 0.9.4 is dropped, this should be unnecessary.
        dataStream = dataStream.pipe(stringstream(self.encoding))
      }
    }

    self.emit('response', response)

    self.dests.forEach(function (dest) {
      self.pipeDest(dest)
    })

    dataStream.on("data", function (chunk) {
      self._destdata = true
      self.emit("data", chunk)
    })
    dataStream.on("end", function (chunk) {
      self.emit("end", chunk)
    })
    dataStream.on("error", function (error) {
      self.emit("error", error)
    })
    dataStream.on("close", function () {self.emit("close")})

    if (self.callback) {
      var buffer = bl()
        , strings = []
        ;
      self.on("data", function (chunk) {
        if (Buffer.isBuffer(chunk)) buffer.append(chunk)
        else strings.push(chunk)
      })
      self.on("end", function () {
        debug('end event', self.uri.href)
        if (self._aborted) {
          debug('aborted', self.uri.href)
          return
        }

        if (buffer.length) {
          debug('has body', self.uri.href, buffer.length)
          if (self.encoding === null) {
            // response.body = buffer
            // can't move to this until https://github.com/rvagg/bl/issues/13
            response.body = buffer.slice()
          } else {
            response.body = buffer.toString(self.encoding)
          }
        } else if (strings.length) {
          // The UTF8 BOM [0xEF,0xBB,0xBF] is converted to [0xFE,0xFF] in the JS UTC16/UCS2 representation.
          // Strip this value out when the encoding is set to 'utf8', as upstream consumers won't expect it and it breaks JSON.parse().
          if (self.encoding === 'utf8' && strings[0].length > 0 && strings[0][0] === "\uFEFF") {
            strings[0] = strings[0].substring(1)
          }
          response.body = strings.join('')
        }

        if (self._json) {
          try {
            response.body = JSON.parse(response.body)
          } catch (e) {}
        }
        debug('emitting complete', self.uri.href)
        if(response.body == undefined && !self._json) {
          response.body = "";
        }
        self.emit('complete', response, response.body)
      })
    }
    //if no callback
    else{
      self.on("end", function () {
        if (self._aborted) {
          debug('aborted', self.uri.href)
          return
        }
        self.emit('complete', response);
      });
    }
  }
  debug('finish init function', self.uri.href)
}

Request.prototype.abort = function () {
  this._aborted = true

  if (this.req) {
    this.req.abort()
  }
  else if (this.response) {
    this.response.abort()
  }

  this.emit("abort")
}

Request.prototype.pipeDest = function (dest) {
  var response = this.response
  // Called after the response is received
  if (dest.headers && !dest.headersSent) {
    if (response.caseless.has('content-type')) {
      var ctname = response.caseless.has('content-type')
      if (dest.setHeader) dest.setHeader(ctname, response.headers[ctname])
      else dest.headers[ctname] = response.headers[ctname]
    }

    if (response.caseless.has('content-length')) {
      var clname = response.caseless.has('content-length')
      if (dest.setHeader) dest.setHeader(clname, response.headers[clname])
      else dest.headers[clname] = response.headers[clname]
    }
  }
  if (dest.setHeader && !dest.headersSent) {
    for (var i in response.headers) {
      // If the response content is being decoded, the Content-Encoding header
      // of the response doesn't represent the piped content, so don't pass it.
      if (!this.gzip || i !== 'content-encoding') {
        dest.setHeader(i, response.headers[i])
      }
    }
    dest.statusCode = response.statusCode
  }
  if (this.pipefilter) this.pipefilter(response, dest)
}

Request.prototype.qs = function (q, clobber) {
  var base
  if (!clobber && this.uri.query) base = qs.parse(this.uri.query)
  else base = {}

  for (var i in q) {
    base[i] = q[i]
  }

  if (qs.stringify(base) === ''){
    return this
  }

  this.uri = url.parse(this.uri.href.split('?')[0] + '?' + qs.stringify(base))
  this.url = this.uri
  this.path = this.uri.path

  return this
}
Request.prototype.form = function (form) {
  if (form) {
    this.setHeader('content-type', 'application/x-www-form-urlencoded; charset=utf-8')
    this.body = (typeof form === 'string') ? form.toString('utf8') : qs.stringify(form).toString('utf8')
    return this
  }
  // create form-data object
  this._form = new FormData()
  return this._form
}
Request.prototype.multipart = function (multipart) {
  var self = this
  self.body = []

  if (!self.hasHeader('content-type')) {
    self.setHeader('content-type', 'multipart/related; boundary=' + self.boundary)
  } else {
    var headerName = self.hasHeader('content-type');
    self.setHeader(headerName, self.headers[headerName].split(';')[0] + '; boundary=' + self.boundary)
  }

  if (!multipart.forEach) throw new Error('Argument error, options.multipart.')

  if (self.preambleCRLF) {
    self.body.push(new Buffer('\r\n'))
  }

  multipart.forEach(function (part) {
    var body = part.body
    if(body == null) throw Error('Body attribute missing in multipart.')
    delete part.body
    var preamble = '--' + self.boundary + '\r\n'
    Object.keys(part).forEach(function (key) {
      preamble += key + ': ' + part[key] + '\r\n'
    })
    preamble += '\r\n'
    self.body.push(new Buffer(preamble))
    self.body.push(new Buffer(body))
    self.body.push(new Buffer('\r\n'))
  })
  self.body.push(new Buffer('--' + self.boundary + '--'))
  return self
}
Request.prototype.json = function (val) {
  var self = this

  if (!self.hasHeader('accept')) self.setHeader('accept', 'application/json')

  this._json = true
  if (typeof val === 'boolean') {
    if (typeof this.body === 'object') {
      this.body = safeStringify(this.body)
      if (!self.hasHeader('content-type'))
        self.setHeader('content-type', 'application/json')
    }
  } else {
    this.body = safeStringify(val)
    if (!self.hasHeader('content-type'))
      self.setHeader('content-type', 'application/json')
  }

  return this
}
Request.prototype.getHeader = function (name, headers) {
  var result, re, match
  if (!headers) headers = this.headers
  Object.keys(headers).forEach(function (key) {
    if (key.length !== name.length) return
    re = new RegExp(name, 'i')
    match = key.match(re)
    if (match) result = headers[key]
  })
  return result
}
var getHeader = Request.prototype.getHeader

Request.prototype.auth = function (user, pass, sendImmediately, bearer) {
  if (bearer !== undefined) {
    this._bearer = bearer
    this._hasAuth = true
    if (sendImmediately || typeof sendImmediately == 'undefined') {
      if (typeof bearer === 'function') {
        bearer = bearer()
      }
      this.setHeader('authorization', 'Bearer ' + bearer)
      this._sentAuth = true
    }
    return this
  }
  if (typeof user !== 'string' || (pass !== undefined && typeof pass !== 'string')) {
    throw new Error('auth() received invalid user or password')
  }
  this._user = user
  this._pass = pass
  this._hasAuth = true
  var header = typeof pass !== 'undefined' ? user + ':' + pass : user
  if (sendImmediately || typeof sendImmediately == 'undefined') {
    this.setHeader('authorization', 'Basic ' + toBase64(header))
    this._sentAuth = true
  }
  return this
}

Request.prototype.aws = function (opts, now) {
  if (!now) {
    this._aws = opts
    return this
  }
  var date = new Date()
  this.setHeader('date', date.toUTCString())
  var auth =
    { key: opts.key
    , secret: opts.secret
    , verb: this.method.toUpperCase()
    , date: date
    , contentType: this.getHeader('content-type') || ''
    , md5: this.getHeader('content-md5') || ''
    , amazonHeaders: aws.canonicalizeHeaders(this.headers)
    }
  var path = this.uri.path;
  if (opts.bucket && path) {
    auth.resource = '/' + opts.bucket + path
  } else if (opts.bucket && !path) {
    auth.resource = '/' + opts.bucket
  } else if (!opts.bucket && path) {
    auth.resource = path
  } else if (!opts.bucket && !path) {
    auth.resource = '/'
  }
  auth.resource = aws.canonicalizeResource(auth.resource)
  this.setHeader('authorization', aws.authorization(auth))

  return this
}
Request.prototype.httpSignature = function (opts) {
  var req = this
  httpSignature.signRequest({
    getHeader: function(header) {
      return getHeader(header, req.headers)
    },
    setHeader: function(header, value) {
      req.setHeader(header, value)
    },
    method: this.method,
    path: this.path
  }, opts)
  debug('httpSignature authorization', this.getHeader('authorization'))

  return this
}

Request.prototype.hawk = function (opts) {
  this.setHeader('Authorization', hawk.client.header(this.uri, this.method, opts).field)
}

Request.prototype.oauth = function (_oauth) {
  var form, query
  if (this.hasHeader('content-type') &&
      this.getHeader('content-type').slice(0, 'application/x-www-form-urlencoded'.length) ===
        'application/x-www-form-urlencoded'
     ) {
    form = this.body
  }
  if (this.uri.query) {
    query = this.uri.query
  }

  var oa = {}
  for (var i in _oauth) oa['oauth_'+i] = _oauth[i]
  if ('oauth_realm' in oa) delete oa.oauth_realm

  if (!oa.oauth_version) oa.oauth_version = '1.0'
  if (!oa.oauth_timestamp) oa.oauth_timestamp = Math.floor( Date.now() / 1000 ).toString()
  if (!oa.oauth_nonce) oa.oauth_nonce = uuid().replace(/-/g, '')

  oa.oauth_signature_method = 'HMAC-SHA1'

  var consumer_secret = oa.oauth_consumer_secret
  delete oa.oauth_consumer_secret
  var token_secret = oa.oauth_token_secret
  delete oa.oauth_token_secret

  var baseurl = this.uri.protocol + '//' + this.uri.host + this.uri.pathname
  var params = qs.parse([].concat(query, form, qs.stringify(oa)).join('&'))
  var signature = oauth.hmacsign(this.method, baseurl, params, consumer_secret, token_secret)

  var realm = _oauth.realm ? 'realm="' + _oauth.realm + '",' : '';
  var authHeader = 'OAuth ' + realm +
    Object.keys(oa).sort().map(function (i) {return i+'="'+oauth.rfc3986(oa[i])+'"'}).join(',')
  authHeader += ',oauth_signature="' + oauth.rfc3986(signature) + '"'
  this.setHeader('Authorization', authHeader)
  return this
}
Request.prototype.jar = function (jar) {
  var cookies

  if (this._redirectsFollowed === 0) {
    this.originalCookieHeader = this.getHeader('cookie')
  }

  if (!jar) {
    // disable cookies
    cookies = false
    this._disableCookies = true
  } else {
    var targetCookieJar = (jar && jar.getCookieStringSync)?jar:globalCookieJar;
    var urihref = this.uri.href
    //fetch cookie in the Specified host
    if (targetCookieJar) {
      cookies = targetCookieJar.getCookieStringSync(urihref);
    }
  }

  //if need cookie and cookie is not empty
  if (cookies && cookies.length) {
    if (this.originalCookieHeader) {
      // Don't overwrite existing Cookie header
      this.setHeader('cookie', this.originalCookieHeader + '; ' + cookies)
    } else {
      this.setHeader('cookie', cookies)
    }
  }
  this._jar = jar
  return this
}


// Stream API
Request.prototype.pipe = function (dest, opts) {
  if (this.response) {
    if (this._destdata) {
      throw new Error("You cannot pipe after data has been emitted from the response.")
    } else if (this._ended) {
      throw new Error("You cannot pipe after the response has been ended.")
    } else {
      stream.Stream.prototype.pipe.call(this, dest, opts)
      this.pipeDest(dest)
      return dest
    }
  } else {
    this.dests.push(dest)
    stream.Stream.prototype.pipe.call(this, dest, opts)
    return dest
  }
}
Request.prototype.write = function () {
  if (!this._started) this.start()
  return this.req.write.apply(this.req, arguments)
}
Request.prototype.end = function (chunk) {
  if (chunk) this.write(chunk)
  if (!this._started) this.start()
  this.req.end()
}
Request.prototype.pause = function () {
  if (!this.response) this._paused = true
  else this.response.pause.apply(this.response, arguments)
}
Request.prototype.resume = function () {
  if (!this.response) this._paused = false
  else this.response.resume.apply(this.response, arguments)
}
Request.prototype.destroy = function () {
  if (!this._ended) this.end()
  else if (this.response) this.response.destroy()
}

Request.prototype.toJSON = requestToJSON

Request.defaultProxyHeaderWhiteList =
  defaultProxyHeaderWhiteList.slice()


module.exports = Request

}).call(this,require('_process'),require("buffer").Buffer)
},{"./lib/cookies":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/cookies.js","./lib/copy":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/copy.js","./lib/debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/debug.js","./lib/optional":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/lib/optional.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","bl":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/bl.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","caseless":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/caseless/index.js","crypto":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/index.js","forever-agent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/forever-agent/index.js","http":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/index.js","json-stringify-safe":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/json-stringify-safe/stringify.js","mime-types":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/mime-types/lib/index.js","net":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","node-uuid":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/node-uuid/uuid.js","qs":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/qs/index.js","querystring":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","tunnel-agent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/tunnel-agent/index.js","url":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/url/url.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js","zlib":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/src/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/typedarray-to-buffer/index.js":[function(require,module,exports){
(function (Buffer){
/**
 * Convert a typed array to a Buffer without a copy
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install typedarray-to-buffer`
 */

module.exports = function (arr) {
  if (typeof Buffer._augment === 'function' && Buffer.TYPED_ARRAY_SUPPORT) {
    // If `Buffer` is from the `buffer` module and this browser supports typed arrays,
    // then augment it with all the `Buffer` methods.
    return Buffer._augment(arr)
  } else {
    // Otherwise, fallback to creating a `Buffer` with a copy.
    return new Buffer(arr)
  }
}

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/index.js":[function(require,module,exports){
(function (process,Buffer){
// TODO: dhtPort and torrentPort should be consistent between restarts
// TODO: peerId and nodeId should be consistent between restarts

module.exports = WebTorrent

var createTorrent = require('create-torrent')
var debug = require('debug')('webtorrent')
var DHT = require('bittorrent-dht/client') // browser exclude
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var FSStorage = require('./lib/fs-storage') // browser exclude
var hat = require('hat')
var inherits = require('inherits')
var loadIPSet = require('load-ip-set') // browser exclude
var parallel = require('run-parallel')
var parseTorrent = require('parse-torrent')
var Server = require('./lib/server') // browser exclude
var speedometer = require('speedometer')
var Storage = require('./lib/storage')
var Torrent = require('./lib/torrent')

inherits(WebTorrent, EventEmitter)

/**
 * WebTorrent Client
 * @param {Object} opts
 */
function WebTorrent (opts) {
  var self = this
  if (!(self instanceof WebTorrent)) return new WebTorrent(opts)
  if (!opts) opts = {}
  EventEmitter.call(self)

  self.listening = false
  self.torrentPort = opts.torrentPort || 0
  self.tracker = (opts.tracker !== undefined) ? opts.tracker : true
  self.torrents = []

  self.downloadSpeed = speedometer()
  self.uploadSpeed = speedometer()

  self.storage = typeof opts.storage === 'function'
    ? opts.storage
    : (opts.storage !== false && typeof FSStorage === 'function' /* browser exclude */)
      ? FSStorage
      : Storage

  self.peerId = opts.peerId === undefined
    ? new Buffer('-WW0001-' + hat(48), 'utf8')
    : typeof opts.peerId === 'string'
      ? new Buffer(opts.peerId, 'utf8')
      : opts.peerId
  self.peerIdHex = self.peerId.toString('hex')

  self.nodeId = opts.nodeId === undefined
    ? new Buffer(hat(160), 'hex')
    : typeof opts.nodeId === 'string'
      ? new Buffer(opts.nodeId, 'hex')
      : opts.nodeId
  self.nodeIdHex = self.nodeId.toString('hex')

  // TODO: implement webtorrent-dht
  if (opts.dht !== false && typeof DHT === 'function' /* browser exclude */) {
    // use a single DHT instance for all torrents, so the routing table can be reused
    self.dht = new DHT(extend({ nodeId: self.nodeId }, opts.dht))
    self.dht.listen(opts.dhtPort)
  }

  debug('new webtorrent (peerId %s, nodeId %s)', self.peerIdHex, self.nodeIdHex)

  // TODO: this is probably broken
  if (opts.list) return

  if (opts.port !== false && typeof Server === 'function' /* browser exclude */) {
    self.server = new Server(self, opts.port)
    self.server.on('listening', function () {
      self.listening = true
      self.emit('listening')
    })
  }

  if (typeof loadIPSet === 'function') {
    loadIPSet(opts.blocklist, function (err, ipSet) {
      self.blocked = ipSet
      ready()
    })
  } else process.nextTick(ready)

  function ready () {
    self.ready = true
    self.emit('ready')
  }
}

/**
 * Seed ratio for all torrents in the client.
 * @type {number}
 */
Object.defineProperty(WebTorrent.prototype, 'ratio', {
  get: function () {
    var self = this
    var uploaded = self.torrents.reduce(function (total, torrent) {
      return total + torrent.uploaded
    }, 0)
    var downloaded = self.torrents.reduce(function (total, torrent) {
      return total + torrent.downloaded
    }, 0) || 1
    return uploaded / downloaded
  }
})

/**
 * Returns the torrent with the given `torrentId`. Convenience method. Easier than
 * searching through the `client.torrents` array.
 *
 * @param  {string|Buffer|Object} torrentId
 * @return {Torrent}
 */
WebTorrent.prototype.get = function (torrentId) {
  var self = this
  var parsed = parseTorrent(torrentId)
  if (!parsed || !parsed.infoHash) return null
  for (var i = 0, len = self.torrents.length; i < len; i++) {
    var torrent = self.torrents[i]
    if (torrent.infoHash === parsed.infoHash) return torrent
  }
  return null
}

/**
 * Start downloading a new torrent. Aliased as `client.download`.
 *
 * `torrentId` can be one of:
 *   - magnet uri (utf8 string)
 *   - torrent file (buffer)
 *   - info hash (hex string or buffer)
 *   - parsed torrent (from [parse-torrent](https://github.com/feross/parse-torrent))
 *   - http/https url to a .torrent file (string)
 *   - filesystem path to a .torrent file (string)
 *
 * @param {string|Buffer|Object} torrentId
 * @param {Object} opts torrent-specific options
 * @param {function=} ontorrent called when the torrent is ready (has metadata)
 */
WebTorrent.prototype.add =
WebTorrent.prototype.download = function (torrentId, opts, ontorrent) {
  var self = this
  debug('add %s', torrentId)
  if (typeof opts === 'function') {
    ontorrent = opts
    opts = {}
  }
  if (!opts) opts = {}

  opts.client = self
  opts.storage = opts.storage || self.storage

  // TODO: fix this to work with multiple torrents. this should probably be in cmd.js
  self.index = opts.index

  var torrent = new Torrent(torrentId, extend({ client: self }, opts))
  self.torrents.push(torrent)

  function clientOnTorrent (_torrent) {
    if (torrent.infoHash === _torrent.infoHash) {
      ontorrent(torrent)
      self.removeListener('torrent', clientOnTorrent)
    }
  }
  if (ontorrent) self.on('torrent', clientOnTorrent)

  torrent.on('error', function (err) {
    self.emit('error', err, torrent)
  })

  torrent.on('listening', function (port) {
    self.emit('listening', port, torrent)
  })

  torrent.on('ready', function () {
    // Emit 'torrent' when a torrent is ready to be used
    debug('torrent')
    self.emit('torrent', torrent)
    self._onTorrent(torrent)
  })

  return torrent
}

/**
 * Start seeding a new torrent.
 *
 * `input` can be any of the following:
 *   - path to the file or folder on filesystem (string)
 *   - W3C File object (from an `<input>` or drag and drop)
 *   - W3C FileList object (basically an array of `File` objects)
 *   - Array of `File` objects
 *
 * @param  {string|File|FileList|Array.<File>|Blob|Array.<Blob>} input
 * @param  {Object} opts
 * @param  {function} onseed
 */
WebTorrent.prototype.seed = function (input, opts, onseed) {
  var self = this
  if (typeof opts === 'function') {
    onseed = opts
    opts = {}
  }
  // TODO: support `input` as filesystem path string
  var buffer = Buffer.concat(input.map(function (file) {
    return file.buffer
  }))

  var torrent
  function clientOnSeed (_torrent) {
    if (torrent.infoHash === _torrent.infoHash) {
      onseed(torrent)
      self.removeListener('seed', clientOnSeed)
    }
  }
  if (onseed) self.on('seed', clientOnSeed)

  createTorrent(input, opts, function (err, torrentBuf) {
    if (err) return self.emit('error', err)
    var parsedTorrent = parseTorrent(torrentBuf)
    self.add(torrentBuf, opts, function (_torrent) {
      torrent = _torrent
      Storage.writeToStorage(
        torrent.storage,
        buffer,
        parsedTorrent.pieceLength,
        function (err) {
          if (err) return self.emit('error', err)
          self.emit('seed', torrent)
        })
    })
  })
}

/**
 * Remove a torrent from the client.
 *
 * @param  {string|Buffer}   torrentId
 * @param  {function} cb
 */
WebTorrent.prototype.remove = function (torrentId, cb) {
  var self = this
  var torrent = self.get(torrentId)
  if (!torrent) throw new Error('No torrent with id ' + torrentId)
  debug('remove')
  self.torrents.splice(self.torrents.indexOf(torrent), 1)
  torrent.destroy(cb)
}

/**
 * Destroy the client, including all torrents and connections to peers.
 *
 * @override
 * @param  {function} cb
 */
WebTorrent.prototype.destroy = function (cb) {
  var self = this
  debug('destroy')

  var tasks = self.torrents.map(function (torrent) {
    return function (cb) {
      self.remove(torrent.infoHash, cb)
    }
  })

  if (self.dht) tasks.push(function (cb) {
    self.dht.destroy(cb)
  })

  if (self.server) tasks.push(function (cb) {
    try {
      self.server.close(cb)
    } catch (err) {
      // ignore error, server was already closed or not listening
      cb(null)
    }
  })

  parallel(tasks, cb)
}

// TODO: this probably belongs in cmd.js
WebTorrent.prototype._onTorrent = function (torrent) {
  var self = this
  debug('on torrent')

  // if no index specified, use largest file
  if (typeof torrent.index !== 'number') {
    var largestFile = torrent.files.reduce(function (a, b) {
      return a.length > b.length ? a : b
    })
    torrent.index = torrent.files.indexOf(largestFile)
  }

  torrent.files[torrent.index].select()

  // TODO: this won't work with multiple torrents
  self.index = torrent.index
  self.torrent = torrent
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"./lib/fs-storage":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","./lib/server":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","./lib/storage":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/storage.js","./lib/torrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/torrent.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","bittorrent-dht/client":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","create-torrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/index.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","hat":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/hat/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","load-ip-set":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","parse-torrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/index.js","run-parallel":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/run-parallel/index.js","speedometer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/speedometer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/file-stream.js":[function(require,module,exports){
module.exports = FileStream

var debug = require('debug')('webtorrent:file-stream')
var inherits = require('inherits')
var stream = require('stream')

inherits(FileStream, stream.Readable)

/**
 * A readable stream of a torrent file.
 *
 * @param {Object} file
 * @param {number} opts.start stream slice of file, starting from this byte (inclusive)
 * @param {number} opts.end stream slice of file, ending with this byte (inclusive)
 * @param {number} opts.pieceLength length of an individual piece
 */
function FileStream (file, opts) {
  var self = this
  if (!(self instanceof FileStream)) return new FileStream(file, opts)
  stream.Readable.call(self, opts)
  debug('new filestream %s', JSON.stringify(opts))

  if (!opts) opts = {}
  if (!opts.start) opts.start = 0
  if (!opts.end) opts.end = file.length - 1

  self.length = opts.end - opts.start + 1

  var offset = opts.start + file.offset
  var pieceLength = opts.pieceLength

  self.startPiece = offset / pieceLength | 0
  self.endPiece = (opts.end + file.offset) / pieceLength | 0

  self._storage = file.storage
  self._piece = self.startPiece
  self._missing = self.length
  self._reading = false
  self._notifying = false
  self._destroyed = false
  self._criticalLength = Math.min((1024 * 1024 / pieceLength) | 0, 2)
  self._offset = offset - (self.startPiece * pieceLength)
}

FileStream.prototype._read = function () {
  debug('_read')
  var self = this
  if (self._reading) return
  self._reading = true
  self.notify()
}

FileStream.prototype.notify = function () {
  debug('notify')
  var self = this

  if (!self._reading || self._missing === 0) return
  if (!self._storage.bitfield.get(self._piece))
    return self._storage.emit('critical', self._piece, self._piece + self._criticalLength)

  if (self._notifying) return
  self._notifying = true

  var p = self._piece
  debug('before read %s', p)
  self._storage.read(self._piece++, function (err, buffer) {
    debug('after read %s (buffer.length %s) (err %s)', p, buffer.length, (err && err.message) || err)
    self._notifying = false

    if (self._destroyed) return

    if (err) {
      self._storage.emit('error', err)
      return self.destroy(err)
    }

    if (self._offset) {
      buffer = buffer.slice(self._offset)
      self._offset = 0
    }

    if (self._missing < buffer.length) {
      buffer = buffer.slice(0, self._missing)
    }
    self._missing -= buffer.length

    debug('pushing buffer of length %s', buffer.length)
    self._reading = false
    self.push(buffer)

    if (self._missing === 0) self.push(null)
  })
}

FileStream.prototype.destroy = function () {
  var self = this
  if (self._destroyed) return
  self._destroyed = true
}

},{"debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/rarity-map.js":[function(require,module,exports){
module.exports = RarityMap

/**
 * Mapping of torrent pieces to their respective availability in the swarm. Used by
 * the torrent manager for implementing the rarest piece first selection strategy.
 *
 * @param {Swarm}  swarm bittorrent-swarm to track availability
 * @param {number} numPieces number of pieces in the torrent
 */
function RarityMap (swarm, numPieces) {
  var self = this

  self.swarm = swarm
  self.numPieces = numPieces

  function initWire (wire) {
    wire.on('have', function (index) {
      self.pieces[index]++
    })
    wire.on('bitfield', self.recalculate.bind(self))
    wire.on('close', function () {
      for (var i = 0; i < self.numPieces; ++i) {
        self.pieces[i] -= wire.peerPieces.get(i)
      }
    })
  }

  self.swarm.wires.forEach(initWire)
  self.swarm.on('wire', function (wire) {
    self.recalculate()
    initWire(wire)
  })

  self.recalculate()
}

/**
 * Recalculates piece availability across all peers in the swarm.
 */
RarityMap.prototype.recalculate = function () {
  var self = this

  self.pieces = []
  for (var i = 0; i < self.numPieces; ++i) {
    self.pieces[i] = 0
  }

  self.swarm.wires.forEach(function (wire) {
    for (var i = 0; i < self.numPieces; ++i) {
      self.pieces[i] += wire.peerPieces.get(i)
    }
  })
}

/**
 * Get the index of the rarest piece. Optionally, pass a filter function to exclude
 * certain pieces (for instance, those that we already have).
 *
 * @param {function} pieceFilterFunc
 * @return {number} index of rarest piece, or -1
 */
RarityMap.prototype.getRarestPiece = function (pieceFilterFunc) {
  var self = this
  var candidates = []
  var min = Infinity
  pieceFilterFunc = pieceFilterFunc || function () { return true }

  for (var i = 0; i < self.numPieces; ++i) {
    if (!pieceFilterFunc(i)) continue

    var availability = self.pieces[i]
    if (availability === min) {
      candidates.push(i)
    } else if (availability < min) {
      candidates = [ i ]
      min = availability
    }
  }

  if (candidates.length > 0) {
    // if there are multiple pieces with the same availability, choose one randomly
    return candidates[Math.random() * candidates.length | 0]
  } else {
    return -1
  }
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/storage.js":[function(require,module,exports){
(function (process,Buffer){
module.exports = Storage

var BitField = require('bitfield')
var BlockStream = require('block-stream')
var debug = require('debug')('webtorrent:storage')
var dezalgo = require('dezalgo')
var eos = require('end-of-stream')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var FileStream = require('./file-stream')
var inherits = require('inherits')
var sha1 = require('git-sha1')
var stream = require('stream')

var BLOCK_LENGTH = 16 * 1024

var BLOCK_BLANK = 0
var BLOCK_RESERVED = 1
var BLOCK_WRITTEN = 2
function noop () {}

inherits(Piece, EventEmitter)

/**
 * A torrent piece
 *
 * @param {number} index  piece index
 * @param {string} hash   sha1 hash (hex) for this piece
 * @param {Buffer|number} buffer backing buffer for this piece or length of piece if the backing buffer is lazy
 */
function Piece (index, hash, buffer) {
  var self = this
  EventEmitter.call(self)

  self.index = index
  self.hash = hash

  if (typeof buffer === 'number') {
    // alloc buffer lazily
    self.buffer = null
    self.length = buffer
  } else {
    // use buffer provided
    self.buffer = buffer
    self.length = buffer.length
  }

  self._reset()
}

Piece.prototype.readBlock = function (offset, length, cb) {
  var self = this
  cb = dezalgo(cb)
  if (!self.buffer || !self._verifyOffset(offset)) {
    return cb(new Error('invalid block offset ' + offset))
  }
  cb(null, self.buffer.slice(offset, offset + length))
}

Piece.prototype.writeBlock = function (offset, buffer, cb) {
  var self = this
  cb = dezalgo(cb)
  if (!self._verifyOffset(offset) || !self._verifyBlock(offset, buffer)) {
    return cb(new Error('invalid block ' + offset + ':' + buffer.length))
  }
  self._lazyAllocBuffer()

  var i = offset / BLOCK_LENGTH
  if (self.blocks[i] === BLOCK_WRITTEN) {
    return cb(null)
  }

  buffer.copy(self.buffer, offset)
  self.blocks[i] = BLOCK_WRITTEN
  self.blocksWritten += 1

  if (self.blocksWritten === self.blocks.length) {
    self.verify()
  }

  cb(null)
}

Piece.prototype.reserveBlock = function (endGame) {
  var self = this
  var len = self.blocks.length
  for (var i = 0; i < len; i++) {
    if ((self.blocks[i] && !endGame) || self.blocks[i] === BLOCK_WRITTEN) {
      continue
    }
    self.blocks[i] = BLOCK_RESERVED
    return {
      offset: i * BLOCK_LENGTH,
      length: (i === len - 1)
        ? self.length - (i * BLOCK_LENGTH)
        : BLOCK_LENGTH
    }
  }
  return null
}

Piece.prototype.cancelBlock = function (offset) {
  var self = this
  if (!self.buffer || !self._verifyOffset(offset)) {
    return false
  }

  var i = offset / BLOCK_LENGTH
  if (self.blocks[i] === BLOCK_RESERVED) {
    self.blocks[i] = BLOCK_BLANK
  }

  return true
}

Piece.prototype._reset = function () {
  var self = this
  self.verified = false
  self.blocks = new Buffer(Math.ceil(self.length / BLOCK_LENGTH))
  self.blocks.fill(0)
  self.blocksWritten = 0
}

Piece.prototype.verify = function (buffer) {
  var self = this
  buffer = buffer || self.buffer
  if (self.verified || !buffer) {
    return
  }

  self.verified = (sha1(buffer) === self.hash)
  if (self.verified) {
    self.emit('done')
  } else {
    self.emit('warning', new Error('piece ' + self.index + ' failed verification; ' + sha1(buffer) + ' expected ' + self.hash))
    self._reset()
  }
}

Piece.prototype._verifyOffset = function (offset) {
  var self = this
  if (offset % BLOCK_LENGTH === 0) {
    return true
  } else {
    self.emit('warning', new Error('piece ' + self.index + ' invalid offset ' + offset + ' not multiple of ' + BLOCK_LENGTH + ' bytes'))
    return false
  }
}

Piece.prototype._verifyBlock = function (offset, buffer) {
  var self = this
  if (buffer.length === BLOCK_LENGTH) {
    // normal block length
    return true

  } else if (buffer.length === self.length - offset
      && self.length - offset < BLOCK_LENGTH) {
    // last block in piece is allowed to be less than block length
    return true
  } else {
    self.emit('warning', new Error('piece ' + self.index + ' invalid block of size ' + buffer.length + ' bytes'))
    return false
  }
}

Piece.prototype._lazyAllocBuffer = function () {
  var self = this
  if (!self.buffer) {
    self.buffer = new Buffer(self.length)
  }
}

inherits(File, EventEmitter)

/**
 * A torrent file
 *
 * @param {Storage} storage       Storage container object
 * @param {Object}  file          the file object from the parsed torrent
 * @param {Array.<Piece>} pieces  backing pieces for this file
 * @param {number}  pieceLength   the length in bytes of a non-terminal piece
 */
function File (storage, file, pieces, pieceLength) {
  var self = this
  EventEmitter.call(self)

  self.storage = storage
  self.name = file.name
  self.path = file.path
  self.length = file.length
  self.offset = file.offset
  self.pieces = pieces
  self.pieceLength = pieceLength

  self.done = false

  self.pieces.forEach(function (piece) {
    piece.on('done', function () {
      self._checkDone()
    })
  })

  // if the file is zero-length, it will be done upon initialization
  self._checkDone()
}

/**
 * Selects the file to be downloaded, but at a lower priority than files with streams.
 * Useful if you know you need the file at a later stage.
 */
File.prototype.select = function () {
  var self = this
  if (self.pieces.length > 0) {
    self.storage.emit('select', self.pieces[0].index, self.pieces[self.pieces.length - 1].index, false)
  }
}

/**
 * Deselects the file, which means it won't be downloaded unless someone creates a stream
 * for it.
 */
File.prototype.deselect = function () {
  var self = this
  if (self.pieces.length > 0) {
    self.storage.emit('deselect', self.pieces[0].index, self.pieces[self.pieces.length - 1].index, false)
  }
}

/**
 * Create a readable stream to the file. Pieces needed by the stream will be prioritized
 * highly and fetched from the swarm first.
 *
 * @param {Object} opts
 * @param {number} opts.start stream slice of file, starting from this byte (inclusive)
 * @param {number} opts.end   stream slice of file, ending with this byte (inclusive)
 * @return {stream.Readable}
 */
File.prototype.createReadStream = function (opts) {
  var self = this
  debug('createReadStream')
  opts = extend({
    pieceLength: self.pieceLength
  }, opts)

  var stream = new FileStream(self, opts)
  self.storage.emit('select', stream.startPiece, stream.endPiece, true, stream.notify.bind(stream))
  eos(stream, function () {
    self.storage.emit('deselect', stream.startPiece, stream.endPiece, true)
  })

  return stream
}

File.prototype._checkDone = function () {
  var self = this
  self.done = self.pieces.every(function (piece) {
    return piece.verified
  })

  if (self.done) {
    process.nextTick(function () {
      self.emit('done')
    })
  }
}

inherits(Storage, EventEmitter)

/**
 * Storage for a torrent download. Handles the complexities of reading and writing
 * to pieces and files.
 *
 * @param {Object} parsedTorrent
 * @param {Object} opts
 */
function Storage (parsedTorrent, opts) {
  var self = this
  EventEmitter.call(self)
  opts = opts || {}

  self.bitfield = new BitField(parsedTorrent.pieces.length)

  self.done = false
  self.closed = false
  self.readonly = true

  if (!opts.nobuffer) {
    self.buffer = new Buffer(parsedTorrent.length)
  }

  var pieceLength = parsedTorrent.pieceLength
  var lastPieceLength = parsedTorrent.lastPieceLength
  var numPieces = parsedTorrent.pieces.length

  self.pieces = parsedTorrent.pieces.map(function (hash, index) {
    var start = index * pieceLength
    var end = start + (index === numPieces - 1 ? lastPieceLength : pieceLength)

    // if we're backed by a buffer, the piece's buffer will reference the same memory.
    // otherwise, the piece's buffer will be lazily created on demand
    var buffer = (self.buffer ? self.buffer.slice(start, end) : end - start)

    var piece = new Piece(index, hash, buffer)
    piece.on('done', self._onPieceDone.bind(self, piece))
    return piece
  })

  self.files = parsedTorrent.files.map(function (fileObj) {
    var start = fileObj.offset
    var end = start + fileObj.length - 1

    var startPiece = start / pieceLength | 0
    var endPiece = end / pieceLength | 0
    var pieces = self.pieces.slice(startPiece, endPiece + 1)

    var file = new File(self, fileObj, pieces, pieceLength)
    file.on('done', self._onFileDone.bind(self, file))
    return file
  })
}

Storage.BLOCK_LENGTH = BLOCK_LENGTH

Storage.writeToStorage = function (storage, buf, pieceLength, cb) {
  var pieceIndex = 0
  var bufStream = new stream.Readable()
  bufStream._read = function () {}
  bufStream
    .pipe(new BlockStream(pieceLength, { nopad: true }))
    .on('data', function (piece) {
      var index = pieceIndex
      pieceIndex += 1

      var blockIndex = 0
      var s = new BlockStream(BLOCK_LENGTH, { nopad: true })
      s.on('data', function (block) {
        var offset = blockIndex * BLOCK_LENGTH
        blockIndex += 1

        storage.writeBlock(index, offset, block)
      })
      s.write(piece)
      s.end()
    })
    .on('end', function () {
      cb(null)
    })
    .on('error', function (err) {
      cb(err)
    })

  bufStream.push(buf)
  bufStream.push(null)
}

Object.defineProperty(Storage.prototype, 'downloaded', {
  get: function () {
    var self = this
    return self.pieces.reduce(function (total, piece) {
      return total + (piece.verified ? piece.length : piece.blocksWritten * BLOCK_LENGTH)
    }, 0)
  }
})

/**
 * The number of missing pieces. Used to implement 'end game' mode.
 */
Object.defineProperty(Storage.prototype, 'numMissing', {
  get: function () {
    var self = this
    var numMissing = self.pieces.length
    for (var index = 0, len = self.pieces.length; index < len; index++) {
      numMissing -= self.bitfield.get(index)
    }
    return numMissing
  }
})

/**
 * Reads a block from a piece.
 *
 * @param {number}    index    piece index
 * @param {number}    offset   byte offset within piece
 * @param {number}    length   length in bytes to read from piece
 * @param {function}  cb
 */
Storage.prototype.readBlock = function (index, offset, length, cb) {
  var self = this
  cb = dezalgo(cb)
  var piece = self.pieces[index]
  if (!piece) return cb(new Error('invalid piece index ' + index))
  piece.readBlock(offset, length, cb)
}

/**
 * Writes a block to a piece.
 *
 * @param {number}  index    piece index
 * @param {number}  offset   byte offset within piece
 * @param {Buffer}  buffer   buffer to write
 * @param {function}  cb
 */
Storage.prototype.writeBlock = function (index, offset, buffer, cb) {
  var self = this
  if (!cb) cb = noop
  cb = dezalgo(cb)

  if (self.readonly) return cb(new Error('cannot write to readonly storage'))
  var piece = self.pieces[index]
  if (!piece) return cb(new Error('invalid piece index ' + index))
  piece.writeBlock(offset, buffer, cb)
}

/**
 * Reads a piece or a range of a piece.
 *
 * @param {number}   index         piece index
 * @param {Object=}  range         optional range within piece
 * @param {number}   range.offset  byte offset within piece
 * @param {number}   range.length  length in bytes to read from piece
 * @param {function} cb
 * @param {boolean}  force         optionally overrides default check preventing reading
 *                                 from unverified piece
 */
Storage.prototype.read = function (index, range, cb, force) {
  var self = this

  if (typeof range === 'function') {
    force = cb
    cb = range
    range = null
  }
  cb = dezalgo(cb)

  var piece = self.pieces[index]
  if (!piece) {
    return cb(new Error('invalid piece index ' + index))
  }

  if (!piece.verified && !force) {
    return cb(new Error('Storage.read called on incomplete piece ' + index))
  }

  var offset = 0
  var length = piece.length

  if (range) {
    offset = range.offset || 0
    length = range.length || length
  }

  if (piece.buffer) {
    // shortcut for piece with static backing buffer
    return cb(null, piece.buffer.slice(offset, offset + length))
  }

  var blocks = []
  function readNextBlock () {
    if (length <= 0) return cb(null, Buffer.concat(blocks))

    var blockOffset = offset
    var blockLength = Math.min(BLOCK_LENGTH, length)

    offset += blockLength
    length -= blockLength

    self.readBlock(index, blockOffset, blockLength, function (err, block) {
      if (err) return cb(err)

      blocks.push(block)
      readNextBlock()
    })
  }

  readNextBlock()
}

/**
 * Reserves a block from the given piece.
 *
 * @param {number}  index    piece index
 * @param {Boolean} endGame  whether or not end game mode is enabled
 *
 * @returns {Object|null} reservation with offset and length or null if failed.
 */
Storage.prototype.reserveBlock = function (index, endGame) {
  var self = this
  var piece = self.pieces[index]
  if (!piece) return null

  return piece.reserveBlock(endGame)
}

/**
 * Cancels a previous block reservation from the given piece.
 *
 * @param {number}  index   piece index
 * @param {number}  offset  byte offset of block in piece
 *
 * @returns {Boolean}
 */
Storage.prototype.cancelBlock = function (index, offset) {
  var self = this
  var piece = self.pieces[index]
  if (!piece) return false

  return piece.cancelBlock(offset)
}

/**
 * Removes and cleans up any backing store for this storage.
 * @param {function=} cb
 */
Storage.prototype.remove = function (cb) {
  if (cb) dezalgo(cb)(null)
}

/**
 * Closes the backing store for this storage.
 * @param {function=} cb
 */
Storage.prototype.close = function (cb) {
  var self = this
  self.closed = true
  if (cb) dezalgo(cb)(null)
}

//
// HELPER METHODS
//

Storage.prototype._onPieceDone = function (piece) {
  var self = this
  self.bitfield.set(piece.index)
  debug('piece done ' + piece.index + ' (' + self.numMissing + ' still missing)')
  self.emit('piece', piece)
}

Storage.prototype._onFileDone = function (file) {
  var self = this
  debug('file done ' + file.name)
  self.emit('file', file)

  self._checkDone()
}

Storage.prototype._checkDone = function () {
  var self = this

  if (!self.done && self.files.every(function (file) { return file.done })) {
    self.done = true
    self.emit('done')
  }
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"./file-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/file-stream.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","bitfield":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/bitfield/index.js","block-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/block-stream/block-stream.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","dezalgo":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/dezalgo.js","end-of-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/end-of-stream/index.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","git-sha1":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/git-sha1/git-sha1.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/torrent.js":[function(require,module,exports){
(function (process){
module.exports = Torrent

var addrToIPPort = require('addr-to-ip-port')
var concat = require('concat-stream') // browser exclude
var debug = require('debug')('webtorrent:torrent')
var Discovery = require('torrent-discovery')
var EventEmitter = require('events').EventEmitter
var fs = require('fs') // browser exclude
var hh = require('http-https') // browser exclude
var inherits = require('inherits')
var parallel = require('run-parallel')
var parseTorrent = require('parse-torrent')
var RarityMap = require('./rarity-map')
var reemit = require('re-emitter')
var Storage = require('./storage')
var Swarm = require('bittorrent-swarm') // `webtorrent-swarm` in browser
var ut_metadata = require('ut_metadata')
var ut_pex = require('ut_pex') // browser exclude

var MAX_BLOCK_LENGTH = 128 * 1024
var MAX_OUTSTANDING_REQUESTS = 5
var PIECE_TIMEOUT = 10000
var CHOKE_TIMEOUT = 5000
var SPEED_THRESHOLD = 3 * Storage.BLOCK_LENGTH

var RECHOKE_INTERVAL = 10000 // 10 seconds
var RECHOKE_OPTIMISTIC_DURATION = 2 // 30 seconds

function noop () {}

inherits(Torrent, EventEmitter)

/**
 * A torrent
 *
 * @param {string|Buffer|Object} torrentId
 * @param {Object} opts
 */
function Torrent (torrentId, opts) {
  var self = this
  EventEmitter.call(self)
  debug('new torrent')

  self.client = opts.client

  self.hotswapEnabled = ('hotswap' in opts ? opts.hotswap : true)
  self.verify = opts.verify
  self.storageOpts = opts.storageOpts

  self.chokeTimeout = opts.chokeTimeout || CHOKE_TIMEOUT
  self.pieceTimeout = opts.pieceTimeout || PIECE_TIMEOUT
  self.strategy = opts.strategy || 'sequential'

  self._rechokeNumSlots = (opts.uploads === false || opts.uploads === 0) ? 0 : (+opts.uploads || 10)
  self._rechokeOptimisticWire = null
  self._rechokeOptimisticTime = 0
  self._rechokeIntervalId = null

  self.ready = false
  self.files = []
  self.metadata = null
  self.parsedTorrent = null
  self.storage = null
  self.numBlockedPeers = 0
  self._amInterested = false
  self._destroyed = false
  self._selections = []
  self._critical = []
  self._storageImpl = opts.storage || Storage

  var parsedTorrent = parseTorrent(torrentId)
  if (parsedTorrent && parsedTorrent.infoHash) {
    onTorrentId(parsedTorrent)

  } else if (typeof hh.get === 'function' && /^https?:/.test(torrentId)) {
    // http or https url to torrent file
    hh.get(torrentId, function (res) {
      res.pipe(concat(function (torrent) {
        onTorrentId(torrent)
      }))
    }).on('error', function (err) {
      self.emit('error', new Error('error downloading torrent: ' + err.message))
    })

  } else if (typeof fs.readFile === 'function') {
    // assume it's a filesystem path
    fs.readFile(torrentId, function (err, torrent) {
      if (err) return self.emit('error', new Error('invalid torrent id'))
      onTorrentId(torrent)
    })

  } else throw new Error('invalid torrent id')

  function onTorrentId (torrentId) {
    parsedTorrent = parseTorrent(torrentId)
    self.infoHash = parsedTorrent.infoHash
    if (parsedTorrent.name) self.name = parsedTorrent.name // preliminary name

    // create swarm
    self.swarm = new Swarm(self.infoHash, self.client.peerId, {
      handshake: { dht: !!self.client.dht }
    })
    reemit(self.swarm, self, ['warning', 'error'])
    self.swarm.on('wire', self._onWire.bind(self))

    // update overall client stats
    self.swarm.on('download', self.client.downloadSpeed.bind(self.client))
    self.swarm.on('upload', self.client.uploadSpeed.bind(self.client))

    if (process.browser) {
      // in browser, swarm does not listen
      self._onSwarmListening(parsedTorrent)
    } else {
      // listen for peers
      self.swarm.listen(self.client.torrentPort, self._onSwarmListening.bind(self, parsedTorrent))
    }
    process.nextTick(function () {
      self.emit('infoHash')
    })
  }
}

// torrent size (in bytes)
Object.defineProperty(Torrent.prototype, 'length', {
  get: function () {
    return (this.parsedTorrent && this.parsedTorrent.length) || 0
  }
})

// time remaining (in milliseconds)
Object.defineProperty(Torrent.prototype, 'timeRemaining', {
  get: function () {
    if (this.swarm.downloadSpeed() === 0) return Infinity
    else return ((this.length - this.downloaded) / this.swarm.downloadSpeed()) * 1000
  }
})

// percentage complete, represented as a number between 0 and 1
Object.defineProperty(Torrent.prototype, 'progress', {
  get: function () {
    return (this.parsedTorrent && (this.downloaded / this.parsedTorrent.length)) || 0
  }
})

// bytes downloaded (not necessarily verified)
Object.defineProperty(Torrent.prototype, 'downloaded', {
  get: function () {
    return (this.storage && this.storage.downloaded) || 0
  }
})

// bytes uploaded
Object.defineProperty(Torrent.prototype, 'uploaded', {
  get: function () {
    return this.swarm.uploaded
  }
})

// ratio of bytes downloaded to uploaded
Object.defineProperty(Torrent.prototype, 'ratio', {
  get: function () {
    return (this.uploaded && (this.downloaded / this.uploaded)) || 0
  }
})

Torrent.prototype._onSwarmListening = function (parsed, port) {
  var self = this
  if (self._destroyed) return

  self.client.torrentPort = port

  // begin discovering peers via the DHT and tracker servers
  self.discovery = new Discovery({
    announce: parsed.announce,
    dht: self.client.dht,
    tracker: self.client.tracker,
    peerId: self.client.peerId,
    port: port
  })
  self.discovery.setTorrent(self.infoHash)
  self.discovery.on('peer', self.addPeer.bind(self))

  // expose discovery events
  reemit(self.discovery, self, ['dhtAnnounce', 'warning', 'error'])

  // if full metadata was included in initial torrent id, use it
  if (parsed.info) self._onMetadata(parsed)

  self.emit('listening', port)
}

/**
 * Called when the metadata is received.
 */
Torrent.prototype._onMetadata = function (metadata) {
  var self = this
  if (self.metadata || self._destroyed) return
  debug('got metadata')

  if (metadata && metadata.infoHash) {
    // `metadata` is a parsed torrent (from parse-torrent module)
    self.metadata = parseTorrent.toBuffer(metadata)
    self.parsedTorrent = metadata
  } else {
    self.metadata = metadata
    try {
      self.parsedTorrent = parseTorrent(self.metadata)
    } catch (err) {
      return self.emit('error', err)
    }
  }

  // update preliminary torrent name
  self.name = self.parsedTorrent.name

  // update discovery module with full torrent metadata
  self.discovery.setTorrent(self.parsedTorrent)

  self.rarityMap = new RarityMap(self.swarm, self.parsedTorrent.pieces.length)

  self.storage = new self._storageImpl(self.parsedTorrent, self.storageOpts)
  self.storage.on('piece', self._onStoragePiece.bind(self))
  self.storage.on('file', function (file) {
    self.emit('file', file)
  })

  self._reservations = self.storage.pieces.map(function () {
    return []
  })

  self.storage.on('done', function () {
    if (self.discovery.tracker)
      self.discovery.tracker.complete()

    debug('torrent ' + self.infoHash + ' done')
    self.emit('done')
  })

  self.storage.on('select', self.select.bind(self))
  self.storage.on('deselect', self.deselect.bind(self))
  self.storage.on('critical', self.critical.bind(self))

  self.storage.files.forEach(function (file) {
    self.files.push(file)
  })

  self.swarm.wires.forEach(function (wire) {
    // If we didn't have the metadata at the time ut_metadata was initialized for this
    // wire, we still want to make it available to the peer in case they request it.
    if (wire.ut_metadata) wire.ut_metadata.setMetadata(self.metadata)

    self._onWireWithMetadata(wire)
  })

  if (self.verify) {
    process.nextTick(function () {
      debug('verifying existing torrent data')
      var numPieces = 0
      var numVerified = 0

      // TODO: move storage verification to storage.js?
      parallel(self.storage.pieces.map(function (piece) {
        return function (cb) {
          self.storage.read(piece.index, function (err, buffer) {
            numPieces += 1
            self.emit('verifying', {
              percentDone: 100 * numPieces / self.storage.pieces.length,
              percentVerified: 100 * numVerified / self.storage.pieces.length,
            })

            if (!err && buffer) {
              // TODO: this is a bit hacky; figure out a cleaner way of verifying the buffer
              piece.verify(buffer)
              numVerified += piece.verified
              debug('piece ' + (piece.verified ? 'verified' : 'invalid') + ' ' + piece.index)
            }
            // continue regardless of whether piece verification failed
            cb()
          }, true) // forces override to allow reading from non-verified pieces
        }
      }), self._onStorage.bind(self))
    })
  } else {
    process.nextTick(self._onStorage.bind(self))
  }

  process.nextTick(function () {
    self.emit('metadata')
  })
}

/**
 * Destroy and cleanup this torrent.
 */
Torrent.prototype.destroy = function (cb) {
  var self = this
  debug('destroy')
  self._destroyed = true
  clearInterval(self._rechokeIntervalId)

  var tasks = []
  if (self.swarm) tasks.push(function (cb) {
    self.swarm.destroy(cb)
  })
  if (self.discovery) tasks.push(function (cb) {
    self.discovery.stop(cb)
  })
  if (self.storage) tasks.push(function (cb) {
    self.storage.close(cb)
  })
  parallel(tasks, cb)
}

/**
 * Add a peer to the swarm
 * @param {string|SimplePeer} peer
 */
Torrent.prototype.addPeer = function (peer) {
  var self = this

  // TODO: extract IP address from peer object and check blocklist
  if (typeof peer === 'string' &&
      self.client.blocked && self.client.blocked.contains(addrToIPPort(peer)[0])) {
    self.numBlockedPeers += 1
    self.emit('blocked-peer', peer)
  } else {
    self.emit('peer', peer)
    self.swarm.addPeer(peer)
  }
}

/**
 * Select a range of pieces to prioritize.
 *
 * @param {number}    start     start piece index (inclusive)
 * @param {number}    end       end piece index (inclusive)
 * @param {number}    priority  priority associated with this selection
 * @param {function}  notify    callback when selection is updated with new data
 */
Torrent.prototype.select = function (start, end, priority, notify) {
  var self = this
  if (start > end || start < 0 || end >= self.storage.pieces.length)
    throw new Error('invalid selection ', start, ':', end)
  priority = Number(priority) || 0

  debug('select %s-%s (priority %s)', start, end, priority)

  self._selections.push({
    from: start,
    to: end,
    offset: 0,
    priority: priority,
    notify: notify || noop
  })

  self._selections.sort(function (a, b) {
    return b.priority - a.priority
  })

  self._updateSelections()
}

/**
 * Deprioritizes a range of previously selected pieces.
 *
 * @param {number}  start     start piece index (inclusive)
 * @param {number}  end       end piece index (inclusive)
 * @param {number}  priority  priority associated with the selection
 */
Torrent.prototype.deselect = function (start, end, priority) {
  var self = this
  priority = Number(priority) || 0
  debug('deselect %s-%s (priority %s)', start, end, priority)

  for (var i = 0; i < self._selections.length; ++i) {
    var s = self._selections[i]
    if (s.from === start && s.to === end && s.priority === priority) {
      self._selections.splice(i--, 1)
      break
    }
  }

  self._updateSelections()
}

/**
 * Marks a range of pieces as critical priority to be downloaded ASAP.
 *
 * @param {number}  start  start piece index (inclusive)
 * @param {number}  end    end piece index (inclusive)
 */
Torrent.prototype.critical = function (start, end) {
  var self = this
  debug('critical %s-%s', start, end)

  for (var i = start; i <= end; ++i) {
    self._critical[i] = true
  }

  self._updateSelections()
}

Torrent.prototype._onWire = function (wire) {
  var self = this

  // use ut_metadata extension
  wire.use(ut_metadata(self.metadata))

  if (!self.metadata) {
    wire.ut_metadata.on('metadata', function (metadata) {
      debug('got metadata via ut_metadata')
      self._onMetadata(metadata)
    })
    wire.ut_metadata.fetch()
  }

  // use ut_pex extension
  if (typeof ut_pex === 'function') wire.use(ut_pex())

  //wire.ut_pex.start() // TODO two-way communication
  if (wire.ut_pex) wire.ut_pex.on('peer', function (peer) {
    debug('got peer via ut_pex ' + peer)
    self.addPeer(peer)
  })

  if (wire.ut_pex) wire.ut_pex.on('dropped', function (peer) {
    // the remote peer believes a given peer has been dropped from the swarm.
    // if we're not currently connected to it, then remove it from the swarm's queue.
    if (!(peer in self.swarm._peers)) self.swarm.removePeer(peer)
  })

  // Send KEEP-ALIVE (every 60s) so peers will not disconnect the wire
  wire.setKeepAlive(true)

  // If peer supports DHT, send PORT message to report DHT node listening port
  if (wire.peerExtensions.dht && self.client.dht && self.client.dht.port) {
    wire.port(self.client.dht.port)
  }

  // When peer sends PORT, add them to the routing table
  wire.on('port', function (port) {
    debug('port message from ' + wire.remoteAddress)
    // TODO: dht should support adding a node when you don't know the nodeId
    // dht.addNode(wire.remoteAddress + ':' + port)
  })

  wire.on('timeout', function () {
    debug('wire timeout from ' + wire.remoteAddress)
    // TODO: this might be destroying wires too eagerly
    wire.destroy()
  })

  // Timeout for piece requests to this peer
  wire.setTimeout(self.pieceTimeout)

  if (self.metadata) {
    self._onWireWithMetadata(wire)
  }
}

Torrent.prototype._onWireWithMetadata = function (wire) {
  var self = this
  var timeoutId = null
  var timeoutMs = self.chokeTimeout

  function onChokeTimeout () {
    if (self._destroyed || wire._destroyed) return

    if (self.swarm.numQueued > 2 * (self.swarm.numConns - self.swarm.numPeers) && wire.amInterested) {
      wire.destroy()
    } else {
      timeoutId = setTimeout(onChokeTimeout, timeoutMs)
    }
  }

  var i = 0
  function updateSeedStatus () {
    if (wire.peerPieces.length !== self.storage.pieces.length) return
    for (; i < self.storage.pieces.length; ++i) {
      if (!wire.peerPieces.get(i)) return
    }
    wire.isSeeder = true
    wire.choke() // always choke seeders
  }

  wire.on('bitfield', function () {
    updateSeedStatus()
    self._update()
  })

  wire.on('have', function () {
    updateSeedStatus()
    self._update()
  })

  wire.once('interested', function () {
    wire.unchoke()
  })

  wire.on('close', function () {
    clearTimeout(timeoutId)
  })

  wire.on('choke', function () {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(onChokeTimeout, timeoutMs)
  })

  wire.on('unchoke', function () {
    clearTimeout(timeoutId)
    self._update()
  })

  wire.on('request', function (index, offset, length, cb) {
    // Disconnect from peers that request more than 128KB, per spec
    if (length > MAX_BLOCK_LENGTH) {
      debug(wire.remoteAddress, 'requested invalid block size', length)
      return wire.destroy()
    }

    self.storage.readBlock(index, offset, length, cb)
  })

  wire.bitfield(self.storage.bitfield) // always send bitfield (required)
  wire.interested() // always start out interested

  timeoutId = setTimeout(onChokeTimeout, timeoutMs)

  wire.isSeeder = false
  updateSeedStatus()
}

/**
 * Called when the metadata, swarm, and underlying storage are all fully initialized.
 */
Torrent.prototype._onStorage = function () {
  var self = this
  debug('on storage')

  // allow writes to storage only after initial piece verification is finished
  self.storage.readonly = false

  // start off selecting the entire torrent with low priority
  self.select(0, self.storage.pieces.length - 1, false)

  self._rechokeIntervalId = setInterval(self._rechoke.bind(self), RECHOKE_INTERVAL)
  self._rechokeIntervalId.unref && self._rechokeIntervalId.unref()

  process.nextTick(function () {
    self.ready = true
    self.emit('ready')
  })
}

/**
 * When a piece is fully downloaded, notify all peers with a HAVE message.
 * @param {Piece} piece
 */
Torrent.prototype._onStoragePiece = function (piece) {
  var self = this
  debug('piece done %s', piece.index)
  self._reservations[piece.index] = null

  self.swarm.wires.forEach(function (wire) {
    wire.have(piece.index)
  })

  self._gcSelections()
}

/**
 * Called on selection changes.
 */
Torrent.prototype._updateSelections = function () {
  var self = this
  if (!self.swarm || self._destroyed) return
  if (!self.metadata) return self.once('metadata', self._updateSelections.bind(self))

  process.nextTick(self._gcSelections.bind(self))
  self._updateInterest()
  self._update()
}

/**
 * Garbage collect selections with respect to the storage's current state.
 */
Torrent.prototype._gcSelections = function () {
  var self = this

  for (var i = 0; i < self._selections.length; i++) {
    var s = self._selections[i]
    var oldOffset = s.offset

    // check for newly downloaded pieces in selection
    while (self.storage.bitfield.get(s.from + s.offset) && s.from + s.offset < s.to) {
      s.offset++
    }

    if (oldOffset !== s.offset) s.notify()
    if (s.to !== s.from + s.offset) continue
    if (!self.storage.bitfield.get(s.from + s.offset)) continue

    // remove fully downloaded selection
    self._selections.splice(i--, 1) // decrement i to offset splice
    s.notify() // TODO: this may notify twice in a row. is this a problem?
    self._updateInterest()
  }

  if (!self._selections.length) self.emit('idle')
}

/**
 * Update interested status for all peers.
 */
Torrent.prototype._updateInterest = function () {
  var self = this

  var prev = self._amInterested
  self._amInterested = !!self._selections.length

  self.swarm.wires.forEach(function (wire) {
    // TODO: only call wire.interested if the wire has at least one piece we need
    if (self._amInterested) wire.interested()
    else wire.uninterested()
  })

  if (prev === self._amInterested) return
  if (self._amInterested) self.emit('interested')
  else self.emit('uninterested')
}

/**
 * Heartbeat to update all peers and their requests.
 */
Torrent.prototype._update = function () {
  var self = this
  if (self._destroyed) return

  // update wires in random order for better request distribution
  randomizedForEach(self.swarm.wires, self._updateWire.bind(self))
}

/**
 * Attempts to update a peer's requests
 */
Torrent.prototype._updateWire = function (wire) {
  var self = this

  if (wire.peerChoking) return
  if (!wire.downloaded) return validateWire()

  trySelectWire(false) || trySelectWire(true)

  function genPieceFilterFunc (start, end, tried, rank) {
    return function (i) {
      return i >= start && i <= end && !(i in tried) && wire.peerPieces.get(i) && (!rank || rank(i))
    }
  }

  // TODO: Do we need both validateWire and trySelectWire?
  function validateWire () {
    if (wire.requests.length) return

    for (var i = self._selections.length; i--;) {
      var next = self._selections[i]

      var piece
      if (self.strategy === 'rarest') {
        var start = next.from + next.offset
        var end = next.to
        var len = end - start + 1
        var tried = {}
        var tries = 0
        var filter = genPieceFilterFunc(start, end, tried)

        while (tries < len) {
          piece = self.rarityMap.getRarestPiece(filter)
          if (piece < 0) break
          if (self._request(wire, piece, false)) return
          tried[piece] = true
          tries += 1
        }
      } else {
        for (piece = next.to; piece >= next.from + next.offset; --piece) {
          if (!wire.peerPieces.get(piece)) continue
          if (self._request(wire, piece, false)) return
        }
      }
    }

    // TODO: wire failed to validate as useful; should we close it?
  }

  function speedRanker () {
    var speed = wire.downloadSpeed() || 1
    if (speed > SPEED_THRESHOLD) return function () { return true }

    var secs = MAX_OUTSTANDING_REQUESTS * Storage.BLOCK_LENGTH / speed
    var tries = 10
    var ptr = 0

    return function (index) {
      if (!tries || self.storage.bitfield.get(index)) return true

      var piece = self.storage.pieces[index]
      var missing = piece.blocks.length - piece.blocksWritten

      for (; ptr < self.swarm.wires.length; ptr++) {
        var otherWire = self.swarm.wires[ptr]
        var otherSpeed = otherWire.downloadSpeed()

        if (otherSpeed < SPEED_THRESHOLD) continue
        if (otherSpeed <= speed) continue
        if (!otherWire.peerPieces.get(index)) continue
        if ((missing -= otherSpeed * secs) > 0) continue

        tries--
        return false
      }

      return true
    }
  }

  function shufflePriority (i) {
    var last = i
    for (var j = i; j < self._selections.length && self._selections[j].priority; j++) {
      last = j
    }
    var tmp = self._selections[i]
    self._selections[i] = self._selections[last]
    self._selections[last] = tmp
  }

  function trySelectWire (hotswap) {
    if (wire.requests.length >= MAX_OUTSTANDING_REQUESTS) return true
    var rank = speedRanker()

    for (var i = 0; i < self._selections.length; i++) {
      var next = self._selections[i]

      var piece
      if (self.strategy === 'rarest') {
        var start = next.from + next.offset
        var end = next.to
        var len = end - start + 1
        var tried = {}
        var tries = 0
        var filter = genPieceFilterFunc(start, end, tried, rank)

        while (tries < len) {
          piece = self.rarityMap.getRarestPiece(filter)
          if (piece < 0) break

          // request all non-reserved blocks in this piece
          while (self._request(wire, piece, self._critical[piece] || hotswap)) {}

          if (wire.requests.length < MAX_OUTSTANDING_REQUESTS) {
            tried[piece] = true
            tries++
            continue
          }

          if (next.priority) shufflePriority(i)
          return true
        }
      } else {
        for (piece = next.from + next.offset; piece <= next.to; piece++) {
          if (!wire.peerPieces.get(piece) || !rank(piece)) continue

          // request all non-reserved blocks in piece
          while (self._request(wire, piece, self._critical[piece] || hotswap)) {}

          if (wire.requests.length < MAX_OUTSTANDING_REQUESTS) continue

          if (next.priority) shufflePriority(i)
          return true
        }
      }
    }

    return false
  }
}

/**
 * Called periodically to update the choked status of all peers, handling optimistic
 * unchoking as described in BEP3.
 */
Torrent.prototype._rechoke = function () {
  var self = this

  if (self._rechokeOptimisticTime > 0)
    self._rechokeOptimisticTime -= 1
  else
    self._rechokeOptimisticWire = null

  var peers = []

  self.swarm.wires.forEach(function (wire) {
    if (!wire.isSeeder && wire !== self._rechokeOptimisticWire) {
      peers.push({
        wire: wire,
        downloadSpeed: wire.downloadSpeed(),
        uploadSpeed: wire.uploadSpeed(),
        salt: Math.random(),
        isChoked: true
      })
    }
  })

  peers.sort(rechokeSort)

  var unchokeInterested = 0
  var i = 0
  for (; i < peers.length && unchokeInterested < self._rechokeNumSlots; ++i) {
    peers[i].isChoked = false
    if (peers[i].wire.peerInterested) unchokeInterested += 1
  }

  // Optimistically unchoke a peer
  if (!self._rechokeOptimisticWire && i < peers.length && self._rechokeNumSlots) {
    var candidates = peers.slice(i).filter(function (peer) { return peer.wire.peerInterested })
    var optimistic = candidates[randomInt(candidates.length)]

    if (optimistic) {
      optimistic.isChoked = false
      self._rechokeOptimisticWire = optimistic.wire
      self._rechokeOptimisticTime = RECHOKE_OPTIMISTIC_DURATION
    }
  }

  // Unchoke best peers
  peers.forEach(function (peer) {
    if (peer.wire.amChoking !== peer.isChoked) {
      if (peer.isChoked) peer.wire.choke()
      else peer.wire.unchoke()
    }
  })

  function rechokeSort (peerA, peerB) {
    // Prefer higher download speed
    if (peerA.downloadSpeed !== peerB.downloadSpeed)
      return peerB.downloadSpeed - peerA.downloadSpeed

    // Prefer higher upload speed
    if (peerA.uploadSpeed !== peerB.uploadSpeed)
      return peerB.uploadSpeed - peerA.uploadSpeed

    // Prefer unchoked
    if (peerA.wire.amChoking !== peerB.wire.amChoking)
      return peerA.wire.amChoking ? 1 : -1

    // Random order
    return peerA.salt - peerB.salt
  }
}

/**
 * Attempts to cancel a slow block request from another wire such that the
 * given wire may effectively swap out the request for one of its own.
 */
Torrent.prototype._hotswap = function (wire, index) {
  var self = this
  if (!self.hotswapEnabled) return false

  var speed = wire.downloadSpeed()
  if (speed < Storage.BLOCK_LENGTH) return false
  if (!self._reservations[index]) return false

  var r = self._reservations[index]
  if (!r) {
    return false
  }

  var minSpeed = Infinity
  var minWire

  var i
  for (i = 0; i < r.length; i++) {
    var otherWire = r[i]
    if (!otherWire || otherWire === wire) continue

    var otherSpeed = otherWire.downloadSpeed()
    if (otherSpeed >= SPEED_THRESHOLD) continue
    if (2 * otherSpeed > speed || otherSpeed > minSpeed) continue

    minWire = otherWire
    minSpeed = otherSpeed
  }

  if (!minWire) return false

  for (i = 0; i < r.length; i++) {
    if (r[i] === minWire) r[i] = null
  }

  for (i = 0; i < minWire.requests.length; i++) {
    var req = minWire.requests[i]
    if (req.piece !== index) continue

    self.storage.cancelBlock(index, req.offset)
  }

  self.emit('hotswap', minWire, wire, index)
  return true
}

/**
 * Attempts to request a block from the given wire.
 */
Torrent.prototype._request = function (wire, index, hotswap) {
  var self = this
  var numRequests = wire.requests.length

  if (self.storage.bitfield.get(index)) return false
  if (numRequests >= MAX_OUTSTANDING_REQUESTS) return false

  var endGame = (wire.requests.length === 0 && self.storage.numMissing < 30)
  var block = self.storage.reserveBlock(index, endGame)

  if (!block && !endGame && hotswap && self._hotswap(wire, index))
    block = self.storage.reserveBlock(index, false)
  if (!block) return false

  var r = self._reservations[index]
  if (!r) {
    r = self._reservations[index] = []
  }
  var i = r.indexOf(null)
  if (i === -1) i = r.length
  r[i] = wire

  function gotPiece (err, buffer) {
    if (!self.ready) {
      self.once('ready', function () {
        gotPiece(err, buffer)
      })
      return
    }

    if (r[i] === wire) r[i] = null

    if (err) {
      debug('error getting piece ' + index + '(offset: ' + block.offset + ' length: ' + block.length + ') from ' + wire.remoteAddress + ' ' + err.message)
      self.storage.cancelBlock(index, block.offset)
      process.nextTick(self._update.bind(self))
      return false
    } else {
      // debug('got piece ' + index + '(offset: ' + block.offset + ' length: ' + block.length + ') from ' + wire.remoteAddress)
      self.storage.writeBlock(index, block.offset, buffer, function (err) {
        if (err) {
          debug('error writing block')
          self.storage.cancelBlock(index, block.offset)
        }

        process.nextTick(self._update.bind(self))
      })
    }
  }

  wire.request(index, block.offset, block.length, gotPiece)

  return true
}

/**
 * Returns a random integer in [0,high)
 */
function randomInt (high) {
  return Math.random() * high | 0
}

/**
 * Iterates through the given array in a random order, calling the given
 * callback for each element.
 */
function randomizedForEach (array, cb) {
  var indices = array.map(function (value, index) { return index })

  for (var i = 0, len = indices.length; i < len; ++i) {
    var j = randomInt(len)
    var tmp = indices[i]
    indices[i] = indices[j]
    indices[j] = tmp
  }

  indices.forEach(function (index) {
    cb(array[index], index, array)
  })
}

}).call(this,require('_process'))
},{"./rarity-map":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/rarity-map.js","./storage":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/lib/storage.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","addr-to-ip-port":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/addr-to-ip-port/index.js","bittorrent-swarm":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/index.js","concat-stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","fs":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","http-https":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","parse-torrent":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/index.js","re-emitter":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/re-emitter/index.js","run-parallel":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/run-parallel/index.js","torrent-discovery":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/index.js","ut_metadata":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/index.js","ut_pex":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/addr-to-ip-port/index.js":[function(require,module,exports){
var cache = {}

module.exports = function addrToIPPort (addr) {
  if (!cache[addr]) {
    var s = addr.split(':')
    cache[addr] = [ s[0], Number(s[1]) ]
  }
  return cache[addr]
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/bitfield/index.js":[function(require,module,exports){
(function (Buffer){
var Container = typeof Buffer !== "undefined" ? Buffer //in node, use buffers
		: typeof Int8Array !== "undefined" ? Int8Array //in newer browsers, use webgl int8arrays
		: function(l){ var a = new Array(l); for(var i = 0; i < l; i++) a[i]=0; }; //else, do something similar

function BitField(data, opts){
	if(!(this instanceof BitField)) {
		return new BitField(data);
	}

	if(arguments.length === 0){
		data = 0;
	}

	this.grow = opts && (isFinite(opts.grow) && getByteSize(opts.grow) || opts.grow) || 0;

	if(typeof data === "number" || data === undefined){
		data = new Container(getByteSize(data));
		if(data.fill) data.fill(0); // clear node buffers of garbage
	}
	this.buffer = data;
}

function getByteSize(num){
	var out = num >> 3;
	if(num % 8 !== 0) out++;
	return out;
}

BitField.prototype.get = function(i){
	var j = i >> 3;
	return (j < this.buffer.length) &&
		!!(this.buffer[j] & (128 >> (i % 8)));
};

BitField.prototype.set = function(i, b){
	var j = i >> 3;
	if (b || arguments.length === 1){
		this._grow(j + 1);
		// Set
		this.buffer[j] |= 128 >> (i % 8);
	} else if (j < this.buffer.length) {
		/// Clear
		this.buffer[j] &= ~(128 >> (i % 8));
	}
};

BitField.prototype._grow = function(length) {
	if (this.buffer.length < length && length <= this.grow) {
		var newBuffer = new Container(length);
		if (newBuffer.fill) newBuffer.fill(0);
		for(var i = 0; i < this.buffer.length; i++) {
			newBuffer[i] = this.buffer[i];
		}
		this.buffer = newBuffer;
	}
};

if(typeof module !== "undefined") module.exports = BitField;

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/block-stream/block-stream.js":[function(require,module,exports){
(function (process,Buffer){
// write data to it, and it'll emit data in 512 byte blocks.
// if you .end() or .flush(), it'll emit whatever it's got,
// padded with nulls to 512 bytes.

module.exports = BlockStream

var Stream = require("stream").Stream
  , inherits = require("inherits")
  , assert = require("assert").ok
  , debug = process.env.DEBUG ? console.error : function () {}

function BlockStream (size, opt) {
  this.writable = this.readable = true
  this._opt = opt || {}
  this._chunkSize = size || 512
  this._offset = 0
  this._buffer = []
  this._bufferLength = 0
  if (this._opt.nopad) this._zeroes = false
  else {
    this._zeroes = new Buffer(this._chunkSize)
    for (var i = 0; i < this._chunkSize; i ++) {
      this._zeroes[i] = 0
    }
  }
}

inherits(BlockStream, Stream)

BlockStream.prototype.write = function (c) {
  // debug("   BS write", c)
  if (this._ended) throw new Error("BlockStream: write after end")
  if (c && !Buffer.isBuffer(c)) c = new Buffer(c + "")
  if (c.length) {
    this._buffer.push(c)
    this._bufferLength += c.length
  }
  // debug("pushed onto buffer", this._bufferLength)
  if (this._bufferLength >= this._chunkSize) {
    if (this._paused) {
      // debug("   BS paused, return false, need drain")
      this._needDrain = true
      return false
    }
    this._emitChunk()
  }
  return true
}

BlockStream.prototype.pause = function () {
  // debug("   BS pausing")
  this._paused = true
}

BlockStream.prototype.resume = function () {
  // debug("   BS resume")
  this._paused = false
  return this._emitChunk()
}

BlockStream.prototype.end = function (chunk) {
  // debug("end", chunk)
  if (typeof chunk === "function") cb = chunk, chunk = null
  if (chunk) this.write(chunk)
  this._ended = true
  this.flush()
}

BlockStream.prototype.flush = function () {
  this._emitChunk(true)
}

BlockStream.prototype._emitChunk = function (flush) {
  // debug("emitChunk flush=%j emitting=%j paused=%j", flush, this._emitting, this._paused)

  // emit a <chunkSize> chunk
  if (flush && this._zeroes) {
    // debug("    BS push zeroes", this._bufferLength)
    // push a chunk of zeroes
    var padBytes = (this._bufferLength % this._chunkSize)
    if (padBytes !== 0) padBytes = this._chunkSize - padBytes
    if (padBytes > 0) {
      // debug("padBytes", padBytes, this._zeroes.slice(0, padBytes))
      this._buffer.push(this._zeroes.slice(0, padBytes))
      this._bufferLength += padBytes
      // debug(this._buffer[this._buffer.length - 1].length, this._bufferLength)
    }
  }

  if (this._emitting || this._paused) return
  this._emitting = true

  // debug("    BS entering loops")
  var bufferIndex = 0
  while (this._bufferLength >= this._chunkSize &&
         (flush || !this._paused)) {
    // debug("     BS data emission loop", this._bufferLength)

    var out
      , outOffset = 0
      , outHas = this._chunkSize

    while (outHas > 0 && (flush || !this._paused) ) {
      // debug("    BS data inner emit loop", this._bufferLength)
      var cur = this._buffer[bufferIndex]
        , curHas = cur.length - this._offset
      // debug("cur=", cur)
      // debug("curHas=%j", curHas)
      // If it's not big enough to fill the whole thing, then we'll need
      // to copy multiple buffers into one.  However, if it is big enough,
      // then just slice out the part we want, to save unnecessary copying.
      // Also, need to copy if we've already done some copying, since buffers
      // can't be joined like cons strings.
      if (out || curHas < outHas) {
        out = out || new Buffer(this._chunkSize)
        cur.copy(out, outOffset,
                 this._offset, this._offset + Math.min(curHas, outHas))
      } else if (cur.length === outHas && this._offset === 0) {
        // shortcut -- cur is exactly long enough, and no offset.
        out = cur
      } else {
        // slice out the piece of cur that we need.
        out = cur.slice(this._offset, this._offset + outHas)
      }

      if (curHas > outHas) {
        // means that the current buffer couldn't be completely output
        // update this._offset to reflect how much WAS written
        this._offset += outHas
        outHas = 0
      } else {
        // output the entire current chunk.
        // toss it away
        outHas -= curHas
        outOffset += curHas
        bufferIndex ++
        this._offset = 0
      }
    }

    this._bufferLength -= this._chunkSize
    assert(out.length === this._chunkSize)
    // debug("emitting data", out)
    // debug("   BS emitting, paused=%j", this._paused, this._bufferLength)
    this.emit("data", out)
    out = null
  }
  // debug("    BS out of loops", this._bufferLength)

  // whatever is left, it's not enough to fill up a block, or we're paused
  this._buffer = this._buffer.slice(bufferIndex)
  if (this._paused) {
    // debug("    BS paused, leaving", this._bufferLength)
    this._needsDrain = true
    this._emitting = false
    return
  }

  // if flushing, and not using null-padding, then need to emit the last
  // chunk(s) sitting in the queue.  We know that it's not enough to
  // fill up a whole block, because otherwise it would have been emitted
  // above, but there may be some offset.
  var l = this._buffer.length
  if (flush && !this._zeroes && l) {
    if (l === 1) {
      if (this._offset) {
        this.emit("data", this._buffer[0].slice(this._offset))
      } else {
        this.emit("data", this._buffer[0])
      }
    } else {
      var outHas = this._bufferLength
        , out = new Buffer(outHas)
        , outOffset = 0
      for (var i = 0; i < l; i ++) {
        var cur = this._buffer[i]
          , curHas = cur.length - this._offset
        cur.copy(out, outOffset, this._offset)
        this._offset = 0
        outOffset += curHas
        this._bufferLength -= curHas
      }
      this.emit("data", out)
    }
    // truncate
    this._buffer.length = 0
    this._bufferLength = 0
    this._offset = 0
  }

  // now either drained or ended
  // debug("either draining, or ended", this._bufferLength, this._ended)
  // means that we've flushed out all that we can so far.
  if (this._needDrain) {
    // debug("emitting drain", this._bufferLength)
    this._needDrain = false
    this.emit("drain")
  }

  if ((this._bufferLength === 0) && this._ended && !this._endEmitted) {
    // debug("emitting end", this._bufferLength)
    this._endEmitted = true
    this.emit("end")
  }

  this._emitting = false

  // debug("    BS no longer emitting", flush, this._paused, this._emitting, this._bufferLength, this._chunkSize)
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/index.js":[function(require,module,exports){
(function (Buffer){
module.exports = createTorrent

var bencode = require('bencode')
var BlockStream = require('block-stream')
var calcPieceLength = require('piece-length')
var corePath = require('path')
var FileReadStream = require('filestream/read')
var flatten = require('flatten')
var fs = require('fs')
var MultiStream = require('multistream')
var once = require('once')
var parallel = require('run-parallel')
var sha1 = require('git-sha1')
var stream = require('stream')

/**
 * Create a torrent.
 * @param  {string|File|FileList|Array.<File>|Blob|Array.<Blob>} input
 * @param  {Object} opts
 * @param  {string=} opts.name
 * @param  {Date=} opts.creationDate
 * @param  {string=} opts.comment
 * @param  {string=} opts.createdBy
 * @param  {boolean|number=} opts.private
 * @param  {number=} opts.pieceLength
 * @param  {Array.<Array.<string>>=} opts.announceList
 * @param  {Array.<string>=} opts.urlList
 * @param  {function} cb
 * @return {Buffer} buffer of .torrent file data
 */
function createTorrent (input, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  var files

  if (isBlob(input)) {
    input = [ input ]
  }

  // TODO: support an array of paths
  if (Array.isArray(input) && input.length > 0) {
    opts.name = opts.name || input[0].name
    files = input.map(function (item) {
      if (!item) return
      var file = {
        length: item.size,
        path: [ item.name ]
      }
      if (isBlob(item)) file.stream = new FileReadStream(item)
      else if (Buffer.isBuffer(item.buffer)) {
        // support "files" from drag-drop that have a `buffer` prop
        file.stream = new stream.PassThrough()
        file.stream.end(item.buffer)
      }
      else throw new Error('Array must contain only File objects')
      return file
    })
    onFiles(files, opts, cb)
  } else if (typeof input === 'string') {
    opts.name = opts.name || corePath.basename(input)

    traversePath(getFileInfo, input, function (err, files) {
      if (err) return cb(err)

      if (Array.isArray(files)) {
        files = flatten(files)
      } else {
        files = [ files ]
      }

      var dirName = corePath.normalize(input) + corePath.sep
      files.forEach(function (file) {
        file.stream = fs.createReadStream(file.path)
        file.path = file.path.replace(dirName, '').split(corePath.sep)
      })

      onFiles(files, opts, cb)
    })
  } else {
    throw new Error('invalid input type')
  }
}

createTorrent.announceList = [
  [ 'udp://tracker.publicbt.com:80' ],
  [ 'udp://tracker.openbittorrent.com:80' ],
  [ 'udp://tracker.webtorrent.io:80' ],
  [ 'wss://tracker.webtorrent.io' ] // For WebRTC peers (see: WebTorrent.io)
]

function each (arr, fn, cb) {
  var tasks = arr.map(function (item) {
    return function (cb) {
      fn(item, cb)
    }
  })
  parallel(tasks, cb)
}

function getFileInfo (path, cb) {
  cb = once(cb)
  fs.stat(path, function (err, stat) {
    if (err) return cb(err)
    var info = {
      length: stat.size,
      path: path
    }
    cb(null, info)
  })
}

function traversePath (fn, path, cb) {
  fs.readdir(path, function (err, entries) {
    if (err && err.code === 'ENOTDIR') {
      // this is a file
      fn(path, cb)
    } else if (err) {
      // there was an error
      cb(err)
    } else {
      // this is a folder
      each(entries, function (entry, cb) {
        traversePath(fn, corePath.join(path, entry), cb)
      }, cb)
    }
  })
}

function getPieceList (files, pieceLength, cb) {
  cb = once(cb)
  var pieces = '' // hex string

  var streams = files.map(function (file) {
    return file.stream
  })

  new MultiStream(streams)
    .pipe(new BlockStream(pieceLength, { nopad: true }))
    .on('data', function (chunk) {
      pieces += sha1(chunk)
    })
    .on('end', function () {
      cb(null, new Buffer(pieces, 'hex'))
    })
    .on('error', function (err) {
      console.error(err)
      cb(err)
    })
}

function onFiles (files, opts, cb) {
  var announceList = opts.announceList !== undefined
    ? opts.announceList
    : createTorrent.announceList // default

  var torrent = {
    info: {
      name: opts.name
    },
    announce: announceList[0][0],
    'announce-list': announceList,
    'creation date': Number(opts.creationDate) || Date.now(),
    encoding: 'UTF-8'
  }

  if (opts.comment !== undefined) {
    torrent.info.comment = opts.comment
  }

  if (opts.createdBy !== undefined) {
    torrent.info['created by'] = opts.createdBy
  }

  if (opts.private !== undefined) {
    torrent.info.private = Number(opts.private)
  }

  if (opts.urlList !== undefined) {
    torrent['url-list'] = opts.urlList
  }

  var singleFile = files.length === 1

  var length = files.reduce(sumLength, 0)
  var pieceLength = opts.pieceLength || calcPieceLength(length)
  torrent.info['piece length'] = pieceLength

  if (singleFile) {
    torrent.info.length = length
  }

  getPieceList(files, pieceLength, function (err, pieces) {
    if (err) return cb(err)
    torrent.info.pieces = pieces

    files.forEach(function (file) {
      delete file.stream
    })

    if (!singleFile) {
      torrent.info.files = files
    }

    cb(null, bencode.encode(torrent))
  })
}

/**
 * Accumulator to sum file lengths
 * @param  {number} sum
 * @param  {Object} file
 * @return {number}
 */
function sumLength (sum, file) {
  return sum + file.length
}

/**
 * Check if `obj` is a W3C Blob object (which is the superclass of W3C File)
 * @param  {*} obj
 * @return {boolean}
 */
function isBlob (obj) {
  return typeof Blob !== 'undefined' && obj instanceof Blob
}

}).call(this,require("buffer").Buffer)
},{"bencode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/bencode.js","block-stream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/block-stream/block-stream.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","filestream/read":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/read.js","flatten":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/flatten/index.js","fs":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","git-sha1":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/git-sha1/git-sha1.js","multistream":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/multistream/index.js","once":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js","path":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/path-browserify/index.js","piece-length":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/piece-length/index.js","run-parallel":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/run-parallel/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/bencode.js":[function(require,module,exports){
module.exports = {
  encode: require( './lib/encode' ),
  decode: require( './lib/decode' )
}

},{"./lib/decode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/lib/decode.js","./lib/encode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/lib/encode.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/lib/decode.js":[function(require,module,exports){
(function (Buffer){
/**
 * Decodes bencoded data.
 *
 * @param  {Buffer} data
 * @param  {String} encoding
 * @return {Object|Array|Buffer|String|Number}
 */
function decode( data, encoding ) {

  decode.position = 0
  decode.encoding = encoding || null

  decode.data = !( Buffer.isBuffer(data) )
    ? new Buffer( data )
    : data

  return decode.next()

}

decode.position = 0
decode.data     = null
decode.encoding = null

decode.next = function() {

  switch( decode.data[decode.position] ) {
    case 0x64: return decode.dictionary(); break
    case 0x6C: return decode.list(); break
    case 0x69: return decode.integer(); break
    default:   return decode.bytes(); break
  }

}

decode.find = function( chr ) {

  var i = decode.position
  var c = decode.data.length
  var d = decode.data

  while( i < c ) {
    if( d[i] === chr )
      return i
    i++
  }

  throw new Error(
    'Invalid data: Missing delimiter "' +
    String.fromCharCode( chr ) + '" [0x' +
    chr.toString( 16 ) + ']'
  )

}

decode.dictionary = function() {

  decode.position++

  var dict = {}

  while( decode.data[decode.position] !== 0x65 ) {
    dict[ decode.bytes() ] = decode.next()
  }

  decode.position++

  return dict

}

decode.list = function() {

  decode.position++

  var lst = []

  while( decode.data[decode.position] !== 0x65 ) {
    lst.push( decode.next() )
  }

  decode.position++

  return lst

}

decode.integer = function() {

  var end    = decode.find( 0x65 )
  var number = decode.data.toString( 'ascii', decode.position + 1, end )

  decode.position += end + 1 - decode.position

  return parseInt( number, 10 )

}

decode.bytes = function() {

  var sep    = decode.find( 0x3A )
  var length = parseInt( decode.data.toString( 'ascii', decode.position, sep ), 10 )
  var end    = ++sep + length

  decode.position = end

  return decode.encoding
    ? decode.data.toString( decode.encoding, sep, end )
    : decode.data.slice( sep, end )

}

// Exports
module.exports = decode

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/lib/encode.js":[function(require,module,exports){
(function (Buffer){
/**
 * Encodes data in bencode.
 *
 * @param  {Buffer|Array|String|Object|Number} data
 * @return {Buffer}
 */
function encode( data ) {
  var buffers = []
  encode._encode( buffers, data )
  return Buffer.concat( buffers )
}

encode._floatConversionDetected = false

encode._encode = function( buffers, data ) {

  if( Buffer.isBuffer(data) ) {
    buffers.push(new Buffer(data.length + ':'))
    buffers.push(data)
    return;
  }

  switch( typeof data ) {
    case 'string':
      encode.bytes( buffers, data )
      break
    case 'number':
      encode.number( buffers, data )
      break
    case 'object':
      data.constructor === Array
        ? encode.list( buffers, data )
        : encode.dict( buffers, data )
      break
  }

}

var buff_e = new Buffer('e')
  , buff_d = new Buffer('d')
  , buff_l = new Buffer('l')

encode.bytes = function( buffers, data ) {

  buffers.push( new Buffer(Buffer.byteLength( data ) + ':' + data) )
}

encode.number = function( buffers, data ) {
  var maxLo = 0x80000000
  var hi = ( data / maxLo ) << 0
  var lo = ( data % maxLo  ) << 0
  var val = hi * maxLo + lo

  buffers.push( new Buffer( 'i' + val + 'e' ))

  if( val !== data && !encode._floatConversionDetected ) {
    encode._floatConversionDetected = true
    console.warn(
      'WARNING: Possible data corruption detected with value "'+data+'":',
      'Bencoding only defines support for integers, value was converted to "'+val+'"'
    )
    console.trace()
  }

}

encode.dict = function( buffers, data ) {

  buffers.push( buff_d )

  var j = 0
  var k
  // fix for issue #13 - sorted dicts
  var keys = Object.keys( data ).sort()
  var kl = keys.length

  for( ; j < kl ; j++) {
    k=keys[j]
    encode.bytes( buffers, k )
    encode._encode( buffers, data[k] )
  }

  buffers.push( buff_e )
}

encode.list = function( buffers, data ) {

  var i = 0, j = 1
  var c = data.length
  buffers.push( buff_l )

  for( ; i < c; i++ ) {
    encode._encode( buffers, data[i] )
  }

  buffers.push( buff_e )

}

// Expose
module.exports = encode

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/node_modules/typedarray-to-buffer/index.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/typedarray-to-buffer/index.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/typedarray-to-buffer/index.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/typedarray-to-buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/read.js":[function(require,module,exports){
(function (Buffer){
/* jshint node: true */
'use strict';

var Readable = require('stream').Readable;
var util = require('util');
var reExtension = /^.*\.(\w+)$/;
var extend = require('extend.js');
var toBuffer = require('typedarray-to-buffer');

function FileReadStream(file, opts) {
  if (! (this instanceof FileReadStream)) {
    return new FileReadStream(file, opts);
  }
  opts = opts || {}

  // inherit readable
  Readable.call(this, extend({
    objectMode: true
  }, opts));

  // save the read offset
  this._offset = 0;
  this._eof = false;

  // if `opts.meta` is true, then emit the metadata in the stream
  this._metasent = !opts.meta;
  // initialise the metadata
  this._metadata = {
    name: file.name,
    size: file.size,
    extension: file.name.replace(reExtension, '$1')
  };

  // create the reader
  this.reader = new FileReader();
  this.reader.onprogress = this._handleProgress.bind(this);
  this.reader.onload = this._handleLoad.bind(this);
  this.reader.readAsArrayBuffer(file);
}

util.inherits(FileReadStream, Readable);
module.exports = FileReadStream;

FileReadStream.prototype._read = function(bytes) {
  var stream = this;
  var reader = this.reader;

  function checkBytes() {
    var startOffset = stream._offset;
    var endOffset = stream._offset + bytes;
    var availableBytes = reader.result && reader.result.byteLength;
    var done = reader.readyState === 2 && endOffset > availableBytes;
    var chunk;

    // console.log('checking bytes available, need: ' + endOffset + ', got: ' + availableBytes);
    if (availableBytes && (done || availableBytes > endOffset)) {
      // get the data chunk
      chunk = toBuffer(new Uint8Array(
        reader.result,
        startOffset,
        Math.min(bytes, reader.result.byteLength - startOffset)
      ));

      // update the stream offset
      stream._offset = startOffset + chunk.length;

      // send the chunk
      // console.log('sending chunk, ended: ', chunk.length === 0);
      stream._eof = chunk.length === 0;
      return stream.push(chunk.length > 0 ? new Buffer(chunk) : null);
    }

    stream.once('readable', checkBytes);
  }

  if (! this._metasent) {
    this._metasent = true;
    return this.push('meta|' + JSON.stringify(this._metadata));
  }

  checkBytes();
};

FileReadStream.prototype._handleLoad = function(evt) {
  this.emit('readable');
};

FileReadStream.prototype._handleProgress = function(evt) {
  this.emit('readable');
};

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","typedarray-to-buffer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/node_modules/typedarray-to-buffer/index.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/flatten/index.js":[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/multistream/index.js":[function(require,module,exports){
module.exports = MultiStream

var inherits = require('inherits')
var stream = require('stream')

inherits(MultiStream, stream.Readable)

function MultiStream (streams, opts) {
  if (!(this instanceof MultiStream)) return new MultiStream(streams, opts)
  stream.Readable.call(this, opts)

  this.destroyed = false

  this._drained = false
  this._forwarding = false
  this._current = null
  this._queue = streams.map(toStreams2)

  this._next()
}

MultiStream.obj = function (streams) {
  return new MultiStream(streams, { objectMode: true, highWaterMark: 16 })
}

MultiStream.prototype._read = function () {
  this._drained = true
  this._forward()
}

MultiStream.prototype._forward = function () {
  if (this._forwarding || !this._drained) return
  this._forwarding = true

  var chunk
  while ((chunk = this._current.read()) !== null) {
    this._drained = this.push(chunk)
  }

  this._forwarding = false
}

MultiStream.prototype.destroy = function (err) {
  if (this.destroyed) return
  this.destroyed = true
  
  if (this._current && this._current.destroy) this._current.destroy()
  this._queue.forEach(function (stream) {
    if (stream.destroy) stream.destroy()
  })

  if (err) this.emit('error', err)
  this.emit('close')
}

MultiStream.prototype._next = function () {
  var self = this
  var stream = this._queue.shift()

  if (typeof stream === 'function') stream = toStreams2(stream())

  if (!stream) {
    this.push(null)
    return
  }

  this._current = stream

  stream.on('readable', onReadable)
  stream.on('end', onEnd)
  stream.on('error', onError)
  stream.on('close', onClose)

  function onReadable () {
    self._forward()
  }

  function onClose () {
    if (!stream._readableState.ended) {
      self.destroy()
    }
  }

  function onEnd () {
    self._current = null
    stream.removeListener('readable', onReadable)
    stream.removeListener('end', onEnd)
    stream.removeListener('error', onError)
    stream.removeListener('close', onClose)
    self._next()
  }

  function onError (err) {
    self.destroy(err)
  }
}

function toStreams2 (s) {
  if (!s || typeof s === 'function' || s._readableState) return s

  var wrap = new stream.Readable().wrap(s)
  if (s.destroy) {
    wrap.destroy = s.destroy.bind(s)
  }
  return wrap
}

},{"inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/piece-length/index.js":[function(require,module,exports){
var closest = require('closest-to')

// Create a range from 16kb–4mb
var sizes = []
for (var i = 14; i <= 22; i++) {
  sizes.push(Math.pow(2, i))
}

module.exports = function(size) {
  return closest(
    size / Math.pow(2, 10), sizes 
  )
}

},{"closest-to":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/piece-length/node_modules/closest-to/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/piece-length/node_modules/closest-to/index.js":[function(require,module,exports){
module.exports = function(target, numbers) {
  var closest = Infinity
  var difference = 0
  var winner = null

  numbers.sort(function(a, b) {
    return a - b
  })

  for (var i = 0, l = numbers.length; i < l; i++) {  
    difference = Math.abs(target - numbers[i])
    if (difference >= closest) {
      break
    }
    closest = difference
    winner = numbers[i]
  }

  return winner
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js":[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // This hackery is required for IE8,
  // where the `console.log` function doesn't have 'apply'
  return 'object' == typeof console
    && 'function' == typeof console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      localStorage.removeItem('debug');
    } else {
      localStorage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = localStorage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/debug.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/debug.js":[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/node_modules/ms/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/node_modules/ms/index.js":[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/dezalgo.js":[function(require,module,exports){
var wrappy = require('wrappy')
module.exports = wrappy(dezalgo)

var asap = require('asap')

function dezalgo (cb) {
  var sync = true
  asap(function () {
    sync = false
  })

  return function zalgoSafe() {
    var args = arguments
    var me = this
    if (sync)
      asap(function() {
        cb.apply(me, args)
      })
    else
      cb.apply(me, args)
  }
}

},{"asap":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/asap/asap.js","wrappy":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/wrappy/wrappy.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/asap/asap.js":[function(require,module,exports){
(function (process){

// Use the fastest possible means to execute a task in a future turn
// of the event loop.

// linked list of tasks (single, with head node)
var head = {task: void 0, next: null};
var tail = head;
var flushing = false;
var requestFlush = void 0;
var isNodeJS = false;

function flush() {
    /* jshint loopfunc: true */

    while (head.next) {
        head = head.next;
        var task = head.task;
        head.task = void 0;
        var domain = head.domain;

        if (domain) {
            head.domain = void 0;
            domain.enter();
        }

        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function() {
                   throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    flushing = false;
}

if (typeof process !== "undefined" && process.nextTick) {
    // Node.js before 0.9. Note that some fake-Node environments, like the
    // Mocha test runner, introduce a `process` global without a `nextTick`.
    isNodeJS = true;

    requestFlush = function () {
        process.nextTick(flush);
    };

} else if (typeof setImmediate === "function") {
    // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
    if (typeof window !== "undefined") {
        requestFlush = setImmediate.bind(window, flush);
    } else {
        requestFlush = function () {
            setImmediate(flush);
        };
    }

} else if (typeof MessageChannel !== "undefined") {
    // modern browsers
    // http://www.nonblocking.io/2011/06/windownexttick.html
    var channel = new MessageChannel();
    channel.port1.onmessage = flush;
    requestFlush = function () {
        channel.port2.postMessage(0);
    };

} else {
    // old browsers
    requestFlush = function () {
        setTimeout(flush, 0);
    };
}

function asap(task) {
    tail = tail.next = {
        task: task,
        domain: isNodeJS && process.domain,
        next: null
    };

    if (!flushing) {
        flushing = true;
        requestFlush();
    }
};

module.exports = asap;


}).call(this,require('_process'))
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/wrappy/wrappy.js":[function(require,module,exports){
// Returns a wrapper function that returns a wrapped callback
// The wrapper function should do some stuff, and return a
// presumably different callback function.
// This makes sure that own properties are retained, so that
// decorations and such are not lost along the way.
module.exports = wrappy
function wrappy (fn, cb) {
  if (fn && cb) return wrappy(fn)(cb)

  if (typeof fn !== 'function')
    throw new TypeError('need wrapper function')

  Object.keys(fn).forEach(function (k) {
    wrapper[k] = fn[k]
  })

  return wrapper

  function wrapper() {
    var args = new Array(arguments.length)
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i]
    }
    var ret = fn.apply(this, args)
    var cb = args[args.length-1]
    if (typeof ret === 'function' && ret !== cb) {
      Object.keys(cb).forEach(function (k) {
        ret[k] = cb[k]
      })
    }
    return ret
  }
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/end-of-stream/index.js":[function(require,module,exports){
var once = require('once');

var noop = function() {};

var isRequest = function(stream) {
	return stream.setHeader && typeof stream.abort === 'function';
};

var isChildProcess = function(stream) {
	return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3
};

var eos = function(stream, opts, callback) {
	if (typeof opts === 'function') return eos(stream, null, opts);
	if (!opts) opts = {};

	callback = once(callback || noop);

	var ws = stream._writableState;
	var rs = stream._readableState;
	var readable = opts.readable || (opts.readable !== false && stream.readable);
	var writable = opts.writable || (opts.writable !== false && stream.writable);

	var onlegacyfinish = function() {
		if (!stream.writable) onfinish();
	};

	var onfinish = function() {
		writable = false;
		if (!readable) callback();
	};

	var onend = function() {
		readable = false;
		if (!writable) callback();
	};

	var onexit = function(exitCode) {
		callback(exitCode ? new Error('exited with error code: ' + exitCode) : null);
	};

	var onclose = function() {
		if (readable && !(rs && rs.ended)) return callback(new Error('premature close'));
		if (writable && !(ws && ws.ended)) return callback(new Error('premature close'));
	};

	var onrequest = function() {
		stream.req.on('finish', onfinish);
	};

	if (isRequest(stream)) {
		stream.on('complete', onfinish);
		stream.on('abort', onclose);
		if (stream.req) onrequest();
		else stream.on('request', onrequest);
	} else if (writable && !ws) { // legacy streams
		stream.on('end', onlegacyfinish);
		stream.on('close', onlegacyfinish);
	}

	if (isChildProcess(stream)) stream.on('exit', onexit);

	stream.on('end', onend);
	stream.on('finish', onfinish);
	if (opts.error !== false) stream.on('error', callback);
	stream.on('close', onclose);

	return function() {
		stream.removeListener('complete', onfinish);
		stream.removeListener('abort', onclose);
		stream.removeListener('request', onrequest);
		if (stream.req) stream.req.removeListener('finish', onfinish);
		stream.removeListener('end', onlegacyfinish);
		stream.removeListener('close', onlegacyfinish);
		stream.removeListener('finish', onfinish);
		stream.removeListener('exit', onexit);
		stream.removeListener('end', onend);
		stream.removeListener('error', callback);
		stream.removeListener('close', onclose);
	};
};

module.exports = eos;
},{"once":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js":[function(require,module,exports){
/**
 * Extend an object with another.
 *
 * @param {Object, ...} src, ...
 * @return {Object} merged
 * @api private
 */

module.exports = function(src) {
  var objs = [].slice.call(arguments, 1), obj;

  for (var i = 0, len = objs.length; i < len; i++) {
    obj = objs[i];
    for (var prop in obj) {
      src[prop] = obj[prop];
    }
  }

  return src;
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/git-sha1/git-sha1.js":[function(require,module,exports){
(function (process){
"use strict";

var isNode = typeof process === 'object' &&
             typeof process.versions === 'object' &&
             process.versions.node &&
             process.__atom_type !== "renderer";

var shared, create, crypto;
if (isNode) {
  var nodeRequire = require; // Prevent mine.js from seeing this require
  crypto = nodeRequire('crypto');
  create = createNode;
}
else {
  shared = new Uint32Array(80);
  create = createJs;
}


// Input chunks must be either arrays of bytes or "raw" encoded strings
module.exports = function sha1(buffer) {
  if (buffer === undefined) return create(false);
  var shasum = create(true);
  shasum.update(buffer);
  return shasum.digest();
};

// Use node's openssl bindings when available
function createNode() {
  var shasum = crypto.createHash('sha1');
  return {
    update: function (buffer) {
      return shasum.update(buffer);
    },
    digest: function () {
      return shasum.digest('hex');
    }
  };
}

// A pure JS implementation of sha1 for non-node environments.
function createJs(sync) {
  var h0 = 0x67452301;
  var h1 = 0xEFCDAB89;
  var h2 = 0x98BADCFE;
  var h3 = 0x10325476;
  var h4 = 0xC3D2E1F0;
  // The first 64 bytes (16 words) is the data chunk
  var block, offset = 0, shift = 24;
  var totalLength = 0;
  if (sync) block = shared;
  else block = new Uint32Array(80);

  return { update: update, digest: digest };

  // The user gave us more data.  Store it!
  function update(chunk) {
    if (typeof chunk === "string") return updateString(chunk);
    var length = chunk.length;
    totalLength += length * 8;
    for (var i = 0; i < length; i++) {
      write(chunk[i]);
    }
  }

  function updateString(string) {
    var length = string.length;
    totalLength += length * 8;
    for (var i = 0; i < length; i++) {
      write(string.charCodeAt(i));
    }
  }


  function write(byte) {
    block[offset] |= (byte & 0xff) << shift;
    if (shift) {
      shift -= 8;
    }
    else {
      offset++;
      shift = 24;
    }
    if (offset === 16) processBlock();
  }

  // No more data will come, pad the block, process and return the result.
  function digest() {
    // Pad
    write(0x80);
    if (offset > 14 || (offset === 14 && shift < 24)) {
      processBlock();
    }
    offset = 14;
    shift = 24;

    // 64-bit length big-endian
    write(0x00); // numbers this big aren't accurate in javascript anyway
    write(0x00); // ..So just hard-code to zero.
    write(totalLength > 0xffffffffff ? totalLength / 0x10000000000 : 0x00);
    write(totalLength > 0xffffffff ? totalLength / 0x100000000 : 0x00);
    for (var s = 24; s >= 0; s -= 8) {
      write(totalLength >> s);
    }

    // At this point one last processBlock() should trigger and we can pull out the result.
    return toHex(h0) +
           toHex(h1) +
           toHex(h2) +
           toHex(h3) +
           toHex(h4);
  }

  // We have a full block to process.  Let's do it!
  function processBlock() {
    // Extend the sixteen 32-bit words into eighty 32-bit words:
    for (var i = 16; i < 80; i++) {
      var w = block[i - 3] ^ block[i - 8] ^ block[i - 14] ^ block[i - 16];
      block[i] = (w << 1) | (w >>> 31);
    }

    // log(block);

    // Initialize hash value for this chunk:
    var a = h0;
    var b = h1;
    var c = h2;
    var d = h3;
    var e = h4;
    var f, k;

    // Main loop:
    for (i = 0; i < 80; i++) {
      if (i < 20) {
        f = d ^ (b & (c ^ d));
        k = 0x5A827999;
      }
      else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ED9EBA1;
      }
      else if (i < 60) {
        f = (b & c) | (d & (b | c));
        k = 0x8F1BBCDC;
      }
      else {
        f = b ^ c ^ d;
        k = 0xCA62C1D6;
      }
      var temp = (a << 5 | a >>> 27) + f + e + k + (block[i]|0);
      e = d;
      d = c;
      c = (b << 30 | b >>> 2);
      b = a;
      a = temp;
    }

    // Add this chunk's hash to result so far:
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;

    // The block is now reusable.
    offset = 0;
    for (i = 0; i < 16; i++) {
      block[i] = 0;
    }
  }

  function toHex(word) {
    var hex = "";
    for (var i = 28; i >= 0; i -= 4) {
      hex += ((word >> i) & 0xf).toString(16);
    }
    return hex;
  }

}

}).call(this,require('_process'))
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/hat/index.js":[function(require,module,exports){
var hat = module.exports = function (bits, base) {
    if (!base) base = 16;
    if (bits === undefined) bits = 128;
    if (bits <= 0) return '0';
    
    var digits = Math.log(Math.pow(2, bits)) / Math.log(base);
    for (var i = 2; digits === Infinity; i *= 2) {
        digits = Math.log(Math.pow(2, bits / i)) / Math.log(base) * i;
    }
    
    var rem = digits - Math.floor(digits);
    
    var res = '';
    
    for (var i = 0; i < Math.floor(digits); i++) {
        var x = Math.floor(Math.random() * base).toString(base);
        res = x + res;
    }
    
    if (rem) {
        var b = Math.pow(base, rem);
        var x = Math.floor(Math.random() * b).toString(base);
        res = x + res;
    }
    
    var parsed = parseInt(res, base);
    if (parsed !== Infinity && parsed >= Math.pow(2, bits)) {
        return hat(bits, base)
    }
    else return res;
};

hat.rack = function (bits, base, expandBy) {
    var fn = function (data) {
        var iters = 0;
        do {
            if (iters ++ > 10) {
                if (expandBy) bits += expandBy;
                else throw new Error('too many ID collisions, use more bits')
            }
            
            var id = hat(bits, base);
        } while (Object.hasOwnProperty.call(hats, id));
        
        hats[id] = data;
        return id;
    };
    var hats = fn.hats = {};
    
    fn.get = function (id) {
        return fn.hats[id];
    };
    
    fn.set = function (id, value) {
        fn.hats[id] = value;
        return fn;
    };
    
    fn.bits = bits || 128;
    fn.base = base || 16;
    return fn;
};

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/node_modules/wrappy/wrappy.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/wrappy/wrappy.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/wrappy/wrappy.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/dezalgo/node_modules/wrappy/wrappy.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js":[function(require,module,exports){
var wrappy = require('wrappy')
module.exports = wrappy(once)

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var f = function () {
    if (f.called) return f.value
    f.called = true
    return f.value = fn.apply(this, arguments)
  }
  f.called = false
  return f
}

},{"wrappy":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/node_modules/wrappy/wrappy.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/index.js":[function(require,module,exports){
(function (Buffer){
var magnet = require('magnet-uri')
var parseTorrentFile = require('parse-torrent-file')

/**
 * Parse a torrent identifier (magnet uri, .torrent file, info hash)
 * @param  {string|Buffer|Object} torrentId
 * @return {Object}
 */
module.exports = function parseTorrent (torrentId) {
  if (typeof torrentId === 'string' && /magnet:/.test(torrentId)) {
    // magnet uri (string)
    return magnet(torrentId)
  } else if (typeof torrentId === 'string' &&
      (torrentId.length === 40 || torrentId.length === 32)) {
    // info hash (hex/base-32 string)
    var info = magnet('magnet:?xt=urn:btih:' + torrentId)
    if (info)
      return { infoHash: info.infoHash }
    else
      return null
  } else if (Buffer.isBuffer(torrentId) && torrentId.length === 20) {
    // info hash (buffer)
    return { infoHash: torrentId.toString('hex') }
  } else if (Buffer.isBuffer(torrentId)) {
    // .torrent file (buffer)
    try {
      return parseTorrentFile(torrentId)
    } catch (err) {
      return null
    }
  } else if (torrentId && torrentId.infoHash) {
    // parsed torrent (from `parse-torrent` or `magnet-uri` module)
    return torrentId
  } else {
    return null
  }
}

module.exports.toBuffer = parseTorrentFile.toBuffer

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","magnet-uri":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/index.js","parse-torrent-file":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/index.js":[function(require,module,exports){
(function (Buffer){
var base32 = require('thirty-two')

/**
 * Parse a magnet URI and return an object of keys/values
 *
 * @param  {string} uri
 * @return {Object} parsed uri
 */
module.exports = function (uri) {
  var result = {}
  var data = uri.split('magnet:?')[1]

  if (!data || data.length === 0)
    return result

  var params = data.split('&')

  params.forEach(function (param) {
    var keyval = param.split('=')

    // This keyval is invalid, skip it
    if (keyval.length !== 2)
      return

    var key = keyval[0]
    var val = keyval[1]

    // Clean up torrent name
    if (key === 'dn')
      val = decodeURIComponent(val).replace(/\+/g, ' ')

    // Address tracker (tr) is an encoded URI, so decode it
    if (key === 'tr')
      val = decodeURIComponent(val)

    // Return keywords as an array
    if (key === 'kt')
      val = decodeURIComponent(val).split('+')

    // If there are repeated parameters, return an array of values
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(val)
      } else {
        var old = result[key]
        result[key] = [old, val]
      }
    } else {
      result[key] = val
    }
  })

  // Convenience properties for parity with `parse-torrent-file`
  var m
  if (result.xt && (m = result.xt.match(/^urn:btih:(.{40})/))) {
    result.infoHash = new Buffer(m[1], 'hex').toString('hex')
  } else if (result.xt && (m = result.xt.match(/^urn:btih:(.{32})/))) {
    var decodedStr = base32.decode(m[1])
    result.infoHash = new Buffer(decodedStr, 'binary').toString('hex')
  }
  if (result.dn)
    result.name = result.dn
  if (result.kt)
    result.keywords = result.kt
  // always make `announce` property an array, for parity with `parse-torrent-file`
  if (typeof result.tr === 'string')
    result.announce = [ result.tr ]
  else if (Array.isArray(result.tr))
    result.announce = result.tr

  return result
}

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","thirty-two":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/node_modules/thirty-two/lib/thirty-two/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/node_modules/thirty-two/lib/thirty-two/index.js":[function(require,module,exports){
/*                                                                              
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in      
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.
*/

var base32 = require('./thirty-two');

exports.encode = base32.encode;
exports.decode = base32.decode;

},{"./thirty-two":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/node_modules/thirty-two/lib/thirty-two/thirty-two.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/magnet-uri/node_modules/thirty-two/lib/thirty-two/thirty-two.js":[function(require,module,exports){
(function (Buffer){
/*                                                                              
Copyright (c) 2011, Chris Umbel

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.                                                                   
*/

var charTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
var byteTable = [
    0xff, 0xff, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
    0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
    0x17, 0x18, 0x19, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
    0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
    0x17, 0x18, 0x19, 0xff, 0xff, 0xff, 0xff, 0xff
];

function quintetCount(buff) {
    var quintets = Math.floor(buff.length / 5);
    return buff.length % 5 == 0 ? quintets: quintets + 1;
}

exports.encode = function(plain) {
    var i = 0;
    var j = 0;
    var shiftIndex = 0;
    var digit = 0;
    var encoded = new Buffer(quintetCount(plain) * 8);
    if(!Buffer.isBuffer(plain)){
    	plain = new Buffer(plain);
    }

    /* byte by byte isn't as pretty as quintet by quintet but tests a bit
        faster. will have to revisit. */
    while(i < plain.length) {
        var current = plain[i];
    
        if(shiftIndex > 3) {
            digit = current & (0xff >> shiftIndex);
            shiftIndex = (shiftIndex + 5) % 8;
            digit = (digit << shiftIndex) | ((i + 1 < plain.length) ?
                plain[i + 1] : 0) >> (8 - shiftIndex);
            i++;
        } else {
            digit = (current >> (8 - (shiftIndex + 5))) & 0x1f;
            shiftIndex = (shiftIndex + 5) % 8;            
            if(shiftIndex == 0) i++;
        }
        
        encoded[j] = charTable.charCodeAt(digit);
        j++;
    }

    for(i = j; i < encoded.length; i++)
        encoded[i] = 0x3d; //'='.charCodeAt(0)
        
    return encoded;
};

exports.decode = function(encoded) {
    var shiftIndex = 0;
    var plainDigit = 0;
    var plainChar;
    var plainPos = 0;
    if(!Buffer.isBuffer(encoded)){
    	encoded = new Buffer(encoded);
    }
    var decoded = new Buffer(Math.ceil(encoded.length * 5 / 8));
    
    /* byte by byte isn't as pretty as octet by octet but tests a bit
        faster. will have to revisit. */    
    for(var i = 0; i < encoded.length; i++) {
    	if(encoded[i] == 0x3d){ //'='
    		break;
    	}
    		
        var encodedByte = encoded[i] - 0x30;
        
        if(encodedByte < byteTable.length) {
            plainDigit = byteTable[encodedByte];
            
            if(shiftIndex <= 3) {
                shiftIndex = (shiftIndex + 5) % 8;
                
                if(shiftIndex == 0) {
                    plainChar |= plainDigit;
                    decoded[plainPos] = plainChar;
                    plainPos++;
                    plainChar = 0;
                } else {
                    plainChar |= 0xff & (plainDigit << (8 - shiftIndex));
                }
            } else {
                shiftIndex = (shiftIndex + 5) % 8;
                plainChar |= 0xff & (plainDigit >>> shiftIndex);
                decoded[plainPos] = plainChar;
                plainPos++;

                plainChar = 0xff & (plainDigit << (8 - shiftIndex));
            }
        } else {
        	throw new Error('Invalid input - it is not base32 encoded string');
        }
    }
    return decoded.slice(0, plainPos);
};

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/index.js":[function(require,module,exports){
(function (Buffer){
module.exports = parseTorrent
module.exports.toBuffer = toBuffer

var bencode = require('bencode')
var path = require('path')
var sha1 = require('git-sha1')

/**
 * Parse a torrent. Throws an exception if the torrent is missing required fields.
 * @param  {Buffer|Object} torrent
 * @return {Object}        parsed torrent
 */
function parseTorrent (torrent) {
  if (Buffer.isBuffer(torrent)) {
    torrent = bencode.decode(torrent)
  }

  // sanity check
  ensure(torrent.info, 'info')
  ensure(torrent.info.name, 'info.name')
  ensure(torrent.info['piece length'], 'info[\'piece length\']')
  ensure(torrent.info.pieces, 'info.pieces')

  if (torrent.info.files) {
    torrent.info.files.forEach(function (file) {
      ensure(typeof file.length === 'number', 'info.files[0].length')
      ensure(file.path, 'info.files[0].path')
    })
  } else {
    ensure(torrent.info.length, 'info.length')
  }

  var result = {}
  result.info = torrent.info
  result.infoBuffer = bencode.encode(torrent.info)
  result.infoHash = sha1(result.infoBuffer)

  result.name = torrent.info.name.toString()
  result.private = !!torrent.info.private

  if (torrent['creation date'])
    result.created = new Date(torrent['creation date'] * 1000)

  if (Buffer.isBuffer(torrent.comment))
    result.comment = torrent.comment.toString()

  // announce/announce-list may be missing if metadata fetched via ut_metadata extension
  var announce = torrent['announce-list']
  if (!announce) {
    if (torrent.announce) {
      announce = [[torrent.announce]]
    } else {
      announce = []
    }
  }

  result.announceList = announce.map(function (urls) {
    return urls.map(function (url) {
      return url.toString()
    })
  })

  result.announce = [].concat.apply([], result.announceList)

  // handle url-list (BEP19 / web seeding)
  result.urlList = (torrent['url-list'] || []).map(function (url) {
    return url.toString()
  })

  var files = torrent.info.files || [torrent.info]
  result.files = files.map(function (file, i) {
    var parts = [].concat(file.name || result.name, file.path || []).map(function (p) {
      return p.toString()
    })
    return {
      path: path.join.apply(null, [path.sep].concat(parts)).slice(1),
      name: parts[parts.length - 1],
      length: file.length,
      offset: files.slice(0, i).reduce(sumLength, 0)
    }
  })

  result.length = files.reduce(sumLength, 0)

  var lastFile = result.files[result.files.length - 1]

  result.pieceLength = torrent.info['piece length']
  result.lastPieceLength = ((lastFile.offset + lastFile.length) % result.pieceLength) || result.pieceLength
  result.pieces = splitPieces(torrent.info.pieces)

  return result
}

/**
 * Convert a parsed torrent object back into a .torrent file buffer.
 * @param  {Object} parsed parsed torrent
 * @return {Buffer}
 */
function toBuffer (parsed) {
  var torrent = {
    info: parsed.info
  }

  if (parsed.announce && parsed.announce[0]) {
    torrent.announce = parsed.announce[0]
  }

  if (parsed.announceList) {
    torrent['announce-list'] = parsed.announceList.map(function (urls) {
      return urls.map(function (url) {
        url = new Buffer(url, 'utf8')
        if (!torrent.announce) {
          torrent.announce = url
        }
        return url
      })
    })
  }

  if (parsed.created) {
    torrent['creation date'] = (parsed.created.getTime() / 1000) | 0
  }
  return bencode.encode(torrent)
}


function sumLength (sum, file) {
  return sum + file.length
}

function splitPieces (buf) {
  var pieces = []
  for (var i = 0; i < buf.length; i += 20) {
    pieces.push(buf.slice(i, i + 20).toString('hex'))
  }
  return pieces
}

function ensure (bool, fieldName) {
  if (!bool) throw new Error('Torrent is missing required field: ' + fieldName)
}

}).call(this,require("buffer").Buffer)
},{"bencode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/node_modules/bencode/bencode.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","git-sha1":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/git-sha1/git-sha1.js","path":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/path-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/node_modules/bencode/bencode.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/bencode.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/bencode.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/bencode/bencode.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/re-emitter/index.js":[function(require,module,exports){
module.exports = reemit
module.exports.filter = filter

var EventEmitter = require('events').EventEmitter

function reemit (source, target, events) {
  if (!Array.isArray(events)) events = [ events ]

  events.forEach(function (event) {
    source.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      target.emit.apply(target, args)
    })
  })
}

function filter (source, events) {
  var emitter = new EventEmitter()
  reemit(source, emitter, events)
  return emitter
}

},{"events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/run-parallel/index.js":[function(require,module,exports){
module.exports = function (tasks, cb) {
  var results, pending, keys
  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      cb && cb(err, results)
      cb = null
    }
  }

  if (!pending) {
    // empty
    cb && cb(null, results)
    cb = null
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](done.bind(undefined, key))
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(done.bind(undefined, i))
    })
  }
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/speedometer/index.js":[function(require,module,exports){
var tick = 1;
var maxTick = 65535;
var resolution = 4;
var inc = function() {
	tick = (tick + 1) & maxTick;
};

var timer = setInterval(inc, (1000 / resolution) | 0);
if (timer.unref) timer.unref();

module.exports = function(seconds) {
	var size = resolution * (seconds || 5);
	var buffer = [0];
	var pointer = 1;
	var last = (tick-1) & maxTick;

	return function(delta) {
		var dist = (tick - last) & maxTick;
		if (dist > size) dist = size;
		last = tick;

		while (dist--) {
			if (pointer === size) pointer = 0;
			buffer[pointer] = buffer[pointer === 0 ? size-1 : pointer-1];
			pointer++;
		}

		if (delta) buffer[pointer-1] += delta;

		var top = buffer[pointer-1];
		var btm = buffer.length < size ? 0 : buffer[pointer === size ? 0 : pointer];

		return buffer.length < resolution ? top : (top - btm) * resolution / buffer.length;
	};
};
},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/index.js":[function(require,module,exports){
(function (process){
module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var inherits = require('inherits')
var reemit = require('re-emitter')
var Tracker = require('bittorrent-tracker/client') // `webtorrent-tracker` in browser

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)
  if (!opts) opts = {}

  self._performedDHTLookup = false

  extend(self, {
    announce: [],
    dht: (typeof DHT === 'function'),
    externalDHT: false,
    tracker: true,
    port: null // torrent port
  }, opts)

  if (!self.peerId) throw new Error('peerId required')
  if (!self.port && !process.browser) throw new Error('port required')

  self._createDHT(opts.dhtPort)
}

Discovery.prototype.setTorrent = function (torrent) {
  var self = this
  if (self.torrent) return

  if (torrent && torrent.infoHash) {
    self.torrent = torrent
    self.infoHash = torrent.infoHash
  } else {
    if (self.infoHash) return
    self.infoHash = torrent
  }
  debug('setTorrent %s', torrent)

  // If tracker exists, then it was created with just infoHash. Set torrent length
  // so client can report correct information about uploads.
  if (self.tracker && self.tracker !== true)
    self.tracker.torrentLength = torrent.length
  else
    self._createTracker()

  if (self.dht) {
    if (self.dht.ready) self._dhtLookupAndAnnounce()
    else self.dht.on('ready', self._dhtLookupAndAnnounce.bind(self))
  }
}

Discovery.prototype.stop = function (cb) {
  var self = this
  if (self.tracker && self.tracker.stop) self.tracker.stop()
  if (!self.externalDHT && self.dht && self.dht.destroy) self.dht.destroy(cb)
  else process.nextTick(function () { cb(null) })
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (!self.dht) return

  if (self.dht) self.externalDHT = true
  else self.dht = new DHT()

  reemit(self.dht, self, ['peer', 'error', 'warning'])

  if (!self.externalDHT) self.dht.listen(port)
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (!self.tracker) return

  var torrent = self.torrent || {
    infoHash: self.infoHash,
    announce: self.announce
  }

  self.tracker = process.browser
    ? new Tracker(self.peerId, torrent)
    : new Tracker(self.peerId, self.port, torrent)

  reemit(self.tracker, self, ['peer', 'warning', 'error'])
  self.tracker.start()
}

Discovery.prototype._dhtLookupAndAnnounce = function () {
  var self = this
  if (self._performedDHTLookup) return
  self._performedDHTLookup = true

  debug('lookup')
  self.dht.lookup(self.infoHash, function (err) {
    if (err || !self.port) return
    debug('dhtAnnounce')
    self.dht.announce(self.infoHash, self.port, function () {
      self.emit('dhtAnnounce')
    })
  })
}

}).call(this,require('_process'))
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","bittorrent-dht/client":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js","bittorrent-tracker/client":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/client.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","re-emitter":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/re-emitter/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/client.js":[function(require,module,exports){
(function (Buffer){
module.exports = Client

var debug = require('debug')('webtorrent-tracker')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var hat = require('hat')
var inherits = require('inherits')
var Peer = require('simple-peer')
var Socket = require('simple-websocket')

var DEFAULT_NUM_WANT = 15

inherits(Client, EventEmitter)

// It turns out that you can't open multiple websockets to the same server within one
// browser tab, so let's reuse them.
var sockets = {}

/**
 * A Client manages tracker connections for a torrent.
 *
 * @param {string} peerId  this peer's id
 * @param {Object} torrent parsed torrent
 * @param {Object} opts    optional options
 * @param {Number} opts.numWant    number of peers to request
 * @param {Number} opts.interval   interval in ms to send announce requests to the tracker
 */
function Client (peerId, torrent, opts) {
  var self = this
  if (!(self instanceof Client)) return new Client(peerId, torrent, opts)
  EventEmitter.call(self)
  self._opts = opts || {}

  // required
  self._peerId = Buffer.isBuffer(peerId)
    ? peerId
    : new Buffer(peerId, 'utf8')
  self._infoHash = Buffer.isBuffer(torrent.infoHash)
    ? torrent.infoHash
    : new Buffer(torrent.infoHash, 'hex')
  self.torrentLength = torrent.length

  // optional
  self._numWant = self._opts.numWant || DEFAULT_NUM_WANT
  self._intervalMs = self._opts.interval || (30 * 60 * 1000) // default: 30 minutes

  debug('new client %s', self._infoHash.toString('hex'))

  if (typeof torrent.announce === 'string') torrent.announce = [ torrent.announce ]
  self._trackers = (torrent.announce || [])
    .filter(function (announceUrl) {
      return announceUrl.indexOf('ws://') === 0 || announceUrl.indexOf('wss://') === 0
    })
    .map(function (announceUrl) {
      return new Tracker(self, announceUrl, self._opts)
    })
}

Client.prototype.start = function (opts) {
  var self = this
  self._trackers.forEach(function (tracker) {
    tracker.start(opts)
  })
}

Client.prototype.stop = function (opts) {
  var self = this
  self._trackers.forEach(function (tracker) {
    tracker.stop(opts)
  })
}

Client.prototype.complete = function (opts) {
  var self = this
  self._trackers.forEach(function (tracker) {
    tracker.complete(opts)
  })
}

Client.prototype.update = function (opts) {
  var self = this
  self._trackers.forEach(function (tracker) {
    tracker.update(opts)
  })
}

Client.prototype.setInterval = function (intervalMs) {
  var self = this
  self._intervalMs = intervalMs

  self._trackers.forEach(function (tracker) {
    tracker.setInterval(intervalMs)
  })
}

inherits(Tracker, EventEmitter)

/**
 * An individual torrent tracker (used by Client)
 *
 * @param {Client} client       parent bittorrent tracker client
 * @param {string} announceUrl  announce url of tracker
 * @param {Object} opts         optional options
 */
function Tracker (client, announceUrl, opts) {
  var self = this
  EventEmitter.call(self)
  self._opts = opts || {}
  self._announceUrl = announceUrl
  self._peers = {} // peers (offer id -> peer)

  debug('new tracker %s', announceUrl)

  self.client = client
  self.ready = false

  self._socket = null
  self._intervalMs = self.client._intervalMs // use client interval initially
  self._interval = null
}

Tracker.prototype.start = function (opts) {
  var self = this
  opts = opts || {}
  opts.event = 'started'

  debug('sent `start` %s %s', self._announceUrl, JSON.stringify(opts))
  self._announce(opts)
  self.setInterval(self._intervalMs) // start announcing on intervals
}

Tracker.prototype.stop = function (opts) {
  var self = this
  opts = opts || {}
  opts.event = 'stopped'

  debug('sent `stop` %s %s', self._announceUrl, JSON.stringify(opts))
  self._announce(opts)
  self.setInterval(0) // stop announcing on intervals

  // TODO: destroy the websocket
}

Tracker.prototype.complete = function (opts) {
  var self = this
  opts = opts || {}
  opts.event = 'completed'
  opts.downloaded = opts.downloaded || self.torrentLength || 0

  debug('sent `complete` %s %s', self._announceUrl, JSON.stringify(opts))
  self._announce(opts)
}

Tracker.prototype.update = function (opts) {
  var self = this
  opts = opts || {}

  debug('sent `update` %s %s', self._announceUrl, JSON.stringify(opts))
  self._announce(opts)
}

Tracker.prototype._init = function (onready) {
  var self = this
  if (onready) self.once('ready', onready)
  if (self._socket) return

  if (sockets[self._announceUrl]) {
    self._socket = sockets[self._announceUrl]
    self._onSocketReady()
  } else {
    self._socket = sockets[self._announceUrl] = new Socket(self._announceUrl)
    self._socket.on('ready', self._onSocketReady.bind(self))
  }
  self._socket.on('warning', self._onSocketWarning.bind(self))
  self._socket.on('error', self._onSocketWarning.bind(self))
  self._socket.on('message', self._onSocketMessage.bind(self))
}

Tracker.prototype._onSocketReady = function () {
  var self = this
  self.ready = true
  self.emit('ready')
}

Tracker.prototype._onSocketWarning = function (err) {
  debug('tracker warning %s', err.message)
}

Tracker.prototype._onSocketMessage = function (data) {
  var self = this

  if (!(typeof data === 'object' && data !== null))
    return self.client.emit('warning', new Error('Invalid tracker response'))

  if (data.info_hash !== self.client._infoHash.toString('binary'))
    return

  debug('received %s from %s', JSON.stringify(data), self._announceUrl)

  var failure = data['failure reason']
  if (failure)
    return self.client.emit('warning', new Error(failure))

  var warning = data['warning message']
  if (warning)
    self.client.emit('warning', new Error(warning))

  var interval = data.interval || data['min interval']
  if (interval && !self._opts.interval && self._intervalMs !== 0) {
    // use the interval the tracker recommends, UNLESS the user manually specifies an
    // interval they want to use
    self.setInterval(interval * 1000)
  }

  var trackerId = data['tracker id']
  if (trackerId) {
    // If absent, do not discard previous trackerId value
    self._trackerId = trackerId
  }

  if (data.complete) {
    self.client.emit('update', {
      announce: self._announceUrl,
      complete: data.complete,
      incomplete: data.incomplete
    })
  }

  var peer
  if (data.offer) {
    peer = new Peer({ trickle: false })
    peer.id = binaryToHex(data.peer_id)
    peer.once('signal', function (answer) {
      var opts = {
        info_hash: self.client._infoHash.toString('binary'),
        peer_id: self.client._peerId.toString('binary'),
        to_peer_id: data.peer_id
      }

      if (self._trackerId)
        opts.trackerid = self._trackerId

      self._send(extend({
        answer: answer,
        offer_id: data.offer_id
      }, opts))
    })
    peer.signal(data.offer)
    self.client.emit('peer', peer)
  }

  if (data.answer) {
    peer = self._peers[data.offer_id]
    if (peer) {
      peer.signal(data.answer)
      self.client.emit('peer', peer)
    }
  }
}

/**
 * Send an announce request to the tracker.
 * @param {Object} opts
 * @param {number=} opts.uploaded
 * @param {number=} opts.downloaded
 * @param {number=} opts.left (if not set, calculated automatically)
 */
Tracker.prototype._announce = function (opts) {
  var self = this
  if (!self.ready) return self._init(self._announce.bind(self, opts))

  self._generateOffers(function (offers) {
    opts = extend({
      uploaded: 0, // default, user should provide real value
      downloaded: 0, // default, user should provide real value
      info_hash: self.client._infoHash.toString('binary'),
      peer_id: self.client._peerId.toString('binary'),
      offers: offers
    }, opts)

    if (self.client.torrentLength != null && opts.left == null) {
      opts.left = self.client.torrentLength - (opts.downloaded || 0)
    }

    if (self._trackerId) {
      opts.trackerid = self._trackerId
    }
    self._send(opts)
  })
}

Tracker.prototype._send = function (opts) {
  var self = this
  debug('send %s', JSON.stringify(opts))
  self._socket.send(opts)
}

Tracker.prototype._generateOffers = function (cb) {
  var self = this
  var offers = []
  debug('generating %s offers', self.client._numWant)

  // TODO: cleanup dead peers and peers that never get a return offer, from self._peers
  for (var i = 0; i < self.client._numWant; ++i) {
    generateOffer()
  }

  function generateOffer () {
    var offerId = hat(160)
    var peer = self._peers[offerId] = new Peer({ initiator: true, trickle: false })
    peer.once('signal', function (offer) {
      offers.push({
        offer: offer,
        offer_id: offerId
      })
      checkDone()
    })
  }

  function checkDone () {
    if (offers.length === self.client._numWant) {
      debug('generated %s offers', self.client._numWant)
      cb(offers)
    }
  }
}

Tracker.prototype.setInterval = function (intervalMs) {
  var self = this
  clearInterval(self._interval)

  self._intervalMs = intervalMs
  if (intervalMs) {
    self._interval = setInterval(self.update.bind(self), self._intervalMs)
  }
}

function binaryToHex (id) {
  return new Buffer(id, 'binary').toString('hex')
}

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","hat":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/hat/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","simple-peer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/index.js","simple-websocket":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-websocket/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/index.js":[function(require,module,exports){
module.exports = Peer

var debug = require('debug')('simple-peer')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var hat = require('hat')
var inherits = require('inherits')
var isTypedArray = require('is-typedarray')
var once = require('once')
var stream = require('stream')
var toBuffer = require('typedarray-to-buffer')

var RTCPeerConnection = typeof window !== 'undefined' &&
    (window.mozRTCPeerConnection
  || window.RTCPeerConnection
  || window.webkitRTCPeerConnection)

var RTCSessionDescription = typeof window !== 'undefined' &&
    (window.mozRTCSessionDescription
  || window.RTCSessionDescription
  || window.webkitRTCSessionDescription)

var RTCIceCandidate = typeof window !== 'undefined' &&
    (window.mozRTCIceCandidate
  || window.RTCIceCandidate
  || window.webkitRTCIceCandidate)

inherits(Peer, EventEmitter)

/**
 * A WebRTC peer connection.
 * @param {Object} opts
 */
function Peer (opts) {
  if (!(this instanceof Peer)) return new Peer(opts)
  EventEmitter.call(this)

  opts = extend({
    initiator: false,
    stream: false,
    config: Peer.config,
    constraints: Peer.constraints,
    channelName: opts && opts.initiator ? 'simple-peer-' + hat(160) : null,
    trickle: true
  }, opts)

  extend(this, opts)

  debug('new peer initiator: %s channelName: %s', this.initiator, this.channelName)

  this.destroyed = false
  this.ready = false
  this._pcReady = false
  this._channelReady = false
  this._dataStreams = []
  this._iceComplete = false // done with ice candidate trickle (got null candidate)

  this._pc = new RTCPeerConnection(this.config, this.constraints)
  this._pc.oniceconnectionstatechange = this._onIceConnectionStateChange.bind(this)
  this._pc.onsignalingstatechange = this._onSignalingStateChange.bind(this)
  this._pc.onicecandidate = this._onIceCandidate.bind(this)

  this._channel = null

  if (this.stream)
    this._setupVideo(this.stream)

  if (this.initiator) {
    this._setupData({ channel: this._pc.createDataChannel(this.channelName) })

    this._pc.onnegotiationneeded = once(function () {
      this._pc.createOffer(function (offer) {
        this._pc.setLocalDescription(offer)
        var sendOffer = function () {
          this.emit('signal', this._pc.localDescription || offer)
        }.bind(this)
        if (this.trickle || this._iceComplete) sendOffer()
        else this.once('_iceComplete', sendOffer) // wait for candidates
      }.bind(this), this._onError.bind(this))
    }.bind(this))

    if (window.mozRTCPeerConnection) {
      // Firefox does not trigger this event automatically
      setTimeout(this._pc.onnegotiationneeded.bind(this._pc), 0)
    }
  } else {
    this._pc.ondatachannel = this._setupData.bind(this)
  }
}

/**
 * Expose config and constraints for overriding all Peer instances. Otherwise, just
 * set opts.config and opts.constraints when constructing a Peer.
 */
Peer.config = { iceServers: [ { url: 'stun:23.21.150.121' } ] }
Peer.constraints = {}

Peer.prototype.send = function (data, cb) {
  if (!this._channelReady) return this.once('ready', this.send.bind(this, data, cb))
  debug('send %s', data)

  if (isTypedArray.strict(data) || data instanceof ArrayBuffer ||
      data instanceof Blob || typeof data === 'string') {
    this._channel.send(data)
  } else {
    this._channel.send(JSON.stringify(data))
  }
  if (cb) cb(null)
}

Peer.prototype.signal = function (data) {
  if (this.destroyed) return
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (err) {
      data = {}
    }
  }
  debug('signal %s', JSON.stringify(data))
  if (data.sdp) {
    this._pc.setRemoteDescription(new RTCSessionDescription(data), function () {
      var needsAnswer = this._pc.remoteDescription.type === 'offer'
      if (needsAnswer) {
        this._pc.createAnswer(function (answer) {
          this._pc.setLocalDescription(answer)
          var sendAnswer = function () {
            this.emit('signal', this._pc.localDescription || answer)
          }.bind(this)
          if (this.trickle || this._iceComplete) sendAnswer()
          else this.once('_iceComplete', sendAnswer)
        }.bind(this), this._onError.bind(this))
      }
    }.bind(this), this._onError.bind(this))
  }
  if (data.candidate) {
    try {
      this._pc.addIceCandidate(new RTCIceCandidate(data.candidate))
    } catch (err) {
      this.destroy(new Error('error adding candidate, ' + err.message))
    }
  }
  if (!data.sdp && !data.candidate)
    this.destroy(new Error('signal() called with invalid signal data'))
}

Peer.prototype.destroy = function (err, onclose) {
  if (this.destroyed) return
  debug('destroy (error: %s)', err && err.message)
  this.destroyed = true
  this.ready = false

  if (typeof err === 'function') {
    onclose = err
    err = null
  }

  if (onclose) this.once('close', onclose)

  if (this._pc) {
    try {
      this._pc.close()
    } catch (err) {}

    this._pc.oniceconnectionstatechange = null
    this._pc.onsignalingstatechange = null
    this._pc.onicecandidate = null
  }

  if (this._channel) {
    try {
      this._channel.close()
    } catch (err) {}

    this._channel.onmessage = null
    this._channel.onopen = null
    this._channel.onclose = null
  }
  this._pc = null
  this._channel = null

  this._dataStreams.forEach(function (stream) {
    if (err) stream.emit('error', err)
    if (!stream._readableState.ended) stream.push(null)
    if (!stream._writableState.finished) stream.end()
  })
  this._dataStreams = []

  if (err) this.emit('error', err)
  this.emit('close')
}

Peer.prototype.getDataStream = function (opts) {
  if (this.destroyed) throw new Error('peer is destroyed')
  var dataStream = new DataStream(extend({ _peer: this }, opts))
  this._dataStreams.push(dataStream)
  return dataStream
}

Peer.prototype._setupData = function (event) {
  this._channel = event.channel
  this.channelName = this._channel.label

  this._channel.binaryType = 'arraybuffer'
  this._channel.onmessage = this._onChannelMessage.bind(this)
  this._channel.onopen = this._onChannelOpen.bind(this)
  this._channel.onclose = this._onChannelClose.bind(this)
}

Peer.prototype._setupVideo = function (stream) {
  this._pc.addStream(stream)
  this._pc.onaddstream = this._onAddStream.bind(this)
}

Peer.prototype._onIceConnectionStateChange = function () {
  var iceGatheringState = this._pc.iceGatheringState
  var iceConnectionState = this._pc.iceConnectionState
  this.emit('iceConnectionStateChange', iceGatheringState, iceConnectionState)
  debug('iceConnectionStateChange %s %s', iceGatheringState, iceConnectionState)
  if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
    this._pcReady = true
    this._maybeReady()
  }
  if (iceConnectionState === 'disconnected' || iceConnectionState === 'closed')
    this.destroy()
}

Peer.prototype._maybeReady = function () {
  debug('maybeReady pc %s channel %s', this._pcReady, this._channelReady)
  if (!this.ready && this._pcReady && this._channelReady) {
    debug('ready')
    this.ready = true
    this.emit('ready')
  }
}

Peer.prototype._onSignalingStateChange = function () {
  this.emit('signalingStateChange', this._pc.signalingState)
  debug('signalingStateChange %s', this._pc.signalingState)
}

Peer.prototype._onIceCandidate = function (event) {
  if (event.candidate && this.trickle) {
    this.emit('signal', { candidate: event.candidate })
  } else if (!event.candidate) {
    this._iceComplete = true
    this.emit('_iceComplete')
  }
}

Peer.prototype._onChannelMessage = function (event) {
  if (this.destroyed) return
  var data = event.data
  debug('receive %s', data)

  if (data instanceof ArrayBuffer) {
    data = toBuffer(new Uint8Array(data))
    this.emit('message', data)
  } else {
    try {
      this.emit('message', JSON.parse(data))
    } catch (err) {
      this.emit('message', data)
    }
  }
  this._dataStreams.forEach(function (stream) {
    stream.push(data)
  })
}

Peer.prototype._onChannelOpen = function () {
  this._channelReady = true
  this._maybeReady()
}

Peer.prototype._onChannelClose = function () {
  this._channelReady = false
  this.destroy()
}

Peer.prototype._onAddStream = function (event) {
  this.emit('stream', event.stream)
}

Peer.prototype._onError = function (err) {
  debug('error %s', err.message)
  this.destroy(err)
}

// Duplex Stream for data channel

inherits(DataStream, stream.Duplex)

function DataStream (opts) {
  stream.Duplex.call(this, opts)
  this._peer = opts._peer
  debug('new stream')
}

DataStream.prototype.destroy = function () {
  this._peer.destroy()
}

DataStream.prototype._read = function () {}

DataStream.prototype._write = function (chunk, encoding, cb) {
  this._peer.send(chunk, cb)
}

},{"debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","hat":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/hat/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","is-typedarray":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/node_modules/is-typedarray/index.js","once":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","typedarray-to-buffer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/node_modules/typedarray-to-buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/node_modules/is-typedarray/index.js":[function(require,module,exports){
module.exports      = isTypedArray
isTypedArray.strict = isStrictTypedArray
isTypedArray.loose  = isLooseTypedArray

var toString = Object.prototype.toString
var names = {
    '[object Int8Array]': true
  , '[object Int16Array]': true
  , '[object Int32Array]': true
  , '[object Uint8Array]': true
  , '[object Uint16Array]': true
  , '[object Uint32Array]': true
  , '[object Float32Array]': true
  , '[object Float64Array]': true
}

function isTypedArray(arr) {
  return (
       isStrictTypedArray(arr)
    || isLooseTypedArray(arr)
  )
}

function isStrictTypedArray(arr) {
  return (
       arr instanceof Int8Array
    || arr instanceof Int16Array
    || arr instanceof Int32Array
    || arr instanceof Uint8Array
    || arr instanceof Uint16Array
    || arr instanceof Uint32Array
    || arr instanceof Float32Array
    || arr instanceof Float64Array
  )
}

function isLooseTypedArray(arr) {
  return names[toString.call(arr)]
}

},{}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-peer/node_modules/typedarray-to-buffer/index.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/node_modules/typedarray-to-buffer/index.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/node_modules/typedarray-to-buffer/index.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/create-torrent/node_modules/filestream/node_modules/typedarray-to-buffer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/torrent-discovery/node_modules/webtorrent-tracker/node_modules/simple-websocket/index.js":[function(require,module,exports){
module.exports = Socket

var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var once = require('once')

var RECONNECT_TIMEOUT = 5000

inherits(Socket, EventEmitter)

function Socket (url, opts) {
  if (!(this instanceof Socket)) return new Socket(url, opts)
  EventEmitter.call(this)
  if (!opts) opts = {}

  this._url = url
  this._reconnect = (opts.reconnect !== undefined)
    ? opts.reconnect
    : RECONNECT_TIMEOUT
  this._init()
}

Socket.prototype.send = function (message) {
  if (this._ws && this._ws.readyState === WebSocket.OPEN) {
    if (typeof message === 'object')
      message = JSON.stringify(message)
    this._ws.send(message)
  }
}

Socket.prototype.destroy = function (onclose) {
  if (onclose) this.once('close', onclose)
  try {
    this._ws.close()
  } catch (err) {
    this._onclose()
  }
}

Socket.prototype._init = function () {
  this._errored = false
  this._ws = new WebSocket(this._url)
  this._ws.onopen = this._onopen.bind(this)
  this._ws.onmessage = this._onmessage.bind(this)
  this._ws.onclose = this._onclose.bind(this)
  this._ws.onerror = once(this._onerror.bind(this))
}

Socket.prototype._onopen = function () {
  this.emit('ready')
}

Socket.prototype._onerror = function (err) {
  this._errored = true

  // On error, close socket...
  this.destroy()

  // ...and try to reconnect after a timeout
  if (this._reconnect) {
    this._timeout = setTimeout(this._init.bind(this), this._reconnect)
    this.emit('warning', err)
  } else {
    this.emit('error', err)
  }
}


Socket.prototype._onmessage = function (event) {
  var message = event.data
  try {
    message = JSON.parse(event.data)
  } catch (err) {}
  this.emit('message', message)
}

Socket.prototype._onclose = function () {
  clearTimeout(this._timeout)
  if (this._ws) {
    this._ws.onopen = null
    this._ws.onerror = null
    this._ws.onmessage = null
    this._ws.onclose = null
  }
  this._ws = null
  if (!this._errored) this.emit('close')
}

},{"events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","once":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/index.js":[function(require,module,exports){
(function (Buffer){
var bencode = require('bencode')
var BitField = require('bitfield')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var sha1 = require('git-sha1')

var MAX_METADATA_SIZE = 10000000 // 10MB
var BITFIELD_GROW = 1000
var PIECE_LENGTH = 16 * 1024

module.exports = function (metadata) {

  inherits(ut_metadata, EventEmitter)

  function ut_metadata (wire) {
    EventEmitter.call(this)

    this._wire = wire

    this._metadataComplete = false
    this._metadataSize = null
    this._remainingRejects = null // how many reject messages to tolerate before quitting
    this._fetching = false

    // The largest .torrent file that I know of is ~1-2MB, which is ~100 pieces.
    // Therefore, cap the bitfield to 10x that (1000 pieces) so a malicious peer can't
    // make it grow to fill all memory.
    this._bitfield = new BitField(0, { grow: BITFIELD_GROW })

    if (Buffer.isBuffer(metadata)) {
      this.setMetadata(metadata)
    }
  }

  // For IE support. Since function.name does not work in IE.
  ut_metadata.prototype.name = 'ut_metadata'

  ut_metadata.prototype.onHandshake = function (infoHash, peerId, extensions) {
    this._infoHash = infoHash
    this._infoHashHex = infoHash.toString('hex')
  }

  ut_metadata.prototype.onExtendedHandshake = function (handshake) {
    if (!handshake.m || !handshake.m.ut_metadata) {
      return this.emit('warning', new Error('Peer does not support ut_metadata'))
    }
    if (!handshake.metadata_size) {
      return this.emit('warning', new Error('Peer does not have metadata'))
    }

    if (handshake.metadata_size > MAX_METADATA_SIZE) {
      return this.emit('warning', new Error('Peer gave maliciously large metadata size'))
    }

    this._metadataSize = handshake.metadata_size
    this._numPieces = Math.ceil(this._metadataSize / PIECE_LENGTH)
    this._remainingRejects = this._numPieces * 2

    if (this._fetching) {
      this._requestPieces()
    }
  }

  ut_metadata.prototype.onMessage = function (buf) {
    var dict, trailer
    try {
      var str = buf.toString()
      var trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
      trailer = buf.slice(trailerIndex)
    } catch (err) {
      // drop invalid messages
      return
    }

    switch (dict.msg_type) {
      case 0:
        // ut_metadata request (from peer)
        // example: { 'msg_type': 0, 'piece': 0 }
        this._onRequest(dict.piece)
        break
      case 1:
        // ut_metadata data (in response to our request)
        // example: { 'msg_type': 1, 'piece': 0, 'total_size': 3425 }
        this._onData(dict.piece, trailer, dict.total_size)
        break
      case 2:
        // ut_metadata reject (peer doesn't have piece we requested)
        // { 'msg_type': 2, 'piece': 0 }
        this._onReject(dict.piece)
        break
    }
  }

  /**
   * Ask the peer to send metadata.
   * @public
   */
  ut_metadata.prototype.fetch = function () {
    if (this._metadataComplete) {
      return
    }
    this._fetching = true
    if (this._metadataSize) {
      this._requestPieces()
    }
  }

  /**
   * Stop asking the peer to send metadata.
   * @public
   */
  ut_metadata.prototype.cancel = function () {
    this._fetching = false
  }

  ut_metadata.prototype.setMetadata = function (metadata) {
    if (this._metadataComplete) return true

    // if full torrent dictionary was passed in, pull out just `info` key
    try {
      var info = bencode.decode(metadata).info
      if (info) {
        metadata = bencode.encode(info)
      }
    } catch (err) {}

    // check hash
    if (this._infoHashHex && this._infoHashHex !== sha1(metadata)) {
      return false
    }

    this.cancel()

    this.metadata = metadata
    this._metadataComplete = true
    this._metadataSize = this.metadata.length
    this._wire.extendedHandshake.metadata_size = this._metadataSize

    this.emit('metadata', bencode.encode({ info: bencode.decode(this.metadata) }))

    return true
  }

  ut_metadata.prototype._send = function (dict, trailer) {
    var buf = bencode.encode(dict)
    if (Buffer.isBuffer(trailer)) {
      buf = Buffer.concat([buf, trailer])
    }
    this._wire.extended('ut_metadata', buf)
  }

  ut_metadata.prototype._request = function (piece) {
    this._send({ msg_type: 0, piece: piece })
  }

  ut_metadata.prototype._data = function (piece, buf, totalSize) {
    var msg = { msg_type: 1, piece: piece }
    if (typeof totalSize === 'number') {
      msg.total_size = totalSize
    }
    this._send(msg, buf)
  }

  ut_metadata.prototype._reject = function (piece) {
    this._send({ msg_type: 2, piece: piece })
  }

  ut_metadata.prototype._onRequest = function (piece) {
    if (!this._metadataComplete) {
      this._reject(piece)
      return
    }
    var start = piece * PIECE_LENGTH
    var end = start + PIECE_LENGTH
    if (end > this._metadataSize) {
      end = this._metadataSize
    }
    var buf = this.metadata.slice(start, end)
    this._data(piece, buf, this._metadataSize)
  }

  ut_metadata.prototype._onData = function (piece, buf, totalSize) {
    if (buf.length > PIECE_LENGTH) {
      return
    }
    buf.copy(this.metadata, piece * PIECE_LENGTH)
    this._bitfield.set(piece)
    this._checkDone()
  }

  ut_metadata.prototype._onReject = function (piece) {
    if (this._remainingRejects > 0 && this._fetching) {
      // If we haven't been rejected too much, then try to request the piece again
      this._request(piece)
      this._remainingRejects -= 1
    } else {
      this.emit('warning', new Error('Peer sent "reject" too much'))
    }
  }

  ut_metadata.prototype._requestPieces = function () {
    this.metadata = new Buffer(this._metadataSize)

    for (var piece = 0; piece < this._numPieces; piece++) {
      this._request(piece)
    }
  }

  ut_metadata.prototype._checkDone = function () {
    var done = true
    for (var piece = 0; piece < this._numPieces; piece++) {
      if (!this._bitfield.get(piece)) {
        done = false
        break
      }
    }
    if (!done) return

    // attempt to set metadata -- may fail sha1 check
    var success = this.setMetadata(this.metadata)

    if (!success) {
      this._failedMetadata()
    }
  }

  ut_metadata.prototype._failedMetadata = function () {
    // reset bitfield & try again
    this._bitfield = new BitField(0, { grow: BITFIELD_GROW })
    this._remainingRejects -= this._numPieces
    if (this._remainingRejects > 0) {
      this._requestPieces()
    } else {
      this.emit('warning', new Error('Peer sent invalid metadata'))
    }
  }

  return ut_metadata
}

}).call(this,require("buffer").Buffer)
},{"bencode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/node_modules/bencode/bencode.js","bitfield":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/bitfield/index.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","git-sha1":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/git-sha1/git-sha1.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/node_modules/bencode/bencode.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/node_modules/bencode/bencode.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/node_modules/bencode/bencode.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/parse-torrent/node_modules/parse-torrent-file/node_modules/bencode/bencode.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/index.js":[function(require,module,exports){
(function (Buffer){
// TODO: don't return offer when we're at capacity. the approach of not sending handshake
//       wastes webrtc connections which are a more limited resource

module.exports = Swarm

var debug = require('debug')('webtorrent-swarm')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
var once = require('once')
var speedometer = require('speedometer')
var Wire = require('bittorrent-protocol')

var MAX_PEERS = 30
var HANDSHAKE_TIMEOUT = 25000

/**
 * Peer
 * A peer in the swarm. Comprised of a `SimplePeer` and a `Wire`.
 *
 * @param {Swarm} swarm
 * @param {stream.Duplex} stream a duplex stream to the remote peer
 * @param {string} id remote peerId
 */
function Peer (swarm, stream, id) {
  this.swarm = swarm
  this.stream = stream
  this.id = id

  var wire = this.wire = new Wire()
  this.timeout = null
  this.handshaked = false
  this.paused = true

  var destroy = once(function () {
    if (this.handshaked)
      this.swarm.wires.splice(this.swarm.wires.indexOf(this.wire), 1)
    this.destroy()
    this.swarm._drain()
    this.swarm._peers[this.id] = null
  }.bind(this))

  // Destroy the peer when the stream/wire is done or emits an error.
  stream.once('end', destroy)
  stream.once('error', destroy)
  stream.once('close', destroy)
  stream.once('finish', destroy)

  wire.once('end', destroy)
  wire.once('close', destroy)
  wire.once('error', destroy)
  wire.once('finish', destroy)

  wire.on('handshake', this._onHandshake.bind(this))

  // Duplex streaming magic!
  stream.pipe(wire).pipe(stream)
}

Peer.prototype.destroy = function () {
  debug('peer destroy')
  if (this.stream) this.stream.destroy()
  if (this.wire) this.wire.destroy()
  if (this.timeout) clearTimeout(this.timeout)
  this.stream = null
  this.wire = null
  this.timeout = null
}

/**
 * Send a handshake to the remote peer. This is called by _drain() when there is room
 * for a new peer in this swarm. Even if the remote peer sends us a handshake, we might
 * not send a return handshake. This is how we rate-limit when there are too many peers;
 * without a return handshake the remote peer won't start sending us data or piece
 * requests.
 */
Peer.prototype.handshake = function () {
  this.paused = false
  this.wire.handshake(this.swarm.infoHash, this.swarm.peerId, this.swarm.handshake)
  debug('sent handshake i %s p %s', this.swarm.infoHashHex, this.swarm.peerIdHex)

  if (!this.handshaked) {
    // Peer must respond to handshake in timely manner
    this.timeout = setTimeout(function () {
      this.destroy()
    }.bind(this), HANDSHAKE_TIMEOUT)
  }
}

/**
 * Called whenever we've handshaken with a new wire.
 * @param  {string} infoHash
 */
Peer.prototype._onHandshake = function (infoHash) {
  var infoHashHex = infoHash.toString('hex')
  debug('got handshake %s', infoHashHex)

  if (this.swarm.destroyed || infoHashHex !== this.swarm.infoHashHex)
    return this.destroy()

  this.handshaked = true
  clearTimeout(this.timeout)

  // Track total bytes downloaded by the swarm
  this.wire.on('download', function (downloaded) {
    this.swarm.downloaded += downloaded
    this.swarm.downloadSpeed(downloaded)
    this.swarm.emit('download', downloaded)
  }.bind(this))

  // Track total bytes uploaded by the swarm
  this.wire.on('upload', function (uploaded) {
    this.swarm.uploaded += uploaded
    this.swarm.uploadSpeed(uploaded)
    this.swarm.emit('upload', uploaded)
  }.bind(this))

  this.swarm.wires.push(this.wire)
  this.swarm.emit('wire', this.wire)
}

inherits(Swarm, EventEmitter)

/**
 * Swarm
 * =====
 * Abstraction of a BitTorrent "swarm", which is handy for managing all peer
 * connections for a given torrent download. This handles connecting to peers,
 * listening for incoming connections, and doing the initial peer wire protocol
 * handshake with peers. It also tracks total data uploaded/downloaded to/from
 * the swarm.
 *
 * Events: wire, download, upload, error, close
 *
 * @param {Buffer|string} infoHash
 * @param {Buffer|string} peerId
 * @param {Object} opts
 */
function Swarm (infoHash, peerId, opts) {
  if (!(this instanceof Swarm)) return new Swarm(infoHash, peerId, opts)
  EventEmitter.call(this)
  if (!opts) opts = {}

  this.infoHash = typeof infoHash === 'string'
    ? new Buffer(infoHash, 'hex')
    : infoHash
  this.infoHashHex = this.infoHash.toString('hex')

  this.peerId = typeof peerId === 'string'
    ? new Buffer(peerId, 'utf8')
    : peerId
  this.peerIdHex = this.peerId.toString('hex')

  debug('new swarm i %s p %s', this.infoHashHex, this.peerIdHex)

  this.handshake = opts.handshake // handshake extensions
  this.maxPeers = opts.maxPeers || MAX_PEERS

  this.downloaded = 0
  this.uploaded = 0
  this.downloadSpeed = speedometer()
  this.uploadSpeed = speedometer()

  this.wires = [] // open wires (added *after* handshake)
  this._queue = [] // queue of peers to attempt handshake with
  this._peers = {} // connected peers (peerId -> Peer)

  this.paused = false
  this.destroyed = false
}

Object.defineProperty(Swarm.prototype, 'ratio', {
  get: function () {
    if (this.downloaded === 0)
      return 0
    else
      return this.uploaded / this.downloaded
  }
})

Object.defineProperty(Swarm.prototype, 'numQueued', {
  get: function () {
    return this._queue.length
  }
})

Object.defineProperty(Swarm.prototype, 'numPeers', {
  get: function () {
    return this.wires.length
  }
})

/**
 * Add a peer to the swarm.
 * @param {SimplePeer} simplePeer     simple peer instance to remote peer
 * @param {string}     simplePeer.id  peer id
 */
Swarm.prototype.addPeer = function (simplePeer) {
  if (this.destroyed) return
  if (this._peers[simplePeer.id]) return
  var stream = simplePeer.getDataStream()
  var peer = new Peer(this, stream, simplePeer.id)
  this._peers[simplePeer.id] = peer
  this._queue.push(peer)
  this._drain()
}

/**
 * Temporarily stop connecting to new peers. Note that this does not pause new
 * incoming connections, nor does it pause the streams of existing connections
 * or their wires.
 */
Swarm.prototype.pause = function () {
  debug('pause')
  this.paused = true
}

/**
 * Resume connecting to new peers.
 */
Swarm.prototype.resume = function () {
  debug('resume')
  this.paused = false
  this._drain()
}

/**
 * Remove a peer from the swarm.
 * @param  {string} peer  simple-peer instance
 */
Swarm.prototype.removePeer = function (peer) {
  debug('removePeer %s', peer)
  this._removePeer(peer)
  this._drain()
}

/**
 * Private method to remove a peer from the swarm without calling _drain().
 * @param  {string} peer  simple-peer instance
 */
Swarm.prototype._removePeer = function (peer) {
  debug('_removePeer %s', peer)
  peer.destroy()
}

/**
 * Destroy the swarm, close all open peer connections, and do cleanup.
 * @param {function} onclose
 */
Swarm.prototype.destroy = function (onclose) {
  if (this.destroyed) return
  this.destroyed = true
  if (onclose) this.once('close', onclose)

  debug('destroy')

  for (var peer in this._peers) {
    this._removePeer(peer)
  }

  this.emit('close')
}

/**
 * Pop a peer off the FIFO queue and connect to it. When _drain() gets called,
 * the queue will usually have only one peer in it, except when there are too
 * many peers (over `this.maxPeers`) in which case they will just sit in the
 * queue until another connection closes.
 */
Swarm.prototype._drain = function () {
  if (this.paused || this.destroyed || this.numPeers >= this.maxPeers) return
  debug('drain %s queued %s peers %s max', this.numQueued, this.numPeers, this.maxPeers)
  var peer = this._queue.shift()
  if (peer) {
    peer.handshake()
  }
}

}).call(this,require("buffer").Buffer)
},{"bittorrent-protocol":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/node_modules/bittorrent-protocol/index.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","once":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/once/once.js","speedometer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/speedometer/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/node_modules/bittorrent-protocol/index.js":[function(require,module,exports){
(function (Buffer){
module.exports = Wire

var BitField = require('bitfield')
var bencode = require('bencode')
var debug = require('debug')('bittorrent-protocol')
var extend = require('extend.js')
var inherits = require('inherits')
var speedometer = require('speedometer')
var stream = require('stream')

var BITFIELD_GROW = 400000

var MESSAGE_PROTOCOL     = new Buffer('\u0013BitTorrent protocol')
var MESSAGE_KEEP_ALIVE   = new Buffer([0x00,0x00,0x00,0x00])
var MESSAGE_CHOKE        = new Buffer([0x00,0x00,0x00,0x01,0x00])
var MESSAGE_UNCHOKE      = new Buffer([0x00,0x00,0x00,0x01,0x01])
var MESSAGE_INTERESTED   = new Buffer([0x00,0x00,0x00,0x01,0x02])
var MESSAGE_UNINTERESTED = new Buffer([0x00,0x00,0x00,0x01,0x03])

var MESSAGE_RESERVED     = [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]
var MESSAGE_PORT         = [0x00,0x00,0x00,0x03,0x09,0x00,0x00]

function Request (piece, offset, length, callback) {
  this.piece = piece
  this.offset = offset
  this.length = length
  this.callback = callback
}

inherits(Wire, stream.Duplex)

function Wire () {
  if (!(this instanceof Wire)) return new Wire()
  stream.Duplex.call(this)
  debug('new wire')

  this.amChoking = true // are we choking the peer?
  this.amInterested = false // are we interested in the peer?

  this.peerChoking = true // is the peer choking us?
  this.peerInterested = false // is the peer interested in us?

  // The largest torrent that I know of (the Geocities archive) is ~641 GB and has
  // ~41,000 pieces. Therefore, cap bitfield to 10x larger (400,000 bits) to support all
  // possible torrents but prevent malicious peers from growing bitfield to fill memory.
  this.peerPieces = new BitField(0, { grow: BITFIELD_GROW })

  this.peerExtensions = {}

  this.requests = []
  this.peerRequests = []

  /** @type {Object} number -> string, ex: 1 -> 'ut_metadata' */
  this.extendedMapping = {}
  /** @type {Object} string -> number, ex: 9 -> 'ut_metadata' */
  this.peerExtendedMapping = {}

  /**
   * The extended handshake to send, minus the "m" field, which gets automatically
   * filled from `this.extendedMapping`.
   * @type {Object}
   */
  this.extendedHandshake = {}
  this.peerExtendedHandshake = {}

  /** @type {Object} string -> function, ex 'ut_metadata' -> ut_metadata() */
  this._ext = {}
  this._nextExt = 1

  this.uploaded = 0
  this.downloaded = 0
  this.uploadSpeed = speedometer()
  this.downloadSpeed = speedometer()

  this._keepAlive = null
  this._timeout = null
  this._timeoutMs = 0

  this.destroyed = false // was the wire ended by calling `destroy`?
  this._finished = false

  this._buffer = []
  this._bufferSize = 0
  this._parser = null
  this._parserSize = 0

  this.on('finish', this._onfinish)

  this._parseHandshake()
}

/**
 * Set whether to send a "keep-alive" ping (sent every 60s)
 * @param {boolean} enable
 */
Wire.prototype.setKeepAlive = function (enable) {
  clearInterval(this._keepAlive)
  if (enable === false) return
  this._keepAlive = setInterval(this._push.bind(this, MESSAGE_KEEP_ALIVE), 60000)
}

/**
 * Set the amount of time to wait before considering a request to be "timed out"
 * @param {number} ms
 */
Wire.prototype.setTimeout = function (ms) {
  this._clearTimeout()
  this._timeoutMs = ms
  this._updateTimeout()
}

Wire.prototype.destroy = function () {
  this.destroyed = true
  this.end()
}

Wire.prototype.end = function () {
  this._onUninterested()
  this._onChoke()
  stream.Duplex.prototype.end.apply(this, arguments)
}

//
// PROTOCOL EXTENSION API
//

Wire.prototype.use = function (Extension) {
  var name = Extension.name || Extension.prototype.name
  if (!name) {
    throw new Error('Extension API requires a named function, e.g. function name() {}')
  }

  var ext = this._nextExt
  var handler = new Extension(this)

  function noop () {}

  if (typeof handler.onHandshake !== 'function') {
    handler.onHandshake = noop
  }
  if (typeof handler.onExtendedHandshake !== 'function') {
    handler.onExtendedHandshake = noop
  }
  if (typeof handler.onMessage !== 'function') {
    handler.onMessage = noop
  }

  this.extendedMapping[ext] = name
  this._ext[name] = handler
  this[name] = handler

  this._nextExt += 1
}

//
// OUTGOING MESSAGES
//

/**
 * Message: "handshake" <pstrlen><pstr><reserved><info_hash><peer_id>
 * @param  {Buffer|string} infoHash (as Buffer or *hex* string)
 * @param  {Buffer|string} peerId
 * @param  {Object} extensions
 */
Wire.prototype.handshake = function (infoHash, peerId, extensions) {
  if (typeof infoHash === 'string')
    infoHash = new Buffer(infoHash, 'hex')
  if (typeof peerId === 'string')
    peerId = new Buffer(peerId, 'hex')
  if (infoHash.length !== 20 || peerId.length !== 20)
    throw new Error('infoHash and peerId MUST have length 20')

  var reserved = new Buffer(MESSAGE_RESERVED)

  // enable extended message
  reserved[5] |= 0x10

  if (extensions && extensions.dht)
    reserved[7] |= 1

  this._push(Buffer.concat([MESSAGE_PROTOCOL, reserved, infoHash, peerId]))
}

/**
 * Message "choke": <len=0001><id=0>
 */
Wire.prototype.choke = function () {
  if (this.amChoking) return
  this.amChoking = true
  while (this.peerRequests.length) this.peerRequests.pop()
  this._push(MESSAGE_CHOKE)
}

/**
 * Message "unchoke": <len=0001><id=1>
 */
Wire.prototype.unchoke = function () {
  if (!this.amChoking) return
  this.amChoking = false
  this._push(MESSAGE_UNCHOKE)
}

/**
 * Message "interested": <len=0001><id=2>
 */
Wire.prototype.interested = function () {
  if (this.amInterested) return
  this.amInterested = true
  this._push(MESSAGE_INTERESTED)
}

/**
 * Message "uninterested": <len=0001><id=3>
 */
Wire.prototype.uninterested = function () {
  if (!this.amInterested) return
  this.amInterested = false
  this._push(MESSAGE_UNINTERESTED)
}

/**
 * Message "have": <len=0005><id=4><piece index>
 * @param  {number} index
 */
Wire.prototype.have = function (index) {
  this._message(4, [index], null)
}

/**
 * Message "bitfield": <len=0001+X><id=5><bitfield>
 * @param  {BitField|Buffer} bitfield
 */
Wire.prototype.bitfield = function (bitfield) {
  if (!Buffer.isBuffer(bitfield))
    bitfield = bitfield.buffer

  this._message(5, [], bitfield)
}

/**
 * Message "request": <len=0013><id=6><index><begin><length>
 * @param  {number}   index
 * @param  {number}   offset
 * @param  {number}   length
 * @param  {function} cb
 */
Wire.prototype.request = function (index, offset, length, cb) {
  if (!cb) cb = function () {}

  if (this._finished)
    return cb(new Error('wire is closed'))
  if (this.peerChoking)
    return cb(new Error('peer is choking'))

  this.requests.push(new Request(index, offset, length, cb))
  this._updateTimeout()
  this._message(6, [index, offset, length], null)
}

/**
 * Message "piece": <len=0009+X><id=7><index><begin><block>
 * @param  {number} index
 * @param  {number} offset
 * @param  {Buffer} buffer
 */
Wire.prototype.piece = function (index, offset, buffer) {
  this.uploaded += buffer.length
  this.uploadSpeed(buffer.length)
  this.emit('upload', buffer.length)
  this._message(7, [index, offset], buffer)
}

/**
 * Message "cancel": <len=0013><id=8><index><begin><length>
 * @param  {number} index
 * @param  {number} offset
 * @param  {number} length
 */
Wire.prototype.cancel = function (index, offset, length) {
  this._callback(
    pull(this.requests, index, offset, length),
    new Error('request was cancelled'),
    null
  )
  this._message(8, [index, offset, length], null)
}

/**
 * Message: "port" <len=0003><id=9><listen-port>
 * @param {Number} port
 */
Wire.prototype.port = function (port) {
  var message = new Buffer(MESSAGE_PORT)
  message.writeUInt16BE(port, 5)
  this._push(message)
}

/**
 * Message: "extended" <len=0005+X><id=20><ext-number><payload>
 * @param  {number} ext
 * @param  {Object} obj
 */
Wire.prototype.extended = function (ext, obj) {
  if (typeof ext === 'string' && this.peerExtendedMapping[ext]) {
    ext = this.peerExtendedMapping[ext]
  }
  if (typeof ext === 'number') {
    var ext_id = new Buffer([ext])
    var buf = Buffer.isBuffer(obj) ? obj : bencode.encode(obj)

    this._message(20, [], Buffer.concat([ext_id, buf]))
  } else {
    console.warn('Skipping extension', ext)
  }
}

//
// INCOMING MESSAGES
//

Wire.prototype._onKeepAlive = function () {
  this.emit('keep-alive')
}

Wire.prototype._onHandshake = function (infoHash, peerId, extensions) {
  this.peerId = peerId
  this.peerExtensions = extensions
  this.emit('handshake', infoHash, peerId, extensions)

  var name
  for (name in this._ext) {
    this._ext[name].onHandshake(infoHash, peerId, extensions)
  }

  /* Peer supports BEP-0010, send extended handshake.
   *
   * This comes after the 'handshake' event to give the user a chance to populate
   * `this.extendedHandshake` and `this.extendedMapping` before the extended handshake
   * is sent to the remote peer.
   */
  if (extensions.extended) {
    // Create extended message object from registered extensions
    var msg = extend({}, this.extendedHandshake)
    msg.m = {}
    for (var ext in this.extendedMapping) {
      name = this.extendedMapping[ext]
      msg.m[name] = Number(ext)
    }

    // Send extended handshake
    this.extended(0, bencode.encode(msg))
  }
}

Wire.prototype._onChoke = function () {
  this.peerChoking = true
  this.emit('choke')
  while (this.requests.length)
    this._callback(this.requests.shift(), new Error('peer is choking'), null)
}

Wire.prototype._onUnchoke = function () {
  this.peerChoking = false
  this.emit('unchoke')
}

Wire.prototype._onInterested = function () {
  this.peerInterested = true
  this.emit('interested')
}

Wire.prototype._onUninterested = function () {
  this.peerInterested = false
  this.emit('uninterested')
}

Wire.prototype._onHave = function (index) {
  if (this.peerPieces.get(index)) {
    return
  }

  this.peerPieces.set(index, true)
  this.emit('have', index)
}

Wire.prototype._onBitField = function (buffer) {
  this.peerPieces = new BitField(buffer)
  this.emit('bitfield', this.peerPieces)
}

Wire.prototype._onRequest = function (index, offset, length) {
  if (this.amChoking) return

  var respond = function (err, buffer) {
    if (request !== pull(this.peerRequests, index, offset, length)) return
    if (err) return
    this.piece(index, offset, buffer)
  }.bind(this)

  var request = new Request(index, offset, length, respond)
  this.peerRequests.push(request)
  this.emit('request', index, offset, length, respond)
}

Wire.prototype._onPiece = function (index, offset, buffer) {
  this._callback(pull(this.requests, index, offset, buffer.length), null, buffer)
  this.downloaded += buffer.length
  this.downloadSpeed(buffer.length)
  this.emit('download', buffer.length)
  this.emit('piece', index, offset, buffer)
}

Wire.prototype._onCancel = function (index, offset, length) {
  pull(this.peerRequests, index, offset, length)
  this.emit('cancel', index, offset, length)
}

Wire.prototype._onPort = function (port) {
  this.emit('port', port)
}

Wire.prototype._onExtended = function (ext, buf) {
  var info, name
  if (ext === 0 && (info = safeBdecode(buf))) {
    this.peerExtendedHandshake = info
    if (typeof info.m === 'object') {
      for (name in info.m) {
        this.peerExtendedMapping[name] = Number(info.m[name].toString())
      }
    }
    for (name in this._ext) {
      if (this.peerExtendedMapping[name]) {
        this._ext[name].onExtendedHandshake(this.peerExtendedHandshake)
      }
    }
    this.emit('extended', 'handshake', this.peerExtendedHandshake)
  } else {
    if (this.extendedMapping[ext]) {
      ext = this.extendedMapping[ext] // friendly name for extension
      if (this._ext[ext]) {
        // there is an registered extension handler, so call it
        this._ext[ext].onMessage(buf)
      }
    }
    this.emit('extended', ext, buf)
  }
}

Wire.prototype._onTimeout = function () {
  this._callback(this.requests.shift(), new Error('request has timed out'), null)
  this.emit('timeout')
}

//
// STREAM METHODS
//

/**
 * Push a message to the remote peer.
 * @param {Buffer} data
 */
Wire.prototype._push = function (data) {
  if (this._finished) return
  return this.push(data)
}

/**
 * Duplex stream method. Called whenever the upstream has data for us.
 * @param  {Buffer|string} data
 * @param  {string}   encoding
 * @param  {function} cb
 */
Wire.prototype._write = function (data, encoding, cb) {
  this._bufferSize += data.length
  this._buffer.push(data)

  while (this._bufferSize >= this._parserSize) {
    var buffer = (this._buffer.length === 1)
      ? this._buffer[0]
      : Buffer.concat(this._buffer)
    this._bufferSize -= this._parserSize
    this._buffer = this._bufferSize
      ? [buffer.slice(this._parserSize)]
      : []
    this._parser(buffer.slice(0, this._parserSize))
  }

  cb(null) // Signal that we're ready for more data
}

/**
 * Duplex stream method. Called whenever the downstream wants data. No-op
 * since we'll just push data whenever we get it. Extra data will be buffered
 * in memory (we don't want to apply backpressure to peers!).
 */
Wire.prototype._read = function () {}


//
// HELPER METHODS
//

Wire.prototype._callback = function (request, err, buffer) {
  if (!request)
    return

  this._clearTimeout()

  if (!this.peerChoking && !this._finished)
    this._updateTimeout()
  request.callback(err, buffer)
}

Wire.prototype._clearTimeout = function () {
  if (!this._timeout)
    return

  clearTimeout(this._timeout)
  this._timeout = null
}

Wire.prototype._updateTimeout = function () {
  if (!this._timeoutMs || !this.requests.length || this._timeout)
    return

  this._timeout = setTimeout(this._onTimeout.bind(this), this._timeoutMs)
}

Wire.prototype._parse = function (size, parser) {
  this._parserSize = size
  this._parser = parser
}

Wire.prototype._message = function (id, numbers, data) {
  var dataLength = data ? data.length : 0
  var buffer = new Buffer(5 + 4 * numbers.length)

  buffer.writeUInt32BE(buffer.length + dataLength - 4, 0)
  buffer[4] = id
  for (var i = 0; i < numbers.length; i++) {
    buffer.writeUInt32BE(numbers[i], 5 + 4 * i)
  }

  this._push(buffer)
  if (data)
    this._push(data)
}

Wire.prototype._onmessagelength = function (buffer) {
  var length = buffer.readUInt32BE(0)
  if (length > 0) {
    this._parse(length, this._onmessage)
  } else {
    this._onKeepAlive()
    this._parse(4, this._onmessagelength)
  }
}

Wire.prototype._onmessage = function (buffer) {
  this._parse(4, this._onmessagelength)
  switch (buffer[0]) {
    case 0:
      return this._onChoke()
    case 1:
      return this._onUnchoke()
    case 2:
      return this._onInterested()
    case 3:
      return this._onUninterested()
    case 4:
      return this._onHave(buffer.readUInt32BE(1))
    case 5:
      return this._onBitField(buffer.slice(1))
    case 6:
      return this._onRequest(buffer.readUInt32BE(1),
          buffer.readUInt32BE(5), buffer.readUInt32BE(9))
    case 7:
      return this._onPiece(buffer.readUInt32BE(1),
          buffer.readUInt32BE(5), buffer.slice(9))
    case 8:
      return this._onCancel(buffer.readUInt32BE(1),
          buffer.readUInt32BE(5), buffer.readUInt32BE(9))
    case 9:
      return this._onPort(buffer.readUInt16BE(1))
    case 20:
      return this._onExtended(buffer.readUInt8(1), buffer.slice(2))
  }
  this.emit('unknownmessage', buffer)
}

Wire.prototype._parseHandshake = function () {
  this._parse(1, function (buffer) {
    var pstrlen = buffer.readUInt8(0)
    this._parse(pstrlen + 48, function (handshake) {
      var protocol = handshake.slice(0, pstrlen)
      if (protocol.toString() !== 'BitTorrent protocol') {
        debug('Error: wire not speaking BitTorrent protocol (%s)', protocol.toString())
        this.end()
        return
      }
      handshake = handshake.slice(pstrlen)
      this._onHandshake(handshake.slice(8, 28), handshake.slice(28, 48), {
        dht: !!(handshake[7] & 0x01), // see bep_0005
        extended: !!(handshake[5] & 0x10) // see bep_0010
      })
      this._parse(4, this._onmessagelength)
    }.bind(this))
  }.bind(this))
}

Wire.prototype._onfinish = function () {
  this._finished = true

  this.push(null) // stream cannot be half open, so signal the end of it
  while (this.read()) {} // consume and discard the rest of the stream data

  clearInterval(this._keepAlive)
  this._parse(Number.MAX_VALUE, function () {})
  this.peerRequests = []
  while (this.requests.length)
    this._callback(this.requests.shift(), new Error('wire was closed'), null)
}

function pull (requests, piece, offset, length) {
  for (var i = 0; i < requests.length; i++) {
    var req = requests[i]
    if (req.piece !== piece || req.offset !== offset || req.length !== length)
      continue
    if (i === 0)
      requests.shift()
    else
      requests.splice(i, 1)
    return req
  }
  return null
}

function safeBdecode (buf) {
  try {
    return bencode.decode(buf);
  } catch (e) {
    console.warn(e);
  }
}

}).call(this,require("buffer").Buffer)
},{"bencode":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/node_modules/bittorrent-protocol/node_modules/bencode/bencode.js","bitfield":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/bitfield/index.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","debug":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/debug/browser.js","extend.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/extend.js/index.js","inherits":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js","speedometer":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/speedometer/index.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/webtorrent-swarm/node_modules/bittorrent-protocol/node_modules/bencode/bencode.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/node_modules/bencode/bencode.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/node_modules/bencode/bencode.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/ut_metadata/node_modules/bencode/bencode.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js":[function(require,module,exports){

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js":[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browser-resolve/empty.js":[function(require,module,exports){
module.exports=require("/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js")
},{"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/utils/common.js":[function(require,module,exports){
'use strict';


var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
                (typeof Uint16Array !== 'undefined') &&
                (typeof Int32Array !== 'undefined');


exports.assign = function (obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    var source = sources.shift();
    if (!source) { continue; }

    if (typeof(source) !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (var p in source) {
      if (source.hasOwnProperty(p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// reduce buffer size, avoiding mem copy
exports.shrinkBuf = function (buf, size) {
  if (buf.length === size) { return buf; }
  if (buf.subarray) { return buf.subarray(0, size); }
  buf.length = size;
  return buf;
};


var fnTyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs+len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for(var i=0; i<len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function(chunks) {
    var i, l, len, pos, chunk, result;

    // calculate data length
    len = 0;
    for (i=0, l=chunks.length; i<l; i++) {
      len += chunks[i].length;
    }

    // join chunks
    result = new Uint8Array(len);
    pos = 0;
    for (i=0, l=chunks.length; i<l; i++) {
      chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result;
  }
};

var fnUntyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    for(var i=0; i<len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function(chunks) {
    return [].concat.apply([], chunks);
  }
};


// Enable/Disable typed arrays use, for testing
//
exports.setTyped = function (on) {
  if (on) {
    exports.Buf8  = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, fnTyped);
  } else {
    exports.Buf8  = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, fnUntyped);
  }
};

exports.setTyped(TYPED_OK);
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/adler32.js":[function(require,module,exports){
'use strict';

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It doesn't worth to make additional optimizationa as in original.
// Small size is preferable.

function adler32(adler, buf, len, pos) {
  var s1 = (adler & 0xffff) |0
    , s2 = ((adler >>> 16) & 0xffff) |0
    , n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
}


module.exports = adler32;
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/constants.js":[function(require,module,exports){
module.exports = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/crc32.js":[function(require,module,exports){
'use strict';

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.


// Use ordinary array, since untyped makes no boost here
function makeTable() {
  var c, table = [];

  for(var n =0; n < 256; n++){
    c = n;
    for(var k =0; k < 8; k++){
      c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();


function crc32(crc, buf, len, pos) {
  var t = crcTable
    , end = pos + len;

  crc = crc ^ (-1);

  for (var i = pos; i < end; i++ ) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
}


module.exports = crc32;
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/deflate.js":[function(require,module,exports){
'use strict';

var utils   = require('../utils/common');
var trees   = require('./trees');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var msg   = require('./messages');

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
var Z_NO_FLUSH      = 0;
var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
//var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
//var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
//var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;


/* compression levels */
//var Z_NO_COMPRESSION      = 0;
//var Z_BEST_SPEED          = 1;
//var Z_BEST_COMPRESSION    = 9;
var Z_DEFAULT_COMPRESSION = -1;


var Z_FILTERED            = 1;
var Z_HUFFMAN_ONLY        = 2;
var Z_RLE                 = 3;
var Z_FIXED               = 4;
var Z_DEFAULT_STRATEGY    = 0;

/* Possible values of the data_type field (though see inflate()) */
//var Z_BINARY              = 0;
//var Z_TEXT                = 1;
//var Z_ASCII               = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;


/* The deflate compression method */
var Z_DEFLATED  = 8;

/*============================================================================*/


var MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_MEM_LEVEL = 8;


var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
var LITERALS      = 256;
/* number of literal bytes 0..255 */
var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
var D_CODES       = 30;
/* number of distance codes */
var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
var HEAP_SIZE     = 2*L_CODES + 1;
/* maximum heap size */
var MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

var PRESET_DICT = 0x20;

var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;

var BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
var BS_BLOCK_DONE     = 2; /* block flush performed */
var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
var BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

function err(strm, errorCode) {
  strm.msg = msg[errorCode];
  return errorCode;
}

function rank(f) {
  return ((f) << 1) - ((f) > 4 ? 9 : 0);
}

function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }


/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm) {
  var s = strm.state;

  //_tr_flush_bits(s);
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}


function flush_block_only (s, last) {
  trees._tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}


function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB(s, b) {
//  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
}


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  utils.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
}


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;      /* max hash chain length */
  var scan = s.strstart; /* current string */
  var match;                       /* matched string */
  var len;                           /* length of current match */
  var best_len = s.prev_length;              /* best match length so far */
  var nice_match = s.nice_match;             /* stop if match long enough */
  var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  var _win = s.window; // shortcut

  var wmask = s.w_mask;
  var prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  var strend = s.strstart + MAX_MATCH;
  var scan_end1  = _win[scan + best_len - 1];
  var scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = (m >= _w_size ? m - _w_size : 0);
      } while (--n);

      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH-1]) & s.hash_mask;

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    var curr = s.strstart + s.lookahead;
//    var init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush) {
  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  var max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
//      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
//        s.block_start >= s.w_size)) {
//        throw  new Error("slide too late");
//      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
//    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    var max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/


    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush) {
  var hash_head;        /* head of the hash chain */
  var bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH-1)) ? s.strstart : MIN_MATCH-1);
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush) {
  var hash_head;          /* head of hash chain */
  var bflush;              /* set if current block must be flushed */

  var max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH-1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size-MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH-1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = trees._tr_tally(s, s.strstart - 1- s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length-1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH-1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart-1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart-1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH-1 ? s.strstart : MIN_MATCH-1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
}


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush) {
  var bflush;            /* set if current block must be flushed */
  var prev;              /* byte at distance one to match */
  var scan, strend;      /* scan goes up to strend for length of run */

  var _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush) {
  var bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
var Config = function (good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
};

var configuration_table;

configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init(s) {
  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new utils.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree  = new utils.Buf16((2*D_CODES+1) * 2);
  this.bl_tree    = new utils.Buf16((2*BL_CODES+1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new utils.Buf16(MAX_BITS+1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new utils.Buf16(2*L_CODES+1);  /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new utils.Buf16(2*L_CODES+1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0;          /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0;      /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


function deflateResetKeep(strm) {
  var s;

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH;
  trees._tr_init(s);
  return Z_OK;
}


function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
}


function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  if (strm.state.wrap !== 2) { return Z_STREAM_ERROR; }
  strm.state.gzhead = head;
  return Z_OK;
}


function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR;
  }
  var wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  var s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new utils.Buf8(s.w_size * 2);
  s.head = new utils.Buf16(s.hash_size);
  s.prev = new utils.Buf16(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new utils.Buf8(s.pending_buf_size);

  s.d_buf = s.lit_bufsize >> 1;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
}

function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
}


function deflate(strm, flush) {
  var old_flush, s;
  var beg, val; // for gzip header write only

  if (!strm || !strm.state ||
    flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }

  s = strm.state;

  if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }

  s.strm = strm; /* just in case */
  old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) { // GZIP header
      strm.adler = 0;  //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) { // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      }
      else {
        put_byte(s, (s.gzhead.text ? 1 : 0) +
                    (s.gzhead.hcrc ? 2 : 0) +
                    (!s.gzhead.extra ? 0 : 4) +
                    (!s.gzhead.name ? 0 : 8) +
                    (!s.gzhead.comment ? 0 : 16)
                );
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, (s.gzhead.time >> 8) & 0xff);
        put_byte(s, (s.gzhead.time >> 16) & 0xff);
        put_byte(s, (s.gzhead.time >> 24) & 0xff);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    else // DEFLATE header
    {
      var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8;
      var level_flags = -1;

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= (level_flags << 6);
      if (s.strstart !== 0) { header |= PRESET_DICT; }
      header += 31 - (header % 31);

      s.status = BUSY_STATE;
      putShortMSB(s, header);

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
      }
      strm.adler = 1; // adler32(0L, Z_NULL, 0);
    }
  }

//#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */

      while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    }
    else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg){
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    }
    else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    }
    else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >> 8) & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    }
    else {
      s.status = BUSY_STATE;
    }
  }
//#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
    var bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
      (s.strategy === Z_RLE ? deflate_rle(s, flush) :
        configuration_table[s.level].func(s, flush));

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      }
      else if (flush !== Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */

        trees._tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH) { return Z_OK; }
  if (s.wrap <= 0) { return Z_STREAM_END; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK : Z_STREAM_END;
}

function deflateEnd(strm) {
  var status;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  status = strm.state.status;
  if (status !== INIT_STATE &&
    status !== EXTRA_STATE &&
    status !== NAME_STATE &&
    status !== COMMENT_STATE &&
    status !== HCRC_STATE &&
    status !== BUSY_STATE &&
    status !== FINISH_STATE
  ) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
}

/* =========================================================================
 * Copy the source state to the destination state
 */
//function deflateCopy(dest, source) {
//
//}

exports.deflateInit = deflateInit;
exports.deflateInit2 = deflateInit2;
exports.deflateReset = deflateReset;
exports.deflateResetKeep = deflateResetKeep;
exports.deflateSetHeader = deflateSetHeader;
exports.deflate = deflate;
exports.deflateEnd = deflateEnd;
exports.deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
exports.deflateBound = deflateBound;
exports.deflateCopy = deflateCopy;
exports.deflateSetDictionary = deflateSetDictionary;
exports.deflateParams = deflateParams;
exports.deflatePending = deflatePending;
exports.deflatePrime = deflatePrime;
exports.deflateTune = deflateTune;
*/
},{"../utils/common":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/utils/common.js","./adler32":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/adler32.js","./crc32":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/crc32.js","./messages":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/messages.js","./trees":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/trees.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inffast.js":[function(require,module,exports){
'use strict';

// See state defs from inflate.js
var BAD = 30;       /* got a data error -- remain here until reset */
var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
module.exports = function inflate_fast(strm, start) {
  var state;
  var _in;                    /* local strm.input */
  var last;                   /* have enough input while in < last */
  var _out;                   /* local strm.output */
  var beg;                    /* inflate()'s initial strm.output */
  var end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  var dmax;                   /* maximum distance from zlib header */
//#endif
  var wsize;                  /* window size or zero if not using window */
  var whave;                  /* valid bytes in the window */
  var wnext;                  /* window write index */
  var window;                 /* allocated sliding window, if wsize != 0 */
  var hold;                   /* local strm.hold */
  var bits;                   /* local strm.bits */
  var lcode;                  /* local strm.lencode */
  var dcode;                  /* local strm.distcode */
  var lmask;                  /* mask for first level of length codes */
  var dmask;                  /* mask for first level of distance codes */
  var here;                   /* retrieved table entry */
  var op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  var len;                    /* match length, unused bytes */
  var dist;                   /* match distance */
  var from;                   /* where to copy match from */
  var from_source;


  var input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD;
                  break top;
                }

// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inflate.js":[function(require,module,exports){
'use strict';


var utils = require('../utils/common');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var inflate_fast = require('./inffast');
var inflate_table = require('./inftrees');

var CODES = 0;
var LENS = 1;
var DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED  = 8;


/* STATES ====================================================================*/
/* ===========================================================================*/


var    HEAD = 1;       /* i: waiting for magic header */
var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
var    TIME = 3;       /* i: waiting for modification time (gzip) */
var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
var    NAME = 7;       /* i: waiting for end of file name (gzip) */
var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
var    HCRC = 9;       /* i: waiting for header crc (gzip) */
var    DICTID = 10;    /* i: waiting for dictionary check value */
var    DICT = 11;      /* waiting for inflateSetDictionary() call */
var        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
var        STORED = 14;    /* i: waiting for stored size (length and complement) */
var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
var        LENLENS = 18;   /* i: waiting for code length code lengths */
var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
var            LEN = 21;       /* i: waiting for length/lit/eob code */
var            LENEXT = 22;    /* i: waiting for length extra bits */
var            DIST = 23;      /* i: waiting for distance code */
var            DISTEXT = 24;   /* i: waiting for distance extra bits */
var            MATCH = 25;     /* o: waiting for output space to copy string */
var            LIT = 26;       /* o: waiting for output space to write literal */
var    CHECK = 27;     /* i: waiting for 32-bit check value */
var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
var    DONE = 29;      /* finished check, done -- remain here until reset */
var    BAD = 30;       /* got a data error -- remain here until reset */
var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;


function ZSWAP32(q) {
  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
}


function InflateState() {
  this.mode = 0;             /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib) */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
  this.work = new utils.Buf16(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}

function inflateResetKeep(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK;
}

function inflateReset(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

}

function inflateReset2(strm, windowBits) {
  var wrap;
  var state;

  /* get the state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
  var ret;
  var state;

  if (!strm) { return Z_STREAM_ERROR; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null/*Z_NULL*/;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
}

function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    var sym;

    lenfix = new utils.Buf32(512);
    distfix = new utils.Buf32(32);

    /* literal/length table */
    sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inflate_table(LENS,  state.lens, 0, 288, lenfix,   0, state.work, {bits: 9});

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inflate_table(DISTS, state.lens, 0, 32,   distfix, 0, state.work, {bits: 5});

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new utils.Buf8(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    utils.arraySet(state.window,src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    utils.arraySet(state.window,src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      utils.arraySet(state.window,src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
}

function inflate(strm, flush) {
  var state;
  var input, output;          // input/output buffers
  var next;                   /* next input INDEX */
  var put;                    /* next output INDEX */
  var have, left;             /* available input and output */
  var hold;                   /* bit buffer */
  var bits;                   /* bits in bit buffer */
  var _in, _out;              /* save starting available input and output */
  var copy;                   /* number of stored or match bytes to copy */
  var from;                   /* where to copy match bytes from */
  var from_source;
  var here = 0;               /* current decoding table entry */
  var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //var last;                   /* parent table entry */
  var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  var len;                    /* length to copy for repeats, bits to drop */
  var ret;                    /* return code */
  var hbuf = new utils.Buf8(4);    /* buffer for gzip header crc calculation */
  var opts;

  var n; // temporary var for NEED_BITS

  var order = /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];


  if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
    case HEAD:
      if (state.wrap === 0) {
        state.mode = TYPEDO;
        break;
      }
      //=== NEEDBITS(16);
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
        state.check = 0/*crc32(0L, Z_NULL, 0)*/;
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//

        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = FLAGS;
        break;
      }
      state.flags = 0;           /* expect zlib header */
      if (state.head) {
        state.head.done = false;
      }
      if (!(state.wrap & 1) ||   /* check if zlib header allowed */
        (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
        strm.msg = 'incorrect header check';
        state.mode = BAD;
        break;
      }
      if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
        strm.msg = 'unknown compression method';
        state.mode = BAD;
        break;
      }
      //--- DROPBITS(4) ---//
      hold >>>= 4;
      bits -= 4;
      //---//
      len = (hold & 0x0f)/*BITS(4)*/ + 8;
      if (state.wbits === 0) {
        state.wbits = len;
      }
      else if (len > state.wbits) {
        strm.msg = 'invalid window size';
        state.mode = BAD;
        break;
      }
      state.dmax = 1 << len;
      //Tracev((stderr, "inflate:   zlib header ok\n"));
      strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
      state.mode = hold & 0x200 ? DICTID : TYPE;
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      break;
    case FLAGS:
      //=== NEEDBITS(16); */
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.flags = hold;
      if ((state.flags & 0xff) !== Z_DEFLATED) {
        strm.msg = 'unknown compression method';
        state.mode = BAD;
        break;
      }
      if (state.flags & 0xe000) {
        strm.msg = 'unknown header flags set';
        state.mode = BAD;
        break;
      }
      if (state.head) {
        state.head.text = ((hold >> 8) & 1);
      }
      if (state.flags & 0x0200) {
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = TIME;
      /* falls through */
    case TIME:
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if (state.head) {
        state.head.time = hold;
      }
      if (state.flags & 0x0200) {
        //=== CRC4(state.check, hold)
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        hbuf[2] = (hold >>> 16) & 0xff;
        hbuf[3] = (hold >>> 24) & 0xff;
        state.check = crc32(state.check, hbuf, 4, 0);
        //===
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = OS;
      /* falls through */
    case OS:
      //=== NEEDBITS(16); */
      while (bits < 16) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if (state.head) {
        state.head.xflags = (hold & 0xff);
        state.head.os = (hold >> 8);
      }
      if (state.flags & 0x0200) {
        //=== CRC2(state.check, hold);
        hbuf[0] = hold & 0xff;
        hbuf[1] = (hold >>> 8) & 0xff;
        state.check = crc32(state.check, hbuf, 2, 0);
        //===//
      }
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = EXLEN;
      /* falls through */
    case EXLEN:
      if (state.flags & 0x0400) {
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.length = hold;
        if (state.head) {
          state.head.extra_len = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
      }
      else if (state.head) {
        state.head.extra = null/*Z_NULL*/;
      }
      state.mode = EXTRA;
      /* falls through */
    case EXTRA:
      if (state.flags & 0x0400) {
        copy = state.length;
        if (copy > have) { copy = have; }
        if (copy) {
          if (state.head) {
            len = state.head.extra_len - state.length;
            if (!state.head.extra) {
              // Use untyped array for more conveniend processing later
              state.head.extra = new Array(state.head.extra_len);
            }
            utils.arraySet(
              state.head.extra,
              input,
              next,
              // extra field is limited to 65536 bytes
              // - no need for additional size check
              copy,
              /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
              len
            );
            //zmemcpy(state.head.extra + len, next,
            //        len + copy > state.head.extra_max ?
            //        state.head.extra_max - len : copy);
          }
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          state.length -= copy;
        }
        if (state.length) { break inf_leave; }
      }
      state.length = 0;
      state.mode = NAME;
      /* falls through */
    case NAME:
      if (state.flags & 0x0800) {
        if (have === 0) { break inf_leave; }
        copy = 0;
        do {
          // TODO: 2 or 1 bytes?
          len = input[next + copy++];
          /* use constant limit because in js we should not preallocate memory */
          if (state.head && len &&
              (state.length < 65536 /*state.head.name_max*/)) {
            state.head.name += String.fromCharCode(len);
          }
        } while (len && copy < have);

        if (state.flags & 0x0200) {
          state.check = crc32(state.check, input, copy, next);
        }
        have -= copy;
        next += copy;
        if (len) { break inf_leave; }
      }
      else if (state.head) {
        state.head.name = null;
      }
      state.length = 0;
      state.mode = COMMENT;
      /* falls through */
    case COMMENT:
      if (state.flags & 0x1000) {
        if (have === 0) { break inf_leave; }
        copy = 0;
        do {
          len = input[next + copy++];
          /* use constant limit because in js we should not preallocate memory */
          if (state.head && len &&
              (state.length < 65536 /*state.head.comm_max*/)) {
            state.head.comment += String.fromCharCode(len);
          }
        } while (len && copy < have);
        if (state.flags & 0x0200) {
          state.check = crc32(state.check, input, copy, next);
        }
        have -= copy;
        next += copy;
        if (len) { break inf_leave; }
      }
      else if (state.head) {
        state.head.comment = null;
      }
      state.mode = HCRC;
      /* falls through */
    case HCRC:
      if (state.flags & 0x0200) {
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (hold !== (state.check & 0xffff)) {
          strm.msg = 'header crc mismatch';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
      }
      if (state.head) {
        state.head.hcrc = ((state.flags >> 9) & 1);
        state.head.done = true;
      }
      strm.adler = state.check = 0 /*crc32(0L, Z_NULL, 0)*/;
      state.mode = TYPE;
      break;
    case DICTID:
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      strm.adler = state.check = ZSWAP32(hold);
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = DICT;
      /* falls through */
    case DICT:
      if (state.havedict === 0) {
        //--- RESTORE() ---
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        //---
        return Z_NEED_DICT;
      }
      strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
      state.mode = TYPE;
      /* falls through */
    case TYPE:
      if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case TYPEDO:
      if (state.last) {
        //--- BYTEBITS() ---//
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        state.mode = CHECK;
        break;
      }
      //=== NEEDBITS(3); */
      while (bits < 3) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.last = (hold & 0x01)/*BITS(1)*/;
      //--- DROPBITS(1) ---//
      hold >>>= 1;
      bits -= 1;
      //---//

      switch ((hold & 0x03)/*BITS(2)*/) {
      case 0:                             /* stored block */
        //Tracev((stderr, "inflate:     stored block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = STORED;
        break;
      case 1:                             /* fixed block */
        fixedtables(state);
        //Tracev((stderr, "inflate:     fixed codes block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = LEN_;             /* decode codes */
        if (flush === Z_TREES) {
          //--- DROPBITS(2) ---//
          hold >>>= 2;
          bits -= 2;
          //---//
          break inf_leave;
        }
        break;
      case 2:                             /* dynamic block */
        //Tracev((stderr, "inflate:     dynamic codes block%s\n",
        //        state.last ? " (last)" : ""));
        state.mode = TABLE;
        break;
      case 3:
        strm.msg = 'invalid block type';
        state.mode = BAD;
      }
      //--- DROPBITS(2) ---//
      hold >>>= 2;
      bits -= 2;
      //---//
      break;
    case STORED:
      //--- BYTEBITS() ---// /* go to byte boundary */
      hold >>>= bits & 7;
      bits -= bits & 7;
      //---//
      //=== NEEDBITS(32); */
      while (bits < 32) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
        strm.msg = 'invalid stored block lengths';
        state.mode = BAD;
        break;
      }
      state.length = hold & 0xffff;
      //Tracev((stderr, "inflate:       stored length %u\n",
      //        state.length));
      //=== INITBITS();
      hold = 0;
      bits = 0;
      //===//
      state.mode = COPY_;
      if (flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case COPY_:
      state.mode = COPY;
      /* falls through */
    case COPY:
      copy = state.length;
      if (copy) {
        if (copy > have) { copy = have; }
        if (copy > left) { copy = left; }
        if (copy === 0) { break inf_leave; }
        //--- zmemcpy(put, next, copy); ---
        utils.arraySet(output, input, next, copy, put);
        //---//
        have -= copy;
        next += copy;
        left -= copy;
        put += copy;
        state.length -= copy;
        break;
      }
      //Tracev((stderr, "inflate:       stored end\n"));
      state.mode = TYPE;
      break;
    case TABLE:
      //=== NEEDBITS(14); */
      while (bits < 14) {
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
      }
      //===//
      state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
      //--- DROPBITS(5) ---//
      hold >>>= 5;
      bits -= 5;
      //---//
      state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
      //--- DROPBITS(5) ---//
      hold >>>= 5;
      bits -= 5;
      //---//
      state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
      //--- DROPBITS(4) ---//
      hold >>>= 4;
      bits -= 4;
      //---//
//#ifndef PKZIP_BUG_WORKAROUND
      if (state.nlen > 286 || state.ndist > 30) {
        strm.msg = 'too many length or distance symbols';
        state.mode = BAD;
        break;
      }
//#endif
      //Tracev((stderr, "inflate:       table sizes ok\n"));
      state.have = 0;
      state.mode = LENLENS;
      /* falls through */
    case LENLENS:
      while (state.have < state.ncode) {
        //=== NEEDBITS(3);
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
        //--- DROPBITS(3) ---//
        hold >>>= 3;
        bits -= 3;
        //---//
      }
      while (state.have < 19) {
        state.lens[order[state.have++]] = 0;
      }
      // We have separate tables & no pointers. 2 commented lines below not needed.
      //state.next = state.codes;
      //state.lencode = state.next;
      // Switch to use dynamic table
      state.lencode = state.lendyn;
      state.lenbits = 7;

      opts = {bits: state.lenbits};
      ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
      state.lenbits = opts.bits;

      if (ret) {
        strm.msg = 'invalid code lengths set';
        state.mode = BAD;
        break;
      }
      //Tracev((stderr, "inflate:       code lengths ok\n"));
      state.have = 0;
      state.mode = CODELENS;
      /* falls through */
    case CODELENS:
      while (state.have < state.nlen + state.ndist) {
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_val < 16) {
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.lens[state.have++] = here_val;
        }
        else {
          if (here_val === 16) {
            //=== NEEDBITS(here.bits + 2);
            n = here_bits + 2;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            if (state.have === 0) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            len = state.lens[state.have - 1];
            copy = 3 + (hold & 0x03);//BITS(2);
            //--- DROPBITS(2) ---//
            hold >>>= 2;
            bits -= 2;
            //---//
          }
          else if (here_val === 17) {
            //=== NEEDBITS(here.bits + 3);
            n = here_bits + 3;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            len = 0;
            copy = 3 + (hold & 0x07);//BITS(3);
            //--- DROPBITS(3) ---//
            hold >>>= 3;
            bits -= 3;
            //---//
          }
          else {
            //=== NEEDBITS(here.bits + 7);
            n = here_bits + 7;
            while (bits < n) {
              if (have === 0) { break inf_leave; }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            len = 0;
            copy = 11 + (hold & 0x7f);//BITS(7);
            //--- DROPBITS(7) ---//
            hold >>>= 7;
            bits -= 7;
            //---//
          }
          if (state.have + copy > state.nlen + state.ndist) {
            strm.msg = 'invalid bit length repeat';
            state.mode = BAD;
            break;
          }
          while (copy--) {
            state.lens[state.have++] = len;
          }
        }
      }

      /* handle error breaks in while */
      if (state.mode === BAD) { break; }

      /* check for end-of-block code (better have one) */
      if (state.lens[256] === 0) {
        strm.msg = 'invalid code -- missing end-of-block';
        state.mode = BAD;
        break;
      }

      /* build code tables -- note: do not change the lenbits or distbits
         values here (9 and 6) without reading the comments in inftrees.h
         concerning the ENOUGH constants, which depend on those values */
      state.lenbits = 9;

      opts = {bits: state.lenbits};
      ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
      // We have separate tables & no pointers. 2 commented lines below not needed.
      // state.next_index = opts.table_index;
      state.lenbits = opts.bits;
      // state.lencode = state.next;

      if (ret) {
        strm.msg = 'invalid literal/lengths set';
        state.mode = BAD;
        break;
      }

      state.distbits = 6;
      //state.distcode.copy(state.codes);
      // Switch to use dynamic table
      state.distcode = state.distdyn;
      opts = {bits: state.distbits};
      ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
      // We have separate tables & no pointers. 2 commented lines below not needed.
      // state.next_index = opts.table_index;
      state.distbits = opts.bits;
      // state.distcode = state.next;

      if (ret) {
        strm.msg = 'invalid distances set';
        state.mode = BAD;
        break;
      }
      //Tracev((stderr, 'inflate:       codes ok\n'));
      state.mode = LEN_;
      if (flush === Z_TREES) { break inf_leave; }
      /* falls through */
    case LEN_:
      state.mode = LEN;
      /* falls through */
    case LEN:
      if (have >= 6 && left >= 258) {
        //--- RESTORE() ---
        strm.next_out = put;
        strm.avail_out = left;
        strm.next_in = next;
        strm.avail_in = have;
        state.hold = hold;
        state.bits = bits;
        //---
        inflate_fast(strm, _out);
        //--- LOAD() ---
        put = strm.next_out;
        output = strm.output;
        left = strm.avail_out;
        next = strm.next_in;
        input = strm.input;
        have = strm.avail_in;
        hold = state.hold;
        bits = state.bits;
        //---

        if (state.mode === TYPE) {
          state.back = -1;
        }
        break;
      }
      state.back = 0;
      for (;;) {
        here = state.lencode[hold & ((1 << state.lenbits) -1)];  /*BITS(state.lenbits)*/
        here_bits = here >>> 24;
        here_op = (here >>> 16) & 0xff;
        here_val = here & 0xffff;

        if (here_bits <= bits) { break; }
        //--- PULLBYTE() ---//
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
        //---//
      }
      if (here_op && (here_op & 0xf0) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (;;) {
          here = state.lencode[last_val +
                  ((hold & ((1 << (last_bits + last_op)) -1))/*BITS(last.bits + last.op)*/ >> last_bits)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((last_bits + here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        //--- DROPBITS(last.bits) ---//
        hold >>>= last_bits;
        bits -= last_bits;
        //---//
        state.back += last_bits;
      }
      //--- DROPBITS(here.bits) ---//
      hold >>>= here_bits;
      bits -= here_bits;
      //---//
      state.back += here_bits;
      state.length = here_val;
      if (here_op === 0) {
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        state.mode = LIT;
        break;
      }
      if (here_op & 32) {
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.back = -1;
        state.mode = TYPE;
        break;
      }
      if (here_op & 64) {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break;
      }
      state.extra = here_op & 15;
      state.mode = LENEXT;
      /* falls through */
    case LENEXT:
      if (state.extra) {
        //=== NEEDBITS(state.extra);
        n = state.extra;
        while (bits < n) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.length += hold & ((1 << state.extra) -1)/*BITS(state.extra)*/;
        //--- DROPBITS(state.extra) ---//
        hold >>>= state.extra;
        bits -= state.extra;
        //---//
        state.back += state.extra;
      }
      //Tracevv((stderr, "inflate:         length %u\n", state.length));
      state.was = state.length;
      state.mode = DIST;
      /* falls through */
    case DIST:
      for (;;) {
        here = state.distcode[hold & ((1 << state.distbits) -1)];/*BITS(state.distbits)*/
        here_bits = here >>> 24;
        here_op = (here >>> 16) & 0xff;
        here_val = here & 0xffff;

        if ((here_bits) <= bits) { break; }
        //--- PULLBYTE() ---//
        if (have === 0) { break inf_leave; }
        have--;
        hold += input[next++] << bits;
        bits += 8;
        //---//
      }
      if ((here_op & 0xf0) === 0) {
        last_bits = here_bits;
        last_op = here_op;
        last_val = here_val;
        for (;;) {
          here = state.distcode[last_val +
                  ((hold & ((1 << (last_bits + last_op)) -1))/*BITS(last.bits + last.op)*/ >> last_bits)];
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((last_bits + here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        //--- DROPBITS(last.bits) ---//
        hold >>>= last_bits;
        bits -= last_bits;
        //---//
        state.back += last_bits;
      }
      //--- DROPBITS(here.bits) ---//
      hold >>>= here_bits;
      bits -= here_bits;
      //---//
      state.back += here_bits;
      if (here_op & 64) {
        strm.msg = 'invalid distance code';
        state.mode = BAD;
        break;
      }
      state.offset = here_val;
      state.extra = (here_op) & 15;
      state.mode = DISTEXT;
      /* falls through */
    case DISTEXT:
      if (state.extra) {
        //=== NEEDBITS(state.extra);
        n = state.extra;
        while (bits < n) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.offset += hold & ((1 << state.extra) -1)/*BITS(state.extra)*/;
        //--- DROPBITS(state.extra) ---//
        hold >>>= state.extra;
        bits -= state.extra;
        //---//
        state.back += state.extra;
      }
//#ifdef INFLATE_STRICT
      if (state.offset > state.dmax) {
        strm.msg = 'invalid distance too far back';
        state.mode = BAD;
        break;
      }
//#endif
      //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
      state.mode = MATCH;
      /* falls through */
    case MATCH:
      if (left === 0) { break inf_leave; }
      copy = _out - left;
      if (state.offset > copy) {         /* copy from window */
        copy = state.offset - copy;
        if (copy > state.whave) {
          if (state.sane) {
            strm.msg = 'invalid distance too far back';
            state.mode = BAD;
            break;
          }
// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
        }
        if (copy > state.wnext) {
          copy -= state.wnext;
          from = state.wsize - copy;
        }
        else {
          from = state.wnext - copy;
        }
        if (copy > state.length) { copy = state.length; }
        from_source = state.window;
      }
      else {                              /* copy from output */
        from_source = output;
        from = put - state.offset;
        copy = state.length;
      }
      if (copy > left) { copy = left; }
      left -= copy;
      state.length -= copy;
      do {
        output[put++] = from_source[from++];
      } while (--copy);
      if (state.length === 0) { state.mode = LEN; }
      break;
    case LIT:
      if (left === 0) { break inf_leave; }
      output[put++] = state.length;
      left--;
      state.mode = LEN;
      break;
    case CHECK:
      if (state.wrap) {
        //=== NEEDBITS(32);
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          // Use '|' insdead of '+' to make sure that result is signed
          hold |= input[next++] << bits;
          bits += 8;
        }
        //===//
        _out -= left;
        strm.total_out += _out;
        state.total += _out;
        if (_out) {
          strm.adler = state.check =
              /*UPDATE(state.check, put - _out, _out);*/
              (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

        }
        _out = left;
        // NB: crc32 stored as signed 32-bit int, ZSWAP32 returns signed too
        if ((state.flags ? hold : ZSWAP32(hold)) !== state.check) {
          strm.msg = 'incorrect data check';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        //Tracev((stderr, "inflate:   check matches trailer\n"));
      }
      state.mode = LENGTH;
      /* falls through */
    case LENGTH:
      if (state.wrap && state.flags) {
        //=== NEEDBITS(32);
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (hold !== (state.total & 0xffffffff)) {
          strm.msg = 'incorrect length check';
          state.mode = BAD;
          break;
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        //Tracev((stderr, "inflate:   length matches trailer\n"));
      }
      state.mode = DONE;
      /* falls through */
    case DONE:
      ret = Z_STREAM_END;
      break inf_leave;
    case BAD:
      ret = Z_DATA_ERROR;
      break inf_leave;
    case MEM:
      return Z_MEM_ERROR;
    case SYNC:
      /* falls through */
    default:
      return Z_STREAM_ERROR;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}

function inflateEnd(strm) {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
    return Z_STREAM_ERROR;
  }

  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}

function inflateGetHeader(strm, head) {
  var state;

  /* check state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK;
}


exports.inflateReset = inflateReset;
exports.inflateReset2 = inflateReset2;
exports.inflateResetKeep = inflateResetKeep;
exports.inflateInit = inflateInit;
exports.inflateInit2 = inflateInit2;
exports.inflate = inflate;
exports.inflateEnd = inflateEnd;
exports.inflateGetHeader = inflateGetHeader;
exports.inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
exports.inflateCopy = inflateCopy;
exports.inflateGetDictionary = inflateGetDictionary;
exports.inflateMark = inflateMark;
exports.inflatePrime = inflatePrime;
exports.inflateSetDictionary = inflateSetDictionary;
exports.inflateSync = inflateSync;
exports.inflateSyncPoint = inflateSyncPoint;
exports.inflateUndermine = inflateUndermine;
*/
},{"../utils/common":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/utils/common.js","./adler32":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/adler32.js","./crc32":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/crc32.js","./inffast":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inffast.js","./inftrees":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inftrees.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inftrees.js":[function(require,module,exports){
'use strict';


var utils = require('../utils/common');

var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
];

var lext = [ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
];

var dbase = [ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
];

var dext = [ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
];

module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
{
  var bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  var len = 0;               /* a code's length in bits */
  var sym = 0;               /* index of code symbols */
  var min = 0, max = 0;          /* minimum and maximum code lengths */
  var root = 0;              /* number of index bits for root table */
  var curr = 0;              /* number of index bits for current table */
  var drop = 0;              /* code bits to drop for sub-table */
  var left = 0;                   /* number of prefix codes available */
  var used = 0;              /* code entries in table used */
  var huff = 0;              /* Huffman code */
  var incr;              /* for incrementing code, index */
  var fill;              /* index for replicating entries */
  var low;               /* low bits for current root entry */
  var mask;              /* mask for low root bits */
  var next;             /* next available space in table */
  var base = null;     /* base value table to use */
  var base_index = 0;
//  var shoextra;    /* extra bits table to use */
  var end;                    /* use base and extra for symbol > end */
  var count = new utils.Buf16(MAXBITS+1); //[MAXBITS+1];    /* number of codes of each length */
  var offs = new utils.Buf16(MAXBITS+1); //[MAXBITS+1];     /* offsets in table for each length */
  var extra = null;
  var extra_index = 0;

  var here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES) {
      base = extra = work;    /* dummy value--not used */
      end = 19;
  } else if (type === LENS) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;
  } else {                    /* DISTS */
      base = dbase;
      extra = dext;
      end = -1;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS && used > ENOUGH_LENS) ||
    (type === DISTS && used > ENOUGH_DISTS)) {
    return 1;
  }

  var i=0;
  /* process all codes and make table entries */
  for (;;) {
    i++;
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS && used > ENOUGH_LENS) ||
        (type === DISTS && used > ENOUGH_DISTS)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};

},{"../utils/common":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/utils/common.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/messages.js":[function(require,module,exports){
'use strict';

module.exports = {
  '2':    'need dictionary',     /* Z_NEED_DICT       2  */
  '1':    'stream end',          /* Z_STREAM_END      1  */
  '0':    '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/trees.js":[function(require,module,exports){
'use strict';


var utils = require('../utils/common');

/* Public constants ==========================================================*/
/* ===========================================================================*/


//var Z_FILTERED          = 1;
//var Z_HUFFMAN_ONLY      = 2;
//var Z_RLE               = 3;
var Z_FIXED               = 4;
//var Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
var Z_BINARY              = 0;
var Z_TEXT                = 1;
//var Z_ASCII             = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;

/*============================================================================*/


function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES    = 2;
/* The three kinds of block type */

var MIN_MATCH    = 3;
var MAX_MATCH    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS      = 256;
/* number of literal bytes 0..255 */

var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES       = 30;
/* number of distance codes */

var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE     = 2*L_CODES + 1;
/* maximum heap size */

var MAX_BITS      = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK   = 256;
/* end of block literal code */

var REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

var extra_lbits =   /* extra bits for each length code */
  [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];

var extra_dbits =   /* extra bits for each distance code */
  [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

var extra_blbits =  /* extra bits for each bit length code */
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];

var bl_order =
  [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array insdead of structure, Freq = i*2, Len = i*2+1
var static_ltree  = new Array((L_CODES+2) * 2);
zero(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

var static_dtree  = new Array(D_CODES * 2);
zero(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

var _dist_code    = new Array(DIST_CODE_LEN);
zero(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

var _length_code  = new Array(MAX_MATCH-MIN_MATCH+1);
zero(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

var base_length   = new Array(LENGTH_CODES);
zero(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

var base_dist     = new Array(D_CODES);
zero(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


var StaticTreeDesc = function (static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
};


var static_l_desc;
var static_d_desc;
var static_bl_desc;


var TreeDesc = function(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
};



function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short (s, w) {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
}


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
function send_bits(s, value, length) {
  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
}


function send_code(s, c, tree) {
  send_bits(s, tree[c*2]/*.Code*/, tree[c*2 + 1]/*.Len*/);
}


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  var tree            = desc.dyn_tree;
  var max_code        = desc.max_code;
  var stree           = desc.stat_desc.static_tree;
  var has_stree       = desc.stat_desc.has_stree;
  var extra           = desc.stat_desc.extra_bits;
  var base            = desc.stat_desc.extra_base;
  var max_length      = desc.stat_desc.max_length;
  var h;              /* heap index */
  var n, m;           /* iterate over the tree elements */
  var bits;           /* bit length */
  var xbits;          /* extra bits */
  var f;              /* frequency */
  var overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max]*2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max+1; h < HEAP_SIZE; h++) {
    n = s.heap[h];
    bits = tree[tree[n*2 +1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n*2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n-base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n*2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length-1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits+1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m*2 + 1]/*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m*2 + 1]/*.Len*/)*tree[m*2]/*.Freq*/;
        tree[m*2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
}


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes(tree, max_code, bl_count)
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  var next_code = new Array(MAX_BITS+1); /* next code value for each bit length */
  var code = 0;              /* running code value */
  var bits;                  /* bit index */
  var n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = (code + bl_count[bits-1]) << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    var len = tree[n*2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n*2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
function tr_static_init() {
  var n;        /* iterates over tree elements */
  var bits;     /* bit counter */
  var length;   /* length value */
  var code;     /* code value */
  var dist;     /* distance index */
  var bl_count = new Array(MAX_BITS+1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES-1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1<<extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length-1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0 ; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1<<extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for ( ; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1<<(extra_dbits[code]-7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n*2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n*2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n*2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n*2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES+1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n*2 + 1]/*.Len*/ = 5;
    static_dtree[n*2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS+1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES, MAX_BITS);
  static_bl_desc =new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES, MAX_BL_BITS);

  //static_init_done = true;
}


/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s) {
  var n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES;  n++) { s.dyn_ltree[n*2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES;  n++) { s.dyn_dtree[n*2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES; n++) { s.bl_tree[n*2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK*2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s)
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s);        /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
//  while (len--) {
//    put_byte(s, *buf++);
//  }
  utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth) {
  var _n2 = n*2;
  var _m2 = m*2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  var v = s.heap[k];
  var j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j+1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
}


// inlined manually
// var SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  var dist;           /* distance of matched string */
  var lc;             /* match length or unmatched char (if dist == 0) */
  var lx = 0;         /* running index in l_buf */
  var code;           /* the code to send */
  var extra;          /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = (s.pending_buf[s.d_buf + lx*2] << 8) | (s.pending_buf[s.d_buf + lx*2 + 1]);
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code+LITERALS+1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");

    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
}


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  var tree     = desc.dyn_tree;
  var stree    = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems    = desc.stat_desc.elems;
  var n, m;          /* iterate over heap elements */
  var max_code = -1; /* largest code with non zero frequency */
  var node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n*2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node*2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n*2 + 1]/*.Dad*/ = tree[m*2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
}


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0*2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code+1)*2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n+1)*2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6*2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10*2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138*2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0*2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n+1)*2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count-3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count-3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count-11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s) {
  var max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES-1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex]*2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3*(max_blindex+1) + 5+5+4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
}


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  var rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes-257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes-1,   5);
  send_bits(s, blcodes-4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank]*2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes-1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes-1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s) {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  var black_mask = 0xf3ffc07f;
  var n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if ((black_mask & 1) && (s.dyn_ltree[n*2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
}


var static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s)
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
}


/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK<<1)+(last ? 1 : 0), 3);    /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
}


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s) {
  send_bits(s, STATIC_TREES<<1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  var opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  var max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len+3+7) >>> 3;
    static_lenb = (s.static_len+3+7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len+4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES<<1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES<<1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code+1, s.d_desc.max_code+1, max_blindex+1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally(s, dist, lc)
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //var out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc*2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc]+LITERALS+1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

// (!) This block is disabled in zlib defailts,
// don't enable it for binary compatibility

//#ifdef TRUNCATE_BLOCK
//  /* Try to guess if it is profitable to stop the current block here */
//  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
//    /* Compute an upper bound for the compressed length */
//    out_length = s.last_lit*8;
//    in_length = s.strstart - s.block_start;
//
//    for (dcode = 0; dcode < D_CODES; dcode++) {
//      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
//    }
//    out_length >>>= 3;
//    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//    //       s->last_lit, in_length, out_length,
//    //       100L - out_length*100L/in_length));
//    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
//      return true;
//    }
//  }
//#endif

  return (s.last_lit === s.lit_bufsize-1);
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
}

exports._tr_init  = _tr_init;
exports._tr_stored_block = _tr_stored_block;
exports._tr_flush_block  = _tr_flush_block;
exports._tr_tally = _tr_tally;
exports._tr_align = _tr_align;
},{"../utils/common":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/utils/common.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/zstream.js":[function(require,module,exports){
'use strict';


function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

module.exports = ZStream;
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/src/binding.js":[function(require,module,exports){
(function (process,Buffer){
var msg = require('pako/lib/zlib/messages');
var zstream = require('pako/lib/zlib/zstream');
var zlib_deflate = require('pako/lib/zlib/deflate.js');
var zlib_inflate = require('pako/lib/zlib/inflate.js');
var constants = require('pako/lib/zlib/constants');

for (var key in constants) {
  exports[key] = constants[key];
}

// zlib modes
exports.NONE = 0;
exports.DEFLATE = 1;
exports.INFLATE = 2;
exports.GZIP = 3;
exports.GUNZIP = 4;
exports.DEFLATERAW = 5;
exports.INFLATERAW = 6;
exports.UNZIP = 7;

/**
 * Emulate Node's zlib C++ layer for use by the JS layer in index.js
 */
function Zlib(mode) {
  if (mode < exports.DEFLATE || mode > exports.UNZIP)
    throw new TypeError("Bad argument");
    
  this.mode = mode;
  this.init_done = false;
  this.write_in_progress = false;
  this.pending_close = false;
  this.windowBits = 0;
  this.level = 0;
  this.memLevel = 0;
  this.strategy = 0;
  this.dictionary = null;
}

Zlib.prototype.init = function(windowBits, level, memLevel, strategy, dictionary) {
  this.windowBits = windowBits;
  this.level = level;
  this.memLevel = memLevel;
  this.strategy = strategy;
  // dictionary not supported.
  
  if (this.mode === exports.GZIP || this.mode === exports.GUNZIP)
    this.windowBits += 16;
    
  if (this.mode === exports.UNZIP)
    this.windowBits += 32;
    
  if (this.mode === exports.DEFLATERAW || this.mode === exports.INFLATERAW)
    this.windowBits = -this.windowBits;
    
  this.strm = new zstream();
  
  switch (this.mode) {
    case exports.DEFLATE:
    case exports.GZIP:
    case exports.DEFLATERAW:
      var status = zlib_deflate.deflateInit2(
        this.strm,
        this.level,
        exports.Z_DEFLATED,
        this.windowBits,
        this.memLevel,
        this.strategy
      );
      break;
    case exports.INFLATE:
    case exports.GUNZIP:
    case exports.INFLATERAW:
    case exports.UNZIP:
      var status  = zlib_inflate.inflateInit2(
        this.strm,
        this.windowBits
      );
      break;
    default:
      throw new Error("Unknown mode " + this.mode);
  }
  
  if (status !== exports.Z_OK) {
    this._error(status);
    return;
  }
  
  this.write_in_progress = false;
  this.init_done = true;
};

Zlib.prototype.params = function() {
  throw new Error("deflateParams Not supported");
};

Zlib.prototype._writeCheck = function() {
  if (!this.init_done)
    throw new Error("write before init");
    
  if (this.mode === exports.NONE)
    throw new Error("already finalized");
    
  if (this.write_in_progress)
    throw new Error("write already in progress");
    
  if (this.pending_close)
    throw new Error("close is pending");
};

Zlib.prototype.write = function(flush, input, in_off, in_len, out, out_off, out_len) {    
  this._writeCheck();
  this.write_in_progress = true;
  
  var self = this;
  process.nextTick(function() {
    self.write_in_progress = false;
    var res = self._write(flush, input, in_off, in_len, out, out_off, out_len);
    self.callback(res[0], res[1]);
    
    if (self.pending_close)
      self.close();
  });
  
  return this;
};

// set method for Node buffers, used by pako
function bufferSet(data, offset) {
  for (var i = 0; i < data.length; i++) {
    this[offset + i] = data[i];
  }
}

Zlib.prototype.writeSync = function(flush, input, in_off, in_len, out, out_off, out_len) {
  this._writeCheck();
  return this._write(flush, input, in_off, in_len, out, out_off, out_len);
};

Zlib.prototype._write = function(flush, input, in_off, in_len, out, out_off, out_len) {
  this.write_in_progress = true;
  
  if (flush !== exports.Z_NO_FLUSH &&
      flush !== exports.Z_PARTIAL_FLUSH &&
      flush !== exports.Z_SYNC_FLUSH &&
      flush !== exports.Z_FULL_FLUSH &&
      flush !== exports.Z_FINISH &&
      flush !== exports.Z_BLOCK) {
    throw new Error("Invalid flush value");
  }
  
  if (input == null) {
    input = new Buffer(0);
    in_len = 0;
    in_off = 0;
  }
  
  if (out._set)
    out.set = out._set;
  else
    out.set = bufferSet;
  
  var strm = this.strm;
  strm.avail_in = in_len;
  strm.input = input;
  strm.next_in = in_off;
  strm.avail_out = out_len;
  strm.output = out;
  strm.next_out = out_off;
  
  switch (this.mode) {
    case exports.DEFLATE:
    case exports.GZIP:
    case exports.DEFLATERAW:
      var status = zlib_deflate.deflate(strm, flush);
      break;
    case exports.UNZIP:
    case exports.INFLATE:
    case exports.GUNZIP:
    case exports.INFLATERAW:
      var status = zlib_inflate.inflate(strm, flush);
      break;
    default:
      throw new Error("Unknown mode " + this.mode);
  }
  
  if (status !== exports.Z_STREAM_END && status !== exports.Z_OK) {
    this._error(status);
  }
  
  this.write_in_progress = false;
  return [strm.avail_in, strm.avail_out];
};

Zlib.prototype.close = function() {
  if (this.write_in_progress) {
    this.pending_close = true;
    return;
  }
  
  this.pending_close = false;
  
  if (this.mode === exports.DEFLATE || this.mode === exports.GZIP || this.mode === exports.DEFLATERAW) {
    zlib_deflate.deflateEnd(this.strm);
  } else {
    zlib_inflate.inflateEnd(this.strm);
  }
  
  this.mode = exports.NONE;
};

Zlib.prototype.reset = function() {
  switch (this.mode) {
    case exports.DEFLATE:
    case exports.DEFLATERAW:
      var status = zlib_deflate.deflateReset(this.strm);
      break;
    case exports.INFLATE:
    case exports.INFLATERAW:
      var status = zlib_inflate.inflateReset(this.strm);
      break;
  }
  
  if (status !== exports.Z_OK) {
    this._error(status);
  }
};

Zlib.prototype._error = function(status) {
  this.onerror(msg[status] + ': ' + this.strm.msg, status);
  
  this.write_in_progress = false;
  if (this.pending_close)
    this.close();
};

exports.Zlib = Zlib;

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","pako/lib/zlib/constants":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/constants.js","pako/lib/zlib/deflate.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/deflate.js","pako/lib/zlib/inflate.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/inflate.js","pako/lib/zlib/messages":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/messages.js","pako/lib/zlib/zstream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/node_modules/pako/lib/zlib/zstream.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/src/index.js":[function(require,module,exports){
(function (process,Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Transform = require('_stream_transform');

var binding = require('./binding');
var util = require('util');
var assert = require('assert').ok;

// zlib doesn't provide these, so kludge them in following the same
// const naming scheme zlib uses.
binding.Z_MIN_WINDOWBITS = 8;
binding.Z_MAX_WINDOWBITS = 15;
binding.Z_DEFAULT_WINDOWBITS = 15;

// fewer than 64 bytes per chunk is stupid.
// technically it could work with as few as 8, but even 64 bytes
// is absurdly low.  Usually a MB or more is best.
binding.Z_MIN_CHUNK = 64;
binding.Z_MAX_CHUNK = Infinity;
binding.Z_DEFAULT_CHUNK = (16 * 1024);

binding.Z_MIN_MEMLEVEL = 1;
binding.Z_MAX_MEMLEVEL = 9;
binding.Z_DEFAULT_MEMLEVEL = 8;

binding.Z_MIN_LEVEL = -1;
binding.Z_MAX_LEVEL = 9;
binding.Z_DEFAULT_LEVEL = binding.Z_DEFAULT_COMPRESSION;

// expose all the zlib constants
Object.keys(binding).forEach(function(k) {
  if (k.match(/^Z/)) exports[k] = binding[k];
});

// translation table for return codes.
exports.codes = {
  Z_OK: binding.Z_OK,
  Z_STREAM_END: binding.Z_STREAM_END,
  Z_NEED_DICT: binding.Z_NEED_DICT,
  Z_ERRNO: binding.Z_ERRNO,
  Z_STREAM_ERROR: binding.Z_STREAM_ERROR,
  Z_DATA_ERROR: binding.Z_DATA_ERROR,
  Z_MEM_ERROR: binding.Z_MEM_ERROR,
  Z_BUF_ERROR: binding.Z_BUF_ERROR,
  Z_VERSION_ERROR: binding.Z_VERSION_ERROR
};

Object.keys(exports.codes).forEach(function(k) {
  exports.codes[exports.codes[k]] = k;
});

exports.Deflate = Deflate;
exports.Inflate = Inflate;
exports.Gzip = Gzip;
exports.Gunzip = Gunzip;
exports.DeflateRaw = DeflateRaw;
exports.InflateRaw = InflateRaw;
exports.Unzip = Unzip;

exports.createDeflate = function(o) {
  return new Deflate(o);
};

exports.createInflate = function(o) {
  return new Inflate(o);
};

exports.createDeflateRaw = function(o) {
  return new DeflateRaw(o);
};

exports.createInflateRaw = function(o) {
  return new InflateRaw(o);
};

exports.createGzip = function(o) {
  return new Gzip(o);
};

exports.createGunzip = function(o) {
  return new Gunzip(o);
};

exports.createUnzip = function(o) {
  return new Unzip(o);
};


// Convenience methods.
// compress/decompress a string or buffer in one step.
exports.deflate = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Deflate(opts), buffer, callback);
};

exports.deflateSync = function(buffer, opts) {
  return zlibBufferSync(new Deflate(opts), buffer);
};

exports.gzip = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Gzip(opts), buffer, callback);
};

exports.gzipSync = function(buffer, opts) {
  return zlibBufferSync(new Gzip(opts), buffer);
};

exports.deflateRaw = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new DeflateRaw(opts), buffer, callback);
};

exports.deflateRawSync = function(buffer, opts) {
  return zlibBufferSync(new DeflateRaw(opts), buffer);
};

exports.unzip = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Unzip(opts), buffer, callback);
};

exports.unzipSync = function(buffer, opts) {
  return zlibBufferSync(new Unzip(opts), buffer);
};

exports.inflate = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Inflate(opts), buffer, callback);
};

exports.inflateSync = function(buffer, opts) {
  return zlibBufferSync(new Inflate(opts), buffer);
};

exports.gunzip = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new Gunzip(opts), buffer, callback);
};

exports.gunzipSync = function(buffer, opts) {
  return zlibBufferSync(new Gunzip(opts), buffer);
};

exports.inflateRaw = function(buffer, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  return zlibBuffer(new InflateRaw(opts), buffer, callback);
};

exports.inflateRawSync = function(buffer, opts) {
  return zlibBufferSync(new InflateRaw(opts), buffer);
};

function zlibBuffer(engine, buffer, callback) {
  var buffers = [];
  var nread = 0;

  engine.on('error', onError);
  engine.on('end', onEnd);

  engine.end(buffer);
  flow();

  function flow() {
    var chunk;
    while (null !== (chunk = engine.read())) {
      buffers.push(chunk);
      nread += chunk.length;
    }
    engine.once('readable', flow);
  }

  function onError(err) {
    engine.removeListener('end', onEnd);
    engine.removeListener('readable', flow);
    callback(err);
  }

  function onEnd() {
    var buf = Buffer.concat(buffers, nread);
    buffers = [];
    callback(null, buf);
    engine.close();
  }
}

function zlibBufferSync(engine, buffer) {
  if (typeof buffer === 'string')
    buffer = new Buffer(buffer);
  if (!Buffer.isBuffer(buffer))
    throw new TypeError('Not a string or buffer');

  var flushFlag = binding.Z_FINISH;

  return engine._processChunk(buffer, flushFlag);
}

// generic zlib
// minimal 2-byte header
function Deflate(opts) {
  if (!(this instanceof Deflate)) return new Deflate(opts);
  Zlib.call(this, opts, binding.DEFLATE);
}

function Inflate(opts) {
  if (!(this instanceof Inflate)) return new Inflate(opts);
  Zlib.call(this, opts, binding.INFLATE);
}



// gzip - bigger header, same deflate compression
function Gzip(opts) {
  if (!(this instanceof Gzip)) return new Gzip(opts);
  Zlib.call(this, opts, binding.GZIP);
}

function Gunzip(opts) {
  if (!(this instanceof Gunzip)) return new Gunzip(opts);
  Zlib.call(this, opts, binding.GUNZIP);
}



// raw - no header
function DeflateRaw(opts) {
  if (!(this instanceof DeflateRaw)) return new DeflateRaw(opts);
  Zlib.call(this, opts, binding.DEFLATERAW);
}

function InflateRaw(opts) {
  if (!(this instanceof InflateRaw)) return new InflateRaw(opts);
  Zlib.call(this, opts, binding.INFLATERAW);
}


// auto-detect header.
function Unzip(opts) {
  if (!(this instanceof Unzip)) return new Unzip(opts);
  Zlib.call(this, opts, binding.UNZIP);
}


// the Zlib class they all inherit from
// This thing manages the queue of requests, and returns
// true or false if there is anything in the queue when
// you call the .write() method.

function Zlib(opts, mode) {
  this._opts = opts = opts || {};
  this._chunkSize = opts.chunkSize || exports.Z_DEFAULT_CHUNK;

  Transform.call(this, opts);

  if (opts.flush) {
    if (opts.flush !== binding.Z_NO_FLUSH &&
        opts.flush !== binding.Z_PARTIAL_FLUSH &&
        opts.flush !== binding.Z_SYNC_FLUSH &&
        opts.flush !== binding.Z_FULL_FLUSH &&
        opts.flush !== binding.Z_FINISH &&
        opts.flush !== binding.Z_BLOCK) {
      throw new Error('Invalid flush flag: ' + opts.flush);
    }
  }
  this._flushFlag = opts.flush || binding.Z_NO_FLUSH;

  if (opts.chunkSize) {
    if (opts.chunkSize < exports.Z_MIN_CHUNK ||
        opts.chunkSize > exports.Z_MAX_CHUNK) {
      throw new Error('Invalid chunk size: ' + opts.chunkSize);
    }
  }

  if (opts.windowBits) {
    if (opts.windowBits < exports.Z_MIN_WINDOWBITS ||
        opts.windowBits > exports.Z_MAX_WINDOWBITS) {
      throw new Error('Invalid windowBits: ' + opts.windowBits);
    }
  }

  if (opts.level) {
    if (opts.level < exports.Z_MIN_LEVEL ||
        opts.level > exports.Z_MAX_LEVEL) {
      throw new Error('Invalid compression level: ' + opts.level);
    }
  }

  if (opts.memLevel) {
    if (opts.memLevel < exports.Z_MIN_MEMLEVEL ||
        opts.memLevel > exports.Z_MAX_MEMLEVEL) {
      throw new Error('Invalid memLevel: ' + opts.memLevel);
    }
  }

  if (opts.strategy) {
    if (opts.strategy != exports.Z_FILTERED &&
        opts.strategy != exports.Z_HUFFMAN_ONLY &&
        opts.strategy != exports.Z_RLE &&
        opts.strategy != exports.Z_FIXED &&
        opts.strategy != exports.Z_DEFAULT_STRATEGY) {
      throw new Error('Invalid strategy: ' + opts.strategy);
    }
  }

  if (opts.dictionary) {
    if (!Buffer.isBuffer(opts.dictionary)) {
      throw new Error('Invalid dictionary: it should be a Buffer instance');
    }
  }

  this._binding = new binding.Zlib(mode);

  var self = this;
  this._hadError = false;
  this._binding.onerror = function(message, errno) {
    // there is no way to cleanly recover.
    // continuing only obscures problems.
    self._binding = null;
    self._hadError = true;

    var error = new Error(message);
    error.errno = errno;
    error.code = exports.codes[errno];
    self.emit('error', error);
  };

  var level = exports.Z_DEFAULT_COMPRESSION;
  if (typeof opts.level === 'number') level = opts.level;

  var strategy = exports.Z_DEFAULT_STRATEGY;
  if (typeof opts.strategy === 'number') strategy = opts.strategy;

  this._binding.init(opts.windowBits || exports.Z_DEFAULT_WINDOWBITS,
                     level,
                     opts.memLevel || exports.Z_DEFAULT_MEMLEVEL,
                     strategy,
                     opts.dictionary);

  this._buffer = new Buffer(this._chunkSize);
  this._offset = 0;
  this._closed = false;
  this._level = level;
  this._strategy = strategy;

  this.once('end', this.close);
}

util.inherits(Zlib, Transform);

Zlib.prototype.params = function(level, strategy, callback) {
  if (level < exports.Z_MIN_LEVEL ||
      level > exports.Z_MAX_LEVEL) {
    throw new RangeError('Invalid compression level: ' + level);
  }
  if (strategy != exports.Z_FILTERED &&
      strategy != exports.Z_HUFFMAN_ONLY &&
      strategy != exports.Z_RLE &&
      strategy != exports.Z_FIXED &&
      strategy != exports.Z_DEFAULT_STRATEGY) {
    throw new TypeError('Invalid strategy: ' + strategy);
  }

  if (this._level !== level || this._strategy !== strategy) {
    var self = this;
    this.flush(binding.Z_SYNC_FLUSH, function() {
      self._binding.params(level, strategy);
      if (!self._hadError) {
        self._level = level;
        self._strategy = strategy;
        if (callback) callback();
      }
    });
  } else {
    process.nextTick(callback);
  }
};

Zlib.prototype.reset = function() {
  return this._binding.reset();
};

// This is the _flush function called by the transform class,
// internally, when the last chunk has been written.
Zlib.prototype._flush = function(callback) {
  this._transform(new Buffer(0), '', callback);
};

Zlib.prototype.flush = function(kind, callback) {
  var ws = this._writableState;

  if (typeof kind === 'function' || (kind === void 0 && !callback)) {
    callback = kind;
    kind = binding.Z_FULL_FLUSH;
  }

  if (ws.ended) {
    if (callback)
      process.nextTick(callback);
  } else if (ws.ending) {
    if (callback)
      this.once('end', callback);
  } else if (ws.needDrain) {
    var self = this;
    this.once('drain', function() {
      self.flush(callback);
    });
  } else {
    this._flushFlag = kind;
    this.write(new Buffer(0), '', callback);
  }
};

Zlib.prototype.close = function(callback) {
  if (callback)
    process.nextTick(callback);

  if (this._closed)
    return;

  this._closed = true;

  this._binding.close();

  var self = this;
  process.nextTick(function() {
    self.emit('close');
  });
};

Zlib.prototype._transform = function(chunk, encoding, cb) {
  var flushFlag;
  var ws = this._writableState;
  var ending = ws.ending || ws.ended;
  var last = ending && (!chunk || ws.length === chunk.length);

  if (!chunk === null && !Buffer.isBuffer(chunk))
    return cb(new Error('invalid input'));

  // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag.
  // If it's explicitly flushing at some other time, then we use
  // Z_FULL_FLUSH. Otherwise, use Z_NO_FLUSH for maximum compression
  // goodness.
  if (last)
    flushFlag = binding.Z_FINISH;
  else {
    flushFlag = this._flushFlag;
    // once we've flushed the last of the queue, stop flushing and
    // go back to the normal behavior.
    if (chunk.length >= ws.length) {
      this._flushFlag = this._opts.flush || binding.Z_NO_FLUSH;
    }
  }

  var self = this;
  this._processChunk(chunk, flushFlag, cb);
};

Zlib.prototype._processChunk = function(chunk, flushFlag, cb) {
  var availInBefore = chunk && chunk.length;
  var availOutBefore = this._chunkSize - this._offset;
  var inOff = 0;

  var self = this;

  var async = typeof cb === 'function';

  if (!async) {
    var buffers = [];
    var nread = 0;

    var error;
    this.on('error', function(er) {
      error = er;
    });

    do {
      var res = this._binding.writeSync(flushFlag,
                                        chunk, // in
                                        inOff, // in_off
                                        availInBefore, // in_len
                                        this._buffer, // out
                                        this._offset, //out_off
                                        availOutBefore); // out_len
    } while (!this._hadError && callback(res[0], res[1]));

    if (this._hadError) {
      throw error;
    }

    var buf = Buffer.concat(buffers, nread);
    this.close();

    return buf;
  }

  var req = this._binding.write(flushFlag,
                                chunk, // in
                                inOff, // in_off
                                availInBefore, // in_len
                                this._buffer, // out
                                this._offset, //out_off
                                availOutBefore); // out_len

  req.buffer = chunk;
  req.callback = callback;

  function callback(availInAfter, availOutAfter) {
    if (self._hadError)
      return;

    var have = availOutBefore - availOutAfter;
    assert(have >= 0, 'have should not go down');

    if (have > 0) {
      var out = self._buffer.slice(self._offset, self._offset + have);
      self._offset += have;
      // serve some output to the consumer.
      if (async) {
        self.push(out);
      } else {
        buffers.push(out);
        nread += out.length;
      }
    }

    // exhausted the output buffer, or used all the input create a new one.
    if (availOutAfter === 0 || self._offset >= self._chunkSize) {
      availOutBefore = self._chunkSize;
      self._offset = 0;
      self._buffer = new Buffer(self._chunkSize);
    }

    if (availOutAfter === 0) {
      // Not actually done.  Need to reprocess.
      // Also, update the availInBefore to the availInAfter value,
      // so that if we have to hit it a third (fourth, etc.) time,
      // it'll have the correct byte counts.
      inOff += (availInBefore - availInAfter);
      availInBefore = availInAfter;

      if (!async)
        return true;

      var newReq = self._binding.write(flushFlag,
                                       chunk,
                                       inOff,
                                       availInBefore,
                                       self._buffer,
                                       self._offset,
                                       self._chunkSize);
      newReq.callback = callback; // this same function
      newReq.buffer = chunk;
      return;
    }

    if (!async)
      return false;

    // finished with the chunk.
    cb();
  }
};

util.inherits(Deflate, Zlib);
util.inherits(Inflate, Zlib);
util.inherits(Gzip, Zlib);
util.inherits(Gunzip, Zlib);
util.inherits(DeflateRaw, Zlib);
util.inherits(InflateRaw, Zlib);
util.inherits(Unzip, Zlib);

}).call(this,require('_process'),require("buffer").Buffer)
},{"./binding":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/browserify-zlib/src/binding.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","_stream_transform":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js","assert":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/assert/assert.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js","ieee754":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js","is-array":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/base64-js/lib/b64.js":[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/ieee754/index.js":[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/node_modules/is-array/index.js":[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/create-hash.js":[function(require,module,exports){
(function (Buffer){
var createHash = require('sha.js')

var md5 = toConstructor(require('./md5'))
var rmd160 = toConstructor(require('ripemd160'))

function toConstructor (fn) {
  return function () {
    var buffers = []
    var m= {
      update: function (data, enc) {
        if(!Buffer.isBuffer(data)) data = new Buffer(data, enc)
        buffers.push(data)
        return this
      },
      digest: function (enc) {
        var buf = Buffer.concat(buffers)
        var r = fn(buf)
        buffers = null
        return enc ? r.toString(enc) : r
      }
    }
    return m
  }
}

module.exports = function (alg) {
  if('md5' === alg) return new md5()
  if('rmd160' === alg) return new rmd160()
  return createHash(alg)
}

}).call(this,require("buffer").Buffer)
},{"./md5":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/md5.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js","ripemd160":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/ripemd160/lib/ripemd160.js","sha.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/create-hmac.js":[function(require,module,exports){
(function (Buffer){
var createHash = require('./create-hash')

var zeroBuffer = new Buffer(128)
zeroBuffer.fill(0)

module.exports = Hmac

function Hmac (alg, key) {
  if(!(this instanceof Hmac)) return new Hmac(alg, key)
  this._opad = opad
  this._alg = alg

  var blocksize = (alg === 'sha512') ? 128 : 64

  key = this._key = !Buffer.isBuffer(key) ? new Buffer(key) : key

  if(key.length > blocksize) {
    key = createHash(alg).update(key).digest()
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = this._ipad = new Buffer(blocksize)
  var opad = this._opad = new Buffer(blocksize)

  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  this._hash = createHash(alg).update(ipad)
}

Hmac.prototype.update = function (data, enc) {
  this._hash.update(data, enc)
  return this
}

Hmac.prototype.digest = function (enc) {
  var h = this._hash.digest()
  return createHash(this._alg).update(this._opad).update(h).digest(enc)
}


}).call(this,require("buffer").Buffer)
},{"./create-hash":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/create-hash.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/helpers.js":[function(require,module,exports){
(function (Buffer){
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/index.js":[function(require,module,exports){
(function (Buffer){
var rng = require('./rng')

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = require('./create-hash')

exports.createHmac = require('./create-hmac')

exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

exports.getHashes = function () {
  return ['sha1', 'sha256', 'sha512', 'md5', 'rmd160']
}

var p = require('./pbkdf2')(exports)
exports.pbkdf2 = p.pbkdf2
exports.pbkdf2Sync = p.pbkdf2Sync


// the least I can do is make error messages for the rest of the node.js/crypto api.
each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

}).call(this,require("buffer").Buffer)
},{"./create-hash":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/create-hash.js","./create-hmac":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/create-hmac.js","./pbkdf2":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/pbkdf2.js","./rng":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/rng.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/md5.js":[function(require,module,exports){
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

var helpers = require('./helpers');

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/helpers.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/pbkdf2-compat/index.js":[function(require,module,exports){
var crypto = require('crypto')

var exportFn = require('./pbkdf2')
var exported = exportFn(crypto)

module.exports = {
  pbkdf2: exported.pbkdf2,
  pbkdf2Sync: exported.pbkdf2Sync,

  // for crypto-browserify
  __pbkdf2Export: exportFn
}

},{"./pbkdf2":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/pbkdf2-compat/pbkdf2.js","crypto":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/pbkdf2-compat/pbkdf2.js":[function(require,module,exports){
(function (Buffer){
module.exports = function(crypto) {
  function pbkdf2(password, salt, iterations, keylen, digest, callback) {
    if ('function' === typeof digest) {
      callback = digest
      digest = undefined
    }

    if ('function' !== typeof callback)
      throw new Error('No callback provided to pbkdf2')

    setTimeout(function() {
      var result

      try {
        result = pbkdf2Sync(password, salt, iterations, keylen, digest)
      } catch (e) {
        return callback(e)
      }

      callback(undefined, result)
    })
  }

  function pbkdf2Sync(password, salt, iterations, keylen, digest) {
    if ('number' !== typeof iterations)
      throw new TypeError('Iterations not a number')

    if (iterations < 0)
      throw new TypeError('Bad iterations')

    if ('number' !== typeof keylen)
      throw new TypeError('Key length not a number')

    if (keylen < 0)
      throw new TypeError('Bad key length')

    digest = digest || 'sha1'

    if (!Buffer.isBuffer(password)) password = new Buffer(password)
    if (!Buffer.isBuffer(salt)) salt = new Buffer(salt)

    var hLen, l = 1, r, T
    var DK = new Buffer(keylen)
    var block1 = new Buffer(salt.length + 4)
    salt.copy(block1, 0, 0, salt.length)

    for (var i = 1; i <= l; i++) {
      block1.writeUInt32BE(i, salt.length)

      var U = crypto.createHmac(digest, password).update(block1).digest()

      if (!hLen) {
        hLen = U.length
        T = new Buffer(hLen)
        l = Math.ceil(keylen / hLen)
        r = keylen - (l - 1) * hLen

        if (keylen > (Math.pow(2, 32) - 1) * hLen)
          throw new TypeError('keylen exceeds maximum length')
      }

      U.copy(T, 0, 0, hLen)

      for (var j = 1; j < iterations; j++) {
        U = crypto.createHmac(digest, password).update(U).digest()

        for (var k = 0; k < hLen; k++) {
          T[k] ^= U[k]
        }
      }

      var destPos = (i - 1) * hLen
      var len = (i == l ? r : hLen)
      T.copy(DK, destPos, 0, len)
    }

    return DK
  }

  return {
    pbkdf2: pbkdf2,
    pbkdf2Sync: pbkdf2Sync
  }
}

}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/ripemd160/lib/ripemd160.js":[function(require,module,exports){
(function (Buffer){

module.exports = ripemd160



/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
/** @preserve
(c) 2012 by Cédric Mesnil. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// Constants table
var zl = [
    0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
    7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
    3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
    1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
    4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13];
var zr = [
    5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
    6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
    15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
    8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
    12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11];
var sl = [
     11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
    7, 6,   8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
    11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
      11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
    9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6 ];
var sr = [
    8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
    9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
    9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
    15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
    8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11 ];

var hl =  [ 0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E];
var hr =  [ 0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000];

var bytesToWords = function (bytes) {
  var words = [];
  for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
    words[b >>> 5] |= bytes[i] << (24 - b % 32);
  }
  return words;
};

var wordsToBytes = function (words) {
  var bytes = [];
  for (var b = 0; b < words.length * 32; b += 8) {
    bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
  }
  return bytes;
};

var processBlock = function (H, M, offset) {

  // Swap endian
  for (var i = 0; i < 16; i++) {
    var offset_i = offset + i;
    var M_offset_i = M[offset_i];

    // Swap
    M[offset_i] = (
        (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
        (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
    );
  }

  // Working variables
  var al, bl, cl, dl, el;
  var ar, br, cr, dr, er;

  ar = al = H[0];
  br = bl = H[1];
  cr = cl = H[2];
  dr = dl = H[3];
  er = el = H[4];
  // Computation
  var t;
  for (var i = 0; i < 80; i += 1) {
    t = (al +  M[offset+zl[i]])|0;
    if (i<16){
        t +=  f1(bl,cl,dl) + hl[0];
    } else if (i<32) {
        t +=  f2(bl,cl,dl) + hl[1];
    } else if (i<48) {
        t +=  f3(bl,cl,dl) + hl[2];
    } else if (i<64) {
        t +=  f4(bl,cl,dl) + hl[3];
    } else {// if (i<80) {
        t +=  f5(bl,cl,dl) + hl[4];
    }
    t = t|0;
    t =  rotl(t,sl[i]);
    t = (t+el)|0;
    al = el;
    el = dl;
    dl = rotl(cl, 10);
    cl = bl;
    bl = t;

    t = (ar + M[offset+zr[i]])|0;
    if (i<16){
        t +=  f5(br,cr,dr) + hr[0];
    } else if (i<32) {
        t +=  f4(br,cr,dr) + hr[1];
    } else if (i<48) {
        t +=  f3(br,cr,dr) + hr[2];
    } else if (i<64) {
        t +=  f2(br,cr,dr) + hr[3];
    } else {// if (i<80) {
        t +=  f1(br,cr,dr) + hr[4];
    }
    t = t|0;
    t =  rotl(t,sr[i]) ;
    t = (t+er)|0;
    ar = er;
    er = dr;
    dr = rotl(cr, 10);
    cr = br;
    br = t;
  }
  // Intermediate hash value
  t    = (H[1] + cl + dr)|0;
  H[1] = (H[2] + dl + er)|0;
  H[2] = (H[3] + el + ar)|0;
  H[3] = (H[4] + al + br)|0;
  H[4] = (H[0] + bl + cr)|0;
  H[0] =  t;
};

function f1(x, y, z) {
  return ((x) ^ (y) ^ (z));
}

function f2(x, y, z) {
  return (((x)&(y)) | ((~x)&(z)));
}

function f3(x, y, z) {
  return (((x) | (~(y))) ^ (z));
}

function f4(x, y, z) {
  return (((x) & (z)) | ((y)&(~(z))));
}

function f5(x, y, z) {
  return ((x) ^ ((y) |(~(z))));
}

function rotl(x,n) {
  return (x<<n) | (x>>>(32-n));
}

function ripemd160(message) {
  var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

  if (typeof message == 'string')
    message = new Buffer(message, 'utf8');

  var m = bytesToWords(message);

  var nBitsLeft = message.length * 8;
  var nBitsTotal = message.length * 8;

  // Add padding
  m[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
  m[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
      (((nBitsTotal << 8)  | (nBitsTotal >>> 24)) & 0x00ff00ff) |
      (((nBitsTotal << 24) | (nBitsTotal >>> 8))  & 0xff00ff00)
  );

  for (var i=0 ; i<m.length; i += 16) {
    processBlock(H, m, i);
  }

  // Swap endian
  for (var i = 0; i < 5; i++) {
      // Shortcut
    var H_i = H[i];

    // Swap
    H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
          (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
  }

  var digestbytes = wordsToBytes(H);
  return new Buffer(digestbytes);
}



}).call(this,require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/hash.js":[function(require,module,exports){
module.exports = function (Buffer) {

  //prototype class for hash functions
  function Hash (blockSize, finalSize) {
    this._block = new Buffer(blockSize) //new Uint32Array(blockSize/4)
    this._finalSize = finalSize
    this._blockSize = blockSize
    this._len = 0
    this._s = 0
  }

  Hash.prototype.init = function () {
    this._s = 0
    this._len = 0
  }

  Hash.prototype.update = function (data, enc) {
    if ("string" === typeof data) {
      enc = enc || "utf8"
      data = new Buffer(data, enc)
    }

    var l = this._len += data.length
    var s = this._s = (this._s || 0)
    var f = 0
    var buffer = this._block

    while (s < l) {
      var t = Math.min(data.length, f + this._blockSize - (s % this._blockSize))
      var ch = (t - f)

      for (var i = 0; i < ch; i++) {
        buffer[(s % this._blockSize) + i] = data[i + f]
      }

      s += ch
      f += ch

      if ((s % this._blockSize) === 0) {
        this._update(buffer)
      }
    }
    this._s = s

    return this
  }

  Hash.prototype.digest = function (enc) {
    // Suppose the length of the message M, in bits, is l
    var l = this._len * 8

    // Append the bit 1 to the end of the message
    this._block[this._len % this._blockSize] = 0x80

    // and then k zero bits, where k is the smallest non-negative solution to the equation (l + 1 + k) === finalSize mod blockSize
    this._block.fill(0, this._len % this._blockSize + 1)

    if (l % (this._blockSize * 8) >= this._finalSize * 8) {
      this._update(this._block)
      this._block.fill(0)
    }

    // to this append the block which is equal to the number l written in binary
    // TODO: handle case where l is > Math.pow(2, 29)
    this._block.writeInt32BE(l, this._blockSize - 4)

    var hash = this._update(this._block) || this._hash()

    return enc ? hash.toString(enc) : hash
  }

  Hash.prototype._update = function () {
    throw new Error('_update must be implemented by subclass')
  }

  return Hash
}

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/index.js":[function(require,module,exports){
var exports = module.exports = function (alg) {
  var Alg = exports[alg]
  if(!Alg) throw new Error(alg + ' is not supported (we accept pull requests)')
  return new Alg()
}

var Buffer = require('buffer').Buffer
var Hash   = require('./hash')(Buffer)

exports.sha1 = require('./sha1')(Buffer, Hash)
exports.sha256 = require('./sha256')(Buffer, Hash)
exports.sha512 = require('./sha512')(Buffer, Hash)

},{"./hash":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/hash.js","./sha1":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha1.js","./sha256":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha256.js","./sha512":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha512.js","buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha1.js":[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var inherits = require('util').inherits

module.exports = function (Buffer, Hash) {

  var A = 0|0
  var B = 4|0
  var C = 8|0
  var D = 12|0
  var E = 16|0

  var W = new (typeof Int32Array === 'undefined' ? Array : Int32Array)(80)

  var POOL = []

  function Sha1 () {
    if(POOL.length)
      return POOL.pop().init()

    if(!(this instanceof Sha1)) return new Sha1()
    this._w = W
    Hash.call(this, 16*4, 14*4)

    this._h = null
    this.init()
  }

  inherits(Sha1, Hash)

  Sha1.prototype.init = function () {
    this._a = 0x67452301
    this._b = 0xefcdab89
    this._c = 0x98badcfe
    this._d = 0x10325476
    this._e = 0xc3d2e1f0

    Hash.prototype.init.call(this)
    return this
  }

  Sha1.prototype._POOL = POOL
  Sha1.prototype._update = function (X) {

    var a, b, c, d, e, _a, _b, _c, _d, _e

    a = _a = this._a
    b = _b = this._b
    c = _c = this._c
    d = _d = this._d
    e = _e = this._e

    var w = this._w

    for(var j = 0; j < 80; j++) {
      var W = w[j] = j < 16 ? X.readInt32BE(j*4)
        : rol(w[j - 3] ^ w[j -  8] ^ w[j - 14] ^ w[j - 16], 1)

      var t = add(
        add(rol(a, 5), sha1_ft(j, b, c, d)),
        add(add(e, W), sha1_kt(j))
      )

      e = d
      d = c
      c = rol(b, 30)
      b = a
      a = t
    }

    this._a = add(a, _a)
    this._b = add(b, _b)
    this._c = add(c, _c)
    this._d = add(d, _d)
    this._e = add(e, _e)
  }

  Sha1.prototype._hash = function () {
    if(POOL.length < 100) POOL.push(this)
    var H = new Buffer(20)
    //console.log(this._a|0, this._b|0, this._c|0, this._d|0, this._e|0)
    H.writeInt32BE(this._a|0, A)
    H.writeInt32BE(this._b|0, B)
    H.writeInt32BE(this._c|0, C)
    H.writeInt32BE(this._d|0, D)
    H.writeInt32BE(this._e|0, E)
    return H
  }

  /*
   * Perform the appropriate triplet combination function for the current
   * iteration
   */
  function sha1_ft(t, b, c, d) {
    if(t < 20) return (b & c) | ((~b) & d);
    if(t < 40) return b ^ c ^ d;
    if(t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }

  /*
   * Determine the appropriate additive constant for the current iteration
   */
  function sha1_kt(t) {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }

  /*
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   * //dominictarr: this is 10 years old, so maybe this can be dropped?)
   *
   */
  function add(x, y) {
    return (x + y ) | 0
  //lets see how this goes on testling.
  //  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  //  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  //  return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
   * Bitwise rotate a 32-bit number to the left.
   */
  function rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  return Sha1
}

},{"util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha256.js":[function(require,module,exports){

/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var inherits = require('util').inherits

module.exports = function (Buffer, Hash) {

  var K = [
      0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5,
      0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
      0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3,
      0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
      0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC,
      0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
      0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7,
      0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
      0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13,
      0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
      0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3,
      0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
      0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5,
      0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
      0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208,
      0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
    ]

  var W = new Array(64)

  function Sha256() {
    this.init()

    this._w = W //new Array(64)

    Hash.call(this, 16*4, 14*4)
  }

  inherits(Sha256, Hash)

  Sha256.prototype.init = function () {

    this._a = 0x6a09e667|0
    this._b = 0xbb67ae85|0
    this._c = 0x3c6ef372|0
    this._d = 0xa54ff53a|0
    this._e = 0x510e527f|0
    this._f = 0x9b05688c|0
    this._g = 0x1f83d9ab|0
    this._h = 0x5be0cd19|0

    this._len = this._s = 0

    return this
  }

  function S (X, n) {
    return (X >>> n) | (X << (32 - n));
  }

  function R (X, n) {
    return (X >>> n);
  }

  function Ch (x, y, z) {
    return ((x & y) ^ ((~x) & z));
  }

  function Maj (x, y, z) {
    return ((x & y) ^ (x & z) ^ (y & z));
  }

  function Sigma0256 (x) {
    return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
  }

  function Sigma1256 (x) {
    return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
  }

  function Gamma0256 (x) {
    return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
  }

  function Gamma1256 (x) {
    return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
  }

  Sha256.prototype._update = function(M) {

    var W = this._w
    var a, b, c, d, e, f, g, h
    var T1, T2

    a = this._a | 0
    b = this._b | 0
    c = this._c | 0
    d = this._d | 0
    e = this._e | 0
    f = this._f | 0
    g = this._g | 0
    h = this._h | 0

    for (var j = 0; j < 64; j++) {
      var w = W[j] = j < 16
        ? M.readInt32BE(j * 4)
        : Gamma1256(W[j - 2]) + W[j - 7] + Gamma0256(W[j - 15]) + W[j - 16]

      T1 = h + Sigma1256(e) + Ch(e, f, g) + K[j] + w

      T2 = Sigma0256(a) + Maj(a, b, c);
      h = g; g = f; f = e; e = d + T1; d = c; c = b; b = a; a = T1 + T2;
    }

    this._a = (a + this._a) | 0
    this._b = (b + this._b) | 0
    this._c = (c + this._c) | 0
    this._d = (d + this._d) | 0
    this._e = (e + this._e) | 0
    this._f = (f + this._f) | 0
    this._g = (g + this._g) | 0
    this._h = (h + this._h) | 0

  };

  Sha256.prototype._hash = function () {
    var H = new Buffer(32)

    H.writeInt32BE(this._a,  0)
    H.writeInt32BE(this._b,  4)
    H.writeInt32BE(this._c,  8)
    H.writeInt32BE(this._d, 12)
    H.writeInt32BE(this._e, 16)
    H.writeInt32BE(this._f, 20)
    H.writeInt32BE(this._g, 24)
    H.writeInt32BE(this._h, 28)

    return H
  }

  return Sha256

}

},{"util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/sha.js/sha512.js":[function(require,module,exports){
var inherits = require('util').inherits

module.exports = function (Buffer, Hash) {
  var K = [
    0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd,
    0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc,
    0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
    0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118,
    0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe,
    0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
    0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1,
    0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694,
    0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
    0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65,
    0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483,
    0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
    0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
    0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4,
    0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
    0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70,
    0x27b70a85, 0x46d22ffc, 0x2e1b2138, 0x5c26c926,
    0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
    0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8,
    0x81c2c92e, 0x47edaee6, 0x92722c85, 0x1482353b,
    0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
    0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30,
    0xd192e819, 0xd6ef5218, 0xd6990624, 0x5565a910,
    0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
    0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53,
    0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
    0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
    0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3,
    0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60,
    0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
    0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9,
    0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b,
    0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
    0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178,
    0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6,
    0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
    0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493,
    0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c,
    0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
    0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817
  ]

  var W = new Array(160)

  function Sha512() {
    this.init()
    this._w = W

    Hash.call(this, 128, 112)
  }

  inherits(Sha512, Hash)

  Sha512.prototype.init = function () {

    this._a = 0x6a09e667|0
    this._b = 0xbb67ae85|0
    this._c = 0x3c6ef372|0
    this._d = 0xa54ff53a|0
    this._e = 0x510e527f|0
    this._f = 0x9b05688c|0
    this._g = 0x1f83d9ab|0
    this._h = 0x5be0cd19|0

    this._al = 0xf3bcc908|0
    this._bl = 0x84caa73b|0
    this._cl = 0xfe94f82b|0
    this._dl = 0x5f1d36f1|0
    this._el = 0xade682d1|0
    this._fl = 0x2b3e6c1f|0
    this._gl = 0xfb41bd6b|0
    this._hl = 0x137e2179|0

    this._len = this._s = 0

    return this
  }

  function S (X, Xl, n) {
    return (X >>> n) | (Xl << (32 - n))
  }

  function Ch (x, y, z) {
    return ((x & y) ^ ((~x) & z));
  }

  function Maj (x, y, z) {
    return ((x & y) ^ (x & z) ^ (y & z));
  }

  Sha512.prototype._update = function(M) {

    var W = this._w
    var a, b, c, d, e, f, g, h
    var al, bl, cl, dl, el, fl, gl, hl

    a = this._a | 0
    b = this._b | 0
    c = this._c | 0
    d = this._d | 0
    e = this._e | 0
    f = this._f | 0
    g = this._g | 0
    h = this._h | 0

    al = this._al | 0
    bl = this._bl | 0
    cl = this._cl | 0
    dl = this._dl | 0
    el = this._el | 0
    fl = this._fl | 0
    gl = this._gl | 0
    hl = this._hl | 0

    for (var i = 0; i < 80; i++) {
      var j = i * 2

      var Wi, Wil

      if (i < 16) {
        Wi = W[j] = M.readInt32BE(j * 4)
        Wil = W[j + 1] = M.readInt32BE(j * 4 + 4)

      } else {
        var x  = W[j - 15*2]
        var xl = W[j - 15*2 + 1]
        var gamma0  = S(x, xl, 1) ^ S(x, xl, 8) ^ (x >>> 7)
        var gamma0l = S(xl, x, 1) ^ S(xl, x, 8) ^ S(xl, x, 7)

        x  = W[j - 2*2]
        xl = W[j - 2*2 + 1]
        var gamma1  = S(x, xl, 19) ^ S(xl, x, 29) ^ (x >>> 6)
        var gamma1l = S(xl, x, 19) ^ S(x, xl, 29) ^ S(xl, x, 6)

        // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
        var Wi7  = W[j - 7*2]
        var Wi7l = W[j - 7*2 + 1]

        var Wi16  = W[j - 16*2]
        var Wi16l = W[j - 16*2 + 1]

        Wil = gamma0l + Wi7l
        Wi  = gamma0  + Wi7 + ((Wil >>> 0) < (gamma0l >>> 0) ? 1 : 0)
        Wil = Wil + gamma1l
        Wi  = Wi  + gamma1  + ((Wil >>> 0) < (gamma1l >>> 0) ? 1 : 0)
        Wil = Wil + Wi16l
        Wi  = Wi  + Wi16 + ((Wil >>> 0) < (Wi16l >>> 0) ? 1 : 0)

        W[j] = Wi
        W[j + 1] = Wil
      }

      var maj = Maj(a, b, c)
      var majl = Maj(al, bl, cl)

      var sigma0h = S(a, al, 28) ^ S(al, a, 2) ^ S(al, a, 7)
      var sigma0l = S(al, a, 28) ^ S(a, al, 2) ^ S(a, al, 7)
      var sigma1h = S(e, el, 14) ^ S(e, el, 18) ^ S(el, e, 9)
      var sigma1l = S(el, e, 14) ^ S(el, e, 18) ^ S(e, el, 9)

      // t1 = h + sigma1 + ch + K[i] + W[i]
      var Ki = K[j]
      var Kil = K[j + 1]

      var ch = Ch(e, f, g)
      var chl = Ch(el, fl, gl)

      var t1l = hl + sigma1l
      var t1 = h + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0)
      t1l = t1l + chl
      t1 = t1 + ch + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0)
      t1l = t1l + Kil
      t1 = t1 + Ki + ((t1l >>> 0) < (Kil >>> 0) ? 1 : 0)
      t1l = t1l + Wil
      t1 = t1 + Wi + ((t1l >>> 0) < (Wil >>> 0) ? 1 : 0)

      // t2 = sigma0 + maj
      var t2l = sigma0l + majl
      var t2 = sigma0h + maj + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0)

      h  = g
      hl = gl
      g  = f
      gl = fl
      f  = e
      fl = el
      el = (dl + t1l) | 0
      e  = (d + t1 + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0
      d  = c
      dl = cl
      c  = b
      cl = bl
      b  = a
      bl = al
      al = (t1l + t2l) | 0
      a  = (t1 + t2 + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0
    }

    this._al = (this._al + al) | 0
    this._bl = (this._bl + bl) | 0
    this._cl = (this._cl + cl) | 0
    this._dl = (this._dl + dl) | 0
    this._el = (this._el + el) | 0
    this._fl = (this._fl + fl) | 0
    this._gl = (this._gl + gl) | 0
    this._hl = (this._hl + hl) | 0

    this._a = (this._a + a + ((this._al >>> 0) < (al >>> 0) ? 1 : 0)) | 0
    this._b = (this._b + b + ((this._bl >>> 0) < (bl >>> 0) ? 1 : 0)) | 0
    this._c = (this._c + c + ((this._cl >>> 0) < (cl >>> 0) ? 1 : 0)) | 0
    this._d = (this._d + d + ((this._dl >>> 0) < (dl >>> 0) ? 1 : 0)) | 0
    this._e = (this._e + e + ((this._el >>> 0) < (el >>> 0) ? 1 : 0)) | 0
    this._f = (this._f + f + ((this._fl >>> 0) < (fl >>> 0) ? 1 : 0)) | 0
    this._g = (this._g + g + ((this._gl >>> 0) < (gl >>> 0) ? 1 : 0)) | 0
    this._h = (this._h + h + ((this._hl >>> 0) < (hl >>> 0) ? 1 : 0)) | 0
  }

  Sha512.prototype._hash = function () {
    var H = new Buffer(64)

    function writeInt64BE(h, l, offset) {
      H.writeInt32BE(h, offset)
      H.writeInt32BE(l, offset + 4)
    }

    writeInt64BE(this._a, this._al, 0)
    writeInt64BE(this._b, this._bl, 8)
    writeInt64BE(this._c, this._cl, 16)
    writeInt64BE(this._d, this._dl, 24)
    writeInt64BE(this._e, this._el, 32)
    writeInt64BE(this._f, this._fl, 40)
    writeInt64BE(this._g, this._gl, 48)
    writeInt64BE(this._h, this._hl, 56)

    return H
  }

  return Sha512

}

},{"util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/pbkdf2.js":[function(require,module,exports){
var pbkdf2Export = require('pbkdf2-compat').__pbkdf2Export

module.exports = function (crypto, exports) {
  exports = exports || {}

  var exported = pbkdf2Export(crypto)

  exports.pbkdf2 = exported.pbkdf2
  exports.pbkdf2Sync = exported.pbkdf2Sync

  return exports
}

},{"pbkdf2-compat":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/node_modules/pbkdf2-compat/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/crypto-browserify/rng.js":[function(require,module,exports){
(function (global,Buffer){
(function() {
  var g = ('undefined' === typeof window ? global : window) || {}
  var foolBrowserify = function (r) {
    try { return require(r) } catch (_) { }
  }
  _crypto = (
    g.crypto || g.msCrypto || foolBrowserify('crypto') || {}
  )
  module.exports = function(size) {
    // Modern Browsers
    if(_crypto.getRandomValues) {
      var bytes = new Buffer(size); //in browserify, this is an extended Uint8Array
      /* This will not work in older browsers.
       * See https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
       */
    
      _crypto.getRandomValues(bytes);
      return bytes;
    }
    else if (_crypto.randomBytes) {
      return _crypto.randomBytes(size)
    }
    else
      throw new Error(
        'secure random number generation not supported by this browser\n'+
        'use chrome, FireFox or Internet Explorer 11'
      )
  }
}())

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"buffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/buffer/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/index.js":[function(require,module,exports){
var http = module.exports;
var EventEmitter = require('events').EventEmitter;
var Request = require('./lib/request');
var url = require('url')

http.request = function (params, cb) {
    if (typeof params === 'string') {
        params = url.parse(params)
    }
    if (!params) params = {};
    if (!params.host && !params.port) {
        params.port = parseInt(window.location.port, 10);
    }
    if (!params.host && params.hostname) {
        params.host = params.hostname;
    }

    if (!params.protocol) {
        if (params.scheme) {
            params.protocol = params.scheme + ':';
        } else {
            params.protocol = window.location.protocol;
        }
    }

    if (!params.host) {
        params.host = window.location.hostname || window.location.host;
    }
    if (/:/.test(params.host)) {
        if (!params.port) {
            params.port = params.host.split(':')[1];
        }
        params.host = params.host.split(':')[0];
    }
    if (!params.port) params.port = params.protocol == 'https:' ? 443 : 80;
    
    var req = new Request(new xhrHttp, params);
    if (cb) req.on('response', cb);
    return req;
};

http.get = function (params, cb) {
    params.method = 'GET';
    var req = http.request(params, cb);
    req.end();
    return req;
};

http.Agent = function () {};
http.Agent.defaultMaxSockets = 4;

var xhrHttp = (function () {
    if (typeof window === 'undefined') {
        throw new Error('no window object present');
    }
    else if (window.XMLHttpRequest) {
        return window.XMLHttpRequest;
    }
    else if (window.ActiveXObject) {
        var axs = [
            'Msxml2.XMLHTTP.6.0',
            'Msxml2.XMLHTTP.3.0',
            'Microsoft.XMLHTTP'
        ];
        for (var i = 0; i < axs.length; i++) {
            try {
                var ax = new(window.ActiveXObject)(axs[i]);
                return function () {
                    if (ax) {
                        var ax_ = ax;
                        ax = null;
                        return ax_;
                    }
                    else {
                        return new(window.ActiveXObject)(axs[i]);
                    }
                };
            }
            catch (e) {}
        }
        throw new Error('ajax not supported in this browser')
    }
    else {
        throw new Error('ajax not supported in this browser');
    }
})();

http.STATUS_CODES = {
    100 : 'Continue',
    101 : 'Switching Protocols',
    102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
    200 : 'OK',
    201 : 'Created',
    202 : 'Accepted',
    203 : 'Non-Authoritative Information',
    204 : 'No Content',
    205 : 'Reset Content',
    206 : 'Partial Content',
    207 : 'Multi-Status',               // RFC 4918
    300 : 'Multiple Choices',
    301 : 'Moved Permanently',
    302 : 'Moved Temporarily',
    303 : 'See Other',
    304 : 'Not Modified',
    305 : 'Use Proxy',
    307 : 'Temporary Redirect',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method Not Allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Time-out',
    409 : 'Conflict',
    410 : 'Gone',
    411 : 'Length Required',
    412 : 'Precondition Failed',
    413 : 'Request Entity Too Large',
    414 : 'Request-URI Too Large',
    415 : 'Unsupported Media Type',
    416 : 'Requested Range Not Satisfiable',
    417 : 'Expectation Failed',
    418 : 'I\'m a teapot',              // RFC 2324
    422 : 'Unprocessable Entity',       // RFC 4918
    423 : 'Locked',                     // RFC 4918
    424 : 'Failed Dependency',          // RFC 4918
    425 : 'Unordered Collection',       // RFC 4918
    426 : 'Upgrade Required',           // RFC 2817
    428 : 'Precondition Required',      // RFC 6585
    429 : 'Too Many Requests',          // RFC 6585
    431 : 'Request Header Fields Too Large',// RFC 6585
    500 : 'Internal Server Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Gateway Time-out',
    505 : 'HTTP Version Not Supported',
    506 : 'Variant Also Negotiates',    // RFC 2295
    507 : 'Insufficient Storage',       // RFC 4918
    509 : 'Bandwidth Limit Exceeded',
    510 : 'Not Extended',               // RFC 2774
    511 : 'Network Authentication Required' // RFC 6585
};
},{"./lib/request":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/lib/request.js","events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","url":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/url/url.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/lib/request.js":[function(require,module,exports){
var Stream = require('stream');
var Response = require('./response');
var Base64 = require('Base64');
var inherits = require('inherits');

var Request = module.exports = function (xhr, params) {
    var self = this;
    self.writable = true;
    self.xhr = xhr;
    self.body = [];
    
    self.uri = (params.protocol || 'http:') + '//'
        + params.host
        + (params.port ? ':' + params.port : '')
        + (params.path || '/')
    ;
    
    if (typeof params.withCredentials === 'undefined') {
        params.withCredentials = true;
    }

    try { xhr.withCredentials = params.withCredentials }
    catch (e) {}
    
    if (params.responseType) try { xhr.responseType = params.responseType }
    catch (e) {}
    
    xhr.open(
        params.method || 'GET',
        self.uri,
        true
    );

    xhr.onerror = function(event) {
        self.emit('error', new Error('Network error'));
    };

    self._headers = {};
    
    if (params.headers) {
        var keys = objectKeys(params.headers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (!self.isSafeRequestHeader(key)) continue;
            var value = params.headers[key];
            self.setHeader(key, value);
        }
    }
    
    if (params.auth) {
        //basic auth
        this.setHeader('Authorization', 'Basic ' + Base64.btoa(params.auth));
    }

    var res = new Response;
    res.on('close', function () {
        self.emit('close');
    });
    
    res.on('ready', function () {
        self.emit('response', res);
    });

    res.on('error', function (err) {
        self.emit('error', err);
    });
    
    xhr.onreadystatechange = function () {
        // Fix for IE9 bug
        // SCRIPT575: Could not complete the operation due to error c00c023f
        // It happens when a request is aborted, calling the success callback anyway with readyState === 4
        if (xhr.__aborted) return;
        res.handle(xhr);
    };
};

inherits(Request, Stream);

Request.prototype.setHeader = function (key, value) {
    this._headers[key.toLowerCase()] = value
};

Request.prototype.getHeader = function (key) {
    return this._headers[key.toLowerCase()]
};

Request.prototype.removeHeader = function (key) {
    delete this._headers[key.toLowerCase()]
};

Request.prototype.write = function (s) {
    this.body.push(s);
};

Request.prototype.destroy = function (s) {
    this.xhr.__aborted = true;
    this.xhr.abort();
    this.emit('close');
};

Request.prototype.end = function (s) {
    if (s !== undefined) this.body.push(s);

    var keys = objectKeys(this._headers);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = this._headers[key];
        if (isArray(value)) {
            for (var j = 0; j < value.length; j++) {
                this.xhr.setRequestHeader(key, value[j]);
            }
        }
        else this.xhr.setRequestHeader(key, value)
    }

    if (this.body.length === 0) {
        this.xhr.send('');
    }
    else if (typeof this.body[0] === 'string') {
        this.xhr.send(this.body.join(''));
    }
    else if (isArray(this.body[0])) {
        var body = [];
        for (var i = 0; i < this.body.length; i++) {
            body.push.apply(body, this.body[i]);
        }
        this.xhr.send(body);
    }
    else if (/Array/.test(Object.prototype.toString.call(this.body[0]))) {
        var len = 0;
        for (var i = 0; i < this.body.length; i++) {
            len += this.body[i].length;
        }
        var body = new(this.body[0].constructor)(len);
        var k = 0;
        
        for (var i = 0; i < this.body.length; i++) {
            var b = this.body[i];
            for (var j = 0; j < b.length; j++) {
                body[k++] = b[j];
            }
        }
        this.xhr.send(body);
    }
    else if (isXHR2Compatible(this.body[0])) {
        this.xhr.send(this.body[0]);
    }
    else {
        var body = '';
        for (var i = 0; i < this.body.length; i++) {
            body += this.body[i].toString();
        }
        this.xhr.send(body);
    }
};

// Taken from http://dxr.mozilla.org/mozilla/mozilla-central/content/base/src/nsXMLHttpRequest.cpp.html
Request.unsafeHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "content-transfer-encoding",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via"
];

Request.prototype.isSafeRequestHeader = function (headerName) {
    if (!headerName) return false;
    return indexOf(Request.unsafeHeaders, headerName.toLowerCase()) === -1;
};

var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var indexOf = function (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (xs[i] === x) return i;
    }
    return -1;
};

var isXHR2Compatible = function (obj) {
    if (typeof Blob !== 'undefined' && obj instanceof Blob) return true;
    if (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) return true;
    if (typeof FormData !== 'undefined' && obj instanceof FormData) return true;
};

},{"./response":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/lib/response.js","Base64":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/node_modules/Base64/base64.js","inherits":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js","stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/lib/response.js":[function(require,module,exports){
var Stream = require('stream');
var util = require('util');

var Response = module.exports = function (res) {
    this.offset = 0;
    this.readable = true;
};

util.inherits(Response, Stream);

var capable = {
    streaming : true,
    status2 : true
};

function parseHeaders (res) {
    var lines = res.getAllResponseHeaders().split(/\r?\n/);
    var headers = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line === '') continue;
        
        var m = line.match(/^([^:]+):\s*(.*)/);
        if (m) {
            var key = m[1].toLowerCase(), value = m[2];
            
            if (headers[key] !== undefined) {
            
                if (isArray(headers[key])) {
                    headers[key].push(value);
                }
                else {
                    headers[key] = [ headers[key], value ];
                }
            }
            else {
                headers[key] = value;
            }
        }
        else {
            headers[line] = true;
        }
    }
    return headers;
}

Response.prototype.getResponse = function (xhr) {
    var respType = String(xhr.responseType).toLowerCase();
    if (respType === 'blob') return xhr.responseBlob || xhr.response;
    if (respType === 'arraybuffer') return xhr.response;
    return xhr.responseText;
}

Response.prototype.getHeader = function (key) {
    return this.headers[key.toLowerCase()];
};

Response.prototype.handle = function (res) {
    if (res.readyState === 2 && capable.status2) {
        try {
            this.statusCode = res.status;
            this.headers = parseHeaders(res);
        }
        catch (err) {
            capable.status2 = false;
        }
        
        if (capable.status2) {
            this.emit('ready');
        }
    }
    else if (capable.streaming && res.readyState === 3) {
        try {
            if (!this.statusCode) {
                this.statusCode = res.status;
                this.headers = parseHeaders(res);
                this.emit('ready');
            }
        }
        catch (err) {}
        
        try {
            this._emitData(res);
        }
        catch (err) {
            capable.streaming = false;
        }
    }
    else if (res.readyState === 4) {
        if (!this.statusCode) {
            this.statusCode = res.status;
            this.emit('ready');
        }
        this._emitData(res);
        
        if (res.error) {
            this.emit('error', this.getResponse(res));
        }
        else this.emit('end');
        
        this.emit('close');
    }
};

Response.prototype._emitData = function (res) {
    var respBody = this.getResponse(res);
    if (respBody.toString().match(/ArrayBuffer/)) {
        this.emit('data', new Uint8Array(respBody, this.offset));
        this.offset = respBody.byteLength;
        return;
    }
    if (respBody.length > this.offset) {
        this.emit('data', respBody.slice(this.offset));
        this.offset = respBody.length;
    }
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

},{"stream":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js","util":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/node_modules/Base64/base64.js":[function(require,module,exports){
;(function () {

  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next input index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      input.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = input.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    input = input.replace(/=+$/, '');
    if (input.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = input.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/https-browserify/index.js":[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    return http.request.call(this, params, cb);
}

},{"http":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/http-browserify/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/webtorrent/node_modules/inherits/inherits_browser.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/path-browserify/index.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/punycode/punycode.js":[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/decode.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/encode.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/index.js":[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/decode.js","./encode":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/encode.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/duplex.js":[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_duplex.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_duplex.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_passthrough.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_passthrough.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_passthrough.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_passthrough.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_transform.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_transform.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_transform.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_writable.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_writable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/lib/_stream_writable.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/passthrough.js":[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_passthrough.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/readable.js":[function(require,module,exports){
module.exports=require("/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/readable.js")
},{"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/readable.js":"/Users/raymond/code/hackupstate-fall-2014/sprawl/node_modules/request/node_modules/bl/node_modules/readable-stream/readable.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js":[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_transform.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/writable.js":[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/lib/_stream_writable.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/stream-browserify/index.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","inherits":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js","readable-stream/duplex.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/duplex.js","readable-stream/passthrough.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/passthrough.js","readable-stream/readable.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/readable.js","readable-stream/transform.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/transform.js","readable-stream/writable.js":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/readable-stream/writable.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/url/url.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/punycode/punycode.js","querystring":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/querystring-es3/index.js"}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js":[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/util.js":[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/util/support/isBufferBrowser.js","_process":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js","inherits":"/usr/local/lib/node_modules/watchify/node_modules/browserify/node_modules/inherits/inherits_browser.js"}]},{},["/Users/raymond/code/hackupstate-fall-2014/sprawl/inject/worker.js"]);
