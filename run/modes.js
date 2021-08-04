_Define(function(global) {
    var Utils = global.Utils;
    var Docs = global.Docs;
    var FileUtils = global.FileUtils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var Imports = global.Imports;
    var getActiveDoc = global.getActiveDoc;
    var Functions = global.Functions;
    var configure = global.configure;
    var IsUrl = global.Schema.IsUrl;

    var appConfig = global.registerAll({
        allowLiveReload: true,
        splitPreview: true,
        commandServer: Env._server && Env._server + "/run",
        commandServerPassphrase: '',
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
        commandServerPassphrase: "Passphrase if present will be sent with command requests",
        runPath: "The url to preview on run when forceRun is set",
        // fiddleFolder: 'Folder containing files that will be run',
        // fiddleExclude: 'Glob for files to be excluded from fiddle. Note only supported file extensions are loaded html,js,css",
        forceRun: "The id of the preview mode (html,js,node,svg, or md)",
        folderPrefix: {
            type: "string|null",
            doc: "Use this to map file paths to server paths, eg name/index.html will be mapped to <runPath>/index.html if folderPrefix is name/"
        }
    }, "execute");
    var Notify = global.Notify;
    var createPreview = global.createPreview;
    var previewer;
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
        // execCommand- 
        if (editor && editor.session) {
            if (options && typeof(options) == "object") {
                if (typeof options.path == "string") {
                    path = options.path;
                    //If you options.path is passed,
                    //no further processing is performed on the path
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
            path = doc.getSavePath();
        }
        //forceRun Flag
        if (!forceRun && doc && doc.flags && doc.flags.forceRun) {
            forceRun = runModes[doc.flags.forceRun];
            if (!forceRun) Notify.info("Invalid preview flag: " + doc.flags.forceRun);
        }
        //App configuration
        if (!forceRun) {
            forceRun = runModes[appConfig.forceRun];
            if (forceRun && runPath) path = runPath;
        }


        if (forceRun) {
            return forceRun.run(path, doc);
        }
        //detect using file extension
        if (path) {
            if (/html?$/.test(path)) {
                return HTMLFilePreview.run(path, doc);
            } else if (path.endsWith(".md") || path.endsWith(".markdown")) {
                return MarkdownPreview.run(path, doc);
            } else if (path.endsWith(".svg")) {
                return SvgPreview.run(path, doc);
            }
        }
        //detect using mode
        if (
            doc &&
            doc.isTemp()) {
            var mode =
                doc.session.getMode().$id;
            if (mode.endsWith("javascript"))
                return BrowserRun.run(doc.getPath(), doc);
            else if (mode.endsWith("markdown")) {
                return MarkdownPreview.run(doc.getPath(), doc);
            } else if (mode.endsWith("html")) {
                return InBrowserPreview.run(doc.getPath(), doc);
            }
        }
        //Finally try lastRun
        if (appConfig.lastRun) {
            HTMLFilePreview.run(appConfig.lastRun);
        } else {
            Notify.info("No configuration set!!!");
        }
    };
    var HTMLFilePreview = {
        id: "html",
        name: "Webpage",
        run: function(path, doc) {
            //Add prefix folderPrefix, not added for execCommand path
            if (path.startsWith("temp:/")) {
                return InBrowserPreview.run(path, doc);
            }
            if (doc && appConfig.folderPrefix) {
                var runPath = path;
                path = doc.getSavePath();
                var folderPrefix = FileUtils.resolve(FileUtils.getProject().rootDir, appConfig
                    .folderPrefix);
                if (path && path.startsWith(folderPrefix)) {
                    path = FileUtils.join(runPath, path.substring(folderPrefix.length));
                }
            }
            if (IsUrl.invalid(path)) {
                //assume we were given a filepath
                var fs;
                if (doc) fs = doc.getFileServer();
                else fs = FileUtils.defaultServer;
                if (fs.href)
                    path = FileUtils.join(fs.href, path);
                else return InBrowserPreview.run(path, doc);
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
        run: function(path, doc) {
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
                    command: appConfig.buildCommand ? appConfig.buildCommand.replace("%",
                        doc && doc.getSavePath()) : "npm build",
                    currentDir: currentDir == FileUtils.NO_PROJECT ? "/" : currentDir,
                    password: appConfig.commandServerPassphrase
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
    //only called when running in iframe
    Preview.prototype.reload = function(frame /*,path, live*/ ) {
        this.wrapRun(this.doc.getValue(), frame);
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
        eruda: "<script src='./libs/js/eruda.min.js'></script><script type='text/javascript'>if(eruda){eruda.init(['console']);eruda._entryBtn.hide();}</script>",
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

    var InBrowserPreview = new Preview("iframe", "Snippet", function(code) {
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
    menu.extendOption(
        "load-settings", {
            subTree: {
                "run-as": {
                    icon: "play_arrow",
                    subIcon: "settings",
                    caption: "Run Options",
                    onclick: function() {
                        var modal = $(
                            Notify.modal({
                                header: "Preview Configuration",
                                large: true,
                                form: [{
                                        type: 'checkbox',
                                        name: 'run-in-split',
                                        caption: 'Live Preview',
                                        value: !!appConfig.splitPreview
                                    },
                                    {
                                        type: 'select',
                                        name: 'run-mode-select',
                                        caption: "Run as"
                                    }
                                ],
                                footers: ['Save']
                            })
                        );
                        var content = modal.find('.modal-content')[0];
                        content.appendChild(
                            global.Form.create([{
                                'type': 'text',
                                'name': 'preview-url',
                                caption: 'Force Preview Url'
                            }, {
                                type: 'checkbox',
                                'name': 'add-prefix',
                                'caption': 'Add filepath to url'
                            }, {
                                type: 'text',
                                name: 'prefix-path',
                                caption: 'Root directory'
                            }], $("<div class='config config-html'></div>")[0]));
                        content.appendChild(
                            global.Form.create([{
                                    type: 'text',
                                    caption: 'Server address',
                                    name: 'preview-server'
                                }, {
                                    caption: 'Server passphrase',
                                    type: 'text',
                                    name: 'preview-server-pass',
                                },
                                "<div><span class='blue-text'>%</span> is replaced with the current document path.</div>",

                                {
                                    type: 'text',
                                    caption: 'Build Command',
                                    name: 'preview-command',
                                },
                                {
                                    type: 'checkbox',
                                    caption: 'Disable preview',
                                    name: 'no-run',
                                },
                                {
                                    type: 'text',
                                    caption: 'Preview Url',
                                    name: 'run-preview-url'
                                }
                            ], $("<div class='config config-node'></div>")[0]));
                        var controller = modal.find('select');
                        controller.append("<option value='default'>Auto</option>");
                        for (var i in runModes) {
                            controller
                                .append(
                                    '<option value="' +
                                    i +
                                    ' ">' +
                                    runModes[i].name +
                                    "</option>"
                                );
                        }

                        function update() {
                            modal.find(".config").hide();
                            var config = modal.find(".config-" + controller.val());
                            config.show();
                        }
                        controller.change(update);

                        //Add path prefix
                        if (appConfig.folderPrefix == null) {
                            modal.find("#preview-prefix").val('./public/');
                            modal.find("#preview-prefix").attr('disabled', true);
                        } else {
                            modal.find("#preview-prefix").val(appConfig.folderPrefix);
                            modal.find("#add-prefix")[0].checked = true;
                        }
                        modal.find("#add-prefix").change(function() {
                            modal.find("#preview-prefix").attr('disabled', !this.checked);
                        });

                        modal.find("#preview-server").val(appConfig.commandServer);
                        modal.find("#preview-server-pass").val(appConfig.commandServerPassphrase);
                        modal.find("#run-preview-url").val(appConfig.runPath);
                        modal.find("#preview-url").val(appConfig.runPath);
                        modal
                            .find("#preview-command")
                            .val(appConfig.buildCommand || "npm build");

                        modal.find("#no-run")[0].checked = appConfig.runPath == "!norun";
                        modal.find("#run-preview-url").attr('disabled', appConfig.runPath == "!norun");
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
                                    configure(
                                        "commandServerPassphrase",
                                        $("#preview-server-pass").val(), "execute");
                                    runPath = modal.find("#no-run")[0].checked ? "!norun" :
                                        modal
                                        .find(
                                            "#run-preview-url")
                                        .val();
                                    configure("runPath", runPath, "execute");
                                    break;
                                case "html":
                                    runPath = modal.find("#preview-url").val();
                                    configure("runPath", runPath, "execute");
                                    console.log(modal.find("#add-prefix")[0].checked);
                                    if (modal.find("#add-prefix").attr('checked')) {
                                        configure("folderPrefix", modal.find("#preview-prefix")
                                            .val(), "execute");
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

            }
        },
        true
    );
}); /*_EndDefine*/