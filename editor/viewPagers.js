_Define(function(global) {
    var Editors = global.Editors;
    var focusEditor = Editors.$focusEditor;
    var getEditor = global.getEditor;
    var Utils = global.Utils;
    var TEMP_SESSION = new ace.EditSession("");
    var Notify = global.Notify;

    /*There must be an active editor, there must be an active doc,
     But what if there isn't. That's why we have view pagers*/
    global.showClickable = function(el) {

    };
    global.hideClickable = function(el) {

    };

    function ViewPager(editor) {
        var edit = editor.container;
        this.mainEditor = editor;
        if (!edit) {
            //swap on elements is not supported yet
            throw 'Error: first argument should be a parentNode';
        }

        this.id = Utils.genID('v');
        //these three variables must be assigned together
        //and never copied as they can change in method calls
        //whether such cases will later be classed as errors is not
        //yet decided
        var isIn = false,
            node = edit,
            host;
        this.views = this.sharedViews;
        var mouseHandler;

        function addMouseHandler(el) {
            if (!mouseHandler && editor != getEditor()) {
                mouseHandler = {
                    el: el,
                    func: function() {
                        clearMouseHandler(el);
                        focusEditor(editor, el, isIn);
                    }
                };
                global.showClickable(el);
                el.addEventListener('mousedown', mouseHandler.func);
            }
        }

        function clearMouseHandler(node) {
            global.hideClickable(mouseHandler.el);
            mouseHandler.el.removeEventListener('mousedown', mouseHandler.func);
            mouseHandler = null;
        }
        this.enter = function(id, e) {
            var parent = node.parentNode;
            Utils.assert(parent, 'No parent node');
            if (id && this.views[id]) {
                var hasParent = this.views[id].element.parentNode;
                var newhost = this.views[id];

                if (!hasParent) {
                    if (host && host.onExit) {
                        try {
                            host.onExit(editor, this);
                        } catch (e) {
                            console.error('host exit threw exception ', e);
                        }
                    } else if (!host) editor.setSession(TEMP_SESSION);

                    /*start switch*/
                    node.remove();
                    if (mouseHandler)
                        clearMouseHandler(node);

                    node = newhost.element;
                    addMouseHandler(node);
                    node.host = this;
                    host = newhost;
                    isIn = id;
                    parent.appendChild(node);
                    /*end switch*/
                    if (newhost.onEnter) {
                        try {
                            newhost.onEnter(editor, this);
                        } catch (e) {
                            console.error(
                                'host enter threw exception force removing tab');
                            console.error(e);
                            Notify.error('Plugin error: ' + id);
                            ViewPager.forceClose(id, this.views[id]);
                        }
                        e.stopPropagation();
                    }
                } else if (hasParent != parent) {
                    //Viewpagers are not cloneable
                    //No need to be
                    e.stopPropagation();
                    return false;
                } else if (isIn != id) {
                    isIn = id;
                }
                newhost && newhost.swapDoc && newhost.swapDoc(isIn, e);
                e && e.preventDefault();
            } else if (isIn) {
                if (host && host.onExit) {
                    try {
                        host.onExit(editor, this);
                    } catch (e) {
                        console.error('host exit threw exception ', e);
                    }
                }
                /*start switch*/
                node.remove();
                if (mouseHandler)
                    clearMouseHandler(node);
                node = edit;
                host = null;
                isIn = false;
                parent.appendChild(node);
                /*end switch*/
                if (editor) {
                    editor.resize();
                    //editor.renderer.updateFull();
                }
            }
        };
        this.exit = function() {
            this.enter(null);
        };
        this.onChangeTab = (function(e) {
            if (isIn && !this.views[e.tab]) {
                this.exit();
            } else if (this.views[e.tab]) {
                this.enter(e.tab, e);
            }
        }).bind(this);
        this.onChangeEditor = (function() {
            if (getEditor() != editor && !mouseHandler && isIn)
                addMouseHandler(node);
        });
        this.remove = function(id) {
            var views = this.views;
            delete views[id];
            //this can cause
            //recursive calls to enter
            if (id == isIn)
                this.exit();
        };
        this.add = function(id, host) {
            var views = this.views;
            if (views.hasOwnProperty(id)) {
                throw 'Error id already taken';
            } else views[id] = host;
        };

    }
    ViewPager.prototype.sharedViews = {};
    //Nice Way to have a doc that opens in a separate editor
    var createEditorHost = function() {
        var editor = Editors.createEditor(new DocumentFragment(), true);
        editor.container.remove();
        editor.renderer.freeze();
        return {
            editor: editor,
            element: editor.container,
            onEnter: function(host) {
                editor.viewPager = host.viewPager;
                editor.viewPager.editor = editor;
                editor.renderer.unfreeze();
                Editors.getSettingsEditor().editor = editor;
                global.AppEvents.trigger('changeEditor', { editor: editor,
                    oldEditor: host, isEmbedded: true });
            },
            onExit: function(host) {
                editor.viewPager.editor = null;
                editor.viewPager = null;
                editor.renderer.freeze();
                Editors.getSettingsEditor().editor = host;
                global.AppEvents.trigger('changeEditor', { oldEditor: editor,
                    editor: host, isEmbedded: true });
            }
        };
    };
    var createEmptyHost = function(el) {
        if (!el) {
            el = document.createElement('div');
            el.style.height = '100%';
            el.style.width = '100%';
            el.className = "toolWindow";
        }
        return {
            element: el
        };
    };

    //viewpager
    Editors.getTabWindow = function(id, name, info, onClose, insert) {
        if (!doneInit)
            ViewPager.init();
        var pager = getEditor().viewPager;
        var host = createEmptyHost(el);
        host.autoClose = (onClose === true);
        host.onClose = !host.autoClose && onClose;
        host.setActive = function() {
            DocsTab.setActive(id, true, true);
        };
        pager.add(id, host);
        if (insert !== undefined) {
            global.DocsTab.insertTab(global.DocsTab.indexOf(insert) + 1, id, name, null,
                info);
        }
        global.DocsTab.addTab(id, name, null, info);
        return host;
    };
    Editors.getEditorWindow = function(id, name, info, onClose, insert) {
        if (!doneInit)
            ViewPager.init();
        var pager = getEditor().viewPager;
        var host = createEditorHost();
        host.autoClose = (onClose === true);
        host.onClose = !host.autoClose && onClose;
        host.setActive = function() {
            global.DocsTab.setActive(id, true, true);
        };
        pager.add(id, host);
        if (insert !== undefined) {
            global.DocsTab.insertTab(global.DocsTab.indexOf(insert) + 1, id, name, null,
                info);
        }
        global.DocsTab.addTab(id, name, null, info);
        return host;
    };
    Editors.closeTabWindow = function(id) {
        global.DocsTab.removeTab(id);
        Editors.forEach(function(e) {
            e.viewPager.remove(id);
        });
    }
    var doneInit;
    ViewPager.init = function() {
        var app = global.AppEvents;
        app.on('closeTab', function(e) {
            var id = e.id;
            var pager = getEditor().viewPager;
            var host = pager.views[id];
            if (host) {
                if (host.autoClose || (host.onClose && host.onClose() !==
                    false))
                    Editors.closeTabWindow(id);
                e.preventDefault();
            }
        });
        app.on('changeTab', function(e) {
            getEditor().viewPager.onChangeTab(e);
        });
        app.on('closeEditor', function(e) {
            e.editor.viewPager.exit();
        });
        app.on('createEditor', function(e) {
            if (e.isMain && !e.editor.viewPager)
                e.editor.viewPager = new ViewPager(e.editor);
        })
        app.on('changeEditor', function(e) {
            Editors.forEach(function(e) {
                e.viewPager.onChangeEditor();
            });
        });
        Editors.forEach(function(e) {
            e.viewPager = new ViewPager(e);
        });
        doneInit = true;
    };
    ViewPager.forceClose = function(id, errant) {
        if (errant && !errant.autoClose && errant.onClose) {
            try {
                errant.onClose();
            } catch (e) {//ignore
            }
        }
        Editors.closeTabWindow(id);
    }
    global.getEditor = function(ses) {
        if (ses || !doneInit) return getEditor(ses);
        else {
            var a = getEditor()
            return a.viewPager.editor || a;
        }
    }
    global.getHostEditor = function(editor) {
        return doneInit ? editor.viewPager.mainEditor : editor;
    }
    global.getMainEditor = getEditor;
    global.ViewPager = ViewPager;

}); /*_EndDefine*/