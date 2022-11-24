define(function (require, exports, module) {
    'use strict';
    var diff = require('grace/ext/diff/diff');
    require('../docs/test_docs_tabs');
    var Doc = require('grace/docs/document').Doc;
    var Docs = require('grace/docs/docs').Docs;
    var appEvents = require('grace/core/app_events').AppEvents;
    var expect = require('chai').expect;
    var text = require('text!./test_diff.js');
    var closeTab = require('grace/setup/setup_tab_host').closeTab;
    var Tabs = require('grace/setup/setup_tab_host').DocsTab;
    var waterfall = require('grace/core/utils').Utils.waterfall;
    var Channels = require('grace/core/channels').Channels;
    function waitForTab(tab, cb) {
        if (Tabs.hasTab(tab)) cb(tab);
        else
            appEvents.on('changeTab', function next(ev) {
                if (ev.tab === tab) {
                    appEvents.off('changeTab', next);
                    cb(tab);
                }
            });
    }
    describe('Diff', function () {
        before(function () {
            Docs.initialize();
        });
        it('should work', function (done) {
            waterfall([
                function (n) {
                    diff.registerDiffFactory('test', function (data, cb) {
                        var panes = Object.assign({}, data);
                        panes.ours = Docs.get(panes.ours);
                        cb(panes, 'TEST', data);
                    });
                    var doc = new Doc(text);
                    var tab = diff.createDiffView(
                        'test',
                        {
                            ours: doc.id,
                            origin: text.replace(/function/g, 'fun'),
                        },
                        true
                    );
                    waitForTab(tab, n);
                },
                closeTab,
                done,
            ]);
        });
        it('should persist views', function (done) {
            appEvents.on('documentsLoaded', function () {
                var hasPending = Channels.channelHasPending(
                    'diffs-test_persist'
                );
                var called = false;
                diff.registerDiffFactory('test_persist', function (data, cb) {
                    called = true;
                    var panes = Object.assign({}, data);
                    panes.ours = Docs.get(panes.ours);
                    cb(panes, 'TEST', data);
                });
                if (!hasPending) {
                    var doc = new Doc(text);
                    diff.createDiffView(
                        'test_persist',
                        {
                            ours: doc.id,
                            origin: text.replace(/function/g, 'fun'),
                        },
                        true
                    );
                    Docs.persist();
                    done();
                } else
                    waterfall([
                        function (n) {
                            //No way to get the tab id.
                            require([
                                'grace/ext/diff/libs/ace-inline-diff',
                                'grace/ext/diff/libs/ace-diff-utils',
                                'css!grace/ext/diff/libs/ace-diff',
                            ], n);
                        },
                        function (n) {
                            setTimeout(n, 100);
                        },
                        function () {
                            expect(called).to.equal(true);
                        },
                        done,
                    ]);
            });
        });
    });
});