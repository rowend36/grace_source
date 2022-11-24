define(function (require, exports, module) {
    /* globals ace */
    var Editor = require('ace!editor').Editor;
    var config = require('ace!config');
    var Marker = require('ace!layer/marker').Marker;
    var dom = require('ace!lib/dom');
    var oop = require('ace!lib/oop');
    var removeFrom = require('../core/utils').Utils.removeFrom;
    var VSCROLL_WIDTH = 25;
    /** @constructor */
    function Part(top) {
        this.element = {
            childElementCount: 0,
            childNodes: [],
            lastChild: undefined,
            root: top.element,
            cache: top.$cache,
            appendChild: function (e) {
                this.childElementCount = this.childNodes.push(e);
                this.lastChild = e;
                this.root.appendChild(e);
            },
            removeChild: function (e) {
                if (e === this.lastChild) {
                    this.childNodes.pop();
                    this.lastChild = this.childNodes[
                        --this.childElementCount - 1
                    ];
                } else if (removeFrom(this.childNodes, e) < 0) return;
                this.cache.push(e);
            },
            reuseNodes: function () {
                if (this.cache.length) {
                    this.lastChild = this.childNodes[
                        (this.childElementCount = this.childNodes.push.apply(
                            this.childNodes,
                            this.cache
                        )) - 1
                    ];
                    this.cache.length = 0;
                }
            },
        };
        this.i = 0;
        this.start = 0;
        this.end = 0;
        this.done = false;
        this._deadLine = -1;
        this.delayedUpdate = top.delayedUpdate;
        this.editor = top.editor;
    }

    oop.inherits(Part, Marker);
    Part.prototype.getConfig = function (config) {
        config = Object.assign({}, config);
        config.firstRow = this.start;
        config.lastRow = this.end;
        return config;
    };
    Part.prototype.LONG_TIMEOUT = 150;
    Part.prototype.SHORT_TIMEOUT = 25;

    Object.defineProperty(Part.prototype, 'deadLine', {
        //TODO : Remove another hack
        get: function () {
            return this._deadLine;
        },
        set: function (t) {
            if (this._deadLine === -1) {
                this._deadLine = t;
            }
        },
    });
    /** @constructor */
    function Minimap(editor) {
        Marker.call(this, editor.container);
        this.element.className +=
            ' ace_scrollbar ace_scrollbar-v ace_scrollbar_marker';
        this.$render = this.onAfterRender.bind(this);
        editor.renderer.on('afterRender', this.$render);
        this.editor = editor;
        this.viewportEl = null;
        this.cursors = [];
        this.$cache = [];
        this.chunkSize = 0;
        this.timeoutCounter = 0;
        this.renderIndex = 0;
        this.parts = [new Part(this)];
    }
    oop.inherits(Minimap, Marker);
    Minimap.prototype.session = undefined;
    Minimap.prototype.delayedUpdate = undefined;
    Minimap.prototype.element = undefined;
    Minimap.prototype.MIN_CHUNK_SIZE = 5;
    Minimap.prototype.MAX_NUM_PARTS = 10;
    Minimap.prototype.SCHEDULE_DELAY = 1500;

    Minimap.prototype.updateParts = function () {
        var len = this.session.getLength();
        var chunkSize = Math.max(
            this.MIN_CHUNK_SIZE,
            (len / this.MAX_NUM_PARTS) | 0
        );
        for (var i = 0, k = 0; k < len; i++, k += chunkSize) {
            var part = this.parts[i] || (this.parts[i] = new Part(this));
            part.start = k;
            part.end = k + chunkSize - 1;
        }
        this.chunkSize = chunkSize;
        while (i < this.parts.length) {
            this.$cache.push.apply(
                this.$cache,
                this.parts.pop().element.childNodes
            );
        }
    };
    Minimap.prototype.destroy = function () {
        this.editor.renderer.off('afterRender', this.$render);
        this.element.remove();
    };
    Minimap.prototype.$padding = 0;
    Minimap.prototype.gatherMarkers = function () {
        var markers = Object.assign(
            {},
            this.session.getMarkers(),
            this.session.getMarkers(true)
        );
        for (var i = 0; i < this.parts.length; i++) {
            this.parts[i].setMarkers(markers);
        }
    };
    Minimap.prototype.updateCursors = function () {
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
                VSCROLL_WIDTH - 3
            );
            var height = Math.max(
                10,
                this.editor.renderer.getLineHeight(f.row)
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

    Minimap.prototype.viewportMarker = {
        clazz: 'marker_square',
        type: 'fullLine',
        update: function (html, self, session, config) {
            self.elt(
                this.clazz,
                'height:' +
                    self.editor.renderer.$size.scrollerHeight * config.scaleY +
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
                    'px;'
            );
            self.viewportEl =
                self.i > -1
                    ? self.element.childNodes[self.i - 1]
                    : self.element.childNodes[
                          self.element.childNodes.length - 1
                      ];
        },
    };
    Minimap.prototype.update = function (config, isAsync) {
        this.config = config;
        var len = this.parts.length;
        this.renderIndex = (this.renderIndex + 1) % len;
        var finished = true,
            timedOut = false,
            deadLine = -1;
        for (var i = 0; i < len; i++) {
            var part = this.parts[(i + this.renderIndex) % len];
            if (part.done) continue;
            if (timedOut) {
                finished = false;
                this.delayedUpdate(this.SCHEDULE_DELAY);
                break;
            }
            part.element.reuseNodes();
            part.session = this.session;
            part._deadLine = deadLine;
            part.update(part.getConfig(config), isAsync);
            if (deadLine === -1) deadLine = part._deadLine;
            //TODO Hack: Marker must render at least on element for it to time out. Otherwise, part.timedOut simply means the update was postponed.
            var skippedRender = part.timedOut && part.i === 0;
            if (!skippedRender) {
                timedOut = part.timedOut;
                if (!timedOut || isAsync) {
                    part.done = true;
                }
            } else {
                finished = false;
                break;
            }
        }
        if (finished) {
            for (var i = 0; i < this.$cache.length; i++) {
                this.element.removeChild(this.$cache[i]);
            }
            this.$cache.length = 0;
        }
    };

    Minimap.prototype.scroll = function () {
        this.viewportEl.style.top =
            (this.editor.renderer.scrollMargin.top +
                this.session.getScrollTop()) *
                this.config.scaleY +
            'px';
    };

    Minimap.prototype.onAfterRender = function (changes) {
        var r = this.editor.renderer;
        this.setSession(this.editor.session);
        var isScroll = false,
            sizeChanged =
                changes & (r.CHANGE_SIZE | r.CHANGE_FULL | r.CHANGE_LINES);
        if (sizeChanged) this.updateParts();
        if (
            changes &
            (r.CHANGE_MARKER |
                r.CHANGE_MARKER_BACK |
                r.CHANGE_MARKER_FRONT |
                r.CHANGE_FULL)
        ) {
            this.gatherMarkers();
            sizeChanged = 1;
        } else if (sizeChanged) {
        } else if (changes & (r.CHANGE_SCROLL | r.CHANGE_H_SCROLL)) {
            isScroll = true;
        } else if (changes & r.CHANGE_CURSOR) {
            return this.updateCursors();
        } else return;

        this.element.style.bottom = r.scrollBarH.getHeight() + 'px';
        var layerConfig = r.layerConfig;
        var totalHeight = r.getScrollbarHeight();
        var scaleY = Math.min(
            1,
            (layerConfig.height - r.scrollBarH.getHeight()) / totalHeight
        );
        var scaleX =
            (VSCROLL_WIDTH - 5) /
            Math.min(
                layerConfig.width,
                r.$size.scrollerWidth * 2 + r.scrollLeft
            );
        var config = {
            scaleY: scaleY,
            lineHeight: layerConfig.lineHeight * scaleY,
            firstRow: 0,
            width: VSCROLL_WIDTH,
            scaleX: scaleX,
            characterWidth: layerConfig.characterWidth * scaleX,
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
        for (var i = 0; i < this.parts.length; i++) {
            this.parts[i].done = false;
        }
        this.i = 0;
        this.viewportMarker.update(null, this, this.session, config);
        this.update(config);
        this.updateCursors();
    };
    config.defineOptions(Editor.prototype, 'editor', {
        annotateScrollbar: {
            set: function (val) {
                if (val) {
                    if (!this.$minimap) {
                        this.$minimap = new Minimap(this);
                        this.renderer.updateBackMarkers();
                    }
                } else if (this.$minimap) {
                    this.$minimap.destroy();
                    this.$minimap = null;
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
                contextMenu.firstChild
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
            }
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
    exports.ScrollbarMarker = Minimap;
    exports.setupEditor = function (el) {
        var editor = ace.edit(el);
        el.env.document = null;
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
