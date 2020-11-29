(function(global) {
    "use strict";
    var Doc = global.Doc;
    var EventsEmitter = global.EventsEmitter;
    var State = global.manageState(window);
    var AutoCloseable = global.AutoCloseable;
    var LinearLayout = global.LinearLayout;
    var CharBar = global.CharBar;
    var Functions = global.Functions;
    var docs = global.docs;
    var Editors = global.Editors;
    var Utils = global.Utils;
    var SettingsDoc = global.SettingsDoc;
    var FileUtils = global.FileUtils;
    var addDoc = global.addDoc;
    var closeDoc = global.closeDoc;
    var getEditor = global.getEditor;
    var appConfig = global.appConfig;
    var configure = global.configure;
    var Notify = global.Notify;
    var FocusManager = global.FocusManager;

    var DocsTab;
    global.registerAll({
        "currentDoc": null,
        'disableOptimizedFileBrowser': false,
        "applicationTheme": "editor",
        "singleTabLayout": false,
        "disableBackButtonTabSwitch": false,
    });
    global.registerValues({
        "applicationTheme": "editor ,classic (needs reload)"
    });
    var appEvents = global.AppEvents;
    Object.assign(appEvents, {
        getCurrentTab: function() {
            return DocsTab.active;
        },
        getCurrentDoc: function() {
            return currentDoc;
        },
        getStorage: function() {
            return appStorage;
        }
    });

    //App Theming
    appEvents._eventRegistry.themeChange = null;
    const themeBlack = ["ace-tomorrow-night-bright", "ace-terminal-theme"];
    var theme = {
        className: 'ace-tm',
        background: 'white'
    };

    function getStyle(_class) {
        var div = document.createElement('div');
        div.className = _class;
        document.body.appendChild(div);
        var e = window.getComputedStyle(div);
        var f = {
            background: e.background || e.backgroundColor,
            color: e.color,
            font: e.font || e.fontFamily
        };
        div.remove();
        return f;

    }
    global.setTheme = function(ace_theme) {
        var style = window.getComputedStyle ? getStyle(ace_theme.cssClass) : null;
        theme = {
            className: ace_theme.cssClass,
            background: style && style.background,
            style: style,
            color: style && style.color,
            isDark: ace_theme.isDark,
            isBlack: themeBlack.indexOf(ace_theme.cssClass) > -1
        };
        var els = $('.editor-primary');
        global.watchTheme(els, true);
    };
    global.clearTheme = function(els) {
        els.each(function() {
            this.className = this.className.split(" ").filter(function(e) {
                return e.indexOf("ace") < 0 && e.indexOf("theme") < 0;
            }).join(" ");
        });
    };
    global.watchTheme = function(els, added) {
        if (!added)
            els.addClass('editor-primary');
        var ev = theme;
        global.clearTheme(els);
        if (appConfig.applicationTheme == "editor") {
            els.addClass(ev.className);
            if (ev.isDark) els.addClass("theme-dark");
            if (ev.isBlack)
                els.addClass("theme-black");
        }
        else {
            if (ev.isDark) {
                els.addClass("app-theme-dark");
                els.addClass("theme-dark");
            }
            else {
                els.addClass("app-theme-light");
            }
        }
    };

    //stateManager
    if (!Env.isWebView)
        State.ensure("noexit", true);
    State.addListener(function(doc, old, dir) {
        if (DocsTab.getOwner(doc)) {
            //can try to reopen previously closed docs
            if (!appConfig.disableBackButtonTabSwitch && DocsTab.hasTab(doc)) {
                if (doc != DocsTab.active)
                    Doc.swapDoc(doc);
                return true;
            }
            return false;
        }
        else {

        }
        switch (doc) {
            case "tabs":
                return true;
            case "noexit":
                Notify.info("<span>Press <b>BACK</b> again to exit.<span>", 1000);
                Doc.tempSave();
                Doc.saveDocs();
                var cancel = State.exit(false);
                setTimeout(function() {
                    cancel();
                    State.ensure("noexit", true);
                    State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : DocsTab.active);
                }, 500);
                return true;
        }
    }, function(state) {
        return (state in ["tabs", "noexit"]) || DocsTab.hasTab(state);
    });

    //viewroot
    var viewRoot = $("#viewroot")[0];
    var Layout = new LinearLayout($(document.body), window.innerHeight, LinearLayout.VERTICAL);
    var Menu = Layout.addChild($("#action_bar"), 50);
    var ViewRoot = Layout.addChild($("#viewroot"), 50, 1);

    Layout.render();
    CharBar.init(Layout);
    global.LayoutCommands = [{
            name: "toggleFullscreen",
            bindKey: "F11",
            exec: function(editor) {
                Menu.toggle();
                global.SplitManager.notifyResize(ViewRoot.$el);
            }
        }, {
            name: "swapTabs",
            bindKey: { win: "Alt-Tab", mac: "Command-Alt-N" },
            exec: swapTab
        },

    ];
    Editors.addCommands(global.LayoutCommands);
    //ClipBoard
    var ClipBoard = global.Clipboard;
    var clipboard = new ClipBoard();

    function initClipBoard() {
        var appStorage = global.appStorage;
        var savedClip = global.getObj('clipboard', []);
        if (savedClip.length) {
            clipboard._clip = savedClip;
        }
        Object.assign(Functions, {
            "copy": function(e) {
                //Update internal clip
                clipboard.set(e.text);
            }
        });
        clipboard.onchange = function(clip) {
            if (clip.length > 20) {
                clip.pop();
            }
            appStorage.setItem('clipboard', JSON.stringify(clip));
        };
        var BottomList = global.BottomList;
        var clipboardList = new BottomList('clipboard-list', clipboard._clip);
        Editors.addCommands([{
            name: "openClipboard",
            bindKey: { win: "Ctrl-Shift-V", mac: "Command-Shift-V" },
            exec: function() {
                clipboardList.show();
            }
        }]);
        clipboardList.on('select', function(text) {
            Functions.copy({ text: text });
            getEditor().insert(text);
            getEditor().renderer.scrollCursorIntoView();
            clipboardList.hide();
        });

        CharBar.setClipboard(clipboard);
        var copyFilePath = {
            caption: 'Copy File Path',
            onclick: function(ev) {
                if (ev.filepath && ev.browser.getParent) {
                    var root = false;
                    var a = ev.browser.getParent();
                    while (a && a.rootDir) {
                        root = a.rootDir;
                        a = a.getParent();
                    }
                    clipboard.text = root ? "./" + FileUtils.relative(root, ev.filepath) : ev.filepath;
                }
                else clipboard.text = ev.filepath || ev.rootDir;
                ev.preventDefault();
            }
        };
        FileUtils.registerOption("files", ["file", "folder"], "copy-file-path", copyFilePath);

    }
    var SidenavLeft, SidenavLeftTab;

    //Default Commands save fullscreen swaptab
    var save = function(e) {
        Doc.tempSave(currentDoc);
        if (docs[currentDoc].isTemp()) {
            FocusManager.hintChangeFocus();
            FileUtils.saveAs(currentDoc);
        }
        else {
            Doc.saveDocs(currentDoc);
        }
    };
    //Overflow menu
    var menuItems = {
        "save": {
            icon: "save",
            caption: "Save",
            close: true,
            onclick: function() {
                save();
            }
        },
        "close": {
            icon: "close",
            caption: "Close Current",
            close: true,
            onclick: function() {
                closeTab(DocsTab.active);
            }
        },
        "close-others": {
            icon: "close",
            caption: "Close Others",
            close: true,
            onclick: function() {
                for (var i in docs) {
                    if (i != DocsTab.active)
                        closeTab(i);
                }
            }
        },
        "tooling": {
            icon: "edit",
            caption: "Edit",
            childHier: {
                "beautify": {
                    caption: "Beautify",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand('beautify');
                    }
                },
                "rename": {
                    caption: "Rename Variable",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("ternRename");
                    }
                }
            }
        },
        "search": {
            icon: "search",
            caption: "Find",
            childHier: {
                "find-in-file": {
                    caption: "Find in File",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("find");
                    }
                },
                "goto-file": {
                    caption: "Goto Line",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("gotoline");
                    }
                },
                "find-refs": {
                    caption: "Find References",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("ternFindRefs");
                    }
                }

            }
        },
        "refresh": {
            icon: "refresh",
            caption: "Refresh file",
            close: true,
            onclick: function() {
                docs[currentDoc].refresh(function(doc) {
                    if (doc && !doc.dirty)
                        Notify.info('refreshed');
                });
            }
        },
        "load-settings": {
            icon: "settings",
            caption: "Edit Settings",
            close: true,
            onclick: function() {
                addDoc(new SettingsDoc());
            }
        }
    };
    var menu = global.MainMenu;
    for (var i in menuItems) {
        menu.addOption(i, menuItems[i]);
    }

    var lastTab;

    function swapTab() {
        if (lastTab < 0)
            return;
        Doc.swapDoc(lastTab);
    }

    global.DocumentCommands = [{
        name: "newFile",
        bindKey: { win: "Ctrl-N", mac: "Command-Alt-N" },
        exec: Functions.newFile
    }, {
        name: 'undoAllChanges',
        exec: function() {
            docs[currentDoc].saveCheckpoint('redo');
            docs[currentDoc].abortChanges();
        }
    }, {
        name: 'redoAllChanges',
        exec: function() {
            docs[currentDoc].redoChanges();
        }
    }, {
        name: 'Save checkpoint',
        exec: function() {
            docs[currentDoc].saveCheckpoint();
        },
    }, {
        name: 'Visit last checkpoint',
        exec: function() {
            docs[currentDoc].gotoCheckpoint();
        }
    }, {
        name: 'Return to current state',
        exec: function() {
            docs[currentDoc].returnFromCheckpoint();
        }
    }, {
        name: "save",
        bindKey: { win: "Ctrl-S", mac: "Command-S" },
        exec: save
    }, {
        name: "saveAs",
        bindKey: { win: "Ctrl-Shift-S", mac: "Command-Shift-S" },
        exec: function(editor) {
            FileUtils.saveAs(currentDoc);
        }
    }];
    Editors.addCommands(global.DocumentCommands);

    //Settings Menu
    var settingsMenu;
    var SettingsPanel;
    appEvents.on('changeEditor', function(ev) {
        var e = ev.editor;
        if (StatusBar) {
            StatusBar.setEditor(e);
            StatusBar.updateStatus(e);
        }

        if (SearchBox) {
            if (SearchBox.active) {
                SearchBox.hide();
                SearchBox.setEditor(e);
                if (SplitManager.hasSplit(e.container)) {
                    viewRoot.appendChild(SearchBox.element);
                }
                SearchBox.show();
            }
            else SearchBox.setEditor(e);
        }
        CharBar.setEditor(e);
        SettingsDoc.setEditor(Editors.getSettingsEditor());
    });

    function updateSettings() {
        SettingsPanel.render();
        //settingsMenu.find('select').formSelect({ dropdownOptions: { height: 300, autoFocus: false } });
        settingsMenu.find('button').addClass('btn btn-group').parent().addClass("btn-group-container");
        global.styleCheckbox(settingsMenu);
    }
    global.styleCheckbox = function(el){
        el = el.find('[type=checkbox]').addClass('checkbox');
        for(var i =0;i<el.length;i++){
            var a = el.eq(i);
            if (!a.next().is("span")) a.after("<span></span>");
        }
        el.next().click(function(e) { $(this).prev().click() });
    };
    //tern
    Functions.switchToDoc = function(name, pos, end, autoload, cb) {
        var c = Doc.forPath(name) || Doc.forPath("/" + name);
        if (!c) {
            var servers = [FileUtils.getProject().fileServer];
            if (docs[currentDoc] && docs[currentDoc].getFileServer() != servers[0]) {
                servers.push(docs[currentDoc].getFileServer());
            }
            var getFile = function() {
                var server = servers.pop();
                if (!server) return;
                Doc.openDoc("/" + name, server, open);
            };
            var open = function(err, doc) {
                if (doc)
                    Functions.switchToDoc(doc.getPath(), pos, end, null, cb);
                else getFile();
            };

            if (autoload) getFile();
            else Notify.ask("Open " + name, getFile);
            return;
        }
        if (!(global.SplitEditors && global.SplitEditors.hasEditor(c))) {
            Doc.swapDoc(c.id);
        }
        State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : c.id);
        var doc = getEditor();
        if (pos) {
            doc.gotoLine(pos.row, pos.column || 0); //this will make sure that the line is expanded
            doc.getSession().unfold(pos); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
            var sel = doc.getSelection();
            sel.setSelectionRange({
                start: pos,
                end: end
            });
        }
        cb && cb();
    };


    function setDoc(id) {
        currentDoc = id;
        if (docs[id]) {
            currentDoc = id;
            if (docs[id] != Doc.forSession(getEditor().session))
                Editors.setSession(docs[id]);
            return true;
        }
        return false;
    }

    function switchTab(id) {
        if (DocsTab.active == id)
            return false;
        lastTab = DocsTab.active;
        //apps can set currentDoc
        //bad approach but it works
        var handled = appEvents.trigger('changeTab', { oldTab: lastTab, tab: id }).defaultPrevented;
        if (!handled) {
            if (!setDoc(id))
                return false;
        }
        DocsTab.active = id;
        State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
        configure("currentDoc", id);
        return true;
    }

    function closeTab(id) {
        var doc = docs[id];
        if ((appEvents.trigger('beforeCloseTab', { id: id, doc: doc })).defaultPrevented)
            return false;
        var e = appEvents.trigger('closeTab', { id: id, doc: doc });
        if (doc && (!(doc.dirty) || confirm(Doc.getName(doc.id) + " has unsaved changes. Close without saving?"))) {
            var rebase = !SidenavLeft._isCurrentlyPush();
            rebase && AutoCloseable.remove(SidenavLeft.id);
            closeDoc(id);
            rebase && AutoCloseable.add(SidenavLeft.id, SidenavLeft);
            return true;
        }
        else return false;
    }

    var currentDoc = appConfig.currentDoc;


    var Grace = {
        get editor() {
            return getEditor();
        },
        get session() {
            return docs[currentDoc].session;
        },
        get fs() {
            return docs[currentDoc].getFileServer();
        },
        get tab() {
            return docs[currentDoc];
        },
        get time() {
            return new Date().getTime();
        },
        get text() {
            return getEditor().getValue();
        },
        insert: function(text) {
            editor.insert(text);
        },
        clipboard: clipboard
    };
    window.Grace = window.G = Grace;
    Object.defineProperties(window, {
        fs: {
            get: function() {
                return docs[currentDoc].getFileServer();
            }
        },
        doc: {
            get: function() {
                return docs[currentDoc];
            }
        },
        editor: {
            get: getEditor
        },
        clipboard: {
            value: clipboard
        }
    });
    var BootList = new global.BootList(function() {
        BootList = null;
        appEvents.trigger('fully-loaded');
    });

    function bootEditor() {
        initClipBoard();
        DocsTab = new DocumentTab($("#menu"), $("#opendocs"), $("#status-filename"));
        DocsTab.$hintActiveDoc = setDoc;

        FocusManager.trap($("#menu"), true);
        DocsTab.setSingleTabs(appConfig.singleTabLayout);
        DocsTab.afterClick = switchTab;
        DocsTab.onClose = closeTab;
        global.DocsTab = DocsTab;
        SidenavLeftTab = new PagerTab($("#selector"), $("#side-menu"));
        SidenavLeftTab.beforeClick = function(newel, oldel) {
            if (newel.attr("href") === "#settings")
                updateSettings();
        };
        $(".toggleBelow").click(function(e) {
            e.stopPropagation();
            if ($(this).next().css("display") == "none") {
                $(this).next().show();
                $(this).children(".material-icons").text("keyboard_arrow_up");
            }
            else {
                $(this).next().hide();
                $(this).children(".material-icons").text("keyboard_arrow_down");
            }
        });
        SidenavLeft = new Sidenav($('#side-menu'), {
            draggable: true,
            edge: 'left',
            pushElements: true,
            onOpenStart: function() {
                this.el.style.visibility = 'visible';
                if (window.innerWidth < 992) {
                    //SidenavRight.close();
                }
            },
            onOpenEnd: function() {
                if (SidenavLeftTab.getActiveTab().attr('href') == "#settings")
                    setTimeout(updateSettings, 1);
                if (!SidenavLeft._isCurrentlyPush()) {
                    AutoCloseable.add(this.id, SidenavLeft);
                    this.options.draggable = false;
                }
            },
            onCloseStart: function() {
                if (FileUtils.activeFileBrowser) {
                    FileUtils.activeFileBrowser.menu.hide();
                }
            },
            onCloseEnd: function() {
                this.el.style.visibility = 'hidden';
                if (!SidenavLeft._isCurrentlyPush())
                    AutoCloseable.close(this.id);
                this.options.draggable = true;
                FileUtils.exitSaveMode();
            }
        });

        //Tabs
        Doc.initialize(DocsTab);
        if (Doc.numDocs() < 1) {
            var doc = new Doc('Welcome to Grace Editor');
            addDoc(doc, "", "", "", null, false);
        }
        var oldCurrentDoc, href;
        if ((href = window.location.href.indexOf("#m")) >= 0) {
            currentDoc = window.location.href.substring(href + 2);
        }
        if (!docs[currentDoc]) {
            oldCurrentDoc = currentDoc;
            currentDoc = Object.keys(docs)[0];
        }

        Editors.init();
        var editor = Editors.createEditor(viewRoot);
        Editors.setEditor(editor);
        DocsTab.setActive(currentDoc, true, true);
        //this will allow later calls to recreate
        //get correct tab
        if (oldCurrentDoc) {
            configure("currentDoc", oldCurrentDoc);
        }
        window.Grace.loaded = true;
        FileUtils.loadServers();
        Doc.refreshDocs();
        BootList.next();
        appEvents.triggerForever('app-loaded');
    }

    //FileBrowsers
    BootList.push({
        script: "./libs/js/touchhold.js",
        ignoreIf: true //use native contextmenu
    }, {
        script: "./ui/recycler.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser
    }, {
        script: "./views/fileBrowser.js",
    }, {
        script: "./views/recyclerBrowser.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser
    }, {
        name: "Creating File Browsers",
        func: function() {
            //FileBrowsers
            appEvents.triggerForever('filebrowsers');
            var FileBrowser = global.FileBrowser;
            if (!appConfig.disableOptimizedFileBrowser) {
                global.FileBrowser = global.RFileBrowser;
            }

            FileUtils.initialize(SidenavLeft, SidenavLeftTab);
            //_fileBrowsers.push(new FileBrowser("file-browser", "/data/data/com.tmstudios.shunt/"))
            var Hierarchy = global.RHierarchy || global.Hierarchy;

            var _hierarchy = new Hierarchy("hierarchy", "");
            FileUtils.ownChannel("project", _hierarchy, "files");
            _hierarchy.fileServer = FileUtils.getProject().fileServer;
            _hierarchy.setRootDir(FileUtils.getProject().rootDir);
            _hierarchy.rename(_hierarchy.hier[0], FileUtils.getProject().name);
            FileUtils.addBrowser(_hierarchy);
            FileUtils.on("change-project", function(e) {
                _hierarchy.fileServer = e.project.fileServer;
                _hierarchy.setRootDir(e.project.rootDir);
                _hierarchy.rename(_hierarchy.hier[0], e.project.name);
            });
            //move this to header?
            //File finding
            function stopFind() {
                if ($("#find_file_cancel_btn").text() == 'stop') {
                    _hierarchy.stopFind();
                    $("#find_file_cancel_btn").text('refresh');
                }
                else {
                    _hierarchy.cancelFind();
                }
            }

            function doFind() {
                $("#search_text").val() && _hierarchy.findFile($("#search_text").val(), null, function() {
                    $("#find_file_cancel_btn").text('refresh');
                });
                $("#find_file_cancel_btn").text('stop');
            }
            $("#find_file_btn").click(doFind);
            $("#search_text").change(doFind);
            $("#find_file_cancel_btn").click(stopFind);
        }
    });

    BootList.push({
        name: "Custom Keybindings",
        func: function() {
            global.restoreBindings(getEditor());
        }
    });

    //runManager
    BootList.push({
        script: "./libs/js/splits.js"
    }, {
        script: "./ui/splits.js"
    }, {
        script: "./preview/previewer.js"
    }, {
        name: "Creating run manager",
        script: "./preview/modes.js"
    }, {
        func: function() {
            $("#runButton").click(Functions.run);
        }
    });
    BootList.push({
        name: "Swipe And Drag",
        script: "./libs/js/mobile-drag.js"
    }, {
        script: "./libs/js/drag-tabs.js",
    }, {
        script: "./libs/js/hammer.min.js",
        ignoreIf: false //not quite there yet
    }, {
        script: "./libs/js/scroll-behaviour.js"
    }, {
        func: function() {
            var swipeDetector = new Hammer($("#side-menu")[0], {
                inputClass: Hammer.TouchMouseInput,
                recognizers: [
                    [Hammer.Swipe, { threshold: 3.0, direction: Hammer.DIRECTION_HORIZONTAL }]
                ]
            });
            swipeDetector.on('hammer.input', function(ev) {
                if (ev.isFirst) {
                    var fileview = $(ev.target).closest('.fileview');
                    if (fileview[0] && (" " + fileview[0].parentElement.className + " ").indexOf(" fileview ") > -1) {
                        swipeDetector.stop();
                    }
                }
            });
            swipeDetector.on('swipeleft', function(ev) {
                SidenavLeftTab.goleft();
            });
            swipeDetector.on('swiperight', function(ev) {
                SidenavLeftTab.goright();
            });
            window.MobileDragDrop.polyfill({
                holdToDrag: 700,
                noDebug: true,
                tryFindDraggableTarget: function(event) {
                    var el = event.target;
                    do {
                        if (el.getAttribute &&
                            el.getAttribute("draggable") === "true") {
                            return el;
                        }
                    } while ((el = el.parentNode) && el !== document.body);
                },
                dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride
            });
            var dragger = new global.DragTabs($("#menu")[0], {
                selectors: {
                    tab: ".tab"
                }
            });

            dragger.on('end', function(e) {
                if (e.newIndex !== undefined) {
                    DocsTab.moveTab(e.newIndex, e.dragTab.getAttribute('data-file'));
                }
            });
            /*dragger.on('drag', function(e) {
                //show drag intent
            });*/
            var listDragger = new global.DragList($("#opendocs")[0], {
                selectors: {
                    tab: ".file-item"
                }
            });
            listDragger.on('drag', function(e) {
                if (e.newIndex !== undefined) {
                    DocsTab.moveTab(e.newIndex, e.dragTab.getAttribute('data-file'));
                }
            });
        }
    });
    var SearchBox;
    var StatusBar;
    //StatusBar SearchBox
    BootList.push({
        name: 'SearchBox and Status',
        func: function() {
            var getEditor = global.getEditor;
            ace.config.loadModule("ace/ext/statusbar", function(module) {
                var Statusbar = module.StatusBar;
                StatusBar = StatusBar || new Statusbar(getEditor(), $("#status-text")[0]);
            });

            ace.config.loadModule("ace/ext/searchbox", function(e) {
                if (SearchBox) return;
                var Searchbox = e.SearchBox;
                SearchBox = new Searchbox(getEditor());
                SearchBox.element.style.display = 'none';
            });
        }
    });

    //Split Editors
    BootList.push({
        script: "./editor/splitEditors.js",
    }, {
        name: "Split Editors",
        func: function() {
            global.SplitEditors.init();
        }
    });

    //Settings Menu
    BootList.push({
        script: "./src-min-noconflict/ext-options.js"
    }, {
        script: "./prefs/settings-menu.js"
    }, {
        name: "Create Settings Menu",
        func: function() {
            settingsMenu = $("#settings");
            SettingsPanel = global.createSettingsMenu(settingsMenu);
        }
    });
    var searchConfig = global.registerAll({
        "useRecyclerViewForSearchResults": true
    }, "search");
    //SearchPanel
    BootList.push({
        script: "./ui/recycler.js",
        ignoreIf: !(appConfig.disableOptimizedFileBrowser && searchConfig.useRecyclerViewForSearchResults)
    }, {
        script: "./libs/js/brace-expansion.js"
    }, {
        script: "./search/overlayMode.js"
    }, {
        script: "./search/rangeRenderer.js"
    }, {
        script: "./search/searchTree.js"
    }, {
        script: "./views/searchTab.js"
    }, {
        name: "Creating Search Panel",
        func: function() {
            var getEditor = global.getEditor;
            var SearchPanel = new global.SearchTab($("#search_container"), $("#searchModal"));
            SearchPanel.init(SidenavLeft);
        }
    });
    BootList.push({
        name: "Material Colors",
        style: "./libs/css/material-colors.css"
    });
    //DiffTooling
    BootList.push({
        name: "Diff Tooling",
        script: "./tools/diff.js"
    });
    BootList.push({
        name: "Missing colons",
        script: "./tools/fix_colons.js"
    });
    $(document).ready(bootEditor);
})(Modules);