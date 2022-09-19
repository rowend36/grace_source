/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2012, Ajax.org B.V.
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

var HashHandler = require("./keyboard/hash_handler").HashHandler;
var AcePopup = require("./autocomplete/popup").AcePopup;
var util = require("./autocomplete/util");
var lang = require("./lib/lang");
var dom = require("./lib/dom");
var snippetManager = require("./snippets").snippetManager;
var config = require("./config");

var Autocomplete = function() {
    this.autoInsert = false;
    this.autoSelect = true;
    this.exactMatch = false;
    this.gatherCompletionsId = 0;
    this.keyboardHandler = new HashHandler();
    this.keyboardHandler.bindKeys(this.commands);

    this.blurListener = this.blurListener.bind(this);
    this.changeListener = this.changeListener.bind(this);
    this.mousedownListener = this.mousedownListener.bind(this);
    this.mousewheelListener = this.mousewheelListener.bind(this);

    this.changeTimer = lang.delayedCall(function() {
        this.updateCompletions(true);
    }.bind(this));

    this.tooltipTimer = lang.delayedCall(this.updateDocTooltip.bind(this), 50);
};

(function() {

    this.$init = function() {
        this.popup = new AcePopup();
        this.setContainer(document.body || document.documentElement);
        this.popup.showIcons = true;
        this.popup.on("click", function(e) {
            this.insertMatch();
            e.stop();
        }.bind(this));
        //so down arrow doesn't bring up irrelevant results
        this.popup.$maxItems = 300;
        this.popup.focus = this.editor.focus.bind(this.editor);
        this.popup.on("show", this.tooltipTimer.bind(null, null));
        this.popup.on("select", this.tooltipTimer.bind(null, null));
        this.popup.on("changeHoverMarker", this.tooltipTimer.bind(null, null));
        return this.popup;
    };

    this.getPopup = function() {
        return this.popup || this.$init();
    };

    this.openPopup = function(editor, prefix, keepPopupPosition) {
        if (!this.popup)
            this.$init();

        this.popup.autoSelect = this.autoSelect;

        this.popup.setData(this.completions.filtered, this.completions.filterText);
        editor.keyBinding.addKeyboardHandler(this.keyboardHandler);
        
        var renderer = editor.renderer;
        this.popup.setRow(this.autoSelect ? 0 : -1);
        if (!keepPopupPosition) {
            this.popup.copyTheme(editor);
            var lineHeight = renderer.layerConfig.lineHeight;
            var base = this.base;
            //wrapped line handling
            if(base.$prefixOffset && editor.session.getRowLineCount(base.row)>1){
                var screenPos = editor.session.documentToScreenPosition(base.row,base.column+base.$prefixOffset);
                if(screenPos.column<base.$prefixOffset){
                    //TODO handle double width chars
                    base = editor.session.screenToDocumentPosition(screenPos.row,0);
                }
            }
            var pos = renderer.getCursorPixelPosition(base, true);
            
            pos.left -= this.popup.getTextLeftOffset();

            var rect = editor.container.getBoundingClientRect();
            pos.top += rect.top - renderer.layerConfig.offset;
            pos.left += rect.left - editor.renderer.scrollLeft;
            pos.left += renderer.gutterWidth;

            this.popup.show(pos, lineHeight);
        } else if (keepPopupPosition && !prefix) {
            this.detach();
        }
        this.changeTimer.cancel();
    };

    this.detach = function() {
        if(this.editor){
            this.editor.keyBinding.removeKeyboardHandler(this.keyboardHandler);
            this.editor.off("changeSelection", this.changeListener);
            this.editor.off("blur", this.blurListener);
            this.editor.off("mousedown", this.mousedownListener);
            this.editor.off("mousewheel", this.mousewheelListener);
        }
        this.changeTimer.cancel();
        this.hideDocTooltip();

        this.gatherCompletionsId += 1;
        if (this.popup && this.popup.isOpen)
            this.popup.hide();

        if (this.base)
            this.base.detach();
        this.activated = false;
        this.completions = this.base = null;
    };

    this.changeListener = function(e) {
        var cursor = this.editor.selection.lead;
        if (cursor.row != this.base.row || cursor.column < this.base.column) {
            this.detach();
        }
        if (this.activated)
            this.changeTimer.schedule();
        else
            this.detach();
    };

    this.blurListener = function(e) {
        // we have to check if activeElement is a child of popup because
        // on IE preventDefault doesn't stop scrollbar from being focussed
        var el = document.activeElement;
        var text = this.editor.textInput.getElement();
        var fromTooltip = e.relatedTarget && this.tooltipNode && this.tooltipNode.contains(e.relatedTarget);
        var container = this.popup && this.popup.container;
        if (el != text && el.parentNode != container && !fromTooltip
            && el != this.tooltipNode && e.relatedTarget != text
        ) {
            this.detach();
        }
    };

    this.mousedownListener = function(e) {
        this.detach();
    };

    this.mousewheelListener = function(e) {
        this.detach();
    };

    this.goTo = function(where) {
        this.popup.goTo(where);
    };
    
    this.insertMatch = function(data, options) {
        if (!data){
            if (this.editor.commands.$inReplay) return true;
            data = this.popup.getData(this.popup.getRow());
        }
        if (!data)
            return false;
            console.log('inserting match');
        var completions = this.completions;
        this.editor.startOperation({command: {name: "insertMatch"}});
        if (data.completer && data.completer.insertMatch) {
            data.completer.insertMatch(this.editor, data);
        } else {
            // TODO add support for options.deleteSuffix
            if (!completions)
                return false;
            if (completions.filterText) {
                this.editor.execCommand(Autocomplete.$deletePrefix,completions.filterText);
            }
            if(options && options.deleteSuffix){
                this.editor.execCommand(Autocomplete.$deleteSuffix,data.value||data);
            }
            if (data.snippet)
                this.editor.execCommand(Autocomplete.$insertSnippet,data.snippet);
            else
                this.editor.execCommand("insertstring", data.value || data);
        }
        // detach only if new popup was not opened while inserting match
        if (this.completions == completions)
            this.detach();
        this.editor.endOperation();
    };


    this.commands = {
        "Up": function(editor) { editor.completer.goTo("up"); },
        "Down": function(editor) { editor.completer.goTo("down"); },
        "Ctrl-Up|Ctrl-Home": function(editor) { editor.completer.goTo("start"); },
        "Ctrl-Down|Ctrl-End": function(editor) { editor.completer.goTo("end"); },

        "Esc": function(editor) { editor.completer.detach(); },
        "Return": function(editor) { return editor.completer.insertMatch(); },
        "Ctrl-Return": function(editor) { editor.completer.insertMatch(null, {deleteSuffix: true}); },
        "Tab": function(editor) {
            var result = editor.completer.insertMatch();
            if (!result && !editor.tabstopManager)
                editor.completer.goTo("down");
            else
                return result;
        },

        "PageUp": function(editor) { editor.completer.popup.gotoPageUp(); },
        "PageDown": function(editor) { editor.completer.popup.gotoPageDown(); }
    };

    this.gatherCompletions = function(editor, callback) {
        var session = editor.getSession();
        var pos = editor.getCursorPosition();

        var prefix = util.getCompletionPrefix(editor);

        this.base = session.doc.createAnchor(pos.row, pos.column - prefix.length);
        this.base.$prefixOffset = prefix.length;
        this.base.$insertRight = true;

        var matches = [];
        var total = editor.completers.length;
        var waiting = 0;
        // var delayTimeout;
        editor.completers.forEach(function(completer, i) {
            if(completer.$blocksCompletions) waiting++;
            completer.getCompletions(editor, session, pos, prefix, function(err, results) {
                if (!err && results)
                    matches = matches.concat(results);
                // Fetch prefix again, because they may have changed by now
                if(completer.$blocksCompletions){
                    waiting--;
                }
                if(waiting === 0){
                    callback(null, {
                        prefix: util.getCompletionPrefix(editor),
                        matches: matches,
                        finished: (--total === 0)
                    });
                } else --total;
            });
        });
        return true;
    };

    this.showPopup = function(editor, options) {
        if (this.editor)
            this.detach();

        this.activated = true;

        this.editor = editor;
        if (editor.completer != this) {
            if (editor.completer)
                editor.completer.detach();
            editor.completer = this;
        }

        editor.on("changeSelection", this.changeListener);
        editor.on("blur", this.blurListener);
        editor.on("mousedown", this.mousedownListener);
        editor.on("mousewheel", this.mousewheelListener);

        this.updateCompletions(false, options);
    };

    this.updateCompletions = function(keepPopupPosition, options) {
        if (keepPopupPosition && this.base && this.completions) {
            var pos = this.editor.getCursorPosition();
            var prefix = this.editor.session.getTextRange({start: this.base, end: pos});
            if (prefix == this.completions.filterText)
                return;
            this.completions.setFilter(prefix);
            if (!this.completions.filtered.length)
                return this.detach();
            if (this.completions.filtered.length == 1
            && this.completions.filtered[0].value == prefix
            && !this.completions.filtered[0].snippet)
                return this.detach();
            this.openPopup(this.editor, prefix, keepPopupPosition);
            return;
        }
        
        if (options && options.matches) {
            var pos = this.editor.getSelectionRange().start;
            this.base = this.editor.session.doc.createAnchor(pos.row, pos.column);
            this.base.$insertRight = true;
            this.completions = new FilteredList(options.matches);
            return this.openPopup(this.editor, "", keepPopupPosition);
        }

        // Save current gatherCompletions session, session is close when a match is insert
        var _id = this.gatherCompletionsId;

        // Only detach if result gathering is finished
        var detachIfFinished = function(results) {
            if (!results.finished) return;
            return this.detach();
        }.bind(this);

        var processResults = function(results) {
            var prefix = results.prefix;
            var matches = results.matches;

            this.completions = new FilteredList(matches);

            if (this.exactMatch)
                this.completions.exactMatch = true;

            this.completions.setFilter(prefix);
            var filtered = this.completions.filtered;

            // No results
            if (!filtered.length)
                return detachIfFinished(results);

            // One result equals to the prefix
            if (filtered.length == 1 && filtered[0].value == prefix && !filtered[0].snippet)
                return detachIfFinished(results);

            // Autoinsert if one result
            if (this.autoInsert && filtered.length == 1 && results.finished && (filtered[0].snippet|| (filtered[0].value.toLowerCase().substring(0,prefix.length)==prefix)))
                return this.insertMatch(filtered[0]);

            this.openPopup(this.editor, prefix, keepPopupPosition);
        }.bind(this);

        var isImmediate = true;
        var immediateResults = null;
        this.gatherCompletions(this.editor, function(err, results) {
            var prefix = results.prefix;
            var matches = results && results.matches;

            if (!matches || !matches.length)
                return detachIfFinished(results);

            // Wrong prefix or wrong session -> ignore
            if (prefix.indexOf(results.prefix) !== 0 || _id != this.gatherCompletionsId)
                return;

            // If multiple completers return their results immediately, we want to process them together
            if (isImmediate) {
                immediateResults = results;
                return;
            }

            processResults(results);
        }.bind(this));
        
        isImmediate = false;
        if (immediateResults) {
            var results = immediateResults;
            immediateResults = null;
            processResults(results);
        }
    };

    this.cancelContextMenu = function() {
        this.editor.$mouseHandler.cancelContextMenu();
    };

    this.updateDocTooltip = function() {
        if(!this.editor.$enableCompletionTooltips)return;
        var popup = this.popup;
        var all = popup.data;
        var selected = all && (all[popup.getHoveredRow()] || all[popup.getRow()]);
        var doc = null;
        if (!selected || !this.editor || !this.popup.isOpen)
            return this.hideDocTooltip();
        this.editor.completers.some(function(completer) {
            if (completer.getDocTooltip)
                doc = completer.getDocTooltip(selected);
            return doc;
        });
        if (!doc && typeof selected != "string")
            doc = selected;

        if (typeof doc == "string")
            doc = {docText: doc};
        if (!doc || !(doc.docHTML || doc.docText))
            return this.hideDocTooltip();
        this.showDocTooltip(doc);
    };
    this.setContainer = function(container){
        this.parentContainer = container;
        container.appendChild(this.popup.container);
        this.popup.parentNode = container;
    };
    
    this.showDocTooltip = function(item) {
        if (!this.tooltipNode) {
            this.tooltipNode = dom.createElement("div");
            this.tooltipNode.className = "ace_tooltip ace_doc-tooltip";
            this.tooltipNode.style.margin = 0;
            this.tooltipNode.style.pointerEvents = "auto";
            this.tooltipNode.tabIndex = -1;
            this.tooltipNode.style.fontSize = this.popup.getFontSize()+"px";
            this.tooltipNode.onblur = this.blurListener.bind(this);
            this.tooltipNode.onclick = this.onTooltipClick.bind(this);
        }

        var tooltipNode = this.tooltipNode;
        if (item.docHTML) {
            tooltipNode.innerHTML = item.docHTML;
        } else if (item.docText) {
            tooltipNode.textContent = item.docText;
        }

        if (!tooltipNode.parentNode)
            this.parentContainer.appendChild(tooltipNode);
        var popup = this.popup;
        var popupRect = popup.container.getBoundingClientRect();
        var margins = this.popup.getPopupMargins(true);
        var outerRect = this.parentContainer.getBoundingClientRect();
        
        tooltipNode.style.display = "block";
        var VIEW_GAP = this.editor.renderer.layerConfig.lineHeight*2;
        var TIP_MAX_WIDTH = Math.max(tooltipNode.offsetWidth,300);
        var tooltipHeight = Math.max(70,tooltipNode.offsetHeight);
        var isHorizontal = true;
        var SPACE_TO_LEFT = popupRect.left - outerRect.left;
        var SPACE_TO_RIGHT = outerRect.right - popupRect.right;
        var SPACE_MAX  = Math.max(SPACE_TO_RIGHT,SPACE_TO_LEFT);
        if(outerRect.height-(popupRect.height+VIEW_GAP+margins.marginBottom+margins.marginTop)<SPACE_MAX/1.5){
            TIP_MAX_WIDTH = SPACE_MAX;
        }
        if (SPACE_TO_RIGHT < TIP_MAX_WIDTH) {
            if (SPACE_TO_LEFT < TIP_MAX_WIDTH) {
                isHorizontal = false;
                 //Usually mobile
                var SPACE_ABOVE = popupRect.top - outerRect.top - margins.marginTop;
                var SPACE_BELOW = outerRect.bottom - popupRect.bottom - margins.marginBottom;
                if(!popup.isTopdown)SPACE_BELOW -= this.editor.renderer.layerConfig.lineHeight;
                if (popup.isTopdown ? //popup is below cursor, is there space below it??
                    SPACE_BELOW > Math.min(tooltipHeight, SPACE_ABOVE) :
                    //popup is above cursor, is there no space above it
                    SPACE_ABOVE < Math.min(tooltipHeight, SPACE_BELOW - VIEW_GAP)
                ) {
                    //position below
                    if (popup.isTopdown) VIEW_GAP = 1;
                    tooltipNode.style.top = popupRect.bottom - outerRect.top + VIEW_GAP + "px";
                    if(SPACE_BELOW<VIEW_GAP)return this.hideDocTooltip();
                    tooltipNode.style.maxHeight = SPACE_BELOW - VIEW_GAP + "px";
                } else {
                    //position above
                    if (popup.isTopdown) {
                        //give as much as 2 to 4 lines view_gap
                        var farthestTop = Math.max(outerRect.top+margins.marginTop,popupRect.top-outerRect.top - VIEW_GAP - Math.max(70,tooltipNode.offsetHeight+VIEW_GAP));
                        tooltipNode.style.top = farthestTop + "px";
                        var maxHeight = popupRect.top - outerRect.top - farthestTop - VIEW_GAP;
                        if(maxHeight<50)return this.hideDocTooltip();
                        tooltipNode.style.maxHeight = maxHeight + "px";
                        tooltipNode.style.bottom =  "";
                    } else {
                        VIEW_GAP = 1;
                        tooltipNode.style.bottom = outerRect.bottom - popupRect.top - VIEW_GAP+ "px";
                        tooltipNode.style.maxHeight = SPACE_ABOVE + "px";
                        tooltipNode.style.top = "";
                    }
                }
                if (VIEW_GAP > 1) {
                    if (SPACE_TO_LEFT < outerRect.width / 2) {
                        tooltipNode.style.right = 10 + "px";
                        tooltipNode.style.left = "";
                    } else {
                        tooltipNode.style.left = 10 + "px";
                        tooltipNode.style.right = "";
                    }
                    tooltipNode.style.maxWidth = outerRect.width - 20 + "px";
                } else {
                    if (SPACE_TO_LEFT > SPACE_TO_RIGHT) {
                        tooltipNode.style.right = SPACE_TO_RIGHT + "px";
                        tooltipNode.style.maxWidth = SPACE_TO_LEFT + popupRect.width - 5 + "px";
                        tooltipNode.style.left = "";
                    } else if (SPACE_TO_LEFT < SPACE_TO_RIGHT) {
                        tooltipNode.style.left = SPACE_TO_LEFT + "px";
                        tooltipNode.style.maxWidth = SPACE_TO_RIGHT + popupRect.width - 5 + "px";
                        tooltipNode.style.right = "";
                    }
                }
            } else {
                tooltipNode.style.right =  outerRect.right-popupRect.left-1 + "px";
                tooltipNode.style.left = "";
            }
        } else {
            tooltipNode.style.left = (popupRect.right + 1) + "px";
            tooltipNode.style.right = "";
        }
        if(isHorizontal){
            if(popup.isTopdown){
                tooltipNode.style.top = popupRect.top+"px";
                tooltipNode.style.bottom = "";
                tooltipNode.style.maxHeight = window.innerHeight-popupRect.top-margins.marginBottom+"px";
            }
            else{
                tooltipNode.style.top = "";
                tooltipNode.style.bottom = window.innerHeight-popupRect.bottom+"px";
                tooltipNode.style.maxHeight = popupRect.bottom-margins.marginTop+"px";
            }
            tooltipNode.style.maxWidth = TIP_MAX_WIDTH+"px";
        }
    };         

    this.hideDocTooltip = function() {
        this.tooltipTimer.cancel();
        if (!this.tooltipNode) return;
        var el = this.tooltipNode;
        if (!this.editor.isFocused() && document.activeElement == el)
            this.editor.focus();
        this.tooltipNode = null;
        if (el.parentNode)
            el.parentNode.removeChild(el);
    };
    
    this.onTooltipClick = function(e) {
        var a = e.target;
        while (a && a != this.tooltipNode) {
            if (a.nodeName == "A" && a.href) {
                a.rel = "noreferrer";
                a.target = "_blank";
                break;
            }
            a = a.parentNode;
        }
    };

    this.destroy = function() {
        this.detach();
        if (this.popup) {
            this.popup.destroy();
            var el = this.popup.container;
            if (el && el.parentNode)
                el.parentNode.removeChild(el);
        }
        if (this.editor && this.editor.completer == this)
            this.editor.completer == null;
        this.popup = null;
    };

}).call(Autocomplete.prototype);


Autocomplete.for = function(editor) {
    if (editor.completer) {
        return editor.completer;
    }
    if (config.get("sharedPopups")) {
        if (!Autocomplete.$shared)
            Autocomplete.$sharedInstance = new Autocomplete();
        editor.completer = Autocomplete.$sharedInstance;
    } else {
        editor.completer = new Autocomplete();
        editor.once("destroy", function(e, editor) {
            editor.completer.destroy();
        });
    }
    return editor.completer;
};
//Split it up for plugins
//and command replay
Autocomplete.$deletePrefix = {
    name: "deletePrefix",
    exec: function(editor,str){
        var ranges = editor.selection.getAllRanges(),
            session=editor.session;
        for (var i = 0, range; (range = ranges[i]); i++) {
            if (session.getLine(range.start.row).substring(range.start.column - str.length, range.start.column) == str) {
                range.start.column -= str.length;
                session.remove(range);
            }
        }
    }
};
Autocomplete.$insertSnippet = {
    name: "insertSnippet",
    exec: function(editor,snippet){
        snippetManager.insertSnippet(editor, snippet);
    }
};
Autocomplete.$deleteSuffix = {
    name: "deleteSuffix",
    exec: function(editor,str){
        var ranges = editor.selection.getAllRanges();
        var len = str.length;
        for (var i = 0, range;
            (range = ranges[i]); i++) {
            var line = editor.session.getLine(range.end.row).substring(range.end.column);
            for (var j = -1;
                (j = str.indexOf(line[0], j + 1)) > -1;) {
                if (line.substring(0, len - j) === str.substring(j)) {
                    range.end.column += (len - j);
                    editor.session.remove(range);
                    break;
                }
            }
        }
    }
};
Autocomplete.startCommand = {
    name: "startAutocomplete",
    exec: function(editor, options) {
        var completer = Autocomplete.for(editor);
        completer.autoInsert = false;
        completer.autoSelect = true;
        completer.showPopup(editor, options);
        // prevent ctrl-space opening context menu on firefox on mac
        completer.cancelContextMenu();
    },
    bindKey: "Ctrl-Space|Ctrl-Shift-Space|Alt-Space"
};

var FilteredList = function(array, filterText) {
    this.all = array;
    this.filtered = array;
    this.filterText = filterText || "";
    this.exactMatch = false;
};
(function(){
    this.setFilter = function(str) {
        if (str.length > this.filterText && str.lastIndexOf(this.filterText, 0) === 0)
            var matches = this.filtered;
        else
            var matches = this.all;

        this.filterText = str;
        matches = this.filterCompletions(matches, this.filterText);
        matches = matches.sort(function(a, b) {
            return b.exactMatch - a.exactMatch || b.$score - a.$score 
                || (a.caption || a.value).localeCompare(b.caption || b.value);
        });

        // make unique
        var prev = null;
        matches = matches.filter(function(item){
            var caption = item.snippet || item.caption || item.value;
            if (caption === prev) return false;
            prev = caption;
            return true;
        });

        this.filtered = matches;
    };
    this.filterCompletions = function(items, needle) {
        var results = [];
        var upper = needle.toUpperCase();
        var lower = needle.toLowerCase();
        loop: for (var i = 0, item; item = items[i]; i++) {
            var caption = item.caption || item.value || item.snippet;
            if (!caption) continue;
            var lastIndex = -1;
            var matchMask = 0;
            var penalty = 0;
            var index, distance;

            if (this.exactMatch) {
                if (needle !== caption.substr(0, needle.length))
                    continue loop;
            } else {
                /**
                 * It is for situation then, for example, we find some like 'tab' in item.value="Check the table"
                 * and want to see "Check the TABle" but see "Check The tABle".
                 */
                var fullMatchIndex = caption.toLowerCase().indexOf(lower);
                if (fullMatchIndex > -1) {
                    penalty = fullMatchIndex;
                } else {
                    // caption char iteration is faster in Chrome but slower in Firefox, so lets use indexOf
                    for (var j = 0; j < needle.length; j++) {
                        // TODO add penalty on case mismatch
                        var i1 = caption.indexOf(lower[j], lastIndex + 1);
                        var i2 = caption.indexOf(upper[j], lastIndex + 1);
                        index = (i1 >= 0) ? ((i2 < 0 || i1 < i2) ? i1 : i2) : i2;
                        if (index < 0)
                            continue loop;
                        distance = index - lastIndex - 1;
                        if (distance > 0) {
                            // first char mismatch should be more sensitive
                            if (lastIndex === -1)
                                penalty += 10;
                            penalty += distance;
                            matchMask = matchMask | (1 << j);
                        }
                        lastIndex = index;
                    }
                }
            }
            item.matchMask = matchMask;
            item.exactMatch = penalty ? 0 : (caption==needle)?3:(caption.length==needle.length)?2:1;
            item.$score = (item.score || 0) - penalty;
            results.push(item);
        }
        return results;
    };
}).call(FilteredList.prototype);

exports.Autocomplete = Autocomplete;
exports.FilteredList = FilteredList;

});
