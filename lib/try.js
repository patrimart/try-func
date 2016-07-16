"use strict";
var either_1 = require("./either");
var log = require("./libs/log");
var Try;
(function (Try) {
    function of(func, initialValue) {
        return new TryClass({ isFork: false, func: func }, _getCallerFile(), initialValue);
    }
    Try.of = of;
    function ofFork(func, initialValue) {
        return new TryClass({ isFork: true, func: func }, _getCallerFile(), initialValue);
    }
    Try.ofFork = ofFork;
})(Try = exports.Try || (exports.Try = {}));
var co = require("co");
var Pool = require("./libs/child_context_pool");
var TryClass = (function () {
    function TryClass(func, callerFileName, initialValue) {
        this._funcStack = [];
        this._initialValue = initialValue;
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
            resolve(either_1.Either.Right(accumulator));
            return;
        }
        (function (wrap, acc) {
            try {
                var isWaitingResponse_1 = true;
                var Success_1 = function (r) {
                    if (isWaitingResponse_1) {
                        console.log("SUCCESS");
                        _this._executeFuncStack(resolve, r);
                        isWaitingResponse_1 = false;
                    }
                };
                var Failure_1 = function (e) {
                    if (isWaitingResponse_1) {
                        resolve(either_1.Either.Left(e));
                        isWaitingResponse_1 = false;
                    }
                };
                if (!wrap.isFork || !!process.env.__TRYJS_IN_FORK) {
                    if (isGeneratorFunction(wrap.func)) {
                        co(wrap.func.bind({ Success: Success_1, Failure: Failure_1 }, accumulator))
                            .then(function (r) {
                            if (r instanceof either_1.Either)
                                (r.isRight() && Success_1 || Failure_1)(r.get());
                            else if (r instanceof Promise)
                                r.then(function (v) { return Success_1(v); }).catch(function (e) { return Failure_1(e); });
                            else
                                Success_1(r);
                        })
                            .catch(function (err) { return Failure_1(err); });
                    }
                    else {
                        var r = wrap.func.call({ Success: Success_1, Failure: Failure_1 }, accumulator);
                        if (r !== undefined) {
                            if (r instanceof either_1.Either)
                                (r.isRight() && Success_1 || Failure_1)(r.get());
                            else if (r instanceof Promise)
                                r.then(function (v) { return Success_1(v); }).catch(function (e) { return Failure_1(e); });
                            else
                                Success_1(r);
                        }
                    }
                }
                else {
                    Pool.acquire()
                        .then(function (cp) {
                        cp.addListener(function (r) {
                            (cp.isDestroyable && Pool.destroy || Pool.release)(cp);
                            (r.isRight() && Success_1 || Failure_1)(r.get());
                            Success_1 = Failure_1 = function () { };
                        });
                        cp.send(wrap.func, acc, _this._callerFileName);
                    })
                        .catch(function (err) {
                        throw err;
                    });
                }
            }
            catch (err) {
                log.error(err);
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
function isGeneratorFunction(obj) {
    var constructor = obj.constructor;
    if (!constructor)
        return false;
    return "GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName;
}
//# sourceMappingURL=try.js.map