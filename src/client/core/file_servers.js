//basefs
define(function(require, exports, module) {
    var setImmediate = require("./utils").Utils.setImmediate;
    var createCounter = require("./utils").Utils.createCounter;
    var FileUtils = require("./file_utils").FileUtils;
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
                e = require("./config").createError({
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
                    if (st.isDirectory()) {
                        var counter = createCounter(function() {
                            if (error.error) return cb(error.error);
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
                                    stat.isDirectory()) &&
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
    exports.BaseFs = BaseFs;


    var Utils = require("./utils").Utils;

    function StubFileServer(resolve) {
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
    exports.StubFileServer = StubFileServer;

    //wish we did not have to keep a separate object
    //we need to separate the FileUtils runtime class from Files
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
});