define(function(require,exports,module) {
    'use strict';
    /*globals $*/
    var getMainEditor = require("grace/setup/setup_editors").getMainEditor;
    var DocsTab = require("grace/setup/setup_tab_host").DocsTab;
    var Docs = require("grace/docs/docs").Docs;
    var app = require("grace/core/app_events").AppEvents;
    var nameTagColors = ['red', 'blue', 'green', 'purple', 'yellow',
        'pink'
    ];
    var colorIndex = 0;
    var nameTagClass = "name-tag";

    function getIcon(color) {
        color = color || getColor();
        return "<span class='dot " + color + " " + color +
            "-text'></span>";
    }

    function getColor() {
        return nameTagColors[(colorIndex++) % nameTagColors.length];
    }

    function showNameTag(edit) {
        if (!edit) return;
        var doc = Docs.forSession(edit.session);
        if (!doc) return;
        var nameTag = edit.container.getElementsByClassName(
            nameTagClass);
        if (nameTag.length) {
            nameTag[0].style.opacity = "0.7";
            nameTag[0].children.item(0).innerHTML = doc.path;
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
        var nameTag = edit.container.getElementsByClassName(
            nameTagClass);
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
    exports.NameTags = {
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
            Docs.addTabAnnotation(DocsTab.active, editor
                .colorAnnotation);
        },
        removeTag: function(editor) {
            Docs.removeTabAnnotation(editor.colorAnnotation.tab,
                editor.colorAnnotation);
            editor.color = editor.colorAnnotation = null;
            editor.container.removeChild(editor.container
                .getElementsByClassName(nameTagClass)[0]);
        }
    };
}); /*_EndDefine*/
