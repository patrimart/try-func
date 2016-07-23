
import * as child_process from "child_process";
import * as os from "os";

import {Pool} from "generic-pool";
import {TryFunction} from "../try";
import {Either} from "../either";
import * as log from "./log";

/**
 * 
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
 * 
 */
class ChildProcess implements IChildProcess {

    private _child: child_process.ChildProcess;
    private _emitter: (r: Either<Error, any>) => void;
    private _isDestroyable = false;
    private _isComplete = false;

    public constructor () {

        this._child = child_process.fork(`${__dirname}/child_context`, ["special"], { env: { __TRYJS_IN_FORK: true, TRYJS_DEBUG: process.env.TRYJS_DEBUG}});

        // Error, data, isDestroyable, isComplete
        this._child.on("message", (m: [string, any, boolean, boolean]) => {
            // console.log("SDSDSD", m);
            if (this._emitter) {
                this._isDestroyable = m[2];
                this._isComplete = m[3];
                if (this._isComplete) {
                    this._emitter(null);
                } else {
                    if (m[0]) {
                        this._emitter(Either.left<Error, any>(new Error(m[0])));
                    } else {
                        this._emitter(Either.right<Error, any>(m[1]));
                    }
                }
            }
        });

        this._child.on("error", (err: Error) => {
            log.error(err);
            this._isDestroyable = true;
            this._isComplete = true;
            if (this._emitter) this._emitter(Either.left<Error, any>(err));
        });

        this._child.on("exit", (code: number, signal: string) => {
            this._isDestroyable = true;
            this._isComplete = true;
            if (this._emitter) this._emitter(Either.left<Error, any>(new Error(`child_process exit(${code}, ${signal})`)));
            this._child = null;
        });
    }

    public get pid (): number {
        return this._child && this._child.pid;
    }

    public get isDestroyable (): boolean {
        return this._isDestroyable;
    }

    public get isComplete (): boolean {
        return this._isComplete;
    }

    public send <T, U> (func: TryFunction<T, U>, data: any, callerFileName: string): void {
        if (this._child) this._child.send({func: func.toString(), data: data, callerFileName});
    }

    public addListener <T> (f: (r: Either<Error, T>) => void) {
        this._emitter = f;
    }

    public release (): void {
        this._isComplete = true;
        this._isDestroyable = false;
        this._emitter = null;
    }

    public destroy (): void {
        this._isDestroyable = true;
        this._emitter = null;
        if (this._child) {
            this._child.removeAllListeners();
            this._child.kill();
            this._child = null;
        }
    }

    public reset (): void {
        this._isComplete = false;
        this._isDestroyable = false;
        this._emitter = null;
    }
}

const pool = new Pool<IChildProcess>({
    name              : `child_context_pool_${Math.random().toString(36).substr(2)}`,
    create            : (callback) => callback(null, new ChildProcess()),
    destroy           : (cp) => cp.destroy(),
    max               : 1, // +process.env.TRYJS_FORK_POOL_MAX || os.cpus().length * 2,
    min               : 1, // +process.env.TRYJS_FORK_POOL_MIN || Math.ceil(os.cpus().length / 2),
    refreshIdle       : true,
    idleTimeoutMillis : +process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: +process.env.TRYJS_FORK_POOL_REAP || 3333,
    returnToHead      : true,
    log               : false,
});

let count: number[] = [];

/**
 * 
 */
export function acquire (): Promise<any> {

    return new Promise ((resolve, reject) => {
        // console.log("- - REQUEST", pool.availableObjectsCount(), pool.waitingClientsCount());
        pool.acquire((err, cp) => {
            count.push(cp.pid);
            // console.log("- - - ACQUIRE", err, cp.pid, JSON.stringify(count));
            if (err) return reject(err)
            cp.reset();
            resolve(cp);
        });
    });
}

/**
 * 
 */
export function release (cp: IChildProcess) {
    count.splice(count.indexOf(cp.pid), 1);
    // console.log("RELEASE", cp.pid, JSON.stringify(count));
    cp.release();
    pool.release(cp);
}

/**
 * 
 */
export function destroy (cp: IChildProcess) {
    count.splice(count.indexOf(cp.pid), 1);
    // console.log("DESTROY", cp.pid, JSON.stringify(count));
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
