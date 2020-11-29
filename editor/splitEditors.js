(function(global) {
    'use strict';
    var getMainEditor = global.getMainEditor;
    var Doc = global.Doc;
    var DocsTab = global.DocsTab;
    var app = global.AppEvents;
    var nameTagIconStyle = "display:inline-block;margin-left:5px;margin-right:5px;width:10px;height:10px;border-radius:50%";
    var nameTagColors = ['red', 'blue', 'green', 'purple', 'yellow', 'pink'];
    var colorIndex = 0;
    var nameTagClass = "name-tag";

    function getIcon(color) {
        color = color || getColor();
        return '<span style="' + nameTagIconStyle + '" class = "' + color + " " + color + '-text"></span>';
    }

    function getColor() {
        return nameTagColors[(colorIndex++) % nameTagColors.length];
    }

    function showNameTag(edit) {
        if (!edit) return;
        var session = Doc.forSession(edit.session);
        if (!session) return;
        var nameTag = edit.container.getElementsByClassName(nameTagClass);
        if (nameTag.length) {
            nameTag[0].style.opacity = "0.7";
            nameTag[0].children.item(0).innerHTML = session.path;
            nameTag[0].children.item(1).style.padding = '';
            nameTag[0].children.item(1).style.boxShadow = 'none';

        }
        return nameTag[0] || null;
    }

    function createNameTag(edit, color) {
        var icon = getIcon(color);
        var nameTag = document.createElement('div');
        nameTag.style.width = "";
        nameTag.style.right = "0px";
        nameTag.style.bottom = "0px";
        nameTag.style.height = "20px";
        nameTag.style.position = "absolute";
        nameTag.className = nameTagClass;
        nameTag.style.zIndex = '8';
        $(nameTag).append('<span></span>' + icon);
        edit.container.appendChild(nameTag);
        return nameTag;
    }

    function hideNameTag(edit) {
        if (!edit) return;
        var nameTagClass = "name-tag";
        var nameTag = edit.container.getElementsByClassName(nameTagClass);
        if (nameTag.length) {
            nameTag[0].style.opacity = 1;
            nameTag[0].children.item(1).style.boxShadow = '0 0 5px';
            nameTag[0].children.item(1).style.padding = '6px';
            nameTag[0].children.item(0).opacity = 0.5;
        }
        return nameTag[0] || null;
    }

    function changeTab(e) {
        var anno = getMainEditor().colorAnnotation;
        if (anno) {
            Doc.removeTabAnnotation(anno.tab, anno);
            anno.tab = e.tab;
            Doc.addTabAnnotation(e.tab, anno);
        }
    }
    function changeEditor(e){
        hideNameTag(e.editor);
        showNameTag(e.oldEditor);
    }
    global.NameTags = {
        init: function() {
            if (!app) app = global.AppEvents;
            var edit = getMainEditor();
            if (!edit)
                return;
            if (!edit.colorAnnotation) {
                this.createTag(edit);
                //error guard
                app.off('changeTab', changeTab);
                app.off('changeEditor', changeEditor);
                app.on('changeTab', changeTab);
                app.on('changeEditor', changeEditor);
            }
        },
        hide: function() {
            var edit = getMainEditor();
            if (!edit)
                return;
            if (edit.colorAnnotation) {
                this.removeTag(edit);
                app.off('changeTab', changeTab);
                app.off('changeEditor', changeEditor);
            }
        },
        createTag: function(editor) {
            editor.color = getColor();
            createNameTag(editor, editor.color);
            editor.colorAnnotation = { tab: DocsTab.active, className: editor.color };
            Doc.addTabAnnotation(DocsTab.active, editor.colorAnnotation);
        },
        removeTag: function(editor) {
            Doc.removeTabAnnotation(editor.colorAnnotation.tab, editor.colorAnnotation);
            editor.color = editor.colorAnnotation = null;
            editor.container.removeChild(editor.container.getElementsByClassName(nameTagClass)[0]);
        }
    };
})(Modules);
(function(global) {
    'use strict';
    var app = global.AppEvents;
    var getEditor = global.getMainEditor;
    var Doc = global.Doc;
    var Editors = global.Editors;
    var SplitManager = global.SplitManager;
    var FocusManager = global.FocusMamager;
    var Notify = global.Notify;
    var NameTags = global.NameTags;
    var clickable = global.showClickable;
    var unclickable = global.hideClickable;
    var numSplits = 0;
    //split editors see Multieditor.setDoc
    function mousedown(e) {
        Editors.setEditor(e.editor);
    }

    function createSplitEditor(edit, direction) {
        //recall sizes
        if (numSplits === 0) {
            getEditor().isSplit = true;
            app.on('beforeCloseTab', onBeforeCloseTab);
            getEditor().on("mousedown",mousedown);
            NameTags.init();
        }
        numSplits++;
        var container = SplitManager.add($(edit.container), direction);
        var editor = Editors.createEditor(container);
        editor.on("mousedown",mousedown);
        var doc = Doc.forSession(edit.session);
        if(doc)
            editor.setSession(doc.cloneSession());
        editor.isSplit = true;
        NameTags.createTag(editor);
        Editors.setEditor(editor);
        editor.focus();
    }

    function removeSplitEditor(edit) {
        if (numSplits < 1) {
            return;
        }
        if (edit.isSplit && SplitManager.remove($(edit.container))) {
            NameTags.removeTag(edit);
            unclickable(edit.container);
            edit.off('mousedown', mousedown);
            Editors.closeEditor(edit);
            numSplits--;
            if(numSplits<1){
                getEditor().isSplit = false;
                unclickable(getEditor().container);
                getEditor().off('mousedown', mousedown);
                app.off('beforeCloseTab', onBeforeCloseTab);
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
    // var onChangeEditor = function(e) {
    //     if(e.oldEditor && e.oldEditor.isSplit){
    //         clickable(e.oldEditor.container);
    //         e.oldEditor.on("mousedown", mousedown);
    //     }
    //     if(e.editor && e.editor.isSplit){
    //         unclickable(e.editor.container);
    //         e.editor.off("mousedown", mousedown);
    //     }
    // };
    var onBeforeCloseTab = function(e) {
        var doc = e.doc;
        if (numSplits > 0) {
            var editor;
            if (doc){
                if (doc.clones && doc.clones.length > 0) {
                    editor = getEditor();
                    if (doc == Doc.forSession(editor.session))
                        editor.execCommand("Remove Split");
                    else
                        Notify.warn('Document active in multiple panes');
                }
                else {
                    editor = getEditor(doc.session);
                    editor.execCommand('Remove Split');
                }
                e.preventDefault();
            }
        }
        else {
            console.error('Invalid State');
            app.off('beforeCloseTab', onBeforeCloseTab);
        }
    };
    global.SplitEditors = {
        create: createSplitEditor,
        close: removeSplitEditor,
        hasEditor: function(doc) {
            if (numSplits < 1) return false;
            var curDoc = Doc.forSession(getEditor().session);
            if (curDoc == doc) return true;
            var editor = getEditor(doc.session);
            if (editor && editor.isSplit) {
                Editors.setEditor(editor);
                FocusManager.focusIfKeyboard(editor,true);
                return true;
            }
            for (var i in doc.clones) {
                editor = getEditor(doc.clones[i]);
                if (editor && editor.isSplit) {
                    Editors.setEditor(editor);
                    FocusManager.focusIfKeyboard(editor,true);
                    return true;
                }
            }

        },
        init: function() {
            Editors.addCommands(splitCommands);
        },
        commands: splitCommands
    }
})(Modules)