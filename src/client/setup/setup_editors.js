define(function (require, exports, module) {
    var appEvents = require('../core/app_events').AppEvents;
    var Docs = require('../docs/docs').Docs;
    var after = require('../core/depend').after;
    var DocsTab = require('./setup_tab_host').DocsTab;
    var Editors = require('../editor/editors').Editors;
    var setActiveEditor = require('../editor/host_editor').setActiveEditor;
    var getActiveEditor = require('../editor/host_editor').$getActiveEditor;
    var getMainEditor = Editors.$getEditor;
    var rootView = require('./setup_root').rootView;
    var appEvents = require('../core/app_events').AppEvents;
    var Annotations = require('ace!annotations').Annotations;
    require('../editor/editor_fonts');
    // var setTheme = require('../themes/themes').setTheme;
    var View = require('../ui/view').View;

    //Editor View
    var editorView = new View();
    rootView.addView(editorView, 2, null, 1);
    editorView.$el.attr('id', 'viewroot');
    var margins = {
        marginTop: 0,
        marginBottom: 0,
    };
    Annotations.updateWorkers = after(
        appEvents.on.bind(appEvents, 'fullyLoaded'),
        function (session) {
            Annotations.updateWorkers = this;
            if (session.bgTokenizer) this(session);
        }.bind(Annotations.updateWorkers),
    );
    Annotations.removeWorkers = after(
        appEvents.on.bind(appEvents, 'fullyLoaded'),
        function (session) {
            Annotations.removeWorkers = this;
            if (session.bgTokenizer) this(session);
        }.bind(Annotations.removeWorkers),
    );
    //We modified ace to use getPopupMargins when positioning popups.
    Editors.onEach(function (editor) {
        editor.getPopupMargins = function (isDoc) {
            return isDoc
                ? {
                      marginTop: 0,
                      marginBottom: margins.marginBottom,
                  }
                : margins;
        };
    });
    appEvents.on('layoutChanged', function () {
        var editors = editorView.$el.find('.editor');
        for (var i = 0; i < editors.length; i++) {
            editors[i].env && editors[i].env.onResize();
        }
        var viewRoot = editorView.$el[0];
        margins.marginTop = parseInt(viewRoot.style.top) || 0;
        margins.marginBottom = (parseInt(viewRoot.style.bottom) || 0) + 50;
    });

    //Link documents and tabs
    function onChangeTab(ev) {
        if (!Docs.has(ev.tab)) return;
        var editor = getMainEditor();
        setActiveEditor(editor);
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
            //No longer possible
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
    //Prior attempts would have failed.
    DocsTab.updateActive();

    //The active main editor can safely be manipulated
    //as opposed to plugin editors which might be returrned by getEditor
    exports.getMainEditor = getMainEditor;
    exports.getEditor = function (session) {
        if (session) return getMainEditor(session);
        else return getActiveEditor();
    };
    exports.editorView = editorView;
    exports.getActiveDoc = getActiveDoc;
});