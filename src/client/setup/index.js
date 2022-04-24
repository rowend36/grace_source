define(function(require, exports, module) {
    require("./setup_breakpoints");
    require("./setup_actionbar");
    require("./setup_config");
    require("./setup_editors");
    require("./setup_docs");
    require("./setup_ext");
    require("./setup_immersive");
    // require("./setup_sideview");
    require("./setup_state");
    require("./setup_statusbar");
    require("./setup_window_vars");
    //Minimum functionality handled by this point.
    
    require("../core/events").AppEvents.triggerForever("appLoaded");
});