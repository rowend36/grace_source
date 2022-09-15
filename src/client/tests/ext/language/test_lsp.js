define(function (require, exports, module) {
  'use strict';
  var LSP = require('grace/ext/language/lsp/lsp_provider').getLanguageServer({
    name: 'Test',
    address: 'ws://localhost:3000/typescript/test',
    priority: 0,
    languageId: 'javascript',
    modes: ['javascript', 'typescript'],
  });
  [
    //Globals added by lsp_client
    'lspDeps',
  ].forEach(function (e) {
    window[e] = undefined;
  });
  describe('Language Services', function () {
    require('./javascript_tests').createTests(LSP);
  });
});