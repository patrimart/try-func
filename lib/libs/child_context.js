"use strict";
var path = require("path");
var vm = require("vm");
var co = require("co");
var either_1 = require("../either");
var option_1 = require("../option");
var log = require("./log");
var ___compiledScriptCache___ = {};
var ___origRequire___ = require;
var ___that___ = this;
function _onComplete() {
    process.send([undefined, undefined, false, true]);
}
function _onNext(r) {
    process.send([undefined, r, false, false]);
}
function _onFailure(e) {
    log.error(e);
    process.send([e.message, undefined, false, false]);
}
function _onFatalException(e) {
    log.error(e);
    process.send([e.message, undefined, true, false]);
    process.exit();
}
process.on("message", function (message) {
    var isComplete = false;
    function onFailure(err) {
        _onFailure(err);
    }
    function onComplete(r) {
        onNext(r);
        process.removeListener("unhandledRejection", onFailure);
        _onComplete();
    }
    ;
    function onNext(r) {
        if (isComplete)
            return _onFatalException(new Error("Complete has already been invoked."));
        if (r instanceof either_1.Either.Right)
            onNext(r.get());
        else if (r instanceof either_1.Either.Left)
            _onFailure(new ReferenceError("This either is Left."));
        else if (r instanceof option_1.Option.Some)
            onNext(r.get());
        else if (r instanceof option_1.Option.None)
            _onFailure(new ReferenceError("This option is None."));
        else if (r instanceof Promise)
            r.then(function (v) { return onNext(v); }).catch(function (e) { return _onFailure(e); });
        else {
            isComplete = true;
            _onNext(r);
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
        var isGenerator = message.func.startsWith("function*");
        if (isGenerator) {
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
        _onFailure(err);
        onComplete();
    }
});
process.on("uncaughtException", _onFatalException);
function ___hash___(str) {
    var hash = 5381, i = str.length;
    while (i)
        hash = (hash * 33) ^ str.charCodeAt(--i);
    return hash >>> 0;
}
//# sourceMappingURL=child_context.js.map