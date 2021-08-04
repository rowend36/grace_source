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
    var Docs = global.Docs;
    var Functions = global.Functions;
    var Notify = global.Notify;
    var configEvents = global.ConfigEvents;
    var providers = global.Completions;
    var Editors = global.Editors;
    var Imports = global.Imports;
    var Snippets = global.Snippets;
    var appConfig = global.registerAll({
        "autoLoadOpenDocs": true,
        "completionTimeout": "auto",
        "enableTypescript": true,
        "enableTern": true,
        "maxFileLoadSize": "5mb",
        "functionHintOnlyOnBoundaries": true,
        "maxSingleFileSize": "2mb",
        "preloadTimeout": "30s",
        "snippetsToLoad": "grace.snippets",
        "enableFilenameCompletion": true,
        "enableColorCompletion": true,
        "preloadConfigs": [],
        "neverAutoLoad": ["**/node_modules/**/*{[!d],[!.]d}.[tj]s"],

    }, "autocompletion");
    global.registerValues({
        '!root': 'Configure ternjs, typescript and Gtags autocompletion engines\nTo disable autocompletion entirely, see editors.enableBasicAutocompletion',
        'enableTern': 'Use ternjs engine for javascript. Takes precedence over typescript for pure javascript files if enabled',
        'enableTypescript': 'Supports js,jsx,ts,tsx files. This completer can be heavy at times. Avoid loading too many files at once.\n For best performance, to load files from only node_modules/@types and src folders',
        'enableColorCompletion': 'Allow completing with html colors as well as colors found in files',
        'enableFilenameCompletion': 'Allow completing with filenames from project directory as well as filepaths found in files',
        'maxSingleFileSize': {
            type: 'size',
            doc: 'Prevent editor from hanging by stopping it from parsing large files'
        },
        "preloadConfigs": {
            doc: "Configure how files should be preloaded into the editor for autocompletion. Preloading improves completions and when used with restricting options like neverAutoLoad, enableTagGathering,etc gives you better control over memory usage. Format:\n\
{\n\
    extensions: Array<String> - the file extensions to load eg ['js','ts'],\n\
    completer: ?Array<String> - the name of the completer. Must be one or more of 'ternServer','tsServer'(ie typescript) or 'tagServer'. Defaults to all.\n\
    rootDir: ?String - the filepath to resolve relative paths from. Defaults to current project directory.\n\
    loadEagerly: Array<String> - the list of files to load. Filepaths can be globs. Note: The files are loaded in directory order.\n\
    exclude: ?Array<String> - Files to exclude ie files that should be ignored in loadEagerly list \n\
}\n\
Note: When multiple configs are specified, they are loaded in the order they are specified..  Users can interactively generate a config file using the Project menu option>Generate loader",
            type: [{
                "extensions": "array<filename>",
                "completer": "?array<[ternServer,tsServer,tagServer]>",
                "rootDir": "?string",
                "loadEagerly": "array<string>",
                "exclude": "?array<string>"
            }]
        },
        "snippetsToLoad": "Load tmsnippet files. Example files are on ace github repository. Specify snippets as filepath followed by optional list of scopes. path[:scope[,scope]] eg main.snippets:javascript,typescript",
        'functionHintOnlyOnBoundaries': "When enabled, function hints will only show at ',' and beginning of argument list",
        'preloadTags': 'File location of configuration for  eagerly loading files for tag completion',
        'preloadFiles': "File location of configuration for eagerly loading files intellisense completion\n",
        'maxFileLoadSize': {
            type: 'size',
            doc: 'The maximum total size of files to load into memory'
        },
        'preloadTimeout': {
            type: "time",
            doc: 'The maximum total time load files into memory. Prevents background loading from hanging editor'
        },
    }, "autocompletion");
    var fileLoader = new FileLoader({
        maxCount: Infinity,
        maxSize: Utils.parseSize(appConfig.maxFileLoadSize),
        parallel: 3
    });
    var neverAutoLoad;
    try {
        neverAutoLoad = FileUtils.globToRegex(appConfig.neverAutoLoad.join(","));
    } catch (e) {
        configure("neverAutoLoad", [], "autocompletion");
    }
    configEvents.on("autocompletion", function(e) {
        var BaseServer = global.BaseServer;
        switch (e.config) {
            case 'enableTern':
            case 'enableTypescript':
                var prov = e.config == 'enableTern' ? global.ternCompletionProvider : global
                    .tsCompletionProvider;
                if (e.newValue && !e.oldValue) {
                    var modes = e.config == 'enableTern' ? ["javascript"] : ["typescript", "tsx",
                        "javascript", "jsx"
                    ];
                    providers.addCompletionProvider(prov, modes);
                } else if (e.oldValue) {
                    providers.removeCompletionProvider(prov);
                }
                break;
            case "preloadTags":
                Tags && loadFiles(Tags);
                break;
            case "preloadFiles":
                loadFiles();
                break;
            case 'neverAutoLoad':
                neverAutoLoad = FileUtils.globToRegex(e.newValue.join(","));
                break;
            case "snippetsToLoad":
                loadSnippets();
                break;
            case 'maxSingleFileSize':
                if (BaseServer) BaseServer.prototype.maxSize = Utils.parseSize(e.newValue);
                break;
            case 'functionHintOnlyOnBoundaries':
                if (!BaseServer) return;
                if (e.newValue) BaseServer.prototype.functionHintTrigger = ',()';
                else BaseServer.prototype.functionHintTrigger = null;
        }
    });

    function loadSnippets() {
        var files = Utils.parseList(appConfig.snippetsToLoad);
        var fs = FileUtils.getProject().fileServer || FileUtils.defaultServer;
        if (!fs) return;
        if (!Snippets.files) return;
        var error = function(path, type) {
            Notify.info("Failed " + type + " snippet file: " + path);
        };
        Utils.asyncForEach(files, function(name, i, n) {
            var parts = name.split(":");
            var path = parts[0];
            if (Snippets.files[path] && !Snippets.files[path].isStale) return n();
            fs.readFile(FileUtils.resolve(FileUtils.getProject().rootDir, path), "utf8", function(e,
                r) {
                n();
                if (e && e.code != 'ENOENT') {
                    error(path, 'loading');
                }
                if (e) return;
                try {
                    var m = {
                        name: path
                    };
                    m.snippets = Snippets.parseSnippetFile(r);
                    Snippets.files[path] = m;
                    if (parts.length > 1) {
                        var scopes = parts[1].split(",");
                        scopes.forEach(function(scope) {
                            Snippets.register(m.snippets || [], scope);
                        });
                    } else Snippets.register(m.snippets || []);
                } catch (e) {
                    console.error(e);
                    error(path, "parsing");
                }
            });
        }, null);
    }
    //the lsp true - current completionProvider
    //        object - any completer
    //        falsy(default)  - true and Tags
    var activeOp;
    var loadFiles = function(cb, lsp) {
        watchMemory();
        if (activeOp) {
            activeOp.abort('Aborted for New Task');
        }
        var currentOp = new Utils.AbortSignal();
        activeOp = currentOp;
        currentOp.notify(console.log.bind(console));

        //Figure out which servers to load files into
        var a = getEditor();
        var explicitLsp = !!lsp;
        lsp = lsp || a.getMainCompleter();
        //Fighting the urge to move the entire thing into an integer flag
        //C upbringing :)
        var enabled = {
            "tagServer": (explicitLsp ? lsp == Tags : Tags) && 1,
            "ternServer": (lsp && lsp.name == 'ternServer') && 2,
            'tsServer': (lsp && lsp.name == 'tsServer') && 4
        };

        //prevent filepaths from being loaded twice
        var fileList = {};

        function notAlreadyLoaded(path, completer) {
            if (enabled[completer]) {
                path = normalize(path);
                if (!fileList[path]) {
                    fileList[path] = enabled[completer];
                    return true;
                } else if (fileList[path] & enabled[completer]) {
                    return false;
                } else {
                    fileList[path] += enabled[path];
                    return true;
                }
            }
            return false;
        }

        var configs = appConfig.preloadConfigs;
        var defaultRoot = FileUtils.getProject().rootDir;
        var server = FileUtils.getProject().fileServer;
        var normalize = FileUtils.normalize;
        var loadFile = Utils.throttle(currentOp.control(fileLoader.loadFile.bind(fileLoader)), 70);

        //This line is one of the reasons why we have to manage memory
        fileLoader.setSize(0, 0);
        var timeout = Utils.parseTime(appConfig.preloadTimeout);
        if (timeout > 0) {
            setTimeout(currentOp.control(function() {
                currentOp.abort('Timed Out');
            }), timeout);
        }

        //For each config file
        Utils.asyncForEach(configs, function(config, i, next, cancel) {
            next = currentOp.control(next, cancel);
            //Find the servers that are enabled for this config file
            var toLoad = (config.completers || ["tagServer", "ternServer",
                "tsServer"
            ]).filter(function(e) {
                return enabled[e];
            });
            if (toLoad.length < 1) return next();

            //Ensure commonRoot is an absolute path by all means
            var commonRoot = normalize(FileUtils.join("/",
                FileUtils.resolve(defaultRoot, config.rootDir || "")));

            var extensionRe = new RegExp(config.extensions.map(Utils.regEscape).join(
                "$|") + "$");
            //TODO fix: Possible wrong results with brace expand
            //Basically {/j,b}/* will be read as /sdcard/j,/sdcard/b instead of /j/,/sdcard/b
            var excludeRe = config.exclude && FileUtils.globToRegex(
                config.exclude.map(
                    FileUtils.resolve.bind(null, commonRoot)
                ).join(","));
            //TODO fix: Possible wrong results with brace expand
            var loadEagerly = config.loadEagerly.map(FileUtils.resolve.bind(null, commonRoot));

            //TODO try to make this a FileUtils.glob again
            var params = FileUtils.globToWalkParams(loadEagerly.join(","));
            var walkerRoot = params.root;
            var dirmatch = params.canMatch;
            var matches = params.matches;
            //walk has its own way of handling abort
            var setStopped = FileUtils.walk({
                dir: walkerRoot,
                fs: server,
                map: function(relPath, next, stopWalking, isDir) {
                    var fullpath = walkerRoot + relPath;
                    
                    console.log(fullpath);
                    if (isDir) {
                        return dirmatch.test(fullpath);
                    }
                    if (!extensionRe.test(fullpath)) return false;
                    if (excludeRe && excludeRe.test(fullpath))
                        return false;
                    if (!matches.test(fullpath)) return false;
                    var willLoad = toLoad.filter(notAlreadyLoaded.bind(null, fullpath));
                    if (willLoad.length < 0) return next();
                    console.log('loading');
                    loadFile(fullpath, server, function(err,
                        res) {
                        if (!err && res) {
                            if (willLoad.indexOf("tagServer") > -1) {
                                Tags.loadTags(fullpath, res, true);
                            } else if (lsp && willLoad.indexOf(lsp.name) > -1) {
                                lsp.addDoc(fullpath, res, true);
                            }
                        } else if (err && (err.reason ==
                                "size" || err
                                .reason == "count"
                            )) {
                            //stop loading files
                            currentOp.abort();
                        }
                        next(); //load next file
                    });
                },
                finish: function() {
                    currentOp.unNotify(setStopped);
                },
                failOnError: false
            });
            currentOp.notify(setStopped);
        }, function() {
            console.debug('Server Load', Utils.toSize(fileLoader.getSize().size));
            currentOp.clear();
            if (currentOp == activeOp) {
                activeOp = null;
            }
            currentOp = null;
            cb && cb();
        }, 0, false, true);
    };

    function getFile(name, cb) {
        var doc = global.getActiveDoc();
        var server = doc ? doc.getFileServer() : FileUtils.defaultServer;
        if (!name.startsWith("/")) name = "/" + name;
        if (neverAutoLoad && neverAutoLoad.test(name)) {
            cb(global.createError({
                code: 'ENOENT'
            }));
        } else
            fileLoader.loadFile(name, server, cb);
    }

    function getFileName(s) {
        var doc = Docs.forSession(s);
        if (doc) return doc.getPath();
        return 'current';
    }

    //cleans docs every 30mins, to contain memory leaks
    //especially with workers
    var watchMemory = Utils.delay(function() {
        //memory management
        var size = fileLoader.getSize();
        if (size.size > fileLoader.getOpts().maxSize) {
            reduceLoad.now();
            resumeLoad();
        }
    }, Utils.parseSize('30mins'));

    function onCreateDoc(doc) {
        if (Tags) Tags.loadTags(doc.getSavePath() || doc.getPath(), doc);
    }

    function onCloseDoc(doc) {
        var added = false;
        var path = doc.getSavePath(),
            value = "";
        if (path)
            value = doc.getValue();
        [global.ternCompletionProvider && global.ternCompletionProvider.instance,
            global.tsCompletionProvider && global.tsCompletionProvider.instance,
            Tags
        ].forEach(function(prov) {
            if (prov) {
                var data = prov.hasDoc(doc.session);
                if (!data) return;
                prov.closeDoc(data.name);
                if (path) {
                    added = true;
                    prov.addDoc(path, value);
                }
            }
        });
        if (added) {
            fileLoader.increment(doc.getSize());
            watchMemory();
        }
    }
    MainMenu.addOption("reload-project", {
        close: true,
        icon: "autorenew",
        caption: "Reload Completions",
        onclick: function() {
            loadFiles(function() {
                Notify.info('Reloaded');
            }, null, null);
            var snippets = Snippets.files;
            for (var i in snippets) {
                snippets[i].isStale = true;
            }
            loadSnippets();
        }
    }, true);
   
    /*
       It's faster to reload workers than to reload the application
       Especially on Android where we have to restart the entire activity
    */
    var reduceLoad = Utils.delay(function() {
        //clear servers on pause
        activeOp && activeOp.abort();
        var ts = global.tsCompletionProvider;
        if (appConfig.enableTypescript) {
            console.debug('Destroying ts server');
            providers.removeCompletionProvider(ts);
            ts.destroy();
        }
        var tern = global.ternCompletionProvider;
        if (appConfig.enableTern) {
            providers.removeCompletionProvider(tern);
            console.debug('Destroying tern server');
            tern.destroy();
        }
        if (Tags) Tags.clear();
        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        appEvents.once('app-resumed', resumeLoad);
    }, Env.isWebView ? 10000 : 1000);

    function resumeLoad() {
        loadSnippets();
        var BaseServer = global.BaseServer;
        if (BaseServer) {
            BaseServer.prototype.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
            if (appConfig.functionHintOnlyOnBoundaries) BaseServer.prototype.functionHintTrigger = ',()';
            else BaseServer.prototype.functionHintTrigger = null;
        }
        var ts = global.tsCompletionProvider;
        if (appConfig.enableTypescript) providers.addCompletionProvider(ts, ["javascript", "jsx", "typescript",
            "tsx"
        ]);
        var tern = global.ternCompletionProvider;
        if (appConfig.enableTern) providers.addCompletionProvider(tern, ["javascript"]);
        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        loadFiles();
        for (var i in docs) {
            onCreateDoc(docs[i]);
        }
        appEvents.once('app-paused', reduceLoad);
    }

    //Replace this with a modal
    FileUtils.registerOption("project", ["project"], "load-comp", {
        "caption": "Project...",
        "subTree": {
            "force-stop": {
                caption: "Force Reload Completions",
                onclick: function(ev) {
                    ev.preventDefault();
                    watchMemory.now();
                }
            },
            "generate": {
                caption: "Generate Loader file",
                onclick: function(ev) {
                    ev.preventDefault();
                    Imports.define("./autocompletion/generate_conf.js", function() {
                        return global.generate_conf;
                    })(ev);
                }
            },
            "export-tags": {
                caption: "Export Tags",
                onclick: function(ev) {
                    ev.preventDefault();
                    var folder = ev.filepath + '/' + Utils.genID('tags');
                    ev.browser.fileServer.mkdir(folder, function() {
                        global.TagCompleter.exportTags(ev.browser.fileServer, folder, Notify
                            .info.bind(null, 'Done'));
                    });
                }
            }
        }

    });
    appEvents.on('createDoc', function(e) {
        onCreateDoc(e.doc);
    });
    appEvents.on('closeDoc', function(e) {
        onCloseDoc(e.doc);
    });
    appEvents.once("fully-loaded", resumeLoad);
    appEvents.on('app-resumed', reduceLoad.cancel);
    BootList.add(
        "./autocompletion/completion.css", "./autocompletion/tern/ternProvider.js",
        "./autocompletion/typescript/tsProvider.js", "./autocompletion/misc/filename_colors.js");
    BootList =
        null;
    Functions.getFile = getFile;
    Functions.getFileName = getFileName;
    Functions.loadAutocompleteFiles =
        loadFiles;
}); /*_EndDefine*/