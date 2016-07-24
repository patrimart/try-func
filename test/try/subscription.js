

var Either = require('../../lib/either').Either;
var Try = require('../../lib/try').Try;


var sub = Try.ofFork(() => {

    var counter = 0;

    setInterval(() => {
        console.log("Send =>", counter);
        Next(++counter);
    }, 1000);

}).andThenFork(function* (v) {

    console.log("1) -->", v);
    // yield Promise.reject(new Error("Promise BOOM!"));
    var r = yield Promise.resolve(v + ' ...andThen.');
    return r;

}).andThenFork(function* (v) {

    console.log("2) -->", v);
    // yield Promise.reject(new Error("Promise BOOM!"));
    var r = yield Promise.resolve(v + ' ...andThen.');
    return r;
})
.subscribe(
    next => console.log("Result =>", next),
    err => console.log(err),
    () => console.log("COMPLETE")
);

setTimeout(() => {
    console.log("Request unsubscribe");
    sub.unsubscribe();
}, 10500);
