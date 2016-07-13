
const path = require("path");
const vm = require('vm');

import {Either} from "./Either";

declare var global: any;

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;

// Send Either.Right(r) with reap flag.
function ok (r: any) {
    process.send([null, r, true]);
}

// Send Either.Left(e) with reap flag.
function error (e: Error) {
    process.send([e.stack, null, true]);
}

// Override require() to handle cwd discrepency.
global.require = function (): any {
    arguments[0] = path.resolve(path.parse(process.env.__TRYJS_ROOT_DIR).dir, arguments[0]);
    return ___origRequire___.apply(___that___, arguments);
};

global.ok = ok;
global.error = error;

// Catch all exceptions.
// Send Either.Left(e) with no reap flag.
// Exit process.
process.on("uncaughtException", (e: Error) => {
    process.send([e.stack, null, false]);
    process.exit();
});

// Listen for messages from parent.
process.on("message", function (message: {func: string, data: any}) {

    let code = `((${message.func})(${JSON.stringify(message.data)}))`,
        hash = ___hash___(code),
        script: any;
    
    if (___compiledScriptCache___[hash]) {
        script = ___compiledScriptCache___[hash];
    } else {
        script = new vm.Script(`((${message.func})(${JSON.stringify(message.data)}))`, { filename: 'try-js-fork.vm' });
        ___compiledScriptCache___[hash] = script;
    }

    try {
        const r = script.runInNewContext(global);
        if (r !== undefined) {

            if (r instanceof Either) {
                if (r.isRight()) {
                    ok(r.get());
                } else {
                    error(r.getLeft());
                }
            } else if (r instanceof Promise) {
                r.then((v: any) => ok(v)).catch((e: Error) => error(e))
            } else {
                ok(r);
            }
        }
    } catch (err) {
        error(err);
    }
});

/**
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
  var hash = 5381, i = str.length
  while(i) hash = (hash * 33) ^ str.charCodeAt(--i)
  return hash >>> 0;
}
