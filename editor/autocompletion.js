(function(global) {
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var parseSize = Utils.parseSize;
    var MAX_SINGLE_SIZE = parseSize("1mb");
    //var TIMEOUT = parseSize("");
    var MAX_TOTAL_SIZE = parseSize("10mb");
    var MAX_COUNT = 25;
    var FileLoader = function(opts) {
        opts = opts || opts;
        var maxSize = opts.maxSize || MAX_TOTAL_SIZE;
        var maxCount = opts.maxCount || MAX_COUNT;
        var maxSingleSize = opts.maxSingleSize || MAX_SINGLE_SIZE;
        var fileFilter;
        var beforeFolder;
        var preCheckSize = opts.preCheckSize !== false;
        //var timeout = opts.timeout || TIMEOUT;
        var parallel = opts.parallel ? (isNaN(opts.parallel) ? 1 : opts.parallel) : 1;

        this.loadFolder = function(path, server, each, cb, depth) {
            fileFilter = opts.fileFilter || function(name, path) {
                return !name.startsWith(".");
            };
            beforeFolder = opts.beforeFolder || function(p, y, n, l) {
                y();
            };
            loadFolder(path, server, each, cb, depth ? (isNaN(depth) ? 1 : depth) : 0, parallel);
        };
        this.getSize = function() {
            return {
                size: currentLoad,
                count: count
            };
        };
        this.setSize = function(esize, ecount) {
            size = esize || size;
            count = ecount || count;
        };
        this.getOpts = function() {
            return opts;
        };
        this.loadList = function(list, server, each, cb, depth) {
            fileFilter = opts.fileFilter || function(name, path) {
                return !name.startsWith(".");
            };
            beforeFolder = opts.beforeFolder || function(p, y, n, l) {
                y();
            };

            var callback = function(err, res, path) {
                if (res) {
                    each(path, err, res);
                }
                if (--done) {
                    cb();
                }
            };
            var done = list.length;
            list.forEach(function(el) {
                server.stat(el, function(e, s) {
                    if (s && s.type == "dir") {
                        loadFolder(el, server, each, callback, depth);
                    }
                    else if (s) {
                        loadFile(el, server, callback);
                    }
                    else callback(e);
                });
            });
        };
        var currentLoad = 0;
        var count = 0;

        function loadFile(path, server, next) {
            server.readFile(path, FileUtils.encodingFor(path), function(e, res) {
                if (!e && res.length > maxSingleSize) {
                    e = {
                        reason: "singleSize",
                        size: res.length
                    };
                }
                next(e, res, path);
            });
        }
        this.loadFile = loadFile;
        function loadFolder(path, server, each, finished, depth, parallel) {
            server.getFiles(path, function(e, list) {
                if (e) return finished(e);
                var pending = parallel;
                var next = function(err, res, filepath) {
                    if (err && (err.reason == "count" || err.reason == "size")) {
                        if (--pending < 1)
                            finished(err);
                        return;
                    }
                    if (filepath) {
                        if (!err) {
                            currentLoad += res.length;
                            count++;
                        }
                        each(filepath, err, res);
                    }
                    if (currentLoad >= maxSize) {
                        if (--pending < 1) {
                            finished({
                                reason: "size"
                            });
                        }
                        return;
                    }
                    if (count >= maxCount) {
                        if (--pending < 1)
                            finished({
                                reason: "count"
                            });
                        return;
                    }
                    if (list.length === 0) {
                        if (--pending < 1)
                            finished();
                        return;
                    }
                    var item = list.pop();
                    if (FileUtils.isDirectory(item)) {
                        if (depth > 0)
                            loadFolder(path + item, server, each, next, depth - 1, 1);
                        else next();
                    }
                    else if (fileFilter(item, path + item)) {
                        if (preCheckSize) {
                            server.stat(path + item, function(e, s) {
                                if (s && s.size > maxSingleSize) {
                                    next({
                                        reason: "singleSize",
                                        size: s.size
                                    }, null, path + item);
                                }
                                else if (s) {
                                    loadFile(path + item, server, next);
                                }
                                else next({
                                    reason: e || "unknown"
                                });
                            });
                        }
                        else loadFile(path + item, server, next);
                    }
                    else next();

                };
                beforeFolder(path, function() {
                    for (var i = 0; i < pending; i++) {
                        next();
                    }
                }, finished, list);
            });
        }
    };
    global.FileLoader = FileLoader;
})(Modules);
(function(global) {
    var ternServer;
    var appEvents = global.AppEvents;
    var FileUtils = global.FileUtils;
    var MainMenu = global.MainMenu;
    var Utils = global.Utils;
    var FileLoader = global.FileLoader;
    var appConfig = global.registerAll({
        "ternDefs": "browser, ecmascript",
        "ternPlugins": "doc_comment",
        "useWebWorkerForTern": false,
        "autoLoadProjectFiles": false,
        "filesToLoad": "list:main.js",
        "maxAutoFileLoadSize": "1mb",
        "maxAutoLoadSize": "5mb",
        "customDefs": "",
        "autoLoadOpenDocs": true
    }, "autocompletion");
    global.registerValues({
        'ternDefs': "browser ecmascript jquery react underscore",
        'ternPlugins': "modules requirejs angular modules node node_resolve es_modules commonjs complete_strings",
        'filesToLoad': "specify either \nall:<load all js,html && php files in project>,\nfile:<ternConfig>,\nlist:<comma separated list of files>",
        'maxAutoFileLoadSize': 'The maximum total size of files to load on start\nIf a ternConfig file is specified, it overrides this value.',
        'customDefs': "Either an absolute path or a filename to be searched for in <project folder>/defs"
    });
    var ternPlugins, ternDefs;
    var Doc = global.Doc;
    var Functions = global.Functions;
    var docs = global.docs;
    var Notify = global.Notify;

    function setupTernServer(editor, Functions) {
        var ternOptions = {
            /* http://ternjs.net/doc/manual.html#option_defs */
            server: ternServer,
            defs: ternDefs,
            /* http://ternjs.net/doc/manual.html#plugins */
            plugins: ternPlugins,
            useWorker: appConfig.useWebWorkerForTern,
            /* if your editor supports switching between different files (such as tabbed interface) then tern can do this when jump to defnition of function in another file is called, but you must tell tern what to execute in order to jump to the specified file */
            switchToDoc: Functions.switchToDoc,
            timeout: appConfig.completionTimeout ||
                (appConfig.useWebWorkerForTern ? 3000 : 1000),
            getFileName: function(s) {
                var doc = Doc.forSession(s);
                if (doc)
                    return doc.getSavePath();
            },
            getFile: function(name, cb) {
                var doc = docs[appConfig.currentDoc];
                var server = doc ? doc.getFileServer() : FileUtils.defaultServer;
                if (!name.startsWith("/")) name = "/" + name;
                fileLoader.loadFile(name, server, cb);
            },
            fileFilter: function(val, name, doc) {
                if (!doc.getMode) {
                    console.error("Tern possible Corruption: " + name);
                }
                else if (doc.getMode().$id != "ace/mode/javascript") {
                    //does not deal well with <script> tag in strings
                    return getJsFromMixedHtml(val);
                }
                return val;
            },
            /**
             * if passed, this function will be called once ternServer is started.
             * This is needed when useWorker=false because the tern source files are loaded asynchronously before the server is started.
             */
            startedCb: function(server) {
                //once tern is enabled, it can be accessed via editor.ternServer
                if (!ternServer) {
                    ternServer = server;
                    for (var doc in docs)
                        if (ternModes.hasOwnProperty(docs[doc].session.getMode().$id)) {
                            ternServer.addDoc(docs[doc].getPath(), docs[doc].session);
                        }
                }
            },
        };
        ace.config.loadModule('ace/ext/tern', function() {
            editor.setOption("enableTern", ternOptions);
        });
    }

    function loadConfig() {
        var defs = Utils.parseList(appConfig.ternPlugins);
        ternPlugins = {};
        for (var i in defs) {
            ternPlugins[defs[i]] = true;
        }
        ternDefs = Utils.parseList(appConfig.ternDefs);
    }
    loadConfig();
    var ternModes = {
        "ace/mode/javascript": true,
        "ace/mode/html": true,
        "ace/mode/php": true
    };
    var modelist = ace.require("ace/ext/modelist");
    var fileLoader = new FileLoader({
        maxCount: Infinity,
        maxSize: Utils.parseSize(appConfig.maxAutoLoadSize),
        fileFilter: function(name, path) {
            return loadedFiles.indexOf(path) < 0 && ternModes[modelist.getModeForPath(name).mode]
        }
    });
    var loadedFiles = [];


    FileUtils.registerOption("project", ["project"], "load-comp", "Load Completions", function(ev) {
        if (!ternServer) {
            ev.preventDefault();
            return;
        }
        var e = ev.filepath;
        var server = ev.browser.fileServer;
        var count = 0;
        var startTime = new Date().getTime();
        var each = function(path, err, res) {
            if (!err && res) {
                count++;
                loadedFiles.push(path);
                ternServer.addDoc(path, res);
            }

        }
        var finished = function(err) {
            console.log(err);
            Notify.info("Loaded " + count + " files" + " in " + (Math.round((new Date().getTime() - startTime) / 10) / 100.0) + " seconds");
        }
        if (FileUtils.isDirectory(e)) {
            Notify.ask("Load " + e + " recursively?", function() {
                fileLoader.getOpts().beforeFolder = function(p, y, n, l) {
                    Notify.ask("Load " + p + "\n" + l.length + " files\n" + l.slice(0, 10).join("\n") + "...", y, n);
                }
                fileLoader.loadFolder(e, server, each, finished, 3);
            }, function() { fileLoader.loadFolder(e, server, each, finished) });
        }
        else fileLoader.loadFile(e, server, function() {
            each.apply(null, arguments);
            finished();
        });
        ev.preventDefault();
    });
    MainMenu.addOption("reload-project", {
        close: true,
        caption: "Reload Project",
        onclick: function() {
            var a = global.getEditor();
            if (ternServer) {
                ternServer.docChanged(a);
            }
            fileLoader.loadList(loadedFiles,FileUtils.getProject().fileServer,function(p,err,res){
                ternServer.addDoc(p,res);
            },function(){
                Notify.info('Reloaded');
            })
        }
    }, true);

    function getJsFromMixedHtml(s, debug) {
        var r = '';
        var d = '';
        var inScript = false;
        var lines = s.split('\n');

        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (debug) d += '\n inScript=' + inScript + '; ' + i + '. ' + l;
            if (inScript) {
                if (l.match(/\s*\/script/)) {
                    inScript = false;
                    r += "\n";
                    continue;
                }
                r += "\n" + l;
            }
            else {
                if (l.match(/\s*<script/)) {
                    if (!l.match(/src="/)) { //dont add <scirpt src lines
                        inScript = true;
                    }
                }
                r += "\n";
            }
            if (i === 0) {
                r = r.replace("\n", ""); //dont add break for first line
            }
        }
        if (debug) console.log('GetJsFromMixedHtml debug', d);
        return r;
    }

    function onCreateDoc(doc) {
        if (ternModes.hasOwnProperty(doc.options.mode)) {
            if (ternServer)
                ternServer.addDoc(doc.getPath(), doc.session);
        }
    }

    function onCloseDoc(doc) {
        if (!ternServer) return;
        var ts = ternServer;
        for (var n in ts.docs) {
            var cur = ts.docs[n];
            if (cur.doc == doc.session) {
                if (loadedFiles.indexOf(n) > -1 || loadedFiles.indexOf("/" + n) > -1) {
                    ts.closeDoc(n);
                    cur.doc = (doc.options.mode != "ace/mode/javascript") ? getJsFromMixedHtml(doc.getValue()) : doc.getValue();
                }
                else ts.delDoc(n);
            }
        }
    }

    appEvents.on('createEditor', function(e) {
        setupTernServer(e.editor, Functions);
    });
    appEvents.on('createDoc', function(e) {
        onCreateDoc(e.doc);
    });
    appEvents.on('closeDoc', function(e) {
        onCloseDoc(e.doc);
    });
    //add option to load tern config

})(Modules)