/**
 * This module is a simple message queue to handle users' functions responses.
 * Guarantees response order.
 */

import * as log from "./log";

// Error message, data, isDestroyable, isComplete
type queueItem = [string, any, boolean, boolean];

// Also on child_context_pool.ts
const UNDEFINED = "2m!!4?U=8th==Z_utdnzR5hsTrry7TG%DZHHvMUZrTp6hs3CWm34=?EgH6FVx?HA?=q_e3$C-eNddgDcMN_4_y@GLpwpm_t-6JdfyAAuEJM97z@dLQ3_pe2PNA$-cZtC";

let queue: Array<queueItem> = [];
let readyToSend = true;
let failSendCount = 0;

// Listen for "REQUEST_NEXT_ITEM" messages from the parent process.
// If available, sends the next queued response.
process.on("message", function (message: string) {
    if (message === "REQUEST_NEXT_ITEM") {
        readyToSend = true;
        sendItem();
    } else if (message === "FLUSH_QUEUE") {
        flush();
    } else {
        // Received a new function, so renew queue.
        clear();
    }
});

/**
 * Queues a given response and/or sends the next available response.
 * If no response is available, sets readyToSend to true so the next
 * queued response need not wait to send.
 */
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
            setTimeout(() => sendItem(), 200);
        } else {
            failSendCount = Math.max(0, failSendCount - 1);
        }
        if (typeof callback === "function") callback(err);
    });
}

// Send nothing with complete.
export function onComplete (callback?: (err: Error) => void) {
    sendItem([UNDEFINED, UNDEFINED, false, true], callback);
}

// Send Either.Right(r).
export function onNext (r: any, callback?: (err: Error) => void) {
    sendItem([UNDEFINED, r, false, false], callback);
}

// Send Either.Left(e) with complete.
export function onFailure (e: Error, callback?: (err: Error) => void) {
    // log.error(e);
    sendItem([e.message, UNDEFINED, false, true], callback);
}

// Send Either.Left(e) with destroy.
export function onFatalException (e: Error, callback?: (err: Error) => void) {
    // log.error(e);
    sendItem([e.message, UNDEFINED, true, false], callback);
}

// Clear the queue an set it to readyToSend.
export function clear () {
    queue = [];
    readyToSend = true;
}

// Flush the queue items.
export function flush (endWithOnComlete?: boolean) {
    const tempQueue = queue.slice(0);
    queue = [];
    while (tempQueue.length) {
        process.send(tempQueue.shift());
    }
    if (endWithOnComlete) process.send([UNDEFINED, UNDEFINED, false, true]);
}
