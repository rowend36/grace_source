define(function (require, exports, module) {
  'use strict';
  var expect = require('chai').expect;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var TS = require('grace/ext/language/ts/ts_provider')
    .tsCompletionProvider;
  var Utils = require('grace/core/utils').Utils;
  var appEvents = require('grace/core/app_events').AppEvents;
  var override = require('override');
  var revert = require('revert');
  [
    //Globals added by ts_worker
    'TsServer',
    '__spreadArrays',
    '__assign',
    '__generator',
    '__makeTemplateObject',
    '__rest',
    '__extends',
    'ts',
    'debugObjectHost',
    'libFileMap',
    'TypeScript',
    'toolsVersion',
  ].forEach(function (e) {
    window[e] = undefined;
  });
  describe('Typescript', function () {
    var editor;
    before(function () {
      editor = getEditor();
      editor.session.setMode('ace/mode/javascript');
      override(TS, 'priority', Infinity);
    });
    after(function () {
      revert(TS, 'priority');
    });
    it('should init', function (done) {
      Utils.waterfall([
        function (n) {
          TS.init(editor, n);
        },
        function (n) {
          expect(editor.tsClient).to.be.ok;
        },
        done,
      ]);
    });
    it('should be registered', function () {
      appEvents.signal('resumeAutocomplete');
      editor.execCommand('startAutocomplete');
      expect(editor.$activeProviders).to.include(TS);
      expect(editor.getMainCompleter()).to.equal(TS.instance);
    });
    require('./javascript_tests').createTests();
  });
});