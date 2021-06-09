(function(root, factory) {
    if (typeof _Define === 'function') {
        _Define(factory, "AceInlineDiff"); /*_EndDefine*/
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require());
    } else {
        root.AceInlineDiff = factory(root);
    }
})(this, function(root) {
    'use strict';
    /*region Common Code*/
    var Range = ace.require('ace/range').Range;
    var LineWidgets = ace.require("ace/line_widgets").LineWidgets;

    var C = {
        DIFF_EQUAL: 0,
        DIFF_DELETE: -1,
        DIFF_INSERT: 1,
        WIDGET_INLINE: 'diff-inline',
        WIDGET_OFFSET: 'diff-offset',
        EDITOR_RIGHT: 'right',
        EDITOR_LEFT: 'left',
        EDITOR_CENTER: 'center',
        RTL: 'rtl',
        LTR: 'ltr',
        SVG_NS: 'http://www.w3.org/2000/svg',
        DIFF_GRANULARITY_SPECIFIC: 'specific',
        DIFF_GRANULARITY_BROAD: 'broad'
    };

    function inlineMarker(acediff, side, line, from, toLine, to, fade) {
        var editor = acediff.editors[side];
        var session = (editor && editor.ace.getSession());
        if (!session) return false;
        acediff.editors[side].markers.push(session.addMarker(new Range(line, from, toLine, to), acediff.options.classes.inline + (fade ? " fading" : ""), 'text', false));
        return true;
    }

    function showInlineDiffs(acediff, left, right, diffs) {
        var pos = {};
        pos[left] = new Pos(0, 0);
        pos[right] = new Pos(0, 0);
        var CLEAN = 1,
            PENDING = 8,
            FAILED = 128;
        var FAILING = PENDING | FAILED;
        var state = CLEAN;
        var marker, hasFullLine, start, startCh, offLeft, offRight;
        for (var i = 0, len = diffs.length; i < len; i++) {
            var type = diffs[i][0];
            var text = diffs[i][1];

            if (type == C.DIFF_EQUAL) {
                if (state & PENDING) {
                    inlineMarker.apply(null, marker);
                    state ^= PENDING;
                }
                start = pos[left].line;
                startCh = pos[left].ch;
                offLeft = startOfLineClean(diffs, i) ? 1 : 0;
                moveOver(pos[left], text, null, pos[right]);
                offRight = (endOfLineClean(diffs, i) ? 1 : 0);
                hasFullLine = (pos[left].line - start + offLeft + offRight) > 1;
                if (hasFullLine && (state & FAILED)) {
                    state = CLEAN;
                }
                continue;
            }
            var side = (type == C.DIFF_DELETE ? left : right);
            start = pos[side].line;
            startCh = pos[side].ch;
            offLeft = startOfLineClean(diffs, i) ? 1 : 0;
            moveOver(pos[side], text);
            offRight = (endOfLineClean(diffs, i) ? 1 : 0);
            hasFullLine = (pos[side].line - start + offLeft + offRight) > 1;

            if (!hasFullLine || text.length < 10) {
                if (state & PENDING) {
                    inlineMarker.apply(null, marker);
                    state ^= PENDING;
                    inlineMarker(acediff, side, start, startCh, pos[side].line, pos[side].ch);
                } else if (state & CLEAN) {
                    state |= PENDING;
                    marker = [acediff, side, start, startCh, pos[side].line, pos[side].ch];
                }
            } else {
                state = FAILED;
                continue;
                /*if (state ^ FAILED) {
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

    function getLineDiff(text1, text2, ignoreWhitespace, swap) {
        // if (!/\n$/.test(text1)) 
        text1 += "\n";
        // if (!/\n$/.test(text2)) 
        text2 += "\n";
        if (ignoreWhitespace) {
            text1 = text1.replace(/^( |\t)*|( |\t)*$/gm, "");
            text2 = text2.replace(/^( |\t)*|( |\t)*$/gm, "");
        }
        var a = dmp.diff_linesToChars_(text1, text2);
        var lineText1 = a.chars1;
        var lineText2 = a.chars2;
        var lineArray = a.lineArray;
        var diff;
        var diff = dmp.diff_main(lineText1, lineText2, false);
        dmp.diff_charsToLines_(diff, lineArray);
        if (swap) {
            for (i = 0; i < diff.length; ++i) {
                diff[i][0] = -diff[i][0];
            }
        }
        return diff;
    }

    function getLineChunks(diff) {
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
            trailinglines: null
        };
        var last = null;
        diff.forEach(function(chunk, i) {
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

    function getDiffs(text1, text2, options, ctx, allowLine) {
        var tag = ctx.savedDiffs ? "cached " : "clean ";
        if (allowLine && !options.showInlineDiffs) {
            if (options.ignoreWhitespace) {
                text1 = text1.replace(/^( |\t)*|( |\t)*$/gm, "");
                text2 = text2.replace(/^( |\t)*|( |\t)*$/gm, "");
            }
            ctx.savedDiffs = (ctx.savedDiffs) ? updateDiff(text1, text2, ctx.swapped, ctx.savedDiffs, getLineDiff) : getLineDiff(text1, text2, false, ctx.swapped);
            return getLineChunks(ctx.savedDiffs);
        } else {
            if (ctx.savedDiffs) {
                var updated = updateDiff(text1, text2, ctx.swapped, ctx.savedDiffs, getCharDiff);
                cleanUpLines(updated);
                // console.log(updated);
                ctx.savedDiffs = updated;
            } else ctx.savedDiffs = getCharDiff(text1, text2, false, ctx.swapped);
            if (options.showInlineDiffs) {
                ctx.rawDiffs = ctx.savedDiffs;
            }
            return getCharChunks(options.ignoreWhitespace ? filterWhiteSpace(ctx.savedDiffs) : ctx.savedDiffs);
        }

    }

    function mergeDiff(dest, src) {
        dest.leftStartLine = Math.min(dest.leftStartLine, src.leftStartLine);
        dest.rightStartLine = Math.min(dest.rightStartLine, src.rightStartLine);
        dest.leftEndLine = Math.max(dest.leftEndLine, src.leftEndLine);
        dest.rightEndLine = Math.max(dest.rightEndLine, src.rightEndLine);
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

        var numlines = text.split("\n").length;
        var endsWithNewline = /\n$/.test(text);
        if (endsWithNewline) {
            numlines--;
        }
        var obj = null;
        if (chunkType == C.DIFF_EQUAL) {
            offset.left += numlines;
            offset.right += numlines;
            if (trailinglines) {
                //floating equal lines are forced down
                //(prepended to next line)
                if (/^\n+$/.test(text)) {
                    var type = trailinglines[0] == C.DIFF_INSERT ? C.EDITOR_RIGHT : C.EDITOR_LEFT;
                    obj = {
                        leftStartLine: offset.left,
                        leftEndLine: offset.left,
                        rightStartLine: offset.right,
                        rightEndLine: offset.right
                    };
                    last[type + "EndLine"] -= trailinglines[1];
                    obj[type + "StartLine"] -= trailinglines[1];
                    last.chunks = text.split("\n");
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
                if (trailinglines)
                    console.warn('Unexpected trailing empty lines');
                trailinglines = [chunkType, countNewlines - 1];
            }
        }

        obj = {
            leftStartLine: offset.left,
            leftEndLine: offset.left,
            rightStartLine: offset.right,
            rightEndLine: offset.right,
            chunks: text.split("\n")
        };
        obj[chunkType == C.DIFF_INSERT ? "rightEndLine" : "leftEndLine"] += numlines;
        offset[chunkType == C.DIFF_INSERT ? "right" : "left"] += numlines;
        offset.trailinglines = trailinglines;
        return obj;
    }


    //getDiff,getChunk: copied from codemirror merge.js
    var dmp;
    var Pos = function(line, ch) {
        if (!this) return new Pos(line, ch);
        this.line = line || 0;
        this.ch = ch || 0;
        this.toAce = function() {
            return {
                row: this.line,
                column: this.ch
            };
        };
    };


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
            3: i == len && start1 == text1.length && start2 == text2.length
        };
    }

    function _unChangedTail(text1, text2, diffs, begin) {
        var start1 = text1.length,
            start2 = text2.length;
        var last = diffs.length,
            saved1 = start1,
            saved2 = start2;

        if (last - begin < 3 || diffs[last - 1][0])
            return [last, saved1, saved2];
        for (var i = last - 1;; i--) {
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
            2: saved2
        };
    }
    //Find a equal row that starts length chars away from end
    function walkBack(diffs,length,data){
        var len = diffs.length - 1;
        for (var i = len; i >= 0; i--) {
            var type = diffs[i][0];
            var textL = diffs[i][1].length;
            if (type == 0) {
                length -= textL;
                if (length < 0) {
                    // i++;//keep equal row
                    break;
                }
            }
            if (type >= 0) {
                data[2] -= textL;
            }
            if (type <= 0) {
                data[1] -= textL;
            }
        }
        diffs.splice(i+1);
        data[0] = i;
    }
    //Find an equal row that starts length chars away from start
    function walkForward(diffs,length,data){
        var len = diffs.length-1;
        for(var i=0;i<=len && (length>0 || diffs[i][0]);i++){
            var type = diffs[i][0];
            var textL = diffs[i][1].length;
            if(type==0){
                length-=textL;
                if(length<0){
                    // i--;
                    break;
                }
            }
            if(type>=0){
                data[2]+=textL;
            }
            if(type<=0){
                data[1]+=textL;
            }
        }
        diffs.splice(0,i);
        data[0] = i;
    }
    function updateDiff(a, b, swapped, diffs, func) {
        if (swapped) {
            var t = a;
            a = b, b = t;
        }
        var len = diffs.length;
        var headT = _unChangedHead(a, b, diffs, len);
        if (headT[3]) return diffs;
        var start = headT[0];
        var tailT = _unChangedTail(a, b, diffs, start);
        var end = tailT[0];
        var lenChange = (tailT[1] - headT[1]) + (tailT[2] - headT[2]);
        var head = diffs.slice(0, start + 1);
        var tail = diffs.slice(end);
        walkBack(head, lenChange, headT);
        walkForward(tail, lenChange, tailT);
        start = headT[0];
        end += tailT[0];
        var mid;
        if (start > -1 && end < len && end - start == 2) {
            //single bounded insert/delete
            var dif = diffs[start + 1][0];
            var i = dif < 0 ? 1 : 2;
            if (headT[i] == tailT[i]) {
                //delete
                tail[0][1]= head.pop()[1]+tail[0][1];
                mid = [];
            }
            else{
                var text = dif < 0 ? a : b;
                //insert
                mid = [{
                    0: dif,
                    1: text.substring(headT[i], tailT[i])
                }];
            }
        } else {
            a = a.substring(headT[1], tailT[1]);
            b = b.substring(headT[2], tailT[2]);
            
            if (swapped) {
                var t2 = b;
                b = a,
                    a = t2;
            }
            mid = func(a, b, false, swapped);
            //merge adjacent equal chunks
            if (head.length) {
                if (mid.length && mid[0][0] == C.DIFF_EQUAL) {
                    head[head.length - 1][1] += mid.shift()[1];
                }
            }
            if (tail.length) {
                if (mid.length && mid[mid.length - 1][0] == C.DIFF_EQUAL) {
                    tail[0][1] = mid.pop()[1] + tail[0][1];
                }
            }
        }
        var m = head.concat(mid).concat(tail);
        return m;
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

    function getCharChunks(diff) {
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
                var startOff = (left.ch || right.ch) ? 1 : 0;
                var cleanFromRight = right.line + startOff,
                    cleanFromLeft = left.line + startOff;
                moveOver(right, part[1], null, left);
                var endOff = i == p - 1 || (i == p - 2 && diff[p - 1][1][0] == '\n') ? 1 : 0; //(left.ch === 0 && right.ch === 0) ? 0 : 0;
                var cleanToRight = right.line + endOff,
                    cleanToLeft = left.line + endOff;
                if (cleanToRight > cleanFromRight) {
                    if (i) chunks.push({
                        leftStartLine: startLeft,
                        leftEndLine: cleanFromLeft,
                        rightStartLine: startRight,
                        rightEndLine: cleanFromRight
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
                rightEndLine: right.line + 1
            });
        return chunks;
    }


    function cleanUpLines(diff) {
        //alternative to using start of line
        //and end of line clean
        //try to make equal rows
        //end with newlines when possible
        //dmp.diff_cleanupEfficiency(diff);
        for (var i = diff.length; i-- > 2;) {
            if (diff[i][0] === 0) { //equal row
                if (diff[--i][0]) { //unequal row between
                    if (diff[i - 1][0] === 0) { //equal row
                        shift(diff[i - 1], diff[i], diff[i + 1]);
                    }
                }
            }
        }
    }

    function shift(before, center, after) {
        var eq1 = before[1];
        var diff = center[1];
        var start = eq1.lastIndexOf("\n");
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
        start = eq2.indexOf("\n");
        if (start > -1 && start < eq2.length - 1) {
            var head = eq2.substring(0, start + 1);
            if (diff.startsWith(head)) {
                before[1] = eq1 + head;
                center[1] = diff.substring(head.length) + head;
                after[1] = after[1].substring(head.length);

            }
        }
    }


    function moveOver(pos, str, copy, other) {
        var out = copy ? Pos(pos.line, pos.ch) : pos,
            at = 0;
        for (;;) {
            var nl = str.indexOf("\n", at);
            if (nl == -1) break;
            ++out.line;
            if (other) ++other.line;
            at = nl + 1;
        }
        out.ch = (at ? 0 : out.ch) + (str.length - at);
        if (other) other.ch = (at ? 0 : other.ch) + (str.length - at);
        return out;
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
            var from = (isOrig ? chunk.leftStartLine : chunk.rightStartLine);
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
            var pos = dir < 0 ? findPrevDiff(diff, line, isOrig) : findNextDiff(diff, line, isOrig);

            if (pos != null && (found == null || (dir < 0 ? pos > found : pos < found)))
                found = pos;
        }
        if (found != null)
            editor.gotoLine(found + 1, 0);

        else
            return false;
    }

    function getOption(acediff, side, option) {
        var opt = acediff.options[option];
        if (acediff.options[side][option] !== undefined) {
            opt = acediff.options[side][option];
        }
        return opt;
    }

    function extend() {
        var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
            i = 1,
            length = arguments.length,
            deep = false,
            toString = Object.prototype.toString,
            hasOwn = Object.prototype.hasOwnProperty,
            class2type = {
                "[object Boolean]": "boolean",
                "[object Number]": "number",
                "[object String]": "string",
                "[object Function]": "function",
                "[object Array]": "array",
                "[object Date]": "date",
                "[object RegExp]": "regexp",
                "[object Object]": "object"
            },

            jQuery = {
                isFunction: function(obj) {
                    return jQuery.type(obj) === "function";
                },
                isArray: Array.isArray ||
                    function(obj) {
                        return jQuery.type(obj) === "array";
                    },
                isWindow: function(obj) {
                    return obj !== null && obj === obj.window;
                },
                isNumeric: function(obj) {
                    return !isNaN(parseFloat(obj)) && isFinite(obj);
                },
                type: function(obj) {
                    return obj === null ? String(obj) : class2type[toString.call(obj)] || "object";
                },
                isPlainObject: function(obj) {
                    if (!obj || jQuery.type(obj) !== "object" || obj.nodeType) {
                        return false;
                    }
                    try {
                        if (obj.constructor && !hasOwn.call(obj, "constructor") && !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
                            return false;
                        }
                    } catch (e) {
                        return false;
                    }
                    var key;
                    for (key in obj) {}
                    return key === undefined || hasOwn.call(obj, key);
                }
            };
        if (typeof target === "boolean") {
            deep = target;
            target = arguments[1] || {};
            i = 2;
        }
        if (typeof target !== "object" && !jQuery.isFunction(target)) {
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
                    if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))) {
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
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        return function() {
            context = this;
            args = arguments;
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
        };
    }

    /*endregion Common Code*/

    var EditSession = ace.require('ace/edit_session').EditSession;
    var Text = ace.require('ace/layer/text').Text;
    var Gutter = ace.require('ace/layer/gutter').Gutter;
    var oop = ace.require("ace/lib/oop");
    var dom = ace.require("ace/lib/dom");
    var FoldLine = ace.require('ace/edit_session/fold_line').FoldLine;
    var Marker = ace.require('ace/layer/marker').Marker;


    //Acediff Methods
    //Method arguments generally mean
    //acediff - An Acediff/AceInlineDiff instance
    //session - An Ace EditSession
    //editor - Not an Ace Editor but the result of acediff.editors[side]
    //left,right,diffs - acediff.pairs[i].left,acediff.pairs[i].right,acediff.pairs[i].diffs
    function createSession(acediff, side, session) {
        var mode = getOption(acediff, side, 'mode');
        var content = acediff.options[side].content;
        if (session) {
            if (mode)
                session.setMode(mode);
            if (content) {
                session.setValue(content);
            }
        } else session = new EditSession(content || "", mode);
        acediff.foldModes[side].setFolding(session.$foldMode);
        session.$setFolding(acediff.foldModes[side]);
        override(session, "$setFolding", session, function(e) {
            acediff.foldModes[side].setFolding(e);
        });
        return session;
    }

    function setupEditor(acediff, side) {
        if (!acediff.$commands)
            acediff.$commands = {
                nextDiff: {
                    name: "Go next diff",
                    exec: function(editor) {
                        acediff.goNextDiff(editor);
                    },
                    readOnly: true,
                    bindKey: "Ctrl-Shift-N"
                },
                prevDiff: {
                    name: "Go previous diff",
                    exec: function(editor) {
                        acediff.goPrevDiff(editor);
                    },
                    readOnly: true,
                    bindKey: "Ctrl-Shift-P"
                }, //Makes the origin the edit
                swapDiffs: {
                    name: "Swap diff origin",
                    readOnly: true,
                    exec: function(editor) {
                        var right = acediff.sessions.right;
                        var left = acediff.sessions.left;
                        acediff.clear();
                        if (right.lineWidgets && right.lineWidgets.some(Boolean)) throw 'Error';
                        if (left.lineWidgets && left.lineWidgets.some(Boolean)) throw 'Error';
                        acediff.setSession(null, true);
                        acediff.setSession(null, false);
                        acediff.setSession(left, true);
                        acediff.setSession(right, false);
                    },
                }
            };
        var commands = acediff.$commands;

        var options = getOption(acediff, side, 'options');
        if (options) {
            acediff.editors[side].ace.setOptions(options);
        }
        /*var mode = getOption(acediff, side, 'mode');
        if(mode)
            acediff.editors[side].ace.getSession().setMode(mode);
        */
        var readOnly = !getOption(acediff, side, "editable");
        if (readOnly)
            acediff.editors[side].ace.setReadOnly(readOnly);
        var theme = getOption(acediff, side, 'theme');
        if (theme)
            acediff.editors[side].ace.setTheme(theme);
        // if the data is being supplied by an option, set the editor values now
        if (acediff.options[side].content) {
            acediff.editors[side].ace.setValue(acediff.options[side].content, -1);
        }
        for (var i in commands)
            acediff.editors[side].ace.commands.addCommand(commands[i]);
    }


    function clearLineWidgets(editor) {
        editor.scrollOffset = 0;

        if (!editor.lineWidgets) return;

        for (var i in editor.lineWidgets) {
            editor.ace.session.widgetManager.removeLineWidget(editor.lineWidgets[i]);
        }
        editor.ace.session.topLineWidget = null;
        editor.lineWidgets = [];
    }

    function addLineWidget(acediff, session, line, start, end, other) {
        if (!acediff.lineWidgets) {
            acediff.lineWidgets = []; //editor.ace.session.widgetManager
        }
        if (!session.widgetManager) {
            session.widgetManager = new LineWidgets(session);
            session.widgetManager.editor = acediff.ace;
        }
        var no;
        if (other) {
            var screenStart = other.documentToScreenRow(start, 0);
            var screenEnd = other.documentToScreenRow(end - 1, Infinity);
            no = screenEnd - screenStart + 1;
        } else no = end - start;

        if (!no) return;
        if (!line) {
            //no multiple widgets supported
            acediff.scrollOffset = no;
            //Warning: setting scroll margin triggers scroll if there is a session
            acediff.changeCharacterSize();
            var renderer = acediff.ace.renderer;
            renderer.session = null;
            renderer.session = session;
            session.topLineWidget = {
                row: -1,
                rowCount: no,
                coverGutter: false,
                type: C.WIDGET_OFFSET,
                start: start,
                end: end
            };
            return;
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: C.WIDGET_INLINE,
            start: start,
            end: end
        };
        acediff.lineWidgets.push(w);
        session.widgetManager.addLineWidget(w);
        return w;
    }

    function endOfLineClean(diff, i) {
        //check if the next diffs
        //start with new line
        var last = diff.length;
        var current = diff[i][0];
        for (; ++i < last;) {
            if (current && diff[i][0] == -current)
                continue;
            var text = diff[i][1];
            if (0 === text.length)
                continue;
            if ('\n' !== text[0])
                return false;
            if (current || !diff[i][0]) return true;
            current = -diff[i][0];
        }
        return true;
    }

    function startOfLineClean(diff, i) {
        //check if all(just 1) the previous diffs
        //before an equal row
        //end with new lines
        var last = -1;
        var current = diff[i][0];
        for (; --i > last;) {
            if (current && diff[i][0] == -current)
                continue;
            var text = diff[i][1];
            if (0 === text.length)
                continue;
            if ('\n' !== text[text.length - 1])
                return false;
            if (current || !diff[i][0]) return true;
            current = -diff[i][0];
        }
        return true;
    }

    //binary search through an array of start end objects
    function binarySearch(diffs, row, TYPE, invert) {
        var startLine = TYPE(invert, "StartLine");
        var endLine = TYPE(invert, "EndLine");
        var recursionHead = 0;
        var first = 0;
        var last = diffs.length - 1;
        while (first <= last) {
            if (++recursionHead > 1000) {
                throw new Error('Loop Limit Exceeded');
            }
            var mid = (first + last) >> 1;
            if (diffs[mid][startLine] > row)
                last = mid - 1;
            else if (diffs[mid][endLine] <= row)
                first = mid + 1;
            else
                return mid;
        }
        //use ABOVE to get first
        return -(first + 1);
    }
    //Override object prototype or value
    function override(host, attr, virus, val) {
        var hasProp = host.hasOwnProperty(attr);
        virus["$hostHas" + attr] = hasProp;
        virus["host" + attr] = host[attr];
        host[attr] = val || virus[attr];
    }

    //Revert object property that had been overidden
    function revert(host, attr, virus) {
        var hasProp = virus["$hostHas" + attr];
        if (hasProp) {
            host[attr] = virus["host" + attr];
        } else {
            delete host[attr];
        }
        delete virus["host" + attr];
        delete virus["$hostHas" + attr];
    }

    //Testing tools
    //python assert
    function test(cond, result) {
        if (!cond) throw new Error(result);
    }

    function noop() {}

    function time(func, name) {
        return function() {
            console.log(name);
            console.time(name);
            var res = func.apply(this, arguments);
            console.timeEnd(name);
            return res;
        };
    }
    //python-like @decorate
    function dec(func, after) {
        return function() {
            var result = func.apply(this, arguments);
            var error = after.apply(this, spread(arguments, result));
            return (error !== undefined) ? error : result;
        };
    }

    //used to check if elements in an array are unique
    function uniq(arr, map) {
        for (var i = 0; i < arr.length; i++) {
            for (var j = i + 1; j < arr.length; j++) {
                if (map(arr[i]) == map(arr[j])) return false;
            }
        }
        return true;
    }

    //python func(*a,b)
    function spread(args, arg) {
        var arg2 = [];
        arg2.push.apply(arg2, args);
        arg2.push(arg);
        return arg2;
    }

    function WIDGET(invert, type) {
        return (invert ? C.EDITOR_LEFT : C.EDITOR_RIGHT) + (type || "");
    }

    function HOST(invert, type) {
        return (invert ? C.EDITOR_RIGHT : C.EDITOR_LEFT) + (type || "");
    }

    function ABOVE(line) {
        return -line - 2;
    }

    function updateDiffMarkers(acediff, session, diffs, TYPE, className, start, end) {
        start = start || 0;
        end = end || diffs.length;
        var startLine = TYPE(null, "StartLine");
        var endLine = TYPE(null, "EndLine");
        for (var i = 0, m = acediff.markers, n = m.length; i < n; i++) {
            session.removeMarker(m[i]);
        }
        acediff.markers = [];
        for (; start < end; start++) {
            var item = diffs[start];
            if (item[endLine] > item[startLine]) {
                acediff.markers.push(session.addMarker(new Range(item[startLine], 0, item[endLine] - 1, Infinity), className, 'fullLine'));
            }
        }
    }

    function DiffFoldMode(before, after) {
        this.diffs = null;
        this.getFoldWidget = function(session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.leftEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end = (diff ? diff.leftStartLine - 1 : session.getLength()) - this.ctxBefore;
                if (end > start) {
                    if (row == start) {
                        return "start";
                    } else if (style == "markbeginend" && row == end) {
                        return "end";
                    }
                }
            } else {
                start = this.diffs[i].leftStartLine;
                end = this.diffs[i].leftEndLine - 1;
            }
            if (this.sub && row > start && row < end) {
                var fold = this.sub.getFoldWidget(session, style, row);
                return fold;
            }
        };
        this.ctxBefore = before === 0 ? 0 : before || 1;
        this.ctxAfter = before === 0 ? 0 : before || 1;
        this.getFoldWidgetRange = function(session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.leftEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end = (diff ? diff.leftStartLine - 1 : session.getLength()) - this.ctxBefore;
                if (end > start) {
                    if (row == start || style == "markbeginend" && row == end) {
                        return new Range(start, 0, end, 0);
                    }
                }
                end += this.ctxBefore;
            } else {
                start = this.diffs[i].leftStartLine;
                end = this.diffs[i].leftEndLine - 1;
            }
            if (this.sub) {
                var range = this.sub.getFoldWidgetRange(session, style, row);
                if (range) {
                    if (range.end.row >= end) {
                        range.end.row = end - 1;
                        range.end.column = session.getLine(end - 1).length;
                    }

                    if (range.start.row <= start) {
                        range.start.row = start + 1;
                        range.start.column = 0;
                    }
                    if (range.end.row < range.start.row || (
                            range.end.row == range.start.row && (range.end.column - range.start.column < -5))) return null;
                }
                return range;
            }
            return null;
        };
        this.setFolding = function(mode) {
            this.sub = mode;
        };
    }

    //A virus is a piece of code that attaches 
    //itself to a host and lives of it.
    //This is a virtual class subclasses must
    //have implement update and scrollLines
    function CellVirus(element, Layer) {
        this.layer = new Layer(element);
        this.layer.$lines.computeLineTop = this.computeLineTop.bind(this);
    }
    var CellVirusProps = (function() {
        this.computeLineTop = function(row, config, session, column) {
            var tops = this.isWidget(row, true);
            var top;
            if (typeof tops == 'number') {
                top = this.host.session.documentToScreenRow(tops, column || 0);
            } else if (tops.row < 0) {
                top = (-tops.rowCount + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0));
            } else {
                top = this.host.session.documentToScreenRow(tops.row, Infinity) + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0) + 1;
            }
            return top * config.lineHeight - config.lineOffset;
        };
        this.hook = function(host_) {
            this.host = host_;
            var hostUpdate = host_.update.bind(host_);
            override(host_, "update", this, ((function(config) {
                hostUpdate(config);
                this.update(this.computeConfig());
                this.lastWidget = null;
            }).bind(this)));
            var hostScroll = host_.scrollLines.bind(host_);
            override(host_, "scrollLines", this, ((function(config) {
                hostScroll(config);
                this.scrollLines(this.computeConfig());
                this.lastWidget = null;
            }).bind(this)));
        };
        this.unhook = function() {
            revert(this.host, "update", this);
            revert(this.host, "scrollLines", this);
            this.lastWidget = null;
            this.host = null;
        };

        /*@return widget || number if equal
         **/
        this.setSession = function(t) {
            this.layer.setSession(t);
        };

        this.isWidget = function(row, returnRow) {
            var lastW = this.lastWidget;
            if (lastW && lastW.end > row && lastW.start <= row) {
                return lastW;
            }
            if (this.host.session.topLineWidget) {
                var top = this.host.session.topLineWidget;
                if (row < top.end)
                    return (this.lastWidget = top);
            }

            var mapped = binarySearch(this.diffs, row, WIDGET);

            if (mapped > -1) {
                var widgets = this.host.session.lineWidgets;
                //push invalid rows down
                if (!widgets) return this.host.session.getLength();
                var last = this.diffs[mapped].leftStartLine - 1;
                if (widgets[last] && widgets[last].type == C.WIDGET_INLINE) {
                    return (this.lastWidget = widgets[last]);
                }
                var next = this.diffs[mapped].leftEndLine - 1;
                if (widgets[next] && widgets[next].type == C.WIDGET_INLINE) {
                    return (this.lastWidget = widgets[next]);
                }
                return this.host.session.getLength();
            } else if (returnRow) {
                //return the equal row 
                var prev = this.diffs[ABOVE(mapped)];
                return prev ? prev.leftEndLine + row - prev.rightEndLine : row;
            }
            //return false
            return 0;
        };
        //@deprecated use hostToWidgetRow directly
        this.isHostEqualRow = function(row, config) {
            var result = this.hostToWidgetRow(row, undefined);
            return result === undefined ? false : result;
        };
        //find host row from widget row
        this.hostToWidgetRow = function(row, below, invert) {
            var last, widgetLine;
            var mapped = binarySearch(this.diffs, row, HOST, invert);
            if (mapped > -1) {
                if (below === undefined || below === null) return below;
                //in widget
                //don't return host diff
                //return an equal row below or above the row
                if (below) {
                    widgetLine = WIDGET(invert, "EndLine");
                    last = this.diffs[mapped];
                    return last[widgetLine];
                } else {
                    widgetLine = WIDGET(invert, "StartLine");
                    last = this.diffs[mapped];
                    return last[widgetLine] - 1;
                }
            } else {
                //in equal row
                var hostLine = HOST(invert, "EndLine");
                widgetLine = WIDGET(invert, "EndLine");
                last = this.diffs[ABOVE(mapped)];
                return last ? row - last[hostLine] + last[widgetLine] : row;
            }
        };
        //find widget row from host row
        this.widgetToHostRow = function(row, below) {
            return this.hostToWidgetRow(row, below, true);
        };

        this.computeConfig = function() {
            var host = this.host.session;
            var config = Object.assign({}, this.host.config);
            var numRows = Math.ceil(config.height / config.lineHeight);
            //triggers bug in pageChanged(Gutter)
            //config.firstRowScreen = null;
            if (config.offset < 0 && host.topLineWidget) {
                var diff = Math.ceil(-config.offset / config.lineHeight);
                var lastOffsetRow = host.topLineWidget.rowCount;
                var firstRow = Math.max(0, lastOffsetRow - diff);
                config.firstRow = this.layer.session.screenToDocumentRow(firstRow, 0);
                config.lastRow = this.layer.session.screenToDocumentRow(firstRow + numRows, Infinity); //too much actually
                config.lineOffset = -(lastOffsetRow - firstRow) * config.lineHeight;
                config.offset -= config.lineOffset;
            } else {
                var firstRowScreen = config.offset > 0 ? (host.$scrollTop / config.lineHeight) : config.firstRowScreen; //not counting scrollMargin
                config.firstRow = Math.max(0, this.$screenToInlineWidgetRow(Math.floor(firstRowScreen)) - 1);
                config.lastRow = this.$screenToInlineWidgetRow(Math.ceil(firstRowScreen + numRows));
                config.lineOffset = 0;
            }
            config.gutterOffset = 1; //good enough for most purposes
            return config;
        };
        this.$screenToInlineWidgetRow = function(screenRow) {
            var host = this.host.session;
            var self = this.layer.session;
            var widgets = host.lineWidgets;
            //real screen row is assured to be at
            //least this
            var row = host.screenToDocumentRow(screenRow, 0);
            var widgetRow /*the last shared widget row*/ , diff;
            var widget = binarySearch(this.diffs, row, HOST);
            if (widget < 0) {
                //in an equal row
                diff = this.diffs[ABOVE(widget)];
                if (diff) {
                    var delta = row - diff.leftEndLine;
                    widgetRow = delta + diff.rightEndLine;
                } else widgetRow = row;
                //the host row does not have
                //widgets so this should be it
                if (!widgets || !widgets[row] || widgets[row].type !== C.WIDGET_INLINE) return widgetRow;
            } else {
                //A diff can either be above or below specified row {@see removedFragmentsBelow}. Due to the asynchronous rendering we are better off gusessing which, right represents the widgets
                diff = this.diffs[widget];
                //assuming there is at least one equal line between the two diffs, that equal line would have the widget ie the line above if diffs are rendered below
                var lineAbove = diff.leftStartLine - 1;
                //only one can have a widget typically
                if (lineAbove < 1 && host.topLineWidget) widgetRow = diff.rightEndLine - 1;
                else if (widgets && widgets[lineAbove] && widgets[lineAbove].type === C.WIDGET_INLINE) {
                    //widget is above this row
                    return diff.rightEndLine - 1;
                } else {
                    widgetRow = diff.rightStartLine;
                    if (!(widgets && widgets[row] && widgets[row].type === C.WIDGET_INLINE)) {
                        //should be impossible but it isn't, it happens, this will cause glitches
                        return widgetRow - 1;
                    }
                    //widget is below this row
                    row == diff.leftStartLine;
                }
            }
            //get the offset of the screen row in the widget; negative in topLine widgets
            diff = screenRow - host.documentToScreenRow(row, 0);
            var widgetScreenRow = self.documentToScreenRow(widgetRow, 0) + diff;
            var res = self.screenToDocumentRow(widgetScreenRow, 0);
            return res;
        };
    }); //.call(CellVirus.prototype);

    //Renders text and markers
    function TextLineVirus(renderer) {
        var content = this.content = document.createElement('div');
        this.markers = new Marker(content);
        CellVirus.call(this, content, Text);
        this.markers.$getTop = function(row, config) {
            var main = this.session.screenToDocumentPosition(row, 0);
            var top = layer.$lines.computeLineTop(main.row, config, layer.session, main.column);
            return top - config.firstRowScreen * config.lineHeight;
        };
        //override
        this.setSession = function(t) {
            if (this.layer.session) {
                this.layer.session.off("changeBackMarker", this.$updateMarkers);
            }
            this.layer.setSession(t);
            this.markers.setSession(t);
            if (t) {
                //not supported yet
                t.unfold();
                t.$backMarkers = [];
                t.on("changeBackMarker", this.$updateMarkers);
                this.updateMarkers();
                if (this.host && this.host.session) {
                    this.updateWrapMode();
                }
            }
        };

        content.className = "ace_content";
        this.renderer = renderer;
        var layer = this.layer;

        this.$getLongestLine = function() {
            var charCount = Math.max(layer.session.getScreenWidth(), this.session.getScreenWidth());
            if (this.showInvisibles && !this.session.$useWrapMode)
                charCount += 1;

            if (this.$textLayer && charCount > this.$textLayer.MAX_LINE_LENGTH)
                charCount = this.$textLayer.MAX_LINE_LENGTH + 30;

            return Math.max(this.$size.scrollerWidth - 2 * this.$padding, Math.round(charCount * this.characterWidth));
        };
        this.$updateWrapMode = this.updateWrapMode.bind(this);
        this.$changeWrapLimit = this.changeWrapLimit.bind(this);

        this.$updateMarkers = this.updateMarkers.bind(this);
        this.$renderLinesFragment = this.renderLinesFragment.bind(this);
        override(this.layer, "$renderLinesFragment", this);
        this.$doRender = this.doRender.bind(this);
        this.attach();
    }
    (function() {
        CellVirusProps.call(this);
        this.detach = function(sessionOnly) {
            this.host.session.off("changeWrapMode", this.$updateWrapMode);
            this.host.session.off("changeWrapLimit", this.$changeWrapLimit);
            if (!sessionOnly) {
                this.renderer.off("afterRender", this.$doRender);
                this.content.remove();
                revert(this.renderer, "$getLongestLine", this);
                this.unhook();
            }
        };
        this.attach = function(sessionOnly) {
            if (!sessionOnly) {
                this.hook(this.renderer.$textLayer);
                this.renderer.on("afterRender", this.$doRender);
                override(this.renderer, "$getLongestLine", this);
                this.renderer.scroller.appendChild(this.content);
            }
            this.host.session.on("changeWrapMode", this.$updateWrapMode);
            this.host.session.on("changeWrapLimit", this.$changeWrapLimit);
            if (this.layer.session) {
                this.updateWrapMode();
            }
        };
        this.updateMarkers = function() {
            this.markers.setMarkers(this.layer.session.getMarkers());
            //hopefully something else will call update
        };

        this.renderLinesFragment = function(config, first, last, which) {
            var widgets = [];
            var host = this.host;
            if (config.lineOffset < 0)
                widgets.push(host.session.topLineWidget);
            if (host.session.lineWidgets) {
                var firstRow = host.config.firstRow;
                var lastRow = host.config.lastRow;
                var foldLine = host.session.getNextFoldLine(firstRow);
                var foldStart = foldLine ? foldLine.start.row : Infinity;
                var widget;
                for (var i = firstRow; i <= lastRow; i++) {
                    if (i > foldStart) {
                        i = foldLine.end.row + 1;
                        foldLine = host.session.getNextFoldLine(i, foldLine);
                        foldStart = foldLine ? foldLine.start.row : Infinity;
                    }
                    widget = host.session.lineWidgets[i];
                    if (widget && widget.end >= first && widget.type === C.WIDGET_INLINE) {
                        widgets.push(widget);
                        if (widget.end >= last) break;
                    }
                }
            }
            var fragment = [];
            if (widgets.length) {
                for (var j in widgets) {
                    this.lastWidget = widgets[j];
                    fragment.push.apply(fragment, this.host$renderLinesFragment.apply(this.layer, [config, Math.max(first, widgets[j].start), Math.min(last, widgets[j].end - 1)]));
                }
            }
            return fragment;
        };
        this.doRender = function() {
            var width = this.renderer.layerConfig.width + 2 * this.renderer.$padding + "px";
            dom.setStyle(this.content.style, "width", width);
            dom.setStyle(this.content.style, "height", this.layer.config.minHeight + this.layer.config.offset + 'px');
            dom.translate(this.content, -this.renderer.scrollLeft, -this.layer.config.offset);
        };
        this.updateWrapMode = function() {
            this.layer.session.setWrapLimitRange(this.host.session.$wrapLimitRange.min, this.host.session.$wrapLimitRange.max);
            this.layer.session.setUseWrapMode(this.host.session.$useWrapMode);
            this.changeWrapLimit();
        };
        this.changeWrapLimit = function() {
            this.layer.session.adjustWrapLimit(this.host.session.$wrapLimit);
        };
        this.scrollLines = function(config) {
            //optimize
            this.layer.setPadding(this.renderer.$padding);
            this.markers.setPadding(this.renderer.$padding);
            this.markers.update(config);

            var _this = this.layer;
            if (_this.$lines.cells.length == 0)
                return this.update(config);
            var oldFirstRow = _this.$lines.cells[0].row;
            var lastRow = config.lastRow;
            var oldLastRow = _this.config ? _this.$lines.cells[_this.$lines.cells.length - 1].row : -1;
            if (_this.$lines.pageChanged(_this.config, config))
                return this.update(config);
            if (!_this.config || oldLastRow < config.firstRow)
                return this.update(config);

            if (lastRow < oldFirstRow)
                return this.update(config);

            if (oldLastRow < config.firstRow)
                return this.update(config);

            if (lastRow < oldFirstRow)
                return this.update(config);


            if (config.lineOffset != _this.config.lineOffset)
                for (var line in _this.$lines.cells) {
                    var cell = _this.$lines.cells[line];
                    cell.element.style.top = this.computeLineTop(cell.row, config, _this.session) + "px";
                }
            _this.$lines.moveContainer(config);
            _this.config = config;
            if (oldFirstRow < config.firstRow) {
                while (_this.$lines.cells.length &&
                    _this.$lines.cells[0].row < config.firstRow) {
                    _this.$lines.shift();
                }
            } else if (config.firstRow < oldFirstRow) {
                _this.$lines.unshift(this.renderLinesFragment(config, config.firstRow, oldFirstRow - 1, 1));
            }
            if (oldLastRow > config.lastRow) {
                while (_this.$lines.cells.length &&
                    _this.$lines.cells[_this.$lines.cells.length - 1].row > config.lastRow) {
                    _this.$lines.pop();
                }
            } else if (config.lastRow > oldLastRow) {
                _this.$lines.push(this.renderLinesFragment(config, oldLastRow + 1, config.lastRow, -1));
            }
            /*test(uniq(_this.$lines.cells, function(r) {
                return r.row;
            }));*/
        };
        this.update = function(config) {
            this.layer.setPadding(this.renderer.$padding);
            this.markers.setPadding(this.renderer.$padding);
            this.markers.update(config);
            this.layer.update(config);
        };
    }).call(TextLineVirus.prototype);

    //Renders gutters
    function GutterLineVirus(renderer) {
        CellVirus.call(this, renderer.$gutter, Gutter);
        this.layer.$renderer = this;
        dom.translate(this.layer.element, 0, 0);
        this.layer.element.style.position = 'absolute';
        this.layer.element.style.top = '0px';
        this.layer.setShowFoldWidgets(false);
        this.layer.setHighlightGutterLine(false);

        var gutter;
        this.layer.$updateGutterWidth = function() {
            if (this.gutterWidth != gutter.gutterWidth - 10) {
                this.gutterWidth = gutter.gutterWidth - 10;
                this.element.style.width = this.gutterWidth + "px";
            }
        };
        var last, lastF;
        this.getNextFoldLine = function(row, start) {
            var rowF = this.widgetToHostRow(row, true);
            var ind;
            if (start == last)
                ind = lastF;
            lastF = this.host.session.getNextFoldLine(rowF, ind);
            if (lastF) {
                last = Object.create(FoldLine.prototype);
                last.start = {
                    row: this.hostToWidgetRow(lastF.start.row, true)
                };
                last.end = {
                    row: this.hostToWidgetRow(lastF.end.row, false)
                };
                if (last.end.row < row) {
                    last.start.row = last.end.row = row;
                } else if (last.end.row < last.start.row) {
                    last.start.row = last.end.row;
                }
                //last.range = new Range(last.start.row, 0, last.end.row, 0);
                //last.foldData = lastF.foldData;
                //last.folds = lastF.folds;
            } else last = null;
            return last;
        };

        this.attach = function() {
            gutter = renderer.$gutterLayer;
            gutter.element.parentNode.appendChild(this.layer.element);
            override(gutter, "$renderer", this, this);
            this.hook(gutter);
        };
        this.attach();
    }
    (function() {
        CellVirusProps.call(this);

        function onCreateCell(element) {
            var textNode = document.createTextNode('');
            element.appendChild(textNode);

            var foldWidget = dom.createElement("span");
            element.appendChild(foldWidget);

            return element;
        }

        this.detach = function() {
            this.layer.element.remove();
            revert(this.host, "$renderer", this, this);
            this.unhook();
        };
        this.update = function(config) {
            var _this = this.layer;
            _this.config = config;
            var session = _this.session;
            var firstRow = config.firstRow;
            var lastRow = Math.min(config.lastRow + config.gutterOffset, // needed to compensate for hor scollbar
                session.getLength() - 1);
            _this.oldLastRow = lastRow;
            _this.config = config;

            _this.$lines.moveContainer(config);
            _this.$updateCursorRow();
            _this.$lines.push(this.renderLines(config, config.firstRow, config.lastRow, true));
            _this._signal("afterRender");
            _this.$updateGutterWidth(config);
        };
        this.getFoldedRowCount = function(startRow, endRow) {
            //when all things fail
            var lines = this.layer.$lines.cells;
            var count = 0;
            for (var i = 0, len = lines.length; i < len; i++) {
                var a = lines[i];
                if (a.row < startRow) {
                    continue;
                }
                if (a.row <= endRow)
                    count++;
                else break;
            }
            return count;
        };
        //so much duplicated code
        this.renderLines = function(config, firstRow, lastRow, useCache) {
            var fragment = [];
            var row = firstRow;
            var _layer = this.layer;
            var session = _layer.session;
            var foldLine = this.getNextFoldLine(row);
            var foldStart = foldLine ? foldLine.start.row : Infinity;
            var _lines = _layer.$lines;
            var index = 0,
                len = -1;
            var cache = this.layer.$lines.cells;
            if (useCache) {
                len = cache.length;
            }
            while (true) {
                if (row > foldStart) {
                    row = foldLine.end.row + 1;
                    foldLine = this.getNextFoldLine(row, foldLine);
                    foldStart = foldLine ? foldLine.start.row : Infinity;
                }
                if (row > lastRow)
                    break;

                var cell;
                if (index < len) {
                    cell = cache[index++];
                } else {
                    cell = _lines.createCell(row, config, session, onCreateCell);
                    fragment.push(cell);
                }
                _layer.$renderCell(cell, config, foldLine, row);
                row++;
            }
            if (useCache && index < len) {
                while (index++ < len) {
                    _lines.pop();
                }
            }
            return fragment;
        };
        this.scrollLines = function(config) {
            if (config.lineOffset != this.layer.config.lineOffset)
                for (var line in this.layer.$lines.cells) {
                    var cell = this.layer.$lines.cells[line];
                    cell.element.style.top = this.computeLineTop(cell.row, config, this.layer.session) + "px";
                }
            var _this = this.layer;
            var oldConfig = _this.config;
            _this.config = config;

            _this.$updateCursorRow();
            if (_this.$lines.pageChanged(oldConfig, config))
                return this.update(config);

            _this.$lines.moveContainer(config);
            var lastRow = Math.min(config.lastRow + config.gutterOffset, // needed to compensate for hor scollbar
                _this.session.getLength() - 1);
            var oldLastRow = _this.oldLastRow;
            _this.oldLastRow = lastRow;
            if (!oldConfig || oldLastRow < config.firstRow)
                return this.update(config);

            if (lastRow < oldConfig.firstRow)
                return this.update(config);

            if (oldConfig.firstRow < config.firstRow)
                for (var row = this.getFoldedRowCount(oldConfig.firstRow, config.firstRow - 1); row > 0; row--)
                    _this.$lines.shift();

            if (oldLastRow > lastRow)
                for (var row = this.getFoldedRowCount(lastRow + 1, oldLastRow); row > 0; row--)
                    _this.$lines.pop();
            if (config.firstRow < oldConfig.firstRow) {
                _this.$lines.unshift(this.renderLines(config, config.firstRow, oldConfig.firstRow - 1));
            }
            if (lastRow > oldLastRow) {
                _this.$lines.push(this.renderLines(config, oldLastRow + 1, lastRow));
            }
            _this.updateLineHighlight();

            _this._signal("afterRender");
            _this.$updateGutterWidth(config);

        };
        this.getText = function(session, row) {
            var text = (session.$firstLineNumber + row).toString();
            return text;
        };
        this.getWidth = function(session, rowText, config) {
            var lastRow = this.layer.$lines.last();
            lastRow = lastRow ? lastRow.row : this.hostToWidgetRow(config.lastRow);
            var hostLastRow = this.host.$lines.last().row;
            var rowText = this.getText(this.layer.session, lastRow);
            var otherRowText = this.getText(this.host.session, hostLastRow);
            return (rowText.length + otherRowText.length + 1) * config.characterWidth;
        };
    }).call(GutterLineVirus.prototype);

    function AceInlineDiff(options) {
        this.options = {};
        extend(true, this.options, AceInlineDiff.defaults, {

        }, options);

        //////////Hacks To Make It Work With Acediff Methods
        this.options.threeWay = false;
        this.options.alignLines = false;
        this.editor = this.options.editor || ace.edit(this.options.id);
        this.editors = {
            left: this,
            hack: {
                ace: null
            }
        };
        this.pairs = [this];
        this.left = C.EDITOR_LEFT;
        this.right = "diffhack";
        this.options.only = this.options;
        this.ace = this.editor;
        ///////////

        this.foldModes = {
            left: new DiffFoldMode(0, 0),
            //not used by virus unless swapped
            right: new DiffFoldMode(0, 0)
        };
        if (this.options.left.session) {
            this.editor.setSession(this.options.left.session);
        }
        this.sessions = {
            left: createSession(this, C.EDITOR_LEFT, this.editor.session),
            right: createSession(this, C.EDITOR_RIGHT, this.options.right.session)
        };


        this.current = this.sessions.left;
        this.other = this.sessions.right;
        this.editors.other = {
            ace: {
                session: this.other,
                getSession: function() {
                    return this.session;
                }
            },
            markers: []
        };

        setupEditor(this, C.EDITOR_LEFT);
        this.markers = [];

        this.$decorate = this.decorate.bind(this);
        this.gutter = new GutterLineVirus(this.editor.renderer);
        this.gutter.setSession(this.other);

        this.renderer = new TextLineVirus(this.editor.renderer);
        this.renderer.setSession(this.other);

        this.addCssClasses();
        if (!dmp) dmp = new diff_match_patch();
        this.swapped = false;
        this.scrollMargin = {};
        this.editor.renderer.addScrollMargin(this.scrollMargin);
        this.diff(true);
        if (this.options.ignoreWhitespace == 'auto') {
            if (this.diffs.length < 2) {
                this.options.ignoreWhitespace = false;
                this.diff(true);
            } else this.options.ignoreWhitespace = true;
        }


        if (this.options.autoupdate) {
            //without this the diffs will
            //eventually get muddled
            this.startUpdate();
        }
        this.$handleDoubleClick = this.handleDoubleClick.bind(this);
        //this.$handleChangeSelection = this.handleChangeSelection.bind(this);
        this.editor.on('dblclick', this.$handleDoubleClick);
        this.$update = this.updateAligns.bind(this);
        this.$changeCharacterSize = this.changeCharacterSize.bind(this);
        this.editor.on('change', this.$update);
        this.other.once('tokenizerUpdate', this.$decorate);
        this.other.on('changeWrapLimit', this.$decorate);
        this.editor.renderer.on('changeCharacterSize', this.$changeCharacterSize);
    }
    //Gutter and Folding
    //Three Structures, One, Alignables, Widgets and Diffs
    //Diffs can be updated with update diff but until then
    //A way to keep things rolling
    //Inline markers will fail cus they need rawDiffs
    //New Goal
    //Use RangeList for inline markers
    //Update line markers on change
    //Get rid of diff format or use
    AceInlineDiff.prototype = {
        clickSwap: function(isWidget, row, column) {
            this.swap();
            if (isWidget && !getOption(this, WIDGET(this.swapped), 'editable') &&
                getOption(this, HOST(this.swapped), 'editable'))
                this.allowSwap = true;
            this.editor.gotoLine(row + 1, column);
        },
        clickCopy: function(isWidget, row, col, origPos) {
            if (isWidget && getOption(this, HOST(this.swapped), "editable")) {
                var widget = origPos.row < 0 ? this.current.topLineWidget : this.current.lineWidgets[origPos.row];
                var text = this.other.getLines(widget.start, widget.end - 1);
                this.current.getDocument().insertFullLines(widget.row + 1, text);
            }
        },
        handleDoubleClick: function(e) {
            var linesAbove = this.scrollOffset;
            var pos = this.editor.renderer.pixelToScreenCoordinates(e.clientX, e.clientY);
            var swap = (this.options.onClick == "swap" ? this.clickSwap : this.clickCopy).bind(this);
            //clicked topLineWidget
            if (pos.row < 0 && linesAbove > 0) {
                var post = this.other.screenToDocumentPosition(pos.row + linesAbove, pos.column, pos.offsetX);
                e.stop();
                return swap(true, post.row, post.column, pos);
            }
            //clicked equal row;
            var position = this.current.screenToDocumentPosition(pos.row, pos.column, pos.offsetX);
            if (this.allowSwap) {
                var end = this.gutter.isHostEqualRow(position.row);
                if (end !== false) {
                    e.stop();
                    return swap(false, end, position.column, position);
                }
            }
            //clicked widget
            var widget = this.current.lineWidgets && this.current.lineWidgets[position.row];
            if (widget) {
                var screenRow = this.current.documentToScreenRow(position.row, Infinity);
                if (pos.row > screenRow) {
                    var otherPos = this.other.screenToDocumentPosition(this.other.documentToScreenRow(widget.start, 0) + (pos.row - screenRow - 1), pos.column, pos.offsetX);
                    e.stop();
                    return swap(true, otherPos.row, otherPos.column, position);
                }
            }
        },
        startUpdate: function() {
            if (!this.$diff) {
                this.$diff = throttle(this.diff, 1500).bind(this);
                this.editor.on('change', this.$diff);
            }
        },
        updateAligns: function(change) {
            var startRow = change.start.row;
            var endRow = change.end.row;
            var delta = endRow - startRow;
            if (delta < 1) return;
            if (change.action == 'remove') delta = -delta;
            var b = change.start.row;
            var start = binarySearch(this.diffs, b, HOST);
            //next line
            if (start < 0) {
                //needs rediffing
                start = ABOVE(start) + 1;
            } else {
                var changed = this.diffs[start++];
                if (change.action == "delete" && changed.leftEndLine < endRow) {
                    changed.leftEndLine = startRow;
                } else changed.leftEndLine += delta;
            }
            var len = this.diffs.length;
            var i;
            if (change.action == "insert") {
                for (i = start; i < len; i++) {
                    this.diffs[i].leftStartLine += delta;
                    this.diffs[i].leftEndLine += delta;
                }
            } else {
                for (i = start; i < len; i++) {
                    var r = this.diffs[i];

                    if (r.leftEndLine < endRow &&
                        startRow <= r.leftEndLine
                    ) {
                        r.leftEndLine = startRow;
                    } else if (r.leftEndLine >= endRow) {
                        r.leftEndLine += delta;
                    }

                    if (r.leftStartLine < endRow &&
                        startRow <= r.leftStartLine
                    ) {
                        r.leftStartLine = startRow;
                    } else if (r.leftStartLine >= endRow) {
                        r.leftStartLine += delta;
                    }
                }
            }
            var currentClass = this.swapped ? this.options.classes.removed : this.options.classes.added;
            updateDiffMarkers(this, this.current, this.diffs, HOST, currentClass);
        },
        stopUpdate: function() {
            if (this.$diff) {
                this.editor.off('change', this.$diff);
                this.$diff = null;
            }
        },
        removeCssClasses: function() {
            if (this.swapped) {
                dom.removeCssClass(this.editor.container, this.options.classes.swapped);
                dom.removeCssClass(this.renderer.content, this.options.classes.contentAdded);
                dom.removeCssClass(this.gutter.layer.element, this.options.classes.gutterAdded);
                dom.removeCssClass(this.editor.renderer.$gutterLayer.element, this.options.classes.gutterRemoved);
                dom.removeCssClass(this.editor.renderer.content, this.options.classes.contentRemoved);
            } else {
                dom.removeCssClass(this.renderer.content, this.options.classes.contentRemoved);
                dom.removeCssClass(this.gutter.layer.element, this.options.classes.gutterRemoved);
                dom.removeCssClass(this.editor.renderer.$gutterLayer.element, this.options.classes.gutterAdded);
                dom.removeCssClass(this.editor.renderer.content, this.options.classes.contentAdded);
            }
        },
        addCssClasses: function() {
            if (this.swapped) {
                dom.addCssClass(this.editor.container, this.options.classes.swapped);
                dom.addCssClass(this.editor.renderer.$gutterLayer.element, this.options.classes.gutterRemoved);
                dom.addCssClass(this.gutter.layer.element, this.options.classes.gutterAdded);
                dom.addCssClass(this.renderer.content, this.options.classes.contentAdded);
                dom.addCssClass(this.editor.renderer.content, this.options.classes.contentRemoved);
            } else {
                dom.addCssClass(this.editor.renderer.$gutterLayer.element, this.options.classes.gutterAdded);
                dom.addCssClass(this.editor.renderer.content, this.options.classes.contentAdded);
                dom.addCssClass(this.gutter.layer.element, this.options.classes.gutterRemoved);
                dom.addCssClass(this.renderer.content, this.options.classes.contentRemoved);
            }
        },
        setSession: function(session, isRight, isSwap) {
            isRight = !!isRight;
            isSwap = !!isSwap;
            var side = (isRight ? C.EDITOR_RIGHT : C.EDITOR_LEFT);
            var oldSession = this.sessions[side];
            if (oldSession == session)
                return;
            if (side == WIDGET(this.swapped)) {
                oldSession && oldSession.off('changeWrapLimit', this.$decorate);
                this.other = session;
                this.renderer.setSession(this.other);
                this.gutter.setSession(this.other);
                this.editors.other.ace.session = this.other;
            } else {
                this.session = this.current = session;
                if (oldSession)
                    this.renderer.detach(true);
                this.editor.setSession(this.current);
                this.editor.setReadOnly(!getOption(this, (isSwap == this.swapped) ? C.EDITOR_LEFT : C.EDITOR_RIGHT, "editable"));
                if (session)
                    this.renderer.attach(true);
            }
            if (isSwap) //keep notion of left and right
                return;
            var foldMode = this.foldModes[side];
            this.sessions[side] = session;
            this.options[side].session = session;
            if (oldSession) {
                revert(oldSession, "$setFolding", oldSession);
                oldSession.$setFolding(foldMode.sub);
            }
            if (session) {
                foldMode.setFolding(session.$foldMode);
                session.$setFolding(foldMode);
                override(session, "$setFolding", session, foldMode.setFolding.bind(foldMode));
                if (this.sessions.left && this.sessions.right)
                    this.diff(true);
            }
        },
        diff: function(clean) {
            var count = 0;
            var ses1 = this.sessions.left;
            var ses2 = this.sessions.right;
            var text1 = ses1.getValue();
            var text2 = ses2.getValue();
            //reset clean based on size
            this.$reset(clean === true ? 0 :
                text1.length + text2.length < 100000 ? 5 :
                text1.length + text2.length > 1000000 ? 50 :
                25);
            this.diffs = getDiffs(text1, text2, this.options, this, ses1.getLength() + ses2.getLength() < 30000);
            count = this.diffs.length;
            if (count > this.options.maxDiffs) return this.clear();
            this.decorate();
        },
        $reset: (function() {
            var i = 0;
            return function(min) {
                if (++i > min) {
                    i = 0;
                    this.savedDiffs = null;
                }
            };
        })(),
        swap: function() {
            var offset = this.scrollMargin.top;
            this.allowSwap = false;
            //this.editor.off("changeSelection", this.$handleChangeSelection);
            var top = this.current.$scrollTop + offset;
            this.other.setScrollTop(top);
            this.clear();
            this.removeCssClasses();
            var right = this.sessions.right;
            this.setSession(this.sessions.left, true, true);
            this.setSession(right, false, true);
            this.swapped = !this.swapped;
            this.addCssClasses();
            this.diff(true);
        },
        decorate: function() {
            var diffs = this.diffs;
            this.foldModes.left.diffs = this.foldModes.right.diffs = this.gutter.diffs = this.renderer.diffs = this.diffs;
            this.clear();
            var putFragmentsAbove = (this.swapped == this.options.removedFragmentsBelow);
            var currentClass = this.swapped ? this.options.classes.removed : this.options.classes.added;
            var otherClass = this.swapped ? this.options.classes.added : this.options.classes.removed;
            var editor = this.editor;

            diffs.forEach(function(item) {
                if (item.rightEndLine > item.rightStartLine) addLineWidget(this, this.current, putFragmentsAbove ? item.leftStartLine : item.leftEndLine, item.rightStartLine, item.rightEndLine, this.other);
                if (item.leftEndLine > item.leftStartLine) {
                    this.markers.push(this.current.addMarker(new Range(item.leftStartLine, 0, item.leftEndLine - 1, Infinity), currentClass, 'fullLine'));
                }
                if (item.rightEndLine > item.rightStartLine) {
                    this.editors.other.markers.push(this.other.addMarker(new Range(item.rightStartLine, 0, item.rightEndLine - 1, Infinity), otherClass, 'fullLine'));
                }
            }, this);
            if (!this.scrollOffset && this.scrollMargin.top) {
                this.scrollMargin.top = 0;
                this.editor.renderer.updateScrollMargins();
            }
            if (this.rawDiffs)
                showInlineDiffs(this, C.EDITOR_LEFT, "other", this.rawDiffs);
        },
        goNextDiff: function(editor) {
            return goNearbyDiff(this, editor, 1);
        },
        goPrevDiff: function(editor) {
            return goNearbyDiff(this, editor, -1);
        },
        clear: function() {
            clearLineWidgets(this);
            this.editors.other.markers.forEach(function(marker) {
                this.other.removeMarker(marker);
            }, this);
            this.markers.forEach(function(marker) {
                this.current.removeMarker(marker);
            }, this);
            this.markers = [];
            this.editors.other.markers = [];
        },
        changeCharacterSize: function() {
            if (this.scrollOffset) {
                this.scrollMargin.top = this.scrollOffset * (this.ace.renderer.lineHeight || 14);
                this.ace.renderer.updateScrollMargins();
            }
        },
        resize: function(force) {
            this.editor.resize(force);
            this.changeCharacterSize();
        },
        destroy: function() {
            //Work in progress
            this.removeCssClasses();
            this.stopUpdate();
            this.editor.renderer.removeScrollMargin(this.scrollMargin);
            this.editor.off('change', this.$diff);
            this.editor.off('change', this.$update);
            this.editor.off('dblclick', this.$handleDoubleClick);
            this.editor.renderer.off('changeCharacterSize', this.$changeCharacterSize);
            this.other.off('changeWrapLimit', this.$decorate);

            revert(this.sessions.left, "$setFolding", this.sessions.left);
            revert(this.sessions.right, "$setFolding", this.sessions.right);
            this.sessions.left.$setFolding(this.foldModes.left.sub);
            this.sessions.right.$setFolding(this.foldModes.right.sub);
            this.clear();
            this.gutter.setSession(null);
            this.renderer.setSession(null);
            this.gutter.detach();
            this.renderer.detach();
            for (var i in this.$commands)
                this.editor.commands.removeCommand(this.$commands[i]);
            if (!this.options.right.session) {
                this.editor.setSession(this.sessions.left);
                this.sessions.right.destroy();
            }
        }
    };
    AceInlineDiff.diff = function(editor, value_or_session, value_or_options) {
        var prop, isSession;
        value_or_session = value_or_session || "";
        var options;
        if (typeof value_or_session !== "string") {
            isSession = true;
        }
        if (typeof value_or_options == 'string') {
            if (isSession) editor.setSession(value_or_session);
            else editor.setValue(value_or_session);
            options = {
                right: {
                    content: value_or_options
                }
            };
        } else options = value_or_options;
        options = extend(true, {
                editor: editor,
                mode: editor.getOption('mode'),
                right: {
                    editable: isSession,
                    session: isSession ? value_or_session : undefined,
                    content: isSession ? undefined : value_or_session
                }
            },
            options);
        return new AceInlineDiff(options);
    };
    AceInlineDiff.defaults = {
        mode: undefined,
        theme: null,
        diffGranularity: C.DIFF_GRANULARITY_BROAD,
        removedFragmentsBelow: false,
        ignoreWhitespace: 'auto',
        maxDiffs: 5000,
        editable: true,
        autoupdate: true,
        alignLines: false,
        showInlineDiffs: false,
        editor: undefined,
        id: "diff-editor",
        left: {},
        right: {
            session: undefined,
            content: null,
            editable: true
        },
        classes: {
            swapped: "acediff-swapped",
            gutterRemoved: "acediff-gutter-removed",
            gutterAdded: "acediff-gutter-added",
            contentRemoved: "acediff-content-removed",
            contentAdded: "acediff-content-added",
            added: "acediff-added",
            removed: "acediff-removed",
            inline: "acediff-inline"
        }
    };
    return AceInlineDiff;
});