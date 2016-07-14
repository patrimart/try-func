
const path = require("path");
const vm = require('vm');

import {Either} from "./Either";

declare var global: any;

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;

// Send Either.Right(r) with destroy flag.
function ok (r: any) {
    process.send([null, r, false]);
}

// Send Either.Left(e) with destroy flag.
function error (e: Error) {
    process.send([e.stack, null, false]);
}

global.ok = ok;
global.error = error;

// Catch all exceptions.
// Send Either.Left(e) with no destroy flag.
// Exit process.
process.on("uncaughtException", (e: Error) => {
    process.send([e.stack, null, true]);
    process.exit();
});

// Listen for messages from parent.
process.on("message", function (message: {func: string, data: any, callerFileName: string}) {

    try {

        let code = `((${message.func})(${JSON.stringify(message.data)}))`,
            hash = ___hash___(code),
            script: any;
        
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        } else {
            script = new vm.Script(code, { filename: 'try-js-fork.vm' });
            ___compiledScriptCache___[hash] = script;
        }

        // Override require() to handle cwd discrepency.
        global.require = function (): any {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        };

        const r = script.runInNewContext(global);
        if (r !== undefined) {

            if (r instanceof Either) {
                (r.isRight() && ok || error)(r.get());
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
