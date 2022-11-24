define(function (require, exports, module) {
  'use strict';
  var Range = require('ace!range').Range;
  var Notify = require('grace/ui/notify').Notify;
  var Docs = require('grace/docs/docs').Docs;
  var Actions = require('grace/core/actions').Actions;
  var $dmpDiffToAceDeltas = require('grace/docs/docs').$dmpDiffToAceDeltas;
  var getFormatter = require('./formatters').getFormatter;
  /**
   * @returns {string} mode at cursor position (examples: javascript|html|css)
   * @param {editor} editor - editor instance
   * @param {bool} [allowNestedMode=false] - pass true return nested mode if in mixed html mode
   */
  function getCurrentMode(editor, allowNestedMode) {
    return allowNestedMode
      ? editor.session.getInnerMode()
      : editor.session.getModeName();
  }
  /**
   * @returns {string} nested mode for passed row (if any) or empty string
   * @param {int} rowNum - row number
   * @note for css and javascript nested in html only
   */
  function getNestedModeforRow(editor, rowNum) {
    return editor.session.getInnerMode({row: rowNum, column: 0});
  }
  /**
   * executes beautify on currently selected code or all code if nothing is selected
   * @param {Editor} editor
   * @param {boolean} [unselect=false] - pass true to unselect the selection after execution
   * @param {boolean} [removeBlanks=false] - pass true to remove unnecessary blank and EOL space instead of beautify (same as NotePad++ command)
   * @param {boolean} [silent=false] - Disable user notification when beautify fails
   */
  function beautify(editor, unselect, removeBlanks, silent) {
    //#region determine range to beautify
    var sel = editor.getSelection();
    var session = editor.session;
    var range = sel.getRange();
    //if nothing is selected, then select all
    var formatAll = false;
    var originalRangeStart = range.start;
    if (
      range.start.row === range.end.row &&
      range.start.column === range.end.column
    ) {
      range.start.row = 0;
      range.start.column = 0;
      var lastLine = editor.session.getLength() - 1;
      range.end.row = lastLine;
      range.end.column = editor.session.getLine(lastLine).length;
      formatAll = true;
    }
    //#endregion
    //#region beautify options
    var rangeContainsIndent = true;
    var indent;
    var options = {};
    if (!removeBlanks) {
      if (session.getUseSoftTabs()) {
        options.indent_char = ' ';
        options.indent_size = session.getTabSize();
      } else {
        options.indent_char = '\t';
        options.indent_size = 1;
      }
      var line = session.getLine(range.start.row);
      indent = line.match(/^\s*/)[0];
      if (range.start.column < indent.length) range.start.column = 0;
      else rangeContainsIndent = false;
    }
    //#endregion
    //#region get value, set mode
    if (removeBlanks) {
      var value = session.getTextRange(range);
      //remove multiple blank lines, trailing spaces and multispace between words
      value = value
        .replace(/ +$|(\S ) +(\S)/gm, '$1$2')
        .replace(/((?:\r\n|\n|\r){3})(?:\r\n|\n|\r)*/g, '$1');
      updateSession(
        session,
        value,
        sel,
        originalRangeStart,
        range,
        formatAll,
        unselect
      );
      return true;
    }
    //#region execute beautify
    // var standardNewLineChar = '\n',
    var editorNewLineChar = session.doc.getNewLineCharacter();
    // needToNormalize = standardNewLineChar != editorNewLineChar;
    var detectedMode = getCurrentMode(editor, false);
    //for html, allow using a nested formatter if the entire range is nested (css and javascript only)
    if (
      detectedMode == 'html' ||
      detectedMode == 'php' ||
      detectedMode == 'svg'
    ) {
      if (!formatAll) {
        //if formatting all then entire thing wont be the nested mode
        var nestedMode = getCurrentMode(editor, true);
        if (['javascript', 'css'].indexOf(nestedMode) !== -1) {
          var useNested = true;
          for (var i = range.start.row; i < range.end.row; i++) {
            if (getNestedModeforRow(editor, i) != nestedMode) {
              useNested = false;
              break;
            }
          }
          if (useNested) detectedMode = nestedMode;
        }
      }
    }
    //#endregion
    var doc = Docs.forSession(session);
    var formatter = getFormatter(detectedMode, doc && doc.getSavePath());
    if (!formatter) {
      if (!silent) Notify.warn('Unable to find formatter for this file');
      return false;
    }
    //TODO reduce the complexity of this function.
    formatter(
      session,
      options,
      function (value, newCursorPos, clientShouldFixIndent) {
        if (typeof value == 'string') {
          if (clientShouldFixIndent) {
            value = value.replace(/\r\n|\r|\n/g, '$&' + indent).trim();
          }
          if (range.end.column === 0) {
            value += editorNewLineChar + indent;
          }
        }
        updateSession(
          session,
          value,
          sel,
          newCursorPos || originalRangeStart,
          range,
          formatAll,
          unselect
        );
      },
      {
        //the number of characters that indent the first line
        baseIndent: indent,
        //Currently neither used by beautify nor handled by any plugin
        //Since changes are applied as a diff
        cursor: originalRangeStart,
        silent: silent,
        editor: editor,
        //When in partial formatting, shows whether text starts
        //from beginning of the line
        isPartialFormat: !formatAll,
        range: range,
        rangeContainsIndent: rangeContainsIndent,
      }
    );
    return true;
  }

  function updateSession(
    session,
    value,
    sel,
    cursorPosition,
    range,
    formattedAll,
    unselect
  ) {
    try {
      if (!value || value == session) return;
      var deltas;
      if (typeof value == 'object') {
        //Array of deltas or diffs
        if (!value[0] || value[0].start) {
          deltas = value;
        } else
          deltas = $dmpDiffToAceDeltas(
            value,
            formattedAll ? 0 : range.start.row,
            formattedAll ? 0 : range.start.column
          );
      } else {
        //Doc.prototype.updateValue
        if (formattedAll) {
          session.getDocument().$detectNewLine(value);
        }
        deltas = Docs.generateDiff(
          formattedAll ? session.getValue() : session.getTextRange(range),
          value,
          formattedAll ? 0 : range.start.row,
          formattedAll ? 0 : range.start.column
        );
      }
      // var end = range.start;
      session.markUndoGroup();
      for (var i = 0; i < deltas.length; i++) {
        session.doc.applyDelta(deltas[i]);
      }
      if (0 < deltas.length) {
        // end = deltas[deltas.length - 1].end;
      }
      if (!formattedAll) {
        if (unselect) {
          sel.setSelectionRange(
            Range.fromPoints(cursorPosition, cursorPosition)
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  exports.beautify = beautify;
  exports.FormatCommands = [
    {
      name: 'beautify',
      bindKey: {
        mac: 'Command-B',
        win: 'Ctrl-B',
      },
      icon: 'format_align_justify',
      showIn: 'actionbar.edit',
      exec: beautify,
      readOnly: false,
    },
    {
      name: 'removeBlanks',
      bindKey: {
        mac: 'Command-Shift-B',
        win: 'Ctrl-Shift-B',
      },
      exec: function (editor) {
        beautify(editor, false, true);
      },
      readOnly: false,
    },
  ];
  Actions.addActions(exports.FormatCommands);
});