
var Either = require('../lib/either').Either;
var Option = require('../lib/option').Option;
var Try = require('../lib/try').Try;

var Double = require('./utils/math').Double;

function divide (a, b) {
    console.log(a, b);
    return a / b;
}

// console.log("1 =>", divide(undefined, 3));

console.log("2 =>", Option.lift(divide)(20, 5));

console.log('Start Test', Double(5));

var outter = 10;

for (var i = 0; i < 10; i++) {

    // Fork can be annon or lambda.
    // Is NOT closure.
    // Forks that do not "complete" hold the process. Beware pool starvation.
    // Forks can only accept/respond with JSONable objects.
    Try.ofFork(v => {

        var Double = require('./utils/math').Double;
        // Promise.reject(new Error("Promise Boom"));
        setTimeout(() => {
            // Promise.reject(new Error("Promise Boom"));
            // Complete('OK Result '+ Double(1));
        }, 1000);

        return 'OK Result '+ Double(v);

    }, i).andThenFork(function* (v) {

        // yield Promise.reject(new Error("Promise BOOM!"));
        var r = yield Promise.resolve(v + ' ...andThen.');
        return r;
    }).andThenFork(function* (v) {

        // yield Promise.reject(new Error("Promise BOOM!"));
        var r = yield Promise.resolve(v + ' ...andThen.');
        return r;
    })
    .get().then(result => console.log('RESULT 1 =>', result));

// Bad. Top-level require in module will not work.
// .andThenFork(require('./functions/generator-promise'))
// OK
// .andThenFork(() => require('./functions/generator-promise')())


    // Non-fork must be annon-funcs, not lambdas, if using this.Complete/Failure.
    // Is closure.
    Try.of(function () {

        // console.log("Complete =>", this, this.Complete);
        var Double = require('./utils/math').Double;

        setImmediate(() => {
            //throw new Error('ERROR');
            // this.Next(Double(outter));
            // this.Complete(Double(outter)); // Subsequent callbacks ignored.
        });

        return Double(i);

    }).andThenFork(v => {

        var Either = require('../lib/either').Either;
        return Either.right(v * v);

    }).andThenFork(v => {

        return new Promise((resolve, reject) => {
            resolve(v * v);
        });

    }).andThenFork(function* (v) {

        // yield Promise.reject(new Error("Promise BOOM!"));
        var r = yield Promise.resolve('abc'+ v);
        return r;
    })
    .get().then(result => console.log('RESULT 2 =>', result));

}

setTimeout(() => {
    console.log('End Test');
}, 2000);