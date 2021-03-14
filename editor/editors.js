_Define(function(global) {
    var appEvents = global.AppEvents;
    var editorConfig = {};
    var config = global.libConfig;
    var Functions = global.Functions;
    var docs = global.docs;
    var Utils = global.Utils;
    var Doc = global.Doc;
    var MultiEditor = global.MultiEditor;
    var FocusManager = global.FocusManager;

    function getSettingsEditor() {
        return multiEditor;
    }
    //Basics for managing multiple editors
    //Whether it's splits,tabs, scrollers etc
    //setEditor, createEditor, closeEditor, getEditor
    var editors = [];
    var multiEditor = new MultiEditor(editors);

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
        Utils.assert(editors.indexOf(e) > -1, 'Please use set viewPager.getEditorWindow || createEditor(container,true)');
        var oldEditor = __editor;
        __editor = e;
        var pluginEditor = element.env && element.env.editor;
        multiEditor.editor = pluginEditor || e;
        appEvents.trigger('changeEditor', {
            oldEditor: oldEditor,
            editor: pluginEditor || e
        });
        Doc.swapDoc(tabId);
    }

    function setEditor(e) {
        //e can be a container or
        //an editor mousedown event
        e = e.editor || e;
        if (__editor == e) return;
        Utils.assert(editors.indexOf(e) > -1, 'Please use set viewPager.getEditorWindow || createEditor(container,true)');
        var oldEditor = __editor;
        __editor = e;
        multiEditor.editor = e;
        var doc = Doc.forSession(e.session);
        if (doc) {
            Doc.swapDoc(doc.id);
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
            var oldDoc = Doc.forSession(editor.session);
            //session is clone
            if (oldDoc && oldDoc.session != editor.session) {
                Doc.closeSession(editor.session);
            }
            if (getEditor(session)) {
                //create clone
                session = doc.cloneSession();
            }
        }
        multiEditor.session = doc.session;
        var overrides = Object.assign({}, editor.editorOptions, doc.editorOptions);
        for (var i in overrides) {
            var value = (doc.editorOptions && doc.editorOptions.hasOwnProperty(i)) ? doc.editorOptions[i] : multiEditor.options[i];
            editor.setOption(i, value);
        }
        editor.editorOptions = doc.editorOptions;

        editor.setSession(session);
    }

    function closeEditor(edit) {
        var isOrphan = editors.indexOf(edit) < 0;
        if (!isOrphan && appEvents.trigger('closeEditor', {
                editor: edit
            }).defaultPrevented)
            return;
        editors = editors.filter(Utils.except(edit));
        if (edit === __editor) {
            __editor = null;
            setEditor(editors[0]);
        }
        if (Doc.forSession(edit.session))
            Doc.closeSession(edit.session);
        edit.setSession(null);
        FocusManager.focusIfKeyboard(__editor.textInput.getElement());
        edit.destroy();
        if (isOrphan) return;
        
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

    function createEditor(container, orphan) {
        var el = document.createElement("div");
        el.className = 'editor';
        container.appendChild(el);
        var editor = ace.edit(el);
        autofadeScrollBars(editor);
        editor.on("copy", Functions.copy);
        //hack to get native clipboard content
        editor.on("paste", Functions.copy);
        editor.setAutoScrollEditorIntoView(false);
        editor.$blockScrolling = Infinity; //prevents ace from logging annoying warnings
        multiEditor.add(editor);

        for (var i = 0, end = defaultCommands.length; i < end; i++) {
            if (orphan && defaultCommands[i].mainOnly) continue;
            editor.commands.addCommand(defaultCommands[i]);
        }
        if (orphan) return editor;

        editors.push(editor);
        editor.renderer.on("themeLoaded", function(e) {
            if (editor == editors[0]) {
                global.setTheme(e.theme);
            }
        });
        editor.renderer.on('changeCharacterSize', function() {
            if (editor == editors[0]) {
                multiEditor.setOption("fontSize", editor.getFontSize());
            }
        })
        appEvents.trigger('createEditor', {
            editor: editor
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
    var api = {};
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