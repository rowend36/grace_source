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
        var vX = 0;
        var vY = 0;
        var pressed;
        var contextMenu;
        var targetvY;
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
            contextMenu.style.top = pagePos.pageY - rect.top - 3 + "px";
            contextMenu.style.right = "10px";
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
            //e.preventDefault()
            editor.textInput.getElement().focus();
            //e.stopPropagation();
        });
        var vScroll = dom.createElement("div");
        vScroll.style.height = 10000 + "px"
        vScroll.style.width = "2px"

        var vScrollContainer = dom.createElement("div");
        vScrollContainer.className = "touch_scroller"
        vScrollContainer.style.height = "100%"
        vScrollContainer.style.width = "100%"
        vScrollContainer.style.overflow = "scroll"
        vScrollContainer.style.position = "absolute"
        editor.renderer.scroller.appendChild(vScrollContainer);
        vScrollContainer.appendChild(vScroll);
        vScrollContainer.addEventListener("touchmove", function(e) {
            if (mode != "scroll")
                e.preventDefault();
        });
        vScrollContainer.addEventListener("contextmenu",function(){
            if(!pressed)e.preventDefault();
            editor.textInput.getElement().focus();
        })
        var selecthandle = dom.createElement("div");
        selecthandle.className = "ace_cursor_handle-center";
        var lefthandle = dom.createElement("div");
        lefthandle.className = "ace_cursor_handle-left";
        var righthandle = dom.createElement("div");
        righthandle.className = "ace_cursor_handle-right";
        righthandle.style.visibility = "hidden"
        lefthandle.style.visibility = "hidden"
        editor.renderer.container.appendChild(lefthandle);
        editor.renderer.container.appendChild(righthandle);
        editor.renderer.container.appendChild(selecthandle);
        vScrollContainer.addEventListener("mousedown", function(e) {
            selecthandle.style.visibility = "visible"
            e.preventDefault()
        }, { passive: false })
        var ev_pd= (function(el){
            el.addEventListener("mousedown", function(e) {
                e.preventDefault()
            }, { passive: false })
        })
        ev_pd(selecthandle)
        ev_pd(lefthandle)
        ev_pd(righthandle)
        vScrollContainer.addEventListener("scroll", function(e) {
            if (editor.session.getScrollTop() != vScrollContainer.scrollTop - editor.renderer.scrollMargin.top) {
                editor.session.setScrollTop(this.scrollTop - editor.renderer.scrollMargin.top);
            }
            if (editor.session.getScrollLeft() != vScrollContainer.scrollLeft - editor.renderer.scrollMargin.left) {
                editor.session.setScrollLeft(this.scrollLeft - editor.renderer.scrollMargin.left);
            }
        })

        function cursorToScreenPos(cursor) {
            var pos = editor.renderer.$cursorLayer.getPixelPosition(cursor, true);
            pos.left += editor.renderer.gutterWidth -editor.session.getScrollLeft()+ editor.renderer.margin.left;
            pos.top += editor.renderer.margin.top - editor.renderer.layerConfig.offset;
            return pos;
        }
        editor.on("input",function(){
            selecthandle.style.visibility = "hidden"
        });
        editor.renderer.on("afterRender", function() {
            var pos;
            if (!editor.selection.isEmpty()) {
                selecthandle.style.visibility = "hidden"
                righthandle.style.visibility = "visible"
                lefthandle.style.visibility = "visible"
                var range = editor.selection.getRange();
                pos = cursorToScreenPos(range.start, true);
                lefthandle.style.left = pos.left - lefthandle.clientWidth + "px";
                lefthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";
                pos = cursorToScreenPos(range.end, true);
                righthandle.style.left = pos.left + "px";
                righthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";
            }
            else {
                righthandle.style.visibility = "hidden"
                lefthandle.style.visibility = "hidden"
                pos = cursorToScreenPos();
                selecthandle.style.left = (pos.left - selecthandle.clientWidth / 2) + "px";
                selecthandle.style.top = (pos.top + editor.renderer.layerConfig.lineHeight) + "px";

            }

            if ((editor.renderer.scrollMargin.v + editor.renderer.layerConfig.maxHeight + "px") != vScroll.style.height) {
                vScroll.style.height = (editor.renderer.scrollMargin.v + editor.renderer.layerConfig.maxHeight + "px");
                vScroll.style.width = editor.renderer.scrollBarH.scrollWidth + "px"
            }
            else if (editor.renderer.scrollBarH.scrollWidth + "px" != vScroll.style.width) {
                vScroll.style.width = editor.renderer.scrollBarH.scrollWidth + "px"
            }
            if (editor.session.getScrollTop() != (vScrollContainer.scrollTop - editor.renderer.scrollMargin.top)) {
                vScrollContainer.scrollTop = editor.session.getScrollTop() + editor.renderer.scrollMargin.top;

            }
            if (editor.session.getScrollLeft() != (vScrollContainer.scrollLeft - editor.renderer.scrollMargin.left)) {
                vScrollContainer.scrollLeft = editor.session.getScrollLeft() + editor.renderer.scrollMargin.left;
            }
        });
        el.addEventListener("touchstart", function(e) {
            var touches = e.touches;
            if (longTouchTimer) {
                clearTimeout(longTouchTimer);
                longTouchTimer = null;
                touchStartT = -1;
            }
            if (touches.length > 1) {
                mode = "zoom";
                var dX = (touches[0].clientX - touches[1].clientX)
                var dY = (touches[0].clientY - touches[1].clientY)
                new_scale = initial_scale = dX * dX - dY * dY;
                var renderer = editor.renderer;
                var availableWidth = editor.session.getScrollLeft() + renderer.$size.scrollerWidth * 0.5 - renderer.$padding;
                var limitX = Math.floor(availableWidth / renderer.characterWidth);
                var limitY = Math.floor((renderer.layerConfig.firstRow + renderer.layerConfig.lastRow) * 0.5);
                offset = { row: limitY, column: limitX }
                return;
            }

            pressed = editor.$mouseHandler.isMousePressed = true;
            var h = editor.renderer.layerConfig.lineHeight;
            //var w = editor.renderer.layerConfig.lineHeight;
            var t = e.timeStamp;
            lastT = t;
            var touchObj = touches[0];
            var x = touchObj.clientX;
            var y = touchObj.clientY;
            // reset clickCount if the new touch is far from the old one
            if (Math.abs(startX - x) + Math.abs(startY - y) > h)
                touchStartT = -1;

            startX = e.clientX = x;
            startY = e.clientY = y;
            targetvY = vX = vY = 0;

            var ev = new MouseEvent(e, editor);
            pos = ev.getDocumentPosition();

            if (t - touchStartT < 500 && touches.length == 1 && !animationSteps) {
                clickCount++;
                e.preventDefault();
                e.button = 0;
                switchToSelectionMode();
            }
            else {
                clickCount = 0;
                if (e.target == lefthandle) {
                    mode = editor.selection.isBackwards() ? "cursor" : "anchor"
                }
                else if (e.target == righthandle) {
                    mode = editor.selection.isBackwards() ? "anchor" : "cursor";
                }
                else if (e.target == selecthandle) {
                    mode = "cursor"
                }
                /*
                var cursor = editor.selection.cursor;
                var anchor = editor.selection.isEmpty() ? cursor : editor.selection.anchor;
            
                var cursorPos = editor.renderer.$cursorLayer.getPixelPosition(cursor, true);
                var anchorPos = editor.renderer.$cursorLayer.getPixelPosition(anchor, true);
                var rect = editor.renderer.scroller.getBoundingClientRect();
                var weightedDistance = function(x, y) {
                    x = x / w;
                    y = y / h - 0.75;
                    return x * x + y * y;
                };
            
                if (e.clientX < rect.left) {
                    mode = "zoom";
                    return;
                }
            
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
                    
                if (diff2 < 3.5)
                    mode = "anchor";
                else if (diff1 < 3.5)
                    mode = "cursor";*/
                else
                    mode = "scroll";

                longTouchTimer = setTimeout(handleLongTap, 450);
            }
            touchStartT = t;
        });

        el.addEventListener("touchend", function(e) {
            pressed = editor.$mouseHandler.isMousePressed = false;
            if (animationTimer) clearInterval(animationTimer);
            if (mode == "zoom") {
                mode = "";
                initial_scale = new_scale = -1;
                animationSteps = 0;
            }
            else if (mode == "scroll") {
                //animate();
                //preventing default
                //makes keyboard popup
                //e.preventDefault();
                hideContextMenu();
            }
            else if (longTouchTimer) {
                editor.selection.moveToPosition(pos);
                animationSteps = 0;
                showContextMenu();
            }
            clearTimeout(longTouchTimer);
            longTouchTimer = null;
        });
        var offset;

        function zoomBy(scale) {
            var renderer = editor.renderer;
            renderer.freeze();
            editor.setFontSize(editor.getFontSize() * scale);
            var availableWidth = editor.session.getScrollLeft() + renderer.$size.scrollerWidth * 0.5 - renderer.$padding;
            var limitX = Math.floor(availableWidth / renderer.characterWidth);
            var limitY = Math.floor((renderer.layerConfig.firstRow + renderer.layerConfig.lastRow) * 0.5);
            var diffX = (limitX - offset.column) * renderer.characterWidth;
            var diffY = (limitY - offset.row) * renderer.layerConfig.lineHeight;
            renderer.scrollBy(-diffX, -diffY);
            renderer.unfreeze()
            //editor.renderer.scrollCursorIntoView(offset,0.5);
        }
        el.addEventListener("touchmove", function(e) {
            if (longTouchTimer) {
                clearTimeout(longTouchTimer);
                longTouchTimer = null;
            }
            var touches = e.touches;
            if (touches.length > 1 && mode == "zoom") {
                var dX = (touches[0].clientX - touches[1].clientX)
                var dY = (touches[0].clientY - touches[1].clientY)
                new_scale = dX * dX + dY * dY;
                if (initial_scale < 0)
                    initial_scale = new_scale;
                var zoom = new_scale / initial_scale;
                if (zoom > 1.25) {
                    zoomBy(1.11)
                    initial_scale = new_scale;
                }
                else if (zoom < 0.81) {
                    zoomBy(0.9);
                    initial_scale = new_scale;
                }

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
                return;
                /*var mouseEvent = new MouseEvent(e, editor);
                mouseEvent.speed = 1;
                mouseEvent.wheelX = wheelX;
                mouseEvent.wheelY = wheelY;
                if ((editor.scrollFix_X?editor.scrollFix_X:10) * Math.abs(wheelX) < Math.abs(wheelY)) wheelX = 0;
                if ((editor.scrollFix_Y?editor.scrollFix_Y:10) * Math.abs(wheelY) < Math.abs(wheelX)) wheelY = 0;
                if (dt != 0) {
                    vX = wheelX / dt;
                    vY = wheelY / dt;
                }
                editor._emit("mousewheel", mouseEvent);
                if (!mouseEvent.propagationStopped) {
                    vX = vY = 0;
                }*/
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

        /*function animate() {
            //Approximation of an actual
            //fling which is easier to
            //understand but less precise
            var fY;
            if(Math.abs(vY)<0.5){fY=0}
            else
                fY=Math.exp(1+0.35*(Math.abs(vY)))
            targetvY=vY*(fY);
            animationSteps += 40+3*(Math.max(Math.abs(vX),Math.abs(vY)));
            animationTimer = setInterval(function() {
                if (animationSteps-- <= 0) {
                    clearInterval(animationTimer);
                    animationTimer = null;
                }
                if (Math.abs(vX) < 0.01) vX = 0;
                if (Math.abs(vY) < 0.01) vY = 0;
                if (animationSteps < 20) vX = 0.9 * vX;
                if (animationSteps < 20) vY = 0.9 * vY;
                else if(animationSteps<40)
                    vY=0.99*vY;
                else vY = (vY*2+targetvY)/3;
                var oldScrollTop = editor.session.getScrollTop();
                editor.renderer.scrollBy(10 * vX, 10 * vY);
                if (oldScrollTop == editor.session.getScrollTop())
                    animationSteps = 0;
            }, 10);
        }*/
    };

});
