_Define(function(global) {
    var extname = global.FileUtils.extname;
    /*
        a smooth way to use dependencies and save 10kb from require.min.js
        //usage - a nightmare for type inference
        1 Imports.define(paths,function(){
            //do stuff on start
            return function(args){
                //handles args
            }
        })(args)
        
        2 Imports.define(paths,function(){
            //do stuff on start
        },function(args){
            //handle args
        })(args)
        
        3 Imports.define(paths)(function(resolvedDependencies...){
            //no args
        })
        
        4 var a = new Imports(function(){
            //do stuff on start
        },onError,delay)
          a.add(dep1)
          a.add(dep2)
          a.load()
        
        5 var a = Imports.promise(deps)
        a().then(function(resolvedDeps...){
            
        })
        
        Dependency types
        - strings a.js, a.css
        - {
            type: 'script|style|func|asyncFunc|resource',
            path: path
            returns?: a name in global namespace,
            [type]:path,
            ignoreIf: condition,
            error: error handling, default stop loading
            isGlobal: //require this path only once, default for script and styles
            head: for script,style, whether to append to head, default true for script, false for style,
            parser: for resource, how to parse result eg JSON, JSONExt
        }
        - [deps] optional deps, try to load if not continue
    */

    /**
     * @constructor
     */
    global.Imports = Imports;

    function Imports(onload, onerror, delay) {
        this.onLoad = onload;
        if (typeof onerror == 'number') {
            delay = onerror;
            onerror = null;
        }
        this.delay = delay == undefined ? 30 : 0;
        this.load = loadDeps.bind(null, this, true);
        this.onerror = onerror;
        this.deps = [];
    }
    var loaded = {};
    var loading = {};
    Imports.prototype.add = function() {
        this.deps.push.apply(this.deps, arguments);
    };
    Imports.clearCache = function(type, path) {
        loaded[type + "!" + path] = null;
    };

    function loadDeps(ctx, isFirst) {
        if (isFirst) {
            if (ctx.started) return;
            ctx.started = true;
        }
        if (ctx.deps.length < 1) {
            return ctx.onLoad && ctx.onLoad();
        }
        var nextItem = ctx.deps.shift();
        var next = loadDeps.bind(null, ctx, false);
        var error = function(e) {
            var deps = ctx.deps;
            var handlers = [function(e) {
                deps.length = 0;
            }];
            if (nextItem.error) {
                handlers.unshift(nextItem.error.bind(nextItem));
            }
            if (ctx.onerror) {
                handlers.unshift(ctx.onerror);
            }
            handlers.some(function(h) {
                try {
                    console.debug('Failed to load ',nextItem.path,e);
                    h(e);
                    return true;
                } catch (err) {
                    e = err;
                    return false;
                }
            });
        };
        if (typeof nextItem == "string") {
            var type = null;
            switch (extname(nextItem)) {
                case "css":
                    type = 'style';
                    break;
                case "js":
                    type = 'script';
                    break;
                default:
                    throw new Error("Unknown dependency extension " + nextItem);
            }
            nextItem = {
                path: nextItem,
                type: type,
                isGlobal: true
            };
        } else {
            if (Array.isArray(nextItem)) {
                var deps = nextItem;
                var delay = ctx.delay;
                nextItem = {
                    asyncFunc: function(cb) {
                        var b = new Imports(cb, function(/*error*/){
                            b.deps.length = 0;
                            cb();
                        }, delay);
                        b.deps = deps;
                        b.load();
                    }
                };
            }
            if (nextItem.id) {
                ctx[nextItem.id] = true;
            }
            if (nextItem.ignoreIf) return next();
            if (nextItem.name) {
                console.debug(nextItem.name);
            }
            if (nextItem.returns) {
                nextItem.isGlobal = true;
            }
            ['script', 'style', 'resource', 'func', 'asyncFunc'].some(function(e) {
                if (nextItem[e]) {
                    nextItem.path = nextItem.path || nextItem[e];
                    nextItem.type = e;
                    return e;
                }
            });
        }
        if (nextItem.isGlobal || (nextItem.isGlobal == undefined && /script|style/.test(nextItem.type))) {
            var path = nextItem.type + "!" + nextItem.path;
            if (loaded[path] !== undefined) {
                return next();
            }
            if (loading[path]) {
                loading[path].push([next, error]);
                return;
            }
            loading[path] = [
                [next, error]
            ];
            next = function() {
                var a = loading[path];
                loading[path] = null;
                loaded[path] = null;
                a.forEach(function(b) {
                    b[0]();
                });
            };
            error = function(e) {
                var a = loading[path];
                loading[path] = null;
                loaded[path] = undefined;
                a.forEach(function(b) {
                    b[1](e);
                });
            };
        }
        switch (nextItem.type) {
            case 'script':
                return loadScript(nextItem, next, error, ctx);
            case 'style':
                return loadStyle(nextItem, next, error, ctx);
            case 'resource':
                return loadResource(nextItem, next, error, ctx);
            case 'func':
                return loadFunc(nextItem, next, error, ctx);
            case 'asyncFunc':
                return loadAsyncFunc(nextItem, next, error, ctx);
            default:
                throw new Error("Unknown dependency type " + nextItem.type);
        }
    }

    Imports.define = function(paths, onStart, exports) {
        var cachedArgs = [];
        if (!(onStart || exports)) {
            var names = [];
            paths.forEach(function(e) {
                if (e.returns)
                    names = names.concat(e.returns);
            });
            exports = function(i) {
                i.apply(null, names.map(function(e) {
                    return global[e];
                }));
            };
        }
        var bootList = new Imports(function() {
            bootList = null;
            exports = (onStart && onStart()) || exports;
            cachedArgs.forEach(function(i) {
                try {
                    exports.apply(i[0], i[1]);
                } catch (e) {
                    console.error(e);
                }
            });
            onStart = bootList = paths = cachedArgs = undefined;
        });

        bootList.deps = bootList.deps.concat(paths);
        return function() {
            if (cachedArgs) {
                cachedArgs.push([this, arguments]);
                bootList.load();
            } else return exports.apply(this, arguments);
        };
    };

    Imports.promise = function(deps) {
        var load = Imports.define(deps);
        var promise = new Promise(function(r/*, j*/) {
            load(r);
        });
        return promise;
    };
    var appEvents = global.AppEvents;
    function loadFunc(item, onLoad, onError, ctx) {
        setTimeout(
            (function() {
                try {
                    appEvents.on('fully-loaded',item.func);
                } catch (e) {
                    onError(e);
                }
                onLoad();
            }).bind(this),
            ctx.delay
        );
    }

    function loadAsyncFunc(item, onLoad, onError) {
        item.asyncFunc(function(error) {
            if (error) {
                onError(error);
            } else onLoad();
        });
    }

    function loadScript(item, onLoad, onError) {
        var scr = document.createElement("script");
        scr.onload = function() {
            onLoad();
        };
        scr.onerror = onError;
        scr.src = item.path;
        document.body.appendChild(scr);
    }

    function loadResource(item, onLoad, onError) {
        $.ajax(item.path).then(function(data) {
            try {
                global[item.path] = item.parse ? item.parse(data) : data;
            } catch (e) {
                return onError(e);
            }
            onLoad();
        }, onError);
    }

    function loadStyle(item, onLoad, onError) {
        var styleEl = document.createElement("link");
        styleEl.setAttribute("rel", "stylesheet");
        styleEl.onload = function() {
            onLoad();
        };
        styleEl.onerror = onError;
        styleEl.href = item.path;
        document.body.appendChild(styleEl);
    }

}) /*_EndDefine*/ ;