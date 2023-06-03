define(function (require, exports, module) {
    var debug = console;
    var call = function (cb) {
        cb && cb.apply(this, arguments);
    };
    /**
     * Creates async functions that do setup on first call
     * var getName = after(generateAllNames,(i,cb)=>cb(names[i]));
     * if(test1)getName(1,alert)
     * if(test2)getName(2,alert)
     * OR
     * var withNames = after(generateAllNames);
     * if(test1)withNames(()=>alert(names[1]))
     * if(test2)withNames(()=>alert(names[2]))
     * In both cases generateAllNames is called a maximum of once
     */
    exports.after = function (init, subsequent) {
        var cachedArgs = [];
        if (!subsequent) subsequent = call;
        var resolve = function () {
            if (!cachedArgs) throw 'Invalid state!!!';
            for (var i = 0, m; (m = cachedArgs[i]); i++) {
                try {
                    subsequent.apply(m[0], m[1]);
                } catch (e) {
                    debug.error(e);
                }
            }
            cachedArgs = undefined;
        };

        return function () {
            if (cachedArgs === undefined)
                return subsequent.apply(this, arguments);
            cachedArgs.push([this, arguments]);
            if (init !== undefined) {
                var _init = init;
                init = undefined;
                _init.call(this, resolve);
                resolve = undefined;
            }
        };
    };
    exports.syncRequire = function (deps, cb) {
        var loaded =
            deps.filter(require.specified, require).length == deps.length;
        if (loaded) return cb.apply(null, deps.map(require));
        else require(deps, cb);
    };
    //return a promisified form of after
    //e.g generateAllNames = m.promise(generateAllNames)
    //async function b(){
    //  await generateAllNames();
    //}
    //async function c(){
    //  await generateAllNames();
    //}
    exports.promise = function (init) {
        var waitForInit = exports.after(init);
        return function () {
            return new Promise(function (r /*, j*/) {
                waitForInit(r);
            });
        };
    };
}) /*_EndDefine*/;