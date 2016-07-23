
import * as log from "./log";

// Error message, data, isDestroyable, isComplete
type queueItem = [string, any, boolean, boolean];

let queue: Array<queueItem> = [];
let readyToSend = true;
let failSendCount = 0;

process.on("message", function (message: string) {
    readyToSend = true;
    if (message === "REQUEST_NEXT_ITEM") {
        sendItem();
    } else {
        // Received a new function, so renew queue.
        queue = [];
    }
});

function sendItem (item?: queueItem, callback?: (err: Error) => void) {

    if (item !== undefined) queue.push(item);

    if (! readyToSend) return;

    if (queue.length === 0) {
        readyToSend = true;
        return;
    }

    readyToSend = false;

    const next = queue.shift();
    process.send(next, function (err: Error) {
        if (err) {

            failSendCount++;
            log.info(`Failure on process.send(): ${failSendCount}`);
            log.error(err);

            if (failSendCount > 3) {
                process.exit(1);
                return;
            }

            queue.unshift(next);
            readyToSend = true;
            setTimeout(sendItem, 200);
        } else {
            failSendCount = Math.max(0, failSendCount - 1);
        }
        if (typeof callback === "function") callback(err);
    });
}

// Send nothing with destroy and complete flags.
export function onComplete (callback?: (err: Error) => void) {
    setImmediate(() => sendItem([undefined, undefined, false, true], callback));
}

// Send Either.Right(r) with destroy and complete flags.
export function onNext (r: any) {
    setImmediate(() => sendItem([undefined, r, false, false]));
}

// Send Either.Left(e) with destroy and complete flags.
export function onFailure (e: Error) {
    log.error(e);
    setImmediate(() => sendItem([e.message, undefined, false, true]));
}

// Send Either.Left(e) with destroy and complete flags.
export function onFatalException (e: Error, callback: (err: Error) => void) {
    log.error(e);
    setImmediate(() => sendItem([e.message, undefined, true, false], callback));
}
