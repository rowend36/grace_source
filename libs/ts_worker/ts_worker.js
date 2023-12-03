/*globals ts, libFileMap*/
function TsServer(requestFile) {
  var docs = {};
  var server = null;
  var folders = {};

  function addDirectories(path) {
    var a = path.split('/');
    var cd = folders;
    for (var i = 0, len = a.length - 1; i < len; i++) {
      //add each segment step by step
      if (a[i]) cd = cd[a[i]] || (cd[a[i]] = {});
    }
    return cd;
  }

  function isDir(path) {
    var a = path.split('/');
    var cd = folders;
    for (var i = 0, len = a.length; i < len; i++) {
      if (a[i]) {
        cd = cd[a[i]];
        if (!cd) return false;
      }
    }
    return cd;
  }

  function addPaths(paths) {
    paths.forEach(function (path) {
      var dir = addDirectories(path);
      var name = /[^\/]*$/.exec(path)[0];
      dir[name] = '';
    });
  }

  function isFile(path) {
    var dir = path.replace(/\/*[^\/]+\/*$/, '');
    var name = /[^\/]*$/.exec(path)[0];
    var kop = isDir(dir);
    if (kop) return kop[name] !== undefined;
    return false;
  }
  //File line endings are normalized
  function addDoc(path, res, version) {
    if (docs[path]) {
      docs[path].res = res.replace(/\r\n|\r|\n/g, '\n');
      docs[path].lines = null;
      docs[path].version = version;
      if (docs[path].history) docs[path].history.length = 0;
    } else {
      docs[path] = {
        res: res,
        version: version,
      };
    }
    addDirectories(path);
    return version;
  }

  function ensureLines(doc) {
    if (!doc.lines) {
      doc.lines = doc.res.split('\n');
      doc.res = null;
    }
    return doc.lines;
  }
  //lines must be at least length 1
  function indexToPos(idx, lines, cache) {
    var rem = 0,
      i = 0;
    if (cache && cache.row && idx >= cache.idx) {
      i = cache.row;
      rem = cache.idx;
    }
    for (var len = lines.length; i < len; i++) {
      if (idx - rem <= lines[i].length) {
        if (cache) {
          cache.row = i;
          cache.idx = rem;
        }
        return {
          row: i,
          column: idx - rem,
        };
      }
      rem += lines[i].length + 1;
    }
    //error should not happen
    return {
      row: i,
      column: idx + 1,
    };
  }

  function posToIndex(pos, lines, cached) {
    var idx = 0;
    var i = 0;
    if (cached && cached.row && cached.row <= pos.row) {
      idx = cached.idx;
      i = cached.row;
    }
    for (var len = pos.row; i < len; i++) {
      idx += lines[i].length + 1;
    }
    if (cached) {
      cached.idx = idx;
      cached.row = i;
    }
    return idx + pos.column;
  }

  function updateDoc(path, deltas, version) {
    if (!docs[path]) throw new Error('Document with does not exist');
    else if (docs[path].version != version) {
      throw new Error('Version mismatch');
    }

    var lines = ensureLines(docs[path]);
    var maxrow = Infinity,
      minrow = 0;
    var changes = [];
    deltas.forEach(function (e) {
      if (e.action == 'insert' || e.action == 'remove') {
        var start = posToIndex(e.start, lines);
        var length = e.lines.join('\n').length;
        changes.push({
          span: {
            start: start,
            length: e.action == 'insert' ? 0 : length,
          },
          newLength: e.action == 'remove' ? 0 : length,
        });
        applyDelta(lines, e);
        maxrow = Math.min(maxrow, e.end.row);
        minrow = Math.max(minrow, e.start.row);
      }
    });
    var lastDelta = deltas[deltas.length - 1];
    if (lines.join('\n').length != lastDelta.tsChecksum) {
      var error = new Error('Failed length check');
      error.data = [deltas, lines.slice(minrow, maxrow + 1)];
      throw error;
    }
    var hist =
      docs[path].history ||
      (docs[path].history = [
        {
          version: version,
        },
      ]);

    hist.push({
      version: version + 1,
      changeRange: ts.collapseTextChangeRangesAcrossMultipleVersions(changes),
    });
    if (hist.length > 7) {
      hist.splice(0, 3);
    }
    return ++docs[path].version;
  }
  /**@constructor*/
  function Snapshot(doc) {
    this.version = doc.version;
    this.hist =
      doc.history ||
      (doc.history = [
        {
          version: doc.version,
        },
      ]);
    this.lines = ensureLines(doc).slice(0); //immutable strings less memory
  }
  Snapshot.prototype.getText = function (start, end) {
    var cache = {};
    var startPos = indexToPos(start, this.lines, cache);
    var endPos = indexToPos(end, this.lines, cache);
    var text = this.lines.slice(startPos.row, endPos.row + 1).join('\n');
    return text.substr(startPos.column, end - start);
  };
  Snapshot.prototype.getLength = function () {
    var res = posToIndex(
      {
        row: this.lines.length,
        column: -1,
      },
      this.lines
    );
    return res;
  };
  Snapshot.prototype.getChangeRange = function (snapshot) {
    // Text-based snapshots do not support incremental parsing. Return undefined
    // to signal that to the caller.
    var start = -1;
    for (var i = 0; i < this.hist.length; i++) {
      if (this.hist[i].version == snapshot.version) {
        start = ++i;
        break;
      }
    }
    if (start < 0) return undefined;
    var end = -1;
    for (; i < this.hist.length; i++) {
      if (this.hist[i].version == this.version) {
        end = ++i;
      }
    }
    if (end < 0) return undefined;

    var change = ts.collapseTextChangeRangesAcrossMultipleVersions(
      this.hist.slice(start, end).map(function (e) {
        return e.changeRange;
      })
    );
    // console.log(JSON.stringify([change,snapshot.getText(),this.getText(),this.version,snapshot.version,this.hist]));
    return change;
  };

  function delDoc(path) {
    if (docs[path]) {
      delete docs[path];
    }
  }

  function restart(options) {
    if (server) server.dispose();
    server = ts.createLanguageService({
      getCompilationSettings: function () {
        return Object.assign(
          {
            fileNames: true,
            allowJs: true,
            allowUnreachableCode: false,
            allowUnusedLabels: false,
            alwaysStrict: true,
            charset: 'utf8',
            checkJs: true,
            jsx: 2,
            lib: ['lib.d.ts'],
            incremental: true,
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
            target: 1,
          },
          options
        );
      },
      directoryExists: function (directoryName) {
        return !!isDir(directoryName);
      },
      error: console.error,
      fileExists: function (path) {
        if (docs[path]) return true;
        if (libFileMap[path]) return true;
        return isFile(path);
      },
      getCurrentDirectory: function () {
        return '';
      },
      getDefaultLibFileName: function (options) {
        return 'lib.d.ts';
      },
      getScriptFileNames: function () {
        return Object.keys(docs);
      },
      // getDirectories ? (directoryName: string) : string[],
      getScriptSnapshot: function (fileName) {
        if (docs[fileName]) return new Snapshot(docs[fileName]);
        var doc = this.readFile(fileName);
        var shot =
          doc !== undefined ? ts.ScriptSnapshot.fromString(doc) : undefined;
        return shot;
      },
      getScriptVersion: function (fileName) {
        if (docs[fileName]) return docs[fileName].version;
        if (libFileMap[fileName]) return 0;
      },
      readFile: function (path) {
        if (docs[path])
          return docs[path].lines
            ? docs[path].lines.join('\n')
            : docs[path].res;
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
    var cache = {};
    var doc = docs[file];

    function transform(diag) {
      var start = indexToPos(diag.start, ensureLines(doc), cache);
      var end = indexToPos(diag.start + diag.length, ensureLines(doc), cache);
      annotations.push({
        row: start.row,
        column: start.column,
        end: end,
        text: ts.flattenDiagnosticMessageText(diag.messageText, '\n'),
        type: ts.DiagnosticCategory[diag.category].toLowerCase(),
      });
    }
    server.getSyntacticDiagnostics(file).forEach(transform);
    server.getSemanticDiagnostics(file).forEach(transform);
    return annotations;
  }
  function applyDelta(docLines, delta, doNotValidate) {
    var row = delta.start.row;
    var startColumn = delta.start.column;
    var line = docLines[row] || '';
    switch (delta.action) {
      case 'insert':
        var lines = delta.lines;
        if (lines.length === 1) {
          docLines[row] =
            line.substring(0, startColumn) +
            delta.lines[0] +
            line.substring(startColumn);
        } else {
          var args = [row, 1].concat(delta.lines);
          docLines.splice.apply(docLines, args);
          docLines[row] = line.substring(0, startColumn) + docLines[row];
          docLines[row + delta.lines.length - 1] += line.substring(startColumn);
        }
        break;
      case 'remove':
        var endColumn = delta.end.column;
        var endRow = delta.end.row;
        if (row === endRow) {
          docLines[row] =
            line.substring(0, startColumn) + line.substring(endColumn);
        } else {
          docLines.splice(
            row,
            endRow - row + 1,
            line.substring(0, startColumn) +
              docLines[endRow].substring(endColumn)
          );
        }
        break;
    }
  }
  return {
    getCompletions: getCompletions,
    getAnnotations: getAnnotations,
    addDoc: addDoc,
    updateDoc: updateDoc,
    addPaths: addPaths,
    delDoc: delDoc,
    restart: restart,
    getLSP: function () {
      return server;
    },
  };
}
(function () {
  /*globals self*/
  var isWorker = typeof window === 'undefined';
  if (isWorker) {
    var requestedFile = false;
    var server = TsServer.call(null, function (path) {
      requestedFile = true;
      self.postMessage({
        type: 'getFile',
        path: path,
      });
    });
    self.onmessage = function (ev) {
      var id = ev.data.id;
      var res, error;
      requestedFile = false;
      try {
        res = (server[ev.data.type] || server.getLSP()[ev.data.type]).apply(
          server,
          ev.data.args
        );
      } catch (e) {
        error = e;
      }
      self.postMessage({
        id: id,
        res: res,
        pending: requestedFile,
        error: error && {
          code: error.code,
          message: error.message,
          stack: error.stack,
        },
      });
    };
  }
})();

// #include "./ts/typescriptServices.js"
// #include "./ts/typescriptLibs.js"
