_Define(function(global) {
    "use strict";
    var saveMode, saveID;
    var browserModal;
    var appStorage = global.appStorage;
    var getObj = global.getObj;
    var putObj = global.putObj;
    var EventsEmitter = global.EventsEmitter;
    var Utils = global.Utils;
    var State = global.State;
    var AutoCloseable = global.AutoCloseable;
    var Notify = global.Notify;
    var register = global.register;
    var configure = global.configure;
    var appConfig = global.registerAll({
        "projectFileServer": "",
        "defaultEncoding": "utf8",
        "projectName": "",
        "projectRoot": "",
        'bookmarks': "/sdcard/, /data/data/io.tempage.dorynode/",
        'code_files': [".js", ".css", ".html", ".sass", ".less", ".json", ".py"].join(", "),
        'dotStar': false,
        'binaryFiles': [
            "zip", "mp4", "mp3", "rar",
            "tar.gz", "tgz", "iso", "bz2",
            "3gp", "avi", "mkv", "exe", 'apk'
        ].join(" ,")
    }, "files");
    global.registerValues({
        'dotStar': 'Enable dotStar matching for globs.eg main/* matches main/.tmp',
        'binaryFiles': 'A list of file extensions\n that should never be opened for editing'
    }, "files");
    var code_files = Utils.parseList(appConfig.code_files);
    var bookmarks = Utils.parseList(appConfig.bookmarks);
    var binaryFiles = Utils.parseList(appConfig.binaryFiles);

    var viewToServer = getObj("viewToServer");
    var serverCreationParams = getObj("serverCreationParams");
    //requires Doc,docs;


    function test(a, b, next, i, custom) {
        var testfunc = sort_funcs[next[i]] || custom[next[i]];
        var res = testfunc(a, b);
        if (res) return res;
        if (next[i + 1] === undefined)
            return 0;
        else
            return test(a, b, next, i + 1, custom);
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
        }
    };
    var isCode = function(a) {
        for (var i in code_files) {
            if (a.endsWith(code_files[i]))
                return true;
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
    var _fileBrowsers = {

    };
    var loadedServers;
    var project = {
        name: appConfig.projectName || appConfig.projectRoot,
        rootDir: appConfig.projectRoot,
        fileServer: null
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
        birthtime: new Date(0)
    };


    var serverFactories = [];
    var needsRecreate;
    var SEP = "/";
    var FileUtils = {
        sep: SEP,
        _eventRegistry: {
            'close': null,
            'create-file': null,
            'open-file': null,
            'open-project': null,
            'delete-file': null,
            'found-file': null,
            'change-project': null
        },
        //path manipulation
        normalize: function(path) {
            if (!path) return "";
            var a = 0,
                start, end;
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
                    if (t > -1 && newpath[t] !== '..') {
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
            return path.split(SEP).slice(0, -1).join(SEP) || SEP;
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
                if (match > 1 && binaryFiles.indexOf(name.substring(match)) > -1) {
                    return true;
                }
            }
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
                return path.substring(from.length + 1) || (forceKeepSlash ? "./" : "");
            }
            if (noBackTrace) return null;
            var child = path.split(SEP);
            var parent = from.split(SEP);
            var i = 0;
            for (; i < child.length &&
                i < parent.length &&
                parent[i] == child[i]; i++) {}
            var relative = "";
            for (var j = i; j < parent.length; j++) {
                relative += (forceKeepSlash || j < parent.length - 1 ? "../" : "..");
            }
            for (j = i; j < child.length; j++) {
                relative += (forceKeepSlash && j == i ? "" : SEP) + child[j];
            }
            return relative;
        },
        //expects normalized path
        filename: function(e) {
            var isFolder = false;
            if (e.endsWith(SEP))
                isFolder = true;
            while (e.endsWith(SEP))
                e = e.slice(0, e.length - 1);
            return e.substring(e.lastIndexOf(SEP) + 1, e.length) + (isFolder ? SEP : "");
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
                dir: 40000
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
            browserModal = $("#createBrowserModal");
            browserModal.modal({
                inDuration: 100,
                outDuration: 100,
                onOpenStart: function() {
                    browserModal.find(".config").hide();
                    browserModal.find(".config-" + browserModal.find('select').val()).show();
                },
                onOpenEnd: AutoCloseable.onOpenEnd,
                onCloseEnd: function() {
                    AutoCloseable.onCloseEnd.apply(this);
                    browserModal.detach();
                },
                dismissible: false
            });
            browserModal.detach();
            browserModal.find('select').on('change', function() {
                browserModal.find(".config").hide();
                browserModal.find(".config-" + browserModal.find('select').val()).show();
            });
            browserModal.find('#create').click(function() {
                var params = {};
                params.type = browserModal.find('select').val();
                var e = browserModal.find('.config-' + params.type)[0];
                if (e) {
                    Object.assign(params, global.Form.parse(serverFactories[params.type].config, e));
                }
                var browser = FileUtils.initBrowser(params);
                if (!browser) {
                    Notify.error('Error Creating Storage');
                } else Tabs.select(browser.id);
            });
            FileUtils.loadBrowsers();
        },
        registerFileServer: function(name, caption, factory, config, isDefault) {
            serverFactories[name] = {
                create: factory,
                caption: caption,
                config: config
            };
            needsRecreate = true;
            if (isDefault || !FileUtils.defaultServer) {
                FileUtils.defaultServer = factory();
            }
        },
        newBrowser: function() {
            if (needsRecreate) {
                var e = browserModal.find(".modal-content")[0];
                browserModal.find(".config").detach();
                var select = browserModal.find('select')[0];
                select.innerHTML = "";
                for (var id in serverFactories) {
                    var factory = serverFactories[id];
                    var option = document.createElement('option');
                    option.setAttribute("name", id);
                    option.setAttribute("value", id);
                    option.innerText = factory.caption || id.toUpperCase();
                    select.appendChild(option);
                    if (factory.config) {
                        var form = global.Form.create(factory.config);
                        form.className = "config config-" + id;
                        e.appendChild(form);
                    }
                }
                needsRecreate = false;
            }
            document.body.appendChild(browserModal[0]);
            browserModal.modal("open");
        },

        addBrowser: function(filebrowser) {
            if (_fileBrowsers[filebrowser.id]) {
                console.warn('Id already taken');
                _fileBrowsers[Utils.genID(filebrowser.id)] = filebrowser;
            }
            _fileBrowsers[filebrowser.id] = filebrowser;
        },
        createBrowser: function(id, fileServer, rootDir, icon) {
            var container = Tabs.add(id, icon || "sd_storage", true);
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
            var browser = FileUtils.createBrowser(Utils.genID("f"),
                server, params.rootDir, server.getIcon && server.getIcon());
            viewToServer[browser.id] = serverID || null;
            FileUtils.addBrowser(browser);
            putObj("viewToServer", viewToServer);
            return browser;
        },
        createServer: function(type, params, id) {
            var server = null;
            var factory = serverFactories[type];
            if (factory) {
                server = factory.create(params, id);
            } else {
                throw new Error('Unknown server type ' + type);
            }
            if (!server.id)
                server.id = id;
            return server;
        },
        replaceServer: function(stub, server) {
            if (stub.$isStub) {
                loadedServers[stub.id] = server;
                for (var i in _fileBrowsers) {
                    if (_fileBrowsers[i].fileServer == stub) {
                        _fileBrowsers[i].fileServer = server;
                    }
                }
            } else throw 'Error: only stub servers can be replaced';
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
            FileUtils.trigger('change-project', {
                project: project
            }, true);
        },
        loadBrowsers: function() {
            if (!loadedServers)
                FileUtils.loadServers();
            for (var i in viewToServer) {
                register("root:" + i, "files");
                var servrId = viewToServer[i];
                if (servrId === "undefined") viewToServer[i] = undefined;
                var server = servrId ? loadedServers[servrId] : FileUtils.defaultServer;
                var browser = FileUtils.createBrowser(i,
                    server);
                FileUtils.addBrowser(browser);
            }
            if (Object.keys(_fileBrowsers).length < 1) {
                var defaultBrowser = FileUtils.createBrowser('file-browser',
                    FileUtils.defaultServer);
                viewToServer['file-browser'] = null;
                FileUtils.addBrowser(defaultBrowser);
                putObj("viewToServer", viewToServer);
            }
            Tabs.select("hierarchy_tab");
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
        deleteBrowser: function(browserID) {
            if (!viewToServer.hasOwnProperty(browserID)) throw new Error("deleting unexisting tab");
            var id;
            var docs = global.docs;
            var serverID = viewToServer[browserID];
            var closeBrowser = function() {
                delete viewToServer[browserID];
                _fileBrowsers[browserID].destroy();
                delete _fileBrowsers[browserID];
                appStorage.removeItem("root:" + browserID);
                putObj("viewToServer", viewToServer);
                putObj("serverCreationParams", serverCreationParams);
                Tabs.goleft();
                Tabs.delete(browserID);
                if (Object.keys(_fileBrowsers).filter(Utils.except("hierarchy")).length < 1) {
                    var defaultBrowser = FileUtils.createBrowser('file-browser');
                    viewToServer['file-browser'] = null;
                    FileUtils.addBrowser(defaultBrowser);
                    putObj("viewToServer", viewToServer);
                }
            };
            if (!serverID) return closeBrowser();

            var hasAlternate = false;
            for (var i in _fileBrowsers) {
                if (i == browserID) continue;
                if (i == "hierarchy") continue;
                if (_fileBrowsers[i].fileServer.id === serverID) {
                    hasAlternate = true;
                    break;
                }
            }
            if (hasAlternate) return closeBrowser();

            var openDocs = FileUtils.getOpenDocs(serverID);
            var clear = function() {
                loadedServers[serverID].destroy && loadedServers[serverID].destroy();
                delete loadedServers[serverID];
                delete serverCreationParams[serverID];
                for (var i in openDocs) {
                    delete docs[openDocs[i]].fileServer;
                    docs[openDocs[i]].setPath(null);
                }
                closeBrowser();
            };
            if (openDocs.length > 0) {
                var refs = openDocs.map(function(i) {
                    return docs[i].getSavePath()
                });
                Notify.ask("The following files are still open from this drive:\n" +
                    refs.join("\n") + "\nContinue?", clear);
            } else clear();
        },

        getFileServer: function(id, fallback) {
            if (!id) return FileUtils.defaultServer;
            return (loadedServers && loadedServers[id]) || (fallback && FileUtils.defaultServer);
        },
        availableEncodings: function(server) {
            if (!server) server = FileUtils.defaultServer;
            //cached result
            if (server.$encodingList) return server.$encodingList;
            var encodingList = [];
            var supportedList = server.getEncodings ? server.getEncodings().sort() : [];
            if (supportedList.indexOf("utf8") < 0)
                supportedList.unshift("utf8");
            for (var i in supportedList) {
                var encoding = supportedList[i];
                encodingList.push({
                    caption: encodingNames[encoding] || encoding.replace(/\-/g, " "),
                    value: encoding
                });
            }
            server.$encodingList = encodingList;
            return encodingList;
        },
        normalizeEncoding: function(enc) {
            return enc.replace(/\-/g, "").toLowerCase();
        },
        encodingFor: function(path, server) {
            //todo if server supports detect, detect
            return appConfig.defaultEncoding;
        },

        getProject: function() {
            return project;
        },
        openProject: function(path, fileServer, name) {
            path = FileUtils.normalize(path);
            configure("projectFileServer", fileServer.id);
            configure("projectRoot", path);
            project.fileServer = fileServer;
            project.rootDir = path;
            project.name = name || (path.length > 50 ? "..." + path.substring(-45) : path);
            FileUtils.trigger('change-project', {
                project: project
            }, true);
        },
        getConfig: function(name, cb, project) {
            project = project || FileUtils.getProject();
            project.fileServer.readFile(FileUtils.join(project.rootDir, name), 'utf8', function(e, res) {
                if (e && e.code == 'ENOENT') {
                    cb("");
                } else if (res) cb(res);
                else cb(null, e);
            });
        },
        saveConfig: function(name, content, cb, project) {
            project = project || FileUtils.getProject();
            project.fileServer.writeFile(FileUtils.join(project.rootDir, name), content, 'utf8', cb);
        },
        getChannel: function(channel, parent) {
            if (!channels[channel]) {
                channels[channel] = new EventsEmitter(parent);
            }
            return channels[channel];
        },
        ownChannel: function(channel, owner, parent) {
            if (typeof(channel) == "string") {
                channel = FileUtils.getChannel(channel);
            }
            if (channel._owner) {
                throw 'Error: Channel already has owner';
            } else if (parent) {
                channel.setParentEmitter(FileUtils.getChannel(parent));
            }
            owner.handler = channel;
            channel._owner = owner;
            if (channel.pending) {
                var pending = channel.pending;
                delete channel.pending;
                for (var i in pending) {
                    FileUtils.registerOption.apply(null, pending[i]);
                }
            }
        },
        registerOption: function(channel_or_owner, types /*[create,file,folder]*/ , id, caption, func) {
            if (FileUtils.activeFileBrowser) {
                FileUtils.activeFileBrowser.menu.hide();
            }
            var emitter;
            var prop;
            if (typeof(channel_or_owner) == "string") {
                emitter = FileUtils.getChannel(channel_or_owner);
                prop = emitter._owner;
            } else {
                prop = channel_or_owner;
                emitter = prop.handler;
                if (!emitter)
                    throw 'Error: channel owners must have handler property';
            }
            if (prop) {
                for (var i in types) {
                    var menuId = prop[types[i] + "Dropdown"];
                    if (caption.extension) {
                        var hasExt = menuId + "-" + caption.extension;
                        if (!prop.menuItems[hasExt]) {
                            prop.menuItems[hasExt] = Object.create(prop.menuItems[menuId]);
                            menuId = hasExt;
                        }
                    }
                    if (caption.filename) {
                        var hasName = menuId + "_" + filename.replace(/\./g, "_");
                        if (!prop.menuItems[hasName]) {
                            prop.menuItems[hasName] = Object.create(prop.menuItems[menuId]);
                            menuId = hasName;
                        }
                    }
                    prop.menuItems[menuId][id] = caption;
                    for (var j in prop.overflows) {
                        prop.overflows[j].setHierarchy();
                    }
                }
                func = caption.onclick || func;
                emitter.on(id, func);
            } else {
                if (!channels.hasOwnProperty(channel_or_owner))
                    console.warn('channel ' + channel_or_owner + ' has no owners yet');
                if (!emitter.pending) {
                    emitter.pending = [];
                }
                emitter.pending.push(Array.prototype.slice.apply(arguments, [0]));
            }
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
            var browser = _fileBrowsers[event.browser] || _fileBrowsers.hierarchy;
            event.browser = browser;
            return event;
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
                if (justText)
                    return callback(res);
                var doc = new Doc(res, path);
                doc.fileServer = server.id;
                doc.encoding = enc;
                callback(doc);
            });
        },
        getDocFromEvent: function(ev, callback, forceNew, justText) {
            var Doc = global.Doc;
            var doc;
            if (!forceNew && (doc = Doc.forPath(ev.filepath, ev.browser.fileServer))) {
                Utils.setImmediate(function() {
                    callback(justText ? doc.getValue() : doc);
                });
            } else {
                FileUtils.getDoc(ev.filepath, ev.browser.fileServer, callback, justText);
            }
        },
        copyFile: function(path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.copyFile) {
                server.copyFile(path, newpath, function(err) {
                    cb && cb(err);
                });
                return;
            }
            server.readFile(path, function(err, res) {
                if (err)
                    return cb && cb(err);
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
                if (!err)
                    server.delete(path, cb);
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
                return cb({
                    code: 'EUNSUPPORTED'
                });
            }
            var moveFile = isCopy ? FileUtils.copyFile : FileUtils.moveFile;

            function copyMove(path, dest, done) {
                newServer.mkdir(dest, function(e) {
                    if (e) {
                        if (onConflict && e.code == 'EEXIST') {
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
            var tryMove = (isCopy || server != newServer) ? copyMove : function(path, dest, done) {
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
                                cb({
                                    code: 'EEXIST',
                                    path: newpath + file
                                });
                                c();
                            } else if (onConflict !== true) {
                                return onConflict(path + file, newpath + file, server, newServer, n, isDir);
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
                        moveFile(path + file, newpath + file, server, newServer, function(e) {
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
                    }
                });

            };
            tryMove(path, newpath, start);
            return function() {
                stopped = true;
            };
        },
        isBuffer: function(buf) {
            return buf && (buf.buffer || buf.constructor.name == 'ArrayBuffer');
        },
        fileBookmarks: bookmarks,
        getBookmarks: function() {
            return bookmarks;
        },
        beforeClose: function(event, func) {
            var newfunc = FileUtils.once(event, func);
            FileUtils.once('clear-temp', function() {
                FileUtils.off(event, newfunc);
            });
        },
        pickFile: function(info, end, allowNew) {
            if(!SideNav.isOpen){
                FileUtils.once('sidenav-open',function(){
                    FileUtils.pickFile(info,end,allowNew);
                });
                return SideNav.open();
            }
            Notify.info(info);
            FileUtils.beforeClose('open-file', end);
            var tab = Tabs.getActiveTab().attr('href').substring(1);
            var browser = _fileBrowsers[tab];
            if (!browser) {
                Tabs.select("hierarchy_tab");
                browser = _fileBrowsers.hierarchy;
            }
            if (allowNew) {
                FileUtils.beforeClose('new-file', end);
                browser.newFile(global.Doc.getName(doc));
            }
        },
        saveAs: function(doc) {
            saveMode = true;
            saveID = doc;
            var onSave = function(event) {
                var Doc = global.Doc;
                var save = function() {
                    Doc.saveAs(saveID, event.filepath, event.browser.fileServer);
                    FileUtils.exitSaveMode();
                };
                if (event.id == "new-file") save();
                else Notify.ask("Overwrite " + event.filename + "?", save);
                event.preventDefault();
            };

            FileUtils.pickFile("Select a file to overwrite or create a new file", onSave, true);
        },
        exitSaveMode: function() {
            saveMode = false;
            FileUtils.trigger('clear-temp');
            //$("#save-text").css("display", "none");
        },
        /**
         * @typedef DataObj
               {cancelled:?any,initialValue:?any,errors:(?Error)[],results:[string]}
         * @callback WalkMapCallback
               If {opts.fs} is passed, the {present} and {error} arguments are skipped.
         * @param {string} path - Relative path
         * @param {boolean} ...present - One for each tree in {opts.trees}
         * @param {Error} ...error - The error, if any that caused a file not to be present,
               Repeated for each tree in {opts.trees}
         * @param {function} next - function([result[,dontVisit]]) Used for asynchronous functions,
               Returning a value other than {WalkOpt.stopSignal} calls this automatically
         * @param {function} stop - function([reason]) Stops traversing the current directory
         * @param {boolean} isDirectory
         * @param {string[]} children - list of all the files in current directory for all trees
         * @param {DataObj} data
         * 
         * 
         * @typedef {Object} WalkOpt
         * @property {WalkMapCallback} [map]
         * @property {function} [reduce] - Called at the end of each folder traversal
                function(path,data[],DataObj data,next)
         * @property {function} [finish]
         * @property {function} [onError] - function(path,error,fs,index,startValue) called when any readdir fails,
         * @property {function} [iterate] - function(iterate,path,mergedPaths,{cancelled:?any,initialValue:?any,errors:(?Error)[]} data) called after readir,
         * @property {FileServer} [fs]
         * @property {FileServer[]} [trees]
         * @property {string} [path]
         * @property {string[]} [dirs]
         * @property {boolean} breadthFirst - Can be changed dynamically to have walks that go both depthwise and breadthwise. But keeping track of position might become tricky
         * @property {boolean} initalValue
         * @property {any} [stopSignal=false] - A value that when returned from {opts.map,opts.onError,opts.reduce} stops iteration,
               Note It is ignored when returned from opts.reduce with opts.breadthFirst set, use opts.breakSignal to stop iteration totally
         * @property {any} [waitSignal=undefined] - A value that when returned from {opts.map,opts.reduce},
               waits indefinitely for next to be called, In onError, it allows walk to traverse remaining trees despite error
               Set this to something other than undefined if next/stop callbacks are not used
               Return this without ever calling next/stop also to stop iteration early
               since only references to the walk are the map/reduce callbacks
               but opts.finish will not be called.
         * @property {any} [breakSignal] - Return this {opts.map,opts.onError,opts.reduce} to stop iteration completely,
               all opts.reduce callbacks will be called as well as opts.finish callback
         * 
         * Powerful tree walking function
         * @param {WalkOpt} opts
         * @returns {function} stop
         */
        walk: function(opts) {
            opts = opts || {};
            var multiTree = !!opts.trees;

            var isDir = FileUtils.isDirectory;
            var join = FileUtils.join;
            var merge = Utils.mergeList;
            var forEach = Utils.asyncForEach;


            //Iteration start
            opts.iterate = opts.iterate || function(iterate, path, children, _data, finish) {
                iterate(path, children, _data, finish);
            };

            //Collect data from each file
            opts.map = opts.map || (multiTree ?
                function(path) {
                    //next = path + presents + errors
                    arguments[numTrees * 2 + 1](path);
                } :
                function(path, next) {
                    next(path);
                });

            //Iteration end
            opts.reduce = opts.reduce || function(path, children, data, next) {
                return next(children.filter(Boolean));
            };

            //getFiles failed
            opts.onError = opts.onError || function(folder, error, fs, index) {
                return opts.failOnError ? SYNC_BREAK : SYNC_WAIT;
            };
            //Done done
            opts.finish = opts.finish || Utils.noop;
            var dir = opts.dirs || [opts.dir];
            dir.forEach(function(e, i) {
                if (!isDir(e)) {
                    dir[i] += "/";
                }
            });
            opts.trees = opts.trees || dir.map((e) => opts.fs || FileUtils.defaultServer);
            var SYNC_WAIT = opts.waitSignal;
            var SYNC_STOP = opts.hasOwnProperty("stopSignal") ? opts.stopSignal : false;
            var SYNC_BREAK = opts.hasOwnProperty("breakSignal") ? opts.breakSignal : {};
            if (SYNC_WAIT === SYNC_STOP || SYNC_BREAK === SYNC_WAIT)
                throw 'Wait signal cannot be the same with break/stop signal';
            var path = "";
            var toWalk = opts.trees;
            var numTrees = toWalk.length;
            var stack = [],
                stopped;

            //3 async callbacks,
            //map,reduce and readdir
            //We check <stopped> after 
            //each of them is called
            var parallel = parseInt(opts.parallel) || 1;

            //traverse down a tree - called synchronously
            function step(filter, finish, initial) {
                var folder = filter[0];
                var errors = new Array(numTrees);
                var results = new Array(numTrees);
                //get results for each path
                var failed = false;
                forEach(toWalk, function(fs, i, done) {
                    if (!filter[i + 1]) return done();
                    fs.getFiles(dir[i] + folder, function(e, res) {
                        if (e) {
                            res = opts.onError(folder, e, toWalk[i], i, initial);
                            if (failed);
                            else if (res !== SYNC_WAIT) {
                                return finish(res);
                            } else errors[i] = e;
                        } else results[i] = res;
                        done();
                    });
                }, function() {
                    /*asynchronous but iterate is usually synchronous so don't check stopped*/
                    var merged = [];
                    results.forEach(function(res, i) {
                        if (res)
                            merge(merged, res.sort());
                    });
                    opts.iterate(iterate, folder, merged, {
                        results: results,
                        errors: errors,
                        initialValue: initial,
                        data: new Array(merged.length)
                    }, finish);
                }, numTrees, false, true);
            }

            function iterate(folder, merged, _data, finish) {
                /*asynchronous*/
                if (stopped) return finish(undefined, stopped);
                var returned = _data.data;
                var results = _data.results;
                var errors = _data.errors;
                var running = 0;
                forEach(merged, function(path, k, next, cancel) {
                    parallel--;
                    running++;
                    var args = [join(folder, path)];
                    if (multiTree) {
                        for (var i = 0; i < toWalk.length; i++) {
                            args.push((results[i] && results[i].indexOf(path) > -1) || null);
                        }
                        args.push.apply(args, errors);
                    }
                    var end = function(res, dontVisit) {
                        /*asynchronous*/
                        running--;
                        if (res === SYNC_BREAK) {
                            stop(SYNC_BREAK);
                        }
                        if (stopped) {
                            parallel++;
                            cancel(stopped);
                        } else {
                            if (!dontVisit && isDir(path)) {
                                //folder and present argument serve as filter
                                if (opts.breadthFirst) {
                                    stack.push(multiTree ? args.slice(0, numTrees + 1) : {
                                        0: args[0],
                                        1: true
                                    });
                                } else {
                                    step(args, function(after, stop) {
                                        /*asynchronous*/
                                        parallel++;
                                        if (after === SYNC_BREAK) {
                                            stop(SYNC_BREAK);
                                        } else returned[k] = after;
                                        if (stopped) cancel(stopped);
                                        else if (stop) cancel(stop);
                                        else next();
                                    }, res);
                                    return SYNC_WAIT;
                                }
                            }
                            parallel++;
                            returned[k] = res;
                            next();
                        }
                        return SYNC_WAIT;
                    };
                    args.push(end, cancel, isDir(path), merged, _data);
                    var res = opts.map.apply(null, args);
                    if (res !== SYNC_WAIT) {
                        end(res, res === SYNC_STOP);
                    }

                }, function(cancelled) {
                    /*synchronous*/
                    if (cancelled) {
                        _data.cancelled = cancelled;
                        parallel += running;
                    } else if (running) throw 'Counter errror';
                    var res = opts.reduce(folder, returned, _data, finish);
                    if (res !== SYNC_WAIT) {
                        finish(res, res === SYNC_STOP);
                    }
                }, parallel > 0 ? parallel : 1, false, true);
            }

            function nextStack(res) {
                //asysynchronous
                if (res == SYNC_BREAK) stop(SYNC_BREAK);
                if (stack.length && !stopped) {
                    step(stack.shift(), next, res);
                } else opts.finish(res, stopped);
            }

            function stop(reason) {
                stopped = reason || true;
                return stopped;
            }
            step([""].concat(opts.trees), nextStack, opts.initialValue);
            return stop;
        },
        globToRegex: globToRegex,
        genQuickFilter: genQuickFilter,
        globToWalkParams: function(glob) {
            var a = fastGlob(glob);
            var b = genQuickFilter(glob);
            return {
                root: a.commonRoot,
                dir: b,
                file: a.regex
            };
        }
    };

    var channels = {
        "default": FileUtils,
        "childStubs": null,
        "all": null,
        "project": null
    };
    Object.assign(FileUtils, EventsEmitter.prototype);
    window.braceExpand = window.braceExpand || function() {
        console.warn('regex needs Brace Expand but not found');
        return "/THIS_SHOULD_MATCH_NOTHING_BUT_WHAT_IF_IT_DOES???/";
    };

    //Could return a function object.test that tests each glob
    function commonHead(path1, path2) {
        var head = [];
        for (var i = 0, n = Math.min(path1.length, path2.length); i < n;) {
            if (path1[i] === path2[i]) i++;
            else break;
        }
        return path1.substring(0, i);
    }

    function genQuickFilter(g) {
        if (/\{|\}/.test(g)) {
            g = braceExpand("{" + g + ",}").join(",");
        }
        var globs = g.split(",").filter(isNotSpace);
        var a = [];
        for (var i in globs) {
            var start = "";
            var segments = FileUtils.normalize(globs[i]).split(SEP);
            if (segments[0] == '.')
                segments.shift();
            var base = segments[segments.length - 1];

            //remove file matches
            if (base && !base.endsWith("**")) {
                segments.pop();
            }
            var j;
            //retrieve the part of the regex that is plain
            var first = true;
            for (j = 0; j < segments.length; j++) {
                var stop = segments[j].indexOf("**") + 1;
                if (stop === 1) {
                    if (j) {
                        start += ".*";
                        break;
                    } else return alwaysTrue;
                } else {
                    if (first) {
                        start += "(?:";
                        first = false;
                    } else start += "(?:/";
                    try {
                        start += globToRegex(segments[j], genQuickFilter).source;
                    } catch (e) {
                        //we might be breaking a group
                        start += "[^/]*";
                        first = true;
                        segments[j + 1] = segments[j] + SEP + segments[j + 1];
                    }
                    //since we allowed it @globToRegex, non-standard glob
                    //handle the /path** -> \/path.*
                    if (stop) {
                        start += ".*";
                        j++;
                        break;
                    }
                }
            }
            for (; j-- > 0;) {
                start += "|/?)";
            }
            /*As a bonus, we could match all files in the directory
                start += "(?:\/[^/]*|\/?)$";
            */
            a.push(start);
        }
        return new RegExp("^(?:\\./)?(?:" + a.join("|") + ")\/?$");
    }
    var alwaysTrue = {
        test: function() {
            return true;
        },
        source: ".*"
    };
    var isNotSpace = function(t) {
        return /\S/.test(t);
    };
    var SEGMENT_MODE = /*any unique value could serve*/ genQuickFilter;

    function globToRegex(g, segment) {
        if (/\{|\}/.test(g)) {
            g = braceExpand("{" + g + ",}").join(",");
        }
        var globs = g.split(",").filter(isNotSpace);
        if (!globs.length) return null;
        var regexStr = "";
        var singleLetter = "[^\/]";
        var star = singleLetter + "*";
        var dotstar = appConfig.dotStar ? star : "(?:[^\/\\.][^\/]*)";
        var doublestar = "(?:" + star + "\/)*" + star;
        var DOUBLE_STAR = "627G27HOR39393";
        var DOT_STAR = "39EHD8EN3IDJD3";
        var DEDOUBLE_STAR = new RegExp(DOUBLE_STAR, "g");
        var DEDOT_STAR = new RegExp(DOT_STAR, "g");
        DOUBLE_STAR = DOUBLE_STAR + "$1";
        DOT_STAR = "$1" + DOT_STAR;
        for (var i in globs) {
            globs[i] =
                Utils.regEscape(FileUtils.normalize(globs[i]))
                .replace(/\\\?/g, singleLetter + "?")
                .replace(/\\\[!/g, "[^")
                .replace(/\\\[/g, "[")
                .replace(/\\\]/g, "]")
                //globstar should stay in its own path segment
                //but we allow ma**/*.js as a bug
                .replace(/\\\*\\\*(?:(\/)$|\/|$)/g, DOUBLE_STAR)
                .replace(/(^|\/)\\\*/g, DOT_STAR)
                .replace(/\\\*/g, star)
                .replace(DEDOUBLE_STAR, doublestar)
                .replace(DEDOT_STAR, dotstar);
        }
        if (segment == SEGMENT_MODE) {
            return new RegExp(globs.join("|"));
        } else {
            var curdir = "^(?:\\.\/)?(?:";
            var tail = ")\/?$";
            return new RegExp(curdir + globs.join("|") + tail);
        }

    }


    function noop(e) {
        return {
            source: e
        };
    }

    function fastGlob(g) {
        if (/\{|\}/.test(g)) {
            //Funny after braceExpanding, we do the exact opposite
            g = braceExpand("{" + g + ",}").join(",");
        }
        //characters we cannot optimize out
        var META = /[^\.a-z\/A-Z\_\-\?\*]/;
        var start = Infinity;
        var nextHead = null;

        function shrink(prev, next, i) {
            //find common head
            var head = nextHead === null ? commonHead(prev.substring(0, start), next) : nextHead;
            //Remove any globbed parts
            //as we cannot merge them
            var meta = META.exec(head);
            if (meta) head = head.substring(0, meta.index);
            var newStart = head.length;
            if (newStart < 3) //Not worth it
                newStart = 0;
            //Check if this will spoil next reduction
            else if (newStart > 0 && i != START) {
                nextHead = commonHead(next, globs[i + 1]);
                if (newStart < nextHead.length)
                    newStart = 0;
            } else nextHead = null;
            var regex1;
            //Update regexed part
            if (newStart < start) {
                if (start > prev.length) {
                    //Unconverted, start convert
                    regex1 = func(prev.substring(newStart), SEGMENT_MODE).source;
                } //convert next chunk
                else regex1 = func(prev.substring(newStart, start), SEGMENT_MODE).source + prev.substring(start);
            } else { //newStart = start, no need to update
                regex1 = prev.substring(newStart);
            }
            //Add pieces together
            if (newStart > 0) {
                if (newStart == start) {
                    //Not always detected
                    regex1 = regex1.substring(3, regex1.length - 1); //remove extra (?:)
                }
                commonRoot = head;
                var regex2 = func(next.substring(newStart), SEGMENT_MODE).source;
                start = newStart;
                return head + "(?:" + regex1 + "|" + regex2 + ")";
            } else {
                //Or discard the chunk 
                start = Infinity;
                //Since newStart==0,regex1 is fully converted
                chunks.push(regex1);
                return next;
            }
        }
        var START;
        /*To use reduce instead of reduceRight
            unshift with push
            ,START = chunks.length-1 instead of 0
            nextHead = i+1 instead of i-1
            reduce seems to handle better
        */
        var chunks = g.split(",").map(FileUtils.normalize).sort().filter(isNotSpace).filter(function(e, i, arr) {
            return e !== arr[i - 1];
        });
        var commonRoot = "";
        var globs, func = globToRegex;
        do {
            START = chunks.length - 1;
            globs = chunks;
            globs.push(""); //so final path always gets converted
            chunks = [];
            globs.reduce(shrink);
            func = noop; //don't repeat globToRegex
        }
        while (globs.length > chunks.length + 1);
        //Validate commonRoot
        if (chunks.length > 1) commonRoot = "";
        else commonRoot = commonRoot.substring(0, commonRoot.lastIndexOf(SEP) + 1);

        //todo remove commonRoot from regex
        return {
            commonRoot: commonRoot,
            regex: new RegExp("^(?:\\./)?(?:" + chunks.join("|") + ")\/?$")
        };
    }
    global.FileUtils = FileUtils;
    var encodingNames = global.EncodingToNames = {
        "utf8": "UTF-8"
    };
}); /*_EndDefine*/