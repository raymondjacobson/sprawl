fs = require('fs')

fs.readFile('inject/worker.js', 'utf8', function (err,w_data) {
    if (err) {
        return console.log(err);
    }

    fs.readFile('inject/hijack.js', 'utf8', function (err,data) {
        if (err) {
            return console.log(err);
        }
        // console.log(data);
        var data = data.split('<WORKER>');

        w_data = w_data.replace(/\r?\n|\r/g,' ');
        data = data[0] + w_data + data[1];

        fs.writeFile('inject/h_bundle.js',data);
    });

});

