define(function (require, exports, module) {
  'use strict';
  var TS = require('grace/ext/language/ts/ts_provider').tsCompletionProvider;
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
    require('./javascript_tests').createTests(TS);
  });
});