
const path = require("path");
const vm = require("vm");
const co = require("co");

import {Either} from "../either";
import {Option} from "../option";
import * as log from "./log";

import * as Queue from "./child_context_queue";

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;

// Listen for messages from parent.
process.on("message", function (message: any) {
    if (message === "REQUEST_NEXT_ITEM") return;
    onMessage(message);
});

function onMessage (message: {func: string, data: any, callerFileName: string}) {

    let isComplete = false;

    function onFailure (err: Error) {
        Queue.onFailure(err);
    }

    function onComplete (r?: any) {
        onNext(r, true);
    }

    function onNext (r: any, doComplete?: boolean) {

        if (isComplete) return Queue.onFatalException(new Error("Complete has already been invoked."), () => process.exit(1));

        if      (r instanceof Either.Right) onNext(r.get(), doComplete);
        else if (r instanceof Either.Left)  Queue.onFailure(new ReferenceError("This either is Left."))
        else if (r instanceof Option.Some)  onNext(r.get(), doComplete);
        else if (r instanceof Option.None)  Queue.onFailure(new ReferenceError("This option is None."));
        else if (r instanceof Promise)      r.then((v: any) => onNext(v, doComplete)).catch((e: Error) => onFailure(e))
        else {
            Queue.onNext(r);
            if (doComplete) {
                process.removeListener("unhandledRejection", onFailure);
                isComplete = true;
                Queue.onComplete();
            }
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
        Queue.onFailure(err);
    }
}

// Catch all exceptions.
// Send Either.Left(e) with no destroy flag.
// Exit process.
process.on("uncaughtException", Queue.onFatalException);

/**
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
    let hash = 5381, i = str.length
    while (i) hash = (hash * 33) ^ str.charCodeAt(--i)
    return hash >>> 0;
}
