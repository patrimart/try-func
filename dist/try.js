"use strict";
var either_1 = require("./either");
var Pool = require("./child_context_pool");
var Try;
(function (Try) {
    function of(func) {
        return new TryClass({ isFork: false, func: func }, _getCallerFile());
    }
    Try.of = of;
    function ofFork(func) {
        return new TryClass({ isFork: true, func: func }, _getCallerFile());
    }
    Try.ofFork = ofFork;
})(Try = exports.Try || (exports.Try = {}));
var TryClass = (function () {
    function TryClass(func, callerFileName) {
        this._funcStack = [];
        this._callerFileName = callerFileName;
        this._funcStack = [func];
    }
    TryClass.prototype.andThen = function (func) {
        this._funcStack.push({ isFork: false, func: func });
        return this;
    };
    TryClass.prototype.andThenFork = function (func) {
        this._funcStack.push({ isFork: false, func: func });
        return this;
    };
    TryClass.prototype.get = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._executeFuncStack(resolve, _this._initialValue);
        });
    };
    TryClass.prototype.getOrElse = function (func) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.get()
                .then(function (r) {
                if (r.isRight()) {
                    resolve(r);
                }
                else {
                    _this._funcStack = [{ isFork: false, func: func }];
                    _this._executeFuncStack(resolve);
                }
            });
        });
    };
    TryClass.prototype.getOrElseFork = function (func) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.get()
                .then(function (r) {
                if (r.isRight()) {
                    resolve(r);
                }
                else {
                    _this._funcStack = [{ isFork: true, func: func }];
                    _this._executeFuncStack(resolve);
                }
            });
        });
    };
    TryClass.prototype.getOrThrow = function (err) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.get()
                .then(function (r) {
                if (r.isRight()) {
                    resolve(r);
                }
                else {
                    reject(err || r.getLeft());
                }
            });
        });
    };
    TryClass.prototype.toCurried = function () {
        var _this = this;
        return function (initialValue) {
            _this._initialValue = initialValue;
            return _this.get();
        };
    };
    TryClass.prototype._executeFuncStack = function (resolve, accumulator) {
        var _this = this;
        if (!this._funcStack.length) {
            if (this._child) {
                this._child.kill();
            }
            resolve(either_1.Either.Right(accumulator));
            return;
        }
        var ok = function (r) {
            _this._executeFuncStack(resolve, r);
        };
        var error = function (e) {
            resolve(either_1.Either.Left(e));
        };
        (function (func, acc) {
            try {
                if (!func.isFork || !!process.env.__TRYJS_IN_FORK) {
                    var r = func.func.call({ ok: ok, error: error }, accumulator);
                    if (r !== undefined) {
                        if (r instanceof either_1.Either) {
                            (r.isRight() && ok || error)(r.get());
                        }
                        else if (r instanceof Promise) {
                            r.then(function (v) { return ok(v); }).catch(function (e) { return error(e); });
                        }
                        else {
                            ok(r);
                        }
                    }
                    return;
                }
                Pool.acquire()
                    .then(function (cp) {
                    cp.addListener(function (r) {
                        (cp.isDestroyable && Pool.destroy || Pool.release)(cp);
                        (r.isRight() && ok || error)(r.get());
                    });
                    cp.send(func.func, acc, _this._callerFileName);
                })
                    .catch(function (err) {
                    throw err;
                });
            }
            catch (err) {
                console.log(err, err.stack);
                resolve(either_1.Either.Left(err));
            }
        })(this._funcStack.shift(), accumulator);
    };
    return TryClass;
}());
function _getCallerFile() {
    var originalFunc = Error.prepareStackTrace;
    var callerfile;
    try {
        var err = new Error();
        var currentfile = void 0;
        Error.prepareStackTrace = function (err, stack) { return stack; };
        currentfile = err.stack.shift().getFileName();
        while (err.stack.length) {
            callerfile = err.stack.shift().getFileName();
            if (currentfile !== callerfile)
                break;
        }
    }
    catch (e) { }
    Error.prepareStackTrace = originalFunc;
    return callerfile;
}
//# sourceMappingURL=try.js.map