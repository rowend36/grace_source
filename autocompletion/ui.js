_Define(function(global) {
    var htmlEncode = global.Utils.htmlEncode;
    var visit = global.FocusManager.visit;
    var focus = global.FocusManager.focusIfKeyboard;
    var EditSession = global.EditSession;

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
        var place = editor.renderer.getCursorPixelPosition(null, true); //position relative to scroller except with css transforms which we avoid
        place.left -= editor.session.getScrollLeft(); //onScreen should do this but it doesn't
        place.top -= editor.renderer.layerConfig.offset;
        /*If positioning relative //to editor, it would have been 
        + editor.renderer.gutterWidth +editor.renderer.margin.left;
        */
        return place;

    }

    function UI(cls, iconClass) {
        if (cls) this.cls = cls;
        if (iconClass) this.iconCls = iconClass;

    }
    UI.prototype.iconCls = "symbol-";
    UI.prototype.cls = "symbol-";
    UI.prototype.iconClass = function(type) {
        var suffix;
        switch (type) {
            case 'local var':
                suffix = 'local-var';
                break;
            default:
                suffix = type.substring(type.lastIndexOf(" ") + 1);
        }
        return suffix ? " " /*remove ace_ prefix*/ + this.iconCls + "completion " + this.iconCls + "completion-" + suffix : "";
    };
    UI.prototype.closeAllTips = function(except) {
        var tips = document.querySelectorAll('.' + this.cls + 'tooltip');
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
    UI.prototype.tempTooltip = function(editor, content, timeout) {
        if (!timeout) {
            timeout = 3000;
        }
        return this.makeTooltip(null, null, content, editor, true, timeout);
    };
    UI.prototype.makeTooltip = function(x, y, content, editor, closeOnCursorActivity, fadeOutDuration, onClose) {
        var node = elt("div", "ace_tooltip "+this.cls + "tooltip");
        if (typeof content === 'string')
            node.innerHTML = content;
        else node.appendChild(content);
        document.body.appendChild(node);
        var closeBtn = document.createElement('button');
        closeBtn.setAttribute('title', 'close');
        closeBtn.setAttribute('class', this.cls + 'tooltip-boxclose');
        if (node.firstChild)
            node.insertBefore(closeBtn, node.firstChild);
        else node.appendChild(closeBtn);

        function closeThisTip(e, fade) {
            if (editor) {
                if (closeOnCursorActivity) {
                    editor.getSession().selection.off('changeCursor', closeThisTip);
                    editor.getSession().off('changeScrollTop', closeThisTip);
                    editor.getSession().off('changeScrollLeft', closeThisTip);
                }
                editor.off('changeSession', closeThisTip);
                if (e)
                    focus(editor.textInput.getElement(), true);
            }
            if (node.$closeThisTip) node.$closeThisTip = undefined;
            if (node.parentNode) {
                if (fade) fadeOut(node, 1000);
                else remove(node);
                onClose && onClose(e);
            }
        }
        node.$closeThisTip = closeThisTip;
        if (editor) {
            this.moveTooltip(node, x, y, editor);
            editor.on('changeSession', closeThisTip);
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
    UI.prototype.showInfo = function(editor, msg) {
        var el = document.createElement('span');
        el.setAttribute('style', 'color:green;');
        el.innerHTML = msg;
        this.tempTooltip(editor, el, 2000);
    };
    UI.prototype.showError = function(editor, msg, noPopup) {
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
    UI.prototype.moveTooltip = function(tip, x, y, editor, max_width, max_height) {
        tip.style.top = 0;
        tip.style.bottom = tip.style.right = tip.style.left =
            tip.style.maxWidth = tip.style.maxHeight = "";
        
        //get maximum height
        tip.style.whiteSpace = "pre-wrap";
        max_height = max_height || tip.offsetHeight || 100;
        //get maximum width
        tip.style.whiteSpace = "pre";
        max_width = max_width || tip.offsetWidth || 360;
        var screenWidth = document.body.clientWidth;

        if (max_height > screenWidth || max_height > max_width) {
            tip.style.paddingRight = '5px';
            tip.style.paddingTop = '25px';
        } else {
            tip.style.paddingTop = '5px';
            tip.style.paddingRight = '35px';
        }
        if (x === null || y === null) {
            var location = getCursorPosForTooltip(editor);
            x = location.left;
            y = location.top;
        }
        var rect = editor.renderer.scroller.getBoundingClientRect(); //position of scroller on screen

        var margins = editor.getPopupMargins(true);
        var screenHeight = document.body.clientHeight;
        var lineHeight = editor.renderer.lineHeight;
        var top = y + rect.y;
        var left = x - 50 + rect.x;
        var smallHeight = false;
        if (screenWidth>screenHeight*1.5 && screenHeight<360 && max_height > 150) {
            top = margins.marginTop;
            //small view_height
            smallHeight = true;
        }
        var spaceBelow = screenHeight - margins.marginBottom - top - 1.2 * lineHeight;
        var spaceAbove = top - margins.marginTop - lineHeight;
        // var maxH = max_height;
        var allowTopdown = spaceAbove > spaceBelow && spaceBelow < max_height;
        //if allow and space above greater than space below
        if (allowTopdown) {
            tip.style.maxHeight = spaceAbove + "px";
            tip.style.top = "";
            tip.style.bottom = Math.max(screenHeight - top + lineHeight, margins.marginBottom) + "px";
        } else {
            tip.style.maxHeight = spaceBelow + "px";
            tip.style.top = top + lineHeight + "px";
            tip.style.bottom = "";
        }
        tip.style.display = "block";
        if (smallHeight) {
            left += 50;
            max_width = Math.min(max_width, screenWidth / 2);
            if (left > max_width) {
                tip.style.left = '10px';
            }
            else {
                tip.style.right='10px';
            }
        } else {
            if (left + max_width > screenWidth)
                left = screenWidth - max_width;
            tip.style.left = Math.max(10, left) + "px";
        }
        tip.style.maxWidth = max_width + "px";
        if (max_width >= screenWidth) {
            max_width = screenWidth - 20;
            tip.style.whiteSpace = "pre-wrap";
        }
    };
    UI.prototype.closeArgHints = function(ts) {
        if (ts.argHintTooltip && ts.argHintTooltip.$closeThisTip) ts.argHintTooltip.$closeThisTip();
    };
    UI.prototype.renameDialog = function(ts, editor, data) {
        this.closeAllTips();
        var div = elt("p", "", data.refs.length + " references found");
        var newNameInput = elt('input','');
        var newNameLabel = elt('label', '', 'Enter new name:');
        newNameInput.style.maxWidth = '200px';
        var tip = this.makeTooltip(null, null, elt('h6', 'tooltip-header', 'Rename ', elt('span', "tooltip-name", (data.name || ""))), editor, false);
        tip.style.padding = '15px';
        tip.style.minWidth = '300px';
        tip.style.minHeight = '150px';
        tip.appendChild(div);
        tip.appendChild(newNameLabel);
        tip.appendChild(newNameInput);
        var refocus;
        try {
            setTimeout(function() {
                refocus = visit(newNameInput);
            }, 100);
        } catch (ex) {}

        var goBtn = elt('button', 'btn right');
        newNameInput.style.marginTop = '3px';//bad
        goBtn.textContent = "Rename";
        goBtn.setAttribute("type", "button");
        goBtn.addEventListener('click', function() {
            tip.$closeThisTip();
            refocus();
            var newName = newNameInput.value;
            if (!newName || newName.trim().length === 0) {
                ts.ui.showError(editor, "new name cannot be empty");
                return;
            }

            ts.executeRename(editor, newName, data);
        });
        tip.appendChild(goBtn);
        tip.appendChild(elt('div','clearfix mt-10'));
        tip.appendChild(document.createTextNode("\n(WARNING: Cannot replace refs in files that are not loaded!)"));
        this.moveTooltip(tip, null, null, editor);
    };
    UI.prototype.referenceDialog = function(ts, editor, data) {
        var self = this;
        self.closeAllTips();

        function refocus() {
            lastFocus();
        }
        var refs = new References(this.makeTooltip(null, null, "", null /*not bound to editor*/ , false, -1, refocus), ts, editor, data);
        refs.blur = refs.tip.$closeThisTip;
        refs.footer = ["Close"];
        refs.$close = refs.tip.$closeThisTip;
        refs.render();
        var info = document.createTextNode('Use up and down arrow keys to navigate between references. \nPress Esc while focused on the list to close the popup (or use the close button in the top right corner).\n This is not guaranteed to find references in other files or references for non-private variables.');
        refs.listEl.appendChild(info);
        var lastFocus = FocusManager.visit(refs.$receiver);
        refs.on("select", function(ev) {
            var animatedScroll = editor.getAnimatedScroll();
            if (animatedScroll) {
                editor.setAnimatedScroll(false);
            }
            ts.markPos(editor);
            ts.goto(editor, ev.item, function() {
                self.moveTooltip(refs.tip, null, null, editor);
                //close any tips that moving this might open, except for the ref tip
                self.closeAllTips(refs.tip);
                if (animatedScroll) {
                    editor.setAnimatedScroll(true); //re-enable
                }
            }, true);
        });

        this.moveTooltip(refs.tip, null, null, editor);
        refs.tip.style.minHeight = '150px';

    };

    UI.prototype.showArgHints = function showArgHints(ts, editor, argpos) {
        if (ts.cachedArgHints.isClosed) {
            return;
        }
        var html = ts.genArgHintHtml(ts.cachedArgHints, argpos);
        if (ts.argHintTooltip && typeof html == 'string') {
            ts.argHintTooltip.lastChild.innerHTML = html;
            this.moveTooltip(ts.argHintTooltip, null, null, editor);
        } else {
            this.closeAllTips();
            var el;
            if (typeof(html) == 'string') {
                el = document.createElement('div');
                el.innerHTML = html;
            } else el = html;
            ts.argHintTooltip = this.makeTooltip(null, null, el, editor, false, null, function(e) {
                if (e && (e.type == 'click' || e.type == 'mousedown')) {
                    ts.cachedArgHints.isClosed = true;
                }
                ts.argHintTooltip = null;
            });
        }
    };

    UI.prototype.createToken = function(part, extraClass) {
        return "<span class='doc-" + part.kind + (extraClass ? " doc-" + extraClass : "") + "'>" + htmlEncode(part.text) + "</span>";
    };

    var ItemList = global.ItemList;
    var FocusManager = global.FocusManager;
    var renderer;
    //copied from SearchTab
    var Counter = function(text) {
        this.lastLinePos = 0;
        this.indexToPosition(-1);
        this.text = text;
    };
    Counter.prototype.indexToPosition = function(offset) {
        var match;
        if (offset < this.lastLinePos) {
            this.line = -1,
                this.nextLinePos = 0,
                this.lastLinePos = -1;
            this.regex = /\r\n|\r|\n/g;
        }
        while (offset >= this.nextLinePos) {
            this.lastLinePos = this.nextLinePos;
            this.line++;
            match = this.regex.exec(this.text);
            if (match) {
                this.nextLinePos = match.index + match[0].length;
            } else this.nextLinePos = Infinity;
        }
        return {
            row: this.line,
            column: offset - this.lastLinePos
        };
    };

    function References(container, ts, editor, data) {
        this.tip = container;
        renderer = renderer || new global.RangeRenderer();
        this.headerText = data.refs.length + " references found" + (data.name ? " for <span class='tooltip-name'>" + data.name + "</span>" : "");
        this.containerClass = "tooltip-references";
        this.ts = ts;
        this.editor = editor;
        References.super(this, ["references", data.refs, container]);
        Object.assign(renderer.config, this.editor.renderer.layerConfig);
        renderer.config.themeClass = "ace_editor " + (editor.renderer.theme.isDark ? "ace_dark " : "") + editor.renderer.$theme;
        renderer.config.width = window.innerWidth * 3;
        renderer.config.lineHeight = "auto";
    }

    function normalizeRef(tsData, ref, path) {
        if (!tsData || !tsData.doc) return null;
        if (!(ref.start || ref.span)) return null;
        var start, end, session, autoClose;
        if (typeof tsData.doc != "string") {
            //session
            if (!ref.start) {
                start = tsData.doc.indexToPosition(ref.span.start);
                end = tsData.doc.indexToPosition(ref.span.start + ref.span.length);
            } else {
                start = ref.start;
                end = ref.end;
            }
            session = tsData.doc;
        } else {
            var counter = new Counter(tsData.doc);
            start = ref.start || counter.indexToPosition(ref.span.start);
            end = ref.end || counter.indexToPosition(ref.span.start + ref.span.length);
            if (tsData.doc.length < 10 || ref.start) {
                //no better way to get substring
                session = new global.EditSession(tsData.doc);
            } else {
                var s = Math.max(ref.span.start - 1000, 0);
                var e = Math.min(tsData.doc.length, s + 2000);
                var offStart = counter.indexToPosition(s);
                if (offStart.row == start.row) {
                    start.column -= offStart.column;
                    if (offStart.row == end.row)
                        end.column -= offStart.column;
                } else {
                    s -= offStart.column;
                    offStart.column = 0;
                }
                var res = tsData.doc.substring(s, e);
                var linesBefore = global.Utils.repeat(offStart.row, "\n");
                session = new EditSession(linesBefore + res, res);
                global.Utils.assert(session.getTextRange({
                    start,
                    end
                }) == tsData.doc.substr(ref.span.start, ref.span.length), tsData.doc.substr(ref.span.start, ref.span.length) + ' !=! ' + session.getTextRange({
                    start,
                    end
                }));

                autoClose = true;
                var mode = global.modelist.getModeForPath(path).mode;
                mode = ace.config.$modes[mode];
                if (mode) session.setMode(mode);

            }
        }
        return {
            start: start,
            end: end,
            session: session,
            autoClose: autoClose
        };
    }

    References.prototype.itemClass = 'references-item';
    References.prototype.createItem = function(index) {
        var data = this.items[index];
        var element = document.createElement('li');
        element.className = "references-item tabbable";
        element.tabIndex = 0;
        var parts = ["<i class='tooltip-filename", data.file.length > 18 ? " clipper" : "", "'>", data.file, "</i></br><span>"];
        if (data.start) {
            parts.push("Line ", data.start ? data.start.row + 1 : "", ", column ", data.start ? data.start.column : "");
        } else if (data.span) {
            parts.push("Position ", data.span.start);
        }
        parts.push("</span>");
        element.innerHTML = parts.join("");
        data = normalizeRef(this.ts.docs[data.file], data, data.file);
        if (data) {
            var lines = renderer.render([data], data.session);
            lines.style.fontFamily = this.editor.renderer.$fontFamily || "";
            element.appendChild(lines);
            if (data.autoClose) data.session.destroy();
        }
        global.styleClip(element);
        return element;
    };
    // References.prototype.getHtml = function(index){
    //     return this.items[index].file;
    // }

    global.Utils.inherits(References, ItemList);
    //Had to override this one method

    global.LspUI = UI;
    global.Functions.htmlEncode = htmlEncode;
}); /*_EndDefine*/