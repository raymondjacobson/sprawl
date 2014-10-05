
// this gets replaced with script via 'shell.js'
var workerScript = "var torrent = '';  self.addEventListener('message', function(e) {     var data = e.data;      switch (data.cmd) {         case 'start':             self.postMessage('Worker Started');         break;         case 'stop':             self.postMessage('Worker Stopped');             self.close();         break;         case 'image':             handle(e.data.url,self.postMessage);         break;         default:             self.postMessage('Unknown command: ' + data.msg);     }; }, false);   function handle (url,callback) {      callback({ cmd: 'message', message: 'received url, retrieving data...'});      $.get(url,function (res) {         callback({ cmd: 'response', url: url, data: res, type: 'server'});     });      torrent.get(url, function (res) {         callback({ cmd: 'response', url: url, data: res, type: 'torrent'});     });   } ";

// parse out the image tags and put them here
var images = ['url1.ipg'];

// for each of those image tags create Asset object which wraps a web worker
for(var i = 0; i < images.length; i++) {

    var asset = new Asset(images[i]);

}

function Asset(url) {

    console.log('asset created');

    var blob        =   new Blob([workerScript], {type: 'text/plain'});
    var worker      =   new Worker(URL.createObjectURL(blob));


    worker.onmessage = function(e) {
        console.log('worker message received');
        switch (e.data.cmd) {
            case 'response':
                console.log(e.data.data);
            break;
            case 'message':
                console.log(e.data.message);
            break;
            default:
                console.log('unknown message');
        };
    };

    // send worker the url
    worker.postMessage({cmd: 'image', url: url});
}

