define(function(require, exports, module) {
    var Docs = require("./docs").Docs;
    var AppEvents = require("../core/events").AppEvents;
    var getEditor = require("../editor/active_editor").$getActiveEditor;
    
    var activeDoc;

    function updateSaveIndicator() {
        var doc = getActiveDoc();
        var saveEls = $("#save");
        var color = "";
        if (!doc || !doc.dirty) color = "";
        else if (doc.allowAutoSave) color = "status_pending";
        else {
            color = "status_unsaved";
        }
        saveEls.attr('class', color);
    }

    function updateActiveDoc() {
        var doc = Docs.forSession(getEditor().session);
        if (doc !== activeDoc) {
            var oldDoc = activeDoc;
            activeDoc = doc;
            updateSaveIndicator(doc);
            AppEvents.trigger('changeDoc', {
                doc: activeDoc,
                oldDoc: oldDoc
            });
        }
    }
    AppEvents.on('changeEditor', function(e) {
        if (!e.editor.$updateActiveDoc) {
            e.editor.on('changeSession', updateActiveDoc);
        }
        updateActiveDoc();
    });
    AppEvents.on('docStatusChange', function(ev) {
        if (ev.doc === getActiveDoc()) {
            updateSaveIndicator();
        }
    });
    var getActiveDoc = function() {
        return activeDoc;
    };

    exports.getActiveDoc = getActiveDoc;
}) /*_EndDefine*/ ;