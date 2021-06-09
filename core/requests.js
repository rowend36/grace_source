_Define(function(global) {
    var errors = {
        404: 'ENOENT',
        401: "EEXIST",
        403: "ENOTEMPTY",
        402: "EISDIR",
        405: 'ENOTDIR',
        406: 'EXDEV',
        412: 'ETOOLARGE',
        413: 'ENOTENCODING'
    };
    var getError = function(xhr, url, path) {
        var code = errors[xhr.status] || xhr.responseText || 'EUNKNOWN';
        if (xhr.status === 0 && !code) global.Notify.error('SERVER DOWN!!!');
        return {
            code: code,
            message: code,
            syscall: url,
            path: path
        };
    };

    function request(url, data, callback, processed, retryCount, stack) {
        retryCount = retryCount || 0;
        $.ajax({
            url: url,
            type: 'POST',
            data: data,
            processData: !processed,
            success: function(res) {
                callback && callback(null, res);
            },
            error: function(xhr, status, message) {
                if ((xhr.status === 0 || (xhr.status === 501 && !xhr.responseText)) && retryCount < 3) {
                    request(url, data, callback, processed, ++retryCount, stack);
                } else callback && callback(getError(xhr, url, data.path || data.dir || data.file));
            }
        });
    }

    function requestBuffer(url, path, callback, retryCount, stack) {
        retryCount = retryCount || 0;
        $.ajax({
            url: url,
            type: 'POST',
            data: {
                path: path
            },
            success: function(res) {
                callback && callback(null, res);
            },
            error: function(xhr, status, message) {
                if ((xhr.status === 0 || (xhr.status === 501 && !xhr.response)) && retryCount < 3) {
                    requestBuffer(url, path, callback, ++retryCount, stack);
                } else callback && callback(getError(xhr, stack, path));
            },
            xhr: function() {
                var a = new XMLHttpRequest();
                a.responseType = "arraybuffer";
                return a;
            }
        });
    }

    function sendBuffer(url, blob, callback) {
        var req = new XMLHttpRequest();
        req.open('post', url);
        req.send(blob);
        if (callback) {
            req.onload = function() {
                if (req.status == 200) callback();
                else {
                    callback(getError(req, null, url));
                }
            };
            req.onerror = function() {
                callback(getError(req));
            };
        }
    }
    global.sendBuffer = sendBuffer;
    global.requestBuffer = requestBuffer;
    global.request = request;
}); /*_EndDefine*/