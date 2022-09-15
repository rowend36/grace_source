define(function (require, exports, module) {
  'use strict';
  var Utils = require('grace/core/utils').Utils;
  var WORKER_BLOB_URL;
  var MAX_CACHE_SIZE = Utils.parseSize('10mb');
  exports.createWorker = function (cb, e) {
    if (!WORKER_BLOB_URL)
      WORKER_BLOB_URL = URL.createObjectURL(
        new Blob(
          [
            '(' +
              inlineWorker
                .toString()
                .replace('$MAX_CACHE_SIZE', MAX_CACHE_SIZE) +
              ')()',
          ],
          {
            type: 'text/javascript',
          }
        )
      );
    var worker = new Worker(WORKER_BLOB_URL);
    worker.onmessage = cb;
    worker.onerror = e;

    function inlineWorker() {
      /* eslint-disable no-restricted-globals */
      /* globals self, $MAX_CACHE_SIZE*/
      var createCounter = function (text) {
        var line = -1,
          nextLinePos = 0,
          lastLinePos = -1;
        var newLine = /\r\n|\r|\n/g;
        return function getPos(offset) {
          var match;
          if (offset < lastLinePos) {
            (line = -1), (nextLinePos = 0), (lastLinePos = -1);
            newLine = /\r\n|\r|\n/g;
          }
          while (offset >= nextLinePos) {
            lastLinePos = nextLinePos;
            line++;
            match = newLine.exec(text);
            if (match) {
              nextLinePos = match.index + match[0].length;
            } else nextLinePos = Infinity;
          }
          return {
            row: line,
            column: offset - lastLinePos,
          };
        };
      };

      function findAll(re, text, path) {
        var matches = [];
        var counter = createCounter(text);
        text.replace(re, function (str) {
          var pos = arguments[arguments.length - 2];
          matches.push({
            start: counter(pos),
            end: counter(pos + str.length),
          });
        });
        self.postMessage({
          id: path,
          message: 'results',
          ranges: matches,
        });
      }
      var cached = {};
      var cachedSize = 0;
      var MAX_CACHE_SIZE = $MAX_CACHE_SIZE;

      function cache(path, res) {
        if (res.length > MAX_CACHE_SIZE * 0.75) return;
        cachedSize += res.length;
        cached[path] = res;
        if (cachedSize > MAX_CACHE_SIZE) {
          var keys = Object.keys(cached);
          keys.sort(function (e, l) {
            return cached[l].length - cached[e].length;
          });
          while (cachedSize > MAX_CACHE_SIZE * 0.75) {
            var a = keys.pop();
            cachedSize -= cached[a].length;
            delete cached[a];
          }
        }
      }

      function fromCache(path) {
        if (cached.hasOwnProperty(path)) {
          return cached[path];
        }
        return null;
      }
      self.onmessage = function (e) {
        if (e.data.hasOwnProperty('text')) {
          cache(e.data.path, e.data.text);
          findAll(e.data.re, e.data.text, e.data.id);
        } else {
          var text = fromCache(e.data.path);
          if (text === null || text.length != e.data.len) {
            self.postMessage({
              id: e.data.id,
              message: 'getFile',
            });
          } else {
            findAll(e.data.re, text, e.data.id);
          }
        }
      };
    }
    return {
      postMessage: worker.postMessage.bind(worker),
      terminate: function () {
        var a = WORKER_BLOB_URL;
        WORKER_BLOB_URL = null;
        URL.revokeObjectURL(a);
      },
    };
  };
});