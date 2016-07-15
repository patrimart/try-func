import { TryFunction } from "./Try";
import Either from "./Either";
export interface IChildProcess {
    isDestroyable: boolean;
    addListener<T>(f: (r: Either<T>) => void): void;
    send<T, U>(func: TryFunction<T, U>, data: any, callerFileName: string): void;
    release(): void;
    destroy(): void;
}
export declare function acquire(): Promise<any>;
export declare function release(cp: IChildProcess): void;
export declare function destroy(cp: IChildProcess): void;
