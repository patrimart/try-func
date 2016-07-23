"use strict";
var path = require("path");
var vm = require("vm");
var co = require("co");
var either_1 = require("../either");
var option_1 = require("../option");
var Queue = require("./child_context_queue");
var ___compiledScriptCache___ = {};
var ___origRequire___ = require;
var ___that___ = this;
process.on("message", function (message) {
    if (message === "REQUEST_NEXT_ITEM")
        return;
    onMessage(message);
});
function onMessage(message) {
    var isComplete = false;
    function onFailure(err) {
        Queue.onFailure(err);
    }
    function onComplete(r) {
        onNext(r, true);
    }
    function onNext(r, doComplete) {
        if (isComplete)
            return Queue.onFatalException(new Error("Complete has already been invoked."));
        if (r instanceof either_1.Either.Right)
            onNext(r.get(), doComplete);
        else if (r instanceof either_1.Either.Left)
            Queue.onFailure(r.getLeft() instanceof Error ? r.getLeft() : new ReferenceError(String(r.getLeft())));
        else if (r instanceof option_1.Option.Some)
            onNext(r.get(), doComplete);
        else if (r instanceof option_1.Option.None)
            Queue.onFailure(new ReferenceError("This option is None."));
        else if (r instanceof Promise)
            r.then(function (v) { return onNext(v, doComplete); }).catch(function (e) { return onFailure(e); });
        else {
            Queue.onNext(r);
            if (doComplete) {
                process.removeListener("unhandledRejection", onFailure);
                isComplete = true;
                Queue.onComplete();
            }
        }
    }
    ;
    try {
        process.on("unhandledRejection", onFailure);
        var code = "(function (require, Complete, Next, arg) { return (" + message.func + ")(arg); })", hash = ___hash___(code), script = void 0;
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        }
        else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }
        var wrapRequire = Object.assign(function require() {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        }, require);
        if (message.func.startsWith("function*")) {
            co(script.runInThisContext()(wrapRequire, onComplete, onNext, message.data))
                .then(function (r) { if (r !== undefined)
                onComplete(r); })
                .catch(function (err) { return onComplete(either_1.Either.left(err)); });
        }
        else {
            var r = script.runInThisContext()(wrapRequire, onComplete, onNext, message.data);
            if (r !== undefined)
                onComplete(r);
        }
    }
    catch (err) {
        Queue.onFailure(err);
    }
}
process.on("uncaughtException", Queue.onFatalException);
function ___hash___(str) {
    var hash = 5381, i = str.length;
    while (i)
        hash = (hash * 33) ^ str.charCodeAt(--i);
    return hash >>> 0;
}
//# sourceMappingURL=child_context.js.map