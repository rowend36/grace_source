define(function(require, exports, module) {
    //ace runtime fixes, additions
    var appEvents = require("../core/events").AppEvents;
    var noop = require("../core/utils").Utils.noop;
    
    var emmetExt = ace.require("ace/ext/emmet");
    emmetExt.load = require("../core/depend").define(function(cb) {
        require(["../libs/js/emmet.js"], function(em) {
            window.emmet = em.emmet;
            cb();
        });
    }, function(cb) {
        cb();
    });
    //todo make keybindings configurable
    emmetExt.isSupportedMode = noop;

    var getEditor = require("./active_editor").$getActiveEditor;
    var FocusManager = require("../core/focus_manager").FocusManager;
    ace.Editor.prototype.$enableTouchHandles = true;
    
    var AutoComplete = ace.require("ace/autocomplete").Autocomplete;
    var doBlur = AutoComplete.prototype.blurListener;
    AutoComplete.prototype.blurListener = function() {
        if (FocusManager.activeElement == getEditor().textInput.getElement())
            return;
        doBlur.apply(this, arguments);
    };
    appEvents.on("keyboardChange", function(ev) {
        if (ev.isTrusted && !ev.visible) {
            var a = AutoComplete.for(getEditor());
            if (a.activated) a.detach();
        }
    });
    
    var Docs = require("../docs/docs").Docs;
    var config = require("../core/config").Config.registerAll({
        "detectIndentation": true
    }, "documents");
    appEvents.on("createDoc", function(e) {
        //TODO: usually not triggered for already loaded documents
        var doc = e.doc;
        if (config.detectIndentation) {
            ace.config.loadModule("ace/ext/whitespace", function(e) {
                e.detectIndentation(doc.session);
                console.log('kkkk');
                doc.options.useSoftTabs = doc.session.getUseSoftTabs();
                doc.options.tabSize = doc.session.getTabSize();
                Docs.tempSave(doc.id);
            });
        }
    });
});
