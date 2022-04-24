define(function(require, exports, module) {
    require("css!./completion");
    var htmlEncode = require("grace/core/utils").Utils.htmlEncode;
    var visit = require("grace/core/focus_manager").FocusManager.visit;
    var focus = require("grace/core/focus_manager").FocusManager
        .focusIfKeyboard;
    var EditSession = ace.require("ace/edit_session").EditSession;

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
            if (typeof elt == "string") elt = document.createTextNode(
                elt);
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
        var place = editor.renderer.getCursorPixelPosition(null,
            true
        ); //position relative to scroller except with css transforms which we avoid
        place.left -= editor.session
            .getScrollLeft(); //onScreen should do this but it doesn't
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
        return suffix ? " " /*remove ace_ prefix*/ + this.iconCls +
            "completion " + this.iconCls +
            "completion-" + suffix : "";
    };
    UI.prototype.closeAllTips = function(except) {
        var tips = document.querySelectorAll('.' + this.cls +
            'tooltip');
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
        return this.makeTooltip(null, null, content, editor, true,
            timeout);
    };
    UI.prototype.makeTooltip = function(x, y, content, editor,
        closeOnCursorActivity, fadeOutDuration,
        onClose) {
        var node = elt("div", "ace_tooltip " + this.cls +
            "tooltip");
        if (typeof content === 'string')
            node.innerHTML = content;
        else node.appendChild(content);
        document.body.appendChild(node);
        var closeBtn = document.createElement('button');
        closeBtn.setAttribute('title', 'close');
        closeBtn.setAttribute('class', this.cls +
            'tooltip-boxclose');
        if (node.firstChild)
            node.insertBefore(closeBtn, node.firstChild);
        else node.appendChild(closeBtn);

        function closeThisTip(e, fade) {
            if (editor) {
                if (closeOnCursorActivity) {
                    editor.getSession().selection.off(
                        'changeCursor', closeThisTip);
                    editor.getSession().off('changeScrollTop',
                        closeThisTip);
                    editor.getSession().off('changeScrollLeft',
                        closeThisTip);
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
            editor.getSession().selection.on('changeCursor',
                closeThisTip);
            editor.getSession().on('changeScrollTop', closeThisTip);
            editor.getSession().on('changeScrollLeft',
                closeThisTip);
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
        var debug = console;
        try {
            var message = '',
                details = '';

            var isError = function(o) {
                return o && o.name && o.stack && o.message;
            };

            if (isError(msg)) { //msg is an Error object
                message = msg.name + ': ' + msg.message;
                details = msg.stack;
            } else if (msg.msg && msg
                .err
            ) { //msg is object that has string msg and Error object
                message = msg.msg;
                if (isError(msg.err)) {
                    message += ': ' + msg.err.message;
                    details = msg.err.stack;
                }
            } else { //msg is string message;
                message = msg;
                details = 'details not supplied. current stack:\n' +
                    new Error().stack;
            }

            debug.log('tsError:\t ', message, '\n details:',
                details); //log the message and deatils (if any)

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
                throw new Error('ts show error failed.' +
                    message + '\n\n fail error: ' + ex
                    .name +
                    '\n' + ex.message + '\n' + ex.stack);
            }, 0);
        }
    };
    UI.prototype.moveTooltip = function(tip, x, y, editor, max_width,
        max_height) {
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
        var header = tip.getElementsByClassName('modal-header');
        if (header.length) {
            header[0].style.paddingRight = '25px';
            tip.style.padding = '';
        } else if (max_height > screenWidth || max_height >
            max_width) {
            tip.style.paddingRight = '';
            tip.style.paddingTop = '25px';
        } else {
            tip.style.paddingTop = '';
            tip.style.paddingRight = '35px';
        }
        if (x === null || y === null) {
            var location = getCursorPosForTooltip(editor);
            x = location.left;
            y = location.top;
        }
        var rect = editor.renderer.scroller
            .getBoundingClientRect(); //position of scroller on screen

        var margins = editor.getPopupMargins(true);
        var screenHeight = document.body.clientHeight;
        var lineHeight = editor.renderer.lineHeight;
        var top = y + rect.y;
        var left = x - 50 + rect.x;
        var smallHeight = false;
        if (screenWidth > screenHeight * 1.5 && screenHeight <
            360 && max_height > 150) {
            top = margins.marginTop;
            //small view_height
            smallHeight = true;
        }
        var spaceBelow = screenHeight - margins.marginBottom - top -
            1.2 * lineHeight;
        var spaceAbove = top - margins.marginTop - lineHeight;
        // var maxH = max_height;
        var allowTopdown = spaceAbove > spaceBelow && spaceBelow <
            max_height;
        //if allow and space above greater than space below
        if (allowTopdown) {
            tip.style.maxHeight = spaceAbove + "px";
            tip.style.top = "";
            tip.style.bottom = Math.max(screenHeight - top +
                lineHeight, margins.marginBottom) + "px";
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
            } else {
                tip.style.right = '10px';
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
        if (ts.argHintTooltip && ts.argHintTooltip.$closeThisTip) ts
            .argHintTooltip.$closeThisTip();
    };
    UI.prototype.renameDialog = function(ts, editor, data) {
        this.closeAllTips();
        var div = elt("p", "", data.refs.length +
            " references found");
        var newNameInput = elt('input', '');
        var newNameLabel = elt('label', '', 'Enter new name:');
        newNameInput.style.maxWidth = '200px';
        var tip = this.makeTooltip(null, null, elt('h6',
                'tooltip-header', 'Rename ', elt('span',
                    "tooltip-name", (data.name || ""))), editor,
            false);
        tip.className += ' large-tooltip';
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
        newNameInput.style.marginTop = '3px'; //bad
        goBtn.textContent = "Rename";
        goBtn.setAttribute("type", "button");
        goBtn.addEventListener('click', function() {
            tip.$closeThisTip();
            refocus();
            var newName = newNameInput.value;
            if (!newName || newName.trim().length === 0) {
                ts.ui.showError(editor,
                    "new name cannot be empty");
                return;
            }

            ts.executeRename(editor, newName, data);
        });
        tip.appendChild(goBtn);
        tip.appendChild(elt('div', 'clearfix mt-10'));
        tip.appendChild(document.createTextNode(
            "\n(WARNING: Cannot replace refs in files that are not loaded!)"
        ));
        this.moveTooltip(tip, null, null, editor);
    };
    var sideView;
    UI.prototype.referenceDialog = function(ts, editor, data) {
        var self = this;
        self.closeAllTips();
        var moveToLastFocus;

        var close = function() {
            sideView.close();
            sideView.options.draggable = false;
            sideView.$el.empty();
        };
        if (sideView) {
            close();
        }
        var container, isTip;
        if (data.refs.length < 4 || window.innerWidth > 720 &&
            window.innerHeight > 720) {
            isTip = true;
            container = this.makeTooltip(null, null, "",
                null /*not bound to editor*/ , false, -1,
                function() {
                    moveToLastFocus();
                });
            close = container.$closeThisTip;
            container.className += ' large-tooltip';
        } else {
            if (!sideView) {
                createSideView();
            } else sideView.options.draggable = false;
            container = sideView.el;
            //use a live list
            sideView.options.focusable = sideView.el
                .getElementsByTagName('textarea');
            sideView.open();
        }
        var refs = new References(container, ts, editor, data);
        refs.blur = close;
        refs.footer = ["Close"];
        refs.$close = close;
        refs.render();
        moveToLastFocus = FocusManager.visit(refs.$receiver);
        if (isTip) {
            refs.listEl.appendChild(elt('i',
                'color-inactive info-tooltip',
                'This is not guaranteed to find references in other files or references for non-private variables.'
            )).style.padding = '10px';
        } else {
            sideView.returnFocus = moveToLastFocus;
        }
        refs.on("select", function(ev) {
            var animatedScroll = editor.getAnimatedScroll();
            if (animatedScroll) {
                editor.setAnimatedScroll(false);
            }
            ts.markPos(editor);
            ts.goto(editor, ev.item, function() {
                if (!isTip && sideView.isOverlay) {
                    sideView.close();
                } else {
                    self.moveTooltip(container,
                        null, null, editor);
                    //close any tips that moving this might open, except for the ref tip
                    self.closeAllTips(container);
                }
                if (animatedScroll) {
                    editor.setAnimatedScroll(
                        true); //re-enable
                }
            }, true);
        });

        if (isTip) {
            this.moveTooltip(container, null, null, editor);
            container.style.contaner = '150px';
        } else container.style.overflow = 'auto';
    };

    UI.prototype.showArgHints = function showArgHints(ts, editor,
        argpos) {
        if (ts.cachedArgHints.isdraggable) {
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
            ts.argHintTooltip = this.makeTooltip(null, null, el,
                editor, false, null,
                function(e) {
                    if (e && (e.type == 'click' || e.type ==
                            'mousedown')) {
                        ts.cachedArgHints.isdraggable = true;
                    }
                    ts.argHintTooltip = null;
                });
        }
    };

    UI.prototype.createToken = function(part, extraClass) {
        return "<span class='doc-" + part.kind + (extraClass ?
                " doc-" + extraClass : "") + "'>" +
            htmlEncode(part.text) + "</span>";
    };
    var createSideView = function() {
        var el = document.body.appendChild(elt('div',
            'sidenav pt-10'));
        var AutoCloseable = require("grace/ui/autocloseable")
            .AutoCloseable;
        var Navigation = require("grace/core/navigation")
        .Navigation;
        sideView = new Sidenav($(el), {
            edge: 'right',
            draggable: true,
            inDuration: 200,
            onOpenEnd: AutoCloseable.onOpenEnd,
            onOpenStart: function() {
                Navigation.addRoot(el, this.close.bind(
                    this));
                if (this.options.focusable[0]) {
                    focus(this.options.focusable[0]);
                }
            },
            onCloseStart: function() {
                this.returnFocus();
                Navigation.removeRoot(this);
            },
            onCloseEnd: AutoCloseable.onCloseEnd,
            outDuration: 100,
            dragTargetWidth: 30,
            minWidthPush: 720,
            preventScrolling: true,
            dragTarget: $(".content")[0],
            pushElements: $(".content")
        });
        createSideView = null;
    };
    var ItemList = require("grace/ui/itemlist").ItemList;
    var FocusManager = require("grace/core/focus_manager").FocusManager;
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
        renderer = renderer || new require("grace/ui/range_renderer")
            .RangeRenderer();
        this.headerText = '<span class="blue-text">' + data.refs
            .length + '</span>' + " references found" + (
                data.name ?
                " for <span class='tooltip-name'>" + data.name +
                "</span>" : "");
        this.containerClass = "tooltip-references";
        this.ts = ts;
        this.editor = editor;
        References.super(this, ["references", data.refs, container]);
        Object.assign(renderer.config, this.editor.renderer
            .layerConfig);
        renderer.config.themeClass = "ace_editor " + (editor.renderer
                .theme.isDark ? "ace_dark " : "") + editor
            .renderer.$theme;
        renderer.config.width = window.innerWidth * 3;
        renderer.config.lineHeight = "auto";
        renderer.config.fontSize = "inherit";
    }

    function normalizeRef(tsData, ref, path) {
        if (!tsData || !tsData.doc) return null;
        if (!(ref.start || ref.span)) return null;
        var start, end, session, autoClose;
        if (typeof tsData.doc != "string") {
            //session
            if (!ref.start) {
                start = tsData.doc.indexToPosition(ref.span.start);
                end = tsData.doc.indexToPosition(ref.span.start + ref
                    .span.length);
            } else {
                start = ref.start;
                end = ref.end;
            }
            session = tsData.doc;
        } else {
            var counter = new Counter(tsData.doc);
            start = ref.start || counter.indexToPosition(ref.span
                .start);
            end = ref.end || counter.indexToPosition(ref.span.start +
                ref.span.length);
            if (tsData.doc.length < 10 || ref.start) {
                //no better way to get substring
                session = new ace.require("ace/edit_session")
                    .EditSession(tsData.doc);
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
                var linesBefore = require("grace/core/utils").Utils
                    .repeat(offStart.row,
                        "\n");
                session = new EditSession(linesBefore + res, res);
                require("grace/core/utils").Utils.assert(session
                    .getTextRange({
                        start,
                        end
                    }) == tsData.doc.substring(ref.span.start, ref
                        .span.start + ref.span.length), tsData.doc
                    .substring(ref.span
                        .start, ref.span.start + ref.span.length) +
                    ' !=! ' + session
                    .getTextRange({
                        start,
                        end
                    }));

                autoClose = true;
                var mode = ace.require("ace/ext/modelist")
                    .getModeForPath(path).mode;
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
        var noHeader = this.items[index - 1] && this.items[index -
            1].file == data.file;
        var element = document.createElement('li');
        element.className = "references-item mb-10 " + (noHeader ?
            "" : "mt-5");
        element.tabIndex = 0;
        var parts = noHeader ? [] : ["<i class='tooltip-filename",
            data.file.length > 18 ? " clipper" : "",
            "'>", data.file,
            "</i></br><span>"
        ];
        if (data.start) {
            parts.push("<i>Line ", data.start ? data.start.row + 1 :
                "", ", column ", data.start ? data
                .start
                .column : "", '</i>');
        } else if (data.span) {
            parts.push("<i>Offset ", data.span.start, "</i>");
        }
        parts.push("</span>");
        element.innerHTML = parts.join("");
        data = normalizeRef(this.ts.docs[data.file], data, data
            .file);
        if (data) {
            var lines = renderer.render([data], data.session);
            lines.style.fontFamily = this.editor.renderer
                .$fontFamily || "";
            lines.className += " part tabbable";
            element.appendChild(lines);
            if (data.autoClose) data.session.destroy();
        }
        require("grace/ui/ui_utils").styleClip(element);
        return element;
    };
    // References.prototype.getHtml = function(index){
    //     return this.items[index].file;
    // }

    require("grace/core/utils").Utils.inherits(References, ItemList);
    //Had to override this one method

    exports.LspUI = UI;
}); /*_EndDefine*/