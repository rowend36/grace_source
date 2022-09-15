define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    var app = require('grace/core/app_events').AppEvents;
    var removeFrom = require('grace/core/utils').Utils.removeFrom;
    var Docs = require('grace/docs/docs').Docs;
    var getMainEditor = require('grace/setup/setup_editors').getMainEditor;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var Editors = require('grace/editor/editors').Editors;
    var Actions = require('grace/core/actions').Actions;
    var SplitManager = require('grace/ui/split_manager').SplitManager;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var host = require('grace/ext/ui/tab_window').getHostEditor;
    var NameTags = require('./nametags').NameTags;
    var appConfig = require('grace/core/config').Config.registerAll({
        disableSplits: window.innerHeight < 700,
    });
    require('grace/core/config').Config.registerInfo({
        disableSplits: 'Hide Splits option in the main menu',
    });
    var splitEditors = [];

    function createSplitEditor(edit, direction) {
        //recall sizes
        var hostEditor = host(edit);
        if (!hostEditor) return;
        if (splitEditors.length === 0) {
            app.on('closeTab', onBeforeCloseTab, true);
            NameTags.show();
            splitEditors.push(hostEditor);
            NameTags.createTag(hostEditor);
        }
        var container = SplitManager.add($(edit.container), direction);
        var editor = Editors.createEditor(container);
        var doc = Docs.forSession(edit.session);
        if (doc) editor.setSession(doc.cloneSession());
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
            removeFrom(splitEditors, hostEditor);
            NameTags.removeTag(hostEditor);
            Editors.closeEditor(hostEditor);
            //unclickable(hostEditor.container);
            if (splitEditors.length === 1) {
                var mainEditor = getMainEditor();
                //unclickable(mainEditor.container);
                removeFrom(splitEditors, mainEditor);
                NameTags.removeTag(mainEditor);
                app.off('closeTab', onBeforeCloseTab);
                NameTags.hide();
            }
        }
    }

    /*Check if a document is open in any split*/
    /*Focus that editor if found*/
    function showDoc(doc) {
        var curDoc = Docs.forSession(getMainEditor().session);
        if (curDoc == doc) return true;
        if (splitEditors.length < 2) return false;
        var editor = getMainEditor(doc.session);
        if (editor && isSplit(editor)) {
            Editors.setEditor(editor);
            FocusManager.focusIfKeyboard(editor, true);
            return true;
        }
        for (var i in doc.clones) {
            editor = getMainEditor(doc.clones[i]);
            if (editor && isSplit(editor)) {
                Editors.setEditor(editor);
                FocusManager.focusIfKeyboard(editor, true);
                return true;
            }
        }
    }
    var onBeforeCloseTab = function (e) {
        if (splitEditors.length < 2) {
            if (splitEditors[0]) {
                NameTags.removeTag(splitEditors[0]);
            }
            NameTags.hide();
            app.off('closeTab', onBeforeCloseTab);
            return;
        }
        var doc = Docs.get(e.tab);
        //Might not be a document tab
        if (!doc) return;
        var editor = getEditor(doc.session);
        if (doc.clones && doc.clones.length > 0) {
            //Document is open in multiple editors, close the active one
            var active = getEditor();
            //Document is not active
            if (Docs.forSession(active.session) !== doc) {
                editor = active;
            }
        }

        if (isSplit(editor)) {
            removeSplitEditor(editor);
            e.preventDefault();
            e.stopPropagation();
        }
    };

    app.on('showDoc', function (ev) {
        if (showDoc(ev.doc)) {
            ev.preventDefault();
        }
    });

    function isSplit(editor) {
        return splitEditors.indexOf(editor) > -1;
    }

    var splitCommands = [
        {
            name: 'Add Split',
            bindKey: 'F10',
            exec: function (edit) {
                return createSplitEditor(edit, 'horizontal');
            },
        },
        {
            name: 'Add Split Vertical',
            bindKey: 'F9',
            exec: function (edit) {
                return createSplitEditor(edit, 'vertical');
            },
        },
        {
            name: 'Remove Split',
            bindKey: 'F8',
            exec: removeSplitEditor,
        },
    ];
    Actions.addAction({
        name: 'splits',
        icon: 'view_module',
        showIn: 'actionbar.more',
        isAvailable: function () {
            return !appConfig.disableSplits;
        },
        subTree: {},
    });
    Actions.addActions(splitCommands, {
        showIn: ['editor', 'actionbar.splits'],
        isAvailable: function () {
            return !appConfig.disableSplits;
        },
    });
    exports.SplitEditors = {
        create: createSplitEditor,
        close: removeSplitEditor,
        isSplit: isSplit,
        showDoc: showDoc,
        commands: splitCommands,
    };
}); /*_EndDefine*/