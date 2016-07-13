
import {Either} from "./either";

/**
 * 
 */
export interface TryFunction<T,U> extends Function {
    name: string;
    length: number;
    prototype: any;
    constructor(v?: T): U;
}

/**
 * 
 */
export interface Try<T> {

    /**
     * 
     */
    andThen  <I,O> (func: TryFunction<I,O>): Try<T>;

    /**
     * 
     */
    andThenFork  <I,O> (func: TryFunction<I,O>): Try<T>;

    /**
     * 
     */
    get (): Promise<Either<T>>;

    /**
     * 
     */
    getOrElse (func: TryFunction<void,T>): Promise<Either<T>>;

    /**
     * 
     */
    getOrElseFork (func: TryFunction<void,T>): Promise<Either<T>>;

    /**
     * 
     */
    getOrThrow (err?: Error): Promise<Either<T>>;

    /**
     * 
     */
    toCurried (): (initialValue?: any) => Promise<Either<T>>;
}

/**
 * 
 */
export namespace Try {

    /**
     * 
     */
    export function of <T> (func: TryFunction<void,any>): Try<T> {
        return new TryClass <T> ({isFork: false, func}, _getCallerFile());
    }

    /**
     * 
     */
    export function  ofFork <T> (func: TryFunction<void,any>): Try<T> {
        return new TryClass <T> ({isFork: true, func}, _getCallerFile());
    }
}

/******************************************************************************
 * Private Objects
 */

import * as child_process from "child_process";
import * as path from "path";


interface IFuncWrapper<T,U> {
    isFork: boolean;
    func: TryFunction<T,U>;
}

declare var global: any;

/**
 * 
 */
class TryClass<T> implements Try<T> {

    private _child: child_process.ChildProcess;

    private _funcStack: Array<IFuncWrapper<any,any>> = [];
    private _initialValue: any;
    private _callerFileName: string;

    constructor (func: IFuncWrapper<void,any>, callerFileName: string) {
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
            if (this._child) {
                this._child.kill();
            }
            resolve(Either.Right<T>(accumulator));
            return;
        }

        ((func: IFuncWrapper<any,any>, acc: any) => {

            const ok = (r: any) => {
                this._executeFuncStack(resolve, r);
            }

            const error = (e: Error) => {
                resolve(Either.Left<T>(e));
            }
            
            try {

                if (! func.isFork) {

                    const r = func.func.call({ok, error}, accumulator);

                    if (r !== undefined) {

                        if (r instanceof Promise) {
                            r.then((v: T) => ok(v)).catch((e: Error) => error(e))
                        } else {
                            ok(r);
                        }
                    }
                    return;
                }

                if (! this._child) {
                    this._child = child_process.fork(`${__dirname}/child_context`, ["special"], { env: { __TRYJS_ROOT_DIR: this._callerFileName}});
                    this._child.on("message", (m: [string, any]) => {
                        if (m[0]) {
                            error(new Error(m[0]));
                        } else {
                            ok(m[1]);
                        }
                    });
                    this._child.on("error", (err: Error) => {
                        error(err);
                        this._child.kill();
                        this._child = null;
                    });
                    this._child.on("exit", () => {
                        this._child = null;
                    });
                }

                this._child.send({func: func.func.toString(), data: acc});

            } catch (err) {
                console.log(err, err.stack);
                error(err);
            }

        })(this._funcStack.shift(), accumulator);
    }
}


declare var Error: any;

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

// function MyError () {
//     Error.call(this);
// }

// MyError.prototype = Object.create(Error.prototype);
// MyError.prototype.constructor = MyError;

// MyError.prepareStackTrace = function (err: any, stack: any) { return stack; };

// class MyError extends Error {

//     public static prepareStackTrace (err: any, stack: any) { return stack; };

//     public name = "MyError";
//     constructor (public message?: string) {
//         super(message);
//     }
// }

// function _getCallerFile() {

//     let callerfile: string;
//     try {
//         let err = new MyError();
//         let currentfile: string = err.stack.shift().getFileName();

//         while (err.stack.length) {
//             callerfile = err.stack.shift().getFileName();
//             if(currentfile !== callerfile) break;
//         }
//     } catch (e) {}

//     return callerfile;
// }

