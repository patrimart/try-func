import { Either } from "./either";
import { Option } from "./option";
export declare type TryFunctionReturn<T> = Promise<T> | Either<Error, T> | Option<T> | T;
export interface TryFunction<T, U extends TryFunctionReturn<U>> extends Function {
    name?: string;
    length: number;
    prototype: any;
}
export interface ISubscription {
    unsubscribe(): void;
}
export interface Try<T> {
    andThen<I, O>(func: TryFunction<I, O>): this;
    andThenFork<I, O>(func: TryFunction<I, O>): this;
    get(): Promise<Either<Error, T>>;
    getOrElse<I>(func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>;
    getOrElseFork<I>(func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>;
    getOrThrow(err?: Error): Promise<Either<Error, T>>;
    subscribe(onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): ISubscription;
    toCurried(): (initialValue?: any) => Promise<Either<Error, T>>;
}
export declare namespace Try {
    function of<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
    function ofFork<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
}
