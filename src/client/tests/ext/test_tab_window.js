define(function (require, exports, module) {
    var expect = require('chai').expect;
    var forEach = require('grace/core/utils').Utils.asyncForEach;
    var appEvents = require('grace/core/app_events').AppEvents;
    var waterfall = require('grace/core/utils').Utils.waterfall;
    var Editors = require('grace/editor/editors').Editors;
    var TabWindow = require('grace/ext/ui/tab_window');
    var setActiveEditor = require('grace/editor/host_editor').setActiveEditor;
    var splits = require('grace/ext/ui/split_editors').SplitEditors;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var getMainEditor = require('grace/setup/setup_editors').getMainEditor;
    var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
    require('../docs/test_docs');
    /*
{
    name: string,
    description: string,
    bindKey: key,
    exec: string|{0:string,1:args},
    readOnly: boolean,
    multiSelectAction: "forEach"|"forEachLine"|function|undefined,
    scrollIntoView: true|"cursor"|"center"|"selectionPart"
    // aceCommandGroup: "fileJump",
}
*/
    describe('Current Editor vs Main Editor', function () {
        var activeDoc,
            numClones,
            firstEditor, //The initial editor
            splitEditor, //A split editor that will be created
            pluginEditor, //A plugin editor that wil be created
            currentEditor, //The output of getEditor()
            mainEditor; //The output of getMainEditor()
        var tests = [
            {
                name: 'set editor using $setActiveEditor',
                exec: function () {
                    setActiveEditor(firstEditor);
                    currentEditor = mainEditor = firstEditor;
                },
            },
            {
                name: 'set plugin editor while keeping main editor',
                exec: function () {
                    pluginEditor = Editors.createEditor(
                        new DocumentFragment(),
                        true
                    );
                    pluginEditor.id = 'plugin';
                    pluginEditor.hostEditor = firstEditor;
                    setActiveEditor(pluginEditor);
                    currentEditor = pluginEditor;
                },
            },
            {
                name: 'not do anything if already active',
                exec: function () {
                    pluginEditor.$setActive();
                },
            },
            {
                name: 'allow main editor to become active',
                exec: function () {
                    firstEditor.$setActive();
                    currentEditor = firstEditor;
                },
            },
            {
                name: 'set editor when creating split',
                exec: function () {
                    splitEditor = splits.create(mainEditor, 'vertical');
                    splitEditor.id = 'split';
                    numClones++;
                    mainEditor = currentEditor = splitEditor;
                },
            },
            {
                name: 'remove split',
                exec: function () {
                    var tempEdit = splits.create(mainEditor, 'horizontal');
                    tempEdit.execCommand('removeSplit');
                    currentEditor = mainEditor = firstEditor;
                },
            },
            {
                name: 'set plugin editor and main editor using focus editor',
                exec: function () {
                    pluginEditor.$setActive();
                    mainEditor = firstEditor;
                    currentEditor = pluginEditor;
                },
            },
        ];
        var times = [500, 125, 30, 15, 0, 0];
        var id;
        before(function (done) {
            waterfall([
                function (n) {
                    require(['grace/setup/setup_docs'], n);
                },
                function (n) {
                    appEvents.on('documentsLoaded', n);
                },
                function () {
                    activeDoc =
                        getActiveDoc() ||
                        ((id = require('grace/docs/docs').openDoc(
                            'test',
                            'Test'
                        )) &&
                            getActiveDoc());

                    expect(activeDoc).to.not.be.null;
                    numClones = activeDoc.clones ? activeDoc.clones.length : 0;
                    pluginEditor = currentEditor = splitEditor = mainEditor = undefined;
                    firstEditor = getMainEditor();
                    firstEditor.id = 'main';
                },
                done,
            ]);
        });
        after(function () {
            if (id) require('grace/docs/docs').closeDoc(id);
        });
        var failed = false;
        forEach(
            times,
            function (time, i, next) {
                forEach(
                    tests,
                    function (test, i, next) {
                        it(
                            'Time=' + time + ', it should ' + test.name,
                            function () {
                                if (failed) return this.skip();
                                failed = true;
                                test.exec();
                                expect(currentEditor.id).to.equal(
                                    getEditor().id
                                );
                                expect(mainEditor.id).to.equal(
                                    getMainEditor().id
                                );
                                expect(
                                    activeDoc.clones
                                        ? activeDoc.clones.length
                                        : 0
                                ).to.equal(numClones);
                                failed = false;
                            }
                        );
                        next();
                    },
                    next
                );
            },
            function () {
                it('should close all splits/clones', function () {
                    var a = getMainEditor();
                    while (splits.isSplit(a)) {
                        a.execCommand('removeSplit');
                        if (a == getMainEditor()) {
                            throw 'Wrror';
                        }
                        a = getMainEditor();
                    }
                    expect(Editors.$allEditors.length).to.equal(1);
                    numClones = activeDoc.clones ? activeDoc.clones.length : 0;
                    expect(numClones).to.equal(0);
                });
            }
        );
    });
    describe('TabWindow', function () {
        var tab, currentDoc;
        before(function () {
            currentDoc = getActiveDoc().id;
        });
        it('should create a new tab window', function () {
            tab = TabWindow.getTabWindow('test', 'Test window', '...testing');
            expect(tab).is.not.null;
            expect(tab).has.property('element');
            expect(tab.element).is.instanceOf(Element);
            expect(
                require('grace/setup/setup_tab_host').DocsTab.indexOf('test')
            ).to.be.above(-1);
        });
        it('should set tab active', function () {
            require('grace/setup/setup_tab_host').setTab('test');
            expect(
                require('grace/setup/setup_tab_host').DocsTab.active
            ).to.equal('test');
        });
        it('should hide editor container when active', function () {
            expect(getEditor().container.style.display).to.equal('none');
            expect(tab.element.style.display).to.equal('block');
        });
        it('should show editor container when not active', function () {
            require('grace/setup/setup_tab_host').setTab(currentDoc);
            expect(getEditor().container.style.display).to.equal('block');
            expect(tab.element.style.display).to.equal('none');
        });
        it('should not remove element until the view is unmounted', function () {
            //Not a serious memory leak since destroyed editors are released from dom
            expect(tab.element.parentElement).to.equal(
                getEditor().container.parentElement
            );
        });
        it('should close the tab window', function () {
            require('grace/setup/setup_tab_host').setTab('test');
            TabWindow.closeTabWindow('test');
            expect(
                require('grace/setup/setup_tab_host').DocsTab.active
            ).to.not.equal('test');
            expect(tab.element.parentElement).to.be.null;
        });
    });
});