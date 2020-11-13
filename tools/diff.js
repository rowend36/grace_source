(function(global) {
    var AceInlineDiff = global.AceInlineDiff;
    var DocsTab = global.DocsTab;
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Storage = new global.DBStorage('diff');
    var Doc = global.Doc;
    var docs = global.docs;
    var Editors = global.Editors;
    var appConfig = global.appConfig;
    var hintDoc = global.DocsTab.$hintActiveDoc;
    var MainMenu = global.MainMenu;
    DocsTab.registerPopulator('d', {
        getName: function(id) {
            return Storage.getItem(id) && Storage.getItem(id).filename;
        },
        getInfo: function(id) {
            return Storage.getItem(id).filepath;
        },
        getAnnotations: function() {}
    });
    Storage.load(
        function(id, ev) {
            if (DocsTab.hasTab(id)) {
                var doc = docs[ev.id];
                if (!doc) {
                    return Storage.removeItem(id);
                }
                var server = doc.getFileServer();
                var encoding = doc.getEncoding();
                server.readFile(doc.getSavePath(), encoding, function(err, res) {
                    if (err) return Storage.removeItem(id);
                    doDiff(id, res, doc.getSavePath(), doc.getSavePath().substring(doc.getSavePath().lastIndexOf("/") + 1), doc, appConfig.currentDoc == id);
                });
            }
            else {
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

    function doDiff(windowId, res, filepath, filename, doc, newWindow) {
        function close() {
            Storage.removeItem(windowId);
            differ.destroy();
            Doc.closeSession(session);
            editor.setSession(null);
            Editors.closeEditor(editor);
        }
        //this window will never close
        var diffWindow = Editors.getEditorWindow(windowId, filename, null, close);
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
            editable: true || doc.isReadOnly(),
            autoupdate: newWindow,
        });
        editor.session.foldAll();
        if (newWindow)
            diffWindow.setActive();
    }
    var diffOption = {
        caption: 'Show changes from disk',
        onclick: function() {
            var doc = docs[appConfig.currentDoc];
            if (!doc) return;
            var server = doc.getFileServer();
            var encoding = doc.getEncoding();
            server.readFile(doc.getSavePath(), encoding, function(err, res) {
                if (err) return;
                var id = Utils.genID("d");
                Doc.tempSave(doc.id);
                Doc.persist();
                var ev = {
                    id: doc.id
                };
                Storage.createItem(id, ev);
                doDiff(id, res, doc.getSavePath(), doc.getSavePath().substring(doc.getSavePath().lastIndexOf("/") + 1), doc, true);
            }, true, true);
        }
    };
    MainMenu.addOption('diff-doc', diffOption);
})(Modules);