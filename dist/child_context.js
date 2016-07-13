"use strict";
var path = require("path");
var vm = require('vm');
var Either_1 = require("./Either");
var ___compiledScriptCache___ = {};
var ___origRequire___ = require;
var ___that___ = this;
function ok(r) {
    process.send([null, r, true]);
}
function error(e) {
    process.send([e.stack, null, true]);
}
global.require = function () {
    arguments[0] = path.resolve(path.parse(process.env.__TRYJS_ROOT_DIR).dir, arguments[0]);
    return ___origRequire___.apply(___that___, arguments);
};
global.ok = ok;
global.error = error;
process.on("uncaughtException", function (e) {
    process.send([e.stack, null, false]);
    process.exit();
});
process.on("message", function (message) {
    var code = "((" + message.func + ")(" + JSON.stringify(message.data) + "))", hash = ___hash___(code), script;
    if (___compiledScriptCache___[hash]) {
        script = ___compiledScriptCache___[hash];
    }
    else {
        script = new vm.Script("((" + message.func + ")(" + JSON.stringify(message.data) + "))", { filename: 'try-js-fork.vm' });
        ___compiledScriptCache___[hash] = script;
    }
    try {
        var r = script.runInNewContext(global);
        if (r !== undefined) {
            if (r instanceof Either_1.Either) {
                if (r.isRight()) {
                    ok(r.get());
                }
                else {
                    error(r.getLeft());
                }
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