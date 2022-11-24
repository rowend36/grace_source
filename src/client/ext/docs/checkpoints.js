define(function (require, exports, module) {
    var Docs = require('grace/docs/docs').Docs;
    var Doc = require('grace/docs/document').Doc;
    var Utils = require('grace/core/utils').Utils;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            maximumCheckpoints: 9,
        },
        'documents'
    );
    require('grace/core/config').Config.registerInfo(
        {
            maximumCheckpoints:
                'Checkpoints allow you to jump between locations in history quickly. Note: Checkpoints are always deleted when a document is closed. Also, saving a checkpoint might fail if a document is very large',
        },
        'documents'
    );
    //priority for checkpoints user creates
    var USER_CHECKPOINT_PRIORITY = 15;
    var TEMP_CHECKPOINT_PRIORITY = 5;
    var clearCheckpoints = Utils.noop;
    Doc.prototype.checkout = function (checkpoint, data, cb) {
        var doRestore = function doRestore(data) {
            if (data) {
                this.$stateID = checkpoint.name;
                this.setDirty();
                this.restoreState(data);
                this.session.once(
                    'change',
                    function () {
                        if (this.$stateID == checkpoint.name) {
                            this.$stateID = null;
                        }
                    }.bind(this)
                );
                cb(true);
            } else {
                this.deleteCheckpoint(checkpoint.name);
                cb(false);
            }
        }.bind(this);
        if (!data) data = checkpoint['!data'];
        if (data) {
            doRestore(data);
        } else Docs.loadBlob(checkpoint.key, doRestore);
    };
    Doc.prototype.$loadCheckpoints = function () {
        if (!this.checkpoints) {
            var key = Docs.hasBlob(this.id, 'checkpoints');
            // @ts-ignore
            this.checkpoints = (key && Docs.getBlob(key)) || [];
        }
        clearCheckpoints();
        return this.checkpoints;
    };
    Doc.prototype.gotoCheckpoint = function (name, cb) {
        this.$loadCheckpoints();
        if (!this.checkpoints.length) {
            return cb(false);
        }
        var checkpoint;

        if (name) {
            name = name.toLowerCase();
            checkpoint = this.checkpoints.find(function (e) {
                return e.name == name;
            });
        } else checkpoint = this.checkpoints[this.checkpoints.length - 1];
        if (!checkpoint) return cb(false);
        if (!this.$revertPoints) {
            this.$revertPoints = [];
        }

        if (checkpoint.name === this.$stateID) {
            //ignore if current
            this.$revertPoints.push(this.checkpoints.pop());
            if (name) {
                return cb(true);
            } else return this.gotoCheckpoint(null, cb);
        }

        // if (!this.$revertPoints.length) {
        //     //save current state, how to do this without gathering too
        //     //too many temporary checkpoints
        //     this.saveCheckpoint("Last Edit Location", true);
        //     //clears revert stack
        //     this.$revertPoints.push(this.checkpoints.pop());
        // }
        Utils.removeFrom(this.checkpoints, checkpoint);
        this.$revertPoints.push(checkpoint);
        this.checkout(
            checkpoint,
            null,
            function (pass) {
                if (!pass) {
                    if (!name) return this.gotoCheckpoint(null, cb);
                    else return cb(false);
                } else return cb(checkpoint);
            }.bind(this)
        );
    };
    Doc.prototype.returnFromCheckpoint = function (cb) {
        if (!this.$revertPoints || !this.$revertPoints.length) {
            return this.gotoCheckpoint(null, cb);
        }
        var checkpoint = this.$revertPoints.pop();
        this.checkpoints.push(checkpoint);
        if (checkpoint.name == this.$stateID) {
            //ignore
            return this.returnFromCheckpoint(cb);
        }
        this.checkout(checkpoint, null, cb);
    };
    Doc.prototype.$clearRevertStack = function () {
        while (this.$revertPoints && this.$revertPoints.length) {
            this.checkpoints.push(this.$revertPoints.shift());
        }
    };
    Doc.prototype.saveCheckpoint = function (name, isTemporary, cb) {
        if (typeof isTemporary === 'function') {
            cb = isTemporary;
            isTemporary = undefined;
        }
        this.$clearRevertStack();
        this.$loadCheckpoints();
        name = name || Utils.genID('c');
        name = name.toLowerCase();
        var checkpoint = this.checkpoints.filter(function (e) {
            return e.name == name;
        })[0];

        if (checkpoint) {
            checkpoint.time = new Date().getTime();
            Utils.removeFrom(this.checkpoints, checkpoint);
        } else {
            checkpoint = {
                name: name,
                time: new Date().getTime(),
                key: '',
            };
            if (this.checkpoints.length >= appConfig.maximumCheckpoints) {
                var toRemove = this.checkpoints.splice(1, 1);
                this.deleteCheckpoint(toRemove[0].name);
            }
        }
        this.$stateID = checkpoint.name;
        this.session.once(
            'change',
            function () {
                if (this.$stateID == checkpoint.name) {
                    this.$stateID = null;
                }
            }.bind(this)
        );

        var data = this.saveState();
        data.folds = [];

        var priority = isTemporary
            ? TEMP_CHECKPOINT_PRIORITY
            : USER_CHECKPOINT_PRIORITY;
        Docs.saveBlob(
            this.id,
            'cp-' + name,
            data,
            {
                dataType: 'checkpoint',
                priority: priority,
            },
            function (key) {
                checkpoint.key = key;
                if (key === false) return cb(false);
                Utils.defProp(checkpoint, '!data', data);
                this.checkpoints.push(checkpoint);
                Docs.setBlob(this.id, 'checkpoints', this.checkpoints, {
                    priority: USER_CHECKPOINT_PRIORITY,
                });
                return cb(checkpoint);
            }.bind(this)
        );
    };
    Doc.prototype.deleteCheckpoint = function (name) {
        this.$clearRevertStack();
        this.$loadCheckpoints();
        name = (name || '').toLowerCase();
        var toRemove = this.checkpoints.filter(function (e) {
            return e.name == name;
        })[0];
        if (toRemove) {
            var key = toRemove.key;
            Docs.removeBlob(key);
            Utils.removeFrom(this.checkpoints, toRemove);
            Docs.setBlob(this.id, 'checkpoints', this.checkpoints, {
                priority: USER_CHECKPOINT_PRIORITY,
            });
        }
    };
    require('grace/core/actions').Actions.addAction({
        caption: 'State',
        icon: 'bookmark',
        subTree: {},
    });
    /** @returns {import('docs/document').Doc} */
    function getDoc(editor) {
        // @ts-ignore
        return Docs.forSession(editor.session);
    }
    var Notify = require('grace/ui/notify').Notify;
    function prompt(title, showFirst, cb) {
        var c = doc.$loadCheckpoints();
        editor.prompt((showFirst && c[0] && c[0].name) || '', {
            getCompletions: function () {
                return c.map(function (e) {
                    return {value: e.name};
                });
            },
            hasDescription: true,
            prompt: '<header>' + title + '</header>',
            onAccept: cb,
        });
    }
    require('grace/core/actions').Actions.addActions(
        [
            {
                isHeader: true,
                showIn: 'actionbar.state',
                name: 'section_state',
                caption: 'State',
            },
            {
                name: 'saveState',
                icon: 'bookmark_border',
                exec: function (editor, args) {
                    var doc = getDoc(editor);
                    if (!doc) return;
                    doc.$clearRevertStack();

                    function saveState(d) {
                        var name = d.value;
                        doc.saveCheckpoint(name, function (obj) {
                            if (args && args.cb) args.cb(obj && obj.key);
                            else if (obj) Notify.info('Saved');
                            else
                                Notify.error(
                                    'Failed to save state. File might be too large.'
                                );
                        });
                    }
                    if (args && args.name) {
                        saveState(args.name);
                    } else prompt('Save checkpoint', true, saveState);
                },
            },
            {
                name: 'restoreState',
                icon: 'restore_page',
                exec: function (editor, args) {
                    var doc = getDoc(editor);
                    doc.$clearRevertStack();
                    if (doc.$loadCheckpoints().length < 1)
                        return Notify.info('No states saved for this file');

                    function restore(d) {
                        var name = d.item.value;
                        doc.gotoCheckpoint(name, function (res) {
                            if (args && args.cb) args.cb(res);
                            else if (res === true)
                                Notify.info('Already at state');
                            else if (res) {
                                Notify.info('Switched to state ' + res.name);
                            } else
                                Notify.error(
                                    'Failed to switch state. State has been cleared.'
                                );
                        });
                    }
                    if (!doc.$stateID) Notify.warn('Current state not saved');
                    if (args && args.name) {
                        restore(name);
                    } else prompt('Select checkpoint', true, restore);
                },
            },
            {
                name: 'deleteState',
                exec: function (editor, args) {
                    var doc = getDoc(editor);
                    if (!doc) return;
                    doc.$clearRevertStack();
                    if (doc.$loadCheckpoints().length < 1)
                        return Notify.info('No states saved for this file');

                    function remove(d) {
                        var name = d.item.value;
                        doc.deleteCheckpoint(name);
                        if (args && args.cb) args.cb();
                    }
                    if (args && args.name) {
                        remove(name);
                    } else prompt('Delete checkpoint', false, remove);
                },
            },
            {
                name: 'returnFromState',
                bindKey: 'Ctrl-Alt-J',
                exec: function (editor) {
                    getDoc(editor).returnFromCheckpoint(Utils.noop);
                },
            },
            {
                isHeader: true,
                showIn: 'actionbar.state',
                name: 'section_history',
                caption: 'History',
            },
            {
                name: 'undoAllChanges',
                exec: function (editor) {
                    var doc = getDoc(editor);
                    if (doc) {
                        doc.saveCheckpoint('last undo', function (pass) {
                            if (pass) {
                                Notify.info('Added checkpoint automatically');
                            } else Notify.error('Unable to add checkpoint');
                            doc.abortChanges();
                        });
                    }
                },
            },
            {
                name: 'redoAllChanges',
                exec: function (editor) {
                    var doc = getDoc(editor);
                    if (doc) doc.redoChanges();
                },
            },
            {
                name: 'partialUndo',
                isAvailable: function (editor) {
                    return getDoc(editor) && getDoc(editor).session.partialUndo;
                },
                dontClose: true,
                exec: function (editor) {
                    var doc = getDoc(editor);
                    if (doc) doc.session.partialUndo();
                },
            },
            {
                name: 'partialRedo',
                isAvailable: function (editor) {
                    return getDoc(editor) && getDoc(editor).session.partialRedo;
                },
                dontClose: true,
                exec: function (editor) {
                    var doc = getDoc(editor);
                    if (doc) doc.session.partialRedo();
                },
            },
        ],
        {showIn: ['editor', 'actionbar.state']}
    );
}); /*_EndDefine*/