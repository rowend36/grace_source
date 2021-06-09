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
                e = {
                    code: "ECLOSED",
                };
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
                        var counter = createCounter(function(e) {
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
                                stat &&
                                stat.type == "dir" &&
                                path[path.length - 1] != "/"
                            ) {
                                path = path + "/";
                            }
                            dest.push(path);
                            counter.decrement(err);
                        };
                    };
                    var final = function(error) {
                        if (error) cb(error);
                        else cb(null, dest);
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
                filter = function(i,path) {
                    return FileUtils.isDirectory(i) || (path+i).match(glob);
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
        return self;
    }
    global.FindFileServer = FindFileServer;
});
//restfileserver
_Define(function(global) {
    "use strict";
    var BaseFs = global.BaseFs;
    var FileUtils = global.FileUtils;
    var request = global.request;
    var requestBuffer = global.requestBuffer;
    var sendBuffer = global.sendBuffer;
    var normalizeEncoding = FileUtils.normalizeEncoding;
    /*TODO implement streams ad links, or leave links*/
    function RESTFileServer(address, rootDir) {
        var server = address;
        rootDir = rootDir || "/";
        var encodings = ["utf8"];
        request(
            server + "/encodings",
            "",
            function(e, f) {
                this.$encodingList = null;
                if (!e) encodings = f;
            }.bind(this)
        );
        this.icon = "storage";
        this.readFile = function(path, opts, callbac) {
            var callback = function(e, r) {
                console.assert(e || r || r === "");
                callbac && callbac(e, r);
            };
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                } else
                    encoding =
                    opts.constructor === String ? opts : opts.encoding;
            }
            if (!encoding) {
                requestBuffer(server + "/open", path, callback);
            } else
                request(
                    server + "/open", {
                        path: path,
                        encoding: encoding,
                    },
                    callback
                );
        };
        this.getDisk = function() {
            return "local";
        };
        this.getFiles = function(path, callback) {
            request(
                server + "/files", {
                    path: path,
                    appendSlash: true,
                },
                callback
            );
        };
        this.fastGetOid = function(path, callback) {
            request(
                server + "/fastGetOid", {
                    path: path,
                },
                callback
            );
        };
        this.readdir = function(path, callback) {
            request(
                server + "/files", {
                    path: path,
                },
                callback
            );
        };
        this.writeFile = function(path, content, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                    encoding = null;
                } else if (typeof opts == "string") {
                    encoding = opts;
                } else {
                    encoding = opts.encoding;
                }
            }
            var blob = new FormData();
            blob.set("encoding", encoding);
            blob.set("content", new Blob([content]), path);
            sendBuffer(
                server + "/save?path=" + path.replace(/\//g, "%2F"),
                blob,
                callback
            );
        };
        this.mkdir = function(path, callback) {
            request(
                server + "/new", {
                    path: path,
                },
                callback
            );
        };
        this.delete = function(path, callback) {
            request(
                server + "/delete", {
                    path: path,
                },
                callback
            );
        };
        this.unlink = this.rmdir = this.delete;
        this.rename = function(path, dest, callback) {
            request(
                server + "/rename", {
                    path: path,
                    dest: dest,
                },
                callback
            );
        };
        this.copyFile = function(path, dest, callback, overwrite) {
            request(
                server + "/copy", {
                    path: path,
                    dest: dest,
                    overwrite: overwrite,
                },
                callback
            );
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            request(
                server + "/move", {
                    path: path,
                    dest: dest,
                    overwrite: overwrite,
                },
                callback
            );
        };
        this.getRoot = function() {
            return rootDir;
        };
        this.stat = function(path, opts, callback) {
            if (!callback && opts && typeof opts === "function") {
                callback = opts;
                opts = null;
            }
            request(
                server + "/info", {
                    path: path,
                    isLstat: !!opts,
                },
                callback &&
                function(e, s) {
                    if (s) {
                        s = FileUtils.createStats(s);
                    }
                    callback(e, s);
                }
            );
        };
        this.isEncoding = function(e) {
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings
                .map(normalizeEncoding)
                .indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function() {
            return encodings;
        };
        this.lstat = function(path, callback) {
            this.stat(path, true, callback);
        };
        this.href = server + "/root/";
        BaseFs.call(this);
    }
    global.RESTFileServer = RESTFileServer;
    if (Env.canLocalHost) {
        FileUtils.registerFileServer(
            "rest",
            "REST HTTP Fileserver",
            function(conf) {
                var address = Env._server;
                var root = "/";
                if (conf) {
                    if (conf.address) {
                        address = conf.address;
                        if (!address.startsWith("http"))
                            address = "http://" + address;
                    }
                    if (conf.root) {
                        root = conf.root;
                    }
                }
                return (window.rfs = new RESTFileServer(address, root));
            },
            [{
                    name: "address",
                    caption: "Address",
                    type: "text",
                    value: Env._server || "http://localhost:8000",
                },
                {
                    name: "root",
                    caption: "Root Directory",
                    value: "/",
                    type: "text",
                },
            ]
        );
    }
}); /*_EndDefine*/
//stubfileserver
_Define(function(global) {
    var Utils = global.Utils;
    var noop = global.Utils.noop;
    var FileUtils = global.FileUtils;
    var BaseFs = global.BaseFs;

    function StubFileServer(url, resolve) {
        //the core async methods of a file server
        var propsToEnqueue = [
            "readFile",
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
        this.$url = url;
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
            queuedOps.forEach(function(e) {
                server[e.method].apply(server, e.args);
            });
            resolve = propsToEnqueue = queuedOps = null;
        }.bind(this);
    }
    Utils.inherits(StubFileServer, BaseFs);
    /*Override this method if you will have multiple
        instances eg
    this.load = function() {
        if (loaded) $inject()
        if (loading) loader.on('loaded', $inject)
        else {
            loader.load();
            loader.on('load', $inject);
        }
        //toprevent more calls to $inject
        this.load = function() {}
    }*/
    StubFileServer.prototype.$isStub = true;
    StubFileServer.prototype.load = function() {
        var script = document.createElement("script");
        script.setAttribute("type", "text/javascript");
        script.setAttribute("id", this.id);
        script.src = this.$url;
        script.onload = this.$inject;
        document.body.appendChild(script);
        this.load = noop;
    };
    global.StubFileServer = StubFileServer;
}); /*_EndDefine*/
//lightningfs
_Define(function(global) {
    var InAppFileServer;
    var noop = global.Utils.noop;
    var FileUtils = global.FileUtils;
    var StubFileServer = global.StubFileServer;
    var BaseFs = global.BaseFs;
    global.getBrowserFileServer = function() {
        if (InAppFileServer) return InAppFileServer;
        var fs = InAppFileServer;
        if (window.LightningFS) {
            fs = InAppFileServer = new LightningFS("grace");
            //No worker will be using you anytime soon
            //And we want to be able to use storage
            //even when quota is exhausted
            //todo make this less of a hack
            fs.promises._initPromise.then(function() {
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
            });
            BaseFs.call(fs);
        } else {
            fs = new StubFileServer(
                "./libs/js/lightning-fs.js",
                global.getBrowserFileServer
            );
        }
        fs.icon = "memory"
        fs.id = "inApp";
        fs.cachedFs = fs;
        return fs;
    };
    FileUtils.registerFileServer(
        "inApp",
        "In-Memory FileSystem",
        global.getBrowserFileServer
    );
});