define(function (require, exports, module) {
  var cmp = ace.require('ace/range').comparePoints;
  var EditSession = ace.require('ace/edit_session').EditSession;
  var Document = ace.require('ace/document').Document;
  var clonePos = Document.prototype.clonePos;
  /**
   * Perform an undo that only affects changes in selection.
   * selection can be a particular range or revision or function.
   **/
  EditSession.prototype.partialUndo = function (selection, splitDeltas) {
    if (!selection) selection = this.selection;
    var filter;
    if (typeof selection === 'function') {
      filter = selection;
    } else if (typeof selection === 'object') {
      filter = function (deltas, id, i) {
        if (deltas[0].ignore) return false;
        //selection if change does not end before the range or start after it.
        return !(
          cmp(deltas[i].end, selection.start) < 0 ||
          cmp(deltas[i].start, selection.end) > 0
        );
      };
      if (splitDeltas == null) splitDeltas = true;
    } else {
      filter = function (deltas, rev) {
        if (!deltas[0].ignore) return rev === selection;
      };
    }
    var um = this.getUndoManager();
    var stack = um.$undoStack;
    var match = _findDeltas(stack, filter, splitDeltas);
    if (!match) return false;
    if (match.tail) stack = [match.tail].concat(stack);
    var deltas = match.deltas;
    var inverse = [];
    //invert the change
    for (var i = deltas.length - 1; i > -1; i--) {
      if (deltas[i].action === 'remove' || deltas[i].action === 'insert') {
        inverse.push({
          start: clonePos(deltas[i].start),
          end: clonePos(deltas[i].end),
          action: deltas[i].action === 'insert' ? 'remove' : 'insert',
          lines: deltas[i].lines.slice(),
        });
      }
    }
    for (var j = match.index + 1; j < stack.length; j++) {
      var deltaSet = stack[j];
      for (var k = 0; k < deltaSet.length; k++) {
        um.transformDeltas(inverse, deltaSet[k]);
      }
    }
    var rev = um.startNewGroup();
    this.getDocument().applyDeltas(inverse);
    return rev;
  };

  function _findDeltas(stack, onMatchRev, splitDeltas) {
    if (stack.length < 1) return false;
    for (var i = stack.length - 1; i > -1; i--) {
      var deltaSet = stack[i],
        rev = deltaSet[0].id,
        tail;
      var matched = Boolean(onMatchRev(deltaSet, rev, deltaSet.length - 1));
      if (splitDeltas) {
        //selection for split points
        for (var j = deltaSet.length - 2; j > -1; j--) {
          if (Boolean(onMatchRev(deltaSet, rev, j)) !== matched) break;
        }
        if (j > -1) {
          var slice = deltaSet.slice(j + 1);
          if (matched) {
            deltaSet = slice;
          } else {
            tail = slice;
            for (var k = j; k > -1; k--) {
              if (Boolean(onMatchRev(deltaSet, rev, k)) === matched) break;
            }
            deltaSet = deltaSet.slice(k + 1, j + 1);
          }
        }
      }
      if (matched) {
        return {tail: tail, deltas: deltaSet, index: i};
      }
    }
  }
});