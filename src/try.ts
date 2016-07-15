
import Either from "./either";
import * as log from "./libs/log";

/**
 * The Try function interface.
 */
export interface TryFunction<T,U> extends Function {
    name: string;
    length: number;
    prototype: any;
    constructor(v?: T): U;
}

/**
 * The Try module interface.
 */
export interface Try <T> {

    /**
     * And then, run the given function.
     */
    andThen  <I,O> (func: TryFunction<I,O>): Try<T>;

    /**
     * And then, fork a new process, run the given function.
     */
    andThenFork  <I,O> (func: TryFunction<I,O>): Try<T>;

    /**
     * Returns a Promise with the Either result.
     */
    get (): Promise<Either<T>>;

    /**
     * Returns a Promise with the right-biased Either, or executes
     * the given function.
     */
    getOrElse (func: TryFunction<void,T>): Promise<Either<T>>;

    /**
     * Returns a Promise with the right-biased Either, or executes
     * the given function in a forked process.
     */
    getOrElseFork (func: TryFunction<void,T>): Promise<Either<T>>;

    /**
     * Returns a Promise with the right-biased Either, or returns
     * a left-biased Either with the given Error.
     */
    getOrThrow (err?: Error): Promise<Either<T>>;

    /**
     * Returns the Try as a curried function, with the option to
     * pass an initial value.
     */
    toCurried (): (initialValue?: any) => Promise<Either<T>>;
}

/**
 * The Try module.
 */
export namespace Try {

    /**
     * Runs the given function.
     */
    export function of <T> (func: TryFunction<void,any>, initialValue?: any): Try<T> {
        return new TryClass <T> ({isFork: false, func}, _getCallerFile(), initialValue);
    }

    /**
     * Runs the given function in a forked child process.
     */
    export function ofFork <T> (func: TryFunction<void,any>, initialValue?: any): Try<T> {
        return new TryClass <T> ({isFork: true, func}, _getCallerFile(), initialValue);
    }
}

/******************************************************************************
 * Private Objects
 */

import * as Pool from "./libs/child_context_pool";
import * as path from "path";


interface IFuncWrapper<T,U> {
    isFork: boolean;
    func: TryFunction<T,U>;
}


/**
 * 
 */
class TryClass<T> implements Try<T> {

    private _funcStack: Array<IFuncWrapper<any,any>> = [];
    private _initialValue: any;
    private _callerFileName: string;

    constructor (func: IFuncWrapper<void,any>, callerFileName: string, initialValue?: any) {
        this._initialValue = initialValue;
        this._callerFileName = callerFileName;
        this._funcStack = [func];
    }

    public andThen <I,O> (func: TryFunction<I,O>): TryClass<T> {
        this._funcStack.push({isFork: false, func});
        return this;
    }

    public andThenFork <I,O> (func: TryFunction<I,O>): TryClass<T> {
        this._funcStack.push({isFork: false, func});
        return this;
    }

    public get (): Promise<Either<T>> {

        return new Promise((resolve, reject) => {
            this._executeFuncStack(resolve, this._initialValue);
        });
    }

    public getOrElse (func: TryFunction<void,T>): Promise<Either<T>> {

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

    public getOrElseFork (func: TryFunction<void,T>): Promise<Either<T>> {

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

    public getOrThrow (err?: Error): Promise<Either<T>> {

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

    public toCurried (): (initialValue?: any) => Promise<Either<T>> {
        return (initialValue?: any) => {
            this._initialValue = initialValue;
            return this.get();
        }
    }

    private _executeFuncStack<T> (resolve: (v: Either<T>) => void, accumulator?: any) {

        if (! this._funcStack.length) {
            resolve(Either.Right<T>(accumulator));
            return;
        }
        
        ((func: IFuncWrapper<any,any>, acc: any) => {

            try {
                
                let Success = (r: any) => {
                    this._executeFuncStack(resolve, r);
                };

                let Failure = (e: Error) => {
                    resolve(Either.Left<T>(e));
                };

                // If not fork, run the script in this thread.
                // If process.env.__TRYJS_IN_FORK, already in child process.
                if (! func.isFork || !! process.env.__TRYJS_IN_FORK) {

                    const r = func.func.call({Success, Failure}, accumulator);

                    if (r !== undefined) {

                        if (r instanceof Either) {
                            (r.isRight() && Success || Failure)(r.get());
                        } else if (r instanceof Promise) {
                            r.then((v: T) => Success(v)).catch((e: Error) => Failure(e))
                        } else {
                            Success(r);
                        }

                        Success = Failure = function () {};
                    }

                    return;
                }

                Pool.acquire()
                    .then((cp: Pool.IChildProcess) => {
            
                        cp.addListener ((r: Either<T>) => {
                            (cp.isDestroyable && Pool.destroy || Pool.release)(cp);
                            (r.isRight() && Success || Failure)(r.get());
                        });

                        cp.send(func.func, acc, this._callerFileName);
                    })
                    .catch(err => {
                        throw err;
                    });

            } catch (err) {
                log.error(err);
                resolve(Either.Left<T>(err));
            }

        })(this._funcStack.shift(), accumulator);
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
            if(currentfile !== callerfile) break;
        }
    } catch (e) {}

    Error.prepareStackTrace = originalFunc; 

    return callerfile;
}
