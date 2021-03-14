_Define(function(global) {
    var appEvents = global.AppEvents;
    var getEditor = global.getEditor;
    var FileUtils = global.FileUtils;
    var MainMenu = global.MainMenu;
    var Utils = global.Utils;
    var BootList = global.BootList;
    var FileLoader = global.FileLoader;
    var Tags = global.TagCompleter;
    var configure = global.configure;
    var docs = global.docs;
    var Doc = global.Doc;
    var Functions = global.Functions;
    var Notify = global.Notify;
    var configEvents = global.configEvents;
    
    var providers = global.Completions;
    var Editors = global.Editors;

    var appConfig = global.registerAll({
        "autoLoadOpenDocs": true,
        "completionTimeout": "auto",
        "enableTypescript": true,
        "enableTern": true,
        "loadFileList": "",
        "maxAutoLoadSize": "5mb",
        "functionHintOnlyOnBoundaries": true,
        "maxSingleFileSize": "2mb",
        "maxAutoLoadTime": "30s",
        "tagsToLoad": "",
    }, "autocompletion");
    global.registerValues({
        'autocompletion': 'Configure ternjs, typescript and Gtags autocompletion engines\nTo disable autocompletion entirely, see editors.enableBasicAutocompletion',
        'enableTern': 'Use ternjs engine for javascript. Takes precedence over typescript for pure javascript files if enabled',
        'enableTypescript': 'Supports js,jsx,ts,tsx files',
        'maxSingleFileSize': 'Prevent editor from hanging on autocompletion by setting this',
        'functionHintOnlyOnBoundaries': "When enabled, function hints will only show at ',' and beginning of argument list",
        'tagsToLoad': 'Comma separated list of files containing list of glob paths to load automatically for tag completion',
        'loadFileList': "Comma separated list of files containing list of glob paths to load automatically for intellisense completion",
        'maxAutoLoadSize': 'The maximum total size of files to load into memory',
        'maxAutoLoadTime': 'The maximum total time load files into memory. Prevents background loading from hanging editor',
    }, "autocompletion");

    var fileLoader = new FileLoader({
        maxCount: Infinity,
        maxSize: Utils.parseSize(appConfig.maxAutoLoadSize),
        parallel: 3
    });
    var loadedFiles = [];


    configEvents.on("autocompletion", function(e) {
        var BaseServer = global.BaseServer;
        switch (e.config) {
            case "loadFileList":
                loadFiles(function() {
                    Notify.info('Files Loaded');
                });
                break;
            case 'maxSingleFileSize':
                if (BaseServer) BaseServer.prototype.maxSize = Utils.parseSize(e.newValue);
                break;
            case 'functionHintOnlyOnBoundaries':
                if (!BaseServer) return;
                if (e.newValue)
                    BaseServer.prototype.functionHintTrigger = ',()';
                else BaseServer.prototype.functionHintTrigger = null;
        }
    });

    //load a bunch of filelists
    //the list defaults to appConfig.loadFileList
    //the lsp defaults to a combo of current smartCompleter and tags
    var loadFiles = Utils.single(function(cb, lsp, list) {
        var a = getEditor();
        var loadTags, loadLsp;
        if (!lsp) {
            lsp = (a.smartCompleter && a[a.smartCompleter.name]);
            loadTags = !!Tags;
            loadLsp = (lsp && lsp !== Tags);
        } else if (lsp == Tags) {
            loadTags = !!Tags;
        } else {
            loadLsp = true;
        }
        var toLoad = [];
        var uniq = {};
        var p = FileUtils.getProject();
        if (loadLsp) {
            lsp.docChanged(a);
            var lspLoad = (list || Utils.parseList(appConfig.loadFileList));
            for (var o in lspLoad) {
                var s = lspLoad[o];
                var isAbsolute = s[0] == "/";
                var path = FileUtils.normalize(isAbsolute ? s : FileUtils.join(p.rootDir, s));
                if (!uniq[path]) {
                    toLoad.push((uniq[path] = [path, true, false, isAbsolute]));
                }
            }
        }
        if (loadTags) {
            var tagLoad = Utils.parseList(appConfig.tagsToLoad);
            for (var o in tagLoad) {
                var s = tagLoad[o];
                var isAbsolute = s[0] == "/";
                var path = FileUtils.normalize(isAbsolute ? s : FileUtils.join(p.rootDir, s));
                if (!uniq[path]) {
                    toLoad.push((uniq[path] = [path, false, true, isAbsolute]));
                } else {
                    uniq[path][2] = true;
                    if (isAbsolute) uniq[path][3] = true;
                }
            }
        }
        //todo make merge list use this algorithm

        var loaded = {};
        var server = p.fileServer;
        var activeOp;
        //For each config file
        var loadFile = Utils.throttle(fileLoader.loadFile.bind(fileLoader), 70);

        function doLoad(item, i, readNextFile, stopReading) {
            var configFilePath = item[0];
            var commonRoot = item[3] ? server.getRoot() : p.rootDir;

            //Read and parse the file
            server.readFile(configFilePath, "utf8", function(e, res) {
                if (e || !res) return readNextFile();
                res = global.stripComments(res);
                var config = JSON.parse(res);
                commonRoot = config.rootDir || commonRoot;
                var extension = new RegExp(config.extensions.map(Utils.regEscape).join("$|") + "$");

                //Walk each folder in each folder
                //todo, commonRoot easier to find by not 
                //merging folders, remove walk, maybe
                Utils.asyncForEach(config.folders, function(res, i, nextFolder, stopLoadin) {
                    var match = FileUtils.globToWalkParams(Utils.parseList(res).join(","));
                    var dirmatch = match.dir;
                    var base = match.root;
                    match = match.file;
                    activeOp = loadFiles.cancel = FileUtils.walk({
                        dir: FileUtils.join(commonRoot, base),
                        fs: server,
                        map: function(name, go, stopWalking, isDir, fileList, data) {
                            name = base + name;
                            if (isDir) {
                                return dirmatch.test(name);
                            }
                            if (!extension.test(name)) return false;
                            if (!match.test(name)) return false;
                            var path = FileUtils.join(commonRoot, name);
                            if (loaded[path]) {
                                return true;
                            }
                            //load the file
                            loadFile(path, server, function(e, res) {
                                loaded[path] = true;
                                if (!e && res) {
                                    if (item[1])
                                        lsp.addDoc(path, res, true);
                                    if (item[2])
                                        Tags.loadTags(path, res, true);
                                } else if (e && (e.reason == "size" || e.reason == "count")) {
                                    return stopLoadin();
                                }
                                return go(); //load next file
                            });
                        },
                        finish: function(res, stopped) {
                            if (stopped) stopLoadin();
                            else nextFolder();
                        },
                        failOnError: false
                    });
                }, function(stopped) {
                    if (stopped)
                        stopReading();
                    else readNextFile();

                }, 0, false, true);
            });
        }
        fileLoader.setSize(0, 0);
        var timeout = Utils.parseTime(appConfig.maxAutoLoadTime);
        if (timeout > 0) {
            setTimeout(function() {
                if (activeOp) {
                    activeOp();
                    console.log("Timed Out");
                }
            }, timeout);
        }
        Utils.asyncForEach(toLoad, doLoad, function() {
            console.debug('Server Load', Utils.toSize(fileLoader.getSize().size));
            if (loadFiles.cancel == activeOp) {
                loadFiles.cancel = null;
            }
            activeOp = null;
            cb && cb();
        }, null, false, true);
    });

    function getFile(name, cb) {
        var doc = global.getActiveDoc();
        var server = doc ? doc.getFileServer() : FileUtils.defaultServer;
        if (!name.startsWith("/")) name = "/" + name;
        fileLoader.loadFile(name, server, cb);
    }

    function getFileName(s) {
        var doc = Doc.forSession(s);
        if (doc)
            return doc.getPath();
    }

    function onCreateDoc(doc) {
        if (Tags)
            Tags.loadTags(doc.getSavePath() || doc.getPath(), doc.getValue());
    }

    function onCloseDoc(doc) {
        var tern = global.ternCompletionProvider;
        if (tern && tern.instance && tern.instance.hasDoc(doc.session))
            tern.instance.addDoc(doc.getPath(), doc.getValue(), false);
        var ts = global.tsCompletionProvider;
        if (ts && ts.instance && ts.instance.hasDoc(doc.session))
            ts.instance.addDoc(doc.getPath(), doc.getValue(), false);
        if (Tags && Tags.hasDoc(doc.session));
        Tags.delDoc(doc.getPath());
    }


    MainMenu.addOption("reload-project", {
        close: true,
        icon: "autorenew",
        caption: "Reload Completions",
        onclick: loadFiles.bind(null, function() {
            Notify.info('Reloaded');
        }, null, null)
    }, true);

    var reduceLoad = Utils.delay(function(e) {
        //clear servers on pause
        var editor = getEditor();
        loadFiles.cancel && loadFiles.cancel();
        var tern = global.ternCompletionProvider;
        if (tern) {
            providers.removeCompletionProvider(tern);
            tern.destroy();
        }
        var ts = global.tsCompletionProvider;
        if (ts) {
            providers.removeCompletionProvider(ts);
            ts.destroy();
        }
        var tern = global.ternCompletionProvider;
        if (tern) {
            providers.removeCompletionProvider(tern);
            tern.destroy();
        }
        if (Tags) Tags.clear();
        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        appEvents.once('app-resumed', resumeLoad)
    }, 10000);

    function resumeLoad(e) {
        var BaseServer = global.BaseServer;
        if (BaseServer) {
            BaseServer.prototype.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
            if (appConfig.functionHintOnlyOnBoundaries)
                BaseServer.prototype.functionHintTrigger = ',()';
            else BaseServer.prototype.functionHintTrigger = null;
        }
        var ts = global.tsCompletionProvider;
        if (ts)
            providers.addCompletionProvider(ts, ["javascript", "jsx", "typescript", "tsx"]);

        var tern = global.ternCompletionProvider;
        if (tern)
            providers.addCompletionProvider(tern, ["javascript"]);

        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        loadFiles();

        for (var i in docs) {
            onCreateDoc(docs[i]);
        }
        appEvents.on('createDoc', function(e) {
            onCreateDoc(e.doc);
        });
        appEvents.on('closeDoc', function(e) {
            onCloseDoc(e.doc);
        });
        appEvents.once('app-paused', reduceLoad);
    }
    appEvents.on("fully-loaded", function() {
        var extensions = new BootList(resumeLoad);
        appEvents.on('app-resumed', reduceLoad.cancel);
        //the servers are separate files so
        //if in future, they grow too big,
        //we can load asynchronously by wrapping
        //init with BootList.define
        //also, we can make a common superClass
        //later though it is more likely, we will
        //eventually drop tern Support
        if (appConfig.enableTern) {
            extensions.push(
                "./autocompletion/tern/ternClient.js",
                "./autocompletion/tern/ternProvider.js");
        }
        if (appConfig.enableTypescript) {
            extensions.push("./autocompletion/typescript/tsClient.js",
                "./autocompletion/typescript/tsProvider.js"
            );
        }
        extensions.next();
    });
    //Replace this with a modal
    FileUtils.registerOption("project", ["project"], "load-comp", "Generate Config", function(ev) {
        var e = ev.filepath;
        var server = ev.browser.fileServer;
        var a = getEditor();
        Notify.prompt("Enter file extensions separated by commas/space", function(ans) {
            if (!ans) return false;
            var extensions = Utils.parseList(ans);

            var args = [],
                isShown = false,
                current;
            var el = $(Notify.modal({
                header: "Load files from <span class='auto-filename'></span>",
                body: "<label for='priority'>Priority: Higher values get loaded first</label><input type='number' name='priority' value=100>" +
                    "<input type='checkbox'/><span>Do this for remaining folders</span>",
                footers: ["Stop", "Ignore", "Load", "Load Recursively"],
                keepOnClose: true,
                autoOpen: false,
                dismissible: false
            }));

            function show(args) {
                el.find('.auto-filename')[0].innerText = args[0];
                el.find('input')[0].value = args[2].initialValue.priority;
                current = args;
            }

            global.styleCheckbox(el);

            el.find('.modal-footer').css('height', 'auto');
            var preload = [];

            function onResult(type, path, priority, parentPriority) {
                switch (type) {
                    case 'load_recursively':
                        if (priority != parentPriority) {
                            preload.unshift({
                                pr: priority,
                                paths: path + "**"
                            });
                            return [null, true];
                        } else return [path + "**", true];
                        break;
                    case 'load':
                        return [{
                            priority: priority,
                            parentPriority: parentPriority,
                            path: path + "*"
                        }];
                        break;
                    case 'ignore':
                        return [null, true];
                        break;
                }
            }
            el.find('.btn').on('click', function() {
                var type = /modal\-(\w+)/.exec(this.className)[1];
                var nextItem = current[1];
                if (type == 'stop') nextItem(stop());
                else {
                    var options = el.find('input');
                    var storeResult = options[1].checked;
                    var priority = options[0].value;
                    var path = current[0]
                    var data = current[2];
                    if (storeResult) data.storedValue = {
                        type: type,
                        priority: priority
                    };
                    nextItem.apply(null, onResult(type, path, priority, data.initialValue.priority));
                }
                if (args.length) {
                    show(args.shift());
                } else if (isShown) {
                    isShown = false;
                    close();
                }
            });
            var close = Utils.delay(function() {
                el.modal('close');
            }, 1000);

            function modal(path, next, stop, isDirectory, files, data) {
                if (data.storedValue) {
                    next.apply(null, onResult(data.storedValue.type, path, data.storedValue.priority, data.initialValue.priority));
                } else if (isShown) {
                    args.push([path, next, data])
                } else {
                    close.cancel();
                    el.modal('open');
                    isShown = true;
                    show([path, next, data]);
                }
            }
            var isDir = FileUtils.isDirectory;
            var stop = FileUtils.walk({
                fs: server,
                dir: e,
                map: modal,
                reduce: function(folder, children, data, next) {
                    children.unshift(data.initialValue.path);
                    var folders = children.filter(Boolean);
                    var res = folders.join(",");
                    if (data.initialValue.priority != data.initialValue.parentPriority) {
                        if (res)
                            preload.push({
                                pr: data.initialValue.priority,
                                paths: res
                            });
                        return null;
                    } else return res;
                },
                initialValue: {
                    priority: 0,
                    parentPriority: -1,
                    path: ""
                },
                iterate: function(iterate, folder, children, data, done) {
                    iterate(folder, children.filter(isDir), data, done);
                },
                finish: function(res) {
                    el.find('button').off();
                    close.cancel();
                    isShown = false;
                    el.modal('destroy');
                    el.detach();
                    var folders = [],
                        lastPr;
                    preload.sort(function(e, r) {
                        return r.pr - e.pr;
                    }).forEach(function(f) {
                        if (f.pr == lastPr) {
                            folders[folders.length - 1] += "," + f.paths;
                        } else {
                            lastPr = f.pr;
                            folders.push(f.paths);
                        }
                    })
                    var config = JSON.stringify({
                        extensions: extensions,
                        rootDir: e,
                        folders: folders
                    });
                    global.getBeautifier('json')(config, {
                        "end-expand": true,
                        "wrap_line_length": 20
                    }, function(res) {
                        Notify.ask("Save config to this folder?\n" + res, function() {
                            if (("" + appConfig.loadFileList.indexOf(".grace-config.json")) < 0) {
                                configure("loadFileList", (appConfig.loadFileList ? appConfig.loadFileList + "," : "") + ".grace-load-config", "autocompletion");
                            }
                            FileUtils.saveConfig(".grace-config.json", "//GRACE_CONFIG\n" + res, function() {
                                Notify.info("Saved");
                            }, {
                                rootDir: ev.filepath,
                                fileServer: ev.browser.fileServer
                            });
                        });
                    });

                }
            })

        }, "js", ["py", "cpp,c,h,cxx", "java", "ts,tsx,js,jsx"])
        ev.preventDefault();
    });

    Functions.getFile = getFile;
    Functions.getFileName = getFileName;
    Functions.loadAutocompleteFiles = loadFiles
}); /*_EndDefine*/