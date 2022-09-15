define(function (require, exports, module) {
    var appEvents = require('../core/app_events').AppEvents;
    var Docs = require('../docs/docs').Docs;
    var DocsTab = require('./setup_tab_host').DocsTab;
    var Editors = require('../editor/editors').Editors;
    var focusEditor = require('../editor/host_editor').focusEditor;
    var getActiveEditor = require('../editor/host_editor').$getActiveEditor;
    var getMainEditor = Editors.$getEditor;
    var rootView = require('./setup_root').rootView;
    var setTheme = require('../themes/themes').setTheme;
    var swapTab = require('./setup_tab_host').swapTab;
    var View = require('../ui/view').View;
    var noop = require('../core/utils').Utils.noop;
    var FocusManager = require('../ui/focus_manager').FocusManager;
    var emmetExt = ace.require('ace/ext/emmet');
    var AutoComplete = ace.require('ace/autocomplete').Autocomplete;
    require('../editor/editor_fonts');

    //Add some commands
    Editors.addCommands({
        name: 'swapTabs',
        bindKey: {
            win: 'Alt-Tab',
            mac: 'Command-Alt-N',
        },
        exec: swapTab,
    });
    Editors.addCommands(require('../ext/format/format').FormatCommands);
    Editors.addCommands(require('../docs/document_commands').DocumentCommands);

    //Setup plugins
    emmetExt.load = require('../core/depend').after(function (cb) {
        require(['../libs/js/emmet'], function (em) {
            console.log(em, window.emmet);
            emmetExt.setCore(em);
            cb();
        });
    });
    //TODO make emmet keybindings configurable
    emmetExt.isSupportedMode = noop;

    var doBlur = AutoComplete.prototype.blurListener;
    AutoComplete.prototype.blurListener = function () {
        if (
            FocusManager.activeElement ==
            getActiveEditor().textInput.getElement()
        )
            return;
        doBlur.apply(this, arguments);
    };
    appEvents.on('keyboardChanged', function (ev) {
        if (ev.isTrusted && !ev.visible) {
            var a = AutoComplete.for(getActiveEditor());
            if (a.activated) a.detach();
        }
    });

    //Editor View
    var editorView = new View();
    rootView.addView(editorView, 2, null, 1);
    editorView.$el.attr('id', 'viewroot');
    var margins = {
        marginTop: 0,
        marginBottom: 0,
    };
    appEvents.on('createEditor', function (e) {
        e.editor.getPopupMargins = function (isDoc) {
            return isDoc
                ? {
                      marginTop: 0,
                      marginBottom: margins.marginBottom,
                  }
                : margins;
        };
    });
    appEvents.on('layoutChanged', function () {
        var viewRoot = editorView.$el[0];
        margins.marginTop = parseInt(viewRoot.style.top) || 0;
        margins.marginBottom = (parseInt(viewRoot.style.bottom) || 0) + 50;
    });

    //Link documents and tabs
    function onChangeTab(ev) {
        if (!Docs.has(ev.tab)) return;
        var editor = getMainEditor();
        focusEditor(editor);
        Editors.setSession(Docs.get(ev.tab));
        ev.preventDefault();
    }

    function onChangeDoc(ev) {
        //Check if the activeDoc is in the main editor
        if (
            ev.doc &&
            getMainEditor() === getActiveEditor() &&
            DocsTab.active !== ev.doc.id
        ) {
            DocsTab.setActive(ev.doc.id, true, true);
        }
    }

    appEvents.on('changeTab', onChangeTab);
    appEvents.on('changeDoc', onChangeDoc);

    var activeDoc;
    function updateActiveDoc() {
        var doc = Docs.forSession(getActiveEditor().session);
        if (doc !== activeDoc) {
            var oldDoc = activeDoc;
            activeDoc = doc;
            appEvents.signal('changeDoc', {
                doc: activeDoc,
                oldDoc: oldDoc,
            });
        }
    }
    appEvents.on('changeEditor', function (e) {
        if (!e.editor.$updateActiveDoc) {
            e.editor.$updateActiveDoc = true;
            e.editor.on('changeSession', updateActiveDoc);
        }
        updateActiveDoc();
    });
    function getActiveDoc() {
        return activeDoc;
    }

    //Initialize main editor
    var editor = Editors.createEditor(editorView.$el[0]);
    Editors.setEditor(editor);
    //Previous attempts would have failed before now.
    DocsTab.updateActive();

    exports.getEditor = function (ses) {
        if (ses) return getMainEditor(ses);
        else return getActiveEditor();
    };
    exports.editorView = editorView;
    exports.getActiveDoc = getActiveDoc;
    //The active main editor can safely be manipulated
    //as opposed to plugin editors which might be returrned by getEditor
    exports.getMainEditor = getMainEditor;
});