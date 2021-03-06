"use strict";
var child_process = require("child_process");
var generic_pool_1 = require("generic-pool");
var either_1 = require("../either");
var log = require("./log");
exports.UNDEFINED = "2m!!4?U=8th==Z_utdnzR5hsTrry7TG%DZHHvMUZrTp6hs3CWm34=?EgH6FVx?HA?=q_e3$C-eNddgDcMN_4_y@GLpwpm_t-6JdfyAAuEJM97z@dLQ3_pe2PNA$-cZtC";
var ChildProcess = (function () {
    function ChildProcess() {
        var _this = this;
        this._isDestroyable = false;
        this._isComplete = false;
        this._child = child_process.fork(__dirname + "/child_context", [], { env: Object.create(process.env) });
        this._child.on("message", function (m) {
            if (_this._emitter) {
                if (m[0] !== exports.UNDEFINED) {
                    _this._emitter(either_1.Either.left(new Error(m[0])));
                }
                else if (m[1] !== exports.UNDEFINED) {
                    _this._emitter(either_1.Either.right(m[1]));
                }
                if (m[3]) {
                    if (_this._emitter)
                        _this._emitter(exports.UNDEFINED);
                    _this._isComplete = true;
                    _this._emitter = null;
                    Singleton().release(_this);
                }
                else if (m[2]) {
                    if (_this._emitter)
                        _this._emitter(exports.UNDEFINED);
                    _this._isDestroyable = true;
                    _this._isComplete = true;
                    _this._emitter = null;
                    if (_this._child) {
                        var cp = _this._child;
                        _this._child = null;
                        Singleton().destroy(_this);
                        cp.removeAllListeners();
                        cp.kill();
                    }
                }
                else {
                    _this._child.send("REQUEST_NEXT_ITEM");
                }
            }
            else {
                if (m[1] === exports.UNDEFINED)
                    return;
                log.info("The following message was received from a child process that has been released back to " +
                    ("the pool (" + _this._isComplete + ") or scheduled for destruction (" + _this._isDestroyable + "). ") +
                    "This generally indicates a misbehaving user function.");
                log.info(JSON.stringify(m));
            }
        });
        this._child.on("exit", function (code, signal) {
            _this._isDestroyable = true;
            _this._isComplete = true;
            if (_this._emitter) {
                _this._emitter(either_1.Either.left(new Error("child_process exit(" + code + ", " + signal + ")")));
            }
            _this._child = null;
        });
    }
    Object.defineProperty(ChildProcess.prototype, "pid", {
        get: function () {
            return +(this._child && this._child.pid);
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
    ChildProcess.prototype.send = function (func, data, callerFileName, type) {
        if (this._child)
            this._child.send({ func: func.toString(), data: data, callerFileName: callerFileName, type: type });
        return !!this._child;
    };
    ChildProcess.prototype.addListener = function (f) {
        this._emitter = f;
    };
    ChildProcess.prototype.release = function () {
        if (this._child)
            this._child.send("FLUSH_QUEUE_COMPLETE");
    };
    ChildProcess.prototype.destroy = function () {
        if (this._child)
            this._child.send("FLUSH_QUEUE_DESTROY");
    };
    ChildProcess.prototype.reset = function () {
        this._isComplete = false;
        this._isDestroyable = false;
        this._emitter = null;
    };
    return ChildProcess;
}());
var _pool;
function Singleton() {
    if (!_pool)
        log.info("Initializing child process pool on pid " + process.pid + ".");
    return _pool = _pool || new generic_pool_1.Pool({
        name: "child_context_pool_" + Math.random().toString(36).substr(2),
        create: function (callback) { return callback(null, new ChildProcess()); },
        destroy: function (cp) { return cp.destroy(); },
        max: 2,
        min: 1,
        refreshIdle: true,
        idleTimeoutMillis: +process.env.NODE_TRY_FORK_POOL_IDLE || 9000,
        reapIntervalMillis: +process.env.NODE_TRY_FORK_POOL_REAP || 5000,
        returnToHead: true,
        log: !!(process.env.NODE_DEBUG || "").split(",").find(function (m) { return m.trim() === "try-func-pool"; }),
    });
}
function acquire() {
    return new Promise(function (resolve, reject) {
        Singleton().acquire(function (err, cp) {
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
}
exports.release = release;
function destroy(cp) {
    cp.destroy();
}
exports.destroy = destroy;
function gracefulShutdown() {
    log.info("Shutting down the child_context_pool " + Singleton().getName() + " (size: " + Singleton().getPoolSize() + ", available: " + Singleton().availableObjectsCount() + ")");
    Singleton().drain(function () { return Singleton().destroyAllNow(); });
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