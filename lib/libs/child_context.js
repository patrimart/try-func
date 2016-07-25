"use strict";
var path = require("path");
var vm = require("vm");
var co = require("co");
var either_1 = require("../either");
var option_1 = require("../option");
var Queue = require("./child_context_queue");
var ___compiledScriptCache___ = {};
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
        var code = "(function (exports, require, module, __filename, __dirname, Complete, Next, arg) { return (" + message.func + ")(arg); })", hash = ___hash___(code), script = void 0;
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        }
        else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }
        var ___module_1 = new (require("module"))(Math.random().toString(36).substr(2), {});
        var ___filename = message.callerFileName;
        var ___dirname_1 = path.parse(message.callerFileName).dir;
        var wrapRequire = Object.assign(function require() {
            if (arguments[0].startsWith("."))
                arguments[0] = path.resolve(___dirname_1, arguments[0]);
            return ___module_1.require(arguments[0]);
        }, require);
        if (message.func.startsWith("function*")) {
            co(script.runInThisContext()(___module_1.exports, wrapRequire, ___module_1, ___filename, ___dirname_1, onComplete, onNext, message.data))
                .then(function (r) { if (r !== undefined)
                onComplete(r); })
                .catch(function (err) { return onComplete(either_1.Either.left(err)); });
        }
        else {
            var r = script.runInThisContext()(___module_1.exports, wrapRequire, ___module_1, ___filename, ___dirname_1, onComplete, onNext, message.data);
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