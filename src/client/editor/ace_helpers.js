define(function (require, exports, module) {
    var Editor = ace.require('ace/editor').Editor;
    var config = ace.require('ace/config');
    var Marker = ace.require('ace/layer/marker').Marker;
    var dom = ace.require('ace/lib/dom');
    var oop = ace.require('ace/lib/oop');

    var VSCROLL_WIDTH = 25;

    function ScrollbarMarker(editor) {
        Marker.call(this, editor.container);
        this.element.className +=
            ' ace_scrollbar ace_scrollbar-v ace_scrollbar_marker';
        this.$render = this.render.bind(this);
        this.viewport = {
            clazz: 'marker_square',
            type: 'fullLine',
            update: function (html, self, session, config) {
                self.elt(
                    this.clazz,
                    'height:' +
                        self.editor.renderer.$size.scrollerHeight *
                            config.scaleY +
                        'px;' +
                        'width:' +
                        config.width +
                        'px;' +
                        'top:' +
                        (self.editor.renderer.scrollMargin.top +
                            session.getScrollTop()) *
                            config.scaleY +
                        'px;' +
                        'left:' +
                        0 +
                        'px;',
                );
            },
        };
        this.cursors = [];
        editor.renderer.on('afterRender', this.$render);
        this.editor = editor;
    }
    oop.inherits(ScrollbarMarker, Marker);

    ScrollbarMarker.prototype.scroll = function () {
        var viewport = this.element.getElementsByClassName('marker_square')[0];
        if (viewport) {
            viewport.style.top =
                (this.editor.renderer.scrollMargin.top +
                    this.session.getScrollTop()) *
                    this.config.scaleY +
                'px';
        }
    };
    ScrollbarMarker.prototype.destroy = function () {
        this.editor.renderer.off('afterRender', this.$render);
        this.element.remove();
    };
    ScrollbarMarker.prototype.$padding = 0;
    ScrollbarMarker.prototype.SCHEDULE_DELAY = 1500;
    ScrollbarMarker.prototype.gatherMarkers = function () {
        var markers = Object.assign(
            {},
            this.session.getMarkers(),
            this.session.getMarkers(true),
        );
        markers.viewport = this.viewport;
        this.setMarkers(markers);
    };
    ScrollbarMarker.prototype.update = function () {
        Marker.prototype.update.apply(this, arguments);
        this.cursors.length = 0; //Marker will remove all the cursor elements
        this.updateCursors();
    };
    ScrollbarMarker.prototype.updateCursors = function () {
        var all = this.editor.selection.getAllRanges();
        if (all.length == 1) all = [];
        all = all.filter(function (e) {
            return e.isEmpty();
        });
        while (all.length < this.cursors.length) {
            this.cursors.pop().remove();
        }
        while (all.length > this.cursors.length) {
            var el = document.createElement('div');
            this.element.appendChild(el);
            this.cursors.push(el);
        }
        all.forEach(function (e, i) {
            var f = this.session.documentToScreenPosition(e.start);
            var left = Math.min(
                f.column * this.config.characterWidth,
                VSCROLL_WIDTH - 3,
            );
            var height = Math.max(
                10,
                this.editor.renderer.getLineHeight(f.row),
            );

            this.cursors[i].style.cssText =
                'top:' +
                (this.$getTop(f.row, this.config) - height / 2) +
                'px;left:' +
                left +
                'px;' +
                'height: ' +
                height +
                'px;';
            this.cursors[i].className = 'marker_cursor';
        }, this);
    };

    ScrollbarMarker.prototype.render = function (changes) {
        var r = this.editor.renderer;
        this.setSession(this.editor.session);

        this.element.style.bottom = r.scrollBarH.getHeight() + 'px';
        var isScroll = false;
        if (
            changes &
            (r.CHANGE_MARKER | r.CHANGE_MARKER_BACK | r.CHANGE_MARKER_FRONT)
        ) {
            this.gatherMarkers();
        } else if (!(changes & (r.CHANGE_SIZE | r.CHANGE_FULL))) {
            if (changes & (r.CHANGE_SCROLL | r.CHANGE_H_SCROLL)) {
                isScroll = true;
            } else if (changes & r.CHANGE_CURSOR) {
                return this.updateCursors();
            } else return;
        }
        var configOld = r.layerConfig;
        var totalHeight = r.getScrollbarHeight();
        var scaleY = Math.min(1, this.element.clientHeight / totalHeight);
        var scaleX =
            (VSCROLL_WIDTH - 5) /
            Math.min(configOld.width, r.$size.scrollerWidth * 2 + r.scrollLeft);
        var config = {
            scaleY: scaleY,
            lineHeight: configOld.lineHeight * scaleY,
            firstRow: 0,
            width: VSCROLL_WIDTH,
            scaleX: scaleX,
            characterWidth: configOld.characterWidth * scaleX,
            lastRow: this.session.getLength(),
            firstRowScreen: -r.getLineAtHeight(r.scrollMargin.top),
            offset: 0,
        };
        if (isScroll) {
            if (scaleX == this.config.scaleX && scaleY == this.config.scaleY) {
                this.config = config;
                return this.scroll();
            }
        }
        this.update(config);
    };
    config.defineOptions(Editor.prototype, 'editor', {
        annotateScrollbar: {
            set: function (val) {
                if (val) {
                    if (!this.$scrollbarMarker) {
                        this.$scrollbarMarker = new ScrollbarMarker(this);
                        this.renderer.updateBackMarkers();
                    }
                } else if (this.$scrollbarMarker) {
                    this.$scrollbarMarker.destroy();
                    this.$scrollbarMarker = null;
                }
            },
            value: false,
        },
    });

    function setupMobileMenu(editor) {
        var defaultCreate = editor.mobileMenu.create;
        editor.mobileMenu.create = function () {
            defaultCreate.call(this);
            //Hide the more element
            this.element.lastChild.style.display = 'none';
        };
        editor.mobileMenu.update = function () {
            //use material icons
            var contextMenu = this.element;
            var selected = editor.getCopyText();
            var hasUndo = editor.session.getUndoManager().hasUndo();
            this.isOpen = true;
            contextMenu.replaceChild(
                dom.buildDom([
                    'span',
                    !selected && [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'selectall',
                        },
                        'select_all',
                    ],
                    selected && [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'copy',
                        },
                        'content_copy',
                    ],
                    selected && [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'cut',
                        },
                        'content_cut',
                    ],
                    [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'paste',
                        },
                        'content_paste',
                    ],
                    hasUndo && [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'undo',
                        },
                        'undo',
                    ],
                    [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'find',
                        },
                        'search',
                    ],
                    [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'openCommandPallete',
                        },
                        'more_horiz',
                    ],
                    [
                        'span',
                        {
                            class: 'ace_mobile-button material-icons',
                            action: 'beautify',
                        },
                        'format_align_center',
                    ],
                ]),
                contextMenu.firstChild,
            );
        };
        editor.on('menuClick', function () {
            editor.mobileMenu.hide();
            //Considering adding a timeout for undo
        });
    }

    function autofadeScrollBars(editor) {
        //everything here should be configurable
        var fadeTimeout;

        function doFade() {
            editor.renderer.scrollBarV.setVisible(false);
            fadeTimeout = null;
        }
        var fadeScroll = function (e) {
            if (fadeTimeout) {
                clearTimeout(fadeTimeout);
            } else editor.renderer.scrollBarV.setVisible(true);
            if (!editor.renderer.$vScrollBarAlwaysVisible) {
                fadeTimeout = setTimeout(doFade, e ? 3000 : 1000);
            }
        };
        var stop = function (e) {
            e.stopPropagation();
        };
        ['ontouchstart', 'ontouchmove', 'ontouchend', 'onmousemove'].forEach(
            function (f) {
                editor.renderer.scrollBarV.element[f] = stop;
            },
        );
        //no resizing viewport
        editor.renderer.scrollBarV.$minWidth = VSCROLL_WIDTH;
        editor.renderer.scrollBarV.width = VSCROLL_WIDTH;
        editor.renderer.scrollBarV.element.style.width = VSCROLL_WIDTH + 'px';
        //editor.renderer.scrollBarV.inner.style.width = 30+"px";
        editor.session.on('changeScrollTop', fadeScroll);
        editor.on('changeSession', function (s) {
            s.oldSession && s.oldSession.off('changeScrollTop', fadeScroll);
            s.session && s.session.on('changeScrollTop', fadeScroll);
            fadeScroll();
        });
        editor.renderer.scrollBarV.setVisible(true);
    }

    function muddleTextInput(el) {
        el.setAttribute('autocomplete', 'off');
        el.removeAttribute('name');
        el.setAttribute('aria-hidden', true);
    }
    var onEditorResize = function () {
        var event = this.$mouseHandler.mousedownEvent;
        if (
            event &&
            new Date().getTime() - event.time < FocusManager.FOCUS_RESIZE_WINDOW
        ) {
            this.renderer.scrollCursorIntoView(null, 0.1);
        }
    };
    var FocusManager = require('../ui/focus_manager').FocusManager;
    exports.setupEditor = function (el) {
        var editor = ace.edit(el);
        editor.$enableTouchHandles = true;
        editor.renderer.setScrollMargin(5, 5, 0, 0);
        muddleTextInput(editor.textInput.getElement());

        autofadeScrollBars(editor);
        setupMobileMenu(editor);
        editor.setAutoScrollEditorIntoView(false);
        editor.$blockScrolling = Infinity; //prevents ace from logging annoying warnings
        editor.renderer.on('resize', onEditorResize.bind(editor));
        return editor;
    };
});
