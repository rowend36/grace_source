//later on
define(function (require, exports, module) {
    require("./libs/isomorphic-git-mod.js");
    var git = window.git;
    var relative = require("grace/core/file_utils").FileUtils.relative;
    var normalize = require("grace/core/file_utils").FileUtils.normalize;
    var clean = require("grace/core/file_utils").FileUtils.removeTrailingSlash;
    var createError = require("grace/core/file_utils").FileUtils.createError;
    var Fileviews = require("grace/ext/fileview/fileviews").Fileviews;
    var pleaseCache = require("./cache_fs").createCacheFs;
    var Utils = require("grace/core/utils").Utils;
    var BaseFs = require("grace/core/base_fs").BaseFs;
    var gitPromptCommit = require('./git_commit').promptCommit;
    exports.browseCommit = function (ev, prov) {
        gitPromptCommit(
            prov,
            "Enter commit id/message",
            function (ref) {
                var opts = {
                    dir: prov.dir,
                    gitdir: prov.gitdir,
                    fs: prov.fs.id,
                    ref: ref,
                    icon: "sync",
                    type: "!gitfs",
                };
                Fileviews.initBrowser(opts);
            }
        );
    };

    function GitFileServer(opts) {
        BaseFs.call(this);
        var fs = require("grace/core/file_utils").FileUtils.getFileServer(
            opts.fs
        );
        this.opts = {
            fs: fs && pleaseCache(fs),
            dir: opts.dir,
            gitdir: opts.gitdir,
            cache: opts.cache || {},
            ref: opts.ref,
        };
        //todo handle missing fs
        this.ref = this.opts.ref;
    }

    Utils.inherits(GitFileServer.prototype, BaseFs);
    (function () {
        this.icon = "sync";
        this.getOpts = function (d) {
            return Object.assign(
                {
                    fs: this.opts.fs,
                    dir: this.opts.dir,
                    gitdir: this.opts.gitdir,
                    cache: this.opts.cache,
                },
                d
            );
        };
        this.resolve = function (cb) {
            var self = this;
            git.resolveRef(
                this.getOpts({
                    ref: this.ref,
                })
            ).then(function (sha) {
                git.readCommit(
                    self.getOpts({
                        oid: sha,
                    })
                ).then(function (obj) {
                    if (!self.trees) {
                        self.trees = {};
                        self.trees["!oid"] = obj.commit.tree;
                        self.trees["!isDir"] = true;
                    }
                    cb();
                }, cb);
            }, cb);
        };
        this.readFile = function (path, opts, cb) {
            var self = this;
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var enc = !opts || typeof opts == "string" ? opts : opts.encoding;
            var segments = self.toSegments(path);
            this.resolveTree(segments.slice(0, -1), function (e, tree) {
                if (e) return cb(e);
                var file = tree[segments.pop()];
                if (!file) {
                    return cb(
                        createError({
                            code: "ENOENT",
                        })
                    );
                } else if (file["!isDir"]) {
                    return cb(
                        createError({
                            code: "EISDIR",
                        })
                    );
                }
                return git
                    .readBlob(
                        self.getOpts({
                            oid: file["!oid"],
                        })
                    )
                    .then(function (t) {
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
            });
        };
        this.resolveTree = function (segments, cb, from) {
            var self = this;
            if (!from) {
                if (this.trees) {
                    from = this.trees;
                } else {
                    //read commit object
                    return this.resolve(function (e) {
                        if (e) cb(e);
                        else {
                            from = self.trees;
                            self.resolveTree(segments, cb);
                        }
                    });
                }
            }

            if (from["!loaded"]) {
                if (!segments.length) {
                    if (!from["!isDir"]) {
                        return cb(
                            createError({
                                code: "ENOTDIR",
                            })
                        );
                    }
                    return cb(null, from);
                }
                from = from[segments.shift()];
                if (!from) {
                    return cb(
                        createError({
                            code: "ENOENT",
                        })
                    );
                }
                return this.resolveTree(segments, cb, from);
            }
            git.readTree(
                self.getOpts({
                    oid: from["!oid"],
                })
            ).then(function (res) {
                if (!from["!loaded"]) {
                    for (var i = 0; i < res.tree.length; i++) {
                        from[res.tree[i].path] = {
                            "!oid": res.tree[i].oid,
                            "!isDir": res.tree[i].type == "tree",
                        };
                    }
                    from["!loaded"] = true;
                }
                if (!from) {
                    return cb(
                        createError({
                            code: "ENOENT",
                        })
                    );
                }
                self.resolveTree(segments, cb, from);
            }, cb);
        };

        this.readdir = function (path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var segments = this.toSegments(path);
            this.resolveTree(segments, function (e, tree) {
                if (e) cb(e);
                else
                    cb(
                        null,
                        Object.keys(tree).filter(function (i) {
                            return (
                                i != "!oid" && i != "!isDir" && i != "!loaded"
                            );
                        })
                    );
            });
        };
        this.getFiles = function (path, cb) {
            var segments = this.toSegments(path);
            var self = this;
            this.readdir(path, function (e, res) {
                if (e) return cb(e);
                var cache = self.trees;
                while (segments.length) {
                    cache = cache[segments.shift()];
                }
                cb(
                    null,
                    res.map(function (e) {
                        if (cache[e]["!isDir"]) {
                            return e + "/";
                        }
                        return e;
                    })
                );
            });
        };
        this.stat = this.lstat = function (path, opts, cb) {
            var self = this;
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var segments = self.toSegments(path);
            this.resolveTree(segments.slice(0, -1), function (e, tree) {
                if (e) cb(e);
                else {
                    var file = tree[segments.pop()];
                    if (!file) {
                        return cb(
                            createError({
                                code: "ENOENT",
                            })
                        );
                    }
                    return cb(
                        null,
                        require("grace/core/file_utils").FileUtils.createStats({
                            type: file["!isDir"] ? "dir" : "file",
                        })
                    );
                }
            });
        };

        this.href = null;
        this.toSegments = function (path) {
            path = clean(normalize(path));
            if (path[0] == "/") {
                path = relative(this.getRoot(), path);
            }
            return path ? path.split("/") : [];
        };

        this.getDisk = function () {
            return this.ref;
        };
        this.getRoot = function () {
            return "/" + this.ref;
        };

        this.writeFile = this.copyFile = this.moveFile = this.mkdir = this.rename = this.delete = this.rmdir = this.unlink = this.symlink = function () {
            var cb = arguments[arguments.length - 1];
            cb(
                createError({
                    code: "UNSUPORTED",
                    message:
                        "This operation is not supported on a readonly file system",
                })
            );
        };
    }.apply(GitFileServer.prototype));
    exports.GitFileServer = GitFileServer;
    require("grace/core/file_utils").FileUtils.registerFsExtension(
        "!gitfs",
        null,
        function (opts) {
            opts["!requireURL"] = "grace/ext/git/git_fs";
            return new GitFileServer(opts);
        },
        null
    );
}); /*_EndDefine*/