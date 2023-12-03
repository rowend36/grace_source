var fs = require("fs");
/**
 * @param {string} rootFile - the folder to server files from
 * @param {string} [rootPrefix] - a prefix which when found indicates the root directory
 */
exports.static = function (rootFile, rootPrefix) {
    return function (req, res) {
        var url = decodeURI(req.path);
        var resolved;
        if (url.startsWith(rootPrefix))
            resolved = "/" + url.substring(rootPrefix.length);
        else {
            resolved = rootFile + url;
        }
        fs.stat(resolved, function (err, stat) {
            if (stat && stat.isDirectory()) err = true;

            if (err) {
                if ("ENOENT" == err.code) {
                    res.type("text/plain");
                    res.statusCode = 404;
                    res.end("Not Found");
                } else {
                    res.statusCode = 500;
                    res.end("Internal Server Error");
                }
            } else {
                res.setHeader("Content-Length", stat.size);
                if (resolved.endsWith(".js"))
                    res.setHeader("Content-Type", "application/javascript");
                var stream = fs.createReadStream(resolved);
                stream.pipe(res);
                stream.on("error", function (/*err*/) {
                    res.status(404);
                    res.write("Can't find " + resolved);
                    res.end("404 - Not Found");
                });
            }
        });
    };
};