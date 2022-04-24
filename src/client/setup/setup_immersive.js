define(function(require, exports, module) {
    var MainMenu = require("./setup_main_menu").MainMenu;
    if (!Env.isWebView) {
        var method = "requestFullscreen" in document.body ?
            "requestFullscreen" :
            "webkitRequestFullscreen" in window ?
            "webkitRequestFullscreen" : "webkitRequestFullScreen" in window ?
            "webkitRequestFullScreen" : null;
        if (method !== null)
            MainMenu.addOption("fullscreen", {
                icon: "fullscreen",
                onclick: function() {
                    document.body[method]();
                },
                caption: "Enable Immersive Mode"
            }, true);
    }
});