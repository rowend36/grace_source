define(function(require, exports, module) {
    require("grace/ext/glob/glob");
    var appEvents = require("grace/core/events").AppEvents;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var MainMenu = require("grace/setup/setup_main_menu").MainMenu;
    var Utils = require("grace/core/utils").Utils;
    var configure = require("grace/core/config").Config.configure;
    var docs = require("grace/docs/document").docs;
    var Notify = require("grace/ui/notify").Notify;
    var configEvents = require("grace/core/config").ConfigEvents;
    var providers = ace.require("ace/ext/completions");
    var Editors = require("grace/editor/editors").Editors;
    var ServerHost = require("./server_host").ServerHost;
    var Snippets = ace.require("ace/snippets").snippetManager;
    var Tags = require("./tags/completer").TagCompleter;
    var tsCompletionProvider = require("./typescript/ts_provider").tsCompletionProvider;
    var ternCompletionProvider = require("./tern/tern_provider").ternCompletionProvider;
    var fileLoader = ServerHost.$fileLoader;
    var watchMemory = ServerHost.$watchMemory;
    var loadFiles = ServerHost.loadAutocompleteFiles;
    var appConfig = require("grace/core/config").Config.registerAll({
        "autoLoadOpenDocs": true,
        "completionTimeout": "auto",
        "enableTypescript": true,
        "enableTern": true,
        "maxFileLoadSize": "5mb",
        "functionHintOnlyOnBoundaries": true,
        "maxSingleFileSize": "2mb",
        "preloadTimeout": "30s",
        "customSnippetFiles": "grace.snippets",
        "enableFilenameCompletion": true,
        "enableColorCompletion": true,
        "preloadConfigs": [],
        "neverAllowLoad": ["**/node_modules/**/*{[!d],[!.]d}.[tj]s"],

    }, "autocompletion");
    require("grace/core/config").Config.registerValues({
        '!root': 'Configure ternjs, typescript and tags autocompletion engines\nTo disable autocompletion entirely, see editors.enableBasicAutocompletion',
        'enableTern': 'Use ternjs engine for javascript. Takes precedence over typescript for pure javascript files if enabled',
        'enableTypescript': 'Supports js,jsx,ts,tsx files. This completer can be heavy at times. Avoid loading too many files at once.\n For best performance, to load files from only node_modules/@types and src folders',
        'enableColorCompletion': 'Allow completing with html colors as well as colors found in files',
        'enableFilenameCompletion': 'Allow completing with filenames from project directory as well as filepaths found in files',
        'maxSingleFileSize': {
            type: 'size',
            doc: 'Prevent editor from hanging by stopping it from parsing large files'
        },
        "preloadConfigs": {
            doc: "Configure how files should be preloaded into the editor for autocompletion. Preloading improves completions and when used with restricting options like neverAllowLoad, enableTagGathering,etc gives you better control over memory usage. Format:\n\
{\n\
    extensions: Array<String> - the file extensions to load eg ['js','ts'],\n\
    completer: ?Array<String> - the name of the completer. Must be one or more of 'ternClient','tsClient'(ie typescript) or 'tagsClient'. Defaults to all.\n\
    rootDir: ?String - the filepath to resolve relative paths from. Defaults to current project directory.\n\
    loadEagerly: Array<String> - the list of files to load. Filepaths can contain wildcards. Note: The files are loaded in directory order.\n\
    exclude: ?Array<String> - Files to exclude ie files that should be ignored in loadEagerly list \n\
}\n\
Note: When multiple configs are specified, they are loaded in the order they are specified..  Users can interactively generate a config file using the Project menu option>Generate loader",
            type: [{
                "extensions": "array<filename>",
                "completer": "?array<[ternClient,tsClient,tagsClient]>",
                "rootDir": "?string",
                "loadEagerly": "array<string>",
                "exclude": "?array<string>"
            }]
        },
        "customSnippetFiles": "Load tmsnippet files. Example files are on ace github repository. Specify snippets as filepath followed by optional list of scopes. path[:scope[,scope]] eg main.snippets:javascript,typescript",
        'functionHintOnlyOnBoundaries': "When enabled, function hints will only show at ',' and beginning of argument list",
        'preloadTags': 'File location of configuration for  eagerly loading files for tag completion',
        'preloadFiles': "File location of configuration for eagerly loading files intellisense completion\n",
        'maxFileLoadSize': {
            type: 'size',
            doc: 'The maximum total size of files to load into memory'
        },
        'preloadTimeout': {
            type: "time",
            doc: 'On startup, the maximum amount of time to spend load files into memory. Prevents background loading from disrupting editor user interface.'
        },
    }, "autocompletion");
    try {
        ServerHost.$neverAllowLoad = FileUtils.globToRegex(appConfig.neverAllowLoad);
    } catch (e) {
        configure("neverAllowLoad", [], "autocompletion");
    }
    configEvents.on("autocompletion", function(e) {
        var BaseServer = require("./base_server").BaseServer;
        switch (e.config) {
            case 'enableTern':
            case 'enableTypescript':
                var prov = e.config == 'enableTern' ? ternCompletionProvider : tsCompletionProvider;
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
            case 'neverAllowLoad':
                ServerHost.$neverAllowLoad = FileUtils.globToRegex(e.newValue);
                break;
            case "customSnippetFiles":
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
        var files = Utils.parseList(appConfig.customSnippetFiles);
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

    function onCloseDoc(doc) {
        var added = false;
        var path = doc.getSavePath(),
            value = "";
        if (path)
            value = doc.getValue();
        [
            ternCompletionProvider.instance,
            tsCompletionProvider.instance,
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
        ServerHost.$stopLoad();
        var ts = tsCompletionProvider;
        if (appConfig.enableTypescript) {
            console.debug('Destroying ts server');
            providers.removeCompletionProvider(ts);
            ts.destroy();
        }
        var tern = ternCompletionProvider;
        if (appConfig.enableTern) {
            providers.removeCompletionProvider(tern);
            console.debug('Destroying tern server');
            tern.destroy();
        }
        if (Tags) Tags.clear();
        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        appEvents.once('appResumed', resumeLoad);
    }, Env.isWebView ? 10000 : 1000);

    function resumeLoad() {
        loadSnippets();
        var BaseServer = require("./base_server").BaseServer;
        if (BaseServer) {
            BaseServer.prototype.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
            if (appConfig.functionHintOnlyOnBoundaries) BaseServer.prototype.functionHintTrigger = ',()';
            else BaseServer.prototype.functionHintTrigger = null;
        }
        var ts = tsCompletionProvider;
        if (appConfig.enableTypescript) providers.addCompletionProvider(ts, ["javascript", "jsx", "typescript",
            "tsx"
        ]);
        var tern = ternCompletionProvider;
        if (appConfig.enableTern) providers.addCompletionProvider(tern, ["javascript"]);
        Editors.forEach(function(e) {
            providers.updateCompleter(e);
        });
        loadFiles();
        if (Tags) {
            for (var i in docs) {
                Tags.onCreateDoc(docs[i]);
            }
        }
        appEvents.once('appPaused', reduceLoad);
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
                    require(["./generate_conf"], function(mod) {
                        mod.generate_conf(ev);
                    });
                }
            },
            "export-tags": {
                caption: "Export Tags",
                onclick: function(ev) {
                    ev.preventDefault();
                    var folder = ev.filepath + '/' + Utils.genID('tags');
                    ev.browser.fileServer.mkdir(folder, function() {
                        require("./tags/completer").TagCompleter.exportTags(ev.browser
                            .fileServer, folder, Notify
                            .info.bind(null, 'Done'));
                    });
                }
            }
        }

    });
    if (Tags) {
        appEvents.on('createDoc', function(e) {
            Tags.onCreateDoc(e.doc);
        });
    }
    appEvents.on('closeDoc', function(e) {
        onCloseDoc(e.doc);
    });
    appEvents.once("fullyLoaded", resumeLoad);
    appEvents.on('appResumed', reduceLoad.cancel);
    
    function trimMemory() {
        reduceLoad.now();
        resumeLoad();
    }
    appEvents.on('trimServerMemory',trimMemory);
}); /*_EndDefine*/