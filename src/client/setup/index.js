define(function (require, exports, module) {
    /*Core functionality*/
    require("css!../libs/css/materialize-grace");
    require("css!../index.css");
    require("../themes/themes"); //removes SplashScreen
    require("../ext/fs/browser_fs");
    require("./setup_docs");
    require("./setup_editors");
    /*Extra functionality*/
    require("./setup_error_message");
    require("./setup_window_vars");
    require("./setup_statusbar");
    require("./setup_menu_items");
    require("./setup_immersive");
    require("../ext/index");
    require("./setup_actionbar");
    // require("./setup_perf");
    // require("../tests/index");
    /*Speed ups for development*/
    require("../editor/editors");
    require("../docs/docs");
    require("../core/schema");
    require("./setup_sideview");
    require('../core/app_events').AppEvents.triggerForever('appLoaded');
});