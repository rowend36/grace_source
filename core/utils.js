_Define(function(global) {
    function CircularBffer(size) {
        if (size === undefined) size = 50;
        var buffer = Array(size);
        var index = 0;
        var overflow = true;
        return {
            push: function(el) {
                buffer[index] = el;
                index++;
                if (index == size) {
                    overflow = true;
                    index = 0;
                }
            },
            getArray: function() {
                if (overflow) {
                    var before = buffer.slice(0, index);
                    var after = buffer.slice(index, size);
                    return after.concat(before);
                } else {
                    return buffer.slice(0, index)
                }
            },
            reset: function(obj) {
                overflow = false;
                if (obj) {
                    buffer = obj;
                    index = buffer.length;
                    size = Math.max(index, size);
                } else {
                    index = 0;
                }
            }
        };
    }


    function parseList(list_text) {
        var result = [];
        if (list_text) {
            var stripSpace = /^\s*|\s*$/;
            list_text = list_text.replace(stripSpace, "");
            var list = list_text.split(/\s+|\s*,\s*/);
            for (var index in list) {
                if (list[index]) result.push(list[index]);
            }
        }
        return result;
    }

    function genSpaces(amount, sep = " ") {
        if (amount === 0) return "";
        if (amount < 2) return sep;
        return new Array(amount + 1).join(sep);
    }

    function printArray(obj, step) {
        var mid = Math.max(5, obj.length - 3);
        var end = Math.min(5, obj.length);
        var arr = {};
        for (var i = 0; i < end; i++) {
            arr[i] = print(obj[i], (step - 1) || 1);
        }
        for (i = mid; i < obj.length; i++) {
            arr[i] = print(obj[i], (step - 1) || 1);
        }
        return arr;
    }

    function print(obj, step = 2) {
        if (!obj) return obj;
        if (typeof obj == 'number') return obj;
        if (typeof obj == 'string') return '"' + obj + '"';
        if (typeof obj == 'boolean') return '<' + obj + '>';
        else if (typeof obj == 'function') {
            return "function" + (obj.name || "<anonymous>") + "()";
        } else if (obj.jquery) {
            return "$:(" + obj.selector + ")->" + print(obj[0], 1) + "[" + obj.length + "]";
        } else if (obj.DOCUMENT_NODE) {
            return "[" + obj.tagName + "] ." + obj.className + " #" + obj.id;
        } else if (step < 1 || obj === window) {
            return ((typeof obj.toString == "function" ? obj.toString() : "[Object]").substr(0, 50));
        } else if (Array.isArray(obj)) {
            return printArray(obj, step);
        } else {
            var clone = {};
            for (var i in obj) {
                clone[i] = print(obj[i], step - 1);
            }
            return clone;
        }
    }

    function wrapFunc(func, name, log) {
        return (function() {
            log(name + " called with", {
                "this": print(this, 1, 2),
                "args": printArray(arguments, 2, 3),
                "stack": new Error().stack.split("\n")
            });
            var result = func.apply(this, arguments);
            log(name + "-->", print(result));
            return result;
        });
    }

    function wrap(obj, include, exclude, log) {
        log = log || window.console.debug;
        include = include || obj;
        for (var i in include) {
            if (typeof obj[i] == "function" && (!exclude || exclude.indexOf(i) < 0))
                obj[i] = wrapFunc(obj[i], i, log);
        }
    }
    var trackFunc = function(start, end, name, func) {
        return function() {
            var preResult;
            if (start) {
                preResult = start(name, this, arguments);
                if (preResult && preResult.override) return preResult.result;
            }
            var result = func.apply(this, arguments);
            if (end) {
                preResult = end(name, this, arguments, result, preResult);
                if (preResult) return preResult;
            }
            return result;
        };
    };

    function track(obj, include, exclude, start, end) {
        include = include || obj;
        for (var i in include) {
            if (typeof obj[i] == "function" && (!exclude || exclude.indexOf(i) < 0))
                obj[i] = trackFunc(start, end, i, obj[i]);
        }
    }

    function extend(prop, superClass, mixin) {
        var mixins = Array.prototype.slice.call(arguments, 2);
        var a = prop.prototype;
        prop.prototype = Object.create(superClass.prototype);
        for (var i in mixins) {
            Object.assign(prop.prototype, mixins[i].prototype);
        }
        Object.assign(prop.prototype, a);
        prop.prototype.super = superClass.prototype;
        prop.super = superClass.apply.bind(superClass);
    }


    function delay(func, wait) {
        //cancellable function
        var timeout, ctx, args;
        var later = function() {
            timeout = null;
            func.apply(ctx, args);
            ctx = args = null;
        }
        var call = function() {
            ctx = this, args = arguments;
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
        };
        call.now = function() {
            func.apply(null, arguments);
            call.cancel()
        }
        call.cancel = function() {
            if (timeout) {
                clearTimeout(timeout);
                ctx = args = null;
            }
        }
        return call;
    }

    function throttle(func, wait) {
        //like delay but allows immediate execution
        //if calls are infrequent, useful for buttons,etc
        var last = 0,
            timeout;
        var context, args;
        var later = function() {
            last = new Date().getTime()
            timeout = null;
            func.apply(context, args)
            context = args = null;
        }
        return function() {
            context = this
            args = arguments;
            if (timeout) return;
            var now = new Date().getTime()
            if (now - last > wait) {
                later()
            } else {
                timeout = setTimeout(later, wait - (now - last));
            }
        }
    }

    function debounce(func, wait) {
        //like delay except each call cancels the previous
        //useful but op is might be suspended indefinitely
        var timeout;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
        }
    }

    function asyncEach(list, each, finish, parallel, unfinished, cancellable) {
        var i = 0;
        var resume, cancel, waiting, cancelled;
        parallel = parallel || 1;
        if (isNaN(parallel)) throw new Error("Invalid Parameter for parallel:" + parallel);
        if (unfinished) {
            resume = function(finished) {
                if (finished) unfinished = false;
                var a = waiting;
                waiting = 0;
                while (a--) {
                    next();
                }
            }
            waiting = 0;
        }
        if (cancellable) {
            cancel = function(e) {
                if (!cancelled) {
                    unfinished = false;
                    list = [];
                    cancelled = e || true;
                    next();
                }
            }
        }
        var next = function() {
            if (i >= list.length) {
                if (unfinished) {
                    waiting++;
                } else if (finish && (--parallel) == 0) {
                    finish(cancelled);
                    finish = null;
                } else if (parallel < 0) {
                    console.warn('Counter error: you might be calling next twice or calling both next and cancel');
                }
            } else {
                var item = list[i];
                each(item, i++, next, cancel);
            }
        }
        for (var j = parallel; j > 0; j--) {
            next();
        }
        return resume;
    }
    var toSizeString = function(size, nameType) {
        var sizes = (nameType == "full" ? ["bytes", "kilobytes", "megabytes", "gigabytes", "terabytes"] : ["bytes", "kb", "Mb", "Gb", "Tb"])
        var i = 0;
        while (size > 1024) {
            i++;
            size /= 1024.0;
        }
        return (Math.round(size * 100) / 100.0) + " " + sizes[i]
    }
    var createCounter = function(cb) {
        var counter = {};
        var count = 0;
        var errors = counter.errors = [];
        counter.increment = function() {
            count++;
        };
        counter.decrement = function(err, res) {
            count--;
            if (err)
                errors.push(err);
            if (count === 0 && cb) {
                if (errors.length < 1) cb();
                else cb(errors);
            } else if (counter.count < 0) {
                throw new Error("Counter error less than 0");
            }
        };
        return counter;
    }


    var times = {
        "": 1
    };
    times["milli"] = times["millisecond"] = times["ms"] = times["millisec"] = times[""]
    times["sec"] = times["second"] = times["s"] = times[""] * 1000;
    times["min"] = times["minute"] = times["m"] = times["s"] * 60;
    times["hr"] = times["hour"] = times["h"] = times["min"] * 60;
    times["day"] = times["d"] = times["hr"] * 24;
    times["week"] = times["wk"] = times["w"] = times["d"] * 7;
    times["b"] = times["byte"] = times[""];
    times["kb"] = times["kilobyte"] = times["kib"] = times["k"] = times["b"] * 1024;
    times["mb"] = times["megabyte"] = times["m"] = times["kb"] * 1024;
    times["gb"] = times["gigabyte"] = times["g"] = times["mb"] * 1024;

    function parseTime(text) {
        var re = /\s*(\d+(?:\.\d+)?)\s*([A-Za-z]*),*/gi;
        var match = re.exec(text);
        var time = 0;
        while (match) {
            var unit = times[match[2]];
            if (!unit && match[2].endsWith('s')) {
                unit = times[match[2].substring(0, match[2].length - 1)];
            }
            time += (parseFloat(match[1]) * unit) || 0;
            match = re.exec(text);
        }
        return time;
    }

    function mergeList(original, update, copy, compare) {
        var list = copy ? original.slice(0) : original;
        var last = 0;
        var changed;
        for (var i = 0; i < update.length; i++) {
            var pos = list.indexOf(update[i], last);
            if (pos < 0) {
                for (; last < list.length; last++) {
                    if (compare ? compare(original[last], update[i]) > 0 : original[last] > update[i]) {
                        break;
                    }
                }
                list.splice(last, 0, update[i]);
                last = last + 1;
            } else last = pos + 1;
        }
        return list;
    }

    function setImmediate(func, args) {
        setTimeout(func, 0);
    }

    function createSingleService(func) {
        var service_ = function() {
            if (service_.cancel) {
                service_.cancel();
                service_.cancel = null;
            }
            func.apply(this, arguments);
        }
        service_.cancel = null;
        return service_;
    }
    var id_count = 0;
    global.Utils = {
        CBuffer: CircularBffer,
        repeat: genSpaces,
        single: createSingleService,
        noop: function() {},
        assert: function(cond, e) {
            if (!(cond)) throw new Error(e || 'AssertError');
            return true;
        },
        genID: function(s) {
            return s + "" + ("" + new Date().getTime()).substring(2) + (((++id_count) % 90) + 10);
        },
        getCreationDate: function(id, s) {
            s = s || "m";
            var today = new Date().getTime();
            var l = parseInt(("" + today).substring(0, 2));
            var m = id.substr(s.length, 11);
            var forwardDate = parseInt(l + m);
            return new Date((forwardDate > today) ? forwardDate - 100000000000 : forwardDate);
        },
        print: print,
        inspect: function() {
            window.console.debug(print.apply(null, arguments.length == 1 || typeof arguments[1] == "number" ? arguments : [arguments]));
        },
        mergeList: mergeList,
        except: function(l) {
            return function(e) {
                return l !== e;
            }
        },
        setImmediate: setImmediate,
        not: function(func) {
            return function() {
                return !func.apply(this, arguments);
            }
        },
        inherits: extend,
        toChars: function(str) {
            return Array.prototype.map.call(str, (e, i) => e.charCodeAt(0)).toString();
        },
        createCounter: createCounter,
        parseTime: parseTime,
        toSize: toSizeString,
        asyncForEach: asyncEach,
        parseList: parseList,
        parseSize: parseTime,
        debounce: debounce,
        delay: delay,
        wrap: wrap,
        track: track,
        throttle: throttle,
        regEscape: function regExpEscape(s) {
            return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
        },
    };
}) /*_EndDefine*/