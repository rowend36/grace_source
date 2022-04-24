define(function(require, exports, module) {
    var appEvents = require("../core/events").AppEvents;
    var Editors = require("./editors").Editors;
    var setEditor = Editors.setEditor;
    
    var activeEditor = Editors.$getEditor();

    var currentHost = null;
    var settings = Editors.getSettingsEditor();

    function focusEditor(editor) {
        if (editor === activeEditor) {
            return;
        }
        var host = editor.hostEditor;
        if (!host) {
            if (editor === currentHost) {
                return appEvents.trigger('changeEditor', {
                    oldEditor: activeEditor,
                    editor: editor
                });
            } else return setEditor(editor);
        }
        if (currentHost !== host) {
            currentHost = null;
            setEditor(host);
            currentHost = currentHost || activeEditor;
        }
        if (currentHost == host)
            appEvents.trigger('changeEditor', {
                oldEditor: activeEditor,
                editor: editor,
                isPlugin: true
            });
    }
    appEvents.on('changeEditor', function(e) {
        activeEditor = e.editor;
        settings.editor = activeEditor;
        if (!e.isPlugin)
            currentHost = null;
    });
    appEvents.on('closeEditor', function(e) {
        if (activeEditor == e.editor) {
            activeEditor = currentHost;
        }
    });

    function onCreateEditor(e) {
        var editor = e.editor;
        editor.$setActive = focusEditor.bind(null, editor);
        editor.on('mousedown', editor.$setActive);
    }
    appEvents.on('createEditor', onCreateEditor);
    exports.focusEditor = focusEditor;
    exports.$getActiveEditor = function() {
        return activeEditor;
    };
});
