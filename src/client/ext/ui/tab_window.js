define(function (require, exports, module) {
    /*globals $, ace*/
    var Editors = require('grace/editor/editors').Editors;
    var setTab = require('grace/setup/setup_tab_host').setTab;
    var DocsTab = require('grace/setup/setup_tab_host').DocsTab;
    var getEditor = require('grace/setup/setup_editors').getMainEditor;
    var Utils = require('grace/core/utils').Utils;
    var Notify = require('grace/ui/notify').Notify;
    var setEditor = Editors.setEditor;
    var setActiveEditor = require('grace/editor/host_editor').setActiveEditor;
    var focus = require('grace/ui/focus_manager').FocusManager.focusIfKeyboard;
    var TEMP_SESSION;

    function ViewPager(editor) {
        var defaultView = editor.container;
        this.mainEditor = editor;
        Utils.assert(defaultView, 'First argument should be an editor');
        this.id = Utils.genID('v');
        //These three variables must be assigned together
        //as they can change in between method calls
        //whether such cases will later be classed as errors is not
        //yet decided
        var isIn = false, //the id of the current view
            currentView = defaultView, //the view it swaps with
            host; //holds data for the view
        var mouseHandler;

        function addMouseHandler(el) {
            var $el = $(el);
            if (!mouseHandler && editor != getEditor()) {
                mouseHandler = {
                    $el: $el,
                    func: function () {
                        clearMouseHandler(/*el*/);
                        handleMouseDown(editor, el, isIn);
                    },
                };
                exports.showClickable(el);
                $el.on('mousedown', mouseHandler.func);
            }
        }

        function clearMouseHandler(/*node*/) {
            exports.hideClickable(mouseHandler.el);
            mouseHandler.$el.off('mousedown', mouseHandler.func);
            mouseHandler = null;
        }

        //Handling all possible scenarios to make sure this operation is
        //as attomic as possible besides perhaps DomMutationEvents.
        function _atomicSetState(newhost, id, shouldDetach) {
            var shouldSetSession = false;
            if (!newhost || newhost.currentOwner) {
                newhost = null;
                id = null;
            } else if (!host) {
                shouldSetSession = true;
            }
            if (mouseHandler) clearMouseHandler(/*currentView*/);
            var parent = currentView.parentElement;
            if (!parent) throw new Error('Invalid State');
            if (host) host.currentOwner = null;
            if (shouldDetach) {
                currentView.remove();
            } else currentView.style.display = 'none';
            host = newhost;
            isIn = id;
            if (newhost) {
                currentView = newhost.element;
                addMouseHandler(currentView);
            } else currentView = defaultView;
            if (currentView.parentElement !== parent)
                parent.appendChild(currentView);
            currentView.style.display = 'block';
            if (host) host.currentOwner = this;
            if (shouldSetSession) {
                //Not atomic
                editor.setSession(
                    TEMP_SESSION || (TEMP_SESSION = new ace.EditSession('')),
                );
            }
        }
        this.enter = function (id, e, _removeView) {
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
                    console.warn('Plugin Host.onExit threw exception!!!');
                    console.error(e);
                }
            }
            _atomicSetState(this.views[id], id, _removeView && !id);
            if (host) {
                if (host.onEnter) {
                    try {
                        host.onEnter(editor, this);
                    } catch (err) {
                        console.warn(
                            'Plugin Host.onEnter: threw exception! Force removing tab.',
                        );
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
                if (getEditor() === editor) setActiveEditor(editor);
                focus(editor.textInput.getElement());
                //editor.renderer.updateFull();
            }
        };

        this.onChangeTab = function (e) {
            if (isIn && !this.views[e.tab]) {
                this.exit();
            } else if (this.views[e.tab]) {
                this.enter(e.tab, e);
            }
        }.bind(this);
        this.onChangeEditor = function () {
            if (getEditor() != editor && !mouseHandler && isIn)
                addMouseHandler(currentView);
        };
        this.remove = function (id) {
            //this can cause
            //recursive calls to enter
            if (id == isIn) {
                this.exit(true);
            }
        };
    }
    ViewPager.prototype.views = {};
    ViewPager.prototype.add = function (id, host) {
        var views = this.views;
        if (views.hasOwnProperty(id)) {
            throw 'Error id already taken';
        } else views[id] = host;
    };
    ViewPager.prototype.exit = function (removeView) {
        this.enter(null, null, removeView);
    };

    function handleMouseDown(editor, view, tab) {
        //won't do anything if this is the active editor
        setEditor(editor);
        setTab(tab);
    }

    function forceClose(id, errHost) {
        if (errHost && errHost.onClose) {
            try {
                errHost.onClose();
            } catch (e) {
                //ignore
            }
        }
        closeTabWindow(id);
        return false;
    }

    /*
        There must be an active editor, 
        There should be an active doc,
        viewpagers should viewswappers handle the few cases 
        where there isn't
    */

    //tabbed window
    var createEmptyHost = function () {
        var el = document.createElement('div');
        el.style.height = '100%';
        el.style.width = '100%';
        return {
            element: el,
        };
    };
    exports.getTabWindow = function (id, name, info, onClose, insert, host) {
        if (!doneInit) ViewPager.init();
        var pager = getEditor().viewPager;
        host = host || createEmptyHost();
        host.onClose = typeof onClose === 'function' ? onClose : null;
        host.setActive = function () {
            DocsTab.setActive(id, true, true);
        };
        pager.add(id, host);
        if (!DocsTab.isSavedTab(id)) {
            if (insert) {
                DocsTab.insertTab(
                    typeof insert === 'string'
                        ? DocsTab.indexOf(insert) + 1
                        : null,
                    id,
                    name,
                    null,
                    info,
                );
            } else DocsTab.addTab(id, name, null, info);
        }
        return host;
    };

    function closeTabWindow(id, isOpen) {
        if (isOpen !== false && DocsTab.hasTab(id)) DocsTab.removeTab(id);
        Editors.forEach(function (e) {
            e.viewPager.remove(id);
        });
        Editors.forEach(function (e) {
            if (e.viewPager.views[id]) {
                var host = e.viewPager.views[id];
                delete e.viewPager.views[id];
                if (host.onClose) host.onClose();
                host.element.remove();
            }
        });
    }

    exports.closeTabWindow = closeTabWindow;
    var doneInit;
    ViewPager.init = function () {
        var app = require('grace/core/app_events').AppEvents;
        app.on('tabClosed', function (e) {
            closeTabWindow(e.tab, false);
        });
        app.on('changeTab', function (e) {
            getEditor().viewPager.onChangeTab(e);
        });
        app.on('closeEditor', function (e) {
            e.editor.viewPager.exit();
        });
        app.on('createEditor', function (e) {
            if (e.isMain && !e.editor.viewPager)
                e.editor.viewPager = new ViewPager(e.editor);
        });
        app.on('changeEditor', function () {
            Editors.forEach(function (e) {
                e.viewPager.onChangeEditor();
            });
        });
        Editors.forEach(function (e) {
            e.viewPager = new ViewPager(e);
        });
        doneInit = true;
    };

    //exposed
    exports.showClickable = Utils.noop;
    exports.hideClickable = Utils.noop;
    //get the main editor for any nested editor
    exports.getHostEditor = function (editor) {
        return doneInit
            ? editor.viewPager && editor.viewPager.mainEditor
            : editor;
    };
}); /*_EndDefine*/