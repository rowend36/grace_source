define(function(require, exports, module) {
    var debug = console;
    var call = function(cb){
        cb();
    };
    //create async functions that do setup on first call
    exports.define = function(init, subsequent) {
        var cachedArgs = [];
        subsequent = subsequent || call;
        var setup = function() {
            if (cachedArgs) {
                cachedArgs.forEach(function(i) {
                    try {
                        subsequent.apply(i[0], i[1]);
                    } catch (e) {
                        debug.error(e);
                    }
                });
                cachedArgs = undefined;
            }
        };

        return function() {
            if (cachedArgs) {
                cachedArgs.push([this, arguments]);
                if (init) {
                    var _init = init;
                    init = undefined;
                    _init(setup);
                    setup = _init = undefined;
                }
            } else return subsequent.apply(this, arguments);
        };
    };
    
    //return a promisified form of define
    exports.promise = function(init) {
        var define = exports.define(init);
        return function(){
            return new Promise(function(r /*, j*/ ) {
                define(r);
            });
        };
    };

}) /*_EndDefine*/ ;