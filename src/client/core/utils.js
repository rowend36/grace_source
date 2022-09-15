define(function (require, exports, module) {
    /*600 lines of utilities*/
    var debug = console;
    function parseList(list_text) {
        var result = [];
        if (list_text) {
            var stripSpace = /^\s*|\s*$/;
            list_text = list_text.replace(stripSpace, '');
            var list = list_text.split(/\s+|\s*,\s*/);
            for (var index in list) {
                if (list[index]) result.push(list[index]);
            }
        }
        return result;
    }

    var repeat = String.prototype.repeat
        ? function (amount, sep) {
              if (!amount || amount < 0) return '';
              return String(sep === undefined ? ' ' : sep).repeat(amount);
          }
        : function repeat(amount, sep) {
              if (sep === undefined) sep = ' ';
              if (!amount || amount < 0) return '';
              if (amount === 1) return sep;
              var half = amount >> 1;
              var text = sep;
              for (var i = 1; i <= half; i <<= 1) {
                  text = text + text;
              }
              return i < amount ? text + repeat(amount - i, sep) : text;
          };

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
    }

    /*Fancy timeouts*/
    function delay(func, wait) {
        assert(func, 'Must provide function');
        wait = wait || 30;
        var timeout, ctx, args;
        var later = function () {
            timeout = null;
            var _ctx = ctx,
                _args = args;
            ctx = args = null;
            func.apply(_ctx, _args);
        };
        var call = function () {
            (ctx = this), (args = arguments);
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
        };
        call.now = function () {
            call.cancel();
            ctx = this;
            args = arguments;
            later();
        };
        call.later = function (_wait) {
            call.cancel();
            ctx = this;
            timeout = setTimeout(later, _wait || wait);
        };
        call.cancel = function () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = ctx = args = null;
            }
        };
        return call;
    }

    //Cancel any previous posts and then post again, used for saving
    //Equivalent to args=>delay.cancel();delay(args)
    function debounce(func, wait) {
        var timeout;
        wait = wait || 30;
        return function () {
            var context = this,
                args = arguments;
            var later = function () {
                timeout = null;
                func.apply(context, args);
            };
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(later, wait);
        };
    }

    //Space calls to a function asynchronously  in order to nott block event loop. Similar to app_cyle.
    function spread(func, wait) {
        var tasks = [];
        var execute = delay(function () {
            var task = tasks.pop();
            func.apply(task.ctx, task.args);
            if (tasks.length) execute();
        }, wait);
        var post = function () {
            tasks.push({
                ctx: this,
                args: arguments,
            });
            execute();
        };
        post.cancel = execute.cancel;
        return post;
    }
    function assert(cond, e) {
        if (!cond) throw new Error(e || 'AssertError');
        return true;
    }
    /*The most powerful async method ever built*/
    //call stack rearranging
    //parallelization
    //resume and cancel
    /*But spoilt by bad api, a method should have 2-3 arguments, anything longer is a scam.*/

    /*Note on unfinished: resume can be called multiple times
    //Calling resume(true) tells async not to wait for new results when
    //after the last item is handled
    */
    function asyncEach(list, each, finish, parallel, unfinished, cancellable) {
        var i = 0;
        var resume, cancel, waiting, cancelled;
        parallel = parallel || 1;
        assert(parallel >= 1, 'Invalid parameter for parallel:' + parallel);
        if (unfinished) {
            resume = function (finished) {
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
            cancel = function (e) {
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
        var next = function () {
            if (callState === 2)
                throw new Error('Next/cancel called more than once');
            if (i >= list.length) {
                if (--parallel == 0 && !unfinished) {
                    if (finish) {
                        finish(cancelled);
                        finish = null;
                    }
                } else if (parallel < 0) {
                    debug.error(
                        new Error(
                            'Counter error: you might be calling next twice or calling both next and cancel',
                        ),
                    );
                } else {
                    waiting++;
                }
            } else {
                if (callState === 1) {
                    callState = 2;
                    return;
                }

                //rearrange calls as if we called setImmediate
                //in order to avoid blowing call stack
                //at the expense of an extra function call
                //ie manual tail call optimization
                var item = list[i];
                callState++;
                if (callState === 0) {
                    next();
                    for (; callState === 1; ) {
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
    var toSizeString = function (size, nameType) {
        var sizes =
            nameType == 'full'
                ? ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte']
                : ['byte', 'kb', 'Mb', 'Gb', 'Tb'];
        var i = 0;
        while (size > 1024) {
            i++;
            size /= 1024.0;
        }
        size = Math.round(size * 100) / 100.0;
        return sizes[i].length > 2
            ? plural(size, sizes[i])
            : size + ' ' + sizes[i];
    };

    function plural(no, name) {
        return (
            no +
            ' ' +
            name +
            (no > 1
                ? name[name.length - 1] === 's' || name[name.length - 1] === 'z'
                    ? 'es'
                    : 's'
                : '')
        );
    }
    var createCounter = function (cb) {
        var counter = {};
        var count = 0;
        var errors = (counter.errors = []);
        counter.increment = function () {
            count++;
        };
        counter.decrement = function (err) {
            count--;
            if (err) errors.push(err);
            if (count === 0 && cb) {
                if (errors.length < 1) cb();
                else cb(errors);
            } else if (count < 0) {
                throw new Error('Counter error less than 0');
            }
        };
        return counter;
    };
    var times = {
        '': 1,
    };
    times.milli = times.millisecond = times.ms = times.millisec = times[''];
    times.sec = times.second = times.s = times[''] * 1000;
    times.min = times.minute = times.m = times.s * 60;
    times.hr = times.hour = times.h = times.min * 60;
    times.day = times.d = times.hr * 24;
    times.week = times.wk = times.w = times.d * 7;
    times.b = times.byte = times[''];
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
            time += parseFloat(match[1]) * value || 0;
            match = re.exec(text);
        }
        return time;
    }

    function toTimeString(time) {
        if (!time || typeof time !== 'object') time = new Date(parseInt(time));
        var today = new Date();
        var deltaMs = today.getTime() - time.getTime();
        var currentDay =
            today.getHours() * times.hour + today.getMinutes() * times.minute;
        if (deltaMs < times.minute)
            return plural(Math.floor(deltaMs / 1000), 'second') + ' ago';
        else if (deltaMs < times.hour)
            return (
                plural(Math.floor(deltaMs / times.minute), 'minute') + ' ago'
            );
        else if (deltaMs < currentDay) {
            return 'Today, ' + time.toLocaleTimeString();
        } else if (deltaMs < currentDay + times.day) {
            return 'Yesterday, ' + time.toLocaleTimeString();
        } else if (deltaMs < currentDay + 2 * times.day) {
            return 'Two days ago, ' + time.toLocaleTimeString();
        } else return time.toLocaleString();
    }

    function mergeList(original, update, copy, compare) {
        var list = copy ? original.slice(0) : original;
        list.push.apply(list, update);
        list.sort(compare);
        return list;
    }
    var setImmediate =
        window.setImmediate ||
        function (func, arg1) {
            switch (arguments.length) {
                case 1:
                    setTimeout(func, 0);
                    break;
                case 2:
                    setTimeout(func, 0, arg1);
                    break;
                case 0:
                    return;
                default:
                    var args = Array.prototype.slice.call(arguments, 0);
                    args.splice(1, 0, 0);
                    setTimeout.apply(null, args);
            }
        };
    function removeFrom(arr, item) {
        var index = arr.indexOf(item);
        if (index > -1) {
            arr.splice(index, 1);
        }
        return index;
    }

    function htmlEncode(string) {
        var entityMap = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
        };
        return String(string).replace(/[<>&]/g, function (s) {
            if (!s) return '';
            return entityMap[s];
        });
    }

    function sentenceCase(text) {
        return text && text[0].toUpperCase() + text.slice(1).toLowerCase();
    }
    var idCount = Math.floor(Math.random() * 1000);
    exports.Utils = {
        repeat: repeat,
        spread: spread,
        unimplemented: function () {
            alert('Unimplemented');
        },
        setProp: function (obj, prop, value) {
            if (obj[prop] != value) {
                obj[prop] = value;
                return true;
            }
        },
        htmlEncode: htmlEncode,
        noop: function () {},
        assert: assert,
        groupEvents: function (_emitter) {
            var events = [];

            function off() {
                for (var i in events) {
                    var e = events[i];
                    e.t.off
                        ? e.t.off(e.e, e.f)
                        : e.t.removeEventListener(e.e, e.f);
                }
            }

            function on(ev, fn, emitter) {
                emitter = emitter || _emitter;
                events.push({
                    e: ev,
                    f: fn,
                    t: emitter,
                });
                emitter.on
                    ? emitter.on(ev, fn)
                    : emitter.addEventListener(ev, fn);
            }
            return {
                on: on,
                off: off,
                once: function (ev, fn, emitter) {
                    on(
                        ev,
                        function () {
                            off();
                            fn.apply(this, arguments);
                        },
                        emitter,
                    );
                },
            };
        },
        genID: function (prefix) {
            //m_adjjjdk6
            var body = (++idCount + new Date().getTime())
                .toString(36)
                .slice(-8);
            return prefix + repeat(9 - body.length, '_') + body;
        },
        getCreationDate: function (id) {
            var date = parseInt(id.slice(id.lastIndexOf('_') + 1), 36);
            //TODO: uncomment this in year 2059 :D
            // var today = Date.now();
            // while (today - date >= 2e11) date += Math.pow(36, 8);
            return new Date(date);
        },
        mergeList: mergeList,
        setImmediate: setImmediate,
        //Slow but easy to write arr manipulation
        not: function (func) {
            return function () {
                return !func.apply(this, arguments);
            };
        },
        removeFrom: removeFrom,
        notIn: function (arr) {
            return function (e) {
                return arr.indexOf(e) < 0;
            };
        },
        smallCaps: function (text) {
            return String(text).split(' ').map(sentenceCase).join(' ');
        },
        sentenceCase: sentenceCase,
        plural: plural,
        inherits: extend,
        //Used by Parser
        //and regex_find
        toChars: function (str) {
            return Array.prototype.map
                .call(str, function (e) {
                    return e.charCodeAt(0);
                })
                .toString();
        },
        createCounter: createCounter,
        parseTime: parseTime,
        toDate: toTimeString,
        parseSize: parseTime,
        toSize: toSizeString,
        asyncForEach: asyncEach,
        parseList: parseList,
        debounce: debounce,
        delay: delay,
        regEscape: function regExpEscape(s) {
            return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        },
        waterfall: function waterfall(steps) {
            var result;
            var done = steps.pop();
            var _slice = Array.prototype.slice;
            asyncEach(
                steps,
                function (e, i, n, c) {
                    if (e === true) return n();
                    try {
                        var args = result || [];
                        if (i < steps.length - 1) {
                            var called = false;
                            args.unshift(function () {
                                if (called)
                                    throw new Error(
                                        'Next called more than once.',
                                    );
                                called = true;
                                result = _slice.call(arguments, 0);
                                n();
                            });
                        }
                        result = undefined;
                        e.apply(null, args);
                        if (i == steps.length - 1) n();
                    } catch (e) {
                        if (e instanceof TypeError) debug.error(e);
                        c(e);
                    }
                },
                function (e) {
                    if (e) done(e);
                    else done.apply(null, result || []);
                },
                0,
                false,
                true,
            );
        },
    };
}); /*_EndDefine*/