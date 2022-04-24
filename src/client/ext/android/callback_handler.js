define(function(require, exports, module) {
    "use strict";
    var appEvents = require("grace/core/events").AppEvents;
    var handler = {};
    var appStorage = require("grace/core/config").appStorage;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    //requires addDoc
    
    var count = 0;
    handler._onNewIntent = function(inte) {
        var intent = JSON.parse(inte);
        if (intent.path) {
            var dir = FileUtils.dirname(intent.path);
            if (dir) FileUtils.addToRecents(dir);
        }
        if (intent.hasOwnProperty('value')) {
            require("grace/docs/docs").addDoc(intent.name || "",
                intent.value || "", intent.path || "");
        } else if (intent.path)
            FileUtils.openIntent(intent);
    };
    handler._pause = function() {
        appEvents.trigger('appPaused');
        appStorage.__doSync && appStorage.__doSync();
    };
    handler._resume = function() {
        setTimeout(window.blur.bind(window), 50);
        //if(window.Grace && window.Grace.loaded)
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
    exports.callBackHandler = handler;

});