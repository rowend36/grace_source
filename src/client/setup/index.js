define(function (require, exports, module) {
    /*Core functionality*/
    require("../ui/theme"); //removes SplashScreen
    require('../ext/fs/browser_fs');//Default fs For use in non-android environments
    require("./setup_docs");
    require("./setup_editors");
    /*Extra functionality*/
    require("./setup_error_message");
    require("./setup_window_vars");
    require("./setup_immersive");
    require("./setup_actionbar");
    // require("../ext/index");
    // require("./setup_perf");
    require("../tests/index");
    require('../core/app_events').AppEvents.triggerForever('appLoaded');
});