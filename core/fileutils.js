(function(global) {
    "use strict";
    var saveMode, saveID;
    var browserModal;
    var appStorage = global.appStorage;
    var getObj = global.getObj;
    var putObj = global.putObj;
    var EventsEmitter = global.EventsEmitter;
    var Utils = global.Utils;
    var State = global.manageState(window);
    var AutoCloseable = global.AutoCloseable;
    var register = global.register;
    var configure = global.configure;
    var appConfig = global.registerAll({
        "projectFileServer": "",
        "defaultEncoding": "utf8",
        "projectName": "",
        "projectRoot": "",
        'bookmarks': "/sdcard/, /data/data/io.tempage.dorynode/",
        '_server': "http://localhost:3000",
        'code_files': [".js", ".css", ".html", ".sass", ".less", ".json", ".py"].join(", "),
        'binaryFiles': [
            "zip", "mp4", "mp3", "rar",
            "tar.gz", "tgz", "iso", "bz2",
            "3gp", "avi", "mkv", "exe", 'apk'
        ].join(" ,")
    }, "files");
    global.registerValues({
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
            var x = a.endsWith("/");
            return x == b.endsWith("/") ? 0 : x ? -1 : 1;
        },
        notfolder: function(a, b) {
            var x = a.endsWith("/");
            return x == b.endsWith("/") ? 0 : x ? 1 : -1;
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
    var serverFactories = [];
    var needsRecreate;
    var FileUtils = {
        _eventRegistry: {
            'close': null,
            'create-file': null,
            'open-file': null,
            'open-project': null,
            'delete-file': null,
            'found-file': null,
            'change-project': null
        },
        normalize: function(path) {
            if (!path) return "";
            var newpath;
            do {
                newpath = path;
                path = path.replace('\/\/', '/').replace('\/.\/', '/').replace(/\/\.\/?$/, '/').replace(/\/(\w+)\/\.\./, '/');
            } while (newpath != path);
            return path;
        },
        join: function(base, path) {
            return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
        },
        createStats: function(stat) {
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
                mode: 33188,
                uid: 0,
                gid: 0,
                rdev: 0,
                blksize: 4096,
                birthtime: new Date(0)
            };
            return Object.assign(Object.create(StatProps), stat, {
                atimeMs: stat.atimeMs || stat.mtimeMs,
                ctimeMs: stat.ctimeMs || stat.mtimeMs,
                mtime: new Date(stat.mtimeMs),
                ctime: new Date(stat.ctimeMs),
                atime: new Date(stat.atimeMs),
            });
        },
        isDirectory: function(name) {
            return name.endsWith("/");
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
                    for (var i = 0; i < e.children.length; i++) {
                        var conf = e.children[i];
                        if (conf.tagName == "INPUT") {
                            params[conf.name] = conf.value;
                        }
                    }
                }
                var browser = FileUtils.initBrowser(params);
                if (!browser) {
                    global.Notify.error('Error Creating Storage');
                }
                else Tabs.select(browser.id);
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
                        var el = document.createElement('form');
                        el.className = "config config-" + id;
                        for (var i in factory.config) {
                            var t = factory.config[i];
                            var caption = document.createElement('label');
                            caption.innerText = t.caption;
                            var input = document.createElement('input');
                            input.setAttribute("type", t.type);
                            input.setAttribute("name", t.name);
                            input.setAttribute("value", t.value || "");
                            el.appendChild(caption);
                            el.appendChild(input);
                        }
                        e.appendChild(el);
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
        ignoreFolder: function(name) {
            return name == ".git/";
        },
        initBrowser: function(params) {
            var server, serverID;
            if (params.server) {
                server = params.server;
                serverID = server.id || undefined;
            }
            else {
                try {
                    serverID = Utils.genID("s");
                    server = FileUtils.createServer(params.type, params, serverID);
                    if (server.id) {
                        serverID = server.id;
                        serverCreationParams[serverID] = params;
                        loadedServers[serverID] = server;
                        putObj("serverCreationParams", serverCreationParams);
                    }
                    else serverID = undefined;
                }
                catch (e) {
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
            }
            else {
                return unimplemented();
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
            }
            else throw 'Error: only stub servers can be replaced';
        },
        loadServers: function() {
            loadedServers = {};
            for (var i in serverCreationParams) {
                var params = serverCreationParams[i];
                loadedServers[i] = FileUtils.createServer(params.type, params, i);
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
            if (serverID) {
                var hasAlternate = false;
                for (var i in _fileBrowsers) {
                    if (i == browserID) continue;
                    if (i == "hierarchy") continue;
                    if (_fileBrowsers[i].fileServer.id === serverID) {
                        hasAlternate = true;
                        break;
                    }
                }
                if (!hasAlternate) {
                    var openDocs = FileUtils.getOpenDocs(serverID);
                    var refs;
                    if (openDocs.length > 0) {
                        refs = openDocs.map(function(i) { return docs[i].getSavePath() });
                    }
                    if (!refs || confirm("After this, the following files will not be able to save to this drive:\n" +
                            refs.join("\n") + "\nContinue?")) {
                        loadedServers[serverID].destroy && loadedServers[serverID].destroy();
                        delete loadedServers[serverID];
                        delete serverCreationParams[serverID];
                        for (var i in openDocs) {
                            delete docs[openDocs[i]].fileServer;
                            docs[openDocs[i]].setPath(null);
                        }
                    }
                    else return;
                }
            }
            delete viewToServer[browserID];
            _fileBrowsers[browserID].destroy();
            delete _fileBrowsers[browserID];
            appStorage.removeItem("root:" + browserID);
            putObj("viewToServer", viewToServer);
            putObj("serverCreationParams", serverCreationParams);
            Tabs.goleft();
            Tabs.delete(browserID);
            if (Object.keys(_fileBrowsers).filter(Utils.filter("hierarchy")).length < 1) {
                var defaultBrowser = FileUtils.createBrowser('file-browser');
                viewToServer['file-browser'] = null;
                FileUtils.addBrowser(defaultBrowser);
                putObj("viewToServer", viewToServer);
            }
        },

        getFileServer: function(id, fallback) {
            return (loadedServers && loadedServers[id]) || (fallback && FileUtils.defaultServer);
        },
        availableEncodings: function(server) {
            if (!server) server = FileUtils.defaultServer;
            //cached result
            if (server.$encodingList) return server.$encodingList;
            var encodingList;
            if (server.getEncodings) {
                encodingList = [];
                var supportedList = server.getEncodings().sort();
                for (var i in supportedList) {
                    var encoding = supportedList[i];
                    encodingList.push({
                        caption: encodingNames[encoding] || encoding.replace(/\-/g, " "),
                        value: encoding
                    });
                }
            }
            else {
                encodingList = [
                    { caption: "UTF-8", value: "utf8" }
                ];
            }
            server.$encodingList = encodingList;
            return encodingList;
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
            this.trigger('change-project', {
                project: project
            }, true);
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
            }
            else if (parent) {
                channel.setParentEmitter(FileUtils.getChannel(parent));
            }
            owner.menuClickHandler = channel;
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
            }
            else {
                prop = channel_or_owner;
                emitter = prop.menuClickHandler;
                if (!emitter)
                    throw 'Error: channel owners must have menuClickHandler property';
            }
            if (prop) {
                for (var i in types) {
                    var menuId = prop[types[i] + "Dropdown"];
                    prop.menuItems[menuId][id] = caption;
                    //var overflow = prop.overflows[menuId];
                    //if (overflow) overflow.setHierarchy(prop.menuItems[menuId]);
                    for (var j in prop.overflows) {
                        prop.overflows[j].setHierarchy();
                    }
                }
                func = caption.onclick || func;
                emitter.on(id, func);
            }
            else {
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
            if (FileUtils.isBinaryFile(path)) {
                console.error('binary file opened');
                return callback(null, "binary");
            }
            var enc = FileUtils.encodingFor(path, server);
            server.readFile(path, enc, function(err, res) {
                if (err) callback(null);
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
                setTimeout(function() {
                    callback(justText ? doc.getValue() : doc);
                }, 0);
            }
            else {
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
        moveFolder: function(path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.moveFolder) {
                server.moveFolder(path, newpath, function(err) {
                    cb && cb(err);
                });
                return;
                //rename could work but ignore that
            }
        },
        isBuffer: function(buf) {
            return buf && (buf.buffer || buf.constructor.name == 'ArrayBuffer');
        },
        fileBookmarks: bookmarks,
        extname: function(name) {
            var ext = /.*\.(.*)/.exec(name);
            return ext ? ext[0] : "";
        },
        extnames: function(name) {
            var exts = [];
            var match=0;
            while ((match = name.indexOf(".",match))>-1) {
                exts.push(name.substring(match+1));
            }
            return exts;
        },
        isBinaryFile: function(name) {
            //return new RegExp("\\\.(" + (binaryFiles.join("|")) + ")$").test(name);
            var match=0;
            while ((match = name.indexOf(".",match))>-1) {
                if(binaryFiles.indexOf((name=name.substring(match+1)))>-1){
                    return true;
                }
            }
        },
        cleanFileList: function(e) {
            return e[e.length - 1] == "/" ? e.substring(0, e.length - 1) : e;
        },
        relative: function(root, path) {
            if (!root) return path;
            if (path.startsWith(root)) {
                return path.substring(FileUtils.cleanFileList(root).length + 1);
            }
        },
        filename: function(e) {
            var isFolder = false;
            if (e.endsWith("/"))
                isFolder = true;
            while (e.endsWith("/"))
                e = e.slice(0, e.length - 1);
            return e.substring(e.lastIndexOf("/") + 1, e.length) + (isFolder ? "/" : "");
        },
        getBookmarks: function() {
            return bookmarks;
        },

        onSave: function(event) {
            var Doc = global.Doc;
            if (event.id == "new-file" || confirm("Overwrite " + event.filename + "?")) {
                Doc.saveAs(saveID, event.filepath, event.browser.fileServer);
                FileUtils.exitSaveMode();
            }
            event.preventDefault();
        },
        beforeClose: function(event, func) {
            var newfunc = FileUtils.once(event, func);
            FileUtils.once('clear-temp', function() {
                FileUtils.off(event, newfunc);
            });
        },
        saveAs: function(doc) {
            saveMode = true;
            saveID = doc;
            global.Notify.info("Select a file to overwrite or create a new file");
            $("#save-text").css("display", "inline-block");
            FileUtils.beforeClose('open-file', FileUtils.onSave);
            FileUtils.beforeClose('new-file', FileUtils.onSave);

            SideNav.open();
            var tab = Tabs.getActiveTab().attr('href').substring(1);
            var browser = _fileBrowsers[tab];
            if (!browser) {
                Tabs.select("hierarchy_tab");
                browser = _fileBrowsers.hierarchy;
            }
            browser.newFile(global.Doc.getName(doc));

        },
        exitSaveMode: function() {
            saveMode = false;
            FileUtils.trigger('clear-temp');
            //$("#save-text").css("display", "none");
        }
    };
    var channels = {
        "default": FileUtils,
        "childStubs": null,
        "all": null,
        "project": null
    };
    Object.assign(FileUtils, EventsEmitter.prototype);
    global.FileUtils = FileUtils;
    var encodingNames = global.EncodingToNames = { "utf8": "UTF-8" };
})(Modules);