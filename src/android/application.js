_Define(function(global) {
    "use strict";
    var TAG = "Application";
    if (!window[TAG]) return;
    /*
    @type{
        //Common
        requestAccessKey : {Function}
        getCorsProxyUrl : {Function}
        getDocumentTreeUri : {Function}
        releaseDocumentTreeUri : {Function}
        getEncodings : {Function}
        getIntent : {Function}
        
        //FileSystem
        closeReadableStream : {Function}
        closeWritableStream : {Function}
        copyFile : {Function}
        copyFileAsync : {Function}
        delete : {Function}
        deleteRecursively : {Function}
        getBytes : {Function}
        getBytesAsync : {Function}
        getError : {Function}
        getFile : {Function}
        getFileAsync : {Function}
        getFiles : {Function}
        getFilesAsync : {Function}
        getGitBlobIdAsync? : {Function}
        moveFile : {Function}
        moveFileAsync : {Function}
        newFolder : {Function}
        openReadableStream : {Function}
        openWritableStream : {Function}
        readlink : {Function}
        readStream : {Function}
        readStreamAsync : {Function}
        rename : {Function}
        runFile : {Function}
        saveBytes : {Function}
        saveBytesAsync : {Function}
        saveFile : {Function}
        saveFileAsync : {Function}
        stat : {Function}
        symlink : {Function}
        writeStream : {Function}
        writeStreamAsync : {Function}
    }
    */
    var app = window[TAG];
    var docfs = window.DocumentFileSystem;
    var handler = {};
    window[TAG] = handler;
    //stops this from being used in iframes
    //provided the iframe cannot access the parent
    //window either
    var accessKey = app.requestAccessKey();
    var config = global.registerAll({
        "runInNewProcess": false,
        "runInExternalBrowser": false,
        "mockHttps": false
    }, "execute");
    global.registerValues({
        "mockHttps": "When enabled, local files use https scheme."
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
    /*
        Note on Urls:
        To be used on newer android versions
        where allowUniversalAccessFromFileUrls is deprecated,
        http://grace.androidplatform.net allows mock https,http but not file
        so when enabled, files must be accessesed through 
        http://files.android.platform.net
        And cross-origin requests must use getCorsProxyUrl
        with opts {body,method}. The method and url will be used to
        verify the actual request while the body is stored for transmission
        until later use. This method is of course likely to be superceded by
        a dedicated local server in needs be later on but the API is unlikely
        to change so we make it available first
    */
    var isUsingFileProtocol = window.location.protocol == "file";
    Env.getCorsProxyUrl = function(url, opts) {
        if (isUsingFileProtocol) return url; //this check is also duplicated on the native side
        opts = opts || {};
        var body;
        if (!opts.body) body = "";
        else if (FileUtils.isBuffer(opts.body)) {
            body = Base64.encode(opts.body);
        } else body = btoa(opts.body);
        return app.getCorsProxyUrl(url, opts.method || '', body, accessKey);
    };
    Env.newWindow = function(path) {
        global.Docs.tempSave();
        appStorage.__doSync && appStorage.__doSync();
        app.runFile(path, config.runInExternalBrowser ? "browser" : config.runInNewProcess ? "process" :
            "webview", accessKey);
    };
    handler._onNewIntent = function(inte) {
        var intent = JSON.parse(inte);
        if (intent.path) {
            var dir = FileUtils.dirname(intent.path);
            if (dir) FileUtils.addToRecents(dir);
        }
        if (intent.hasOwnProperty('value')) {
            global.addDoc(intent.name || "", intent.value || "", intent.path || "");
        } else if (intent.path)
            FileUtils.openIntent(intent);
    };
    handler._pause = function() {
        appEvents.trigger('app-paused');
        appStorage.__doSync && appStorage.__doSync();
    };
    handler._resume = function() {
        setTimeout(window.blur.bind(window), 50);
        //if(window.Grace && window.Grace.loaded)
        appEvents.trigger('app-resumed');
    };
    handler._notifyIntent = function() {
        appEvents.on("app-loaded", function() {
            var intent = app.getIntent(accessKey);
            if (intent) {
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

    function bindOnce(func) {
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
                result = func.apply(app, callback ? Array.prototype.splice.apply(arguments, [0, index]) :
                    arguments);
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

    function ReadableStream(app, accessKey, fd) {
        this.close = function() {
            app.closeReadableStream(fd, accessKey);
        };
        this.read = function(cb) {
            count++;
            try {
                app.readStreamAsync(fd, bindOnce(cb && function(e, res) {
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

    function WritableStream(app, accessKey, fd) {
        this.close = function() {
            app.closeWritableStream(fd, accessKey);
        };
        this.write = function(data, cb) {
            count++;
            try {
                app.writeStreamAsync(fd, encodeBufferToBytes(data), bindOnce(cb), accessKey);
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


    function AndroidFs(app, accessKey) {
        this.openReadableStream = function(path) {
            return new ReadableStream(app, accessKey, app.openReadableStream(path, accessKey));
        };
        this.openWritableStream = function(path) {
            return new WritableStream(app, accessKey, app.openWritableStream(path, accessKey));
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
        this.statSync = function(path, opts) {
            var isLstat = (opts === true || (opts && opts.isLstat));
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
                throwError(err);
            }
        };
        this.moveFileSync = function(path, dest, overwrite) {
            try {
                return app.moveFile(path, dest, overwrite, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.mkdirSync = function(path) {
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
                return app.deleteRecursively(path, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.unlinkSync = this.rmdirSync = function(path) {
            try {
                return app.delete(path, accessKey);
            } catch (err) {
                throwError(err);
            }
        };
        this.readFile = function(path, opts, callback) {
            var encoding;
            if (opts) {
                if (!callback && typeof(opts) == "function") {
                    callback = opts;
                } else if (isString(opts)) encoding = opts;
                else encoding = opts.encoding;
            }
            if (!this.fileAccessPrefix || encoding && normalizeEncoding(encoding) !== "utf8") {
                return this.readFile2(path, encoding, callback);
            }
            (encoding ? request : requestBuffer)(this.fileAccessPrefix + path, {
                path: path
            }, function(e, r) {
                if (!e) return callback(null, r);
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
            }.bind(this), 3, 3);
        };
        this.readFile2 = function(path, encoding, callback) {
            if (encoding) {
                app.getFileAsync(path, encoding, bindOnce(callback), accessKey);
            } else {
                count++;
                try {
                    app.getBytesAsync(path, bindOnce(callback && function(e, r) {
                        if (!e) r = decodeBytesToBuffer(r);
                        callback(e, r);
                    }), accessKey);
                } catch (err) {
                    clearLastCallback(err);
                }
            }
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
                    app.saveBytesAsync(path, content, bindOnce(callback), accessKey);
                } else app.saveFileAsync(path, content, encoding || "utf-8", bindOnce(callback),
                    accessKey);
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
                app.getFilesAsync(path, bindOnce(callback ? jsonCallback(callback) : null),
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
        };
        this.stat = asyncify(this, this.statSync, 1);
        this.lstat = asyncify(this, this.lstatSync, 1);
        this.copyFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.copyFileAsync(path, dest, !!overwrite, bindOnce(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.moveFileAsync(path, dest, !!overwrite, bindOnce(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        this.mkdir = asyncify(this, this.mkdirSync, 1);
        this.rename = asyncify(this, this.renameSync, 2);
        this.unlink = this.rmdir = asyncify(this, this.unlinkSync, 1);
        this.delete = asyncify(this, deleteSync, 1);
        this.$gitBlobOid = function(path, callback) {
            count++;
            try {
                app.getGitBlobIdAsync(path, bindOnce(callback), accessKey);
            } catch (err) {
                clearLastCallback(err);
            }
        };
        Object.defineProperty(this, 'href', {
            get: function() {
                return isUsingFileProtocol ? "file://" : (config.mockHttps ? "https" : "http") + "://files.androidplatform.net/";
            }
        });
        this.isEncoding = function(e) {
            var encodings = this.getEncodings();
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
            return this.disk;
        };
        this.getRoot = function() {
            return this.root;
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
    }

    function AppFileServer(path) {
        this.root = path || "/sdcard/";
        this.disk = "local";
        this.fileAccessPrefix = isUsingFileProtocol ? "file://" : "http://grace.androidplatform.net/root/";
    }
    AppFileServer.prototype = new AndroidFs(app, accessKey);


    FileUtils.registerFileServer('application', "Default FileSystem", function(conf) {
        return (window.afs = new AppFileServer(conf && conf.root));
    }, [{
        name: "root",
        caption: "Root Directory",
        value: '/storage/emulated/0/',
        type: "text"
    }], true);
    if (docfs) {
        var DocumentFs = function DocumentFs(uri) {
            this.root = "/" + uri + "/root_directory/";
            this.disk = uri;
            AndroidFs.call(this, docfs, accessKey);
        };
        DocumentFs.prototype.destroy = function() {
            app.releaseDocumentTreeUri(this.disk, accessKey);
        };
        FileUtils.registerFileServer('doctree', "Open Directory", function(conf) {
            var fs;
            if (conf.id) {
                var uri = appStorage.getItem("uri:" + conf.id);
                fs = new DocumentFs(uri);
                return fs;
            } else {
                var id = conf.id = global.Utils.genID("s");
                var stub = new global.StubFileServer(function() {
                    return fs;
                });
                stub.id = id;
                app.getDocumentTreeUri(bindOnce(function(uri) {
                    fs = new DocumentFs(uri);
                    fs.id = id;
                    appStorage.setItem(id, "uri:" + conf.id);
                    stub.$inject();
                }), accessKey);
                return stub;
            }
        });
    }
}); /*_EndDefine*/