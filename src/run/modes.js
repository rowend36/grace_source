_Define(function(global) {
    var Docs = global.Docs;
    var FileUtils = global.FileUtils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var getActiveDoc = global.getActiveDoc;
    var configure = global.configure;

    var appConfig = global.registerAll({
        allowLiveReload: true,
        previewMode: 'split',
        useIframePreview: !Env.newWindow,
        runPath: "",
        lastRun: "",
        buildCommand: "",
        forceRun: "",
        folderPrefix: null
    }, "execute");

    global.registerValues({
        lastRun: "no-user-config",
        useIframePreview: Env.newWindow?"Allows running code using current window rather than opening a new window.":"no-user-config",
        previewMode: {
            doc: 'If useIframePreview is enabled, set how iframe should be positioned',
            values: [
                ['split', 'Split screen into two parts'],
                ['tab', 'Put in a separate tab'],
                ['overlay', 'Show as overlay window']
            ]
        },
        runPath: "The url to preview. If not set, it defaults to the currently open document.",
        folderPrefix: {
            type: "string|null",
            doc: "Use this to map file paths to server paths, eg name/index.html will be mapped to <runPath>/index.html if folderPrefix is name/"
        }
    }, "execute");
    var Notify = global.Notify;
    var createPreview = global.createPreview;
    var previewer;
    var viewModes = [
        'split',
        'overlay',
        'tab'
    ];

    function preview(path, reloader) {
        if (Env.newWindow && !appConfig.useIframePreview) {
            return Env.newWindow(path);
        }
        var viewMode = viewModes.indexOf(appConfig.previewMode);
        if(viewMode<0){
            viewMode = 0;
        }
        if (previewer) {
            previewer.setEditor(getEditor());
            if (previewer.isHidden()) previewer.show(viewMode);
        } else {
            previewer = createPreview(getEditor());
            previewer.show(viewMode);
        }
        previewer.setPath(path, reloader);
        if (viewMode !== 1 && appConfig.allowLiveReload) {
            previewer.startLiveUpdate();
        } else previewer.stopLiveUpdate();
    }

    global.runCode = function(editor, options) {
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
            if(doc)
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
            var ext = FileUtils.extname(path);
            for (var i in runModes) {
                if (runModes[i].extensions && runModes[i].extensions[ext]) {
                    return runModes[i].run(path, doc);
                }
            }
        }
        //detect using mode if it's an unsaved document
        if (
            doc &&
            doc.isTemp()) {
            var mode =
                doc.session.getMode().$id;
            for (var m in runModes) {
                if (runModes[m].modes && runModes[m].modes[mode]) {
                    return runModes[m].run(doc.getPath(), doc);
                }
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
        extensions: {
            'html': true,
            'htm': true,
            'xhtml': true
        },
        modes: {
            'ace/mode/html': true
        },
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
            if (path.indexOf(':/') < 0) {
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
        getConfig: function() {
            return [{
                'type': 'text',
                'name': 'preview-url',
                caption: 'Force Preview Url',
                value: appConfig.runPath
            }, {
                type: 'checkbox',
                'name': 'add-prefix',
                'caption': 'Add filepath to url'
            }, {
                type: 'text',
                name: 'prefix-path',
                caption: 'Root directory'
            }];
        },
        onConfigChanged: function(data) {
            configure("runPath", data.runPath, "execute");
            if (data['add-prefix']) {
                configure("folderPrefix", data['preview-prefix'], "execute");
            } else configure("folderPrefix", null, "execute");

        }
    };


    function Preview(id, name, transformFunc) {
        this.id = id;
        this.name = name;
        this.transform = transformFunc;
        this.$setDoc = (function(doc) {
            this.doc = doc;
            var value = this.transform(doc.getValue());
            preview("./preview.html?html=" + encodeURIComponent(btoa(value)), this);
        }).bind(this);
    }
    Preview.prototype.run = function(path, doc) {
        doc = doc || Docs.forPath(path);
        if (doc) {
            this.$setDoc(doc);
        } else
            FileUtils.getDoc(path, null, this.$setDoc, true);
    };
    //only called when running in iframe
    var previewPath = location.origin + FileUtils.join(location.pathname.replace('/index.html', ''),
        'preview.html');
    Preview.prototype.reload = function(frame, path, live) {
        var value = this.transform(this.doc.getValue());
        if (live && frame.contentWindow && frame.contentWindow.location.pathname == previewPath) {
            frame.contentWindow.postMessage({
                'action': 'reload',
                'type': 'html',
                'data': value
            }, location.origin);
        } else frame.src = previewPath + "?html=" + encodeURIComponent(btoa(value));
    };
    var InBrowserSnippets = {
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
    BrowserRun.modes = {
        'ace/mode/javascript': true
    };
    BrowserRun.scriptStub =
        InBrowserSnippets.log +
        InBrowserSnippets.fallbackConsole;
    BrowserRun.scriptStub = BrowserRun.scriptStub.replace(
        "NUM_LINES",
        BrowserRun.scriptStub.split("\n").length - 1 + ""
    );

    var InBrowserPreview = new Preview("iframe", "Snippet", function(code) {
        return code;

    });
    InBrowserPreview.modes = {
        'ace/mode/html': true
    };
    var runModes = {
        js: BrowserRun,
        html: HTMLFilePreview
    };
    global.BasePreview = Preview;
    global.preview = preview;
    global.registerRunMode = function(id, mode) {
        if (mode)
            runModes[id] = mode;
        global.registerValues({
            "!root": "Supported document flags fl-runAs with any preview mode e.g " + Object.keys(
                runModes).join(', '),
            forceRun: {
                doc: "The id of the preview mode",
                values: Object.keys(runModes)
            },
        });
    };
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
        exec: global.runCode,
    }, ]);
    var menu = global.MainMenu;
    menu.addOption(
        "run-now", {
            icon: "play_arrow",
            caption: "Preview",
            onclick: global.runCode,
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
                                        value: !appConfig.useIframePreview
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
                        var controller = modal.find('select');
                        controller.append("<option value='default'>Auto</option>");
                        for (var i in runModes) {
                            if (runModes[i].getConfig) {
                                content.appendChild(
                                    global.Form.create(runModes[i].getConfig(), $(
                                        "<div class='config config-" + i + "'></div>")[0]));
                            }
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

                        //Todo Perharps Add basic behaviours to Form.create
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

                        modal.find("#run-preview-url").attr('disabled', appConfig.runPath == "!norun");
                        modal.find("#no-run").change(function() {
                            modal
                                .find("#run-preview-url")
                                .attr("disabled", this.checked)
                                .focus();
                        });


                        if (runModes[appConfig.forceRun])
                            modal.find("select").val(appConfig.forceRun);
                        else modal.find("select").val("default");
                        update();
                        modal.submit(function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            var id = modal.find("select").val();
                            configure(
                                "useIframePreview",
                                !modal.find("#run-in-split")[0].checked, "execute");
                            var data = global.Form.parse(modal[0]);
                            if (runModes[id] && runModes[id].getConfig) {
                                runModes[id].onConfigChanged(data);
                            }
                            configure("forceRun", id, "execute");
                            if (previewer) {
                                previewer.hide();
                            }
                            modal.modal("close");
                        });
                    },
                },

            }
        },
        true
    );
}); /*_EndDefine*/
_Define(function(global) {
    var Utils = global.Utils;
    var preview = global.preview;
    var FileUtils = global.FileUtils;
    var appConfig = global.allConfigs.execute;
    var configure = global.configure;
    var Notify = global.Notify;
    global.registerValues({
        commandServer: "The url of the fileserver eg http://localhost:3000",
        commandServerPassphrase: "Passphrase if present will be sent with command requests",
    });
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
                    try{
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
                    catch(e){
                        console.log(e,res);
                        Notify.error('Invalid output received from server');
                    }
                }
            );
        },
        getConfig: function() {
            return [{
                    type: 'text',
                    caption: 'Server address',
                    name: 'preview-server',
                    value: appConfig.commandServer
                }, {
                    caption: 'Server passphrase',
                    type: 'text',
                    name: 'preview-server-pass',
                    value: appConfig.commandServerPassphrase
                },
                "<div><span class='blue-text'>%</span> is replaced with the current document path.</div>",

                {
                    type: 'text',
                    caption: 'Build Command',
                    name: 'preview-command',
                    value: appConfig.buildCommand || "npm build"
                },
                {
                    type: 'checkbox',
                    caption: 'Disable preview',
                    name: 'no-run',
                    value: appConfig.runPath == "!norun"
                },
                {
                    type: 'text',
                    caption: 'Preview Url',
                    name: 'run-preview-url',
                    value: appConfig.runPath
                }
            ];
        },
        onConfigChanged: function(data) {
            configure(
                "buildCommand",
                data['preview-command'], "execute");
            configure(
                "commandServer",
                data["preview-server"], "execute");
            configure(
                "commandServerPassphrase",
                data["preview-server-pass"], "execute");
            var runPath = data["no-run"] ? "!norun" :
                data["run-preview-url"];
            configure("runPath", runPath, "execute");
        }
    };
    global.registerRunMode('node', TerminalPreview);
});
_Define(function(global) {
    var Preview = global.BasePreview;
    var Imports = global.Imports;
    var MarkdownPreview = new Preview("md", "Markdown", function(value) {
        return this.md.render(value);
    });
    MarkdownPreview.extensions = {
        'md': true,
        'markdown': true
    };
    MarkdownPreview.modes = {
        'ace/mode/markdown': true
    };
    MarkdownPreview.run = Imports.define(
        ["preview/libs/markdown-it.js"],
        function() {
            MarkdownPreview.md = window.markdownit();
        },
        Preview.prototype.run
    );
    global.registerRunMode('md', MarkdownPreview);
});
_Define(function(global) {
    var Preview = global.BasePreview;
    global.registerAll({
        commandServer: Env._server && Env._server + "/run",
        commandServerPassphrase: '',
    });
    var SvgPreview = new Preview("svg", "Svg", function(code) {
        return "<html>" + code + "</html>";
    });
    SvgPreview.extensions = {
        'svg': true
    };
    global.registerRunMode('svg', SvgPreview);
});