define(function(require,exports,module) {
    "use strict";
    var Utils = require("grace/core/utils").Utils;
    var removeTrailingSlash = require("grace/core/file_utils").FileUtils.removeTrailingSlash;
    var setImmediate = Utils.setImmediate;
    var normalize = require("grace/core/file_utils").FileUtils.normalize;
    var dirname = require("grace/core/file_utils").FileUtils.dirname;
    var createError = require("grace/core/file_utils").FileUtils.createError;
    var filename = require("grace/core/file_utils").FileUtils.filename;
    var current = 0;
    var activate = function(i, size) {
        exports.Caches.caches[i] = {
            last: current,
            size: size
        };
        poll();
    };
    exports.Caches = {
        caches: [],
        activate: activate,
        index: 0,
        get usage() {
            var sum = 0;
            var caches = exports.Caches.caches;
            var deadline = current - 3;
            for (var i in caches) {
                if (caches[i] && caches[i].last > deadline) {
                    sum += caches[i].size;
                } else caches[i] = undefined;
            }
            return sum;
        }
    };
    var poll = Utils.delay(function() {
        current++;
        if (exports.Caches.usage) {
            poll();
        }
    }, 60000);
    /*
        fs - Filesystem to wrap
        cacheSize - maximum cache size default - 1mb
        noSave - whether to throttle file writes
    */
    exports.createCacheFs = function(fs, cacheSize, noSave) {
        if (fs.cachedFs)
            return fs.cachedFs;
        else if (fs.isCached) return fs;
        var id = exports.Caches.index++;
        //A map of paths and cached data
        //Each path must have a res property
        //oid,stat,lstat are optional
        //willSave implies a save is pending which means
        //all data from fs is void
        var cached = {};
        var enoents = {};
        var max_size = cacheSize || Utils.parseSize("1mb");
        var size = 0;
        //reduce the size of the cache
        var slimCache = function(targetSize) {
            var a = Object.keys(cached);
            a = a.sort(function(a, b) {
                return (cached[b].count - cached[a].count) || (cached[a].size - cached[b].size);
            });
            var i = 0;
            while (size > targetSize * 0.75 && i < a.length) {
                var path = cached[a[i++]];
                if (!path.willSave) {
                    size -= path.size;
                    delete cached[a[i - 1]];
                }
            }
        };
        //remove a path from the cache
        var pop = function(path) {
            var item = cached[path];
            if (item && !item.willSave) {
                size -= item.size;
                delete cached[path];
            } else if (item) item.dirty = true;
        };
        //add a path to cache, save means the file was modified
        var push = function(path, res, save) {
            activate(id, size);
            if (enoents[path]) delete enoents[path];
            if (size > max_size) {
                slimCache(max_size);
            }
            if (typeof res == 'string') {
                res = toBuffer(res).buffer;
            }
            if (cached[path]) {
                size -= cached[path].size;
                cached[path].res = res;
                cached[path].dirty = false;
                cached[path].size = res.byteLength;
                cached[path].count++;
                cached[path].oid = undefined;
                size += cached[path].size;
                if (save) {
                    cached[path].lastMod = new Date();
                }
            } else {
                cached[path] = {
                    size: res.byteLength,
                    count: 1,
                    res: res,
                    stat: null,
                    lstat: null,
                    lastMod: null,
                    oid: null
                };
                size += cached[path].size;
            }
        };
        //Add an oid only if the file has not been modified since the fs call
        function putOid(path, value, lastMod) {
            if (cached[path] && cached[path].lastMod == lastMod) {
                cached[path].oid = value;
            }
        }
        //get stat updating from item
        var getStat = function(item, isLstat) {
            activate(id, size);
            if (item.dirty) return;
            var stat = item[isLstat ? "lstat" : "stat"];
            if (!stat) return;
            if (item.lastMod && item.lastMod !== stat.mtime) {
                stat.mtime = item.lastMod;
                stat.mtimeMs = item.lastMod.getTime();
                stat.atimeMs = stat.mtimeMs;
                stat.atime = stat.mtime;
            }
            stat.size = item.size;
            return copyStat(stat);
        };
        //add a recent stat, possible errors,
        //file has been deleted and is now a directory
        var copyStat = require("grace/core/file_utils").FileUtils.createStats;

        var putStat = function(item, stat, isLstat) {
            stat = copyStat(stat);
            if (isLstat) {
                item.lstat = stat;
                if (!stat.isSymbolicLink()) {
                    item.stat = stat;
                }
            } else {
                item.stat = stat;
            }
        };
        var doSave = function(item, name, token, cb) {
            item.willSave = token;
            fs.writeFile(name, item.res, function(e) {
                if (item.willSave != token) return;
                if (e) {
                    item.canSave = false;
                    item.willSave = true;
                    save();
                } else {
                    item.willSave = false;
                }
                if (cb) cb(e);
            });
        };
        //save all the files that need saving
        var saveAll = function() {
            if (isClosed) return;
            var token = {};
            for (var i in cached) {
                if (cached[i].willSave === true) {
                    doSave(cached[i], i, token);
                }
            }
        };
        var save = Utils.debounce(saveAll, 700);
        var toBuffer = function(res) {
            return new TextEncoder().encode(res);
        };
        var toString = function(res) {
            var t = new TextDecoder().decode(res);
            return t;
        };

        function saveThen(path, func) {
            if (cached[path] && cached[path].willSave)
                doSave(cached[path], path, {}, func);
            else func();
        }
        var cacheFs = Object.create(fs);
        if (window.git) {
            var getOid = window.git.hashBlob;
            cacheFs.$gitBlobOid = function(path, cb) {
                path = normalize(path);
                var item = cached[path];
                var key = item && (item.lastMod || (item.lastMod = 0));
                if (item && item.oid) {
                    item.count++;
                    var oid = item.oid;
                    setImmediate(function() {
                        cb(null, oid);
                    });
                } else if (item) {
                    //implies item.willSave
                    item.count++;
                    getOid({
                        object: item.res
                    }).then(function(ret) {
                        putOid(path, ret, key);
                        cb(null, ret);
                    });
                } else if (enoents[path]) {
                    setImmediate(function() {
                        cb(null, null);
                    });
                } else if (fs.$gitBlobOid) {
                    fs.$gitBlobOid(path, function(e, ret) {
                        if (ret) {
                            putOid(path, ret, key);
                        }
                        cb(e, ret);
                    });
                } else {
                    //only a safe op because no item
                    this.readFile(path, function(e, res) {
                        if (e && e.code == 'ENOENT') {
                            enoents[path] = true;
                            cb(null, null);
                        } else if (!e) {
                            push(path, res);
                            var item = cached[path];
                            var key = item && item.lastMod;
                            getOid({
                                object: res
                            }).then(function(ret) {
                                putOid(path, ret, key);
                                cb(null, ret);
                            });
                        } else cb(e);
                    });
                }
            };
        }

        cacheFs.readFile = function(path, opts, cb) {
            activate(id, size);
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            path = normalize(path);
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            var item = cached[path];
            if (item && !item.dirty && (!enc || enc == "utf8")) {
                item.count++;
                var res = item.res;
                if (enc)
                    res = toString(item.res);
                setImmediate(function() {
                    cb(null, res);
                });
            } else if (enoents[path]) {
                setImmediate(function() {
                    cb(createError({
                        code: 'ENOENT'
                    }));
                });
            } else
                saveThen(path, function() {
                    fs.readFile(path, opts, function(e, res) {
                        if (!e) {
                            if (!e && (!enc || enc == 'utf8')) {
                                push(path, res);
                            } else pop(path);
                        } else if (!(cached[path] && cached[path].wilSave) && e.code == 'ENOENT') {
                            enoents[path] = true;
                        }
                        cb(e, res);
                    });
                });
        };
        cacheFs.writeFile = function(path, res, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            path = normalize(path);
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            var item = cached[path];
            if (item) {
                if (!isClosed &&
                    item.canSave &&
                    (!enc || enc == 'utf8')
                ) {
                    push(path, res || "", true);
                    item.willSave = true;
                    if (enoents[path]) delete enoents[path];
                    var dir = cached[dirname(path)];
                    if (dir && dir.fileList.indexOf(filename(path)) < 0) {
                        dir.fileList.push(filename(path));
                    }
                    save();
                    setImmediate(cb);
                    return;
                } else if (item.willSave)
                    item.willSave = false;
            }
            var key = item && item.lastMod;
            fs.writeFile(path, res, opts, function(e) {
                if (enoents[path]) delete enoents[path];
                var item = cached[path];
                if (item && item.lastMod === key) {
                    if (e) {
                        item.canSave = false;
                        //unknown state
                        //won't be removed if item.willSave
                        item.stat = item.lstat = null;
                        pop(path);
                    } else if (!e) {
                        item.canSave = !noSave;
                        if (!enc || enc == 'utf8') {
                            push(path, res || "", true);
                        } else pop(path); //remove path if res is null
                    } else pop(path);
                } else {}
                if (!e) {
                    //add to directory list
                    var dir = cached[dirname(path)];
                    if (dir && dir.fileList.indexOf(filename(path)) < 0) {
                        dir.fileList.push(filename(path));
                    }
                }
                cb && cb(e);
            });
        };

        cacheFs.readdir = function(path, cb) {
            this.getFiles(path, function(e, r) {
                if (r) r = r.map(removeTrailingSlash);
                cb && cb(e, r);
            });
        };
        cacheFs.getFiles = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            path = normalize(path);
            path = path.replace(/\/$/, '');
            var item = cached[path];
            if (item) {
                item.count++;
                if (item.fileList) {
                    return setImmediate(function() {
                        cb(null, item.fileList);
                    });
                }
                //unlikely
                return setImmediate(function() {
                    cb(createError({
                        code: 'ENOTDIR'
                    }));
                });
            }
            if (enoents[path]) {
                return setImmediate(function() {
                    cb(createError({
                        code: 'ENOENT'
                    }));
                });
            }
            var dir = cached[dirname(path)];
            if (dir) {
                dir.count--;
                var t = dir.fileList;
                var name = filename(path);
                if (t.indexOf(name + "/") < 0) {
                    if (t.indexOf(name) > -1) {
                        return cb(createError({
                            code: 'ENOTDIR'
                        }));
                    }
                    //unlikely
                    console.error(path + ' not found in', t);
                    return setImmediate(function() {
                        cb(createError({
                            code: 'ENOENT'
                        }));
                    });
                }
            }
            fs.getFiles(path, function(e, list) {
                if (e && e.code == 'ENOENT') {
                    enoents[path] = true;
                } else if (list) {
                    slimCache(max_size);
                    size -= (cached[path] && cached[path].size)||0;
                    cached[path] = {
                        fileList: list,
                        count: 100 + list.length,
                        size: list.length * 5
                    };
                    size += list.length * 5;
                }
                cb(e, list);
            });

        };

        cacheFs.stat = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var isLstat = (opts === true || (opts && opts.isLstat));
            if (cached[path]) {
                var stat = getStat(cached[path], isLstat);
                if (stat) {
                    setImmediate(function() {
                        cb(null, stat);
                    });
                    return;
                }
            } else if (enoents[path]) {
                setImmediate(function() {
                    cb(createError({
                        code: 'ENOENT'
                    }));
                });
                return;
            }
            var end = function(e, s) {
                if (e) {
                    pop(path);
                    if (e.code == 'ENOENT') {
                        enoents[path] = true;
                    }
                } else if (cached[path]) {
                    putStat(cached[path], s, isLstat);
                    if (cached[path].willSave) {
                        s = getStat(cached[path], s, isLstat);
                    }
                }
                cb(e, s);
            };
            fs.stat(path, opts || end, opts && end);
        };
        cacheFs.synchronize = function() {
            saveAll();
            for (var t in cached) {
                pop(t);
            }
        };
        cacheFs.discard = function() {
            this.synchronize();
            //don't close yet, memory should still be reclaimed
            //since we keep no reference
        };
        cacheFs.id = fs.id;
        cacheFs.isCached = true;
        var isClosed = false;
        // cacheFs.discard = discard.now;
        // cacheFs.postDiscard = function() {
        //     discard.cancel();
        //     discard();
        // };
        //TODO add mechanism to detect invalidation of cache
        return cacheFs;
    };
}); /*_EndDefine*/