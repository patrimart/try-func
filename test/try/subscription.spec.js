

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
        .andThen(v => v + v)
        .subscribe(
            next => { 
                // console.log("NEXT =>", next);
                if (next > 240) sub.unsubscribe();
            },
            err => console.log("Error", err),
            () => {
                // console.log("COMPLETE");
                done();
            });

    });

    it('should setInterval values until counter exceeds 10 and self-complete.', function (done) {

        Try.ofFork(() => {

            var counter = 0;

            const id = setInterval(() => {
                if (++counter > 10) {
                    clearInterval(id);
                    Complete();
                } else {
                    Next(counter);
                }
            }, 100);

        }).andThen(function* (v) {
            var r = yield Promise.resolve(v * v);
            return r;
        })
        .subscribe(
            next => { 
                // console.log("NEXT =>", next);
                if (next > 120) done("Counter exceeded 10.");
            },
            err => done("Returned an error."),
            () => {
                // console.log("COMPLETE");
                done();
            });

    });

    it('should setInterval values until counter exceeds 10 and send error.', function (done) {

        Try.ofFork(() => {

            var counter = 0;

            setInterval(() => {
                if (++counter > 10)
                    throw new Error("Counter exceeded 10 so throw.");
                else
                    Next(counter);
            }, 100);

        }).andThen(v => v * v)
        .subscribe(
            next => {
                 // console.log("NEXT =>", next);
                if (next > 110) done("Counter exceeded 10.")
            },
            err => {
                // console.log("ERROR =>", err);
                done();
            },
            () => {
                // console.log("COMPLETE");
                // Error still allows COMPLETE
            });

    });

});
