define(function (require, exports, module) {
  'use strict';
  var Editors = require('grace/editor/editors').Editors;
  function onAfterExec_Beautify(e) {
    var editor = e.editor;
    if (e.command.name === 'insertstring' && e.args === '}') {
      var m = editor.session.getInnerMode();
      if (m !== 'javascript' && m !== 'css') {
        return;
      }
      var sel = editor.getSelection();
      var range = sel.getRange();
      var pos = range.end;
      var tok = editor.session.getTokenAt(pos.row, pos.column);
      if (tok) {
        if (
          tok.type.indexOf('paren') > -1 &&
          tok.type.toString().indexOf('comment') === -1
        ) {
          //bracket just inserted - move back one character before jumpting to matching or it wont work correctly (executing it after the newly inserted char can cause issues in some instances)
          var start = range.start;
          start.column--;
          sel.setSelectionRange(Range.fromPoints(start, start));
          editor.jumpToMatching(true); //jumpto and select
          //now move end of selection back one char, to include the newly inserted bracket, and start of selection one char to include start bracket
          var newRange = sel.getRange();
          var end = newRange.end;
          end.column++;
          start = newRange.start;
          start.column--;
          sel.setSelectionRange(Range.fromPoints(start, end));
          //now beautify the selection
          editor.execCommand('beautify', true);
        }
      }
    }
  }

  Editors.getSettingsEditor().addOption('autoBeautify', {
    set: function (val) {
      if (val) this.commands.on('afterExec', onAfterExec_Beautify);
      else this.commands.off('afterExec', onAfterExec_Beautify);
    },
    value: false,
  });
});