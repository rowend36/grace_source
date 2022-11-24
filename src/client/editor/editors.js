define(function (require, exports, module) {
    var appEvents = require('../core/app_events').AppEvents;
    var Utils = require('../core/utils').Utils;
    var Actions = require('../core/actions').Actions;
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
            'Must use setActiveEditor for plugin editors.'
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
            if (settings.options.hasOwnProperty(i)) {
                var value =
                    doc.editorOptions && doc.editorOptions.hasOwnProperty(i)
                        ? doc.editorOptions[i]
                        : settings.options[i];
                editor.setOption(i, value);
            }
        }
        editor.editorOptions = doc.editorOptions;

        editor.setSession(session);
    }

    function closeEditor(edit) {
        var index = editors.indexOf(edit);
        if (index > -1) {
            if (editors.length === 1) return;
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
    function onThemeChange(e, renderer) {
        if (renderer == editors[0].renderer) {
            appEvents.once('appLoaded', function () {
                appEvents.trigger('editorThemeLoaded', e);
            });
        }
    }
    function createEditor(container, orphan) {
        var el = document.createElement('div');
        el.className = 'editor';
        container.appendChild(el);
        var editor = setupEditor(el);
        settings.add(editor);
        editor.commands.addCommands(defaultCommands);

        if (!orphan) {
            editors.push(editor);
            editor.renderer.on('themeLoaded', onThemeChange);
            if (editor === editors[0])
                onThemeChange(editor.renderer, editor.renderer);
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

    Actions.registerActionHost('editor', function (action) {
        defaultCommands.push(action);
        for (var i in editors) {
            editors[i].commands.addCommand(action);
        }
    });

    var Editors = exports;
    Editors.getSettingsEditor = getSettingsEditor;
    Editors.setSession = setSession;
    Editors.findEditor = getEditor;
    Editors.forEach = editors.forEach.bind(editors);
    Editors.onEach = function (e, ctx) {
        Editors.forEach(e, ctx);
        appEvents.on('createEditor', function (ev) {
            e.call(ctx, ev.editor);
        });
    };
    Editors.setEditor = setEditor;
    Editors.$getEditor = getEditor;
    Editors.$allEditors = editors;
    Editors.createEditor = createEditor;
    Editors.closeEditor = closeEditor;
    exports.Editors = Editors;
}); /*_EndDefine*/