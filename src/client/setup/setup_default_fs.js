define(function (require, exports, module) {
    var FileUtils = require("../core/file_utils").FileUtils;
    var BaseFs = require("../core/file_servers").BaseFs;
    var StubFileServer = require("../core/file_servers").StubFileServer;
    //lightningfs

    var InAppFileServer;
    var noop = require("../core/utils").Utils.noop;

    var LightningFS;

    function initBrowserFs() {
        if (InAppFileServer) return InAppFileServer;
        var fs = InAppFileServer;
        if (LightningFS) {
            var isApp = Env.isWebView;
            fs = InAppFileServer = new LightningFS(isApp ? "grace_app" : "grace");
            //No worker will be using it anytime soon
            //And we want to be able to use storage
            //even when quota is exhausted
            //todo make this less of a hack
            fs.promises._initPromise.then(function () {
                if (isApp) {
                    fs.promises._mutex = {
                        _has: true,
                        has: function () {
                            return this._has;
                        },
                        acquire: function () {
                            this._has = true;
                            return true;
                        },
                        wait: noop,
                        release: function () {
                            this._has = false;
                            return true;
                        },
                        _keepAlive: function () {
                            this._keepAliveTimeout = true;
                        },
                        _stopKeepAlive: function () {
                            if (this._keepAliveTimeout) {
                                this._keepAliveTimeout = null;
                            }
                        },
                    };
                    fs.promises._deactivate = noop;
                }
                var read = fs.readFile;
                fs.readFile = function (path, opts, cb) {
                    if (typeof opts == "function") {
                        cb = opts;
                        opts = {};
                    }
                    read.call(fs, path, opts, function (e, i) {
                        if (!e && i === undefined) {
                            cb(
                                require("../core/config").createError({
                                    code: "EISDIR",
                                })
                            );
                        } else cb(e, i);
                    });
                };
            });
            BaseFs.call(fs);
        } else {
            fs = new StubFileServer(initBrowserFs);
            fs.load = require("../core/depend").define(function (cb) {
                require(["../libs/js/lightning-fs.min.js"], function (lfs) {
                    LightningFS = lfs;
                    cb();
                    fs.$inject();
                });
            }, noop);
        }
        fs.icon = "memory";
        fs.id = "inApp";
        fs.isCached = true;
        return fs;
    }
    FileUtils.registerFileServer("inApp", "In-Memory FileSystem", initBrowserFs, null, true);
});