function TsServer(requestFile) {
    var docs = {};
    var server = null;

    function addDoc(path, res) {
        if (docs[path]) {
            docs[path].res = res;
            docs[path].version++;
        } else {
            docs[path] = {
                res: res,
                version: 0
            };
        }
        return docs[path].version;
    }

    function updateDoc(path, deltas,version) {
        if (!docs[path] || version !== docs[path].version)
            throw new Error('Document with specified version does not exist');
        var lines = docs[path].res.split(/\r\n|\r|\n/);
        deltas.forEach(function(delta){
            applyDeltas(lines, delta);
        });
        docs[path].res = lines.join('\n');
        return ++docs[path].version;
    }

    function delDoc(path) {
        if (docs[path]) {
            delete docs[path];
        }
    }

    function restart(options) {
        if (server) server.dispose();
        server = ts.createLanguageService({
            getCompilationSettings: function() {
                return Object.assign({
                    fileNames: true,
                    allowJs: true,
                    allowUnreachableCode: false,
                    allowUnusedLabels: false,
                    alwaysStrict: true,
                    charset: 'utf8',
                    checkJs: true,
                    jsx: 2,
                    lib: ["lib.d.ts"],
                    newLine: 1,
                    noFallthroughCasesInSwitch: true,
                    noImplicitUseStrict: true,
                    noUnusedLocals: true,
                    noUnusedParameters: false,
                    preserveConstEnums: true,
                    removeComments: false,
                    strict: true,
                    strictNullChecks: true,
                    suppressExcessPropertyErrors: true,
                    suppressImplicitAnyIndexErrors: true,
                    target: 1
                }, options);
            },
            directoryExists: function(directoryName) {
                return false;
            },
            error: console.error,
            fileExists: function(path) {
                if (docs[path]) return true;
                if (libFileMap[path]) return true;
            },
            getCurrentDirectory: function() {
                return "";
            },
            getDefaultLibFileName: function(options) {
                return ts.getDefaultLibFileName(options);
            },
            getScriptFileNames: function() {
                return Object.keys(docs);
            },
            // getDirectories ? (directoryName: string) : string[],
            getScriptSnapshot: function(fileName) {
                var doc = this.readFile(fileName);
                var shot = doc !== undefined ? ts.ScriptSnapshot.fromString(doc) : undefined;
                return shot;
            },
            getScriptVersion: function(fileName) {
                return docs[fileName] && docs[fileName].version;
            },
            log: console.log,
            trace: console.debug,
            readFile: function(path) {
                if (docs[path]) return docs[path].res;
                if (libFileMap[path]) return libFileMap[path];
                return requestFile(path);
            },
        });
    }

    function getCompletions(file, pos) {
        return server.getCompletionsAtPosition(file, pos);
    }

    function getAnnotations(file, pos) {
        var annotations = [];

        function readMessage(d) {
            if (d)
                return d.messageText + readMessage(d.next);
            else return "";
        }

        function transform(diag) {
            annotations.push({
                pos: diag.start,
                text: typeof diag.messageText == "string" ? diag.messageText : readMessage(diag.messageText),
                type: diag.category == 2 ? "info" : diag.category == 1 ? "error" : "warning"
            });
        }
        server.getSyntacticDiagnostics(file).forEach(transform);
        server.getSemanticDiagnostics(file).forEach(transform);
        return annotations;
    }
    return {
        getCompletions: getCompletions,
        getAnnotations: getAnnotations,
        addDoc: addDoc,
        updateDoc: updateDoc,
        delDoc: delDoc,
        restart: restart,
        getLSP: function() {
            return server;
        }
    };
}

var applyDeltas = function(docLines, delta, doNotValidate) {
    var row = delta.start.row;
    var startColumn = delta.start.column;
    var line = docLines[row] || "";
    switch (delta.action) {
        case "insert":
            var lines = delta.lines;
            if (lines.length === 1) {
                docLines[row] = line.substring(0, startColumn) + delta.lines[0] + line.substring(startColumn);
            } else {
                var args = [row, 1].concat(delta.lines);
                docLines.splice.apply(docLines, args);
                docLines[row] = line.substring(0, startColumn) + docLines[row];
                docLines[row + delta.lines.length - 1] += line.substring(startColumn);
            }
            break;
        case "remove":
            var endColumn = delta.end.column;
            var endRow = delta.end.row;
            if (row === endRow) {
                docLines[row] = line.substring(0, startColumn) + line.substring(endColumn);
            } else {
                docLines.splice(
                    row, endRow - row + 1,
                    line.substring(0, startColumn) + docLines[endRow].substring(endColumn)
                );
            }
            break;
    }
};
var isWorker = typeof window === 'undefined';
if (isWorker) {
    var server = new TsServer(function(path) {
        self.postMessage({
            type: 'getFile',
            path: path
        })
    });
    self.onmessage = function(ev) {
        var id = ev.data.id;
        var res, error;
        try {
            res = (server[ev.data.type] || server.getLSP()[ev.data.type]).apply(server, ev.data.args);
        } catch (e) {
            error = e;
        }
        self.postMessage({
            id: id,
            res: res,
            error: error && {
                code: error.code,
                message: error.message,
                stack: error.stack
            }
        });
    };
}


// #include "./workers/typescriptServices.js"
// #include "./workers/typescriptLibs.js"