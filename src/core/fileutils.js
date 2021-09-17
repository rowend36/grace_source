_Define(function(global) {
    "use strict";
    var saveMode, saveID;
    var browserModal;
    var appStorage = global.appStorage;
    var getObj = global.getObj;
    var putObj = global.putObj;
    var EventsEmitter = global.EventsEmitter;
    var Utils = global.Utils;
    var Notify = global.Notify;
    var register = global.register;
    var configure = global.configure;
    var configureArr = global.configureArr;
    /*Dynamic dependencies Form,Docs,Doc,docs,FileBrowser*/
    /*This class starts of as a nodejs path module then
    becomes some kind of filebrowser manager then a doc
    save/open utility. Basically file utilities
    Note: One basic assumption is that all paths are android ie linux paths.
    If you supply a \ paths, the results are undefined.
    */
    var NO_PROJECT = "**no-project**";
    var appConfig = global.registerAll({
        projectFileServer: "",
        defaultEncoding: "utf8",
        projectName: NO_PROJECT,
        projectRoot: NO_PROJECT,
        maxRecentFolders: 7,
        recentFolders: [],
        bookmarks: ["/sdcard/", "/data/data/io.tempage.dorynode/"],
        codeFileExts: [".js", ".css", ".html", ".sass", ".less", ".json", ".py", ".ts", ".tsx",
            ".jsx",
        ],
        dotStar: false,
        binaryFileExts: [".zip", ".mp4", ".mp3", ".rar", ".tar.gz", ".tgz", ".iso", ".bz2", ".3gp",
            ".avi", ".mkv", ".exe",
            ".apk", ".tar", ".jar", ".png", ".jpg", ".jpeg", ".ttf", ".otf", ".woff", ".woff2"
        ],
    }, "files");
    global.ConfigEvents.on("files", function(e) {
        switch (e.config) {
            case "projectName":
                project.name = e.newValue;
                FileUtils.trigger("change-project-name");
                break;
            case "projectRoot":
                //do nothing - prevents infinite looping
        }
    });
    global.registerValues({
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
    var viewToServer = getObj("viewToServer");
    var serverCreationParams = getObj("serverCreationParams");
    //requires Docs,docs;
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
            return x == FileUtils.isBinaryFile(b) ? 0 : x ? 1 : -1;
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
    var SideNav;
    var Tabs;
    var _fileBrowsers = {};
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
    var needsRecreate;
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
            return t > -1 ? start + newpath.join(SEP) + end : start;
        },
        //expects normalized path, clears trailing slash for uniformity
        dirname: function(path) {
            if (!path || path == SEP) return null;
            path = FileUtils.removeTrailingSlash(path);
            return path.split(SEP).slice(0, -1).join(SEP) || (path[0] == SEP ? SEP : "");
        },
        join: function(base) {
            var a = 1,
                path;
            while ((path = arguments[a++]) !== undefined) {
                base = (base ? base.replace(/\/+$/, "") + SEP : "") + path.replace(/^\/+/, "");
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
                if (match > 1 && binaryFileExts.indexOf(name.substring(match - 1)) > -1) {
                    return true;
                }
            }
        },
        addToRecents: function(folder) {
            var recentFolders = appConfig.recentFolders;
            var index = recentFolders.indexOf(folder);
            if (index > -1) {
                recentFolders = recentFolders.slice(0, index).concat(recentFolders.slice(index + 1));
            }
            recentFolders.unshift(folder);
            if (recentFolders.length > appConfig.maxRecentFolders) recentFolders.pop();
            configureArr("recentFolders", recentFolders, "files");

        },
        //does nothing to '/'
        removeTrailingSlash: function(e) {
            return e[e.length - 1] == SEP ? e.substring(0, e.length - 1) || SEP : e;
        },
        resolve: function(from, path) {
            if (path[0] == SEP) {
                return FileUtils.normalize(path);
            }
            return FileUtils.normalize(from + SEP + path);
        },
        //expects normalized paths
        relative: function(from, path, forceKeepSlash, noBackTrace) {
            //absolute to relative
            if (from[0] != SEP && path[0] == SEP) return null;
            //relative to absolute
            if (from[0] == SEP && path[0] != SEP) return null;
            if (from === "") return path;
            from = from == SEP ? "" : FileUtils.removeTrailingSlash(from);
            if (path === from) return "";
            if (path.startsWith(from + SEP)) {
                return (path.substring(from.length + 1) || (forceKeepSlash ? "./" : ""));
            }
            if (noBackTrace) return null;
            var child = path.split(SEP);
            var parent = from.split(SEP);
            var i = 0;
            for (; i < child.length && i < parent.length && parent[i] == child[i]; i++) {}
            var relative = "";
            for (var j = i; j < parent.length; j++) {
                relative += forceKeepSlash || j < parent.length - 1 ? "../" : "..";
            }
            for (j = i; j < child.length; j++) {
                relative += (forceKeepSlash && j == i ? "" : SEP) + child[j];
            }
            return relative;
        },
        //expects normalized path
        filename: function(e) {
            var isFolder = false;
            if (e.endsWith(SEP)) isFolder = true;
            while (e.endsWith(SEP)) e = e.slice(0, e.length - 1);
            return (e.substring(e.lastIndexOf(SEP) + 1, e.length) + (isFolder ? SEP : ""));
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
                mode: stat.mode || parseInt(bits[stat.type] + 644, 8),
                atimeMs: stat.atimeMs || stat.mtimeMs,
                ctimeMs: stat.ctimeMs || stat.mtimeMs,
                mtime: new Date(stat.mtimeMs),
                ctime: new Date(stat.ctimeMs),
                atime: new Date(stat.atimeMs),
            });
        },
        sort: sort,
        initialize: function(container, tabs) {
            Tabs = tabs;
            SideNav = container;
            browserModal = $(Notify.modal({
                header: "Pick Storage Type",
                body: "<select id='browserType'></select>",
                footers: ["Cancel", "Create"],
                autoOpen: false,
                keepOnClose: true,
                ondismiss: function() {
                    browserModal.detach();
                },
                dismissible: false,
            }));
            browserModal.detach();
            browserModal.find("select").on("change", function() {
                browserModal.find(".config").hide();
                browserModal.find(".config-" + browserModal.find("select").val()).show();
            });
            browserModal.find(".modal-create").click(function() {
                browserModal.modal('close');
                var params = {};
                params.type = browserModal.find("select").val();
                var e = browserModal.find(".config-" + params.type)[0];
                if (e) {
                    Object.assign(params, global.Form.parse(e));
                }
                var browser = FileUtils.initBrowser(params);
                if (!browser) {
                    Notify.error("Error Creating Storage");
                } else Tabs.select(browser.id);
            });
            FileUtils.loadBrowsers();
        },
        registerFileServer: function(type, caption, factory, config, isDefault) {
            serverFactories[type] = {
                create: factory,
                caption: caption,
                config: config,
            };
            needsRecreate = true;
            if (isDefault && !FileUtils.defaultServer) {
                FileUtils.defaultServer = factory();
            }
        },
        newBrowser: function() {
            if (needsRecreate) {
                var e = browserModal.find(".modal-content")[0];
                browserModal.find(".config").detach();
                var select = browserModal.find("select")[0];
                select.innerHTML = "";
                for (var id in serverFactories) {
                    if (id[0] == "!") continue;
                    var factory = serverFactories[id];
                    var option = document.createElement("option");
                    option.setAttribute("name", id);
                    option.setAttribute("value", id);
                    option.innerText = factory.caption || id.toUpperCase();
                    select.appendChild(option);
                    if (factory.config) {
                        var form = global.Form.create(factory.config);
                        form.className = "config config-" + id;
                        e.appendChild(form);
                        $(form).submit(false);
                    }
                }
                needsRecreate = false;
            }
            document.body.appendChild(browserModal[0]);
            browserModal.modal("open");
            browserModal.find(".config").hide();
            browserModal.find(".config-" + browserModal.find("select").val()).show();
        },
        addBrowser: function(filebrowser) {
            if (_fileBrowsers[filebrowser.id]) {
                console.warn("Id already taken");
                _fileBrowsers[Utils.genID(filebrowser.id)] = filebrowser;
            }
            _fileBrowsers[filebrowser.id] = filebrowser;
        },
        createBrowser: function(id, fileServer, rootDir, icon) {
            var container = Tabs.add(id, icon || ((fileServer || FileUtils.defaultServer).icon) ||
                "sd_storage", true);
            container.className = "fileview-container";
            return new global.FileBrowser(id, rootDir, fileServer);
        },
        initBrowser: function(params) {
            var server, serverID;
            if (params.server) {
                server = params.server;
                serverID = server.id || undefined;
            } else {
                try {
                    serverID = Utils.genID("s");
                    server = FileUtils.createServer(params.type, params, serverID);
                    if (server.id) {
                        serverID = server.id;
                        serverCreationParams[serverID] = params;
                        loadedServers[serverID] = server;
                        putObj("serverCreationParams", serverCreationParams);
                    } else serverID = undefined;
                } catch (e) {
                    console.error(e);
                    return;
                }
            }
            var browser = FileUtils.createBrowser(Utils.genID("f"), server, params.rootDir, server
                .getIcon &&
                server.getIcon());
            viewToServer[browser.id] = serverID || null;
            FileUtils.addBrowser(browser);
            putObj("viewToServer", viewToServer);
            return browser;
        },
        createServer: function(type, params, id) {
            var server = null;
            var factory = serverFactories[type];
            if (factory) {
                //The factory can modify the type
                server = factory.create(params, id);
            } else {
                throw new Error("Unknown server type " + type);
            }
            if (!server.id) server.id = id;
            return server;
        },
        replaceServer: function(stub, server) {
            if (stub.$isStub) {
                loadedServers[stub.id] = server;
                if (stub == FileUtils.defaultServer) {
                    FileUtils.defaultServer = server;
                }
                for (var i in _fileBrowsers) {
                    if (_fileBrowsers[i].fileServer == stub) {
                        _fileBrowsers[i].fileServer = server;
                        if (_fileBrowsers[i].tree) {
                            _fileBrowsers[i].tree.fileServer = server;
                            for (var c in _fileBrowsers[i].tree.childStubs) {
                                _fileBrowsers[i].tree.childStubs[c].fileServer = server;
                            }
                        }
                    }
                }
                if (project.fileServer == stub) {
                    FileUtils.openProject(project.rootDir, server, project.name);
                }
            } else throw "Error: only stub servers can be replaced";
        },
        loadServers: function() {
            loadedServers = {};
            for (var i in serverCreationParams) {
                var params = serverCreationParams[i];
                try {
                    loadedServers[i] = FileUtils.createServer(params.type, params, i);
                } catch (e) {
                    console.error(e);
                }
            }
            project.fileServer = loadedServers[appConfig.projectFileServer] || FileUtils.defaultServer;
            project.rootDir = appConfig.projectRoot;
            FileUtils.trigger("change-project", {
                project: project
            }, true);
        },
        loadBrowsers: function() {
            if (!loadedServers) FileUtils.loadServers();
            for (var i in viewToServer) {
                register("root:" + i, "files");
                register("tree:" + i, "files");
                register("info:" + i, "files");
                // register("hidden:" + i, "files");
                var servrId = viewToServer[i];
                if (servrId === "undefined") viewToServer[i] = undefined;
                var server = servrId ? loadedServers[servrId] : FileUtils.defaultServer;
                var browser = FileUtils.createBrowser(i, server);
                FileUtils.addBrowser(browser);
            }
            if (Object.keys(_fileBrowsers).length < 1) {
                var defaultBrowser = FileUtils.createBrowser("file-browser", FileUtils.defaultServer);
                viewToServer["file-browser"] = null;
                FileUtils.addBrowser(defaultBrowser);
                putObj("viewToServer", viewToServer);
            }
            Tabs.select("hierarchy_tab");
            FileUtils.trigger('filebrowsers-loaded');
        },
        getOpenDocs: function(id) {
            var openDocs = [];
            var docs = global.docs;
            for (var i in docs) {
                if (docs[i].fileServer == id) {
                    openDocs.push(i);
                }
            }
            return openDocs;
        },
        //TODO no undefined ids
        deleteBrowser: function(browserID) {
            if (!viewToServer.hasOwnProperty(browserID)) throw new Error("deleting unexisting tab");
            var id;
            var docs = global.docs;
            var serverID = viewToServer[browserID];
            var closeBrowser = function() {
                delete viewToServer[browserID];
                _fileBrowsers[browserID].destroy();
                delete _fileBrowsers[browserID];
                appStorage.removeItem("files.root:" + browserID);
                appStorage.removeItem("files.tree:" + browserID);
                appStorage.removeItem("files.info:" + browserID);

                appConfig["root:" + browserID] = undefined;
                appConfig["tree:" + browserID] = undefined;
                appConfig["info:" + browserID] = undefined;
                putObj("viewToServer", viewToServer);
                putObj("serverCreationParams", serverCreationParams);
                Tabs.goleft();
                Tabs.delete(browserID);
                //if no other browser, create one
                for (var i in _fileBrowsers) {
                    if (!_fileBrowsers[i].isHierarchy) {
                        return;
                    }
                }
                var defaultBrowser = FileUtils.createBrowser("file-browser");
                viewToServer["file-browser"] = null;
                FileUtils.addBrowser(defaultBrowser);
                putObj("viewToServer", viewToServer);
            };
            if (!serverID) return closeBrowser();
            var server = loadedServers[serverID];
            if (!server) {
                console.error("No server with id " + typeof id + ":" + id);
                return closeBrowser();
            }
            var hasAlternate = false,
                hasAlternateDisk = null;
            for (var i in _fileBrowsers) {
                if (i == browserID) continue;
                if (_fileBrowsers[i].isHierarchy) continue;
                if (_fileBrowsers[i].fileServer.id === serverID) {
                    hasAlternate = true;
                    break;
                } else if (_fileBrowsers[i].fileServer.getDisk() == server.getDisk()) {
                    hasAlternateDisk = _fileBrowsers[i].fileServer;
                }
            }
            if (hasAlternate) return closeBrowser();
            var openDocs = FileUtils.getOpenDocs(serverID);
            var clear = function() {
                if (server == project.fileServer) {
                    FileUtils.openProject(NO_PROJECT, FileUtils.defaultServer);
                }
                if (server.destroy) server.destroy();
                delete loadedServers[serverID];
                delete serverCreationParams[serverID];
                closeBrowser();
                for (var i in openDocs) {
                    delete docs[openDocs[i]].fileServer;
                    docs[openDocs[i]].setPath(null);
                }
            };

            function closeAndSetTemp() {
                Notify.ask("The following files are still open from this drive:\n" + refs.join("\n") +
                    "\nContinue? (The documents will be marked as unsaved)", clear);
            }
            if (openDocs.length > 0) {
                var refs = openDocs.map(function(i) {
                    return docs[i].getSavePath();
                });
                if (hasAlternateDisk) {
                    Notify.ask(
                        "Reconfigure files that are still open from this drive to use available filesystem: " +
                        hasAlternateDisk.constructor.name + "?",
                        function() {
                            for (var i in openDocs) {
                                docs[openDocs[i]].fileServer = hasAlternateDisk.id;
                            }
                            openDocs = [];
                            clear();
                        }, closeAndSetTemp);
                } else closeAndSetTemp();
            } else clear();
        },
        getFileServer: function(id, fallback) {
            if (!id) return FileUtils.defaultServer;
            return (
                (loadedServers && loadedServers[id]) || (fallback && FileUtils.defaultServer));
        },
        availableEncodings: function(server) {
            if (!server) server = FileUtils.defaultServer;
            //cached result
            if (server.$encodingList) return server.$encodingList;
            var encodingList = [];
            var supportedList = server.getEncodings ? server.getEncodings().sort() : [];
            if (supportedList.indexOf("utf8") < 0) supportedList.unshift("utf8");
            for (var i in supportedList) {
                var encoding = supportedList[i];
                encodingList.push({
                    caption: encodingNames[encoding] || encoding.replace(/\-/g, " "),
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
            configure("projectFileServer", fileServer.id, "files");
            configure("projectRoot", path, "files");
            configure("projectName", name || path, "files");
            project.fileServer = fileServer;
            project.rootDir = path;
            project.name = name || (path.length > 50 ? "..." + path.substring(-45) : path);
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
                if (!fs) throw new Error('Missing parameter: fileServer');
                rootDir = project.rootDir;
            } else if (name[0] == FileUtils.sep) {
                fs = FileUtils.defaultServer;
            } else {
                fs = FileUtils.getProject().fileServer;
                rootDir = FileUtils.getProject().rootDir;
            }
            if (!fs) {
                //app not yet loaded
                return FileUtils.once('change-project', function() {
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
            project.fileServer.writeFile(FileUtils.resolve(project.rootDir, name), content, "utf8", cb);
        },
        ownChannel: function(channel, owner) {
            if (channels.handlers[channel]) {
                throw "Error: Channel already has owner";
            }
            channels.handlers[channel] = owner;
            channels.triggerForever(channel + "-loaded");
        },
        channelHasPending: function(id) {
            return channels._eventRegistry[id + "-loaded"] && channels._eventRegistry[id +
                "-loaded"] !== true;
        },
        postChannel: function(channel, arg1, arg2, arg3, arg4) {
            channels.once(channel + "-loaded", function() {
                var handler = channels.handlers[channel];
                handler.call(null, arg1, arg2, arg3, arg4);
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
            FileUtils.postChannel(channel, types, id, data, func);
        },
        freezeEvent: function(event) {
            var stub = event.browser;
            while (stub.parentStub) {
                stub = stub.parentStub;
            }
            return {
                browser: stub.id,
                filename: event.filename,
                filepath: event.filepath,
                rootDir: event.rootDir,
                id: event.id,
            };
        },
        unfreezeEvent: function(event) {
            var browser = _fileBrowsers[event.browser] || _fileBrowsers.projectView;
            event.browser = browser;
            return event;
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
            } else servers = Object.keys(loadedServers).concat([undefined]);
            Utils.asyncForEach(servers, function(id, i, next, stop) {
                var server = FileUtils.getFileServer(id, true);
                server.readFile(intent.path, intent.encoding || 'utf8', function(e, res) {
                    if (!e) {
                        stop();
                        global.addDoc(intent.name, res, intent.path, {
                            data: {
                                fileServer: id,
                                encoding: intent.encoding
                            }
                        });
                    } else next();
                });
            }, function() {
                Notify.error("No such file " + intent.path);
            }, 1, false, true);
        },
        getDoc: function(path, server, callback, justText, factory) {
            var Doc = factory || global.Doc;
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
        getDocFromEvent: function(ev, callback, forceNew, justText) {
            var Docs = global.Docs;
            var doc;
            if (!forceNew && (doc = Docs.forPath(ev.filepath, ev.browser.fileServer))) {
                Utils.setImmediate(function() {
                    callback(justText ? doc.getValue() : doc);
                });
            } else {
                FileUtils.getDoc(ev.filepath, ev.browser.fileServer, callback, justText);
            }
        },
        /*Depend on walk*/
        copyFile: function(path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.copyFile) {
                server.copyFile(path, newpath, function(err) {
                    cb && cb(err);
                });
                return;
            }
            server.readFile(path, function(err, res) {
                if (err) return cb && cb(err);
                newserver.writeFile(newpath, res, function(err) {
                    return cb && cb(err);
                });
            });
        },
        moveFile: function(path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.moveFile) {
                server.moveFile(path, newpath, function(err) {
                    cb && cb(err);
                });
                return;
                //rename could work but ignore that
            }
            FileUtils.copyFile(path, newpath, server, newserver, function(err) {
                if (!err) server.delete(path, cb);
                else cb && cb(err);
            });
        },
        copyFolder: function(path, newpath, server, newServer, cb, onConflict, onEach) {
            FileUtils.moveFolder(path, newpath, server, newServer, cb, onConflict, onEach, true);
        },
        moveFolder: function(path, newpath, server, newServer, cb, onConflict, onEach, isCopy) {
            newServer = newServer || server;
            path = FileUtils.normalize(path + SEP);
            newpath = FileUtils.normalize(newpath + SEP);
            if (newpath == path || newpath.startsWith(path)) {
                return cb(global.createError({
                    code: "EUNSUPPORTED",
                }));
            }
            var moveFile = isCopy ? FileUtils.copyFile : FileUtils.moveFile;

            function copyMove(path, dest, done) {
                newServer.mkdir(dest, function(e) {
                    if (e) {
                        if (onConflict && e.code == "EEXIST") {
                            if (onConflict === true) done();
                            else onConflict(path, newpath, server, newServer, done, true);
                        } else if (done == start) {
                            cb(e);
                        } else {
                            stopped = true;
                            done(e, false);
                        }
                    } else done();
                });
            }
            var tries = 3;
            var tryMove = isCopy || server != newServer ? copyMove : function(path, dest, done) {
                if (tries > 0) {
                    newServer.rename(path, dest, function(e) {
                        if (e) {
                            tries--;
                            console.error(e);
                        } else done(null, true);
                    });
                } else {
                    tryMove = copyMove;
                    copyMove(path, dest, done);
                }
            };
            var stopped = false;
            var start = function() {
                FileUtils.walk({
                    trees: [server, newServer],
                    dirs: [path, newpath],
                    map: function(file, src, dest, err1, err2, n, c, isDir) {
                        if (!src || stopped) return false;
                        else if (dest) {
                            if (!onConflict) {
                                stopped = true;
                                cb(global.createError({
                                    code: "EEXIST",
                                    path: newpath + file,
                                }));
                                c();
                            } else if (onConflict !== true) {
                                return onConflict(path + file, newpath + file, server,
                                    newServer,
                                    n, isDir);
                            }
                        } else if (isDir) {
                            tryMove(path + file, newpath + file, function(e, moved) {
                                onEach && onEach(newpath + file, e);
                                if (e) {
                                    console.error(e);
                                } else n(null, moved || !!e);
                            });
                            return;
                        }
                        moveFile(path + file, newpath + file, server, newServer,
                            function(e) {
                                onEach && onEach(newpath + file, e);
                                n(e);
                            });
                    },
                    reduce: function(file, errs, data, finish) {
                        var errors = errs.filter(Boolean);
                        if (errors.length > 0) {
                            return errors;
                        } else if (!isCopy) {
                            var todelete = path + file;
                            server.readdir(todelete, function(err, res) {
                                if (res && res.length < 1) {
                                    server.rmdir(todelete, finish);
                                } else finish(err);
                            });
                            return;
                        }
                        return null;
                    },
                    finish: function() {
                        cb();
                    },
                });
            };
            tryMove(path, newpath, start);
            return function() {
                stopped = true;
            };
        },
        isBuffer: function(buf) {
            return buf && (buf.buffer || buf.constructor.name == "ArrayBuffer");
        },
        fileBookmarks: bookmarks,
        getBookmarks: function() {
            return bookmarks;
        },
        beforeClose: function(event, func) {
            var newfunc = FileUtils.once(event, func);
            FileUtils.once("clear-temp", function() {
                FileUtils.off(event, newfunc);
            });
        },
        pickFile: function(info, end, allowNew) {
            if (!SideNav) return;
            if (!SideNav.isOpen) {
                FileUtils.once("sidenav-open", function() {
                    FileUtils.pickFile(info, end, allowNew);
                });
                return SideNav.open();
            }
            var grp = new Utils.eventGroup(this);
            grp.on('clear-temp', grp.off);
            var dismiss = info ? Notify.direct(info) : Utils.noop;
            grp.on('open-file', dismiss);
            grp.once('open-file', end);
            var tab = Tabs.getActiveTab().attr("href").substring(1);
            var browser = _fileBrowsers[tab];
            if (!browser) {
                Tabs.select("hierarchy_tab");
                browser = _fileBrowsers.projectView;
            }
            if (browser.isClosed) {
                var all = Object.keys(_fileBrowsers);
                var next = all.indexOf(tab);
                next = next > 0 ? next - 1 : next + 1;
                browser = _fileBrowsers[all[next]];
                Tabs.select(browser.id);
            }
            if (allowNew) {
                grp.on('new-file', dismiss);
                grp.once('new-file', end);
                browser.newFile(saveMode && global.Docs.getName(saveID));
            }
        },
        saveAs: function(doc) {
            saveMode = true;
            saveID = doc;
            var onSave = function(event) {
                var Docs = global.Docs;
                var save = function() {
                    Docs.saveAs(saveID, event.filepath, event.browser.fileServer);
                    FileUtils.exitSaveMode();
                };
                if (event.id == "new-file") save();
                else Notify.ask("Overwrite " + event.filename + "?", save);
                event.preventDefault();
            };
            FileUtils.pickFile("Select a file to overwrite or create a new file", onSave, true);
        },
        inSaveMode: function() {
            return saveMode;
        },
        exitSaveMode: function() {
            if (saveMode) {
                saveMode = false;
                FileUtils.trigger("clear-temp");
            }
            //$("#save-text").css("display", "none");
        }
    };
    var channels = new EventsEmitter();
    //Don't warn for unknown channels
    channels.frozenEvents = false;
    channels.handlers = {};
    Object.assign(FileUtils, EventsEmitter.prototype);
    global.FileUtils = FileUtils;
    var encodingNames = (global.EncodingToNames = {
        utf8: "UTF-8",
    });
}); /*_EndDefine*/