
import {Either} from "./either";
import {Option} from "./option";
import * as log from "./libs/log";

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
    getOrElse (func: TryFunction<void, T>): Promise<Either<Error, T>>;

    /**
     * Returns a Promise with the right-biased Either, or executes
     * the given function in a forked process.
     */
    getOrElseFork (func: TryFunction<void, T>): Promise<Either<Error, T>>;

    /**
     * Returns a Promise with the right-biased Either, or returns
     * a left-biased Either with the given Error.
     */
    getOrThrow (err?: Error): Promise<Either<Error, T>>;


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
        return new TryClass <T> ({isFork: false, func}, _getCallerFile(), initialValue);
    }

    /**
     * Runs the given function in a forked child process.
     */
    export function ofFork <T> (func: TryFunction<void, any>, initialValue?: any): Try<T> {
        return new TryClass <T> ({isFork: true, func}, _getCallerFile(), initialValue);
    }
}

/******************************************************************************
 * Private Objects
 */

const co = require("co");
import * as Pool from "./libs/child_context_pool";
import * as path from "path";


interface IFuncWrapper<T, U> {
    isFork: boolean;
    func: TryFunction<T, U>;
}


/**
 * 
 */
class TryClass<T> implements Try<T> {

    private _funcStack: Array<IFuncWrapper<any, any>> = [];
    private _initialValue: any;
    private _callerFileName: string;

    constructor (func: IFuncWrapper<void, any>, callerFileName: string, initialValue?: any) {
        this._initialValue = initialValue;
        this._callerFileName = callerFileName;
        this._funcStack = [func];
    }

    public andThen <I, O> (func: TryFunction<I, O>): this {
        this._funcStack.push({isFork: false, func});
        return this;
    }

    public andThenFork <I, O> (func: TryFunction<I, O>): this {
        this._funcStack.push({isFork: false, func});
        return this;
    }

    public get (): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this._executeFuncStack(resolve, this._initialValue);
        });
    }

    public getOrElse (func: TryFunction<void, T>): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this.get()
                .then(r => {
                    if (r.isRight()) {
                        resolve(r);
                    } else {
                        this._funcStack = [{isFork: false, func}];
                        this._executeFuncStack(resolve);
                    }
                });
        });
    }

    public getOrElseFork (func: TryFunction<void, T>): Promise<Either<Error, T>> {

        return new Promise((resolve, reject) => {
            this.get()
                .then(r => {
                    if (r.isRight()) {
                        resolve(r);
                    } else {
                        this._funcStack = [{isFork: true, func}];
                        this._executeFuncStack(resolve);
                    }
                });
        });
    }

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

    public toCurried (): (initialValue?: any) => Promise<Either<Error, T>> {
        return (initialValue?: any) => {
            this._initialValue = initialValue;
            return this.get();
        }
    }

    private _executeFuncStack<T> (resolve: (v: Either<Error, T>) => void, accumulator?: any) {

        if (! this._funcStack.length) {
            resolve(Either.right<Error, T>(accumulator));
            return;
        }

        try {

            let isWaitingResponse = true;

            const onSuccess = (r: any) => {
                if (isWaitingResponse) {
                    this._executeFuncStack(resolve, r);
                    isWaitingResponse = false;
                } else {
                    log.error(new Error("Success/Failure has already been invoked."));
                }
            };

            const onNext = (r: any) => {
                if (isWaitingResponse) {
                    setImmediate(() => this._executeFuncStack(resolve, r));
                } else {
                    log.error(new Error("Success/Failure has already been invoked."));
                }
            };

            const onFailure = (e: Error) => {
                if (isWaitingResponse) {
                    resolve(Either.left<Error, T>(e));
                    isWaitingResponse = false;
                } else {
                    log.error(new Error("Success/Failure has already been invoked."));
                }
            };

            const wrap = this._funcStack.shift();

            // If not fork, run the script in this thread.
            // If process.env.__TRYJS_IN_FORK, already in child process.
            if (! wrap.isFork || !! process.env.__TRYJS_IN_FORK) {

                if (isGeneratorFunction(wrap.func)) {

                    co(wrap.func.bind({Success: onSuccess, Next: onNext, Failure: onFailure}, accumulator))
                        .then((r: any) => {
                            if (r instanceof Either.Right) onSuccess(r.get());
                            else if (r instanceof Either.Left) onFailure(new ReferenceError("This either is Left."))
                            else if (r instanceof Option.Some) onSuccess(r.get());
                            else if (r instanceof Option.None) onFailure(new ReferenceError("This option is None."));
                            else if (r instanceof Promise) r.then((v: any) => onSuccess(v)).catch((e: Error) => onFailure(e))
                            else onSuccess(r);
                        })
                        .catch((err: Error) => onFailure(err));

                } else {

                    const r = wrap.func.call({Success: onSuccess, Failure: onFailure}, accumulator);
                    if (r !== undefined) {
                        if (r instanceof Either.Right) onSuccess(r.get());
                        else if (r instanceof Either.Left) onFailure(new ReferenceError("This either is Left."))
                        else if (r instanceof Option.Some) onSuccess(r.get());
                        else if (r instanceof Option.None) onFailure(new ReferenceError("This option is None."));
                        else if (r instanceof Promise) r.then((v: any) => onSuccess(v)).catch((e: Error) => onFailure(e))
                        else onSuccess(r);
                    }
                }

            } else {

                Pool.acquire()
                    .then((cp: Pool.IChildProcess) => {

                        cp.addListener ((r: Either<Error, T>) => {
                            (cp.isDestroyable && Pool.destroy || Pool.release)(cp);
                            (r.isRight() && onSuccess || onFailure)(r.get());
                        });

                        cp.send(wrap.func, accumulator, this._callerFileName);
                    })
                    .catch(err => {
                        throw err;
                    });
            }

        } catch (err) {
            log.error(err);
            resolve(Either.left<Error, T>(err));
        }
    }
}


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

function isGeneratorFunction(obj: any) {
    const constructor = obj.constructor;
    if (! constructor) return false;
    return "GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName;
}
