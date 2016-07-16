
const isDebug = process.env.TRYJS_DEBUG === "true";

export function info (info: string, filename = "") {
    if (isDebug) {
        console.log("[%s] [info] %s: %s", new Date().toLocaleString(), info, filename);
    }
}

export function error (e: Error) {
    if (isDebug) {
        console.log("[%s] [error] %s:", new Date().toLocaleString(), e.message);
        console.log(e.stack);
    }
}
