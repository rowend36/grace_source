//basefs
define(function (require, exports, module) {
    var setImmediate = require('./utils').Utils.setImmediate;
    var createCounter = require('./utils').Utils.createCounter;
    var noop = require('./utils').Utils.noop;
    var after = require('./depend').after;
    var FileServers = require('./file_servers').FileServers;

    function DummyReadStream(fs, path) {
        var read = false;
        this.close = noop;
        this.read = function (cb) {
            if (!read) fs.readFile(path, cb);
            else setImmediate(cb.bind(null, undefined, null));
            read = true;
        };
    }

    function concat(arrays) {
        // sum of individual array lengths
        var totalLength = arrays.reduce(function (acc, value) {
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
        var _afterTesting = after(
            function test(done) {
                fs.writeFile(path, '', function (e) {
                    error = e;
                    done();
                });
            },
            function (cb, e) {
                setImmediate(cb, e || error);
            }
        );
        var buffers = [];
        var closed, error;
        this.close = function () {
            if (!error && !closed) {
                closed = true;
            }
            _afterTesting(function () {
                fs.writeFile(path, concat(buffers));
            });
        };
        this.write = function (data, cb) {
            var e;
            if (closed) {
                e = FileServers.createError({
                    code: 'ECLOSED',
                });
            } else buffers.push(data);
            _afterTesting(cb, e);
        };
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
            function (path, cb, ctx) {
                ctx = ctx || {
                    error: false,
                };
                fs.stat(path, function (e, st) {
                    if (ctx.error) return cb();
                    if (e) {
                        ctx.error = e;
                        return cb(e);
                    }
                    if (st.isDirectory()) {
                        var counter = createCounter(function () {
                            if (ctx.error) return cb(ctx.error);
                            fs.rmdir(path, cb);
                        });
                        counter.increment();
                        fs.readdir(path, function (e, li) {
                            if (ctx.error) return cb();
                            if (e) {
                                ctx.error = e;
                                return cb(e);
                            }
                            li.forEach(function (el) {
                                counter.increment();
                                fs.delete(
                                    path + '/' + el,
                                    counter.decrement,
                                    ctx
                                );
                            });
                            counter.decrement();
                        });
                    } else fs.unlink(path, cb);
                });
            };
        fs.moveFile =
            fs.moveFile ||
            function (path, newpath, cb /* overwrite*/) {
                fs.rename(path, newpath, function (err) {
                    if (err) {
                        FileServers.copyFile(
                            path,
                            newpath,
                            fs,
                            undefined,
                            function (e) {
                                if (!e) fs.delete(path);
                                cb && cb(e);
                            }
                        );
                    } else cb();
                });
            };
        fs.getFiles =
            fs.getFiles ||
            function (path, cb) {
                fs.readdir(path, function (err, res) {
                    if (!cb) return;
                    if (err) return cb(err);
                    if (!res.length) return cb(null, res);
                    var dest = [];
                    var each = function (path) {
                        return function (err, stat) {
                            if (
                                (!stat || stat.isDirectory()) &&
                                path[path.length - 1] != '/'
                            ) {
                                path = path + '/';
                            }
                            dest.push(path);
                            counter.decrement(err);
                        };
                    };
                    var final = function (/*error*/) {
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
    BaseFs.prototype.readlink = function (path, callback) {
        setImmediate(function () {
            callback(path);
        });
    };
    BaseFs.prototype.label = 'Unnamed FileSystem';
    BaseFs.prototype.symlink = function (path, dest, callback) {
        setImmediate(callback, FileServers.createError({code: 'EUNSUPPORTED'}));
    };
    BaseFs.prototype.getRoot = function () {
        return '/';
    };
    BaseFs.prototype.getDisk = function () {
        return this.id;
    };
    BaseFs.prototype.isEncoding = function (e) {
        if (FileServers.normalizeEncoding(e) === 'utf8') return 'utf8';
    };
    BaseFs.prototype.openReadableStream = function (path) {
        return new DummyReadStream(this, path);
    };
    BaseFs.prototype.openWritableStream = function (path) {
        return new DummyWriteStream(this, path);
    };
    exports.BaseFs = BaseFs;
});