define(function(require, exports, module) {
    var expect = require('chai').expect;
    var forEach = require("grace/core/utils").Utils.asyncForEach;
    var Editors = require("grace/editor/editors").Editors;
    var TabWindow = require("grace/ext/tab_window");
    var focusEditor = require("grace/editor/active_editor").focusEditor;

    describe("Current Editor vs Main Editor", function(done) {
        var numClones,
            pluginEditor,
            currentEditor,
            splitEditor,
            firstEditor,
            mainEditor;
        var tests = [{
                name: "set editor using $focusEditor",
                exec: function() {
                    focusEditor(firstEditor);
                    currentEditor = mainEditor =
                        firstEditor;
                }
            },
            {
                name: "set plugin editor while keeping main editor",
                exec: function() {
                    pluginEditor = currentEditor =
                        Editors.createEditor(
                            new DocumentFragment(),
                            true);
                    pluginEditor.id = 'plugin';
                    currentEditor.hostEditor =
                        mainEditor;
                    focusEditor(currentEditor);
                }
            },
            {
                name: "not do anything if already active",
                exec: function() {
                    currentEditor.$setActive();
                }
            },
            {
                name: "allow main editor to become active",
                exec: function() {
                    mainEditor.$setActive();
                    currentEditor = mainEditor;
                }
            },
            {
                name: "set editor when creating split",
                exec: function() {
                    mainEditor.execCommand('Add Split');
                    mainEditor = splitEditor =
                        currentEditor = require(
                            "grace/setup/setup_editors")
                        .getEditor();
                    splitEditor.id = 'split';
                    numClones++;
                }
            },
            {
                name: "remove split",
                exec: function() {
                    mainEditor.execCommand('Add Split');
                    var tempEdit = require(
                            "grace/setup/setup_editors")
                        .getEditor();
                    tempEdit.execCommand(
                        'Remove Split');
                    currentEditor = mainEditor =
                        firstEditor;
                }
            },
            {
                name: "set plugin editor and main editor using focus editor",
                exec: function() {
                    pluginEditor.$setActive();
                    mainEditor = firstEditor;
                    currentEditor = pluginEditor;
                }
            },
        ];
        var times = [500, 125, 30, 15, 0, 0];

        var doc = require("grace/docs/active_doc")
            .getActiveDoc();
        pluginEditor = currentEditor = splitEditor =
            mainEditor = undefined;
        numClones = doc.clones ? doc.clones.length : 0;
        firstEditor = require("grace/setup/setup_editors")
            .getMainEditor();
        firstEditor.id = 'main';
        expect(doc).to.not.be.null;

        forEach(times, function(time, i, next) {
            forEach(tests, function(test, i, next) {
                it("Time=" + time +
                    ", it should " + test
                    .name,
                    function(done) {
                        test.exec();
                        expect(
                                currentEditor
                                )
                            .to.equal(
                                require(
                                    "grace/setup/setup_editors"
                                )
                                .getEditor()
                            );
                        expect(mainEditor)
                            .to.equal(
                                require(
                                    "grace/setup/setup_editors"
                                )
                                .getMainEditor()
                            );
                        expect(doc.clones ?
                                doc.clones
                                .length : 0)
                            .to.equal(
                                numClones);
                        done();
                    });
                next();
            }, next);

        }, function() {
            it("should close all splits/clones",
                function() {
                    var a = require(
                        "grace/setup/setup_editors"
                    ).getMainEditor();
                    while (require(
                            "grace/ext/split_editors"
                        ).SplitEditors.isSplit(
                            a)) {
                        a.execCommand(
                            'Remove Split');
                        if (a == require(
                                "grace/setup/setup_editors"
                            ).getMainEditor()) {
                            throw "Wrror";
                        }
                        a = require(
                            "grace/setup/setup_editors"
                        ).getMainEditor();
                    }
                    expect(Editors.$allEditors
                            .length)
                        .to.equal(1);
                    numClones = doc.clones ? doc
                        .clones.length : 0;
                    expect(numClones).to.equal(0);
                });
        });

    });
    describe("TabWindow", function() {
        var tab;
        var currentDoc = require("grace/docs/active_doc")
            .getActiveDoc().id;
        it("should create a new tab window", function() {
            tab = TabWindow.getTabWindow("test",
                "Test window", "...testing");
            expect(tab).is.not.null;
            expect(tab).has.property('element');
            expect(tab.element).is.instanceOf(Element);
            expect(require("grace/setup/setup_tab_host")
                    .DocsTab.indexOf("test")).to.be
                .above(-1);
        });
        it("should set tab active", function() {
            require("grace/setup/setup_tab_host")
                .setTab("test");
            expect(require("grace/setup/setup_tab_host")
                .DocsTab.active).to.equal("test");
        });
        it("should hide editor container when active",
            function() {
                expect(require("grace/setup/setup_editors")
                    .getEditor().container.style.display
                ).to.equal("none");
                expect(tab.element.style.display).to.equal(
                    "block");
            });
        it("should show editor container when not active",
            function() {
                require("grace/setup/setup_tab_host")
                    .setTab(currentDoc);
                expect(require("grace/setup/setup_editors")
                    .getEditor().container.style.display
                ).to.equal("block");
                expect(tab.element.style.display).to.equal(
                    "none");
            });
        it("should not remove element until the view is unmounted",
            function() {
                //Not a serious memory leak since destroyed editors are released from dom
                expect(tab.element.parentElement).to.equal(
                    require("grace/setup/setup_editors")
                    .getEditor().container
                    .parentElement);
            });
        it("should close the tab window", function() {
            require("grace/setup/setup_tab_host")
                .setTab('test');
            TabWindow.closeTabWindow("test");
            expect(require("grace/setup/setup_tab_host")
                .DocsTab.active).to.not.equal(
                "test");
            expect(tab.element.parentElement).to.be
                .null;
        });
    });
});