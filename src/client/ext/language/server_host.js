define(function (require, exports, module) {
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var FileLoader = require('./file_loader').FileLoader;
    var Utils = require('grace/core/utils').Utils;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var appEvents = require('grace/core/app_events').AppEvents;
    var configEvents = require('grace/core/config').Config;
    var BaseClientProps = require('./base_client').BaseClient.prototype;
    var StopSignal = require('grace/ext/stop_signal').StopSignal;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            functionHintTrigger: '(),',
        },
        'intellisense',
    );

    var loadConfig = require('grace/core/config').Config.registerAll(
        {
            maxFileLoadSize: '5mb',
            maxSingleFileSize: '2mb',
            preloadTimeout: '30s',
            preloadConfigs: [],
            neverAllowLoad: ['**/node_modules/**/*{[!d],[!.]d}.[tj]s'],
        },
        'intellisense',
    );
    require('grace/core/config').Config.registerInfo(
        {
            '!root': 'Setup intellisense services.',
            maxSingleFileSize: {
                type: 'size',
                doc:
                    'Prevent editor from hanging by stopping it from loading large files',
            },
            preloadConfigs: {
                doc:
                    "Configure how files should be preloaded into the editor for intellisense. Preloading improves completions and when used with restricting options like neverAllowLoad, enableTagGathering,etc gives you better control over memory usage. Format:\n\
{\n\
    extensions: Array<String> - the file extensions to load eg ['js','ts'],\n\
    completer: ?Array<String> - the name of the completer. Must be one or more of 'ternClient','tsClient'(ie typescript), 'tagsClient' or any registered language service provider name. Defaults to all.\n\
    rootDir: ?String - the filepath to resolve relative paths from. Defaults to current project directory.\n\
    loadEagerly: Array<String> - the list of files to load. Filepaths can contain wildcards. Note: The files are loaded in directory order.\n\
    exclude: ?Array<String> - Files to exclude ie files that should be ignored in loadEagerly list \n\
}\n\
Note: When multiple configs are specified, they are loaded in the order they are specified..  Users can interactively generate a config file using the Project menu option>Generate loader",
                type: [
                    {
                        extensions: 'array<filename>',
                        completer: '?array<[ternClient,tsClient,tagsClient]>',
                        rootDir: '?string',
                        loadEagerly: 'array<string>',
                        exclude: '?array<string>',
                    },
                ],
            },
            functionHintTrigger: {
                type: 'string|null',
                doc:
                    'Characters that should trigger function hint tooltip. Specifying null means all characters.',
            },
            maxFileLoadSize: {
                type: 'size',
                doc: 'The maximum total size of files to load into memory',
            },
            preloadTimeout: {
                type: 'time',
                doc:
                    'On startup, the maximum amount of time to spend load files into memory. Prevents background loading from disrupting editor user interface.',
            },
        },
        'intellisense',
    );
    require('grace/core/config').Config.on('intellisense', function (e) {
        switch (e.config) {
            case 'maxFileLoadSize':
                fileLoader.opts.maxSize =
                    Utils.parseSize(loadConfig.maxFileLoadSize) ||
                    fileLoader.opts.maxSize;
                break;
            case 'maxSingleFileSize':
                fileLoader.opts.maxSize =
                    Utils.parseSize(loadConfig.maxFileLoadSize) ||
                    fileLoader.opts.maxSize;
                break;
            case 'maxFileLoadSize':
                fileLoader.opts.maxSize = Utils.parseSize(
                    loadConfig.maxFileLoadSize,
                );
                break;
            case 'preloadConfigs':
                loadFiles();
                break;
            case 'neverAllowLoad':
                api.$neverAllowLoad = FileUtils.globToRegex(e.value());
                break;
        }
    });

    var hover = require('./services/hover');
    var commands = require('./services/commands');
    var lint = require('./services/lint');
    var completion = require('./services/completion');
    var format = require('grace/ext/format/formatters');
    var Docs = require('grace/docs/docs').Docs;
    var debug = console;
    /**
     * The ServerHost is a collection of services that could not be added
     * to BaseProvider since they involve shared state, nor setup_services
     * since that would cause cyclic dependencies.
     **/
    var fileLoader = new FileLoader({
        maxCount: Infinity,
        maxSize: Utils.parseSize(loadConfig.maxFileLoadSize),
    });

    var activeOp;
    //cleans docs every 30mins, to contain memory leaks
    //especially with workers
    var watchMemory = Utils.delay(function () {
        //memory management
        var size = fileLoader.getSize();
        if (size.size > fileLoader.getOpts().maxSize) {
            debug.log('Trimming Memory....');
            appEvents.trigger('trimServerMemory');
        }
    }, Utils.parseSize('30mins'));
    
    //the lsp true - current completionProvider
    //        object - any completer
    //        falsy(default)  - true and Tags
    //Todo move tag management to a separate file
    //A lot of excessive work being done
    //to make tasks run in parallel
    //unforunately, does not yet handle servers being destroyed
    var loadFiles = function (cb, lsp) {
        watchMemory();
        //Prevent filepaths from being loaded twice,
        //The filelist shows files that have been loaded
        //and for which completers in the form of a binary flag
        var fileList = {};
        //The currenttask shows which completers we should load files for
        //and maps them to an integer mask used by filelist,
        //:) forgive my C background
        var currentTask = {mask: 1, lsps: {}};
        if (activeOp) {
            currentTask = Object.assign({}, activeOp.data);
            activeOp.stop('Aborted for New Task');
        }
        var currentOp = new StopSignal();
        activeOp = currentOp;
        currentOp.subscribe(debug.log.bind(debug));

        //Load files into the active completer
        lsp = lsp || getEditor().getMainCompleter();
        var tagsClient = getEditor().tagsClient;

        function addToCurrentTask(lsp) {
            if (!currentTask[lsp.name]) {
                currentTask[lsp.name] = currentTask.mask;
                currentTask.mask << 1;
                currentTask.lsps[lsp.name] = lsp;
            }
        }

        //Tags are always loaded
        if (tagsClient) addToCurrentTask(tagsClient);
        if (lsp) {
            addToCurrentTask(lsp);
        }
        currentOp.data = currentTask;

        function notAlreadyLoaded(path, completer) {
            if (currentTask[completer]) {
                path = normalize(path);
                if (!fileList[path]) {
                    fileList[path] = currentTask[completer];
                    return true;
                } else if (fileList[path] & currentTask[completer]) {
                    return false;
                } else {
                    fileList[path] |= currentTask[completer];
                    return true;
                }
            }
            return false;
        }

        var configs = loadConfig.preloadConfigs;
        var defaultRoot = FileUtils.getProject().rootDir;
        var server = FileUtils.getProject().fileServer;
        var normalize = FileUtils.normalize;
        var loadFile = Utils.delay(
            currentOp.control(fileLoader.loadFile.bind(fileLoader)),
            70,
        );

        //This line is one of the reasons why we have to manage memory
        fileLoader.setSize(0, 0);
        var timeout = Utils.parseTime(loadConfig.preloadTimeout);
        if (timeout > 0) {
            setTimeout(
                currentOp.control(function () {
                    currentOp.stop('Timed Out');
                }),
                timeout,
            );
        }
        //For each config file
        Utils.asyncForEach(
            configs,
            function (config, i, next, cancel) {
                next = currentOp.control(next, cancel);
                //Find the servers that are enabled for this config file
                var toLoad = config.completers
                    ? config.completers.filter(function (e) {
                          return e && currentTask[e];
                      })
                    : Object.keys(currentTask);
                if (toLoad.length < 1) return next();

                //Ensure commonRoot is an absolute path by all means
                var commonRoot = normalize(
                    FileUtils.join(
                        '/',
                        FileUtils.resolve(defaultRoot, config.rootDir || ''),
                    ),
                );

                var extensionRe = new RegExp(
                    '\\.' +
                        config.extensions.map(Utils.regEscape).join('$|\\.') +
                        '$',
                );
                //TODO fix: Possible wrong results with brace expand
                //Basically {/j,b}/* with /sdcard/  as commonRoot will be read as /sdcard/j,/sdcard/b instead of /j/,/sdcard/b
                var excludeRe =
                    config.exclude &&
                    FileUtils.globToRegex(
                        config.exclude.map(
                            FileUtils.resolve.bind(null, commonRoot),
                        ),
                    );
                var loadEagerly = config.loadEagerly.map(
                    FileUtils.resolve.bind(null, commonRoot),
                );

                var params = FileUtils.globToWalkParams(loadEagerly);
                var walkerRoot = params.root;
                var dirmatch = params.canMatch;
                var matches = params.matches;
                console.log(params);
                //walk has its own way of handling abort
                var setStopped = FileUtils.walk({
                    dir: walkerRoot,
                    fs: server,
                    map: function (relPath, next, stopWalking, isDir) {
                        var fullpath = walkerRoot + relPath;

                        if (isDir) {
                            return dirmatch.test(fullpath);
                        }
                        if (!extensionRe.test(fullpath)) return false;
                        if (excludeRe && excludeRe.test(fullpath)) return false;
                        if (!matches.test(fullpath)) return false;
                        var willLoad = toLoad.filter(
                            notAlreadyLoaded.bind(null, fullpath),
                        );
                        //.filter(notDestroyed);
                        if (willLoad.length < 0) return next();
                        loadFile(fullpath, server, function (err, res) {
                            if (!err && res) {
                                willLoad.forEach(function (e) {
                                    var t = currentTask.lsps[e];
                                    if (e === 'tagsClient') {
                                        t.loadTags(fullpath, res, true);
                                    } else t.addDoc(fullpath, res, true);
                                });
                            } else if (
                                err &&
                                (err.reason == 'size' || err.reason == 'count')
                            ) {
                                //stop loading files
                                currentOp.stop();
                            }
                            next(); //load next file
                        });
                    },
                    finish: function () {
                        currentOp.unsubscribe(setStopped);
                        next();
                    },
                    failOnError: false,
                });
                currentOp.subscribe(setStopped);
            },
            function () {
                console.debug(
                    'Server Load',
                    Utils.toSize(fileLoader.getSize().size),
                );
                currentOp.clear();
                if (currentOp == activeOp) {
                    activeOp = null;
                }
                currentOp = null;
                cb && cb();
            },
            0,
            false,
            true,
        );
    };
    appEvents.on('reloadProject', function (e) {
        e.await(null, loadFiles);
    });
    
    function readFile(name, cb) {
        var doc = require('grace/setup/setup_editors').getActiveDoc();
        var server = doc ? doc.getFileServer() : FileUtils.getFileServer();
        if (name[0] !== '/') name = '/' + name;
        if (api.$neverAllowLoad && api.$neverAllowLoad.test(name)) {
            cb(
                FileUtils.createError({
                    code: 'ENOENT',
                }),
            );
        } else fileLoader.loadFile(name, server, cb);
    }

    function getFileName(s) {
        var doc = Docs.forSession(s);
        if (doc) return doc.getPath();
        return 'current';
    }
    function updateBaseClient() {
        BaseClientProps.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
        BaseClientProps.functionHintTrigger = appConfig.functionHintTrigger;
    }
    configEvents.on('intellisense', updateBaseClient);

    updateBaseClient();

    var api = (exports.ServerHost = {
        loadAutocompleteFiles: function (cb, lsp) {
            appEvents.on('fullyLoaded', loadFiles.bind(null, cb, lsp));
        },
        switchToDoc: require('grace/ext/switch_to_doc').switchToDoc,
        readFile: readFile,
        getFileName: getFileName,
        normalize: FileUtils.normalize,
        $neverAllowLoad: /^$/,
        $fileLoader: fileLoader,
        $watchMemory: watchMemory,
        registerProvider: function (provider) {
            console.log('Registering ',provider.name);
            if (provider.hasCompletions)
                completion.registerCompletionProvider(provider);
            if (provider.hasArgHints) hover.registerHoverProvider(provider);
            if (provider.hasAnnotations) lint.registerLintProvider(provider);
            if (provider.hasFormatting) format.registerFormatter(provider);
            commands.registerProvider(provider);
        },
        unregisterProvider: function (provider) {
            completion.unregisterCompletionProvider(provider);
            hover.unregisterHoverProvider(provider);
            lint.unregisterLintProvider(provider);
            commands.unregisterProvider(provider);
        },
        //Used to update the provider for instance when new capabilities are added
        toggleProvider: function (provider, modes, value) {
            this.unregisterProvider(provider);
            if (value) {
                this.registerProvider(provider);
            }
        },
        $stopLoad: function () {
            activeOp && activeOp.stop();
        },
    });
});