define(function(require, exports, module) {
    var getActiveDoc = require("../docs/active_doc").getActiveDoc;
    var getEditor = require("./setup_editors").getEditor;
    var FileUtils = require("../core/file_utils").FileUtils;
    var Utils = require("../core/utils").Utils;
    var MainMenu = require("./setup_main_menu").MainMenu;
    MainMenu.addOption(
        "console", {
            caption: "Show Console",
            icon: "bug_report",
            close: true,
            sortIndex: 1000,
            onclick: function() {
                eruda._entryBtn.show();
                eruda._devTools.toggle();
            }
        }, true);

    Object.defineProperties(window, {
        fs: {
            get: function() {
                return getActiveDoc().getFileServer();
            },
        },
        doc: {
            get: getActiveDoc,
        },
        editor: {
            get: getEditor,
        },
        gUtils: {
            value: Utils,
        },
        fUtils: {
            value: FileUtils,
        }
    });

});