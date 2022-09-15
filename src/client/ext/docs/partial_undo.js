define(function (require, exports, module) {
  var EditSession = require('ace!edit_session').EditSession;
  var Document = require('ace!document').Document;
  var clonePos = Document.prototype.clonePos;
  var RangeList = require('ace!range_list').RangeList;
  var Range = require('ace!range').Range;

  /**
   * Perform an undo that only affects changes in selection.
   * selection can be a particular range or revision or function.
   **/
  //[     [1][2.1,2.2][-1]]
  function _partialUndo(session, selection, filters, splitDeltas) {
    if (typeof selection === 'function') {
      filters.push(selection);
    } else if (typeof selection === 'object') {
      filters.push(matchRanges(selection));
    } else {
      filters.push(matchRev(selection));
    }
    var um = session.$undoManager;
    var uStack = um.$undoStack;
    var result, match;
    do {
      match = _findDeltas(uStack, skipAll(filters), splitDeltas, match);
      if (!match) return false;
      var stack = uStack.slice(match.index + 1);
      if (match.tail) stack = [match.tail].concat(stack);
      var base = uStack[match.index][0].id;
      var startIndex =
        uStack[match.index].length -
        match.deltas.length -
        (match.tail ? match.tail.length : 0);
      var endIndex = startIndex + match.deltas.length;
      result = _invertAndApply(session, match.deltas, stack);
      if (!result) {
        filters.push(skipRev(base, startIndex, endIndex));
        continue;
      }
      if (typeof result === 'object') {
        result.$baseRev = base;
        result.$baseIndex = startIndex;
        result.$endIndex = endIndex;
      }
      return result;
    } while (true);
  }
  EditSession.prototype.partialUndo = function (selection, splitDeltas) {
    if (!selection && selection !== 0) {
      selection = this.selection.getAllRanges().map(function (e) {
        //Personally, it's intuitive to undo changes in front of the cursor not after.
        if (e.isEmpty() && e.start.column > 0)
          return Range.fromPoints(
            {column: e.start.column - 1, row: e.start.row},
            e.end,
          );
        return e.clone();
      });
    }
    var filters = [SkipIgnored];
    filters.push(skipUndos(filters));
    var result = _partialUndo(this, selection, filters, splitDeltas);
    if (result && typeof result === 'object') {
      result.isPartialUndo = true;
      return true;
    }
    return result;
  };

  /*Redo a change undone using partial redo*/
  EditSession.prototype.partialRedo = function (selection, splitDeltas) {
    if (!selection && selection !== 0) {
      selection = this.selection.getAllRanges().map(function (e) {
        return e.clone();
      });
    }
    var filters = [SkipIgnored, MatchUndos];
    filters.push(skipRedos(filters));
    var result = _partialUndo(this, selection, filters, splitDeltas);
    if (result && typeof result === 'object') {
      result.isPartialRedo = true;
      return true;
    }
    return result;
  };

  function skipAll(filters) {
    return function (delta, rev, index) {
      var result;
      for (var i = 0; i < filters.length; i++) {
        var m = filters[i](delta, rev, index, result !== false);
        if (m === false) result = false;
        else if (m === true && result === undefined) {
          result = true;
        }
      }
      return result;
    };
  }
  function matchRev(startRev) {
    return function (delta, rev, index) {
      return rev === startRev;
    };
  }
  function matchRanges(range) {
    var ranges = new RangeList();
    if (Array.isArray(range)) ranges.addList(range);
    else ranges.add(range);
    return function (deltas, rev, i, canPass) {
      var change = deltas[i];
      if (change.action === 'insert' || change.action === 'remove') {
        var m = canPass && _intersects(ranges, change);
        ranges.$onChange(_invert(change));
        return m;
      }
    };
  }
  var comparePoints = RangeList.prototype.comparePoints;
  //Like RangeList.pointIndex but for ranges. with excludeEdges
  function _intersects(rangelist, change, bias) {
    var list = rangelist.ranges;
    for (var i = 0; i < list.length; i++) {
      var range = list[i];
      var cmpEnd = comparePoints(range.end, change.start);
      if (cmpEnd === 0 && range.isEmpty()) return true;
      if (cmpEnd <= 0) {
        continue; //range is before change
      }
      var cmpStart = comparePoints(range.start, change.end);
      if (cmpStart === 0) return range.isEmpty();
      else if (cmpStart > 0) return false; //range is after change
      return true;
    }
    return false;
  }

  function SkipIgnored(delta) {
    return !delta[0].ignore && undefined;
  }

  function skipRev(startRev, startIndex, endIndex) {
    return function (delta, rev, index) {
      if (rev === startRev && index >= startIndex && index < endIndex)
        return false;
    };
  }

  //Skips previous partial undos as well as the changes they undid
  function skipUndos(filters) {
    return function (deltas, rev, i) {
      var d = deltas[0];
      if (d.isPartialUndo) {
        if (i === deltas.length - 1)
          filters.push(skipRev(d.$baseRev, d.$baseIndex, d.$endIndex));
        return false;
      }
    };
  }

  function skipRedos(filters) {
    return function (deltas, rev, i) {
      var d = deltas[0];
      if (d.isPartialRedo) {
        if (i === deltas.length - 1)
          filters.push(skipRev(d.$baseRev, d.$baseIndex, d.$endIndex));
        return false;
      }
    };
  }

  function MatchUndos(deltas, rev) {
    return deltas[0].isPartialUndo === true;
  }

  function _invert(change) {
    var m = Object.assign({}, change);
    m.action = change.action === 'insert' ? 'remove' : 'insert';
    return m;
  }
  function _findDeltas(stack, onMatchRev, splitDeltas, prevMatch) {
    var start = prevMatch ? prevMatch.index : stack.length - 1;
    for (var i = start; i > -1; i--) {
      var deltaSet = stack[i],
        rev = deltaSet[0].id,
        tail;
      var matched = Boolean(onMatchRev(deltaSet, rev, deltaSet.length - 1));
      if (splitDeltas || !matched) {
        //selection for split points
        for (var j = deltaSet.length - 2; j > -1; j--) {
          if (Boolean(onMatchRev(deltaSet, rev, j)) !== matched) break;
        }
        if (j > -1) {
          if (splitDeltas) {
            var slice = deltaSet.slice(j + 1);
            if (matched) {
              deltaSet = slice;
            } else {
              tail = slice;
              for (var k = j; k > -1; k--) {
                if (Boolean(onMatchRev(deltaSet, rev, k)) === matched) break;
              }
              matched = true;
              deltaSet = deltaSet.slice(k + 1, j + 1);
            }
          } else matched = true;
        }
      }
      if (matched) {
        return {tail: tail, deltas: deltaSet, index: i};
      }
    }
  }
  function _invertAndApply(session, deltas, after) {
    var inverse = [];
    var doc = session.getDocument();
    var um = session.getUndoManager();
    console.log({after, deltas});
    if (
      //Optimization for when the change is at the top of the undo stack.
      after.length === 0 &&
      !deltas[0].ignore &&
      (deltas[0].isPartialRedo || deltas[0].isPartialUndo) &&
      //Ensure we do not mess up keepRedoStack.
      (um.$redoStack.length === 0 || um.$redoStackBaseRev !== deltas[0].id)
    ) {
      var d = um.$redoStack;
      um.$redoStack = [];
      um.undo(session, true);
      um.$redoStack = d;
      console.log('popped');
      return true;
    }
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
    //transform the change
    inverse = [inverse];
    um.transformDeltas(inverse, after);
    if (!inverse.length) return false;
    um.startNewGroup();
    //apply the change
    var len = um.$undoStack.length;
    var initial = um.$keepRedoStack;
    um.$keepRedoStack = true;
    for (var l = 0; l < inverse.length; l++) {
      for (var m = 0; m < inverse[l].length; m++) {
        doc.$safeApplyDelta(inverse[l][m]);
      }
    }
    um.$keepRedoStack = initial;
    //return the revision
    if (um.$undoStack.length !== len + 1)
      throw new Error('Assertion failed!!!');
    return um.$undoStack[len][0];
  }
});