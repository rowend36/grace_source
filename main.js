_Define(function(global) {
    "use strict";
    var Doc = global.Doc;
    var setBreakpoint = global.Recovery.setBreakpoint;
    var clearBreakpoint = global.Recovery.removeBreakpoint;
    var State = global.State;
    var AutoCloseable = global.AutoCloseable;
    var LinearLayout = global.LinearLayout;
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
    var setDoc = global.setDoc;
    var getActiveDoc = global.getActiveDoc;
    var Notify = global.Notify;
    var FocusManager = global.FocusManager;
    var MainMenu = global.MainMenu;
    var CharBar = global.CharBar;
    var DocumentTab = global.DocumentTab;
    var appEvents = global.AppEvents;
    var Navigation = global.Navigation;
    global.registerAll({
        "currentTab": null,
        'disableOptimizedFileBrowser': false,
        "disableBackButtonTabSwitch": false,
        "backButtonDelay": "700ms",
        "enableFloatingRunButton": 'auto',
        "enableSplits": true,
        'autoHideTabs': window.innerHeight<500,
        "enableKeyboardNavigation": Env.isDesktop,
        "enableGit": true,
        "inactiveFileDelay": "10s",
    });
    global.registerValues({
        "currentTab": "no-user-config",
        "enableFloatingRunButton": "Values: true,'small','center','auto',false"
    });
    var DocsTab;
    setBreakpoint("start-app", function(id, e) {
        Notify.error("Error During Previous Load!!! Contact Developer");
    });
    appEvents.once('app-loaded', function() {
        clearBreakpoint('start-app');
    });

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
        } else {

        }
        switch (doc) {
            case "tabs":
                return true;
            case "noexit":
                var delay = Utils.parseTime(appConfig.backButtonDelay);
                Notify.info("<span>Press <b>BACK</b> again to exit.<span>", delay);
                appEvents.trigger("app-paused");
                var cancel = State.exit(false);
                setTimeout(function() {
                    appEvents.trigger("app-resumed");
                    cancel();
                    State.ensure("noexit", true);
                    State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : DocsTab.active);
                }, delay * 0.7);
                return true;
        }
    }, function(state) {
        return (state in ["tabs", "noexit"]) || DocsTab.hasTab(state);
    });

    var lastTab;

    function swapTab() {
        if (lastTab < 0)
            return;
        Doc.swapDoc(lastTab);
    }

    var viewRoot, SidenavLeft, Menu;
    global.LayoutCommands = [{
            name: "toggleFullscreen",
            bindKey: "F11",
            exec: function(editor) {
                Menu.toggle();
                Menu.$forcedOpen = !Menu.hidden;
            }
        }, {
            name: "swapTabs",
            bindKey: {
                win: "Alt-Tab",
                mac: "Command-Alt-N"
            },
            exec: swapTab
        },

    ];
    Editors.addCommands(global.LayoutCommands);

    MainMenu.addOption("close", {
        icon: "close",
        caption: "Close",
        childHier: {
            "close-current": {
                icon: "close",
                caption: "Close current tab",
                close: true,
                onclick: function() {
                    closeTab(global.DocsTab.active);
                }
            },
            "close-others": {
                icon: "close",
                caption: "Close all other tabs",
                close: true,
                onclick: function() {
                    var tab = global.DocsTab;
                    for (var i = tab.tabs.length; i-- > 0;) {
                        if (tab.tabs[i] != global.DocsTab.active) {
                            closeTab(tab.tabs[i]);
                        }
                    }
                }
            },
            "close-all": {
                icon: "clear_all",
                caption: "Close all tabs",
                close: true,
                onclick: function() {
                    var tab = global.DocsTab;
                    for (var i = tab.tabs.length; i-- > 0;) {
                        closeTab(tab.tabs[i]);
                    }
                }
            },
            "close-inactive": {
                icon: "timelapse",
                caption: "Close inactive tabs",
                close: true,
                onclick: function() {
                    var inactiveTime = new Date().getTime() - Utils.parseTime(appConfig.inactiveFileDelay);
                    Utils.asyncForEach(global.DocsTab.tabs.slice(0), function(e, i, n) {
                        n();
                        if (e == global.DocsTab.active || !docs[e] || docs[e].dirty || docs[e].isTemp()) return;
                        docs[e].getFileServer().stat(docs[e].getSavePath(), function(err, s) {
                            if (s && s.mtimeMs < inactiveTime && s.size === docs[e].getSize()) {
                                closeTab(e);
                            }
                        });
                    });
                }
            }
        }
    });


    //ClipBoard
    var ClipBoard = global.Clipboard;
    var clipboard = new ClipBoard();

    (function() {
        var appStorage = global.appStorage;
        var savedClip = global.getObj('clipboard', []);
        if (savedClip.length) {
            clipboard._clip = savedClip;
        }
        var copyTextEl;
        if (!Env.setClipboard) {
            var setClipExec = function(text, callback) {
                if (!copyTextEl) {
                    copyTextEl = document.createElement('textarea');
                    document.body.appendChild(copyTextEl);
                } else copyTextEl.style.display = 'block';
                copyTextEl.value = text;
                copyTextEl.selectionStart = 0;
                copyTextEl.selectionEnd = text.length;
                copyTextEl.style.display = 'none';
                var release = FocusManager.visit(copyTextEl, true);
                var result = document.execCommand("copy") ? undefined : {
                    code: 'EUNKNOWN',
                    message: 'Failed to write clipboard'
                };
                release();
                callback && callback(result);
            };
            var getClipExec = function(callback) {
                if (!copyTextEl) {
                    copyTextEl = document.createElement('textarea');
                    document.body.appendChild(copyTextEl);
                } else copyTextEl.style.display = 'block';
                var prev = FocusManager.activeElement;
                var release = FocusManager.visit(copyTextEl, true);
                copyTextEl.focus();
                copyTextEl.value = "";
                copyTextEl.style.display = 'none';
                var result = document.execCommand("paste") ? undefined : {
                    code: 'EUNKNOWN',
                    message: 'Failed to write clipboard'
                };
                release();
                callback(result, copyTextEl.value);
            };
            if (window.navigator && navigator.clipboard) {
                var readClip = function(callback) {
                    navigator.clipboard.readText().then(function(text) {
                        callback(undefined, text);
                    }).catch(callback);
                };
                var writeClip = function(text, callback) {
                    navigator.clipboard.writeText().then(function() {
                        callback();
                    }).catch(callback);
                };
                var failCount = 0;
                Env.getClipboard = function(callback) {
                    var passed;
                    readClip(function(e, r) {
                        if (e) {
                            if (failCount++ > e.message.indexOf('denied') > 0) {
                                Env.getClipboard = getClipExec;
                            }
                            if (passed === false) callback(e, r);
                            else passed = false;
                        } else {
                            Env.getClipboard = readClip;
                            if (!passed) {
                                passed = true;
                                callback(e, r);
                            }
                        }
                    });
                    getClipExec(function(e, r) {
                        if (!e && r) {
                            if (!passed) {
                                passed = true;
                                callback(e, r);
                            }
                        } else if (passed === false) callback(e, r);
                        else passed = false;
                    });
                };
                Env.setClipboard = function(text, callback) {
                    var passed;
                    callback = callback || Utils.noop;
                    writeClip(text, function(e, r) {
                        if (e) {
                            if (failCount++ > 3 || e.message.indexOf('denied') > 0) {
                                Env.setClipboard = setClipExec;
                            }
                            if (passed === false) callback(e, r);
                            else passed = false;
                        } else {
                            Env.setClipboard = writeClip;
                            if (!passed) {
                                callback(e, r);
                                passed = true;
                            }
                        }
                    });
                    setClipExec(text, function(e, r) {
                        if (!e && r) {
                            if (!passed) {
                                passed = true;
                                callback(e, r);
                            }
                        } else if (passed === false) callback(e, r);
                        else passed = false;
                    });
                };
            } else {
                Env.setClipboard = setClipExec;
                Env.getClipboard = getClipExec;
            }
        }
        //todo expose clipboard directly
        Object.assign(Functions, {
            "copy": function(e, editor) {
                clipboard.set(e.text, true);
            }
        });
        clipboard.onchange = Utils.throttle(function(clip) {
            while (clip.length > 20) {
                clip.pop();
            }
            appStorage.setItem('clipboard', JSON.stringify(clip));
        }, 40);
        var BottomList = global.BottomList;
        var clipboardList = new BottomList('clipboard-list', clipboard._clip);
        Editors.addCommands([{
            name: "openClipboard",
            bindKey: {
                win: "Ctrl-Shift-V",
                mac: "Command-Shift-V"
            },
            exec: function() {
                clipboardList.show();
            }
        }]);
        clipboardList.on('select', function(ev) {
            //remove pasted index
            if (ev.index && clipboard.get(ev.index) == ev.item) {
                clipboard.delete(ev.index);
            }
            Functions.copy({
                text: ev.item
            });
            getEditor().execCommand("paste", ev.item);
            clipboardList.hide();
        });

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
                } else clipboard.text = ev.filepath || ev.rootDir;
                ev.preventDefault();
            }
        };
        FileUtils.registerOption("files", ["file", "folder"], "copy-file-path", copyFilePath);

    })();
    SettingsDoc.setEditor(Editors.getSettingsEditor());


    function switchTab(id) {
        if (DocsTab.active == id)
            return false;
        lastTab = DocsTab.active;
        //apps can set active Doc
        var handled = appEvents.trigger('changeTab', {
            oldTab: lastTab,
            tab: id
        }).defaultPrevented;
        if (!handled) {
            if (!setDoc(id))
                return false;
        }
        DocsTab.active = id;
        State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
        configure("currentTab", id);
        return true;
    }

    function closeTab(id, force) {
        var doc = docs[id];
        if ((appEvents.trigger('beforeCloseTab', {
                id: id,
                doc: doc
            })).defaultPrevented)
            return false;
        var e = appEvents.trigger('closeTab', {
            id: id,
            doc: doc
        });

        function close() {
            var rebase = SidenavLeft.isOpen && SidenavLeft.isOverlay;
            rebase && AutoCloseable.remove(SidenavLeft.id);
            closeDoc(id);
            rebase && AutoCloseable.add(SidenavLeft.id, SidenavLeft);
        }
        if (!doc) return false;
        if (doc.dirty) {
            Notify.ask(Doc.getName(doc.id) + " has unsaved changes. Close without saving?", function() {
                close();
            });
            return false;
        } else {
            close();
            return false;
        }
    }


    Object.defineProperties(window, {
        fs: {
            get: function() {
                return getActiveDoc().getFileServer();
            }
        },
        doc: {
            get: getActiveDoc
        },
        editor: {
            get: getEditor
        },
        Clip: {
            value: clipboard
        },
        gUtils: {
            value: Utils
        },
        fUtils: {
            value: FileUtils
        }
    });

    function bootEditor() {
        //viewroot
        viewRoot = $("#viewroot")[0];
        var Layout = new LinearLayout($(document.body), window.innerHeight, LinearLayout.VERTICAL);
        Menu = Layout.addChild($("#action_bar"), 56);

        var ViewRoot = Layout.addChild($("#viewroot"), 0, 1);
        var margins = {
            marginTop: 0,
            marginBottom: 0
        };
        ace.Editor.prototype.getPopupMargins = function(isDoc) {
            return isDoc ? {
                marginTop: 0,
                marginBottom: margins.marginBottom
            } : margins;
        }
        Layout.onRender = function() {
            appEvents.trigger("view-change");
            margins.marginTop = parseInt(viewRoot.style.top);
            margins.marginBottom = parseInt(viewRoot.style.bottom) + 50;
        }
        MainMenu.createTrigger($('#action_bar .dropdown-trigger')[0]);
        if (window.innerHeight < 105) {
            var update = function() {
                if (update) {
                    if (window.innerHeight > 105) {
                        window.removeEventListener('resize', update);
                    }
                    update = null;
                }
                Layout.render();
            };
            window.addEventListener('resize', update);
        }
        CharBar.init(Layout);
        CharBar.setClipboard(clipboard);
        appEvents.on('changeEditor', function(e) {
            CharBar.setEditor(e.editor);
        });
        Layout.render();
        if (appConfig.enableKeyboardNavigation)
            Navigation.attach();
        var AutoComplete = global.Autocomplete;
        var doBlur = AutoComplete.prototype.blurListener;
        AutoComplete.prototype.blurListener = function() {
            if (FocusManager.activeElement == editor.textInput.getElement())
                return;
            doBlur.apply(this, arguments);
        };
        appEvents.on("keyboard-change", function(ev) {
            if (ev.isTrusted) {
                if (!ev.visible) {
                    var a = AutoComplete.for(getEditor());
                    if (a.activated)
                        a.detach();
                } else {
                    if(appConfig.autoHideTabs && !Menu.$forcedOpen)
                        Menu.hide();
                    document.body.classList.add('virtual-keyboard-visible');
                }
            }
            if (!ev.visible) {
                if(appConfig.autoHideTabs)
                    Menu.show();
                document.body.classList.remove('virtual-keyboard-visible');
            }
        });
        DocsTab = new DocumentTab($("#menu"), $("#opendocs"), $("#status-filename"));
        DocsTab.$hintActiveDoc = setDoc;

        FocusManager.trap($("#menu"), true);
        DocsTab.setSingleTabs(appConfig.singleTabLayout);
        DocsTab.afterClick = switchTab;
        DocsTab.onClose = closeTab;
        var SidenavLeftTab = new PagerTab($("#selector"), $("#side-menu"));

        $(".toggleBelow").click(function(e) {
            e.stopPropagation();
            if ($(this).next().css("display") == "none") {
                $(this).next().show();
                $(this).children(".material-icons").text("keyboard_arrow_up");
            } else {
                $(this).next().hide();
                $(this).children(".material-icons").text("keyboard_arrow_down");
            }
        });
        //uodate currently push on openstart or dragstart
        var refocus = false;
        SidenavLeft = new Sidenav($('#side-menu'), {
            draggable: true,
            edge: 'left',
            minWidthPush: 400,
            pushElements: true, //we'll need to scope things to view root first
            onOpenStart: function() {
                FocusManager.hintChangeFocus();
                /*if (window.innerWidth < 992) {
                    SidenavRight.close();
                }*/
            },
            onOpenEnd: function() {
                if (SidenavLeftTab.getActiveTab().attr('href') == "#settings")
                    SidenavLeftTab.update("#settings");
                if (SidenavLeft.isOverlay) {
                    Navigation.addRoot(SidenavLeft.el, SidenavLeft.close.bind(SidenavLeft));
                    if (!Env.isDesktop) {
                        refocus = FocusManager.keyboardVisible && FocusManager.activeElement;
                        if (refocus) refocus.blur();
                    }
                    AutoCloseable.add(this.id, SidenavLeft);
                }
                FileUtils.trigger('sidenav-open');
            },
            onCloseStart: function() {
                if (FileUtils.activeFileBrowser) {
                    FileUtils.activeFileBrowser.menu.hide();
                }
            },
            onCloseEnd: function() {
                if (SidenavLeft.isOverlay) {
                    Navigation.removeRoot(SidenavLeft.el);
                    AutoCloseable.close(this.id);
                }
                FileUtils.exitSaveMode();
                refocus && FocusManager.focusIfKeyboard(refocus, false, true);
            }
        });
        $(".sidenav-trigger").click(SidenavLeft.toggle.bind(SidenavLeft));
        //Tabs
        global.DocsTab = DocsTab;
        global.SideView = SidenavLeft;
        global.SideViewTabs = SidenavLeftTab;
        global.viewRoot = viewRoot;
        var currentTab = appConfig.currentTab;
        var oldCurrentTab, href;
        if ((href = window.location.href.indexOf("#m")) >= 0) {
            currentTab = window.location.href.substring(href + 2);
        }
        //Docs
        Doc.initialize(DocsTab, currentTab);
        var newDoc;
        if (Doc.numDocs() < 1) {
            newDoc = new Doc('Welcome to Grace Editor');
            addDoc(newDoc, "", "", "", null, false);
        }
        if (!docs[currentTab]) {
            oldCurrentTab = currentTab;
            currentTab = Object.keys(docs)[0];
        }

        //Editor
        Editors.init();
        var editor = Editors.createEditor(viewRoot);
        Editors.setEditor(editor);

        //Loaded
        DocsTab.setActive(currentTab, true, true);

        if (oldCurrentTab) {
            configure("currentTab", oldCurrentTab);
        }
        appEvents.triggerForever('app-loaded');
        appEvents.on("documents-loaded", function() {
            FileUtils.loadServers();
            if (newDoc && Doc.numDocs() > 1) {
                if (newDoc.getValue() == 'Welcome to Grace Editor') {
                    if (newDoc.getRevision() === 0) {
                        closeDoc(newDoc.id);
                    }
                }
            }
            Doc.refreshDocs();
        });
    }
    $(document).ready(bootEditor);
}); /*_EndDefine*/
_Define(function(global) {
    /*Theming*/
    "use strict";
    var configEvents = global.configEvents;
    var appEvents = global.AppEvents;
    var appConfig = global.registerAll({
        "applicationTheme": "editor",
        "appFontSize": "medium",
        "singleTabLayout": false,
    });
    global.registerValues({
        "applicationTheme": "editor ,classic (needs reload)",
        "appFontSize": "Font size for UI - small|medium|big",
        "inactiveFileDelay": "How long after saving is necessary for a file\n to be considered inactive for 'Close inactive tabs' menu option"
    });

    function onChange(ev) {
        switch (ev.config) {
            case 'applicationTheme':
                updateTheme($('.editor-primary'), true);
                break;
            case 'appFontSize':
                switch (ev.newValue) {
                    case 'small':
                    case 'medium':
                    case 'big':
                        clearClass($(document.body.parentElement), /font$/);
                        document.body.parentElement.className += " " + ev.newValue + "font";
                        break;
                    default:
                        ev.preventDefault();
                }
                break;
            case 'singleTabLayout':
                global.DocsTab.setSingleTabs(ev.newValue);
                break;
        }
    }
    configEvents.on("application", onChange);
    //App Theming
    appEvents.once('app-loaded', function() {
        document.body.parentElement.className += " " + appConfig.appFontSize + "font";
        $('.splash-screen').fadeOut();
        setTimeout(function() {
            $('.splash-screen').detach();
        }, 700);
    });
    var themeBlack = ["ace-tomorrow-night-bright", "ace-terminal-theme"];
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
        updateTheme(els, true);
    };

    function clearClass(els, regex) {
        els.each(function() {
            this.className = this.className.split(" ").filter(function(e) {
                return !regex.test(e);
            }).join(" ");
        });
    }

    function updateTheme(els, added) {
        if (!added)
            els.addClass('editor-primary');
        var ev = theme;
        clearClass(els, /theme|^ace/);
        if (ev.isDark) {
            if (appConfig.applicationTheme == "editor") {
                els.addClass(ev.className);
                els.addClass("theme-dark");
                if (ev.isBlack)
                    els.addClass("theme-black");

            } else {
                els.addClass("app-theme-dark");
                els.addClass("theme-dark");
            }
        } else {
            els.addClass("app-theme-light");
        }
    }
    global.styleCheckbox = function(el) {
        el = el.find('[type=checkbox]').addClass('checkbox');
        for (var i = 0; i < el.length; i++) {
            var a = el.eq(i);
            if (!a.next().is("span")) a.after("<span></span>");
        }
        el.next().click(function(e) {
            $(this).prev().click();
            e.stopPropagation();
            e.preventDefault();
        });
    };
    global.watchTheme = updateTheme;
});
_Define(function(global) {
    "use strict";
    var appEvents = global.AppEvents;
    var appConfig = global.appConfig;
    var Functions = global.Functions;
    var Utils = global.Utils;
    var getEditor = global.getEditor;
    var BootList = new global.BootList(function() {
        BootList = null;
        appEvents.triggerForever('fully-loaded');
    });
    appEvents.on("documents-loaded", BootList.next);
    //material colors
    BootList.push({
        name: "Material Colors",
        style: "./libs/css/materialize-colors.css"
    });
    BootList.push({
        name: "Inbuilt Fonts",
        func: function() {
            var fonts = [
                "Courier Prime",
                "Hack",
                "JetBrains Mono",
                "Roboto Mono",
                "Source Code Pro",
                "Ubuntu Mono",
                {
                    name: "Fira Code",
                    types: ["Regular", "Bold"],
                    formats: ["woff", "woff2", "ttf"]
                },
                {
                    name: "Inconsolata",
                    types: ["Regular", "Bold"]
                },
                {
                    name: "Nova Mono",
                    types: ["Regular"]
                },
                {
                    name: "PT Mono",
                    types: ["Regular"]
                },
            ];
            /*var Default = {
                types: ['Regular', 'Bold', 'Italic', 'BoldItalic'],
                formats: ['ttf']
            };
            var template =
                "@font-face {\
font-family: $NAME;\
src: $SRC\
font-weight: $WEIGHT;\
font-style: $STYLE;\
}";
            var weights = {
                "Bold": 'bold',
                "Regular": 'normal',
                "Italic": 'normal',
                "BoldItalic": 'bold'
            };
            var url = "url(\"$PATH.$EXT\") format(\"$FORMAT\")";
            var cssText = fonts.map(function(e) {
                if (typeof e == 'string') {
                    Default.name = e;
                    e = Default;
                } else if (!e.formats) {
                    e.formats = Default.formats;
                }
                var name = "\"" + e.name + "\"";
                var condensed = "./libs/fonts/"+e.name.replace(/ /g,"_")+"/"+e.name.replace(/ /g,"");
                return e.types.map(function(type) {
                    var style = type.indexOf('Italic')<0?'normal':'italic';
                    var weight = weights[type];
                    var path = condensed+"-"+type;
                    var src = e.formats.map(function(ext) {
                        return url.replace("$EXT",ext).replace("$PATH",path).replace("$FORMAT",ext=='ttf'?'truetype':ext);
                    }).join(", ")+";";
                    return template.replace("$SRC",src)
                        .replace("$WEIGHT",weight)
                        .replace("$STYLE",style)
                        .replace("$NAME",name);
                }).join("\n");
            }).join("\n");
            var styleEl = document.createElement('style');
            styleEl.innerHTML = cssText;
            document.head.appendChild(styleEl);*/
            global.registerValues({
                "fontFamily": "Font used by the editor and search results\n" +
                    "Inbuilt fonts include " + fonts.map(function(e) {
                        return e.name || e
                    }).join(", ") + " as well as any System fonts.\n" +
                    "Warning: If using system fonts, ensure they are monospace fonts to avoid view artifacts"
            });
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
            var button = $("#runButton");
            var enable = appConfig.enableFloatingRunButton;
            if (enable) {
                button.click(Functions.run);
                switch (enable) {
                    case 'center':
                        button.addClass('centerV');
                        break;
                    case 'small':
                        button.removeClass('btn-large');
                        break;
                    case 'auto':
                        var visible = true;
                        var hide = Utils.delay(function() {
                            button.hide();
                        }, 400);
                        var update = function(ev) {
                            if (ev.visible) {
                                if (visible && ev.isTrusted) {
                                    button.stop().animate({
                                        right: -20,
                                        opacity: 0
                                    }, 400, hide);
                                    visible = false;
                                }
                            } else if (!visible) {
                                hide.cancel();
                                button.stop().show().animate({
                                    right: 20,
                                    opacity: 0.5
                                }, 300);
                                visible = true;
                            }
                        };
                        appEvents.on("keyboard-change", update);
                }
            } else {
                button.detach();
            }
        }
    });

    BootList.push("./libs/css/completion.css", "./autocompletion/ui.js", "./autocompletion/base_server.js", {
        name: "Tags",
        script: "./autocompletion/tags/tags.js"
    }, {
        script: "./autocompletion/loader.js"
    }, {
        name: "AutoCompletion",
        script: "./autocompletion/manager.js"
    });


    //StatusBar SearchBox
    BootList.push({
        name: 'SearchBox and Status',
        /*Isolated*/ //Looks awful on small splits
        func: function() {
            var getEditor = global.getEditor;
            var viewRoot = global.viewRoot;
            ace.config.loadModule("ace/ext/searchbox", function(e) {
                var Searchbox = e.SearchBox;
                var SearchBox = getEditor().searchBox || new Searchbox(getEditor());
                // position(SearchBox.element);
                ace.config.loadModule("ace/ext/statusbar", function(module) {
                    var Statusbar = module.StatusBar;
                    var StatusBar = StatusBar || new Statusbar(getEditor(), $("#status-text")[0]);
                    if (SearchBox.editor != getEditor()) {
                        SearchBox.setEditor(e);
                        // position(SearchBox.element);
                    }
                    appEvents.on('changeEditor', (function(SearchBox, StatusBar) {
                        return function(ev) {
                            var e = ev.editor;
                            StatusBar.setEditor(e);
                            StatusBar.updateStatus(e);
                            SearchBox.setEditor(e);
                            // position(SearchBox.element);
                        };
                    })(SearchBox, StatusBar));
                });
            });
        }
    });


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
            var FileUtils = global.FileUtils;
            //FileBrowsers
            appEvents.triggerForever('filebrowsers');
            var FileBrowser = global.FileBrowser;
            if (!appConfig.disableOptimizedFileBrowser) {
                global.FileBrowser = global.RFileBrowser;
            }
            FileUtils.initialize(global.SideView, global.SideViewTabs);
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
                } else {
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


    //swiping
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
            var SidenavTabs = global.SideViewTabs;
            var DocsTab = global.DocsTab;
            var swipeDetector = new Hammer($("#side-menu")[0], {
                inputClass: Hammer.TouchMouseInput,
                recognizers: [
                    [Hammer.Swipe, {
                        threshold: 3.0,
                        direction: Hammer.DIRECTION_HORIZONTAL
                    }]
                ]
            });
            var unChecked = false;
            swipeDetector.on('hammer.input', function(ev) {
                if (ev.isFirst) unChecked = true;
                if (unChecked) {
                    var el = ev.target;
                    var style;
                    if (ev.velocityX < -0.5) {
                        do {
                            style = window.getComputedStyle(el);
                            if ((style.overflow == 'scroll' ||
                                    style.overflow == 'auto' ||
                                    style.overflowX == 'scroll' ||
                                    style.overflowX == 'auto') && el.scrollWidth - el.scrollLeft > el.offsetWidth) {
                                return swipeDetector.stop();
                            }
                            el = el.parentElement;
                        } while (el);
                        unChecked = false;
                    } else if (ev.velocityX > 0.5) {
                        do {
                            style = window.getComputedStyle(el);
                            if ((style.overflow == 'scroll' ||
                                    style.overflow == 'auto' ||
                                    style.overflowX == 'scroll' ||
                                    style.overflowX == 'auto') && el.scrollLeft > 0) {
                                return swipeDetector.stop();
                            }
                            el = el.parentElement;
                        } while (el);
                        unChecked = false;
                    }
                }
            });
            swipeDetector.on('swipeleft', function(ev) {
                SidenavTabs.goleft();
            });
            swipeDetector.on('swiperight', function(ev) {
                SidenavTabs.goright();
            });
            window.MobileDragDrop.polyfill({
                holdToDrag: 650,
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

    //Split Editors
    BootList.push({
        script: "./editor/splitEditors.js",
        ignoreIf: !appConfig.enableSplits
    }, {
        name: "Split Editors",
        func: function() {
            global.SplitEditors && global.SplitEditors.init();
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
            var settingsMenu = $("#settings");
            var SettingsPanel = global.createSettingsMenu(settingsMenu);

            function updateSettings() {
                SettingsPanel.render();
                //settingsMenu.find('select').formSelect({ dropdownOptions: { height: 300, autoFocus: false } });
                settingsMenu.find('button').addClass('btn btn-group').parent().addClass("btn-group-container");
                global.styleCheckbox(settingsMenu);
            }
            global.SideViewTabs["owner-#settings"] = {
                update: updateSettings
            };
        }
    });

    //git
    BootList.push({
        name: "Git Integration",
        script: "./tools/git/git.js",
        ignoreIf: !appConfig.enableGit
    });
    //show diff
    BootList.push("./core/storage/databasestorage.js", {
        name: "Diff Tooling",
        script: "./tools/diff/diff.js"
    });
    //tools fxmising
    BootList.push({
        name: "Missing colons",
        script: "./tools/fix_colons.js"
    });
    //keybindings
    BootList.push({
        name: "Custom Keybindings",
        func: function() {
            global.restoreBindings(getEditor());
        }
    });


    var searchConfig = global.registerAll({
        "useRecyclerViewForSearchResults": true
    }, "search");
    //SearchPanel
    BootList.push({
        script: "./ui/recycler.js",
        ignoreIf: searchConfig.useRecyclerViewForSearchResults && !global.RecyclerRenderer
    }, {
        script: "./libs/js/brace-expansion.js"
    }, {
        script: "./search/overlayMode.js"
    }, {
        script: "./search/rangeRenderer.js"
    }, {
        script: "./search/searchList.js"
    }, {
        script: "./search/searchResults.js"
    }, {
        script: "./search/searchReplace.js"
    }, {
        script: "./views/searchTab.js"
    }, {
        name: "Creating Search Panel",
        func: function() {
            var getEditor = global.getEditor;
            var SearchPanel = new global.SearchTab($("#search_container"), $("#searchModal"));
            SearchPanel.init(Sidenav);
        }
    });
});