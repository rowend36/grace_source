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
    
    var MouseEvent = require("./mouse_event").MouseEvent;
    var dom = require("../lib/dom");
    
    exports.addTouchListeners = function(el, editor){
        var mode = "scroll";
        var startX;
        var startY;
        var touchStartT;
        var lastT;
        var longTouchTimer;
        var animationTimer;
        var animationSteps = 0;
        var pos;
        var clickCount = 0;
        var vX = 0;
        var vY = 0;
        var pressed;
        var contextMenu;
        var new_scale, initial_scale;
    
        function createContextMenu() {
            var clipboard = window.navigator && window.navigator.clipboard;
            var isOpen = false;
            var updateMenu = function() {
                var selected = editor.getCopyText();
                var hasUndo = editor.session.getUndoManager().hasUndo();
                contextMenu.replaceChild(
                    dom.buildDom(isOpen ? ["span", !selected && ["span", { class: "ace_mobile-button", action: "selectall" }, "Select All"],
                        selected && ["span", { class: "ace_mobile-button", action: "copy" }, "Copy"],
                        selected && ["span", { class: "ace_mobile-button", action: "cut" }, "Cut"],
                        clipboard && ["span", { class: "ace_mobile-button", action: "paste" }, "Paste"],
                        hasUndo && ["span", { class: "ace_mobile-button", action: "undo" }, "Undo"],
                        ["span", { class: "ace_mobile-button", action: "find" }, "Find"],
                        ["span", { class: "ace_mobile-button", action: "openCommandPallete" }, "Pallete"]
                    ] : ["span"]),
                    contextMenu.firstChild
                );
            };
            var handleClick = function(e) {
                var action = e.target.getAttribute("action");
    
                if (action == "more" || !isOpen) {
                    isOpen = !isOpen;
                    return updateMenu();
                }
                if (action == "paste") {
                    clipboard.readText().then(function(text) {
                        editor.execCommand(action, text);
                    });
                }
                else if (action) {
                    if (action == "cut" || action == "copy") {
                        if (clipboard)
                            clipboard.writeText(editor.getCopyText());
                        else
                            document.execCommand("copy");
                    }
                    editor.execCommand(action);
                }
                contextMenu.firstChild.style.display = "none";
                isOpen = false;
                if (action != "openCommandPallete")
                    editor.focus();
            };
            contextMenu = dom.buildDom(["div",
                {
                    class: "ace_mobile-menu",
                    ontouchstart: function(e) {
                        mode = "menu";
                        e.stopPropagation();
                        e.preventDefault();
                        editor.textInput.focus();
                    },
                    ontouchend: function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        handleClick(e);
                    },
                    onclick: handleClick
                },
                ["span"],
                ["span", { class: "ace_mobile-button", action: "more" }, "..."]
            ], editor.container);
        }
    
        function showContextMenu() {
            if (!contextMenu) createContextMenu();
            var cursor = editor.selection.cursor;
            var pagePos = editor.renderer.textToScreenCoordinates(cursor.row, cursor.column);
            var rect = editor.container.getBoundingClientRect();
            contextMenu.style.top = Math.min(pagePos.pageY-rect.top,/**/Math.max(10, pagePos.pageY - rect.top + 40)/**/) + "px";
            contextMenu.style.right = "20px";
            contextMenu.style.display = "";
            contextMenu.firstChild.style.display = "none";
            editor.on("input", hideContextMenu);
        }
    
        function hideContextMenu(e) {
            if (contextMenu)
                contextMenu.style.display = "none";
            editor.off("input", hideContextMenu);
        }
    
        function handleLongTap() {
            longTouchTimer = null;
            clearTimeout(longTouchTimer);
            var range = editor.selection.getRange();
            var inSelection = range.contains(pos.row, pos.column);
            if (range.isEmpty() || !inSelection) {
                editor.selection.moveToPosition(pos);
                editor.selection.selectWord();
            }
            else
                showContextMenu();
            mode = "wait";
        }
    
        function switchToSelectionMode() {
            longTouchTimer = null;
            clearTimeout(longTouchTimer);
            editor.selection.moveToPosition(pos);
            var range = clickCount >= 2 ?
                editor.selection.getLineRange(pos.row) :
                editor.session.getBracketRange(pos);
            if (range && !range.isEmpty()) {
                editor.selection.setRange(range);
            }
            else {
                editor.selection.selectWord();
            }
            mode = "wait";
        }
        el.addEventListener("contextmenu", function(e) {
            if (!pressed) return;
            editor.textInput.getElement().focus();
        });
        
        var touchScroller,handledScroll,showTimeout;
        function createTouchScroller() {
            var touchInner = dom.createElement("div");
            touchInner.style.height = "2px";
            touchInner.style.width = "2px";
    
            touchScroller = dom.createElement("div");
            touchScroller.className = "touch_scroller";
            touchScroller.style.overflow = "scroll";
            //touchScroller.style.background = "";
            
            touchScroller.style.position = "absolute";
            touchScroller.style.touchAction = "pan-x pan-y";
            touchScroller.style.zIndex = 1;
            touchScroller.style.top = touchScroller.style.bottom = touchScroller.style.left = touchScroller.style.right = "-50px";
            editor.renderer.scroller.appendChild(touchScroller);
            touchInner.style.visibility = "hidden";
            touchScroller.appendChild(touchInner);
    
            touchScroller.addEventListener("scroll", function(e) {
                if (editor.session.getScrollTop() != touchScroller.scrollTop - editor.renderer.scrollMargin.top) {
                    editor.session.setScrollTop(this.scrollTop - editor.renderer.scrollMargin.top);
                }
                if (editor.session.getScrollLeft() != touchScroller.scrollLeft - editor.renderer.scrollMargin.left) {
                    editor.session.setScrollLeft(this.scrollLeft - editor.renderer.scrollMargin.left);
                }
            });
    
            /*function clone(eventName, event) {
                return new event.constructor(eventName, event);
            }
            
            var target;
            var dtarget = editor.renderer.getMouseEventTarget();
            var focustarget = editor.textInput.getElement();
            */
            touchScroller.addEventListener("touchstart",function(e){
                handledScroll = true;
            });
            touchScroller.addEventListener("mousedown",function(e){
                if(showTimeout){
                    clearTimeout(showTimeout);
                }
                else{
                    this.style.visibility = 'hidden';
                }
                showTimeout = setTimeout(function(){
                    touchScroller.style.visibility = 'visible';
                    showTimeout = null;
                },1000);
            });
            function update(){
                var scrollHeight = touchScroller.clientHeight - editor.renderer.scroller.clientHeight + editor.renderer.scrollMargin.v + editor.renderer.layerConfig.maxHeight /* editor.renderer.scrollBarH.getHeight()*/ + "px";
                var scrollWidth = touchScroller.clientWidth - editor.renderer.$size.scrollerWidth + editor.renderer.scrollBarH.scrollWidth + "px";
                if (scrollHeight != touchInner.style.height) {
                    touchInner.style.height = scrollHeight;
                }
                if (scrollWidth != touchInner.style.width) {
                    touchInner.style.width = scrollWidth;
                }
                if (editor.session.getScrollTop() != (touchScroller.scrollTop - editor.renderer.scrollMargin.top)) {
                    touchScroller.scrollTop = editor.session.getScrollTop() + editor.renderer.scrollMargin.top;
    
                }
                if (editor.session.getScrollLeft() != (touchScroller.scrollLeft - editor.renderer.scrollMargin.left)) {
                    touchScroller.scrollLeft = editor.session.getScrollLeft() + editor.renderer.scrollMargin.left;
                }
            }
            editor.renderer.on("afterRender", update);
            update();
            return;
        }
        
        var lefthandle, selecthandle, righthandle;
        function createSelectHandles() {
            selecthandle = dom.createElement("div");
            selecthandle.className = "ace_cursor_handle-center";
            lefthandle = dom.createElement("div");
            lefthandle.className = "ace_cursor_handle-left";
            righthandle = dom.createElement("div");
            righthandle.className = "ace_cursor_handle-right";
            righthandle.style.visibility = "hidden";
            lefthandle.style.visibility = "hidden";
            selecthandle.style.visibility = "hidden";
            var ev_pd = (function(el) {
                el.addEventListener("mousedown", function(e) {
                    e.preventDefault();
                }, { passive: false });
            });
            editor.renderer.container.appendChild(lefthandle);
            editor.renderer.container.appendChild(righthandle);
            editor.renderer.container.appendChild(selecthandle);
            ev_pd(selecthandle);
            ev_pd(lefthandle);
            ev_pd(righthandle);
            var show = function() {
                selecthandle.style.visibility = "";
                editor.once("input",hide);
                editor.renderer.on('afterRender',update);
            };
            var hide = function() {
                selecthandle.style.visibility = "hidden";
                editor.once('mousedown',show);
                editor.renderer.off('afterRender',update);
            };
            hide();
            function update() {
                var pos;
                if (editor.selection.isEmpty()) {
                    righthandle.style.visibility = "hidden";
                    lefthandle.style.visibility = "hidden";
                    pos = cursorToScreenPos();
                    selecthandle.style.left = (pos.left - selecthandle.clientWidth / 2) + "px";
                    selecthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";
                }
                else{
                    selecthandle.style.visibility = "hidden";
                    righthandle.style.visibility = "visible";
                    lefthandle.style.visibility = "visible";
                    var range = editor.selection.getRange();
                    pos = cursorToScreenPos(range.start, true);
                    lefthandle.style.left = pos.left - lefthandle.clientWidth + "px";
                    lefthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";
                    pos = cursorToScreenPos(range.end, true);
                    righthandle.style.left = pos.left + "px";
                    righthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";
                }
            }
        }
        function cursorToScreenPos(cursor) {
            var pos = editor.renderer.$cursorLayer.getPixelPosition(cursor, true);
            pos.left += editor.renderer.gutterWidth - editor.session.getScrollLeft() + editor.renderer.margin.left;
            pos.top += editor.renderer.margin.top - editor.renderer.layerConfig.offset;
            return pos;
        }
        
        function initMobile(e){
            if(e)
                el.removeEventListener("touchend",initMobile);
            if(animationSteps>0){
                setTimeout(initMobile, animationSteps * 10);
                return;
            }
            if(!touchScroller && editor.$useTouchScroller!==false){
                editor.$useTouchScroller = true;
                setTimeout(createTouchScroller,0);
            }
            if(!lefthandle && !editor.$disableTouchHandles){
                setTimeout(createSelectHandles,0);
            }
        }
        
        el.addEventListener("touchstart", function(e) {
            var touches = e.touches;
            if (longTouchTimer) {
                clearTimeout(longTouchTimer);
                longTouchTimer = null;
                touchStartT = -1;
            }
            if (touches.length > 1) {
                mode = "zoom";
                startZoom(touches);
                return;
            }
    
            pressed = editor.$mouseHandler.isMousePressed = true;
            var h = editor.renderer.layerConfig.lineHeight;
            var t = e.timeStamp;
            lastT = t;
            var touchObj = touches[0];
            var x = touchObj.clientX;
            var y = touchObj.clientY;
            if (Math.abs(startX - x) + Math.abs(startY - y) > h)
                touchStartT = -1;
            
            startX = e.clientX = x;
            startY = e.clientY = y;
            if(animationTimer){
                clearTimeout(animationTimer);
                animationTimer = null;
            }
            vX=vY=0;
            var ev = new MouseEvent(e, editor);
            pos = ev.getDocumentPosition();
    
            if (t - touchStartT < 500 && touches.length == 1 && !animationSteps) {
                clickCount++;
                e.preventDefault();
                e.button = 0;
                switchToSelectionMode();
            }
            else if(animationSteps>0){
                mode = "scroll";
            }
            else {
                longTouchTimer = setTimeout(handleLongTap, 450);
                clickCount = 0;
                if (lefthandle) {
                    if (e.target == lefthandle) {
                        mode = editor.selection.isBackwards() ? "cursor" : "anchor";
                    }
                    else if (e.target == righthandle) {
                        mode = editor.selection.isBackwards() ? "anchor" : "cursor";
                    }
                    else if (e.target == selecthandle) {
                        mode = "cursor";
                    }
                    else
                        mode = "scroll";
                }
                else {
                    var cursor = editor.selection.cursor;
                    var anchor = editor.selection.isEmpty() ? cursor : editor.selection.anchor;
                    var w = editor.renderer.layerConfig.lineHeight;
                    var cursorPos = cursorToScreenPos(cursor);
                    var anchorPos = cursorToScreenPos(anchor);
                    var rect = editor.container.getBoundingClientRect();
                    var weightedDistance = function(x, y) {
                        x = x / w - 0.5;
                        y = y / h - 0.75;
                        return x * x + y * y;
                    };
                    var diff1 = weightedDistance(
                        e.clientX - rect.left - cursorPos.left,
                        e.clientY - rect.top - cursorPos.top
                    );
                    var diff2 = weightedDistance(
                        e.clientX - rect.left - anchorPos.left,
                        e.clientY - rect.top - anchorPos.top
                    );
                    if (diff1 < 3.5 && diff2 < 3.5)
                        mode = diff1 > diff2 ? "cursor" : "anchor";
    
                    else if (diff2 < 3.5)
                        mode = "anchor";
                    else if (diff1 < 3.5)
                        mode = "cursor";
                    else
                        mode = "scroll";
    
                }
            }
            touchStartT = t;
        });
        el.addEventListener("touchend", function(e) {
            pressed = editor.$mouseHandler.isMousePressed = false;
            if (mode == "scroll") {
                if(!handledScroll){
                    var callback;
                    if(touchScroller)callback = function(){
                        touchScroller.style.visibility = '';
                    }
                    
                    //if (touchScroller && touchScroller.style.visibilty == 'hidden')
                    animate(callback);
                }
                else handledScroll = false;
                hideContextMenu();
            }
            else{
                handledScroll = false;
                animationSteps = 0;
                if (mode == "zoom") {
                    mode = "";
                    initial_scale = new_scale = -1;
                }
            
                else if (longTouchTimer) {
                    editor.selection.moveToPosition(pos);
                    showContextMenu();
                }
            }
            if(longTouchTimer){
                clearTimeout(longTouchTimer);
                longTouchTimer = null;
            }
        });
        el.addEventListener("touchmove", function(e) {
            if (longTouchTimer) {
                clearTimeout(longTouchTimer);
                longTouchTimer = null;
            }
            var touches = e.touches;
            if (touches.length > 1 && mode == "zoom") {
                var dX = (touches[0].clientX - touches[1].clientX);
                var dY = (touches[0].clientY - touches[1].clientY);
                new_scale = dX * dX + dY * dY;
                if (initial_scale < 0)
                    initial_scale = new_scale;
                var zoom = new_scale / initial_scale;
                zoomBy(Math.sqrt(zoom));
                
            }
        
            var touchObj = touches[0];
        
            var wheelX = startX - touchObj.clientX;
            var wheelY = startY - touchObj.clientY;
        
            if (mode == "wait") {
                if (wheelX * wheelX + wheelY * wheelY > 4)
                    mode = "cursor";
                else
                    return e.preventDefault();
            }
        
            startX = touchObj.clientX;
            startY = touchObj.clientY;
        
            e.clientX = touchObj.clientX;
            e.clientY = touchObj.clientY;
        
            var t = e.timeStamp;
            var dt = t - lastT;
            lastT = t;
            if (mode == "scroll") {
                if(handledScroll)return;
                if(touchScroller){
                    if(showTimeout){
                        clearTimeout(showTimeout);
                        showTimeout = null;
                    }
                }
                var mouseEvent = new MouseEvent(e, editor);
                mouseEvent.speed = 1;
                if (3 * Math.abs(wheelX) < Math.abs(wheelY)) wheelX = 0;
                if (3 * Math.abs(wheelY) < Math.abs(wheelX)) wheelY = 0;
                if (dt !== 0) {
                    vX = wheelX / dt;
                    vY = wheelY / dt;
                }
                mouseEvent.wheelX = wheelX;
                mouseEvent.wheelY = wheelY;
                
                editor._emit("mousewheel", mouseEvent);
                if (!mouseEvent.propagationStopped) {
                    vX = vY = 0;
                }
                
            }
            else {
                var ev = new MouseEvent(e, editor);
        
                if (mode == "cursor" || mode == "anchor") {
                    ev.clientY = ev.clientY - 50;
                    var pos = ev.getDocumentPosition();
                    if (mode == "cursor") {
                        editor.selection.moveCursorToPosition(pos);
                    }
                    else
                        editor.selection.setSelectionAnchor(pos.row, pos.column);
                    pos.row++;
                    editor.renderer.scrollCursorIntoView(pos);
        
                }
                e.preventDefault();
            }
        });
        el.addEventListener("touchend",initMobile);
        
        var zoomCenter;
        var zoomCenterX  = 0.5, zoomCenterY = 0.5;
        function startZoom(touches){
            var dX = (touches[0].clientX - touches[1].clientX);
            var dY = (touches[0].clientY - touches[1].clientY);
            initial_scale = -1;
            var renderer = editor.renderer;
            zoomCenterX = (-dX*0.5 + touches[0].clientX);
            if(beforeRendererBound)
                editor.renderer.off("beforeRender",beforeRender)
            beforeRendererBound =false;
            zoomCenterY = (-dY*0.5 + touches[0].clientY);
            zoomCenter = editor.renderer.screenToTextCoordinates(zoomCenterX,zoomCenterY);
        }
        var beforeRendererBound = false
        function beforeRender(){
            beforeRendererBound = false;
            editor.renderer.off("beforeRender",beforeRender)
            
            var renderer = editor.renderer;
            renderer.$computeLayerConfig();
            
            var center = editor.renderer.textToScreenCoordinates(zoomCenter.row,zoomCenter.column);
            var diffX = center.pageX-zoomCenterX;
            var diffY = center.pageY-zoomCenterY;
            
            renderer.scrollBy(diffX, diffY);
            }
        function zoomBy(scale) {
            scale = Math.min(2,Math.max(0.5,scale));
            var oldFontSize = editor.getFontSize();
            var newFontSize = oldFontSize * scale;
            if(Math.abs(oldFontSize-newFontSize)<1)
                return;
            initial_scale = new_scale;
            editor.setFontSize(newFontSize);
            if(!beforeRendererBound)
                editor.renderer.on("beforeRender",beforeRender);
        }
        
        function animate(callback) {
            var v = Math.min(3.5,Math.sqrt(vX*vX+vY*vY));
            var lastTime = new Date().getTime();
            animationSteps += 20*v;
            var flingCoeff = Math.exp(v);
            if(Math.abs(vX)>0.7)
                vX*=flingCoeff;
            if(Math.abs(vY)>0.7)
                vY*=flingCoeff;
            function render() {
                var t = new Date().getTime();
                if (animationSteps-- <= 0) {
                    //due to decrement, touchstart or touchend
                    animationTimer = null;
                    callback && callback();
                    return;
                }
                if (Math.abs(vX) < 0.01) vX = 0;
                if (Math.abs(vY) < 0.01) vY = 0;
                //Approximation of a spline
                if (animationSteps < 20){
                    
                vX = 0.9 * vX;
                vY = 0.9 * vY;
                }
                else{
                    vX = 0.99*vX;
                    vY = 0.99*vY;
                }
                var oldScrollTop = editor.session.getScrollTop();
                var oldScrollLeft = editor.session.getScrollLeft();
                var dt = Math.min(50,t-lastTime);
                editor.renderer.scrollBy(dt * vX, dt * vY);
                //does anyone ever fling diagonally
                if (oldScrollLeft == editor.session.getScrollLeft() && oldScrollTop == editor.session.getScrollTop())
                    animationSteps = 0;
                //requestAnimationFrame is not the best since
                //rendering will happen asynchronously
                animationTimer = setTimeout(render,Math.max(0,34-dt));
                lastTime = t;
            }
            if(animationTimer)clearTimeout(animationTimer);
            animationTimer = setTimeout(render, 10);
        }
    };
});