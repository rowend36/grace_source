_Define(function(global) {
    function htmlEncode(string) {
        var entityMap = {
            "<": "&lt;",
            ">": "&gt;",
        };
        return String(string).replace(/[<>]/g, function(s) {
            if (!s) return '';
            return entityMap[s];
        });
    }

    function remove(node) {
        if (node.$closeThisTip) throw 'Error: Tip in use';
        var p = node && node.parentNode;
        if (p) p.removeChild(node);
    }

    function elt(tagname, cls /*, ... elts*/ ) {
        var e = document.createElement(tagname);
        if (cls) e.className = cls;
        for (var i = 2; i < arguments.length; ++i) {
            var elt = arguments[i];
            if (typeof elt == "string") elt = document.createTextNode(elt);
            e.appendChild(elt);
        }
        return e;
    }

    function fadeOut(tooltip, timeout) {
        if (!timeout) {
            timeout = 1100;
        }
        if (timeout === -1) {
            remove(tooltip);
            return;
        }
        tooltip.style.opacity = "0";
        setTimeout(function() {
            remove(tooltip);
        }, timeout);
    }

    function getCursorPosForTooltip(editor) {
        var place = editor.renderer.$cursorLayer.cursors[0].getBoundingClientRect(); //this gets top correctly regardless of scrolling, but left is not correct
        return {
            left: place.left,
            top: place.bottom
        };

    }

    function UI(cls, iconClass) {
        if (!cls) cls = "symbol-";
        if (!iconClass) iconClass = "symbol-";
        this.iconClass = function(type) {
            var suffix;
            switch (type) {
                case 'local var':
                    suffix = 'local-var';
                    break;
                default:
                    suffix = type.substring(type.lastIndexOf(" ")+1);
            }
            return suffix ? " "/*remove ace_ prefix*/ + iconClass + "completion " + iconClass + "completion-" + suffix : "";
        };
        this.closeAllTips = function(except) {
            var tips = document.querySelectorAll('.' + cls + 'tooltip');
            if (tips.length > 0) {
                for (var i = 0; i < tips.length; i++) {
                    if (except && tips[i] == except) {
                        continue;
                    }
                    if (tips[i].$closeThisTip) tips[i].$closeThisTip();
                    else remove(tips[i]);
                }
            }
        };
        this.tempTooltip = function(editor, content, timeout) {
            if (!timeout) {
                timeout = 3000;
            }
            var location = getCursorPosForTooltip(editor);
            return this.makeTooltip(location.left, location.top, content, editor, true, timeout);
        };
        this.makeTooltip = function(x, y, content, editor, closeOnCursorActivity, fadeOutDuration, onClose) {
            var node = elt("div", cls + "tooltip");
            if (typeof content === 'string')
                node.innerHTML = content;
            else node.appendChild(content);
            document.body.appendChild(node);
            var closeBtn = document.createElement('a');
            closeBtn.setAttribute('title', 'close');
            closeBtn.setAttribute('class', cls + 'tooltip-boxclose');
            node.appendChild(closeBtn);

            function closeThisTip(e, fade) {
                if (editor) {
                    if (closeOnCursorActivity) {
                        editor.getSession().selection.off('changeCursor', closeThisTip);
                        editor.getSession().off('changeScrollTop', closeThisTip);
                        editor.getSession().off('changeScrollLeft', closeThisTip);
                    }
                    editor.off('changeSession', closeThisTip);
                    if (e)
                        editor.focus();
                }
                if (node.$closeThisTip) node.$closeThisTip = undefined;
                if (node.parentNode) {
                    if (fade) fadeOut(node, 1000);
                    else remove(node);
                    onClose && onClose(e);
                }
            }
            if (editor) {
                this.moveTooltip(node, x, y, editor);
                editor.on('changeSession', closeThisTip);
                node.$closeThisTip = closeThisTip;
            }
            if (closeOnCursorActivity) {
                editor.getSession().selection.on('changeCursor', closeThisTip);
                editor.getSession().on('changeScrollTop', closeThisTip);
                editor.getSession().on('changeScrollLeft', closeThisTip);
            }
            closeBtn.addEventListener('click', closeThisTip);
            if (fadeOutDuration) {
                fadeOutDuration = parseInt(fadeOutDuration, 10);
                if (fadeOutDuration > 100) {
                    var fadeThistip = function() {
                        closeThisTip(null, true);
                    };
                    setTimeout(fadeThistip, fadeOutDuration);
                }
            }
            return node;
        };
        this.showInfo = function(editor, msg) {
            var el = document.createElement('span');
            el.setAttribute('style', 'color:green;');
            el.innerHTML = msg;
            this.tempTooltip(editor, el, 2000);
        };
        this.showError = function(editor, msg, noPopup) {
            try {
                var message = '',
                    details = '';

                var isError = function(o) {
                    return o && o.name && o.stack && o.message;
                };

                if (isError(msg)) { //msg is an Error object
                    message = msg.name + ': ' + msg.message;
                    details = msg.stack;
                } else if (msg.msg && msg.err) { //msg is object that has string msg and Error object
                    message = msg.msg;
                    if (isError(msg.err)) {
                        message += ': ' + msg.err.message;
                        details = msg.err.stack;
                    }
                } else { //msg is string message;
                    message = msg;
                    details = 'details not supplied. current stack:\n' + new Error().stack;
                }

                console.log('tsError:\t ', message, '\n details:', details); //log the message and deatils (if any)

                if (!noPopup) { //show popup
                    var el = elt('span', null, message);
                    el.style.color = 'red';
                    this.tempTooltip(editor, el);
                }
            } catch (ex) {
                setTimeout(function() {
                    if (typeof message === undefined) {
                        message = " (no error passed)";
                    }
                    throw new Error('ts show error failed.' + message + '\n\n fail error: ' + ex.name + '\n' + ex.message + '\n' + ex.stack);
                }, 0);
            }
        };
        this.moveTooltip = function(tip, x, y, editor, max_width, max_height) {
            tip.style.top = tip.style.bottom = tip.style.right = tip.style.left = "";
            max_width = max_width || tip.offsetWidth || 360;
            max_height = max_height || tip.offsetHeight || 100;
            if (x === null || y === null) {
                var location = getCursorPosForTooltip(editor);
                x = location.left;
                y = location.top;
            }
            var margins = editor.getPopupMargins();
            var el = tip;
            var screenHeight = document.body.clientHeight - margins.marginBottom;
            var screenWidth = document.body.clientWidth;
            var maxH = max_height;
            var lineHeight = editor.renderer.lineHeight;
            var top = y - lineHeight;
            var allowTopdown = top - margins.marginTop > screenHeight / 2;
            if (allowTopdown && top + lineHeight + maxH > screenHeight) {
                el.style.maxHeight = (top - margins.marginTop) + "px";
                el.style.top = "";
                el.style.bottom = screenHeight - top + margins.marginBottom + "px";
            } else {
                top += lineHeight;
                el.style.maxHeight = screenHeight - top - 0.2 * lineHeight + "px";
                el.style.top = top + "px";
                el.style.bottom = "";
            }

            el.style.display = "block";

            var left = x-50;
            if (left + max_width > screenWidth)
                left = screenWidth - max_width;

            el.style.left = Math.max(10, left) + "px";
        };
        this.closeArgHints = function(ts) {
            if (ts.argHintTooltip && ts.argHintTooltip.$closeThisTip) ts.argHintTooltip.$closeThisTip();
        }
        this.renameDialog = function(ts, editor, data) {
            var div = elt("div", "", data.name + ": " + data.refs.length + " references found \n (WARNING: Cannot replace refs in files that are not loaded!) \n\n Enter new name:\n");
            var newNameInput = elt('input');
            var tip = this.makeTooltip(null, null, div, editor, true);
            tip.appendChild(newNameInput);
            try {
                setTimeout(function() {
                    newNameInput.focus();
                }, 100);
            } catch (ex) {}

            var goBtn = elt('button', 'btn');
            goBtn.textContent = "Rename";
            goBtn.setAttribute("type", "button");
            goBtn.addEventListener('click', function() {
                tip.$closeThisTip()
                var newName = newNameInput.value;
                if (!newName || newName.trim().length === 0) {
                    ts.ui.showError(editor, "new name cannot be empty");
                    return;
                }

                ts.executeRename(editor, newName, data);
            });
            tip.appendChild(goBtn);
        };
        this.referenceDialog = function(ts, editor, data) {
            var self = this;
            self.closeAllTips();
            var header = document.createElement("div");
            var title = document.createElement("span");
            title.textContent = data.name + '(' + (data.type || '?') + ')';
            title.setAttribute("style", "font-weight:bold;");
            header.appendChild(title);

            var tip = this.makeTooltip(null, null, header, null /*global tip*/ , false, -1);
            if (!data.refs || data.refs.length === 0) {
                tip.appendChild(elt('div', '', 'No References Found'));
                return;
            }
            var totalRefs = document.createElement("div");
            totalRefs.setAttribute("style", "font-style:italic; margin-bottom:3px; cursor:help");
            totalRefs.innerHTML = data.refs.length + " References Found";
            totalRefs.setAttribute('title', 'Use up and down arrow keys to navigate between references. \n\nPress Esc while focused on the list to close the popup (or use the close button in the top right corner).\n\n This is not guaranteed to find references in other files or references for non-private variables.');
            header.appendChild(totalRefs);
            var refInput = document.createElement("select");
            refInput.addEventListener("change", function() {
                var el = this,
                    selected;
                for (var i = 0; i < el.options.length; i++) {
                    if (selected) {
                        el[i].selected = false;
                        continue;
                    }
                    if (el[i].selected) {
                        selected = el[i];
                        selected.style.color = "grey";
                    }
                }
                var animatedScroll = editor.getAnimatedScroll();
                if (animatedScroll) {
                    editor.setAnimatedScroll(false);
                }
                ts.goto(editor, data.refs[selected.getAttribute("data-index")], function() {
                    self.moveTooltip(tip, null, null, editor);
                    //close any tips that moving this might open, except for the ref tip
                    self.closeAllTips(tip);
                    if (animatedScroll) {
                        editor.setAnimatedScroll(true); //re-enable
                    }
                }, true);
            });
            var addRefLine = function(index, file, start) {
                var el = document.createElement("option");
                el.setAttribute("data-index", index);
                //add 1 to line because editor does not use line 0
                el.appendChild(document.createTextNode((start.row + 1) + ":" + start.column + " - " + (file.length > 33 ? "..." + file.substring(Math.min(file.indexOf("/", file.length - 40), file.length - 30)) : file)));
                refInput.appendChild(el);
            };
            var addDisabled = function(index, file) {
                var el = document.createElement("option");
                el.setAttribute("data-index", index);
                el.text = (file.length > 23 ? "..." + file.substring(file.length - 20) : file);
                refInput.appendChild(el);
            };
            var finalizeRefInput = function() {
                tip.appendChild(refInput);
                refInput.focus(); //focus on the input (user can press down key to start traversing refs)
                refInput.addEventListener('keydown', function(e) {
                    if (e && e.keyCode && e.keyCode == 27) {
                        remove(tip);
                    }
                });
                self.moveTooltip(tip, null, null, editor);
            };

            for (var i = 0; i < data.refs.length; i++) {
                var tmp = data.refs[i];
                try {
                    if (tmp.start)
                        addRefLine(i, tmp.file, tmp.start);
                    else addDisabled(i, tmp.file);
                    if (i === data.refs.length - 1) {
                        finalizeRefInput();
                    }
                } catch (ex) {
                    console.log('findRefs inner loop error (should not happen)', ex);
                }
            }
        };

        this.showArgHints = function showArgHints(ts, editor, argpos) {
            if (ts.cachedArgHints.isClosed) {
                return
            }
            var html = ts.genArgHintHtml(ts.cachedArgHints, argpos);
            if (ts.argHintTooltip && typeof html == 'string') {
                ts.argHintTooltip.firstChild.innerHTML = html;
                this.moveTooltip(ts.argHintTooltip, null, null, editor);
            } else {
                this.closeAllTips();
                if (typeof(html) == 'string') {
                    var el = document.createElement('div');
                    el.innerHTML = html;
                } else el = html;
                ts.argHintTooltip = this.makeTooltip(null, null, el, editor, false, null, function(e) {
                    if (e && (e.type == 'click' || e.type == 'mousedown')) {
                        ts.cachedArgHints.isClosed = true;
                    }
                    ts.argHintTooltip = null;
                });
            }
        }
        
        this.createToken = function(part, extraClass) {
            return "<span class='doc-" + part.kind + (extraClass ? " doc-" + extraClass : "") + "'>" + htmlEncode(part.text) + "</span>"
        }

    }
    global.LspUI = UI;
    global.Functions.htmlEncode = htmlEncode;
});