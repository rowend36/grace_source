define(function(require,exports,module){
   require("grace/ext/glob/glob");
   var FileUtils = require("grace/core/file_utils");
   function FindFileServer(fileServer) {
        var filter = null;
        var b = fileServer;
        var self = Object.create(fileServer);
        self.setFilter = function(glob) {
            if (!glob) {
                filter = null;
                return;
            }
            if (typeof glob == "string") {
                glob = FileUtils.globToRegex(glob);
                filter = function(i, path) {
                    return FileUtils.isDirectory(i) || (path + i).match(glob);
                };

            } else filter = glob;
        };
        self.getFiles = function(path, callback) {
            if (filter)
                b.getFiles(path, function(err, res) {
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
        self.readdir = function(path, callback) {
            self.getFiles(path, function(e, res) {
                callback(e, res && res.map(FileUtils.removeTrailingSlash));
            });
        };
        return self;
    }
    exports.FindFileServer = FindFileServer;
});