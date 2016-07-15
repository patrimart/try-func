"use strict";
var isDebug = process.env.TRYJS_DEBUG === "true";
function info(info, filename) {
    if (filename === void 0) { filename = ""; }
    if (isDebug) {
        console.log("[%s] [info] %s: %s", new Date().toLocaleString(), info, filename);
    }
}
exports.info = info;
function error(e) {
    if (isDebug) {
        console.log("[%s] [error] %s:", new Date().toLocaleString(), e.message);
        console.log(e.stack);
    }
}
exports.error = error;
//# sourceMappingURL=log.js.map