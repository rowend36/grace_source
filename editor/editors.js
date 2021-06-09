_Define(function(global) {
    var appEvents = global.AppEvents;
    var editorConfig = {};
    var config = global.libConfig;
    var Functions = global.Functions;
    var docs = global.docs;
    var Utils = global.Utils;
    var Docs = global.Docs;
    var EditorSettings = global.EditorSettings;
    var FocusManager = global.FocusManager;

    function getSettingsEditor() {
        return settings;
    }
    //Basics for managing multiple editors
    //Whether it's splits,tabs, scrollers etc
    //setEditor, createEditor, closeEditor, getEditor
    var editors = [];
    var settings = new EditorSettings(editors);

    var __editor;

    function getEditor(session) {
        return session ? editors.filter(function(e) {
            return e.session === session;
        })[0] : __editor;
    }

    function focusEditor(mainEditor, element, tabId) {
        //a hook used by viewpagers
        //to changeEditor without messing
        //up internal state
        var e = mainEditor;
        if (__editor == e) return;
        Utils.assert(editors.indexOf(e) > -1, 'Please use set viewPager.getEditorWindow');
        var oldEditor = __editor;
        __editor = e;
        var pluginEditor = element.env && element.env.editor;
        settings.editor = pluginEditor || e;
        appEvents.trigger('changeEditor', {
            oldEditor: oldEditor,
            editor: pluginEditor || e
        });
        Docs.swapDoc(tabId);
    }

    function setEditor(e) {
        //e can be a container or
        //an editor mousedown event
        e = e.editor || e;
        if (__editor == e) return;
        Utils.assert(editors.indexOf(e) > -1, 'Please use set viewPager.getEditorWindow');
        var oldEditor = __editor;
        __editor = e;
        settings.editor = e;
        var doc = Docs.forSession(e.session);
        if (doc) {
            Docs.swapDoc(doc.id);
        }
        appEvents.trigger('changeEditor', {
            oldEditor: oldEditor,
            editor: e
        });
    }

    function setSession(doc) {
        var editor = __editor;
        var session = doc.session;
        if (editors.length > 1) {
            var oldDoc = Docs.forSession(editor.session);
            //session is a clone, close
            if (oldDoc && oldDoc.session !== editor.session) {
                //unnecssary check
                Docs.closeSession(editor.session);
            }
            if (getEditor(session)) {
                //create clone
                session = doc.cloneSession();
            }
        }
        settings.session = doc.session;
        var overrides = Object.assign({}, editor.editorOptions, doc.editorOptions);
        for (var i in overrides) {
            var value = (doc.editorOptions && doc.editorOptions.hasOwnProperty(i)) ? doc
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
            console.error(e);
        }
        FocusManager.focusIfKeyboard(__editor.textInput.getElement());
        edit.destroy();
    }

    function autofadeScrollBars(editor) {
        //everything here should be configurable
        var fadeTimeout;

        function doFade() {
            editor.renderer.scrollBarV.setVisible(false);
            fadeTimeout = null;
        }
        var fadeScroll = function(e) {
            if (fadeTimeout) {
                clearTimeout(fadeTimeout);
            } else editor.renderer.scrollBarV.setVisible(true);
            fadeTimeout = setTimeout(doFade, e ? 3000 : 1000);
        };
        var stop = function(e) {
            e.stopPropagation();
        };
        ['ontouchstart', 'ontouchmove', 'ontouchend', 'onmousemove'].forEach(function(f) {
            editor.renderer.scrollBarV.element[f] = stop;
        });
        //no resizing viewport
        editor.renderer.scrollBarV.$minWidth = 25;
        editor.renderer.scrollBarV.width = 25;
        editor.renderer.scrollBarV.element.style.width = 25 + "px";
        //editor.renderer.scrollBarV.inner.style.width = 30+"px";
        editor.session.on("changeScrollTop", fadeScroll);
        editor.on("changeSession", function(s) {
            s.oldSession && s.oldSession.off('changeScrollTop', fadeScroll);
            s.session && s.session.on('changeScrollTop', fadeScroll);
            fadeScroll();
        });
        editor.renderer.scrollBarV.setVisible(true);
    }
    function keepSelect(e){
        var event = this.$mouseHandler.mousedownEvent;
        if(event && new Date().getTime()-event.time<global.FOCUS_RESIZE_WINDOW){
            this.renderer.scrollCursorIntoView(null,0.1);
        }
    }
    function createEditor(container, orphan) {
        var el = document.createElement("div");
        el.className = 'editor';
        container.appendChild(el);
        var editor = ace.edit(el);
        editor.renderer.setScrollMargin(5, 5, 0, 0);
        autofadeScrollBars(editor);
        editor.setAutoScrollEditorIntoView(false);
        editor.$blockScrolling = Infinity; //prevents ace from logging annoying warnings
        settings.add(editor);

        for (var i = 0, end = defaultCommands.length; i < end; i++) {
            if (orphan && defaultCommands[i].mainOnly) continue;
            editor.commands.addCommand(defaultCommands[i]);
        }
        editor.renderer.on('resize',keepSelect.bind(editor));
        if (!orphan) {
            editors.push(editor);
            editor.renderer.on("themeLoaded", function(e) {
                if (editor == editors[0]) {
                    global.setTheme(e.theme);
                }
            });
            editor.renderer.on('changeCharacterSize', function() {
                if (editor == editors[0]) {
                    settings.setOption("fontSize", editor.getFontSize());
                }
            })
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
                e.mainOnly = true
            });
        }
        defaultCommands.push.apply(defaultCommands, commands);
        for (var i in editors) {
            for (var j in commands)
                editors[i].commands.addCommand(commands[j]);
        }
    };
    var api = Object.create(null);
    api.init = Utils.noop;
    api._editors = editors;

    api.getSettingsEditor = getSettingsEditor;
    api.setSession = setSession;
    api.findEditor = getEditor;
    api.addCommands = addCommands;
    api.$focusEditor = focusEditor;
    api.forEach = editors.forEach.bind(editors);
    api.setEditor = setEditor;
    api.getEditor = getEditor;
    api.createEditor = createEditor;
    api.closeEditor = closeEditor;
    global.Editors = api;
    global.getEditor = getEditor;
}) /*_EndDefine*/