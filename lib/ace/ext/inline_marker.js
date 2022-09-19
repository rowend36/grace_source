/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";
var oop = require("../lib/oop");
var RangeList = require("../range_list").RangeList;
var Range = require("../range").Range;
var lang = require("../lib/lang");
var Tooltip = require("../tooltip").Tooltip;
var config = require("../config");
var EditSession = require("../edit_session").EditSession;
var Editor = require("../editor").Editor;
function InlineMarkers(session) {
    RangeList.call(this, arguments);
    
    this.attach(session);
    this.$updateCallback = lang.delayedCall(this.updateCallback.bind(this));
    session.on("changeAnnotation", this.$updateCallback);
    this.$dismiss = this.dismiss.bind(this);
    //post update regardless of whether new annotations come in or not
    this.$updateChange = function() {
        session._signal("changeFrontMarker");
    };
    this.session.on("change", this.$updateChange);
    this.session.addDynamicMarker(this,true);
    this.$updateCallback();
}
(function() {
    oop.implement(this, RangeList.prototype);
    this.updateCallback = function() {
        var session = this.session;
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
            //expand range size to at least 3 chars for hover
            if (line.end && (line.end.row>line.row || line.end.column>startCol+2)) {
                endCol = line.end.column;
            } else {
                if (startCol > 0)
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

                //Merge with other markers
                if (Range.comparePoints(removed[0].start, range.start) <
                    0)
                    range.start = removed[0].start;
                var last = removed[rlen - 1];
                if (Range.comparePoints(last.end, range.end) > -1)
                    range.end = last.end;
                var _score = scores[line.type];
                //Use highest error level
                for (var j = 0; j < rlen; j++) {
                    range.message += "</br>" + removed[j].message;
                    if (scores[line.type] > _score) {
                        range.type = line.type;
                        _score = scores[line.type];
                    }
                }
            }
        }
        session._signal("changeFrontMarker");
    };
    this.update = function(html, markerLayer, session, config){
        var ranges = this.clipRows(config.firstRow, config.lastRow+1);
        for (var k = 0, r = ranges, len2 = r.length; k <
            len2 && !markerLayer.timedOut; k++) {
            var mark = r[k].toScreenRange(session);
            if (mark.isMultiLine()) {
                markerLayer.drawTextMarker(
                    html, mark,
                    "ace_inline_annotation ace_inline_" + r[k].type, config);
    
            } else {
                markerLayer.drawSingleLineMarker(
                    html, mark,
                    "ace_inline_annotation ace_inline_" + r[k].type, config);
            }
        }
    };
    this.showError = function(editor, a) {
        if (this.activeTip) return;
        if (!this.session.selection.isEmpty()) return;
        a = a || this.session.selection.getCursor();
        var range = this.rangeAtPoint(a);
        if (!range) return;
        var tip = editor.$inlineTip || (editor.$inlineTip = new Tooltip(editor.container));
        tip.setHtml("<span class='ace_" + range.type + "'>" + range.message + "</span>");
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
        this.activeTip.hide();
        this.activeTip.editor.off("changeSelection", this.$dismiss);
        this.activeTip = null;
    };
    this.clearMarkers = function() {
        this.ranges = [];
        this.$updateChange();
    };
    this.detach = function() {
        this.clearMarkers();
        this.session.removeMarker(this.id);
        this.session.off("changeAnnotation", this.$updateCallback);
        this.session.off("change", this.$updateChange);
        RangeList.prototype.detach.apply(this);
    };
}).call(InlineMarkers.prototype);
config.defineOptions(EditSession.prototype,"session",{
    highlightErrorRegions: {
        set: function(val){
            var self = this;
            if(val){
                config.loadModule("./ext/inline_marker",function(m){
                    if(val && !self.$inlineMarkers){
                        self.$inlineMarkers = new m.InlineMarkers(self);
                    }
                });
            }
            else if(self.$inlineMarkers){
                self.$inlineMarkers.detach();
                self.$inlineMarkers = null;
            }
        },
        value: true
    } 
});
config.defineOptions(Editor.prototype,'editor',{
   showErrorOnClick: {
        set: function(val){
          if(val){
              var self = this;
              if (!this.$inlineMarkerClickListener) {
                  this.$inlineMarkerClickListener = function(e) {
                      var s = self.session;
                      var i = s && s.$inlineMarkers;
                      var pos = i && self.renderer.getClickPosition(e, 1);
                      if(pos)
                        i.showError(self,pos);
                  };
                  this.on("click", this.$inlineMarkerClickListener);
              }
          }
          else{
              if(this.$inlineMarkerClickListener){
                  this.off('click',this.$inlineMarkerClickListener);
                  this.$inlineMarkerClickListener = null;
              }
          }
        },
        value: true
    }
});
exports.InlineMarkers = InlineMarkers;
});