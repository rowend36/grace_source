_Define(function(global) {
    "use strict";
    var TAG = "Application";
    if (!window[TAG]) return;
    var app = window[TAG];
    var handler = {};
    window[TAG] = handler;
    var accessKey = app.requestAccessKey();
    var config = global.registerAll({
        "runInNewProcess": false
    }, "execute");
    var request = global.request;
    var requestBuffer = global.requestBuffer;
    var appStorage = global.appStorage;
    var appEvents = global.AppEvents;
    var FileUtils = global.FileUtils;
    var normalizeEncoding = FileUtils.normalizeEncoding;
    var setImmediate = global.Utils.setImmediate;
    //requires Docs addDoc
    Env.isWebView = true;
    Env.isLocalHost = false;
    Env._server = null;
    Env.canLocalHost = true;
    Env.newWindow = function(path) {
        global.Docs.tempSave();
        appStorage.__doSync && appStorage.__doSync();
        app.runFile(path, config.runInNewProcess, accessKey);
    };
    handler._onNewIntent = function(inte) {
        var intent = JSON.parse(inte);
        app._intent = intent;
        global.addDoc(intent.name || "", intent.value || "", intent.path || "");
    };
    handler._pause = function() {
        window.blur();
        appEvents.trigger('app-paused');
        appStorage.__doSync && appStorage.__doSync();
    };
    handler._resume = function() {
        //if(window.Grace && window.Grace.loaded)
        appEvents.trigger('app-resumed');
    };
    handler._notifyIntent = function() {
        appEvents.on("app-loaded", function() {
            var intent = app.getIntent(accessKey);
            if (intent) {
                global.Notify.info('Loading file..');
                handler._onNewIntent(intent);
            }
        });
    };
    handler._notifyIntent();
    function isString(str) {
        return str.charAt;
    }
    handler._callbacks = {
        0: function(e) {
            if (e) console.error(e);
        }
    };
    var count = 0;

    function createCallback(func) {
        var c = handler._callbacks;
        if (!func) return 0;
        var id = ++count;
        while (c[id]) {
            id = ++count;
        }
        c[id] = function(err, res) {
            delete c[id];
            if (err) {
                err = toNodeError(err);
            }
            func(err, res);
        };
        return id;
    }
    handler.createCallback = function(func) {
        var c = handler._callbacks;
        if (!func) return 0;
        var id = ++count;
        while (c[id]) {
            id = ++count;
        }
        c[id] = func;
        return id;
    };
    handler.clearCallback = function(id) {
        delete handler._callbacks[id];
    };

    function clearLastCallback(err) {
        var c = handler._callbacks;
        var app_e = app.getError(accessKey);
        var error = app_e || err.message;
        if (c[count]) {
            c[count](error);
        }
    }

    function jsonCallback(cb) {
        return function(e, res) {
            if (!e) cb(e, JSON.parse(res));
            else cb(e, null);
        };
    }

    function encodeBufferToBytes(buffer) {
        var res = Base64.encode(new Uint8Array(buffer.buffer || buffer));
        return res;
    }

    function decodeBytesToBuffer(base64) {
        var res = Base64.decode(base64);
        return res;
    }

    function asyncify(app, func, baseIndex) {
        return function() {
            var callback, index = arguments.length - 1;
            while (index >= baseIndex) {
                callback = arguments[index];
                if (callback && typeof(callback) == "function") {
                    break;
                } else callback = null;
                index--;
            }
            var result, error;
            try {
                result = func.apply(app, callback ? Array.prototype.splice.apply(arguments, [0, index]) : arguments);
            } catch (e) {
                error = e;
            }
            if (callback) {
                setImmediate(function() {
                    callback(error, result);
                });
            }
        };
    }
    var errors = {
        "is a directory": 'EISDIR',
        "already exists": "EEXIST",
        "not empty": "ENOTEMPTY",
        "is not a directory": 'ENOTDIR',
        "too large": 'ETOOLARGE',
        "Unknown encoding": 'ENOTENCODING',
        "does not exist": "ENOENT",
        "Operation failed": "EACCES",
        "System Busy": "EMFILE",
        " can not be null": "ENULLVALUE",
        "Resource closed": "ECLOSED",
        "FileNotFoundException": 'ENOENT',
        "AccessDeniedException": "EACCES",
        "DirectoryNotEmptyException": "ENOTEMEPTY",
        "FileAlreadyExistsException": "EEXIST",
        "NoSuchFileException": "ENOENT",
        "NotDirectoryException": "ENOTDIR",
    };

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
            console.debug("Unknown error", err.origin);
            err.code = err.message = 'EUNKNOWN';
        }
        return err;
    }

    function throwError(err) {
        var app_e = app.getError(accessKey);
        var error = app_e ? toNodeError(app_e) : err;
        throw error;
    }

    function ReadableStream(fd) {
        this.close = function() {
            app.closeReadableStream(fd, accessKey);
        };
        this.read = function(cb) {
            count++;
            try {
                app.readStreamAsync(fd, createCallback(cb && function(e, res) {
                    if (!e) {
                        if (res) res = decodeBytesToBuffer(res);
                        else res = null;
                    }
                    cb(e, res);
                }), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.readSync = function() {
            try {
                var res = app.readStream(fd, accessKey);
                if (res) res = decodeBytesToBuffer(res);
                else res = null;
                return res;
            } catch (err) {
                throwError(err);
            }
        };
    }

    function WritableStream(fd) {
        this.close = function() {
            app.closeWritableStream(fd, accessKey);
        };
        this.write = function(data, cb) {
            count++;
            try {
                app.writeStreamAsync(fd, encodeBufferToBytes(data), createCallback(cb), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.writeSync = function(data) {
            try {
                return app.writeStream(fd, encodeBufferToBytes(data), accessKey);
            } catch (err) {
                throwError(err);
            }
        };
    }
    var AppFileServer = function(path) {
        if (!path) path = "/sdcard/";
        this.openReadableStream = function(path) {
            return new ReadableStream(app.openReadableStream(path, accessKey));
        };
        this.openWritableStream = function(path) {
            return new WritableStream(app.openWritableStream(path, accessKey));
        };
        this.readFileSync = function(path, opts) {
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
                throwError(err);
            }
        };
        this.writeFileSync = function(path, content, opts) {
            try {
                var encoding;
                if (opts) {
                    if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (FileUtils.isBuffer(content)) {
                    content = encodeBufferToBytes(content);
                    return app.saveBytes(path, content, accessKey);
                } else return app.saveFile(path, content, encoding || 'utf-8', accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.readdirSync = function(path) {
            try {
                return JSON.parse(app.getFiles(path, accessKey)).map(FileUtils.removeTrailingSlash);
            } catch (err) {
                throwError(err);
            }
        };
        this.statSync = function(path, isLstat) {
            try {
                return FileUtils.createStats(JSON.parse(app.stat(path, !!isLstat, accessKey)));
            } catch (err) {
                throwError(err);
            }
        };
        this.lstatSync = function(path) {
            return this.statSync(path, true);
        };
        this.copyFileSync = function(path, dest, overwrite) {
            try {
                return app.copyFile(path, dest, overwrite, accessKey);
            } catch (err) {
                throwError(error);
            }
        };
        this.moveFileSync = function(path, dest, overwrite) {
            try {
                return app.moveFile(path, dest, overwrite, accessKey);
            } catch (err) {
                throwError(error);
            }
        };
        this.mkdirSync = function(path, opts) {
            try {
                return app.newFolder(path, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.renameSync = function(path, dest) {
            try {
                return app.rename(path, dest, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        var deleteSync = function(path) {
            try {
                return app.delete(path, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.unlinkSync = this.rmdirSync = deleteSync;
        this.readFile = function(path, opts, callback) {
            var encoding;
            if (opts) {
                if (!callback && typeof(opts) == "function") {
                    callback = opts;
                } else if (isString(opts)) encoding = opts;
                else encoding = opts.encoding;
            }
            if (encoding && normalizeEncoding(encoding) !== "utf8") {
                count++; //for clearLastCallback
                try {
                    app.getFileAsync(path, encoding, createCallback(callback), accessKey);
                } catch (err) {
                    clearLastCallback(err);
                }
                return;
            }
            (encoding ? request : requestBuffer)(this.href + path, path, function(e, r) {
                if (!e) return callback(null, r);
                var stat;
                try {
                    stat = this.statSync(path);
                } catch (err) {
                    return callback(err);
                }
                if (stat.type == "dir") {
                    return callback({
                        code: "EISDIR",
                        message: "EISDIR"
                    });
                }
                if (encoding) {
                    app.getFileAsync(path, encoding, createCallback(callback), accessKey);
                } else {
                    count++;
                    try {
                        app.getBytesAsync(path, createCallback(callback && function(e, r) {
                            if (!e) r = decodeBytesToBuffer(r);
                            callback(e, r);
                        }), accessKey);
                    } catch (err) {
                        clearLastCallback(err);
                    }
                }
            }.bind(this), 3, 3);
        };
        this.writeFile = function(path, content, opts, callback) {
            count++;
            try {
                var encoding;
                if (opts) {
                    if (!callback && typeof(opts) == "function") {
                        callback = opts;
                    } else if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (FileUtils.isBuffer(content)) {
                    content = encodeBufferToBytes(content);
                    app.saveBytesAsync(path, content, createCallback(callback), accessKey);
                } else app.saveFileAsync(path, content, encoding || "utf-8", createCallback(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.getFiles = function(path, opts, callback) {
            count++;
            try {
                if (opts) {
                    if (!callback && typeof(opts) == "function") {
                        callback = opts;
                    }
                }
                var res = app.getFilesAsync(path, createCallback(callback ? jsonCallback(callback) : null),
                    accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.readdir = function(path, opts, callback) {
            if (opts) {
                if (!callback && typeof(opts) == "function") {
                    callback = opts;
                }
            }
            this.getFiles(path, callback && function(e, r) {
                callback && callback(e, r && r.map(FileUtils.removeTrailingSlash));
            });
        }
        this.stat = asyncify(this, this.statSync, 1);
        this.lstat = asyncify(this, this.lstatSync, 1);
        this.copyFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.copyFileAsync(path, dest, !!overwrite, createCallback(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.moveFileAsync(path, dest, !!overwrite, createCallback(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.mkdir = asyncify(this, this.mkdirSync, 1);
        this.rename = asyncify(this, this.renameSync, 2);
        this.unlink = this.rmdir = this.delete = asyncify(this, deleteSync, 1);
        this.fastGetOid = function(path, callback) {
            count++;
            try {
                app.getGitBlobIdAsync(path, createCallback(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.href = "file://";
        this.isEncoding = function(encoding) {
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings.map(normalizeEncoding).indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function() {
            try {
                return this.encodings || (this.encodings = JSON.parse(app.getEncodings(accessKey)));
            } catch (err) {
                throwError(err);
            }
        };
        this.getDisk = function() {
            return "local";
        };
        this.getRoot = function() {
            return path;
        };
        this.symlinkSync = function(path, dest) {
            try {
                return app.symlink(path, dest, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.readlinkSync = function(path) {
            try {
                return app.readlink(path, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.symlink = asyncify(this, this.symlinkSync, 1);
        this.readlink = asyncify(this, this.readlinkSync, 1);
    };
    FileUtils.registerFileServer('application', "Default FileSystem", function(conf) {
        return (window.afs = new AppFileServer(conf && conf.root));
    }, [{
        name: "root",
        caption: "Root Directory",
        value: '/sdcard/',
        type: "text"
    }]);
}); /*_EndDefine*/