define(function (require, exports, module) {
  'use strict';
  var expect = require('chai').expect;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var LSP = require('grace/ext/language/lsp/lsp_provider').getLanguageServer({
    name: 'Test',
    address: 'ws://localhost:3000/typescript/test',
    priority: 0,
    languageId: 'javascript',
    modes: ['javascript', 'typescript'],
  });
  var Utils = require('grace/core/utils').Utils;
  var appEvents = require('grace/core/app_events').AppEvents;
  var override = require('override');
  var revert = require('revert');
  [
    //Globals added by lsp_client
    'lspDeps',
  ].forEach(function (e) {
    window[e] = undefined;
  });
  describe('Language Services', function () {
    var editor;
    before(function () {
      editor = getEditor();
      editor.session.setMode('ace/mode/javascript');
      override(LSP, 'priority', Infinity);
    });
    after(function () {
      revert(LSP, 'priority');
    });
    it('should init', function (done) {
      Utils.waterfall([
        function (n) {
          LSP.init(editor, n);
        },
        function (n) {
          expect(editor.Test_LSP).to.be.ok;
        },
        done,
      ]);
    });
    it('should be registered', function () {
      appEvents.signal('resumeAutocomplete');
      editor.execCommand('startAutocomplete');
      expect(editor.$activeProviders).to.include(LSP);
      expect(editor.getMainCompleter()).to.equal(LSP.instance);
    });
    require('./javascript_tests').createTests();
  });
});