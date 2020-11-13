(function(global) {
    "use strict";
    //todo replace confirm with Notify ask
    global.registerAll({
        "lastRun": undefined,
        "allowAutoSave": false,
        "stashExpiryTime": "1day",
        "keepDocumentsOnClose": true,
        "maxStoreSize": Env.isWebView ? "50mb" : "5mb",
        "maxDocCacheSize": "500kb",
        "maxUndoHistory": "Infinity"
    });

    var appStorage = global.appStorage;
    var appConfig = global.appConfig;
    var getObj = global.getObj;
    var putObj = global.configureObj;
    var modelist = ace.require("ace/ext/modelist");
    var lastRun = appConfig.lastRun;
    var docs = {};
    var app; //for getCurrentTab
    var EditSession = ace.require("ace/edit_session").EditSession;
    var FileUtils = global.FileUtils;
    var Notify = global.Notify;
    var Utils = global.Utils;
    var Tabs;
    var CONTENT_PRIORITY = 10;
    var STASH_PRIORITY = 5;
    var USER_CHECKPOINT_PRIORITY = 10;
    var maxDocCacheSize = Math.min(5000, Math.max(10, Utils.parseSize(appConfig.maxDocCacheSize)));

    function updateDiff(session, undoManager, from) {
        var diff, delta, i;
        var stack = undoManager.$undoStack;
        if (from === 0) diff = stack;
        else
            for (i = stack.length; i--;) {
                delta = stack[i][0];
                if (delta.id == from) {
                    diff = stack.slice(i + 1);
                    break;
                }
                else if (delta.id < from) {
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
        for (i = stack.length; i--;) {
            delta = stack[i][0];
            if (delta.id == from) {
                diff = stack.slice(i);
                break;
            }
            else if (delta.id > from) {
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

    function ca(doc, attr) {
        console.log(attr, doc.getPath(), doc[attr]);
    }
    var historySaver = {
        save: function(doc) {
            var obj = doc.serialize();
            if (!isNaN(doc.lastSave) && !doc.isTemp() && doc.getSize() > maxDocCacheSize) {
                obj.contentSize = obj.content.length;
                Doc.saveBlob(doc.id, "content", obj.content, CONTENT_PRIORITY);
                obj.content = "";
            }
            //todo put additional recovery data
            return obj;
        },
        load: function(doc, obj) {
            doc.unserialize(obj);
            if (obj.contentSize) {
                var contentKey = Doc.hasBlob(doc.id, "content");
                if (contentKey) {
                    var content = Doc.restoreBlob(contentKey);
                    if (content && content.length == obj.contentSize) {
                        doc.session.$fromUndo = true;
                        doc.setValue(content);
                        doc.session.$fromUndo = false;
                        return;
                    }
                }
                console.error('Cache content wiped ', doc.id);
                doc.savedUndos = doc.session.$undoManager;
                doc.session.setUndoManager(null);
                doc.contentSize = obj.contentSize;
                doc.needsRefresh = true;
                doc.dirty = true;

            }
        },
        refresh: function(doc, res) {
            if (doc.getSize()) {
                console.error(new Error("Error: Unrefreshed doc modified"));
                //_LSC && lastSave are invalidated
            }
            //doc has not changed since last save
            //undos can be reused
            else if (doc.isLastSavedValue(res)) {
                doc.$fromSerial = true;
                doc.setValue(res);
                try {
                    if (updateDiff(doc.session, doc.savedUndos, doc.lastSave)) {
                        Utils.assert(doc.getSize() == doc.contentSize);
                        doc.session.setUndoManager(doc.savedUndos);
                        doc.dirty = (doc.contentSize != res.length);
                    }
                    else doc.setClean();
                }
                catch (e) {
                    Notify.error('Corrupted history recovery');
                    //should probably clear history
                    doc.setValue(res, true);
                }
                //later use revision
                console.debug('Recovered from disk', doc.id);
                doc.$fromSerial = false;
            }
            else {
                console.debug('Recovery failed', doc.id);
                doc.setValue(res, true);
            }
            delete doc.needsRefresh;
            delete doc.savedUndos;
            delete doc.contentSize;
        },
        canRecover: function(id) {
            var contentKey = Doc.hasBlob(id, "content");
            var content = Doc.restoreBlob(contentKey);
            if (content && content.length) {
                return true;
            }
        },
        recover: function(id, doc) {
            var contentKey = Doc.hasBlob(id, "content");
            var content = Doc.restoreBlob(contentKey);
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
            delete doc.needsRefresh;
        },
        canRecover: function() {}
    };
    var contentLoader = historySaver;

    function Doc(content, path, mode, id, orphan, data) {
        //documents are a link to paths
        //To edit multiple copies of a document
        //You can create a new file and saveAs
        //the doc or fork the document
        //using Doc constructor is a bit complex
        //use addDoc for docs that can be editted
        Object.assign(this, data);
        if (id) {
            this.id = id;
        }
        else {
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
        }
        else docs[this.id] = this;
        this.session.setOptions(Doc.$defaults);
        //needs saving
        this.dirty = false;
        //needs saving temp
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
            return;
        }
        path = FileUtils.normalize(path);
        if (path == this.path) return;
        //shadow docs,
        //ensure getpath is unique
        //save file to update shadowDoc value
        if (Doc.forPath(path)) {
            //0 would test false
            this.shadowDoc = 1;
            var a;
            while ((a = Doc.forPath(path + "~~" + this.shadowDoc))) {
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
        return this.path;
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
        this.getFileServer().readFile(this.getSavePath(), this.getEncoding(), function(err, res) {
            var name = FileUtils.filename(doc.getPath());
            if (err || res === undefined || res === null) {
                Notify.info('File deleted: ' + name);
                return callback && callback(doc, err || new Error('ENOTEXIST'));
            }
            if (doc.needsRefresh) {
                contentLoader.refresh(doc, res);
            }
            if (res.length === doc.getSize() && res === doc.getValue()) {
                if (doc.dirty)
                    doc.setClean();
            }
            else if (ignoreDirty && doc.dirty && doc.isLastSavedValue(res)) {
                //ignoreDirty :ignore docs whose changes were
                //caused by the editor
            }
            else if (force || confirm("File changed. Reload " + name + "?")) {
                //force: do not ask confirmation
                doc.setValue(res, true);
            }
            callback && callback(doc);
        });
        return true;
    };
    Doc.prototype.serialize = function() {
        var obj = sessionToJson(this.session);
        obj.lastSave = this.lastSave;
        obj._LSC = this._LSC;
        obj.dirty = this.dirty;
        obj.options = this.options;
        if (this.fileServer)
            obj.fileServer = this.fileServer;
        if (this.encoding)
            obj.encoding = this.encoding;
        if (this.allowAutoSave !== undefined)
            obj.allowAutoSave = this.allowAutoSave;
        if (this.editorOptions)
            obj.editorOptions = this.editorOptions;
        if (this.factory) //prototype value
            obj.factory = this.factory;
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
            //options: session.getOptions(),
            //mode: session.$modeId,
            scrollTop: session.getScrollTop(),
            scrollLeft: session.getScrollLeft(),
            history: undoManager.$undoStack ? {
                undo: shrink(undoManager.$undoStack).map(filterHistory),
                //ace undomanager allows you to redo changes after editting
                redo: undoManager.$redoStack.map(filterHistory),
                m: undoManager.$maxRev,
                b: (undoManager.$redoStackBaseRev !== undoManager.$rev) ? undoManager.$redoStackBaseRev : "",
            } : null,
            folds: session.getAllFolds().map(function(fold) {
                return {
                    start: { row: fold.start.row, column: fold.start.column },
                    end: { row: fold.end.row, column: fold.end.column },
                    placeholder: fold.placeholder
                };
            }).filter(function(e) {
                if (e.start.row > e.end.row) {
                    console.error('Bad fold data ', JSON.stringify(e));
                    return false;
                }
                return true;
            })
        };
    }

    function jsonToSession(session, state) {
        var Range = ace.require('ace/range').Range;
        session.setValue(state.content);
        session.selection.fromJSON(state.selection);
        //session.setOptions(state.options);
        //session.setMode(state.mode);
        session.setScrollTop(state.scrollTop);
        session.setScrollLeft(state.scrollLeft);
        if (state.history) {
            if (!session.$undoManager)
                session.setUndoManager(new ace.UndoManager());
            session.$undoManager.$undoStack = state.history.undo || [];
            session.$undoManager.$redoStack = state.history.redo || [];
            session.$undoManager.$maxRev = state.history.m;

            //backwards compatibility
            if (state.history.b)
                session.$undoManager.$redoStackBaseRev = state.history.b;
        }
        try {
            state.folds.forEach(function(fold) {
                session.addFold(fold.placeholder, Range.fromPoints(fold.start, fold.end));
            });
        }
        catch (e) { console.error('Fold exception: ' + e) }
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
    Doc.prototype.getSize = function() {
        var sep = this.session.getDocument().getNewLineCharacter().length;
        return this.session.getDocument().$lines.reduce(function(sum, next, i) {
            return (i === 1 ? sum.length : sum) + sep + next.length;
        });
    };

    Doc.prototype.clearHistory = function() {
        session.getUndoManager().reset();
    };
    Doc.prototype.abortChanges = function(tillLastSave) {
        var manager = this.session.$undoManager;
        while (manager.canUndo() && (!tillLastSave || manager.getRevision() > this.lastSave)) {
            manager.undo();
        }
    };
    Doc.prototype.redoChanges = function() {
        var manager = this.session.$undoManager;
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
                doc.safe = false;
                updateIcon(doc.id);
            }
        }
    }, 0);
    Doc.prototype.onChange = function() {
        var doc = this;
        if (doc.$fromSerial) return;
        if (doc.session.$fromUndo)
            checkRevision(this);
        if (!this.dirty || this.safe)
            this.setDirty();
        if (doc.allowAutoSave) {
            autoSave();
        }
        sessionSave();
    };
    Doc.prototype.setDirty = function() {
        this.dirty = true;
        this.safe = false;
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
        doc.safe = false;
        sessionSave();
        updateIcon(this.id);
    };
    Doc.prototype.getChecksum = function(res) {
        return (res || this.session.getValue()).length;
    };
    Doc.prototype.isLastSavedValue = function(res) {
        return this._LSC === res.length;
    };
    Doc.prototype.fork = function(orphan) {
        var fork = new Doc("", this.getSavePath(), this.options.mode, undefined, orphan);
        var data = this.serialize();
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


    //checkpoints: fast ways of switching
    //histories other than shadowDoc
    var clearCheckpoints = Utils.debounce(function() {
        for (var i in docs) {
            docs[i].checkpoints = null;
        }
    }, Utils.parseTime("1min"));
    Doc.prototype.gotoCheckpoint = function(name) {
        if (!this.checkpoints) {
            this.checkpoints = Doc.restoreBlob(this.id, "checkpoints") || [];
        }
        clearCheckpoints();
        if (!this.checkpoints.length)
            return;
        if (!this.revertPoints) {
            this.revertPoints = [];
        }
        var checkpoint;
        if (name) {
            checkpoint = this.checkpoints.find(function(e) {
                return e.name == name;
            });
        }
        else checkpoint = this.checkpoints[this.checkpoints.length - 1];
        if (!checkpoint) return false;
        if (checkpoint.id == this.stateID) {
            //ignore
            this.revertPoints.push(this.checkpoints.pop());
            if (name) return;
            else return this.gotoCheckpoint();
        }
        if (!this.revertPoints.length) {
            this.saveCheckpoint('current', true);
            //clears revert stack
            this.revertPoints.push(this.checkpoints.pop());
        }
        this.revertPoints.push(this.checkpoints.pop());
        jsonToSession(this.session, checkpoint);
        this.stateID = checkpoint.id;
    };
    Doc.prototype.returnFromCheckpoint = function() {
        if (!this.revertPoints || !this.revertPoints.length) {
            return this.gotoCheckpoint();
        }
        var checkpoint = this.revertPoints.pop();
        this.checkpoints.push(checkpoint);
        if (checkpoint.id == this.stateID) {
            //ignore
            return this.returnFromCheckpoint();
        }
        this.stateID = checkpoint.id;
        jsonToSession(this.session, checkpoint);
        this.session.once("change", function() {
            if (this.stateID == checkpoint.id) {
                this.$clearRevertStack();
                this.stateID = null;
            }
        }.bind(this));
    };
    Doc.prototype.$clearRevertStack = function() {
        while (this.revertPoints && this.revertPoints.length) {
            this.checkpoints.push(this.revertPoints.pop());
        }
    };
    Doc.prototype.saveCheckpoint = function(name, persist) {
        this.$clearRevertStack();
        var id = Utils.genID('c');
        if (!this.checkpoints) {
            this.checkpoints = Doc.restoreBlob(this.id, "checkpoints") || [];
        }
        clearCheckpoints();
        //remove previous name
        this.checkpoints = this.checkpoints.filter(function(e) {
            return e.name != name;
        });
        var checkpoint = sessionToJson(this.session);
        checkpoint.folds = [];
        checkpoint.id = id;
        checkpoint.time = new Date().getTime();
        checkpoint.name = name;
        checkpoint.persist = !!persist;
        this.stateID = checkpoint.id;
        this.session.once("change", function() {
            if (this.stateID == checkpoint.id) {
                this.$clearRevertStack();
                this.stateID = null;
            }
        }.bind(this));
        this.checkpoints.push(checkpoint);
        if (this.checkpoints.length > appConfig.maximumCheckpoints) {
            this.checkpoints.splice(1, 1);
        }
        Doc.saveBlob(this.id, "checkpoints", this.checkpoints, USER_CHECKPOINT_PRIORITY);
    };
    Doc.prototype.deleteCheckpoint = function(name) {
        this.$clearRevertStack();
        if (!this.checkpoints) {
            this.checkpoints = Doc.restoreBlob(this.id, "checkpoints") || [];
        }
        clearCheckpoints();
        this.checkpoints = this.checkpoints.filter(function(e) {
            return e.name != name;
        });
        Doc.saveBlob(this.id, "checkpoints", this.checkpoints, USER_CHECKPOINT_PRIORITY);
    };


    Doc.tempSave = function(id, force) {
        if (id !== undefined) {
            try {
                Utils.assert(docs[id].bound || force, "unbound doc");
                Utils.assert(!docs[id].hasOwnProperty('factory'), "factory doc");
                appStorage.setItem(id, JSON.stringify(contentLoader.save(docs[id])));
                docs[id].safe = true;
                updateIcon(id);
            }
            catch (e) {
                console.error('Unable to save doc ' + docs[id].getSavePath());
                console.error(e);
            }
        }
        else {
            for (var i in docs)
                if ((!docs[i].safe && docs[i].bound) || force) {
                    Doc.tempSave(i);
                }
            sessionSave.cancel();

        }
    };
    Doc.saveAs = function(id, newpath, fileServer,callback) {
        var doc = docs[id];
        fileServer = fileServer || FileUtils.defaultServer;
        if (doc.isTemp()) {
            doc.setPath(newpath);
            Tabs.setName(id, Doc.getName(id));
            Doc.persist();
        }
        else {
            id = addDoc("", "", newpath);
            jsonToSession(docs[id].session, sessionToJson(doc.session));
        }
        docs[id].fileServer = fileServer.id;
        if (doc.encoding) {
            var alias = fileServer.isEncoding(doc.encoding);
            if (!alias) {
                docs[id].encoding = FileUtils.encodingFor(newpath, fileServer);
                Notify.info('Encoding reset to default');
            }
            else docs[id].encoding = typeof(alias) == "string" ? alias : doc.encoding;
        }
        docs[id].save(callback);
    };
    Doc.rename = function(path, newpath, server) {
        var doc = Doc.forPath(path, server);
        if (doc) {
            doc.setPath(newpath);
            Tabs.setName(doc.id, Doc.getName(doc.id));
            doc.safe = false;
            sessionSave();
            Doc.persist();
            return true;
        }
        return false;
    };
    Doc.setEncoding = function(id, encoding) {
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
        }
        else {
            Notify.error('Encoding ' + encoding + ' not supported by this storage device');
        }
    };
    Doc.saveDocs = function(id, callback, force) {
        //save all non shadow docs
        //or specified doc
        if (id !== undefined) {
            if (docs[id].shadowDoc) {
                var mainDoc = Doc.forPath(docs[id].getSavePath(), docs[id].getFileServer());
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
        }
        else {
            for (var i in docs)
                if ((docs[i].dirty || force) && docs[i].allowAutoSave && !docs[i].shadowDoc)
                    Doc.saveDocs(i, callback);
            autoSave.cancel();
        }
    };
    Doc.refreshDocs = function(id) {
        var next = [];
        if (id) {
            if (!docs[id].isTemp())
                next = [id];
        }
        else
            for (var i in docs) {
                if (docs[i].isTemp())
                    continue;
                next.push(i);
            }
        var advance = function() {
            if (next.length < 1) return;
            var i = next.pop();
            try {
                var a = docs[i].refresh(advance, !!docs[i].forceReload, true);
                delete docs[i].forceReload;
                if (!a)
                    advance();
            }
            catch (e) {
                console.error(e);
                advance();
            }
        };
        advance();
        advance();
        //async but needs to ensure all docs
        //are refreshed regardless of errors
        //setTimeout would have been better though
    };
    Doc.dirty = function(id) {
        docs[id].setDirty();
    };

    var sessionSave = Utils.delay(Doc.tempSave, 5000);
    var autoSave = Utils.delay(Doc.saveDocs, 60000);

    Doc.numDocs = function() {
        var num = 0;
        for (var i in docs) num++;
        return num;
    };
    Doc.forPath = function(path, server) {
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
    Doc.forSession = function(session) {
        for (var id in docs) {
            var doc = docs[id];
            if (doc.session == session || (doc.clones && doc.clones.indexOf(session) > -1)) {
                return doc;
            }
        }
    };
    Doc.closeSession = function(session) {
        var doc = Doc.forSession(session);
        if (session == doc.session) {
            if (doc.clones && doc.clones.length > 0) {
                temp = doc.clones[0];
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


    var blobRegistry = getObj('blobRegistry', { size: 0 });
    var blobClearTimeout;

    //must be a synchronous file storage
    var blobStorage = global.appStorage;
    //blob is like stash for open documents
    //unlike stash it uses size as a metric
    Doc.saveBlob = function(id, name, value, priority, data) {
        var t = Doc.hasBlob(id, name);
        if (t)
            Doc.removeBlob(t);
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
            blobStorage.setItem(manifest.key, value);
        }
        catch (e) {
            try {
                blobStorage.removeItem(manifest.key);
            }
            catch (e) {}
            return false;
        }
        blobRegistry[manifest.key] = manifest;
        blobRegistry.size += manifest.size;
        if (blobRegistry.size > Utils.parseSize(appConfig.maxStoreSize)) {
            if (!blobClearTimeout) {
                blobClearTimeout = setTimeout(function() {
                    blobClearTimeout = null;
                    Doc.cleanBlobs(true);
                }, 0);
            }
        }
        putObj("blobRegistry", blobRegistry);
        return manifest.key;
    };
    Doc.hasBlob = function(id, name) {
        for (var i in blobRegistry) {
            if (i == 'size') continue;
            if (blobRegistry[i].id == id && (!name || blobRegistry[i].type == name)) {
                return i;
            }
        }
    };
    Doc.removeBlob = function(key) {
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
    Doc.restoreBlob = function(key) {
        if (blobRegistry.hasOwnProperty(key)) {
            var manifest = blobRegistry[key];
            var value = blobStorage.getItem(manifest.key);
            if (!value) {
                Doc.removeBlob(key);
                return false;
            }
            if (manifest.obj)
                value = JSON.parse(value);
            return value;
        }
        return false;
    };
    Doc.cleanBlobs = function(force) {
        var maxSize = Utils.parseSize(appConfig.maxStoreSize);
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
            Doc.removeBlob(toClean[i].key);
        }
        if (blobRegistry.size > maxSize) {
            Doc.cleanBlobs(true);
        }
    };
    Doc.allBlobs = function(id) {
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
    Doc.registerFactory = function(type, constructor) {
        __factory[type] = constructor;
    };

    Doc.stashDoc = function(path, text) {
        var key;
        if (path && !path.startsWith(":"))
            key = Doc.saveBlob("stashExpiry", path, text, STASH_PRIORITY, { expiry: Math.floor(new Date().getTime() / 1000) });
        return key;
    };
    Doc.cleanStash = function() {
        var current = new Date().getTime();
        current -= Utils.parseTime(appConfig.stashExpiryTime);
        current = current / 1000;
        var keys = Doc.allBlobs('stashExpiry');
        for (var j in keys) {
            var i = keys[j];
            if (blobRegistry[i].expiry < current) {
                Doc.removeBlob(i);
            }
        }
    };
    Doc.restoreStash = function(path, doc) {
        var key = Doc.hasBlob('stashExpiry', path);
        if (key) {
            var text = Doc.restoreBlob(key);
            Doc.removeBlob(key);
            try {
                var content = JSON.parse(text);
                var value = doc.getValue();
                jsonToSession(doc.session, content);
                if (content.content != value) {
                    doc.setValue(value);
                }
            }
            catch (e) {
                return null;
            }
            return doc;
        }
    };


    Doc.initialize = function(tabs) {
        app = global.AppEvents;
        app.on('changeTab', function(e) {
            updateIcon(e.tab, true);
        });
        Tabs = tabs;
        Tabs.registerPopulator('m', Doc);
        Doc.fromJSON();
        Tabs.recreate();
    };
    Doc.toJSON = function() {
        var h = {};
        for (var i in docs) {
            h[i] = docs[i].isTemp() ? null : docs[i].getSavePath();
        }
        return JSON.stringify(h);
    };
    Doc.fromJSON = function(json) {
        json = json || appStorage.getItem("docs");
        if (!json) return;
        json = JSON.parse(json);

        for (var i in json) {
            if (docs[i]) continue;
            var state = appStorage.getItem(i);
            if (state) {
                try {
                    state = JSON.parse(state);
                }
                catch (e) {
                    state = null;
                    //appStorage.removeItem(i);
                    Notify.error("Error loading save for </br>" + json[i], 1000);
                    //maybe later we can do recovery
                    //for now blah, I feel I will regret this
                }
            }
            try {
                if (state) {
                    if (state.factory) {
                        if (__factory[state.factory]) {
                            var c = __factory[state.factory];
                            docs[i] = new c("", json[i], undefined, i);
                        }
                        else {
                            //factory not registered
                            console.error('Unknown factory ' + state.factory);
                            continue;
                        }
                    }
                    else docs[i] = new Doc("", json[i], undefined, i);
                    contentLoader.load(docs[i], state);
                    docs[i].safe = true;
                    addDoc("", docs[i], undefined, state.mode, null, false);
                }
                else {
                    if (contentLoader.canRecover(i)) {
                        //lost state, reload
                        docs[i] = new Doc("", json[i], undefined, i);
                        contentLoader.recover(i, docs[i]);
                    }
                    else if (json[i]) {
                        docs[i] = new Doc("", json[i], undefined, i);
                        if (!docs[i].isTemp()) {
                            docs[i].forceReload = true;
                        }
                    }
                    else continue;
                    addDoc("", docs[i], undefined, undefined, null, false);
                    //todo this will likely be a problem

                }
            }
            catch (e) {
                console.error(e);
            }
        }
        Doc.cleanStash();
    };
    Doc.persist = function() {
        appStorage.setItem("docs", Doc.toJSON());
    };

    //move to tabs
    Doc.addTabAnnotation = function(id, anno) {
        var doc = docs[id];
        if (doc) {
            if (!doc.annotations) doc.annotations = [];
            doc.annotations.push(anno);
            Tabs.setAnnotations(id, doc.annotations);
            return doc.annotations;
        }
        else {
            Tabs.setAnnotations(id, [anno]);
        }
    };
    Doc.removeTabAnnotation = function(id, anno) {
        var doc = docs[id];
        if (doc) {
            doc.annotations = doc.annotations && doc.annotations.filter(function(e) {
                return e !== anno;
            });
            Tabs.setAnnotations(id, doc.annotations);
        }
        else {
            Tabs.setAnnotations(id, null);
        }
    };


    function addDoc(name, content /*-doc-*/ , path, mode /*-use true to keep mode-*/ , data, select = true) {
        var b, doc;
        //use cases in searchtab addDoc(,doc,path)
        //main use adddoc(,doc,path,mode)
        //filebrowser adddoc(n,c,p)
        if (typeof name == "object") {
            doc = name;
            name = undefined;
            content = undefined;
            //console.warn('Use of deprecated api addDoc(doc)')
        }
        else if (typeof content == "object") {
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
        }
        else {
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
            Doc.persist();
            if (!name) {
                name = Doc.getName(doc.id);
            }
            Tabs.addTab(doc.id, name, doc.annotations);
        }
        if (!doc.bound) {
            if (path)
                Doc.restoreStash(path, doc);
            doc.onChange = Doc.prototype.onChange.bind(doc);
            doc.onChangeMode = function(mode) {
                if (mode.$id != doc.options.mode) {
                    doc.options.mode = mode.$id;
                    doc.safe = false;
                    sessionSave();
                }
            };
            doc.session.on("change", doc.onChange);
            doc.session.on('changeMode', doc.onChangeMode);
            doc.bound = true;
            app.trigger('createDoc', { doc: doc });
        }

        //this usually is valid assumption
        if (content !== undefined && path)
            doc.setClean();

        if (select)
            Tabs.setActive(doc.id, true, true);
        return doc.id;
    }

    function closeDoc(docId, replace, keepUndos) {
        var doc = docs[docId];
        if (doc.clones && doc.clones.length) {
            throw 'Error: Doc is currently in use';
        }
        if (keepUndos === undefined) keepUndos = appConfig.keepDocumentsOnClose;
        var key;
        while ((key = Doc.hasBlob(docId))) {
            Doc.removeBlob(key);
        }
        if (doc.bound && keepUndos && !doc.isTemp() && doc.getSavePath()) {
            Doc.stashDoc(doc.getSavePath(), JSON.stringify(defaultSaver.save(doc)));
        }
        if (appStorage.getItem(docId)) {
            appStorage.removeItem(docId);
        }
        else {
            if (doc.safe) console.error("Unsafe doc with safe flag");
        }
        if (doc.bound) {
            doc.session.off("change", doc.onChange);
            doc.session.off("changeMode'", doc.onChangeMode);
            app.trigger('closeDoc', { doc: doc, id: docId });
        }
        doc.session.destroy();
        delete docs[docId];
        Doc.persist();

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
        if (!fromEvent && id != app.getCurrentTab()) return;
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
    Doc.swapDoc = function(id) {
        if (Tabs.active != id)
            Tabs.setActive(id, true, true);
        
    };

    Doc.openDoc = function(path, server, cb) {
        FileUtils.getDoc(path, server, function(doc, error) {
            if (error) return cb(error);
            addDoc(doc);
            doc.setClean();
            cb && cb(null, doc);
        });
    };
    //TabHolder interface
    Doc.getName = function(id) {
        var doc = docs[id];
        if (doc) {
            Utils.assert(doc.getPath(), 'bad doc');
            if (doc.isTemp()) {
                return "unsaved(" + (Tabs.indexOf(id) < 0 ? Tabs.numTabs() : Tabs.indexOf(id)) + ")";
            }
            else return FileUtils.filename(doc.getPath());
        }
        return null;
    };
    Doc.getAnnotations = function(id) {
        return docs[id].annotations;
    };
    Doc.getInfo = function(id) {
        return docs[id].isTemp() ? docs[id].id.substring(5) : docs[id].getSavePath();
    };
    global.Functions.newFile = newFile;
    global.docs = docs;
    global.addDoc = addDoc;
    global.closeDoc = closeDoc;
    global.Doc = Doc;
})(Modules);