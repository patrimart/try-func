"use strict";
var Either = (function () {
    function Either(left, right) {
        this.left = left;
        this.right = right;
    }
    Either.Left = function (err) {
        return new Either(err, undefined);
    };
    Either.Right = function (right) {
        return new Either(undefined, right);
    };
    Either.prototype.isLeft = function () {
        return !!this.left;
    };
    Either.prototype.isRight = function () {
        return !!this.right;
    };
    Either.prototype.get = function () {
        return this.right || this.left;
    };
    Either.prototype.getLeft = function () {
        return this.left;
    };
    Either.prototype.getRight = function () {
        return this.right;
    };
    Either.prototype.getOrElse = function (right) {
        if (this.isRight()) {
            return this.right;
        }
        if (typeof right === "function") {
            return right();
        }
        return right;
    };
    Either.prototype.getOrThrow = function () {
        if (this.left) {
            throw this.left;
        }
        return this.right;
    };
    Either.prototype.toString = function () {
        return JSON.stringify(this.toJSON());
    };
    Either.prototype.toObject = function () {
        return {
            left: this.left,
            right: this.right,
        };
    };
    Either.prototype.toJSON = function () {
        return {
            left: this.left ? this.left.message : undefined,
            right: this.right,
        };
    };
    return Either;
}());
exports.Either = Either;
//# sourceMappingURL=either.js.map