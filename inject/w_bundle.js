(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var torrent = '';

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

    $.get(url,function (res) {
        callback({ cmd: 'response', url: url, data: res, type: 'server'});
    });

    torrent.get(url, function (res) {
        callback({ cmd: 'response', url: url, data: res, type: 'torrent'});
    });


}

},{}]},{},[1])