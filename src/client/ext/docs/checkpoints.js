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
    var debug = console;
    //priority for checkpoints user creates
    var USER_CHECKPOINT_PRIORITY = 15;
    var TEMP_CHECKPOINT_PRIORITY = 5;
    var clearCheckpoints = Utils.noop;
    Doc.prototype.checkout = function (checkpoint, data, cb) {
        function doRestore(data) {
            if (data) {
                this.stateID = checkpoint.name;
                this.setDirty();
                this.restoreState(data);
                this.session.once(
                    'change',
                    function () {
                        if (this.stateID == checkpoint.name) {
                            this.stateID = null;
                        }
                    }.bind(this)
                );
                cb(true);
            } else {
                this.deleteCheckpoint(checkpoint.name);
                cb(false);
            }
        }
        if (data) {
            doRestore(data);
        } else Docs.loadBlob(checkpoint.key, doRestore);
    };
    Doc.prototype.$loadCheckpoints = function () {
        if (!this.checkpoints) {
            this.checkpoints =
                Docs.getBlob(Docs.hasBlob(this.id, 'checkpoints')) || [];
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
        if (!this.revertPoints) {
            this.revertPoints = [];
        }

        if (checkpoint.name == this.stateID) {
            //ignore if current
            this.revertPoints.push(this.checkpoints.pop());
            if (name) {
                debug.log('already there');
                return cb(true);
            } else return this.gotoCheckpoint(null, cb);
        }

        // if (!this.revertPoints.length) {
        //     //save current state, how to do this without gathering too
        //     //too many temporary checkpoints
        //     this.saveCheckpoint("Last Edit Location", true);
        //     //clears revert stack
        //     this.revertPoints.push(this.checkpoints.pop());
        // }
        Utils.removeFrom(this.checkpoints, checkpoint);
        this.revertPoints.push(checkpoint);
        this.checkout(checkpoint, null, function (pass) {
            if (!pass) {
                debug.log('failed checkout');
                if (!name) return this.gotoCheckpoint(null, cb);
                else return cb(false);
            } else return cb(checkpoint);
        });
    };
    Doc.prototype.returnFromCheckpoint = function (cb) {
        if (!this.revertPoints || !this.revertPoints.length) {
            return this.gotoCheckpoint(null, cb);
        }
        var checkpoint = this.revertPoints.pop();
        this.checkpoints.push(checkpoint);
        if (checkpoint.name == this.stateID) {
            //ignore
            return this.returnFromCheckpoint(cb);
        }
        this.checkout(checkpoint, null, cb);
    };
    Doc.prototype.$clearRevertStack = function () {
        while (this.revertPoints && this.revertPoints.length) {
            this.checkpoints.push(this.revertPoints.shift());
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
            };
            if (this.checkpoints.length >= appConfig.maximumCheckpoints) {
                var toRemove = this.checkpoints.splice(1, 1);
                this.deleteCheckpoint(toRemove[0].name);
            }
        }
        this.stateID = checkpoint.name;
        this.session.once(
            'change',
            function () {
                if (this.stateID == checkpoint.name) {
                    this.stateID = null;
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

                this.checkpoints.push(checkpoint);
                Docs.setBlob(this.id, 'checkpoints', this.checkpoints, {
                    priority: USER_CHECKPOINT_PRIORITY,
                });
                return cb(checkpoint);
            }
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
}); /*_EndDefine*/