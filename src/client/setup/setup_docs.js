define(function(require, exports, module) {
    "use strict";
    require("./setup_default_fs");
    var appEvents = require("../core/events").AppEvents;
    var Docs = require("../docs/docs").Docs;
    var docs = require("../docs/docs").docs;
    var closeDoc = require("../docs/docs").closeDoc;
    var DocsTab = require("./setup_tab_host").DocsTab;
    var closeTab = require("./setup_tab_host").closeTab;
    var Utils = require("../core/utils").Utils;
    var MainMenu = require("./setup_main_menu").MainMenu;
    var appConfig = require("../core/config").Config.appConfig;
    var FileUtils = require("../core/file_utils").FileUtils;
    var Notify = require("../ui/notify").Notify;
    //configure Doc defaults
    require("../editor/editor_settings");

    //allow open document in new tab

    Docs.initialize(DocsTab, DocsTab.active);

    if (Docs.numDocs() < 1) {
        Docs.createPlaceHolder("welcome", "Welcome To Grace Editor", {
            select: false,
        });
    }

    appEvents.on("closeTab", function(ev) {
        if (docs[ev.tab]) {
            closeDoc(ev.tab);
            if (Docs.numDocs() === 0) {
                Docs.createPlaceHolder();
            }
        }
    });
    
    appEvents.on("confirmCloseTab", function(ev) {
        var doc = docs[ev.tab];
        if (doc && doc.clones && doc.clones.length) {
            Notify.error(
                "This document is being used by a plugin");
            ev.preventDefault();
        }
        if (!doc) return;
        var flag = "close-without-saving-" + doc.lastSave;
        if (doc.dirty && ev.flags.indexOf(flag) < 0) {
            ev.stopPropagation();
            ev.preventDefault();
            Notify.ask(Docs.getName(doc.id) +
                " has unsaved changes. Close without saving?",
                function() {
                    closeTab(ev.tab, ev.flags.concat(flag));
                });
        }
    });

    MainMenu.extendOption("file", {
        icon: "insert_drive_file",
        sortIndex: 3,
        caption: "File",
        subTree: {
            "close-current": {
                icon: "close",
                sortIndex: -1,
                caption: "Close current tab",
                close: true,
                onclick: function() {
                    closeTab(DocsTab.active);
                },
            },
            "close-except": {
                icon: "clear_all",
                caption: "Close others",
                close: true,
                onclick: function() {
                    var tab = DocsTab;
                    for (var i = tab.tabs.length; i-- >
                        0;) {
                        if (tab.tabs[i] != DocsTab.active) {
                            closeTab(tab.tabs[i]);
                        }
                    }
                },
            },
            "close-all": {
                icon: "clear_all",
                caption: "Close all",
                close: true,
                onclick: function() {
                    var tab = DocsTab;
                    for (var i = tab.tabs.length; i-- >
                        0;) {
                        closeTab(tab.tabs[i]);
                    }
                },
            },
            "close-inactive": {
                icon: "timelapse",
                caption: "Close inactive tabs",
                close: true,
                onclick: function() {
                    var inactiveTime =
                        new Date().getTime() - Utils
                        .parseTime(appConfig
                            .inactiveFileDelay);
                    Utils.asyncForEach(
                        DocsTab.tabs.slice(0),
                        function(e, i, n) {
                            if (
                                e == DocsTab.active ||
                                !docs[e] ||
                                docs[e].dirty ||
                                docs[e].isTemp() //||
                                //e == lastTab
                            )
                                return n();
                            if (Utils.getCreationDate(
                                    docs[e].id) >=
                                inactiveTime)
                                return n();
                            docs[e].getFileServer()
                                .stat(docs[e]
                                    .getSavePath(),
                                    function(err, s) {
                                        if (s && s
                                            .mtimeMs <
                                            inactiveTime &&
                                            s.size ===
                                            docs[e]
                                            .getSize()
                                        ) {
                                            closeTab(e);
                                        }
                                        n();
                                    });
                        },
                        null,
                        5
                    );
                },
            },
        },
    });
    FileUtils.loadServers();
    appEvents.on("documentsLoaded", Docs
        .refreshDocs.bind(null, null));
    console.debug("setup docs");
});