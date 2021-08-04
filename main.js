_Define(function(global) {
    //ace fixes
    var appEvents = global.AppEvents;
    var noop = global.Utils.noop;
    var getEditor = global.getEditor;
    var FocusManager = global.FocusManager;

    var margins = {
        marginTop: 0,
        marginBottom: 0,
    };
    var Utils = global.Utils;

    var updateStatus = Utils.delay(function() {
        var editor = getEditor();
        if (editor && editor.commands.recording) {
            $("#togglerecording").addClass("blink");
        } else $("#togglerecording").removeClass("blink");
    }, 100);
    var trackStatus = function(e) {
        (e.editor || e).on("changeStatus", updateStatus);
    };
    appEvents.on("changeEditor", updateStatus);
    appEvents.on("createEditor", trackStatus);
    global.Editors.forEach(trackStatus);

    ace.Editor.prototype.$enableTouchHandles = true;
    ace.Editor.prototype.getPopupMargins = function(isDoc) {
        return isDoc ? {
                marginTop: 0,
                marginBottom: margins.marginBottom,
            } :
            margins;
    };
    var emmetExt = ace.require("ace/ext/emmet");
    emmetExt.load = global.Imports.define(
        ["./libs/js/emmet.js"],
        null,
        function(cb) {
            window.emmet = window.emmetCodeMirror.emmet;
            cb && cb();
        }
    );
    emmetExt.isSupportedMode = noop;

    appEvents.on("view-change", function() {
        var viewRoot = global.viewRoot;
        margins.marginTop = parseInt(viewRoot.style.top);
        margins.marginBottom = parseInt(viewRoot.style.bottom) + 50;
    });
    var AutoComplete = global.Autocomplete;
    var doBlur = AutoComplete.prototype.blurListener;
    AutoComplete.prototype.blurListener = function() {
        if (FocusManager.activeElement == getEditor().textInput.getElement())
            return;
        doBlur.apply(this, arguments);
    };
    appEvents.on("keyboard-change", function(ev) {
        if (ev.isTrusted && !ev.visible) {
            var a = AutoComplete.for(getEditor());
            if (a.activated) a.detach();
        }

    });
});
_Define(function(global) {
    "use strict";
    /*So this basically sets up the application,
    Mainly deals with tab navigation
    */

    var Docs = global.Docs;
    var setBreakpoint = global.Recovery.setBreakpoint;
    var clearBreakpoint = global.Recovery.removeBreakpoint;
    var State = global.State;
    var AutoCloseable = global.AutoCloseable;
    var LinearLayout = global.LinearLayout;
    var docs = global.docs;
    var Editors = global.Editors;
    var Utils = global.Utils;
    var getMainEditor = global.getMainEditor;
    var FileUtils = global.FileUtils;
    var closeDoc = global.closeDoc;
    var getEditor = global.getEditor;
    var appConfig = global.appConfig;
    var configure = global.configure;
    var getActiveDoc = global.getActiveDoc;
    var Notify = global.Notify;
    var FocusManager = global.FocusManager;
    var MainMenu = global.MainMenu;
    var CharBar = global.CharBar;
    var DocumentTab = global.DocumentTab;
    var PagerTab = global.PagerTab;
    var appEvents = global.AppEvents;
    var Navigation = global.Navigation;
    var register = global.register;
    var configEvents = global.ConfigEvents;
    global.registerAll({
        currentTab: null,
        tabletView: false,
        disableOptimizedFileBrowser: true,
        disableBackButtonTabSwitch: false,
        backButtonDelay: "700ms",
        enableFloatingRunButton: "auto",
        enableSplits: window.innerHeight > 700,
        autoHideTabs: "landscape",
        enableKeyboardNavigation: Env.isHardwareKeyboard,
        enableGit: true,
        inactiveFileDelay: "5min",
        projectConfigFile: "grace.json",
    });
    global.registerValues({
        currentTab: "no-user-config",
        autoHideTabs: {
            doc: "Automatically hide tabs when keyboard is visible. Set to false to disable.",
            values: [
                "always",
                ["viewport", "hide if viewport is small"],
                ["landscape", "hide when in landscape"],
                "landscape_small",
                "auto",
                "never",
            ],
        }, 
        projectConfigFile: "The filepath to the user's configuration file relative to project folder or as an absolute path. Multiple comma separated files are allowed",
        enableFloatingRunButton: {
            default: "auto",
            values: ["true", "small", "center", "auto", false],
        },
        backButtonDelay: {
            type: "time"
        },
        inactiveFileDelay: {
            doc: "How long after saving is necessary for a file to be considered inactive for 'Close inactive tabs' menu option",
            type: "time"
        }
    });
    setBreakpoint("start-app", function() {
        Notify.error(
            "Error During Previous Load!!! If issue persists, contact developer"
        );
        if (window.eruda) window.eruda._entryBtn.show();
    });
    appEvents.once("app-loaded", function() {
        clearBreakpoint("start-app");
    });
    //stateManager
    var DocsTab;
    if (!Env.isWebView) State.ensure("noexit", true);
    State.addListener(
        function(tab) {
            if (DocsTab.getOwner(tab)) {
                //can try to reopen previously closed docs
                if (
                    !appConfig.disableBackButtonTabSwitch &&
                    DocsTab.hasTab(tab)
                ) {
                    if (tab != DocsTab.active) setTab(tab);
                    return true;
                }
                return false;
            } else {}
            switch (tab) {
                case "tabs":
                    return true;
                case "noexit":
                    var delay = Utils.parseTime(appConfig.backButtonDelay);
                    Notify.info(
                        "<span>Press <b>BACK</b> again to exit.<span>",
                        delay
                    );
                    appEvents.trigger("app-paused");
                    var cancel = State.exit(false);
                    setTimeout(function() {
                        appEvents.trigger("app-resumed");
                        cancel();
                        State.ensure("noexit", true);
                        State.ensure(
                            appConfig.disableBackButtonTabSwitch ?
                            "tabs" :
                            DocsTab.active
                        );
                    }, delay * 0.7);
                    return true;
            }
        },
        function(state) {
            return (
                state == "tabs" || state == "noexit" || DocsTab.hasTab(state)
            );
        }
    );
    var lastTab;

    function swapTab() {
        if (!DocsTab.hasTab(lastTab))
            lastTab = DocsTab.tabs[DocsTab.indexOf(DocsTab.active) + 1] || DocsTab.tabs[0];
        setTab(lastTab);
    }

    var setTab = global.setTab = function(tab) {
        if (DocsTab.active != tab) {
            DocsTab.setActive(tab, true, true);
        } else {
            State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : tab);
        }
    };
    /*
     * @method switchToDoc
     * Switch to a document
     * @param {String} name Path to the document
     * @param {Object} [pos] Selection start or cursor position
     * @param {Object} [end] Selection end
     * @param {EditSession|String|Boolean|undefined} [autoload] How to handle path not found
     * @param {Function} [callback]
     * @param {FileServer} [server] The server to use in loading the file 
     * @related Docs#openDoc
     * @related FileUtils#getDoc
     */
    var addDoc = global.addDoc;
    global.Functions.switchToDoc = function switchToDoc(name, pos, end, autoLoad, cb, server) {
        var doc, session, text;
        if (autoLoad && (typeof autoLoad == 'object')) {
            //autoload is a session
            session = autoLoad;
            autoLoad = undefined;
            doc = Docs.forSession(autoLoad);
        } else if (typeof autoLoad == 'string') {
            text = autoLoad;
            autoLoad = undefined;
        }
        if (!doc)
            doc = Docs.forPath(name, server) || Docs.forPath("/" + name, server);

        if (!doc) {
            var servers;
            if (server) {
                servers = [server];
            } else {
                var mainDoc = getActiveDoc();
                servers = [FileUtils.getProject().fileServer];
                if (mainDoc && mainDoc.getFileServer() != servers[
                        0]) {
                    servers.unshift(mainDoc.getFileServer());
                }
            }
            if (text || session) {
                if (session) text = session.getValue();
                doc = docs[addDoc(null, text, name, {
                    data: {
                        fileServer: servers[0].id,
                        encoding: FileUtils.encodingFor(name, servers[0])
                    }
                })];
                doc.setDirty();
                doc.refresh();
            } else {
                if (autoLoad === false) return;
                var getFile = function() {
                    var server = servers.pop();
                    if (!server) return;
                    Docs.openDoc("/" + name, server, open);
                };
                var open = function(err, doc) {
                    if (doc)
                        switchToDoc(doc.getPath(), pos, end, null, cb);
                    else getFile();
                };
                if (autoLoad) getFile();
                else Notify.ask("Open " + name, getFile);
                return;
            }
        }
        if (!(global.SplitEditors && global.SplitEditors.hasEditor(doc))) {
            global.setTab(doc.id);
        } else State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : doc.id);
        if (pos) {
            var edit = getEditor();
            edit.exitMultiSelectMode && edit.exitMultiSelectMode();
            edit.getSession().unfold(
                pos
            ); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
            var sel = edit.getSelection();
            if (end) {
                edit.getSession().unfold(
                    end
                ); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
                sel.setSelectionRange({
                    start: pos,
                    end: end
                });
            } else {
                sel.moveCursorToPosition(pos);
            }
            edit.centerSelection();
        }
        cb && cb(doc.session);
    };

    var viewRoot, SidenavLeft, ActionBar;
    global.LayoutCommands = [{
            name: "toggleFullscreen",
            bindKey: "F11",
            exec: function() {
                ActionBar.toggle();
                ActionBar.$forcedOpen = !ActionBar.hidden;
            },
        },
        {
            name: "swapTabs",
            bindKey: {
                win: "Alt-Tab",
                mac: "Command-Alt-N",
            },
            exec: swapTab,
        },
    ];
    Editors.addCommands(global.LayoutCommands);
    MainMenu.extendOption("file", {
        icon: "insert_drive_file",
        sortIndex: 3,
        caption: "File",
        subTree: {
            "close-current": {
                icon: "close",
                sortIndex: -1,
                caption: "Close current tab",
                close: true,
                onclick: function() {
                    closeTab(global.DocsTab.active);
                },
            },
            "close-except": {
                icon: "clear_all",
                caption: "Close others",
                close: true,
                onclick: function() {
                    var tab = global.DocsTab;
                    for (var i = tab.tabs.length; i-- > 0;) {
                        if (tab.tabs[i] != global.DocsTab.active) {
                            closeTab(tab.tabs[i]);
                        }
                    }
                },
            },
            "close-all": {
                icon: "clear_all",
                caption: "Close all",
                close: true,
                onclick: function() {
                    var tab = global.DocsTab;
                    for (var i = tab.tabs.length; i-- > 0;) {
                        closeTab(tab.tabs[i]);
                    }
                },
            },
            "close-inactive": {
                icon: "timelapse",
                caption: "Close inactive tabs",
                close: true,
                onclick: function() {
                    var inactiveTime =
                        new Date().getTime() -
                        Utils.parseTime(appConfig.inactiveFileDelay);
                    Utils.asyncForEach(
                        global.DocsTab.tabs.slice(0),
                        function(e, i, n) {
                            n();
                            if (
                                e == global.DocsTab.active ||
                                !docs[e] ||
                                docs[e].dirty ||
                                docs[e].isTemp()
                            )
                                return;
                            if (
                                Utils.getCreationDate(docs[e].id) < inactiveTime
                            )
                                docs[e]
                                .getFileServer()
                                .stat(
                                    docs[e].getSavePath(),
                                    function(err, s) {
                                        if (
                                            s &&
                                            s.mtimeMs < inactiveTime &&
                                            s.size === docs[e].getSize()
                                        ) {
                                            closeTab(e);
                                        }
                                    }
                                );
                        }
                    );
                },
            },
        },
    });
    var onChangeTab = Utils.guardEntry(function switchTab(id, previousTab) {
        lastTab = previousTab;
        var handled = appEvents.trigger("changeTab", {
            oldTab: lastTab,
            tab: id,
        }).defaultPrevented;
        if (!handled) {
            if (!docs[id]) id = lastTab;
            if (docs[id]) {
                var editor = getMainEditor();
                Editors.$focusEditor(editor);
                Editors.setSession(docs[id]);
            } else return false;
        }
        configure("currentTab", id, "application");
        State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
        return true;
    });

    function closeTab(id) {
        var doc = docs[id];
        if (
            appEvents.trigger("beforeCloseTab", {
                id: id,
                doc: doc,
            }).defaultPrevented
        )
            return false;
        appEvents.trigger("closeTab", {
            id: id,
            doc: doc,
        });

        function close() {
            var rebase = SidenavLeft.isOpen && SidenavLeft.isOverlay;
            rebase && AutoCloseable.remove(SidenavLeft.id);
            closeDoc(id);
            rebase && AutoCloseable.add(SidenavLeft.id, SidenavLeft);
        }
        if (!doc) return false;
        if (doc.dirty) {
            Notify.ask(
                Docs.getName(doc.id) +
                " has unsaved changes. Close without saving?",
                close
            );
            return false;
        } else {
            close();
            return true;
        }
    }
    configEvents.on("application", function(ev) {
        if (ev.config == "tabletView") {
            SidenavLeft.options.minWidthPush = ev.newValue ? 600 : Infinity;
            $(document.body)[ev.newValue ? "on" : "off"]('mousedown', 'select', global.Dropdown
                .openSelect);
        }
    });

    var toggleBelow = function(e) {
        var target = $("#" + this.id.replace("-toggle", ""));
        e.stopPropagation();
        if (target.css("display") == "none") {
            configure(this.id + ":shown", true);
            target.show();
            $(this).children().removeClass('btn-toggle__activated');
            if (this.id == 'find_file-toggle') {
                $('#project_view').removeClass('find_file_hidden');
            }
        } else {
            configure(this.id + ":shown", false);
            target.hide();
            $(this).children().addClass('btn-toggle__activated');
            if (this.id == 'find_file-toggle') {
                $('#project_view').addClass('find_file_hidden');
            }
        }
    };

    //setup sidenav used by filebrowsers
    appEvents.once('app-loaded', function() {
        //update currently push on openstart or dragstart
        var refocus = false;

        var SidenavLeftTab = new PagerTab($("#selector"), $("#side-menu"));
        SidenavLeft = new Sidenav($("#side-menu"), {
            draggable: true,
            edge: "left",
            minWidthPush: appConfig.tabletView ? 600 : Infinity,
            pushElements: $(".content"),
            onOpenStart: function() {
                FocusManager.hintChangeFocus();
                /*if (window.innerWidth < 992) {
                    SidenavRight.close();
                }*/
            },
            onOpenEnd: function() {
                if (SidenavLeftTab.getActiveTab().attr("href") == "#settings")
                    SidenavLeftTab.update("#settings");
                if (SidenavLeft.isOverlay) {
                    if (!Env.isHardwareKeyboard) {
                        if (FocusManager.keyboardVisible) {
                            refocus = FocusManager.activeElement;
                            if (refocus) {
                                refocus.blur();
                            }
                        } else document.activeElement.blur();
                    }
                    Navigation.addRoot(
                        SidenavLeft.el,
                        SidenavLeft.close.bind(SidenavLeft)
                    );
                    AutoCloseable.add(this.id, SidenavLeft);
                }
                FileUtils.trigger("sidenav-open");
            },
            onCloseStart: function() {
                try {
                    if (FileUtils.activeFileBrowser) {
                        FileUtils.activeFileBrowser.menu.hide();
                    }
                } catch (e) {
                    console.error(e);
                }
            },
            onCloseEnd: function() {
                if (SidenavLeft.isOverlay) {
                    Navigation.removeRoot(SidenavLeft.el);
                    AutoCloseable.close(this.id);
                }
                FileUtils.exitSaveMode();
                if (refocus) {
                    FocusManager.focusIfKeyboard(refocus, false, true);
                    refocus = null;
                }
            },
        });
        //toggle below in hierarchy_tabs
        var toggles = {};
        $(".toggleBelow")
            .click(toggleBelow)
            .each(function(e, el) {
                appConfig[el.id + ":shown"] = true;
                register(el.id + ":shown");
                toggles[el.id + ":shown"] = "no-user-config";
                if (!appConfig[el.id + ":shown"]) {
                    el.click();
                }
            });
        global.registerValues(toggles);
        toggles = null;
        $(".sidenav-trigger").click(SidenavLeft.toggle.bind(SidenavLeft));
        global.SideView = SidenavLeft;
        global.SideViewTabs = SidenavLeftTab;
    });

    function startApplication() {
        //Setup main view
        viewRoot = $("#viewroot")[0];
        var Layout = new LinearLayout(
            $(document.body),
            window.innerHeight,
            LinearLayout.VERTICAL
        );
        ActionBar = Layout.addChild($("#action_bar"), 56);
        ActionBar.shorter = window.innerHeight < 400;
        if (ActionBar.shorter){
            ActionBar.layout_height = 48;
            ActionBar.$el.addClass('short-action_bar');
        }
        Layout.addChild($("#viewroot"), 56, 1);
        Layout.addChild($("#status-bar"), 21);
        Layout.onRender = appEvents.trigger.bind(appEvents, "view-change");

        if (window.innerHeight < 105) {
            //possible layer resize
            var update = function() {
                if (update) {
                    if (window.innerHeight > 105) {
                        window.removeEventListener("resize", update);
                    }
                    update = null;
                }
                Layout.render();
            };
            window.addEventListener("resize", update);
        }
        //should be in overflow.js
        MainMenu.createTrigger($("#action_bar .dropdown-trigger")[0]);
        //should be in Charbar.js but decided to save an extra render
        appEvents.on("changeEditor", function(e) {
            CharBar.setEditor(e.editor);
        });
        global.viewRoot = viewRoot;
        CharBar.init(Layout);
        Layout.render();

        //Keyboard.attach Must be done on start
        if (appConfig.enableKeyboardNavigation) Navigation.attach();

        //Updating action bar
        appEvents.on("keyboard-change", function(ev) {
            $(document.body).toggleClass("virtual-keyboard-visible", ev.visible);
            if (appConfig.autoHideTabs) {
                if (!ActionBar.hidden && ev.visible && ev.isTrusted && !ActionBar.$forcedOpen) {
                    var isLandscape =
                        window.innerWidth > window.innerHeight;
                    var isSmall = window.innerHeight < 300;
                    if ((function() {
                            switch (appConfig.autoHideTabs) {
                                case true:
                                    return true;
                                case "never":
                                    return false;
                                case "auto":
                                    return isLandscape && isSmall;
                                case "viewport":
                                    return isSmall;
                                case "landscape":
                                    return isLandscape;
                                case "landscape_small":
                                    return isLandscape || isSmall;
                            }
                        })())
                        return ActionBar.hide();
                } else if (ActionBar.hidden) {
                    ActionBar.show();
                }
            }
            if (ActionBar.shorter != window.innerHeight < 400) {
                ActionBar.shorter = window.innerHeight < 400;
                ActionBar.$el.toggleClass('short-action_bar', ActionBar.shorter);
                ActionBar.layout_height = ActionBar.shorter ? 48 : 56;
                Layout.render();
            }
        });

        FocusManager.trap($("#status-bar"), true);
        global.styleClip($("#status-filename"));

        DocsTab = new DocumentTab(
            $("#menu"),
            $("#opendocs"),
            $("#status-filename").children()
        );
        FocusManager.trap($("#menu"), true);
        DocsTab.setSingleTabs(appConfig.singleTabLayout);
        DocsTab.afterClick = onChangeTab;
        DocsTab.onClose = closeTab;

        if (appConfig.tabletView)
            $(document.body).on('mousedown', 'select', global.Dropdown.openSelect);

        //Tabs
        global.DocsTab = DocsTab;
        var currentTab = appConfig.currentTab;
        var oldCurrentTab, href;
        if ((href = window.location.href.indexOf("#m")) >= 0) {
            currentTab = window.location.href.substring(href + 2);
        }
        //Docs
        Docs.initialize(DocsTab, currentTab);
        var newDoc;
        if (Docs.numDocs() < 1) {
            newDoc = Docs.createPlaceHolder(
                "welcome",
                "Welcome To Grace Editor", {
                    select: false,
                }
            );
        }
        if (!docs[currentTab]) {
            oldCurrentTab = currentTab;
            currentTab = Object.keys(docs)[0];
        }
        //Editor
        Editors.init();
        //initialize editors
        var editor = Editors.createEditor(viewRoot);
        Editors.setEditor(editor);
        //Loaded
        DocsTab.setActive(currentTab, true, true);
        if (oldCurrentTab) {
            configure("currentTab", oldCurrentTab, "application");
        }
        FileUtils.loadServers();
        //Minimum functionality handled by this point.
        appEvents.triggerForever("app-loaded");
        //Tabs,editors and docs, sideview with opendocs available
        /*
        Docs.refreshDocs is an async function but it might 
        need extensions to complete so we don't wait for it
        */
        appEvents.on("documents-loaded", Docs.refreshDocs.bind(null, null));
    }
    //Setup the bootlist, Grace can run without it
    //Extensions are advised to add to the boolist
    //rather than creating new Imports objects so
    //that their config/editor options are read as valid
    //when reading project config 
    var BootList = new global.Imports(function() {
        global.BootList = BootList = null;
        appEvents.triggerForever("fully-loaded");
    });
    global.BootList = BootList;
    BootList.add("./bootlist.js");
    appEvents.on("documents-loaded", BootList.load);

    //User objects
    Object.defineProperties(window, {
        fs: {
            get: function() {
                return getActiveDoc().getFileServer();
            },
        },
        doc: {
            get: getActiveDoc,
        },
        editor: {
            get: getEditor,
        },
        gUtils: {
            value: Utils,
        },
        fUtils: {
            value: FileUtils,
        },
    });

    $(document).ready(startApplication);
}); /*_EndDefine*/