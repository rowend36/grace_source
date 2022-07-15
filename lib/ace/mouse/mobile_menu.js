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
var dom = require("../lib/dom");
exports.setupMobileMenu = function(editor){
    var contextMenu;
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
                } else {
                    updateMenu(false);
                    editor._emit("menuClick", {
                        action: action,
                    });
                }
            };
            this.element = dom.buildDom(["div",
                {
                    class: "ace_mobile-menu",
                    ontouchstart: function(e) {
                        // mode = "menu";
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
    function showContextMenu(event) {
        if (editor.$useNativeContextMenu == true) {
            return false;
        }
        if (!contextMenu) createContextMenu();
        else updateMenu();
        var cursor = editor.selection.cursor;
        var lineHeight = editor.renderer.lineHeight + (editor.$useNativeContextMenu?100:30);
        var pagePos = event?{
            pageX: event.clientX,
            pageY: event.clientY-15
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
};
});