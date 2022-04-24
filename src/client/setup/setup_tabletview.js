define(function(require, exports, module) {
    var configEvents = require("./core/config").ConfigEvents;
    var appConfig = require("../core/config").Config.appConfig;
    var ctx = require("../core/app");
    var Dropdown = require("../ui/dropdown")
        .Dropdown;
    configEvents.on("application", function(ev) {
        if (ev.config == "tabletView") {
            if (ctx.SideView) {
                ctx.SideView.options.minWidthPush = ev.newValue ? 600 : Infinity;
            }
            $(document.body)[ev.newValue ? "on" : "off"]('mousedown', 'select',
                Dropdown.openSelect);
        } else if (ev.config == "enableTouchKeyboardFeatures") {
            Env.isHardwareKeyboard = !ev.newValue;
        }
    });
    if (appConfig.tabletView)
        $(document.body).on('mousedown', 'select', Dropdown.openSelect);

});