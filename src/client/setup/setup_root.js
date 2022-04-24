define(function (require, exports, module) {
    /*globals $*/
    //Setup Main View
    var appEvents = require("../core/events").AppEvents;
    require("css!../libs/css/materialize-grace");
    require("css!../main.css");
    require("css!../libs/css/coding-fonts.css");
    var appConfig = require("../core/config").Config.appConfig;
    var Navigation = require("../core/navigation").Navigation;

    var LinearLayout = require("../ui/linear_layout").LinearLayout;
    var rootView = new LinearLayout(
        $("<div class='content'></div>"),
        window.innerHeight,
        LinearLayout.VERTICAL
    );
    rootView._mount({
        $el: $(document.body),
    });
    rootView.onRender = appEvents.trigger.bind(appEvents, "layoutChange");
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

    console.debug("state: root created");
    exports.rootView = rootView;
});