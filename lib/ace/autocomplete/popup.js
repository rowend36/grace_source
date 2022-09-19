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

var Renderer = require("../virtual_renderer").VirtualRenderer;
var Editor = require("../editor").Editor;
var Range = require("../range").Range;
var event = require("../lib/event");
var lang = require("../lib/lang");
var dom = require("../lib/dom");

var $singleLineEditor = function(el) {
    var renderer = new Renderer(el);

    renderer.$maxLines = 4;

    var editor = new Editor(renderer);
    editor.setHighlightActiveLine(false);
    editor.setShowPrintMargin(false);
    editor.renderer.setShowGutter(false);
    editor.renderer.setHighlightGutterLine(false);

    editor.$mouseHandler.$focusTimeout = 0;
    editor.$highlightTagPending = true;
    editor.copyTheme = function(host){
        editor.setTheme(host.getTheme());
        var font = host.getFontSize();
        /*Used by Autocompletion icons*/
        if(font<16){
            if(font<12)font=12;
            editor.$popupFontBp = 12;
        }
        else if(font<20){
            editor.$popupFontBp = 16;
        }
        else{
            if(font>24)font = 24;
            editor.$popupFontBp = 20;
        }
        editor.setFontSize(font);
        editor.setOption("fontFamily",host.renderer.$fontFamily);
    };
    return editor;
};
var AcePopup = function(parentNode) {
    var el = dom.createElement("div");
    var popup = $singleLineEditor(el);
  
    if (parentNode)
        parentNode.appendChild(el);
    el.style.display = "none";
    popup.renderer.content.style.cursor = "default";
    popup.renderer.setStyle("ace_autocomplete");
    //disable bracket match
    popup.$highlightPending = 'disabled';
    
    popup.setOption("displayIndentGuides", false);
    popup.setOption("dragDelay", 150);

    var noop = function(){};
    popup.$maxItems = 5000;
    popup.focus = noop;
    popup.$isFocused = true;

    popup.renderer.$cursorLayer.restartTimer = noop;
    popup.renderer.$cursorLayer.element.style.opacity = 0;

    popup.renderer.$maxLines = 8;
    popup.renderer.$keepTextAreaAtCursor = false;

    popup.setHighlightActiveLine(false);
    // set default highlight color
    popup.session.highlight("");
    popup.session.$searchHighlight.clazz = "ace_highlight-marker";

    popup.on("mousedown", function(e) {
        var pos = e.getDocumentPosition();
        popup.selection.moveToPosition(pos);
        selectionMarker.start.row = selectionMarker.end.row = pos.row;
        e.stop();
    });

    var lastMouseEvent;
    var hoverMarker = new Range(-1,0,-1,Infinity);
    var selectionMarker = new Range(-1,0,-1,Infinity);
    selectionMarker.id = popup.session.addMarker(selectionMarker, "ace_active-line", "fullLine");
    popup.setSelectOnHover = function(val) {
        if (!val) {
            hoverMarker.id = popup.session.addMarker(hoverMarker, "ace_line-hover", "fullLine");
        } else if (hoverMarker.id) {
            popup.session.removeMarker(hoverMarker.id);
            hoverMarker.id = null;
        }
    };
    var $textLayer = popup.renderer.$textLayer;
    var renderLine = $textLayer.$renderLine;
    //for dynamically generated styles
    //where using iconClass is not possible
    $textLayer.$renderLine = function(parent,row){
        var noReturn = renderLine.apply(this,arguments);
        var data = popup.getData(row);
        if(data && typeof data.onRender == "function"){
            data.onRender(parent,row,data);
        }
        return noReturn;
    };
    popup.setSelectOnHover(false);
    popup.on("mousemove", function(e) {
        if (!lastMouseEvent) {
            lastMouseEvent = e;
            return;
        }
        if (lastMouseEvent.x == e.x && lastMouseEvent.y == e.y) {
            return;
        }
        lastMouseEvent = e;
        lastMouseEvent.scrollTop = popup.renderer.scrollTop;
        var row = lastMouseEvent.getDocumentPosition().row;
        if (hoverMarker.start.row != row) {
            if (!hoverMarker.id)
                popup.setRow(row);
            setHoverMarker(row);
        }
    });
    popup.renderer.on("beforeRender", function() {
        if (lastMouseEvent && hoverMarker.start.row != -1) {
            lastMouseEvent.$pos = null;
            var row = lastMouseEvent.getDocumentPosition().row;
            if (!hoverMarker.id)
                popup.setRow(row);
            setHoverMarker(row, true);
        }
    });
    popup.renderer.on("afterRender", function() {
        var row = popup.getRow();
        var t = popup.renderer.$textLayer;
        var selected = t.element.childNodes[row - t.config.firstRow];
        if (selected !== t.selectedNode && t.selectedNode)
            dom.removeCssClass(t.selectedNode, "ace_selected");
        t.selectedNode = selected;
        if (selected)
            dom.addCssClass(selected, "ace_selected");
    });
    var hideHoverMarker = function() { setHoverMarker(-1); };
    var setHoverMarker = function(row, suppressRedraw) {
        if (row !== hoverMarker.start.row) {
            hoverMarker.start.row = hoverMarker.end.row = row;
            if (!suppressRedraw)
                popup.session._emit("changeBackMarker");
            popup._emit("changeHoverMarker");
        }
    };
    popup.getHoveredRow = function() {
        return hoverMarker.start.row;
    };

    event.addListener(popup.container, "mouseout", hideHoverMarker);
    popup.on("hide", hideHoverMarker);
    popup.on("changeSelection", hideHoverMarker);

    popup.session.doc.getLength = function() {
        return Math.min(popup.data.length,popup.$maxItems);
    };
    popup.session.doc.getLine = function(i) {
        var data = popup.data[i];
        if (typeof data == "string")
            return data;
        return (data && data.value) || "";
    };

    var bgTokenizer = popup.session.bgTokenizer;
    bgTokenizer.$tokenizeRow = function(row) {
        var data = popup.data[row];
        var tokens = [];
        if (!data)
            return tokens;
        if (typeof data == "string")
            data = {value: data};
        var caption = data.caption || data.value || data.name;

        function addToken(value, className) {
            value && tokens.push({
                type: data.className?(className?data.className+ "."+className:data.className):(className || ""), 
                value: value
            });
        }
        var lower = caption.toLowerCase();
        var filterText = (popup.filterText || "").toLowerCase();
        var lastIndex = 0;
        var lastI = 0;
        for (var i = 0; i <= filterText.length; i++) {
            if (i != lastI && (data.matchMask & (1 << i) || i == filterText.length)) {
                var sub = filterText.slice(lastI, i);
                lastI = i;
                var index = lower.indexOf(sub, lastIndex);
                if (index == -1) continue;
                addToken(caption.slice(lastIndex, index), "");
                lastIndex = index + sub.length;
                addToken(caption.slice(index, lastIndex), "completion-highlight");
            }
        }
        addToken(caption.slice(lastIndex, caption.length), "");
        if (data.message)
            tokens.push({type: "completion-message", value: data.message});
        if (data.meta){
            var chunks = data.meta.split(/([^a-zA-Z0-9$])/);
            for(var n=chunks.length,c=n-1;c>=0;c--){
                if(chunks[c])
                    tokens.push({type: "completion-meta.float-hack-"+(n-c), value: chunks[c]});
                else n--;
            }
        }
        if(popup.showIcons && tokens.length){
            tokens[0].type += ".completion-icon.completion-icon-"+popup.$popupFontBp+(data.iconClass?"."+data.iconClass:".completion-default");
        }
        return tokens;
    };
    bgTokenizer.$updateOnChange = noop;
    bgTokenizer.start = noop;

    popup.session.$computeWidth = function() {
        return this.screenWidth = 0;
    };

    // public
    popup.isOpen = false;
    popup.isTopdown = false;
    popup.autoSelect = true;
    popup.filterText = "";
    popup.showIcons = false;

    popup.data = [];
    popup.setData = function(list, filterText) {
        popup.filterText = filterText || "";
        popup.setValue(lang.stringRepeat("\n", list.length), -1);
        popup.data = list || [];
        popup.setRow(0);
    };
    popup.getData = function(row) {
        return popup.data[row];
    };

    popup.getRow = function() {
        return selectionMarker.start.row;
    };
    popup.setRow = function(line) {
        line = Math.max(this.autoSelect ? 0 : -1, Math.min(this.data.length, line));
        if (selectionMarker.start.row != line) {
            popup.selection.clearSelection();
            selectionMarker.start.row = selectionMarker.end.row = line || 0;
            popup.session._emit("changeBackMarker");
            popup.moveCursorTo(line || 0, 0);
            if (popup.isOpen)
                popup._signal("select");
        }
    };

    popup.on("changeSelection", function() {
        if (popup.isOpen)
            popup.setRow(popup.selection.lead.row);
        popup.renderer.scrollCursorIntoView();
    });

    popup.hide = function() {
        this.container.style.display = "none";
        this._signal("hide");
        popup.isOpen = false;
    };
    popup.show = function(pos, lineHeight, topdownOnly) {
        var margins = popup.getPopupMargins();
        var el = this.container;
        var screenHeight = this.parentNode?this.parentNode.clientHeight:window.innerHeight;
        var screenWidth = this.parentNode?this.parentNode.clientWidth:window.innerWidth;
        var renderer = this.renderer;
        var top = pos.top + this.$borderSize;
        var SPACE_ABOVE = top-margins.marginTop-lineHeight;
        var SPACE_BELOW = screenHeight-top-lineHeight-this.$borderSize-margins.marginBottom;
        if (!topdownOnly && SPACE_ABOVE > SPACE_BELOW*1.4) {
            renderer.$maxPixelHeight = top - 2 * this.$borderSize - margins.marginTop - lineHeight;
            el.style.top = "";
            el.style.bottom = screenHeight - top - this.$borderSize + lineHeight +"px";
            popup.isTopdown = false;
        } else {
            top += lineHeight;
            renderer.$maxPixelHeight = screenHeight - margins.marginBottom - top - 0.2 * lineHeight;
            el.style.top = top + "px";
            el.style.bottom = "";
            popup.isTopdown = true;
        }
        if(renderer.$maxPixelHeight<lineHeight*2)
            renderer.$maxPixelHeight = lineHeight*2;
        el.style.display = "";

        var left = pos.left;
        if (left + el.offsetWidth > screenWidth)
            left = screenWidth - el.offsetWidth;

        el.style.left = left + "px";
        lastMouseEvent = null;
        popup.isOpen = true;
    };
    popup.goTo = function(where) {
        var row = this.getRow();
        var max = this.session.getLength() - 1;

        switch(where) {
            case "up": row = row <= 0 ? max : row - 1; break;
            case "down": row = row >= max ? -1 : row + 1; break;
            case "start": row = 0; break;
            case "end": row = max; break;
        }

        this.setRow(row);
    };


    popup.getTextLeftOffset = function() {
        return this.$borderSize + this.renderer.$padding + this.$imageSize;
    };

    popup.$imageSize = 0;
    popup.$borderSize = 1;
    return popup;
};
Editor.prototype.getPopupMargins = function(){
    return {
        marginTop: 0,
        marginBottom: 0
    };
};
dom.importCssString("\
.ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {\
    background-color: #CAD6FA;\
    z-index: 1;\
}\
.ace_dark.ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {\
    background-color: #3a674e;\
}\
.ace_editor.ace_autocomplete .ace_line-hover {\
    border: 1px solid #abbffe;\
    margin-top: -1px;\
    background: rgba(233,233,253,0.4);\
    position: absolute;\
    z-index: 2;\
}\
.ace_dark.ace_editor.ace_autocomplete .ace_line-hover {\
    border: 1px solid rgba(109, 150, 13, 0.8);\
    background: rgba(58, 103, 78, 0.62);\
}\
.ace_autocomplete .ace_text-layer{\
    width:100%;\
}\
.ace_autocomplete .ace_line{\
    width:100%;\
    overflow: hidden;\
}\
.ace_completion-meta {\
    opacity: 0.7;\
    float: right;\
}\
.ace_float-hack-1{\
    margin-right: 10px;\
}\
.ace_completion-icon:before {\
    display: inline-block;\
    vertical-align: middle;\
    max-height: 100%\
    margin: 0;\
    position: relative;\
    top: -0.13em;\
    margin-right: 5px;\
    text-align: center;\
    content: ' ';\
    -moz-box-sizing: border-box;\
    -webkit-box-sizing: border-box;\
    box-sizing: border-box;\
}\
.ace_completion-icon-12:before {\
    width: 1.2em;\
    height: 1.2em;\
    font-size: 10px;\
    line-height: 1.2em;\
}\
.ace_completion-icon-16:before {\
    width: 1.1em;\
    height: 1.1em;\
    font-size: 15px;\
    line-height: 1.1em;\
}\
.ace_completion-icon-20:before {\
    width: 20px;\
    height: 20px;\
    font-size: 19px;\
    line-height: 20px;\
}\
.ace_completion-message {\
    color: teal;\
    font-weight: bold;\
    margin-left: 1.5em;\
    text-overflow: ellipsis;\
}\
.ace_editor.ace_autocomplete .ace_completion-highlight{\
    color: #2d69c7;\
}\
.ace_dark.ace_editor.ace_autocomplete .ace_completion-highlight{\
    color: #93ca12;\
}\
.ace_editor.ace_autocomplete {\
    width: 300px;\
    z-index: 200000;\
    border: 1px lightgray solid;\
    position: fixed;\
    box-shadow: 2px 3px 5px rgba(0,0,0,.2);\
    line-height: 1.45;\
    background: #fefefe;\
    color: #111;\
}\
.ace_dark.ace_editor.ace_autocomplete {\
    border: 1px #484747 solid;\
    box-shadow: 2px 3px 5px rgba(0, 0, 0, 0.51);\
    line-height: 1.45;\
    background: #25282c;\
    color: #c1c1c1;\
}", "autocompletion.css", false);

exports.AcePopup = AcePopup;
exports.$singleLineEditor = $singleLineEditor;
});