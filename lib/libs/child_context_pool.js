"use strict";
var child_process = require("child_process");
var generic_pool_1 = require("generic-pool");
var Either_1 = require("../Either");
var log = require("./log");
var ChildProcess = (function () {
    function ChildProcess() {
        var _this = this;
        this._isDestroyable = false;
        this._child = child_process.fork(__dirname + "/child_context", ["special"], { env: { __TRYJS_IN_FORK: true, TRYJS_DEBUG: process.env.TRYJS_DEBUG } });
        this._child.on("message", function (m) {
            if (_this._emitter) {
                _this._isDestroyable = m[2];
                if (m[0]) {
                    _this._emitter(Either_1.Either.Left(new Error(m[0])));
                }
                else {
                    _this._emitter(Either_1.Either.Right(m[1]));
                }
            }
        });
        this._child.on("error", function (err) {
            _this._isDestroyable = true;
            _this._emitter && _this._emitter(Either_1.Either.Left(err));
            _this._child && _this._child.kill();
            _this._child = null;
        });
        this._child.on("exit", function (code, signal) {
            _this._isDestroyable = true;
            _this._emitter && _this._emitter(Either_1.Either.Left(new Error("child_process exit(" + code + ", " + signal + ")")));
            _this._child = null;
        });
    }
    Object.defineProperty(ChildProcess.prototype, "isDestroyable", {
        get: function () {
            return this._isDestroyable;
        },
        enumerable: true,
        configurable: true
    });
    ChildProcess.prototype.send = function (func, data, callerFileName) {
        this._child && this._child.send({ func: func.toString(), data: JSON.stringify(data), callerFileName: callerFileName });
    };
    ChildProcess.prototype.addListener = function (f) {
        this._emitter = f;
    };
    ChildProcess.prototype.release = function () {
        this._emitter = null;
    };
    ChildProcess.prototype.destroy = function () {
        this._child && this._child.kill();
        this._child = null;
    };
    return ChildProcess;
}());
var pool = new generic_pool_1.Pool({
    name: "child_context_pool",
    create: function (callback) { return callback(null, new ChildProcess()); },
    destroy: function (cp) { return cp.destroy(); },
    max: process.env.TRYJS_FORK_POOL_MAX || 10,
    min: process.env.TRYJS_FORK_POOL_MIN || 2,
    refreshIdle: true,
    idleTimeoutMillis: process.env.TRYJS_FORK_POOL_IDLE || 9999,
    reapIntervalMillis: process.env.TRYJS_FORK_POOL_REAP || 3333,
    returnToHead: true,
    log: false,
});
function acquire() {
    return new Promise(function (resolve, reject) {
        pool.acquire(function (err, cp) {
            if (err)
                reject(err);
            else
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
    log.info("Shutting down the child_context_pool (size: " + pool.getPoolSize() + ", available: " + pool.availableObjectsCount() + ")");
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