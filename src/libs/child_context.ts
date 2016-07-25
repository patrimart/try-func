/**
 * This module runs the users' functions in a VM context,
 * sending responses and uncaught exceptions to the parent.
 * Uncaught exceptions will cause the child process to die.
 */

const path = require("path");
const vm = require("vm");
const co = require("co");

import {Either} from "../either";
import {Option} from "../option";
import * as log from "./log";

import * as Queue from "./child_context_queue";

const ___compiledScriptCache___: {[hash: string]: any} = {};

// Listen for messages w/ functions from parent process.
// Ignore messages to poll queue.
process.on("message", function (message: any) {
    if (message === "REQUEST_NEXT_ITEM") return;
    onMessage(message);
});

/**
 * Handler for executing user functions.
 * @param {{func: string, data: any, callerFileName: string}} message
 * @param {string} message.func - the user function to execute.
 * @param {any} data - the data to pass to the user function.
 * @param {string} callerFileName - the origin of the user function.
 */
function onMessage (message: {func: string, data: any, callerFileName: string}) {

    let isComplete = false;

    function onFailure (err: Error) {
        Queue.onFailure(err);
    }

    function onComplete (r?: any) {
        onNext(r, true);
    }

    function onNext (r: any, doComplete?: boolean) {

        // Harshly indicate that a user function has invoked callbacks after complete has been indicated.
        if (isComplete) return Queue.onFatalException(new Error("Complete has already been invoked."));

        // Handle many different responses from the user functions.
        if      (r instanceof Either.Right) onNext(r.get(), doComplete);
        else if (r instanceof Either.Left)  Queue.onFailure(r.getLeft() instanceof Error ? r.getLeft() : new ReferenceError(String(r.getLeft())))
        else if (r instanceof Option.Some)  onNext(r.get(), doComplete);
        else if (r instanceof Option.None)  Queue.onFailure(new ReferenceError("This option is None."));
        else if (r instanceof Promise)      r.then((v: any) => onNext(v, doComplete)).catch((e: Error) => onFailure(e))
        else {
            Queue.onNext(r);
            // This "onComplete" code here prevents a Promise async issue.
            if (doComplete) {
                process.removeListener("unhandledRejection", onFailure);
                isComplete = true;
                Queue.onComplete();
            }
        }
    };

    try {
        // Send unhandled Promise catch.
        process.on("unhandledRejection", onFailure);

        // Wrap the user's executable function with TryJS handlers.
        let code = `(function (exports, require, module, __filename, __dirname, Complete, Next, arg) { return (${message.func})(arg); })`,
            hash = ___hash___(code),
            script: any;

        // Determine if already compiled and cached.
        if (___compiledScriptCache___[hash]) {
            script = ___compiledScriptCache___[hash];
        } else {
            script = new vm.Script(code, { filename: "try-js-fork.vm" });
            ___compiledScriptCache___[hash] = script;
        }

        const ___module = new (require("module"))(Math.random().toString(36).substr(2), {});
        const ___filename = message.callerFileName;
        const ___dirname = path.parse(message.callerFileName).dir;
        // Override require() to handle cwd discrepency.
        const wrapRequire = Object.assign(function require (): any {
            if (arguments[0].startsWith(".")) arguments[0] = path.resolve(___dirname, arguments[0]);
            return ___module.require(arguments[0]);
        }, require);

        // If user's function is a generator with yields, wrap in co lib.
        if (message.func.startsWith("function*")) {

            (co(script.runInThisContext()(___module.exports, wrapRequire, ___module, ___filename, ___dirname, onComplete, onNext, message.data)) as Promise<any>)
                .then((r: any) => { if (r !== undefined) onComplete(r); })
                .catch((err: Error) => onComplete(Either.left(err)));

        }
        // Else, run normally.
        else {

            const r = script.runInThisContext()(___module.exports, wrapRequire, ___module, ___filename, ___dirname, onComplete, onNext, message.data);
            if (r !== undefined) onComplete(r);
        }

    }
    // Catch any unexpected errors.
    catch (err) {
        Queue.onFailure(err);
    }
}

// Catch all uncaught exceptions. (The point of this lib.)
process.on("uncaughtException", Queue.onFatalException);

/**
 * A hashing method to uniquely ID user functions.
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
    let hash = 5381, i = str.length
    while (i) hash = (hash * 33) ^ str.charCodeAt(--i)
    return hash >>> 0;
}
