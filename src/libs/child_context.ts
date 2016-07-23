
const path = require("path");
const vm = require("vm");
const co = require("co");

import {Either} from "../either";
import {Option} from "../option";
import * as log from "./log";

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;

// Send Either.Right(r) with destroy and complete flags.
function _onComplete () {
    process.send([undefined, undefined, false, true]);
}

// Send Either.Right(r) with destroy and complete flags.
function _onNext (r: any) {
    // console.log(">>>>", r);
    process.send([undefined, r, false, false]);
}

// Send Either.Left(e) with destroy and complete flags.
function _onFailure (e: Error) {
    log.error(e);
    process.send([e.message, undefined, false, false]);
}

// Send Either.Left(e) with destroy and complete flags.
function _onFatalException (e: Error) {
    log.error(e);
    process.send([e.message, undefined, true, false]);
    process.exit();
}

// Listen for messages from parent.
process.on("message", function (message: {func: string, data: any, callerFileName: string}) {
    // console.log("=", process.pid, message.data);
    let isComplete = false;

    function onFailure (err: Error) {
        _onFailure(err);
    }
    function onComplete (r?: any) {
        // console.log("C>>", r);
        onNext(r);
        process.removeListener("unhandledRejection", onFailure);
        _onComplete();
    };
    function onNext (r: any) {
        // console.log("N>>", r);

        if (isComplete) return _onFatalException(new Error("Complete has already been invoked."));

        if      (r instanceof Either.Right) onNext(r.get());
        else if (r instanceof Either.Left)  _onFailure(new ReferenceError("This either is Left."))
        else if (r instanceof Option.Some)  onNext(r.get());
        else if (r instanceof Option.None)  _onFailure(new ReferenceError("This option is None."));
        else if (r instanceof Promise)      r.then((v: any) => onNext(v)).catch((e: Error) => _onFailure(e))
        else    {
            isComplete = true;
            _onNext(r);
        }
    };

    try {

        // Send unhandled Promise catch with destroy flag.
        process.on("unhandledRejection", onFailure);

        let code = `(function (require, Complete, Next, arg) { return (${message.func})(arg); })`,
            hash = ___hash___(code),
            script: any;

        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        } else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }

        // Override require() to handle cwd discrepency.
        const wrapRequire = Object.assign(function require (): any {
            arguments[0] = path.resolve(path.parse(message.callerFileName).dir, arguments[0]);
            return ___origRequire___.apply(___that___, arguments);
        }, require);

        const isGenerator = message.func.startsWith("function*");
        if (isGenerator) {

            (co(script.runInThisContext()(wrapRequire, onComplete, onNext, message.data)) as Promise<any>)
                .then((r: any) => { if (r !== undefined) onComplete(r); })
                .catch((err: Error) => onComplete(Either.left(err)));

        } else {

            const r = script.runInThisContext()(wrapRequire, onComplete, onNext, message.data);
            if (r !== undefined) onComplete(r);
        }

    } catch (err) {
        _onFailure(err);
        onComplete();
    }
});

// Catch all exceptions.
// Send Either.Left(e) with no destroy flag.
// Exit process.
process.on("uncaughtException", _onFatalException);

/**
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
  let hash = 5381, i = str.length
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i)
  return hash >>> 0;
}
