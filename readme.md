try-func
========
A functional-style Node.js library with improved error handling, non-nested asyncronous patterns and parallel processing.

- Supports Node >= 4.3
- Languages JavaScript and TypeScript
- Does not support the browser

Install
-------
`npm install try-func`

This library is an attempt to bring pleasant error handling to JavaScript. The Domain module is deprecated without a replacement. Zone.js is promising, but feels incomplete. **try-func** catches all thrown Errors, all uncaught errors and all unhandled rejections by running functions in child processes.

#### Quick Examples
Let's start with some sample JS code:
```javascript
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
// This Try ultimately returns a Promise<Either<Error, number>>.
// Run the first function in a child process and return a string.
Try<number>.ofFork<string>(() => {
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
// Handling a catch is unnecessary, as errors are handled with the Either.
.get().then((result: Either<Error, number>) => console.log(`Word count: ${result.get()}.`);
```
Here's a more ambitious example counting the words in multiple files.
```javascript
var totalCount = 0;
Try.ofFork(function* () {
    var fs = require('fs');
    function* listFiles(path) {
        /* Return array of files */
    }
    function* readFile(path) {
        /* Return the content of a file. */
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
Errors and Promises
-------------------
Promise.reject() - Not necessary to catch. Uses Either.
Throw Errors


Supported Returns
-----------------
- Promise (resolved or uncaught rejected)
- Either<L, R>
- Option<T>
- Error (throw or return)

Differences Between Forked and Non-Forked Functions
---------------------------------------------------
##### Forked Functions
- Child process pool
- Cached functions
- Not closures
- No return/complete, process holds.

##### Regular Functions
- Closure
- Uncaught exceptions, unhandled rejections, async errors are not caught.

Try Interface
-------------
##### andThen  <I, O> (func: TryFunction<I, O>): this
Description

##### andThenFork  <I, O> (func: TryFunction<I, O>): this
Description

##### get (): Promise<Either<Error, T>>
Description of method.

###### Arguments
- `arg` - Description of argument.

###### Example
```javascript
Try.of(() => 1)
    .get().then(result => {
        if (result.isRight())
            console.log("Success", result.get());
        else
            console.log("Error", result.getLeft());
    });
```
---

- `getOrElse <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>`
- `getOrElseFork <I> (func: TryFunction<void, T>, value?: I): Promise<Either<Error, T>>`
- `getOrThrow (err?: Error): Promise<Either<Error, T>>`
- `subscribe (onNext: (value: T) => void, onError: (err: Error) => void, onComplete: () => void): ISubscription`
- `toCurried (): (initialValue?: any) => Promise<Either<Error, T>>`

Considerations
--------------
Pool starvation


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
