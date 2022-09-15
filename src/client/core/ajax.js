define(function (require, exports, module) {
    var resolve = require('./file_utils').FileUtils.resolve;
    var dirname = require('./file_utils').FileUtils.dirname;

    /**
     * @typedef ("application\/x-www-form-urlencoded"|"multipart\/form-data"|"text\/plain"|"urlparams") DataType
     * @param {string} url
     * @param {Object} [opts]
     * @param {string} opts.method
     * @param {object} opts.headers
     * @param {Object} opts.data
     * @param {DataType} opts.dataType
     * @param {Object|ArrayBuffer|string} opts.body
     * @param {(arraybuffer|blob|json|document|text)} opts.responseType
     * @param {string} opts.mimeType - The mimetype of the response text
     * @param {boolean} opts.withCredentials
     * @param {boolean} opts.addTimestamp
     * @callback {({loaded,total?})} opts.onProgress
     * @param {window.AbortSignal} opts.abortSignal
     * @param {number} opts.retryCount
     * @param {number} opts.timeout
     */

    function ajax(url, opts) {
        return new Promise(function (y, n) {
            if (!opts) opts = {};
            else if (opts.retryCount || opts.body)
                opts = Object.assign({}, opts);

            var req = new XMLHttpRequest();
            req.contentType = opts.responseType || 'arraybuffer';
            var RESPONSE =
                opts.responseType === 'text' ? 'responseText' : 'response';

            if (opts.mimeType) req.overrideMimeType(opts.mimeType);
            if (opts.timeout) req.timeout = opts.timeout;

            if (opts.abortSignal) {
                opts.abortSignal.addEventListener('abort', req.abort.bind(req));
            }
            // ({lengthComputable:boolean,loaded:number,total?:number})
            if (opts.onProgress)
                req.addEventListener('progress', opts.onProgress.bind(req));

            if (opts.retryCount && opts.retryCount > 0) {
                var final = n;
                n = function (e) {
                    if (
                        (req.status === 0 && !req[RESPONSE]) ||
                        req.status >= 500
                    ) {
                        opts.retryCount--;
                        ajax(url, opts).then(y, final);
                    } else final(e);
                };
            }

            req.addEventListener('abort', n);
            req.addEventListener('error', n);

            req.addEventListener('load', function (e) {
                var req = e.target;
                if (req.status === 200 || !req.status) y(req);
                else {
                    var err = new Error('Request Failed: ' + req.status);
                    err.target = req;
                    n(err);
                }
            });

            req.withCredentials = opts.withCredentials;
            sendData(req, url, opts);
        });
    }

    function relative(module) {
        return function (url, opts) {
            return ajax(
                url.indexOf(':') > -1 ? url : resolve(dirname(module.uri), url),
                opts
            );
        };
    }

    //Utility methods

    function sendHeaders(req, url, opts) {
        if (opts.addTimestamp)
            url = url + (/\?/.test(url) ? '&' : '?') + new Date().getTime();

        req.open(opts.method || 'GET', url, true);
        if (opts.headers) {
            for (var i in opts.headers) {
                req.setRequestHeader(i, opts.headers[i]);
            }
        }
    }

    var MULTIPART = 'multipart/form-data';
    var PLAINTEXT = 'text/plain';
    var URLENCODED = 'application/x-www-form-urlencoded';
    var GETPARAMS = 'urlparams';
    function sendData(req, url, opts) {
        var data = opts.data;
        var isGet = !opts.method || opts.method.toUpperCase() === 'GET';
        var dataType = opts.dataType;

        //Infer data type
        if (!dataType && !isGet) dataType = URLENCODED;
        var technique = opts.body || !dataType ? GETPARAMS : dataType;
        var segments;
        if (technique === MULTIPART) {
            segments = [];
            for (var name in data) {
                segments.push(
                    /* enctype is multipart/form-data */
                    'Content-Disposition: form-data; name="' +
                        name +
                        '"\r\n\r\n' +
                        data[name] +
                        '\r\n'
                );
            }
        } else {
            var filter =
                technique === PLAINTEXT ? encodePlain : encodeURIComponent;
            segments = toParamStr(data, filter);
        }
        switch (technique) {
            case GETPARAMS:
                if (segments.length > 0)
                    url += (/\?/.test(url) ? '&' : '?') + segments.join('&');
                if (opts.body && opts.body.contructor === Object) {
                    opts.data = opts.body;
                    opts.body = null;
                    sendData(req, url, opts);
                } else {
                    sendHeaders(req, url, opts);
                    req.send(opts.body || undefined);
                }
                break;
            case URLENCODED:
            case PLAINTEXT:
                sendHeaders(req, url, opts);
                req.setRequestHeader('Content-Type', dataType);
                req.send(segments.join(technique === PLAINTEXT ? '\r\n' : '&'));
                break;
            case MULTIPART:
                sendHeaders(req, url, opts);
                /* enctype is multipart/form-data */
                var sBoundary =
                    '---------------------------' + Date.now().toString(16);
                req.setRequestHeader(
                    'Content-Type',
                    'multipart/form-data; boundary=' + sBoundary
                );
                sendAsBinary(
                    req,
                    '--' +
                        sBoundary +
                        '\r\n' +
                        segments.join('--' + sBoundary + '\r\n') +
                        '--' +
                        sBoundary +
                        '--\r\n'
                );
        }
    }

    function encodePlain(sText) {
        return sText.replace(/[\s\=\\]/g, '\\$&');
    }

    /**
     * @preserve jquery-param (c) KNOWLEDGECODE | MIT
     */
    function toParamStr(a, filter) {
        var s = [];
        var add = function (k, v) {
            v = typeof v === 'function' ? v() : v;
            v = v === null ? '' : v === undefined ? '' : v;
            s[s.length] = filter(k) + '=' + filter(v);
        };
        var buildParams = function (prefix, obj) {
            var i, len, key;

            if (prefix) {
                if (Array.isArray(obj)) {
                    for (i = 0, len = obj.length; i < len; i++) {
                        buildParams(
                            prefix +
                                '[' +
                                (typeof obj[i] === 'object' && obj[i]
                                    ? i
                                    : '') +
                                ']',
                            obj[i]
                        );
                    }
                } else if (
                    Object.prototype.toString.call(obj) === '[object Object]'
                ) {
                    for (key in obj) {
                        buildParams(prefix + '[' + key + ']', obj[key]);
                    }
                } else {
                    add(prefix, obj);
                }
            } else if (Array.isArray(obj)) {
                for (i = 0, len = obj.length; i < len; i++) {
                    add(obj[i].name, obj[i].value);
                }
            } else {
                for (key in obj) {
                    buildParams(key, obj[key]);
                }
            }
            return s;
        };

        return buildParams('', a);
    }

    function sendAsBinary(req, str) {
        if (req.sendAsBinary) return req.sendAsBinary(str);

        var a = new Uint8Array(str.length);
        for (var i = 0, len = str.length; i < len; i++) {
            a[i] = str.charCodeAt(i) | 0xff;
        }
        req.send(a.buffer);
    }

    exports.ajax = ajax;
    exports.from = relative;
}); /*_EndDefine*/