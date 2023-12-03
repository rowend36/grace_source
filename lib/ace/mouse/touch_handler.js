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
var setupMobileMenu = require("./mobile_menu").setupMobileMenu;
var lang = require('../lib/lang');
exports.addTouchListeners = function(el, editor) {
    var mode = "scroll";
    var startX;
    var startY;
    var thumbOffset;
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
    var touchStartEvent;
    
    setupMobileMenu(editor);
    el.addEventListener("contextmenu", function(e) {
        if(!pressed) return e.preventDefault();
        if(!editor.$useNativeContextMenu){
            e.preventDefault();
            if(!longTouchTimer) editor.mobileMenu.show(touchStartEvent);
            editor.textInput.getElement().focus();
        }
        //New Issues with every new Chrome release
    });
    function handleLongTap() {
        clearTimeout(longTouchTimer);
        longTouchTimer = null;
        editor._signal("longpress", touchStartEvent);
        var range = editor.selection.getRange();
        var inSelection = range.contains(pos.row, pos.column);
        var token;
        var inSpace = pos.column==editor.session.getDocumentLastRowColumn(pos.row,pos.column) || (!(token = editor.session.getTokenAt(pos.row,pos.column)) || (token.value[0]==" "||token.value[0]=="\t"));
        if ((range.isEmpty() || !inSelection) && !inSpace) {
            editor.selection.moveToPosition(pos);
            editor.selection.selectWord();
            mode = "wait";
        }
        editor.mobileMenu.show(touchStartEvent);
    }

    function switchToSelectionMode(ev) {
        mode = "wait";
        clearTimeout(longTouchTimer);
        longTouchTimer = null;
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
    var scrollY = editor.renderer.scrollTop;
    editor.renderer.on('beforeRender', function(changes){
        if (scrollY !== editor.renderer.scrollTop) {
            scrollY = editor.renderer.scrollTop;
            if (!changes & editor.renderer.CHANGE_FULL) {
                editor.renderer.$isScrolling = true;
                stopScroll();
            }
        }
    });
    var stopScroll = lang.delayedCall(function(){
        editor.renderer.$isScrolling = false;
        editor.renderer._signal('finishedScroll');
    },1000);
    
    var leftHandle, cursorHandle, rightHandle, cursorState = 0;
    function createSelectHandles() {
        cursorHandle = dom.createElement("div");
        cursorHandle.className = "ace_cursor_handle-center";
        leftHandle = dom.createElement("div");
        leftHandle.className = "ace_cursor_handle-left";
        rightHandle = dom.createElement("div");
        rightHandle.className = "ace_cursor_handle-right";
        var ev_pd = function (el) {
            el.addEventListener(
                "mousedown",
                function (e) {
                    e.preventDefault();
                },
                { passive: false }
            );
        };
        editor.renderer.container.appendChild(leftHandle);
        editor.renderer.container.appendChild(rightHandle);
        editor.renderer.container.appendChild(cursorHandle);
        ev_pd(cursorHandle);
        ev_pd(leftHandle);
        ev_pd(rightHandle);
        var STATE_HIDE = 0,
            STATE_CURSOR = 1,
            STATE_SELECT = 2,
            INVALIDATE = editor.renderer.CHANGE_H_SCROLL |
                editor.renderer.CHANGE_SCROLL |
                editor.renderer.CHANGE_FULL |
                editor.renderer.CHANGE_MARKER_BACK | //selection
                editor.renderer.CHANGE_CURSOR |
                editor.renderer.CHANGE_SIZE;
        var show = function () {
            if(cursorState !== STATE_HIDE) return;
            updateCursorHandles();
            editor.on("keyboardActivity", hide);
            editor.off("click", show);
            editor.off("longpress", show);
            editor.renderer.on("afterRender", updateCursorHandles);
        };
        var hide = function () {
            if(cursorState === STATE_HIDE) return;
            editor.off("keyboardActivity", hide);
            if (cursorState === STATE_CURSOR) {
                cursorHandle.style.opacity = 0;
            } else {
                rightHandle.style.opacity = 0;
                leftHandle.style.opacity = 0;
            }
            cursorState = STATE_HIDE;
            editor.on("click", show);
            editor.on("longpress", show);
            editor.renderer.off("afterRender", updateCursorHandles);
        };
        show();
        
        function updateCursorHandles(changes) {
            if (editor.renderer.$isScrolling) {
                editor.renderer.once('finishedScroll', show);
                return hide();
            }
        
            if (changes && (changes & INVALIDATE) === 0) return;
            var newstate = editor.selection.isEmpty() ? STATE_CURSOR : STATE_SELECT;
            if (cursorState !== newstate) {
                cursorHandle.style.opacity = newstate === STATE_CURSOR ? 1 : 0;
                rightHandle.style.opacity = newstate === STATE_SELECT ? 1 : 0;
                leftHandle.style.opacity = newstate === STATE_SELECT ? 1 : 0;
                cursorState = newstate;
            }
            var pos;
            if (cursorState === STATE_CURSOR) {
                var cursor = editor.getSelection().getCursor();
                pos = editor.renderer.getCursorPosition(cursor, true);
                cursorHandle.style.left = 1 + pos.left + 'px';
                cursorHandle.style.top =
                    pos.top + editor.renderer.layerConfig.lineHeight + 'px';
            } else {
                var range = editor.selection.getRange();
                pos = editor.renderer.getCursorPosition(range.start, true);
                leftHandle.style.left = pos.left + 'px';
                leftHandle.style.top =
                    pos.top + editor.renderer.layerConfig.lineHeight + 'px';
                pos = editor.renderer.getCursorPosition(range.end, true);
                rightHandle.style.left = pos.left + 'px';
                rightHandle.style.top =
                    pos.top + editor.renderer.layerConfig.lineHeight + 'px';
            }
        }
    }

    var touchScroller, handledScroll, showTimeout;
    function createTouchScroller() {
        var touchInner = dom.createElement("div");
        
        touchScroller = dom.createElement("div");
        touchScroller.className = "ace_scroller-touch";
        touchScroller.style.overflow = "scroll";
    
        touchScroller.style.position = "absolute";
        touchScroller.style.touchAction = "pan-x pan-y";
        touchScroller.style.zIndex = 1;
        touchScroller.style.top = touchScroller.style.bottom = touchScroller.style.left = touchScroller.style.right =
            "-50px";
        editor.renderer.scroller.appendChild(touchScroller);
        touchInner.style.visibility = "hidden";
        touchScroller.appendChild(touchInner);
        editor.$touchScroller = touchScroller;
    
        var scrollTop = 0,
            scrollLeft = 0;
        touchScroller.addEventListener("scroll", function (/*e*/) {
            scrollTop = touchScroller.scrollTop - editor.renderer.scrollMargin.top;
            scrollLeft = touchScroller.scrollLeft - editor.renderer.scrollMargin.left;
            if(exceededMaxHeight) return;
            if (editor.session.getScrollTop() != scrollTop) {
                editor.session.setScrollTop(scrollTop);
            }
            if (editor.session.getScrollLeft() != scrollLeft) {
                editor.session.setScrollLeft(scrollLeft);
            }
        });
    
        touchScroller.addEventListener("touchstart", function (/*e*/) {
            handledScroll = !exceededMaxHeight;
        });
        //If the user is having problems clicking something
        //usually links
        editor.on("dblclick", function (e) {
            //should be impossible
            if (showTimeout) {
                clearTimeout(showTimeout);
            } else {
                touchScroller.style.visibility = "hidden";
                var el = document.elementFromPoint(e.clientX, e.clientY);
                if(el && typeof el.click === 'function') el.click();
            }
            showTimeout = setTimeout(function () {
                touchScroller.style.visibility = "visible";
                showTimeout = null;
            }, 5000);
        });
        var _scrollHeight = 2;
        var _scrollWidth = 2;
        var scrollMask =
            editor.renderer.CHANGE_H_SCROLL |
            editor.renderer.CHANGE_SCROLL |
            editor.renderer.CHANGE_FULL;
        var exceededMaxHeight = false; 
        var sizeMask = editor.renderer.CHANGE_LINES | editor.renderer.CHANGE_SIZE | editor.renderer.CHANGE_FULL;
    
        function updateTouchScroller(changes) {
            if (changes & sizeMask) {
                var r = editor.renderer;
                var scrollHeight = 100/*padding*/ + r.scrollBarH.getHeight() + r.layerConfig.maxHeight + r.scrollMargin.v;
                var scrollWidth = 100 + editor.renderer.gutterWidth + editor.renderer.scrollBarH.scrollWidth - 3; //to handle rounding errors
                exceededMaxHeight = scrollHeight > 1e7;
                if(!exceededMaxHeight){
                    if (scrollHeight != _scrollHeight) {
                        _scrollHeight = scrollHeight;
                        touchInner.style.height = scrollHeight + 'px';
                    }
                    if (scrollWidth != _scrollWidth) {
                        _scrollWidth = scrollWidth;
                        touchInner.style.width = scrollWidth + 'px';
                    }
                }
            }
            if (changes & scrollMask) {
                if (editor.session.getScrollTop() != scrollTop) {
                    scrollTop = editor.session.getScrollTop();
                    touchScroller.scrollTop =
                        scrollTop + editor.renderer.scrollMargin.top;
                }
                if (editor.session.getScrollLeft() != scrollLeft) {
                    scrollLeft = editor.session.getScrollLeft();
                    touchScroller.scrollLeft =
                        scrollLeft + editor.renderer.scrollMargin.left;
                }
            }
        }
        editor.renderer.on("afterRender", updateTouchScroller);
        updateTouchScroller(sizeMask | scrollMask);
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
        if (touches.length === 2) {
            mode = "zoom";
            return startZoom(touches);
        }
        if (beforeRendererBound){
            editor.renderer.off("beforeRender", beforeRender);
            beforeRendererBound = false;
        }
        
        isGutter = false;
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
        thumbOffset = 0;
        pressed = editor.$mouseHandler.isMousePressed = true;
        var t = e.timeStamp;
        lastT = t;
        var touchObj = touches[0];
        var h = editor.renderer.layerConfig.lineHeight;
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

        touchStartEvent = e;
        if (t - touchStartT < ((clickCount-1)*100 + 500) /*&& touches.length == 1 */&& !animationSteps) {
            clickCount++;
            e.preventDefault();
            e.button = 0;
            switchToSelectionMode(ev);
        } else if (editor.renderer.$isScrolling) {
            clickCount = 0;
            mode = "scroll";
        } else {
            longTouchTimer = setTimeout(handleLongTap, 450);
            clickCount = 0;
            if (leftHandle) {
                thumbOffset = editor.renderer.lineHeight;
                if (cursorState === 0){
                    mode = 'scroll';
                }
                else if (e.target == leftHandle) {
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
                var cursorPos = editor.renderer.getCursorPosition(cursor, true);
                var anchorPos = editor.renderer.getCursorPosition(anchor, true);
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
            if(mode=="cursor" && editor.selection.isEmpty()){
                editor.selection.clearSelection();
            }
        }
        touchStartT = t;
    });
    el.addEventListener("touchend", function(/*e*/) {
        pressed = editor.$mouseHandler.isMousePressed = false;
        if (mode == "scroll") {
            if (!handledScroll) animate();
            editor.mobileMenu.hide();
        } else {
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
                editor.mobileMenu.show(touchStartEvent);
            }
        }
        if (longTouchTimer) {
            clearTimeout(longTouchTimer);
            longTouchTimer = null;
        }
        handledScroll = false;
        touchStartEvent = null;
    });
    el.addEventListener("touchmove", function(e) {
        if (longTouchTimer) {
            clearTimeout(longTouchTimer);
            longTouchTimer = null;
        }
        var touches = e.touches;
        if (touches.length === 2 && mode == "zoom") {
            var dX = (touches[0].clientX - touches[1].clientX);
            var dY = (touches[0].clientY - touches[1].clientY);
            new_scale = dX * dX + dY * dY;
            if (initial_scale < 0)
                initial_scale = new_scale;
            var zoom = new_scale / initial_scale;
            return zoomBy(Math.sqrt(zoom));
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
            if(e.defaultPrevented) return;
            if (2 * Math.abs(wheelX) < Math.abs(wheelY)) wheelX = 0;
            if (3 * Math.abs(wheelY) < Math.abs(wheelX)) wheelY = 0;
            if(isGutter && !wheelY){
                //don't scroll horizontally on gutter
                return (handledScroll=true);
            }
            if (dt !== 0) {
                vX = wheelX / dt;
                vY = wheelY / dt;
            }
            editor.renderer.scrollBy(wheelX, wheelY);
            // var mouseEvent = new MouseEvent(e, editor);
            // mouseEvent.speed = 1;
            // mouseEvent.wheelX = wheelX;
            // mouseEvent.wheelY = wheelY;

            // editor._emit("mousewheel", mouseEvent);
            // if (!mouseEvent.propagationStopped) {
            //     vX = vY = 0;
            // }

        } else {
            if (mode == "cursor" || mode == "anchor") {
                var ev = {clientY: e.clientY, clientX: e.clientX}; // new MouseEvent(e, editor);
                if (thumbOffset < 50) {
                    thumbOffset = Math.max(
                        thumbOffset,
                        Math.min(50, Math.abs(ev.clientY - touchStartEvent.clientY))
                    );
                }
                ev.clientY -= thumbOffset;
                var pos = editor.renderer.getClickPosition(ev, Infinity);
                if (mode == 'cursor') {
                    editor.selection.moveCursorToPosition(pos);
                } else editor.selection.setSelectionAnchor(pos.row, pos.column);
                //pos.row++;
                editor.renderer.scrollSelectionIntoView(
                    {row: pos.row, column: pos.column - 1},
                    {row: pos.row, column: pos.column + 2}
                );
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
        zoomCenter = editor.renderer.getClickPosition({clientX:zoomCenterX, clientY:zoomCenterY},Infinity);
    }
    var beforeRendererBound = false;

    function beforeRender() {
        var renderer = editor.renderer;
        renderer.$computeLayerConfig();
    
        var center = editor.renderer.textToScreenCoordinates(
            zoomCenter.row,
            zoomCenter.column
        );
        var diffX = center.pageX - zoomCenterX;
        var diffY = center.pageY - zoomCenterY;
        renderer.scrollBy(diffX, diffY);
    }

    function zoomBy(scale) {
        scale = Math.min(2, Math.max(0.5, scale));
        var oldFontSize = editor.getFontSize();
        var newFontSize = Math.max(6, Math.min(70, (oldFontSize * scale) | 0));
        if (Math.abs(oldFontSize - newFontSize) < 1) return;
        initial_scale = new_scale;
        editor.setFontSize(newFontSize);
        if (!beforeRendererBound) {
            beforeRendererBound = true;
            editor.renderer.on('beforeRender', beforeRender);
        }
    }
    function animate(){
        //Trial and error to make this usable
        //hypot velocity
        var v = Math.sqrt(vX * vX + vY * vY);
        if (v < 1) animationSteps = v = 0;
        var lastTime = new Date().getTime();
        var killMinorAxis = 1 / Math.max(Math.abs(vX), Math.abs(vY));
        vX *= killMinorAxis * Math.abs(vX);
        vY *= killMinorAxis * Math.abs(vY);
    
        //Maximum duration 17*170 about 3s
        animationSteps = Math.min(animationSteps + v * 25, 90);
        var stop1 = animationSteps * 0.5;
        var stop2 = animationSteps > 100 ? animationSteps * 0.1 : 20;
        function render() {
            var t = new Date().getTime();
            var dt = Math.min(50, t - lastTime);
            var step = dt / 17;
            if ((animationSteps -= step) <= 0) {
                //due to decrement, touchstart or touchend
                animationTimer = null;
                animationSteps = 0;
                if (touchScroller) touchScroller.style.visibility = '';
                return;
            }
            if (Math.abs(vX) < 0.01) vX = 0;
            if (Math.abs(vY) < 0.01) vY = 0;
            var oldScrollLeft = editor.session.getScrollLeft();
            var oldScrollTop = editor.session.getScrollTop();
            editor.renderer.scrollBy(dt * vX, dt * vY);
            if (
                oldScrollLeft == editor.session.getScrollLeft() &&
                oldScrollTop == editor.session.getScrollTop()
            )
                animationSteps = 0;
            //Approximation of a fast decay for the last
            //Trial and error, probably redundant.
            var decel = 1;
            if (animationSteps < stop2) {
                decel = 0.75;
            } else if (animationSteps < stop1) {
                decel = 0.99;
            } else decel = 0.99 + (animationSteps - stop1) * 0.001;
            var mult = Math.pow(decel, step);
            vX = vX * mult;
            vY = vY * mult;
    
            //requestAnimationFrame is not the best since
            //rendering will happen asynchronously
            animationTimer = setTimeout(render, Math.max(0, 34 - dt));
            lastTime = t;
        }
        if (animationTimer) clearTimeout(animationTimer);
        if (animationSteps > 0) animationTimer = setTimeout(render, 10);
        else render();
    }
};
});