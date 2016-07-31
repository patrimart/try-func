try-func
========
A functional-style Node.js library with improved error handling, flattened asyncronous handling and parallel processing.

- Supports Node >= 4.3
- Languages JavaScript and TypeScript
- Does not support the browser

This library is an attempt to bring pleasant error handling to JavaScript. The Domain module is deprecated without a replacement. Zone.js is promising, but feels incomplete. **try-func** catches all thrown Errors, all uncaught errors and all unhandled rejections by running functions in child processes.

Ideally, this library will help prevent common bugs caused by thrown errors and undefined variables. By using Either and Option, method signatures can be more predictable.


Install
-------
`npm install try-func`


Quick Examples
--------------
Let's start with some sample JS code:

```javascript
var Try = require('try-func').Try;
Try.ofFork(() => {
    var fs = require('fs');
    return fs.readFileSync(__dirname + '/path/to/filename.txt', 'utf8');
}).andThenFork(function* (fileContent) {
    var wordCount = yield asyncCountWords(fileContent);
    return wordCount;
})
.get().then(result => console.log(result.get());

```

Now let's see it in TypeScript with comments:

```typescript
import {Try} from "try-func";
// This Try ultimately returns a Promise<Either<Error, number>>.
// Run the first function in a child process and return a string.
Try.ofFork<number>(() => {
    // Forked functions are NOT closures. Must include require('fs') here.
    var fs = require("fs");
    // If the file does not exist, the get() will return an Either<Error, number>.Left.
    return fs.readFileSync(`${__dirname}/path/to/filename.txt`, "utf8");
})
// Pass the previous result into another child process.
.andThenFork<string, number>(function* (fileContent) {
    // Try supports generator/yield to flatten out Promise handling.
    var wordCount: number = yield asyncCountWords(fileContent);
    return wordCount;
})
// Finally, get() returns a Promise<Either<Error, number>>.
// Handling a catch is unnecessary, as errors are returned with the Either.
.get().then((result: Either<Error, number>) => console.log(`Word count: ${result.get()}.`);
```

Here's a more ambitious example counting the words in multiple files.

```javascript
var Try = require('try-func/try').Try;
var totalCount = 0;
Try.ofFork(function* () {
    var fs = require('fs');
    function* listFiles(path) {
        /* Return array of files in Promise. */
    }
    function* readFile(path) {
        /* Return the content of a file in Promise. */
    }
    var files = yield* listFiles(__dirname + "/path/to/files", "utf8");
    files
        .filter(f => fs.stat(f).isFile())
        .forEach(f => {
            var content = yield* readFile(f);
            Next(content);
        });
    Complete();
}).andThenFork((fileContent) => {
    var wordCount = countWords(fileContent);
    return wordCount;
})
.subscribe(
    wordCount => totalCount += wordCount,
    err => console.log("An unexpected error:", err),
    () => console.log("Total word count: " + totalCount)
);
```
---

Either and Option
-----------------
This library includes implementations of `Either` and `Option` classes. The `Either` class is widely used.  
__Either__ docs are [here](docs/either.md)  
__Option__  docs are [here](docs/option.md)

---

Configuration
-------------
The behavior of this library can be changed by setting environment variables.
- `NODE_TRY_FORK_POOL_MAX` (cpus * 2) - The maximum number of child processes running at one time.
- `NODE_TRY_FORK_POOL_MIN` (2) - The minimum number of child processes always available, even if idle.
- `NODE_TRY_FORK_POOL_IDLE` (9000) - How many ms a child process must be idle to be eligble for reaping.
- `NODE_TRY_FORK_POOL_REAP` (5000) - How often in ms the pool reaps eligble child processes.
- `NODE_DEBUG` - Add `try-func` to the list to enable info and error logs to the console. Add `try-func-pool` to log very verbose info about the child process pool(s).

---

Try Interface Docs
------------------

### *static* of &lt;T> (func: TryFunction&lt;void, any>, initialValue?: any): Try&lt;T>
A static method that instantiates Try with an initial function. This function will execute in the current process.

__Arguments__
- `func: TryFunction<void, any>` - The function to execute.
- `initialValue?: any` - Optional value to pass to the function.

__Returns__
`Try<T>` - An instance of Try.

__Example__
```javascript
Try.of<number>(() => 1).get().then(result => console.log(result.get());
// Outputs: 1
Try.of<number>(v => v + 1, 9).get().then(result => console.log(result.get());
// Outputs: 10
```

### *static* ofFork &lt;T> (func: TryFunction&lt;void, any>, initialValue?: any): Try&lt;T>
A static method that instantiates Try with an initial function. This function will execute in a forked child process.

__Arguments__
- `func: TryFunction<void, any>` - The function to execute.
- `initialValue?: any` - Optional value to pass to the function.

__Returns__
`Try<T>` - An instance of Try.

__Example__
```javascript
Try.ofFork<number>(() => 1).get().then(result => console.log(result.get());
// Outputs: 1
Try.ofFork<number>(v => v + 1, 9).get().then(result => console.log(result.get());
// Outputs: 10
```

### andThen  &lt;I, O> (func: TryFunction&lt;I, O>): this
Executes the given function, passing the result from the previous function, in the same process.

__Arguments__
- `func: TryFunction<void, any>` - The function to execute.

__Returns__
`Try<T>` - An instance of Try.

__Example__
```javascript
Try.of<number>(() => 1)
    .andThen(v => v + v)
    .get().then(result => console.log(result.get());
// Outputs: 2
```

### andThenFork  &lt;I, O> (func: TryFunction&lt;I, O>): this
Executes the given function, passing the result from the previous function, in a forked child process.

__Arguments__
- `func: TryFunction<void, any>` - The function to execute.

__Returns__
`Try<T>` - An instance of Try.

__Example__
```javascript
Try.of<number>(() => 1)
    andThenFork(v => v + v)
    .get().then(result => console.log(result.get());
// Outputs: 2
```

### get (): Promise&lt;Either&lt;Error, T>>
Returns a Promise that resolves with `Either<Error, T>`. These Promises will never reject.

__Returns__
`Promise<Either<Error, T>>` - A Promise that resolves with an Either.

__Example__
```javascript
Try.of(() => 1)
    .get().then(result => {
        if (result.isRight())
            console.log("Success", result.get());
        else
            console.log("Error", result.getLeft());
    });
// Outputs: 'Success' 1
```

### getOrElse &lt;I> (func: TryFunction&lt;void, T>, value?: I): Promise&lt;Either&lt;Error, T>>
Returns the Try result, if it is `Either.Right`. Else, executes the given function in the current process and returns its result.

__Arguments__
- `func: TryFunction<void, any>` - The function to optionally execute.
- `value?: I` - An optional value to pass to the function.

__Returns__
`Promise<Either<Error, T>>` - A Promise that resolves with an Either.

__Example__
```javascript
Try.of(() => 1)
    .andThen(v => { throw new Error(); })
    .getOrElse(() => 2)
    .then(result => console.log(result.get()));
// Outputs: 2
```

### getOrElseFork &lt;I> (func: TryFunction&lt;void, T>, value?: I): Promise&lt;Either&lt;Error, T>>
Returns the Try result, if it is `Either.Right`. Else, executes the given function in a forked child process and returns its result.

__Arguments__
- `func: TryFunction<void, any>` - The function to optionally execute.
- `value?: I` - An optional value to pass to the function.

__Returns__
`Promise<Either<Error, T>>` - A Promise that resolves with an Either.

__Example__
```javascript
Try.of(() => 1)
    .andThen(v => { throw new Error(); })
    .getOrElseFork(() => 2)
    .then(result => console.log(result.get()));
// Outputs: 2
```

### getOrThrow (err?: Error): Promise&lt;Either&lt;Error, T>>
Returns the Try result, if it is `Either.Right`. Else, throws the given `Error` or, if omitted, the `Either.Left`.

__Arguments__
- `err?: TryFunction<void, any>` - The optional Error to throw.

__Returns__
`Promise<Either<Error, T>>` - A Promise that resolves with a Either.Right.

__Example__
```javascript
Try.of(() => 1)
    .andThen(v => { throw new Error("Internal Error"); })
    .getOrThrow(new Error("Custom Error"))
    .then(result => console.log(result.get()));
// Throws Error: Custom Error
```

### subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): ISubscription
Where the `get*()` methods return one result, `subscribe` will handle multiple results emitted by the Try chain. Inspired by Observables in RxJS.

A subscription will complete under three conditions:
- A function invokes `Complete`.
- An `Error` occurs.
- `ISubscription.unsubscribe` is invoked.

__Arguments__
- `onNext: (value: T) => void` - A function that handles the vaules emitted.
- `onError: (err: Error) => void` - A function that handles any Error.
- `onComplete: () => void` - A function that is invoked when the subscription completes.

__Returns__
`ISubscription` - This interface has one method: `unsubscribe()`. Calling this will stop the Try by killing the child process. It would be more performant to invoke `Complete` in the emitting function.

__Example__
```javascript
var subscription = Try.of(() => {
    setInterval(() => Next(counter++), 1000);
})
.subscribe(
    next => {
        if (next < 10) console.log(next);
        else subscription.unsubscribe();
    },
    err => console.log("An unexpected error:", err),
    () => console.log("Complete")
);
// Outputs: 1 2 3 4 5 6 7 8 9 'Complete'
```

### toCurried (): (initialValue?: any) => Promise&lt;Either&lt;Error, T>>
This method returns the Try as a curried method.

__Returns__
`(initialValue?: any) => Promise<Either<Error, T>>`

__Example__
```javascript
var pow2 = Try.of(v => v * v).toCurried();
pow2(1).then(result => console.log(result.get()));
pow2(2).then(result => console.log(result.get()));
pow2(3).then(result => console.log(result.get()));
// Outputs: 1, 4, 9
```
---

Promises and Callbacks and Errors...
-------------------
Oh, my! I am not a fan of these things as they can easily lead to chaotic execution flow through JavaScript code. Promises did much to help. Libraries like Async are true heroes. And, future support for _generator/yield_ and _async/await_ will go far to making JavaScript more sane. Still, problems persist, especially when handling errors asynchorously.

By using forked functions in this library, you can say goodbye to handling Promises, catching errors or surprise undefined objects.

- Throw an `Error` from anywhere in a forked function and it will be caught and handled by the Try.
- Return an `Error` and it will be handled.
- Simply reject a `Promise` anywhere (with no catch). It will be caught and handled by the Try.
- Return an `Either` or `Option` and Try will handle it accordingly.

It's true that this library ultimately returns Promises. However, they are always resolved Eithers. The new _generator/yield_ and _async/await_ will make these transparent to handle. For example:
```js
var result = await Try.ofFork(require('./heavy-computation')).get();
if (result.getRight())
    console.log("Success", result.get());
else
    console.log("Error", result.getLeft());
```
---

Supported Returns
-----------------
There are a variety of ways to return a _value_ or `Error` from a Try function.
- Simply return the plain value. `return foo;`
- Return a `Promise` that will resolve or reject.
- Return `Either<Error, T>`.
- Return `Option<T>`.
- Invoke `Next()` with any of the above. Remember to finally call `Complete()`.
- Throw or return an `Error`.
- Reject a `Promise` and do not "catch" it.

---

Differences Between Forked and Non-Forked Functions
---------------------------------------------------
An effort was made to make their behaviors interchangable. However, some differences are technically mandated.
#### Forked Functions...
- Run in child processes and are managed by a limited pool.
- Must be serialized, sent to a child process and compiled. Each child process caches compiled functions.
- Are Not closures and, therefore, cannot see external variables. Beware: `require()`.
- Will not release back to the pool unless a non-undefined is returned or `Complete()` is invoked.
- `Either` and `Option` are automatically loaded. No need to require/import.
- Require paths are different at top-level.
- Can only accept and emit JSONable objects.
- Either and Option automatically loaded with require.

#### Regular Functions...
- Run in the same process and do not suffer from the overhead of forked functions.
- Are closures and can see external variables.
- Cannot catch uncaught exceptions or unhandled rejections.
- Require a `this` context when using `this.Next()` and `this.Complete()`. If using these, the functions cannot be lambdas.

---

Common Pitfalls
---------------
Here are some issues to be aware of when using this library.

__Pool Starvation__  
Forked child processes are managed by a limited pool (with the max being configurable). Forked functions will not be released back into the pool unless they return a non-undefined value or invoke `Complete()`. If your long-running forked functions equal the pool's max, the app will not be able to execute any down-stream functions and it will deadlock.

__Requires in Forks__  
Because forked functions must be serialized and sent to a child process, some trickery was done to make relative paths in `require()` still work. Without trying to describe the how-tos (where the function is invoked), these examples should cover it.

If a require cannot resolve a path and you are doing something like this:
```js
Try
    .ofFork(require('../../my-module'))
    .andThenFork(require('../../another-module'))
    ...
```
Try this instead:
```js
Try
    .ofFork(() => require('../../my-module')())
    .andThenFork(v => require('../../another-module')(v))
    ...
```

__Forked Functions Forking Functions Forking Functions__  
If a long-running forked function emits five values to another long-running forked function that emits five values, the app could be using up to twenty-five child processes downstream. To be safe, try to restrict your Try chain to one long-running process that feeds completing functions. Or, be aware of child process pool starvation.

__Nested Forking__  
Using nested Trys with forked functions can cause multiple child process pools to start in the forked child processes. While not forbidden, be aware of exponential growth of child processes.

__Optimization vs. Convenience__  
Spawning child processes is not cheap. Forked functions must be serialized, sent to the child and compiled. Forked functions must serialize data when communicating between parent and child processes. While significant effort was made to alleviate some of this cost with process pools and cached functions, developers can do things to aggravate the issue. Specifically, any behavior that causes a child process to die. Like, calling `unsubscribe()`, uncaught exceptions and unhandled rejections.

If your app does not need to wring out every last drop of performance, I'd suggest leaning on the side of convenience versus optimization. After all, hard-to-reason code will never get easier to understand, but computers will always get faster.

---

More Examples
-------------
You can view more trivial examples in the test directory.

---

Benchmarks
----------
I'd like to see how this library compares to others, like Async. As I run benchmarks, I'll add them here.

---

Credit
------

co - generator async control flow goodness https://www.npmjs.com/package/co

node-pool - https://github.com/coopernurse/node-pool

string-hash - https://github.com/darkskyapp/string-hash


License
-------
(The MIT License)

Copyright (c) 2016 Patrick Martin

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and 
associated documentation files (the 'Software'), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN 
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
