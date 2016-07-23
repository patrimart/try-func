"use strict";
var log = require("./log");
var queue = [];
var readyToSend = true;
var failSendCount = 0;
process.on("message", function (message) {
    readyToSend = true;
    if (message === "REQUEST_NEXT_ITEM") {
        sendItem();
    }
    else {
        queue = [];
    }
});
function sendItem(item, callback) {
    if (item !== undefined)
        queue.push(item);
    if (!readyToSend)
        return;
    if (queue.length === 0) {
        readyToSend = true;
        return;
    }
    readyToSend = false;
    var next = queue.shift();
    process.send(next, function (err) {
        if (err) {
            failSendCount++;
            log.info("Failure on process.send(): " + failSendCount);
            log.error(err);
            if (failSendCount > 3) {
                process.exit(1);
                return;
            }
            queue.unshift(next);
            readyToSend = true;
            setTimeout(sendItem, 200);
        }
        else {
            failSendCount = Math.max(0, failSendCount - 1);
        }
        if (typeof callback === "function")
            callback(err);
    });
}
function onComplete(callback) {
    setImmediate(function () { return sendItem([undefined, undefined, false, true], callback); });
}
exports.onComplete = onComplete;
function onNext(r, callback) {
    setImmediate(function () { return sendItem([undefined, r, false, false], callback); });
}
exports.onNext = onNext;
function onFailure(e, callback) {
    log.error(e);
    setImmediate(function () { return sendItem([e.message, undefined, false, true], callback); });
}
exports.onFailure = onFailure;
function onFatalException(e, callback) {
    log.error(e);
    setImmediate(function () { return sendItem([e.message, undefined, true, false], callback); });
}
exports.onFatalException = onFatalException;
//# sourceMappingURL=child_context_queue.js.map