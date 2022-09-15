define(function (require, exports, module) {
  'use strict';
  
  var tern = require('grace/ext/language/tern/tern_provider')
    .ternCompletionProvider;
  [
    //Globals added by tern_worker
    'tern_Defs',
    'acorn',
    'tern',
  ].forEach(function (e) {
    window[e] = undefined;
  });
  describe('Tern', function () {
    require('./javascript_tests').createTests(tern);
  });
});