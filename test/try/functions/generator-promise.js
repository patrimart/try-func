
module.exports = function* (v) {

    // yield Promise.reject(new Error("Promise BOOM!"));
    var r = yield Promise.resolve(v + ' ...andThen.');
    return r;

};
