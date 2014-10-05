
// this gets replaced with script via 'shell.js'
var workerScript = "<WORKER>";

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

