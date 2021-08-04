_Define(function(global) {
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Docs = global.Docs;

    var completions = global.Completions;
    var ConfigEvents = global.ConfigEvents;
    var appConfig = global.registerAll({
        "fileCompletion": {
            "currentDirs": ["$PROJECT_DIR"],
            "mountPaths": [
                ["~", "$PROJECT_DIR"]
            ],
            "maxFileSearchDepth": 1,
            "maxMatches": 10
        }
    }, "autocompletion");
    global.registerValues({
        "currentDirs": "By defualt, current project directory and directory name of current file will be searched. You can add more paths with this option. This should be an absolute path. You can also add globs such as /home/* (Note: this will match contents from all folders in /home/ not the contents of home). $PROJECT_DIR represents your projectDir. If maxFileSearchDepth>0, the directory of the current file is also searched first",
        "mountPaths": "A list of paths that will be substituted before resolving e.g ['/public/','/home/www/'] will list files from /home/www/ when you type /public/. If the given path is relative, it is resolved according to currentDirs option. Ensure you end both paths with trailing slashes.",
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
                            completer: global.fileNameCompleter
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
    var Autocomplete = global.Autocomplete;
    global.fileNameCompleter = {
        registered: false,
        insertMatch: function(editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText) {
                editor.completer.execCommand(Autocomplete.$deletePrefix, completions.filterText);
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
_Define(function(global) {
    //A very simple completer for css
    var docs = global.docs;
    var Utils = global.Utils;
    var completions = global.Completions;
    var ConfigEvents = global.ConfigEvents;
    var appConfig = global.registerAll({
        colors: {
            presets: ["red", "blue", "orange"]
        }
    }, "autocompletion");
    var config = appConfig.colors;
    global.registerValues({
        "presets": "An Array of color presets. Best loaded as a separate file. Each item can either be an object of the form \n\
{\n\
    value:string, - The value inserted when selected\n\
    caption?string, - The name in autocompletion menu\n\
    color?:string?\n - The color used for preview\n\
} or a plain string representing all of them"
    }, "autocompletion.colors");
    var prefixes = ["color:", "background-color:", "style.color=", "style.backgroundColor=", "background:",
        "style.background=", "#", "rgb(", "rgba("
    ];
    //what attrocity
    var regex =
        /rgba?\(\s*(\d*\.)?\d+\s*,\s*(\d*\.)?\d+\s*,\s*(\d*\.)?\d+(?:\s*,\s*(\d*\.)?\d+\s*)?\)|\#(?:[\da-f]{6,8}|[\da-f]{3,4})/g;

    function matchLine(prefix, line) {
        line = line.replace(/^\s*|\s*$/g, "").replace(/\s+/g, " ").replace(/['"`]/g, "");
        prefix = Utils.regEscape(prefix)
            .replace(/\\#\\#/g, "\\s?.+\\s?")
            .replace(/\W+/g, "\\s?$&\\s?") + "$";
        try {
            return new RegExp(prefix).exec(line);
        } catch (e) {
            global.Notify.error("Invalid color regex");
            return false;
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
    var registry = {};

    function uniq(arr) {
        var prev;
        return arr.sort().filter(function(e) {
            return e == prev ? false : (prev = e);
        });
    }

    function gatherColors(removePrefix) {
        var p = config.presets.slice(0);
        for (var i in docs) {
            var doc = docs[i];
            if (!registry[i] || doc.getRevision() != registry[i].rev) {
                registry[i] = {
                    rev: doc.getRevision()
                };
                var t = docs[i].getValue();
                regex.lastIndex = 0;
                var colors = t.match(regex);
                if (colors) {
                    //perharps Utils.uniq
                    colors = uniq(colors);
                }
                registry[i].colors = colors;
            }
            if (registry[i].colors) {
                p = p.concat(registry[i].colors);
            }
        }
        p = uniq(p);
        var score = 600;
        var prefixOffset = 0;
        if (removePrefix) {
            prefixOffset = removePrefix.length;
            p = p.filter(function(e) {
                return (e.caption || e.value || e).startsWith(removePrefix);
            });
            score += 300;
        }
        return p.map(
            function(e) {
                return {
                    iconClass: " symbol-completion symbol-completion-color",
                    message: 'color',
                    value: e.value || e,
                    completer: global.colorCompleter,
                    color: e.color || (typeof e == "string" ? e : null),
                    caption: (e.caption || e.value || e).substring(prefixOffset),
                    score: score,
                };
            }
        );
    }
    var Autocomplete = global.Autocomplete;
    global.colorCompleter = {
        registered: false,
        insertMatch: function(editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText || this.filterPrefix) {
                var prefix = completions.filterText + this.filterPrefix;
                editor.execCommand(Autocomplete.$deletePrefix, prefix);
                var suffix = this.filterSuffixes[this.filterPrefix];
                if (suffix)
                    editor.execCommand(Autocomplete.$deleteSuffix, suffix);
            }
            editor.execCommand("insertstring", data.value);
        },
        filterPrefix: "",
        filterSuffixes: {
            "#": "",
            "rgba(": ")",
            "rgb(": ")"
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            //check mode
            var line = editor.session.getLine(pos.row).slice(0, pos.column - prefix.length);
            if (prefixes.some(function(e) {
                    var result = matchLine(e, line);
                    if (result) {
                        if (this.filterSuffixes.hasOwnProperty(result[0]))
                            this.filterPrefix = result[0];
                        else this.filterPrefix = "";
                        return true;
                    }
                    return false;
                }, this)) {
                callback(null, gatherColors(this.filterPrefix));
            } else callback(null);
        },
        getDocTooltip: function(item) {
            if (!item.docHTML && item.color) {
                item.docHTML = "<span class='color-preview' style='background:" + item.color +
                    "'></span>";
            }
        }
    };
    update();
});