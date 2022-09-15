define(function (require, exports, module) {
    var appEvents = require('../core/app_events').AppEvents;
    var Editors = require('./editors').Editors;
    var setEditor = Editors.setEditor;

    var activeEditor = Editors.$getEditor();

    var currentHost = null;
    var settings = Editors.getSettingsEditor();

    function setActiveEditor(editor) {
        if (editor === activeEditor) {
            return;
        }
        if (!editor.session) throw new Error('Cannot focus closed editor');
        var host = editor.hostEditor;
        if (!host) {
            if (editor === currentHost) {
                return appEvents.signal('changeEditor', {
                    oldEditor: activeEditor,
                    editor: editor,
                });
            } else return setEditor(editor);
        }
        if (currentHost !== host) {
            currentHost = null;
            setEditor(host);
            currentHost = currentHost || activeEditor;
        }
        if (currentHost == host)
            appEvents.signal('changeEditor', {
                oldEditor: activeEditor,
                editor: editor,
                isPlugin: true,
            });
    }
    appEvents.on('changeEditor', function (e) {
        activeEditor = e.editor;
        settings.editor = activeEditor;
        if (!e.isPlugin) currentHost = null;
    });
    appEvents.on('closeEditor', function (e) {
        if (activeEditor == e.editor) {
            activeEditor = currentHost;
        }
    });

    Editors.onEach(function trackActive(editor) {
        editor.$setActive = setActiveEditor.bind(null, editor);
        editor.on('mousedown', editor.$setActive);
    });
    exports.setActiveEditor = setActiveEditor;
    exports.$getActiveEditor = function () {
        return activeEditor;
    };
});
