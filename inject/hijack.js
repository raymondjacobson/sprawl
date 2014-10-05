/*global console: false, require: false */

window.stop();

var num_workers = 0;
var img_regx = new RegExp(/<img.*>/g);
var src_regx = new RegExp(/src=('.*(.jpg|.png)'|".*(.jpg|.png)")/g);
// this gets replaced with script via 'shell.js'
var workerScript = "<WORKER>";

$.get('', function(data) {
//  matches = regx.exec(String(data));
  data = String(data);
  var img_match = img_regx.exec(data);
  while((img_match !== null)) {
    num_workers++;
    // cut out src=
    var img_url = src_regx.exec(img_match)[0].slice(5, -1);
    
    if (img_url.search("http") !== 0) {
      if (img_url.search("/") === 0) {
        console.log("/////");
        img_url = window.location.origin + img_url;
      }
      else {
        img_url = window.location.href + img_url;
      }
    }
//    img_url = window.location + img_url;
//    img_url = "fucking fucker fuck";
    Asset(img_url);

//    console.log("img_match:", img_match);
    console.log("img_url:", img_url);
    img_match = img_regx.exec(data);
  }
/*
  replaced = data.replace(regx, function (match, offset, string) {
    return "fucker" + String(match) + "fucker";
  });
*/

  document.write(data);
});


/*
// parse out the image tags and put them here
var images = ['url1.ipg'];

// for each of those image tags create Asset object which wraps a web worker
for(var i = 0; i < images.length; i++) {

    var asset = new Asset(images[i]);

}
*/

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
