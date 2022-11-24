define(function (require, exports, module) {
    'use strict';
    var BaseFs = require('grace/core/base_fs').BaseFs;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var delay = require('grace/core/utils').Utils.delay;
    var ajax = require('grace/core/ajax').ajax;
    var normalizeEncoding = FileUtils.normalizeEncoding;
    var debug = console;

    var errors = {
        401: 'EACCESS',
        402: 'EISDIR',
        403: 'ENOTEMPTY',
        404: 'ENOENT',
        405: 'ENOTDIR',
        406: 'EXDEV',
        410: 'EEXIST',
        412: 'ETOOLARGE',
        413: 'ENOTENCODING',
    };
    function getAjaxError(xhr, url, path, stack) {
        var code =
            errors[xhr.status] ||
            xhr.statusText ||
            (xhr.contentType == 'text' && xhr.responseText) ||
            'EUNKNOWN';
        // if (xhr.status === 0 && !code) require("../ui/notify")
        //     .Notify.error('SERVER DOWN!!!');
        return FileUtils.createError({
            code: code,
            syscall: url,
            path: path,
            _stack: stack,
        });
    }

    function sendBuffer(url, data, blob, callback) {
        // var stack = new Error().stack;
        ajax(url, {data: data, body: blob, retryCount: 0, method: 'POST'}).then(
            function () {
                callback(null);
            },
            function (e) {
                callback(getAjaxError(e.target, url, url /*, stack*/));
            }
        );
    }

    function _parseJSON(req, url, path, callback, stack) {
        var type = req.getResponseHeader('Content-Type');
        if (!type) return false;
        if (
            type.indexOf('application/json') > -1 ||
            type.indexOf('text/json') > -1
        ) {
            var err, data;
            try {
                data = JSON.parse(req.responseText);
            } catch (e) {
                err = e;
                e.code = 'EUNKNOWN';
                e.path = path;
                e._stack = stack;
                e.syscall = url;
            }
            callback(err, data);
            return true;
        }
    }
    function request(url, data, callback, asBuffer, stack) {
        // stack =
        //     stack ||
        //     Object.assign(new Error().stack, {data: asBuffer ? null : data});
        // stack = data;
        ajax(url, {
            data: data,
            retryCount: 3,
            method: 'POST',
            responseType: asBuffer ? 'arraybuffer' : 'text',
        }).then(
            function (req) {
                if (
                    asBuffer ||
                    !_parseJSON(req, url, data.path, callback, stack)
                )
                    callback(null, asBuffer ? req.response : req.responseText);
            },
            function (e) {
                callback(getAjaxError(e.target, url, data.path, stack));
            }
        );
    }
    function requestBuffer(url, data, callback) {
        request(url, data, callback, true /*, new Error().stack*/);
    }

    var invokeCbs = function (err, res) {
        this.cbs.forEach(function (e, i) {
            try {
                if (err) return e(err);
                var d = res[i];
                if (!d.e) return e(null, d.r);
                return e(
                    FileUtils.createError({path: this.args[i].path, code: d.e})
                );
            } catch (e) {
                debug.error(e);
            }
        });
    };
    /** @type {Record<string,{data:Any,args:Array<Any>,cbs:Array<Function>}} */
    var waiting = {};
    var sendRequests = delay(function () {
        for (var i in waiting) {
            var m = waiting[i];
            waiting[i] = null;
            if (m.args.length === 1) {
                request(i, Object.assign(m.data, m.args[0]), m.cbs[0]);
            } else {
                m.data.args = m.args;
                request(i, m.data, invokeCbs.bind(m));
            }
        }
    });
    var lastCalled = 0;
    function batchRequest(url, data, arg, cb) {
        var t = lastCalled;
        lastCalled = new Date().getTime();
        if (waiting[url]) {
            waiting[url].cbs.push(cb);
            waiting[url].args.push(arg);
        } else {
            waiting[url] = {data: data, args: [arg], cbs: [cb]};
            sendRequests.later(lastCalled - t > 300 ? 0 : 300);
        }
    }

    /*TODO implement streams and symlinks && readlink, or leave symlinks*/
    function RESTFileServer(address, rootDir, password) {
        var server = address;
        rootDir = rootDir || '/';
        var encodings = ['utf8'];
        var oneArgCallback = function (cb) {
            return function (e) {
                cb(e);
            };
        };
        request(
            server + '/encodings',
            {password: password},
            function (e, f) {
                this.$encodingList = null;
                if (!e) encodings = f;
            }.bind(this)
        );
        this.icon = 'storage';
        this.getRoot = function () {
            return rootDir;
        };
        this.isEncoding = function (e) {
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings
                .map(normalizeEncoding)
                .indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function () {
            return encodings;
        };
        this.getDisk = function () {
            return 'local';
        };
        this.href = server + '/root/';
        this.readFile = function (path, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = null;
                } else if (typeof opts === 'string') encoding = opts;
                else encoding = opts.encoding;
            }
            if (!encoding) {
                requestBuffer(
                    server + '/open',
                    {path: path, password: password},
                    callback
                );
            } else
                request(
                    server + '/open',
                    {path: path, password: password, encoding: encoding},
                    callback
                );
        };
        this.getFiles = function (path, callback) {
            request(
                server + '/files',
                {path: path, password: password, appendSlash: true},
                callback
            );
        };
        this.readdir = function (path, callback) {
            request(
                server + '/files',
                {path: path, password: password},
                callback
            );
        };

        this.writeFile = function (path, content, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === 'function') {
                    callback = opts;
                    opts = null;
                    encoding = null;
                } else if (typeof opts == 'string') {
                    encoding = opts;
                } else {
                    encoding = opts.encoding || null;
                }
            }
            var form = new FormData();
            form.set('encoding', encoding);
            form.set('password', password);
            form.set('content', new Blob([content]), path);
            sendBuffer(
                server + '/save',
                {path: path},
                form,
                oneArgCallback(callback)
            );
        };
        this.mkdir = function (path, callback) {
            request(
                server + '/new',
                {path: path, password: password},
                oneArgCallback(callback)
            );
        };
        this.delete = function (path, callback) {
            request(
                server + '/delete',
                {path: path, password: password, recursive: true},
                oneArgCallback(callback)
            );
        };
        this.unlink = this.rmdir = function (path, callback) {
            request(
                server + '/delete',
                {path: path, password: password},
                oneArgCallback(callback)
            );
        };
        this.rename = function (path, dest, callback) {
            request(
                server + '/rename',
                {path: path, dest: dest, password: password},
                oneArgCallback(callback)
            );
        };
        this.copyFile = function (path, dest, callback, overwrite) {
            batchRequest(
                server + '/copy',
                {password: password},
                {path: path, dest: dest, overwrite: overwrite || null},
                oneArgCallback(callback)
            );
        };
        this.moveFile = function (path, dest, callback, overwrite) {
            batchRequest(
                server + '/move',
                {password: password},
                {path: path, dest: dest, overwrite: overwrite || null},
                oneArgCallback(callback)
            );
        };
        this.$gitBlobOid = function (path, callback) {
            batchRequest(
                server + '/fastGetOid',
                {password: password},
                {path: path},
                callback
            );
        };
        this.stat = function (path, opts, callback) {
            if (typeof opts === 'function') {
                callback = opts;
                opts = null;
            }
            var isLstat = opts === true || (opts && opts.isLstat);
            batchRequest(
                server + '/info',
                {password: password},
                {path: path, isLstat: isLstat || null},
                function (e, s) {
                    if (s) s = FileUtils.createStats(s);
                    callback(e, s);
                }
            );
        };
        this.lstat = function (path, callback) {
            this.stat(path, true, callback);
        };
        BaseFs.call(this);
    }
    if (Env.canLocalHost) {
        FileUtils.registerFsExtension(
            'rest',
            'REST HTTP Fileserver',
            function (conf) {
                var address = Env.server;
                var root = '/';
                var password;
                if (conf) {
                    conf.icon = 'storage';
                    if (conf.address) {
                        address = conf.address;
                        if (!address.startsWith('http'))
                            address = 'http://' + address;
                    }
                    if (conf.root) {
                        root = conf.root;
                    }
                    if (conf.password) {
                        password = conf.password;
                    }
                    conf['!requireURL'] = 'grace/ext/fs/httpfs';
                }
                return (window.rfs = new RESTFileServer(
                    address,
                    root,
                    password
                ));
            },
            [
                {
                    name: 'address',
                    caption: 'Address',
                    type: 'text',
                    value: Env.server || 'http://localhost:8000',
                },
                {
                    name: 'root',
                    caption: 'Root Directory',
                    value: '/',
                    type: 'text',
                },
                {
                    name: 'password',
                    caption: 'Password',
                    value: '',
                    type: 'text',
                },
            ]
        );
    }
}); /*_EndDefine*/