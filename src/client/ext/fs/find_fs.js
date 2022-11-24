define(function (require, exports, module) {
    require('grace/ext/file_utils/glob');
    var FileUtils = require('grace/core/file_utils').FileUtils;
    function FindFileServer(fileServer) {
        var filter = null;
        var b = fileServer;
        var self = Object.create(fileServer);
        self.setFilter = function (_filter) {
            filter = _filter;
        };
        self.getFiles = function (path, callback) {
            if (filter)
                b.getFiles(path, function (err, res) {
                    if (err || !filter) return callback(err, []);
                    var filtered = [];
                    for (var i in res) {
                        if (filter(res[i], path)) {
                            filtered.push(res[i]);
                        }
                    }
                    if (callback) callback(err, !err && filtered);
                });
            else b.getFiles(path, callback);
        };
        self.readdir = function (path, callback) {
            self.getFiles(path, function (e, res) {
                callback(e, res && res.map(FileUtils.removeTrailingSlash));
            });
        };
        return self;
    }
    exports.FindFileServer = FindFileServer;
});