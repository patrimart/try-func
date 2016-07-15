
import * as child_process from "child_process";

import {Pool} from "generic-pool";
import {TryFunction} from "../Try";
import Either from "../Either";
import * as log from "./log";

/**
 * 
 */
export interface IChildProcess {
    isDestroyable: boolean;
    addListener <T> (f: (r: Either<T>) => void): void;
    send <T,U> (func: TryFunction<T,U>, data: any, callerFileName: string): void;
    release (): void;
    destroy (): void;
}

/**
 * 
 */
class ChildProcess implements IChildProcess {

    private _child: child_process.ChildProcess;
    private _emitter: (r: Either<any>) => void;
    private _isDestroyable = false;

    public constructor () {

        this._child = child_process.fork(`${__dirname}/child_context`, ["special"], { env: { __TRYJS_IN_FORK: true, TRYJS_DEBUG: process.env.TRYJS_DEBUG}});

        this._child.on("message", (m: [string, any, boolean]) => {
            if (this._emitter) {
                this._isDestroyable = m[2];
                if (m[0]) {
                    this._emitter(Either.Left<any>(new Error(m[0])));
                } else {
                    this._emitter(Either.Right<any>(m[1]));
                }
            }
        });

        this._child.on("error", (err: Error) => {
            this._isDestroyable = true;
            this._emitter && this._emitter(Either.Left<any>(err));
            this._child && this._child.kill();
            this._child = null;
        });

        this._child.on("exit", (code: number, signal: string) => {
            this._isDestroyable = true;
            this._emitter && this._emitter(Either.Left<any>(new Error(`child_process exit(${code}, ${signal})`)));
            this._child = null;
        });
    }

    public get isDestroyable (): boolean {
        return this._isDestroyable;
    }

    public send <T,U> (func: TryFunction<T,U>, data: any, callerFileName: string): void {
        this._child && this._child.send({func: func.toString(), data: JSON.stringify(data), callerFileName});
    }

    public addListener <T> (f: (r: Either<T>) => void) {
        this._emitter = f;
    }

    public release (): void {
        this._emitter = null;
    }

    public destroy (): void {
        this._child && this._child.kill();
        this._child = null;
    }
}

const pool = new Pool<IChildProcess>({
    name              : 'child_context_pool',
    create            : (callback) => callback(null, new ChildProcess()),
    destroy           : (cp) => cp.destroy(),
    max               : process.env.TRYJS_FORK_POOL_MAX || 10,
    min               : process.env.TRYJS_FORK_POOL_MIN || 2,
    refreshIdle       : true,
    idleTimeoutMillis : process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: process.env.TRYJS_FORK_POOL_REAP || 3333,
    returnToHead      : true,
    log               : false,
});

/**
 * 
 */
export function acquire (): Promise<any> {
    return new Promise ((resolve, reject) => {
        pool.acquire((err, cp) => {
            if (err) reject(err)
            else resolve(cp);
        });
    });
}

/**
 * 
 */
export function release (cp: IChildProcess) {
    cp.release();
    pool.release(cp);
}

/**
 * 
 */
export function destroy (cp:IChildProcess) {
    pool.destroy(cp);
}

/**
 * Gracefully shutdown the child_process pool.
 */
function gracefulShutdown () {
    log.info(`Shutting down the child_context_pool (size: ${pool.getPoolSize()}, available: ${pool.availableObjectsCount()})`);
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
