define(function (require, exports, module) {
  var emmetExt = require('ace!ext/emmet');
  var noop = require('grace/core/utils').Utils.noop;
  var Editors = require('grace/editor/editors').Editors;
  //Setup plugins
  emmetExt.load = require('grace/core/depend').after(function (cb) {
    require(['./libs/emmet'], function (em) {
      emmetExt.setCore(em);
      cb();
    });
  });
  emmetExt.isSupportedMode = noop;
  //Add this the way we know how.
  Editors.getSettingsEditor().addOption('enableEmmet');
});