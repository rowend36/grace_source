define(function (require, exports, module) {
    'use strict';
    var Editors = require('grace/editor/editors').Editors;
    var Registry = require('grace/core/registry').Registry;
    var hoverProviders = new Registry(null, 'intellisense.hover');

    var onCursorChange = function (e, editor) {
        clearTimeout(editor.$debounceArgHints);
        editor.$debounceArgHints = setTimeout(
            $invokeProviders.bind(editor),
            100
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

    Editors.getSettingsEditor().addOption('enableArgumentHints', {
        set: function () {
            updateArgHints(this);
        },
        value: false,
    });
    exports.registerHoverProvider = hoverProviders.register;
    exports.unregisterHoverProvider = hoverProviders.unregister;
});