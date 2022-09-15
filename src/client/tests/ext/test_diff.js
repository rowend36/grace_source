define(function (require, exports, module) {
  'use strict';
  var diff = require('grace/ext/diff/diff');
  require('../docs/test_docs_tabs');
  var Doc = require('grace/docs/document').Doc;
  var text = require('text!./test_diff');
  describe('Diff', function () {
    it('should work', function (done) {
      diff.registerDiffFactory('test', function (doc, data, cb) {
        if (data) {
          cb(data.content, 'TEST', data);
        }
      });
      var doc = new Doc(text);
      diff.createDiffView(
        'test',
        doc,
        {content: text.replace(/function/g, 'fun')},
        true
      );
    });
  });
});