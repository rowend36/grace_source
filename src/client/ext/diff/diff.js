define(function (require, exports, module) {
    'use strict';
    /* globals $ */
    var DocsTab = require('grace/setup/setup_tab_host').DocsTab;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var appEvents = require('grace/core/app_events').AppEvents;
    var Fileviews = require('grace/ext/fileview/fileviews').Fileviews;
    var Utils = require('grace/core/utils').Utils;
    var Docs = require('grace/docs/docs').Docs;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var Editors = require('grace/editor/editors').Editors;
    var getTabWindow = require('grace/ext/ui/tab_window').getTabWindow;
    var Actions = require('grace/core/actions').Actions;
    var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
    var setActiveEditor = require('grace/editor/host_editor').setActiveEditor;
    var Splits = require('grace/ui/split_manager').SplitManager;
    var DBStorage = require('grace/ext/storage/db_storage').DBStorage;
    require('grace/ext/fileview/setup_fileview');
    require('ace!line_widgets');
    var diffRef = Docs.getPersistentRef('diffs');
    //Pane/Document handling
    /**
     * @type {(e:any)=> e is Doc} isDoc
     */
    function isDoc(e) {
        return typeof e.getSavePath === 'function';
    }
    /**
     * Release references to a document so it can be garbaged.
     * @param {string} id
     * @param {string} tabId
     */
    function releaseDoc(id, tabId) {
        var a = registry[id];
        if (!a) return;
        Utils.removeFrom(a, tabId);
        if (/**@type string[] */ (registry[id]).length == 0) {
            registry[id] = undefined;
            Docs.get(id).unref(diffRef);
        }
    }
    /**
     * Acquire reference to a doc so it is not garbaged.
     * @param {string} id
     * @param {string} tabId
     */
    function keepDoc(id, tabId) {
        var a = registry[id];
        if (!a) a = registry[id] = [];
        else Utils.removeFrom(a, tabId);
        /**@type string[] */ (registry[id]).push(tabId);
        if (Storage.hasItem(tabId) && Docs.has(id)) {
            Docs.get(id).ref(diffRef);
        }
    }
    /**
     * @typedef {"ours"|"theirs"|"origin"} Side
     * @typedef {{[side in Side]?:string|Doc} & {[id:string]:Object}} Panes
     */
    /**
     * Destroy a diffView's data.
     * @param {Panes} panes
     * @param {string} tabId
     */
    function destroyTab(panes, tabId) {
        ['theirs', 'origin', 'ours'].forEach(function (i) {
            if (!panes[i]) return;
            if (isDoc(panes[i])) {
                Docs.closeSession(panes[panes[i].id]);
                panes[panes[i].id] = undefined;
                releaseDoc(panes[i].id, tabId);
            } else if (typeof panes[i] === 'object') {
                panes[i].destroy();
            }
        });
    }
    /**
     * Get the ids that are referenced by a diff view.
     * @param {Panes} panes
     */
    function getDocIds(panes) {
        return ['theirs', 'origin', 'ours']
            .map(function (e) {
                return (
                    panes[e] &&
                    isDoc(panes[e]) &&
                    Docs.has(panes[e].id) &&
                    panes[e].id
                );
            })
            .filter(Boolean);
    }
    /**
     * Get a session or string for the pane.
     * @param {Panes} panes
     * @param {Side} side
     */
    function getView(panes, side) {
        var pane = panes[side];
        if (isDoc(pane)) {
            return panes[pane.id] || (panes[pane.id] = pane.cloneSession(true));
        }
        return pane;
    }

    /**
     * @param {string} tabId
     * @param {Panes} panes
     * @param {boolean} asNewWindow
     */
    function doDiffInline(tabId, panes, asNewWindow) {
        require(['./libs/ace-inline-diff', 'css!./libs/ace-diff'], function (
            AceInlineDiff
        ) {
            function close() {
                if (Storage.hasItem(tabId)) Storage.removeItem(tabId);
                diffView.destroy();
                Editors.closeEditor(editor);
                destroyTab(panes, tabId);
            }
            //Editors.createeditor creates inside a container
            var editor = Editors.createEditor(new DocumentFragment(), true);
            editor.isDiffEditor = true;
            editor.container.remove();
            var view = {
                element: editor.container,
                onEnter: function (host) {
                    editor.renderer.unfreeze();
                    //allow splits and shit
                    editor.viewPager = host.viewPager;
                    editor.hostEditor = host;
                    setActiveEditor(editor);
                    FocusManager.focusIfKeyboard(editor.textInput.getElement());
                    diffView.startUpdate();
                    diffView.resize();
                },
                onExit: function () {
                    editor.viewPager = null;
                    editor.renderer.freeze();
                    diffView.stopUpdate();
                },
            };

            getTabWindow(tabId, null, null, close, asNewWindow, view);
            var diffView = AceInlineDiff.diff(
                editor,
                getView(panes, 'origin'),
                getView(panes, 'ours'),
                {
                    editable: true, //!doc.isReadOnly(),
                    showInlineDiffs: true,
                    onClick:
                        typeof getView(panes, 'origin') === 'string'
                            ? 'copy'
                            : 'swap',
                }
            );
            editor.execCommand('foldToLevel1');
            diffView.goNextDiff(editor);
            if (asNewWindow) {
                view.setActive();
            } else {
                view.onExit();
                DocsTab.updateActive();
            }
        });
    }

    /**
     * @param {string} tabId
     * @param {Panes} panes
     * @param {boolean} asNewWindow
     */
    function doDiff2(tabId, panes, asNewWindow) {
        require(['css!./libs/ace-diff', './libs/ace-diff'], function (
            css,
            AceDiff
        ) {
            /**@type {Array<Editor>}*/
            var editors = [];
            function close() {
                if (Storage.hasItem(tabId)) Storage.removeItem(tabId);
                diffView.destroy();
                editors.forEach(Editors.closeEditor);
                destroyTab(panes, tabId);
            }

            var view = {
                element: document.createElement('div'),
                onEnter: function (host) {
                    editors.forEach(function (e) {
                        e.renderer.unfreeze();
                        e.hostEditor = host;
                    });
                    var active = diffView.getEditors()[diffView.activePane];
                    setActiveEditor(active);
                    FocusManager.focusIfKeyboard(active.textInput.getElement());
                    //diffView.startUpdate();
                    //diffView.resize();
                },
                onExit: function () {
                    editors.forEach(function (e) {
                        e.renderer.freeze();
                        e.hostEditor = null;
                    });
                    //diffView.stopUpdate();
                },
            };
            getTabWindow(tabId, null, null, close, asNewWindow, view);
            view.element.className = 'tab-window';
            /** @type Array<Side> tabs */
            var tabs = ['origin', 'ours'];
            if (panes.theirs) tabs.unshift('theirs');

            tabs.forEach(function (e, i) {
                var editor = Editors.createEditor(
                    i == 0
                        ? view.element
                        : Splits.add($(editors[i - 1].container), 'horizontal')
                );
                editor.isDiffEditor = true;
                var value = getView(panes, e);
                if (value.getValue) {
                    editor.setSession(value);
                } else {
                    editor.setValue(value);
                    editor.setReadOnly(true);
                }
                editors[i] = editor;
            });
            var diffView = new AceDiff({
                left: {
                    editor: editors[0],
                },
                right: {
                    editor: editors[2] || editors[1],
                },
                center: editors[2] && {
                    editor: editors[1],
                },
                showConnectors: false,
                showCopyArrows: false,
                showInlineDiffs: true,
            });
            if (asNewWindow) {
                view.setActive();
            } else {
                view.onExit();
                DocsTab.updateActive();
            }
        });
    }
    /**
     * @typedef DiffItem
     * @property {string} type
     * @property {string} caption
     * @property {any} data
     * @property {string[]} ids
     * @property {boolean} useInlineDiff
     */
    /**
     * Get the name of a diff view from the item
     * @param {DiffItem} item
     * @returns {string}
     */
    function getItemName(item) {
        /** @type {Doc}*/
        var doc = Docs.get(item.ids[item.ids.length - 1]);
        var path;

        return doc
            ? (path = doc.getSavePath())
                ? FileUtils.filename(path)
                : doc.id
            : item.caption;
    }
    /**
     * @param {string} type
     * @param {any} data
     * @param {boolean} useInlineDiff
     */
    function createDiffView(type, data, useInlineDiff) {
        var tabId = Utils.genID('d');
        FileUtils.postChannel(
            'diffs-' + type,
            data,
            function (panes, caption, data) {
                if (!panes) return;
                Utils.assert(data, 'Failed to provide persistence data.');
                Storage.createItem(tabId, {
                    type: type,
                    caption: caption,
                    data: data,
                    ids: getDocIds(panes),
                    useInlineDiff: useInlineDiff,
                });

                getDocIds(panes).forEach(function (e) {
                    keepDoc(e, tabId);
                });
                (useInlineDiff ? doDiffInline : doDiff2)(tabId, panes, true);
            }
        );
        return tabId;
    }
    /**
     * @param {string} tabId
     * @param {DiffItem} item
     */
    function loadDiffView(tabId, item) {
        FileUtils.postChannel(
            'diffs-' + item.type,
            item.data,
            function (res, caption, data) {
                var removed = !res
                    ? item.ids
                    : item.ids.filter(Utils.notIn(getDocIds(res)));
                removed.forEach(function (e) {
                    releaseDoc(e, tabId);
                });
                if (res === null) {
                    return Storage.removeItem(tabId);
                }
                if (caption != item.caption || data != item.data) {
                    if (!data) throw new Error('Failed to provide data!!!');
                    item.caption = caption;
                    item.data = data;
                    Storage.setItem(tabId, item);
                }
                (item.useInlineDiff ? doDiffInline : doDiff2)(
                    tabId,
                    res,
                    false
                );
            }
        );
    }
    /**
     * @typedef {(data:any,cb:(res:Panes|null,caption?:string,data?:any)=>void)=>void}  DiffFactory
     * @param {string} name
     * @param {DiffFactory} onLoadDiff
     */
    function registerDiffFactory(name, onLoadDiff) {
        FileUtils.ownChannel('diffs-' + name, onLoadDiff);
    }

    var onMenuClick = function () {
        var doc = getActiveDoc();
        if (!doc) return;
        createDiffView(this.type, doc, this.useInlineDiff);
    };

    Actions.addAction({
        icon: 'swap_horiz',
        caption: 'Diff',
        subTree: {},
    });
    /**
     * @param {string} id
     * @param {string} caption
     * @param {DiffFactory} getRes
     * @param {()=>boolean} [isAvailable]
     */
    function addToDiffMenu(id, caption, getRes, isAvailable) {
        registerDiffFactory(id, getRes);
        Actions.addActions(
            [
                {
                    name: 'inlineDiff-' + id,
                    type: id,
                    caption: 'Inline diff from ' + caption,
                    handle: onMenuClick,
                    useInlineDiff: true,
                    sortIndex: 1000,
                },
                {
                    name: 'diff-' + id,
                    type: id,
                    caption: '2-way diff from ' + caption,
                    handle: onMenuClick,
                },
            ],
            {
                '!update':
                    isAvailable &&
                    function (self, update) {
                        update(this.name, isAvailable() ? this : null);
                    },
                showIn: 'actionbar.diff',
            }
        );
    }

    //Diff from oldest state
    addToDiffMenu('oldest', 'oldest state', function (data, cb) {
        var doc = typeof data == 'string' ? Docs.get(data) : data;
        if (!doc) return cb(null);
        var newDoc = doc.fork(true);
        newDoc.abortChanges();
        cb({origin: newDoc, ours: doc}, 'OLDEST', doc.id);
    });

    //Diff from last save
    addToDiffMenu(
        'disk',
        'last save',
        function (data, cb) {
            var doc = typeof data == 'string' ? Docs.get(data) : data;
            if (!doc) return cb(null);
            var server = doc.getFileServer();
            var encoding = doc.getEncoding();
            server.readFile(doc.getSavePath(), encoding, function (err, res) {
                if (err) return cb(null);
                cb({origin: res, ours: doc}, 'DISK', doc.id);
            });
        },
        function () {
            return getActiveDoc() && !getActiveDoc().isTemp();
        }
    );

    //Diff from another file
    addToDiffMenu('file', 'other file', function (data, cb) {
        var frozenEvent;
        var doc = data.getValue ? data : Docs.get(data.doc);
        if (!doc) return cb(null);
        if (data !== doc) frozenEvent = data;
        if (!frozenEvent) {
            Fileviews.pickFile('Select File', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                frozenEvent = Fileviews.freezeEvent(ev);
                frozenEvent.doc = doc.id;
                FileUtils.getDocFromEvent(ev, load, true, true);
            });
        } else {
            var ev = Fileviews.unfreezeEvent(frozenEvent);
            FileUtils.getDocFromEvent(ev, load, true, true);
        }

        function load(err, res) {
            if (err) {
                console.error(err);
                return cb(null);
            }
            cb({origin: res, ours: doc}, 'DISK', frozenEvent);
        }
    });
    /**
     * @type {{
         getItem: (id:string)=>DiffItem,
         createItem: (id:string,item:DiffItem)=>void,
         setItem: (id:string,item:DiffItem)=>void
         hasItem: (id:string)=>boolean,
         removeItem: (id:string)=>void,
         load: any
     }} Storage
     */
    var Storage = new DBStorage('diff');

    /** @type {Record<string,string[]|undefined>} registry*/
    var registry = Object.create(null);
    DocsTab.registerPopulator('d', {
        getName: function (id) {
            var item = Storage.getItem(id);
            return item && getItemName(item);
        },
        canDiscard: function (id) {
            for (var i in registry) {
                var waiting = registry[i];
                if (waiting && waiting.indexOf(id) > -1) return false;
            }
            return true;
        },
        getInfo: function (id) {
            var item = Storage.getItem(id);
            return (
                "<span class='dot red'></span><b>" +
                (item.caption.length < 15
                    ? item.caption
                    : '...' +
                      item.caption.substring(item.caption.length - 15)) +
                '</b><span class="right">' +
                '<b>' +
                getItemName(item) +
                '</b><span class="dot green"><span></span>'
            );
        },
        getAnnotations: Utils.noop,
    });

    Storage.load(
        function onLoadItem(tabId, item) {
            var discard = item.ids.some(function (e) {
                if (!Docs.has(e) && Docs.canDiscard(e)) return true;
            });
            if (discard) return Storage.removeItem(tabId);
            var waiting = item.ids.filter(function (id) {
                keepDoc(id, tabId);
                return !Docs.has(id);
            });
            if (waiting.length < 1) loadDiffView(tabId, item);
        },
        null, //on lost item - Docs cleanup after themselves without refs
        null, //on no item, nothing to do.
        DocsTab.recreate.bind(DocsTab)
    );
    appEvents.on('loadDoc', function (e) {
        var waitingTabs = registry[e.doc.id];
        if (!waitingTabs) return;
        e.doc.ref(diffRef);
        waitingTabs.forEach(function (tabId) {
            var item = Storage.getItem(tabId);
            if (item.ids.filter(Docs.has).length === item.ids.length)
                loadDiffView(tabId, item);
        });
    });
    appEvents.on('documentsLoaded', function () {
        //Cleanup
        var removedTabs = [];
        for (var i in registry) {
            var waitingTabs = registry[i];
            if (waitingTabs && !Docs.has(i) && Docs.canDiscard(i)) {
                registry[i] = undefined;
                waitingTabs.forEach(function (tabId) {
                    if (Storage.hasItem(tabId)) {
                        removedTabs.push(tabId);
                        Storage.removeItem(tabId);
                    }
                });
            }
        }
        if (removedTabs.length > 0) {
            for (i in registry) {
                for (var j = 0; j < removedTabs.length && Docs.has(i); j++) {
                    releaseDoc(i, removedTabs[j]);
                }
            }
            DocsTab.recreate();
        }
    });
    exports.registerDiffFactory = registerDiffFactory;
    exports.addToDiffMenu = addToDiffMenu;
    exports.createDiffView = createDiffView;
}); /*_EndDefine*/