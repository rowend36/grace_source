_Define(function(global) {
    var AceInlineDiff;
    var DocsTab = global.DocsTab;
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Docs = global.Docs;
    var docs = global.docs;
    var Editors = global.Editors;
    var appConfig = global.appConfig;
    var hintDoc = global.DocsTab.$hintActiveDoc;
    var MainMenu = global.MainMenu;
    var Imports = global.Imports;
    var getActiveDoc = global.getActiveDoc;
    
    var doDiff = Imports.define(["./tools/diff/diff.css", "./tools/diff/ace-inline-diff.js"], function() {
        doDiff = doDiffLoaded;
        AceInlineDiff = global.AceInlineDiff;
        return doDiff;
    });

    var Storage = new global.DBStorage('diff');
    DocsTab.registerPopulator('d', {
        getName: function(id) {
            //should not be called since
            //do diff handles it
            var ev = Storage.getItem(id);
            return ev && Docs.getName(ev.docId);
        },
        getInfo: function(id) {
            var ev = Storage.getItem(id);
            return "<span class='red-text'>" + (ev.filepath.length < 15 ? ev.filepath : "..." + (ev.filepath.substring(ev.filepath.length - 15))) + "</span>" + "<span class='right green-text'>" + Docs.getName(ev.docId) + "</span>";
        },
        getAnnotations: Utils.noop
    });

    function safeGetPath(doc) {
        return doc.getSavePath() ? doc.getSavePath().substring(doc.getSavePath().lastIndexOf("/") + 1) : doc.id;
    }
    Storage.load(
        function(id, ev) {
            if (DocsTab.hasTab(id)) {
                var doc = docs[ev.docId];
                if (!doc) {
                    return Storage.removeItem(id);
                }
                if (ev.browser) {
                    ev = FileUtils.unfreezeEvent(ev);
                    FileUtils.getDocFromEvent(ev, function(res, err) {
                        if (err) {
                            console.error(err);
                            return Storage.removeItem(id);
                        }
                        doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, true);
                    }, true, true);
                } else if (ev.filepath == 'OLDEST') {

                    var newDoc = doc.fork(true);
                    newDoc.abortChanges();
                    res = newDoc.session;

                    doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, true);
                } else {
                    var server = doc.getFileServer();
                    var encoding = doc.getEncoding();
                    server.readFile(doc.getSavePath(), encoding, function(err, res) {
                        if (err) return Storage.removeItem(id);
                        doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, appConfig.currentTab == id);
                    });
                }
            } else {
                Storage.removeItem(id);
            }
        },
        function(id) {
            if (DocsTab.hasTab(id)) {
                DocsTab.removeTab(id);
            }
        });
    if (Storage.itemList.length)
        DocsTab.recreate();

    function doDiffLoaded(windowId, res, filepath, filename, doc, newWindow) {
        function close() {
            Storage.removeItem(windowId);
            differ.destroy();
            Editors.closeEditor(editor);
            if(typeof res!="string"){
                Docs.closeSession(session);//just in case
                res.destroy();
            }
        }
        var diffWindow = Editors.getEditorWindow(windowId, filename, null, close, doc.id || null);
        var c = diffWindow.onEnter;
        diffWindow.onEnter = function(host) {
            c(host);
            differ.startUpdate();
            differ.resize();
        };
        diffWindow.swapDoc = function(id, ev) {
            hintDoc(doc.id);
        };
        var b = diffWindow.onExit;
        diffWindow.onExit = function(host) {
            b(host);
            differ.stopUpdate();
        };
        var editor = diffWindow.editor;
        var session = doc.cloneSession();
        editor.setSession(session);
        var differ = AceInlineDiff.diff(editor, res, {
            editable: true,//!doc.isReadOnly(),
            autoupdate: newWindow,
            showInlineDiffs: true,
            onClick: res.getValue?'swap':'copy'
        });
        editor.execCommand("foldToLevel1");
        differ.goNextDiff(editor);
        if (newWindow)
            diffWindow.setActive();
    }
    var diskOption = {
        caption: 'Show diff from disk',
        onclick: function() {
            var doc = getActiveDoc();
            if (!doc) return;
            var server = doc.getFileServer();
            var encoding = doc.getEncoding();
            server.readFile(doc.getSavePath(), encoding, function(err, res) {
                if (err) return;
                var id = Utils.genID("d");
                Docs.tempSave(doc.id);
                Docs.persist();
                var ev = {
                    filepath: 'DISK',
                    docId: doc.id
                };
                Storage.createItem(id, ev);
                doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, true);
            }, true, true);
        }
    };
    var undoOption = {
        caption: 'Show changes since opened',
        onclick: function() {
            var doc = getActiveDoc();
            if (!doc) return;
            var newDoc = doc.fork(true);
            newDoc.abortChanges();
            res = newDoc.session;
            var id = Utils.genID("d");
            Docs.tempSave(doc.id);
            Docs.persist();
            var ev = {
                filepath: 'OLDEST',
                docId: doc.id
            };
            Storage.createItem(id, ev);
            doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, true);
        }
    };
    var fileOption = {
        caption: 'Show diff from file',
        onclick: function() {
            var doc = getActiveDoc();
            if (!doc) return;
            FileUtils.pickFile('Select File', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                FileUtils.getDocFromEvent(ev, function(res, err) {
                    if (err) return console.error(err);
                    var id = Utils.genID("d");
                    Docs.tempSave(doc.id);
                    Docs.persist();
                    ev = FileUtils.freezeEvent(ev);
                    ev.docId = doc.id;
                    Storage.createItem(id, ev);
                    doDiff(id, res, doc.getSavePath(), safeGetPath(doc), doc, true);
                }, true, true);
            });
        }
    };
    MainMenu.extendOption('diff', {
        icon: "swap_horiz",
        caption: "Diff",
        childHier: {
            "diff-disk": diskOption,
            "diff-file": fileOption,
            "diff-undo": undoOption
        }
    });
}) /*_EndDefine*/