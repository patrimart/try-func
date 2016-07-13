export declare class Either<R> {
    private left;
    private right;
    static Left<R>(err: Error): Either<R>;
    static Right<R>(right: R): Either<R>;
    constructor(left: Error, right: R);
    isLeft(): boolean;
    isRight(): boolean;
    get(): R | Error;
    getLeft(): Error;
    getRight(): R;
    getOrElse(right: R | (() => R)): R;
    getOrThrow(): R;
    toString(): string;
    toObject(): {
        left: Error;
        right: R;
    };
    toJSON(): {
        left: string;
        right: R;
    };
}
