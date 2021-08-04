_Define(function(global) {
    var Editor = global.Editor;
    var config = global.libConfig;
    var Marker = ace.require("ace/layer/marker").Marker;
    var VSCROLL_WIDTH = 25;
    var Utils = global.Utils;

    function ScrollbarMarker(editor) {
        Marker.call(this, editor.container);
        this.element.className += " ace_scrollbar ace_scrollbar-v ace_scrollbar_marker";
        this.$render = this.render.bind(this);
        this.viewport = {
            clazz: "marker_square",
            type: "fullLine",
            update: function(html, self, session, config) {
                self.elt(
                    this.clazz,
                    "height:" + (self.editor.renderer.$size.scrollerHeight * config.scaleY) + "px;" +
                    "width:" + config.width + "px;" +
                    "top:" + (self.editor.renderer.scrollMargin.top + session.getScrollTop()) * config.scaleY + "px;" +
                    "left:" + 0 + "px;"
                );
            }
        };
        this.cursors = [];
        editor.renderer.on('afterRender', this.$render);
        this.editor = editor;
        this.delayedUpdate = Utils.throttle((function(config) {
            this.update(config);
            this.cursors.length = 0;
            this.updateCursors();
        }).bind(this), 1000);
    }

    ScrollbarMarker.prototype.scroll = function() {
        var viewport = this.element.getElementsByClassName("marker_square")[0];
        if (viewport) {
            viewport.style.top = (this.editor.renderer.scrollMargin.top + this.session.getScrollTop()) * this.config.scaleY + "px";
        }
    };
    ScrollbarMarker.prototype.destroy = function() {
        this.editor.renderer.off('afterRender', this.$render);
        this.element.remove();
    };
    ScrollbarMarker.prototype.$padding = 0;
    ScrollbarMarker.prototype.TIMEOUT = 100;
    ScrollbarMarker.prototype.gatherMarkers = function() {
        var markers = Object.assign({}, this.session.getMarkers(), this.session.getMarkers(true));
        markers.viewport = this.viewport;
        this.setMarkers(markers);
    };
    ScrollbarMarker.prototype.updateCursors = function() {
        var all = this.editor.selection.getAllRanges();
        if (all.length == 1) all = [];
        all = all.filter(function(e) {
            return e.isEmpty();
        });
        while (all.length < this.cursors.length) {
            this.cursors.pop().remove();
        }
        while (all.length > this.cursors.length) {
            var el = document.createElement("div");
            this.element.appendChild(el);
            this.cursors.push(el);
        }
        var height = Math.max(10, this.config.lineHeight);
        all.forEach(function(e, i) {
            var f = this.session.documentToScreenPosition(e.start);
            var left = Math.min(f.column * this.config.characterWidth, VSCROLL_WIDTH - 3);
            this.cursors[i].style.cssText = "top:" + (this.$getTop(f.row, this.config) - height / 2) + "px;left:" + left + "px;" + "height: " + height + "px;";
            this.cursors[i].className = "marker_cursor";
        }, this);
    };
    ScrollbarMarker.prototype.render = function(changes) {
        var r = this.editor.renderer;
        this.setSession(this.editor.session);

        this.element.style.bottom = r.scrollBarH.getHeight() + "px";
        var isScroll = false;
        if (changes & (r.CHANGE_MARKER | r.CHANGE_MARKER_BACK | r.CHANGE_MARKER_FRONT)) {
            this.gatherMarkers();
        } else if (!(changes & (r.CHANGE_SIZE | r.CHANGE_FULL))) {
            if (changes & (r.CHANGE_SCROLL | r.CHANGE_H_SCROLL)) {
                isScroll = true;
            } else if (changes & r.CHANGE_CURSOR) {
                return this.updateCursors();
            } else return;
        }
        var configOld = r.layerConfig;
        var totalHeight = r.scrollMargin.v + configOld.maxHeight;
        var scrollerHeight = r.$size.scrollerHeight - r.lineHeight;
        if (!r.$maxLines && r.$scrollPastEnd) {
            totalHeight -= scrollerHeight * r.$scrollPastEnd;
            if (r.scrollTop > totalHeight - scrollerHeight) {
                totalHeight = r.scrollTop + scrollerHeight;
            }
        }
        var scaleY = Math.min(1, this.element.clientHeight / totalHeight);
        var scaleX = (VSCROLL_WIDTH - 5) / Math.min(configOld.width, (r.$size.scrollerWidth * 2 + r.scrollLeft));
        var config = {
            scaleY: scaleY,
            lineHeight: configOld.lineHeight * scaleY,
            firstRow: 0,
            width: VSCROLL_WIDTH,
            scaleX: scaleX,
            characterWidth: configOld.characterWidth * scaleX,
            lastRow: this.session.getLength(),
            firstRowScreen: (-r.scrollMargin.top / configOld.lineHeight),
            offset: 0
        };
        if (isScroll) {
            if (scaleX == this.config.scaleX &&
                scaleY == this.config.scaleY) {
                this.config = config;
                return this.scroll();
            } else {
                return this.delayedUpdate(config);
            }
        }
        this.delayedUpdate.now(config);
    };
    global.Utils.inherits(ScrollbarMarker, Marker);
    config.defineOptions(Editor.prototype, "editor", {
        annotateScrollbar: {
            set: function(val) {
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
            value: false
        }
    });
    var dom = global.dom;
    function setupMobileMenu(editor) {
        var defaultCreate = editor.mobileMenu.create;
        editor.mobileMenu.create = function(){
            defaultCreate.call(this);
            this.element.lastChild.style.display = 'none';
        };
        editor.mobileMenu.update = function() {
            //use material icons
            var contextMenu = this.element;
            var selected = editor.getCopyText();
            var hasUndo = editor.session.getUndoManager().hasUndo();
            this.isOpen = true;
            contextMenu.replaceChild(
                dom.buildDom(["span",
                    !selected && ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "selectall"
                    }, "select_all"],
                    selected && ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "copy"
                    }, "content_copy"],
                    selected && ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "cut"
                    }, "content_cut"],
                    ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "paste"
                    }, "content_paste"],
                    hasUndo && ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "undo"
                    }, "undo"],
                    ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "find"
                    }, "search"],
                    ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "openCommandPallete"
                    }, "more_horiz"],
                    ["span", {
                        class: "ace_mobile-button material-icons",
                        action: "beautify"
                    }, "format_align_center"],
                ]),
                contextMenu.firstChild
            );
        };
    }

function autofadeScrollBars(editor) {
    //everything here should be configurable
    var fadeTimeout;

    function doFade() {
        editor.renderer.scrollBarV.setVisible(false);
        fadeTimeout = null;
    }
    var fadeScroll = function(e) {
        if (fadeTimeout) {
            clearTimeout(fadeTimeout);
        } else editor.renderer.scrollBarV.setVisible(true);
        if (!editor.renderer.$vScrollBarAlwaysVisible) {
            fadeTimeout = setTimeout(doFade, e ? 3000 : 1000);
        }
    };
    var stop = function(e) {
        e.stopPropagation();
    };
    ['ontouchstart', 'ontouchmove', 'ontouchend', 'onmousemove'].forEach(function(f) {
        editor.renderer.scrollBarV.element[f] = stop;
    });
    //no resizing viewport
    editor.renderer.scrollBarV.$minWidth = VSCROLL_WIDTH;
    editor.renderer.scrollBarV.width = VSCROLL_WIDTH;
    editor.renderer.scrollBarV.element.style.width = VSCROLL_WIDTH + "px";
    //editor.renderer.scrollBarV.inner.style.width = 30+"px";
    editor.session.on("changeScrollTop", fadeScroll);
    editor.on("changeSession", function(s) {
        s.oldSession && s.oldSession.off('changeScrollTop', fadeScroll);
        s.session && s.session.on('changeScrollTop', fadeScroll);
        fadeScroll();
    });
    editor.renderer.scrollBarV.setVisible(true);
}
global.setupMobileMenu = setupMobileMenu;
global.autofadeScrollBars = autofadeScrollBars;
});
_Define(function(global) {
    var appEvents = global.AppEvents;
    var Utils = global.Utils;
    var Docs = global.Docs;
    var EditorSettings = global.EditorSettings;
    var FocusManager = global.FocusManager;
    var autofadeScrollBars = global.autofadeScrollBars;
    var setupMobileMenu = global.setupMobileMenu;

    function getSettingsEditor() {
        return settings;
    }
    //Basics for managing multiple editors
    //Whether it's splits,tabs, scrollers etc
    //setEditor, createEditor, closeEditor, getEditor
    var editors = [];
    var settings = new EditorSettings(editors);

    //The main editor is the one that is completely managed by
    //the application, used for switching docs and the like
    var __editor;

    function getEditor(session) {
        return session ? editors.filter(function(e) {
            return e.session === session;
        })[0] : __editor;
    }


    function setEditor(e) {
        //e can be a container or
        //an editor mousedown event
        e = e.editor || e;
        if (__editor == e) return;
        Utils.assert(editors.indexOf(e) > -1, 'Please use set viewPager.getEditorWindow');
        var oldEditor = __editor;
        __editor = e;
        settings.editor = e;
        appEvents.trigger('changeEditor', {
            oldEditor: oldEditor,
            editor: e
        });
    }

    function setSession(doc) {
        var editor = __editor;
        var session = doc.session;
        if (editors.length > 1) {
            //deal with cloned sessions
            var oldDoc = Docs.forSession(editor.session);
            if (oldDoc === doc) {
                session = editor.session;
            } else {
                if (oldDoc) {
                    //Close any clones available
                    Docs.closeSession(editor.session);
                }
                if (getEditor(session)) {
                    //create clone
                    session = doc.cloneSession();
                }
            }
        }
        settings.session = doc.session;
        var overrides = Object.assign({}, editor.editorOptions, doc.editorOptions);
        for (var i in overrides) {
            var value = (doc.editorOptions && doc.editorOptions.hasOwnProperty(i)) ? doc
                .editorOptions[i] : settings.options[i];
            editor.setOption(i, value);
        }
        editor.editorOptions = doc.editorOptions;

        editor.setSession(session);
    }

    function closeEditor(edit) {
        var index = editors.indexOf(edit);
        if (index > -1) {
            if (appEvents.trigger('closeEditor', {
                    editor: edit
                }).defaultPrevented)
                return;
            editors.splice(index, 1);
            if (edit === __editor) {
                __editor = null;
                setEditor(editors[0]);
            }
        }
        if (Docs.forSession(edit.session))
            Docs.closeSession(edit.session);
        try {
            edit.setSession(null);
        } catch (e) {
            console.error(e);
        }
        FocusManager.focusIfKeyboard(__editor.textInput.getElement());
        edit.destroy();
    }


    function keepSelect(e) {
        var event = this.$mouseHandler.mousedownEvent;
        if (event && new Date().getTime() - event.time < global.FOCUS_RESIZE_WINDOW) {
            this.renderer.scrollCursorIntoView(null, 0.1);
        }
    }

    function muddleTextInput(el) {
        el.setAttribute("autocomplete", "off");
        el.removeAttribute("name");
        el.setAttribute("aria-hidden", true);
    }

    function createEditor(container, orphan) {
        var el = document.createElement("div");
        el.className = 'editor';
        container.appendChild(el);
        var editor = ace.edit(el);
        editor.renderer.setScrollMargin(5, 5, 0, 0);
        muddleTextInput(editor.textInput.getElement());
        autofadeScrollBars(editor);
        setupMobileMenu(editor);
        editor.setAutoScrollEditorIntoView(false);
        editor.$blockScrolling = Infinity; //prevents ace from logging annoying warnings
        settings.add(editor);

        for (var i = 0, end = defaultCommands.length; i < end; i++) {
            if (orphan && defaultCommands[i].mainOnly) continue;
            editor.commands.addCommand(defaultCommands[i]);
        }
        editor.renderer.on('resize', keepSelect.bind(editor));
        if (!orphan) {
            editors.push(editor);
            editor.renderer.on("themeLoaded", function(e) {
                if (editor == editors[0]) {
                    global.setTheme(e.theme);
                }
            });
            editor.renderer.on('changeCharacterSize', function() {
                if (editor == editors[0]) {
                    settings.setOption("fontSize", editor.getFontSize());
                }
            });
        }
        appEvents.trigger('createEditor', {
            editor: editor,
            isMain: !orphan
        });
        return editor;
    }
    var defaultCommands = [];

    function addCommands(commands, mainOnly) {
        if (!Array.isArray(commands)) commands = [commands];
        if (mainOnly) {
            commands.forEach(function(e) {
                e.mainOnly = true;
            });
        }
        defaultCommands.push.apply(defaultCommands, commands);
        for (var i in editors) {
            for (var j in commands)
                editors[i].commands.addCommand(commands[j]);
        }
    }
    var api = Object.create(null);
    api.init = Utils.noop;
    api._editors = editors;

    api.getSettingsEditor = getSettingsEditor;
    api.setSession = setSession;
    api.findEditor = getEditor;
    api.addCommands = addCommands;
    api.forEach = editors.forEach.bind(editors);
    api.setEditor = setEditor;
    api.getEditor = getEditor;
    api.createEditor = createEditor;
    api.closeEditor = closeEditor;
    global.Editors = api;
    global.getEditor = getEditor;
}); /*_EndDefine*/