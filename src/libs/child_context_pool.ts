/**
 * This module instantiates and manages the child context pool.
 */

import * as child_process from "child_process";
import * as os from "os";

// A 3rd party dependency. Importing this spawns min child processes.
import {Pool} from "generic-pool";

import {TryFunction} from "../try";
import {Either} from "../either";
import * as log from "./log";

/**
 * The interface for the IChildProcess.
 */
export interface IChildProcess {
    pid: number;
    isDestroyable: boolean;
    isComplete: boolean;
    addListener <T> (f: (r: Either<Error, T>) => void): void;
    send <T, U> (func: TryFunction<T, U>, data: any, callerFileName: string): void;
    release (): void;
    destroy (): void;
    reset (): void;
}

/**
 * The ChildProcess class is a wrapper around a forked child process.
 * It will manage the lifecycle of a child process, while allowing
 * external influence to release or destroy.
 */
class ChildProcess implements IChildProcess {

    private _child: child_process.ChildProcess;
    private _emitter: (r: Either<Error, any>) => void;
    private _isDestroyable = false;
    private _isComplete = false;

    public constructor () {

        // Fork a new child process with necessary env vars.
        this._child = child_process.fork(`${__dirname}/child_context`, ["special"], { env: { __TRYJS_IN_FORK: true, TRYJS_DEBUG: process.env.TRYJS_DEBUG}});

        // Error, data, isDestroyable, isComplete
        this._child.on("message", (m: [string, any, boolean, boolean]) => {

            // If the emitter is gone, release or destroy has been invoked.
            // Do not attempt to send additional repsonses. Indicates a problem.
            if (this._emitter) {

                this._isDestroyable = m[2];
                this._isComplete = m[3];

                // If complete or destroyable, release or destroy the process and inform the Try.
                if (this._isComplete) {
                    release(this);
                } else if (this._isDestroyable) {
                    destroy(this);
                }
                // Else, send the response and prompt for the next.
                else {
                    this._child.send("REQUEST_NEXT_ITEM");
                    if (m[0]) {
                        this._emitter(Either.left<Error, any>(new Error(m[0])));
                    } else {
                        this._emitter(Either.right<Error, any>(m[1]));
                    }
                }
            }
            // Log error for attempting to send responses after complete or destroy.
            else {
                log.info(`The following message was received from a child process that has been released back to` +
                    `the pool (${this._isComplete}) or scheduled for destruction (${this._isDestroyable}). ` +
                    `This generally indicates a misbehaving user function.`);
                log.info(m[0] ? m[0] : `Error: ${JSON.stringify(m[1])}`);
            }
        });

        // If child exits unexpectedly, send warning to Try.
        this._child.on("exit", (code: number, signal: string) => {
            this._isDestroyable = true;
            this._isComplete = true;
            if (this._emitter) {
                this._emitter(Either.left<Error, any>(new Error(`child_process exit(${code}, ${signal})`)));
            }
            this._child = null;
        });
    }

    /**
     * Returns the process ID of this child process.
     */
    public get pid (): number {
        return +(this._child && this._child.pid);
    }

    /**
     * Returns if this process has been marked for destruction.
     */
    public get isDestroyable (): boolean {
        return this._isDestroyable;
    }

    /**
     * Returns if this process has been marked as completed.
     */
    public get isComplete (): boolean {
        return this._isComplete;
    }

    /**
     * Send a user function and data to this process.
     * @param {TryFunction<T, U>} func - the user function
     * @param {any} data - the data to pass to the user function
     * @param {string} callerFileName - the origin of the user function
     */
    public send <T, U> (func: TryFunction<T, U>, data: any, callerFileName: string): void {
        if (this._child) this._child.send({func: func.toString(), data: data, callerFileName});
    }

    /**
     * Accepts one callback to receive user function responses.
     * @param {(r: Either<Error, T>) => void} f - the user function response
     */
    public addListener <T> (f: (r: Either<Error, T>) => void) {
        this._emitter = f;
    }

    /**
     * Marks this child process as complete.
     */
    public release (): void {
        this._isComplete = true;
        if (this._emitter) this._emitter(null);
        this._emitter = null;
    }

    /**
     * Marks this process as destroyable and kills the process.
     */
    public destroy (): void {
        this._isDestroyable = true;
        this.release();
        if (this._child) {
            this._child.removeAllListeners();
            this._child.kill();
            this._child = null;
        }
    }

    /**
     * Resets the process as not complete or destroyable.
     */
    public reset (): void {
        this._isComplete = false;
        this._isDestroyable = false;
        this._emitter = null;
    }
}

// Initiates the child process pool.
const pool = new Pool<IChildProcess>({
    name              : `child_context_pool_${Math.random().toString(36).substr(2)}`,
    create            : (callback) => callback(null, new ChildProcess()),
    destroy           : (cp) => cp.destroy(),
    max               : 2, // +process.env.TRYJS_FORK_POOL_MAX || os.cpus().length * 2,
    min               : 1, // +process.env.TRYJS_FORK_POOL_MIN || Math.ceil(os.cpus().length / 2),
    refreshIdle       : true,
    idleTimeoutMillis : +process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: +process.env.TRYJS_FORK_POOL_REAP || 3333,
    returnToHead      : true,
    log               : false,
});

/**
 * Acquire a new child process, or blocks.
 */
export function acquire (): Promise<any> {

    return new Promise ((resolve, reject) => {
        pool.acquire((err, cp) => {
            if (err) return reject(err)
            cp.reset();
            resolve(cp);
        });
    });
}

/**
 * Release the given child process.
 * @param {} cp - the child process to release
 */
export function release (cp: IChildProcess) {
    cp.release();
    pool.release(cp);
}

/**
 * Destroy the given child process.
 * @param {} cp - the child process to release
 */
export function destroy (cp: IChildProcess) {
    pool.destroy(cp);
}

/**
 * Gracefully shutdown the child_process pool.
 */
function gracefulShutdown () {
    log.info(`Shutting down the child_context_pool ${pool.getName()} (size: ${pool.getPoolSize()}, available: ${pool.availableObjectsCount()})`);
    pool.drain(() => pool.destroyAllNow());
    process.exit();
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("exit", gracefulShutdown);
process.on("uncaughtException", (err: Error) => {
    log.error(err);
    gracefulShutdown();
});
