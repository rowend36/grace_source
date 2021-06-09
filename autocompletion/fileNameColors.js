_Define(function(global) {
    var FileUtils = global.FileUtils;
    var docs = global.docs;
    var Utils = global.Utils;
    var Docs = global.Docs;

    var completions = global.Completions;
    var ConfigEvents = global.ConfigEvents;
    var appConfig = global.registerAll({
        "fileCompletion": {
            "currentDirs": ["$PROJECT_DIR"],
            "mountPaths":[["~","$PROJECT_DIR"]],
            "maxFileSearchDepth": 1,
            "maxMatches": 10
        }
    }, "autocompletion");
    global.registerValues({
        "currentDirs": "By defualt, current project directory and directory name of current file will be searched. You can add more paths with this option. This should be an absolute path. You can also add globs such as /home/* (Note: this will match contents from all folders in /home/ not the contents of home). $PROJECT_DIR represents your projectDir. If maxFileSearchDepth>0, the directory of the current file is also searched first",
        "mountPaths":"A list of paths that will be substituted before resolving e.g ['/public/','/home/www/'] will list files from /home/www/ when you type /public/. If the given path is relative, it is resolved according to currentDirs option. Ensure you end both paths with trailing slashes.",
        "maxFileSearchDepth": {
            doc: "How many directories above the current directory should be checked",
            "default": 1
        },
        "maxMatches": "How many possible matches should be found before giving up"
    }, "autocompletion.fileCompletion");
    var config = appConfig.fileCompletion;

    function update() {
        if (global.fileNameCompleter.registered !== Boolean(appConfig.enableFilenameCompletion)) {
            global.fileNameCompleter.registered = Boolean(appConfig.enableFilenameCompletion);
            if (appConfig.enableFilenameCompletion)
                completions.addCompleter(global.fileNameCompleter);
            else completions.removeCompleter(global.fileNameCompleter);
        }
    }
    ConfigEvents.on("autocompletion", update);

    function gatherFileNames(folder, filename, roots, cb) {
        config.mountPaths.some(function(mount){
            if(folder.startsWith(mount[0])){
                folder = mount[1]+folder.substring(mount[0].length);
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
            if (dir.indexOf("*") > -1) {
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
                        return {
                            iconClass: " symbol-completion-folder",
                            message: "filename",
                            meta: folder[0],
                            value: e,
                            score: (e[0] == "." ? 698 : e[e.length - 1] != "/" ? 699 : 700) - (3 * i),
                            completer: global.fileNameCompleter
                        };
                    }));
                    r.forEach(function(e) {
                        if (e.startsWith(filename)) found++;
                    });
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
    global.fileNameCompleter = {
        registered: false,
        insertMatch: function(editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText) {
                var ranges = editor.selection.getAllRanges();
                for (var i = 0, range; range = ranges[i]; i++) {
                    range.start.column -= completions.filterText.length;
                    editor.session.remove(range);
                }
            }
            editor.execCommand("insertstring", data.value);
            if (data.value.endsWith("/")) {
                editor.completer.updateCompletions();
            }
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            var token = editor.session.getTokenAt(pos.row, pos
                .column);
            if (!token || !/string|comment/.test(token.type)) {
                return callback(null);
            }
            var file = token.value.substring(0, pos.column - token.start);
            file = file.split(" ").pop();
            if (token.type.indexOf("comment") > -1) {
                if (file.startsWith("/*"))
                    file = file.substring(2);
            } else file = file.replace(/['"`]/, "");
            file = file.replace(/\\\\/g, "/");
            if (file.indexOf("/") < 0) {
                return callback(null);
            }
            var doc = Docs.forSession(session);
            file = FileUtils.normalize(file);
            var folder = FileUtils.dirname(file);
            if (FileUtils.isDirectory(file)) {
                folder = file;
                file = "";
            } else if (folder == null) {
                folder = file;
                file = "";
            } else file = file.substring(folder == "/" ? 1 : folder.length + 1);

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
_Define(function(global) {
    var FileUtils = global.FileUtils;
    var docs = global.docs;
    var Utils = global.Utils;
    var Docs = global.Docs;
    //make this a line completer
    var completions = global.Completions;
    var ConfigEvents = global.ConfigEvents;
    var appConfig = global.registerAll({
        colors: {
            prefixes: ["color:", "background-color:", "style.color=", "style.backgroundColor=", "border:## ##"],
            colors: ["red", "blue", "orange"]
        }
    }, "autocompletion")
    var config = appConfig.colors;
    global.registerValues({}, "autocompletion");

    var regex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*\d+\s*)?\)|\#(?:[\da-f]{6,8}|[\da-f]{3,4})/g;

    function matchLine(prefix, line) {
        line = line.replace(/^\s*|\s*$/g, "").replace(/\s+/g, " ").replace(/['"`]$/, "");
        prefix = Utils.regEscape(prefix)
            .replace(/\\#\\#/g, "\\s?.+\\s?")
            .replace(/\W+/g, "\\s?$&\\s?");
        try {
            return new RegExp(prefix).test(line);
        } catch (e) {
            Notify.error("Invalid color regex");
        }
    }

    function update() {
        if (global.colorCompleter.registered !== Boolean(appConfig.enableColorCompletion)) {
            global.colorCompleter.registered = Boolean(appConfig.enableColorCompletion);
            if (appConfig.enableColorCompletion)
                completions.addCompleter(global.colorCompleter);
            else completions.removeCompleter(global.colorCompleter);
        }
    }
    ConfigEvents.on("autocompletion", update);
    var registry = {}

    function gatherColors() {
        var p = config.colors.slice(0);
        for (var i in docs) {
            if (!registry[i] || doc.getRevision() != registry[i].rev) {
                registry[i] = {
                    rev: doc.getRevision()
                };
                var t = docs[i].getValue();
                regex.lastIndex = 0;
                var colors = t.match(regex);
                if (colors) {
                    var prev;
                    colors = colors.sort().filter(function(e) {
                        return e == prev ? false : (prev = e)
                    });
                }
                registry[i].colors = colors;
            }
            if (registry[i].colors) {
                p = p.concat(registry[i].colors);
            }
        }
        var prev = "";
        p = p.sort().filter(function(e) {
            return e == prev ? false : (prev = e)
        });
        return p.map(
            function(e) {
                return {
                    iconClass: " symbol-completion-color",
                    message: 'color',
                    value: e.value || e,
                    caption: e.caption || e,
                    score: 600,
                };
            }
        );
    }
    global.colorCompleter = {
        registered: false,
        getCompletions: function(editor, session, pos, prefix, callback) {
            //check mode
            var line = editor.session.getLine(pos.row).slice(0, pos.column - prefix.length);
            if (config.prefixes.some(function(e) {
                    return matchLine(e, line);
                })) callback(null, gatherColors());
            else callback(null);
        }
    };
    update();
});