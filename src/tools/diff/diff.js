_Define(function(global) {
    var AceInlineDiff, AceDiff;
    var DocsTab = global.DocsTab;
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Docs = global.Docs;
    var docs = global.docs;
    var FocusManager = global.FocusManager;
    var Editors = global.Editors;
    var MainMenu = global.MainMenu;
    var Imports = global.Imports;
    var getActiveDoc = global.getActiveDoc;
    var Splits = global.SplitManager;
    var ADD_TO_DIFF_MENU = 'inlinediff';
    var ON_CREATE_DIFF = 'diffs-';

    var diffInline = Imports.define(["./tools/diff/diff.css", "./tools/diff/ace-inline-diff.js"], function() {
        AceInlineDiff = global.AceInlineDiff;
    }, function doDiff(tabId, res, filename, doc, newWindow) {
        function close() {
            Storage.removeItem(tabId);
            differ.destroy();
            Editors.closeEditor(editor);
            Docs.closeSession(session); //just in case
            if (typeof res != "string") {
                res.destroy();
            }
        }
        if(Array.isArray(res))res = res[0];
        if (res.session) res = res.session;
        //editor.createeditor creates inside a container
        var editor = Editors.createEditor(new DocumentFragment(), true);
        editor.container.remove();
        var view = {
            element: editor.container,
            onEnter: function(host) {
                editor.renderer.unfreeze();
                //allow splits and shit
                editor.viewPager = host.viewPager;
                editor.hostEditor = host;
                Editors.$focusEditor(editor);
                differ.startUpdate();
                differ.resize();
            },
            onExit: function() {
                editor.viewPager = null;
                editor.renderer.freeze();
                differ.stopUpdate();
            }
        };

        Editors.getTabWindow(tabId, filename, null, close, newWindow ? doc.id ||
            undefined : undefined, view);
        var session = doc.cloneSession();
        editor.setSession(session);
        var differ = AceInlineDiff.diff(editor, res, {
            editable: true, //!doc.isReadOnly(),
            autoupdate: newWindow,
            showInlineDiffs: true,
            onClick: res.getValue ? 'swap' : 'copy'
        });
        editor.execCommand("foldToLevel1");
        differ.goNextDiff(editor);
        if (newWindow)
            view.setActive();
        else view.onExit();
    });
    var diff2 = Imports.define(["./ui/splits.js", "./tools/diff/diff.css", "./tools/diff/ace-diff3.js"],
        function() {
            AceDiff = global.AceDiff;
        },
        function doDiff2(tabId, res, filename, doc, newWindow) {
            function close() {
                differ.destroy();
                Storage.removeItem(tabId);
                editors.forEach(Editors.closeEditor);
                Docs.closeSession(session); //just in case
            }
            var isThree = false;
            if (!Array.isArray(res)) {
                res = [res];
            } else isThree = (res.length == 2);
            res = res.map(function(value) {
                //if given a editor or a doc
                return value.session || value;
            });
            var editors = [];
            var view = {
                element: document.createElement('div'),
                onEnter: function(host) {
                    editors.forEach(function(e) {
                        e.renderer.unfreeze();
                        e.hostEditor = host;
                    });
                    var active = differ.editors[differ.activePane].ace;
                    Editors.$focusEditor(active);
                    FocusManager.focusIfKeyboard(active.textInput.getElement());
                    //differ.startUpdate();
                    //differ.resize();
                },
                onExit: function() {
                    editors.forEach(function(e) {
                        e.renderer.freeze();
                        e.hostEditor = null;
                    });
                    //differ.stopUpdate();
                }
            };
            Editors.getTabWindow(tabId, filename, null, close, newWindow ? doc.id ||
                undefined : undefined, view);
            view.element.className = 'preview';
            //theirs|origin
            editors[0] = Editors.createEditor(view.element, true);
            //origin|ours
            editors[1] = Editors.createEditor(Splits.add($(editors[0].container), 'horizontal'), true);
            if (isThree) {
                //ours
                editors[2] = Editors.createEditor(Splits.add($(editors[1].container), 'horizontal'), true);
            }
            var session = doc.cloneSession();
            editors[isThree?2:1].setSession(session);
            res.forEach(function(value, i) {
                if (value.getValue) {
                    editors[i].setSession(value);
                } else {
                    editors[i].setValue(value||"");
                    editors[i].setReadOnly(true);
                }
            });
            var differ = new AceDiff({
                left: {
                    editor: editors[0],
                },
                right: {
                    editor: editors[isThree?2:1],
                    editable: true
                },
                center: isThree && {
                    editor: editors[1]
                },
                showConnectors: false,
                showCopyArrows: false,
                showInlineDiffs: true
            });
            if (newWindow)
                view.setActive();
            else view.onExit();
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
            return "<span class='red-text'>" + (ev.caption.length < 15 ? ev.caption : "..." + (ev
                    .caption.substring(ev.caption.length - 15))) + "</span>" +
                "<span class='right green-text'>" + Docs.getName(ev.docId) + "</span>";
        },
        getAnnotations: Utils.noop
    });

    Storage.load(
        function recoverDiff(tabId, info) {
            if (info.inline && DocsTab.isClosedTab(tabId)) {
                return Storage.removeItem(tabId);
            }
            var doc = docs[info.docId];
            if (!doc) {
                Storage.removeItem(tabId);
            } else {
                FileUtils.postChannel(ON_CREATE_DIFF + info.type, doc, info.data, function(res,
                    caption, data) {
                    if (res === null) {
                        return Storage.removeItem(tabId);
                    }
                    if (caption != info.caption || data != info.data) {
                        info.caption = caption;
                        info.data = data;
                        Storage.setItem(tabId, info, true);
                    }
                    (info.inline ?
                        diffInline : diff2)(tabId, res, safeGetPath(doc), doc, true);
                });
            }
        }
    );

    function safeGetPath(doc) {
        return doc.getSavePath() ? doc.getSavePath().substring(doc.getSavePath().lastIndexOf("/") + 1) : doc.id;
    }

    function onMenuClick(handlerID, getRes, isInline) {
        var doc = getActiveDoc();
        if (!doc) return;
        getRes(doc, null, function(res, caption, data) {
            if (res === null) return;
            var tabId = Utils.genID('d');
            Storage.createItem(tabId, {
                type: handlerID,
                caption: caption,
                data: data,
                docId: doc.id,
                inline: isInline
            });
            Docs.tempSave(doc.id);
            Docs.persist();
            (isInline ? diffInline : diff2)(tabId, res, safeGetPath(doc), doc, true);
        });
    }
    FileUtils.ownChannel(ADD_TO_DIFF_MENU, function(id, caption, getRes, update) {
        var data = {
            "!update": update && [].concat(update)
        };
        data[id+"-diffInline"] = {
            caption: "Inline diff from "+caption,
            onclick: onMenuClick.bind(null, id, getRes, true),
            sortIndex: 150,
        };
        data[id+"-diff2"] = {
            caption: "2-way diff from "+caption,
            onclick: onMenuClick.bind(null, id, getRes, !true)
        };
        FileUtils.ownChannel(ON_CREATE_DIFF + id, getRes);
        MainMenu.extendOption('diff', {
            icon: "swap_horiz",
            caption: "Diff",
            subTree: data
        });
    });
    FileUtils.postChannel(ADD_TO_DIFF_MENU, 'oldest', 'oldest state', function(doc, data, cb) {
        var newDoc = doc.fork(true);
        newDoc.abortChanges();
        cb(newDoc, 'OLDEST', null);
    });
    FileUtils.postChannel(ADD_TO_DIFF_MENU, '!disk', 'last save', function(doc, data, cb) {
        var server = doc.getFileServer();
        var encoding = doc.getEncoding();
        server.readFile(doc.getSavePath(), encoding, function(err, res) {
            if (err) return cb(null);
            cb(res, 'DISK', null);
        });
    }, [function(self, update) {
        var doc = getActiveDoc();
        return update("disk-diffInline", (!doc || doc.isTemp()) ? null : self["!disk-diffInline"]);
    }, function(self, update) {
        var doc = getActiveDoc();
        return update("disk-diff2", (!doc || doc.isTemp()) ? null : self["!disk-diff2"]);
    }]);
    FileUtils.postChannel(ADD_TO_DIFF_MENU, 'file', 'other file', function(doc, data, cb) {
        var saved;
        if (!data) {
            FileUtils.pickFile('Select File', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                saved = ev;
                FileUtils.getDocFromEvent(ev, load, true, true);

            });
        } else {
            saved = FileUtils.unfreezeEvent(data);
            FileUtils.getDocFromEvent(saved, load, true, true);
        }

        function load(res, err) {
            if (err) {
                cb(null);
                return console.error(err);
            }
            cb(res, 'DISK', data || FileUtils.freezeEvent(saved));
        }
    });

    FileUtils.ownChannel('create-diff-doc', function(type, doc, data, inline) {
        FileUtils.postChannel(ON_CREATE_DIFF + type, doc, data, function(views, caption, data) {
            var tabId = Utils.genID('d');
            if (doc) {
                Storage.createItem(tabId, {
                    type: type,
                    caption: caption,
                    data: data,
                    docId: doc.id,
                    inline: inline
                });
                Docs.tempSave(doc.id);
                Docs.persist();
            }
            (inline ? diffInline : diff2)(tabId, views, safeGetPath(doc), doc, true);
        });
    });
}); /*_EndDefine*/