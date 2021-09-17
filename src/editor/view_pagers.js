_Define(function(global) {
    var appEvents = global.AppEvents;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var setEditor = Editors.setEditor;
    global.getEditor = function(ses) {
        if (ses) return getEditor(ses);
        else {
            return activeEditor;
        }
    };
    var activeEditor = getEditor();
    var currentHost = null;
    global.getMainEditor = getEditor;
    var settings = Editors.getSettingsEditor();

    function focusEditor(editor) {
        if (editor === activeEditor) {
            return;
        }
        var host = editor.hostEditor;
        if (!host) {
            if (editor === currentHost) {
                return appEvents.trigger('changeEditor', {
                    oldEditor: activeEditor,
                    editor: editor
                });
            } else return setEditor(editor);
        }
        if (currentHost !== host) {
            currentHost = null;
            setEditor(host);
            currentHost = currentHost || activeEditor;
        }
        if (currentHost == host)
            appEvents.trigger('changeEditor', {
                oldEditor: activeEditor,
                editor: editor,
                isPlugin: true
            });
    }
    appEvents.on('changeEditor', function(e) {
        activeEditor = e.editor;
        settings.editor = activeEditor;
        if (!e.isPlugin)
            currentHost = null;
    });
    appEvents.on('closeEditor', function(e) {
        if (activeEditor == e.editor) {
            activeEditor = currentHost;
        }
    });

    function onCreateEditor(e) {
        var editor = e.editor;
        editor.$setActive = focusEditor.bind(null, editor);
        editor.on('mousedown', editor.$setActive);
    }
    appEvents.on('createEditor', onCreateEditor);
    Editors.$focusEditor = focusEditor;
});

_Define(function(global) {
    var Editors = global.Editors;
    var getEditor = global.getMainEditor;
    var Utils = global.Utils;
    var TEMP_SESSION = new ace.EditSession("");
    var Notify = global.Notify;
    var setEditor = Editors.setEditor;

    function handleMouseDown(editor, view, tab) {
        //won't do anything if this is the active editor
        setEditor(editor);
        global.setTab(tab);
    }

    function forceClose(id, errHost) {
        if (errHost && !errHost.autoClose && errHost.onClose) {
            try {
                errHost.onClose();
            } catch (e) { //ignore
            }
        }
        Editors.closeTabWindow(id);
        return false;
    }

    /*
        There must be an active editor, 
        There should be an active doc,
        viewpagers should viewswappers handle the few cases 
        where there isn't
    */

    function ViewPager(editor) {
        var container = editor.container;
        this.mainEditor = editor;
        if (!container) {
            throw 'Error: first argument should be an editor';
        }
        this.id = Utils.genID('v');
        //These three variables must be assigned together
        //as they can change in between method calls
        //whether such cases will later be classed as errors is not
        //yet decided
        var isIn = false, //the id of the current view
            currentView = container, //the view it swaps with
            host; //holds data for the view
        var mouseHandler;

        function addMouseHandler(el) {
            var $el = $(el);
            if (!mouseHandler && editor != getEditor()) {
                mouseHandler = {
                    $el: $el,
                    func: function() {
                        clearMouseHandler(el);
                        handleMouseDown(editor, el, isIn);
                    }
                };
                global.showClickable(el);
                $el.on('mousedown', mouseHandler.func);
            }
        }

        function clearMouseHandler(node) {
            global.hideClickable(mouseHandler.el);
            mouseHandler.$el.off('mousedown', mouseHandler.func);
            mouseHandler = null;
        }

        function _setState(newhost, id, removeView) {
            if (!newhost || newhost.currentOwner) {
                //handling all possible scenarios
                newhost = null;
                id = null;
            } else if (!host) {
                editor.setSession(TEMP_SESSION);
            }
            if (mouseHandler)
                clearMouseHandler(currentView);
            var parent = currentView.parentElement;
            if (!parent) throw new Error('Invalid State');
            if (host) host.currentOwner = null;
            if (removeView) {
                currentView.remove();
            } else currentView.style.display = 'none';

            host = newhost;
            isIn = id;
            if (newhost) {
                currentView = newhost.element;
                addMouseHandler(currentView);
            } else currentView = container;
            if (currentView.parentElement !== parent)
                parent.appendChild(currentView);
            currentView.style.display = 'block';
            if (host) host.currentOwner = this;
        }
        this.enter = function(id, e, removeView) {
            if (id && this.views[id]) {
                var hasParent = this.views[id].currentOwner;
                if (hasParent && hasParent != this) {
                    //Viewpagers are not cloneable
                    e.stopPropagation();
                    return false;
                } else if (hasParent == this) {
                    return host.onShow(isIn, e);
                }
            }
            if (host && host.onExit) {
                try {
                    host.onExit(editor, this);
                } catch (e) {
                    console.error('host exit threw exception ', e);
                }
            }
            var newhost = this.views[id];
            _setState(newhost, id, removeView);
            if (host) {
                if (host.onEnter) {
                    try {
                        host.onEnter(editor, this);
                    } catch (err) {
                        console.error(
                            'Plugin host.onEnter: threw exception! Force removing tab');
                        console.error(err);
                        Notify.error('Plugin error !!!');
                        e.stopPropagation();
                        return forceClose(isIn, host);
                    }
                }
                if (host && host.onShow) {
                    host.onShow(isIn, this);
                }
                e.preventDefault();
            } else {
                editor.resize();
                //editor.renderer.updateFull();
            }
        };

        this.onChangeTab = (function(e) {
            if (isIn && !this.views[e.tab]) {
                this.exit();
            } else if (this.views[e.tab]) {
                this.enter(e.tab, e);
            }
        }).bind(this);
        this.onChangeEditor = function() {
            if (getEditor() != editor && !mouseHandler && isIn)
                addMouseHandler(currentView);
        };
        this.remove = function(id) {
            //this can cause
            //recursive calls to enter
            if (id == isIn) {
                this.exit(true);
            }
        };

    }
    ViewPager.prototype.views = {};
    ViewPager.prototype.add = function(id, host) {
        var views = this.views;
        if (views.hasOwnProperty(id)) {
            throw 'Error id already taken';
        } else views[id] = host;
    };
    ViewPager.prototype.exit = function(removeView) {
        this.enter(null, null, removeView);
    };


    //tabbed window
    var createEmptyHost = function() {
        var el = document.createElement('div');
        el.style.height = '100%';
        el.style.width = '100%';
        return {
            element: el
        };
    };
    Editors.getTabWindow = function(id, name, info, onClose, insert, host) {
        if (!doneInit)
            ViewPager.init();
        var pager = getEditor().viewPager;
        host = host || createEmptyHost();
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
        Editors.forEach(function(e) {
            if (e.viewPager.views[id]) {
                var host = e.viewPager.views[id];
                delete e.viewPager.views[id];
                host.element.remove();
            }
        });
    };
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
        });
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

    //exposed
    global.showClickable = Utils.noop;
    global.hideClickable = Utils.noop;
    global.getHostEditor = function(editor) {
        return doneInit ? editor.viewPager && editor.viewPager.mainEditor : editor;
    };
    global.ViewPager = ViewPager;

}); /*_EndDefine*/