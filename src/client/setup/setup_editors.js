define(function(require, exports, module) {
    var ActionBar = require("./setup_actionbar").actionBar;
    var addDoc = require("../docs/docs").addDoc;
    var appEvents = require("../core/events").AppEvents;
    var docs = require("../docs/docs").docs;
    var Docs = require("../docs/docs").Docs;
    var DocsTab = require("./setup_tab_host").DocsTab;
    var Editors = require("../editor/editors").Editors;
    var FileUtils = require("../core/file_utils").FileUtils;
    var focusEditor = require("../editor/active_editor").focusEditor;
    var getActiveDoc = require("../docs/active_doc").getActiveDoc;
    var getActiveEditor = require("../editor/active_editor")
        .$getActiveEditor;
    var getMainEditor = Editors.$getEditor;
    var Notify = require("../ui/notify").Notify;
    var rootView = require("./setup_root").rootView;
    var setTheme = require("../themes/theme").setTheme;
    var swapTab = require("./setup_tab_host").swapTab;
    var View = require("../ui/view").View;
    require("../editor/ace_stubs");


    //Editor View
    const editorView = new View();
    rootView.addView(editorView, 2, null, 1);
    editorView.$el.attr("id", "viewroot");
    exports.editorView = editorView;
    var margins = {
        marginTop: 0,
        marginBottom: 0,
    };
    appEvents.on("createEditor", function(e) {
        e.editor.getPopupMargins = function(isDoc) {
            return isDoc ? {
                    marginTop: 0,
                    marginBottom: margins.marginBottom,
                } :
                margins;
        };
    });
    appEvents.on("layoutChange", function() {
        var viewRoot = rootView.$el[0];
        margins.marginTop = parseInt(viewRoot.style.top);
        margins.marginBottom = parseInt(viewRoot.style.bottom) +
            50;
    });

    //Initialize main editor
    var editor = Editors.createEditor(editorView.$el[0]);
    Editors.setEditor(editor);

    //Link documents and tabs
    function onChangeTab(ev) {
        if (docs[ev.tab]) {
            var editor = getMainEditor();
            focusEditor(editor);
            Editors.setSession(docs[ev.tab]);
            ev.preventDefault();
        }
    }

    function onChangeDoc(ev) {
        //Check if the activeDoc is in the main editor
        var isMain = getMainEditor() === getActiveEditor();
        if (isMain && DocsTab.active !== ev.doc.id) {
            DocsTab.setActive(ev.doc.id, true, true);
        }
    }
    
    appEvents.on("changeTab", onChangeTab);
    appEvents.on('changeDoc', onChangeDoc);
    
    DocsTab.updateActive();
    
    //Add some commands
    exports.LayoutCommands = [{
            name: "toggleFullscreen",
            bindKey: "F11",
            exec: function() {
                ActionBar.toggle();
                ActionBar.$forcedOpen = !ActionBar.hidden;
            },
        },
        {
            name: "swapTabs",
            bindKey: {
                win: "Alt-Tab",
                mac: "Command-Alt-N",
            },
            exec: swapTab,
        },
    ];
    Editors.addCommands(exports.LayoutCommands);

    Editors.addCommands(require("../docs/document_commands")
        .DocumentCommands);

    //Once loaded, update app theme
    appEvents.on("appLoaded", function() {
        setTheme(getActiveEditor().renderer.theme);
    });


    //The active main editor can safely be manipulated
    //as opposed to plugin editors
    exports.getMainEditor = getMainEditor;

    exports.getEditor = function(ses) {
        if (ses) return getMainEditor(ses);
        else {
            return getActiveEditor();
        }
    };

    exports.switchToDoc = function switchToDoc(name, pos, end, autoLoad,
        cb, server) {
        var doc, session, text;
        if (autoLoad && typeof autoLoad == "object") {
            //autoload is a session
            session = autoLoad;
            autoLoad = undefined;
            doc = Docs.forSession(autoLoad);
        } else if (typeof autoLoad == "string") {
            text = autoLoad;
            autoLoad = undefined;
        }
        if (!doc) doc = Docs.forPath(name, server) || Docs.forPath(
            "/" + name, server);

        if (!doc) {
            var servers;
            if (server) {
                servers = [server];
            } else {
                var mainDoc = getActiveDoc();
                servers = [FileUtils.getProject().fileServer];
                if (mainDoc && mainDoc.getFileServer() != servers[
                        0]) {
                    servers.unshift(mainDoc.getFileServer());
                }
            }
            if (text || session) {
                if (session) text = session.getValue();
                doc =
                    docs[
                        addDoc(null, text, name, {
                            data: {
                                fileServer: servers[0].id,
                                encoding: FileUtils.encodingFor(
                                    name, servers[0]),
                            },
                        })
                    ];
                doc.setDirty();
                doc.refresh();
            } else {
                if (autoLoad === false) return;
                var getFile = function() {
                    var server = servers.pop();
                    if (!server) return;
                    Docs.openDoc("/" + name, server, open);
                };
                var open = function(err, doc) {
                    if (doc) switchToDoc(doc.getPath(), pos,
                        end, null, cb);
                    else getFile();
                };
                if (autoLoad) getFile();
                else Notify.ask("Open " + name, getFile);
                return;
            }
        }
        if (
            !appEvents.trigger("switch-to-doc", {
                doc: doc.id,
                pos: pos,
            }).defaultPrevented
        ) {
            //     if (!(mainView.SplitEditors && mainView.SplitEditors
            //         .hasEditor(doc))) {
            //     mainView.setTab(doc.id);
            // } else
            State.ensure(appConfig.disableBackButtonTabSwitch ?
                "tabs" : doc.id);
        }
        // if (pos) {
        //     var edit = getActiveEditor();
        //     edit.exitMultiSelectMode && edit.exitMultiSelectMode();
        //     edit.getSession().unfold(
        //         pos
        //     ); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
        //     var sel = edit.getSelection();
        //     if (end) {
        //         edit.getSession().unfold(
        //             end
        //         ); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
        //         sel.setSelectionRange({
        //             start: pos,
        //             end: end
        //         });
        //     } else {
        //         sel.moveCursorToPosition(pos);
        //     }
        //     edit.centerSelection();
        // }
        cb && cb(doc.session);
    };


    function doCopy() {
        var editor = getActiveEditor();
        editor.once("copy", function(e) {
            require("../ext/clipboard/enhanced_clipboard")
                .clipboard.set(e.text);
        });
        editor.getCopyText();
    }

    //Add the bulk of the menu items
    var menuItems = {
        "!update": [
            function(self, update) {
                var doc = getActiveDoc();
                update("save", doc ? self["!save"] : null);
            },
        ],
        "!save": {
            icon: "save",
            caption: "Save",
            close: true,
            sortIndex: 1,
            onclick: function() {
                getActiveEditor().execCommand("save");
            },
        },
        file: {
            caption: "File",
            sortIndex: 2,
            icon: "insert_drive_file",
            subTree: {
                "!update": [
                    function(self, update) {
                        var doc = getActiveDoc();
                        update("refresh", doc ? self[
                            "!refresh"] : null);
                        update("refresh-all", doc ? self[
                            "!refresh-all"] : null);
                    },
                ],
                "!refresh": {
                    icon: "refresh",
                    caption: "Refresh",
                    close: true,
                    onclick: function() {
                        var doc = getActiveDoc();
                        doc &&
                            doc.refresh(function(doc) {
                                if (doc && !doc.dirty)
                                    Notify.info(
                                        "Refreshed");
                            });
                    },
                },
                "!refresh-all": {
                    icon: "refresh",
                    caption: "Refresh All",
                    close: true,
                    onclick: function() {
                        var docs = require("../docs/docs").docs;
                        require("../core/utils").Utils
                            .asyncForEach(
                                Object.keys(docs),
                                function(doc, i, next) {
                                    if (docs[doc]) docs[doc]
                                        .refresh(next);
                                    else next();
                                },
                                function() {
                                    Notify.info("Refreshed");
                                },
                                3
                            );
                    },
                },
            },
        },
        "Jump to": {
            icon: "call_made",
            caption: "Navigation",
            subTree: {
                "!update": [
                    function(self, update) {
                        var c = getActiveEditor()
                            .getMainCompleter();
                        update("refresh", c ? self["!refresh"] :
                            null);
                        update("refresh-all", c ? self[
                            "!refresh-all"] : null);
                    },
                ],
                "find-in-file": {
                    caption: "Find in File",
                    close: true,
                    onclick: function() {
                        getActiveEditor().execCommand("find");
                    },
                },
                "goto-file": {
                    caption: "Go to Line",
                    close: true,
                    onclick: function() {
                        getActiveEditor().execCommand(
                            "gotoline");
                    },
                },
                "next-error": {
                    caption: "Go to Next Error",
                    close: true,
                    onclick: function() {
                        getActiveEditor().execCommand(
                            "goToNextError");
                    },
                },
                "!find-refs": {
                    caption: "Find References",
                    close: true,
                    onclick: function() {
                        var editor = getActiveEditor();
                        var completer = editor
                            .getMainCompleter();
                        if (completer.findRefs) {
                            completer.findRefs(editor);
                        }
                    },
                },
                "!jump-to-def": {
                    caption: "Jump To Definition",
                    close: true,
                    onclick: function() {
                        var editor = getActiveEditor();
                        var completer = editor
                            .getMainCompleter();
                        if (completer.jumpToDef) {
                            completer.jumpToDef(editor);
                        }
                    },
                },
            },
        },
        edit: {
            icon: "edit",
            caption: "Edit",
            subTree: {
                "!update": [
                    function(self, update) {
                        var c = getActiveEditor()
                            .getMainCompleter();
                        update("rename", c ? self["!rename"] :
                            null);
                    },
                ],
                undo: {
                    icon: "undo",
                    caption: "Undo",
                    close: false,
                    onclick: function() {
                        getActiveEditor().execCommand("undo");
                    },
                },
                redo: {
                    caption: "Redo",
                    icon: "redo",
                    close: false,
                    onclick: function() {
                        getActiveEditor().execCommand("redo");
                    },
                },
                "increase-indent": {
                    caption: "Increase Indent",
                    icon: "format_indent_increase",
                    close: false,
                    onclick: function() {
                        getActiveEditor().execCommand("indent");
                    },
                },
                "decrease-indent": {
                    caption: "Decrease Indent",
                    icon: "format_indent_decrease",
                    close: false,
                    onclick: function() {
                        getActiveEditor().execCommand(
                            "outdent");
                    },
                },
                "!rename": {
                    icon: "find_replace",
                    caption: "Rename Variable",
                    close: true,
                    onclick: function() {
                        var editor = getActiveEditor();
                        var completer = editor
                            .getMainCompleter();
                        if (completer.rename) {
                            completer.rename(editor);
                        }
                    },
                },
                format: {
                    caption: "Format",
                    icon: "format_align_justify",
                    close: true,
                    onclick: function() {
                        getActiveEditor().execCommand(
                            "beautify");
                    },
                },
                paste: {
                    caption: "Paste",
                    icon: "content_paste",
                    close: true,
                    onclick: function() {
                        require(
                                "../ext/clipboard/enhanced_clipboard"
                            )
                            .clipboard.get(
                                0,
                                function(text) {
                                    getActiveEditor()
                                        .execCommand(
                                            "paste", text);
                                }
                            );
                    },
                },
                copy: {
                    caption: "Copy",
                    icon: "content_copy",
                    onclick: doCopy,
                },
                cut: {
                    caption: "Cut",
                    icon: "content_cut",
                    onclick: function doCut() {
                        var editor = getActiveEditor();
                        doCopy();
                        editor.execCommand("cut");
                    },
                },
            },
        },
    };
    var menu = require("../setup/setup_main_menu").MainMenu;
    for (var i in menuItems) {
        menu.extendOption(i, menuItems[i]);
    }
    console.debug("setup editors");
});