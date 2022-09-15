define(function (require, exports, module) {
    require('grace/ext/file_utils/glob');
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Utils = require('grace/core/utils').Utils;
    var Schema = require('grace/core/schema').Schema;
    var Docs = require('grace/docs/docs').Docs;
    var ConfigEvents = require('grace/core/config').Config;
    var config = require('grace/core/config').Config.registerAll(
        {
            currentDirs: ['$PROJECT_DIR'],
            mountPaths: [['~', '$PROJECT_DIR']],
            maxFileSearchDepth: 1,
            maxMatches: 10,
            rules: [
                {
                    glob: '*.min.js',
                    removeSuffix: '.min.js',
                    removeFullpath: true,
                },
                {
                    glob: '*.?js',
                    removeExtension: true,
                    removeFullpath: true,
                },
            ],
            enableFileCompletion: true,
        },
        'autocompletion.fileCompletion'
    );
    require('grace/core/config').Config.registerInfo(
        {
            '!root':
                'Allow completing with filenames from project directory as well as filepaths found in files',
            currentDirs:
                'By default, current project directory and directory name of current file will be searched. You can add more paths with this option. This should be an absolute path. You can also add wildcards such as /home/* (Note: this will match contents from all folders in /home/ not the contents of home). $PROJECT_DIR represents your projectDir. If maxFileSearchDepth>0, the directory of the current file is also searched first',
            mountPaths:
                "A list of paths that will be substituted before resolving e.g ['/public/','/home/www/'] will list files from /home/www/ when you type /public/. If the given path is relative, it is resolved according to currentDirs option. Ensure you end both paths with trailing slashes.",
            maxFileSearchDepth: {
                doc:
                    'How many directories above the current directory should be checked',
                default: 1,
            },
            maxMatches:
                'How many possible matches should be found before giving up',
            rules: {
                doc:
                    'Special handling for file extensions. Format:\n' +
                    '{\n' +
                    'glob: "string",\n' +
                    '"removeSuffix": "?string",\n' +
                    '"removeExtension": "?boolean",\n' +
                    '"removeFullpath": "?boolean",\n' +
                    '},',

                type: [
                    new Schema.XOneOf([
                        Schema.parse({
                            glob: 'string',
                            removeSuffix: '?string',
                            removeFullpath: '?boolean',
                            removeExtension: '?!<>',
                        }),
                        Schema.parse({
                            glob: 'string',
                            removeExtension: '?boolean',
                            removeFullpath: '?boolean',
                            removeSuffix: '?!<>',
                        }),
                    ]),
                ],
            },
        },
        'autocompletion.fileCompletion'
    );
    var Autocomplete = ace.require('ace/autocomplete').Autocomplete;
    var completions = ace.require('ace/ext/completions');
    var IS_GLOB = /\*\?\\}/;
    var parsedRules;
    function parseRule(e) {
        return Object.assign({}, e, {
            glob: FileUtils.globToRegex(e.glob),
        });
    }
    var completer = {
        name: 'Filename completer',
        registered: false,
        insertMatch: function (editor, data) {
            var completions = editor.completer.completions;
            if (completions.filterText) {
                editor.execCommand(
                    Autocomplete.$deletePrefix,
                    completions.filterText
                );
            }
            editor.execCommand('insertstring', data.value);
            if (data.value.endsWith('/')) {
                editor.completer.updateCompletions();
            }
        },
        getCompletions: function (editor, session, pos, prefix, callback) {
            var token = editor.session.getTokenAt(pos.row, pos.column);
            //requirement 1 -  must be a string or comment
            if (!token) {
                return callback(null);
            }
            var mightNotBeFile = false;
            if (!/string|comment/.test(token.type)) {
                switch (editor.session.getInnerMode()) {
                    case 'javascript':
                    case 'java':
                    case 'python':
                        return callback(null);
                }
                mightNotBeFile = true;
            }
            var file = token.value.substring(0, pos.column - token.start);
            var lastWord = /(?:[^\s\\]+|\\ |\\)$/.exec(file);
            if (lastWord && lastWord[0] !== file) {
                mightNotBeFile = true;
                file = lastWord;
            }
            if (token.type.indexOf('comment') > -1) {
                mightNotBeFile = true;
                if (file.startsWith('/*')) file = file.substring(2);
            } else {
                file = file.replace(/['"`]/, ''); // remove string
            }
            file = file.replace(/\\\\/g, '/');
            //requirement 2, don't complete ordinary words
            //unless at the beginning of a string
            if (mightNotBeFile && file.indexOf('/') < 0) {
                return callback(null);
            }

            if (file !== './') file = FileUtils.normalize(file);
            var folder; //get folder
            if (FileUtils.isDirectory(file) || !file) {
                folder = file;
                file = '';
            } else {
                folder = FileUtils.dirname(file);
                if (folder != '') {
                    file = file.substring(
                        folder == '/' ? 1 : folder.length + 1
                    );
                }
            }
            gatherFileNames(
                folder,
                file,
                getPossibleRoots(folder, Docs.forSession(session)),
                callback
            );
        },
    };
    function update() {
        var enabled = !!config.enableFilenameCompletion;
        if (completer.registered !== enabled) {
            completer.registered = enabled;
            if (enabled) completions.addCompleter(completer);
            else completions.removeCompleter(completer);
        }
    }

    function addTo(files, folderName, getScore) {
        return function (e) {
            var isFile = !FileUtils.isDirectory(e);
            var score = getScore(e, isFile);
            if (isFile) {
                if (!parsedRules) parsedRules = config.rules.map(parseRule);
                var matched;
                parsedRules.some(function (rule) {
                    var fullpath = FileUtils.join(folderName, e);
                    return (
                        (rule.glob.test(e) || rule.glob.test(fullpath)) &&
                        (matched = rule)
                    );
                });
                if (matched) {
                    var suffix =
                        matched.removeSuffix ||
                        (matched.removeExtension && '.' + FileUtils.extname(e));
                    if (e.endsWith(suffix)) {
                        files.push({
                            iconClass:
                                ' symbol-completion symbol-completion-' +
                                (isFile ? 'file' : 'folder'),
                            message: 'filename',
                            meta: folderName,
                            value: e.slice(0, -matched.removeSuffix.length),
                            score: score,
                            completer: completer,
                        });
                    }
                    if (matched.removeFullpath) return;
                }
            }
            files.push({
                iconClass:
                    ' symbol-completion symbol-completion-' +
                    (isFile ? 'file' : 'folder'),
                message: 'filename',
                meta: folderName,
                value: e,
                score: score,
                completer: completer,
            });
        };
    }
    function getPossibleRoots(folderName, doc) {
        var possibleRoots = [];

        //Add parent folders of the current document
        if (
            doc &&
            doc.getSavePath() &&
            folderName[0] != '/' &&
            config.maxFileSearchDepth > 0
        ) {
            var i = config.maxFileSearchDepth;
            var dirpath = FileUtils.dirname(doc.getSavePath());
            var path;
            do {
                path = dirpath;
                possibleRoots.push([path, doc.getFileServer()]);
                dirpath = FileUtils.dirname(path);
            } while (dirpath && path != dirpath && --i > 0);
        }

        //Add parent folders from mount paths
        config.mountPaths.some(function (mount) {
            if (folderName.startsWith(mount[0])) {
                folderName = mount[1] + folderName.substring(mount[0].length);
                return true;
            }
        });

        //Add parent folders from current directories
        var project = FileUtils.getProject();
        config.currentDirs.forEach(function (e) {
            if (e.indexOf('$PROJECT_DIR') > -1) {
                if (project.rootDir != FileUtils.NO_PROJECT) {
                    possibleRoots.push([
                        e.replace('$PROJECT_DIR', project.rootDir),
                        project.fileServer,
                    ]);
                }
            } else possibleRoots.push([e, FileUtils.getFileServer()]);
        });

        //Add the folder name to the possible roots
        possibleRoots.forEach(function (e) {
            e[0] = FileUtils.resolve(e[0], folderName);
        });
        return possibleRoots;
    }
    function gatherFileNames(folderName, filename, possibleRoots, cb) {
        var roots = [];

        function addEntry(path, fs) {
            //Make sure each entry is unique
            if (
                !roots.some(function (e) {
                    return e[0] == path && e[1] == fs;
                })
            ) {
                roots.splice(last, 0, [path, fs]);
            }
        }
        possibleRoots.forEach(addEntry.apply.bind(addEntry, null));

        function addGlobEntries(glob, fs, cb) {
            var params = FileUtils.globToWalkParams(glob);
            var root = params.root;
            abort.notify(
                FileUtils.walk({
                    dir: params.root,
                    fs: fs,
                    waitSignal: null,
                    map: function (path, n, c, isDir) {
                        if (!isDir) return;
                        var fullpath = root + path;
                        if (params.matches.test(fullpath)) {
                            addEntry(fullpath, fs);
                            resume();
                        }

                        if (!params.canMatch.test(fullpath)) {
                            return false;
                        }
                    },
                    finish: cb,
                })
            );
        }
        var files = [];
        // A lot of ops can be sped up if we had a means to watch files
        // but I'm not even going there. Let fs provider deal with caching.
        var found = 0;
        var abort = new Utils.AbortSignal();
        var baseScore = folderName ? 500 : filename ? 300 : 250;
        var last;//Need this since tasks are done in parallel
        function forEachRoot(entry, i, next, cancel) {
            last = i;
            next = abort.control(next, cancel);
            var dir = entry[0];
            var fs = entry[1];
            if (IS_GLOB.test(dir)) {
                addGlobEntries(dir, fs, next);
            } else {
                //add all the files in the folder
                fs.getFiles(dir, function (e, r) {
                    if (r) {
                        r.forEach(
                            addTo(files, dir, function (name, isFile) {
                                var score =
                                    baseScore -
                                    3 * i +
                                    (name[0] == '.' ? 98 : isFile ? 99 : 100);
                                if (name.startsWith(filename)) {
                                    found++;
                                    score += 100;
                                }
                                return score;
                            })
                        );
                        if (found >= config.maxMatches) abort.abort();
                    }
                    next(); //allow abort to clean up
                });
            }
        }
        //Men I love this api
        var resume = Utils.asyncForEach(
            roots,
            forEachRoot,
            function () {
                cb(null, files);
            },
            3,
            true,
            true
        );
        resume(true);
    }

    ConfigEvents.on('autocompletion.fileCompletion', function (ev) {
        if (ev.config === 'rules') {
            parsedRules = null;
        } else if (ev.config === 'enableFileCompletion') update();
    });
    update();
    exports.fileNameCompleter = completer;
});