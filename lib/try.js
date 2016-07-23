"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var either_1 = require("./either");
var option_1 = require("./option");
var log = require("./libs/log");
var Try;
(function (Try) {
    function of(func, initialValue) {
        var runner = new TryLocal(func);
        return new TryClass(runner, _getCallerFile(), initialValue);
    }
    Try.of = of;
    function ofFork(func, initialValue) {
        var runner = new TryFork(func, _getCallerFile());
        return new TryClass(runner, _getCallerFile(), initialValue);
    }
    Try.ofFork = ofFork;
})(Try = exports.Try || (exports.Try = {}));
var co = require("co");
var Pool = require("./libs/child_context_pool");
var TryClass = (function () {
    function TryClass(head, callerFileName, initialValue) {
        this.head = head;
        this.callerFileName = callerFileName;
        this.initialValue = initialValue;
        this.last = head;
    }
    TryClass.prototype.andThen = function (func) {
        var runner = new TryLocal(func);
        this.last.setNext(runner);
        runner.setPrevious(this.last);
        this.last = runner;
        return this;
    };
    TryClass.prototype.andThenFork = function (func) {
        var runner = new TryFork(func, this.callerFileName);
        this.last.setNext(runner);
        runner.setPrevious(this.last);
        this.last = runner;
        return this;
    };
    TryClass.prototype.get = function () {
        var _this = this;
        return new Promise(function (resolve, _) {
            _this.head.run(_this.initialValue, function (next) {
                _this.head.complete();
                if (next)
                    resolve(next);
            });
        });
    };
    TryClass.prototype.getOrElse = function (func, value) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.get()
                .then(function (r) {
                if (r.isRight()) {
                    resolve(r);
                }
                else {
                    var runner = new TryLocal(func);
                    runner.run(value, function (next) { return resolve(next); });
                }
            });
        });
    };
    TryClass.prototype.getOrElseFork = function (func, value) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.get()
                .then(function (r) {
                if (r.isRight()) {
                    resolve(r);
                }
                else {
                    var runner = new TryFork(func, _this.callerFileName);
                    runner.run(value, function (next) { return resolve(next); });
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
            return new Promise(function (resolve, _) {
                _this.head.run(initialValue, function (next) {
                    _this.head.complete();
                    resolve(next);
                });
            });
        };
    };
    return TryClass;
}());
var TryLocal = (function () {
    function TryLocal(func) {
        this.func = func;
        this._id = Math.random().toString(36).substr(2);
    }
    Object.defineProperty(TryLocal.prototype, "id", {
        get: function () {
            return this._id;
        },
        enumerable: true,
        configurable: true
    });
    TryLocal.prototype.setPrevious = function (f) {
        this.prev = f;
    };
    TryLocal.prototype.setNext = function (f) {
        this.next = f;
    };
    TryLocal.prototype.isComplete = function (prevComplete) {
        return this.next ? this.next.isComplete(prevComplete && true) : prevComplete && true;
    };
    TryLocal.prototype.complete = function () {
        if (this.next)
            this.next.complete();
    };
    TryLocal.prototype.run = function (accumulator, callback) {
        var _this = this;
        var isWaitingResponse = true;
        var onComplete = function (r) {
            if (!isWaitingResponse)
                return log.error(new Error("Complete has already been invoked."));
            var resp = r;
            if (r instanceof either_1.Either.Right)
                resp = r.get();
            else if (r instanceof either_1.Either.Left)
                return callback(either_1.Either.left(new ReferenceError("This either is Left.")));
            else if (r instanceof option_1.Option.Some)
                resp = r.get();
            else if (r instanceof option_1.Option.None)
                return callback(either_1.Either.left(new ReferenceError("This option is None.")));
            else if (r instanceof Promise) {
                return r.then(function (v) { return onComplete(r); }).catch(function (e) { return callback(either_1.Either.left(e)); });
            }
            isWaitingResponse = false;
            if (_this.next) {
                _this.next.run(resp, callback);
            }
            else {
                callback(either_1.Either.right(resp));
            }
        };
        var onNext = onComplete;
        try {
            if (isGeneratorFunction(this.func)) {
                co(this.func.bind({ Complete: onComplete, Next: onNext }, accumulator))
                    .then(function (r) { if (r !== undefined)
                    onNext(r); })
                    .catch(function (err) { return onNext(either_1.Either.left(err)); });
            }
            else {
                var r = this.func.call({ Complete: onComplete, Next: onNext }, accumulator);
                if (r !== undefined)
                    onNext(r);
            }
        }
        catch (err) {
            onNext(either_1.Either.left(err));
        }
    };
    return TryLocal;
}());
var TryFork = (function (_super) {
    __extends(TryFork, _super);
    function TryFork(func, callerFileName) {
        _super.call(this, func);
        this.callerFileName = callerFileName;
        this._isComplete = false;
    }
    TryFork.prototype.isComplete = function (prevComplete) {
        return this.next ? this.next.isComplete(prevComplete && this._isComplete) : prevComplete && this._isComplete;
    };
    TryFork.prototype.complete = function () {
        if (!this._isComplete) {
            this._isComplete = true;
            if (this._currentProcess) {
                Pool.destroy(this._currentProcess);
                this._currentProcess = null;
            }
            if (this.next)
                this.next.complete();
        }
    };
    TryFork.prototype.run = function (accumulator, callback) {
        var _this = this;
        var onNext = function (r) {
            if (_this.next)
                _this.next.run(r, callback);
            else
                callback(either_1.Either.right(r));
        };
        var onFailure = function (e) {
            callback(either_1.Either.left(e));
        };
        try {
            if (this._currentProcess)
                return this._currentProcess.send(this.func, accumulator, this.callerFileName);
            Pool.acquire()
                .then(function (cp) {
                _this._isComplete = false;
                _this._currentProcess = cp;
                cp.addListener(function (r) {
                    if (cp.isDestroyable) {
                        _this._currentProcess = null;
                    }
                    else if (cp.isComplete) {
                        _this._currentProcess = null;
                        _this._isComplete = true;
                    }
                    if (r instanceof either_1.Either)
                        r.isRight() ? onNext(r.getRight()) : onFailure(r.getLeft());
                });
                cp.send(_this.func, accumulator, _this.callerFileName);
            })
                .catch(function (err) {
                throw err;
            });
        }
        catch (err) {
            onFailure(err);
        }
    };
    return TryFork;
}(TryLocal));
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