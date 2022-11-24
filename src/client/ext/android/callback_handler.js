define(function(require, exports, module) {
    "use strict";
    var appEvents = require("grace/core/app_events").AppEvents;
    var handler = {};
    var FileUtils = require("grace/core/file_utils").FileUtils;
    //requires openDoc
    
    var count = 0;
    handler._onNewIntent = function(inte) {
        var intent = JSON.parse(inte);
        if (intent.path) {
            var dir = FileUtils.dirname(intent.path);
            if (dir) FileUtils.addToRecents(dir);
        }
        if (intent.hasOwnProperty('value')) {
            require("grace/docs/docs").openDoc(intent.name || "",
                intent.value || "", intent.path || "");
        } else if (intent.path)
            FileUtils.openIntent(intent);
    };
    handler._pause = function() {
        appEvents.pause();
    };
    handler._resume = function() {
        appEvents.trigger('appResumed');
    };

    handler._callbacks = {
        0: function(e) {
            if (e) console.error(e);
        }
    };

    handler.createCallback = function(func) {
        if (!func) return 0;
        var c = handler._callbacks;
        var id = ++count;
        while (c[id]) {
            id = ++count;
        }
        c[id] = func;
        return id;
    };
    handler.clearCallback = function(id) {
        delete handler._callbacks[id];
    };
    exports.callbackHandler = handler;

});