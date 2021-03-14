_Define(function(global) {
    "use strict";
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var createCounter = global.Utils.createCounter;
    var request = global.request;
    var requestBuffer = global.requestBuffer;
    var sendBuffer = global.sendBuffer;
    var normalizeEncoding = FileUtils.normalizeEncoding;

    function upgradeFs(fs) {
        fs.delete = fs.delete || function(path, cb, error) {
            error = error || {
                error: false
            };
            fs.stat(path, function(e, st) {
                if (error.error) return cb();
                if (e) {
                    error.error = e;
                    return cb(e);
                }
                if (st.type == "dir") {
                    var counter = Utils.createCounter(function(e) {
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
                            fs.delete(path + "/" + el, counter.decrement, error);
                        });
                        counter.decrement();
                    });
                } else fs.unlink(path, cb);
            });
        };
        fs.moveFile = fs.moveFile || function(path, newpath, cb, overwrite) {
            fs.rename(path, newpath, function(err) {
                if (err) {
                    FileUtils.copyFile(path, newpath, fs, null, function(e) {
                        if (!e) fs.delete(path);
                        cb && cb(e);
                    });
                } else cb();
            });
        };
        fs.getRoot = fs.getRoot || function() {
            return "/";
        };

        fs.getFiles = fs.getFiles || function(path, cb) {
            fs.readdir(path, function(err, res) {
                if (!cb) return;
                if (err) return cb(err);
                if (!res.length) return cb(null, res);
                var dest = [];

                var each = function(path) {
                    return function(err, stat) {
                        if (stat && stat.type == "dir" && path[path.length - 1] != "/") {
                            path = path + "/";
                        }
                        dest.push(path);
                        counter.decrement();
                    };
                };
                var final = function() {
                    cb(null, dest);
                };
                var counter = createCounter(final, each);
                counter.increment();
                for (var i in res) {
                    counter.increment();
                    fs.stat(path + res[i], each(res[i]));
                }
                counter.decrement();
            });
        };
        fs.getDisk = fs.getDisk || function() {
            return this.id;
        };
        fs.isEncoding = fs.isEncoding || function(e) {
            if (normalizeEncoding(e) === "utf8") return 'utf8';
        };
    }
    var InAppFileServer;
    global.getBrowserFileServer = function() {
        if (InAppFileServer) return InAppFileServer;
        var fs = InAppFileServer;
        if (window.LightningFS) {
            fs = InAppFileServer = new LightningFS('grace');
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
                    wait: Utils.noop,
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
                    }
                };
                fs.promises._deactivate = Utils.noop;
            });
            upgradeFs(fs);
        } else {
            fs = new StubFileServer("./libs/js/lightning-fs.js", global.getBrowserFileServer);
        }
        fs.id = "inApp";
        fs.cachedFs = fs;

        return fs;
    };

    function RESTFileServer(address, rootDir) {
        var server = address;
        rootDir = rootDir || "/";
        var encodings = ["utf8"];
        request(server + "/encodings", "", function(e, f) {
            this.$encodingList = null;
            if (!e) encodings = f;
        }.bind(this));
        this.readFile = function(path, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                } else encoding = opts.constructor === String ? opts : opts.encoding;
            }
            if (!encoding) {
                requestBuffer(server + "/open", path, callback);
            } else request(server + "/open", {
                path: path,
                encoding: encoding
            }, callback);
        };
        this.getDisk = function() {
            return "local";
        };
        this.getFiles = function(path, callback) {
            request(server + "/files", {
                path: path,
                appendSlash: true
            }, callback);
        };
        this.readdir = function(path, callback) {
            request(server + "/files", {
                path: path
            }, callback);
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
            sendBuffer(server + "/save?path=" + path.replace(/\//g, '%2F'), blob, callback);

        };
        this.mkdir = function(path, callback) {
            request(server + "/new", {
                path: path,
            }, callback);
        };
        this.delete = function(path, callback) {
            request(server + "/delete", {
                path: path,
            }, callback);
        };
        this.unlink = this.rmdir = this.delete;
        this.rename = function(path, dest, callback) {
            request(server + "/rename", {
                path: path,
                dest: dest
            }, callback);
        };

        this.copyFile = function(path, dest, callback, overwrite) {
            request(server + "/copy", {
                path: path,
                dest: dest,
                overwrite: overwrite
            }, callback);
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            request(server + "/move", {
                path: path,
                dest: dest,
                overwrite: overwrite
            }, callback);
        };
        this.getRoot = function() {
            return rootDir;
        };

        this.stat = function(path, opts, callback) {
            if (!callback && opts && typeof opts === "function") {
                callback = opts;
                opts = null;
            }
            request(server + "/info", {
                path: path,
                isLstat: !!opts
            }, callback && function(e, s) {
                if (s) {
                    s = FileUtils.createStats(s);
                }
                callback(e, s);
            });

        };
        this.isEncoding = function(e) {
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings.map(normalizeEncoding).indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function() {
            return encodings;
        };
        this.symlink = function(path, dest, callback) {
            this.copyFile(path, dest, callback, false);
        };
        this.readlink = function(path, callback) {
            setImmedate(function() {
                callback(path);
            });
            //path,dest,callback,false);
        };
        this.lstat = function(path, callback) {
            this.stat(path, true, callback);
        };
        this.href = server + "/root/";
    }
    //the core props of a file server

    function StubFileServer(url, resolve) {
        var propsToEnqueue = ['getFiles',
            'readFile', 'writeFile', 'stat', 'lstat', 'mkdir'
        ];
        var queuedOps = [];
        propsToEnqueue.forEach(function(e) {
            this[e] = function() {
                queuedOps.push({
                    method: e,
                    args: Array.prototype.slice.apply(arguments, [0])
                });
                this.load();
            };
        }, this);
        this.$isStub = true;
        //override this method if you will have multiple
        //instances eg
        /*
        this.load = function(){
            if(loaded)inject()
            if(loading)loader.on('loaded',inject)
            else {
            loader.load();
            loader.on('load',inject);
            }
            //toprevent more calls to inject
            this.load = function(){}
        }
        */
        this.load = function() {
            var script = document.createElement('script');
            script.setAttribute("type", "text/javascript");
            script.setAttribute('id', this.id);
            script.src = url;
            script.onload = function() {
                this.inject();
            }.bind(this);
            document.body.appendChild(script);
            this.load = Utils.noop;
        };
        this.getRoot = function() {
            return '/';
        };
        this.getDisk = function() {
            return this.id;
        };
        this.inject = function() {
            var server = resolve();
            server.id = this.id;
            //optional since methods are updated
            FileUtils.replaceServer(this, server);
            this.$isStub = server;
            queuedOps = null;
            this.inject = null;
            propsToEnqueue.forEach(function(e) {
                this[e] = server[e].bind(server);
            }, this);
            queuedOps.forEach(function(e) {
                server[e.method].apply(server, e.args);
            });
        };
    }

    function FindFileServer(fileServer) {
        var filter = null;
        var b = fileServer;
        var self = Object.create(fileServer);
        self.setFilter = function(glob, re) {
            if (!glob) {
                filter = null;
                return;
            }
            if (typeof(glob) == 'string') {
                if (re) {
                    filter = function(i) {
                        return FileUtils.isDirectory(i) || i.match(glob);
                    };
                } else filter = function(i, folder) {
                    return (FileUtils.isDirectory(i) || ('^' + folder + i + '$').indexOf(glob) > -1);
                };
                return;
            }
            filter = glob;
        };
        self.getFiles = function(path, callback) {
            if (filter)
                b.getFiles(path, function(err, res) {
                    if (err || !filter) return callback(err, []);
                    var filtered = [];
                    for (var i of res) {
                        if (filter(i, path)) {
                            filtered.push(i);
                        }
                    }
                    if (callback)
                        callback(err, !err && filtered);
                });
            else b.getFiles(path, callback);
        };
        return self;
    }

    global.RESTFileServer = RESTFileServer;
    global.FindFileServer = FindFileServer;
    global.StubFileServer = StubFileServer;
    if (Env.canLocalHost) {
        FileUtils.registerFileServer("rest", "REST HTTP Fileserver", function(conf) {
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
        }, [{
                name: "address",
                caption: "Address",
                type: "text",
                value: Env._server || "http://localhost:8000"
            },
            {
                name: "root",
                caption: "Root Directory",
                value: '/',
                type: "text"
            }
        ]);
    }
    FileUtils.registerFileServer('inApp', "In-Memory FileSystem", global.getBrowserFileServer);
}) /*_EndDefine*/