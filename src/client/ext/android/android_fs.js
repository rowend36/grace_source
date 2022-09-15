define(function (require, exports, module) {
    "use strict";
    /*globals Base64*/
    require("grace/libs/js/base64");
    var handler = require("./callback_handler").callbackHandler;
    var ajax = require("grace/core/ajax").ajax;

    var FileUtils = require("grace/core/file_utils").FileUtils;
    var normalizeEncoding = FileUtils.normalizeEncoding;
    var setImmediate = require("grace/core/utils").Utils.setImmediate;

    function decodeBytesToBuffer(base64) {
        var res = Base64.decode(base64);
        return res;
    }

    function encodeBufferToBytes(buffer) {
        var res = Base64.encode(new Uint8Array(buffer.buffer || buffer));
        return res;
    }

    function isString(str) {
        return str.charAt;
    }

    function jsonCallback(cb) {
        return function (e, res) {
            if (!e) cb(e, JSON.parse(res));
            else cb(e, null);
        };
    }

    function asyncify(app, func, baseIndex) {
        return function () {
            var callback,
                index = arguments.length - 1;
            while (index >= baseIndex) {
                callback = arguments[index];
                if (callback && typeof callback == "function") {
                    break;
                } else callback = null;
                index--;
            }
            var result, error;
            try {
                result = func.apply(
                    app,
                    callback
                        ? Array.prototype.slice.apply(arguments, [0, index])
                        : arguments
                );
            } catch (e) {
                error = e;
            }
            if (callback) {
                setImmediate(function () {
                    callback(error, result);
                });
            }
        };
    }
    var errors = {
        "is a directory": "EISDIR",
        "already exists": "EEXIST",
        "not empty": "ENOTEMPTY",
        "is not a directory": "ENOTDIR",
        "too large": "ETOOLARGE",
        "Unknown encoding": "ENOTENCODING",
        "does not exist": "ENOENT",
        "Operation failed": "EACCES",
        "System Busy": "EMFILE",
        " can not be null": "ENULLVALUE",
        "Resource closed": "ECLOSED",
        FileNotFoundException: "ENOENT",
        AccessDeniedException: "EACCES",
        DirectoryNotEmptyException: "ENOTEMEPTY",
        FileAlreadyExistsException: "EEXIST",
        NoSuchFileException: "ENOENT",
        NotDirectoryException: "ENOTDIR",
    };

    function bindOnce(app, func) {
        if (!func) return 0;
        var id = handler.createCallback(function (err, res) {
            handler.clearCallback(id);
            if (err) {
                err = toNodeError(err);
            }
            func(err, res);
        });
        return id;
    }

    function throwError(app, accessKey, err) {
        var app_e = app.getError(accessKey);
        var error = app_e ? toNodeError(app_e) : err;
        throw error;
    }

    function toNodeError(e) {
        var code;
        var err = new Error();
        err.origin = e;
        for (var i in errors) {
            if (e.indexOf(i) > -1) {
                code = errors[i];
                break;
            }
        }
        if (code) {
            err.code = err.message = code;
        } else {
            console.log("Unknown error", err.origin);
            err.code = err.message = "EUNKNOWN";
        }
        return err;
    }

    function ReadableStream(app, accessKey, fd) {
        this.close = function () {
            app.closeReadableStream(fd, accessKey);
        };
        this.read = function (cb) {
            app.try(function () {
                app.readStreamAsync(
                    fd,
                    bindOnce(
                        app,
                        cb &&
                            function (e, res) {
                                if (!e) {
                                    if (res) res = decodeBytesToBuffer(res);
                                    else res = null;
                                }
                                cb(e, res);
                            }
                    ),
                    accessKey
                );
            });
        };
        this.readSync = function () {
            try {
                var res = app.readStream(fd, accessKey);
                if (res) res = decodeBytesToBuffer(res);
                else res = null;
                return res;
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
    }

    function WritableStream(app, accessKey, fd) {
        this.close = function () {
            app.closeWritableStream(fd, accessKey);
        };
        this.write = function (data, cb) {
            app.try(function () {
                app.writeStreamAsync(
                    fd,
                    encodeBufferToBytes(data),
                    bindOnce(app, cb),
                    accessKey
                );
            });
        };
        this.writeSync = function (data) {
            try {
                return app.writeStream(
                    fd,
                    encodeBufferToBytes(data),
                    accessKey
                );
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
    }

    function AndroidFs(app, accessKey) {
        this.requestFileSystem = function (cb) {
            app.getDocumentTreeUri(bindOnce(app, cb));
        };
        this.openReadableStream = function (path) {
            return new ReadableStream(
                app,
                accessKey,
                app.openReadableStream(path, accessKey)
            );
        };
        this.openWritableStream = function (path) {
            return new WritableStream(
                app,
                accessKey,
                app.openWritableStream(path, accessKey)
            );
        };
        this.readFileSync = function (path, opts) {
            try {
                var encoding;
                if (opts) {
                    if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (!encoding) {
                    var data = app.getBytes(path, accessKey);
                    return decodeBytesToBuffer(data);
                }
                return app.getFile(path, encoding, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.writeFileSync = function (path, content, opts) {
            try {
                var encoding;
                if (opts) {
                    if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (FileUtils.isBuffer(content)) {
                    content = encodeBufferToBytes(content);
                    return app.saveBytes(path, content, accessKey);
                } else
                    return app.saveFile(
                        path,
                        content,
                        encoding || "utf-8",
                        accessKey
                    );
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.readdirSync = function (path) {
            try {
                return JSON.parse(app.getFiles(path, accessKey)).map(
                    FileUtils.removeTrailingSlash
                );
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.statSync = function (path, opts) {
            var isLstat = opts === true || (opts && opts.isLstat);
            try {
                return FileUtils.createStats(
                    JSON.parse(app.stat(path, !!isLstat, accessKey))
                );
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.lstatSync = function (path) {
            return this.statSync(path, true);
        };
        this.copyFileSync = function (path, dest, overwrite) {
            try {
                return app.copyFile(path, dest, overwrite, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.moveFileSync = function (path, dest, overwrite) {
            try {
                return app.moveFile(path, dest, overwrite, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.mkdirSync = function (path) {
            try {
                return app.newFolder(path, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.renameSync = function (path, dest) {
            try {
                return app.rename(path, dest, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        var deleteSync = function (path) {
            try {
                return app.deleteRecursively(path, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.unlinkSync = this.rmdirSync = function (path) {
            try {
                return app.delete(path, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.readFile = function (path, opts, callback) {
            var encoding;
            if (opts) {
                if (!callback && typeof opts == "function") {
                    callback = opts;
                } else if (isString(opts)) encoding = opts;
                else encoding = opts.encoding;
            }
            if (
                !this.fileAccessPrefix ||
                (encoding && normalizeEncoding(encoding) !== "utf8")
            ) {
                return this.readFile2(path, encoding, callback);
            }
            ajax(this.fileAccessPrefix + path, {
                // data: {
                //     path: path
                // },
                responseType: encoding ? "text" : "arraybuffer",
                retryCount: 3,
            }).then(
                callback.bind(null, null),
                function () {
                    var stat;
                    try {
                        stat = this.statSync(path);
                    } catch (err) {
                        return callback(err);
                    }
                    if (stat.type == "dir") {
                        return callback(toNodeError("is a directory"));
                    }
                    this.readFile2(path, encoding, callback);
                }.bind(this)
            );
        };
        this.readFile2 = function (path, encoding, callback) {
            if (encoding) {
                app.getFileAsync(
                    path,
                    encoding,
                    bindOnce(app, callback),
                    accessKey
                );
            } else {
                app.try(function () {
                    app.getBytesAsync(
                        path,
                        bindOnce(
                            app,
                            callback &&
                                function (e, r) {
                                    if (!e) r = decodeBytesToBuffer(r);
                                    callback(e, r);
                                }
                        ),
                        accessKey
                    );
                });
            }
        };
        this.writeFile = function (path, content, opts, callback) {
            app.try(function () {
                var encoding;
                if (opts) {
                    if (!callback && typeof opts == "function") {
                        callback = opts;
                    } else if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (FileUtils.isBuffer(content)) {
                    content = encodeBufferToBytes(content);
                    app.saveBytesAsync(
                        path,
                        content,
                        bindOnce(app, callback),
                        accessKey
                    );
                } else app.saveFileAsync(path, content, encoding || "utf-8", bindOnce(app, callback), accessKey);
            });
        };
        this.getFiles = function (path, opts, callback) {
            app.try(function () {
                if (opts) {
                    if (!callback && typeof opts == "function") {
                        callback = opts;
                    }
                }
                app.getFilesAsync(
                    path,
                    bindOnce(app, callback ? jsonCallback(callback) : null),
                    accessKey
                );
            });
        };
        this.readdir = function (path, opts, callback) {
            if (opts) {
                if (!callback && typeof opts == "function") {
                    callback = opts;
                }
            }
            this.getFiles(
                path,
                callback &&
                    function (e, r) {
                        callback &&
                            callback(
                                e,
                                r && r.map(FileUtils.removeTrailingSlash)
                            );
                    }
            );
        };
        this.stat = asyncify(this, this.statSync, 1);
        this.lstat = asyncify(this, this.lstatSync, 1);
        this.copyFile = function (path, dest, callback, overwrite) {
            app.try(function () {
                app.copyFileAsync(
                    path,
                    dest,
                    !!overwrite,
                    bindOnce(app, callback),
                    accessKey
                );
            });
        };
        this.moveFile = function (path, dest, callback, overwrite) {
            app.try(function () {
                app.moveFileAsync(
                    path,
                    dest,
                    !!overwrite,
                    bindOnce(app, callback),
                    accessKey
                );
            });
        };
        this.mkdir = asyncify(this, this.mkdirSync, 1);
        this.rename = asyncify(this, this.renameSync, 2);
        this.unlink = this.rmdir = asyncify(this, this.unlinkSync, 1);
        this.delete = asyncify(this, deleteSync, 1);
        this.$gitBlobOid = function (path, callback) {
            app.try(function () {
                app.getGitBlobIdAsync(path, bindOnce(app, callback), accessKey);
            });
        };
        this.isEncoding = function (e) {
            var encodings = this.getEncodings();
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings
                .map(normalizeEncoding)
                .indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function () {
            try {
                return (
                    this.encodings ||
                    (this.encodings = JSON.parse(app.getEncodings(accessKey)))
                );
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.getDisk = function () {
            return this.disk;
        };
        this.getRoot = function () {
            return this.root;
        };
        this.symlinkSync = function (path, dest) {
            try {
                return app.symlink(path, dest, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.readlinkSync = function (path) {
            try {
                return app.readlink(path, accessKey);
            } catch (err) {
                throwError(app, accessKey, err);
            }
        };
        this.symlink = asyncify(this, this.symlinkSync, 1);
        this.readlink = asyncify(this, this.readlinkSync, 1);
    }
    require(["./android_git"]);
    exports.AndroidFs = AndroidFs;
});