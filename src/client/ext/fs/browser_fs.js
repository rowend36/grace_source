define(function (require, exports, module) {
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var BaseFs = require('grace/core/base_fs').BaseFs;
    var setImmediate = require('grace/core/utils').Utils.setImmediate;
    var StubFileServer = require('grace/core/register_fs_extension')
        .StubFileServer;
    //lightningfs

    var BrowserFileServer;
    var noop = require('grace/core/utils').Utils.noop;

    var LightningFS;

    function initBrowserFs() {
        if (BrowserFileServer) return BrowserFileServer;
        var fs = BrowserFileServer;
        if (LightningFS) {
            var isApp = Env.isWebView;
            fs = BrowserFileServer = new LightningFS(
                isApp ? 'grace_app' : 'grace'
            );
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
                    if (typeof opts == 'function') {
                        cb = opts;
                        opts = {};
                    }
                    read.call(fs, path, opts, function (e, i) {
                        try {
                            if (!e && i === undefined) {
                                cb(
                                    FileUtils.createError({
                                        code: 'EISDIR',
                                    })
                                );
                            } else cb(e, i);
                        } catch (e) {
                            setImmediate(function () {
                                throw e;
                            });
                        }
                    });
                };
                //LightningFS does not throw errors, patch our most used methods
                [
                    'lstat',
                    'readFile',
                    'writeFile',
                    'readdir',
                    'stat',
                    'mkdir',
                    'unlink',
                    'rmdir',
                    'rename',
                ].forEach(function (e) {
                    var o = fs[e];
                    fs[e] = function () {
                        var a = arguments,
                            cb = a[a.length - 1];
                        if (cb && typeof cb === 'function') {
                            a[a.length - 1] = function (e, r) {
                                try {
                                    cb(e, r);
                                } catch (e) {
                                    setImmediate(function () {
                                        throw e;
                                    });
                                }
                            };
                        }
                        o.apply(this, a);
                    };
                });
            });
            BaseFs.call(fs);
        } else {
            fs = new StubFileServer(initBrowserFs);
            fs.load = require('grace/core/depend').after(function (cb) {
                require(['./libs/lightning-fs.min.js'], function (lfs) {
                    cb();
                    LightningFS = lfs;
                    fs.$inject();
                });
            }, noop);
        }
        fs.icon = 'memory';
        fs.id = 'inApp';
        fs.isCached = true;
        return fs;
    }
    FileUtils.registerFileServer(
        'inApp',
        'In-Memory FileSystem',
        initBrowserFs,
        null,
        true
    );
});