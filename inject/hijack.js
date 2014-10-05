/*global console: false, require: false */

window.stop();

var num_workers = 0;
var img_regx = new RegExp(/<img.*>/g);
var torrent = require('./torrent');
// this gets replaced with script via 'shell.js'
var workerScript = "<WORKER>";


$.get('', function(data) {
//  matches = regx.exec(String(data));
  $('body').css("display","none");
  data = String(data);
  var img_match = img_regx.exec(data);
  while((img_match != null)) {
    var src_regx = new RegExp(/src=('.*(.jpg|.png)'|".*(.jpg|.png)")/g);
    var check_reg = src_regx.exec(img_match[0]);
    if (check_reg) {
      num_workers++;
      // cut out src=
      // console.log(check_reg);
      var img_url = check_reg[0].slice(5, -1);
      // console.log(img_url); 
      // console.log(img_url);
      if (img_url.search("http") !== 0) {
        if (img_url.search("/") === 0) {
          img_url = window.location.origin + img_url;
        }
        else {
          img_url = window.location.href + img_url;
        }
      }
      var new_url = img_url;
      torrent.download(img_url, function (res) {
        if (res === -1) {
          torrent.upload(img_url);
        }
        else {
          new_url = res;
        }
        console.log("%c img_url: " + img_url, 'color: #0B2220');
        console.log("%c new_url: " + new_url + "\n", 'color: #0B2220');
        $('body').css("display","block");
        // document.write("<img src='"+new_url+"' />");
      });

// //    console.log("img_match:", img_match);
    }
    img_match = img_regx.exec(data);
  }
/*
  replaced = data.replace(regx, function (match, offset, string) {
    return "fucker" + String(match) + "fucker";
  });
*/

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
    // var worker      =   new Worker(URL.createObjectURL(blob));
    var worker = new Worker(chrome.runtime.getURL("inject/w_bundle.js"));
    worker.postMessage({cmd:"start"});

    worker.onmessage = function(e) {
        console.log('worker message received');
        switch (e.data.cmd) {
            case 'response':
              console.log(e.data.url);
              if (e.data.url !== -1) {
                worker.postMessage({cmd: 'stop'});
                return e.data.url;
              }
              return url;
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
