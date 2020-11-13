(function(global) {
    "use strict";
    var TAG = "Application";
    if (!window[TAG]) return;
    var app = window[TAG];
    var handler = {};
    window[TAG] = handler;
    var accessKey = app.requestAccessKey();
    var appStorage = global.appStorage;
    var appEvents = global.AppEvents;
    var FileUtils = global.FileUtils;
    //requires Doc addDoc
    Env.isWebView = true;
    Env.isLocalHost = false;
    Env._server = null;
    Env.canLocalHost = true;
    Env.newWindow = function(path) {
        global.Doc.tempSave();
        appStorage.__doSync && appStorage.__doSync();
        app.runFile(path, false, accessKey);
    };
    handler._onNewIntent = function(inte) {
        var intent = JSON.parse(inte);
        app._intent = intent;
        global.addDoc(intent.name || "", intent.value || "", intent.path || "");
    };
    handler._pause = function() {
        if (window.Grace && window.Grace.loaded)
            global.Doc.tempSave();
        appStorage.__doSync && appStorage.__doSync();
    };
    handler._resume = function() {
        //if(window.Grace && window.Grace.loaded)
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
            if (e) throw e;
        }
    };
    var count = 0;

    function createCallback(func) {
        var c = handler._callbacks;
        if (!func) return 0;
        var id = count++;
        while (c[id]) {
            id = count++;
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

    function clearLastCallback(err) {
        var app_e = app.getError(accessKey);
        console.error(app_e);
        var error = app_e ? toNodeError(app_e) : err;
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
        return Base64.encode(new Uint8Array(buffer.buffer || buffer));
    }

    function decodeBytesToBuffer(base64) {
        return Base64.decode(base64);
    }

    function asyncify(app, func, baseIndex) {
        return function() {
            var callback, index = arguments.length - 1;
            while (index >= baseIndex) {
                callback = arguments[index];
                if (callback && typeof(callback) == "function") {
                    break;
                }
                else callback = null;
                index--;
            }
            var result, error;
            try {
                result = func.apply(app, callback ? Array.prototype.splice.apply(arguments, [0, index]) : arguments);
            }
            catch (e) {
                error = e;
            }
            if (callback) {
                setTimeout(function() {
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
        "FileNotFoundException": 'ENOENT',
        "AccessDeniedException": "EACCES",
        "DirectoryNotEmptyException":"ENOTEMEPTY",
        "FileAlreadyExistsException": "EEXIST",
        "NoSuchFileException": "ENOENT",
        "NotDirectoryException": "ENOTDIR",
    };

    function toNodeError(e) {
        console.log('parse '+e);
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
        }
        else {
            console.error(new Error(e));
            err.code = err.message = 'EUNKNOWN';
        }
        console.log(code);
        return err;
    }

    function throwError(err) {
        var app_e = app.getError(accessKey);
        console.error(app_e);
        var error = app_e ? toNodeError(app_e) : err;
        throw error;
    }

    var AppFileServer = function(path) {
        if (!path) path = "/sdcard/";
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
            }
            catch (err) {
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
                }
                else return app.saveFile(path, content, encoding || 'utf-8', accessKey);
            }
            catch (err) {
                throwError(err);
            }
        };
        this.readdirSync = function(path) {
            try {
                return JSON.parse(app.getFiles(path, accessKey));
            }
            catch (err) {
                throwError(err);
            }
        };
        this.statSync = function(path, isLstat) {
            try {
                return JSON.parse(app.stat(path, !!isLstat, accessKey));
            }
            catch (err) {
                throwError(err);
            }
        };
        this.lstatSync = function(path) {
            try {
                return JSON.parse(app.stat(path, true, accessKey));
            }
            catch (err) {
                throwError(error);
            }
        };
        this.copyFileSync = function(path, dest, overwrite) {
            try {
                return app.copyFile(path, dest, overwrite, accessKey);
            }
            catch (err) {
                throwError(error);
            }
        };
        this.moveFileSync = function(path, dest, overwrite) {
            try {
                return app.moveFile(path, dest, overwrite, accessKey);
            }
            catch (err) {
                throwError(error);
            }
        };
        this.mkdirSync = function(path, opts) {
            try {
                return app.newFolder(path, accessKey);
            }
            catch (err) {
                throwError(error);
            }
        };
        this.renameSync = function(path, dest) {
            try {
                return app.rename(path, dest, accessKey);
            }
            catch (err) {
                throwError(error);
            }
        };
        var deleteSync = function(path) {
            try {
                return app.delete(path, accessKey);
            }
            catch (err) {
                throwError(error);
            }
        };
        this.unlinkSync = this.rmdirSync = deleteSync;

        this.readFile = function(path, opts, callback) {
            count++; //for clearLastCallback
            try {
                var encoding;
                if (opts) {
                    if (!callback && typeof(opts) == "function") {
                        callback = opts;
                    }
                    else if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (!encoding) {
                    var cb = callback;
                    callback = cb && function(e, res) {
                        if (e) return cb(e, res);
                        cb(e, decodeBytesToBuffer(res));
                    };
                    app.getBytesAsync(path, createCallback(callback), accessKey);
                }
                else app.getFileAsync(path, encoding, createCallback(callback), accessKey);
            }
            catch (err) {
                clearLastCallback(err);
            }
        };
        this.writeFile = function(path, content, opts, callback) {
            count++;
            try {
                var encoding;
                if (opts) {
                    if (!callback && typeof(opts) == "function") {
                        callback = opts;
                    }
                    else if (isString(opts)) encoding = opts;
                    else encoding = opts.encoding;
                }
                if (FileUtils.isBuffer(content)) {
                    content = encodeBufferToBytes(content);
                    app.saveBytesAsync(path, content, createCallback(callback), accessKey);
                }
                else app.saveFileAsync(path, content, encoding || "utf-8", createCallback(callback), accessKey);
            }
            catch (err) {
                clearLastCallback(err);
            }
        };
        this.getFiles = this.readdir = function(path, opts, callback) {
            count++;
            try {
                if (opts) {
                    if (!callback && typeof(opts) == "function") {
                        callback = opts;
                    }
                }
                var res = app.getFilesAsync(path, createCallback(callback ? jsonCallback(callback) : null), accessKey);
            }
            catch (err) {
                clearLastCallback(err);
            }
        };


        this.stat = asyncify(this, this.statSync, 1);
        this.lstat = asyncify(this, this.lstatSync, 1);

        this.copyFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.copyFileAsync(path, dest, !!overwrite, createCallback(callback), accessKey);
            }
            catch (err) {
                clearLastCallback(err);
            }
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            count++;
            try {
                app.moveFileAsync(path, dest, !!overwrite, createCallback(callback), accessKey);
            }
            catch (err) {
                clearLastCallback(err);
            }
        };

        this.mkdir = asyncify(this, this.mkdirSync, 1);
        this.rename = asyncify(this, this.renameSync, 2);
        this.unlink = this.rmdir = this.delete = asyncify(this, deleteSync, 1);


        this.href = "file://";
        this.isEncoding = function(encoding) {
            return true;
        };
        this.getEncodings = function() {
            try {
                return JSON.parse(app.getEncodings(accessKey));
            }
            catch (err) {
                throwError(err);
            }
        };
        this.getDisk = function() {
            return "local";
        };
        this.getRoot = function() {
            return path;
        };

    };
    FileUtils.registerFileServer('application', "Default FileSystem", function(conf) {
        return new AppFileServer(conf && conf.root);
    }, {
        name: "root",
        caption: "Root Directory",
        value: '/sdcard/',
        type: "text"
    });
})(Modules);