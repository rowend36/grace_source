_Define(function(global) {
    //of an ace extension
    var Annotations = global.Annotations;
    var EditSession = global.EditSession;
    var config = global.libConfig;
    var options = global.registerAll({}, "git");
    global.ConfigEvents.on("git", update);
    var docs = global.docs;
    var Docs = global.Docs;

    function update() {
        for (var i in docs) {
            docs[i].session.setOption("highlightMerge3", options.enableMergeMode);
            Annotations.updateWorkers(docs[i].session);
        }
        Docs.$defaults.highlightMerge3 = options.enableMergeMode;

    }

    function Merge3Worker() {
        this.isGlobal = true;
        this.isSupport = true;
        this.queue = {};
        var self = this;
        this.triggerUpdate = (function(change, doc) {
            if (this.queue[doc.$sessionId]) return;
            if (change.action == "remove" && !doc.$lastMergeRow) {
                return;
            }
            if (change.start.row < parseInt(doc.$lastMergeRow)) {
                this.queue[doc.$sessionId] = doc;
                this.annotate();
            }
            if (change.action == "insert" && change.start.column<10) {
                var text = doc.getLines(
                    change.start.row, change.end.row);
                if (text.some(MERGE_LINE.test, MERGE_LINE)) {
                    this.queue[doc.$sessionId] = doc;
                    return self.annotate();
                }
            }
        }).bind(this);
    }
    Merge3Worker.prototype.annotate = global.Utils.debounce(function() {
        var queue = this.queue;
        this.queue = {};
        for (var id in queue) {
            var anno = [];
            var doc = queue[id];
            var lastRow = -1;
            for (var i = 0; i < doc.getLength(); i++) {
                if (MERGE_LINE.test(doc.getLine(i))) {
                    lastRow = i;
                    anno.push({
                        row: i,
                        column: 0,
                        text: "Unmerged Changes",
                        type: "error"
                    });
                }
            }
            doc.$lastMergeRow = lastRow + 1;
            this.update(id, anno);
        }
    }, 2000);
    global.Utils.inherits(Merge3Worker, global.EventsEmitter);
    Annotations.registerProvider(new Merge3Worker());
    Merge3Worker.prototype.addDocument = function(id, doc) {
        // should not need to add properties,
        doc.$sessionId = id;
        this.queue[id] = doc;
        this.annotate();
        doc.on('change', this.triggerUpdate);
    };
    Merge3Worker.prototype.removeDocument = function(id, doc) {
        doc.off('change', this.triggerUpdate);
    };
    Merge3Worker.prototype.terminate = function() {
        this.trigger('terminate');
    };
    Merge3Worker.prototype.update = function(id, data) {
        this.trigger('annotate', {
            data: {
                doc: id,
                data: data
            }
        });
    };
    Merge3Worker.prototype.canHandle = function(mode, session) {
        return !!session.$merge3mode && mode !== "ace/mode/javascript";
    };
    Merge3Worker.prototype.createWorker = function() {
        return this;
    };
    var MERGE_LINE = /^(>>>>)|^(====)|^(<<<<)|^(\|\|\|\|)/;

    function Merge3Mode(session) {
        this.$reset = this.reset.bind(this);
        this.session = session;
        this.bgTokenizer = session.bgTokenizer;
        this.reset();
        session.on('changeMode', this.$reset);
    }
    Merge3Mode.prototype.reset = function reset() {
        if (this.bgTokenizer.tokenizer == this) return;
        this.tokenizer = this.bgTokenizer.tokenizer;
        this.bgTokenizer.setTokenizer(this);
    };
    Merge3Mode.prototype.destroy = function() {
        this.bgTokenizer.setTokenizer(this.tokenizer);
        this.session.off('changeMode', this.$reset);
        this.session = null;
    };
    Merge3Mode.prototype.getLineTokens = function(text, state, row) {
        var inMerge = MERGE_LINE.exec(text);
        if (inMerge) {
            var side = inMerge[1] ? '>' : inMerge[2] ? '=' : inMerge[3] ? '<' : '|';
            var wasInMerge = state && state[0] == "inMerge";
            switch (side) {
                case "=":
                case "|":
                    var originalState = wasInMerge ? state[2] : state;
                    state = ["inMerge", originalState, originalState, side == "=" ? "theirs" : "base"];
                    break;
                case ">":
                    state = wasInMerge ? ["inMerge", state[1], null, null] : state;
                    break;
                case "<":
                    state = wasInMerge ? state[1] : state;
                    state = ["inMerge", state, state, 'ours'];
                    break;
            }
            if (wasInMerge || side != ">")
                return {
                    state: state,
                    tokens: [{
                        type: "comment.merge.arrows." + state[3],
                        value: text
                    }]
                };
        }
        if (state && state[0] == "inMerge") {
            var tokens = this.tokenizer.getLineTokens(text, state[1], row);
            if (tokens && state[3] !== null) {
                tokens.state = ["inMerge", tokens.state, state[2]];
                tokens.tokens.forEach(function(e) {
                    e.type += ".merge." + state[3];
                });
            }
            return tokens;
        }
        return this.tokenizer.getLineTokens(text, state, row);
    };
    config.defineOptions(EditSession.prototype, "editor", {
        "highlightMerge3": {
            set: function(val) {
                var enabled = !!this.$merge3mode;
                val = !!val;
                if (val !== enabled) {
                    if (val) {
                        this.$merge3mode = new Merge3Mode(this);
                    } else {
                        this.$merge3mode.destroy();
                        this.$merge3mode = null;
                    }
                }
            },
            value: false
        }
    });
    global.dom.importCssString("\
.ace_editor .ace_merge.ace_arrows.ace_ours{\
    color: red;\
}\
.ace_editor .ace_merge.ace_arrows.ace_base{\
    color: blue;\
}\
.ace_editor .ace_merge.ace_arrows.ace_null{\
    color: green;\
}", "merge3highlight.css");
    update();
    global.GitCommands.highlightMerge3 = update;
});