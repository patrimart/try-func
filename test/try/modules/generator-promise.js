
module.exports = function* (v) {

    var fs = require('fs');

    function readFile () {

        return new Promise((resolve, reject) => {

            fs.readFile(__dirname +'/test/data/sample.json', (err, content) => {
                if (err) reject(err);
                else resolve(content);
            });
        });
    }

    var content = yield readFile();
    return content;
};
