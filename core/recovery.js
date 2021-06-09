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
        breakpoint: function(id, handle,timeout) {
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
                Notify.error(message);
            }
        },
        removeBreakpoint: removeBreakpoint,
        hasFailures: hasFailures,
        defaultHandler: function(id, stack) {
            Notify.prompt("Crash detected? Clear data?", function() {
                appStorage.clear();
            });
        },
        clearData: function(id, namespace) {
            return function() {
                configure(id, undefined, namespace);
            };
        }
    };
}); /*_EndDefine*/