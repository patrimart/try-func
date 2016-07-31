
var Either = require('../../lib').Either;
var Option = require('../../lib').Option;
var Try = require('../../lib').Try;

describe('Handle variety of errors', function () {

    describe('with non-fork functions', function () {

        it('should execute lambdas until Either.Left error.', function (done) {

            var outter = "C";

            Try.of(() => "A")
            .andThen(v => v + "B")
            .andThen(v => v + outter)
            .andThen(v => Either.left(new Error("A planned error occurred.")))
            .andThen(v => Option.some(v + "E"))
            .andThen(v => Promise.resolve(v + "F"))
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until Option none error.', function (done) {

            Try.of(function () { return "A"; })
            .andThen(function (v) { return v + "B"; })
            .andThen(function* (v) {
                var r = yield Promise.resolve(v + "C");
                return r;
            })
            .andThen(function (v) { return Either.right(v + "D"); })
            .andThen(function (v) { return Option.none(); })
            .andThen(function (v) { return Promise.resolve(v + "F"); })
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until Promise.reject(Error).', function (done) {

            Try.of(function () { return "A"; })
            // Non-fork must return promise.
            .andThen(function (v) { return Promise.reject(new Error("A planned error occurred.")) })
            .andThen(v => v + "B")
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until throw Error.', function (done) {

            Try.of(function () { return "A"; })
            .andThen(function (v) { throw new Error("A planned error occurred.") })
            .andThen(v => v + "B")
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

    });

    describe('with forked functions', function () {

        it('should execute lambdas until Either.Left error.', function (done) {

            Try.ofFork(() => "A")
            .andThenFork(v => v + "B")
            .andThenFork(v => {
                return Either.left(new Error("A planned error occurred."));
            })
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });


        });

        it('should execute functions until Option none error.', function (done) {

            Try.ofFork(function () { return "A"; })
            .andThenFork(function (v) { return v + "B"; })
            .andThenFork(function* (v) {
                var r = yield Promise.resolve(v + "C");
                return r;
            })
            .andThenFork(function (v) {
                return Option.none();
            })
            .andThenFork(function (v) { return Promise.resolve(v + "F"); })
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until Promise.reject(Error).', function (done) {

            Try.ofFork(function () { return "A"; })
            .andThenFork(function (v) { Promise.reject(new Error("A planned error occurred.")) })
            .andThenFork(v => v + "B")
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

        it('should execute functions until throw Error.', function (done) {

            Try.ofFork(function () { return "A"; })
            .andThenFork(function (v) { throw new Error("A planned error occurred.") })
            .andThenFork(v => v + "B")
            .get()
            .then(next => {
                if (next.getLeft() instanceof Error) done();
                else done("Final value === " + next);
            });

        });

    });

});
