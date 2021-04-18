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
    var Range = require('ace/range').Range;
    var LineWidgets = require("ace/line_widgets").LineWidgets;

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

    function getLineChunks(text1, text2, ignoreWhitespace, swap) {
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
        if (!dmp)
            dmp = new diff_match_patch();
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
        var diff = dmp.diff_main(lineText1, lineText2, false);
        dmp.diff_charsToLines_(diff, lineArray);

        var diffs = [];
        var offset = {
            left: 0,
            right: 0,
            trailinglines: null
        };
        var last = null;
        if (swap) {
            for (i = 0; i < diff.length; ++i) {
                diff[i][0] = -diff[i][0];
            }
        }
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

    function updateDiff(a, b, ignoreWhitespace, swapped, diffs) {
        if (swapped) {
            var t = a;
            a = b, b = t;
        }
        var len = diffs.length;
        var startPos = [0, undefined, 0];
        var endPos = [a.length, undefined, b.length];
        var sliceStart = [0, null, 0];
        var sliceEnd = endPos.slice(0);
        var text = [a, undefined, b];
        var start = -1,
            end = len;

        function eat(type, frag) {
            if (text[type].startsWith(frag, startPos[type])) {
                startPos[type] += frag.length;
                return true;
            }
            return false;
        }

        function eatBack(type, frag) {
            if (text[type].endsWith(frag, endPos[type])) {
                endPos[type] -= frag.length;
                return true;
            }
            return false;
        }

        for (var i = 0; i < len; i++) {
            if (diffs[i][0]) {
                if (eat(diffs[i][0] + 1, diffs[i][1])) {
                    continue;
                }
                //recoverable without regenerating tho
                //but only fast if done perChange or so
            } else {
                if (eat(2, diffs[i][1]) && eat(0, diffs[i][1])) {
                    sliceStart = startPos.slice(0);
                    start = i;
                    continue;
                }
            }
            break;
        }
        for (var j = len; --j > i;) {
            if (diffs[j][0]) {
                if (eatBack(diffs[j][0] + 1, diffs[j][1])) {
                    endPos[diffs[j][0] + 1] -= diffs[j][1].length;
                    continue;
                }
            } else {
                if (eatBack(0, diffs[j][1]) && eatBack(2, diffs[j][1])) {
                    sliceEnd = endPos.slice(0);
                    end = j;
                    continue;
                }
            }
            break;
        }
        var changed = diffs.slice(start + 1, end);
        if (end < len && changed.length === 0) return diffs;
        var head = diffs.slice(0, start + 1);
        var tail = diffs.slice(end);
        var mid;
        if (end < len && changed.length == 1) {
            mid = changed;
            var type = changed[0][0] + 1;
            mid[0][1] = text[type].substring(sliceStart[type], sliceEnd[type]);
        } else {
            a = text[0].substring(sliceStart[0], sliceEnd[0]);
            b = text[2].substring(sliceStart[2], sliceEnd[2]);
            if (swapped) {
                var t2 = b;
                b = a,
                    a = t2;
            }
            mid = getDiff(a, b, false, swapped);
            //merge equal chunks
            if (mid.length && mid[0][0] == C.DIFF_EQUAL) {
                if (head.length) {
                    head[head.length - 1][1] += mid.shift()[1];
                }
            }
            if (mid.length && mid[mid.length - 1][0] == C.DIFF_EQUAL) {
                if (tail.length) {
                    tail[0][1] = mid.pop()[1] + tail[0][1];
                }
            }
        }
        return head.concat(mid).concat(tail);
    }

    function getDiff(a, b, ignoreWhitespace, swap, rawDiffs) {
        if (!dmp) dmp = new diff_match_patch();
        var diff = rawDiffs || dmp.diff_main(a, b);
        // The library sometimes leaves in empty parts, which confuse the algorithm
        for (var i = 0; i < diff.length; ++i) {
            var part = diff[i];
            if (ignoreWhitespace ? !/[^ \t]/.test(part[1]) : !part[1]) {
                diff.splice(i--, 1);
            } else if (i && diff[i - 1][0] == part[0]) {
                diff.splice(i--, 1);
                diff[i][1] += part[1];
            }
        }
        cleanUpLines(diff);
        if (swap) {
            for (i = 0; i < diff.length; ++i) {
                diff[i][0] = -diff[i][0];
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
        for (var i = diff.length; i-- > 2;) {
            if (diff[i][0] === 0) {
                if (diff[--i][0]) {
                    if (diff[i - 1][0] === 0) {
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

    function getChunks(diff) {
        var chunks = [];
        if (!diff.length) return chunks;
        var startRight = 0,
            startLeft = 0;
        var right = Pos(0, 0),
            left = Pos(0, 0);
        for (var i = 0; i < diff.length; ++i) {
            var part = diff[i],
                tp = part[0];
            if (tp == DIFF_EQUAL) {
                var startOff = (left.ch || right.ch) ? 1 : 0;
                var cleanFromRight = right.line + startOff,
                    cleanFromLeft = left.line + startOff;
                moveOver(right, part[1], null, left);
                var endOff = i == diff.length - 1 ? 1 : 0; //(left.ch === 0 && right.ch === 0) ? 0 : 0;
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
                setTimeout(later, wait);
            }
        };
    }

    /*endregion Common Code*/

    var EditSession = require('ace/edit_session').EditSession;
    var Text = require('ace/layer/text').Text;
    var Gutter = require('ace/layer/gutter').Gutter;
    var oop = require("ace/lib/oop");
    var dom = require("ace/lib/dom");
    var FoldLine = require('ace/edit_session/fold_line').FoldLine;
    var Marker = require('ace/layer/marker').Marker;


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
                },
                swapDiffs: {
                    name: "Swap diff origin",
                    readOnly: true,
                    exec: function(editor) {
                        var right = acediff.sessions.right;
                        acediff.clear();
                        acediff.setSession(acediff.sessions.left, true);
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

    function addLineWidget(editor, session, line, start, end, other) {
        if (!editor.lineWidgets) {
            editor.lineWidgets = []; //editor.ace.session.widgetManager
        }
        if (!session.widgetManager) {
            session.widgetManager = new LineWidgets(session);
            session.widgetManager.editor = editor.ace;
        }
        var no;
        if (other) {
            var screenStart = other.documentToScreenRow(start, 0);
            var screenEnd = other.documentToScreenRow(end - 1, 0);
            no = screenEnd - screenStart + 1;
        } else no = end - start;

        if (!no) return;
        if (!line) {
            editor.scrollOffset += no;
            //setting scroll margin triggers scroll if there is a session
            var renderer = editor.ace.renderer;
            renderer.session = null;
            renderer.setScrollMargin(editor.scrollOffset * (editor.ace.renderer.lineHeight || 14));
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
        editor.lineWidgets.push(w);
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
    function binarySearch(lines, row) {
        var recursionHead = 0;
        var first = 0;
        var last = lines.length - 1;
        while (first <= last) {
            if (++recursionHead > 1000) {
                throw new Error('Loop Limit Exceeded');
            }
            var mid = (first + last) >> 1;
            if (lines[mid].start > row)
                last = mid - 1;
            else if (lines[mid].end <= row)
                first = mid + 1;
            else
                return mid;
        }
        return -(first + 1);
    }

    //binary search given mapStart instead of start
    function inverseSearch(lines, row) {
        var first = 0;
        var last = lines.length - 1;
        var recursionHead = 0;

        while (first <= last) {
            if (++recursionHead > 1000) {
                throw new Error('Loop Limit Exceeded');
            }
            var mid = (first + last) >> 1;
            if (lines[mid].mapStart > row)
                last = mid - 1;
            else if (lines[mid].mapStart + (lines[mid].end - lines[mid].start) <= row)
                first = mid + 1;
            else
                return mid;
        }
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

    function DiffFoldMode(before, after) {
        this.aligns = null;
        this.getFoldWidget = function(session, style, row) {
            var i = inverseSearch(this.aligns, row);
            if (i < 0) return null;
            var aligns = this.aligns;
            if (row == aligns[i].mapStart + this.ctxAfter) {
                var end = aligns[i].mapStart + (aligns[i].end - aligns[i].start - 1);
                if (end - this.ctxBefore > row) {
                    return "start";
                }
            }
            if (this.sub) {
                var fold = this.sub.getFoldWidgetRange(session, style, row);
                return fold;
            }
        };
        this.ctxBefore = before === 0 ? 0 : before || 1;
        this.ctxAfter = before === 0 ? 0 : before || 1;
        this.getFoldWidgetRange = function(editor, style, row) {
            var i = inverseSearch(this.aligns, row);
            if (i < 0) return null;
            var aligns = this.aligns;
            var end;
            if (row == aligns[i].mapStart + this.ctxAfter) {
                end = aligns[i].mapStart + (aligns[i].end - aligns[i].start - 1) - this.ctxBefore;
                if (end <= row) end = null;

            }
            if (end) {
                return new Range(row, 0, end, 0);
            } else if (this.sub) {
                var range = this.sub.getFoldWidgetRange(editor, style, row);
                return range;
            }
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
        this.alignables = {};
        this.layer.$lines.computeLineTop = this.computeLineTop.bind(this);

        var last = null,
            lastF = null;
        this.getNextFoldLine = function(row, start) {
            var widget = this.isWidget(row, this.layer.config);
            var rowF = this.unmapLine(widget ? widget.end : row);
            var ind;
            if (start == last) {
                ind = lastF;
            }
            lastF = this.host.session.getNextFoldLine(rowF, ind);
            if (lastF) {
                last = Object.create(FoldLine.prototype);
                last.start = {
                    row: this.mapLine(lastF.start.row)
                };
                last.end = {
                    row: this.mapLine(lastF.end.row)
                };
                last.range = new Range(last.start.row, lastF.start.column, last.end.row, lastF.end.column);
                //last.foldData = lastF.foldData;
                //last.folds = lastF.folds;
            } else last = null;
            return last;
        };
    }
    var CellVirusProps = (function() {
        this.computeLineTop = function(row, config, session, column) {
            var tops = this.isWidget(row, config, true);
            var top;
            if (typeof tops == 'number') {
                top = this.host.session.documentToScreenRow(tops, column || 0);
            } else if (tops.row < 0) {
                top = (-tops.rowCount + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0));
            } else {
                top = this.host.session.documentToScreenRow(tops.row, 0) + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0) + 1;
            }
            console.log(top,row);
            return top * config.lineHeight - config.lineOffset;
        };
        this.hook = function(host_) {
            this.host = host_;
            var hostUpdate = host_.update.bind(host_);
            override(host_, "update", this, (function(config) {
                hostUpdate(config);
                this.update(this.computeConfig());
            }).bind(this));
            var hostScroll = host_.scrollLines.bind(host_);
            override(host_, "scrollLines", this, (function(config) {
                hostScroll(config);
                this.scrollLines(this.computeConfig());
            }).bind(this));
        };
        this.unhook = function() {
            revert(this.host, "update", this);
            revert(this.host, "scrollLines", this);
            this.host = null;
        };

        /*@return widget || number if equal
         **/
        this.isWidget = function(row, config, returnRow) {
            var lastW = this.lastWidget;
            if (lastW && lastW.end > row && lastW.start <= row) {
                return lastW;
            }
            if (this.host.session.topLineWidget) {
                var top = this.host.session.topLineWidget;
                if (row < top.end)
                    return (this.lastWidget = top);
            }

            var mapped = binarySearch(this.alignables, row);
            if (mapped < 0) {
                var widgets = this.host.session.lineWidgets;
                if (!widgets) return 0;
                var last = this.alignables[-mapped - 2];
                last = last ? last.end - 1 - last.start + last.mapStart : -1;
                if (widgets[last] && widgets[last].type == C.WIDGET_INLINE) {
                    console.log(widgets[last].row == last);
                    return (this.lastWidget = widgets[last]);
                }
                //inserting a line above a diff
                //causes errors until the diff is updated
                var next = this.alignables[-mapped - 1];
                next = (next ? next.mapStart : widgets.length) - 1;
                if (next != last && widgets[next] && widgets[next].type == C.WIDGET_INLINE) {
                    console.log(widgets[next].row == last);
                    return (this.lastWidget = widgets[next]);
                }
            } else if (returnRow) {
                //return the equal row 
                //ie opposite of ishostequalrow
                var equal = this.lastWidget = this.alignables[mapped];
                if (equal)
                    return row - equal.start + equal.mapStart;
                //error state 
            }
            return 0;
        };
        this.isHostEqualRow = function(row, config) {
            var i = inverseSearch(this.alignables, row);
            if (i < 0)
                return false;
            var last = this.alignables[i];
            return row - last.start + last.mapStart;
        };
        this.unmapLine = function(row) {
            var last;
            if (this.alignables[0].start > row)
                return 0;

            var mapped = binarySearch(this.alignables, row);
            if (mapped < 0) {
                last = this.alignables[-mapped - 2];
                return last.end - 1 - last.start + last.mapStart;
            } else {
                last = this.alignables[mapped];
                return row - last.start + last.mapStart;
            }
        };
        this.mapLine = function(row) {
            var last;
            //*
            if (this.alignables[0].mapStart > row)
                return 0;
            var mapped = inverseSearch(this.alignables, row);
            if (mapped < 0) {
                last = this.alignables[-mapped - 2];
                return last.end - 1;
            } else {
                last = this.alignables[mapped];
                return row + last.start - last.mapStart;
            }
        };
        this.setSession = function(t) {
            this.layer.setSession(t);
        };
        this.getFoldedRowCount = function(firstRow, lastRow) {
            return this.host.session.getFoldedRowCount(this.unmapLine(firstRow), this.unmapLine(lastRow));
        };

        this.computeConfig = function() {
            var host = this.host.session;
            var config = Object.assign({}, this.host.config);
            var numRows = Math.ceil(config.height / config.lineHeight);
            console.log(this.alignables);
            console.log(host.lineWidgets, host.topLineWidget);
            //triggers bug in pageChanged(Gutter)
            //config.firstRowScreen = null;
            if (config.offset < 0 && host.topLineWidget) {
                var diff = Math.ceil(-config.offset / config.lineHeight);
                var lastOffsetRow = host.topLineWidget.rowCount;
                var firstRow = Math.max(0, lastOffsetRow - diff);
                config.firstRow = this.layer.session.screenToDocumentRow(firstRow, 0);
                config.lastRow = this.layer.session.screenToDocumentRow(firstRow + numRows, Infinity);
                config.lineOffset = -(lastOffsetRow - firstRow) * config.lineHeight;
                config.offset -= config.lineOffset;
            } else {
                var firstRowScreen = host.$scrollTop / config.lineHeight;
                config.firstRow = this.$screenToInlineWidgetRow(Math.floor(firstRowScreen));
                config.lastRow = this.$screenToInlineWidgetRow(Math.ceil(firstRowScreen + numRows));
                config.lineOffset = 0;
            }
            return config;
        };
        this.$screenToInlineWidgetRow = function(screenRow) {
            var host = this.host.session;
            var self = this.layer.session;
            var widgets = host.lineWidgets;
            if (!widgets) return -1;
            //row assured to be below or above the screenrow
            var row = host.screenToDocumentRow(screenRow, 0);
            var hostRow, widgetRow;
            var equal = inverseSearch(this.alignables, row);
            if (equal > -1) {
                var equalRow = this.alignables[equal];
                widgetRow = row - equalRow.mapStart + equalRow.start;
                if (!widgets[row] || widgets[row].type !== C.WIDGET_INLINE) return widgetRow;
                hostRow = row;
            } else {
                //in a diff
                //is the widget is directly above this row
                //or directly below the previous equal row
                var directlyAbove = this.alignables[-(equal + 1)];
                widgetRow = directlyAbove.start;
                hostRow = directlyAbove.mapStart;
                if (!widgets[hostRow - 1] || widgets[hostRow - 1].type !== C.WIDGET_INLINE) return widgetRow;
            }
            //get the difference the rows position and screen
            var diff = screenRow - host.documentToScreenRow(hostRow, 0);
            var widgetScreenRow = self.documentToScreenRow(widgetRow, Infinity) + diff;
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
                //revert(this.layer.session, "getNextFoldLine", this);
                //revert(this.layer.session, "getFoldedRowCount", this);
                this.layer.session.off("changeBackMarker", this.$updateMarkers);
            }
            this.layer.setSession(t);
            this.markers.setSession(t);
            if (t) {
                t.$backMarkers = [];
                //see updateFold
                //override(t, "getNextFoldLine", this, this.getNextFoldLine.bind(this));
                //override(t, "getFoldedRowCount", this, this.getFoldedRowCount.bind(this));
                t.on("changeBackMarker", this.$updateMarkers);
                this.updateMarkers();
                this.updateWrapMode();
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
        this.$updateMarkers = this.updateMarkers.bind(this);
        this.$updateWrapMode = this.updateWrapMode.bind(this);
        this.$changeWrapLimit = this.changeWrapLimit.bind(this);
        this.$renderLinesFragment = this.renderLinesFragment.bind(this);
        override(this.layer, "$renderLinesFragment", this);
        this.$doRender = this.doRender.bind(this);
        this.$updateFolds = this.updateFolds.bind(this);
        this.attach();
    }
    (function() {
        CellVirusProps.call(this);
        this.detach = function(temp) {
            this.host.session.off("changeWrapMode", this.$updateWrapMode);
            this.host.session.off("changeWrapLimit", this.$changeWrapLimit);
            this.host.session.off('changeFold', this.$updateFolds);

            if (!temp) {
                this.renderer.off("afterRender", this.$doRender);
                this.content.remove();
                revert(this.renderer, "$getLongestLine", this);
                this.unhook();
            }
        };
        this.updateFolds = function(data, session) {
            if (data.action == "add") {
                var start = data.data.range.start.row;
                var end = data.data.range.end.row;
                var mapRange = new Range(this.mapLine(start), data.data.range.start.column, this.mapLine(end), data.data.range.end.column);
                this.layer.session.addFold("...", mapRange);
            } else if (data.action == "remove") {
                var row = this.mapLine(data.data.range.start.row);
                var fold = this.layer.session.getFoldAt(row, this.layer.session.getLine(row).length, 1);
                if (fold)
                    this.layer.session.removeFold(fold);
            }
        };
        this.attach = function(temp) {
            if (!temp) {
                this.hook(this.renderer.$textLayer);
                this.renderer.on("afterRender", this.$doRender);
                override(this.renderer, "$getLongestLine", this);
                this.renderer.scroller.appendChild(this.content);
            }
            this.host.session.on('changeFold', this.$updateFolds);
            this.host.session.on("changeWrapMode", this.$updateWrapMode);
            this.host.session.on("changeWrapLimit", this.$changeWrapLimit);
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
            if (!_this.$lines.cells.length)
                return _this.update(config);
            var oldFirstRow = _this.$lines.cells[0].row;
            var lastRow = config.lastRow;
            var oldLastRow = _this.config ? _this.$lines.cells[_this.$lines.cells.length - 1].row : -1;
            if (_this.$lines.pageChanged(_this.config, config))
                return _this.update(config);
            if (!_this.config || oldLastRow < config.firstRow)
                return _this.update(config);

            if (lastRow < oldFirstRow)
                return _this.update(config);

            if (oldLastRow < config.firstRow)
                return _this.update(config);

            if (lastRow < oldFirstRow)
                return _this.update(config);


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
        this.detach = function() {
            this.layer.element.remove();
            revert(this.host, "$renderer", this, this);
            this.unhook();
        };
        this.update = function(config) {
            this.layer.update(config);
        };
        this.scrollLines = function(config) {
            if (config.lineOffset != this.layer.config.lineOffset)
                for (var line in this.layer.$lines.cells) {
                    var cell = this.layer.$lines.cells[line];
                    cell.element.style.top = this.computeLineTop(cell.row, config, this.layer.session) + "px";
                }
            this.layer.scrollLines(config);
        };
        /*todo
            use lastlinetext to get padded space
            and remove textalign left style
        */
        this.getText = function(session, row) {
            var text = (session.$firstLineNumber + row).toString();
            return text;
        };
        this.getWidth = function(session, rowText, config) {
            var lastRow = this.layer.$lines.last();
            lastRow = lastRow ? lastRow.row : this.unmapLine(config.lastRow);
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
        this.options.threeWay = false;
        this.options.alignLines = false;

        //////////Hacks To Make It Work With Acediff Methods
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
            left: new DiffFoldMode(2, 2),
            right: new DiffFoldMode(2, 2)
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
        this.lineWidgets = [];

        //array of equal line segments
        this.lines = [];
        this.$decorate = this.decorate.bind(this);
        this.gutter = new GutterLineVirus(this.editor.renderer);
        this.gutter.setSession(this.other);

        this.renderer = new TextLineVirus(this.editor.renderer);
        this.renderer.setSession(this.other);

        this.addCssClasses();
        this.diff();
        if (this.options.autoupdate) {
            this.startUpdate();
        }
        this.swapped = false;
        this.$handleMouseDown = this.handleMouseDown.bind(this);
        //this.$handleChangeSelection = this.handleChangeSelection.bind(this);
        this.editor.on('mousedown', this.$handleMouseDown);
        this.$update = this.updateAligns.bind(this);
        this.$changeCharacterSize = this.changeCharacterSize.bind(this);
        this.editor.on('change', this.$update);
        this.other.once('tokenizerUpdate', this.$decorate);
        this.other.on('changeWrapLimit', this.$decorate);
        this.editor.renderer.on('changeCharacterSize', this.$changeCharacterSize);
    }
    //Three Structures, One, Alignables, Widgets and Diffs
    //Diffs can be updated with update diff but until then
    //A way to keep things rolling
    //Inline markers will fail cus they need rawDiffs
    //New Goal
    //Use RangeList for inline markers
    //Update line markers on change
    //Get rid of diff format or use
    AceInlineDiff.prototype = {
        clickSwap: function(e, isWidget, row, column) {
            if (e) e.stop();
            this.swap();
            if (isWidget && !getOption(this, this.swapped ? C.EDITOR_RIGHT : C.EDITOR_LEFT, 'editable') &&
                getOption(this, this.swapped ? C.EDITOR_LEFT : C.EDITOR_RIGHT, 'editable'))
                this.allowSwap = true;
            this.editor.gotoLine(row + 1, pos.column);
        },
        changeCharacterSize: function(){
            if(this.scrollOffset){
                this.ace.renderer.setScrollMargin(this.scrollOffset * (this.ace.renderer.lineHeight || 14));
            }
        },
        clickCopy: function(e, isWidget, row, col, origPos) {
            if (isWidget && getOption(this, this.swapped ? C.EDITOR_RIGHT : C.EDITOR_LEFT, "editable")) {
                var widget = origPos.row < 0 ? this.current.topLineWidget : this.current.lineWidgets[origPos.row];
                var text = this.other.getLines(widget.start, widget.end - 1);
                this.current.getDocument().insertFullLines(widget.row + 1, text);
            }
        },
        handleMouseDown: function(e) {
            var offset = this.scrollOffset;
            var pos = this.editor.renderer.pixelToScreenCoordinates(e.clientX, e.clientY);
            var swap = (this.options.onClick == "swap" ? this.clickSwap : this.clickCopy).bind(this);
            //clicked topLineWidget
            if (pos.row < 0 && offset > 0) {
                var post = this.other.screenToDocumentPosition(pos.row + offset, pos.column, pos.offsetX);
                return swap(e, true, post.row, post.column, pos);
            }
            //clicked equal row;
            var position = this.current.screenToDocumentPosition(pos.row, pos.column, pos.offsetX);
            if (this.allowSwap) {
                var end = this.gutter.isHostEqualRow(position.row);
                if (end !== false) {
                    return swap(e, false, end, position.column, position);
                }
            }
            //clicked widget
            var widget = this.current.lineWidgets && this.current.lineWidgets[position.row];
            if (widget) {
                var screenRow = this.current.documentToScreenRow(position.row, Infinity);
                if (pos.row > screenRow) {
                    var otherPos = this.other.screenToDocumentPosition(this.other.documentToScreenRow(widget.start, 0) + (pos.row - screenRow - 1), pos.column, pos.offsetX);
                    return swap(e, true, otherPos.row, otherPos.column, position);
                }
            }
        },
        startUpdate: function() {
            if (!this.$diff) {
                this.$diff = throttle(this.diff, 1000).bind(this);
                //this.editor.on('change', this.$diff);
            }
        },
        updateAligns: function(change) {
            var a = change.lines.length - 1;
            if (a < 1) return;
            if (change.action == 'remove') a = -a;
            var b = change.start.row;
            var start = inverseSearch(this.lines, b);
            //next line
            if (start < 0) start = -(start + 1);
            else {
                start++;
            }
            var len = this.lines.length;
            for (var i = start; i < len; i++) {
                this.lines[i].mapStart += a;
            }
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
            if (this.swapped !== isRight) {
                oldSession && oldSession.off('changeWrapLimit', this.$decorate);
                this.other = session;
                this.renderer.setSession(this.other);
                this.gutter.setSession(this.other);
                this.editors.other.ace.session = this.other;
            } else {
                this.session = this.current = session;
                this.renderer.detach(true);
                this.editor.setSession(this.current);
                this.editor.setReadOnly(!getOption(this, (isSwap == this.swapped) ? C.EDITOR_LEFT : C.EDITOR_RIGHT, "editable"));
                this.renderer.attach(true);
            }
            if (isSwap)
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
                this.diff();
            }
        },
        diff: function() {
            var count = 0;
            var ses1 = this.sessions.left;
            var ses2 = this.sessions.right;
            var text1 = ses1.getValue();
            var text2 = ses2.getValue();
            var pair = this;
            if (!this.options.showInlineDiffs && ses1.getLength() + ses2.getLength() < 30000) {
                //todo cache also
                pair.diffs = getLineChunks(text1, text2, this.options.ignoreWhitespace, this.swapped);
            } else {
                var tag = pair.savedDiffs ? "saved" : "clean";
                pair.savedDiffs = pair.savedDiffs ? updateDiff(text1, text2, false, this.swapped, pair.savedDiffs) : getDiff(text1, text2, false, this.swapped);
                pair.diffs = getChunks(this.options.ignoreWhitespace ? getDiff(text1, text2, true, this.swapped, pair.savedDiffs) : pair.savedDiffs);
                if (this.options.showInlineDiffs) {
                    pair.rawDiffs = pair.savedDiffs;
                }
            }
            count += pair.diffs.length;

            if (count > this.options.maxDiffs) return this.clear();
            this.decorate();
        },
        swap: function() {
            var offset = this.scrollOffset * this.editor.renderer.layerConfig.lineHeight;
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
            this.diff();
        },
        decorate: function() {
            var diffs = this.diffs;
            this.clear();
            var putFragmentsAbove = (this.swapped == this.options.removedFragmentsBelow);
            var currentClass = this.swapped ? this.options.classes.removed : this.options.classes.added;
            var otherClass = this.swapped ? this.options.classes.added : this.options.classes.removed;
            //alignables are more flexible
            //than diffs, but diffs show a
            //clearer picture for widgets
            //{@todo}if we make findNextDiff use
            //alignables,we can free the memory
            //used by diffs after decorate
            var align = this.lines;
            var editor = this.editor;
            var equal = {
                start: 0,
                end: 0,
                mapStart: 0
            };
            var eq_start = function(s, m) {
                equal = {
                    start: s,
                    mapStart: m
                };
            };
            var eq_end = function(e) {
                //if (e != equal.start) {
                equal.end = e;
                align.push(equal);
                //}
            };
            diffs.forEach(function(item) {
                eq_end(item.rightStartLine);
                eq_start(item.rightEndLine, item.leftEndLine);
                if (item.rightEndLine > item.rightStartLine) addLineWidget(this, this.current, putFragmentsAbove ? item.leftStartLine : item.leftEndLine, item.rightStartLine, item.rightEndLine, this.other);
                if (item.leftEndLine > item.leftStartLine) {
                    this.markers.push(this.current.addMarker(new Range(item.leftStartLine, 0, item.leftEndLine - 1, Infinity), currentClass, 'fullLine'));
                }
                if (item.rightEndLine > item.rightStartLine) {
                    this.editors.other.markers.push(this.other.addMarker(new Range(item.rightStartLine, 0, item.rightEndLine - 1, Infinity), otherClass, 'fullLine'));
                }
            }, this);
            if (!this.scrollOffset)
                this.editor.renderer.setScrollMargin(0);
            eq_end(this.other.getLength());
            this.renderer.layer.config = this.gutter.layer.config = null;
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
            this.foldModes.left.aligns = this.foldModes.right.aligns = this.lines = this.gutter.alignables = this.renderer.alignables = [];
            clearLineWidgets(this);
            this.markers.forEach(function(marker) {
                this.current.removeMarker(marker);
            }, this);
            this.editors.other.markers.forEach(function(marker) {
                this.other.removeMarker(marker);
            }, this);
            this.markers = [];
            this.editors.other.markers = [];

        },
        resize: function(force) {
            this.editor.resize(force);
            this.editor.renderer.setScrollMargin(this.scrollOffset * (this.editor.renderer.lineHeight || 14));
        },
        destroy: function() {
            //Work in progress
            this.removeCssClasses();
            this.stopUpdate();
            this.editor.off('change', this.$diff);
            this.editor.off('change', this.$update);
            this.editor.off('mousedown', this.$handleMouseDown);
            this.editor.renderer.off('changeCharacterSize', this.$changeCharacterSize);
            this.other.off('changeWrapLimit', this.$decorate);

            revert(this.sessions.left, "$setFolding", this.sessions.left);
            revert(this.sessions.right, "$setFolding", this.sessions.right);
            this.sessions.left.$setFolding(this.foldModes.left.sub);
            this.sessions.right.$setFolding(this.foldModes.right.sub);
            this.clear();
            this.editor.renderer.setScrollMargin(0);
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
    AceInlineDiff.diff = function(editor, value_or_session, options) {
        var prop, isSession;
        value_or_session = value_or_session || "";
        while ((prop = value_or_session.__proto__)) {
            if (!prop || prop == Object.prototype) {
                options = value_or_session;
                value_or_session = "";
                if (options.right && (options.right.id || options.right.editor)) {
                    return AceDiff.diff(editor, null, options);
                }
                break;
            }
            if (prop == ace.Editor.prototype) {
                return AceDiff.diff(editor, value_or_session, options);
            } else if (prop == ace.EditSession.prototype) {
                isSession = true;
                break;
            } else if (prop == String.prototype) {
                break;
            }
        }
        if (typeof options == 'string') {
            if (isSession) editor.setSession(value_or_session);
            else editor.setValue(value_or_session);
            options = {
                right: {
                    content: options
                }
            };
        }
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

    //just a poc
    //AceInlineDiff spawned from acediff just
    //as acediff3 spawned from acediff
    //but the two codes have diverged beyond
    //reconciliation or have they???
    function AceDiff(options) {
        this.options = {};
        extend(true, this.options, AceDiff.defaults, {
            left: {
                content: null,
                session: undefined,
                editor: undefined,
            },
            right: {
                session: undefined,
                editor: undefined,
                content: null,
                editable: true
            }
        }, options);
        //////////Hacks To Make It Work With Acediff Methods
        this.editors = {
            left: {
                ace: getOption(this, C.EDITOR_LEFT, "editor") || ace.edit(getOption(this, C.EDITOR_LEFT, "id")),
                markers: [],
                lineWidgets: []
            },
            right: {
                ace: this.options.right.editor || ace.edit(this.options.right.id),
                markers: [],
                lineWidgets: []
            }
        };
        this.pairs = [this];
        this.left = C.EDITOR_LEFT;
        this.right = C.EDITOR_RIGHT;
        ///////////

        this.foldModes = {
            left: new DiffFoldMode(2, 2),
            right: new DiffFoldMode(2, 2)
        };
        if (this.options.left.session) {
            this.editors.left.ace.setSession(this.options.right.session);
        }
        if (this.options.right.session) {
            this.editors.right.ace.setSession(this.options.right.session);
        }
        this.sessions = {
            left: createSession(this, C.EDITOR_LEFT, this.editors.left.ace.session),
            right: createSession(this, C.EDITOR_RIGHT, this.editors.right.ace.session)
        };
        setupEditor(this, C.EDITOR_LEFT);
        setupEditor(this, C.EDITOR_RIGHT);

        //array of equal line segments
        this.lines = [];
        this.$decorate = this.decorate.bind(this);

        this.addCssClasses();
        this.diff();
        if (this.options.autoupdate) {
            this.startUpdate();
        }
    }
    AceDiff.prototype = Object.create(AceInlineDiff.prototype);
    (function() {
        this.addCssClasses = function() {
            dom.addCssClass(this.editors.left.ace.renderer.$gutterLayer.element, this.options.classes.gutterRemoved);
            dom.addCssClass(this.editors.left.ace.renderer.content, this.options.classes.contentRemoved);
            dom.addCssClass(this.editors.right.ace.renderer.$gutterLayer.element, this.options.classes.gutterAdded);
            dom.addCssClass(this.editors.right.ace.renderer.content, this.options.classes.contentAdded);
        };
        this.removeCssClasses = function() {
            dom.removeCssClass(this.editors.left.ace.renderer.$gutterLayer.element, this.options.classes.gutterRemoved);
            dom.removeCssClass(this.editors.left.ace.renderer.content, this.options.classes.contentRemoved);
            dom.removeCssClass(this.editors.right.ace.renderer.$gutterLayer.element, this.options.classes.gutterAdded);
            dom.removeCssClass(this.editors.right.ace.renderer.content, this.options.classes.contentAdded);
        };
        this.clear = function() {
            this.foldModes.left.aligns = this.foldModes.right.aligns = this.lines = [];
            clearLineWidgets(this.editors.left);
            this.editors.left.markers.forEach(function(marker) {
                this.sessions.left.removeMarker(marker);
            }, this);
            this.editors.right.markers.forEach(function(marker) {
                this.sessions.right.removeMarker(marker);
            }, this);
            clearLineWidgets(this.editors.right);
            this.editors.left.markers = [];
            this.editors.right.markers = [];

        };
        this.destroy = function() {
            this.clear();
            this.removeCssClasses();
            this.stopUpdate();
        };
        this.startUpdate = function() {
            if (!this.$diff) {
                this.$diff = throttle(this.diff, 1000).bind(this);
                this.editors.left.ace.on('change', this.$diff);
                this.editors.right.ace.on('change', this.$diff);
            }
        };
        this.stopUpdate = function() {
            if (this.$diff) {
                this.editors.left.ace.off('change', this.$diff);
                this.editors.right.ace.off('change', this.$diff);
                this.$diff = null;
            }
        };
        this.destroy = function() {
            this.removeCssClasses();
            this.clear();
            this.stopUpdate();
        };
        this.decorate = function() {
            this.clear();
            var diffs = this.diffs;
            var putFragmentsAbove = !this.options.removedFragmentsBelow;
            var currentClass = this.options.classes.removed;
            var otherClass = this.options.classes.added;
            var align = this.lines;
            var editor = this.editor;
            var equal = {
                start: 0,
                end: 0,
                mapStart: 0
            };
            var eq_start = function(s, m) {
                equal = {
                    start: s,
                    mapStart: m
                };
            };
            var eq_end = function(e) {
                //if (e != equal.start) {
                equal.end = e;
                align.push(equal);
                //}
            };
            diffs.forEach(function(item) {
                eq_end(item.rightStartLine);
                eq_start(item.rightEndLine, item.leftEndLine);
                var heightLeft = item.leftEndLine - item.leftStartLine;
                var heightRight = item.rightEndLine - item.rightStartLine;
                if (this.options.alignLines) {
                    if (heightRight > heightLeft) addLineWidget(this.editors.left, this.sessions.left, putFragmentsAbove ? item.leftStartLine : item.leftEndLine, heightLeft, heightRight);
                    else if (heightLeft > heightRight) addLineWidget(this.editors.right, this.sessions.right, putFragmentsAbove ? item.rightStartLine : item.rightEndLine, heightRight, heightLeft);
                }
                if (item.leftEndLine > item.leftStartLine) {
                    this.editors.left.markers.push(this.sessions.left.addMarker(new Range(item.leftStartLine, 0, item.leftEndLine - 1, Infinity), currentClass, 'fullLine'));
                }
                if (item.rightEndLine > item.rightStartLine) {
                    this.editors.right.markers.push(this.sessions.right.addMarker(new Range(item.rightStartLine, 0, item.rightEndLine - 1, Infinity), otherClass, 'fullLine'));
                }
            }, this);
            if (!this.editors.left.scrollOffset)
                this.editors.left.ace.renderer.setScrollMargin(0);
            if (!this.editors.right.scrollOffset)
                this.editors.right.ace.renderer.setScrollMargin(0);
            eq_end(this.sessions.right.getLength());
            if (this.rawDiffs)
                showInlineDiffs(this, C.EDITOR_LEFT, C.EDITOR_RIGHT, this.rawDiffs);
        };
    }).apply(AceDiff.prototype);
    AceDiff.diff = function(id, id2, options) {
        options = extend(true, {
                left: {
                    id: id
                },
                right: {
                    id: id2
                }
            },
            options);
        return new AceDiff(options);
    };
    AceDiff.defaults = AceInlineDiff.defaults = {
        mode: undefined,
        theme: null,
        diffGranularity: C.DIFF_GRANULARITY_BROAD,
        showInlineDiffs: true,
        removedFragmentsBelow: false,
        ignoreWhitespace: true,
        maxDiffs: 5000,
        editable: true,
        autoupdate: true,
        alignLines: false,
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
    return Object.assign(AceInlineDiff, {
        One: AceInlineDiff,
        Two: AceDiff,
        diffTwo: AceDiff.diff
    });
});