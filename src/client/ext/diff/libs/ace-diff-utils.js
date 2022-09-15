(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require());
  } else {
    root.AceDiffUtils = factory(root);
  }
})(this, function (exports) {
  var Range = ace.require('ace/range').Range;
  var dmp;

  var DIFF_EQUAL = 0;
  var DIFF_DELETE = -1;
  var DIFF_INSERT = 1;
  var EDITOR_RIGHT = 'right'; //added
  var EDITOR_LEFT = 'left'; //removed

  //getDiff,getChunk: copied from codemirror merge.js
  var Pos = function (line, ch) {
    if (!this) return new Pos(line, ch);
    this.line = line || 0;
    this.ch = ch || 0;
    this.toAce = function () {
      return {
        row: this.line,
        column: this.ch,
      };
    };
  };

  /*globals diff_match_patch*/
  function getDiffs(text1, text2, options, ctx, allowLine) {
    if (!dmp) dmp = new diff_match_patch();
    // var tag = ctx.savedDiffs ? "cached " : "clean ";
    if (allowLine && !options.showInlineDiffs) {
      if (options.ignoreWhitespace) {
        text1 = text1.replace(/^( |\t)*|( |\t)*$/gm, '');
        text2 = text2.replace(/^( |\t)*|( |\t)*$/gm, '');
      }
      ctx.savedDiffs = ctx.savedDiffs
        ? updateDiff(text1, text2, ctx.swapped, ctx.savedDiffs, getLineDiff)
        : getLineDiff(text1, text2, false, ctx.swapped);
      return getChunksFromLineDiff(ctx.savedDiffs);
    } else {
      if (ctx.savedDiffs) {
        var updated = updateDiff(
          text1,
          text2,
          ctx.swapped,
          ctx.savedDiffs,
          getCharDiff
        );
        cleanUpLines(updated);
        ctx.savedDiffs = updated;
      } else ctx.savedDiffs = getCharDiff(text1, text2, false, ctx.swapped);
      if (options.showInlineDiffs) {
        ctx.rawDiffs = ctx.savedDiffs;
      }
      return getChunksFromCharDiff(
        options.ignoreWhitespace
          ? filterWhiteSpace(ctx.savedDiffs)
          : ctx.savedDiffs
      );
    }
  }

  function getLineDiff(text1, text2, ignoreWhitespace, swap) {
    // if (!/\n$/.test(text1))
    text1 += '\n';
    // if (!/\n$/.test(text2))
    text2 += '\n';
    if (ignoreWhitespace) {
      text1 = text1.replace(/^( |\t)*|( |\t)*$/gm, '');
      text2 = text2.replace(/^( |\t)*|( |\t)*$/gm, '');
    }
    var a = dmp.diff_linesToChars_(text1, text2);
    var lineText1 = a.chars1;
    var lineText2 = a.chars2;
    var lineArray = a.lineArray;
    var diff = dmp.diff_main(lineText1, lineText2, false);
    dmp.diff_charsToLines_(diff, lineArray);
    if (swap) {
      for (var i = 0; i < diff.length; ++i) {
        diff[i][0] = -diff[i][0];
      }
    }
    return diff;
  }

  function getChunksFromLineDiff(diff) {
    /*
        returns output of the form
        [{
            leftStartLine: offset
            leftEndLine: offset
            rightStartLine: offset
            rightEndLine: offset
            chunks: text
        }]
        */
    var diffs = [];
    var offset = {
      left: 0,
      right: 0,
      trailinglines: null,
    };
    var last = null;
    diff.forEach(function (chunk, i) {
      var obj = transformDiff(chunk, offset, last);
      if (obj) {
        if (last) {
          mergeDiff(last, obj);
        } else {
          diffs.push(obj);
        }
      }
      last = obj;
    });
    return diffs;
  }

  function transformDiff(chunk, offset, last) {
    /*returns output of the form
        {
            leftStartLine: offset
            leftEndLine: offset
            rightStartLine: offset
            rightEndLine: offset
            chunks: text
            trailinglines: number
        }
        */
    var trailinglines = offset.trailinglines;
    var chunkType = chunk[0];
    var text = chunk[1];
    // oddly, occasionally the algorithm returns a diff with no changes made
    if (text.length === 0) {
      return;
    }

    var numlines = text.split('\n').length;
    var endsWithNewline = /\n$/.test(text);
    if (endsWithNewline) {
      numlines--;
    }
    var obj = null;
    if (chunkType == DIFF_EQUAL) {
      offset.left += numlines;
      offset.right += numlines;
      if (trailinglines) {
        //floating equal lines are forced down
        //(prepended to next line)
        if (/^\n+$/.test(text)) {
          var type =
            trailinglines[0] == DIFF_INSERT ? EDITOR_RIGHT : EDITOR_LEFT;
          obj = {
            leftStartLine: offset.left,
            leftEndLine: offset.left,
            rightStartLine: offset.right,
            rightEndLine: offset.right,
          };
          last[type + 'EndLine'] -= trailinglines[1];
          obj[type + 'StartLine'] -= trailinglines[1];
          last.chunks = text.split('\n');
          offset.trailinglines = null;
          return obj;
        } else {
          offset.trailinglines = null;
        }
      }
      return;
      //pass
    }
    if (endsWithNewline) {
      var countNewlines = /\n+$/.exec(text)[0].length;
      if (countNewlines > 1) {
        if (trailinglines) console.warn('Unexpected trailing empty lines');
        trailinglines = [chunkType, countNewlines - 1];
      }
    }

    obj = {
      leftStartLine: offset.left,
      leftEndLine: offset.left,
      rightStartLine: offset.right,
      rightEndLine: offset.right,
      chunks: text.split('\n'),
    };
    obj[chunkType == DIFF_INSERT ? 'rightEndLine' : 'leftEndLine'] += numlines;
    offset[chunkType == DIFF_INSERT ? 'right' : 'left'] += numlines;
    offset.trailinglines = trailinglines;
    return obj;
  }

  function mergeDiff(dest, src) {
    dest.leftStartLine = Math.min(dest.leftStartLine, src.leftStartLine);
    dest.rightStartLine = Math.min(dest.rightStartLine, src.rightStartLine);
    dest.leftEndLine = Math.max(dest.leftEndLine, src.leftEndLine);
    dest.rightEndLine = Math.max(dest.rightEndLine, src.rightEndLine);
  }

  function getCharDiff(a, b, ignoreWhitespace, swap, rawDiffs) {
    var diff = rawDiffs || dmp.diff_main(a, b);
    cleanUpLines(diff);
    if (swap) {
      for (var i = 0; i < diff.length; ++i) {
        diff[i][0] = -diff[i][0];
      }
    }
    return diff;
  }

  function getChunksFromCharDiff(diff) {
    var chunks = [];
    if (!diff.length) return chunks;
    var startRight = 0,
      startLeft = 0;
    var right = Pos(0, 0),
      left = Pos(0, 0);
    for (var i = 0, p = diff.length; i < p; ++i) {
      var part = diff[i],
        tp = part[0];
      if (tp == DIFF_EQUAL) {
        var startOff = left.ch || right.ch ? 1 : 0;
        var cleanFromRight = right.line + startOff,
          cleanFromLeft = left.line + startOff;
        moveOver(right, part[1], null, left);
        var endOff =
          i == p - 1 || (i == p - 2 && diff[p - 1][1][0] == '\n') ? 1 : 0; //(left.ch === 0 && right.ch === 0) ? 0 : 0;
        var cleanToRight = right.line + endOff,
          cleanToLeft = left.line + endOff;
        if (cleanToRight > cleanFromRight) {
          if (i)
            chunks.push({
              leftStartLine: startLeft,
              leftEndLine: cleanFromLeft,
              rightStartLine: startRight,
              rightEndLine: cleanFromRight,
            });
          startRight = cleanToRight;
          startLeft = cleanToLeft;
        }
      } else {
        moveOver(tp == DIFF_INSERT ? right : left, part[1]);
      }
    }
    if (startRight <= right.line || startLeft <= left.line)
      chunks.push({
        leftStartLine: startLeft,
        leftEndLine: left.line + 1,
        rightStartLine: startRight,
        rightEndLine: right.line + 1,
      });
    return chunks;
  }

  function moveOver(pos, str, copy, other) {
    var out = copy ? Pos(pos.line, pos.ch) : pos,
      at = 0;
    for (;;) {
      var nl = str.indexOf('\n', at);
      if (nl == -1) break;
      ++out.line;
      if (other) ++other.line;
      at = nl + 1;
    }
    out.ch = (at ? 0 : out.ch) + (str.length - at);
    if (other) other.ch = (at ? 0 : other.ch) + (str.length - at);
    return out;
  }

  function filterWhiteSpace(diff) {
    var SPACE = /[^ \t]/;
    diff = diff.slice(0);
    for (var i = 0; i < diff.length; ++i) {
      var part = diff[i];
      if (!SPACE.test(part[1])) {
        diff.splice(i--, 1);
      } else if (i && diff[i - 1][0] == part[0]) {
        diff.splice(i--, 1);
        diff[i] = [diff[i][0], diff[i][1] + part[1]];
      }
    }
    return diff;
  }

  function cleanUpLines(diff) {
    //alternative to using start of line
    //and end of line clean
    //try to make equal rows
    //end with newlines when possible
    //dmp.diff_cleanupEfficiency(diff);
    for (var i = diff.length; i-- > 2; ) {
      if (diff[i][0] === 0) {
        //equal row
        if (diff[--i][0]) {
          //unequal row between
          if (diff[i - 1][0] === 0) {
            //two equal rows
            shift(diff[i - 1], diff[i], diff[i + 1]);
          }
        }
      }
    }
  }

  function shift(before, center, after) {
    var eq1 = before[1];
    var diff = center[1];
    var start = eq1.lastIndexOf('\n');
    if (start > -1 && start < eq1.length - 1) {
      //make equal center start on new line
      var trail = eq1.substring(start + 1);
      if (diff.endsWith(trail)) {
        before[1] = before[1].substring(0, start + 1);
        center[1] = trail + diff.substring(0, diff.length - trail.length);
        after[1] = trail + after[1];
        return;
      }
    }
    var eq2 = after[1];
    start = eq2.indexOf('\n');
    if (start > -1 && start < eq2.length - 1) {
      var head = eq2.substring(0, start + 1);
      if (diff.startsWith(head)) {
        before[1] = eq1 + head;
        center[1] = diff.substring(head.length) + head;
        after[1] = after[1].substring(head.length);
      }
    }
  }

  var LAST_EQUAL = 0;
  var STOP_REMOVE = 1;
  var STOP_INSERT = 2;
  var UNCHANGED = 3;
  function _unChangedHead(text1, text2, diffs, len) {
    var start1 = 0,
      start2 = 0;
    var last = -1,
      saved1 = 0,
      saved2 = 0;
    for (var i = 0; i < len; i++) {
      var type = diffs[i][0];
      var text = diffs[i][1];
      if (type >= 0) {
        if (text2.substring(start2, start2 + text.length) == text) {
          start2 += text.length;
        } else break;
      }
      if (type <= 0) {
        if (text1.substring(start1, start1 + text.length) == text) {
          start1 += text.length;
        } else break;
      }
      if (type === 0) {
        saved1 = start1;
        saved2 = start2;
        last = i;
      }
    }
    return {
      0: last,
      1: saved1,
      2: saved2,
      3: i == len && start1 == text1.length && start2 == text2.length,
    };
  }

  function _unChangedTail(text1, text2, diffs, begin) {
    var start1 = text1.length,
      start2 = text2.length;
    var last = diffs.length,
      saved1 = start1,
      saved2 = start2;

    if (last - begin < 3 || diffs[last - 1][0]) return [last, saved1, saved2];
    for (var i = last - 1; ; i--) {
      var type = diffs[i][0];
      var text = diffs[i][1];
      if (type >= 0) {
        if (text2.substring(start2 - text.length, start2) == text) {
          start2 -= text.length;
        } else break;
      }
      if (type <= 0) {
        if (text1.substring(start1 - text.length, start1) == text) {
          start1 -= text.length;
        } else break;
      }
      if (type === 0) {
        saved1 = start1;
        saved2 = start2;
        last = i;
        if (i - begin < 4) break;
      }
    }
    return {
      0: last,
      1: saved1,
      2: saved2,
    };
  }
  //Find a equal row that starts length chars away from end
  function trimChangeHead(diffs, length, data) {
    var len = diffs.length - 1;
    for (var i = len; i >= 0; i--) {
      var type = diffs[i][0];
      var textL = diffs[i][1].length;
      if (type == 0) {
        length -= textL;
        if (length < 0) {
          break;
        }
      }
      if (type >= 0) {
        data[STOP_INSERT] -= textL;
      }
      if (type <= 0) {
        data[STOP_REMOVE] -= textL;
      }
    }
    diffs.splice(i + 1);
    data[LAST_EQUAL] = i;
  }
  //Find an equal row that starts length chars away from start
  function trimChangeTail(diffs, length, data) {
    var len = diffs.length - 1;
    for (var i = 0; i <= len; i++) {
      var type = diffs[i][0];
      var textL = diffs[i][1].length;
      if (type == 0) {
        length -= textL;
        if (length < 0) {
          break;
        }
      }
      if (type >= 0) {
        data[STOP_INSERT] += textL;
      }
      if (type <= 0) {
        data[STOP_REMOVE] += textL;
      }
    }
    diffs.splice(0, i);
    data[LAST_EQUAL] = i;
  }

  function updateDiff(a, b, swapped, diffs, diff) {
    if (swapped) {
      var t = a;
      (a = b), (b = t);
    }
    var len = diffs.length;
    //Find the extent of the change
    var headT = _unChangedHead(a, b, diffs, len);
    if (headT[UNCHANGED]) return diffs;
    var start = headT[LAST_EQUAL];
    var tailT = _unChangedTail(a, b, diffs, start);
    var end = tailT[LAST_EQUAL];

    var head = diffs.slice(0, start + 1);
    var tail = diffs.slice(end);

    //Add some context for the change to get best results for diffing
    //Find nearby equal rows that are small enough to be affected by the change
    var lenChange = Math.max(
      100,
      tailT[STOP_REMOVE] -
        headT[STOP_REMOVE] +
        (tailT[STOP_INSERT] - headT[STOP_INSERT])
    );
    trimChangeHead(head, lenChange, headT);
    trimChangeTail(tail, lenChange, tailT);

    //rediff changed section
    a = a.substring(headT[STOP_REMOVE], tailT[STOP_REMOVE]);
    b = b.substring(headT[STOP_INSERT], tailT[STOP_INSERT]);
    if (swapped) {
      var t2 = b;
      (b = a), (a = t2);
    }
    var mid = diff(a, b, false, swapped);

    //merge adjacent equal chunks
    if (head.length) {
      if (mid.length && mid[0][0] == DIFF_EQUAL) {
        head[head.length - 1][1] += mid.shift()[1];
      }
    }
    if (tail.length) {
      if (mid.length && mid[mid.length - 1][0] == DIFF_EQUAL) {
        tail[0][1] = mid.pop()[1] + tail[0][1];
      }
    }

    return head.concat(mid).concat(tail);
  }

  function inlineMarker(acediff, side, line, from, toLine, to, fade, removed) {
    var editor = acediff.editors[side];
    var session = editor && editor.ace.getSession();
    if (!session) return false;
    acediff.editors[side].markers.push(
      session.addMarker(
        new Range(line, from, toLine, to),
        acediff.options.classes[
          removed === acediff.swapped ? 'inlineAdded' : 'inlineRemoved'
        ] + (fade ? ' fading' : ''),
        'text',
        false
      )
    );
    return true;
  }
  // note that this and everything else in this script uses 0-indexed row numbers
  // function endOfLineClean(diff, i) {
  //   if (i == diff.length - 1) return true;
  //   var next = diff[i + 1][1];
  //   if ((next.length == 1 && i < diff.length - 2) || next.charCodeAt(0) != 10)
  //     return false;
  //   if (i == diff.length - 2) return true;
  //   next = diff[i + 2][1];
  //   return (
  //     (next.length > 1 || i == diff.length - 3) && next.charCodeAt(0) == 10
  //   );
  // }

  // function startOfLineClean(diff, i) {
  //   if (i == 0) return true;
  //   var last = diff[i - 1][1];
  //   if (last.charCodeAt(last.length - 1) != 10) return false;
  //   if (i == 1) return true;
  //   last = diff[i - 2][1];
  //   return last.charCodeAt(last.length - 1) == 10;
  // }
  function endOfLineClean(diff, i) {
    var last = diff.length;
    var current = diff[i][0];
    for (; ++i < last; ) {
      if (current && diff[i][0] == -current) continue;
      var text = diff[i][1];
      if (0 === text.length) continue;
      if ('\n' !== text[0]) return false;
      if (current || !diff[i][0]) return true;
      current = -diff[i][0];
    }
    return true;
  }

  function startOfLineClean(diff, i) {
    var last = -1;
    var current = diff[i][0];
    for (; --i > last; ) {
      if (current && diff[i][0] == -current) continue;
      var text = diff[i][1];
      if (0 === text.length) continue;
      if ('\n' !== text[text.length - 1]) return false;
      if (current || !diff[i][0]) return true;
      current = -diff[i][0];
    }
    return true;
  }

  function showInlineDiffs(acediff, left, right, diffs) {
    var pos = {};
    pos[left] = new Pos(0, 0);
    pos[right] = new Pos(0, 0);

    //Stream States:
    var RESET = 1, // yet to see a diff
      PENDING = 2, // one side is ok, waiting to confirm the other side
      FAILED = 4, // has seen a diff too long to be shown inline
      MAX_LENGTH = 10; // maximum length of diffs that can span a full line
    // var FAILING = PENDING | FAILED;
    var state = RESET;
    var marker, hasFullLine, start, startCh, offLeft, offRight;
    for (var i = 0, len = diffs.length; i < len; i++) {
      var type = diffs[i][0];
      var text = diffs[i][1];

      if (type == DIFF_EQUAL) {
        if (state & PENDING) {
          inlineMarker.apply(null, marker);
          state ^= PENDING;
        }
        start = pos[left].line;
        startCh = pos[left].ch;
        offLeft = startOfLineClean(diffs, i) ? 1 : 0;
        moveOver(pos[left], text, null, pos[right]);
        offRight = endOfLineClean(diffs, i) ? 1 : 0;
        hasFullLine = pos[left].line - start + offLeft + offRight > 1;
        if (hasFullLine && state & FAILED) {
          state = RESET;
        }
        continue;
      }
      var side = type == DIFF_DELETE ? left : right;
      start = pos[side].line;
      startCh = pos[side].ch;
      offLeft = startOfLineClean(diffs, i) ? 1 : 0;
      moveOver(pos[side], text);
      offRight = endOfLineClean(diffs, i) ? 1 : 0;
      hasFullLine = pos[side].line - start + offLeft + offRight > 1;

      if (!hasFullLine || text.length < MAX_LENGTH) {
        if (state & PENDING) {
          inlineMarker.apply(null, marker);
          state ^= PENDING;
          inlineMarker(
            acediff,
            side,
            start,
            startCh,
            pos[side].line,
            pos[side].ch,
            false,
            type == DIFF_DELETE
          );
        } else if (state & RESET) {
          state |= PENDING;
          marker = [
            acediff,
            side,
            start,
            startCh,
            pos[side].line,
            pos[side].ch,
            false,
            type == DIFF_DELETE,
          ];
        }
      } else {
        state = FAILED;
        continue;
        /* Show the first line if at least one side passed. Ugly.
        if (state ^ FAILED) {
            if (state & PENDING) {
                state ^= PENDING;
                inlineMarker.apply(null, marker);
                inlineMarker(acediff, side, start, startCh, start, Infinity, true);
            }
            else { //if(pos[side].ch!==0 && !offRight) {
                state = FAILING;
                marker = [acediff, side, start, startCh, start, Infinity, true];
            }
        }*/
      }
    }
  }

  function findPrevDiff(chunks, start, isOrig) {
    for (var i = chunks.length - 1; i >= 0; i--) {
      var chunk = chunks[i];
      var to = (isOrig ? chunk.leftEndLine : chunk.rightEndLine) - 1;
      if (to < start) return to;
    }
  }

  function findNextDiff(chunks, start, isOrig) {
    for (var i = 0; i < chunks.length; i++) {
      var chunk = chunks[i];
      var from = isOrig ? chunk.leftStartLine : chunk.rightStartLine;
      if (from > start) return from;
    }
  }

  function goNearbyDiff(acediff, editor, dir) {
    var found = null,
      pairs = acediff.pairs,
      editors = acediff.editors;
    var line = editor.getCursorPosition().row;
    for (var i = 0; i < pairs.length; i++) {
      var diff = pairs[i].diffs,
        isOrig = editor == editors[pairs[i].left].ace;
      if (!isOrig && editor != editors[pairs[i].right].ace) {
        continue;
      }
      var pos =
        dir < 0
          ? findPrevDiff(diff, line, isOrig)
          : findNextDiff(diff, line, isOrig);

      if (
        pos != null &&
        (found == null || (dir < 0 ? pos > found : pos < found))
      )
        found = pos;
    }
    if (found != null) editor.gotoLine(found + 1, 0);
    else return false;
  }

  function getOption(acediff, side, option) {
    var opt = acediff.options[option];
    if (acediff.options[side][option] !== undefined) {
      opt = acediff.options[side][option];
    }
    return opt;
  }
  /*
    deep? - boolean whether recurse
    target? - object
    src... - objects to extend from
     If you provide only src, then target is this
     ie a.extend = extend
     a.extend(deep,src)
    */
  function extend() {
    var options,
      name,
      src,
      copy,
      copyIsArray,
      clone,
      target = arguments[0] || {},
      i = 1,
      length = arguments.length,
      deep = false,
      toString = Object.prototype.toString,
      hasOwn = Object.prototype.hasOwnProperty,
      class2type = {
        '[object Boolean]': 'boolean',
        '[object Number]': 'number',
        '[object String]': 'string',
        '[object Function]': 'function',
        '[object Array]': 'array',
        '[object Date]': 'date',
        '[object RegExp]': 'regexp',
        '[object Object]': 'object',
      },
      jQuery = {
        isFunction: function (obj) {
          return jQuery.type(obj) === 'function';
        },
        isArray:
          Array.isArray ||
          function (obj) {
            return jQuery.type(obj) === 'array';
          },
        isWindow: function (obj) {
          return obj !== null && obj === obj.window;
        },
        isNumeric: function (obj) {
          return !isNaN(parseFloat(obj)) && isFinite(obj);
        },
        type: function (obj) {
          return obj === null
            ? String(obj)
            : class2type[toString.call(obj)] || 'object';
        },
        isPlainObject: function (obj) {
          if (!obj || jQuery.type(obj) !== 'object' || obj.nodeType) {
            return false;
          }
          try {
            if (
              obj.constructor &&
              !hasOwn.call(obj, 'constructor') &&
              !hasOwn.call(obj.constructor.prototype, 'isPrototypeOf')
            ) {
              return false;
            }
          } catch (e) {
            return false;
          }
          var key;
          for (key in obj) {
          }
          return key === undefined || hasOwn.call(obj, key);
        },
      };
    if (typeof target === 'boolean') {
      deep = target;
      target = arguments[1] || {};
      i = 2;
    }
    if (typeof target !== 'object' && !jQuery.isFunction(target)) {
      target = {};
    }
    if (length === i) {
      target = this;
      --i;
    }
    for (i; i < length; i++) {
      if ((options = arguments[i]) !== null) {
        for (name in options) {
          src = target[name];
          copy = options[name];
          if (target === copy) {
            continue;
          }
          if (
            deep &&
            copy &&
            (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))
          ) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && jQuery.isArray(src) ? src : [];
            } else {
              clone = src && jQuery.isPlainObject(src) ? src : {};
            }
            // WARNING: RECURSION
            target[name] = extend(deep, clone, copy);
          } else if (copy !== undefined) {
            target[name] = copy;
          }
        }
      }
    }

    return target;
  }
  //limit the number of times a function
  //is called in a time frame
  function throttle(func, wait) {
    var timeout;
    var context, args;
    var later = function () {
      timeout = null;
      func.apply(context, args);
    };
    return function () {
      context = this;
      args = arguments;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
    };
  }
  exports.extend = extend;
  exports.getOption = getOption;
  exports.goNearbyDiff = goNearbyDiff;
  exports.showInlineDiffs = showInlineDiffs;
  exports.getDiffs = getDiffs;
  exports.throttle = throttle;
  exports.EDITOR_LEFT = EDITOR_LEFT;
  exports.EDITOR_RIGHT = EDITOR_RIGHT;
  exports.DIFF_GRANULARITY_SPECIFIC = 'specific';
  exports.DIFF_GRANULARITY_BROAD = 'broad';
  exports.EDITOR_CENTER = 'center';
  exports.LTR = 'ltr';
  exports.RTL = 'rtl';
  exports.SVG_NS = 'http://www.w3.org/2000/svg';
  exports.WIDGET_INLINE = 'diff-inline';
  exports.WIDGET_OFFSET = 'diff-offset';
});