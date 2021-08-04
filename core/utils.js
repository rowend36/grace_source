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
                    return buffer.slice(0, index);
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

    function genSpaces(amount, sep) {
        if (!amount || amount < 0) return "";
        if (sep === undefined) sep = " ";
        if (amount < 2) return sep;
        if (amount < 10000) {
            return new Array(amount + 1).join(sep);
        }
        var half = amount >> 1;
        return genSpaces(amount - half, sep) + genSpaces(half, sep);
    }

    function printArray(obj, step) {
        var size = step > 1 ? 5 : 30;
        var offsetStart = Math.min(size, obj.length);
        var offsetEnd = Math.max(obj.length - size, offsetStart);
        var arr = {};
        for (var i = 0; i < offsetStart; i++) {
            arr[i] = print(obj[i], (step - 1) || 1);
        }
        for (i = offsetEnd; i < obj.length; i++) {
            arr[i] = print(obj[i], (step - 1) || 1);
        }
        return arr;
    }

    function print(obj, step) {
        if (!obj) return obj;
        if (arguments.length == 1) step = 2;
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
            if (typeof obj[i] == "function" && (!exclude || exclude.indexOf(i) < 0)) obj[i] = wrapFunc(obj[i],
                i, log);
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
            if (typeof obj[i] == "function" && (!exclude || exclude.indexOf(i) < 0)) obj[i] = trackFunc(start,
                end, i,
                obj[i]);
        }
    }

    function extend(prop, superClass, mixins) {
        mixins = Array.prototype.slice.call(arguments, 2);
        var a = prop.prototype;
        prop.prototype = Object.create(superClass.prototype);
        for (var i in mixins) {
            Object.assign(prop.prototype, mixins[i].prototype);
        }
        Object.assign(prop.prototype, a);
        prop.prototype.constructor = prop;
        prop.super = superClass.apply.bind(superClass);
        prop.superProps = superClass.prototype;
    }

    /*Fancy timeouts*/
    //Simplest schedule something to be done if it's not already done
    function delay(func, wait) {
        wait = wait || 30;
        //cancellable function
        var timeout, ctx, args;
        var later = function() {
            timeout = null;
            var _ctx = ctx,
                _args = args;
            ctx = args = null;
            func.apply(_ctx, _args);
        };
        var call = function() {
            ctx = this, args = arguments;
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
        };
        call.now = function() {
            call.cancel();
            ctx = this;
            args = arguments;
            later();
        };
        call.later = function(wait) {
            call.cancel();
            timeout = setTimeout(later,wait);
        };
        call.cancel = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = ctx = args = null;
            }
        };
        return call;
    }
    
    //Schedule only if it's been a short time since last call
    //Only really useful for ui eg button clicks, render updates
    function throttle(func, wait) {
        var last = 0,
            timeout;
        var ctx, args;
        wait = wait || 30;
        var later = function() {
            last = new Date().getTime();
            timeout = null;
            var _ctx = ctx,
                _args = args;
            ctx = args = null;
            func.apply(_ctx, _args);
        };
        var call = function() {
            ctx = this;
            args = arguments;
            if (timeout) return;
            var now = new Date().getTime();
            if (now - last > wait) {
                later();
            } else {
                timeout = setTimeout(later, wait - (now - last));
            }
        };
        call.now = function() {
            ctx = this;
            args = arguments;
            call.cancel();
            later();
        };
        call.cancel = function() {
            if (timeout) {
                clearTimeout(timeout);
                timeout = ctx = args = null;
            }
        };
        return call;
    }
    
    //Cancel any previous posts and then post again, used for saving
    function debounce(func, wait) {
        //like delay except each call cancels the previous
        //simple and useful but op might be suspended indefinitely
        var timeout;
        wait = wait || 30;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                func.apply(context, args);
            };
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
        };
    }

    //Put on a queue and then call each one at a time
    //Considering replacing this something from app_cycle
    function spread(func, wait) {
        var tasks = [];
        var execute = throttle(function() {
            var task = tasks.pop();
            func.apply(task.ctx, task.args);
            if (tasks.length) execute();
        },wait);
        var post = function(){
            tasks.push({ctx:this,args:arguments});
            execute();
        };
        post.cancel = execute.cancel;
    }
    /*The most powerful async method ever built*/
    //call stack rearranging
    //parallelization
    //resume and cancel
    /*But spoilt by bad api, a method should have 2-3 arguments, anything longer is a scam*/

    //unfinished can be called multiple times
    //To enable asyncEach to stop when the last next is called,
    //call resume(true) immediately
    //unless it will wait indefinitely for the result

    function asyncEach(list, each, finish, parallel, unfinished, cancellable) {
        var i = 0;
        var resume, cancel, waiting, cancelled;
        parallel = parallel || 1;
        if (isNaN(parallel)) throw new Error("Invalid Parameter for parallel:" + parallel);
        if (unfinished) {
            resume = function(finished) {
                if (finished) unfinished = false;
                var a = waiting;
                parallel += waiting;
                waiting = 0;
                while (a--) {
                    next();
                }
            };
            waiting = 0;
        }
        if (cancellable) {
            cancel = function(e) {
                if (!cancelled) {
                    unfinished = false;
                    list = [];
                    cancelled = e || true;
                }
                next();
            };
        }
        var callState = -1;
        //-1 - execute and handle posted calls
        //0 - just execute
        //1 - post
        //2 - has posted
        var next = function() {
            if (callState === 1) {
                callState = 2;
                return;
            }
            if (callState === 2) throw new Error('Next/cancel called more than once');
            if (i >= list.length) {
                if ((--parallel) == 0 && !unfinished) {
                    if (finish) {
                        finish(cancelled);
                        finish = null;
                    }
                } else if (parallel < 0) {
                    console.error(
                        'Counter error: you might be calling next twice or calling both next and cancel'
                    );
                } else {
                    waiting++;
                }
            } else {
                //rearrange calls as if we called setImmediate
                //in order to avoid blowing call stack
                var item = list[i];
                callState++;
                if (callState === 0) {
                    next();
                    for (; callState === 1;) {
                        callState = 0;
                        next();
                    }
                    callState = -1;
                    return;
                }
                each(item, i++, next, cancel);
                callState--;
            }
        };
        for (var j = parallel; j > 0; j--) {
            next();
        }
        return resume;
    }
    var toSizeString = function(size, nameType) {
        var sizes = (nameType == "full" ? ["bytes", "kilobytes", "megabytes", "gigabytes", "terabytes"] : [
            "bytes",
            "kb", "Mb", "Gb", "Tb"
        ]);
        var i = 0;
        while (size > 1024) {
            i++;
            size /= 1024.0;
        }
        return (Math.round(size * 100) / 100.0) + " " + sizes[i];
    };

    function plural(no, name) {
        return no + " " + name + (no > 1 ? "s" : "");
    }
    var createCounter = function(cb) {
        var counter = {};
        var count = 0;
        var errors = counter.errors = [];
        counter.increment = function() {
            count++;
        };
        counter.decrement = function(err) {
            count--;
            if (err) errors.push(err);
            if (count === 0 && cb) {
                if (errors.length < 1) cb();
                else cb(errors);
            } else if (count < 0) {
                throw new Error("Counter error less than 0");
            }
        };
        return counter;
    };
    var times = {
        "": 1
    };
    times.milli = times.millisecond = times.ms = times.millisec = times[""];
    times.sec = times.second = times.s = times[""] * 1000;
    times.min = times.minute = times.m = times.s * 60;
    times.hr = times.hour = times.h = times.min * 60;
    times.day = times.d = times.hr * 24;
    times.week = times.wk = times.w = times.d * 7;
    times.b = times.byte = times[""];
    times.kb = times.kilobyte = times.kib = times.k = times.b * 1024;
    times.mb = times.megabyte = times.m = times.kb * 1024;
    times.gb = times.gigabyte = times.g = times.mb * 1024;

    /**
     * @param [validate] {boolean}- return false if a value is wrong rather than ignore it
        To allow array ops such as arr.map(parseTime), this value must be true to have effect.
     */
    function parseTime(text, validate) {
        var re = /\s*(\d+(?:\.\d+)?)\s*([A-Za-z]*),*/gi;
        var match = re.exec(text);
        var time = 0;
        while (match) {
            var unit = match[2];
            var value = times[unit];
            if (value === undefined && unit.endsWith('s')) {
                value = times[unit.slice(0, -1)];
            }
            if (validate === true && value === undefined) return false;
            time += (parseFloat(match[1]) * value) || 0;
            match = re.exec(text);
        }
        return time;
    }

    function toTime(time) {
        if (!time || typeof time !== 'object') time = new Date(parseInt(time));
        var today = new Date();
        var deltaMs = today.getTime() - time.getTime();
        var currentDay = today.getHours() * times.hour + today.getMinutes() * times.minute;
        if (deltaMs < times.minute) return plural(Math.floor(deltaMs / 1000), "second") + " ago";
        else if (deltaMs < times.hour)
            return plural(Math.floor(deltaMs / times.minute), "minute") + " ago";
        else if (deltaMs < currentDay) {
            return "Today, " + time.toLocaleTimeString();
        } else if (deltaMs < currentDay + times.day) {
            return "Yesterday, " + time.toLocaleTimeString();
        } else if (deltaMs < currentDay + 2 * times.day) {
            return "Two days ago, " + time.toLocaleTimeString();
        } else return time.toLocaleString();
    }

    /*Add all entries in update that are not in original to original*/
    function mergeList(original, update, copy, compare) {
        var list = copy ? original.slice(0) : original;
        var last = 0;
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

    function setImmediate(func, arg1, arg2) {
        switch (arguments.length) {
            case 1:
                setTimeout(func, 0);
                break;
            case 2:
                setTimeout(func, 0, arg1);
                break;
            case 3:
                setTimeout(func, 0, arg1, arg2);
                break;
            case 0:
                return;
            default:
                var args = Array.prototype.slice.call(arguments, 0);
                args.splice(1, 0, 0);
                setTimeout.apply(window, args);
        }
    }

    function AbortSignal() {
        this.aborted = false;
        this.triggers = [];
        this.abort = this.control(this._abort.bind(this), false);
    }
    AbortSignal.prototype.control = function(func, abortCode) {
        var self = this;
        return function() {
            if (self.aborted) return typeof abortCode == 'function' ? abortCode.apply(this, arguments) :
                abortCode;
            return func.apply(this, arguments);
        };
    };
    AbortSignal.prototype._abort = function(cause) {
        this.aborted = cause || true;
        var triggers = this.triggers;
        this.triggers = null;
        for (var i = triggers.length; i > 0;) {
            triggers[--i].apply(null, arguments);
        }
        return true;
    };
    AbortSignal.prototype.notify = function(func) {
        if (this.aborted) setImmediate(func, [this.aborted]);
        else if (this.triggers.indexOf(func) < 0) this.triggers.push(func);
    };
    AbortSignal.prototype.unNotify = function(func) {
        var index;
        if (!this.aborted && (index = this.triggers.indexOf(func)) > -1) this.triggers.splice(index, 1);
    };
    AbortSignal.prototype.clear = function() {
        this.aborted = true;
        this.triggers = null;
    };

    function htmlEncode(string) {
        var entityMap = {
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;"
        };
        return String(string).replace(/[<>&]/g, function(s) {
            if (!s) return '';
            return entityMap[s];
        });
    }
    var id_count = 0;
    global.Utils = {
        CBuffer: CircularBffer,
        AbortSignal: AbortSignal,
        repeat: genSpaces,
        spread: spread,
        guardEntry: function(func, _throw, errorText) {
            var guard = false;
            if (arguments.length < 3) errorText = 'Attempt to call' + func.name +
                ' while a call ongoing ignored';
            return function() {
                if (guard) {
                    var error = new Error(errorText);
                    if (_throw) throw error;
                    else {
                        console.error(error);
                        return;
                    }
                }
                guard = true;
                try {
                    return func.apply(this, arguments);
                } finally {
                    guard = false;
                }
            };
        },
        setProp: function(obj, prop, value) {
            if (obj[prop] != value) {
                obj[prop] = value;
                return true;
            }
        },
        htmlEncode: htmlEncode,
        withTry: function(func, err) {
            if (arguments.length == 1) err = false;
            //intentions should be clear when necessary
            return function() {
                try {
                    return func.apply(this, arguments);
                } catch (e) {
                    console.error(e);
                }
                return err;
            };
        },
        noop: $.noop,
        assert: function(cond, e) {
            if (!(cond)) throw new Error(e || 'AssertError');
            return true;
        },
        eventGroup: function(emit) {
            var events = [];

            function off() {
                for (var i in events) {
                    var e = events[i];
                    e.t.off ? e.t.off(e.e, e.f) : e.t.removeEventListener(e.e, e.f);
                }
            }

            function on(ev, fn, emitter) {
                emitter = emitter || emit;
                events.push({
                    e: ev,
                    f: fn,
                    t: emitter
                });
                emitter.on ? emitter.on(ev, fn) : emitter.addEventListener(ev, fn);
            }
            return {
                on: on,
                off: off,
                once: function(ev, fn, emitter) {
                    on(ev, function() {
                        off();
                        fn.apply(this, arguments);
                    }, emitter);
                }
            };
        },
        genID: function(s) {
            return s + "" + ("" + new Date().getTime()).substring(2) + (((++id_count) % 90) + 10);
        },
        getCreationDate: function(id) {
            var today = new Date().getTime();
            var l = parseInt(("" + today).substring(0, 2));
            var m = id.substr(id.length - 11, 11);
            var forwardDate = parseInt(l + m);
            return new Date((forwardDate > today) ? forwardDate - 100000000000 : forwardDate);
        },
        print: print,
        inspect: function() {
            window.console.debug(print.apply(null, arguments.length == 1 || typeof arguments[1] ==
                "number" ?
                arguments : [arguments]));
        },
        mergeList: mergeList,
        setImmediate: setImmediate,
        //Slow but easy to write arr manipulation
        not: function(func) {
            return function() {
                return !func.apply(this, arguments);
            };
        },
        except: function(l) {
            return function(e) {
                return l !== e;
            };
        },
        notIn: function(arr) {
            return function(e) {
                return arr.indexOf(e) < 0;
            };
        },
        plural: plural,
        inherits: extend,
        //deprecated
        toChars: function(str) {
            return Array.prototype.map.call(str, function(e) {
                return e.charCodeAt(0);
            }).toString();
        },
        createCounter: createCounter,
        parseTime: parseTime,
        toTime: toTime,
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
            return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        },
    };
}); /*_EndDefine*/