var Either = require('../dist/index').Either;
var Try = require('../dist/index').Try;
var Try2 = require('../dist/try').Try2;

var Double = require('./utils/math').Double;

console.log('Start Test', Double(5));


Try.ofFork(function () {

    var Double = require('./utils/math').Double;

    ok('OK Result '+ Double(2));

    //return 'Return Result 1';

})
.get()
.then(result => console.log('RESULT =>', result));

Try.ofFork(() => {

    var Double = require('./utils/math').Double;

    setImmediate(() => {
    
        //throw new Error('ERROR');
        ok(Double(2));

    });

}).andThen(v => {
    return v * v;
}).andThenFork(v => {

    return new Promise((resolve, reject) => {
        resolve(v * v);
    });

}).andThen(v => {
    return 'abc'+ v;
})
.get()
.then(result => console.log('RESULT =>', result));

console.log('End Test');
