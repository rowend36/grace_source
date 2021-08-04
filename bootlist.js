_Define(function(global) {
    "use strict";
    var appEvents = global.AppEvents;
    var appConfig = global.appConfig;
    var Functions = global.Functions;
    var Imports = global.BootList;
    var MainMenu = global.MainMenu;
    Imports.add({
        ignoreIf: Env.isWebView,
        func: function() {
            var method = "requestFullscreen" in document.body ?
                "requestFullscreen" :
                "webkitRequestFullscreen" in window ?
                "webkitRequestFullscreen" : "webkitRequestFullScreen" in window ?
                "webkitRequestFullScreen" : null;
            if (method)
                MainMenu.addOption("fullscreen", {
                    icon: "fullscreen",
                    onclick: function() {
                        document.body[method]();
                    },
                    caption: "Enable Immersive Mode"
                }, true);


        }
    });
    Imports.add({
        //material colors
        name: "Material Colors",
        style: "./libs/css/materialize-colors.css",
    });
    Imports.add("./libs/js/brace-expansion.js");
    Imports.add({
        name: "Inbuilt Fonts",
        func: function() {
            var fonts = [
                "Anonymous Pro",
                "Courier Prime",
                {
                    name: "Fira Code",
                    types: ["Regular", "Bold"],
                    formats: ["woff", "woff2", "ttf"],
                },
                "Hack",
                {
                    name: "Inconsolata",
                    types: ["Regular", "Bold"],
                },
                "JetBrains Mono",
                {
                    name: "Roboto Mono",
                    types: ["Regular", "Bold"],
                },
                {
                    name: "PT Mono",
                    types: ["Regular"],
                },
                "Source Code Pro",
                "Ubuntu Mono",
                {
                    name: "Nova Mono",
                    types: ["Regular"],
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
                fontFamily: "Font used by the editor and search results. Availability of fonts varies with operating. The following are guaranteed to be available " +
                    fonts
                    .map(function(e) {
                        return e.name || e;
                    })
                    .join(", ") +
                    ".\n",
            }, "editor");
        },
    });
    Imports.add("./prefs/linter_options.js", {
        script: "./prefs/auto_settings.js",
    });
    //runManager
    Imports.add({
        script: "./libs/js/splits.js",
    }, {
        script: "./ui/splits.js",
    }, {
        script: "./run/previewer.js",
    }, {
        name: "Creating run manager",
        script: "./run/modes.js",
    }, {
        name: "Enhanced Clipboard",
        script: "./tools/enhanced_clipboard.js",
    }, {
        func: function() {
            var button = $("#runButton");
            button.click(Functions.run);
            var lastClass = "btn-large",
                hideRunButton;

            function update(ev) {
                var enable = appConfig.enableFloatingRunButton;
                if(ev){
                    button.removeClass("centerV");
                    button.addClass("btn-large");
                    appEvents.off("keyboard-change", hideRunButton);
                }
                if (enable) {
                    switch (enable) {
                        case "center":
                            button.addClass("centerV");
                            break;
                        case "small":
                            button.removeClass("btn-large");
                            break;
                        case "auto":
                            var hidRunButton = true;
                            if (!hideRunButton) hideRunButton = function(ev) {
                                if (hidRunButton !== (ev.isTrusted && ev.visible)) {
                                    if (hidRunButton) {
                                        button.removeClass("slide-out");
                                        hidRunButton = false;
                                    } else {
                                        button.addClass("slide-out");
                                        hidRunButton = true;

                                    }
                                }
                            };
                            appEvents.on("keyboard-change", hideRunButton);
                    }
                } else {
                    button.hide();
                }
            };
            global.ConfigEvents.on("application.enableFloatingRunButton", update);
            update();
        },
    });
    Imports.add([
        "./autocompletion/completion.css",
        "./ui/overlayMode.js", //dynamic
        "./ui/rangeRenderer.js", //dynamic
        "./autocompletion/ui.js",
        "./autocompletion/base_server.js", [
            "./autocompletion/tags/scope.js",
            "./autocompletion/tags/prop.js", {
                name: "Tags",
                script: "./autocompletion/tags/completer.js",
            },
            "./autocompletion/tags/finders.js"
        ], {
            script: "./autocompletion/loader.js",
        }, {
            name: "AutoCompletion",
            script: "./autocompletion/manager.js",
        }
    ]);

    //FileBrowsers
    Imports.add({
        script: "./libs/js/touchhold.js",
        ignoreIf: true, //use native contextmenu
    }, {
        script: "./ui/fileBrowser.js",
    }, [{
        script: "./ui/recycler.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser,
    }, {
        script: "./ui/recyclerBrowser.js",
        ignoreIf: appConfig.disableOptimizedFileBrowser,
    }], {
        name: "Creating File Browsers",
        func: function() {
            var FileUtils = global.FileUtils;
            var EventsEmitter = global.EventsEmitter;
            //FileBrowsers
            appEvents.triggerForever("filebrowsers");
            if (global.RFileBrowser) {
                global.FileBrowser = global.RFileBrowser;
            }
            FileUtils.initialize(global.SideView, global.SideViewTabs);
            var ProjectView = global.RProjectView || global.ProjectView;
            var projectView = new ProjectView($("#hierarchy"), "");
            projectView.id = "projectView";
            projectView.emitter = new EventsEmitter(projectView.emitter);
            FileUtils.ownChannel("project", projectView.onNewOption.bind(projectView));
            FileUtils.addBrowser(projectView);

            function update(e) {
                var n = e.project.rootDir;
                if (n == FileUtils.NO_PROJECT) {
                    projectView.close();
                } else {
                    projectView.fileServer = e.project.fileServer;
                    projectView.setRootDir(n);
                    projectView.rename(projectView.names[0], e.project.name);
                }
            }
            update({
                project: FileUtils.getProject(),
            });
            FileUtils.on("change-project", update);
            FileUtils.on("change-project-name", function() {
                projectView.rename(
                    projectView.names[0],
                    FileUtils.getProject().name
                );
            });
            //FileUtils.on("close-project", update);
            //move this to header?
            //File finding TODO
            function stopFind() {
                if ($("#find_file_cancel_btn").text() == "stop") {
                    projectView.stopFind();
                    $("#find_file_cancel_btn").text("refresh");
                } else {
                    projectView.cancelFind();
                }
            }

            function doFind() {
                if ($("#search_text").val()) {
                    projectView.findFile(
                        $("#search_text").val(),
                        null,
                        function() {
                            $("#find_file_cancel_btn").text("refresh");
                        }
                    );
                    $("#find_file_cancel_btn").text("stop");
                }
            }
            global.createSearch('#search_text', "#find_file_btn", doFind);
            $("#find_file_cancel_btn").click(stopFind);
        },
    });
    //HttpServer
    Imports.add(["./fileserver/httpfs.js"]);

    //StatusBar SearchBox
    Imports.add({
        name: "SearchBox and Status", //Looks awful on small splits
        /*Isolated*/
        func: function() {
            var Dropdown = global.Dropdown;
            var getEditor = global.getEditor;
            ace.config.loadModule("ace/ext/searchbox", function(e) {
                var Searchbox = e.SearchBox;
                var SearchBox =
                    getEditor().searchBox || new Searchbox(getEditor());
                var lastPosition = 0;
                var SB_HEIGHT = 100;
                var SB_WIDTH = 300;
                var lastAlign = null;

                function position() {
                    var refocus = global.FocusManager.visit(
                        global.FocusManager.activeElement
                    );
                    var el = SearchBox.element;
                    var editDiv = SearchBox.editor.container;
                    var editRect = editDiv.getBoundingClientRect();
                    var inContent = el.parentElement != editDiv;
                    if (editRect.height > SB_HEIGHT * 3) {
                        //portrait editor
                        var W = $(".content").width();
                        var l = 0,
                            r = 0;
                        if (lastAlign != SearchBox.ALIGN_ABOVE) {
                            SearchBox.alignContainer(SearchBox.ALIGN_ABOVE);
                            lastAlign = SearchBox.ALIGN_ABOVE;
                        }
                        if (lastPosition < 5) {
                            el.style.top = 0;
                            el.style.bottom = "auto";
                            lastPosition = 5;
                        }
                        if (
                            editRect.width < SB_WIDTH ||
                            //avoid jolting changes due to keyboard focus
                            (inContent && SearchBox.active)
                        ) {
                            if (!inContent) {
                                $(".content")[0].appendChild(SearchBox.element);
                                inContent = true;
                            }
                            //in content overlapping and overflowing
                            el.style.top = editRect.top + "px";
                        } else {
                            //in editDiv, overlapping no overflow
                            if (inContent) {
                                editDiv.appendChild(el);
                                inContent = false;
                            }
                            l = editRect.left;
                            r = W - editRect.right;
                            el.style.top = 0;
                        }
                        var p = Dropdown.clipWindow(
                            editRect,
                            SB_WIDTH,
                            W,
                            false
                        );
                        if (p[0] === undefined) {
                            el.style.right = p[1] - r + "px";
                            el.style.left = "auto";
                        } else {
                            el.style.right = "auto";
                            el.style.left = p[0] - l + "px";
                        }
                        refocus();
                    } else {
                        //small editor height
                        if (!inContent) {
                            $(".content")[0].appendChild(SearchBox.element);
                            inContent = true;
                        }
                        var u = $("#viewroot")[0].getBoundingClientRect();
                        var cleared = true;
                        if (editRect.left - u.left > SB_WIDTH) {
                            el.style.right = "auto";
                            el.style.left = 0;
                        } else {
                            if (u.right - editRect.right < SB_WIDTH)
                                cleared = false;
                            el.style.right = 0;
                            el.style.left = "auto";
                        }
                        if (cleared || u.bottom - editRect.bottom < SB_HEIGHT) {
                            if (editRect.top - u.top < SB_HEIGHT) {
                                //not cleared
                            }
                            //outside editor above
                            el.style.top = u.top + "px";
                            el.style.bottom = "auto";
                        } else {
                            //outside editor below
                            el.style.top = "auto";
                            el.style.bottom =
                                window.innerHeight - u.bottom + "px";
                        }
                        lastPosition = 1;
                        if (lastAlign != SearchBox.ALIGN_NONE) {
                            SearchBox.alignContainer(SearchBox.ALIGN_NONE);
                            lastAlign = SearchBox.ALIGN_NONE;
                        }
                        refocus();
                    }
                }
                ace.config.loadModule("ace/ext/statusbar", function(module) {
                    var Statusbar = module.StatusBar;
                    var StatusBar =
                        StatusBar ||
                        new Statusbar(getEditor(), $("#status-bar")[0]);
                    if (SearchBox.editor != getEditor()) {
                        SearchBox.setEditor(getEditor());
                    }
                    position();
                    getEditor().renderer.on("resize", position);
                    appEvents.on(
                        "changeEditor",
                        (function(SearchBox, StatusBar, position) {
                            return function(ev) {
                                var e = ev.editor;
                                $(e.container).addClass(
                                    "active_editor");
                                if (ev.oldEditor) {
                                    $(ev.oldEditor.container)
                                        .removeClass(
                                            "active_editor"
                                        );
                                    ev.oldEditor.renderer.off(
                                        "resize",
                                        position
                                    );
                                }
                                StatusBar.setEditor(e);
                                StatusBar.updateStatus(e);
                                SearchBox.setEditor(e);
                                e.renderer.on("resize", position);
                                position();
                            };
                        })(SearchBox, StatusBar, position)
                    );
                });
            });
        },
    });
    //swiping
    Imports.add([{
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
                        Hammer.Swipe,
                        {
                            threshold: 3.0,
                            direction: Hammer.DIRECTION_HORIZONTAL,
                        },
                    ],
                ],
            });
            var canScrollLeft = true,
                canScrollRight = true;
            swipeDetector.on("hammer.input", function(ev) {
                if (ev.isFirst) {
                    canScrollLeft = false,
                        canScrollRight = false;
                    var elt = ev.target;
                    if (elt.tagName == "INPUT") return swipeDetector.stop();
                    elt = elt.parentElement;
                    if (
                        (elt &&
                            elt.parentElement &&
                            elt.parentElement.id == "selector") ||
                        elt.id == "selector"
                    ) {
                        return swipeDetector.stop();
                    }
                    var el = ev.target;
                    do {
                        var style;
                        style = window.getComputedStyle(el);
                        var isScrollable = el.scrollWidth > el.clientWidth && (style
                            .overflow == "scroll" ||
                            style.overflow == "auto" ||
                            style.overflowX == "scroll" ||
                            style.overflowX == "auto");
                        if (isScrollable) {
                            //Really small views should never be the objects of a swipe
                            if (el.clientHeight < 150) {
                                return swipeDetector.stop();
                            } else {
                                if (
                                    el.scrollWidth - el.scrollLeft >
                                    el.offsetWidth) canScrollRight = true;
                                if (el.scrollLeft > 0) canScrollLeft = true;
                            }
                        }
                        el = el.parentElement;
                    }
                    while (el);
                }
                if (canScrollLeft && ev.velocityX > 0) {
                    return swipeDetector.stop();
                } else if (canScrollRight && ev.velocityX < 0) {
                    return swipeDetector.stop();
                }
            });
            swipeDetector.on("swipeleft", function() {
                SidenavTabs.goleft();
            });
            swipeDetector.on("swiperight", function() {
                SidenavTabs.goright();
            });
            /*globals MobileDragDrop*/
            MobileDragDrop.polyfill({
                holdToDrag: 650,
                noDebug: true,
                tryFindDraggableTarget: function(event) {
                    var el = event.target;
                    do {
                        if (
                            el.getAttribute &&
                            el.getAttribute("draggable") === "true"
                        ) {
                            return el;
                        }
                    } while ((el = el.parentNode) && el !== document.body);
                },
                dragImageTranslateOverride: MobileDragDrop
                    .scrollBehaviourDragImageTranslateOverride,
            });
            var dragger = new global.DragTabs($("#menu")[0], {
                selectors: {
                    tab: ".tab",
                },
            });
            dragger.on("end", function(e) {
                if (e.newIndex !== undefined) {
                    DocsTab.moveTab(
                        e.newIndex,
                        e.dragTab.getAttribute("data-tab")
                    );
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
                    DocsTab.moveTab(
                        e.newIndex,
                        e.dragTab.getAttribute("data-file")
                    );
                }
            });
        },
    }]);
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
    });
    //git
    Imports.add(["./core/app_cycle.js", {
        name: "Git Integration",
        script: "./tools/git/git.js",
        ignoreIf: !appConfig.enableGit,
    }]);
    //show diff
    Imports.add(["./core/storage/databasestorage.js", {
        name: "Diff Tooling",
        script: "./tools/diff/diff.js",
    }]);
    //tools fxmising
    Imports.add([{
        name: "Missing colons",
        script: "./tools/fix_colons.js", //dynamic
    }]);
    var searchConfig = global.registerAll({
            useRecyclerViewForSearchResults: true,
        },
        "search"
    );
    //SearchPanel
    Imports.add({
        script: "./ui/recycler.js",
        ignoreIf: !searchConfig.useRecyclerViewForSearchResults,
    }, "./ui/overlayMode.js", "./ui/rangeRenderer.js", {
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
            var SearchPanel = new global.SearchTab(
                $("#search_container"),
                $("#searchModal")
            );
            SearchPanel.init(global.SideView);
        },
    }, {
        name: "Preview",
        script: "./tools/preview_file.js",
    });
    //Add a tool
    //Adding a func argument ensures the function is executed
    //after the app is fully-loaded. I made this change in case I later
    //decide to bundle this functions also using a deferred script.
    //list as 
    /*
     * Imports.add([deps]); 
     */
}); /*_EndDefine*/