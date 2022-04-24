define(function(require,exports,module) {
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var Utils = require("grace/core/utils").Utils;
    var parseSize = Utils.parseSize;
    var MAX_SINGLE_SIZE = parseSize("1mb");
    //var TIMEOUT = parseSize("");
    var MAX_TOTAL_SIZE = parseSize("10mb");
    var FAIL_MARGIN = parseSize("50kb");
    var BASE_FILE_SIZE = parseSize("5kb");
    //each fn(path,err,res)
    //finished fn(err)
    //beforeFolder(path,start,skip,list)
    var FileLoader = function(opts) {
        opts = opts || opts;
        var maxSize = opts.maxSize || MAX_TOTAL_SIZE;
        var maxSingleSize = opts.maxSingleSize || MAX_SINGLE_SIZE;
        this.getSize = function() {
            return {
                size: currentLoad,
                count: count
            };
        };
        this.setSize = function(esize, ecount) {
            currentLoad = esize;
            count = ecount;
        };
        this.increment = function(size) {
            currentLoad += size;
        };
        this.getOpts = function() {
            return opts;
        };
        var currentLoad = 0;
        var count = 0;

        function assertSize(size) {
            if (size > maxSingleSize)
                return {
                    reason: "singleSize",
                    size: size
                };
            else if (size + currentLoad > maxSize) {
                if (size < FAIL_MARGIN) {
                    return {
                        reason: "singleSize",
                        size: size
                    };
                } else return {
                    reason: "size",
                    size: currentLoad
                };
            }
        }

        function loadFile(path, server, next, preCheck) {
            if (currentLoad > maxSize) {
                next({
                    reason: "size",
                    size: currentLoad
                }, null, path);
            }
            if (preCheck) {
                server.stat(path, function(e, s) {
                    if (s) {
                        e = assertSize(s.size);
                        if (e) {
                            next(e, null, path);
                        } else loadFile(path, server, next);
                    } else next(e || {
                        reason: "unknown"
                    }, null, path);
                });
            } else
                server.readFile(path, FileUtils.encodingFor(path), function(e, res) {
                    if (!e && res) {
                        e = assertSize(res.length);
                        if (!e) {
                            count++;
                            currentLoad += res.length + BASE_FILE_SIZE;
                        }
                    }
                    next(e, res, path);
                });
        }
        this.loadFile = loadFile;
    };
    exports.FileLoader = FileLoader;
}); /*_EndDefine*/
