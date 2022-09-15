define(function (require, exports, module) {
    'use strict';
    var Config = require('./config').Config;
    Config.registerAll({defaultEncoding: 'utf8'}, 'files');
    var appEvents = require('./app_events').AppEvents;
    var Utils = require('./utils').Utils;
    var Notify = require('../ui/notify').Notify;
    var cyclicRequire = require;
    var putObj = Config.putObj;
    var getObj = Config.getObj;
    var debug = console;
    /* 
    FileServer management - needed methods for fileservers
    */
    var serverCreationParams = getObj('serverCreationParams');
    var setImmediate = Utils.setImmediate;
    var serverFactories = [];
    var loadedServers;
    var defaultServer, defaultFactory;
    var StatProps = {
        isDirectory: function () {
            return this.type == 'dir';
        },
        isSymbolicLink: function () {
            return this.type == 'symlink';
        },
        isFile: function () {
            return this.type == 'file';
        },
        dev: 2114,
        ino: 0,
        uid: 0,
        gid: 0,
        rdev: 0,
        blksize: 4096,
        birthtime: new Date(0),
    };

    var FileServers = {
        registerFileServer: function (
            type,
            caption,
            factory,
            config,
            isDefault,
        ) {
            serverFactories[type] = {
                create: factory,
                caption: caption,
                config: config,
            };
            if (isDefault && !defaultFactory) {
                defaultFactory = type;
            }
            appEvents.trigger('registerFileServer', type, true);
        },
        $serverFactories: serverFactories,
        $getDefaultServer: function () {
            if (defaultServer) return defaultServer;
            if (!serverFactories[defaultFactory])
                throw new Error('No default FS Factory configured');
            return (defaultServer =
                loadedServers.default ||
                serverFactories[defaultFactory].create(null, 'default'));
        },
        //TODO no undefined ids
        createServer: function (type, params, id) {
            var server = null;
            var factory = serverFactories[type];
            if (!id) id = Utils.genID('s');
            if (factory) {
                //The factory can modify the type
                server = factory.create(params, id);
            } else {
                throw new Error('Unknown server type ' + type);
            }
            if (!server.id) server.id = id;

            serverCreationParams[server.id] = params;
            loadedServers[server.id] = server;
            putObj('serverCreationParams', serverCreationParams);
            return server;
        },
        getFileServer: function (id, fallback) {
            if (!loadedServers) this.$loadServers();
            if (!id) return FileServers.$getDefaultServer();
            return (
                (loadedServers && loadedServers[id]) ||
                (fallback && FileServers.$getDefaultServer())
            );
        },
        $loadServers: function () {
            if (loadedServers) return;
            loadedServers = {};
            for (var i in serverCreationParams) {
                var params = serverCreationParams[i];
                try {
                    loadedServers[i] = FileServers.createServer(
                        params.type,
                        params,
                        i,
                    );
                } catch (e) {
                    debug.error(e);
                }
            }
            appEvents.triggerForever('fileServersLoaded');
        },
        replaceServer: function (stub, server) {
            if (stub.$isStub) {
                loadedServers[stub.id] = server;
                if (stub == defaultServer) {
                    defaultServer = server;
                }
                appEvents.signal('replaceFileServer', {
                    server: stub,
                    replacement: server,
                });
            } else throw 'Error: only stub servers can be replaced';
        },
        //controlled method, intended to be
        //used by fileviews.
        //Does not check if fs is in use
        //Comsidering using refcounted
        deleteServer: function (id) {
            var server = loadedServers[id];
            appEvents.trigger('deleteFileServer', {server: server}, true);
            if (server === defaultServer) defaultServer = null;
            if (server.destroy) server.destroy();
            delete loadedServers[id];
            delete serverCreationParams[id];
            putObj('serverCreationParams', serverCreationParams);
        },
        /**
         * @param intent {{
             name?: string,
             path: string,
             encoding?: string,
             fileserver?: string
         }}
        **/
        openIntent: function (intent) {
            var servers = [];
            if (intent.fileserver) {
                servers.push(intent.fileserver);
            } else servers = Object.keys(loadedServers).concat([undefined]);
            Utils.asyncForEach(
                servers,
                function (id, i, next, stop) {
                    var server = FileServers.getFileServer(id, true);
                    server.readFile(
                        intent.path,
                        intent.encoding ||
                            FileServers.detectEncoding(intent.path),
                        function (e, res) {
                            if (!e) {
                                stop();
                                cyclicRequire('../docs/docs').openDoc(
                                    intent.name,
                                    res,
                                    intent.path,
                                    {
                                        fileServer: id,
                                        encoding: intent.encoding,
                                    },
                                );
                            } else next();
                        },
                    );
                },
                function () {
                    Notify.error('No such file ' + intent.path);
                },
                1,
                false,
                true,
            );
        },
        availableEncodings: function (server) {
            if (!server) server = FileServers.getFileServer();
            //cached result
            if (server.$encodingList) return server.$encodingList;
            var encodingList = [];
            var supportedList = server.getEncodings
                ? server.getEncodings().sort()
                : [];
            if (supportedList.indexOf('utf8') < 0)
                supportedList.unshift('utf8');
            for (var i in supportedList) {
                var encoding = supportedList[i];
                encodingList.push({
                    caption:
                        encodingNames[encoding] || encoding.replace(/\-/g, ' '),
                    value: encoding,
                });
            }
            server.$encodingList = encodingList;
            return encodingList;
        },
        normalizeEncoding: function (enc) {
            return enc.replace(/\-/g, '').toLowerCase();
        },
        detectEncoding: function (path, server, cb) {
            var encoding = Config.forPath(path, 'files', 'defaultEncoding');
            setImmediate(cb, encoding);
            return encoding;
        },
        createError: function (obj) {
            if (!obj.message || obj.message == obj.code) {
                switch (obj.code) {
                    case 'ENOENT':
                        obj.message = 'File does not exist';
                        break;
                    case 'EACCESS':
                        obj.message = 'Permission denied';
                        break;
                    case 'ETOOLARGE':
                        obj.message = 'File Too Large';
                        break;
                    default:
                        obj.message = 'Encountered error: ' + obj.code;
                }
            }
            var err = new Error(obj.message);
            if (err.stack)
                err.stack = err.stack.split('\n').splice(1).join('\n');
            Object.assign(err, obj);
            return err;
        },
        createStats: function (stat) {
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
        copyFile: function (path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.copyFile) {
                server.copyFile(path, newpath, function (err) {
                    cb && cb(err);
                });
                return;
            }
            server.readFile(path, function (err, res) {
                if (err) return cb && cb(err);
                newserver.writeFile(newpath, res, function (err) {
                    return cb && cb(err);
                });
            });
        },
        moveFile: function (path, newpath, server, newserver, cb) {
            newserver = newserver || server;
            if (newserver == server && server.moveFile) {
                server.moveFile(path, newpath, function (err) {
                    cb && cb(err);
                });
                return;
                //rename could work but ignore that
            }
            FileServers.copyFile(
                path,
                newpath,
                server,
                newserver,
                function (err) {
                    if (!err) server.delete(path, cb);
                    else cb && cb(err);
                },
            );
        },
    };

    var encodingNames = (exports.EncodingToNames = {
        utf8: 'UTF-8',
    });
    exports.FileServers = FileServers;
});