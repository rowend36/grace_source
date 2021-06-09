_Define(function(global) {
    var Utils = global.Utils;
    var Docs = global.Docs;
    var SplitManager = global.SplitManager;
    var watchTheme = global.watchTheme;
    var AutoCloseable = global.AutoCloseable;

    function createIcon(id, name) {
        return "<button style='width:35px' id='" + id + "' class='material-icons'>" + name +
            "</button>";
    }

    function loadConsole(win, loadOnly) {
        if (win.eruda) {
            if (!loadOnly) {
                win.eruda._devTools.toggle();
            }
            win.eruda._entryBtn.hide();
        } else {
            $.get({
                url: "./libs/js/eruda.min.js",
                success: function(res) {
                    var script = res;
                    win.eval(script);
                    if (win.eruda) {
                        win.eruda.init(win.erudaPanes || []);
                        loadConsole(win);
                    }
                }
            });
        }
    }

    function createNavBar(navBar, icons, prefix) {
        navBar.className = "editor-primary";
        navBar.style.position = "absolute";
        navBar.style.top = '0px';
        navBar.style.width = '100%';
        var iconLeft = Math.min(4, icons.length) * 35 + 5;
        var addressBar = document.createElement("div");
        addressBar.setAttribute("readOnly", true);
        addressBar.style.position = "absolute";
        addressBar.style.left = "5px";
        addressBar.style.top = "5px";
        addressBar.style.width = "";
        addressBar.style.minWidth = '150px';
        addressBar.style.height = "30px";
        addressBar.style.background = "rgba(180,180,180,128)";
        addressBar.style.border = "2px solid #2196F3";
        addressBar.style.borderRadius = "15px";
        addressBar.style.right = iconLeft + "px";
        addressBar.style.overflow = "hidden";
        addressBar.style.overflowX = 'auto';
        addressBar.style.lineHeight = "30px";
        addressBar.style.paddingLeft = "10px";
        addressBar.style.color = "#444444";

        navBar.appendChild(addressBar);
        var iconContainer = document.createElement('div');
        iconContainer.style.background = 'inherit';
        iconContainer.style.zIndex = '1';
        iconContainer.style.position = 'relative';
        iconContainer.style.float = 'right';
        iconContainer.style.height = '100%';
        iconContainer.style.width = iconLeft + "px";
        iconContainer.style.overflow = 'auto';
        iconContainer.style.whiteSpace = 'nowrap';
        iconContainer.style.maxWidth = "100%";
        for (var i in icons) {
            $(iconContainer).append(createIcon((prefix || "") + icons[i].id, icons[i]
            .icon));
        }
        navBar.appendChild(iconContainer);
        return {
            addressBar: addressBar,
            iconContainer: iconContainer
        };
    }

    function inJavascriptMode(editor) {
        return getCurrentMode(editor) == 'javascript';
    }

    function getCurrentMode(editor) {
        var scope = editor.session.$mode.$id || "";
        scope = scope.split("/").pop();
        if (scope === "html" || scope === "php") {
            if (scope === "php") scope = "html";
            var c = editor.getCursorPosition();
            var state = editor.session.getState(c.row);
            if (typeof state === "object") {
                state = state[0];
            }
            if (state.substring) {
                if (state.substring(0, 3) == "js-") scope = "javascript";
                else if (state.substring(0, 4) == "css-") scope = "css";
                else if (state.substring(0, 4) == "php-") scope = "php";
            }
        }
        return scope;
    }

    function inSafeJs(editor) {
        var pos = editor.getSelectionRange().end;
        if (editor.session.getTokenAt(pos.row, pos.column).type == "string") {
            if (editor.session.getLength() > (pos.row + 5) && editor.session.getLine(pos
                    .row).length > pos.column + 1)
                return true
        }
        return false
    }

    function checkInCssHtmlOrString(editor) {
        if (!inJavascriptMode(editor)) { //|| inSafeJs(editor)) {
            return true;
        } else {
            return false;
        }
    }

    global.createPreview = function(edit) {
        var previewContainer = document.createElement("div");
        previewContainer.style.paddingTop = '35px';

        var navBar = createNavBar(
            $(previewContainer).append("<div style='width:100%;height:35px'></div>")
            .children().last()[0], [{
                id: "backward",
                icon: "keyboard_arrow_left"
            }, {
                id: "forward",
                icon: "keyboard_arrow_right"
            }, {
                id: "reload",
                icon: "refresh"
            }, {
                id: "close",
                icon: "close"
            }, {
                id: "console",
                icon: "bug_report"
            }, {
                id: "full",
                icon: "fullscreen"
            }, {
                id: "desktop",
                icon: "computer"
            }, {
                id: "zoom",
                icon: "zoom_out"
            }], "preview-"
        );
        previewContainer.className = "preview";
        var preview = document.createElement('iframe');
        previewContainer.appendChild(preview);
        navBar.iconContainer.onclick = function(e) {
            var win = preview.contentWindow;
            switch (e.target.getAttribute("id").substring(8)) {
                case "backward":
                    win.history.back();
                    break;
                case "forward":
                    win.history.forward();
                    break;
                case "console":
                    loadConsole(win);
                    break;
                case "reload":
                    updatePreview(false);
                    break;
                case "close":
                    hide();
                    break;
                case "zoom":
                    $(previewContainer).toggleClass('preview-zoom');
                    break;
                case "desktop":
                    if (!$(previewContainer).toggleClass('preview-desktop')
                        .hasClass('preview-container')) {
                        $(previewContainer).removeClass('preview-zoom');
                    }
                    break;
                case "full":
                    if (isFull) {
                        show(false);
                        e.target.innerHTML = "fullscreen"
                    } else {
                        e.target.innerHTML = "fullscreen_exit"
                        show(true);
                    }
                    break;
            }
        };
        var addressBar = navBar.addressBar;


        var path = "";
        var live = false;
        var hot = false;
        var isFull = false;
        var hidden = true;
        var editor = null;
        var reloader, container;
        var splitMode;
        //preview.contentWindow.location = window.location.origin
        var liveUpdatePreview = Utils.debounce(function() {
            if (checkInCssHtmlOrString(editor))
                updatePreview(true);
        }, 1000);

        function getSplitMode(container) {
            return container.clientWidth > Math.min(container.clientHeight, 720) ?
                "horizontal" : "vertical";
        }

        function updatePreview(live) {
            if (reloader) {
                reloader.reload(preview, path, live);
            } else {
                preview.src = path;
            }

        }

        function setEditor(edit) {
            if (editor == edit) {
                return;
            } else {
                if (live) {
                    if (editor)
                        stopLiveUpdate();
                    editor = edit;
                    startLiveUpdate();
                } else {
                    editor = edit;
                    updatePreview();
                }
            }
        }

        function stopLiveUpdate() {
            live = false;
            editor.off("change", liveUpdatePreview);
        }

        function startLiveUpdate() {
            live = true;
            editor.on("change", liveUpdatePreview);
        }

        function hide() {
            hidden = true;
            if (isFull) {
                if (isFull == true)
                    previewContainer.className = "preview";
                previewContainer.parentNode.removeChild(previewContainer);
                AutoCloseable.remove("preview");
            } else {
                container = null;
                SplitManager.remove($(previewContainer));
            }
            stopLiveUpdate();
        }
        if (edit) {
            setEditor(edit);
        }

        function show(full) {
            /*possible values are
             *DOMElement: use as container
             *true: means document.body,
             *false: means split,
             *undefined: means current container || split
             */
            if (full === undefined) {
                full = isFull;
            }
            if (!hidden) {
                if (isFull != full)
                    hide();
                else
                    return;
            }
            watchTheme($(previewContainer));
            if (full === true) {
                container = document.body;
                previewContainer.className += " fullscreen";
            } else if (full) {
                container = full;
            } else {
                full = false;
                container = SplitManager.add($(editor.container), splitMode ||
                    getSplitMode(editor.container));
            }
            if (full) {
                AutoCloseable.add("preview", {
                    close: hide
                });
            }
            hidden = false;
            container.appendChild(previewContainer);
            isFull = full;
        }

        var API = {
            isHidden: function() {
                return hidden;
            },
            show: show,
            hide: hide,
            setSplitDirection: function(dir) {
                if (splitMode == dir) return;
                else {
                    splitMode = dir;
                    if (!(hidden || isFull)) {
                        hide();
                        show();
                    }
                }
            },
            setEditor: setEditor,
            stopLiveUpdate: stopLiveUpdate,
            startLiveUpdate: startLiveUpdate,
            container: previewContainer,
            setPath: function(p, reload) {
                path = p;
                addressBar.innerHTML = p;
                reloader = reload;
                updatePreview(false);
            }
        };
        return API;
    }
}); /*_EndDefine*/