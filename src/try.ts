
import {Either} from "./either";
import {Option} from "./option";
import * as log from "./libs/log";

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
     * Returns a subscription.
     */
    // subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): {unsubscribe: () => void};

    /**
     * Returns the Try as a curried function, with the option to
     * pass an initial value.
     */
    toCurried (): (initialValue?: any) => Promise<Either<Error, T>>;
}

/**
 * The Try module.
 */
export namespace Try {

    /**
     * Runs the given function.
     */
    export function of <T> (func: TryFunction<void, any>, initialValue?: any): Try<T> {
        const runner = new TryLocal(func);
        return new TryClass <T> (runner, _getCallerFile(), initialValue);
    }

    /**
     * Runs the given function in a forked child process.
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
    run (accumulator: I, callback: (v: Either<Error, O>) => void): void;
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
            this.head.run(this.initialValue, (next: Either<Error, T>) => {
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
                        runner.run(value, (next: Either<Error, T>) => resolve(next));
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
                        runner.run(value, (next: Either<Error, T>) => resolve(next));
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

    // public subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): {unsubscribe: () => void} {

    // }

    public toCurried (): (initialValue?: any) => Promise<Either<Error, T>> {

        return (initialValue?: any) => {
            return new Promise((resolve, _) => {
                this.head.run(initialValue, (next: Either<Error, T>) => {
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

    public run (accumulator: I, callback: (v: Either<Error, O>) => void): void {

        let isWaitingResponse = true;

        const onComplete = (r: any) => {

            if (! isWaitingResponse) return log.error(new Error("Complete has already been invoked."));

            let resp: O = r;
            if (r instanceof Either.Right) resp = r.get();
            else if (r instanceof Either.Left) return callback(r); // Either.left<Error, O>(new ReferenceError("This either is Left.")));
            else if (r instanceof Option.Some) resp = r.get();
            else if (r instanceof Option.None) return callback(Either.left<Error, O>(new ReferenceError("This option is None.")));
            else if (r instanceof Promise) {
                return r.then((v: any) => onComplete(r)).catch((e: Error) => callback(Either.left<Error, O>(e)));
            }

            isWaitingResponse = false;

            if (this.next) {
                setImmediate(() => this.next.run(resp, callback));
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

        if (! this._isComplete) {
            this._isComplete = true;
            if (this._currentProcess) {
                Pool.destroy(this._currentProcess);
                this._currentProcess = null;
            }
            if (this.next) this.next.complete();
        }
    }

    public run (accumulator: I, callback: (v: Either<Error, O>) => void): void {

        // Send the user function response down the flow, or send final response.
        const onNext = (r: O) => {
            if (this.next)
                this.next.run(r, callback);
            else
                callback(Either.right<Error, O>(r));
        };

        // Send the error as the final response, skipping all subsequent user funtions.
        const onFailure = (e: Error) => {
            callback(Either.left<Error, O>(e));
        };

        try {

            // If a child process has aleady been acquired, send the user function to it.
            if (this._currentProcess) return this._currentProcess.send(this.func, accumulator, this.callerFileName);

            // Acquire a pooled child process, or block until available.
            Pool.acquire()
                .then((cp: Pool.IChildProcess) => {

                    this._isComplete = false;
                    this._currentProcess = cp;

                    // Listen for user function responses from the child process.
                    cp.addListener ((r: Either<Error, O>) => {

                        if (cp.isDestroyable) {
                            this._currentProcess = null;
                        } else if (cp.isComplete) {
                            this._currentProcess = null;
                            this._isComplete = true;
                        }
                        // Send the user function response down the flow.
                        if (r instanceof Either) r.isRight() ? onNext(r.getRight()) : onFailure(r.getLeft());
                    });

                    // Send the user function to the child process for execution.
                    cp.send(this.func, accumulator, this.callerFileName);
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
