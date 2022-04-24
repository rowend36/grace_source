define(function(require, exports, module) {
    var resolve = require("./file_utils").FileUtils.resolve;
    var dirname = require("./file_utils").FileUtils.dirname;

    /**
     * @typedef ("application\/x-www-form-urlencoded"|"multipart\/form-data"|"text\/plain") ContentType
     * @param {string} url
     * @param {Object} [opts]
     * @param {AbprtSignal} opts.abortSignal
     * @param {boolean} opts.addTimestamp
     * @param {ArrayBuffer|string} opts.body
     * @param {ContentType} opts.mimeType
     * @param {ContentType} opts.contentType
     * @param {object} opts.data
     * @param {object} opts.headers
     * @param {string} opts.method
     * @callback {({loaded,total?})} opts.onProgress
     * @param {ResponseType} opts.responseType
     * @param {number} opts.retryCount
     * @param {number} opts.timeout
     * @param {boolean} opts.withCredentials
     */

    function ajax(url, opts) {
        return new Promise(function(y, n) {
            opts = opts || {};
            var req = new XMLHttpRequest();
            //arraybuffer|blob|json|document|text
            req.contentType = opts.responseType ||
                "arraybuffer";
            var RESPONSE = "response";
            if (opts.responseType === "text")
                RESPONSE = "responseText";


            if (opts.responseType && opts.responseType !==
                "arraybuffer" && opts
                .mimeType)
                req.overrideMimeType(opts.mimeType);

            if (opts.timeout) {
                req.timeout = opts.timeout;
            }

            if (opts.abortSignal) {
                opts.abortSignal.addEventListener("abort", req
                    .abort.bind(req));
            }
            // ({lengthComputable:boolean,loaded:number,total?:number})
            if (req.onProgress) req.addEventListener("progress",
                opts.onProgress.bind(req));

            if (opts.retryCount) {
                var final = n;
                n = function(e) {
                    if ((e.target.status === 0 && !e.target[
                            RESPONSE]) || (e
                            .target
                            .status >
                            500
                        ) &&
                        opts.retryCount > 0) {
                        opts.retryCount--;
                        ajax(url, opts).then(y,
                            final);
                    } else final(e);
                };
            }

            req.addEventListener("abort", n);
            req.addEventListener("error", n);

            req.addEventListener("load", function(e) {
                var req = e.target;
                if (req.status === 200 || !req
                    .status && req.response)
                    y(req);
                else n(Object.assign(new Error(
                    "Request Failed"), {
                    target: req
                }));
            });

            req.withCredentials = opts.withCredentials;
            if (opts.data) {
                sendData(req, url, opts);
            } else {
                sendHeaders(req, url, opts);
                req.send(opts.body || undefined);
            }
        });
    }

    function relative(module) {
        return function(url, opts) {
            return ajax(resolve(dirname(module.uri), url), opts);
        };
    }


    //Utility methods

    function sendHeaders(req, url, opts) {
        if (opts.addTimestamp) url = url + ((/\?/).test(url) ?
                "&" : "?") + (new Date())
            .getTime();

        req.open(opts.method, url, true);
        if (opts.headers) {
            for (var i in opts.headers) {
                req.setRequestHeader(i, opts.headers[
                    i]);
            }
        }
    }

    function sendData(req, url, opts) {
        var method = opts.method;
        var data = opts.data;
        var isPost = method && method.toUpperCase() !== 'GET';
        var contentType = isPost && opts.contentType ? opts
            .contentType :
            "application\/x-www-form-urlencoded";
        var technique = isPost ?
            contentType === "multipart\/form-data" ? 3 : contentType ===
            "text\/plain" ? 2 : 1 : 0;
        var segments;
        if (technique === 3) {
            segments = [];
            for (var name in data) {
                segments.push(
                    /* enctype is multipart/form-data */
                    "Content-Disposition: form-data; name=\"" +
                    name +
                    "\"\r\n\r\n" + data[name] + "\r\n"
                );
            }
        } else {
            var filter = technique === 2 ? plainEscape :
                encodeURIComponent;
            segments = toParamStr(data, filter);
        }
        switch (technique) {
            case 0:
                url = url.replace(/(?:\?.*)?$/,
                    segments.length > 0 ? "?" + segments
                    .join("&") : "");
                sendHeaders(req, url, opts);
                req.send(opts.body || undefined);
                break;
            case 1:
            case 2:
                sendHeaders(req, url, opts);
                req.setRequestHeader("Content-Type", contentType);
                req.send(segments.join(technique ===
                    2 ? "\r\n" : "&"));
                break;
            case 3:
                sendHeaders(req, url, opts);
                /* enctype is multipart/form-data */
                var sBoundary = "---------------------------" + Date
                    .now().toString(16);
                req.setRequestHeader("Content-Type",
                    "multipart\/form-data; boundary=" + sBoundary);
                sendAsBinary(req, "--" + sBoundary + "\r\n" +
                    segments.join("--" + sBoundary + "\r\n") +
                    "--" + sBoundary + "--\r\n");
        }
    }

    function plainEscape(sText) {
        return sText.replace(/[\s\=\\]/g, "\\$&");
    }

    /**
     * @preserve jquery-param (c) KNOWLEDGECODE | MIT
     */
    function toParamStr(a, filter) {
        var s = [];
        var add = function(k, v) {
            v = typeof v === 'function' ? v() : v;
            v = v === null ? '' : v === undefined ? '' : v;
            s[s.length] = filter(k) + '=' +
                filter(v);
        };
        var buildParams = function(prefix, obj) {
            var i, len, key;

            if (prefix) {
                if (Array.isArray(obj)) {
                    for (i = 0, len = obj.length; i <
                        len; i++) {
                        buildParams(
                            prefix + '[' + (typeof obj[
                                    i] === 'object' && obj[
                                    i] ?
                                i : '') + ']',
                            obj[i]
                        );
                    }
                } else if (Object.prototype.toString.call(
                        obj) === '[object Object]') {
                    for (key in obj) {
                        buildParams(prefix + '[' + key + ']',
                            obj[key]);
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