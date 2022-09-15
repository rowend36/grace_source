define(function (require, exports, module) {
  "use strict";
  var openDoc = require("./mixin_docs_tabs").openDoc;
  var closeDoc = require("./mixin_docs_tabs").closeDoc;
  var $dmpDiffToAceDeltas = require("./docs_base").$dmpDiffToAceDeltas;
  var Docs = require("./docs_base").Docs;
  Object.assign(
    Docs,
    //TODO save blobs should be in a different place
    require("./mixin_docs_blob"),
    require("./mixin_docs_save"),
    require("./mixin_docs_tabs"),
    require("./mixin_docs_persist")
  );
  exports.Docs = Docs;
  exports.$dmpDiffToAceDeltas = $dmpDiffToAceDeltas;
  exports.openDoc = openDoc;
  exports.closeDoc = closeDoc;
}); /*_EndDefine*/