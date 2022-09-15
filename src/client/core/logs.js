define(function (require, exports, module) {
    //runtime class
    function circularBuffer(size) {
        if (size === undefined) size = 50;
        var buffer = Array(size);
        var index = 0;
        var overflow = false;
        return {
            push: function (el) {
                buffer[index] = el;
                index++;
                if (index == size) {
                    overflow = true;
                    index = 0;
                }
            },
            getArray: function () {
                if (overflow) {
                    var before = buffer.slice(0, index);
                    var after = buffer.slice(index, size);
                    return after.concat(before);
                } else {
                    return buffer.slice(0, index);
                }
            },
            reset: function (obj) {
                overflow = false;
                if (obj) {
                    buffer = obj;
                    index = buffer.length;
                    size = Math.max(index, size);
                } else {
                    index = 0;
                }
            },
        };
    }
    function printArray(obj, step) {
        var size = step > 1 ? 5 : 30;
        var offsetStart = Math.min(size, obj.length);
        var offsetEnd = Math.max(obj.length - size, offsetStart);
        var arr = {};
        for (var i = 0; i < offsetStart; i++) {
            arr[i] = print(obj[i], step - 1 || 1);
        }
        for (i = offsetEnd; i < obj.length; i++) {
            arr[i] = print(obj[i], step - 1 || 1);
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
            return 'function' + (obj.name || '<anonymous>') + '()';
        } else if (obj.jquery) {
            return (
                '$:(' +
                obj.selector +
                ')->' +
                print(obj[0], 1) +
                '[' +
                obj.length +
                ']'
            );
        } else if (obj.DOCUMENT_NODE) {
            return '[' + obj.tagName + '] .' + obj.className + ' #' + obj.id;
        } else if (step < 1 || obj === window) {
            return (typeof obj.toString == 'function'
                ? obj.toString()
                : '[Object]'
            ).substring(0, 50);
        } else if (Array.isArray(obj)) {
            return printArray(obj, step);
        } else {
            var clone = {};
            for (var i in obj) {
                clone[i] = print(obj[i], step - 1);
            }
            if (obj instanceof Error) {
                clone.message = print(obj.message, step - 1);
                clone.stack = print(obj.stack, step - 1);
            }
            return clone;
        }
    }

    var messages = circularBuffer(100);
    var _console = window.console;
    var debug = Object.create(_console);

    var _debuggableObject = function (object) {
        return print(object, 3);
    };
    ['log', 'error', 'info', 'warn', 'debug', 'error2'].forEach(function (e) {
        var original = _console[e];
        debug[e] = function () {
            if (original) original.apply(_console, arguments);
            var data = arguments[0];
            if (arguments.length > 1) {
                data = Array.prototype.slice.call(arguments, 0);
            }
            var stack;
            if (!(data && data instanceof Error)) {
                stack = (new Error().stack || '').split('\n');
                stack.splice(0, 2);
                data = _debuggableObject(data);
            } else {
                stack = [data.stack];
                data.message = data.message;
            }
            messages.push({
                type: original ? e : 'error',
                stack: stack,
                data: data,
            });
        };
    });
    var _shown;
    window.addEventListener('error', function (e) {
        if (!_shown) (_shown = true), require(['../setup/setup_console']);
        debug.error2(e.error);
    });
    window.addEventListener('unhandledrejection', function (e) {
        debug.error2(e.reason);
    });
    window.console = debug;
    exports.Logs = messages;
});