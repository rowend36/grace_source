define(function (require, exports, module) {
  'use strict';
  var storage = require('../core/config').storage;
  var determineQuota = require('./mixin_docs_blob').$determineQuota;
  var openDoc = require('./mixin_tabs_populator').openDoc;
  var loadBlob = require('./mixin_docs_blob').loadBlob;
  var getBlobInfo = require('./mixin_docs_blob').getBlobInfo;
  var Doc = require('./document').Doc;
  var debug = console;
  var inspectMemory = function () {
    var t =
      storage.getKeys && typeof storage.getKeys == 'function'
        ? (function () {
            var keys = storage.getKeys();
            var obj = {};
            keys.forEach(function (e) {
              obj[e] = storage.getItem(e);
              //don't get how this returns undefined
              if (obj[e] && obj[e].length > 100)
                obj[e] = obj[e].substring(0, 100) + '...';
            });
            return obj;
          })()
        : Object.create(storage);
    t['!determinedQuota'] = determineQuota();
    openDoc('memory_dump', JSON.stringify(t), {
      mode: 'json',
    });
  };
  var recoverDoc = function () {
    var keys = exports.allBlobs('stashExpiry');
    require('../core/utils').Utils.asyncForEach(keys, function (e, i, n) {
      var doc = new Doc('', 'temp://' + getBlobInfo(e).type);
      loadBlob(e, function (data) {
        try {
          data = typeof data == 'object' ? data : JSON.parse(data);
          openDoc('recovery', doc);
          doc.unserialize(data);
        } catch (e) {
          debug.error(e);
        }
      });
      n();
    });
  };
  exports.$recovery = recoverDoc;
  exports.$inspect = inspectMemory;
});