_Define(function(global) {
    var appStorage = global.appStorage;

    function hasFailures(id) {
        return appStorage.getItem("breakpoint-" + id);
    }

    function setBreakpoint(id, handle) {
        if (handle) {
            var stack = hasFailures(id);
            if (stack) {
                (handle[id] || handle)(id, stack);
            }
        }
        appStorage.setItem("breakpoint-" + id, "Failed");
        var a = ids.indexOf(id);
        if (a > -1)
            ids.push(id);
    }

    function removeBreakpoint(id) {
        appStorage.removeItem("breakpoint-" + id);
        var a = ids.indexOf(id);
        if (a > -1) {
            ids.splice(a, 1);
        }
    }
    var ids = [];
    global.Recovery = {
        setBreakpoint: setBreakpoint,
        breakpoint: function(id, handle, timeout) {
            setBreakpoint(id, handle);
            return setTimeout(function() {
                removeBreakpoint(id);
            }, timeout || 7000);
        },
        fail: function(error, message) {
            for (var i in ids) {
                setBreakpoint(ids[i], error.code + "\n" + (error.message || "") + "\n" + error.stack);
            }
            if (message) {
                global.Notify.error(message);
            }
        },
        removeBreakpoint: removeBreakpoint,
        hasFailures: hasFailures,
        defaultHandler: function(id, stack) {
            global.Notify.prompt("Crash detected? Clear data?", function() {
                appStorage.clear();
            });
        },
        clearData: function(id, namespace) {
            return function() {
                global.configure(id, undefined, namespace);
            };
        }
    };
}); /*_EndDefine*/
_Define(function(global) {
    function CircularBffer(size) {
        if (size === undefined) size = 50;
        var buffer = Array(size);
        var index = 0;
        var overflow = false;
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
    var noop = global.Utils.noop;
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

    var messages = new CircularBffer();
    var _console = window.console;
    var console = Object.create(_console);
    
    var _debuggableObject = function(object) {
        return print(object, 3);
    };
    ['log', 'error', 'info', 'warn', 'debug'].forEach(function(e) {
        var original = _console[e] || noop;
        console[e] = function() {
            original.apply(this, arguments);
            var data = arguments[0];
            if (arguments.length > 1) {
                data = Array.prototype.slice.call(arguments, 0);
            }
            var stack;
            if (!data || data.constructor !== Error) {
                stack = (new Error().stack || '').split('\n');
                stack.splice(0, 2);
                data = _debuggableObject(data);
            } else stack = data.stack;
            messages.push({
                type: e,
                stack: stack,
                data: data
            });
        };
    });
    window.addEventListener('error', function(e) {
        console.error(e.error);
    });
    window.console = console;
    global.Logs = messages;
});