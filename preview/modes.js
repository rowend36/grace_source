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
        folderPrefix: null
    }, "execute");

    global.registerValues({
        "!root": "Supported document flags fl-runAs with any preview-mode (html,js,node,md,svg",
        commandServer: "The url of the fileserver eg http://localhost:3000",
        lastRun: "no-user-config",
        runPath: "The url to preview on run when forceRun is set",
        // fiddleFolder: 'Folder containing files that will be run',
        // fiddleExclude: 'Glob for files to be excluded from fiddle. Note only supported file extensions are loaded html,js,css",
        forceRun: "The id of the preview mode (html,js,node,svg, or md)",
        folderPrefix: "Use this to map file paths to server paths, eg name/index.html will be mapped to <runPath>/index.html if folderPrefix is name/"
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
        var forceRun;
        var doc;
        var path = "";
        // execCommand- If you pass a options.path,
        //      no further processing is performed on the path
        if (editor && editor.session) {
            if (options && typeof(options) == "object") {
                if (typeof options.path == "string") {
                    path = options.path;
                    doc = null;
                }
                if (options.forceRun) {
                    doc = Docs.forSession(editor.session);
                    forceRun = runModes[options.forceRun];
                }
            }
        } else {
            //Default: from mouseevent
            doc = getActiveDoc();
        }
        //forceRun Flag
        if (!forceRun && doc && doc.flags && doc.flags.forceRun) {
            forceRun = runModes[doc.flags.forceRun];
            if (!forceRun) Notify.info("Invalid force run as value " + doc.flags.forceRun);
        }
        //App configuration
        if (!forceRun) {
            forceRun = runModes[appConfig.forceRun];
            if (forceRun && runPath) path = runPath;
        }
        //Add prefix unless it was in option.path
        if (runPath && doc && appConfig.folderPrefix && forceRun == HTMLFilePreview) {
            path = doc.getSavePath();
            var folderPrefix = FileUtils.resolve(FileUtils.getProject().rootDir, appConfig.folderPrefix);
            if (path && path.startsWith(folderPrefix)) {
                path = FileUtils.join(runPath, path.substring(folderPrefix.length));
            } else path = appConfig.lastRun;
        }
        if (!path && !doc) return;
        if (!forceRun && /html?$/.test(path || doc.getSavePath() || "")) {
            forceRun = HTMLFilePreview;
            path = path || doc.getSavePath();
        } else if (!path) {
            path = doc.getPath() || "";
        }
        if (forceRun) {
            forceRun.run(path, doc);
        } else if (path.endsWith(".md") || path.endsWith(".markdown")) {
            MarkdownPreview.run(path, doc);
        } else if (path.endsWith(".svg")) {
            SvgPreview.run(path, doc);
        } else if (
            doc &&
            doc.isTemp() &&
            doc.session.getMode().$id.endsWith("javascript")
        ) {
            BrowserRun.run(path, doc);
        } else if (appConfig.lastRun) {
            HTMLFilePreview.run(appConfig.lastRun);
        } else {
            Notify.info("No configuration set!!!");
        }
    };
    var HTMLFilePreview = {
        id: "html",
        name: "Webpage",
        run: function(path, doc) {
            if (path.startsWith("temp:/")) {
                return InBrowserPreview.run(path);
            } else if (
                path.indexOf("localhost") < 0 &&
                path.indexOf(":") < 0 &&
                !schemes.test(path)
            ) {
                var fs;
                doc = doc || Docs.forPath(path);
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
                    preview.src = path + "#" + new Date().getTime();
                });
            } else {
                preview.src = path + "#" + new Date().getTime();
            }
        },
    };

    var TerminalPreview = {
        id: "node",
        name: "Terminal",
        run: function(path) {
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
                    if (TerminalPreview.pending) {
                        clearTimeout(TerminalPreview.pending);
                        TerminalPreview.pending = null;
                    }
                    var result = JSON.parse(res);
                    if (result.output) {
                        console.log(result.output);
                        if (path == "!norun") {
                            if (result.output)
                                Notify.modal({
                                    body: result.output
                                });
                        }
                    }
                    if (result.error) {
                        console.error(result.error);
                        Notify.modal({
                            header: "Error",
                            body: Array.isArray(result.error) ?
                                result.error.join("\n") : result.error
                        });
                    } else if (path != "!norun") preview(path);
                }
            );
        },
    };

    function Preview(id, name, transformFunc) {
        this.id = id;
        this.name = name;
        this.wrapRun = function(content, frame) {
            var value = transformFunc.call(this, content);
            if (frame) {
                frame.contentDocument.open();
                frame.contentDocument.write(value);
                frame.contentDocument.close();
            } else preview("data:text/html," + encodeURIComponent(value), this);
        };
    }
    Preview.prototype.run = function(path, doc) {
        doc = doc || Docs.forPath(path);
        if (doc) {
            this.doc = doc;
            this.wrapRun(doc.getValue());
        } else
            FileUtils.getDoc(path, null, this.wrapRun, true);
    };
    Preview.prototype.reload = function(frame, path, live) {
        //if (live && this.doc) {
        //Iframes do not load data scripts for some reason
        this.wrapRun(this.doc.getValue(), frame);
        //}
        // else if (preview.src == path) {
        //     preview.contentWindow.reload();
        // } else {
        //     preview.src = path;
        // }
    };
    var MarkdownPreview = new Preview("md", "Markdown", function(value) {
        var md = window.markdownit();
        return md.render(value);
    });
    MarkdownPreview.run = Imports.define(
        ["preview/libs/markdown-it.js"],
        null,
        Preview.prototype.run
    );
    var InBrowserSnippets = {
        eruda: "<script src='./libs/js/eruda.min.js'></script><script type='text/javascript'>eruda.init(['console']);eruda._entryBtn.hide();</script>",
        log: "<script>function log(a){\n" +
            "if(typeof(a)=='object')a = JSON.stringify(a);\n" +
            "document.write(a+'<br/>')};\n</script>",
        fallbackConsole: "<script>if(!eruda){" +
            "window.onerror = function(a,b,c,d){\n" +
            "log('ERROR '+a+' at position: '+(c/*-NUM_LINES*/)+','+d);}\n" +
            "console.log=console.error=console.warn=log}</script>\n"
    };
    var BrowserRun = new Preview("js", "Script", function(value) {
        return (
            "<html>" + this.scriptStub +
            "<script type='text/javascript'>eval(\"" +
            value
            .replace(/<\/script/g, "%SCR%ipt")
            .replace(/["\\]/g, "\\$&")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r") +
            '".replace(/%SCR%/g,"</scr"))</script></html>');

    });
    BrowserRun.scriptStub =
        InBrowserSnippets.log +
        InBrowserSnippets.fallbackConsole;
    BrowserRun.scriptStub = BrowserRun.scriptStub.replace(
        "NUM_LINES",
        BrowserRun.scriptStub.split("\n").length - 1 + ""
    );

    var InBrowserPreview = new Preview("br", "Snippet", function(code) {
        return InBrowserSnippets.eruda + code;

    });
    var SvgPreview = new Preview("svg", "Svg", function(code) {
        return "<html>" + code + "</html>";
    });

    var runModes = {
        js: BrowserRun,
        md: MarkdownPreview,
        html: HTMLFilePreview,
        node: TerminalPreview,
        svg: SvgPreview
    };

    global.preview = preview;
    global.runModes = runModes;
    FileUtils.registerOption("files", ["file"], "run-as", {
        caption: "Set as preview url",
        extension: "html",
        onclick: function(ev) {
            ev.preventDefault();
            configure("runPath", ev.filepath, "execute");
            configure("forceRun", HTMLFilePreview.id, "execute");
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
                            "<label for='run-mode-select'>Run as</label>",
                            "<select class='mb-10' name='run-mode-select'>",
                            "<option value='default'>Auto</option>",
                            "</select>",
                            "<div class='clearfix'></div>",
                            "<div class='mb-10 config config-html'>",
                            "<label for='preview-url'>Force Preview Url</label>",
                            "<input class='mb-10' name='preview-url' id='preview-url'/>",
                            "<div class='h-30 mb-10'>",
                            "<input type='checkbox' name='add-prefix' id='add-prefix'/>",
                            "<span for='add-prefix'>Add Path To Url</span>",
                            "</div>",
                            "<label for='preview-prefix'>Prefix to strip from path</label>",
                            "<input name='preview-prefix' id='preview-prefix'/>",
                            "</div>",
                            "<div class='config config-node'>",
                            "<label for='preview-server'>Build Server</label>",
                            "<input class='mb-10' name='preview-server' id='preview-server'/>",
                            "<label for='preview-command'>Build Command</label>",
                            "<input class='mb-10' name='preview-command' id='preview-command'/>",
                            "<label for='run-preview-url'>Force Preview Url </label>",
                            "<input class='mb-10' name='run-preview-url' id='run-preview-url'/>",
                            "<div class='h-30'>",
                            "<input class='mb-10' type='checkbox' name='no-run' id='no-run'/>",
                            "<span for='no-run'>Disable preview</span>",
                            "</div>",
                            "</div></div>",
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

                function update() {
                    modal.find(".config").hide();
                    modal.find(".config-" + modal.find("select").val()).show();
                }
                modal.find("select").change(update);

                //Add path prefix
                if (appConfig.folderPrefix == null) {
                    modal.find("#preview-prefix").val('./public/');
                    modal.find("#preview-prefix").attr('disabled', true);
                } else {
                    modal.find("#preview-prefix").val(appConfig.folderPrefix);
                    modal.find("#add-prefix")[0].checked = true;
                }
                modal.find("#add-prefix").change(function() {
                    modal.find("#preview-prefix").attr('disabled', !this.checked).focus();
                });

                modal.find("#preview-server").val(appConfig.commandServer);
                modal.find("#run-preview-url").val(appConfig.runPath);
                modal.find("#preview-url").val(appConfig.runPath);
                modal
                    .find("#preview-command")
                    .val(appConfig.buildCommand || "npm build");

                modal.find("#no-run")[0].checked = appConfig.runPath == "!norun";
                modal.find("#no-run").change(function() {
                    modal
                        .find("#run-preview-url")
                        .attr("disabled", this.checked)
                        .focus();
                });

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
                            runPath = modal.find("#no-run").checked?"!norun":modal.find("#run-preview-url").val();
                            configure("runPath", runPath, "execute");
                            break;
                        case "html":
                            runPath = modal.find("#preview-url").val();
                            configure("runPath", runPath, "execute");
                            console.log(modal.find("#add-prefix")[0].checked);
                            if (modal.find("#add-prefix").attr('checked')) {
                                configure("folderPrefix", modal.find("#preview-prefix").val(), "execute");
                            } else configure("folderPrefix", null, "execute");
                            break;
                    }
                    configure("forceRun", id, "execute");
                    if (previewer) {
                        previewer.hide();
                    }
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