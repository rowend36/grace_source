_Define(function(global) {
    'use strict';
    var getMainEditor = global.getMainEditor;
    var Docs = global.Docs;
    var DocsTab = global.DocsTab;
    var app = global.AppEvents;
    var nameTagColors = ['red', 'blue', 'green', 'purple', 'yellow', 'pink'];
    var colorIndex = 0;
    var nameTagClass = "name-tag";

    function getIcon(color) {
        color = color || getColor();
        return "<span class='dot " + color + " " + color + "-text'></span>";
    }

    function getColor() {
        return nameTagColors[(colorIndex++) % nameTagColors.length];
    }

    function showNameTag(edit) {
        if (!edit) return;
        var session = Docs.forSession(edit.session);
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
            Docs.removeTabAnnotation(anno.tab, anno);
            anno.tab = e.tab;
            Docs.addTabAnnotation(e.tab, anno);
        }
    }

    function changeEditor(e) {
        hideNameTag(e.editor);
        showNameTag(e.oldEditor);
    }
    global.NameTags = {
        show: function() {
            app.off('changeTab', changeTab);
            app.off('changeEditor', changeEditor);
            app.on('changeTab', changeTab);
            app.on('changeEditor', changeEditor);
        },
        hide: function() {
            app.off('changeTab', changeTab);
            app.off('changeEditor', changeEditor);
        },
        createTag: function(editor) {
            editor.color = getColor();
            createNameTag(editor, editor.color);
            editor.colorAnnotation = {
                tab: DocsTab.active,
                className: editor.color
            };
            Docs.addTabAnnotation(DocsTab.active, editor.colorAnnotation);
        },
        removeTag: function(editor) {
            Docs.removeTabAnnotation(editor.colorAnnotation.tab, editor.colorAnnotation);
            editor.color = editor.colorAnnotation = null;
            editor.container.removeChild(editor.container.getElementsByClassName(nameTagClass)[0]);
        }
    };
}); /*_EndDefine*/
_Define(function(global) {
    'use strict';
    var app = global.AppEvents;
    var getEditor = global.getMainEditor;
    var Docs = global.Docs;
    var Editors = global.Editors;
    var SplitManager = global.SplitManager;
    var FocusManager = global.FocusMamager;
    var host = global.getHostEditor;
    var Notify = global.Notify;
    var NameTags = global.NameTags;
    var clickable = global.showClickable;
    var unclickable = global.hideClickable;
    
    function mousedown(e) {
        Editors.setEditor(e.editor);
    }
    var splitEditors = [];

    function createSplitEditor(edit, direction) {
        //recall sizes
        if (splitEditors.length === 0) {
            var hostEditor = host(edit);
            app.on('beforeCloseTab', onBeforeCloseTab);
            NameTags.show();
            splitEditors.push(hostEditor);
            hostEditor.on("mousedown", mousedown);
            NameTags.createTag(hostEditor);
        }
        var container = SplitManager.add($(edit.container), direction);
        var editor = Editors.createEditor(container);
        var doc = Docs.forSession(edit.session);
        if (doc)
            editor.setSession(doc.cloneSession());
        splitEditors.push(editor);
        editor.on("mousedown", mousedown);
        NameTags.createTag(editor);
        Editors.setEditor(editor);
        editor.focus();
    }

    function removeSplitEditor(edit) {
        var hostEditor = host(edit);
        if (splitEditors.indexOf(hostEditor) < 0) {
            return;
        }
        if (SplitManager.remove($(edit.container))) {
            splitEditors.splice(splitEditors.indexOf(hostEditor), 1);
            hostEditor.off('mousedown', mousedown);
            NameTags.removeTag(hostEditor);
            Editors.closeEditor(hostEditor);
            //unclickable(hostEditor.container);
            if (splitEditors.length === 1) {
                var mainEditor = host(getEditor());
                //unclickable(mainEditor.container);
                splitEditors.splice(splitEditors.indexOf(mainEditor), 1);
                mainEditor.off('mousedown', mousedown);
                NameTags.removeTag(mainEditor);
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
    var MainMenu = global.MainMenu;

    MainMenu.addOption("splits-m", {
        caption: "Splits",
        icon: "view_module",
        childHier: {
            "add-split": {
                caption: "Add Split Horizontal",
                onclick: function() {
                    createSplitEditor(global.getEditor(), 'horizontal');
                }
            },
            "add-split-v": {
                caption: "Add Split Vertical",
                onclick: function() {
                    createSplitEditor(global.getEditor(), 'vertical');
                }
            },
            "remove-split": {
                caption: "Remove Split",
                onclick: function() {
                    removeSplitEditor(global.getEditor());
                }
            },

        }
    });

    var onBeforeCloseTab = function(e) {
        if (splitEditors.length < 2) {
            console.error('Invalid State');
            if (splitEditors[0]) {
                splitEditors[0].off('mousedown', mousedown);
                NameTags.removeTag(splitEditors[0]);
            }
            NameTags.hide();
            app.off('beforeCloseTab', onBeforeCloseTab);
            return;
        }
        var doc = e.doc;
        var editor;
        //*Check if a valid tab not viewPager
        if (!doc) return;
        if (doc.clones && doc.clones.length > 0) {
            editor = getEditor();
            if (doc == Docs.forSession(editor.session))
                removeSplitEditor(editor);
            else {
                //Not all holders are assured to call
                //closeDoc and closeSession does not do
                //it automatically yet
                Notify.warn('Document is in use by another plugin');
            }
            e.preventDefault();
        } else {
            editor = getEditor(doc.session);
            if (editor) {
                removeSplitEditor(editor);
                e.preventDefault();
            }
        }
    };
    global.SplitEditors = {
        create: createSplitEditor,
        close: removeSplitEditor,
        hasEditor: function(doc) {
            /*Check if a document is open in any split*/
            /*Focus that editor if found*/
            var curDoc = Docs.forSession(getEditor().session);
            if (curDoc == doc) return true;
            if (splitEditors.length < 2) return false;
            var editor = getEditor(doc.session);
            if (editor && splitEditors.indexOf(editor) > -1) {
                Editors.setEditor(editor);
                FocusManager.focusIfKeyboard(editor, true);
                return true;
            }
            for (var i in doc.clones) {
                editor = getEditor(doc.clones[i]);
                if (editor && splitEditors.indexOf(editor) > -1) {
                    Editors.setEditor(editor);
                    FocusManager.focusIfKeyboard(editor, true);
                    return true;
                }
            }

        },
        init: function() {
            Editors.addCommands(splitCommands);
        },
        commands: splitCommands
    };
}); /*_EndDefine*/