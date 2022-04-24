define(function(require, exports, module) {
    "use strict";
    var Config = require("./config").Config;
    var getObj = Config.getObj;
    var EventsEmitter = require("./events").EventsEmitter;
    var Utils = require("./utils").Utils;
    var Notify = require("../ui/notify");
    var configure = Config.configure;
    var configureArr = Config.configureArr;
    var cyclicRequire = require;
    var putObj = Config.putObj;
    var debug = console;

    /*Dynamic dependencies Notify,Form,Docs,Doc,docs,FileBrowser*/
    /*
        TODO Split into 3 parts and get rid of cyclicRequire
        This class starts of as a nodejs path module then
        manages fileservers for documents,
        some kind of filebrowser manager,
        then a doc save/open utility.
    Warning: Assumes that all paths are android ie linux paths.
    If you supply windows paths, the results are undefined.
    */
    var NO_PROJECT = "**no-project**";
    var appConfig = Config.registerAll({
        projectFileServer: "",
        defaultEncoding: "utf8",
        projectName: NO_PROJECT,
        projectRoot: NO_PROJECT,
        maxRecentFolders: 7,
        recentFolders: [],
        bookmarks: ["/sdcard/",
            "/data/data/io.tempage.dorynode/"
        ],
        codeFileExts: [".js", ".css", ".html", ".sass", ".less",
            ".json", ".py", ".ts", ".tsx",
            ".jsx",
        ],
        dotStar: false,
        binaryFileExts: [".zip", ".mp4", ".mp3", ".rar",
            ".tar.gz", ".tgz", ".iso", ".bz2", ".3gp",
            ".avi", ".mkv", ".exe",
            ".apk", ".tar", ".jar", ".png", ".jpg", ".jpeg",
            ".ttf", ".otf", ".woff", ".woff2"
        ],
    }, "files");
    require("./config").ConfigEvents.on("files", function(e) {
        switch (e.config) {
            case "projectName":
                project.name = e.newValue;
                FileUtils.trigger("change-project-name");
                break;
            case "projectRoot":
                //do nothing - prevents infinite looping
        }
    });
    Config.registerValues({
        recentFolders: {
            type: "array<filename>"
        },
        dotStar: "Enable dotStar matching for globs.eg main/* matches main/.tmp",
        binaryFiles: "A list of file extensions\n that should never be opened for editing",
        projectRoot: "This directory serves as the current directory for all file operations"
    }, "files");
    var codeFileExts = appConfig.codeFileExts;
    var bookmarks = appConfig.bookmarks;
    var binaryFileExts = appConfig.binaryFileExts;
    var serverCreationParams = getObj("serverCreationParams");

    function test(a, b, next, i, custom) {
        var testfunc = sort_funcs[next[i]] || custom[next[i]];
        var res = testfunc(a, b);
        if (res) return res;
        if (next[i + 1] === undefined) return 0;
        else return test(a, b, next, i + 1, custom);
    }

    var sort_funcs = {
        folder: function(a, b) {
            var x = a.endsWith(SEP);
            return x == b.endsWith(SEP) ? 0 : x ? -1 : 1;
        },
        notfolder: function(a, b) {
            var x = a.endsWith(SEP);
            return x == b.endsWith(SEP) ? 0 : x ? 1 : -1;
        },
        code: function(a, b) {
            var x = isCode(a);
            return x == isCode(b) ? 0 : x ? -1 : 1;
        },
        notbinary: function(a, b) {
            var x = FileUtils.isBinaryFile(a);
            return x == FileUtils.isBinaryFile(b) ? 0 : x ? 1 :
                -1;
        },
        name: function(a, b) {
            var x = b.toLowerCase();
            var y = a.toLowerCase();
            return x > y ? -1 : x < y ? 1 : 0;
        },
    };
    var isCode = function(a) {
        for (var i in codeFileExts) {
            if (a.endsWith(codeFileExts[i])) return true;
        }
        return false;
    };

    function sort(files, mode, custom) {
        var modes = mode.split(",");
        return files.sort(function(a, b) {
            return test(a, b, modes, 0, custom);
        });
    }
    var loadedServers;
    var project = {
        name: appConfig.projectName || appConfig.projectRoot,
        rootDir: appConfig.projectRoot,
        fileServer: null,
    };
    var StatProps = {
        isDirectory: function() {
            return this.type == "dir";
        },
        isSymbolicLink: function() {
            return this.type == "symlink";
        },
        isFile: function() {
            return this.type == "file";
        },
        dev: 2114,
        ino: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 4096,
        birthtime: new Date(0),
    };
    var serverFactories = [];
    //var needsRecreate;
    var SEP = "/";
    var FileUtils = {
        sep: SEP,
        NO_PROJECT: NO_PROJECT,
        _eventRegistry: {
            close: null,
            "create-file": null,
            "open-file": null,
            "open-project": null,
            "delete-file": null,
            "found-file": null,
            "change-project": null,
            "change-project-name": null
        },
        //path manipulation
        normalize: function(path) {
            if (!path) return "";
            var a = 0,
                start,
                end;
            path = path.split(SEP);
            var p = path.length;
            if (path[0] === "") {
                start = SEP;
                a = 1;
            } else start = "";
            if (path[p - 1] === "") {
                end = SEP;
            } else end = "";
            var t = -1;
            var newpath = [];
            for (; a < p; a++) {
                if (path[a] === "" || path[a] === ".") {
                    continue;
                } else if (path[a] === "..") {
                    if (t > -1 && newpath[t] !== "..") {
                        newpath.pop();
                        t--;
                        continue;
                    }
                }
                newpath[++t] = path[a];
            }
            return t > -1 ? start + newpath.join(SEP) + end :
                start;
        },
        //expects normalized path, clears trailing slash for uniformity
        dirname: function(path) {
            if (!path || path == SEP) return null;
            path = FileUtils.removeTrailingSlash(path);
            return path.split(SEP).slice(0, -1).join(SEP) || (
                path[0] == SEP ? SEP : "");
        },
        join: function(base) {
            var a = 1,
                path;
            while ((path = arguments[a++]) !== undefined) {
                base = (base ? base.replace(/\/+$/, "") + SEP :
                    "") + path.replace(/^\/+/, "");
            }
            return base;
        },
        /*extname("man.txt")=txt*/
        extname: function(name) {
            var ext = name.lastIndexOf(".");
            if (ext > 0) {
                return name.substring(ext + 1);
            } else return "";
        },
        isBinaryFile: function(name) {
            var match = 0;
            while ((match = name.indexOf(".", match) + 1) > 0) {
                if (match > 1 && binaryFileExts.indexOf(name
                        .substring(match - 1)) > -1) {
                    return true;
                }
            }
        },
        addToRecents: function(folder) {
            var recentFolders = appConfig.recentFolders;
            var index = recentFolders.indexOf(folder);
            if (index > -1) {
                recentFolders = recentFolders.slice(0, index)
                    .concat(recentFolders.slice(index + 1));
            }
            recentFolders.unshift(folder);
            if (recentFolders.length > appConfig
                .maxRecentFolders) recentFolders.pop();
            configureArr("recentFolders", recentFolders,
                "files");

        },
        //does nothing to '/'
        removeTrailingSlash: function(e) {
            return e[e.length - 1] == SEP ? e.substring(0, e
                .length - 1) || SEP : e;
        },
        resolve: function(from, path) {
            if (path[0] == SEP) {
                return FileUtils.normalize(path);
            }
            return FileUtils.normalize(from + SEP + path);
        },
        //expects normalized paths
        relative: function(from, path, forceKeepSlash,
            noBackTrace) {
            //absolute to relative
            if (from[0] != SEP && path[0] == SEP) return null;
            //relative to absolute
            if (from[0] == SEP && path[0] != SEP) return null;
            if (from === "") return path;
            from = from == SEP ? "" : FileUtils
                .removeTrailingSlash(from);
            if (path === from) return "";
            if (path.startsWith(from + SEP)) {
                return (path.substring(from.length + 1) || (
                    forceKeepSlash ? "./" : ""));
            }
            if (noBackTrace) return null;
            var child = path.split(SEP);
            var parent = from.split(SEP);
            var i = 0;
            for (; i < child.length && i < parent.length &&
                parent[i] == child[i]; i++) {}
            var relative = "";
            for (var j = i; j < parent.length; j++) {
                relative += forceKeepSlash || j < parent
                    .length - 1 ? "../" : "..";
            }
            for (j = i; j < child.length; j++) {
                relative += (forceKeepSlash && j == i ? "" :
                    SEP) + child[j];
            }
            return relative;
        },
        //expects normalized path
        filename: function(e) {
            var isFolder = false;
            if (e.endsWith(SEP)) isFolder = true;
            while (e.endsWith(SEP)) e = e.slice(0, e.length -
                1);
            return (e.substring(e.lastIndexOf(SEP) + 1, e
                .length) + (isFolder ? SEP : ""));
        },
        isDirectory: function(name) {
            return name.endsWith(SEP);
        },
        createStats: function(stat) {
            var bits = {
                //socket: 140000,
                symlink: 120000,
                file: 100000,
                //block: 60000,
                dir: 40000,
                //character: 20000,
                //fifo: 10000
            };
            return Object.assign(Object.create(StatProps), {
                mtimeMs: stat.mtimeMs,
                type: stat.type,
                size: stat.size,
                ino: stat.ino || 0,
                mode: stat.mode || parseInt(bits[stat
                    .type] + 644, 8),
                atimeMs: stat.atimeMs || stat.mtimeMs,
                ctimeMs: stat.ctimeMs || stat.mtimeMs,
                mtime: new Date(stat.mtimeMs),
                ctime: new Date(stat.ctimeMs),
                atime: new Date(stat.atimeMs),
            });
        },
        sort: sort,
        //needed methods for fileservers
        registerFileServer: function(type, caption, factory, config,
            isDefault) {
            serverFactories[type] = {
                create: factory,
                caption: caption,
                config: config,
            };
            if (isDefault && !FileUtils.defaultServer) {
                FileUtils.defaultServer = factory();
            }
            FileUtils.trigger("register-fileserver", type,
                true);
        },
        $serverFactories: serverFactories,
        //TODO no undefined ids
        createServer: function(type, params, id) {
            var server = null;
            var factory = serverFactories[type];
            if (!id) id = Utils.genID("s");
            if (factory) {
                //The factory can modify the type
                server = factory.create(params, id);
            } else {
                throw new Error("Unknown server type " + type);
            }
            if (!server.id) server.id = id;

            serverCreationParams[server.id] = params;
            loadedServers[server.id] = server;
            putObj("serverCreationParams",
                serverCreationParams);
            return server;
        },
        getFileServer: function(id, fallback) {
            if (!id) return FileUtils.defaultServer;
            return (
                (loadedServers && loadedServers[id]) || (
                    fallback && FileUtils.defaultServer));
        },
        loadServers: function() {
            loadedServers = {};
            for (var i in serverCreationParams) {
                var params = serverCreationParams[i];
                try {
                    loadedServers[i] = FileUtils.createServer(
                        params.type, params, i);
                } catch (e) {
                    debug.error(e);
                }
            }
            project.fileServer = loadedServers[appConfig
                    .projectFileServer] || FileUtils
                .defaultServer;
            project.rootDir = appConfig.projectRoot;
            FileUtils.trigger("change-project", {
                project: project
            }, true);
        },
        replaceServer: function(stub, server) {
            if (stub.$isStub) {
                loadedServers[stub.id] = server;
                if (stub == FileUtils.defaultServer) {
                    FileUtils.defaultServer = server;
                }
                FileUtils.trigger("replace-fileserver", {
                    former: stub,
                    current: server
                });
                if (project.fileServer == stub) {
                    FileUtils.openProject(project.rootDir,
                        server, project.name);
                }
            } else
                throw "Error: only stub servers can be replaced";
        },
        //controlled method
        //Does not check if fs is in use
        deleteServer: function(id) {
            var server = loadedServers[id];
            if (server == project.fileServer) {
                FileUtils.openProject(NO_PROJECT, FileUtils
                    .defaultServer);
            }
            if (server.destroy) server.destroy();
            delete loadedServers[id];
            delete serverCreationParams[id];
            putObj("serverCreationParams",
                serverCreationParams);
        },
        //document helpers
        availableEncodings: function(server) {
            if (!server) server = FileUtils.defaultServer;
            //cached result
            if (server.$encodingList) return server
                .$encodingList;
            var encodingList = [];
            var supportedList = server.getEncodings ? server
                .getEncodings().sort() : [];
            if (supportedList.indexOf("utf8") < 0) supportedList
                .unshift("utf8");
            for (var i in supportedList) {
                var encoding = supportedList[i];
                encodingList.push({
                    caption: encodingNames[encoding] ||
                        encoding.replace(/\-/g, " "),
                    value: encoding,
                });
            }
            server.$encodingList = encodingList;
            return encodingList;
        },
        normalizeEncoding: function(enc) {
            return enc.replace(/\-/g, "").toLowerCase();
        },
        encodingFor: function( /*path, server*/ ) {
            //todo if server supports detect, detect
            return appConfig.defaultEncoding;
        },
        getProject: function() {
            return project;
        },
        openProject: function(path, fileServer, name) {
            path = FileUtils.normalize(path);
            configure("projectFileServer", fileServer.id,
                "files");
            configure("projectRoot", path, "files");
            configure("projectName", name || path, "files");
            project.fileServer = fileServer;
            project.rootDir = path;
            project.name = name || (path.length > 50 ? "..." +
                path.substring(-45) : path);
            FileUtils.trigger("change-project", {
                project: project,
            }, true);
            if (path == NO_PROJECT) {
                FileUtils.trigger("close-project", {
                    project: project,
                }, true);
            }
        },
        getConfig: function(name, cb, project) {
            var fs, rootDir;
            if (project) {
                fs = project.fileServer;
                if (!fs) throw new Error(
                    'Missing parameter: fileServer');
                rootDir = project.rootDir;
            } else if (name[0] == FileUtils.sep) {
                fs = FileUtils.defaultServer;
            } else {
                fs = FileUtils.getProject().fileServer;
                rootDir = FileUtils.getProject().rootDir;
            }
            if (!fs) {
                //app not yet loaded
                return FileUtils.once('change-project',
                    function() {
                        FileUtils.getConfig(name, cb);
                    });
            }
            if (name[0] !== FileUtils.sep) {
                if (rootDir == FileUtils.NO_PROJECT) {
                    return cb(null, "");
                } else name = FileUtils.resolve(rootDir, name);
            }
            fs.readFile(name, "utf8", function(e, res) {
                if (e && e.code == "ENOENT") {
                    cb(null, "");
                } else if (res) cb(null, res);
                else cb(e, "");
            });
        },
        saveConfig: function(name, content, cb, project) {
            project = project || FileUtils.getProject();
            project.fileServer.writeFile(FileUtils.resolve(
                    project.rootDir, name), content, "utf8",
                cb);
        },
        ownChannel: function(channel, owner) {
            if (channels.handlers[channel]) {
                throw "Error: Channel already has owner";
            }
            channels.handlers[channel] = owner;
            channels.triggerForever(channel + "-loaded");
        },
        channelHasPending: function(id) {
            return channels._eventRegistry[id + "-loaded"] &&
                channels._eventRegistry[id +
                    "-loaded"] !== true;
        },
        postChannel: function(channel, arg1, arg2, arg3, arg4) {
            channels.once(channel + "-loaded", function() {
                var handler = channels.handlers[
                    channel];
                handler.call(null, arg1, arg2, arg3,
                    arg4);
            });
        },
        /*
        Accepts up to four arguments that will be passed to
        channel owner
        For filebrowsers,these are
        @param types - [create,file,folder,project]
        @param id - the id of the option
        @param data {(string | {
          extension?:string,
          filename?:string,
          onclick?:function
        })}
        @param func?: callback to be called when clicked
        */
        registerOption: function(channel, types, id, data, func) {
            FileUtils.postChannel(channel, types, id, data,
                func);
        },
        /**
         * @param intent {{
             name: [string],
             path: string,
             encoding: [string],
             fileserver: [string]
         }}
        **/
        openIntent: function(intent) {
            var servers = [];
            if (intent.fileserver) {
                servers.push(intent.fileserver);
            } else servers = Object.keys(loadedServers).concat([
                undefined
            ]);
            Utils.asyncForEach(servers, function(id, i, next,
                stop) {
                var server = FileUtils.getFileServer(id,
                    true);
                server.readFile(intent.path, intent
                    .encoding || 'utf8',
                    function(e, res) {
                        if (!e) {
                            stop();
                            cyclicRequire(
                                    "../docs/docs")
                                .addDoc(intent.name,
                                    res,
                                    intent
                                    .path, {
                                        data: {
                                            fileServer: id,
                                            encoding: intent
                                                .encoding
                                        }
                                    });
                        } else next();
                    });
            }, function() {
                Notify.error("No such file " + intent
                    .path);
            }, 1, false, true);
        },
        getDoc: function(path, server, callback, justText,
            factory) {
            var Doc = factory || cyclicRequire(
                "../docs/document").Doc;
            server = server || FileUtils.defaultServer;
            if (FileUtils.isBinaryFile(path)) {
                return callback(null, "binary");
            }
            var enc = FileUtils.encodingFor(path, server);
            server.readFile(path, enc, function(err, res) {
                if (err) return callback(null, err);
                if (justText) return callback(res);
                var doc = new Doc(res, path);
                doc.fileServer = server.id;
                doc.encoding = enc;
                callback(doc);
            });
        },
        getDocFromEvent: function(ev, callback, forceNew,
            justText) {
            var Docs = cyclicRequire("../docs/docs").Docs;
            var doc;
            if (!forceNew && (doc = Docs.forPath(ev.filepath, ev
                    .browser.fileServer))) {
                Utils.setImmediate(function() {
                    callback(justText ? doc.getValue() :
                        doc);
                });
            } else {
                FileUtils.getDoc(ev.filepath, ev.browser
                    .fileServer, callback, justText);
            }
        },
        isBuffer: function(buf) {
            return buf && (buf.buffer || buf.constructor.name ==
                "ArrayBuffer");
        },
        fileBookmarks: bookmarks,
        getBookmarks: function() {
            return bookmarks;
        }
    };
    var channels = new EventsEmitter();
    //Don't warn for unknown channels
    channels.frozenEvents = false;
    channels.handlers = {};
    Object.assign(FileUtils, EventsEmitter.prototype);
    exports.FileUtils = FileUtils;
    var encodingNames = (exports.EncodingToNames = {
        utf8: "UTF-8",
    });
}); /*_EndDefine*/