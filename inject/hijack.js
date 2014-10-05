/*global console: false, require: false */

window.stop();

var num_workers = 0;
var img_regx = new RegExp(/<img.*>/g);
var src_regx = new RegExp(/src=('.*'|".*")/g);

$.get('', function(data) {
//  matches = regx.exec(String(data));
  data = String(data);
  var img_match = img_regx.exec(data);
  while((img_match !== null)) {
    num_workers++;
    var img_url = window.location + src_regx.exec(img_match)[0].slice(5, -1);

//    create_worker(img_url);
    console.log("img_match:", img_match);
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