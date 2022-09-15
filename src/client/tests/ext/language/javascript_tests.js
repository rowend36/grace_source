define(function (require, exports, module) {
  'use strict';
  var applyChanges = require('grace/ext/language/base_client').ClientUtils
    .applyChanges;
  var Utils = require('grace/core/utils').Utils;
  var waterfall = Utils.waterfall;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var expect = require('chai').expect;
  require('ace!mode/javascript');

  exports.createTests = function () {
    var editor, ts;

    function setup(lines) {
      var cursor = lines
        .replace(/\n/g, editor.session.getDocument().getNewLineCharacter())
        .indexOf('^');
      editor.setValue(lines.replace('^', ''));
      editor.clearSelection();
      cursor = editor.session.getDocument().indexToPosition(cursor);
      editor.selection.moveCursorTo(cursor.row, cursor.column);
    }
    it('!setup', function (done) {
      this.timeout(7000); //Take up to 7s for first start
      editor = getEditor();
      ts = editor.getMainCompleter();
      waterfall([
        function (n) {
          setup('document.^');
          ts.getCompletions(editor, null, null, null, n);
        },
        true, //Wait for setup
        done,
      ]);
    });
    it('should get completions', function (done) {
      waterfall([
        function (n) {
          setup('document.^');
          ts.getCompletions(editor, null, null, null, n);
        },
        function (err, res) {
          expect(res).to.be.an('array');
          expect(
            res.map(function (e) {
              return e.value;
            })
          ).to.include.members(['getElementById', 'activeElement']);
        },
        done,
      ]);
    });
    it('should show type', function (done) {
      waterfall([
        function (n) {
          setup('var a^ = "hi"');
          ts.requestType(editor, null, n);
        },
        function (err, res) {
          expect(res).to.be.ok;
          if (res.name) expect(res.name).to.equal('string');
        },
        done,
      ]);
    });
    it('should rename items', function (done) {
      waterfall([
        function (n) {
          setup('var a^ = "hi"\na="hello"');
          ts.setupForRename(editor, 'pako', n);
        },
        function (n, e, data) {
          console.log(data);
          expect(data).to.be.ok;
          applyChanges(ts, data.refs, 'pako', n);
        },
        function (results) {
          expect(results.replaced).to.equal(2);
          expect(editor.getValue()).to.equal('var pako = "hi"\npako="hello"');
        },
        done,
      ]);
    });
    it('should get definition', function (done) {
      waterfall([
        function (n) {
          setup(
            '\
var foo = "hi:"\n\
function pop(foo){\n\
  foo="hello"\n\
}\n\
pop(foo^)'
          );
          ts.jumpToDef(editor, n);
        },
        function (n) {
          var c = editor.selection.getRange();
          expect(c.start).to.eql({
            row: 0,
            column: 4,
          });
          expect(c.end).to.eql({
            row: 0,
            column: 7,
          });
          setup(
            '\
var foo = "hi:"\n\
function pop(foo){\n\
  foo^="hello"\n\
}\n\
pop(foo)'
          );
          ts.jumpToDef(editor, n);
        },
        function () {
          var c = editor.selection.getRange();
          expect(c.start).to.eql({
            row: 1,
            column: 13,
          });
          expect(c.end).to.eql({
            row: 1,
            column: 16,
          });
        },
        done,
      ]);
    });

    it('should apply formatting', function (done) {
      if (!ts.format) return this.skip();
      waterfall([
        function (n) {
          setup('\
function pop(foo){\n\
foo=hello\n\
}');
          ts.format(
            editor.session,
            {
              indent_char: ' ',
              indent_size: 4,
            },
            n
          );
        },
        function (n) {
          expect(editor.session.getLine(1)).to.equal('    foo = hello');
        },
        done,
      ]);
    });
  };
});