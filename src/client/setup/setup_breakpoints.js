define(function(require, exports, module) {
    var setBreakpoint = require("../core/recovery").Recovery.setBreakpoint;
    var Notify = require("../ui/notify").Notify;
    var clearBreakpoint = require("../core/recovery").Recovery.removeBreakpoint;
    var appEvents = require("../core/events").AppEvents;
    
    setBreakpoint("start-app", function() {
        Notify.error(
            "Error During Previous Load!!! If issue persists, contact developer"
        );
        if (window.eruda !== undefined) window.eruda._entryBtn.show();
    });
    appEvents.once("appLoaded", function() {
        console.debug("appLoaded");
        clearBreakpoint("start-app");
    });
    
});