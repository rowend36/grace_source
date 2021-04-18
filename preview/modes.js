_Define(function(global) {
    var docs = global.docs;
    var Utils = global.Utils;
    var Docs = global.Docs;
    var FileUtils = global.FileUtils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var checkBox = global.styleCheckbox;
    var getActiveDoc = global.getActiveDoc || function() {
        return Docs.forSession(getEditor().session);
    };
    var Functions = global.Functions;
    var appStorage = global.appStorage;
    var configure = global.configure;
    var appConfig = global.registerAll({
        "allowLiveReload": true,
        "splitPreview": true,
        "commandServer": Env._server && Env._server+"/run",
        "useIframePreview": !Env.newWindow,
        "runPath": "",
        "lastRun": "",
        "buildCommand": "",
        "forceRun": ""
    });
    global.registerValues({
        "commandServer": "The url of the fileserver eg http://localhost:3000"
    });
    var Notify = global.Notify;
    var createPreview = global.createPreview;
    var previewer;
    var schemes = /^(http|ftp|ssh)/;
    var livePrev = window.location.origin;


    function preview(path, reloader) {
        var isFull = !appConfig.splitPreview;
        if (isFull) {
            if (Env.newWindow && !appConfig.useIframePreview) {
                return Env.newWindow(path);
            }
            else console.log(Env.newWindow ,appConfig.useIframePreview);
        }
        if (previewer) {
            previewer.setEditor(getEditor());
            if (previewer.isHidden())
                previewer.show(isFull);
        }
        else {
            previewer = createPreview(getEditor());
            previewer.show(isFull);
        }
        previewer.setPath(path, reloader);
        if (!isFull && appConfig.allowLiveReload) {
            previewer.startLiveUpdate();
        }
        else previewer.stopLiveUpdate();
    }

    var runPath = appConfig.runPath;
    var lastRun = appConfig.lastRun;
    var buildCommand = appConfig.buildCommand;
    
    
    Functions.run = function(editor) {
        var path;
        var doc;
        if (runPath)
            path = runPath;
        else {
            if (typeof(editor) == ace.Editor) {
                doc = Docs.forSession(editor.session);
            }
            else {
                doc = getActiveDoc();
            }
            if (!doc) {
                return;
            }
            path = doc.getPath();
            if(!path){
                path = "";
            }
        }
        if (forceRun) {
            forceRun.run(path);
        }
        else if (/html?$/.test(path)) {
            if (lastRun != path) {
                lastRun = path;
                configure("lastRun", path);
            }
            HTMLPreview.run(path);
        }
        else if (path.endsWith(".md")) {
            MarkdownPreview.run(path);
        }
        else if(doc && doc.isTemp() && doc.options.mode.endsWith("javascript")){
            BrowserRun.run(path);
        }
        else if (lastRun) {
            HTMLPreview.run(lastRun);
        }
        else {
            Notify.info('No path set!!!');
        }

    };
    FileUtils.registerOption("files", ["file"], "run-as", {
        caption: "Set as preview url",
        extension: "html",
        onclick: function(ev) {
            ev.preventDefault();
            var path = ev.filepath;
            runPath = path;
            forceRun = HTMLPreview;
            configure("runPath",runPath);
            configure("forceRun",HTMLPreview.id);
        }
    });
    Editors.addCommands([{
        name: "run",
        bindKey: { win: "F7", mac: "Command-Alt-N" },
        exec: Functions.run
    }]);
    var menu = global.MainMenu;
    menu.addOption('run-as', {
        icon: 'build',
        caption: 'Build/Run',
        onclick: function(ev, id, el) {
            var modal = $(Notify.modal({
                header: "Preview Configuration",
                body: ["<div id='run-config'>",
                    "<form>",
                    "<div class='h-30 pb-10'>",
                    "<input type='checkbox' name='run-in-split' id='run-in-split' " + (appConfig.splitPreview ? "checked " : "") + "/>",
                    "<span for='run-in-split'>Live Preview</span>",
                    "</div>",
                    "<span>Run as </span>",
                    "<select>",
                    "<option value='default'>Auto</option>",
                    "</select>",
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
                    "<div class='modal-footer'>",
                    "<input type='submit' class='btn' value='Done'/>",
                    "</div>",
                    "</form>"
                ].join("\n")
            }));
            for (var i in runModes) {
                modal.find('select').append("<option value=\"" + i + " \">" + runModes[i].name + "</option>");
            }
            checkBox(modal);
            modal.find("#no-run").click(function() {
                modal.find('#run-preview-url').attr('disabled', this.checked).val("!norun");
            });

            function update() {
                modal.find(".config").hide();
                modal.find(".config-" + modal.find('select').val()).show();
            }
            modal.find('select').change(update);
            modal.find("#preview-server").val(appConfig.commandServer);
            modal.find("#run-preview-url").val(runPath || lastRun);
            modal.find("#preview-url").val(runPath || lastRun);
            modal.find("#preview-command").val(buildCommand || "npm build");
            modal.find("#no-run").val(runPath == "!norun");

            modal.find('form').submit(function(e) {
                e.stopPropagation();
                e.preventDefault();
                var id = modal.find('select').val();
                configure("splitPreview", modal.find("#run-in-split")[0].checked);
                switch (id) {
                    case "default":
                        runPath = "";
                        forceRun = null;
                        break;
                    case "node":
                        forceRun = NodeRun;
                        buildCommand = modal.find("#preview-command").val();
                        configure("buildCommand", buildCommand);
                        configure("commandServer",$("#preview-server").val());
                        runPath = modal.find("#run-preview-url").val();
                        break;
                    case "html":
                        runPath = modal.find("#preview-url").val();
                        forceRun = HTMLPreview;
                        break;
                    default:
                        runPath = null;
                        forceRun = runModes[id];

                }
                configure("forceRun", id);
                configure("runPath", runPath);
                modal.modal('close');
            });
            if (forceRun) modal.find('select').val(forceRun.id);
            else modal.find('select').val('default');
            update();
        }
    }, true);
    var MarkdownPreview = {
        id: "md",
        name: "Markdown",
        run: function(path) {
            var doc = Docs.forPath(path);
            if (doc) this.wrapRun(doc.getValue());
            else FileUtils.getDoc(path, null, this.wrapRun, true);
        },
        wrapRun: function(value) {
            var md = window.markdownit();
            var code = md.render(value);
            preview("data:text/html," + encodeURI(code), this);
        },
        reload: function(frame, value) {
            var md = window.markdownit();
            value = md.render(getActiveDoc().getValue());
            frame.contentDocument.open();
            frame.contentDocument.write(value);
            frame.contentDocument.close();
        }
    };
    var HTMLPreview = {
        id: "html",
        name: "Webpage",
        run: function(path) { //, errors, runMode, args, realpath, doc) {
            if (path.indexOf("localhost") < 0 && path.indexOf(":") < 0 && !schemes.test(path)) {
                var fs;
                var doc = Docs.forPath(path);
                if (doc) fs = doc.getFileServer();
                else fs = FileUtils.defaultServer;
                path = FileUtils.join(fs.href, path);
            }
            preview(path, this);
        },
        reload: function(preview, path, live) {
            var a = getActiveDoc();
            if (live) {
                Docs.saveDocs(a.id, function() {
                    preview.contentWindow.location.reload();
                });
            }
            else {
                if(path == a.getPath())path=a.getSavePath();
                if (preview.src == path) preview.contentWindow.location.reload();
                else preview.src = path;
            }
        }

    };
    var NodeRun = {
        id: 'node',
        name: 'Terminal',
        run: function(path) { //, errors, runMngr, args, realpath) {
            if (this.pending) return;
            this.pending = setTimeout(function() {
                this.pending = null;
            }, Utils.parseTime('5s'));
            //does not give failure
            $.post(appConfig.commandServer, {
                command: buildCommand || "npm build",
                currentDir: FileUtils.getProject().rootDir
            }, function(res) {
                var result = JSON.parse(res);
                if (result.output) {
                    console.log(result.output);
                }
                if (result.error) {
                    console.error(result.error);
                }
                if (NodeRun.pending) {
                    clearTimeout(NodeRun.pending);
                    NodeRun.pending = null;
                    if (path == "!norun") {
                        if (result.error) {
                            Notify.error(Array.isArray(result.error) ? result.error[0] : result.error.split("\n")[0]);
                        }
                    }
                    else preview(path);
                }
            });
        }
    };
    var BrowserRun = {
        id: "js",
        name: "Script",
        scriptStub: "",
        run: function(path) {
            var doc = Docs.forPath(path);
            if (doc) this.wrapRun(doc.getValue());
            else FileUtils.getDoc(path, null, this.wrapRun, true);
        },
        wrapRun: function(value) {
            var code = this.code = this.scriptStub + "<script type='text/javascript'>eval(\"" + value.replace(/<\/script/g, "%SCR%ipt").replace(/["\\]/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + "\".replace(/%SCR%/g,\"</scr\"))</script>";
            var path = "data:text/html," + encodeURIComponent(code);
            preview(path, this);
            this.code = null;
            previewer.stopLiveUpdate();
        },
        reload: function(frame, value, live) {
            if (live) {
                return;
            }
            frame.contentDocument.open();
            frame.contentDocument.write(this.code);
            frame.contentDocument.close();
        }
    };
    BrowserRun.scriptStub =
        "<script>" +
        "function log(a){\n" +
        "if(typeof(a)=='object')a = JSON.stringify(a);\n" +
        "document.write(a+'<br/>')};\n" +
        "window.onerror = function(a,b,c,d){\n" +
        "log('ERROR '+a+' at position: '+(c/*-NUM_LINES*/)+','+d);}\n" +
        "console.log=console.error=console.warn=log</script>\n";
    BrowserRun.scriptStub = BrowserRun.scriptStub.replace('NUM_LINES', BrowserRun.scriptStub.split("\n").length - 1);
    var runModes = {
        "js": BrowserRun,
        "md": MarkdownPreview,
        "html": HTMLPreview,
        "node": NodeRun
    };
    var forceRun = runModes[appConfig.forceRun];

    global.preview = preview;
    global.runModes = runModes;
})/*_EndDefine*/