define(function (require, exports, module) {
    'use strict';
    var appEvents = require('../core/app_events').AppEvents;
    var Docs = require('../docs/docs').Docs;
    var closeDoc = require('../docs/docs').closeDoc;
    var openDoc = require('../docs/docs').openDoc;
    var DocsTab = require('./setup_tab_host').DocsTab;

    var Notify = require('../ui/notify').Notify;

    //needed for Docs.defaults
    require('../editor/editor_settings');

    appEvents.on('tabClosed', function (ev) {
        if (Docs.has(ev.tab)) {
            closeDoc(ev.tab);
            if (DocsTab.numTabs() === 0) {
                openDoc(null, '', null, {autoClose: true});
            }
        }
    });

    appEvents.on('closeTab', function (ev) {
        var doc = Docs.get(ev.tab);
        if (doc && doc.clones && doc.clones.length) {
            Notify.error('This document is being used by a plugin');
            ev.preventDefault();
        }
        if (!doc) return;
        if (doc.dirty) {
            ev.stopPropagation();
            ev.await('close-without-saving-' + doc.lastSave, function (resume) {
                Notify.ask(
                    Docs.getName(doc.id) +
                        ' has unsaved changes. Close without saving?',
                    resume
                );
            });
        }
    });
    var Config = require('../core/config').Config;
    Config.registerAll(
        {
            detectIndentation: true,
        },
        'documents'
    );
    Config.registerInfo(
        {
            detectIndentation:
                'Automatically detect indentation in new files. Uses resource context.',
        },
        'documents'
    );
    appEvents.on('openDoc', function (e) {
        //TODO: usually not triggered for already loaded documents
        var doc = e.doc;
        if (
            Config.forPath(doc.getSavePath(), 'documents', 'detectIndentation')
        ) {
            require(['ace!ext/whitespace'], function (e) {
                e.detectIndentation(doc.session);
                doc.setOption('useSoftTabs', doc.session.getUseSoftTabs());
                doc.setOption('tabSize', doc.session.getTabSize());
            });
        }
    });

    //allow open document in new tab
    Docs.initialize();
    appEvents.on('documentsLoaded', Docs.refreshDocs.bind(null, null));
});