"use strict";
var path = require("path");
var vm = require("vm");
var either_1 = require("../either");
var option_1 = require("../option");
var log = require("./log");
var ___compiledScriptCache___ = {};
var ___origRequire___ = require;
var ___that___ = this;
function Success(r) {
    global.Success = global.Failure = function () { };
    process.send([null, r, false]);
}
function Failure(e) {
    global.Success = global.Failure = function () { };
    log.error(e);
    process.send([e.message, null, false]);
}
process.on("message", function (message) {
    try {
        var isGenerator = message.func.startsWith("function*");
        var code = isGenerator ?
            "co((" + message.func + ").bind(this, " + JSON.stringify(message.data) + "))" :
            "(" + message.func + "(" + JSON.stringify(message.data) + "))", hash = ___hash___(code), script = void 0;
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        }
        else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }
        global.require = function () {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        };
        global.Success = Success;
        global.Failure = Failure;
        if (isGenerator) {
            global.co = require("co");
            script.runInNewContext(global)
                .then(function (r) {
                if (r !== undefined) {
                    if (r instanceof either_1.Either.Right)
                        Success(r.get());
                    else if (r instanceof either_1.Either.Left)
                        Failure(new ReferenceError("This either is Left."));
                    else if (r instanceof option_1.Option.Some)
                        Success(r.get());
                    else if (r instanceof option_1.Option.None)
                        Failure(new ReferenceError("This option is None."));
                    else if (r instanceof Promise)
                        r.then(function (v) { return Success(v); }).catch(function (e) { return Failure(e); });
                    else
                        Success(r);
                }
            })
                .catch(function (err) { return Failure(err); });
        }
        else {
            var r = script.runInNewContext(global);
            if (r !== undefined) {
                if (r instanceof either_1.Either.Right)
                    Success(r.get());
                else if (r instanceof either_1.Either.Left)
                    Failure(new ReferenceError("This either is Left."));
                else if (r instanceof option_1.Option.Some)
                    Success(r.get());
                else if (r instanceof option_1.Option.None)
                    Failure(new ReferenceError("This option is None."));
                else if (r instanceof Promise)
                    r.then(function (v) { return Success(v); }).catch(function (e) { return Failure(e); });
                else
                    Success(r);
            }
        }
    }
    catch (err) {
        Failure(err);
    }
});
process.on("unhandledRejection", Failure);
process.on("uncaughtException", function (e) {
    log.error(e);
    process.send([e.message, null, true]);
    process.exit();
});
function ___hash___(str) {
    var hash = 5381, i = str.length;
    while (i)
        hash = (hash * 33) ^ str.charCodeAt(--i);
    return hash >>> 0;
}
//# sourceMappingURL=child_context.js.map