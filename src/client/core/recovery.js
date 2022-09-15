define(function (require, exports, module) {
    //runtime class
    var storage = require('./config').storage;

    function hasFailures(id) {
        return storage.getItem('breakpoint-' + id);
    }

    function setBreakpoint(id, handle) {
        if (handle) {
            var stack = hasFailures(id);
            if (stack) {
                (handle[id] || handle)(id, stack);
            }
        }
        storage.setItem('breakpoint-' + id, 'Failed');
        var a = ids.indexOf(id);
        if (a > -1) ids.push(id);
    }

    function removeBreakpoint(id) {
        storage.removeItem('breakpoint-' + id);
        cyclicRequire('./utils').Utils.removeFrom(ids, id);
    }
    var ids = [];
    var cyclicRequire = require;
    exports.Recovery = {
        setBreakpoint: setBreakpoint,
        breakpoint: function (id, handle, timeout) {
            setBreakpoint(id, handle);
            return setTimeout(function () {
                removeBreakpoint(id);
            }, timeout || 7000);
        },
        fail: function (error, message) {
            for (var i in ids) {
                setBreakpoint(
                    ids[i],
                    error.code +
                        '\n' +
                        (error.message || '') +
                        '\n' +
                        error.stack
                );
            }
            if (message) {
                cyclicRequire('../ui/notify').Notify.error(message);
            }
        },
        removeBreakpoint: removeBreakpoint,
        hasFailures: hasFailures,
        defaultHandler: function (id, stack) {
            cyclicRequire('../ui/notify').Notify.prompt(
                'Crash detected? Clear data?',
                function () {
                    storage.clear();
                }
            );
        },
        clearData: function (id, namespace) {
            return function () {
                cyclicRequire('./config').Config.configure(
                    id,
                    undefined,
                    namespace
                );
            };
        },
    };
}); /*_EndDefine*/
