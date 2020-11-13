(function(global) {
    "use strict";
    var Utils = global.Utils;
    global.createCacheFs = function(fs) {
        var cached = {};
        var enoents = {};
        var max_size = 1000000;
        var size = 0;
        var slimCache = function() {
            var a = Object.keys(cached);
            a = a.sort(function(a, b) {
                return (cached[b].count - cached[a].count) || (cached[a].size - cached[b].size);
            });
            var i = 0;
            while (size > max_size * 0.75 && i < a.length) {
                var path = cached[a[i++]];
                if (!path.willSave) {
                    size -= path.size;
                    delete cached[a[i - 1]];
                }
            }
        };
        var pop = function(path) {
            var item = cached[path];
            if (item && !item.willSave) {
                size -= item.size;
                delete cached[path];
            }
        }
        var push = function(path, res, save) {
            if (enoents[path]) delete enoents[path];
            if (size > max_size) {
                slimCache();
            }
            if(typeof res=='string'){
                res = toBuffer(res).buffer;
            }
            if (cached[path]) {
                size -= cached[path].size;
                cached[path].res = res;
                cached[path].size = res.byteLength;
                cached[path].count++;
                size += cached[path].size;
                if (save) {
                    cached[path].lastMod = new Date();
                }
            }
            else {
                cached[path] = {
                    size: res.byteLength,
                    count: 1,
                    res: res,
                    stat: null,
                    lstat: null,
                    lastMod: null
                };
                size += cached[path].size;
            }
        };
        var getStat = function(item, lstat) {
            var stat = item[lstat ? "lstat" : "stat"];
            if (!stat) return;
            if (item.lastMod > stat.mtime) {
                stat.mtime = item.lastMod;
                stat.mtimeMs = item.lastMod.getTime();
                stat.atimeMs = stat.mtimeMs;
                stat.atime = stat.mtime; //item.lastMod.getTime();
            }
            stat.size = item.size;
            return stat;
        };
        var putStat = function(item, stat, lstat) {
            if (lstat) {
                item.lstat = stat;
                if (!stat.isSymbolicLink()) {
                    item.stat = stat;
                }
            }
            else {
                item.stat = stat;
            }
        };
        var doSave = function(item, name, token) {
            item.willSave = token;
            fs.writeFile(name, item.res, function(e) {
                if (item.willSave != token) return;
                if (e) {
                    item.willSave = true;
                    save();
                }
                else {
                    item.willSave = false;
                }
            });
        };
        var save = Utils.debounce(function() {
            var token = {};
            for (var i in cached) {
                if (cached[i].willSave) {
                    doSave(cached[i], i, token);
                }
            }
        }, 1000);
        var toBuffer = function(res) {
            return new TextEncoder().encode(res);
        };
        var toString = function(res) {
            var t = new TextDecoder().decode(res);
            return t;
        };
        var cacheFs = Object.create(fs);
        cacheFs.readFile = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            var item = cached[path];
            if (item && (!enc || enc == "utf8")) {
                item.count++;
                var res = item.res;
                if (enc)
                    res = toString(item.res);
                setTimeout(function() {
                    cb(null, res);
                });
            }
            else if (enoents[path]) {
                setTimeout(function() {
                    cb({
                        code: 'ENOENT',
                        message: 'ENOENT'
                    });
                });
            }
            else fs.readFile(path, opts, function(e, res) {
                if (!e) {
                    if (res && (!enc || enc == 'utf8')) {
                        push(path, res);
                    }
                }
                else if (e.code == 'ENOENT') {
                    enoents[path] = true;
                }
                cb(e, res);
            });
        };
        cacheFs.writeFile = function(path, res, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            var item = cached[path];
            if (item) {
                if (res && item.canSave && (!enc || enc == 'utf8')) {
                    item.willSave = true;
                    push(path, res, true);
                    save();
                    setTimeout(cb, 0);
                    return;
                }
                else if (item.willSave)
                    item.willSave = false;
            }
            fs.writeFile(path, res, opts, function(e) {
                if (enoents[path]) delete enoents[path];
                var item = cached[path];
                if (item) {
                    if (e) {
                        item.canSave = false;
                        pop(path);
                    }
                    else if (res) {
                        item.canSave = true;
                        if (!enc || enc == 'utf8') {
                            push(path, res, true);
                        }
                        else pop(path);
                    }
                }
                cb && cb(e);
            });
        }
        cacheFs.stat = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }

            var isLstat = (opts == true || (opts && opts.isLstat == true))

            if (cached[path]) {
                var stat = getStat(cached[path], isLstat);
                if (stat) {
                    setTimeout(function() {
                        cb(null, stat)
                    });
                    return;
                }
            }
            else if (enoents[path]) {
                setTimeout(function() {
                    cb({
                        code: 'ENOENT',
                        message: 'ENOENT'
                    });
                });
                return;
            }
            var end = function(e, s) {
                if (e) {
                    pop(path);
                    if (e.code == 'ENOENT') {
                        enoents[path] = true;
                    }
                }
                else if (cached[path]) {
                    putStat(cached[path], s, isLstat);
                }
                cb(e, s);
            }
            fs.stat(path, opts || end, opts && end);

        }
        return cacheFs;
    };
})(Modules);