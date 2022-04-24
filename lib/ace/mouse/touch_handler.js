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
exports.addTouchListeners = function(el, editor) {
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
    var isGutter = false;
    var vX = 0;
    var vY = 0;
    var pressed;
    var new_scale, initial_scale;
    var contextMenu,contextMenuEvent;
    //Allow extension/customization of mobile menu
    //while still doing the main work
    editor.mobileMenu = {
        element: null,
        create: function() {
            var self = this;
            var handleClick = function(e) {
                var action = e.target.getAttribute("action");
                if (action == "more" || !self.isOpen) {
                    return updateMenu(!self.isOpen);
                } else editor._emit("menuClick", {
                    action: action
                });
            };
            this.element = dom.buildDom(["div",
                {
                    class: "ace_mobile-menu",
                    ontouchstart: function(e) {
                        mode = "menu";
                        e.stopPropagation();
                        editor.textInput.focus();
                    },
                    ontouchend: function(e) {
                        e.stopPropagation();
                    },
                    onmousedown: function(e) {
                        e.stopPropagation();
                        event.preventDefault(e);
                        handleClick(e);
                    }
                },
                ["span"],
                ["span", {
                    class: "ace_mobile-button",
                    action: "more"
                }, "..."]
            ], editor.container);
        },
        show: showContextMenu,
        hide: hideContextMenu,
        isOpen: false,
        maxWidth: 200,
        update: function(isOpen) {
            var clipboard = window.navigator && window.navigator.clipboard;
            var selected = editor.getCopyText();
            var hasUndo = editor.session.getUndoManager().hasUndo();
            contextMenu.replaceChild(
                dom.buildDom(isOpen ? ["span",
                    !selected && ["span", {
                        class: "ace_mobile-button",
                        action: "selectall"
                    }, "Select All"],
                    selected && ["span", {
                        class: "ace_mobile-button",
                        action: "copy"
                    }, "Copy"],
                    selected && ["span", {
                        class: "ace_mobile-button",
                        action: "cut"
                    }, "Cut"],
                    clipboard && ["span", {
                        class: "ace_mobile-button",
                        action: "paste"
                    }, "Paste"],
                    hasUndo && ["span", {
                        class: "ace_mobile-button",
                        action: "undo"
                    }, "Undo"],
                    ["span", {
                        class: "ace_mobile-button",
                        action: "find"
                    }, "Find"],
                    ["span", {
                        class: "ace_mobile-button",
                        action: "openCommandPallete"
                    }, "Pallete"]
                ] : ["span"]),
                contextMenu.firstChild
            );
        }
    };
    function updateMenu(open) {
        var mobileMenu = editor.mobileMenu;
        if (open === true) mobileMenu.isOpen = true;
        else if (open === false) mobileMenu.isOpen = false;
        else open = mobileMenu.isOpen;
        mobileMenu.update(open);
    }
    function createContextMenu() {
        var clipboard = window.navigator && window.navigator.clipboard;
        editor.setDefaultHandler("menuClick",function(ev){
            var action = ev.action;
            updateMenu(false);
            if (action == "paste") {
                clipboard.readText().then(function(text) {
                    editor.execCommand('paste', text);
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
            if (action !== "find" && action != "openCommandPallete")
                editor.focus();
        });
        if(!editor.mobileMenu.element)
            editor.mobileMenu.create();
        contextMenu = editor.mobileMenu.element;
    }
    function showContextMenu() {
        if (editor.$useNativeContextMenu == true) {
            return false;
        }
        if (!contextMenu) createContextMenu();
        else updateMenu();
        var cursor = editor.selection.cursor;
        var lineHeight = editor.renderer.lineHeight + (editor.$useNativeContextMenu?100:30);
        var pagePos = contextMenuEvent?{
            pageX: contextMenuEvent.clientX,
            pageY: contextMenuEvent.clientY-15
        }: editor.renderer.textToScreenCoordinates(cursor.row, cursor.column);
        //var scrollLeft = editor.renderer.scrollLeft;
        var leftOffset = editor.renderer.textToScreenCoordinates(0, 0).pageX;
        var rect = editor.container.getBoundingClientRect();
        contextMenu.style.top =
            pagePos.pageY - rect.top -
            ((pagePos.pageY - rect.top)*1.5 > rect.bottom - pagePos.pageY ? lineHeight : -lineHeight) + "px";
        
        if (pagePos.pageX - rect.left > rect.width - editor.mobileMenu.maxWidth) {
            //position to right
            contextMenu.style.left = "";
            contextMenu.style.right = Math.min(rect.width-editor.mobileMenu.maxWidth,
                Math.max(rect.width - pagePos.pageX - editor.mobileMenu.maxWidth/2,
            10))+"px";
        } else {
            //position to left
            contextMenu.style.right = "";
            //contextMenu.style.left = leftOffset + scrollLeft - rect.left + "px";
            contextMenu.style.left = Math.min(rect.width-editor.mobileMenu.maxWidth ,
                Math.max( pagePos.pageX  - rect.left - editor.mobileMenu.maxWidth/2,
            10+leftOffset))+"px";
        }
        contextMenu.style.display = "";
        // contextMenu.firstChild.style.display = "none";
        editor.on("input", hideContextMenu);
    }
    function hideContextMenu(/*e*/) {
        if (contextMenu){
            if(editor.mobileMenu.isOpen){
                updateMenu(false);
            }
            contextMenu.style.display = "none";
        }
        editor.off("input", hideContextMenu);
    }
    
    el.addEventListener("contextmenu", function(e) {
        if(!pressed) return e.preventDefault();
        if(!editor.$useNativeContextMenu){
            e.preventDefault();
            if(!longTouchTimer) showContextMenu();
            editor.textInput.getElement().focus();
        }
        //New Issues with every new Chrome release
    });
    function handleLongTap() {
        longTouchTimer = null;
        clearTimeout(longTouchTimer);
        var range = editor.selection.getRange();
        var inSelection = range.contains(pos.row, pos.column);
        var token;
        var inSpace = pos.column==editor.session.getDocumentLastRowColumn(pos.row,pos.column) || (!(token = editor.session.getTokenAt(pos.row,pos.column)) || (token.value[0]==" "||token.value[0]=="\t"));
        if ((range.isEmpty() || !inSelection) && !inSpace) {
            editor.selection.moveToPosition(pos);
            editor.selection.selectWord();
        }
        mode = "wait";
        showContextMenu();
    }

    function switchToSelectionMode(ev) {
        mode = "wait";
        longTouchTimer = null;
        clearTimeout(longTouchTimer);
        if(clickCount>2){
            editor.selectAll();
            clickCount = 2;
        }
        else{
            if(clickCount==1){
                editor._signal("dblclick",ev);
                if(ev.defaultPrevented)return;
            }
            editor.selection.moveToPosition(pos);
            var range = clickCount == 2 ?
                editor.selection.getLineRange(pos.row) :
                editor.session.getBracketRange(pos);
            if (range && !range.isEmpty()) {
                editor.selection.setRange(range);
            } else {
                editor.selection.selectWord();
            }
        }
    }
    

    var touchScroller, handledScroll, showTimeout;

    function createSelectHandles() {
        cursorHandle = dom.createElement("div");
        cursorHandle.className = "ace_cursor_handle-center";
        leftHandle = dom.createElement("div");
        leftHandle.className = "ace_cursor_handle-left";
        rightHandle = dom.createElement("div");
        rightHandle.className = "ace_cursor_handle-right";
        rightHandle.style.visibility = "hidden";
        leftHandle.style.visibility = "hidden";
        cursorHandle.style.visibility = "hidden";
        var ev_pd = (function(el) {
            el.addEventListener("mousedown", function(e) {
                e.preventDefault();
            }, { passive: false });
        });
        editor.renderer.container.appendChild(leftHandle);
        editor.renderer.container.appendChild(rightHandle);
        editor.renderer.container.appendChild(cursorHandle);
        ev_pd(cursorHandle);
        ev_pd(leftHandle);
        ev_pd(rightHandle);
        var show = function() {
            update();
            editor.once("input", hide);
            editor.renderer.on('afterRender', update);
        };
        var hide = function() {
            rightHandle.style.visibility = 'hidden';
            leftHandle.style.visibility = 'hidden';
            cursorHandle.style.visibility = "hidden";
            editor.once('mousedown', show);
            editor.renderer.off('afterRender', update);
        };
        hide();

        function update() {
            var pos;
            var cursor = editor.getSelection().getCursor();
            if (editor.selection.isEmpty()) {
                rightHandle.style.visibility = "hidden";
                leftHandle.style.visibility = "hidden";
                pos = cursorToScreenPos(cursor);
                cursorHandle.style.visibility = 'visible';
                cursorHandle.style.left = (1+pos.left - cursorHandle.clientWidth / 2) + "px";
                cursorHandle.style.top = (pos.top+editor.renderer.layerConfig.lineHeight) + "px";
            } else {
                cursorHandle.style.visibility = "hidden";
                rightHandle.style.visibility = "visible";
                leftHandle.style.visibility = "visible";
                var range = editor.selection.getRange();
                pos = cursorToScreenPos(range.start);
                leftHandle.style.left = pos.left - leftHandle.clientWidth + "px";
                leftHandle.style.top = (pos.top+editor.renderer.layerConfig.lineHeight) + "px";
                pos = cursorToScreenPos(range.end);
                rightHandle.style.left = pos.left + "px";
                rightHandle.style.top = (pos.top+editor.renderer.layerConfig.lineHeight) + "px";
            }
        }
        show();
    }

    function cursorToScreenPos(cursor) {
        var pos = editor.renderer.getCursorPixelPosition(cursor, true);
        pos.left += editor.renderer.gutterWidth - editor.session.getScrollLeft() + editor
            .renderer
            .margin.left;
        pos.top -= editor.renderer.layerConfig.offset;
        return pos;
    }
    var leftHandle, cursorHandle, rightHandle;

    function createTouchScroller() {
        var touchInner = dom.createElement("div");
        touchInner.style.height = "2px";
        touchInner.style.width = "2px";
    
        touchScroller = dom.createElement("div");
        touchScroller.className = "touch_scroller";
        touchScroller.style.overflow = "scroll";
    
        touchScroller.style.position = "absolute";
        touchScroller.style.touchAction = "pan-x pan-y";
        touchScroller.style.zIndex = 1;
        touchScroller.style.top = touchScroller.style.bottom = touchScroller.style.left =
            touchScroller.style.right = "-50px";
        editor.renderer.scroller.appendChild(touchScroller);
        touchInner.style.visibility = "hidden";
        touchScroller.appendChild(touchInner);
    
        touchScroller.addEventListener("scroll", function(/*e*/) {
            if (editor.session.getScrollTop() != touchScroller.scrollTop - editor
                .renderer
                .scrollMargin.top) {
                editor.session.setScrollTop(this.scrollTop - editor.renderer
                    .scrollMargin
                    .top);
            }
            if (editor.session.getScrollLeft() != touchScroller.scrollLeft - editor
                .renderer
                .scrollMargin.left) {
                editor.session.setScrollLeft(this.scrollLeft - editor.renderer
                    .scrollMargin
                    .left);
            }
        });
    
        touchScroller.addEventListener("touchstart", function(/*e*/) {
            handledScroll = true;
        });
        //If the user is having problems clicking something
        //usually links
        editor.on("dblclick", function(e) {
            //should be impossible
            if (showTimeout) {
                clearTimeout(showTimeout);
            } else {
                touchScroller.style.visibility = 'hidden';
                var el = document.elementFromPoint(e.clientX, e.clientY);
                el.click();
            }
            showTimeout = setTimeout(function() {
                touchScroller.style.visibility = 'visible';
                showTimeout = null;
            }, 5000);
        });
        var _scrollHeight;
        var _scrollWidth;
        var scrollMask = editor.renderer.CHANGE_H_SCROLL |
            editor.renderer.CHANGE_SCROLL|
            editor.renderer.CHANGE_FULL;
        var sizeMask = editor.renderer.CHANGE_SIZE |
            editor.renderer.CHANGE_FULL;
    
        function update(changes) {
            if (changes & sizeMask) {
                var scrollHeight = touchScroller.clientHeight - editor.renderer.scroller
                    .clientHeight +
                    editor.renderer.scrollMargin.v + editor.renderer.layerConfig
                    .maxHeight /* editor.renderer.scrollBarH.getHeight()*/ ;
                var scrollWidth = touchScroller.clientWidth - editor.renderer.$size
                    .scrollerWidth +
                    editor.renderer.scrollBarH.scrollWidth - 3; //to handle rounding errors
                if (scrollHeight != _scrollHeight) {
                    _scrollHeight = scrollHeight;
                    touchInner.style.height = scrollHeight + "px";
                }
                if (scrollWidth != _scrollWidth) {
                    _scrollWidth = scrollWidth;
                    touchInner.style.width = scrollWidth + "px";
                }
            }
            if(changes & scrollMask){
                if (editor.session.getScrollTop() != (touchScroller.scrollTop - editor
                        .renderer
                        .scrollMargin.top)) {
                    touchScroller.scrollTop = editor.session.getScrollTop() + editor
                        .renderer
                        .scrollMargin.top;
                }
                if (editor.session.getScrollLeft() != (touchScroller.scrollLeft - editor
                        .renderer
                        .scrollMargin.left)) {
                    touchScroller.scrollLeft = editor.session.getScrollLeft() + editor
                        .renderer
                        .scrollMargin.left;
                }
            }
        }
        editor.renderer.on("afterRender", update);
        update(editor.renderer.CHANGE_SIZE, editor.renderer);
    }
    function initMobile(e) {
        if (e)
            el.removeEventListener("touchend", initMobile);
        if (animationSteps > 0) {
            setTimeout(initMobile, animationSteps * 17);
            return;
        }
        if (!touchScroller && editor.$useTouchScroller !== false) {
            editor.$useTouchScroller = true;
            setTimeout(createTouchScroller, 0);
        }
        if (!leftHandle && editor.$enableTouchHandles) {
            setTimeout(createSelectHandles, 0);
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
        if (beforeRendererBound){
            editor.renderer.off("beforeRender", beforeRender);
            beforeRendererBound = false;
        }
        var target = e.target;
        if (target != el)
            do {
                if (target == editor.renderer.$gutter) {
                    isGutter = true;
                    break;
                }
                target = target.parentElement;
            }
            while (target != el);
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
        if (animationTimer) {
            clearTimeout(animationTimer);
            animationTimer = null;
        }
        vX = vY = 0;
        var ev = new MouseEvent(e, editor);
        pos = ev.getDocumentPosition();

        if (t - touchStartT < ((clickCount-1)*100 + 500) && touches.length == 1 && !animationSteps) {
            clickCount++;
            e.preventDefault();
            e.button = 0;
            switchToSelectionMode(ev);
        } else if (animationSteps > 0) {
            clickCount = 0;
            mode = "scroll";
        } else {
            contextMenuEvent = e;
            longTouchTimer = setTimeout(handleLongTap, 450);
            clickCount = 0;
            if (leftHandle) {
                if (e.target == leftHandle) {
                    mode = editor.selection.isBackwards() ? "cursor" : "anchor";
                } else if (e.target == rightHandle) {
                    mode = editor.selection.isBackwards() ? "anchor" : "cursor";
                } else if (e.target == cursorHandle) {
                    mode = "cursor";
                } else
                    mode = "scroll";
            } else {
                var cursor = editor.selection.cursor;
                var anchor = editor.selection.isEmpty() ? cursor : editor.selection
                    .anchor;
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
            if(mode=="cursor"){
                if(editor.selection.isEmpty()){
                    editor.selection.clearSelection();
                }
            }
        }
        touchStartT = t;
    });
    el.addEventListener("touchend", function(e) {
        pressed = editor.$mouseHandler.isMousePressed = false;
        if (mode == "scroll") {
            if (!handledScroll) {
                var callback;
                if (touchScroller) callback = function() {
                    touchScroller.style.visibility = '';
                };
                animate(callback);
            } else handledScroll = false;
            hideContextMenu();
        } else {
            handledScroll = false;
            animationSteps = 0;
            if (mode == "zoom") {
                mode = "";
                initial_scale = new_scale = -1;
                if(beforeRendererBound){
                    editor.renderer.off("beforeRender", beforeRender);
                    beforeRendererBound = false;
                }
            } else if (longTouchTimer) {
                editor.selection.moveToPosition(pos);
                showContextMenu();
            }
        }
        if (longTouchTimer) {
            clearTimeout(longTouchTimer);
            longTouchTimer = null;
        }
        contextMenuEvent = null;
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
            if (handledScroll) return;
            if (touchScroller) {
                if (showTimeout) {
                    clearTimeout(showTimeout);
                    showTimeout = null;
                }
            }
            var mouseEvent = new MouseEvent(e, editor);
            mouseEvent.speed = 1;
            if (3 * Math.abs(wheelX) < Math.abs(wheelY)) wheelX = 0;
            if (3 * Math.abs(wheelY) < Math.abs(wheelX)) wheelY = 0;
            if(isGutter && !wheelY){
                //don't scroll horizontally on gutter
                return (handledScroll=true);
            }
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

        } else {
            var ev = new MouseEvent(e, editor);

            if (mode == "cursor" || mode == "anchor") {
                ev.clientY = ev.clientY - 50;
                var pos = ev.getDocumentPosition();
                if (mode == "cursor") {
                    editor.selection.moveCursorToPosition(pos);
                } else
                    editor.selection.setSelectionAnchor(pos.row, pos.column);
                //pos.row++;
                editor.renderer.scrollSelectionIntoView({row:pos.row,column:pos.column-1},{row:pos.row,column:pos.column+2});

                e.preventDefault();
            }
        }
    });
    el.addEventListener("touchend", initMobile);
    var zoomCenter;
    var zoomCenterX = 0.5,
        zoomCenterY = 0.5;

    function startZoom(touches) {
        var dX = (touches[0].clientX - touches[1].clientX);
        var dY = (touches[0].clientY - touches[1].clientY);
        initial_scale = -1;
        zoomCenterX = (-dX * 0.5 + touches[0].clientX);
        zoomCenterY = (-dY * 0.5 + touches[0].clientY);
        zoomCenter = editor.renderer.screenToTextCoordinates(zoomCenterX, zoomCenterY);
    }
    var beforeRendererBound = false;

    function beforeRender() {
        
        var renderer = editor.renderer;
        renderer.$computeLayerConfig();

        var center = editor.renderer.textToScreenCoordinates(zoomCenter.row, zoomCenter.column);
        var diffX = center.pageX - zoomCenterX;
        var diffY = center.pageY - zoomCenterY;

        renderer.scrollBy(diffX, diffY);
    }

    function zoomBy(scale) {
        scale = Math.min(2, Math.max(0.5, scale));
        var oldFontSize = editor.getFontSize();
        var newFontSize = oldFontSize * scale;
        if (Math.abs(oldFontSize - newFontSize) < 1)
            return;
        initial_scale = new_scale;
        editor.setFontSize(newFontSize);
        if (!beforeRendererBound){
            beforeRendererBound = true;
            editor.renderer.on("beforeRender", beforeRender);
        }
    }
    function animate(callback){
        //hypot velocity, vX and vY are already normalized
        var v = Math.sqrt(vX * vX + vY * vY);
        var lastTime = new Date().getTime();
        var vMax = 1/Math.max(Math.abs(vX),Math.abs(vY));
        vX *= vMax*Math.abs(vX);
        vY *= vMax*Math.abs(vY);
        
        //Maximum duration 17*170 about 3s
        animationSteps = Math.min(animationSteps+v*25,90);
        var stop1 = animationSteps>100?animationSteps*0.1:0;
        var stop2 = animationSteps*0.5;
        function render() {
            var t = new Date().getTime();
            var dt = Math.min(50, t - lastTime);
            if ((animationSteps-=(dt/17)) <= 0) {
                //due to decrement, touchstart or touchend
                animationTimer = null;
                animationSteps = 0;
                callback && callback();
                return;
            }
            if (Math.abs(vX) < 0.01) vX = 0;
            if (Math.abs(vY) < 0.01) vY = 0;
            var oldScrollLeft = editor.session.getScrollLeft();
            var oldScrollTop = editor.session.getScrollTop();
            editor.renderer.scrollBy(dt * vX, dt * vY);
            if (oldScrollLeft == editor.session.getScrollLeft() && oldScrollTop == editor
                .session
                .getScrollTop())
                animationSteps = 0;
            //Approximation of a fast decay for the last
            //750ms
            var decel = 1;
            if (animationSteps < stop1) {
                decel = 0.96;
            } else if(animationSteps<stop2){
                decel = 0.98;
            }
            else decel = 0.99 + (animationSteps-stop2)*0.001;
            var mult = Math.pow(decel,(dt/17));
            vX = vX*mult;
            vY = vY*mult;
            
            //requestAnimationFrame is not the best since
            //rendering will happen asynchronously
            animationTimer = setTimeout(render, Math.max(0, 34 - dt));
            lastTime = t;
        }
        if (animationTimer) clearTimeout(animationTimer);
        animationTimer = setTimeout(render, 10);
    }
};
});