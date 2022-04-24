define(function(require, exports, module) {
    var appEvents = require("../core/events").AppEvents;
    var Utils = require("../core/utils").Utils;
    var Docs = require("../docs/docs").Docs;
    var EditorSettings = require("./editor_settings").EditorSettings;
    var FocusManager = require("../core/focus_manager").FocusManager;
    var autofadeScrollBars = require("./ace_helpers")
        .autofadeScrollBars;
    var setupMobileMenu = require("./ace_helpers").setupMobileMenu;
    var debug = console;
    //Basics for managing multiple editors
    //Whether it's splits,tabs, scrollers etc
    //setEditor, createEditor, closeEditor, getEditor
    var editors = [];
    var settings = new EditorSettings(editors);

    function getSettingsEditor() {
        return settings;
    }

    //The main editor is the one that is completely managed by
    //the application, used for switching docs and the like
    var __editor;

    function getEditor(session) {
        return session ? editors.filter(function(e) {
            return e.session === session;
        })[0] : __editor;
    }


    function setEditor(e) {
        //e can be a container or
        //an editor mousedown event
        e = e.editor || e;
        if (__editor == e) return;
        Utils.assert(editors.indexOf(e) > -1,
            'Please use set tabwindow.getEditorWindow');
        var oldEditor = __editor;
        __editor = e;
        settings.editor = e;
        appEvents.trigger('changeEditor', {
            oldEditor: oldEditor,
            editor: e
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
                    //create clone
                    session = doc.cloneSession();
                }
            }
        }
        settings.session = doc.session;
        var overrides = Object.assign({}, editor.editorOptions, doc
            .editorOptions);
        for (var i in overrides) {
            var value = (doc.editorOptions && doc.editorOptions
                    .hasOwnProperty(i)) ? doc
                .editorOptions[i] : settings.options[i];
            editor.setOption(i, value);
        }
        editor.editorOptions = doc.editorOptions;

        editor.setSession(session);
    }

    function closeEditor(edit) {
        var index = editors.indexOf(edit);
        if (index > -1) {
            if (appEvents.trigger('closeEditor', {
                    editor: edit
                }).defaultPrevented)
                return;
            editors.splice(index, 1);
            if (edit === __editor) {
                __editor = null;
                setEditor(editors[0]);
            }
        }
        if (Docs.forSession(edit.session))
            Docs.closeSession(edit.session);
        try {
            edit.setSession(null);
        } catch (e) {
            debug.error(e);
        }
        FocusManager.focusIfKeyboard(__editor.textInput.getElement());
        edit.destroy();
    }


    function keepSelectionInView() {
        var event = this.$mouseHandler.mousedownEvent;
        if (event && new Date().getTime() - event.time < FocusManager
            .FOCUS_RESIZE_WINDOW) {
            this.renderer.scrollCursorIntoView(null, 0.1);
        }
    }

    function muddleTextInput(el) {
        el.setAttribute("autocomplete", "off");
        el.removeAttribute("name");
        el.setAttribute("aria-hidden", true);
    }

    function createEditor(container, orphan) {
        var el = document.createElement("div");
        el.className = 'editor';
        container.appendChild(el);
        var editor = ace.edit(el);
        editor.renderer.setScrollMargin(5, 5, 0, 0);
        muddleTextInput(editor.textInput.getElement());
        autofadeScrollBars(editor);
        setupMobileMenu(editor);
        editor.setAutoScrollEditorIntoView(false);
        editor.$blockScrolling =
            Infinity; //prevents ace from logging annoying warnings
        settings.add(editor);

        for (var i = 0, end = defaultCommands.length; i < end; i++) {
            if (orphan && defaultCommands[i].mainOnly) continue;
            editor.commands.addCommand(defaultCommands[i]);
        }
        editor.renderer.on('resize', keepSelectionInView.bind(editor));
        if (!orphan) {
            editors.push(editor);
            editor.renderer.on("themeLoaded", function(e) {
                if (editor == editors[0]) {
                    appEvents.once("appLoaded", function() {
                        appEvents.trigger(
                            "editorThemeLoaded", e
                        );
                    });
                }
            });
            editor.renderer.on('changeCharacterSize', function() {
                if (editor == editors[0]) {
                    settings.setOption("fontSize", editor
                        .getFontSize());
                }
            });
        }
        appEvents.trigger('createEditor', {
            editor: editor,
            isMain: !orphan
        });
        return editor;
    }
    var defaultCommands = [];

    function addCommands(commands, mainOnly) {
        if (!Array.isArray(commands)) commands = [commands];
        if (mainOnly) {
            commands.forEach(function(e) {
                e.mainOnly = true;
            });
        }
        defaultCommands.push.apply(defaultCommands, commands);
        for (var i in editors) {
            for (var j in commands)
                editors[i].commands.addCommand(commands[j]);
        }
    }
    var api = {};

    api.getSettingsEditor = getSettingsEditor;
    api.setSession = setSession;
    api.findEditor = getEditor;
    api.addCommands = addCommands;
    api.forEach = editors.forEach.bind(editors);
    api.setEditor = setEditor;
    api.$getEditor = getEditor;
    api.$allEditors = editors;
    api.createEditor = createEditor;
    api.closeEditor = closeEditor;
    exports.Editors = api;
}); /*_EndDefine*/