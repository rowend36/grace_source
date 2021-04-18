_Define(function(global) {
    "use strict";


    //todo replace confirm with Notify ask
    var appConfig = global.registerAll({
        "allowAutoSave": false,
        "stashExpiryTime": "1day",
        "keepDocumentsOnClose": true,
        "maxStoreSize": Env.isWebView ? "50mb" : "5mb",
        "maxDocCacheSize": "20kb",
        "maxDocDataSize": "2mb",
        "maxUndoHistory": "Infinity",
        "clearCache": false,
        "autosaveInterval": "1min"
    }, "documents");
    global.registerValues({
        "clearCache": "Set to true to clear all cached content",
        "allowAutoSave": "Enable autosave once a document has been saved once",
        "stashExpiryTime": "If keepDocumentsOnClose is enabled, this specifies how long they should be kept",
        "keepDocumentsOnClose": "Allows the editor to save your undo history when a document is closed",
        "maxStoreSize": "Configures how much storage can be used in total for storing documents",
        "maxDocCacheSize": "The maximum size of documents that must be cached for later opening. Useful if using a network file server",
        "maxDocDataSize": "The maximum size of data that should be stored for a single document",
        "maxUndoHistory": "Deprecated: use maxDocDataSize"
    }, "documents");
    var configEvents = global.configEvents;
    configEvents.on("documents", function(ev) {
        switch (ev.config) {
            case "clearCache":
                if (ev.newValue === true)
                    maxStoreSize = 0;
                Docs.cleanBlobs(true);
                ev.preventDefault();
                Notify.info("Cache cleared");
                /*fall through*/
            case "maxStoreSize":
            case "maxDocDataSize":
            case "maxDocCacheSize":
                updateSizes();
                break;
            case "autosaveInterval":
                autoSave = Utils.delay(Docs.saveDocs, Math.max(Utils.parseTime(appConfig.autosaveInterval), 5000));
        }
    });
    var appStorage = global.appStorage;
    var getObj = global.getObj;
    var putObj = global.putObj;
    var modelist = global.modelist;
    var lastRun = appConfig.lastRun;
    var docs = {};
    var app = global.AppEvents;
    var EditSession = global.EditSession;
    var Range = global.Range;
    var FileUtils = global.FileUtils;
    var Notify = global.Notify;
    var Utils = global.Utils;
    var Breaks = global.Recovery;
    var Tabs;
    var State = global.State;
    //priority for content for recovering session
    var CONTENT_PRIORITY = 10;
    //priority for closed docs
    var STASH_PRIORITY = 5;
    var maxDocCacheSize, maxDocDataSize, maxStoreSize;

    function updateSizes() {
        maxStoreSize = Math.max(500000, Utils.parseSize(appConfig.maxStoreSize));
        maxDocCacheSize = Math.min(maxStoreSize / 10, Math.max(5000, Utils.parseSize(appConfig.maxDocCacheSize)));
        maxDocDataSize = Math.min(maxStoreSize, Math.max(100000, Utils.parseSize(appConfig.maxDocDataSize)));
    }
    updateSizes();

    function invalid(deltas) {
        var uniq = {};
        for (var i = deltas.length; i-- > 0;) {
            var d = deltas[i][0];
            if (!d) return [i, 'Empty delta'];
            if (uniq[d.id]) return [i, 'Duplicate id ' + d.id];
            else uniq[d.id] = true;
        }
        return false;
    }

    function updateContentFromUndos(session, undoManager, revision) {
        var diff, delta, i;
        var stack = undoManager.$undoStack;
        if (invalid(stack)) return false;
        if (revision === 0) diff = stack;
        else
            for (i = stack.length; i--;) {
                delta = stack[i][0];
                if (delta.id == revision) {
                    diff = stack.slice(i + 1);
                    break;
                } else if (delta.id < revision) {
                    break;
                }
            }
        if (diff) {
            diff.forEach(function(deltaSet) {
                session.redoChanges(deltaSet, true);
            });
            return true;
        }
        stack = undoManager.$redoStack;
        if (invalid(stack)) return false;
        for (i = stack.length; i--;) {
            delta = stack[i][0];
            if (delta.id == revision) {
                diff = stack.slice(i);
                break;
            } else if (delta.id > revision) {
                break;
            }
        }
        if (diff) {
            diff.forEach(function(deltaSet) {
                session.undoChanges(deltaSet, true);
            });
            return true;
        }
        return false;
    }


    var historySaver = {
        save: function(doc) {
            var obj = doc.serialize();
            if (doc.isTemp() || doc.getSize() < maxDocCacheSize)
                return obj;

            obj.checksum = doc.getChecksum(obj.content);
            var res = obj.content;
            obj.content = "";
            //Try saving documents content
            if (res.length < maxDocDataSize / 2) {
                var lastSave = Docs.hasBlob(doc.id, "content");
                if (lastSave) {
                    var a = blobRegistry[lastSave];
                    if (20 > Math.abs(a.rev - doc.getRevision())) return obj;
                }
                Docs.saveBlob(doc.id, "content", res, CONTENT_PRIORITY, {
                    rev: doc.getRevision()
                });
            }
            return obj;
        },
        load: function(doc, obj) {
            if (!obj.checksum) return doc.unserialize(obj);
            doc.unserialize(obj);
            delete obj.history;
            doc.savedState = obj;
            doc.savedUndos = doc.session.$undoManager;
            doc.session.setUndoManager(null);

            var contentKey = Docs.hasBlob(doc.id, "content");
            if (contentKey) {
                var res = Docs.restoreBlob(contentKey);
                if (res !== undefined) {
                    var rev = blobRegistry[contentKey].rev;
                    doc.$fromSerial = true;
                    if (historySaver.$update(doc, res, rev)) {
                        delete doc.savedUndos;
                        delete doc.savedState;
                        doc.$fromSerial = false;
                        return;
                    }
                    doc.$fromSerial = false;
                }
            }
            doc.$needsRecoveryFromRefresh = true;
        },
        $update: function(doc, res, revision) {
            doc.setValue(res);
            var status = true;
            try {
                status = updateContentFromUndos(doc.session, doc.savedUndos, revision) || undefined;
            } catch (e) {
                doc.clearHistory();
                status = false;
            }
            if (doc.getChecksum() !== doc.savedState.checksum) {
                status = null;
            }
            var state = doc.savedState;
            doc.session.selection.fromJSON(state.selection);
            doc.session.setScrollTop(state.scrollTop);
            doc.session.setScrollLeft(state.scrollLeft);
            if (status) {
                doc.session.setUndoManager(doc.savedUndos);
                state.folds.forEach(function(fold) {
                    doc.session.addFold(fold.placeholder, Range.fromPoints(fold.start, fold.end));
                });
            }
            return status;
        },
        refresh: function(doc, res) {
            var INCORRECT = null;
            var FAILURE;
            var SUCCESS = true;
            var ERROR = false;
            /*if (doc.getSize()) {
                console.error(new Error("Error: Unrefreshed doc modified"));
                //_LSC && lastSave are invalidated
            }*/
            //doc has not changed since last save
            //undos can be reused
            if (doc.isLastSavedValue(res)) {
                doc.$fromSerial = true;
                var result = historySaver.$update(doc, res, doc.lastSave);
                switch (result) {
                    case ERROR:
                        Notify.error('Error Loading ' + doc.getPath());
                        /*fall through*/
                    case INCORRECT:
                        doc.setValue(res, true);
                        break;
                    case SUCCESS:
                        doc.dirty = (doc.getRevision() != doc.lastSave);
                        break;
                    default:
                        doc.setClean();
                }
                doc.$fromSerial = false;
            } else {
                doc.setValue(res, true);
            }
            delete doc.$needsRecoveryFromRefresh;
            delete doc.savedState;
            delete doc.savedUndos;
        },
        canRecover: function(id) {
            var contentKey = Docs.hasBlob(id, "content");
            var content = Docs.restoreBlob(contentKey);
            if (content && content.length) {
                return true;
            }
        },
        recover: function(id, doc) {
            var contentKey = Docs.hasBlob(id, "content");
            var content = Docs.restoreBlob(contentKey);
            if (content && content.length) {
                doc.setValue(content);
            }
        }
    };
    var defaultSaver = {
        save: function(doc) {
            return doc.serialize();
        },
        load: function(doc, obj) {
            doc.unserialize(obj);
        },
        refresh: function(doc, res) {
            doc.setValue(res, true);
            delete doc.$needsRecoveryFromRefresh;
        },
        canRecover: Utils.noop
    };
    var contentLoader = historySaver;

    function Doc(content, path, mode, id, orphan, data) {
        Object.assign(this, data);
        if (id) {
            this.id = id;
        } else {
            this.id = Utils.genID("m");
        }
        if (id && docs[id]) {
            console.error("Creating doc with existing id");
            closeDoc(id);
        }
        this.setPath(path);
        var session = this.session = new EditSession(content || "", mode);
        if (orphan) {
            this.orphan = orphan;
        } else docs[this.id] = this;
        this.session.setOptions(Docs.$defaults);
        //needs saving
        this.dirty = false;
        //needs caching
        this.safe = false;
        this.options = {};
    }

    //a unique path for all opened docs
    //uses shadowDoc for duplicates
    //there is usually no reason to change this
    //code and it may be inlined in future
    Doc.prototype.getPath = function() {
        return (this.shadowDoc ? this.path + "~~" + this.shadowDoc : this.path);
    };
    Doc.prototype.setPath = function(path) {
        if (!path) {
            this.path = "temp:///" + this.id.substring(0);
            this.dirty = true;
            return;
        }
        path = FileUtils.normalize(path);
        if (path == this.path) return;
        //shadow docs,
        //ensure getpath is unique
        //save file to update shadowDoc value
        if (Docs.forPath(path)) {
            //0 would test false
            this.shadowDoc = 1;
            var a;
            while ((a = Docs.forPath(path + "~~" + this.shadowDoc))) {
                this.shadowDoc++;
                if (a == this) throw new Error("Infinite Looping caught!!");
            }
            this.allowAutoSave = undefined;
        }
        this.path = path;
    };

    //the actual path that is used to save files
    //override save/refresh if you override this
    Doc.prototype.getSavePath = function() {
        return this.isTemp() ? null : this.path;
    };
    Doc.prototype.getEncoding = function() {
        return this.encoding || FileUtils.encodingFor(this.getSavePath(), this.getFileServer());
    };
    Doc.prototype.getFileServer = function() {
        return FileUtils.getFileServer(this.fileServer, true);
    };
    Doc.prototype.save = function(callback) {
        var a = this.getFileServer();
        var doc = this;
        var rev;
        if (this.session.$undoManager) {
            rev = this.session.$undoManager.startNewGroup();
        }
        var res = this.session.getValue();
        a.writeFile(this.path, res, this.getEncoding(), function(err) {
            if (!err && rev !== undefined)
                doc.setClean(rev, res);
            callback && callback(doc, err);
        });
    };
    Doc.prototype.refresh = function(callback, force, ignoreDirty) {
        if (this.isTemp())
            return false;
        var doc = this;

        function load() {
            doc.getFileServer().readFile(doc.getSavePath(), doc.getEncoding(), function(err, res) {
                if (!err || err.code == 'ENOENT')
                    Docs.setValue(doc, res, callback, force, ignoreDirty);
                else {
                    doc.setDirty();
                    callback(doc, err);
                    Notify.error('Failed to load ' + doc.getPath() + ' ' + err.code);
                }
            });
        }
        //todo stat file first
        load();
        return true;
    };
    Doc.prototype.serialize = function() {
        var obj = sessionToJson(this.session);
        obj.lastSave = this.lastSave;
        obj._LSC = this._LSC;
        obj.dirty = this.dirty;
        obj.options = this.options;
        obj.fileServer = this.fileServer;
        obj.encoding = this.encoding;
        obj.allowAutoSave = this.allowAutoSave;
        obj.editorOptions = this.editorOptions;
        obj.factory = this.factory; //prototype value
        return obj;
    };
    Doc.prototype.unserialize = function(json) {
        var obj = json;
        this._LSC = obj._LSC;
        this.encoding = obj.encoding;
        this.fileServer = obj.fileServer;
        this.allowAutoSave = obj.allowAutoSave;
        this.options = obj.options;
        this.session.setOptions(this.options || {});
        this.editorOptions = obj.editorOptions;
        this.lastSave = obj.lastSave;
        this.$fromSerial = true;
        jsonToSession(this.session, obj);
        this.$fromSerial = false;
        this.dirty = obj.dirty;
    };

    function filterHistory(deltas) {
        return deltas.filter(function(d) {
            return d.action != "removeFolds";
        });
    }

    function shrink(undos) {
        var max = Number(appConfig.maxUndoHistory);
        if (!isNaN(max)) {
            return undos.slice(-max);
        }
        return undos;
    }

    function sessionToJson(session) {
        var undoManager = session.getUndoManager();

        return {
            content: session.getValue(),
            selection: session.getSelection().toJSON(),
            scrollTop: session.getScrollTop(),
            scrollLeft: session.getScrollLeft(),
            history: undoManager.$undoStack ? {
                undo: shrink(undoManager.$undoStack).map(filterHistory),
                redo: undoManager.$redoStack.map(filterHistory),
                m: undoManager.$maxRev,
                b: (undoManager.$redoStackBaseRev !== undoManager.$rev) ? undoManager.$redoStackBaseRev : "",
            } : null,
            folds: session.getAllFolds().map(function(fold) {
                return {
                    start: {
                        row: fold.start.row,
                        column: fold.start.column
                    },
                    end: {
                        row: fold.end.row,
                        column: fold.end.column
                    },
                    placeholder: fold.placeholder
                };
            }).filter(function(e) {
                if (e.start.row > e.end.row) {
                    //no longer needed
                    return false;
                }
                return true;
            })
        };
    }

    function jsonToSession(session, state) {
        if (state.content) {
            session.setValue(state.content);
            session.selection.fromJSON(state.selection);
            session.setScrollTop(state.scrollTop);
            session.setScrollLeft(state.scrollLeft);
            try {
                state.folds.forEach(function(fold) {
                    session.addFold(fold.placeholder, Range.fromPoints(fold.start, fold.end));
                });
            } catch (e) {
                console.error('Fold exception: ' + e);
            }
        }
        if (state.history) {
            var manager = session.$undoStack;
            if (!manager)
                session.setUndoManager((manager = new ace.UndoManager()));
            manager.$undoStack = state.history.undo || [];
            manager.$redoStack = state.history.redo || [];
            manager.$maxRev = state.history.m;

            //backwards compatibility
            if (state.history.b)
                manager.$redoStackBaseRev = state.history.b;
            else manager.$redoStackBaseRev = state.history.m;
            manager.$syncRev();
        }
    }

    Doc.prototype.isTemp = function() {
        return this.path.startsWith('temp://');
    };
    Doc.prototype.isReadOnly = function(e) {
        return (this.editorOptions && this.editorOptions.readOnly);
    };
    Doc.prototype.setValue = function(e, isClean) {
        this.session.getDocument().setValue(e);
        var u = this.session.$undoManager;
        if (u && u.$undoStack.length === 1 && u.$redoStack.length === 0 && u.$undoStack[0].length === 1) {
            this.session.$undoManager.reset();
        }
        if (isClean && !this.isTemp()) {
            this.setClean(null, e);
        }
    };
    Doc.prototype.getValue = function() {
        return this.session.getValue();
    };
    Doc.prototype.updateValue = function(res, isClean) {
        var a = Docs.generateDiff(this.getValue(), res);
        var t = this.session.getDocument();
        for (var i in a) {
            t.applyDelta(a[i]);
        }
        if (this.getSize() !== res.length) {
            console.error("Generate diff failed");
            this.setValue(res, isClean);
        } else if (isClean && !this.isTemp()) {
            this.setClean(null, res);
        }
    };
    Doc.prototype.getSize = function() {
        var lastLine = this.session.getLength();
        if(lastLine<1)return 0;
        var doc = this.session.getDocument();
        var sum = doc.getNewLineCharacter().length * (lastLine - 1);
        for (; lastLine > 0;) {
            sum += doc.getLine(--lastLine).length;
        }
        return sum;
    };

    Doc.prototype.clearHistory = function() {
        this.session.getUndoManager().reset();
    };
    Doc.prototype.abortChanges = function(tillLastSave) {
        var manager = this.session.getUndoManager();
        while (manager.canUndo() && (!tillLastSave || manager.getRevision() > this.lastSave)) {
            manager.undo();
        }
    };
    Doc.prototype.getDeltas = function(start) {
        return this.session.getUndoManager().getDeltas(start || 0);
    };
    Doc.prototype.getRevision = function() {
        var u = this.session.getUndoManager();
        return u.startNewGroup();
    };
    Doc.prototype.redoChanges = function() {
        var manager = this.session.getUndoManager();
        while (manager.canRedo()) {
            manager.redo();
        }
        checkRevision(this);
    };

    var checkRevision = Utils.delay(function(doc) {
        //detect when a document is no longer dirty
        //the timeout is needed because the changes are called
        //in the middle of undo/redo operations
        var n = doc.session.getUndoManager().$undoStack;
        if (!n) return;
        n = (n.length > 0 ? Number(n[n.length - 1][0].id) : 0);
        if (doc.lastSave === n) {
            if (doc.dirty) {
                doc.dirty = false;
                updateIcon(doc.id);
            }
        }
    }, 0);
    Doc.prototype.onChange = function() {
        var doc = this;
        if (doc.$fromSerial) return;
        if (doc.session.$fromUndo)
            checkRevision(this);
        if (this.safe)
            this.safe = false;
        if (!this.dirty)
            this.setDirty();
        if (doc.allowAutoSave) {
            autoSave();
        }
        sessionSave();
    };
    Doc.prototype.setDirty = function() {
        this.dirty = true;
        updateIcon(this.id);
    };
    Doc.prototype.setClean = function(rev, res) {
        var doc = this;
        doc.lastSave = rev || doc.session.getUndoManager().startNewGroup();
        //last save checksum, for now we use length
        doc._LSC = doc.getChecksum();
        //the other way to change this value
        //are to refresh
        doc.dirty = false;
        //todo put this data elsewhere
        //like in a smaller header
        doc.safe = false;
        sessionSave();
        updateIcon(this.id);
    };
    Doc.prototype.getChecksum = function(res) {
        //to implement
        return (res || this.session.getValue()).length;
    };
    Doc.prototype.isLastSavedValue = function(res) {
        return this._LSC === res.length;
    };
    Doc.prototype.fork = function(orphan) {
        var fork = new Doc("", this.getSavePath(), this.options.mode, undefined, orphan);
        var data = this.serialize();
        //Ace editor sometimes modifies undos
        data.history = JSON.parse(JSON.stringify(data.history));
        fork.unserialize(data);
        return fork;
    };
    Doc.prototype.cloneSession = function() {
        var session = this.session;
        var s = new EditSession(session.getDocument(), session.getMode());
        var undoManager = session.$undoManager;
        s.setUndoManager(undoManager);
        // Copy over 'settings' from the session.
        s.setTabSize(session.getTabSize());
        s.setUseSoftTabs(session.getUseSoftTabs());
        s.setOverwrite(session.getOverwrite());
        s.setBreakpoints(session.getBreakpoints());
        s.setUseWrapMode(session.getUseWrapMode());
        s.setUseWorker(session.getUseWorker());
        s.setWrapLimitRange(session.$wrapLimitRange.min,
            session.$wrapLimitRange.max);
        s.$foldData = session.$cloneFoldData();
        this.clones = this.clones || [];
        this.clones.push(s);
        return s;
    };

    var Docs = Object.create(null);
    Docs.diffToAceDeltas = function(diff, start_line, start_col) {
        var line = start_line || 0,
            col = start_col || 0;
        var endOfLine = /\r\n|\n|\r/g;
        var deltas = [];
        var start = {
            row: line,
            column: col
        };

        function moveOver(text, type) {
            var a = text.split(endOfLine);
            if (a.length > 1) {
                line += (a.length - 1);
                col = a[a.length - 1].length;
            } else {
                col += a[0].length;
            }
            var end = {
                row: line,
                column: col
            };
            if (type) {
                deltas.push({
                    action: type > 0 ? "insert" : "remove",
                    lines: a,
                    start: start,
                    end: end
                });
            }
            if (type < 0 /*delete*/ ) {
                line = start.row;
                col = start.column;
            } else start = end;
        }
        for (var a = 0; a < diff.length; a++) {
            moveOver(diff[a][1], diff[a][0]);
        }
        return deltas;
    };
    Docs.generateDiff = function(from, value, start_line, start_col) {
        var dmp = new diff_match_patch();
        dmp.Diff_EditCost = 50;
        dmp.Diff_Timeout = 0.4;
        var diff = dmp.diff_main(from, value);
        dmp.diff_cleanupEfficiency(diff);
        return Docs.diffToAceDeltas(diff, start_line, start_col);
    };
    Docs.setValue = function(doc, res, callback, force, ignoreDirty) {
        var name = FileUtils.filename(doc.getPath());
        if (res === undefined || res === null) {
            doc.setDirty();
            Notify.info('File deleted ' + name);
            return callback && callback(doc, {
                code: 'ENOENT'
            });
        }
        if (doc.$needsRecoveryFromRefresh) {
            contentLoader.refresh(doc, res);
            updateIcon(doc.id);
        }
        if (res.length === doc.getSize() && res === doc.getValue()) {
            if (doc.dirty)
                doc.setClean();
        } else if (ignoreDirty && doc.dirty && doc.isLastSavedValue(res)) {
            //console.debug('Ignored changes ' + doc.getPath());
            //ignoreDirty :ignore docs whose changes were
            //caused by the editor
        } else if (force) {
            //force: do not ask confirmation
            doc.updateValue(res, true);
        } else {
            doc.setDirty();
            Notify.ask("File changed. Reload " + name + "?", function() {
                doc.updateValue(res, true);
            }, function() {
                doc._LSC = null;
                doc.lastSave = null;
            });
        }
        callback && callback(doc);
    };
    
    var notified = 0;
    Docs.tempSave = function(id, force, cleaned) {
        if (id !== undefined) {
            try {
                var doc = docs[id];
                var obj = contentLoader.save(doc);
                var data = JSON.stringify(obj);
                if (data.length > maxDocDataSize) {
                    if (!doc.warned)
                        Notify.warn("The internal data of this file has exceeded the configured limits\n" + doc.getPath() + "\n: " + Math.floor(data.length / 1024) + "kb >" + maxDocDataSize / 1024 + "kb",
                            "clear-history-" + doc.id);
                    doc.warned = true;
                    if (obj.history.undo) {
                        obj.history.undo = obj.history.undo.slice((obj.history.undo.length / 2) + 1);
                    } else obj.folds = [];
                    data = JSON.stringify(obj);
                }
                appStorage.setItem(id, data);
                docs[id].safe = true;
                updateIcon(id);
            } catch (e) {
                var msg = (e + "").toLowerCase();
                if (!cleaned && msg.indexOf('quota') > -1) {
                    var freeSpace = determineQuota();
                    if (freeSpace < 1000000) {
                        var clear = 1000000 - freeSpace;
                        while (blobRegistry.size > clear) {
                            Docs.cleanBlobs(true);
                        }
                        Docs.tempSave(id, true, true);
                        return;
                    } else {
                        //todo handle low space scenarios
                    }
                }
                if (notified < 3) {
                    Notify.error('Error caching current document');
                    notified++;
                }
                console.error(e);
            }
        } else {
            for (var i in docs)
                if ((force || !docs[i].safe) && docs[i].bound) {
                    Docs.tempSave(i);
                }
            sessionSave.cancel();

        }
    };
    Docs.saveAs = function(id, newpath, fileServer, callback) {
        var doc = docs[id];
        fileServer = fileServer || FileUtils.defaultServer;
        if (doc.isTemp()) {
            doc.setPath(newpath);
            Tabs.setName(id, Docs.getName(id));
            Docs.persist();
        } else {
            id = addDoc("", "", newpath);
            jsonToSession(docs[id].session, sessionToJson(doc.session));
        }
        docs[id].fileServer = fileServer.id;
        if (doc.encoding) {
            var alias = fileServer.isEncoding(doc.encoding);
            if (!alias) {
                docs[id].encoding = FileUtils.encodingFor(newpath, fileServer);
                Notify.info('Encoding reset to default');
            } else docs[id].encoding = typeof(alias) == "string" ? alias : doc.encoding;
        }
        docs[id].save(callback);
    };
    Docs.rename = function(path, newpath, server) {
        var doc = Docs.forPath(path, server);
        if (doc) {
            doc.setPath(newpath);
            Tabs.setName(doc.id, Docs.getName(doc.id));
            doc.safe = false;
            sessionSave();
            Docs.persist();
            return true;
        }
        return false;
    };
    Docs.setEncoding = function(id, encoding) {
        var doc = docs[id];
        var alias = doc.getFileServer().isEncoding(encoding);
        if (alias) {
            if (typeof(alias) == "string")
                doc.encoding = alias;
            else doc.encoding = encoding;
            if (!doc.isTemp()) {
                Notify.ask('Reload file with new encoding?', function() {
                    doc.refresh(function() {
                        Notify.info('Refreshed');
                    }, true, true);
                });
            }
            sessionSave(id);
        } else {
            Notify.error('Encoding ' + encoding + ' not supported by this storage device');
        }
    };
    Docs.saveDocs = function(id, callback, force) {
        //save all non shadow docs
        //or specified doc
        if (id !== undefined) {
            if (docs[id].shadowDoc) {
                var mainDoc = Docs.forPath(docs[id].getSavePath(), docs[id].getFileServer());
                if (mainDoc && mainDoc.allowAutoSave) {
                    mainDoc.shadowDoc = docs[id].shadowDoc;
                    mainDoc.allowAutoSave = undefined;
                    if (!mainDoc.warned) {
                        mainDoc.warned = true;
                        Notify.warn("Saving Duplicate Document.</br> Autosave turned off.", 1000);
                    }
                }
                docs[id].shadowDoc = false;
            }
            if (docs[id].allowAutoSave === undefined) {
                docs[id].allowAutoSave = appConfig.allowAutoSave;
                if (docs[id].allowAutoSave) Notify.info('Autosave enabled')
                //notify allowAutoSave
                ;
            }
            docs[id].save(callback);
        } else {
            for (var i in docs)
                if ((docs[i].dirty || force) && docs[i].allowAutoSave && !docs[i].shadowDoc)
                    Docs.saveDocs(i, callback);
            autoSave.cancel();
        }
    };
    Docs.refreshDocs = function(id) {
        var next = [];
        if (id) {
            if (!docs[id].isTemp())
                next = [id];
        } else
            for (var i in docs) {
                if (!docs[i].isTemp())
                    next.push(i);
            }
        Utils.asyncForEach(next,
            function(i, n, advance) {
                try {
                    var a = docs[i].refresh(advance, !!docs[i].forceReload, true);
                    delete docs[i].forceReload;
                    if (!a)
                        advance();
                } catch (e) {
                    console.error(e);
                    advance();
                }
            }, null, 2);
    };
    Docs.dirty = function(id) {
        docs[id].setDirty();
    };
    Docs.$jsonToSession = jsonToSession;
    Docs.$sessionToJson = sessionToJson;
    var sessionSave = Utils.delay(Docs.tempSave, 5000);
    var autoSave = Utils.delay(Docs.saveDocs, Math.max(Utils.parseTime(appConfig.autosaveInterval), 5000));

    Docs.numDocs = function() {
        var num = 0;
        for (var i in docs) num++;
        return num;
    };
    Docs.forPath = function(path, server) {
        var shadow = null;
        for (var i in docs) {
            if (docs[i].getPath() == path) {
                if (server && (server.getDisk() !== docs[i].getFileServer().getDisk())) {
                    continue;
                }
                return docs[i];
            }

        }

        return null;
    };
    Docs.forSession = function(session) {
        for (var id in docs) {
            var doc = docs[id];
            if (doc.session == session || (doc.clones && doc.clones.indexOf(session) > -1)) {
                return doc;
            }
        }
    };
    Docs.closeSession = function(session) {
        var doc = Docs.forSession(session);
        if (session == doc.session) {
            if (doc.clones && doc.clones.length > 0) {
                var temp = doc.clones[0];
                doc.clones[0] = session;
                doc.session = temp;
                if (doc.bound) {
                    session.off("change", doc.onChange);
                    session.off('changeMode', doc.onChangeMode);
                    doc.session.on("change", doc.onChange);
                    doc.session.on('changeMode', doc.onChangeMode);
                }
            }
            //don't close session without closing tab
            else return false;
        }
        doc.clones = doc.clones.filter(function(e) {
            if (e == session) return false;
            return true;
        });
        session.destroy();
        return true;
    };


    var blobRegistry = getObj('blobRegistry', {
        size: 0
    });
    var blobClearTimeout;

    //must be a synchronous file storage
    var blobStorage = global.appStorage;
    var determineQuota = function(key) {
        key = key || 0;
        var a = "Getting Quota Using String Concatenation";
        try {
            while (true) {
                localStorage["s" + key] = a;
                a = a + a;
            }
        } catch (e) {
            var size = a.length / 2 + (a.length > 1000 ? determineQuota(key + 1) : 0);
            localStorage.removeItem('s' + key);
            return size;

        }
    };

    //blob is like stash for open documents
    //unlike stash it uses size as a metric
    Docs.saveBlob = function(id, name, value, priority, data) {
        var t = Docs.hasBlob(id, name);
        if (t)
            Docs.removeBlob(t);
        if (!value)
            return false;
        var manifest = {
            id: id,
            type: name,
            pr: priority || 1,
            key: Utils.genID('b', blobRegistry), //createKey
        };
        for (var i in data) {
            if (!manifest[i]) //cannot override
                manifest[i] = data[i];
        }
        if (typeof(value) == "object") {
            manifest.obj = true;
        }
        try {
            if (manifest.obj) {
                value = JSON.stringify(value);
            }
            manifest.size = value.length;
            if (value.length > maxStoreSize) {
                return false;
            }
            blobStorage.setItem(manifest.key, value);
        } catch (e) {
            try {
                blobStorage.removeItem(manifest.key);
            } catch (e) {}
            return false;
        }
        blobRegistry[manifest.key] = manifest;
        blobRegistry.size += manifest.size;
        if (blobRegistry.size > maxStoreSize) {
            if (!blobClearTimeout) {
                blobClearTimeout = Utils.setImmediate(function() {
                    blobClearTimeout = null;
                    Docs.cleanBlobs(true);
                });
            }
        }
        putObj("blobRegistry", blobRegistry);
        return manifest.key;
    };
    Docs.hasBlob = function(id, name) {
        for (var i in blobRegistry) {
            if (i == 'size') continue;
            if (blobRegistry[i].id == id && (!name || blobRegistry[i].type == name)) {
                return i;
            }
        }
    };
    Docs.removeBlob = function(key) {
        if (blobRegistry.hasOwnProperty(key)) {
            var manifest = blobRegistry[key];
            blobStorage.removeItem(manifest.key);
            blobRegistry.size -= manifest.size;
            delete blobRegistry[key];
            putObj("blobRegistry", blobRegistry);
            return true;
        }
        return false;
    };
    Docs.restoreBlob = function(key) {
        if (blobRegistry.hasOwnProperty(key)) {
            var manifest = blobRegistry[key];
            var value = blobStorage.getItem(manifest.key);
            if (!value) {
                Docs.removeBlob(key);
                return false;
            }
            if (manifest.obj)
                value = JSON.parse(value);
            return value;
        }
        return false;
    };
    Docs.cleanBlobs = function(force) {
        var maxSize = maxStoreSize;
        if (!force && blobRegistry.size < maxSize)
            return;
        var toClean = [];
        if (blobClearTimeout) {
            clearTimeout(blobClearTimeout);
            blobClearTimeout = null;
        }
        //recent blobs have higher priority
        var t = 1;
        for (var i in blobRegistry) {
            if (i == 'size') continue;
            var size = blobRegistry[i].size;
            var priority = blobRegistry[i].pr;
            var score = t * priority / size;
            t += 0.5;
            toClean.push({
                key: i,
                score: score
            });
        }
        toClean[toClean.length - 1].score *= 2;
        toClean.sort(function(a, b) {
            return a.score < b.score ? -1 : 1;
        });
        var l = toClean.length / 3 || 1;
        for (var i = 0; i < l; i++) {
            Docs.removeBlob(toClean[i].key);
        }
        if (blobRegistry.size > maxSize) {
            Docs.cleanBlobs(true);
        }
    };
    Docs.allBlobs = function(id) {
        var ids = [];
        for (var i in blobRegistry) {
            if (i == 'size') continue;
            if (blobRegistry[i].id == id) {
                ids.push(i);
            }
        }
        return ids;
    };


    var __factory = {};
    Docs.registerFactory = function(type, constructor) {
        __factory[type] = constructor;
    };

    Docs.stashDoc = function(path, text) {
        var key;
        if (path && !path.startsWith(":"))
            key = Docs.saveBlob("stashExpiry", path, text, STASH_PRIORITY, {
                expiry: Math.floor(new Date().getTime() / 1000)
            });
        return key;
    };
    Docs.cleanStash = function() {
        var current = new Date().getTime();
        current -= Utils.parseTime(appConfig.stashExpiryTime);
        current = current / 1000;
        var keys = Docs.allBlobs('stashExpiry');
        for (var j in keys) {
            var i = keys[j];
            if (blobRegistry[i].expiry < current) {
                Docs.removeBlob(i);
            }
        }
    };
    Docs.restoreStash = function(path, doc) {
        var key = Docs.hasBlob('stashExpiry', path);
        if (key) {
            var text = Docs.restoreBlob(key);
            Docs.removeBlob(key);
            try {
                var content = JSON.parse(text);
                var value = doc.getValue();
                jsonToSession(doc.session, content);
                if (content.content != value) {
                    doc.updateValue(value);
                }
            } catch (e) {
                return null;
            }
            return doc;
        }
    };


    Docs.initialize = function(tabs, activeTab) {
        Tabs = tabs;
        app.on('changeTab', function(e) {
            updateIcon(e.tab, true);
        });
        app.on('app-paused', function() {
            Docs.tempSave();
        });
        app.once('app-loaded', function() {
            updateIcon(Tabs.active);
        });
        Tabs.registerPopulator('m', Docs);
        Docs.fromJSON(null, null, activeTab);
    };
    Docs.toJSON = function() {
        var h = {};
        for (var i in docs) {
            h[i] = docs[i].isTemp() ? null : docs[i].getSavePath();
        }
        return JSON.stringify(h);
    };
    Docs.fromJSON = function(json, ignoreFail, asyncStart) {
        if (!json) {
            json = getObj("docs", null);
            if (!json) {
                return app.triggerForever('documents-loaded');
            }
        }
        if (!ignoreFail && Breaks.hasFailures("loadDocuments")) {
            var el = $(Notify.modal({
                header: "<i class='material-icons close-icon'>error</i><h5 class='center'>Error Loading Documents</h5>",
                dismissible: false,
                body: ["<h6>Error during previous load.</br>Choose documents to load</h6><form>"].concat(Object.keys(json).map(function(e) {
                    return "<input data-id='" + e + "' type='checkbox'" + (json[e] ? "" : " checked") + "></input><span>" + (json[e] || "Temporary " + e) + "</span>";
                })).concat(["</form>"]).join(""),
                footers: ['Load All', 'Proceed']
            }, function() {
                el.find('input').off();
                el.find('.modal-load_all').off();
                el.find('.modal-proceed').off();
            }));
            el.find('.modal-load_all').click(function() {
                Breaks.removeBreakpoint('loadDocuments');
                Docs.fromJSON(json, true);
                el.modal('close');
            }).addClass('red');
            el.find('.modal-proceed').click(function() {
                var toDelete = [];
                var els = el.find('input');
                for (var i = els.length; i-- > 0;) {
                    if (!els[i].checked) {
                        toDelete.push(i);
                        delete json[els[i].getAttribute('data-id')];
                    }
                }
                for (var j in toDelete) {
                    var id = toDelete[j];
                    var key;
                    while ((key = Docs.hasBlob(id))) {
                        Docs.removeBlob(key);
                    }
                    appStorage.removeItem(id);
                }
                Breaks.removeBreakpoint('loadDocuments');
                Docs.fromJSON(json, true);
                el.modal('close');
            });
            global.styleCheckbox(el);
            return;
        }
        var load;
        var ids = Object.keys(json);
        if (asyncStart) {
            var i = ids.indexOf(asyncStart);
            var loaded = false;
            if (i > -1) {
                loaded = loadOne(asyncStart, i, function() {
                    return true;
                });
            }
            //Load at least one document
            for (i = 0; !loaded && i < ids.length; i++) {
                loaded = loadOne(ids[i], i, function() {
                    return true;
                });
            }
            load = function(i, index, next) {
                setTimeout(loadOne.bind(null, i, index, next), 150);
            };
        } else load = loadOne;
        Breaks.breakpoint("loadDocuments", null, 2000);
        Utils.asyncForEach(ids, load, function() {
            Docs.cleanStash();
            //A new doc might have been created
            //Or one of the docs closed
            if (ids.length !== Docs.numDocs()) {
                Docs.persist();
            }
            Tabs.recreate();
            app.triggerForever('documents-loaded');
        }, 2);

        function loadOne(i, index, next) {
            if (docs[i]) return next();
            var state = appStorage.getItem(i);
            if (state) {
                try {
                    state = JSON.parse(state);
                } catch (e) {
                    state = null;
                }
            }
            if (Breaks.hasFailures(i)) {
                Notify.ask('Proceed to load ' + (json[i] || "Document " + i) + " ?", Docs.$loadData.bind(null, i, json[i], state), Docs.persist);
            } else {
                Docs.$loadData(i, json[i], state);
            }
            return next();
        }
    };
    Docs.$loadData = function(id, path, state) {
        Breaks.setBreakpoint(id);
        if (state) {
            if (state.factory) {
                if (__factory[state.factory]) {
                    var C = __factory[state.factory];
                    docs[id] = new C("", path, undefined, id);
                } else {
                    //factory not registered
                    console.error('Unknown factory ' + state.factory);
                    return Breaks.removeBreakpoint(id);
                }
            } else docs[id] = new Doc("", path, undefined, id);
            contentLoader.load(docs[id], state);
            docs[id].safe = true;
            addDoc("", docs[id], undefined, state.mode, null, false);
            updateIcon(id);
        } else {
            if (contentLoader.canRecover(id)) {
                //lost state, reload
                docs[id] = new Doc("", path, undefined, id);
                contentLoader.recover(id, docs[id]);
            } else if (path) {
                docs[id] = new Doc("", path, undefined, id);
                if (!docs[id].isTemp()) {
                    docs[id].forceReload = true;
                }
            }
            if (docs[id])
                addDoc("", docs[id], undefined, undefined, null, false);
        }
        Breaks.removeBreakpoint(id);
    };
    Docs.persist = function() {
        appStorage.setItem("docs", Docs.toJSON());
    };

    //move to tabs
    Docs.addTabAnnotation = function(id, anno) {
        Tabs.addAnnotation(id, anno);
    };
    Docs.removeTabAnnotation = function(id, anno) {
        Tabs.removeAnnotation(id, anno);
    };


    function addDoc(name, content /*-doc-*/ , path, mode /*-use true to keep mode-*/ , data, select = true) {
        var b, doc;
        //use cases in searchtab addDoc(,doc,path)
        //main use adddoc(,doc,path,mode)
        //filebrowser adddoc(n,c,p)
        if (name && typeof name == "object") {
            doc = name;
            name = undefined;
            content = undefined;
            //console.warn('Use of deprecated api addDoc(doc)')
        } else if (content && typeof content == "object") {
            doc = content;
            content = undefined;
        }
        if (doc) {
            path = doc.getSavePath();
            if (!doc.options.mode) {
                mode = modelist.getModeForPath(path || name || "").mode;
                if (mode != "ace/mode/text")
                    doc.session.setMode(mode);
            }
        } else {
            if (!mode)
                mode = modelist.getModeForPath(path || name || "").mode;
            if (!doc) {
                doc = new Doc(content, path, mode);
            }
        }
        if (!doc.session.$undoManager) {
            doc.session.setUndoManager(new ace.UndoManager());
        }


        if (!doc.getPath()) {
            console.error('Bad factory: path cannot be null');
            doc.setPath(null);
        }
        if (!Tabs.hasTab(doc.id)) {
            Docs.persist();
            if (!name) {
                name = Docs.getName(doc.id);
            }
            Tabs.addTab(doc.id, name, doc.annotations);
        }
        if (!doc.bound) {
            if (path)
                Docs.restoreStash(path, doc);
            doc.onChange = Doc.prototype.onChange.bind(doc);
            doc.onChangeMode = function() {
                var mode = doc.session.getMode();
                if (mode.$id != doc.options.mode) {
                    doc.options.mode = mode.$id;
                    doc.safe = false;
                    sessionSave();
                }
            };
            doc.session.on("change", doc.onChange);
            doc.session.on('changeMode', doc.onChangeMode);
            doc.bound = true;
            app.trigger('createDoc', {
                doc: doc
            });
        }

        //this usually is a valid assumption
        if (content !== undefined && path)
            doc.setClean();

        if (select)
            Tabs.setActive(doc.id, true, true);
        return doc.id;
    }

    function closeDoc(docId, replace, keepUndos) {
        var doc = docs[docId];
        if (doc.clones && doc.clones.length) {
            throw 'Error: Docs is currently in use';
        }
        if (keepUndos === undefined) keepUndos = appConfig.keepDocumentsOnClose;
        var key;
        while ((key = Docs.hasBlob(docId))) {
            Docs.removeBlob(key);
        }
        if (doc.bound && keepUndos && !doc.isTemp() && doc.getSavePath()) {
            Docs.stashDoc(doc.getSavePath(), JSON.stringify(defaultSaver.save(doc)));
        }
        if (appStorage.getItem(docId)) {
            appStorage.removeItem(docId);
        } else {
            if (doc.safe) console.error("Unsafe doc with safe flag");
        }
        if (doc.bound) {
            doc.session.off("change", doc.onChange);
            doc.session.off("changeMode'", doc.onChangeMode);
            app.trigger('closeDoc', {
                doc: doc,
                id: docId
            });
        }
        doc.session.destroy();
        delete docs[docId];
        Docs.persist();

        if (Tabs.hasTab(docId)) {
            Tabs.removeTab(docId, !replace);
            if (!replace && Tabs.numTabs() === 0) {
                newFile();
            }
        }

    }

    function newFile(editor) {
        addDoc("unsaved*", "", "", editor ? editor.getOption('mode') : null);
    };


    var updateIcon = function(id, fromEvent) {
        //status indicator
        //used to show change in status
        //if need be there might be a change status
        //event but for now, it has only one listener
        if (!fromEvent && id != Tabs.active) return;
        if (!docs[id] || !docs[id].dirty)
            $("#save i").css("color", "inherit");
        else if (docs[id].allowAutoSave)
            $("#save i").css("color", "orange");
        else {
            $("#save i").css("color", "red");
        }
    };


    //this should be in Editors
    //it is just a legacy method now
    Docs.swapDoc = function(id) {
        if (Tabs.active != id) {
            Tabs.setActive(id, true, true);
        } else {
            State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
        }
    };

    Docs.openDoc = function(path, server, cb) {
        FileUtils.getDoc(path, server, function(doc, error) {
            if (error) {
                var et = "";
                if(cb)return cb(error);
                else if(error=='binary')et = 'Binary file';
                else switch(error.code){
                    case 'ENOENT':
                        et = 'File does not exist';
                        break;
                    case 'EACCESS':
                        et = 'Permission denied';
                        break;
                    case 'ETOOLARGE':
                        et = 'File Too Large';
                        break;
                }
                return Notify.error(et);
            }
            addDoc(doc);
            doc.setClean();
            cb && cb(null, doc);
        });
    };
    //TabHolder interface
    Docs.getName = function(id) {
        var doc = docs[id];
        if (doc) {
            if (doc.isTemp()) {
                return "unsaved(" + (Tabs.indexOf(id) < 0 ? Tabs.numTabs() : Tabs.indexOf(id)) + ")";
            } else return FileUtils.filename(doc.getPath());
        }
        return null;
    };
    Docs.getAnnotations = function(id) {
        return Tabs.getAnnotations(id);
    };
    Docs.getInfo = function(id) {
        return (docs[id].isTemp() ? "<i>"+docs[id].id+"</i>" : docs[id].getSavePath()) || "<i>"+docs[id].id+"</i>"; 
            //+"<i class='right' style='text-transform:uppercase'>"+docs[id].getEncoding()+"</i>";
    };
    global.Functions.newFile = newFile;
    global.docs = docs;
    global.addDoc = addDoc;
    global.Doc = Doc;
    global.closeDoc = closeDoc;
    global.Docs = Docs;
}); /*_EndDefine*/