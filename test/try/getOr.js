
var Either = require('../../lib/either').Either;
var Option = require('../../lib/option').Option;
var Try = require('../../lib/try').Try;

describe('Recover from error', function () {

    describe('with non-fork functions', function () {

        it('should getOrElse.', function (done) {

            Try.of(() => 1)
            .andThen(() => { throw new Error("Catch me"); })
            .getOrElse(() => 2)
            .then(result => result.get() === 2 ? done() : done("result !== 2"));

        });

        it('should getOrElseFork.', function (done) {

            Try.of(() => 1)
            .andThen(() => { throw new Error("Catch me"); })
            .getOrElseFork(() => 2)
            .then(result => result.get() === 2 ? done() : done("result !== 2"));

        });

        it('should getOrThrow.', function (done) {

            try {
                Try.of(() => 1)
                .andThen(() => { throw new Error("Catch me"); })
                .getOrElseThrow(new Error("orElseThrow me"))
                .then(result => done("Did not throw"));
            } catch (err) {
                done();
            }
        });

        it('should getOrThrow via function.', function (done) {

            try {
                Try.of(() => 1)
                .andThen(() => { throw new Error("Catch me"); })
                .getOrElseThrow(() => { return new Error("orElseThrow me"); })
                .then(result => done("Did not throw"));
            } catch (err) {
                done();
            }
        });

    });

    describe('with forked functions', function () {

        it('should getOrElse.', function (done) {

            Try.ofFork(() => 1)
            .andThenFork(() => { throw new Error("Catch me"); })
            .getOrElse(() => 2)
            .then(result => result.get() === 2 ? done() : done("result !== 2"));

        });

        it('should getOrElseFork.', function (done) {

            Try.ofFork(() => 1)
            .andThenFork(() => { throw new Error("Catch me"); })
            .getOrElseFork(() => 2)
            .then(result => result.get() === 2 ? done() : done("result !== 2"));

        });

        it('should getOrThrow.', function (done) {

            try {
                Try.ofFork(() => 1)
                .andThenFork(() => { throw new Error("Catch me"); })
                .getOrElseThrow(new Error("orElseThrow me"))
                .then(result => done("Did not throw"));
            } catch (err) {
                done();
            }
        });

        it('should getOrThrow via function.', function (done) {

            try {
                Try.ofFork(() => 1)
                .andThenFork(() => { throw new Error("Catch me"); })
                .getOrElseThrow(() => { return new Error("orElseThrow me"); })
                .then(result => done("Did not throw"));
            } catch (err) {
                done();
            }
        });

    });

});

