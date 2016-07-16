
const path = require("path");
const vm = require("vm");

import {Either} from "../Either";
import * as log from "./log";

declare var global: any;

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;

// Send Either.Right(r) with destroy flag.
// Remove callbacks incase of double call.
function Success (r: any) {
    global.Success = global.Failure = function () {};
    process.send([null, r, false]);
}

// Send Either.Left(e) with destroy flag.
// Remove callbacks incase of double call.
function Failure (e: Error) {
    global.Success = global.Failure = function () {};
    log.error(e);
    process.send([e.message, null, false]);
}

// Listen for messages from parent.
process.on("message", function (message: {func: string, data: any, callerFileName: string}) {

    try {

        let isGenerator = message.func.startsWith("function*");

        let code = isGenerator ?
                `co((${message.func}).bind(this, ${JSON.stringify(message.data)}))` :
                `(${message.func}(${JSON.stringify(message.data)}))`,
            hash = ___hash___(code),
            script: any;

        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        } else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }

        // Override require() to handle cwd discrepency.
        global.require = function (): any {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        };

        global.Success = Success;
        global.Failure = Failure;

        if (isGenerator) {

            global.co = require("co");
            (script.runInNewContext(global) as Promise<any>)
                .then((r: any) => {
                    if (r !== undefined) {
                        if (r instanceof Either) (r.isRight() && Success || Failure)(r.get());
                        else if (r instanceof Promise) r.then((v: any) => Success(v)).catch((e: Error) => Failure(e))
                        else Success(r);
                    }
                })
                .catch((err: Error) => Failure(err));

        } else {

            const r = script.runInNewContext(global);
            if (r !== undefined) {
                if (r instanceof Either) (r.isRight() && Success || Failure)(r.get());
                else if (r instanceof Promise) r.then((v: any) => Success(v)).catch((e: Error) => Failure(e))
                else Success(r);
            }
        }

    } catch (err) {
        Failure(err);
    }
});

// Send unhandled Promise catch with destroy flag.
process.on("unhandledRejection", Failure);

// Catch all exceptions.
// Send Either.Left(e) with no destroy flag.
// Exit process.
process.on("uncaughtException", (e: Error) => {
    log.error(e);
    process.send([e.message, null, true]);
    process.exit();
});

/**
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
  let hash = 5381, i = str.length
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i)
  return hash >>> 0;
}
