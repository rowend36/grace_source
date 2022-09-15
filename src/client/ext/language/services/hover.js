define(function (require, exports, module) {
    'use strict';
    var config = ace.require('ace/config');
    var Editor = ace.require('ace/editor').Editor;
    var Registry = require('grace/core/registry').Registry;
    var hoverProviders = new Registry();

    var onCursorChange = function (e, editor) {
        clearTimeout(editor.$debounceArgHints);
        editor.$debounceArgHints = setTimeout(
            $invokeProviders.bind(editor),
            100,
        );
    };
    var $invokeProviders = function () {
        var editor = this,
            hasMain;
        hoverProviders.getActive(editor).forEach(function (server) {
            var instance;
            if (hasMain && !server.isSupport) return;
            hasMain = hasMain || !server.isSupport;
            if ((instance = editor[server.name])) {
                instance.updateArgHints(editor);
            }
            server.init(editor, function (instance) {
                if (!instance) return;
                editor[server.name] = instance;
                instance.updateArgHints(editor);
            });
        });
    };

    function updateArgHints(editor) {
        if (editor.$enableArgumentHints) {
            if (!editor.$onSmartCursorChange) {
                editor.$onSmartCursorChange = onCursorChange;
                editor.on('changeSelection', editor.$onSmartCursorChange);
            }
        } else if (editor.$onSmartCursorChange) {
            editor.off('changeSelection', editor.$onSmartCursorChange);
            editor.$onSmartCursorChange = null;
            clearTimeout(editor.$debounceArgHints);
        }
    }

    config.defineOptions(Editor.prototype, 'editor', {
        enableArgumentHints: {
            set: function () {
                updateArgHints(this);
            },
            value: false,
        },
    });
    exports.registerHoverProvider = hoverProviders.register;
    exports.unregisterHoverProvider = hoverProviders.unregister;
});