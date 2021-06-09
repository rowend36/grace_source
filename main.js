_Define(function(global) {
    "use strict";
    /*So this basically sets up the application,
    Mainly is deals with tab navigation
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
    var SettingsDoc = global.SettingsDoc;
    var FileUtils = global.FileUtils;
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
    var register = global.register;
    global.registerAll({
        currentTab: null,
        disableOptimizedFileBrowser: false,
        disableBackButtonTabSwitch: false,
        backButtonDelay: "700ms",
        enableFloatingRunButton: "auto",
        enableSplits: window.innerHeight > 700,
        autoHideTabs: 500,
        enableKeyboardNavigation: Env.isDesktop,
        enableGit: true,
        inactiveFileDelay: "5min",
        projectConfigFile: "grace.json"
    });
    global.registerValues({
        currentTab: "no-user-config",
        "autoHideTabs": "Automatically hide tabs when keyboard visible if window height is less than this value in pixels. Set to 0 to disable.",
        // configFiles: "./.grace.json",
        "projectConfigFile": " A file which contains configuration relative to project folder. Multiple comma separated files are allowed",
        enableFloatingRunButton: {
            "default": 'auto',
            values: ["true", 'small', 'center', 'auto', false]
        },
        inactiveFileDelay: "How long after saving is necessary for a file to be considered inactive for 'Close inactive tabs' menu option"
    });
    var DocsTab;
    setBreakpoint("start-app", function(id, e) {
        Notify.error("Error During Previous Load!!! If issue persists, contact developer");
        eruda._entryBtn.show();
    });
    appEvents.once("app-loaded", function() {
        clearBreakpoint("start-app");
    });
    //stateManager
    if (!Env.isWebView) State.ensure("noexit", true);
    State.addListener(function(doc, old, dir) {
        if (DocsTab.getOwner(doc)) {
            //can try to reopen previously closed docs
            if (!appConfig.disableBackButtonTabSwitch && DocsTab.hasTab(doc)) {
                if (doc != DocsTab.active) Docs.swapDoc(doc);
                return true;
            }
            return false;
        } else {}
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
        return (state == "tabs" || state == "noexit" || DocsTab.hasTab(state));
    });
    var lastTab;


    function swapTab() {
        if (lastTab < 0) return;
        Docs.swapDoc(lastTab);
    }
    var viewRoot, SidenavLeft, Menu;
    global.LayoutCommands = [{
        name: "toggleFullscreen",
        bindKey: "F11",
        exec: function(editor) {
            Menu.toggle();
            Menu.$forcedOpen = !Menu.hidden;
        },
    }, {
        name: "swapTabs",
        bindKey: {
            win: "Alt-Tab",
            mac: "Command-Alt-N",
        },
        exec: swapTab,
    }, ];
    Editors.addCommands(global.LayoutCommands);
    MainMenu.addOption("close", {
        icon: "close",
        sortIndex: 3,
        caption: "Close",
        childHier: {
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
                    var inactiveTime = new Date().getTime() - Utils.parseTime(appConfig.inactiveFileDelay);
                    Utils.asyncForEach(global.DocsTab.tabs.slice(0), function(e, i, n) {
                        n();
                        if (e == global.DocsTab.active || !docs[e] || docs[e].dirty || docs[e].isTemp()) return;
                        if (Utils.getCreationDate(docs[e].id) < inactiveTime)
                            docs[e].getFileServer().stat(docs[e].getSavePath(), function(err, s) {
                                if (s && s.mtimeMs < inactiveTime && s.size === docs[e].getSize()) {
                                    closeTab(e);
                                }
                            });
                    });
                },
            },
        },
    });
    //No one chnages tabs while we are triggering event return false instead
    var switchTab = Utils.guardEntry(function switchTab(id, previousTab) {
        lastTab = previousTab;
        //apps can set active Docs
        var handled = appEvents.trigger("changeTab", {
            oldTab: lastTab,
            tab: id,
        }).defaultPrevented;
        if (!(handled || setDoc(id))) {
            return false;
        }
        configure("currentTab", id, "application");
        //TODO bad api but we can't move state to documemt tab yet
        State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
        return true;
    });

    function closeTab(id, force) {
        var doc = docs[id];
        if (appEvents.trigger("beforeCloseTab", {
                id: id,
                doc: doc,
            }).defaultPrevented) return false;
        var e = appEvents.trigger("closeTab", {
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
            Notify.ask(Docs.getName(doc.id) + " has unsaved changes. Close without saving?", function() {
                close();
            });
            return false;
        } else {
            close();
            return true;
        }
    }
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

    function bootEditor() {
        //viewroot
        viewRoot = $("#viewroot")[0];
        var Layout = new LinearLayout($(document.body), window.innerHeight, LinearLayout.VERTICAL);
        Menu = Layout.addChild($("#action_bar"), 56);
        Layout.addChild($("#viewroot"), 0, 1);
        Layout.addChild($("#status-bar"));
        var margins = {
            marginTop: 0,
            marginBottom: 0,
        };
        ace.Editor.prototype.getPopupMargins = function(isDoc) {
            return isDoc ? {
                marginTop: 0,
                marginBottom: margins.marginBottom,
            } : margins;
        };
        var emmetExt = ace.require("ace/ext/emmet");
        emmetExt.load = global.Imports.define(["./libs/js/emmet.js"], null, function(cb) {
            window.emmet = window.emmetCodeMirror.emmet;
            cb && cb();
        });
        Layout.onRender = function() {
            appEvents.trigger("view-change");
            margins.marginTop = parseInt(viewRoot.style.top);
            margins.marginBottom = parseInt(viewRoot.style.bottom) + 50;
        };
        MainMenu.createTrigger($("#action_bar .dropdown-trigger")[0]);
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
        CharBar.init(Layout);
        appEvents.on("changeEditor", function(e) {
            CharBar.setEditor(e.editor);
        });
        Layout.render();
        if (appConfig.enableKeyboardNavigation) Navigation.attach();
        var AutoComplete = global.Autocomplete;
        var doBlur = AutoComplete.prototype.blurListener;
        AutoComplete.prototype.blurListener = function() {
            if (FocusManager.activeElement == editor.textInput.getElement()) return;
            doBlur.apply(this, arguments);
        };
        appEvents.on("keyboard-change", function(ev) {
            if (ev.isTrusted) {
                if (!ev.visible) {
                    var a = AutoComplete.for(getEditor());
                    if (a.activated) a.detach();
                } else {
                    if (appConfig.autoHideTabs && !Menu.$forcedOpen) {
                        if (window.innerHeight < parseInt(appConfig.autoHideTabs)) Menu.hide();
                    }
                    $(document.body).addClass("virtual-keyboard-visible");
                }
            }
            if (!ev.visible) {
                if (appConfig.autoHideTabs && !Menu.$forcedClose) Menu.show();
                $(document.body).removeClass("virtual-keyboard-visible");
            }
        });
        global.styleClip($("#status-filename"));
        DocsTab = new DocumentTab($("#menu"), $("#opendocs"), $("#status-filename").children());
        DocsTab.$hintActiveDoc = setDoc;
        FocusManager.trap($("#menu"), true);
        FocusManager.trap($("#status-filename"), true);
        DocsTab.setSingleTabs(appConfig.singleTabLayout);
        DocsTab.afterClick = switchTab;
        DocsTab.onClose = closeTab;
        var SidenavLeftTab = new PagerTab($("#selector"), $("#side-menu"));
        var toggles = {};
        $(".toggleBelow").click(function(e) {
            e.stopPropagation();
            if ($(this).next().css("display") == "none") {
                configure(this.id + ":shown", true);
                $(this).next().show();
                $(this).children(".material-icons").text("keyboard_arrow_up");
            } else {
                configure(this.id + ":shown", false);
                $(this).next().hide();
                $(this).children(".material-icons").text("keyboard_arrow_down");
            }
        }).each(function(e, el) {
            appConfig[el.id + ":shown"] = true;
            register(el.id + ":shown");
            toggles[el.id + ":shown"] = "no-user-config";
            if (!appConfig[el.id + ":shown"]) {
                el.click();
            }
        });
        global.registerValues(toggles);
        toggles = null;
        //uodate currently push on openstart or dragstart
        var refocus = false;
        SidenavLeft = new Sidenav($("#side-menu"), {
            draggable: true,
            edge: "left",
            minWidthPush: 600,
            pushElements: $(".content"),
            onOpenStart: function() {
                FocusManager.hintChangeFocus();
                /*if (window.innerWidth < 992) {
                    SidenavRight.close();
                }*/
            },
            onOpenEnd: function() {
                if (SidenavLeftTab.getActiveTab().attr("href") == "#settings") SidenavLeftTab.update("#settings");
                if (SidenavLeft.isOverlay) {
                    if (!Env.isDesktop) {
                        if (FocusManager.keyboardVisible) {
                            refocus = FocusManager.activeElement;
                            if (refocus) {
                                refocus.blur();
                            }
                        } else document.activeElement.blur();
                    }
                    Navigation.addRoot(SidenavLeft.el, SidenavLeft.close.bind(SidenavLeft));
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
        Docs.initialize(DocsTab, currentTab);
        var newDoc;
        if (Docs.numDocs() < 1) {
            newDoc = Docs.createPlaceHolder("welcome", "Welcome To Grace Editor", {
                select: false,
            });
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
            configure("currentTab", oldCurrentTab, "application");
        }
        appEvents.triggerForever("app-loaded");
        appEvents.on("documents-loaded", function() {
            FileUtils.loadServers();
            Docs.refreshDocs();
        });
    }
    $(document).ready(bootEditor);
}); /*_EndDefine*/
_Define(function(global) {
    /*Theming*/
    "use strict";
    var configEvents = global.ConfigEvents;
    var appEvents = global.AppEvents;
    var appConfig = global.registerAll({
        applicationTheme: "editor",
        appFontSize: "medium",
        singleTabLayout: false
    });
    global.registerValues({
        applicationTheme: "editor , application",
        appFontSize: "Font size for UI - small|medium|big"
    });

    function onChange(ev) {
        switch (ev.config) {
            case "applicationTheme":
                updateTheme($(".editor-primary"), true);
                break;
            case "appFontSize":
                switch (ev.newValue) {
                    case "small":
                    case "medium":
                    case "big":
                        clearClass($(document.body.parentElement), /font$/);
                        document.body.parentElement.className += " " + ev.newValue + "font";
                        break;
                    default:
                        ev.preventDefault();
                }
                break;
            case "singleTabLayout":
                global.DocsTab.setSingleTabs(ev.newValue);
                break;
        }
    }
    configEvents.on("application", onChange);
    //App Theming
    appEvents.once("app-loaded", function() {
        document.body.parentElement.className += " " + appConfig.appFontSize + "font";
        $(".splash-screen").fadeOut();
        setTimeout(function() {
            $(".splash-screen").detach();
        }, 700);
    });
    var themeBlack = ["ace-tomorrow-night-bright", "ace-terminal-theme", "ace-vibrant-ink","ace-clouds-midnight","ace-kr-theme","ace-merbivore-soft","ace-ambiance","ace-twilight","ace-merbivore"];
    var theme = {
        className: "ace-tm",
        background: "white",
    };

    function getStyle(_class) {
        var div = document.createElement("div");
        div.className = _class;
        document.body.appendChild(div);
        var e = window.getComputedStyle(div);
        var f = {
            background: e.background || e.backgroundColor,
            color: e.color,
            font: e.font || e.fontFamily,
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
            isBlack: themeBlack.indexOf(ace_theme.cssClass) > -1,
        };
        var els = $(".editor-primary");
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
        if (!added) els.addClass("editor-primary");
        var ev = theme;
        clearClass(els, /theme|^ace/);
        if (ev.isDark && appConfig.applicationTheme == "editor" && !ev.isBlack) {
            els.addClass(ev.className);
            els.addClass("theme-dark");
        } else {
            switch (appConfig.applicationTheme) {
                case "blue-devel":
                    if(ev.isDark){
                        els.addClass("theme-dark");
                        els.addClass("theme-blue-dark");
                    }
                    else els.addClass("theme-blue");
                    /*fall through*/
                default:
                    if (ev.isDark){
                        els.addClass("app-theme-dark");
                        els.addClass("theme-dark");
                    }
                    else
                        els.addClass("app-theme-light");
            }
        }
    }
    global.styleCheckbox = function(el) {
        el = el.find("[type=checkbox]").addClass("checkbox").addClass("filled-in");
        for (var i = 0; i < el.length; i++) {
            var a = el.eq(i);
            //The styling uses the before element of next span
            if (!a.next().is("span")) a.after("<span></span>");
        }
        el.next().click(function(e) {
            $(this).prev().click();
            e.stopPropagation();
            e.preventDefault();
        });
    };
    global.styleClip = function(el) {
        el = $(el);
        var all = el.filter(".clipper");
        all.add(el.find(".clipper")).each(function(i, clipper) {
            var text = clipper.innerText;
            clipper.innerText = "";
            var chunks = [text];
            var t = chunks.length - 1;
            chunks.reverse().forEach(function(e, i) {
                var span = document.createElement('span');
                span.className = 'clipper-text';
                span.innerText = (i < t ? "/" : "") + e;
                clipper.appendChild(span);
            });
        });
    };
    global.watchTheme = updateTheme;
}); /*_EndDefine*/
_Define(function(global) {
    "use strict";
    var appEvents = global.AppEvents;
    var appConfig = global.appConfig;
    var Functions = global.Functions;
    var Utils = global.Utils;
    var getEditor = global.getEditor;
    var Imports = new global.Imports(function() {
        global.BootList = Imports = null;
        appEvents.triggerForever("fully-loaded");
    });
    global.BootList = Imports;
    appEvents.on("documents-loaded", Imports.load);
    //material colors
    Imports.add({
        name: "Material Colors",
        style: "./libs/css/materialize-colors.css",
    });
    Imports.add({
        name: "Inbuilt Fonts",
        func: function() {
            var fonts = ["Anonymous Pro", "Courier Prime", {
                name: "Fira Code",
                types: ["Regular", "Bold"],
                formats: ["woff", "woff2", "ttf"],
            }, "Hack", {
                name: "Inconsolata",
                types: ["Regular", "Bold"],
            }, "JetBrains Mono", {
                name: "Roboto Mono",
                types: ["Regular", "Bold"],
            }, {
                name: "PT Mono",
                types: ["Regular"],
            }, "Source Code Pro", "Ubuntu Mono", {
                name: "Nova Mono",
                types: ["Regular"],
            }, ];
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
                fontFamily: "Font used by the editor and search results. Bundled fonts include " + fonts.map(function(e) {
                    return e.name || e;
                }).join(", ") + " as well as any System fonts.\n"
            });
        },
    });
    Imports.add("./prefs/linter_options.js", {
        script: "./document/auto_settings.js"
    });
    //runManager
    Imports.add({
        script: "./libs/js/splits.js",
    }, {
        script: "./ui/splits.js",
    }, {
        script: "./preview/previewer.js",
    }, {
        name: "Creating run manager",
        script: "./preview/modes.js",
    }, {
        name: "Enhanced Clipboard",
        script: "./tools/enhanced_clipboard.js",
    }, {
        func: function() {
            var button = $("#runButton");
            var enable = appConfig.enableFloatingRunButton;
            if (enable) {
                button.click(Functions.run);
                switch (enable) {
                    case "center":
                        button.addClass("centerV");
                        break;
                    case "small":
                        button.removeClass("btn-large");
                        break;
                    case "auto":
                        var visible = true;
                        var update = function(ev) {
                            if (ev.visible) {
                                if (visible && ev.isTrusted) {
                                    button.addClass('slide-out');
                                    visible = false;
                                }
                            } else if (!visible) {
                                button.removeClass('slide-out');
                                visible = true;
                            }
                        };
                        appEvents.on("keyboard-change", update);
                }
            } else {
                button.detach();
            }
        },
    });
    Imports.add("./libs/css/completion.css", {
        script: "./ui/overlayMode.js", //dynamic
    }, {
        script: "./ui/rangeRenderer.js", //dynamuc
    }, "./autocompletion/ui.js", "./autocompletion/base_server.js", {
        name: "Tags",
        script: "./autocompletion/tags/tags.js",
    }, {
        script: "./autocompletion/loader.js",
    }, {
        name: "AutoCompletion",
        script: "./autocompletion/manager.js",
    });
    var Overflow = global.Overflow;
    //StatusBar SearchBox
    Imports.add({
        name: "SearchBox and Status", //Looks awful on small splits
        /*Isolated*/
        func: function() {
            var getEditor = global.getEditor;

            var updateStatus = Utils.delay(function() {
                var editor = getEditor();
                if (editor && editor.commands.recording) {
                    $("#togglerecording").addClass('blink');
                } else $("#togglerecording").removeClass('blink');
            }, 100);
            var trackStatus = function(e) {
                (e.editor || e).on('changeStatus', updateStatus);
            };
            appEvents.on('changeEditor', updateStatus);
            appEvents.on('createEditor', trackStatus);
            global.Editors.forEach(trackStatus);
            trackStatus = null;
            ace.config.loadModule("ace/ext/searchbox", function(e) {
                var Searchbox = e.SearchBox;
                var SearchBox = getEditor().searchBox || new Searchbox(getEditor());
                var lastPosition = 0,
                    inContent;

                function position(ev) {
                    var refocus = global.FocusManager.visit(global.FocusManager.activeElement);
                    if (!ev) {
                        inContent = false;
                    }
                    var el = SearchBox.element;
                    var y = SearchBox.editor.container;
                    var t = y.getBoundingClientRect();
                    // var offset = 0;
                    if (t.height < 300) {
                        if (!inContent) {
                            $(".content")[0].appendChild(SearchBox.element);
                            inContent = true;
                        }
                        var u = $("#viewroot")[0].getBoundingClientRect();
                        if (t.top - u.top > 100) {
                            if (lastPosition == 1) return refocus();
                            lastPosition = 1;
                            el.style.top = u.top + "px";
                            el.style.bottom = "auto";
                            SearchBox.alignContainer(SearchBox.ALIGN_NONE);
                        } else {

                            if (t.bottom < u.bottom - 100) {
                                if (lastPosition == 4) return refocus();
                                lastPosition = 4;
                                SearchBox.alignContainer(SearchBox.ALIGN_NONE);
                            } else {
                                if (lastPosition == 3) return refocus();
                                lastPosition = 3;

                                SearchBox.alignContainer(SearchBox.ALIGN_BELOW);
                            }
                            el.style.bottom = window.innerHeight - u.bottom + "px";
                            el.style.top = "auto";
                        }
                        el.style.right = "auto";
                        el.style.left = 0;
                        return refocus();
                    }
                    var W = $(".content").width();
                    var l = 0,
                        r = 0;

                    if (lastPosition < 5) {
                        el.style.top = 0;
                        el.style.bottom = "auto";
                        lastPosition = 5;
                    }
                    if (t.width < 300 ||
                        (inContent && SearchBox.active)
                    ) {
                        if (!inContent) {
                            $(".content")[0].appendChild(SearchBox.element);
                            inContent = true;
                        }
                        el.style.top = t.top + "px";
                        lastPosition = 7;
                    } else {
                        //avoid jolting changes due to keyboard focus
                        if (inContent) {
                            y.appendChild(el);
                            inContent = false;
                            el.style.top = 0;
                        }
                        l = t.left;
                        r = W - t.right;
                        if (l == 0) {
                            if (lastPosition !== 6)
                                lastPosition = 6;
                            else return refocus();
                        }
                    }
                    SearchBox.alignContainer(SearchBox.ALIGN_ABOVE);
                    var p = Overflow.clipWindow(t, 300, W, false);
                    if (t[0] == 0 && !inContent) {

                    }
                    if (p[0] == undefined) {
                        el.style.right = p[1] - r + "px";
                        el.style.left = "auto";
                    } else {
                        el.style.right = "auto";
                        el.style.left = p[0] - l + "px";
                    }
                    refocus();
                }
                ace.config.loadModule("ace/ext/statusbar", function(module) {
                    var Statusbar = module.StatusBar;
                    var StatusBar = StatusBar || new Statusbar(getEditor(), $("#status-bar")[0]);
                    if (SearchBox.editor != getEditor()) {
                        SearchBox.setEditor(e);
                    }
                    position();
                    appEvents.on("changeEditor",
                        (function(SearchBox, StatusBar, position) {
                            return function(ev) {
                                var e = ev.editor;
                                $(e.container).addClass("active_editor");
                                if (ev.oldEditor) {
                                    $(ev.oldEditor.container).removeClass("active_editor");
                                    ev.oldEditor.renderer.off("resize", position);
                                }
                                StatusBar.setEditor(e);
                                StatusBar.updateStatus(e);
                                SearchBox.setEditor(e);
                                e.renderer.on("resize", position);
                                position();
                            };
                        })(SearchBox, StatusBar, position));
                });
            });
        },
    });
    //FileBrowsers
    Imports.add({
        script: "./libs/js/touchhold.js",
        ignoreIf: true, //use native contextmenu
    }, {
        script: "./ui/recycler.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser,
    }, {
        script: "./views/fileBrowser.js",
    }, {
        script: "./views/recyclerBrowser.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser,
    }, {
        name: "Creating File Browsers",
        func: function() {
            var FileUtils = global.FileUtils;
            //FileBrowsers
            appEvents.triggerForever("filebrowsers");
            var FileBrowser = global.FileBrowser;
            if (!appConfig.disableOptimizedFileBrowser) {
                global.FileBrowser = global.RFileBrowser;
            }
            FileUtils.initialize(global.SideView, global.SideViewTabs);
            var Hierarchy = global.RHierarchy || global.Hierarchy;
            var _hierarchy = new Hierarchy($("#hierarchy"), "");
            _hierarchy.id = "projectView";
            FileUtils.ownChannel("project", _hierarchy, "files");
            FileUtils.addBrowser(_hierarchy);

            function update(e) {
                var n = e.project.rootDir;
                if (n == FileUtils.NO_PROJECT) {
                    _hierarchy.close();
                } else {
                    _hierarchy.fileServer = e.project.fileServer;
                    _hierarchy.setRootDir(n);
                    _hierarchy.rename(_hierarchy.hier[0], e.project.name);
                }
            }
            update({
                project: FileUtils.getProject()
            });
            FileUtils.on("change-project", update);
            //FileUtils.on("close-project", update);
            //move this to header?
            //File finding TODO
            function stopFind() {
                if ($("#find_file_cancel_btn").text() == "stop") {
                    _hierarchy.stopFind();
                    $("#find_file_cancel_btn").text("refresh");
                } else {
                    _hierarchy.cancelFind();
                }
            }

            function doFind() {
                $("#search_text").val() && _hierarchy.findFile($("#search_text").val(), null, function() {
                    $("#find_file_cancel_btn").text("refresh");
                });
                $("#find_file_cancel_btn").text("stop");
            }
            $("#find_file_btn").click(doFind);
            $("#search_text").change(doFind);
            $("#find_file_cancel_btn").click(stopFind);
        },
    });
    //swiping
    Imports.add({
        name: "Swipe And Drag",
        script: "./libs/js/mobile-drag.js",
    }, {
        script: "./libs/js/drag-tabs.js",
    }, {
        script: "./libs/js/hammer.min.js",
        ignoreIf: false, //not quite there yet
    }, {
        script: "./libs/js/scroll-behaviour.js",
    }, {
        func: function() {
            var SidenavTabs = global.SideViewTabs;
            var DocsTab = global.DocsTab;
            var swipeDetector = new Hammer($("#side-menu")[0], {
                inputClass: Hammer.TouchMouseInput,
                recognizers: [
                    [
                        Hammer.Swipe, {
                            threshold: 3.0,
                            direction: Hammer.DIRECTION_HORIZONTAL,
                        },
                    ],
                ],
            });
            var unChecked = false;
            swipeDetector.on("hammer.input", function(ev) {
                if (ev.isFirst) {
                    unChecked = true;
                    var elt = ev.target;
                    if (elt.tagName == "INPUT") return swipeDetector.stop();
                    elt = elt.parentElement;
                    if (elt && (elt.parentElement && elt.parentElement.id == "selector") || elt.id == 'selector') {
                        return swipeDetector.stop();
                    }
                }
                if (unChecked) {
                    var el = ev.target;
                    var style;
                    if (ev.velocityX < -0.5) {
                        do {
                            style = window.getComputedStyle(el);
                            if (
                                (style.overflow == "scroll" || style.overflow == "auto" || style.overflowX == "scroll" || style
                                    .overflowX == "auto") && el.scrollWidth - el.scrollLeft > el.offsetWidth) {
                                return swipeDetector.stop();
                            }
                            el = el.parentElement;
                        } while (el);
                        unChecked = false;
                    } else if (ev.velocityX > 0.5) {
                        do {
                            style = window.getComputedStyle(el);
                            if (
                                (style.overflow == "scroll" || style.overflow == "auto" || style.overflowX == "scroll" || style
                                    .overflowX == "auto") && el.scrollLeft > 0) {
                                return swipeDetector.stop();
                            }
                            el = el.parentElement;
                        } while (el);
                        unChecked = false;
                    }
                }
            });
            swipeDetector.on("swipeleft", function(ev) {
                SidenavTabs.goleft();
            });
            swipeDetector.on("swiperight", function(ev) {
                SidenavTabs.goright();
            });
            window.MobileDragDrop.polyfill({
                holdToDrag: 650,
                noDebug: true,
                tryFindDraggableTarget: function(event) {
                    var el = event.target;
                    do {
                        if (el.getAttribute && el.getAttribute("draggable") === "true") {
                            return el;
                        }
                    } while ((el = el.parentNode) && el !== document.body);
                },
                dragImageTranslateOverride: MobileDragDrop.scrollBehaviourDragImageTranslateOverride,
            });
            var dragger = new global.DragTabs($("#menu")[0], {
                selectors: {
                    tab: ".tab",
                },
            });
            dragger.on("end", function(e) {
                if (e.newIndex !== undefined) {
                    DocsTab.moveTab(e.newIndex, e.dragTab.getAttribute("data-file"));
                }
            });
            /*dragger.on('drag', function(e) {
                      //show drag intent
                  });*/
            var listDragger = new global.DragList($("#opendocs")[0], {
                selectors: {
                    tab: ".file-item",
                },
            });
            listDragger.on("drag", function(e) {
                if (e.newIndex !== undefined) {
                    DocsTab.moveTab(e.newIndex, e.dragTab.getAttribute("data-file"));
                }
            });
        },
    });
    //Split Editors
    Imports.add({
        script: "./tools/splitEditors.js",
        ignoreIf: !appConfig.enableSplits,
    }, {
        name: "Split Editors",
        func: function() {
            global.SplitEditors && global.SplitEditors.init();
        },
    });
    //Settings Menu
    Imports.add({
        script: "./src-min-noconflict/ext-options.js",
    }, {
        script: "./prefs/settings-menu.js",
    }, {
        name: "Create Settings Menu",
        func: function() {
            var settingsMenu = $("#settings");
            var SettingsPanel = global.createSettingsMenu(settingsMenu);

            function updateSettings() {
                SettingsPanel.render();
                //settingsMenu.find('select').formSelect({ dropdownOptions: { height: 300, autoFocus: false } });
                settingsMenu.find("button").addClass("btn btn-group").parent().addClass("btn-group-container");
                global.styleCheckbox(settingsMenu);
            }
            global.SideViewTabs["owner-#settings"] = {
                update: updateSettings,
            };
            $("#settings_tab").show();
        },
    });
    //git
    Imports.add({
        name: "Git Integration",
        script: "./tools/git/git.js",
        ignoreIf: !appConfig.enableGit,
    });
    //show diff
    Imports.add("./core/storage/databasestorage.js", {
        name: "Diff Tooling",
        script: "./tools/diff/diff.js",
    });
    //tools fxmising
    Imports.add({
        name: "Missing colons",
        script: "./tools/fix_colons.js", //dynamic
    });
    //keybindings
    Imports.add({
        name: "Custom Keybindings",
        func: function() {
            var Editors = global.Editors;
            Editors.forEach(function(e) {
                global.restoreBindings(e);
            });
            var appEvents = global.AppEvents;
            appEvents.on("createEditor", global.restoreBindings);
        },
    });
    var searchConfig = global.registerAll({
        useRecyclerViewForSearchResults: true,
    }, "search");
    //SearchPanel
    Imports.add({
        script: "./ui/recycler.js",
        ignoreIf: searchConfig.useRecyclerViewForSearchResults && !global.RecyclerRenderer,
    }, {
        script: "./libs/js/brace-expansion.js", //core
    }, {
        script: "./search/searchList.js", //dynamic
    }, {
        script: "./search/searchResults.js", //dynamic
    }, {
        script: "./search/searchReplace.js", //dynamic
    }, {
        script: "./search/searchTab.js",
    }, {
        name: "Creating Search Panel",
        func: function() {
            var SearchPanel = new global.SearchTab($("#search_container"), $("#searchModal"));
            SearchPanel.init(global.SideView);
        },
    });
}); /*_EndDefine*/