define(function(require,exports,module) {
    'use strict';
    Object.defineProperty(exports, '__esModule', {
        value: true
    });

    /**
     * @typedef {Object} GitProgressEvent
     * @property {string} phase
     * @property {number} loaded
     * @property {number} total
     */

    /**
     * @callback ProgressCallback
     * @param {GitProgressEvent} progress
     * @returns {void | Promise<void>}
     */

    /**
     * @typedef {Object} GitHttpRequest
     * @property {string} url - The URL to request
     * @property {string} [method='GET'] - The HTTP method to use
     * @property {Object<string, string>} [headers={}] - Headers to include in the HTTP request
     * @property {AsyncIterableIterator<Uint8Array>} [body] - An async iterator of Uint8Arrays that make up the body of POST requests
     * @property {ProgressCallback} [onProgress] - Reserved for future use (emitting `GitProgressEvent`s)
     * @property {object} [signal] - Reserved for future use (canceling a request)
     */

    /**
     * @typedef {Object} GitHttpResponse
     * @property {string} url - The final URL that was fetched after any redirects
     * @property {string} [method] - The HTTP method that was used
     * @property {Object<string, string>} [headers] - HTTP response headers
     * @property {AsyncIterableIterator<Uint8Array>} [body] - An async iterator of Uint8Arrays that make up the body of the response
     * @property {number} statusCode - The HTTP status code
     * @property {string} statusMessage - The HTTP status message
     */

    /**
     * @callback HttpFetch
     * @param {GitHttpRequest} request
     * @returns {Promise<GitHttpResponse>}
     */

    /**
     * @typedef {Object} HttpClient
     * @property {HttpFetch} request
     */

    // Convert a value to an Async Iterator
    // This will be easier with async generator functions.
    function fromValue(value) {
        let queue = [value];
        return {
            next() {
                return Promise.resolve({
                    done: queue.length === 0,
                    value: queue.pop()
                })
            },
            return () {
                queue = [];
                return {}
            },
            [Symbol.asyncIterator]() {
                return this
            },
        }
    }

    function getIterator(iterable) {
        if (iterable[Symbol.asyncIterator]) {
            return iterable[Symbol.asyncIterator]()
        }
        if (iterable[Symbol.iterator]) {
            return iterable[Symbol.iterator]()
        }
        if (iterable.next) {
            return iterable
        }
        return fromValue(iterable)
    }

    // Currently 'for await' upsets my linters.
    async function forAwait(iterable, cb) {
        const iter = getIterator(iterable);
        while (true) {
            const {
                value,
                done
            } = await iter.next();
            if (value) await cb(value);
            if (done) break
        }
        if (iter.return) iter.return();
    }

    async function collect(iterable) {
        let size = 0;
        const buffers = [];
        // This will be easier once `for await ... of` loops are available.
        await forAwait(iterable, value => {
            buffers.push(value);
            size += value.byteLength;
        });
        const result = new Uint8Array(size);
        let nextIndex = 0;
        for (const buffer of buffers) {
            result.set(buffer, nextIndex);
            nextIndex += buffer.byteLength;
        }
        return result
    }

    // Convert a web ReadableStream (not Node stream!) to an Async Iterator
    // adapted from https://jakearchibald.com/2017/async-iterators-and-generators/
    function fromStream(stream) {
        // Use native async iteration if it's available.
        if (stream[Symbol.asyncIterator]) return stream
        const reader = stream.getReader();
        return {
            next() {
                return reader.read()
            },
            return () {
                reader.releaseLock();
                return {}
            },
            [Symbol.asyncIterator]() {
                return this
            },
        }
    }

    /* eslint-env browser */

    /**
     * HttpClient
     *
     * @param {GitHttpRequest} request
     * @returns {Promise<GitHttpResponse>}
     */
    async function request({
        onProgress,
        url,
        method = 'GET',
        headers = {},
        body,
    }) {
        // streaming uploads aren't possible yet in the browser
        if (body) {
            body = await collect(body);
        }
        if (Env.getCorsProxyUrl) {
            url = Env.getCorsProxyUrl(url, {
                method,
                headers,
                body
            });
        }
        const res = await fetch(url, {
            method,
            headers,
            body
        });
        const iter =
            res.body && res.body.getReader ?
            fromStream(res.body) : [new Uint8Array(await res.arrayBuffer())];
        // convert Header object to ordinary JSON
        headers = {};
        for (const [key, value] of res.headers.entries()) {
            headers[key] = value;
        }
        return {
            url: res.url,
            method: res.method,
            statusCode: res.status,
            statusMessage: res.statusText,
            body: iter,
            headers: headers,
        };
    }
    // const delayFunc = (r) => setTimeout(r, 10);
    // async function delay() {
    //     await new Promise(delayFunc);
    // }

    // async function slowRequest(opts) {
    //     var res = await request(opts);
    //     //parsing extremely long request bodies blocks ui
    //     //emulate streaming, perharps we should not be running downloads on
    //     //the main thread
    //     //throttles parse speed to a maximum of about 333kb/s in 100kb bursts
    //     if (!res.body) return res;
    //     var reader, body = res.body;
    //     var MAX_CHUNK_SIZE = 10000;
    //     var index = 0,
    //         current = null,
    //         done = false,
    //         waiting, release;
    //     var iter = {
    //         next: async function() {
    //             //mutex cus async functions are traitors
    //             while (waiting) await waiting;
    //             if (current == null) {
    //                 waiting = new Promise((r) => {
    //                     release = r;
    //                 });
    //                 //Get a new chunk
    //                 if (!reader) reader = getIterator(body);
    //                 var result = await reader.next();
    //                 done = result.done;
    //                 current = result.value;
    //                 waiting = null;
    //                 release();
    //                 if (!result.value) return result;
    //             }
    //             let slice;
    //             if (index + MAX_CHUNK_SIZE >= current.length) {
    //                 console.log(index + "/" + current.length);
    //                 //finished this chunk
    //                 slice = current.slice(index);
    //                 index=0,current = null;
    //                 await delay();
    //                 return {
    //                     done: done,
    //                     value: slice
    //                 };
    //             } else {
    //                 //send the chunks slice by slice
    //                 slice = current.slice(index, index + MAX_CHUNK_SIZE);
    //                 index += MAX_CHUNK_SIZE;
    //                 await delay();
    //                 return {
    //                     done: false,
    //                     value: slice
    //                 };
    //             }
    //         },
    //         return () {
    //             body = null;
    //             console.log('return');
    //             if (reader && reader.return) return reader.return();
    //         },
    //         [Symbol.asyncIterator]: function() {
    //             return this;
    //         },
    //     };
    //     res.body = iter;
    //     return res;
    // }

    var index = {
        request
    };

    exports.default = index;
    exports.request = request;
    exports.http = exports;
}) /*_EndDefine*/ ;