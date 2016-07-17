import { Either } from "./either";
import { Option } from "./option";
export declare type TryFunctionReturn<U extends string | number | boolean | {} | void> = Promise<U> | Either<Error, U> | Option<U> | string | number | boolean | Array<U> | {} | void;
export interface TryFunction<T, U extends TryFunctionReturn<U>> extends Function {
    name: string;
    length: number;
    prototype: any;
    constructor(v?: T): U;
}
export interface Try<T> {
    andThen<I, O>(func: TryFunction<I, O>): Try<T>;
    andThenFork<I, O>(func: TryFunction<I, O>): Try<T>;
    get(): Promise<Either<Error, T>>;
    getOrElse(func: TryFunction<void, T>): Promise<Either<Error, T>>;
    getOrElseFork(func: TryFunction<void, T>): Promise<Either<Error, T>>;
    getOrThrow(err?: Error): Promise<Either<Error, T>>;
    toCurried(): (initialValue?: any) => Promise<Either<Error, T>>;
}
export declare namespace Try {
    function of<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
    function ofFork<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
}
