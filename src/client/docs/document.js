define(function (require, exports, module) {
    /* globals ace */
    var EditSession = require('ace!edit_session').EditSession;
    var AceDocument = require('ace!document').Document;
    var Range = require('ace!range').Range;
    var Utils = require('../core/utils').Utils;
    var RefCounted = require('../core/ref_counted').RefCounted;
    var FileUtils = require('../core/file_utils').FileUtils;
    var Notify = require('../ui/notify').Notify;
    //Uses methods that will be added in docs
    /** @type {import('./docs').Docs} Docs*/
    // @ts-ignore
    var Docs = require('./docs_base').Docs;
    var cyclicRequire = require;
    cyclicRequire('./docs');
    var debug = console;
    //an extension to Ace Document.
    function Doc(content, path, mode, id, orphan) {
        Doc.super(this, [content || '']);
        RefCounted.call(this);
        if (id) {
            this.id = id;
        } else {
            this.id = Utils.genID('m');
        }
        if (id && Docs.has(id)) {
            throw new Error('Creating doc with existing id');
        }
        if (orphan) {
            this.orphan = orphan;
        } else Docs.$set(this.id, this);

        this.setPath(path);
        //circular reference
        this.session = new EditSession(this, mode);
        this.session.setOptions(Docs.$defaults);
        //TODO stop sessions from starting workers until they are visible
        this.options = {};
        if (mode) this.options.mode = mode;
        //needs saving
        this.dirty = false;
        //needs caching
        if (orphan) return;
        this.$safe = false;
        // @ts-ignore
        this.onChange = this.onChange.bind(this);
        // @ts-ignore
        this.syncMode = this.syncMode.bind(this);
        this.on('change', this.onChange);
        this.session.on('changeMode', this.syncMode);
    }
    Utils.inherits(Doc, AceDocument, RefCounted);
    //a unique path for all opened documents
    //uses duplicateId for duplicates
    //there is usually no reason to change this
    //code and it may be inlined in future
    Doc.prototype.getPath = function () {
        return this.duplicateId
            ? this.path + '~~' + this.duplicateId
            : this.path;
    };

    Doc.prototype.setPath = function (path) {
        if (!path) {
            path = 'temp:/' + this.id;
        }
        path = FileUtils.normalize(path);
        if (path == this.path) return;
        //For duplicate documents,
        //ensure getpath is unique
        //save file to update duplicateId value
        if (Docs.forPath(path)) {
            //0 would test false
            this.duplicateId = 1;
            var a;
            while ((a = Docs.forPath(path + '~~' + this.duplicateId))) {
                this.duplicateId++;
                // @ts-ignore - Overlapping types
                if (a === this) throw new Error('Infinite Looping caught!!');
            }
        }
        if (this.path) {
            this.path = path;
            Docs.persist(); //renaming should trigger set path
        } else this.path = path;
        if (this.isTemp()) this.setDirty();
    };
    //the actual path that is used to save files
    //override save/refresh if you override this
    Doc.prototype.getSavePath = function () {
        return this.isTemp() ? null : this.path;
    };
    Doc.prototype.getEncoding = function () {
        return (
            this.encoding ||
            FileUtils.detectEncoding(this.getSavePath(), this.getFileServer())
        );
    };
    Doc.prototype.setEncoding = function (encoding) {
        this.encoding = encoding;
        this.$safe = false;
        Docs.$persistDoc();
    };
    Doc.prototype.getFileServer = function () {
        return FileUtils.getFileServer(this.fileServer, true);
    };
    Doc.prototype.save = function (callback) {
        var fs = this.getFileServer();
        var self = this;
        var rev = this.getRevision();
        var res = this.session.getValue();

        fs.writeFile(this.path, res, this.getEncoding(), function (err) {
            if (!err && rev != undefined) self.setClean(rev, res);
            callback && callback(self, err);
        });
    };
    /**
     * @callback(err:Error, refreshed:boolean)
     * @returns {boolean}
     */
    Doc.prototype.refresh = function (callback, ignoreDirty, confirm) {
        if (this.isTemp()) return callback(null, false);
        var doc = this;
        doc.getFileServer().readFile(
            doc.getSavePath(),
            doc.getEncoding(),
            function (err, res) {
                Docs.onRefresh(doc, err, res, callback, ignoreDirty, confirm);
            },
        );
        //todo stat file first
        return true;
    };

    Doc.prototype.isReadOnly = function () {
        return this.editorOptions && this.editorOptions.readOnly;
    };
    Doc.prototype.isTemp = function () {
        return this.path.startsWith('temp:/');
    };

    //State management
    function filterHistory(deltas) {
        var m = deltas.filter(function (d) {
            return d.action != 'removeFolds';
        });
        return m.length < deltas.length ? m : deltas;
    }
    Doc.prototype.saveState = function () {
        var session = this.session;
        var undoManager = session.getUndoManager();
        return {
            content: session.getValue(),
            selection: session.getSelection().toJSON(),
            scrollTop: session.getScrollTop(),
            scrollLeft: session.getScrollLeft(),
            history: undoManager.$undoStack
                ? {
                      undo: undoManager.$undoStack.map(filterHistory),
                      redo: undoManager.$redoStack.map(filterHistory),
                      m: undoManager.$maxRev,
                      b:
                          undoManager.$redoStackBaseRev !== undoManager.$rev
                              ? undoManager.$redoStackBaseRev
                              : undefined,
                  }
                : null,
            folds: session
                .getAllFolds()
                .map(function (fold) {
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
                .filter(function (e) {
                    if (e.start.row > e.end.row) {
                        //Corrupted folds: no longer needed
                        return false;
                    }
                    return true;
                }),
        };
    };
    Doc.prototype.createHistory = function (state) {
        var manager = new ace.UndoManager();
        if (!state || !state.history) return manager;
        manager.$undoStack = state.history.undo || [];
        manager.$redoStack = state.history.redo || [];
        manager.$maxRev = state.history.m;
        manager.$syncRev();
        if (state.history.b) manager.$redoStackBaseRev = state.history.b;
        return manager;
    };
    Doc.prototype.restoreView = function (state, session) {
        if (!session) {
            this.restoreView(state, this.session);
            return (
                this.clones &&
                this.clones.forEach(this.restoreView.bind(this, state))
            );
        }
        session.selection.fromJSON(state.selection);
        session.setScrollTop(state.scrollTop);
        session.setScrollLeft(state.scrollLeft);
        try {
            state.folds.forEach(function (fold) {
                session.addFold(
                    fold.placeholder,
                    Range.fromPoints(fold.start, fold.end),
                );
            });
        } catch (e) {
            debug.error('Fold exception: ' + e);
        }
    };
    Doc.prototype.setHistory = function (undoManager, session) {
        if (!session) {
            this.setHistory(undoManager, this.session);
            if (this.clones)
                this.clones.forEach(this.setHistory.bind(this, undoManager));
        } else session.setUndoManager(undoManager);
    };
    Doc.prototype.restoreState = function (state, session) {
        if (state.checksum) return; //needs a content loader
        this.session.setValue(state.content);
        this.restoreView(state, session);
        if (state.history) {
            this.setHistory(this.createHistory(state), session);
        }
    };
    Doc.prototype.serialize = function () {
        var obj = this.saveState();
        obj.saveRev = this.saveRev;
        obj._LSC = this._LSC; //last saved checksum
        obj.dirty = this.dirty;
        obj.options = this.options;
        obj.fileServer = this.fileServer;
        obj.encoding = this.encoding;
        obj.allowAutosave = this.allowAutosave;
        obj.editorOptions = this.editorOptions;
        obj.factory = this.factory; //prototype value
        return obj;
    };
    Doc.prototype.unserialize = function (json) {
        var obj = json;
        this.$fromSerial = true;
        this.restoreState(obj);
        this.$fromSerial = false;
        this.saveRev = obj.saveRev;
        this._LSC = obj._LSC;
        this.dirty = obj.dirty;
        this.options = obj.options || {};
        this.session.setOptions(this.options);
        this.fileServer = obj.fileServer;
        this.encoding = obj.encoding;
        this.allowAutosave = obj.allowAutosave;
        this.editorOptions = obj.editorOptions;
    };
    Doc.prototype.factory = undefined;
    Doc.prototype.setValue = function (e, isClean) {
        var u = this.session.$undoManager;
        var hadValue =
            u &&
            (this.getLength() > 1 ||
                this.getSize() > 0 ||
                u.$undoStack.length > 0 ||
                u.$redoStack.length > 0);

        AceDocument.prototype.setValue.call(this, e);

        if (u && !hadValue) this.session.$undoManager.reset();
        if (isClean && !this.isTemp()) this.setClean(null, e);
    };
    Doc.prototype.updateValue = function (res, isClean, minRowGap) {
        this.$detectNewLine(res);
        var a = Docs.generateDiff(this.getValue(), res);
        if (minRowGap === undefined) minRowGap = 5;
        var lastRow = Infinity;
        for (var i = 0; i < a.length; i++) {
            var d = a[i];
            if (d.start.row > lastRow) {
                this.getRevision();
            }
            this.applyDelta(d);
            lastRow = minRowGap + (d.action === 'delete' ? d.start.row : d.end.row);
        }
        if (this.getSize() !== res.length) {
            if (this.getNewLineCharacter() !== this.$autoNewLine) {
                Notify.warn(
                    'Attempted to change newline character in ' +
                        Docs.getName(this.id) +
                        '.',
                );
            } else if (
                +/\r(?:[^\n]|$)/.test(res) +
                    +/\r\n/.test(res) +
                    +/(?:^|[^\r])\n/.test(res) >
                1
            ) {
                Notify.warn(
                    Docs.getName(this.id) +
                        ' had multiple new line characters.',
                );
            } else {
                debug.error('Generate diff failed length check');
                this.setValue(res, isClean);
            }
        } else if (isClean && !this.isTemp()) {
            this.setClean(null, res);
        }
    };
    Doc.prototype.getSize = function () {
        var lastLine = this.session.getLength();
        if (lastLine < 1) return 0;
        var doc = this;
        var sum = doc.getNewLineCharacter().length * (lastLine - 1);
        for (; lastLine > 0; ) {
            sum += doc.getLine(--lastLine).length;
        }
        return sum;
    };

    Doc.prototype.clearHistory = function () {
        this.session.getUndoManager().reset();
    };
    Doc.prototype.abortChanges = function (fromRevision) {
        if (fromRevision && typeof fromRevision === 'boolean')
            fromRevision = this.saveRev;
        else if (!fromRevision) fromRevision = 0;
        var manager = this.session.getUndoManager();
        while (manager.canUndo() && manager.getRevision() > fromRevision) {
            manager.undo();
        }
        return manager.getRevision() === fromRevision;
    };
    Doc.prototype.getDeltas = function (start) {
        return this.session.getUndoManager().getDeltas(start || 0);
    };
    Doc.prototype.getRevision = function () {
        Docs.$checkInit(this);
        return this.session.getUndoManager().startNewGroup();
    };
    Doc.prototype.redoChanges = function () {
        var manager = this.session.getUndoManager();
        while (manager.canRedo()) {
            manager.redo();
        }
        checkRevision(this);
    };
    Doc.prototype.getChecksum = function (res) {
        //to implement
        return 1 + (typeof res === 'string' ? res.length : this.getSize());
    };
    Doc.prototype.isLastSavedValue = function (res) {
        return this._LSC === this.getChecksum(res);
    };

    var checkRevision = Utils.delay(function (doc) {
        //detect when a document is no longer dirty
        //the timeout is needed because the changes are called
        //in the middle of undo/redo operations
        var n = doc.session.getUndoManager().$undoStack;
        if (!n) return;
        n = n.length > 0 ? Number(n[n.length - 1][0].id) : 0;
        if (doc.saveRev === n) {
            if (doc.dirty) {
                doc.dirty = false;
                Docs.$updateStatus(doc.id);
            }
        }
    }, 0);
    //@ts-ignore - Will be bound in constructor
    Doc.prototype.onChange = function () {
        var self = this;
        if (self.$fromSerial) return;
        if (self.session.getUndoManager().$fromUndo) checkRevision(self);
        if (!self.dirty) self.setDirty(true);
        Docs.$autoSave();
        self.$safe = false;
        Docs.$persistDoc();
    };
    Doc.prototype.toggleAutosave = function (on) {
        this.allowAutosave = on;
        this.$safe = false;
        Docs.$persistDoc();
    };
    //@ts-ignore - Will be bound in constructor
    Doc.prototype.syncMode = function () {
        var mode = this.session.getMode().$id;
        if (mode != this.options.mode) {
            this.setOption('mode', mode);
        }
    };
    Doc.prototype.setOption = function (name, value) {
        var opts =
            name == 'mode' || Docs.$defaults.hasOwnProperty(name)
                ? this.options
                : this.editorOptions || (this.editorOptions = {});
        if (value != opts[name]) {
            if (value === undefined) delete opts[name];
            else opts[name] = value;
            this.$safe = false;
            Docs.$persistDoc();
            if (opts === this.options) {
                this.session.setOption(name, value);
                this.clones &&
                    this.clones.forEach(function (e) {
                        e.setOption(name, value);
                    });
            }
        }
    };
    Doc.prototype.setDirty = function (fromChange) {
        if (!fromChange) this.saveRev = null;
        this.dirty = true;
        Docs.$updateStatus(this.id);
    };
    Doc.prototype.setClean = function (rev, res) {
        if (rev === undefined) rev = null;
        this.saveRev = rev === null ? this.getRevision() : rev;
        this._LSC = this.getChecksum(res);
        this.dirty = rev !== null && rev !== this.getRevision();
        this.$safe = false;
        Docs.$persistDoc();
        Docs.$updateStatus(this.id);
    };

    Doc.prototype.fork = function (orphan) {
        var fork = new Doc(
            '',
            this.getSavePath(),
            this.options.mode,
            undefined,
            orphan,
        );
        var data = this.serialize();
        //Ace editor sometimes modifies undos
        // data.history = JSON.parse(JSON.stringify(data.history));
        fork.unserialize(data);
        return fork;
    };
    Doc.prototype.cloneSession = function (exclusive) {
        //Duplicate this here for plugins using Docs that are not opened in tabs
        Docs.$checkInit(this);
        var session = this.session;
        var s = new EditSession(this, session.getMode());
        s.setOptions(Docs.$defaults);
        s.setOptions(this.options);
        s.setWrapLimitRange(
            session.$wrapLimitRange.min,
            session.$wrapLimitRange.max,
        );
        s.setUndoManager(session.$undoManager);
        s.setUseWorker(session.getUseWorker());
        // Copy over 'settings' from the session.
        // s.setTabSize(session.getTabSize());
        // s.setUseSoftTabs(session.getUseSoftTabs());
        // s.setOverwrite(session.getOverwrite());
        // s.setBreakpoints(session.getBreakpoints());
        // s.setUseWrapMode(session.getUseWrapMode());

        s.$foldData = session.$cloneFoldData();
        s.$isMain = !exclusive;
        (this.clones || (this.clones = [])).push(s);
        return s;
    };
    Doc.prototype.closeSession = function (session) {
        if (session == this.session) {
            if (this.clones) {
                for (var i = 0; i < this.clones.length; i++)
                    if (this.clones[i].$isMain) {
                        this.session = this.clones[i];
                        this.clones[i] = session;
                        session.off('changeMode', this.syncMode);
                        this.session.on('changeMode', this.syncMode);
                        break;
                    }
                if (session === this.session) return false;
            }
            //don't close session while there are refs
            else return false;
        }
        if (!this.clones || Utils.removeFrom(this.clones, session) < 0) {
            if (session.getDocument() !== this)
                //Already closed
                throw new Error('Asked to close session doc does not own!!');
            else return true;
        }
        session.destroy();
        return true;
    };

    Doc.prototype.destroy = function () {
        if (this.clones && this.clones.length > 1) {
            debug.warn(
                'Destroying document that is still in use. Acquire ref while using a document.',
            );
        }
        Docs.$clearDocData(this.id);
        this.session.destroy();
        this.removeAllListeners();
        this.setValue('');
        this.clearHistory();
    };
    exports.Doc = Doc;
}); /*_EndDefine*/
