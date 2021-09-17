_Define(function(global) {
    //Extra files in a simple import format
    //Such that bundling is also very easy,
    "use strict";
    var appEvents = global.AppEvents;
    var appConfig = global.appConfig;
    var Imports = global.BootList;
    //HttpServer brought up because of custom themes
    Imports.add(["./fileserver/httpfs.js"]);
    Imports.add([{
            name: "Confuguration",
            func: $.noop //bootlist insists we add something
        },
        "./prefs/config.js",
        "./prefs/key_binding.js"
    ]);
    Imports.add({
        //material colors
        name: "Material Colors",
        style: "./libs/css/materialize-colors.css",
    });
    Imports.add("./libs/js/brace-expansion.js");
    Imports.add("./core/glob.js");
    Imports.add("./prefs/linter_options.js", "./prefs/auto_settings.js");
    //runManager
    Imports.add({
        script: "./libs/js/splits.js",
    }, {
        script: "./ui/splits.js",
    }, {
        script: "./run/previewer.js",
    }, {
        name: "Creating run manager",
        script: "./run/modes.js"
    }, {
        name: "Enhanced Clipboard",
        script: "./tools/enhanced_clipboard.js",
    }, {
        func: function() {
            var button = $("#runButton");
            button.click(global.runCode); //defined in run/modes.js
            var hideRunButton;

            function update(ev) {
                var enable = appConfig.enableFloatingRunButton;
                if (ev) {
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
            }
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
            "./autocompletion/tags/async_tags.js",
            "./autocompletion/tags/regex_tags.js"
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
            if (!appConfig.disableOptimizedFileBrowser && global.RFileBrowser) {
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
            FileUtils.triggerForever("filebrowsers-loaded");
        },
    });

    //StatusBar SearchBox
    Imports.add({
        name: "SearchBox and Status", //Looks awful in landscape
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
                var refocus;

                function position() {
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
                                refocus = global.FocusManager.visit(
                                    global.FocusManager.activeElement
                                );
                                $(".content")[0].appendChild(SearchBox.element);
                                refocus();
                                inContent = true;
                            }
                            //in content overlapping and overflowing
                            el.style.top = editRect.top + "px";
                        } else {
                            //in editDiv, overlapping no overflow
                            if (inContent) {
                                refocus = global.FocusManager.visit(
                                    global.FocusManager.activeElement
                                );
                                editDiv.appendChild(el);
                                refocus();
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
                    } else {
                        //small editor height
                        if (!inContent) {
                            refocus = global.FocusManager.visit(
                                global.FocusManager.activeElement
                            );
                            $(".content")[0].appendChild(SearchBox.element);
                            refocus();
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
    }, {
        script: "./search/searchTab.js"
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