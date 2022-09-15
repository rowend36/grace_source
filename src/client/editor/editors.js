define(function (require, exports, module) {
    var appEvents = require('../core/app_events').AppEvents;
    var Utils = require('../core/utils').Utils;
    var config = ace.require('ace/config');
    var Docs = require('../docs/docs').Docs;
    var settings = require('./editor_settings');
    var FocusManager = require('../ui/focus_manager').FocusManager;
    var setupEditor = require('./ace_helpers').setupEditor;
    var debug = console;
    //Basics for managing multiple editors
    //Whether it's splits,tabs, scrollers etc
    //setEditor, createEditor, closeEditor, getEditor
    var editors = [];
    settings.editors = editors;

    function getSettingsEditor() {
        return settings;
    }

    //The main editor is the one that is completely managed by
    //the application, used for switching docs and the like
    var __editor;

    function getEditor(session) {
        return session
            ? editors.filter(function (e) {
                  return e.session === session;
              })[0]
            : __editor;
    }

    function setEditor(e) {
        //e can be a container or
        //an editor mousedown event
        e = e.editor || e;
        if (__editor == e) return;
        Utils.assert(
            editors.indexOf(e) > -1,
            'Please use set tabwindow.getEditorWindow'
        );
        var oldEditor = __editor;
        __editor = e;
        settings.editor = e;
        appEvents.signal('changeEditor', {
            oldEditor: oldEditor,
            editor: e,
        });
    }

    function setSession(doc) {
        var editor = __editor;
        var session = doc.session;
        if (editors.length > 1) {
            //deal with cloned sessions
            var oldDoc = Docs.forSession(editor.session);
            if (oldDoc === doc) {
                session = editor.session;
            } else {
                if (oldDoc) {
                    //Close any clones available
                    Docs.closeSession(editor.session);
                }
                if (getEditor(session)) {
                    //create synchronized clone
                    session = doc.cloneSession();
                }
            }
        }
        settings.session = doc.session;
        var overrides = Object.assign(
            {},
            editor.editorOptions,
            doc.editorOptions
        );
        for (var i in overrides) {
            var value =
                doc.editorOptions && doc.editorOptions.hasOwnProperty(i)
                    ? doc.editorOptions[i]
                    : settings.options[i];
            editor.setOption(i, value);
        }
        editor.editorOptions = doc.editorOptions;

        editor.setSession(session);
    }

    function closeEditor(edit) {
        var index = editors.indexOf(edit);
        if (index > -1) {
            if (
                appEvents.trigger('closeEditor', {
                    editor: edit,
                }).defaultPrevented
            )
                return;
            editors.splice(index, 1);
            if (edit === __editor) {
                __editor = null;
                setEditor(editors[0]);
            }
        }
        if (Docs.forSession(edit.session)) Docs.closeSession(edit.session);
        try {
            edit.setSession(null);
        } catch (e) {
            debug.error(e); //some plugins assume a session can't be null
        }
        FocusManager.focusIfKeyboard(__editor.textInput.getElement());
        edit.destroy();
    }

    function createEditor(container, orphan) {
        var el = document.createElement('div');
        el.className = 'editor';
        container.appendChild(el);
        var editor = setupEditor(el);
        settings.add(editor);

        for (var i = 0, end = defaultCommands.length; i < end; i++) {
            if (orphan && defaultCommands[i].mainOnly) continue;
            editor.commands.addCommand(defaultCommands[i]);
        }
        if (!orphan) {
            editors.push(editor);
            editor.renderer.on('themeLoaded', function (e) {
                if (editor == editors[0]) {
                    appEvents.once('appLoaded', function () {
                        appEvents.trigger('editorThemeLoaded', e);
                    });
                }
            });
            editor.renderer.on('changeCharacterSize', function () {
                if (editor == editors[0]) {
                    settings.setOption('fontSize', editor.getFontSize());
                }
            });
        }
        appEvents.trigger('createEditor', {
            editor: editor,
            isMain: !orphan,
        });
        return editor;
    }
    var defaultCommands = [];

    function addCommands(commands, mainOnly) {
        if (!Array.isArray(commands)) commands = [commands];
        if (mainOnly) {
            commands.forEach(function (e) {
                e.mainOnly = true;
            });
        }
        defaultCommands.push.apply(defaultCommands, commands);
        for (var i in editors) {
            for (var j in commands) editors[i].commands.addCommand(commands[j]);
        }
    }
    function addOptions(options) {
        config.defineOptions(
            ace.require('ace/editor').Editor.prototype,
            'editor',
            options
        );
    }
    var api = {};

    api.getSettingsEditor = getSettingsEditor;
    api.setSession = setSession;
    api.findEditor = getEditor;
    api.addOptions = addOptions;
    api.addCommands = addCommands;
    api.forEach = editors.forEach.bind(editors);
    api.setEditor = setEditor;
    api.$getEditor = getEditor;
    api.$allEditors = editors;
    api.createEditor = createEditor;
    api.closeEditor = closeEditor;
    exports.Editors = api;
}); /*_EndDefine*/