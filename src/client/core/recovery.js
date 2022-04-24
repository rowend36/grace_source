define(function(require,exports,module) {
    //runtime class
    var appStorage = require("./config").appStorage;

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
    var cyclicRequire = require;
    exports.Recovery = {
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
                cyclicRequire("../ui/notify").Notify.error(message);
            }
        },
        removeBreakpoint: removeBreakpoint,
        hasFailures: hasFailures,
        defaultHandler: function(id, stack) {
            cyclicRequire("../ui/notify").Notify.prompt("Crash detected? Clear data?", function() {
                appStorage.clear();
            });
        },
        clearData: function(id, namespace) {
            return function() {
                cyclicRequire("./config").Config.configure(id, undefined, namespace);
            };
        }
    };
}); /*_EndDefine*/
