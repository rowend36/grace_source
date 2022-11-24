define(function () {
    require('grace/setup/setup_console');
    var context = require.s.contexts._;
    var initial = Object.keys(context.defined).length;
    var initialTime = performance.now();
    var m = context.execCb;
    var sizes = Object.create(null);
    var size = 0;
    var modules = [];
    var waiting = [];
    var used = [];
    context.execCb = function (id, factory, depExports, exports) {
        let res = m.call(context, id, factory, depExports, exports);
        if (id.indexOf('eruda') > -1 || id.indexOf('@r') > -1) return res;
        let q = false;
        let p = res || exports;
        traverse(
            p,
            function (name, value, parent, stack, isNew) {
                if (typeof value === 'function') {
                    // if (isNew) console.count('functions');
                    parent
                        ? (parent[name] = startInspect(stack, value))
                        : (p = startInspect(stack, value));
                    if (value.__inspector) q = true;
                }
                return true;
            },
            [id]
        );
        if (q) modules.push(id);
        size += sizes[id] = factory.toString().length;
        return p === exports ? res : p;
    };

    function startInspect(stack, value) {
        if (!value.prototype) return value;
        if (!value.__inspector) value = new Inspector(value).exec;
        value.__inspector.watch(logger(value.__inspector, stack.join('/')));
        return value;
    }

    function logger(i, entry) {
        waiting.push(entry);
        return function p() {
            i.cbs.splice(i.cbs.indexOf(i), 1);
            waiting.splice(waiting.indexOf(entry), 1);
            used.push(entry);
        };
    }
    require(['grace/core/app_events', 'grace/core/utils'], function (e, u) {
        function log(name) {
            var loaded = Object.keys(context.defined).length - initial;
            var info = window['unused'];
            console.debug(
                name +
                    ' (' +
                    loaded +
                    ' modules): ' +
                    ' size =' +
                    u.Utils.toSize(size),
                Math.round(performance.now() - initialTime) + 'ms',
                'Load Efficiency ' + info.loadEfficiency,
                'Exec Efficiency ' + info.execEfficiency
            );
        }
        e.AppEvents.on('appLoaded', log.bind(null, 'Core'));
        e.AppEvents.on('fullyLoaded', log.bind(null, 'Ext'));
    });
    Object.defineProperty(window, 'unused', {
        get: function () {
            var unusedMods = modules.filter(function (e) {
                return !used.some(f => f.startsWith(e));
            });
            return {
                unused: unusedMods.reduce(
                    (a, e) => (
                        (a[e] = waiting
                            .map(f => f.startsWith(e) && f.replace(e, ''))
                            .filter(Boolean)),
                        a
                    ),
                    Object.create(null)
                ),
                modules: Object.keys(sizes)
                    .sort((a, b) => sizes[a] - sizes[b])
                    .map((a, i) => a + '-' + sizes[a]),
                usedMethods: used,
                unusedMethods: waiting,
                totalSize: size,
                loadEfficiency:
                    Math.round((1 - unusedMods.length / modules.length) * 100) +
                    '%',
                execEfficiency:
                    Math.round(
                        (used.length / (waiting.length + used.length)) * 100
                    ) + '%',
            };
        },
    });
    var _map = new WeakSet();
    /**
     * @template {{[key in string|number]:T}} T
     * @param {T} obj
     * @param {(name:string,value:T,parent:T|null,stack:Array<string>,isNew:boolean)=>boolean} cb
     * @param {Array<string>} stack
     * @param {T|null} parent
     * @param {string} name
     */
    function traverse(obj, cb, stack = [], parent = null, name = '') {
        var willEnter =
            obj &&
            ((typeof obj === 'object' &&
                name !== '__inspector' &&
                !Array.isArray(obj)) ||
                (typeof obj === 'function' &&
                    (typeof parent !== 'function' || !traverse[name]))) &&
            !_map.has(obj);
        if (cb(name, obj, parent, stack, willEnter) && willEnter) {
            _map.add(obj);
            for (var i in obj) {
                if (i !== '__inspector' && obj.hasOwnProperty(i)) {
                    stack.push(i);
                    traverse(obj[i], cb, stack, obj, i);
                    stack.pop();
                }
            }
            stack.push('#');
            obj = obj.prototype;
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    stack.push(i);
                    traverse(obj[i], cb, stack, obj, i);
                    stack.pop();
                }
            }
            stack.pop();
        }
    }
    traverse(/** @type {any!}*/ (window), function () {
        return false;
    });
    function Inspector(func) {
        var self = this;
        this.args = [];
        this.ret = ['void'];
        this.len = func.length;
        this.called = false;
        /** @type {Array<Function>} */
        this.cbs = [];
        this.exec = {
            [func.name]: function (...args) {
                var isConstructor =
                    Object.getPrototypeOf(this) === self.exec.prototype;
                var ret = isConstructor
                    ? new func(...args)
                    : func.apply(this, args);
                self.update(arguments, this instanceof self.exec ? null : ret);
                return ret;
            },
        }[func.name];
        func.__inspector = this.exec.__inspector = this;
        Object.assign(this.exec, func);
        this.exec.prototype = func.prototype;
        // Object.assign(
        //   Object.create(func.prototype),//For instanceof checks
        //   func.prototype,//for mixins
        //   this.exec.prototype,//for constructor
        // );
        this.exec.toString = func.toString.bind(func);
    }
    Inspector.prototype.update = function (args, ret) {
        var l = 0;
        if (!this.called) {
            this.called = true;
            l = 1;
        }
        var m = Math.max(args.length, this.len);
        for (var i = 0; i < m; i++) {
            l += _union(this.args, i, getType(args[i]));
        }
        for (; i < this.len; i++) {
            l += _union(this.args, i, '?');
        }
        l += _union(this, 'ret', getType(ret));
        if (l > 0 && this.cb)
            this.cb(this.args.map(toStr), [], toStr(this.ret));
    };
    Inspector.prototype.watch = function (cb) {
        this.cbs.push(cb);
        if (this.called) {
            cb(this.args.map(toStr), [], toStr(this.ret));
        }
    };
    Inspector.prototype.cb = function (...args) {
        this.cbs.slice().forEach(function (e) {
            e(...args);
        });
    };

    function getType(obj) {
        if (obj === null || obj === undefined) return '?';
        else if (typeof obj === 'object') {
            if (
                obj.constructor &&
                obj.constructor !== Object &&
                obj.constructor.name
            ) {
                return obj.constructor.name;
            } else return '{}';
        } else if (typeof obj === 'function') return 'Function';
        return typeof obj;
    }
    /**
     * @template {string|number} T
     * @param {{[a in T]:string[]}} ctx
     * @param {T} prop
     * @param {string} type2
     * @returns {number}
     */
    function _union(ctx, prop, type2) {
        var types = ctx[prop];
        if (!types) types = ctx[prop] = [type2];
        var order = ['{}', 'string', 'boolean', 'number', '?'];
        if (types[0] === 'void') {
            if (type2 === '?') return 0;
            else types.length = 0;
        }
        if (types.indexOf(type2) > -1) return 0;
        if (order.indexOf(type2) < 0) {
            if (types.indexOf('{}') > -1) return 0;
        } else if (type2 === '{}') {
            ctx[prop] = types = types.filter(function (e) {
                return order.indexOf(e) > -1;
            });
        }
        types.push(type2);
        types.sort(function (a, b) {
            return order.indexOf(a) - order.indexOf(b);
        });
        return 1;
    }

    function toStr(e) {
        if (e.length > 3) return 'any';
        return (
            e.join('|').replace('|?', '|undefined').replace('?', 'any') || 'any'
        );
    }
});