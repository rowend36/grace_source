_Define(function(global) {
    var Utils = global.Utils;
    var Docs = global.Docs;
    var FileUtils = global.FileUtils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var checkBox = global.styleCheckbox;
    var Imports = global.Imports;
    var getActiveDoc =
        global.getActiveDoc ||
        function() {
            return Docs.forSession(getEditor().session);
        };
    var Functions = global.Functions;
    var configure = global.configure;

    var appConfig = global.registerAll({
        allowLiveReload: true,
        splitPreview: true,
        commandServer: Env._server && Env._server + "/run",
        useIframePreview: !Env.newWindow,
        runPath: "",
        lastRun: "",
        buildCommand: "",
        forceRun: "",
    }, "execute");

    global.registerValues({
        "!root": "Supported document flags fl-runAs with any preview-mode (html,js,node,md",
        commandServer: "The url of the fileserver eg http://localhost:3000",
        lastRun: "no-user-config",
        runPath: "The url to preview on run when forceRun is set",
        // fiddleFolder: 'Folder containing files that will be run',
        // fiddleExclude: 'Glob for files to be excluded from fiddle. Note only supported file extensions are loaded html,js,css",
        forceRun: "The id of the preview mode (html,js,node or md)",
    }, "execute");
    var Notify = global.Notify;
    var createPreview = global.createPreview;
    var previewer;
    var schemes = /^(http|ftp|ssh)/;
    // var livePrev = window.location.origin;

    function preview(path, reloader) {
        var isFull = !appConfig.splitPreview;
        if (isFull) {
            if (Env.newWindow && !appConfig.useIframePreview) {
                return Env.newWindow(path);
            }
        }
        if (previewer) {
            previewer.setEditor(getEditor());
            if (previewer.isHidden()) previewer.show(isFull);
        } else {
            previewer = createPreview(getEditor());
            previewer.show(isFull);
        }
        previewer.setPath(path, reloader);
        if (!isFull && appConfig.allowLiveReload) {
            previewer.startLiveUpdate();
        } else previewer.stopLiveUpdate();
    }

    Functions.run = function(editor, options) {
        var runPath = appConfig.runPath;
        var forceRun = runModes[appConfig.forceRun];
        var doc;
        var path = "";
        if (options && typeof(options) == "object") { //execCommand
            if (typeof options.path == "string") {
                path = options.path;
            }
            if (options.forceRun) {
                forceRun = runModes[options.forceRun];
            }
        }
        if (forceRun && runPath) path = runPath;
        if (!path) {
            if (editor && editor.session /*from event*/ ) {
                doc = Docs.forSession(editor.session);
            } else {
                doc = getActiveDoc();
            }
            if (!doc) {
                return;
            }
            if (doc.flags && doc.flags.forceRun) {
                forceRun = runModes[doc.flags.forceRun];
                if (!forceRun) Notify.info("Invalid force run as value " + doc.flags.forceRun);
            }
            path = doc.getPath();
            if (!path) { //temporary doc
                path = "";
            }
        }
        if (forceRun) {
            forceRun.run(path);
        } else if (/html?$/.test(path)) {
            HTMLPreview.run(path);
        } else if (path.endsWith(".md")) {
            MarkdownPreview.run(path);
        } else if (
            doc &&
            doc.isTemp() &&
            doc.session.getMode().$id.endsWith("javascript")
        ) {
            BrowserRun.run(path);
        } else if (appConfig.lastRun) {
            HTMLPreview.run(appConfig.lastRun);
        } else {
            Notify.info("No path set!!!");
        }
    };

    var MarkdownPreview = {
        id: "md",
        name: "Markdown",
        run: Imports.define(
            ["preview/libs/markdown-it.js"],
            null,
            function(path) {
                var doc = Docs.forPath(path);
                if (doc) MarkdownPreview.wrapRun(doc.getValue());
                else
                    FileUtils.getDoc(path, null, MarkdownPreview.wrapRun, true);
            }
        ),
        wrapRun: function(value) {
            var md = window.markdownit();
            var code = md.render(value);
            preview("data:text/html," + encodeURIComponent(code), this);
        },
        reload: function(frame, value) {
            var md = window.markdownit();
            value = md.render(getActiveDoc().getValue());
            frame.contentDocument.open();
            frame.contentDocument.write(value);
            frame.contentDocument.close();
        },
    };
    var HTMLPreview = {
        id: "html",
        name: "Webpage",
        run: function(path) {
            //, errors, runMode, args, realpath, doc) {
            if (
                path.indexOf("localhost") < 0 &&
                path.indexOf(":") < 0 &&
                !schemes.test(path)
            ) {
                var fs;
                var doc = Docs.forPath(path);
                if (doc) fs = doc.getFileServer();
                else fs = FileUtils.defaultServer;
                if (fs.href)
                    path = FileUtils.join(fs.href, path);
                else return InBrowserPreview.run(path);
            }
            if (appConfig.lastRun != path)
                configure("lastRun", path, "execute");
            preview(path, this);
        },
        reload: function(preview, path, live) {
            var a = getActiveDoc();
            if (live) {
                Docs.saveDocs(a.id, function() {
                    preview.contentWindow.location.reload();
                });
            } else {
                if (path == a.getPath()) path = a.getSavePath();
                if (preview.src == path)
                    preview.contentWindow.location.reload();
                else preview.src = path;
            }
        },
    };
    var NodeRun = {
        id: "node",
        name: "Terminal",
        run: function(path) {
            //, errors, runMngr, args, realpath) {
            if (this.pending) return;
            this.pending = setTimeout(
                function() {
                    this.pending = null;
                }.bind(this),
                Utils.parseTime("5s")
            );
            //does not give failure
            var currentDir = FileUtils.getProject().rootDir;
            $.post(
                appConfig.commandServer, {
                    command: appConfig.buildCommand || "npm build",
                    currentDir: currentDir == FileUtils.NO_PROJECT ? "/" : currentDir
                },
                function(res) {
                    var result = JSON.parse(res);
                    if (result.output) {
                        console.log(result.output);
                        Notify.modal({
                            body: result.output
                        });
                    }
                    if (result.error) {
                        console.error(result.error);
                    }
                    if (NodeRun.pending) {
                        clearTimeout(NodeRun.pending);
                        NodeRun.pending = null;
                        if (path == "!norun") {
                            if (result.error) {
                                Notify.error(
                                    Array.isArray(result.error) ?
                                    result.error[0] :
                                    result.error.split("\n")[0]
                                );
                            }
                        } else preview(path);
                    }
                }
            );
        },
    };
    var InBrowserSnippets = {
        eruda: "<script src='./libs/js/eruda.min.js'></script><script type='text/javascript'>eruda.init(['console']);eruda._entryBtn.hide();eruda._devTools.toggle()</script>",
        log: "<script>function log(a){\n" +
            "if(typeof(a)=='object')a = JSON.stringify(a);\n" +
            "document.write(a+'<br/>')};\n</script>",
        fallbackConsole: "<script>if(!eruda){" +
            "window.onerror = function(a,b,c,d){\n" +
            "log('ERROR '+a+' at position: '+(c/*-NUM_LINES*/)+','+d);}\n" +
            "console.log=console.error=console.warn=log}</script>\n"
    };
    var BrowserRun = {
        id: "js",
        name: "Script",
        scriptStub: "",
        run: function(path) {
            this.path = path;
            var doc = Docs.forPath(path);
            if (doc) this.wrapRun(doc.getValue());
            else FileUtils.getDoc(path, null, this.wrapRun, true);
        },
        wrapRun: function(value) {
            var code = (this.code =
                "<html>" + this.scriptStub +
                "<script type='text/javascript'>eval(\"" +
                value
                .replace(/<\/script/g, "%SCR%ipt")
                .replace(/["\\]/g, "\\$&")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r") +
                '".replace(/%SCR%/g,"</scr"))</script></html>');
            var path = "data:text/html," + encodeURIComponent(code);
            this.inPreview = true;
            preview(path, this);
            this.inPreview = false;
            previewer.stopLiveUpdate();
        },
        reload: function(frame) {
            if (!this.inPreview) {
                return this.run(this.path);
            }
            frame.contentDocument.open();
            frame.contentDocument.write(this.code);
            frame.contentDocument.close();
        }
    };
    var InBrowserPreview = Object.create(BrowserRun);
    InBrowserPreview.wrapRun = function(code) {
        this.code = InBrowserSnippets.eruda + code;
        var path = "data:text/html," + encodeURIComponent(code);
        //we could resolve links but why??
        this.inPreview = true;
        preview(path, this);
        this.inPreview = false;
    };

    BrowserRun.scriptStub =
        InBrowserSnippets.eruda +
        InBrowserSnippets.log +
        InBrowserSnippets.fallbackConsole;
    BrowserRun.scriptStub = BrowserRun.scriptStub.replace(
        "NUM_LINES",
        BrowserRun.scriptStub.split("\n").length - 1 + ""
    );
    var runModes = {
        js: BrowserRun,
        md: MarkdownPreview,
        html: HTMLPreview,
        node: NodeRun,
    };

    global.preview = preview;
    global.runModes = runModes;
    FileUtils.registerOption("files", ["file"], "run-as", {
        caption: "Set as preview url",
        extension: "html",
        onclick: function(ev) {
            ev.preventDefault();
            configure("runPath", ev.filepath, "execute");
            configure("forceRun", HTMLPreview.id, "execute");
        },
    });
    Editors.addCommands([{
        name: "run",
        bindKey: {
            win: "F7",
            mac: "Command-Alt-N"
        },
        exec: Functions.run,
    }, ]);
    var menu = global.MainMenu;
    menu.addOption(
        "run-now", {
            icon: "play_arrow",
            caption: "Preview",
            onclick: Functions.run,
            sortIndex: 1000
        }, false);
    menu.addOption(
        "run-as", {
            icon: "play_arrow",
            caption: "Run Options",
            onclick: function(ev, id, el) {
                var modal = $(
                    Notify.modal({
                        header: "Preview Configuration",
                        type: 'form',
                        body: [
                            "<div id='run-config'>",
                            "<div class='h-30 mb-10'>",
                            "<input type='checkbox' name='run-in-split' id='run-in-split' " +
                            (appConfig.splitPreview ? "checked " : "") +
                            "/>",
                            "<span for='run-in-split'>Live Preview</span>",
                            "</div>",
                            "<div class='mb-10'>",
                            "<label for='run-mode-select'>Run as</label>",
                            "<select name='run-mode-select'>",
                            "<option value='default'>Auto</option>",
                            "</select>",
                            "</div>",
                            "<div class='config config-html'>",
                            "<label for='preview-url'>Force Preview Url</label>",
                            "<input name='preview-url' id='preview-url'/>",
                            "</div>",
                            "<div class='config config-node'>",
                            "<label for='preview-server'>Build Server</label>",
                            "<input name='preview-server' id='preview-server'/>",
                            "<label for='preview-command'>Build Command</label>",
                            "<input name='preview-command' id='preview-command'/>",
                            "<label for='run-preview-url'>Force Preview Url </label>",
                            "<input name='run-preview-url' id='run-preview-url'/>",
                            "<div class='h-30'>",
                            "<input type='checkbox' name='no-run' id='no-run'/>",
                            "<span for='no-run'>Disable preview</span>",
                            "</div>",
                            "</div>",
                        ].join("\n"),
                        footers: ['Done']
                    })
                );
                for (var i in runModes) {
                    modal
                        .find("select")
                        .append(
                            '<option value="' +
                            i +
                            ' ">' +
                            runModes[i].name +
                            "</option>"
                        );
                }
                checkBox(modal);
                modal.find("#no-run").change(function() {
                    modal
                        .find("#run-preview-url")
                        .attr("disabled", this.checked)
                        .val("!norun");
                });

                function update() {
                    modal.find(".config").hide();
                    modal.find(".config-" + modal.find("select").val()).show();
                }
                modal.find("select").change(update);
                modal.find("#preview-server").val(appConfig.commandServer);
                modal.find("#run-preview-url").val(appConfig.runPath);
                modal.find("#preview-url").val(appConfig.runPath);
                modal
                    .find("#preview-command")
                    .val(appConfig.buildCommand || "npm build");
                modal.find("#no-run").val(appConfig.runPath == "!norun");

                modal.submit(function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var id = modal.find("select").val();
                    configure(
                        "splitPreview",
                        modal.find("#run-in-split")[0].checked, "execute");
                    var runPath;
                    switch (id) {
                        case "node":
                            configure(
                                "buildCommand",
                                modal.find("#preview-command").val(), "execute");
                            configure(
                                "commandServer",
                                $("#preview-server").val(), "execute");
                            runPath = modal.find("#run-preview-url").val();
                            configure("runPath", runPath, "execute");
                            break;
                        case "html":
                            runPath = modal.find("#preview-url").val();
                            configure("runPath", runPath, "execute");
                            break;
                    }
                    configure("forceRun", id, "execute");
                    modal.modal("close");
                });
                if (runModes[appConfig.forceRun])
                    modal.find("select").val(appConfig.forceRun);
                else modal.find("select").val("default");
                update();
            },
        },
        true
    );
}); /*_EndDefine*/