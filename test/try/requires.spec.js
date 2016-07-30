
var fs = require('fs');

var Either = require('../../lib/either').Either;
var Option = require('../../lib/option').Option;
var Try = require("../../lib/try").Try;

describe('Forked functions handle moedule requires()', function () {

    it('should find paths from root', function (done) {

        Try.ofFork(() => {

            var fs = require('fs');
            var content = fs.readFileSync(__dirname +'/test/data/sample.json');
            if (! content) throw new Error("No content loaded");
            return content;

        }).andThenFork(function* (v) {

            var json = require('../data/sample');
            if (json.foo !== "bar") throw new Error("No json loaded")
            return json;
        })
        .get().then(result => {
            done();
        });

    });

    it('should find modules from root with sub requires', function (done) {

        var f = require('./modules/require-utils-math');

        Try.ofFork(() => require('./modules/require-utils-math')())
        .andThenFork(require('./modules/generator-promise'))
        .get().then(result => {
            done();
        });

    });

});
