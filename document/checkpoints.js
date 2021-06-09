_Define(function(global) {
    var Docs = global.Docs;
    var Doc = global.Doc;
    var Utils = global.Utils;
    var jsonToSession = Docs.$jsonToSession;
    var sessionToJson = Docs.$sessionToJson;
    var appConfig = global.registerAll({
        "maximumCheckpoints":9
    },"documents");
    global.registerValues({
        "maximumCheckpoints":"Checkpoints allow you to jump between locations in history quickly. Note: Checkpoints are always deleted when a document is closed. Also, saving a checkpoint might fail if a document is very large"
    },"documents");
    //priority for checkpoints user creates
    var USER_CHECKPOINT_PRIORITY = 15;
    var TEMP_CHECKPOINT_PRIORITY = 5;
    var clearCheckpoints = Utils.noop;
    Doc.prototype.checkout = function(checkpoint, data) {
        data = data || Docs.restoreBlob(checkpoint.key);
        if (data) {
            this.stateID = checkpoint.name;
            this.setDirty();
            jsonToSession(this.session, data);
            this.session.once("change", function() {
                if (this.stateID == checkpoint.name) {
                    this.stateID = null;
                }
            }.bind(this));
            return true;
        } else {
            this.deleteCheckpoint(checkpoint.name);
            return false;
        }
    };
    Doc.prototype.$loadCheckpoints = function() {
        if (!this.checkpoints) {
            this.checkpoints = Docs.restoreBlob(Docs.hasBlob(this.id, "checkpoints")) ||
                [];
        }
        clearCheckpoints();
        return this.checkpoints;
    };
    Doc.prototype.gotoCheckpoint = function(name) {
        this.$loadCheckpoints();
        if (!this.checkpoints.length){
            console.log('mdksksks');
            return false;
        }
        var checkpoint;

        if (name) {
            name = name.toLowerCase();
            console.log(name,this.checkpoints);
            checkpoint = this.checkpoints.find(function(e) {
                return e.name == name;
            });
        } else checkpoint = this.checkpoints[this.checkpoints.length - 1];
        if (!checkpoint) return false;
        if (!this.revertPoints) {
            this.revertPoints = [];
        }

        if (checkpoint.name == this.stateID) {
            //ignore if current
            this.revertPoints.push(this.checkpoints.pop());
            if (name) return console.log('alredy ther');
            else return this.gotoCheckpoint();
        }

        // if (!this.revertPoints.length) {
        //     //save current state, how to do this without gathering too
        //     //too many temporary checkpoints
        //     this.saveCheckpoint("Last Edit Location", true);
        //     //clears revert stack
        //     this.revertPoints.push(this.checkpoints.pop());
        // }
        this.checkpoints.splice(this.checkpoints.indexOf(checkpoint), 1);
        this.revertPoints.push(checkpoint);
        if (!this.checkout(checkpoint)) {
            console.log('failed checkout');
            if (!name) return this.gotoCheckpoint();
            else return false;
        }
        return checkpoint;
    };
    Doc.prototype.returnFromCheckpoint = function() {
        if (!this.revertPoints || !this.revertPoints.length) {
            return this.gotoCheckpoint();
        }
        var checkpoint = this.revertPoints.pop();
        this.checkpoints.push(checkpoint);
        if (checkpoint.name == this.stateID) {
            //ignore
            return this.returnFromCheckpoint();
        }
        this.checkout(checkpoint);

    };
    Doc.prototype.$clearRevertStack = function() {
        while (this.revertPoints && this.revertPoints.length) {
            this.checkpoints.push(this.revertPoints.shift());
        }
    };
    Doc.prototype.saveCheckpoint = function(name, temp) {
        this.$clearRevertStack();
        this.$loadCheckpoints();
        name = name || Utils.genID("c");
        name = name.toLowerCase();

        var checkpoint = this.checkpoints.filter(function(e) {
            return e.name == name;
        })[0];

        if (checkpoint) {
            checkpoint.time = new Date().getTime();
            this.checkpoints.splice(this.checkpoints.indexOf(checkpoint), 1);
        } else {
            checkpoint = {
                name: name,
                time: new Date().getTime()
            };
            if (this.checkpoints.length >= appConfig.maximumCheckpoints) {
                var toRemove = this.checkpoints.splice(1, 1);
                this.deleteCheckpoint(toRemove[0].name);
            }
        }
        this.checkpoints.push(checkpoint);
        this.stateID = checkpoint.name;
        this.session.once("change", function() {
            if (this.stateID == checkpoint.name) {
                this.stateID = null;
            }
        }.bind(this));

        var data = sessionToJson(this.session);
        data.folds = [];

        var priority = temp ? TEMP_CHECKPOINT_PRIORITY : USER_CHECKPOINT_PRIORITY;
        var key = Docs.saveBlob(this.id, "cp-" + name, data,
        priority, { dataType: "checkpoint" });
        checkpoint.key = key;
        Docs.saveBlob(this.id, "checkpoints", this.checkpoints,
            USER_CHECKPOINT_PRIORITY);
        return checkpoint;
    };
    Doc.prototype.deleteCheckpoint = function(name) {
        this.$clearRevertStack();
        this.$loadCheckpoints();
        name = (name || "").toLowerCase();
        var toRemove = this.checkpoints.filter(function(e) {
            return e.name == name;
        })[0];
        if (toRemove) {
            var key = toRemove.key;
            Docs.removeBlob(key);
            this.checkpoints.splice(this.checkpoints.indexOf(toRemove), 1);
            Docs.saveBlob(this.id, "checkpoints", this.checkpoints,
                USER_CHECKPOINT_PRIORITY);
        }
    };
}); /*_EndDefine*/