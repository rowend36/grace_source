define(function (require, exports, module) {
    var State = require("../core/state_manager").State;
    var appEvents = require("../core/events").AppEvents;
    var Utils = require("../core/utils").Utils;
    var appConfig = require("../core/config").Config.appConfig;
    var Notify = require("../ui/notify").Notify;
    if (!Env.isWebView) State.ensure("noexit", true);
    State.addListener(
        function (tab) {
            switch (tab) {
                case "noexit":
                    var delay = Utils.parseTime(appConfig.backButtonDelay);
                    Notify.info("<span>Press <b>BACK</b> again to exit.<span>", delay);
                    appEvents.trigger("appPaused");
                    var cancel = State.exit(false);
                    setTimeout(function () {
                        cancel();
                        State.ensure("noexit", true);
                        appEvents.trigger("appResumed");
                    }, delay * 0.7);
                    return true;
            }
        },
        function (state) {
            return state == "noexit";
        }
    );
});