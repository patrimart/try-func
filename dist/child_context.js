"use strict";
var path = require("path");
var vm = require('vm');
var Either_1 = require("./Either");
var ___compiledScriptCache___ = {};
var ___origRequire___ = require;
var ___that___ = this;
function ok(r) {
    process.send([null, r, false]);
}
function error(e) {
    process.send([e.stack, null, false]);
}
global.ok = ok;
global.error = error;
process.on("uncaughtException", function (e) {
    process.send([e.stack, null, true]);
    process.exit();
});
process.on("message", function (message) {
    try {
        var code = "((" + message.func + ")(" + JSON.stringify(message.data) + "))", hash = ___hash___(code), script = void 0;
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        }
        else {
            script = new vm.Script(code, { filename: 'try-js-fork.vm' });
            ___compiledScriptCache___[hash] = script;
        }
        global.require = function () {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        };
        var r = script.runInNewContext(global);
        if (r !== undefined) {
            if (r instanceof Either_1.Either) {
                (r.isRight() && ok || error)(r.get());
            }
            else if (r instanceof Promise) {
                r.then(function (v) { return ok(v); }).catch(function (e) { return error(e); });
            }
            else {
                ok(r);
            }
        }
    }
    catch (err) {
        error(err);
    }
});
function ___hash___(str) {
    var hash = 5381, i = str.length;
    while (i)
        hash = (hash * 33) ^ str.charCodeAt(--i);
    return hash >>> 0;
}
//# sourceMappingURL=child_context.js.map