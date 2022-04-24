define(function(require, exports, module) {
    var getEditor = require("grace/setup/setup_editors").getEditor;
    require("grace/setup/setup_main_menu").MainMenu.addOption(
        "state-5", {
            caption: "State",
            icon: "bookmark",
            subTree: {
                "save-state": {
                    icon: "bookmark_border",
                    caption: "Save state",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand(
                        "Save Current State");
                    },
                },
                "restore-state": {
                    icon: "restore_page",
                    caption: "Restore state",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand("Go to Saved State");
                    },
                },
            },
        },
        true
    );

});