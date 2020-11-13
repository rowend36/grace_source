(function(global) {
    //how to move this elsewhere;
    //without creating setEditor code
    //Preview
    registerAll({
        "allowLiveReload": true,
        "splitPreview": true
    });
    var runMngr = new RunMode(window);
    var previewer;
    
    //globals
    var getEditor,currentDoc;
    var HTMLPreview = {
        id: "mode-html",
        run: function(path, errors, runMode) {
            if (!appConfig.splitPreview) {
                if (Env.newWindow) {
                    Env.newWindow(path);

                }
                else this.runInWindow(path, errors, runMode)
            }
            else {
                this.runInSplit(path, errors, runMode);
            }
        },
        canRun: function(path, mngr) {
            return true;
        },
        runInWindow: function(path, errors, runMngr) {
            if (previewer) {
                previewer.setEditor(getEditor());
                if (previewer.isHidden())
                    previewer.show(true);
            }
            else {
                previewer = createPreview(getEditor());
                previewer.show(true);
            }
            previewer.setPath(path);

        },
        runInSplit: function(path, errors, runMngr) {
            var live = appConfig.allowLiveReload && runMngr.isCurrentDoc;
            if (previewer) {
                previewer.setEditor(getEditor());
                if (previewer.isHidden())
                    previewer.show();
            }
            else {
                previewer = createPreview(getEditor());
                previewer.show();
            }
            previewer.setPath(path);
            if (live)
                previewer.startLiveUpdate();
            else
                previewer.stopLiveUpdate();
        }
    };
    var NodeRun = {
        id: 'mode-node',
        run: function(path, errors, runMngr, args) {
            $.post(appConfig._server + "/run/", {
                command: args || "npm build",
                currentDir: _hierarchy.rootDir + _hierarchy.hier[0]
            }, function(res) {
                var result = JSON.parse(res);
                if (result.error) {
                    console.error(result.error);
                }
                if (result.output) {
                    console.log(result.output);
                }
                HTMLPreview.run(path, errors, runMngr);

            });
            //todo fileserver.exec
        }
    }
    var JSRun = {
        id: "mode-browser",
        paths: {},
        scriptStub: "",
        canRun: function(path) {
            return this.paths[currentDoc];
        },
        run: function(path, errors, runMngr) {
            var code = this.scriptStub + "<script>" + docs[currentDoc].getValue() + "</script>";
            path = "data:text/html," + encodeURIComponent(code);
            this.runInSplit(path, errors, runMngr);
            previewer.stopLiveUpdate();
        },
        runInSplit: HTMLPreview.runInSplit
    };
    JSRun.scriptStub = "<script>function log(a){\n" +
        "if(typeof(a)=='object')a = JSON.stringify(a);\n" +
        "document.write(a+'\\n')};\n" +
        "window.onerror = function(a,b,c,d){\n" +
        "log('ERROR '+a+' at position'+(c-NUM_LINES)+','+d);}\n" +
        "console.log=console.error=console.warn=log</script>\n";
    JSRun.scriptStub = JSRun.scriptStub.replace('NUM_LINES', JSRun.scriptStub.split("\n").length - 1);
    runMngr.register(["html"], HTMLPreview);
    runMngr.register(["js"], JSRun);
    runMngr.register([], NodeRun);
    var runPaths = {};
    var runArgs = {};

    function getRunPath(id) {
        return runPaths[id] || (FileUtils.getFileServer(docs[id].fileServer) || _fileServer).href + docs[id].getSavePath() || "";
    }

    function getRunArgs(id) {
        return runArgs[id] || "";
    }

    function saveRunConfig() {
        var data = {
            lastRun: runMngr.lastRun.id,
            lastPath: runMngr.lastPath,
            runPaths: runPaths,
            runArgs: runArgs,
            config: (function(l) {
                var b = {}
                for (var i in l) {
                    if (l[i]) b[i] = l[i].id
                }
                return b
            })(runMngr.getConfigs())
        }
        appStorage.setItem('runConfig', JSON.stringify(data));
    }

    function loadRunConfig() {
        var data = appStorage.getItem('runConfig');
        if (!data) return;
        data = JSON.parse(data);
        runPaths = data.runPaths;
        runArgs = data.runArgs;
        var map = {
            "mode-browser": JSRun,
            "mode-html": HTMLPreview,
            "mode-node": NodeRun
        }
        runMngr.lastPath = data.lastPath,
            runMngr.lastRun = map[data.lastRun];
        for (var i in data.config) {
            var runMode = map[data.config[i]]
            runMngr.setConfig(i, runMode);

        }
    }
    Functions.run = function(editor) {
        var doc;
        if (typeof(editor) == ace.Editor) {
            doc = Doc.forPath(editor.path).id;
            runMngr.isCurrentDoc = (doc == currentDoc);
        }
        else {
            doc = currentDoc;
            runMngr.isCurrentDoc || (runMngr.isCurrentDoc = true);
        }
        var path = getRunPath(doc);
        var args = getRunArgs(doc);
        if (!runMngr.execute(path, args)) {
            Notify.info('No run configuration');
        }
        else {
            if (runMngr.needsSave) {
                saveRunConfig();
                runMngr.needsSave = false;
            }
        }
    };
    var runConfig = [];
    var runConfigDropdown = new Overflow();
    var getRunConfigHier = function() {
        var hier = {
            "runInSplit": {
                caption: "<span class = " + (appConfig.splitPreview ? "" : "red-text") + ">Live Preview</span>",
                className: appConfig.splitPreview ? "" : "red-text",
                onclick: function() {
                    configure("splitPreview", !appConfig.splitPreview);
                    runConfigDropdown.setHierarchy(getRunConfigHier());
                }
            },
            "runMode": {
                caption: "Run Mode",
                childHier: {
                    "mode-html": {
                        caption: "Run as html",
                        onclick: function() {
                            runMngr.setConfig(getRunPath(currentDoc), HTMLPreview);
                            saveRunConfig();
                            runConfigDropdown.setHierarchy(getRunConfigHier());
                        }
                    },
                    "mode-browser": {
                        caption: "Run as script",
                        onclick: function() {
                            runMngr.setConfig(getRunPath(currentDoc), JSRun);
                            saveRunConfig();
                            runConfigDropdown.setHierarchy(getRunConfigHier());
                        }
                    },
                    "mode-node": {
                        caption: "Run as Node(needs fileserver)",
                        onclick: function() {
                            runMngr.setConfig(getRunPath(currentDoc), NodeRun);
                            saveRunConfig();
                            runConfigDropdown.setHierarchy(getRunConfigHier());
                        }
                    },
                    "mode-default": {
                        caption: "Default",
                        onclick: function() {
                            runMngr.setConfig(getRunPath(currentDoc), null);
                            saveRunConfig();
                            runConfigDropdown.setHierarchy(getRunConfigHier());

                        }
                    }
                },
            },
            "setRunPath": {
                caption: "Set Run Path",
                childHier: {
                    "runpath-input": {
                        caption: "<input value='" + (runPaths[currentDoc] || docs[currentDoc].getSavePath()) + "'></input>"
                    },
                    "back": {
                        caption: "Done",
                        onclick: function() {
                            runPaths[currentDoc] = $("#runpath-input").children().val();
                            saveRunConfig()
                        }
                    }
                }
            },
            "setRunArgs": {
                caption: "Set Run Arguments",
                childHier: {
                    "runargs-input": {
                        caption: "<input value='" + (runArgs[currentDoc] || "") + "'></input>"
                    },
                    "back": {
                        caption: "Done",
                        onclick: function() {
                            runArgs[currentDoc] = $("#runargs-input").children().val();
                            saveRunConfig()
                        }
                    }
                }
            }
        }
        var runmode = runMngr.getConfig(getRunPath(currentDoc));

        var id = (runmode && runmode.id) || 'mode-default';
        hier.runMode.childHier[id].caption = "<span class='red'>" + hier.runMode.childHier[id].caption + "</span>";
        return hier;

    }
})(Modules);