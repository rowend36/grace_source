define(function (require, exports, module) {
    /*globals $*/
    var DocsTab = require('grace/setup/setup_tab_host').DocsTab;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var appEvents = require('grace/core/app_events').AppEvents;
    var Fileviews = require('grace/ext/fileview/fileviews').Fileviews;
    var Utils = require('grace/core/utils').Utils;
    var Docs = require('grace/docs/docs').Docs;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var Editors = require('grace/editor/editors').Editors;
    var getTabWindow = require('grace/ext/ui/tab_window').getTabWindow;
    var MainMenu = require('grace/setup/setup_main_menu').MainMenu;
    var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
    var focusEditor = require('grace/editor/host_editor').focusEditor;
    var Splits = require('grace/ui/split_manager').SplitManager;
    var DBStorage = require('grace/ext/storage/databasestorage').DBStorage;
    require('grace/ext/fileview/setup_fileview');

    var diffRef = Docs.getPersistentRef('diffs');

    function doDiffInline(tabId, data, filename, doc, newWindow) {
        doc.ref(diffRef);
        require(['css!./libs/diff', './libs/ace-inline-diff'], function (
            css,
            AceInlineDiff
        ) {
            function close() {
                Storage.removeItem(tabId);
                differ.destroy();
                Editors.closeEditor(editor);
                Docs.closeSession(session);
                doc.unref(diffRef);
                if (typeof data != 'string') {
                    data.destroy();
                }
            }
            if (Array.isArray(data)) data = data[0];
            if (data.session) data = data.session;
            //editor.createeditor creates inside a container
            var editor = Editors.createEditor(new DocumentFragment(), true);
            editor.container.remove();
            var view = {
                element: editor.container,
                onEnter: function (host) {
                    editor.renderer.unfreeze();
                    //allow splits and shit
                    editor.viewPager = host.viewPager;
                    editor.hostEditor = host;
                    focusEditor(editor);
                    differ.startUpdate();
                    differ.resize();
                },
                onExit: function () {
                    editor.viewPager = null;
                    editor.renderer.freeze();
                    differ.stopUpdate();
                },
            };

            getTabWindow(
                tabId,
                filename,
                null,
                close,
                newWindow ? doc.id || undefined : undefined,
                view
            );
            var session = doc.cloneSession();
            editor.setSession(session);
            editor.isDiffEditor = true;
            var differ = AceInlineDiff.diff(editor, data, {
                editable: true, //!doc.isReadOnly(),
                showInlineDiffs: true,
                onClick: data.getValue ? 'swap' : 'copy',
            });
            editor.execCommand('foldToLevel1');
            differ.goNextDiff(editor);
            if (newWindow) view.setActive();
            else view.onExit();
        });
    }

    function doDiff2(tabId, data, filename, doc, newWindow) {
        doc.ref(diffRef);
        require(['css!./libs/diff', './libs/ace-diff3'], function (css, AceDiff) {
            function close() {
                Storage.removeItem(tabId);
                differ.destroy();
                editors.forEach(Editors.closeEditor);
                Docs.closeSession(session); //just in case
                doc.unref(diffRef);
            }
            var isThree = false;
            if (!Array.isArray(data)) {
                data = [data];
            } else isThree = data.length == 2;
            data = data.map(function (value) {
                //if given a editor or a doc
                return value.session || value;
            });
            var editors = [];
            var view = {
                element: document.createElement('div'),
                onEnter: function (host) {
                    editors.forEach(function (e) {
                        e.renderer.unfreeze();
                        e.hostEditor = host;
                    });
                    var active = differ.editors[differ.activePane].ace;
                    focusEditor(active);
                    FocusManager.focusIfKeyboard(active.textInput.getElement());
                    //differ.startUpdate();
                    //differ.resize();
                },
                onExit: function () {
                    editors.forEach(function (e) {
                        e.renderer.freeze();
                        e.hostEditor = null;
                    });
                    //differ.stopUpdate();
                },
            };
            getTabWindow(
                tabId,
                filename,
                null,
                close,
                newWindow ? doc.id || undefined : undefined,
                view
            );
            view.element.className = 'tab-window';
            //theirs|origin
            editors[0] = Editors.createEditor(view.element, true);
            //origin|ours
            editors[1] = Editors.createEditor(
                Splits.add($(editors[0].container), 'horizontal'),
                true
            );
            if (isThree) {
                //ours
                editors[2] = Editors.createEditor(
                    Splits.add($(editors[1].container), 'horizontal'),
                    true
                );
            }
            var session = doc.cloneSession();
            editors[isThree ? 2 : 1].setSession(session);
            data.forEach(function (value, i) {
                if (value.getValue) {
                    editors[i].setSession(value);
                } else {
                    editors[i].setValue(value || '');
                    editors[i].setReadOnly(true);
                }
            });
            editors.forEach(function(e){
               e.isDiffEditor = true; 
            });
            var differ = new AceDiff({
                left: {
                    editor: editors[0],
                },
                right: {
                    editor: editors[isThree ? 2 : 1],
                    editable: true,
                },
                center: isThree && {
                    editor: editors[1],
                },
                showConnectors: false,
                showCopyArrows: false,
                showInlineDiffs: true,
            });
            if (newWindow) view.setActive();
            else view.onExit();
        });
    }

    var DIFF_FACTORY = 'diffs-';

    function safeGetName(doc) {
        return doc.getSavePath()
            ? FileUtils.filename(doc.getSavePath())
            : doc.id;
    }
    function createDiffView(type, doc, data, inline) {
        FileUtils.postChannel(
            DIFF_FACTORY + type,
            doc,
            data,
            function (views, caption, data) {
                var tabId = Utils.genID('d');
                if (doc) {
                    Storage.createItem(tabId, {
                        type: type,
                        caption: caption,
                        data: data,
                        docId: doc.id,
                        inline: inline,
                    });
                }
                (inline ? doDiffInline : doDiff2)(
                    tabId,
                    views,
                    safeGetName(doc),
                    doc,
                    true
                );
            }
        );
    }
    function loadDiffView(tabId, info) {
        var doc = Docs.get(info.docId);
        doc.ref(diffRef); //do this early before the document is destroyed
        FileUtils.postChannel(
            DIFF_FACTORY + info.type,
            doc,
            info.data,
            function (res, caption, data) {
                if (res === null) {
                    doc.unref(diffRef);
                    return Storage.removeItem(tabId);
                }
                if (caption != info.caption || data != info.data) {
                    info.caption = caption;
                    info.data = data;
                    Storage.setItem(tabId, info, true);
                }
                (info.inline ? doDiffInline : doDiff2)(
                    tabId,
                    res,
                    safeGetName(doc),
                    doc,
                    false
                );
            }
        );
    }
    function onMenuClick(handlerID, isInline) {
        var doc = getActiveDoc();
        if (!doc) return;
        createDiffView(handlerID, doc, null, isInline);
    }
    function addToDiffMenu(id, caption, getRes, update) {
        var data = {
            '!update': update && [].concat(update),
        };
        data[id + '-diffInline'] = {
            caption: 'Inline diff from ' + caption,
            onclick: onMenuClick.bind(null, id, true),
            sortIndex: 150,
        };
        data[id + '-diff2'] = {
            caption: '2-way diff from ' + caption,
            onclick: onMenuClick.bind(null, id, !true),
        };
        registerDiffFactory(id, getRes);
        MainMenu.extendOption('diff', {
            icon: 'swap_horiz',
            caption: 'Diff',
            subTree: data,
        });
    }
    function registerDiffFactory(name, onLoadDiff) {
        FileUtils.ownChannel(DIFF_FACTORY + name, onLoadDiff);
    }

    //Diff from oldest state
    addToDiffMenu('oldest', 'oldest state', function (doc, data, cb) {
        var newDoc = doc.fork(true);
        newDoc.abortChanges();
        cb(newDoc, 'OLDEST', null);
    });

    //Diff from last save
    addToDiffMenu(
        '!disk',
        'last save',
        function (doc, data, cb) {
            var server = doc.getFileServer();
            var encoding = doc.getEncoding();
            server.readFile(doc.getSavePath(), encoding, function (err, res) {
                if (err) return cb(null);
                cb(res, 'DISK', null);
            });
        },
        [
            function (self, update) {
                var doc = getActiveDoc();
                return update(
                    'disk-diffInline',
                    !doc || doc.isTemp() ? null : self['!disk-diffInline']
                );
            },
            function (self, update) {
                var doc = getActiveDoc();
                return update(
                    'disk-diff2',
                    !doc || doc.isTemp() ? null : self['!disk-diff2']
                );
            },
        ]
    );

    //Diff from another file
    addToDiffMenu('file', 'other file', function (doc, data, cb) {
        var saved;
        if (!data) {
            Fileviews.pickFile('Select File', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                saved = ev;
                FileUtils.getDocFromEvent(ev, load, true, true);
            });
        } else {
            saved = Fileviews.unfreezeEvent(data);
            FileUtils.getDocFromEvent(saved, load, true, true);
        }

        function load(res, err) {
            if (err) {
                cb(null);
                return console.error(err);
            }
            cb(res, 'DISK', data || Fileviews.freezeEvent(saved));
        }
    });
    var Storage = new DBStorage('diff');

    var pending = {};
    DocsTab.registerPopulator('d', {
        getName: function (id) {
            //should not be called since
            //we provide name in getTabWindow
            var data = Storage.getItem(id);
            return data && Docs.getName(data.docId);
        },
        canDiscard: function (id) {
            return !pending[id];
        },
        getInfo: function (id) {
            var data = Storage.getItem(id);
            return (
                "<span class='red-text'>" +
                (data.caption.length < 15
                    ? data.caption
                    : '...' +
                      data.caption.substring(data.caption.length - 15)) +
                '</span>' +
                "<span class='right green-text'>" +
                Docs.getName(data.docId) +
                '</span>'
            );
        },
        getAnnotations: Utils.noop,
    });

    Storage.load(
        function onLoadItem(tabId, info) {
            if (Docs.has(info.docId)) {
                loadDiffView(tabId, info);
            } else if (Docs.canDiscard(info.docId)) {
                Storage.removeItem(tabId);
            } else pending[info.docId] = tabId;
        },
        null, //on lost item - Docs cleanup after themselves
        null, //on no item
        DocsTab.recreate.bind(DocsTab)
    );
    appEvents.on('loadDoc', function (e) {
        if (pending[e.doc.id]) {
            var data = Storage.getItem(pending[e.doc.id]);
            pending[e.doc.id] = false;
            loadDiffView(pending[e.doc.id], data);
        }
    });

    exports.registerDiffFactory = registerDiffFactory;
    exports.addToDiffMenu = addToDiffMenu;
    exports.createDiffView = createDiffView;
}); /*_EndDefine*/