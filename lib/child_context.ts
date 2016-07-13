
const path = require("path");
const vm = require('vm');

const ___compiledScriptCache___: {[hash: string]: any} = {};
const ___origRequire___ = require;
const ___that___ = this;


function ok (r: any) {
    process.send([null, r]);
}

function error (e: Error) {
    process.send([e.stack, null]);
    process.exit();
}

global.require = function (): any {
    arguments[0] = path.resolve(path.parse(process.env.__TRYJS_ROOT_DIR).dir, arguments[0]);
    return ___origRequire___.apply(___that___, arguments);
};

global.ok = ok;
global.error = error;

process.on("uncaughtException", (e: Error) => {
    process.send([e.stack, null]);
    process.exit();
});

process.on("message", function (message: {func: string, data: any}) {

    let code = `((${message.func})(${JSON.stringify(message.data)}))`,
        hash = ___hash___(code),
        script: any;
    
    if (___compiledScriptCache___[hash]) {
        script = ___compiledScriptCache___[hash];
    } else {
        script = new vm.Script(`((${message.func})(${JSON.stringify(message.data)}))`, { filename: 'try-js-fork.vm' });
        ___compiledScriptCache___[hash] = script;
    }
    // const r = eval(`((${message.func})(${JSON.stringify(message.data)}))`);
    const r = script.runInNewContext(global);
    if (r !== undefined) {

        if (r instanceof Promise) {
            r.then((v: any) => ok(v)).catch((e: Error) => error(e))
        } else {
            ok(r);
        }
    }
});

/**
 * https://github.com/darkskyapp/string-hash
 */
function ___hash___ (str: string): number {
  var hash = 5381,
      i    = str.length

  while(i)
    hash = (hash * 33) ^ str.charCodeAt(--i)

  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
}
