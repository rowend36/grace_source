define(function (require, exports, module) {
    'use strict';
    var appEvents = require('../core/app_events').AppEvents;
    var Docs = require('../docs/docs').Docs;
    var closeDoc = require('../docs/docs').closeDoc;
    var openDoc = require('../docs/docs').openDoc;
    var DocsTab = require('./setup_tab_host').DocsTab;
    require('../docs/document_commands');
    //Most of this file is now handled by doc_mixins
    //needed for Docs.defaults
    require('../editor/editor_settings');

    appEvents.on('tabClosed', function (ev) {
        if (Docs.has(ev.tab)) {
            closeDoc(ev.tab);
            console.log(ev.tab,DocsTab.numTabs());
            if (DocsTab.numTabs() === 0) {
                openDoc(null, '', null, {autoClose: true});
            }
        }
    });

    var Config = require('../core/config').Config;
    Config.registerAll(
        {
            detectIndentation: true,
        },
        'documents',
    );
    Config.registerInfo(
        {
            detectIndentation:
                'Automatically detect indentation in new files. Uses resource context.',
        },
        'documents',
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
});