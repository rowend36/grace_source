define(function (require, exports, module) {
    var setBreakpoint = require('../core/recovery').Recovery.setBreakpoint;
    var Notify = require('../ui/notify').Notify;
    var clearBreakpoint = require('../core/recovery').Recovery.removeBreakpoint;
    var appEvents = require('../core/app_events').AppEvents;

    setBreakpoint('start-app', function () {
        Notify.error(
            'Error During Previous Load!!! If issue persists, contact developer.'
        );
        require(['./setup_console']);
    });
    appEvents.once('appLoaded', function () {
        clearBreakpoint('start-app');
    });
});