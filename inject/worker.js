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

/*
    $.get(url,function (res) {
        callback({ cmd: 'response', url: url, data: res, type: 'server'});
    });
*/

    torrent.get(url, function (res) {
        callback({ cmd: 'response', url: url, data: res, type: 'torrent'});
    });


}
