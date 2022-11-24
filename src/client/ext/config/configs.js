define(function (require, exports, module) {
    var Utils = require('grace/core/utils').Utils;
    var Schema = require('grace/core/schema').Schema;
    var Config = require('grace/core/config').Config;
    var parseKey = require('./context_parser').parseKey;
    var configure = Config.configure;
    var configureObj = Config.configureObj;
    var allConfigs = Config.allConfigs;
    var getInfo = Config.getConfigInfo;
    var debug = console;
    var NO_USER_CONFIG = 'no-user-config';
    var DOT = '.'; //separates deep set keys
    var SEP = ', '; //separates string lists
    var Configs = exports;
    Configs._debug = false;
    /*Adds methods for validating && batch updating config*/

    /*region Error Handling*/
    var errorFlag = 0;
    var errSource = '';
    var errHandler = debug.error;
    function _error(error, path, value, cause) {
        errorFlag++;
        var p = _split(path, '');
        var obj = new Error(
            error
                .replace('{ns}', p.ns || 'ROOT')
                .replace('{key}', p.key || 'EMPTY_KEY')
                .replace('{val}', value)
                .replace('{path}', path)
                .replace('{cause}', cause) + errSource
        );

        obj.error = error;
        obj.namespace = p.ns;
        obj.key = p.key;
        obj.value = value;
        obj.path = path;
        obj.cause = cause;
        if (cause) obj.stack = cause.stack || obj.stack;
        errHandler(obj);
    }
    Configs.withErrorHandler = function (err, func) {
        var h = errHandler;
        errHandler = err;
        try {
            return func();
        } finally {
            errHandler = h;
        }
    };
    Configs.withSource = function (source, func, _a, _b) {
        var h = errSource;
        errSource = '\n-> in ' + source;
        try {
            return func(_a, _b);
        } finally {
            errSource = h;
        }
    };
    /** Catch errors in both parsing, merging and finishupdate*/
    function _checkErrorFlag(func) {
        return function m() {
            var p = errorFlag;
            return func.apply(this, arguments) && p === errorFlag;
        };
    }
    /*endregion*/

    /*region Deep Layered Object handling.*/
    function isArray(e) {
        return e && e.constructor === Array;
    }
    function isPureObject(e) {
        return e && e.constructor === Object;
    }
    function isNamespace(e) {
        return e === '' || allConfigs[e];
    }
    function deepGet(obj, chain) {
        var i = 0;
        do {
            obj = obj[chain[i]];
            if (!obj) return {missing: true, i: i};
            ++i;
        } while (i < chain.length);
        return {val: obj};
    }
    //Get schema for a configuration path
    function inferSchema(key, defaultValue) {
        var info = getInfo(key);
        var schema;
        if (typeof info === 'object') {
            if (typeof info.validate === 'function') return info;
            //Schema
            else if (info.type) {
                schema = Schema.parse(info.type);
            } else if (info.values) {
                var values = [];
                var props = [];
                info.values.forEach(function (e) {
                    if (isArray(e)) {
                        e = e[0];
                    }
                    if (typeof e === 'string' && e[0] === '<') {
                        props.push(Schema.parse(e));
                    } else values.push(e);
                });
                schema = new Schema.XEnum(values);
                if (props.length) {
                    props.push(schema);
                    schema = new Schema.XOneOf(props);
                }
            }
            if (info.isList) schema = new Schema.XList(schema);
            if (schema) return schema;
        }
        var res = Schema.fromValue(defaultValue);
        if ((res.schema || res) === Schema.IsPlain)
            debug.error('Could not infer type for ' + key);
        return res;
    }

    function _split(path, prefix) {
        var ns = prefix + path;
        var key = '';
        while (!isNamespace(ns)) {
            var t = ns.lastIndexOf(DOT);
            key = ns.slice(t + 1) + (key ? DOT : '') + key;
            ns = t > -1 ? ns.slice(0, t) : '';
        }
        return {ns: ns, key: key};
    }

    function _hasProp(e, prop) {
        return e[prop] !== undefined || e.hasOwnProperty(prop);
    }

    /**
   * Converts complex config into layers
   * of simple configs where each direct key is a 
   * namespace.
   * E.g {
      a.b.e:"hi",
      a: {
        b.o: 'help'
      }
      a.b: {
        e: 'hello' 
      }
   } => {a.b:{e:'hi',o:'help'},__n$x$t:{a.b:{e:'hello'}}}
   */
    function _parse(src, ns, head, top) {
        if (src && src.__n$x$t) return src; //no validation!!!
        var current = head || (top = {});
        var prefix = ns ? ns + DOT : '';
        for (var key in src) {
            var finalValue = src[key];
            var path;
            if (key.indexOf('[') < 0) {
                path = key;
            } else {
                var data = parseKey(key, _error);
                if (!data) continue; //error in parsing
                if (data.rule) {
                    if (!isPureObject(finalValue))
                        finalValue = {'': finalValue};
                    var rule = {
                        rule: data.rule,
                        options: Configs.withSource(
                            key,
                            _parse,
                            finalValue,
                            data.key ? prefix + data.key : ns
                        ),
                    };
                    current = _parse(
                        {'_triggers.rules+': [rule]},
                        '',
                        current,
                        top
                    );
                    continue;
                } else path = data.key;
            }
            var p = _split(path, prefix);
            if (!p.key) {
                if (isPureObject(finalValue)) {
                    current = _parse(finalValue, p.ns, current, top);
                } else {
                    _error(
                        'Cannot set namespace {path} to {val}',
                        p.ns,
                        finalValue
                    );
                }
            } else if (p.ns) {
                if (current[p.ns] && _hasProp(current[p.ns], p.key)) {
                    current = current.__n$x$t = {};
                }
                (current[p.ns] || (current[p.ns] = {}))[p.key] = finalValue;
            } else {
                _error('Unknown namespace {path}', p.key);
            }
        }
        return head ? current : top;
    }

    function forEachNs(layers, func) {
        while (layers) {
            for (var ns in layers) {
                if (ns === '__n$x$t') continue;
                func(ns, layers[ns]);
            }
            layers = layers.__n$x$t;
        }
    }

    var _hash = JSON.stringify; //TODO find a more efficient way
    function _optimize(val, current) {
        if (val === current) return current;
        if (typeof val !== 'object') return val;
        var _isArr = isArray(val) && isArray(current);
        if (
            (!_isArr || val.length === current.length) &&
            _hash(val) === _hash(current)
        )
            return current;
        if (!_isArr || !isPureObject(val[0])) return val;
        var map = current.map(_hash);
        return val.map(function (e, i) {
            var t = map.indexOf(_hash(e));
            if (t < 0) return val[i];
            map[t] = null; //ensure unique
            return current[t];
        });
    }

    //To add new operation: detect in _ext, implement in _evaluate
    function _ext(n) {
        var op = n[n.length - 1];
        return op === '+' || op === '-' ? op : '';
    }
    /**
     * Opdates which fulfil 3 criteria.
     * 1. Repeated execution is a fast no op.
     * 2. The data must be self sufficient
     *  regardless of missing defaults.
     * 3. Any combination of available ops
     * must fulfil both criteria 1 && 2.
     */
    function _evaluate(old, val, op, hasProp) {
        var oldArr;
        var _isArr = isArray(val) || (hasProp && isArray(old));
        val = _optimize(val, old);
        //requirement 1
        if (op === '+' && val === old) return old;
        if (!_isArr) {
            val = Utils.parseList(String(val));
            oldArr = old ? Utils.parseList(String(old)) : [];
        } else {
            if (!isArray(val) || (hasProp && !isArray(old))) return false; //requirement 2
            oldArr = hasProp ? old : [];
        }
        var filtered = oldArr.filter(Utils.notIn(val));
        if (op === '+') val = filtered.concat(val);
        else if (filtered.length === oldArr.length) return old;
        else val = filtered;
        return _isArr ? val : val.join(SEP);
    }

    function _opdate(obj1, p, l, op, path) {
        var f = _evaluate(obj1[p], l, op, _hasProp(obj1, p));
        if (f !== false) {
            return (obj1[p] = f);
        } else {
            _error(
                'Type mismatch: Cannot modify value at {key} in {ns}',
                (path ? path + DOT : path) + p
            );
            return obj1[p];
        }
    }

    function _validate(val, schema, path) {
        if (Configs._debug) debug.debug(path, '-->', val);
        try {
            var error = schema.validate(val);
            if (!error) return true;
            _error(
                'Invalid value for {path}, {val} : {cause}',
                path,
                val,
                error
            );
        } catch (e) {
            _error('Error validating {path}:{val} : {cause}', path, val, e);
        }
    }

    /*Merge one namespace with another*/
    function _mergeNs(dest, src, ns, mask) {
        if (mask && !mask[ns]) return;
        var info = getInfo(ns);
        var type = info && info.type && Schema.parse(info.type); //Only uses Map
        for (var key in src) {
            var k = key.indexOf(DOT);
            var isNotDeep = true;
            var firstPart;
            if (k > 0) {
                firstPart = key.substring(0, k);
                isNotDeep = false;
            } else firstPart = key;

            var ext = _ext(firstPart);
            var prop = ext ? firstPart.slice(0, -1) : firstPart;
            if (mask && !_hasProp(mask[ns], prop)) continue;
            if (type && type.keys) {
                if (!_validate(prop, type.keys, ns)) continue;
            } else if (!_hasProp(allConfigs[ns], prop)) {
                _error(
                    'Unknown option {key} in namespace {ns}',
                    ns + DOT + key
                );
                continue;
            }
            var previous = dest[prop];
            if (isNotDeep && !ext) {
                dest[prop] = src[key];
            } else if (isNotDeep) {
                _opdate(dest, prop, src[key], ext, ns);
            } else if (ext) {
                //Wrong ops e.g a+.b.c
                _error('Invalid property chain: {key} in {ns}', ns + DOT + key);
                continue;
            } else {
                ext = _ext(key);
                var chain = key.split(DOT);
                var last = /** @type {string} */ (chain.pop()); //order matters
                var target = deepGet(dest, chain);
                var result = src[key];
                if (!target.missing && isPureObject(target.val)) {
                    if (ext) {
                        var m = {};
                        if (_hasProp(target.val, last))
                            m[last] = target.val[last];
                        result = _opdate(
                            m,
                            last,
                            src[key],
                            ext,
                            ns + DOT + chain.join(DOT)
                        );
                    }
                    if (result === target.val[key]) continue;
                }

                //Update chain
                for (var r = 0, parent = dest; r < chain.length; r++) {
                    var link = chain[r];
                    if (isPureObject(parent[link])) {
                        parent = parent[link] = Object.assign({}, parent[link]);
                    } else {
                        if (_hasProp(parent, link)) {
                            _error(
                                'Discarding non-object value while updating {path} : {val}',
                                ns + DOT + chain.slice(0, r + 1).join(DOT),
                                parent[link]
                            );
                        }
                        parent = parent[link] = {};
                    }
                }
                parent[last] = result;
            }
            if (dest[prop] !== previous) {
                var schema =
                    (type && type.values) ||
                    inferSchema(ns + DOT + prop, allConfigs[ns][prop]);
                if (!_validate(dest[prop], schema, ns + DOT + firstPart)) {
                    dest[prop] = previous;
                    continue;
                }
            }
        }
    }

    function _merge(dest, layers, mask) {
        forEachNs(layers, function (ns, data) {
            _mergeNs(dest[ns] || (dest[ns] = {}), data, ns, mask);
        });
        return dest;
    }
    /*endregion*/

    var handlers = Config.$handlers;
    Configs.withUpdateHandler = function (handler, func, _a, _b) {
        var m = handlers[''];
        try {
            handlers[''] = handler;
            return func(_a, _b);
        } finally {
            handlers[''] = m;
        }
        //Optional: call Configs.commit() to clear _changes.
    };

    var _changes = {};
    /** @type {{back:Record<String,Array<Object>>,front:Record<String,Array<Object>>}} */
    //TODO: Potential speed ups:
    //1. cache #back
    //2. _merge backwards
    //3. use Maps instead of objects for back and front
    var configs = {back: {}, front: {}};
    function _dirty(layers, copy) {
        var m = copy ? {} : _changes;
        forEachNs(layers, function (ns, data) {
            m[ns] = m[ns] || {};
            for (var key in data) {
                var prop = key;
                var k = prop.indexOf(DOT);
                if (k > -1) prop = prop.slice(0, k);
                var ext = _ext(prop);
                if (ext) prop = prop.slice(0, -1);
                m[ns][prop] = true;
            }
            if (copy) Object.assign(_changes[ns] || (_changes[ns] = {}), m[ns]);
        });

        return m;
    }

    Configs.setConfig = _checkErrorFlag(function (name, config, inFront) {
        var t = inFront ? configs.front : configs.back;
        var layers = config ? _parse(config) : null;
        _dirty(layers);
        _dirty(t[name]);
        t[name] = layers;
        return true;
    });

    Configs.removeConfig = function (name, inFront) {
        var t = inFront ? configs.front : configs.back;
        _dirty(t[name]);
        delete t[name];
    };

    var inUpdate,
        commitDepth = 0,
        numCommits = 0;
    //Apply the value and trigger events
    function mutexUpdate(val, current, path) {
        var _id = numCommits;
        var isNs = isNamespace(path);
        if (!isNs) throw new Error(path + ' is not a valid namespace!!!');
        current = current || allConfigs;
        //Use registered handlers
        if (handlers[path] && handlers[path].update) {
            return handlers[path].update(val, current, path) !== false;
        }
        var success = true;
        if (path) {
            for (var j in val) {
                var n = _optimize(val[j], current[j]);
                if (current[j] === n) continue;
                if (typeof n !== 'object')
                    success = configure(j, n, path, true) && success;
                else success = configureObj(j, n, path, true) && success;
                if (_id !== numCommits) break;
            }
        } else {
            for (var i in val) {
                success = mutexUpdate(val[i], current[i], i) && success;
                if (_id !== numCommits) break;
            }
        }
        return success;
    }

    function _finishCurrentUpdate() {
        if (inUpdate !== undefined) {
            if (Configs._debug) debug.debug('Finishing previous update...');
            if (commitDepth > 7 || (commitDepth > 1 && numCommits > 15)) {
                _error(
                    'Recursive update {cause} limit exceeded!!!',
                    null,
                    null,
                    commitDepth > 7 ? 'depth' : 'size'
                );
                return false;
            }
            if (!mutexUpdate(inUpdate, null, '')) errorFlag++;
            if (Configs._debug) debug.debug('Finished update...');
            inUpdate = undefined;
        }
        return true;
    }
    /**
     * Updates a namespace 'path' with 'value'.
     * Similar to configure/configureObj, calls event listeners.
     * Not to be used directly, use save ,apply or commit.
     */
    Configs.update = function update(value, path, mask) {
        if (inUpdate) throw new Error('Concurrent updates are not allowed!!!');
        try {
            commitDepth++;
            numCommits++;
            inUpdate = value;
            if (Configs._debug) debug.debug('Applying update...', value);
            return mutexUpdate(value, null, path);
        } finally {
            if (--commitDepth == 0) numCommits = 0;
            inUpdate = undefined;
            if (handlers['']) _dirty(mask);
        }
    };

    //Merge all configs added in setconfig and update
    Configs.commit = _checkErrorFlag(function () {
        if (!_finishCurrentUpdate()) return false;
        var t = getBaseConfig(_changes);
        for (var b in configs.back) {
            if (Configs._debug)
                debug.debug(
                    'Adding ',
                    b,
                    '(',
                    configs.back[b] && '{}',
                    ')',
                    '....'
                );
            _merge(t, configs.back[b], _changes);
        }
        for (var f in configs.front) {
            if (Configs._debug)
                debug.debug(
                    'Adding ',
                    f,
                    '(',
                    configs.front[f] && '{}',
                    ')',
                    '....'
                );
            _merge(t, configs.front[f], _changes);
        }
        var mask = _changes;
        _changes = {};
        return Config.withoutStorage(Configs.update, t, '', mask);
    });

    //Commit a configuration to memory
    Configs.save = _checkErrorFlag(function (config) {
        var layers = _parse(config);
        var mask = _dirty(layers, true);
        var base = getBaseConfig(mask);
        if (inUpdate) {
            debug.error(new Error('Nested updates might not be saved!!!.'));
            if (!_finishCurrentUpdate()) return false;
        }
        try {
            return Configs.update(_merge(base, layers, mask), '', mask);
        } finally {
            //When a rule/commit was triggered, this would be unecessary
            var p = errorFlag; //Reset error flags for latter commit.
            Configs.withErrorHandler(Utils.noop, Configs.commit);
            errorFlag = p;
        }
    });

    //Like #save but saves only the changes to
    //the current configuration.
    Configs.apply = _checkErrorFlag(function (config) {
        //reset rules
        return Configs.save(Configs.diff(allConfigs, config));
    });
    Configs.diff = function (base, config) {
        var layers = _parse(config);

        //Parse treats all rules like + ops
        //Merge the rules ahead of time to get correct diffs
        var ignoreTriggers = false;
        var t = _merge({}, layers, {_triggers: {rules: true}});
        if (t._triggers) {
            if (layers === config) layers = Object.assign({}, config);
            layers._triggers = Object.assign(
                layers._triggers || t._triggers,
                t._triggers
            );
            ignoreTriggers = true;
        }

        var diff = {},
            head = diff;
        forEachNs(layers, function (ns, data) {
            if (!base[ns]) return (head[ns] = data);
            var ignoreRules = ignoreTriggers && ns === '_triggers';
            var d;
            for (var i in data) {
                if (ignoreRules && i === 'rules+') continue;
                var old = base[ns][i];
                var val = _optimize(data[i], old);
                if (old === val) continue;
                if (!d)
                    d = (head[ns] ? (head = head.__n$x$t = {}) : head)[ns] = {};

                var m = getInfo(ns + DOT + i);
                var join = false;
                if (!isArray(old) || !isArray(val)) {
                    if (m && m.isList) {
                        join = true;
                        old = Utils.parseList(old);
                        val = Utils.parseList(val);
                    } else if (_ext(i)) {
                        d[i] = _evaluate(d[i], val, '+', _hasProp(d, i));
                        continue;
                    } else {
                        d[i] = val;
                        continue;
                    }
                }
                var added = val.filter(Utils.notIn(old));
                var removed = old.filter(Utils.notIn(val));
                if (added.length + removed.length === val.length + old.length) {
                    d[i] = join ? data[i] : val;
                } else {
                    d[i + '+'] = join ? added.join(SEP) : added;
                    d[i + '-'] = join ? removed.join(SEP) : removed;
                }
            }
        });
        console.log(diff);
        return diff;
    };

    //Return the values that are stored in memory
    function getBaseConfig(mask) {
        var m = {};
        for (var ns in allConfigs) {
            if (!mask[ns]) continue;
            m[ns] = {};
            for (var i in mask[ns]) {
                m[ns][i] = allConfigs[ns].__memory[i];
            }
        }
        return m;
    }

    //Copy values from current configuration
    //Ignore values whose info is NO_USER_CONFIG
    Configs.toJSON = function () {
        var keys = Object.keys(allConfigs).sort();
        var userConfig = {};
        //Guarantee the following keys come first
        userConfig.ui = undefined;
        userConfig.files = undefined;
        userConfig.documents = undefined;
        userConfig.editor = undefined;

        for (var i = 0; i < keys.length; i++) {
            var path = keys[i];
            if (getInfo(path) === NO_USER_CONFIG) continue;
            var parent,
                name = '';
            if (path.indexOf(DOT) > -1) {
                // Add nested configuration
                var parts = path.split(DOT);
                name = /** @type {string} */ (parts.pop());
                var res = deepGet(userConfig, parts);
                if (res.missing) {
                    debug.warn('Missing parent namespace ' + path);
                    continue;
                } else parent = res.val;
            } else {
                name = path;
                parent = userConfig;
            }
            var children =
                handlers[path] && handlers[path].toJSON
                    ? handlers[path].toJSON()
                    : allConfigs[path];
            parent[name] = {};
            var keys2 = Object.keys(children);
            if (!handlers[path] || !handlers[path].toJSON) keys2.sort();
            for (var k in keys2) {
                var j = keys2[k];
                if (getInfo(path + DOT + j) === NO_USER_CONFIG) continue;
                parent[name][j] = children[j];
            }
        }
        return userConfig;
    };
    //Used by (grace/ext/configs/context).
    Configs.$parseRules = function (conf, ns) {
        return _merge({}, _parse(conf, ns))._triggers.rules;
    };
    Configs.$getConfig = function (path) {
        var s = _split(path, '');
        return s.ns ? allConfigs[s.ns][s.key] : undefined;
    };
    (function () {
        var Actions = require('grace/core/actions').Actions;
        var FileUtils = require('grace/core/file_utils').FileUtils;
        var Notify = require('grace/ui/notify').Notify;
        Actions.addAction({
            caption: 'Load as configuration',
            extension: 'json',
            icon: 'settings',
            showIn: 'fileview.file',
            handle: function (e) {
                e.preventDefault();
                FileUtils.getDocFromEvent(
                    e,
                    function (res) {
                        if (res) {
                            require(['grace/ext/json_ext'], function (mod) {
                                Configs.setConfig(
                                    e.filepath,
                                    mod.JSONExt.parse(res)
                                );
                                Configs.commit();
                            });
                        }
                    },
                    true,
                    true
                );
            },
        });
        Actions.addAction({
            icon: 'warning',
            caption: 'Clear saved settings',
            sortIndex: 1000,
            showIn: 'actionbar.settings',
            handle: function () {
                Notify.prompt(
                    "<h6>Clear Saved Settings</h6>\
                <p style='font-size:1rem'>In the textbox below, you can either specify\
                <ul class='ml-15'><li><span class='error-text'>all</span> to clear all values or</li><li>A comma separated string list of namespaces. Nested namespaces must be specified separately. Example\n<small><code>search, editor, keyBindings.intellisense</code></small></li></ul></p><p style='font-size:1rem'> <span class='error-text'>Restart</span> immediately after unless previous configuration might be rewritten back.</p>",
                    function resetAll(value) {
                        if (!value) return;
                        var toReset, caption;
                        if (value == 'all') {
                            toReset = Object.keys(allConfigs);
                            caption = 'all your configuration';
                        } else {
                            toReset = Utils.parseList(value);
                            caption =
                                'all your configurations in\n' +
                                toReset.join(',\n');
                        }
                        Notify.ask(
                            'This will reset ' + caption + '\n   Continue?',
                            function () {
                                for (var y in toReset) {
                                    var ns = toReset[y];
                                    for (var m in allConfigs[ns]) {
                                        Config.unregister(m, ns);
                                    }
                                }
                                Notify.info(
                                    'Restart Immediately to Apply Changes'
                                );
                            }
                        );
                    },
                    'all',
                    {
                        options: Utils.mergeList(Object.keys(allConfigs), [
                            'all',
                        ]),
                        complete: function (value) {
                            var name = value.split(',').pop();
                            return this.options.filter(function (e) {
                                return (
                                    e
                                        .toLowerCase()
                                        .indexOf(name.toLowerCase()) > -1
                                );
                            });
                        },
                        update: function (input, value) {
                            var prec = input.value.lastIndexOf(',') + 1;
                            input.value =
                                input.value.substring(0, prec) + value;
                        },
                    }
                );
            },
        });
    })();
    exports.Configs = Configs;
});