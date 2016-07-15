import Either from "./either";
export interface TryFunction<T, U> extends Function {
    name: string;
    length: number;
    prototype: any;
    constructor(v?: T): U;
}
export interface Try<T> {
    andThen<I, O>(func: TryFunction<I, O>): Try<T>;
    andThenFork<I, O>(func: TryFunction<I, O>): Try<T>;
    get(): Promise<Either<T>>;
    getOrElse(func: TryFunction<void, T>): Promise<Either<T>>;
    getOrElseFork(func: TryFunction<void, T>): Promise<Either<T>>;
    getOrThrow(err?: Error): Promise<Either<T>>;
    toCurried(): (initialValue?: any) => Promise<Either<T>>;
}
export declare namespace Try {
    function of<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
    function ofFork<T>(func: TryFunction<void, any>, initialValue?: any): Try<T>;
}
