define(function(require, exports, module) {
    var EditSession = ace.require("ace/edit_session").EditSession;
    var AceDocument = ace.require("ace/document").Document;
    var Utils = require("../core/utils").Utils;
    var FileUtils = require("../core/file_utils").FileUtils;
    var Notify = require("../ui/notify").Notify;

    var docs = Object.create(null);
    var Range = ace.require("ace/range").Range;
    var Docs = exports.Docs || (exports.Docs = {});
    var appConfig = require("../core/config").Config.registerAll({},
        "documents");
    var debug = console;
    //an extension to Ace Document that manges it's own session
    function Doc(content, path, mode, id, orphan) {
        Doc.super(this, [content || ""]);
        if (id) {
            this.id = id;
        } else {
            this.id = Utils.genID("m");
        }
        if (id && docs[id]) {
            throw new Error("Creating doc with existing id");
        }
        this.setPath(path);

        //circular reference
        this.session = new EditSession(this, mode);

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
    Utils.inherits(Doc, AceDocument);

    //a unique path for all opened docs
    //uses duplicateId for duplicates
    //there is usually no reason to change this
    //code and it may be inlined in future
    Doc.prototype.getPath = function() {
        return this.duplicateId ? this.path + "~~" + this
            .duplicateId : this.path;
    };
    Doc.prototype.setPath = function(path) {
        if (!path) {
            this.path = "temp:///" + this.id.substring(0);
            this.setDirty();
            return;
        }
        path = FileUtils.normalize(path);
        if (path == this.path) return;
        //shadow docs,
        //ensure getpath is unique
        //save file to update duplicateId value
        if (Docs.forPath(path)) {
            //0 would test false
            this.duplicateId = 1;
            var a;
            while ((a = Docs.forPath(path + "~~" + this
                    .duplicateId))) {
                this.duplicateId++;
                if (a == this) throw new Error(
                    "Infinite Looping caught!!");
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
        return this.encoding || FileUtils.encodingFor(this
            .getSavePath(), this.getFileServer());
    };
    Doc.prototype.getFileServer = function() {
        return FileUtils.getFileServer(this.fileServer, true);
    };
    Doc.prototype.save = function(callback) {
        var fs = this.getFileServer();
        var self = this;
        var rev;
        if (this.session.$undoManager) {
            rev = this.session.$undoManager.startNewGroup();
        }
        var res = this.session.getValue();

        fs.writeFile(this.path, res, this.getEncoding(), function(
            err) {
            if (!err && rev != undefined) self.setClean(rev,
                res);
            callback && callback(self, err);
        });
    };
    Doc.prototype.refresh = function(callback, force, ignoreDirty) {
        if (this.isTemp()) return false;
        var doc = this;

        function load() {
            doc.getFileServer().readFile(doc.getSavePath(), doc
                .getEncoding(),
                function(err, res) {
                    if (!err || err.code == "ENOENT")
                        Docs.setValue(doc, res, callback, force,
                            ignoreDirty);
                    else {
                        doc.setDirty();
                        callback && callback(doc, err);
                        Notify.error("Failed to load " + doc
                            .getPath() + " " + err.code);
                    }
                });
        }
        //todo stat file first
        load();
        return true;
    };

    Doc.prototype.isTemp = function() {
        return this.path.startsWith("temp:/");
    };

    Doc.prototype.serialize = function() {
        var obj = sessionToJson(this.session);
        obj.lastSave = this.lastSave;
        obj._LSC = this._LSC;
        obj.dirty = this.dirty;
        obj.options = this.options;
        obj.flags = this.flags;
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
        this.flags = obj.flags;
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
            history: undoManager.$undoStack ?
                {
                    undo: shrink(undoManager.$undoStack).map(
                        filterHistory),
                    redo: undoManager.$redoStack.map(filterHistory),
                    m: undoManager.$maxRev,
                    b: undoManager.$redoStackBaseRev !== undoManager
                        .$rev ?
                        undoManager.$redoStackBaseRev :
                        "",
                } :
                null,
            folds: session
                .getAllFolds()
                .map(function(fold) {
                    return {
                        start: {
                            row: fold.start.row,
                            column: fold.start.column,
                        },
                        end: {
                            row: fold.end.row,
                            column: fold.end.column,
                        },
                        placeholder: fold.placeholder,
                    };
                })
                .filter(function(e) {
                    if (e.start.row > e.end.row) {
                        //Corrupted folds: no longer needed
                        return false;
                    }
                    return true;
                }),
        };
    }

    function jsonToSession(session, state) {
        session.setValue(state.content);
        if (state.content) {
            session.selection.fromJSON(state.selection);
            session.setScrollTop(state.scrollTop);
            session.setScrollLeft(state.scrollLeft);
            try {
                state.folds.forEach(function(fold) {
                    session.addFold(fold.placeholder, Range
                        .fromPoints(fold.start, fold.end));
                });
            } catch (e) {
                debug.error("Fold exception: " + e);
            }
        }
        if (state.history) {
            var manager = session.$undoManager;
            if (!manager) session.setUndoManager((manager = new ace
                .UndoManager()));
            manager.$undoStack = state.history.undo || [];
            manager.$redoStack = state.history.redo || [];
            manager.$maxRev = state.history.m;

            //backwards compatibility
            if (state.history.b) manager.$redoStackBaseRev = state
                .history.b;
            else manager.$redoStackBaseRev = state.history.m;
            manager.$syncRev();
        }
    }

    Doc.prototype.isReadOnly = function() {
        return this.editorOptions && this.editorOptions.readOnly;
    };
    Doc.prototype.setValue = function(e, isClean) {
        var u = this.session.$undoManager;
        var hadValue =
            u &&
            (this.getLength() > 1 ||
                this.getSize() > 1 ||
                u.$undoStack.length ||
                u.$redoStack.length);

        AceDocument.prototype.setValue.call(this, e);

        if (u && !hadValue) {
            this.session.$undoManager.reset();
        }
        if (isClean && !this.isTemp()) {
            this.setClean(null, e);
        }
    };

    Doc.prototype.updateValue = function(res, isClean) {
        var a = Docs.generateDiff(this.getValue(), res);
        var t = this;
        for (var i in a) {
            t.applyDelta(a[i]);
        }
        //generate diff normalizes newlines to linux mode
        this.$detectNewLine(res);
        //TODO fix - Remove this test to prevent unnecessary full refresh. This mostly happens
        //due to doc.$newlineCharacter and causes refresh prompts
        //until the document is saved not sure the best way to fix this
        if (this.getSize() !== res.length) {
            if (/\r(?:[^\n]|$)/.test(res) + /\r\n/.test(res) +
                /(?:^|[^\r])\n/.test(res) > 1) {
                Notify.error(Docs.getName(this.id) +
                    " has multiple line endings");
                return this.updateValue(res.replace(/\r\n?/g, /\n/,
                    isClean));
            }
            debug.error("Generate diff failed length check");
            this.setValue(res, isClean);
        } else if (isClean && !this.isTemp()) {
            this.setClean(null, res);
        }
    };
    Doc.prototype.getSize = function() {
        var lastLine = this.session.getLength();
        if (lastLine < 1) return 0;
        var doc = this;
        var sum = doc.getNewLineCharacter().length * (lastLine - 1);
        for (; lastLine > 0;) {
            sum += doc.getLine(--lastLine).length;
        }
        return sum;
    };

    //I think undomanger should be adopted directly tooo
    Doc.prototype.clearHistory = function() {
        this.session.getUndoManager().reset();
    };
    Doc.prototype.abortChanges = function(tillLastSave) {
        var manager = this.session.getUndoManager();
        while (manager.canUndo() && (!tillLastSave || manager
                .getRevision() > this.lastSave)) {
            manager.undo();
        }
        //why don't we check revision
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
        n = n.length > 0 ? Number(n[n.length - 1][0].id) : 0;
        if (doc.lastSave === n) {
            if (doc.dirty) {
                doc.dirty = false;
                Docs.$updateStatus(doc.id);
            }
        }
    }, 0);
    Doc.prototype.onChange = function() {
        var self = this;
        if (self.$fromSerial) return;
        if (self.session.$undoManager.$fromUndo) checkRevision(
        self);
        if (self.safe) self.safe = false;
        if (!self.dirty) self.setDirty(true);
        if (self.allowAutoSave) {
            Docs.$autoSave();
        }
        Docs.$sessionSave();
    };
    Doc.prototype.onChangeMode = function() {
        var mode = this.session.getMode();
        if (mode.$id != this.options.mode) {
            this.options.mode = mode.$id;
            this.safe = false;
            Docs.$sessionSave();
        }
    };
    Doc.prototype.setDirty = function(fromChange) {
        if (!fromChange) {
            this.lastSave = null;
        }
        this.dirty = true;
        Docs.$updateStatus(this.id);
    };
    Doc.prototype.setClean = function(rev, res) {
        var doc = this;
        doc.lastSave = rev || doc.getRevision();
        //last save checksum, for now we use length
        doc._LSC = doc.getChecksum(res);
        doc.dirty = false;
        //todo put this data elsewhere
        //like in a smaller header
        doc.safe = false;
        Docs.$sessionSave();
        Docs.$updateStatus(this.id);
    };
    Doc.prototype.getChecksum = function(res) {
        //to implement
        return 1 + (res || this.session.getValue()).length;
    };
    Doc.prototype.isLastSavedValue = function(res) {
        return this._LSC === 1 + res.length;
    };
    Doc.prototype.fork = function(orphan) {
        var fork = new Doc("", this.getSavePath(), this.options
            .mode, undefined, orphan);
        var data = this.serialize();
        //Ace editor sometimes modifies undos
        data.history = JSON.parse(JSON.stringify(data.history));
        fork.unserialize(data);
        return fork;
    };

    Doc.prototype.cloneSession = function() {
        var session = this.session;
        var s = new EditSession(this, session.getMode());
        var undoManager = session.$undoManager;
        s.setUndoManager(undoManager);
        // Copy over 'settings' from the session.
        s.setTabSize(session.getTabSize());
        s.setUseSoftTabs(session.getUseSoftTabs());
        s.setOverwrite(session.getOverwrite());
        s.setBreakpoints(session.getBreakpoints());
        s.setUseWrapMode(session.getUseWrapMode());
        s.setUseWorker(session.getUseWorker());
        s.setWrapLimitRange(session.$wrapLimitRange.min, session
            .$wrapLimitRange.max);
        s.$foldData = session.$cloneFoldData();
        this.clones = this.clones || [];
        this.clones.push(s);
        return s;
    };

    Docs.$jsonToSession = jsonToSession;
    Docs.$sessionToJson = sessionToJson;
    exports.Doc = Doc;
    exports.$Docs = Docs; //needed for hidden methods
    exports.docs = docs;
}); /*_EndDefine*/
