define(function(require,exports,module) {
    var slashPath = /(?:[A-Za-z0-9_\-\.]+\/)[A-Za-z0-9_\-\.]/;
    var dotPath = /import\s*((?:[A-Za-z0-9_]+\.)[A-Za-z0-9_\*])/;

    var ImportFinders = {
        "slashImports": {
            prefixes: [
                /import\b.*\"/,
                /require\s*\(?\"/,
                /require_once\s*\(?\"/,
                /\#\?include\s*(?:\"|\(\"|<)/
            ],
            exec: function(line) {
                line = line.trim();
                var result;
                if (this.prefixes.some(function(e) {
                        var m = e.exec(line);
                        if (m) {
                            var path = line.substring(m.index + m[0].length);
                            path = slashPath.exec(path);
                            if (path) {
                                path = path[0];
                                result = {
                                    match: path
                                };
                            }
                        }
                    })) return result;
                //can be loaded anywhere in the file
                else return true;
            }
        },
        "dotImports": {
            exec: function(line) {
                var path = dotPath.exec(line);
                if (path) {
                    path = path[1].split(".").join("/");
                    return {
                        match: path
                    };
                } else if (line.indexOf("{") < 0) {
                    return true;
                }
                return false;
            }
        }
    };


    function listImports(session, types) {
        if (!types) types = Object.keys(ImportFinders);
        var imports = [];
        types.forEach(function(type) {
            var finder = (typeof type == 'string') ? ImportFinders[type] : type;
            if (!finder) return;
            for (var i = 0, len = session.getLength(); i < len; i++) {
                var line = session.getLine(i);
                var m = finder.exec(line);
                if (!m) break;
                if (m.match) imports.push(m.match);
            }
        });
        return imports;
    }
    //Not mature enough to use
})