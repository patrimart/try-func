
import {Option} from "./option";

/**
 * The Either<L, R> abstract class.
 */
export abstract class Either <L, R> {

    abstract getOrElse (f: () => R): R;
    abstract getOrElseGet (right: R): R;
    abstract getOrThrow (err?: Error): R;
    abstract orElse (f: () => Either<L, R>): Either<L, R>;
    abstract toObject (): {left?: L; right?: R};

    /**
     * Is this a Left.
     * @returns {boolean}
     */
    public isLeft (): boolean { return false; }

    /**
     * Is this a Right.
     * @returns {boolean}
     */
    public isRight (): boolean { return false; }

    /**
     * Throws a ReferenceError.
     */
    public get (): R {
        throw new ReferenceError("This is a Left either.")
    }

    /**
     * Returns an undefined Left value.
     * @returns {L}
     */
    public getLeft (): L { return undefined; }

    /**
     * Returns an undefined Right value.
     * @returns {R}
     */
    public getRight (): R { return undefined; }

    /**
     * Returns an Option.None<R>.
     * @returns {Option<R>}
     */
    public toOption (): Option<R> {
        return Option.none<R>();
    }

    /**
     * Tests equality of Eithers.
     * @params {Either<L, R>} other - the other Either to test
     * @returns {boolean}
     */
    public equals (other: Either<L, R>): boolean {
        if (! other) return false;
        if (this === other) return true;
        return this.getRight() === this.getRight() && this.getLeft() === this.getLeft();
    }

    /**
     * Returns the Either as a JSON object.
     * @returns {{left?: L; right?: R}}
     */
    public toJSON (): {left?: L; right?: R} {
        return this.toObject();
    }

    /**
     * Returns the Either as a string.
     * @returns {string} '{"right": R}' or '{"left": L}'
     */
    public toString (): string {
        return JSON.stringify(this.toJSON());
    }
}

/**
 * The Either namespace.
 */
export namespace Either {

    /**
     * Returns a new Either.Left<L, R> instance.
     * @returns {Either.Left<L, R>}
     */
    export function left <L, R> (left: L) {
        return new Left<L, R>(left);
    }

    /**
     * Returns a new Either.Right<L, R> instance.
     * @returns {Either.Right<L, R>}
     */
    export function right <L, R> (right: R) {
        return new Right<L, R>(right);
    }

    /**
     * Returns the singleton instance of Either.Left<void, void>.
     * @returns {Either.Left<void, void>}
     */
    export function nothing () {
        return nothingEither;
    }

    /**
     * The Either.Left<L, R> class.
     */
    export class Left <L, R> extends Either <L, R> {

        constructor (private left: L) {
            super();
        }

        /**
         * Returns that this is a Left.
         * @returns {boolean}
         */
        public isLeft (): boolean {
            return true;
        }

        /**
         * Returns the Left value.
         * @returns {L}
         */
        public getLeft (): L {
            return this.left;
        }

        /**
         * Returns the evaluated given function.
         * @param {() => R} f - the or else function to evaluate
         * @returns {R}
         */
        public getOrElse (f: () => R): R {
            return f();
        }

        /**
         * Returns the given R value.
         * @param {R} right - the or else value
         * @returns {R}
         */
        public getOrElseGet (right: R): R {
            return right;
        }

        /**
         * Throws a ReferenceError or the given Error.
         * @param {Error} [err] - the optional Error to throw
         * @returns {R}
         */
        public getOrThrow (err?: Error): R {
            throw err || new ReferenceError("This is a Left either.")
        }

        /**
         * Returns the evaluated function.
         * @param {() => Either<L, R>} f - the or else function to evaluate
         * @returns {Either<L, R>}
         */
        public orElse (f: () => Either<L, R>): Either<L, R> {
            return f();
        }

        /**
         * Returns an Option.None<R>.
         * returns {Option<R>}
         */
        public toOption (): Option<R> {
            return Option.none<R>();
        }

        /**
         * Returs the Either as a plain-old JS object.
         * @returns {{left: L}}
         */
        public toObject (): {left?: L; right?: R} {
            return { left : this.left };
        }
    }

    /**
     * The Either.Right<L, R> class.
     */
    export class Right <L, R> extends Either <L, R> {

        constructor (private right: R) {
            super();
        }

        /**
         * This is a Right.
         * @returns {boolean}
         */
        public isRight (): boolean {
            return true;
        }

        /**
         * Returns the Right value.
         * @returns {R}
         */
        public get (): R {
            return this.right;
        }

        /**
         * Returns the Right value.
         * @returns {R}
         */
        public getRight (): R {
            return this.right;
        }

        /**
         * Returns the Right value.
         * @param {() => R} f - the function to evaluate if Left
         * @returns {R}
         */
        public getOrElse (f: () => R): R {
            return this.right;
        }

        /**
         * Returns the Right value.
         * @param {R} right - the value to return if Left
         * @return {R}
         */
        public getOrElseGet (right: R): R {
            return this.right;
        }

        /**
         * Returns the Right value.
         * @returns {R}
         */
        public getOrThrow (): R {
            return this.right;
        }

        /**
         * Returns this Right.
         * @param {Either<L, R>} f - the function to evaluate if Left
         * @returns {Either<L, R>}
         */
        public orElse (f: () => Either<L, R>): Either<L, R> {
            return this;
        }

        /**
         * Returns an Option.Some<R>.
         * @returns {Option<R>}
         */
        public toOption (): Option<R> {
            return Option.some<R>(this.right);
        }

        /**
         * Returs the Either as a plain-old JS object.
         * @returns {{left: L | undefined; right: R | undefined;}}
         */
        public toObject (): {left?: L; right?: R} {
            return { right: this.right };
        }
    }

    const nothingEither = new Left<void, void>(void(0));
}
