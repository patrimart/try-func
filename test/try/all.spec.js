
var fs = require('fs');

var Either = require('../../lib/either').Either;
var Option = require('../../lib/option').Option;
var Try = require("../../lib/try").Try;

describe('Array', function () {

    describe('#indexOf()', function () {

        it('should return -1 when the value is not present', function (done) {

            Try.ofFork(() => {

                var fs = require('fs');
                var content = fs.readFileSync(__dirname +'/functions/init-require-return.js');
                console.log(content);

                var Double = require('../utils/math').Double;
                return 'OK Result '+ Double(2);

            }).andThenFork(function* (v) {

                var r = yield Promise.resolve(v + ' ...andThen.');
                return r;
            })
            .get().then(result => {
                console.log('RESULT 1 =>', result);
                done();
            });

        });

        it('should return -1 when the value is not present', function (done) {

            var f = require('./functions/init-require-return');

            Try.ofFork(() => require('./functions/init-require-return')()
            ).andThenFork(
                require('./functions/generator-promise')
            )
            .get().then(result => {
                console.log('RESULT 1 =>', result);
                done();
            });

        });

    });

});
