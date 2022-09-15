define(function (require, exports, module) {
    var StateManager = require('../ui/state_manager').StateManager;
    var appEvents = require('../core/app_events').AppEvents;
    var Utils = require('../core/utils').Utils;
    var uiConfig = require('../core/config').Config.registerAll(null, 'ui');
    var cyclicRequire = require;
    var State = new StateManager(window);
    if (!Env.isWebView) State.ensure('noexit', true);
    State.addListener(
        function (tab) {
            switch (tab) {
                case 'noexit':
                    var delay = Utils.parseTime(uiConfig.backButtonDelay);
                    cyclicRequire('../ui/notify').Notify.info(
                        '<span>Press <b>BACK</b> again to exit.<span>',
                        delay
                    );
                    appEvents.pause();
                    var cancel = State.exit(false);
                    appEvents.once(
                        'appResumed',
                        function () {
                            cancel();
                            State.ensure('noexit', true);
                        },
                        true
                    );
                    setTimeout(appEvents.resume, delay * 0.7);
                    return true;
            }
        },
        function (state) {
            return state == 'noexit';
        }
    );
    exports.State = State;
});