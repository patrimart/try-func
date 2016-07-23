"use strict";
var child_process = require("child_process");
var generic_pool_1 = require("generic-pool");
var either_1 = require("../either");
var log = require("./log");
var ChildProcess = (function () {
    function ChildProcess() {
        var _this = this;
        this._isDestroyable = false;
        this._isComplete = false;
        this._child = child_process.fork(__dirname + "/child_context", ["special"], { env: { __TRYJS_IN_FORK: true, TRYJS_DEBUG: process.env.TRYJS_DEBUG } });
        this._child.on("message", function (m) {
            if (_this._emitter) {
                _this._isDestroyable = m[2];
                _this._isComplete = m[3];
                if (_this._isComplete) {
                    _this._emitter(null, true);
                    release(_this);
                }
                else if (_this._isDestroyable) {
                    _this._emitter(null, true);
                    destroy(_this);
                }
                else {
                    _this._child.send("REQUEST_NEXT_ITEM");
                    if (m[0]) {
                        _this._emitter(either_1.Either.left(new Error(m[0])));
                    }
                    else {
                        _this._emitter(either_1.Either.right(m[1]));
                    }
                }
            }
        });
        this._child.on("exit", function (code, signal) {
            _this._isDestroyable = true;
            _this._isComplete = true;
            if (_this._emitter)
                _this._emitter(either_1.Either.left(new Error("child_process exit(" + code + ", " + signal + ")")));
            _this._child = null;
        });
    }
    Object.defineProperty(ChildProcess.prototype, "pid", {
        get: function () {
            return this._child && this._child.pid;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ChildProcess.prototype, "isDestroyable", {
        get: function () {
            return this._isDestroyable;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(ChildProcess.prototype, "isComplete", {
        get: function () {
            return this._isComplete;
        },
        enumerable: true,
        configurable: true
    });
    ChildProcess.prototype.send = function (func, data, callerFileName) {
        if (this._child)
            this._child.send({ func: func.toString(), data: data, callerFileName: callerFileName });
    };
    ChildProcess.prototype.addListener = function (f) {
        this._emitter = f;
    };
    ChildProcess.prototype.release = function () {
        this._isComplete = true;
        this._isDestroyable = false;
        this._emitter = null;
    };
    ChildProcess.prototype.destroy = function () {
        this._isDestroyable = true;
        this._emitter = null;
        if (this._child) {
            this._child.removeAllListeners();
            this._child.kill();
            this._child = null;
        }
    };
    ChildProcess.prototype.reset = function () {
        this._isComplete = false;
        this._isDestroyable = false;
        this._emitter = null;
    };
    return ChildProcess;
}());
var pool = new generic_pool_1.Pool({
    name: "child_context_pool_" + Math.random().toString(36).substr(2),
    create: function (callback) { return callback(null, new ChildProcess()); },
    destroy: function (cp) { return cp.destroy(); },
    max: 1,
    min: 1,
    refreshIdle: true,
    idleTimeoutMillis: +process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: +process.env.TRYJS_FORK_POOL_REAP || 3333,
    returnToHead: true,
    log: false,
});
function acquire() {
    return new Promise(function (resolve, reject) {
        pool.acquire(function (err, cp) {
            if (err)
                return reject(err);
            cp.reset();
            resolve(cp);
        });
    });
}
exports.acquire = acquire;
function release(cp) {
    cp.release();
    pool.release(cp);
}
exports.release = release;
function destroy(cp) {
    pool.destroy(cp);
}
exports.destroy = destroy;
function gracefulShutdown() {
    log.info("Shutting down the child_context_pool " + pool.getName() + " (size: " + pool.getPoolSize() + ", available: " + pool.availableObjectsCount() + ")");
    pool.drain(function () { return pool.destroyAllNow(); });
    process.exit();
}
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("exit", gracefulShutdown);
process.on("uncaughtException", function (err) {
    log.error(err);
    gracefulShutdown();
});
//# sourceMappingURL=child_context_pool.js.map