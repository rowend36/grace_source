//basefs
_Define(function(global) {
    var setImmediate = global.Utils.setImmediate;
    var createCounter = global.Utils.createCounter;
    var FileUtils = global.FileUtils;
    var normalizeEncoding = FileUtils.normalizeEncoding;

    function DummyReadStream(fs, path) {
        var read = false;
        this.close = function() {};
        this.read = function(cb) {
            if (!read) fs.readFile(path, cb);
            else setImmediate(cb.bind(null, undefined, null));
            read = true;
        };
    }

    function concat(arrays) {
        // sum of individual array lengths
        var totalLength = arrays.reduce(function(acc, value) {
            return acc + value.length;
        }, 0);
        if (!arrays.length) return null;
        var result = new Uint8Array(totalLength);
        // for each array - copy it over result
        // next array is copied right after the previous one
        var length = 0;
        for (var i in arrays) {
            var array = arrays[i];
            result.set(array, length);
            length += array.length;
        }
        return result;
    }

    function DummyWriteStream(fs, path) {
        var buffers = [];
        var pending, tested, closed, error;
        this.close = function() {
            if (!error && !closed) {
                if (!tested) {
                    pending = true;
                } else fs.writeFile(path, concat(buffers));
                closed = true;
            }
        };
        this.write = function(data, cb) {
            var e = error;
            if (closed)
                e = global.createError({
                    code: "ECLOSED",
                });
            else if (!e) buffers.push(data);
            setImmediate(cb && cb.bind(null, e));
        };
        fs.writeFile(path, "", function(e) {
            tested = true;
            if (pending) {
                closed = false;
                this.close();
            }
            error = e;
        });
    }
    /*Reduces required properties to just
        "readFile",
        "writeFile",
        "readdir",
        "stat",
        "mkdir",
        "unlink",
        "rmdir",
        "rename"
        href, getEncodings() and copyFile() are optional
    */
    function BaseFs() {
        var fs = this;
        for (var i in BaseFs.prototype) {
            if (!fs[i]) {
                // console.log(i);
                fs[i] = BaseFs.prototype[i];
            }
        }
        fs.lstat = fs.lstat || fs.stat;
        fs.delete =
            fs.delete ||
            function(path, cb, error) {
                error = error || {
                    error: false,
                };
                fs.stat(path, function(e, st) {
                    if (error.error) return cb();
                    if (e) {
                        error.error = e;
                        return cb(e);
                    }
                    if (st.type == "dir") {
                        var counter = createCounter(function() {
                            if (error.error) return cb(error.error);
                            //ignore errors
                            fs.rmdir(path, cb);
                        });
                        counter.increment();
                        fs.readdir(path, function(e, li) {
                            if (error.error) return cb();
                            if (e) {
                                error.error = e;
                                return cb(e);
                            }
                            li.forEach(function(el) {
                                counter.increment();
                                fs.delete(
                                    path + "/" + el,
                                    counter.decrement,
                                    error
                                );
                            });
                            counter.decrement();
                        });
                    } else fs.unlink(path, cb);
                });
            };
        fs.moveFile =
            fs.moveFile ||
            function(path, newpath, cb, overwrite) {
                fs.rename(path, newpath, function(err) {
                    if (err) {
                        FileUtils.copyFile(
                            path,
                            newpath,
                            fs,
                            null,
                            function(e) {
                                if (!e) fs.delete(path);
                                cb && cb(e);
                            }
                        );
                    } else cb();
                });
            };
        fs.getFiles =
            fs.getFiles ||
            function(path, cb) {
                fs.readdir(path, function(err, res) {
                    if (!cb) return;
                    if (err) return cb(err);
                    if (!res.length) return cb(null, res);
                    var dest = [];
                    var each = function(path) {
                        return function(err, stat) {
                            if (
                                (!stat ||
                                    stat.type == "dir") &&
                                path[path.length - 1] != "/"
                            ) {
                                path = path + "/";
                            }
                            dest.push(path);
                            counter.decrement(err);
                        };
                    };
                    var final = function(error) {
                        cb(null, dest);
                    };
                    var counter = createCounter(final);
                    counter.increment();
                    for (var i in res) {
                        counter.increment();
                        fs.stat(path + res[i], each(res[i]));
                    }
                    counter.decrement();
                });
            };
    }
    BaseFs.prototype.readlink = function(path, callback) {
        setImmediate(function() {
            callback(path);
        });
    };
    BaseFs.prototype.symlink = function(path, dest, callback) {
        this.copyFile(path, dest, callback, false);
    };
    BaseFs.prototype.getRoot = function() {
        return "/";
    };
    BaseFs.prototype.getDisk = function() {
        return this.id;
    };
    BaseFs.prototype.isEncoding = function(e) {
        if (normalizeEncoding(e) === "utf8") return "utf8";
    };
    BaseFs.prototype.openReadableStream = function(path) {
        return new DummyReadStream(this, path);
    };
    BaseFs.prototype.openWritableStream = function(path) {
        return new DummyWriteStream(this, path);
    };
    global.BaseFs = BaseFs;
});
//findfileserver
_Define(function(global) {
    var FileUtils = global.FileUtils;

    function FindFileServer(fileServer) {
        var filter = null;
        var b = fileServer;
        var self = Object.create(fileServer);
        self.setFilter = function(glob) {
            if (!glob) {
                filter = null;
                return;
            }
            if (typeof glob == "string") {
                glob = FileUtils.globToRegex(glob);
                filter = function(i, path) {
                    return FileUtils.isDirectory(i) || (path + i).match(glob);
                };

            } else filter = glob;
        };
        self.getFiles = function(path, callback) {
            if (filter)
                b.getFiles(path, function(err, res) {
                    if (err || !filter) return callback(err, []);
                    var filtered = [];
                    for (var i in res) {
                        if (filter(res[i], path)) {
                            filtered.push(res[i]);
                        }
                    }
                    if (callback) callback(err, !err && filtered);
                });
            else b.getFiles(path, callback);
        };
        self.readdir = function(path, callback) {
            self.getFiles(path, function(e, res) {
                callback(e, res && res.map(FileUtils.removeTrailingSlash));
            });
        };
        return self;
    }
    global.FindFileServer = FindFileServer;
});
//stubfileserver
_Define(function(global) {
    var Utils = global.Utils;
    var FileUtils = global.FileUtils;
    var BaseFs = global.BaseFs;

    function StubFileServer(resolve) {
        this.fifif = Utils.genID("FKKF");
        //the core async methods of a file server
        var propsToEnqueue = [
            "readFile",
            "getFiles", //not core, but massive optimization oppurtunity
            "writeFile",
            "readdir",
            "stat",
            "lstat",
            "mkdir",
            "unlink",
            "rmdir",
            "rename",
            "symlink",
            "readlink",
        ];
        var queuedOps = [];
        propsToEnqueue.forEach(function(e) {
            this[e] = function() {
                queuedOps.push({
                    method: e,
                    args: Array.prototype.slice.apply(arguments, [0]),
                });
                this.load();
            };
        }, this);
        StubFileServer.super(this);
        this.$inject = function() {
            var server = resolve();
            server.id = this.id;
            //Update so new calls get to use fs directly
            FileUtils.replaceServer(this, server);
            this.$isStub = server;
            this.$inject = null;
            propsToEnqueue.forEach(function(e) {
                this[e] = server[e].bind(server);
            }, this);
            this.getDisk = server.getDisk.bind(server);
            queuedOps.forEach(function(e) {
                server[e.method].apply(server, e.args);
            });
            resolve = propsToEnqueue = queuedOps = null;
        }.bind(this);
    }
    Utils.inherits(StubFileServer, BaseFs);
    /*Calles when the first request comes in*/
    StubFileServer.prototype.load = Utils.noop;
    StubFileServer.prototype.$isStub = true;
    global.StubFileServer = StubFileServer;

    //wish we did not have to keep a separate object
    var factories = {};
    FileUtils.registerFsExtension = function(id, caption, factory, config) {
        FileUtils.registerFileServer(id, caption, function(params) {
            params.type = "!extensions";
            params.factoryId = id;
            return factory(params);
        }, config);
        if (factory) {
            factories[id] = factory;
            FileUtils.ownChannel("servers-" + id, function(stub) {
                stub.$inject();
            });
        }
    };

    function load(params) {
        if (factories[params.factoryId]) {
            return factories[params.factoryId](params);
        } else {
            var stub = new StubFileServer(load.bind(null, params));
            stub.icon = params.icon;
            FileUtils.postChannel("servers-" + params.factoryId, stub);
            return stub;
        }
    }
    FileUtils.registerFileServer(
        "!extensions",
        "Extension",
        load
    );
}); /*_EndDefine*/
//lightningfs
_Define(function(global) {
    /*globals LightningFS*/
    var InAppFileServer;
    var noop = global.Utils.noop;
    var FileUtils = global.FileUtils;
    var StubFileServer = global.StubFileServer;
    var BaseFs = global.BaseFs;
    var Imports = global.Imports;

    function initBrowserFs() {
        if (InAppFileServer) return InAppFileServer;
        var fs = InAppFileServer;
        if (window.LightningFS) {
            var isApp = Env.isWebView;
            fs = InAppFileServer = new LightningFS(isApp ? "grace_app" : "grace");
            //No worker will be using it anytime soon
            //And we want to be able to use storage
            //even when quota is exhausted
            //todo make this less of a hack
            fs.promises._initPromise.then(function() {
                if (isApp) {
                    fs.promises._mutex = {
                        _has: true,
                        has: function() {
                            return this._has;
                        },
                        acquire: function() {
                            this._has = true;
                            return true;
                        },
                        wait: noop,
                        release: function() {
                            this._has = false;
                            return true;
                        },
                        _keepAlive: function() {
                            this._keepAliveTimeout = true;
                        },
                        _stopKeepAlive: function() {
                            if (this._keepAliveTimeout) {
                                this._keepAliveTimeout = null;
                            }
                        },
                    };
                    fs.promises._deactivate = noop;
                }
                var read = fs.readFile;
                fs.readFile = function(path, opts, cb) {
                    if (typeof opts == 'function') {
                        cb = opts;
                        opts = {};
                    }
                    read.call(fs, path, opts, function(e, i) {
                        if (!e && i === undefined) {
                            cb(global.createError({
                                code: 'EISDIR'
                            }));
                        } else cb(e, i);
                    });
                };
            });
            BaseFs.call(fs);
        } else {
            fs = new StubFileServer(initBrowserFs);
            fs.load = Imports.define(["./libs/js/lightning-fs.js"],
                fs.$inject, noop);
        }
        fs.icon = "memory";
        fs.id = "inApp";
        fs.isCached = true;
        return fs;
    }
    FileUtils.registerFileServer(
        "inApp",
        "In-Memory FileSystem",
        initBrowserFs,
        null, true);
});