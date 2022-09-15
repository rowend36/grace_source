define(function (require, exports, module) {
  'use strict';
  var expect = require('chai').expect;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var tern = require('grace/ext/language/tern/tern_provider')
    .ternCompletionProvider;
  var Utils = require('grace/core/utils').Utils;
  var appEvents = require('grace/core/app_events').AppEvents;
  var override = require('override');
  var revert = require('revert');
  [
    //Globals added by tern_worker
    'tern_Defs',
    'acorn',
    'tern',
  ].forEach(function (e) {
    window[e] = undefined;
  });
  describe('Tern', function () {
    var editor;
    before(function () {
      editor = getEditor();
      editor.session.setMode('ace/mode/javascript');
      override(tern, 'priority', Infinity);
    });
    after(function () {
      revert(tern, 'priority');
    });
    it('should init', function (done) {
      Utils.waterfall([
        function (n) {
          tern.init(editor, n);
        },
        function () {
          expect(editor.ternClient).to.be.ok;
        },
        done,
      ]);
    });
    it('should be registered', function () {
      appEvents.signal('resumeAutocomplete');
      editor.execCommand('startAutocomplete');
      expect(editor.$activeProviders).to.include(tern);
      expect(editor.getMainCompleter()).to.equal(tern.instance);
    });
    require('./javascript_tests').createTests();
  });
});