export declare function onComplete(callback?: (err: Error) => void): void;
export declare function onNext(r: any, callback?: (err: Error) => void): void;
export declare function onFailure(e: Error, callback?: (err: Error) => void): void;
export declare function onFatalException(e: Error, callback?: (err: Error) => void): void;
