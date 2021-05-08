define("ace/ext/inline_marker",["require","exports","module","ace/lib/oop","ace/range_list","ace/range","ace/lib/lang","ace/tooltip"], function(require, exports, module) {
    "use strict";
    var oop = require("../lib/oop");
    var RangeList = require("../range_list").RangeList;
    var Range = require("../range").Range;
    var lang = require("../lib/lang");
    var Tooltip = require("../tooltip").Tooltip;

    function InlineMarkers(session) {
        RangeList.call(this, arguments);
        session.on("changeAnnotation", (this.$updateCallback = lang.delayedCall(function() {
            var a = session.$annotations;
            if (!a) return;
            var scores = {
                error: 5,
                warning: 4,
                info: 1,
            };
            this.clearMarkers();
            for (var i = a.length; i--;) {
                var line = a[i];
                if (line.column == undefined) continue;
                var startCol = line.column;
                var endCol;
                if (line.end && line.end.column - startCol > 3) {
                    endCol = line.end.column;
                } else {
                    if (startCol > 1)
                        startCol -= 2;
                    else if (startCol > 0)
                        startCol--;
                    endCol = startCol + 3;
                }
                var range = new Range(line.row, startCol, (line.end ||
                    line).row, endCol);
                range.message = lang.escapeHTML(line.text);
                range.type = line.type;
                var removed = this.add(range);

                if (removed.length > 0) {
                    var rlen = removed.length;
                    if (Range.comparePoints(removed[0].start, range.start) <
                        0)
                        range.start = removed[0].start;
                    var last = removed[rlen - 1];
                    if (Range.comparePoints(last.end, range.end) > -1)
                        range.end = last.end;
                    var _score = scores[line.type];
                    for (var j = 0; j < rlen; j++) {
                        range.message += "</br>" + removed[j].message;
                        if (scores[line.type] > _score) {
                            range.type = line.type;
                            _score = scores[line.type];
                        }
                    }
                }
            }
            for (var k = 0, r = this.ranges, len2 = r.length; k <
                len2; k++) {
                var mark = r[k];
                mark.id = session.addMarker(mark,
                    "ace_inline_annotation ace_inline_" + (
                        mark.type ? mark.type : "default"));
            }
        }.bind(this))));

        this.$dismiss = this.dismiss.bind(this);
        this.attach(session);
        this.$updateChange = function() {
            session._signal("changeBackMarker");
        };
        this.session.on("change", this.$updateChange);
        this.$updateCallback();
    }
    (function() {
        oop.implement(this, RangeList.prototype);
        this.showError = function(editor, a) {
            if (this.activeTip) return;
            if (!this.session.selection.isEmpty()) return;
            a = a || this.session.selection.getCursor();
            var range = this.rangeAtPoint(a);
            if (!range) return;

            var tip = new Tooltip(editor.container);
            tip.setHtml(range.message);
            var pos = editor.renderer.textToScreenCoordinates(a.row, a.column);
            pos.pageY += editor.renderer.layerConfig.lineHeight;
            tip.show();
            tip.setPosition(Math.max(0, pos.pageX - tip.getElement().offsetWidth * 0.5), pos.pageY);
            var self = this;
            self.activeTip = tip;
            self.activeTip.editor = editor;
            editor.on('changeSelection', self.$dismiss);
        };
        this.dismiss = function() {
            if (!this.activeTip) return;
            this.activeTip.destroy();
            this.activeTip.editor.off("changeSelection", this.$dismiss);
            this.activeTip = null;
        };
        this.clearMarkers = function() {
            this.ranges.forEach(function(e) {
                this.removeMarker(e.id);
            }, this.session);
            this.ranges = [];
        };
        this.detach = function() {
            this.clearMarkers();
            this.session.off("changeAnnotation", this.$updateCallback);
            this.session.off("change", this.$updateChange);
            RangeList.prototype.detach.apply(this);
        };
    }).call(InlineMarkers.prototype);
    exports.InlineMarkers = InlineMarkers;
});
                (function() {
                    window.require(["ace/ext/inline_marker"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            