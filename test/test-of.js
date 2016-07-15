var Either = require('../lib').Either;
var Try = require('../lib').Try;

var Double = require('./utils/math').Double;

console.log('Start Test', Double(5));

var outter = 10;

// Fork can be annon or lambda.
// Is NOT closure.
Try.ofFork(() => {

    var Double = require('./utils/math').Double;

    setTimeout(() => {
        Success('OK Result '+ Double(1));
    }, 1000);

    return 'OK Result '+ Double(2);
})
.get()
.then(result => console.log('RESULT 1 =>', result));

// Non-fork must be annon-funcs, not lambdas, if using this.Success/Failure.
// Is closure.
Try.of(function () {

    // console.log("Success =>", this, this.Success);

    var Double = require('./utils/math').Double;

    setImmediate(() => {
        //throw new Error('ERROR');
        this.Success(Double(outter)); // Subsequent callbacks ignored.
    });

    return Double(2);

}).andThenFork(v => {
    return Either.Right(v * v);
}).andThenFork(v => {

    return new Promise((resolve, reject) => {
        resolve(v * v);
    });

}).andThen(v => {
    return 'abc'+ v;
})
.get()
.then(result => console.log('RESULT 2 =>', result));

setTimeout(() => {
    console.log('End Test');
}, 2000);
