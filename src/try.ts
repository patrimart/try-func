
import {Either} from "./either";
import {Option} from "./option";
import * as log from "./libs/log";

export type TryType = "run-once" | "subscription" | "observable";

/**
 * The return type of the user function.
 */
export type TryFunctionReturn<T> = Promise<T> | Either<Error, T> | Option<T> | T;


/**
 * The Try function interface.
 */
export interface TryFunction<T, U extends TryFunctionReturn<U>> extends Function {
    name?: string;
    length: number;
    prototype: any;
}

/**
 * The ISubscription interface is returned from Try.subscription();
 */
export interface ISubscription {

    /**
     * Tells the Try functions to stop sending data and, if any, child processes to die.
     */
    unsubscribe (): void;
}

/**
 * The Try module interface.
 */
export interface Try <T> {

    /**
     * And then, run the given function.
     */
    andThen  <I, O> (func: TryFunction<I, O>): this;

    /**
     * And then, fork a new process, run the given function.
     */
    andThenFork  <I, O> (func: TryFunction<I, O>): this;

    /**
     * Returns a Promise with the Either result.
     */
    get (): Promise<Either<Error, T>>;

    /**
     * Returns a Promise with the right-biased Either, or executes
     * the given function.
     */
    getOrElse <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>;

    /**
     * Returns a Promise with the right-biased Either, or executes
     * the given function in a forked process.
     */
    getOrElseFork <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>;

    /**
     * Returns a Promise with the right-biased Either, or returns
     * a left-biased Either with the given Error.
     */
    getOrThrow (err?: Error): Promise<Either<Error, T>>;

    /**
     * Returns a subscription to receive continuous data.
     * @param {(value: T) => void} onNext - callback to receive continuous responses
     * @param {(err: Error) => void} onError - callback to receive errors
     * @param {onComplete: () => void} onComplete - callback to notify a subscription is done
     * @returns ISubscription
     */
    subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): ISubscription;

    /**
     * Returns the Try as a curried function, with the option to pass an initial value.
     * @returns {(initialValue?: any) => Promise<Either<Error, T>>}
     */
    toCurried (): (initialValue?: any) => Promise<Either<Error, T>>;
}

/**
 * The Try module.
 */
export namespace Try {

    /**
     * Executes the given function in the current process.
     */
    export function of <T> (func: TryFunction<void, any>, initialValue?: any): Try<T> {
        const runner = new TryLocal(func);
        return new TryClass <T> (runner, _getCallerFile(), initialValue);
    }

    /**
     * Executes the given function in a forked child process.
     */
    export function ofFork <T> (func: TryFunction<void, any>, initialValue?: any): Try<T> {
        const runner = new TryFork(func, _getCallerFile());
        return new TryClass <T> (runner, _getCallerFile(), initialValue);
    }
}

/******************************************************************************
 * Private Objects
 */

const co = require("co");
import * as Pool from "./libs/child_context_pool";
import * as path from "path";

interface TryRunner <I, O> {
    id: string;
    setPrevious (f: TryRunner<any, I>): void;
    setNext (f: TryRunner<O, any>): void;
    run (accumulator: I, type: TryType, callback: (v: Either<Error, O>) => void): void;
    isComplete (prevComplete: boolean): boolean;
    complete (): void;
}

/**
 * The TryClass manages the Try function flow and execution.
 */
class TryClass<T> implements Try<T> {

    private last: TryRunner<any, any>;

    constructor (
        private head: TryRunner<void, any>,
        private callerFileName: string,
        private initialValue?: any
    ) {
        this.last = head;
    }

    public andThen <I, O> (func: TryFunction<I, O>): this {
        const runner = new TryLocal(func);
        this.last.setNext(runner);
        runner.setPrevious(this.last);
        this.last = runner;
        return this;
    }

    public andThenFork <I, O> (func: TryFunction<I, O>): this {
        const runner = new TryFork(func, this.callerFileName);
        this.last.setNext(runner);
        runner.setPrevious(this.last);
        this.last = runner;
        return this;
    }

    public get (): Promise<Either<Error, T>> {

        return new Promise((resolve, _) => {
            this.head.run(this.initialValue, "run-once", (next: Either<Error, T>) => {
                this.head.complete();
                if (next) resolve(next);
            });
        });
    }

    public getOrElse <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this.get()
                .then(r => {
                    if (r.isRight()) {
                        resolve(r);
                    } else {
                        const runner = new TryLocal <I, T> (func);
                        runner.run(value, "run-once", (next: Either<Error, T>) => resolve(next));
                    }
                });
        });
    }

    public getOrElseFork <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this.get()
                .then(r => {
                    if (r.isRight()) {
                        resolve(r);
                    } else {
                        const runner = new TryFork <I, T> (func, this.callerFileName);
                        runner.run(value, "run-once", (next: Either<Error, T>) => resolve(next));
                    }
                });
        });
    }

    // Works well with yield.
    public getOrThrow (err?: Error): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this.get()
                .then(r => {
                    if (r.isRight()) {
                        resolve(r);
                    } else {
                        reject(err || r.getLeft());
                    }
                });
        });
    }


    public subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): ISubscription {

        if (typeof onNext !== "function") throw new Error("The onNext parameter must be a function.");
        if (onError && typeof onError !== "function")  throw new Error("The onError parameter must be a function.");
        if (onComplete && typeof onComplete !== "function")  throw new Error("The onComplete parameter must be a function.");

        this.head.run(this.initialValue, "subscription", (next: Either<Error, T>) => {

            if (next === Pool.UNDEFINED as any) {
                this.head.complete();
            } else if (next instanceof Either.Right) onNext(next.getRight());
            else if (onError && next instanceof Either.Left) onError(next.getLeft());

            if (onComplete && this.head.isComplete(true)) onComplete();
        });

        return { unsubscribe: () => this.head.complete() }
    }


    public toCurried (): (initialValue?: any) => Promise<Either<Error, T>> {

        return (initialValue?: any) => {
            return new Promise((resolve, _) => {
                this.head.run(initialValue, "run-once", (next: Either<Error, T>) => {
                    this.head.complete();
                    resolve(next);
                });
            });
        }
    }
}

/**
 * The TryLocal class manages an individual non-forked user function.
 * TryLocals are always marked as complete.
 */
class TryLocal <I, O> implements TryRunner<I, O> {

    protected _id = Math.random().toString(36).substr(2);
    protected prev: TryRunner<any, I>;
    protected next: TryRunner<O, any>
    protected _activeMessageCount = 0;
    protected _isShuttingDown = false;

    constructor (
        protected func: TryFunction<I, O>
    ) {}

    public get id () {
        return this._id;
    }

    public setPrevious (f: TryRunner<any, I>): void {
        this.prev = f;
    }

    public setNext (f: TryRunner<O, any>): void {
        this.next = f;
    }

    public isComplete (prevComplete: boolean) {
        return this.next ? this.next.isComplete(prevComplete && true) : prevComplete && true;
    }

    public complete (): void {
        if (this.next) this.next.complete();
    }

    public run (accumulator: I, type: TryType, callback: (v: Either<Error, O>) => void): void {

        if (this._isShuttingDown) return;

        if (accumulator === Pool.UNDEFINED as any) {
            this._isShuttingDown = true;
            let id = setTimeout(() => {
                if (this._activeMessageCount <= 0) {
                    clearTimeout(id);
                    if (this.next) this.next.run(Pool.UNDEFINED as any, type, callback);
                    else callback(Pool.UNDEFINED as any);
                }
            }, 10);
            return;
        }

        this._activeMessageCount++;
        // console.log(this._activeMessageCount);

        let isWaitingResponse = true;

        const onComplete = (r: any) => {

            this._activeMessageCount = Math.max(0, this._activeMessageCount - 1);
            // console.log(this._activeMessageCount);

            if (! isWaitingResponse) return log.error(new Error("Complete has already been invoked."));

            let resp: O = r;
            if (r instanceof Either.Right) resp = r.get();
            else if (r instanceof Either.Left) return callback(r); // Either.left<Error, O>(new ReferenceError("This either is Left.")));
            else if (r instanceof Option.Some) resp = r.get();
            else if (r instanceof Option.None) return callback(Either.left<Error, O>(new ReferenceError("This option is None.")));
            else if (r instanceof Promise) {
                return r.then((v: any) => onComplete(v)).catch((e: Error) => callback(Either.left<Error, O>(e)));
            }

            isWaitingResponse = false;

            if (this.next) {
                setImmediate(() => this.next.run(resp, type, callback));
            } else {
                setImmediate(() => callback(Either.right<Error, O>(resp)));
            }
        }
        const onNext = onComplete;

        try {

            if (isGeneratorFunction(this.func)) {

                co(this.func.bind({Complete: onComplete, Next: onNext}, accumulator))
                    .then((r: any) => { if (r !== undefined) onNext(r); })
                    .catch((err: Error) => onNext(Either.left<Error, O>(err)));

            } else {

                const r = this.func.call({Complete: onComplete, Next: onNext}, accumulator);
                if (r !== undefined) onNext(r);
            }

        } catch (err) {
            onNext(Either.left<Error, O>(err));
        }
    }
}

/**
 * The TryFork class manages an individual forked user function.
 */
class TryFork  <I, O> extends TryLocal<I, O> {

    private _currentProcess: Pool.IChildProcess;
    private _isComplete = false;

    constructor (
        func: TryFunction<I, O>,
        private callerFileName?: string
    ) {
        super(func);
    }

    public isComplete (prevComplete: boolean) {
        return this.next ? this.next.isComplete(prevComplete && this._isComplete) : prevComplete && this._isComplete;
    }

    /**
     * Force the forked child process to die.
     */
    public complete (): void {

// console.log("ID", this.id);
// console.log("isComplete", this._isComplete);
// console.log("currentProcess", !! this._currentProcess);
// console.log("activeMessageCount", this._activeMessageCount);
// console.log("isShuttingDown", this._isShuttingDown);

        this._isShuttingDown = true;
        this._isComplete = true;
        if (this._currentProcess) {
            // Pool.release(this._currentProcess);
            // if (this._activeMessageCount <= 0)
            // Pool.release(cp);
            // else
            // setTimeout(() => this._currentProcess && Pool.destroy(this._currentProcess), 1000);
        }
        this._currentProcess = null;
        if (this.next) this.next.complete();

// console.log(this._isShuttingDown || (this._isComplete && this._currentProcess === null));
//         if (this._isShuttingDown || (this._isComplete && this._currentProcess === null)) {
//             if (this.next) this.next.complete();
//             return;
//         }

        // this._isShuttingDown = true;

        // let id = setTimeout(() => {
        //     if (this._activeMessageCount <= 0) {
        //         clearTimeout(id);
        //         this._isComplete = true;
        //         if (this._currentProcess) {
        //             if (this._activeMessageCount <= 0)
        //                 Pool.release(this._currentProcess);
        //             else
        //                 Pool.destroy(this._currentProcess);
        //             this._currentProcess = null;
        //         }
        //         if (this.next) this.next.complete();
        //     }
        // }, 10);
    }

    public run (accumulator: I, type: TryType, callback: (v: Either<Error, O>) => void): void {

        if (this._isShuttingDown) return;

        if (accumulator === Pool.UNDEFINED as any) {
            this._isShuttingDown = true;
            this._currentProcess = null;
            if (this._activeMessageCount <= 0) {
                if (this.next) this.next.run(Pool.UNDEFINED as any, type, callback);
                else callback(Pool.UNDEFINED as any);
            } else {
                let id = setTimeout(() => {
                    if (this._activeMessageCount <= 0) {
                        clearTimeout(id);
                        if (this.next) this.next.run(Pool.UNDEFINED as any, type, callback);
                        else callback(Pool.UNDEFINED as any);
                    }
                }, 10);
            }
            return;
        }

        if (this._isComplete) return;
        this._activeMessageCount++;

        // Send the user function response down the flow, or send final response.
        const onNext = (r: O) => {

            this._activeMessageCount = Math.max(0, this._activeMessageCount - 1);
            // if (this._isComplete) return;

            if (this.next)
                this.next.run(r, type, callback);
            else
                callback(Either.right<Error, O>(r));
        };

        // Send the error as the final response, skipping all subsequent user funtions.
        const onFailure = (e: Error) => {
            this._activeMessageCount = Math.max(0, this._activeMessageCount - 1);
            // if (this._isComplete) return;
            callback(Either.left<Error, O>(e));
        };

        try {

            // If a child process has aleady been acquired, send the user function to it.
            if (this._currentProcess) return this._currentProcess.send(this.func, accumulator, this.callerFileName, type);

            // Acquire a pooled child process, or block until available.
            Pool.acquire()
                .then((cp: Pool.IChildProcess) => {

                    this._isComplete = false;
                    this._currentProcess = cp;

                    // Listen for user function responses from the child process.
                    cp.addListener ((r: Either<Error, O>) => {
                        // Send the user function response down the flow.
                        if (r instanceof Either)
                            r.isRight() ? onNext(r.getRight()) : onFailure(r.getLeft());
                        else if (type === "subscription")
                            onNext(Pool.UNDEFINED as any);

                        // Tells state of child process and that pool released or destroyed.
                        if (cp.isDestroyable) {
                            this._currentProcess = null;
                        } else if (cp.isComplete) {
                            this._isShuttingDown = true;
                            this._isComplete = true;
                            this._currentProcess = null;
                        }
                    });

                    // Send the user function to the child process for execution.
                    cp.send(this.func, accumulator, this.callerFileName, type);
                })
                // If the pool fails, let the user know. This should never happen.
                .catch(err => {
                    log.info("The child process pool failed. This error is likely fatal. Please submit a bug report.");
                    log.error(err);
                    onFailure(err);
                });

        }
        // Catch an unexpected error. This should never happen.
        catch (err) {
            log.info("The Try lib failed to execute the user function. This error is likely fatal. Please submit a bug report.");
            log.error(err);
            onFailure(err);
        }
    }
}

// For convenience to avoid lint errors.
declare var Error: any;

/**
 * A hack of the Error object to get a function caller's __filename.
 */
function _getCallerFile() {

    let originalFunc = Error.prepareStackTrace;

    let callerfile: string;
    try {
        let err = new Error();
        let currentfile: string;

        Error.prepareStackTrace = function (err: any, stack: any) { return stack; };

        currentfile = err.stack.shift().getFileName();

        while (err.stack.length) {
            callerfile = err.stack.shift().getFileName();
            if (currentfile !== callerfile) break;
        }
    } catch (e) {}

    Error.prepareStackTrace = originalFunc;

    return callerfile;
}

/**
 * Determine if the user function is a generator (function* () {}).
 */
function isGeneratorFunction(obj: any) {
    const constructor = obj.constructor;
    if (! constructor) return false;
    return "GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName;
}
