

var Either = require('../../lib/either').Either;
var Try = require('../../lib/try').Try;

describe('Fork Subscription', function () {

    it('should setInterval values until total exceeds 100 and unsubscribe.', function (done) {

        var sub = Try.ofFork(() => {

            var counter = 0;

            setInterval(() => {
                Next(++counter);
            }, 100);

        }).andThenFork(function* (v) {
            var r = yield Promise.resolve(v * v);
            return r;
        })
        .andThen(v => v * v)
        .subscribe(
            next => { if (next > 100) sub.unsubscribe(); },
            err => console.log("Error", err),
            () => done()
        );

    });

    it('should setInterval values until counter exceeds 10 and self-complete.', function (done) {

        Try.ofFork(() => {

            var counter = 0;

            setInterval(() => {
                if (++counter > 10)
                    Complete();
                else
                    Next(counter);
            }, 100);

        }).andThen(function* (v) {

            var r = yield Promise.resolve(v * v);
            return r;

        })
        .subscribe(
            next => { if (next > 110) done("Counter exceeded 10."); }
        );

    });

    it('should setInterval values until counter exceeds 10 and send error.', function (done) {

        Try.ofFork(() => {

            var counter = 0;

            setInterval(() => {
                if (++counter > 10)
                    Error(new Error("Counter exceeded 10."));
                else
                    Next(counter);
            }, 100);

        }).andThen(v => v * v)
        .subscribe(
            next => {
                if (next > 110) done("Counter exceeded 10.")
            },
            err => done(),
            () => done("Triggered complete handler.")
        );

    });

});
