define(function (require, exports, module) {
    /*globals $*/
    //Setup Main View
    var Env = window.Env;
    var appEvents = require("../core/app_events").AppEvents;
    var Navigation = require("../ui/navigation").Navigation;
    var appConfig = require('../core/config').Config.registerAll({
        enableTouchKeyboardFeatures: !Env.isHardwareKeyboard,
        enableKeyboardNavigation: !!Env.isHardwareKeyboard,
    });
    var LinearLayout = require("../ui/linear_layout").LinearLayout;
    var rootView = new LinearLayout(
        $("<div class='content'></div>"),
        window.innerHeight,
        LinearLayout.VERTICAL
    );
    rootView._mount({
        $el: $(document.body),
    });
    rootView.onRender = appEvents.trigger.bind(appEvents, "layoutChanged");
    if (window.innerHeight < 105) {
        //possible layer resize
        var update = function () {
            if (update) {
                if (window.innerHeight > 105) {
                    window.removeEventListener("resize", update);
                }
                update = null;
            }
            rootView.render();
        };
        window.addEventListener("resize", update);
    }
    //Keyboard.attach Must be done on start
    if (appConfig.enableKeyboardNavigation) Navigation.attach();

    exports.rootView = rootView;
});