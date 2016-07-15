
/**
 * The Either<R> class.
 */
export default class Either <R> {

    /**
     * Creates a left-biased Either with the given error.
     * @returns {Either<R>}
     */
    public static Left<R> (err: Error): Either<R> {
        return new Either(err, undefined);
    }

    /**
     * Creates a rigt-biased Either with the given value.
     * @returns {Either<R>}
     */
    public static Right<R> (right: R): Either<R> {
        return new Either(undefined, right);
    }

    /**
     * Instantiates a new Either instance.
     * @param {Error | undefined} left - the left error value.
     * @param {R | undefined} right - the right value.
     */
    constructor (private left: Error, private right: R) {}

    /**
     * Is this a left-biased Either.
     * @returns {boolean}
     */
    public isLeft (): boolean {
        return !! this.left;
    }

    /**
     * Is this a right-biased Either.
     * @returns {boolean}
     */
    public isRight (): boolean {
        return !! this.right;
    }

    /**
     * Returns the left or right value.
     * @returns {R | Error}
     */
    public get (): R | Error {
        return this.right || this.left;
    }

    /**
     * Returns the left value, or undefined.
     * @returns {Error | undefined}
     */
    public getLeft (): Error {
        return this.left;
    }

    /**
     * Returns the right value, or undefined.
     * @returns {R | undefined}
     */
    public getRight (): R {
        return this.right;
    }

    /**
     * If right, returns the right value. If left, returns the given parameter value.
     * @param {R | (() => R)} right - the value to return if left-biased.
     * @returns {R}
     */
    public getOrElse(right: R | (() => R)): R {
        if (this.isRight()) {
            return this.right;
        }
        if (typeof right === "function") {
            return (right as () => R)();
        }
        return right as R;
    }

    /**
     * If right-biased, returns the right value. If left-biased, throws the error.
     * @returns {R}
     */
    public getOrThrow (): R {
        if (this.left) {
            throw this.left;
        }
        return this.right;
    }

    /**
     * Returns the Either as a string.
     * @returns {string} '{"right": R}' or '{"left": string}'
     */
    public toString(): string {
        return JSON.stringify(this.toJSON());
    }

    /**
     * Returs the Either as a plain-old JS object.
     * @returns {{left: Error | undefined; right: R | undefined;}}
     */
    public toObject (): {left: Error; right: R;} {
        return {
            left: this.left,
            right: this.right,
        }
    }

    /**
     * Returns the Either as a JSON object.
     * @returns {{left?: Error; right?: R;}}
     */
    public toJSON (): {left: string; right: R;} {
        return {
            left : this.left ? this.left.message : undefined,
            right: this.right,
        };
    }
}
