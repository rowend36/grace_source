define(function(require, exports, module) {
    'use strict';
    /*globals $*/
    var app = require("grace/core/events").AppEvents;
    var Docs = require("grace/docs/docs").Docs;
    var docs = require("grace/docs/docs").docs;
    var getEditor = require("grace/setup/setup_editors").getMainEditor;
    var Editors = require("grace/editor/editors").Editors;
    var SplitManager = require("grace/ui/splits").SplitManager;
    var FocusManager = require("grace/core/focus_manager").FocusManager;
    var host = require("grace/ext/tab_window").getHostEditor;
    var NameTags = require("./nametags").NameTags;
    var splitEditors = [];

    function createSplitEditor(edit, direction) {
        //recall sizes
        var hostEditor = host(edit);
        if (!hostEditor) return;
        if (splitEditors.length === 0) {
            app.on('confirmCloseTab', onBeforeCloseTab, true);
            NameTags.show();
            splitEditors.push(hostEditor);
            NameTags.createTag(hostEditor);
        }
        var container = SplitManager.add($(edit.container), direction);
        var editor = Editors.createEditor(container);
        var doc = Docs.forSession(edit.session);
        if (doc)
            editor.setSession(doc.cloneSession());
        splitEditors.push(editor);
        NameTags.createTag(editor);
        Editors.setEditor(editor);
        editor.focus();
        return editor;
    }

    function removeSplitEditor(edit) {
        var hostEditor = host(edit);
        if (!isSplit(hostEditor)) {
            return;
        }
        if (SplitManager.remove($(edit.container))) {
            splitEditors.splice(splitEditors.indexOf(hostEditor), 1);
            NameTags.removeTag(hostEditor);
            Editors.closeEditor(hostEditor);
            //unclickable(hostEditor.container);
            if (splitEditors.length === 1) {
                var mainEditor = getEditor();
                //unclickable(mainEditor.container);
                splitEditors.splice(splitEditors.indexOf(mainEditor),
                    1);
                NameTags.removeTag(mainEditor);
                app.off('confirmCloseTab', onBeforeCloseTab);
                NameTags.hide();
            }
        }
    }

    var splitCommands = [{
            name: "Add Split",
            bindKey: "F10",
            exec: function(edit) {
                createSplitEditor(edit, 'horizontal');
            }
        }, {
            name: "Add Split Vertical",
            bindKey: "F9",
            exec: function(edit) {
                createSplitEditor(edit, 'vertical');
            }
        },
        {
            name: "Remove Split",
            bindKey: "F8",
            exec: removeSplitEditor
        },
    ];
    var MainMenu = require("grace/setup/setup_main_menu").MainMenu;

    MainMenu.addOption("splits-m", {
        caption: "Splits",
        icon: "view_module",
        subTree: {
            "add-split": {
                caption: "Add Split Horizontal",
                onclick: function() {
                    createSplitEditor(require(
                            "grace/setup/setup_editors")
                        .getEditor(),
                        'horizontal');
                }
            },
            "add-split-v": {
                caption: "Add Split Vertical",
                onclick: function() {
                    createSplitEditor(require(
                            "grace/setup/setup_editors")
                        .getEditor(),
                        'vertical');
                }
            },
            "remove-split": {
                caption: "Remove Split",
                onclick: function() {
                    removeSplitEditor(require(
                            "grace/setup/setup_editors")
                        .getEditor());
                }
            },

        }
    });
    var onBeforeCloseTab = function(e) {
        if (splitEditors.length < 2) {
            if (splitEditors[0]) {
                NameTags.removeTag(splitEditors[0]);
            }
            NameTags.hide();
            app.off('confirmCloseTab', onBeforeCloseTab);
            return;
        }
        var doc = docs[e.tab];
        var editor;
        //Might not be a document tab not viewPager
        if (!doc) return;
        if (doc.clones && doc.clones.length > 0) {
            editor = getEditor();
            //ensure it is the active doc
            if (doc.clones.indexOf(editor.session) < 0) {
                editor = getEditor(doc.session);
            }
        } else {
            //close any editor associated with this tab
            editor = getEditor(doc.session);
        }

        if (editor) {
            removeSplitEditor(editor);
            e.preventDefault();
            e.stopPropagation();
        }

    };

    function isSplit(editor) {
        return splitEditors.indexOf(editor) > -1;
    }
    exports.SplitEditors = {
        create: createSplitEditor,
        close: removeSplitEditor,
        isSplit: isSplit,
        hasEditor: function(doc) {
            /*Check if a document is open in any split*/
            /*Focus that editor if found*/
            var curDoc = Docs.forSession(getEditor().session);
            if (curDoc == doc) return true;
            if (splitEditors.length < 2) return false;
            var editor = getEditor(doc.session);
            if (editor && isSplit(editor)) {
                Editors.setEditor(editor);
                FocusManager.focusIfKeyboard(editor, true);
                return true;
            }
            for (var i in doc.clones) {
                editor = getEditor(doc.clones[i]);
                if (editor && isSplit(editor)) {
                    Editors.setEditor(editor);
                    FocusManager.focusIfKeyboard(editor, true);
                    return true;
                }
            }

        },
        init: function() {
            Editors.addCommands(splitCommands);
            exports.SplitEditors = exports.SplitEditors;
        },
        commands: splitCommands
    };
    app.on("fullyLoaded", function() {
        exports.SplitEditors
            .init();
    });
}); /*_EndDefine*/