declare module 'pako' {
    export const compress: string
}
declare module 'test' {
    export const hello: string;
}
interface Modules {
    'pako': typeof import('pako'), './main': typeof import('./main'), './test': typeof import('test')
}
declare function define < U > (init: (require: typeof doRequire, exports: U, module: never) => U | void);
declare function doRequire < T extends keyof Modules > (name: T): Modules[T];
type V<T> = T extends `../${infer U}` ? U : T; 
declare function doRequire < U, T extends keyof Modules > (name: T): V;
define(function(require, exports, module) {
    'use strict';
    /** @name exports
     * @property {any} pop
     */
    /** @param {string} exports*/
    var main = require('./main');
    if (main.foo.toString() === require('./test')
        .hello) {
        throw 'wtf';
    }
    return exports;
});