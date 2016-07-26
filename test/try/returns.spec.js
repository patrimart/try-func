

var Either = require('../../lib/either').Either;
var Option = require('../../lib/option').Option;
var Try = require('../../lib/try').Try;

describe('Handling variety of returns', function () {

    describe('with non-fork functions', function () {

        it('should execute lambdas until final value === Either.Right("ABCDEF").', function (done) {

            var outter = "C";

            Try.of(() => "A")
            .andThen(v => v + "B")
            .andThen(v => v + outter)
            .andThen(v => Either.right(v + "D"))
            .andThen(v => Option.some(v + "E"))
            .andThen(v => Promise.resolve(v + "F"))
            .get()
            .then(next => {
                if (next.getRight() === "ABCDEF") done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until final value === Either.Right("ABCDEF").', function (done) {

            Try.of(function () { return "A"; })
            .andThen(function (v) { return v + "B"; })
            .andThen(function* (v) {
                var r = yield Promise.resolve(v + "C");
                return r;
            })
            .andThen(function (v) { return Either.right(v + "D"); })
            .andThen(function (v) { return Option.some(v + "E"); })
            .andThen(function (v) { return Promise.resolve(v + "F"); })
            .get()
            .then(next => {
                if (next.getRight() === "ABCDEF") done();
                else done("Final value === " + next);
            });

        });
    });

    describe('with forked functions', function () {

        it('should execute lambdas until final value === Either.Right("ABCDEF").', function (done) {

            var outter = "C";

            Try.ofFork(() => "A")
            .andThenFork(v => v + "B")
            .andThenFork(v => v + outter)
            .andThenFork(v => Either.right(v + "D"))
            .andThenFork(v => Option.some(v + "E"))
            .andThenFork(v => Promise.resolve(v + "F"))
            .get()
            .then(next => {
                if (next.getRight() === "ABCDEF") done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until final value === Either.Right("ABCDEF").', function (done) {

            Try.ofFork(function () { return "A"; })
            .andThenFork(function (v) { return v + "B"; })
            .andThenFork(function* (v) {
                var r = yield Promise.resolve(v + "C");
                return r;
            })
            .andThenFork(function (v) { return Either.right(v + "D"); })
            .andThenFork(function (v) { return Option.some(v + "E"); })
            .andThenFork(function (v) { return Promise.resolve(v + "F"); })
            .get()
            .then(next => {
                if (next.getRight() === "ABCDEF") done();
                else done("Final value === " + next);
            });

        });
    });
});
