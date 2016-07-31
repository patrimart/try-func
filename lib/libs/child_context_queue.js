"use strict";
var log = require("./log");
var UNDEFINED = "2m!!4?U=8th==Z_utdnzR5hsTrry7TG%DZHHvMUZrTp6hs3CWm34=?EgH6FVx?HA?=q_e3$C-eNddgDcMN_4_y@GLpwpm_t-6JdfyAAuEJM97z@dLQ3_pe2PNA$-cZtC";
var queue = [];
var readyToSend = true;
var failSendCount = 0;
process.on("message", function (message) {
    if (message === "REQUEST_NEXT_ITEM") {
        readyToSend = true;
        sendItem();
    }
    else if (message === "FLUSH_QUEUE") {
        flush();
    }
    else {
        clear();
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
            setTimeout(function () { return sendItem(); }, 200);
        }
        else {
            failSendCount = Math.max(0, failSendCount - 1);
        }
        if (typeof callback === "function")
            callback(err);
    });
}
function onComplete(callback) {
    sendItem([UNDEFINED, UNDEFINED, false, true], callback);
}
exports.onComplete = onComplete;
function onNext(r, callback) {
    sendItem([UNDEFINED, r, false, false], callback);
}
exports.onNext = onNext;
function onFailure(e, callback) {
    sendItem([e.message, UNDEFINED, false, true], callback);
}
exports.onFailure = onFailure;
function onFatalException(e, callback) {
    sendItem([e.message, UNDEFINED, true, false], callback);
}
exports.onFatalException = onFatalException;
function clear() {
    queue = [];
    readyToSend = true;
}
exports.clear = clear;
function flush(endWithOnComlete) {
    var tempQueue = queue.slice(0);
    queue = [];
    while (tempQueue.length) {
        process.send(tempQueue.shift());
    }
    if (endWithOnComlete)
        process.send([UNDEFINED, UNDEFINED, false, true]);
}
exports.flush = flush;
//# sourceMappingURL=child_context_queue.js.map