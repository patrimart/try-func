
var Either = require('../lib').Either;
var Option = require('../lib').Option;
var Try = require('../lib').Try;

var fs = require('fs');
var files = fs.readdirSync(__dirname + "/../lib", "utf8");
var wordCount = 0;
for (var i in files) {
    if (fs.statSync(__dirname + "/../lib/" + files[i]).isFile()) {
        var content = fs.readFileSync(__dirname + "/../lib/" + files[i], 'utf8');
        wordCount += content.split(' ').length;
    }
}
// console.log("Official word count:", wordCount);


var counter = 10;
while(counter--) {

    describe('Docs Examples', function () {

        it('first example JS ayncCountWords', function (done) {

            Try.ofFork(() => {
                var fs = require('fs');
                return fs.readFileSync(__dirname + '/data/lorem-ipsum.txt', 'utf8');
            }).andThenFork(function* (fileContent) {

                function* asyncCountWords(content) {
                    return Promise.resolve(content.split(' ').length);
                }

                var wordCount = yield asyncCountWords(fileContent);
                return wordCount;
            })
            .get().then(result => {
                if (result.isRight()) {
                    // console.log(result);
                    done();
                } else {
                    done("Result was not Either.Right: " + result.getLeft());
                }
            });
        })

        it('second example subscribe count words in files', function (done) {

            var totalCount = 0;

            Try.ofFork(function* () {

                var fs = require('fs');

                function* listFiles(path) {
                    return yield Promise.resolve(fs.readdirSync(path, 'utf8'));
                }

                function* readFile(path) {
                    return yield Promise.resolve(fs.readFileSync(path, 'utf8'));
                }

                var files = yield* listFiles(__dirname + "/../lib", "utf8");

                for (var i in files) {
                    if (fs.statSync(__dirname + "/../lib/" + files[i]).isFile()) {
                        var content = yield* readFile(__dirname + "/../lib/" + files[i]);
                        Next(content);
                    }
                }

                Complete();

            }).andThenFork((fileContent) => {

                function countWords (content) {
                    return content.split(' ').length;
                }

                var wordCount = countWords(fileContent);
                return wordCount;
            })
            .subscribe(
                wordCount => {
                    totalCount += wordCount
                    // console.log("Word count:", wordCount, "Count so far:", totalCount);
                },
                err => {
                    // console.log(err, err.stack);
                    done("An unexpected error: " + err);
                },
                () => {
                    if (totalCount !== wordCount) {
                        done("Total Count " + totalCount + " !== Official Count " + wordCount);
                    } else {
                        // console.log("Total word count: " + totalCount);
                        done();
                    }
                }
            );
        });

    });

}
