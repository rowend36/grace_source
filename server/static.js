exports.static = function(rootFile, rootPrefix) {
    return function(req, res) {
        var url = req.path;
        var resolved;
        if (url.startsWith(rootPrefix))
            resolved = "/"+url.substring(rootPrefix.length);
        else {
            resolved = rootFile + url;
        }
        fs.stat(resolved, function(err, stat) {
            if (err) {
                if ('ENOENT' == err.code) {
                    res.type('text/plain');
                    res.statusCode = 404;
                    console.log(url + ":" + 404);
                    res.end('Not Found');
                }
                else {
                    res.statusCode = 500;
                    console.log(url + ":" + 500);
                    res.end('Internal Server Error');
                }
            }
            else {
                res.setHeader('Content-Length', stat.size);
                var stream = fs.createReadStream(resolved);
                stream.pipe(res);
                stream.on('error', function(err) {
                    res.status(404);
                    res.write("Can't find " + req.path);
                    res.end('404 - Not Found');
                });
            }
        });
    };
}