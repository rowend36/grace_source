define(function(require,exports,module){
    var getEditor = require("grace/setup/setup_editors").getEditor;
    var FileLoader = require("./loader").FileLoader;
    var Utils = require("grace/core/utils").Utils;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var appEvents = require("grace/core/events").AppEvents;
    var appConfig = require("grace/core/config").Config.registerAll({},"autocompletion");
    var Docs = require("grace/docs/docs").Docs;
    var debug = console;
    var fileLoader = new FileLoader({
        maxCount: Infinity,
        maxSize: Utils.parseSize(appConfig.maxFileLoadSize),
        parallel: 3
    });
    
    //the lsp true - current completionProvider
    //        object - any completer
    //        falsy(default)  - true and Tags
    //Todo move tag management to a separate file
    var activeOp;
    //cleans docs every 30mins, to contain memory leaks
    //especially with workers
    var watchMemory = Utils.delay(function() {
        //memory management
        var size = fileLoader.getSize();
        if (size.size > fileLoader.getOpts().maxSize) {
            debug.log('Reloading all completers now....');
            appEvents.trigger("trimServerMemory");
        }
    }, Utils.parseSize('30mins'));

    var loadFiles = function(cb, lsp) {
        watchMemory();
        var data = {};
        if (activeOp) {
            data = activeOp.data;
            activeOp.abort('Aborted for New Task');
        }
        var currentOp = new Utils.AbortSignal();
        activeOp = currentOp;
        currentOp.notify(debug.log.bind(debug));

        //Figure out which servers to load files into
        var a = getEditor();
        var explicitLsp = !!lsp;
        var tagsClient = a.tagsClient;
        lsp = lsp || a.getMainCompleter();
        //Fighting the urge to move the entire thing into an integer flag
        //C upbringing :
        var enabled = {
            "tagsClient": (explicitLsp ? lsp == tagsClient : tagsClient) && 1 || data.tagsClient,
            "ternClient": (lsp && lsp.name == 'ternClient') && 2 || data.ternClient,
            'tsClient': (lsp && lsp.name == 'tsClient') && 4 || data.tsClient
        };
        currentOp.data = enabled;

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
            var toLoad = (config.completers || ["tagsClient", "ternClient",
                "tsClient"
            ]).filter(function(e) {
                return enabled[e];
            });
            if (toLoad.length < 1) return next();

            //Ensure commonRoot is an absolute path by all means
            var commonRoot = normalize(FileUtils.join("/",
                FileUtils.resolve(defaultRoot, config.rootDir || "")));

            var extensionRe = new RegExp("\\." + config.extensions.map(Utils.regEscape).join(
                "$|\\.") + "$");
            //TODO fix: Possible wrong results with brace expand
            //Basically {/j,b}/* will be read as /sdcard/j,/sdcard/b instead of /j/,/sdcard/b
            var excludeRe = config.exclude && FileUtils.globToRegex(
                config.exclude.map(
                    FileUtils.resolve.bind(null, commonRoot)
                ));
            //TODO fix: Possible wrong results with brace expand
            var loadEagerly = config.loadEagerly.map(FileUtils.resolve.bind(null, commonRoot));

            //TODO try to make this a FileUtils.glob again
            var params = FileUtils.globToWalkParams(loadEagerly);
            var walkerRoot = params.root;
            var dirmatch = params.canMatch;
            var matches = params.matches;
            //walk has its own way of handling abort
            var setStopped = FileUtils.walk({
                dir: walkerRoot,
                fs: server,
                map: function(relPath, next, stopWalking, isDir) {
                    var fullpath = walkerRoot + relPath;

                    if (isDir) {
                        return dirmatch.test(fullpath);
                    }
                    if (!extensionRe.test(fullpath)) return false;
                    if (excludeRe && excludeRe.test(fullpath))
                        return false;
                    if (!matches.test(fullpath)) return false;
                    var willLoad = toLoad.filter(notAlreadyLoaded.bind(null, fullpath));
                    if (willLoad.length < 0) return next();
                    loadFile(fullpath, server, function(err,
                        res) {
                        if (!err && res) {
                            if (willLoad.indexOf("tagsClient") > -1) {
                                tagsClient.loadtagsClient(fullpath, res, true);
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
                    next();
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
    function readFile(name, cb) {
        var doc = require("grace/docs/active_doc").getActiveDoc();
        var server = doc ? doc.getFileServer() : FileUtils.defaultServer;
        if (!name.startsWith("/")) name = "/" + name;
        if (api.$neverAllowLoad && api.$neverAllowLoad.test(name)) {
            cb(require("grace/core/config").createError({
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
    var api = exports.ServerHost = {
        loadAutocompleteFiles: loadFiles,
        switchToDoc : require("grace/setup/setup_tab_host").switchToDoc,
        readFile : readFile,
        getFileName : getFileName,
        $neverAllowed: null,
        $fileLoader: fileLoader,
        $watchMemory: watchMemory,
        $stopLoad: function(){
            activeOp && activeOp.abort();
        }
    };
    
});