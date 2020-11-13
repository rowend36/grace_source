(function(global) {
    var docs = global.docs;
    var Utils = global.Utils;
    var Overflow = global.Overflow;
    var Doc = global.Doc;
    var FileUtils = global.FileUtils;
    var getEditor = global.getEditor;
    var AutoCloseable = global.AutoCloseable;
    var getActiveDoc = global.getActiveDoc || function() {
        return Doc.forSession(getEditor().session);
    };
    var appConfig = global.appConfig;
    var appStorage = global.appStorage;
    var configure = global.configure;
    var runPaths = {};
    var runArgs = {};
    var pathMap = {};

    function getRunPath(id) {
        return runPaths[id] || docs[id].getSavePath() || "";
    }

    function getRunArgs(id) {
        return runArgs[id] || "";
    }

    function saveRunConfig(runMngr) {
        var data = {
            runPaths: runPaths,
            runArgs: runArgs,
            config: (function(l) {
                var b = {};
                for (var i in l) {
                    if (l[i]) b[i] = l[i].id;
                }
                return b;
            })(runMngr.getConfigs())
        };
        if(runMngr.lastRun){
            data.lastRun = runMngr.lastRun.id;
            data.lastPath = runMngr.lastPath;
        }
        appStorage.setItem('runConfig', JSON.stringify(data));
    }

    function loadRunConfig(runMngr) {
        var data = appStorage.getItem('runConfig');
        if (!data) return;
        data = JSON.parse(data);
        runPaths = data.runPaths;
        runArgs = data.runArgs;
        var loadedAll = true;
        for (var i in data.config) {
            var runMode = pathMap[data.config[i]];
            if (docs[i] && runMode)
                runMngr.setConfig(i, runMode.runMode);
            else loadedAll = false;
        }
        runMngr.lastPath = data.lastPath;
        runMngr.lastRun = pathMap[data.lastRun] && pathMap[data.lastRun].runMode;
        return loadedAll;
    }
    var runConfigs = {};
    var createRunModeOption = function(runMngr,id, caption, onchange) {
        return {
            caption: caption,
            onclick: function() {
                var currentDoc = getActiveDoc();
                if (currentDoc)
                    runMngr.setConfig(currentDoc.id, pathMap[id] && pathMap[id].runMode);
                saveRunConfig(runMngr);
                onchange();
            }
        };
    };
    var createConfigOption = function(config, caption, onchange) {
        return {
            caption: "<span class = " + (appConfig[config] ? "''" : "'red-text'") + " >" + caption + "</span>",
            className: appConfig[config] ? "" : "red-text",
            onclick: function() {
                configure(config, !appConfig[config]);
                onchange();
            }
        };
    };
    var inputDialog = null,
        input, header, onchange,isOpen =false,queued=[];
    var ENTER = 13,ESC=27;
    var createInputDialog = function(caption, onchang, getValue) {
        if (!inputDialog) {
            var dialog = "<h6 class='modal-header'></h6>" +
                "<div class='modal-content'>" +
                "<input></input>" +
                "</div><div class='modal-footer'>" +
                "<a href='#!' class='modal-close waves-effect waves-green btn-flat'>Cancel</a>" +
                "<a href='#!' class='modal-done modal-close waves-effect waves-green btn-flat'>Done</a>" +
                "</div>";
            var creator = document.createElement('div');
            creator.innerHTML = dialog;
            creator.className = 'modal';
            creator.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            input = creator.getElementsByTagName('input')[0];
            input.addEventListener('keypress', function(e) {
                switch (e.keyCode) {
                    case ENTER:
                        onchange(this.value);
                        inputDialog.modal('close');
                        break;
                }
            });
            header = creator.getElementsByClassName('modal-header')[0];
            var save = creator.getElementsByClassName('modal-done')[0];
            save.addEventListener('click', function() {
                onchange(input.value);
            });

            document.body.appendChild(creator);
            inputDialog = $(creator).modal({
                onCloseStart: function() {
                    if (queued.length) {
                        setTimeout(function() {
                            var item = queued.shift();
                            inputDialog.modal('open');
                            input.value = item.pop()()||"";
                            onchange = item.pop();
                            header.innerHTML = item.pop();
                        },20);
                    }
                    else isOpen = false;
                },
                onCloseEnd: AutoCloseable.onCloseEnd,
                onOpenEnd: AutoCloseable.onOpenEnd
            });
        }
        return {
            caption: caption,
            onclick: function() {
                Dropdown.hide();
                if (!isOpen) {
                    isOpen = true;
                    inputDialog.modal('open');
                    header.innerHTML = caption;
                    input.value = getValue()||"";
                    onchange = onchang;
                }
                else queued.push([caption, onchange, getValue]);
            }
        };
    };

    var Dropdown = new Overflow();

    var getRunConfigHier = function(runMngr) {
        function update() {
            getRunConfigHier(runMngr);
            saveRunConfig(runMngr);
        }
        for (var i in pathMap) {
            runConfigs[i] = createRunModeOption(runMngr,i, "Run as " + i.substring(5), update);
        }
        runConfigs['mode-default'] = createRunModeOption(runMngr,null, "Use Default", update);

        var hier = {
            "runInSplit": createConfigOption('splitPreview', 'Run in split', update),
            "runMode": {
                caption: "Run Mode",
                childHier: runConfigs,
            },
            "setRunPath": createInputDialog("Set execution path", function(val) {
                runPaths[getActiveDoc().id] = val;
                saveRunConfig(runMngr);
            }, function() {
                return runPaths[getActiveDoc()];
            })
        };
        var runmode = runMngr.getConfig(getActiveDoc().id);
        if((runmode || runMngr.findRunModeFor(getRunPath(getActiveDoc().id))||{}).hasArgs){
            hier.setRunArgs = createInputDialog("Set execution command", function(val) {
                runArgs[getActiveDoc().id] = val;
                saveRunConfig(runMngr)
            }, function() {
                return runArgs[getActiveDoc()];
            })
        }
        var id = (runmode && runmode.id) || 'mode-default';
        hier.runMode.childHier[id].caption = "<span class='red'>" + hier.runMode.childHier[id].caption + "</span>";
        Dropdown.setHierarchy(hier);
    };
    global.RunMode = function(window) {
        var loadedAll;
        var errors = new Utils.CBuffer(200);
        var configs = {};
        this.register = function(paths, runMode) {
            pathMap[runMode.id] = { runMode: runMode, paths: paths };
        };
        this.reload = function() {
            if (!loadedAll) loadedAll = loadRunConfig(this);
        };
        this.unregister = function(runMode) {
            delete pathMap[runMode.id];
        };
        this.executeDoc = function(doc) {
            var path = getRunPath(doc.id);
            var args = getRunArgs(doc.id);
            this.isCurrentDoc = (doc.id == getActiveDoc());
            return this.execute(path, args, doc.getSavePath(),doc);
        };
        this.configure = function(el) {
            getRunConfigHier(this);
            Dropdown.show(el);
        };
        this.execute = function(path, args, realpath,doc) {
            var runMode;
            if (doc && configs[doc.id]) {
                runMode = configs[doc.id];
            }
            else runMode = this.findRunModeFor(path);
            if (runMode) {
                runMode.run(path, errors, this, args, realpath,doc);
                if (this.lastRun != runMode || this.lastPath != path) {
                    this.lastRun = runMode;
                    this.lastPath = path;
                    saveRunConfig(this);
                }
            }
            else if (this.lastRun && this.lastRun.canRun && this.lastRun.canRun(path)) {
                this.lastRun.run(this.lastPath, errors, this, args, realpath,doc);
            }
            else return false;
            return true;
        };
        this.setConfig = function(id, route) {
            configs[id] = route;
        };
        this.findRunModeFor = function(path) {
            var extension = path.substring(path.lastIndexOf(".") + 1);
            if (extension) {
                for (var i in pathMap) {
                    if (pathMap[i].paths.indexOf(extension) > -1 &&
                        (!pathMap[i].runMode.canRun || pathMap[i].runMode.canRun(path, this))) {
                        return pathMap[i].runMode;
                    }
                }
            }
        };
        this.getConfig = function(id) {
            return configs[id];
        };
        this.getConfigs = function() {
            return configs;
        };
    };
})(Modules);