define(function (require, exports, module) {
  "use strict";
  /*globals diff_match_patch*/
  //runtime class
  require("../libs/js/diff_match_patch.js");
  //TODO use a simpler and faster diff implementation
  //that just checks common head and tail?
  //split into 8 chunks and merge sortoff,
  //maybe even works async

  var dmp = new diff_match_patch();
  dmp.Diff_EditCost = 50;
  dmp.Diff_Timeout = 0.4; //actual time can be up to times 2

  var filename = require("../core/file_utils").FileUtils.filename;

  var Docs = exports;

  var docs = Object.create(null);
  Docs.generateDiff = function (from, value, start_line, start_column) {
    //dmp can sometimes split newlines causing issues with toAceDeltas
    from = from.replace(/\r\n?/g, "\n");
    value = value.replace(/\r\n?/g, "\n");
    var diff = dmp.diff_main(from, value);
    dmp.diff_cleanupEfficiency(diff);
    return dmpDiffToAceDeltas(diff, start_line, start_column);
  };
  Docs.$set = function (id, doc) {
    docs[id] = doc;
  };
  Docs.$defaults = {};
  Docs.$delete = function (id) {
    delete docs[id];
  };
  Docs.get = function (id) {
    return docs[id];
  };
  Docs.has = function (id) {
    return !!docs[id];
  };
  Docs.ids = function () {
    return Object.keys(docs);
  };
  Docs.forEach = function (cb, ctx) {
    for (var i in docs) {
      cb.call(ctx, docs[i], i);
    }
  };
  Docs.numDocs = function () {
    //Just counting keys for now
    return Object.keys(docs).length;
  };
  Docs.forPath = function (path, server) {
    for (var i in docs) {
      if (docs[i].getPath() == path) {
        if (server && server.getDisk() !== docs[i].getFileServer().getDisk()) {
          continue;
        }
        return docs[i];
      }
    }
    return null;
  };
  Docs.forSession = function (session) {
    if (session) {
      var doc = session.getDocument();
      //ensure it is a doc not an ordinary ace document
      if (docs[doc.id]) return doc;
    }
    /*
    for (var id in docs) {
        var doc = docs[id];
        if (doc.session == session || (doc.clones && doc.clones.indexOf(session) > -1)) {
            return doc;
        }
    }*/
  };
  var _unsavedIndex = 0;
  Docs.getName = function (id) {
    var doc = docs[id];
    if (doc) {
      if (doc.isTemp()) {
        doc.$unsavedIndex = doc.$unsavedIndex || _unsavedIndex++;
        return "unsaved(" + doc.$unsavedIndex + ")";
      } else return filename(doc.getPath());
    }
    return null;
  };

  function dmpDiffToAceDeltas(diff, start_line, start_col) {
    var line = start_line || 0,
      col = start_col || 0;
    var endOfLine = /\r\n|\n|\r/g;
    var deltas = [];
    var start = {
      row: line,
      column: col,
    };

    function moveOver(text, type) {
      var a = text.split(endOfLine);
      if (a.length > 1) {
        line += a.length - 1;
        col = a[a.length - 1].length;
      } else {
        col += a[0].length;
      }
      var end = {
        row: line,
        column: col,
      };
      if (type) {
        deltas.push({
          action: type > 0 ? "insert" : "remove",
          lines: a,
          start: start,
          end: end,
        });
      }
      if (type < 0 /*delete*/) {
        line = start.row;
        col = start.column;
      } else start = end;
    }
    for (var a = 0; a < diff.length; a++) {
      moveOver(diff[a][1], diff[a][0]);
    }
    return deltas;
  }

  exports.Docs = Docs;
  exports.$dmpDiffToAceDeltas = dmpDiffToAceDeltas;
}); /*_EndDefine*/