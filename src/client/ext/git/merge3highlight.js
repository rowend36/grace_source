define(function (require, exports, module) {
    //of an ace extension
    var Annotations = require('ace!annotations').Annotations;
    var EditSession = require('ace!edit_session').EditSession;
    var config = require('ace!config');
    var options = require('grace/core/config').Config.registerAll({}, 'git');
    require('grace/core/config').Config.on('git', update);
    var Docs = require('grace/docs/docs').Docs;

    function update() {
        Docs.forEach(function (doc) {
            doc.session.setOption('highlightMerge3', options.enableMergeMode);
            Annotations.updateWorkers(doc.session);
        });
        Docs.$defaults.highlightMerge3 = options.enableMergeMode;
    }

    function Merge3Worker() {
        Merge3Worker.super(this);
        this.isQueued = false;
        this.$triggerUpdate = this.triggerUpdate.bind(this);
        this.$annotate = require('grace/core/utils').Utils.debounce(
            this.annotate
        );
    }
    require('grace/core/utils').Utils.inherits(
        Merge3Worker,
        require('grace/core/events_emitter').EventsEmitter
    );
    Merge3Worker.prototype.triggerUpdate = function (change, doc) {
        if (this.isQueued) return;
        if (change.action == 'remove' && !doc.$lastMergeRow) {
            return;
        }
        if (change.start.row < parseInt(doc.$lastMergeRow)) {
            this.isQueued = true;
            this.$annotate();
        } else if (change.action == 'insert' && change.start.column < 10) {
            var text = doc.getLines(change.start.row, change.end.row);
            if (text.some(MERGE_LINE.test, MERGE_LINE)) {
                this.isQueued = true;
                return this.$annotate();
            }
        }
    };
    Merge3Worker.prototype.annotate = function () {
        this.isQueued = false;
        var anno = [];
        var doc = this.doc;
        var lastRow = -1;
        for (var i = 0; i < doc.getLength(); i++) {
            if (MERGE_LINE.test(doc.getLine(i))) {
                lastRow = i;
                anno.push({
                    row: i,
                    column: 0,
                    text: 'Unmerged Changes',
                    type: 'error',
                });
            }
        }
        doc.$lastMergeRow = lastRow + 1;
        this.trigger('annotate', {
            data: anno,
        });
    };

    Merge3Worker.prototype.attachToDocument = function (doc) {
        this.doc = doc;
        this.annotate();
        doc.on('change', this.triggerUpdate);
    };
    Merge3Worker.prototype.terminate = function () {
        this.doc.off('change', this.triggerUpdate);
        this.doc = null;
        this.trigger('terminate');
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
    Merge3Mode.prototype.destroy = function () {
        this.bgTokenizer.setTokenizer(this.tokenizer);
        this.session.off('changeMode', this.$reset);
        this.session = null;
    };
    Merge3Mode.prototype.getLineTokens = function (text, state, row) {
        var inMerge = MERGE_LINE.exec(text);
        if (inMerge) {
            var side = inMerge[1]
                ? '>'
                : inMerge[2]
                ? '='
                : inMerge[3]
                ? '<'
                : '|';
            var wasInMerge = state && state[0] == 'inMerge';
            switch (side) {
                case '=':
                case '|':
                    var originalState = wasInMerge ? state[2] : state;
                    state = [
                        'inMerge',
                        originalState,
                        originalState,
                        side == '=' ? 'theirs' : 'base',
                    ];
                    break;
                case '>':
                    state = wasInMerge
                        ? ['inMerge', state[1], null, null]
                        : state;
                    break;
                case '<':
                    state = wasInMerge ? state[1] : state;
                    state = ['inMerge', state, state, 'ours'];
                    break;
            }
            if (wasInMerge || side != '>')
                return {
                    state: state,
                    tokens: [
                        {
                            type: 'comment.merge.arrows.' + state[3],
                            value: text,
                        },
                    ],
                };
        }
        if (state && state[0] == 'inMerge') {
            var tokens = this.tokenizer.getLineTokens(text, state[1], row);
            if (tokens && state[3] !== null) {
                tokens.state = ['inMerge', tokens.state, state[2]];
                tokens.tokens.forEach(function (e) {
                    e.type += '.merge.' + state[3];
                });
            }
            return tokens;
        }
        return this.tokenizer.getLineTokens(text, state, row);
    };
    Merge3Mode.getPriority = function (mode, session) {
        return !!session.$merge3Mode && mode !== 'ace/mode/javascript' && 1;
    };
    Merge3Mode.createWorker = function () {
        return new Merge3Worker();
    };
    Merge3Mode.isSupport = true;

    Annotations.registerProvider(Merge3Mode);
    config.defineOptions(EditSession.prototype, 'edit_session', {
        highlightMerge3: {
            set: function (val) {
                var enabled = !!this.$merge3Mode;
                val = !!val;
                if (val !== enabled) {
                    if (val) {
                        this.$merge3Mode = new Merge3Mode(this);
                    } else {
                        this.$merge3Mode.destroy();
                        this.$merge3Mode = null;
                    }
                }
            },
            value: false,
        },
    });
    require('ace!lib/dom').importCssString(
        '\
.ace_editor .ace_merge.ace_arrows.ace_ours{\
    color: red;\
}\
.ace_editor .ace_merge.ace_arrows.ace_base{\
    color: blue;\
}\
.ace_editor .ace_merge.ace_arrows.ace_null{\
    color: green;\
}',
        'merge3highlight.css'
    );
    update();
    exports.highlightMerge3 = update;
});