define(function(require,exports,module) {
    require("grace/ext/glob/glob");
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var Utils = require("grace/core/utils").Utils;
    var Docs = require("grace/docs/docs").Docs;

    var completions = ace.require("ace/ext/completions");
    var ConfigEvents = require("grace/core/config").ConfigEvents;
    var appConfig = require("grace/core/config").Config.registerAll({
        "fileCompletion": {
            "currentDirs": ["$PROJECT_DIR"],
            "mountPaths": [
                ["~", "$PROJECT_DIR"]
            ],
            "maxFileSearchDepth": 1,
            "maxMatches": 10
        }
    }, "autocompletion");
    require("grace/core/config").Config.registerValues({
        "currentDirs": "By defualt, current project directory and directory name of current file will be searched. You can add more paths with this option. This should be an absolute path. You can also add wildcards such as /home/* (Note: this will match contents from all folders in /home/ not the contents of home). $PROJECT_DIR represents your projectDir. If maxFileSearchDepth>0, the directory of the current file is also searched first",
        "mountPaths": "A list of paths that will be substituted before resolving e.g ['/public/','/home/www/'] will list files from /home/www/ when you type /public/. If the given path is relative, it is resolved according to currentDirs option. Ensure you end both paths with trailing slashes.",
        "maxFileSearchDepth": {
            doc: "How many directories above the current directory should be checked",
            "default": 1
        },
        "maxMatches": "How many possible matches should be found before giving up"
    }, "autocompletion.fileCompletion");
    var config = appConfig.fileCompletion;

    function update() {
        if (exports.fileNameCompleter.registered !== Boolean(appConfig.enableFilenameCompletion)) {
            exports.fileNameCompleter.registered = Boolean(appConfig.enableFilenameCompletion);
            if (appConfig.enableFilenameCompletion)
                completions.addCompleter(exports.fileNameCompleter);
            else completions.removeCompleter(exports.fileNameCompleter);
        }
    }
    ConfigEvents.on("autocompletion", update);

    function gatherFileNames(folder, filename, roots, cb) {
        var baseScore = folder ? 500 : filename ? 300 : 250;
        config.mountPaths.some(function(mount) {
            if (folder.startsWith(mount[0])) {
                folder = mount[1] + folder.substring(mount[0].length);
                return true;
            }
        });
        var project = FileUtils.getProject();
        config.currentDirs.forEach(function(e) {
            if (e.indexOf("$PROJECT_DIR") > -1) {
                if (project.rootDir != FileUtils.NO_PROJECT) {
                    roots.push([e.replace("$PROJECT_DIR", project.rootDir), project.fileServer]);
                }
            } else roots.push([e, FileUtils.defaultServer]);
        });

        roots.forEach(function(e) {
            e[0] = FileUtils.resolve(e[0], folder);
        });
        roots = roots.filter(function(e, i) {
            return !(roots.slice(0, i).some(function(other) {
                return other[0] == e[0] && other[1] == e[1];
            }));
        });
        var files = [];
        //A lot of ops can be sped up if we had a means to watch files but I'm not even going there
        var found = 0;
        //Men I love this api
        var abort = new Utils.AbortSignal();
        var resume = Utils.asyncForEach(roots, function(folder, i, next, cancel) {
            next = abort.control(next, cancel);
            var dir = folder[0];
            if (/\*\?\\}/.test(dir)) {
                var params = FileUtils.globToWalkParams(dir);
                var root = params.root;
                abort.notify(FileUtils.walk({
                    dir: params.root,
                    fs: folder[1],
                    waitSignal: null,
                    map: function(path, n, c, isDir) {
                        if (isDir) {
                            if (params.matches.test(root + path) &&
                                !roots.some(function(e) {
                                    return e[0] == root + path && e[1] == folder[1];
                                })) {
                                roots.push([root + path, folder[1]]);
                                resume();
                            }
                            if (!params.canMatch.test(root + path)) {
                                return false;
                            }
                        }
                    },
                    finish: next
                }));
            } else folder[1].getFiles(folder[0], function(e, r) {
                if (r) {
                    files = files.concat(r.map(function(e) {
                        var isFile = e[e.length - 1] != "/";
                        var score = baseScore + (e[0] == "." ? 98 : isFile ? 99 :
                            100) - (3 * i);
                        if (e.startsWith(filename)) {
                            found++;
                            score += 100;
                        }
                        return {
                            iconClass: " symbol-completion symbol-completion-"+(isFile?"file":"folder"),
                            message: "filename",
                            meta: folder[0],
                            value: e,
                            score: score,
                            completer: exports.fileNameCompleter
                        };
                    }));
                    if (found >= config.maxMatches)
                        abort.abort();
                }
                next(); //allow abort to clean up
            });
        }, function() {
            cb(null, files);
        }, 3, true, true);
        resume(true);

    }
    var Autocomplete = ace.require("ace/autocomplete").Autocomplete;
    exports.fileNameCompleter = {
        registered: false,
        insertMatch: function(editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText) {
                editor.execCommand(Autocomplete.$deletePrefix, completions.filterText);
            }
            editor.execCommand("insertstring", data.value);
            if (data.value.endsWith("/")) {
                editor.completer.updateCompletions();
            }
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            var token = editor.session.getTokenAt(pos.row, pos
                .column);

            //requirement 1 -  must be a string or comment
            if (!token) {
                return callback(null);
            }
            var notFilename = false;
            if (!(/string|comment/.test(token.type))) {
                switch (editor.session.getMode().$id) {
                    case "javascript":
                    case "java":
                    case "python":
                        return callback(null);
                }
                notFilename = true;
            }
            var file = token.value.substring(0, pos.column - token.start);

            file = file.replace(/\\ /g, " ");
            if (file.indexOf(" ") > -1) {
                notFilename = true;
                file = file.split(" ").pop();
            }
            if (token.type.indexOf("comment") > -1) {
                notFilename = true;
                if (file.startsWith("/*"))
                    file = file.substring(2);
            } else {
                file = file.replace(/['"`]/, "");
            }
            file = file.replace(/\\\\/g, "/");

            //requirement 2, don't complete ordinary words
            //unless at the beginning of a string
            if (notFilename && file.indexOf("/") < 0) {
                return callback(null);
            }

            var doc = Docs.forSession(session);
            if (file !== "./")
                file = FileUtils.normalize(file);

            var folder;
            if (FileUtils.isDirectory(file) || !file) {
                folder = file;
                file = "";
            } else {
                folder = FileUtils.dirname(file);
                if (folder != "") {
                    file = file.substring(folder == "/" ? 1 : folder.length + 1);
                }
            }
            //dirname removes trailing slash except for root directory
            var possibleRoots = [];
            if (folder[0] != "/" && config.maxFileSearchDepth > 0)
                if (doc && doc.getSavePath()) {
                    var i = config.maxFileSearchDepth;
                    var dirpath = FileUtils.dirname(doc.getSavePath());
                    var path;
                    do {
                        path = dirpath;
                        possibleRoots.push([path, doc.getFileServer()]);
                        dirpath = FileUtils.dirname(path);
                    } while (dirpath && path != dirpath && (--i > 0));
                }
            gatherFileNames(folder, file, possibleRoots, callback);
        }
    };
    update();
});