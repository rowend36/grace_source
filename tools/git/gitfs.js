
//later on
_Define(function(global) {
    function GitTreeBrowser() {
        GitTreeBrowser.super(this, arguments);
    }
    //Utils.extend(GitTreeBrowser,Hierarchy);
}); /*_EndDefine*/
_Define(function(global) {
    var relative = global.FileUtils.relative;
    var normalize = global.FileUtils.normalize;
    var clean = global.FileUtils.removeTrailingSlash;
    var dirname = global.FileUtils.dirname;

    function GitFileServer(opts, commit) {
        this.opts = {
            fs: opts.fs,
            dir: opts.dir,
            gitdir: opts.gitdir,
            cache: opts.cache
        };
        if (commit) {
            this.trees = {
                "!oid": commit.tree,
                "!isDir": true
            };
        }
        this.ref = this.opts.ref;
    }
    (function() {
        this.getOpts = function(d) {
            return Object.assign({
                fs: this.opts.fs,
                dir: this.opts.dir,
                gitdir: this.opts.gitdir,
                cache: this.opts.cache,
            }, d);
        };
        this.resolve = function(cb) {
            git.resolveRef(this.getOpts({
                ref: this.ref
            })).then(function(sha) {
                git.readCommit(this.getOpts({
                    oid: sha
                })).then(function(obj) {
                    if (!this.trees) {
                        this.trees = {};
                        this.trees["!oid"] = obj.commit.tree;
                        this.trees["!isDir"] = true;
                    }
                    cb();
                }, cb);
            }, cb);
        };
        this.readFile = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            this.readdir(dirname(path), function(e) {
                if (e) cb(e);
                else {
                    var cache = this.trees;
                    var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
                    while (segments.length) {
                        cache = cache[segments.shift()];
                    }
                    if (!cache) {
                        cb({
                            code: 'ENOENT'
                        });
                    } else if (cache["!isDir"]) {
                        cb({
                            code: 'EISDIR'
                        });
                    }
                    git.readBlob(this.getOpts({
                        oid: cache["!oid"]
                    })).then(function(t) {
                        var res = t.blob;
                        if (!enc) {
                            cb(null, res);
                        } else {
                            var error;
                            try {
                                res = new TextDecoder(enc).decode(res);
                            } catch (e) {
                                error = e;
                            }
                            cb(error, error ? undefined : res);
                        }
                    }, cb);
                }
            });
        };
        this.writeFile = function(path, content, opts, cb) {
            setTimeout(function() {
                cb({
                    code: 'EUNSUPPORTED'
                });
            });
        };
        this.readdir = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }

            // Read a commit object
            var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
            var treeOid = null;
            var cache = this.trees;
            if (!cache) {
                this.resolve(function(e) {
                    if (e) cb(e);
                    else {
                        cache = this.trees;
                        dip();
                    }
                });
            } else {
                while (segments.length) {
                    if ((cache[segments[0]])) {
                        cache = cache[segments.shift()];
                    } else break;
                }
                if (!segments.length) {
                    if (cache["!loaded"]) {
                        cb(null, Object.keys(cache).filter(function(i) {
                            return i != "!oid" && i != "!isDir" && i != "!loaded";
                        }));
                    }
                }
                dip();
            }

            function dip() {
                git.readTree(this.getOpts({
                    oid: cache["!oid"]
                })).then(function(res) {
                    for (var i = 0; i < res.tree.length; i++) {
                        cache[res.tree[i].path] = {
                            "!oid": res.tree[i].oid,
                            "!isDir": res.tree[i].type == 'tree'
                        };
                    }
                    cache["!loaded"] = true;
                    if (segments.length === 0) {
                        cb(null, res.tree.map(function(e) {
                            return e.path;
                        }));
                    } else {
                        var name = segments.shift();
                        var tree = res.tree[name];
                        if (!tree) {
                            return cb({
                                code: 'ENOENT'
                            });
                        } else if (!tree["!isDir"]) {
                            return cb({
                                code: 'ENOTDIR'
                            });
                        } else {
                            cache = tree;
                            dip();
                        }
                    }
                }, cb);
            }
        };
        this.getFiles = function(path, cb) {
            var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
            this.readdir(path, function(e, res) {
                if (e) cb(e);
                var cache = this.trees;
                while (segments.length) {
                    cache = cache[segments.shift()];
                }
                cb(null, res.map(function(e) {
                    if (cache[e]["!isDir"]) {
                        return e + "/";
                    }
                    return e;
                }));
            });
        };
        this.stat = function() {
            this.opts.fs.stat.apply(fs, arguments);
        };
        this.lstat = function() {
            this.opts.fs.lstat.apply(fs, arguments);
        };
        this.href = null;
        this.isEncoding = function() {
            this.opts.fs.isEncoding.apply(fs, arguments);
        };
        this.getEncodings = function() {
            this.opts.fs.getEncodings.apply(fs, arguments);
        };
        this.getDisk = function() {
            this.opts.fs.getDisk.apply(fs, arguments);
        };
        this.getRoot = function() {
            return this.opts.dir; //.apply(fs, arguments);
        };
        this.copyFile = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.moveFile = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.mkdir = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.rename = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.delete = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.rmdir = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.unlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.symlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
        this.readlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({
                code: 'UNSUPORTED'
            })
        };
    }).apply(GitFileServer.prototype);
    global.GitFileServer = GitFileServer;
}); /*_EndDefine*/