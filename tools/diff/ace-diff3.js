(function(root, factory) {
    if (typeof _Define === 'function') {
        _Define(factory, "AceDiff"); /*_EndDefine*/
    } else if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require());
    } else {
        root.AceDiff = factory(root);
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
        acediff.editors[side].markers.push(session.addMarker(new Range(line, from, toLine, to),
            acediff.options.classes.inline + (fade ? " fading" : ""), 'text', false));
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
                    var type = trailinglines[0] == C.DIFF_INSERT ? C.EDITOR_RIGHT : C
                        .EDITOR_LEFT;
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

    function getDiff(a, b, ignoreWhitespace, swap) {
        if (!dmp) dmp = new diff_match_patch();
        var diff = dmp.diff_main(a, b);
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

    function shift(before, center, after) {
        var eq1 = before[1];
        var diff = center[1];
        var start = eq1.lastIndexOf("\n");
        if (start > -1 && start < eq1.length - 1) {
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
                center[1] = diff.substring(head.length + 1) + head;
                after[1] = after[1].substring(head.length + 1);
            }
        }
    }

    function cleanUpLines(diff) {
        //alternative to using start of line
        //and end of line clean
        //try to make equal rows
        //end with newlines when possible
        dmp.diff_cleanupEfficiency(diff);
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
                var endOff = i == diff.length - 1 ? 1 :
                0; //(left.ch === 0 && right.ch === 0) ? 0 : 0;
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
            var pos = dir < 0 ? findPrevDiff(diff, line, isOrig) : findNextDiff(diff, line,
                isOrig);

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
                    return obj === null ? String(obj) : class2type[toString.call(obj)] ||
                        "object";
                },
                isPlainObject: function(obj) {
                    if (!obj || jQuery.type(obj) !== "object" || obj.nodeType) {
                        return false;
                    }
                    try {
                        if (obj.constructor && !hasOwn.call(obj, "constructor") && !hasOwn
                            .call(obj.constructor.prototype, "isPrototypeOf")) {
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
                    if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery
                            .isArray(copy)))) {
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

    // our constructor
    function AceDiff(options) {
        this.options = {};

        extend(true, this.options, {
            showConnectors: !(options && options.lockScrolling),
            showCopyArrows: window.innerWidth > 700,
            threeWay: options && options.center
        }, AceDiff.defaults, options);
        if (this.options.threeWay) {
            options = {};
            extend(true, options, {
                activeEditor: C.EDITOR_CENTER,
                classes: {
                    gutterLeftID: this.options.classes.gutterID + "-left",
                    gutterRightID: this.options.classes.gutterID + "-right",
                }
            }, this.options);
            this.options = options;
        } else options.center = undefined;
        // instantiate the editors in an internal data structure that will store a little info about the diffs and
        // editor content

        this.editors = {
            left: {
                ace: ace.edit(this.options.left.id),
                markers: [],
                lineLengths: []
            },
            right: {
                ace: ace.edit(this.options.right.id),
                markers: [],
                lineLengths: []
            }
        };

        setupEditor(this, C.EDITOR_RIGHT);
        setupEditor(this, C.EDITOR_LEFT);
        this.lineHeight = this.editors.left.ace.renderer.lineHeight ||
        14; // assumption: both editors have same line heights
        this.pairs = [];
        addEventHandlers(this, C.EDITOR_LEFT);
        addEventHandlers(this, C.EDITOR_RIGHT);
        if (this.options.threeWay) {
            this.editors[C.EDITOR_CENTER] = {
                ace: ace.edit(this.options.center.id),
                markers: [],
                lineLengths: []
            };
            this.pairs.push({
                left: C.EDITOR_LEFT,
                right: C.EDITOR_CENTER,
                gutterID: this.options.classes.gutterLeftID
            });
            this.pairs.push({
                left: C.EDITOR_CENTER,
                right: C.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterRightID
            });
            setupEditor(this, C.EDITOR_CENTER);
            addEventHandlers(this, C.EDITOR_CENTER);
        } else {
            this.pairs.push({
                left: C.EDITOR_LEFT,
                right: C.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterID
            });
        }
        this.editors[this.options.activeEditor].ace.focus();
        if (this.options.showConnectors) {
            createSvgContainer(this);
        }
        if (this.options.showCopyArrows) {
            createCopyContainers(this);
            addGutterEventHandlers(this);
        }


        addWindowResizeHandler(this);
        // store the visible height of the editors (assumed the same)
        this.editorHeight = getEditorHeight(this);
        this.diff();

        var count = 0,
            total = 0;
        var init = (function() {
            if (++count < total) return;
            this.decorate();
        }).bind(this);
        for (var i in this.editors) {
            this.editors[i].ace.renderer.once('afterRender', init);
            total++;
        }
        this.goNextDiff(this.editors[this.options.activeEditor].ace);
    }

    // our public API
    AceDiff.prototype = {
        getNumDiffs: function() {
            return this.diffs.length;
        },

        // exposes the Ace editors in case the dev needs it
        getEditors: function() {
            return {
                left: this.editors.left.ace,
                center: this.editors.right.ace,
                right: this.editors.right.ace
            };
        },
        goNextDiff: function(editor) {
            return goNearbyDiff(this, editor, 1);
        },
        goPrevDiff: function(editor) {
            return goNearbyDiff(this, editor, -1);
        },

        diff: function() {
            var count = 0;
            for (var i in this.pairs) {
                var pair = this.pairs[i];
                var ses1 = this.editors[pair.left].ace.getSession();
                var ses2 = this.editors[pair.right].ace.getSession();
                var text1 = ses1.getValue();
                var text2 = ses2.getValue();
                if (this.options.showInlineDiffs) {
                    pair.rawDiffs = getDiff(text1, text2, false);
                    pair.diffs = getChunks(this.options.ignoreWhitespace ? getDiff(
                        text1, text2, true) : pair.rawDiffs);
                } else if (ses1.getLength() + ses2.getLength() < 65535) {
                    pair.diffs = getLineChunks(text1, text2, this.options
                        .ignoreWhitespace);
                } else pair.diffs = getChunks(getDiff(text1, text2, this.options
                    .ignoreWhitespace));

                count += pair.diffs.length;
            }
            if (count > this.options.maxDiffs) return;
            if (this.pairs.length > 1)
                splitDiffs(this.pairs[0].diffs, this.pairs[1].diffs);
            decorating = false;
            this.decorate();
        },
        decorate: function() {
            var acediff = this;
            if (decorating)
                return;
            decorating = true;
            clearDiffMarkers(acediff);
            if (acediff.options.alignLines) {
                for (var i in this.editors) {
                    clearLineWidgets(acediff.editors[i]);
                }
                var offsets = computeOffsets(acediff.pairs[0].diffs, acediff.pairs[1] ?
                    acediff.pairs[1].diffs : null);
                for (i in this.editors) {
                    for (var j in offsets[i]) {
                        addLineWidget(acediff.editors[i], Number(j), offsets[i][j]);
                    }
                }
            }
            if (acediff.pairs.length == 1) {
                if (acediff.options.showDiffs) {
                    acediff.pairs[0].diffs.forEach(function(info) {
                        showDiff(acediff, right, info.rightStartLine, info
                            .rightEndLine, acediff.options.classes.added);
                        showDiff(acediff, left, info.leftStartLine, info
                            .leftEndLine, acediff.options.classes.removed);
                    });
                }
                if (pair.rawDiffs)
                    showInlineDiffs(acediff, pair.left, pair.right, pair.rawDiffs);
            } else {
                if (acediff.options.showDiffs) {
                    highlight3(acediff, acediff.pairs[0]);
                    highlight3(acediff, acediff.pairs[1]);
                }
            }
            this.update(true);
            decorating = false;
        },
        update: function(gutter) {
            var acediff = this;
            gutter = gutter && this.options.showCopyArrows;
            var connect = this.options.showConnectors;
            if (!(connect || gutter)) return;

            if (gutter) {
                clearArrows(acediff);
            }
            if (connect)
                clearSvgContainer(acediff);

            acediff.pairs.forEach(function(pair) {
                pair.diffs.forEach(function(info, diffIndex) {
                    if (gutter) {
                        addCopyArrows(acediff, info, diffIndex, pair);
                    }
                    if (connect) {
                        var left = pair.left;
                        var right = pair.right;
                        var leftScrollTop = acediff.editors[left].ace
                            .getSession().getScrollTop();
                        var rightScrollTop = acediff.editors[right].ace
                            .getSession().getScrollTop();
                        var side = C.EDITOR_LEFT;
                        if (pair.left == C.EDITOR_CENTER) {
                            side = C.EDITOR_RIGHT;
                        }
                        addConnector(acediff, pair, info.leftStartLine,
                            info.leftEndLine, info.rightStartLine,
                            info.rightEndLine, leftScrollTop,
                            rightScrollTop, acediff.options.classes[
                                side + "Diff"]);
                    }
                });
            });
            if (this.options.showCopyArrows) {
                positionCopyContainers(acediff);
            }
        },

        destroy: function() {
            window.removeEventListener('resize', this.$onResize);
            removeEventHandlers(this);
            clearDiffMarkers(this);
            if (this.options.showCopyArrows) {
                clearArrows(this);
                this.pairs.forEach(function(pair) {
                    var gutter = document.getElementById(pair.gutterID);
                    gutter.removeEventListener('click', pair.$gutterClickLeft);
                    gutter.removeEventListener('click', pair.$gutterClickRight);
                });
            }
            for (var i in this.editors) {
                if (!this.options[i].editor) {
                    this.editors[i].destroy();
                }
            }
            if (this.options.showConnectors) {
                this.pairs.forEach(function(pair) {
                    document.getElementById(pair.gutterID).removeChild(pair
                    .svg);
                });
            }
        }

    };

    function setupEditor(acediff, side) {
        var commands = {
            nextDiff: {
                name: "nextDiff",
                exec: function(editor) {
                    acediff.goNextDiff(editor);
                },
                bindKey: "Ctrl-N"
            },
            prevDiff: {
                name: "prevDiff",
                exec: function(editor) {
                    acediff.goPrevDiff(editor);
                },
                bindKey: "Ctrl-P"
            }
        };
        var options = getOption(acediff, side, 'options');
        if (options) {
            acediff.editors[side].ace.setOptions(options);
        }
        acediff.editors[side].ace.getSession().setMode(getOption(acediff, side, 'mode'));
        acediff.editors[side].ace.setReadOnly(!acediff.options[side].editable);
        acediff.editors[side].ace.setTheme(getOption(acediff, side, 'theme'));
        // if the data is being supplied by an option, set the editor values now
        if (acediff.options[side].content) {
            acediff.editors[side].ace.setValue(acediff.options[side].content, -1);
        }
        for (var i in commands)
            acediff.editors[side].ace.commands.addCommand(commands[i]);
    }

    function syncScrolling(acediff, side, tag, close) {
        //this can end up in an endless loop
        if (!close) {
            tag = new Date().getTime();
            //scroll cooldown
            if (tag - acediff.editors[side].tag < 1000)
                return;
        } else if (!tag) throw 'ValueError';
        acediff.scrollSyncing = true;
        try {
            acediff.editors[side].tag = tag;
            for (var i in acediff.pairs) {
                var pair = acediff.pairs[i];
                var other = pair.left == side ?
                    pair.right :
                    pair.right == side ?
                    pair.left : null;
                if (!other) continue;
                var editor = acediff.editors[other];
                if (editor.tag == tag) continue;
                var result = syncPair(acediff, pair, side == pair.left);
                if (result)
                    syncScrolling(acediff, other, tag, true);
            }
        } catch (e) {
            console.error(e);
        }
        acediff.scrollSyncing = !!close;
        if (!acediff.scrollSyncing) {
            acediff.editors[side].tag = 0;
        }
    }

    function syncPair(acediff, pair, isLeft) {
        var side = isLeft ? pair.left : pair.right;
        var other = isLeft ? pair.right : pair.left;
        var editor = acediff.editors[side];
        var otherEditor = acediff.editors[other];
        var scroll, targetScrollTop;
        if (!otherEditor.ace) return;
        if (acediff.options.alignLines) {
            scroll = getScrollingInfo(acediff, side) - acediff.editors[side].scrollOffset *
                acediff.lineHeight;
            var top = getScrollingInfo(acediff, other);
            var offset = otherEditor.scrollOffset * acediff.lineHeight;

            if (offset + top != clampScroll(otherEditor, scroll + offset)) {
                targetScrollTop = scroll + offset;
            }
        } else {
            //Copied from codemirror source
            var config = editor.ace.renderer.layerConfig;
            var size = editor.ace.renderer.$size;
            var targetPos = 0;
            scroll = getScrollingInfo(acediff, side);

            var halfScreen = 0.5 * size.scrollerHeight,
                midY = scroll + halfScreen;
            var mid = getLineAtHeight(editor, midY);
            var around = chunkBoundariesAround(pair.diffs, mid, isLeft);
            var off = getOffsets(editor, isLeft ? around.edit : around.orig);
            var offOther = getOffsets(otherEditor, isLeft ? around.orig : around.edit);
            var ratio = (midY - off.top) / (off.bot - off.top);
            targetPos = (offOther.top - halfScreen) + ratio * (offOther.bot - offOther.top);
            var botDist, mix;
            // Some careful tweaking to make sure no space is left out of view
            // when scrolling to top or bottom.
            halfScreen = Math.min(config.maxHeight - size.scrollerHeight, halfScreen);
            if (targetPos > scroll && (mix = scroll / halfScreen) < 1) {
                targetPos = targetPos * mix + scroll * (1 - mix);
            } else if ((botDist = config.maxHeight - size.scrollerHeight - scroll) <
                halfScreen) {
                var otherInfo = getScrollingInfo(acediff, other);
                var otherConfig = otherEditor.ace.renderer.layerConfig;
                var otherSize = otherEditor.ace.renderer.$size;

                var botDistOther = otherConfig.maxHeight - otherSize.scrollerHeight - targetPos;
                if (botDistOther > botDist && (mix = botDist / (halfScreen)) < 1)
                    targetPos = targetPos * mix + (otherConfig.maxHeight - otherSize
                        .scrollerHeight - botDist) * (1 - mix);
            }
            targetScrollTop = clampScroll(otherEditor, targetPos);
        }
        otherEditor.ace.session.setScrollTop(targetScrollTop);
        return true;
    }

    function chunkBoundariesAround(chunks, n, nInEdit) {
        var beforeE, afterE, beforeO, afterO;
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            var fromLocal = nInEdit ? chunk.leftStartLine : chunk.rightStartLine;
            var toLocal = nInEdit ? chunk.leftEndLine : chunk.rightEndLine;
            if (afterE == null) {
                if (fromLocal > n) {
                    afterE = chunk.leftStartLine;
                    afterO = chunk.rightStartLine;
                } else if (toLocal > n) {
                    afterE = chunk.leftEndLine;
                    afterO = chunk.rightEndLine;
                }
            }
            if (toLocal <= n) {
                beforeE = chunk.leftEndLine;
                beforeO = chunk.rightEndLine;
            } else if (fromLocal <= n) {
                beforeE = chunk.leftStartLine;
                beforeO = chunk.rightStartLine;
            }
        }
        return { edit: { before: beforeE, after: afterE }, orig: { before: beforeO,
                after: afterO } };
    }

    function getOffsets(editor, around) {
        var bot = around.after;
        if (bot == null) bot = editor.ace.getSession().getLength();;
        return {
            top: getRowPosition(editor, around.before || 0, false),
            bot: getRowPosition(editor, bot, false)
        };
    }

    function cursorToScreenPos(cursor) {
        var pos = editor.renderer.$cursorLayer.getPixelPosition(cursor, true);
        pos.left += editor.renderer.gutterWidth - editor.session.getScrollLeft() + editor
            .renderer.margin.left;
        pos.top += editor.renderer.margin.top - editor.renderer.layerConfig.offset;
        return pos;
    }

    function removeEventHandlers(acediff) {
        for (var i in acediff.events) {
            var events = acediff.events[i];
            events[0].off(events[1], events[2]);
        }
        acediff.events = null;
    }

    function addEventHandlers(acediff, side) {
        var self = acediff;
        if (!self.events) self.events = [];

        function addEvent(target, name, func) {
            acediff.events.push([target, name, func]);
            target.on(name, func);
        }
        var synchronize = throttle(syncScrolling, 70);
        addEvent(acediff.editors[side].ace, "mousedown", function() {
            acediff.activeEditor = side;
        });
        addEvent(acediff.editors[side].ace.getSession(), 'changeScrollTop', function(scroll) {
            if (acediff.options.lockScrolling && !acediff.scrollSyncing) {
                synchronize(acediff, side);
            }
            acediff.editors[side].ace.renderer.once('afterRender', function() {
                acediff.update(false);
            });
        });
        if (acediff.options.showConnectors || acediff.options.showCopyArrows) {
            addEvent(acediff.editors[side].ace.getSession(), 'changeFold', function(scroll) {
                acediff.update(true);
            });
        }
        var diff = throttle(acediff.diff, 500).bind(acediff);
        addEvent(acediff.editors[side].ace, 'change', diff);
    }

    function addGutterEventHandlers(acediff) {
        acediff.pairs.forEach(function(pair) {
            var gutterID = pair.gutterID;
            if (acediff.options[pair.left].copyLinkEnabled) {
                pair.$gutterClickLeft = delegate(gutterID, 'click', '.' + acediff
                    .options.classes.newCodeConnectorLink,
                    function(e) {
                        copy(acediff, e, pair, C.LTR);
                    });
            }
            if (acediff.options[pair.right].copyLinkEnabled) {
                pair.$gutterClickRight = delegate(gutterID, 'click', '.' + acediff
                    .options.classes.deletedCodeConnectorLink,
                    function(e) {
                        copy(acediff, e, pair, C.RTL);
                    });
            }
        });
    }

    function addWindowResizeHandler(acediff) {
        var onResize = debounce(function() {
            acediff.availableHeight = document.getElementById(acediff.options.left.id)
                .offsetHeight;
            acediff.update(true);
        }, 250);
        acediff.$onResize = onResize;
        window.addEventListener('resize', onResize);
    }

    function copy(acediff, e, pair, dir) {
        var diffs = pair.diffs;
        var left = pair.left;
        var right = pair.right;
        var diffIndex = parseInt(e.target.getAttribute('data-diff-index'), 10);
        var diff = diffs[diffIndex];
        var sourceEditor, targetEditor;
        var startLine, endLine, targetStartLine, targetEndLine;
        if (dir == C.LTR) {
            sourceEditor = acediff.editors[left];
            targetEditor = acediff.editors[right];
            startLine = diff.leftStartLine;
            endLine = diff.leftEndLine;
            targetStartLine = diff.rightStartLine;
            targetEndLine = diff.rightEndLine;
        } else if (dir == C.RTL) {
            targetEditor = acediff.editors[left];
            sourceEditor = acediff.editors[right];
            targetStartLine = diff.leftStartLine;
            targetEndLine = diff.leftEndLine;
            startLine = diff.rightStartLine;
            endLine = diff.rightEndLine;
        }

        var startContent = '';
        for (var i = 0; i < targetStartLine; i++) {
            startContent += getLine(targetEditor, i) + '\n';
        }

        var contentToInsert = '';
        for (var j = startLine; j < endLine; j++) {
            contentToInsert += getLine(sourceEditor, j) + '\n';
        }

        var endContent = '';
        var totalLines = targetEditor.ace.getSession().getLength();
        for (var k = targetEndLine; k < totalLines; k++) {
            endContent += getLine(targetEditor, k);
            if (k < totalLines - 1) {
                endContent += '\n';
            }
        }
        if (!endContent) {
            contentToInsert = contentToInsert.substring(0, contentToInsert.length - 1);
        }

        //endContent = endContent.replace(/\s*$/, '');

        // keep track of the scroll height
        var h = targetEditor.ace.getSession().getScrollTop();
        targetEditor.ace.getSession().setValue(startContent + contentToInsert + endContent);
        targetEditor.ace.getSession().setScrollTop(parseInt(h));

        acediff.diff();
    }


    function clearDiffMarkers(acediff) {
        acediff.editors.left.markers.forEach(function(marker) {
            this.editors.left.ace.getSession().removeMarker(marker);
        }, acediff);
        acediff.editors.right.markers.forEach(function(marker) {
            this.editors.right.ace.getSession().removeMarker(marker);
        }, acediff);
        if (acediff.options.threeWay)
            acediff.editors.center.markers.forEach(function(marker) {
                this.editors.center.ace.getSession().removeMarker(marker);
            }, acediff);
    }

    function clearLineWidgets(editor) {
        editor.scrollOffset = 0;
        editor.ace.renderer.setScrollMargin(0);
        if (!editor.lineWidgets) return;

        for (var i in editor.lineWidgets) {
            editor.ace.session.widgetManager.removeLineWidget(editor.lineWidgets[i]);
        }
        editor.lineWidgets = [];
    }

    function clearSvgContainer(acediff) {
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i];
            var gutterEl = document.getElementById(pair.gutterID);
            gutterEl.removeChild(pair.svg);
        }
        createSvgContainer(acediff);
    }


    function clearArrows(acediff) {
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i];
            pair.leftDiv.innerHTML = '';
            pair.rightDiv.innerHTML = '';
        }
    }

    function createArrow(info) {
        var el = document.createElement('div');
        var props = {
            'class': info.className,
            'style': 'top:' + info.topOffset + 'px',
            title: info.tooltip,
            'data-diff-index': info.diffIndex
        };
        for (var key in props) {
            el.setAttribute(key, props[key]);
        }
        el.innerHTML = info.arrowContent;
        return el;
    }

    function createSvgContainer(acediff) {
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i];
            var id = pair.gutterID;
            var gutter = document.getElementById(id);
            acediff.gutterHeight = gutter.clientHeight;
            acediff.gutterWidth = gutter.clientWidth;
            var leftHeight = getTotalHeight(acediff, pair.left);
            var rightHeight = getTotalHeight(acediff, pair.right);
            var height = Math.max(leftHeight, rightHeight, acediff.gutterHeight);

            pair.svg = document.createElementNS(C.SVG_NS, 'svg');
            pair.svg.setAttribute('width', acediff.gutterWidth);
            pair.svg.setAttribute('height', height);

            gutter.appendChild(pair.svg);
            if ((" " + gutter.className + " ").indexOf(acediff.options.classes.gutterClass) <
                0) {
                gutter.className += " " + acediff.options.classes.gutterClass;
            }
        }
    }
    // shows a diff in one of the two editors.
    function showDiff(acediff, side, startLine, endLine, className) {
        var editor = acediff.editors[side];
        if (endLine < startLine) { // can this occur? Just in case.
            endLine = startLine;
        }

        var classNames = className + ' ' + ((endLine > startLine) ? 'lines' : 'targetOnly');
        endLine--; // because endLine is always + 1
        if (acediff.options.alignLines && endLine < startLine) {
            endLine++;
        }
        // to get Ace to highlight the full row we just set the start and end chars to 0 and 1
        editor.markers.push(editor.ace.session.addMarker(new Range(startLine, 0, endLine, 1),
            classNames, 'fullLine'));

    }

    function addConnector(acediff, pair, leftStartLine, leftEndLine, rightStartLine,
        rightEndLine, leftScrollTop, rightScrollTop, className) {
        // All connectors, regardless of ltr or rtl have the same point system, even if p1 === p3 or p2 === p4
        //  p1   p2
        //
        //  p3   p4
        className = acediff.options.classes.connector + " " + className;
        acediff.connectorYOffset = 1;
        var editorLeft = acediff.editors[pair.left];
        var editorRight = acediff.editors[pair.right];
        var p1_x = -1;
        var p1_y = getRowPosition(editorLeft, leftStartLine) + 0.5;
        var p2_x = acediff.gutterWidth + 1;
        var p2_y = getRowPosition(editorRight, rightStartLine) + 0.5;
        var p3_x = -1;
        var p3_y = getRowPosition(editorLeft, leftEndLine) + acediff.connectorYOffset + 0.5;
        var p4_x = acediff.gutterWidth + 1;
        var p4_y = getRowPosition(editorRight, rightEndLine) + acediff.connectorYOffset + 0.5;
        var curve1 = getCurve(p1_x, p1_y, p2_x, p2_y);
        var curve2 = getCurve(p4_x, p4_y, p3_x, p3_y);

        var verticalLine1 = 'L' + p2_x + ',' + p2_y + ' ' + p4_x + ',' + p4_y;
        var verticalLine2 = 'L' + p3_x + ',' + p3_y + ' ' + p1_x + ',' + p1_y;
        var d = curve1 + ' ' + verticalLine1 + ' ' + curve2 + ' ' + verticalLine2;

        var el = document.createElementNS(C.SVG_NS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('class', className);
        pair.svg.appendChild(el);
    }

    function addCopyArrows(acediff, info, diffIndex, pair) {
        var arrow;
        if (info.leftEndLine > info.leftStartLine && acediff.options.left.copyLinkEnabled) {
            arrow = createArrow({
                className: acediff.options.classes.newCodeConnectorLink,
                topOffset: getRowPosition(acediff.editors[pair.left], info
                    .leftStartLine, false),
                tooltip: 'Copy to right',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.newCodeConnectorLinkContent
            });
            pair.rightDiv.appendChild(arrow);
        }

        if (info.rightEndLine > info.rightStartLine && acediff.options.right.copyLinkEnabled) {
            arrow = createArrow({
                className: acediff.options.classes.deletedCodeConnectorLink,
                topOffset: getRowPosition(acediff.editors[pair.right], info
                    .rightStartLine, false),
                tooltip: 'Copy to left',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.deletedCodeConnectorLinkContent
            });
            pair.leftDiv.appendChild(arrow);
        }
    }

    function positionCopyContainers(acediff) {
        function setStyle(pair, leftTopOffset, rightTopOffset) {
            pair.leftDiv.style.cssText = 'top: ' + (-rightTopOffset) + 'px';
            pair.rightDiv.style.cssText = 'top: ' + (-leftTopOffset) + 'px';
        }
        acediff.pairs.forEach(function(pair) {
            var leftTopOffset = acediff.editors[pair.left].ace.getSession()
                .getScrollTop(); //+acediff.editors.left.scrollOffset*acediff.lineHeight;
            var rightTopOffset = acediff.editors[pair.right].ace.getSession()
                .getScrollTop(); //+acediff.editors.right.scrollOffset*acediff.lineHeight;
            setStyle(pair, leftTopOffset, rightTopOffset);
        });

    }
    // creates two contains for positioning the copy left + copy right arrows
    function createCopyContainers(acediff) {
        acediff.pairs.forEach(function(cont) {
            cont.leftDiv = document.createElement('div');
            cont.rightDiv = document.createElement('div');
            cont.leftDiv.setAttribute('class', acediff.options.classes
                .copyLeftContainer);
            cont.rightDiv.setAttribute('class', acediff.options.classes
                .copyRightContainer);

            document.getElementById(cont.gutterID).appendChild(cont.rightDiv);
            document.getElementById(cont.gutterID).appendChild(cont.leftDiv);
        });
    }


    function addLineWidget(editor, line, no) {
        if (!editor.lineWidgets) {
            editor.lineWidgets = []; //editor.ace.session.widgetManager
        }
        if (!editor.ace.session.widgetManager) {
            editor.ace.session.widgetManager = new LineWidgets(editor.ace.session);
            editor.ace.session.widgetManager.attach(editor.ace);
        }
        if (!no) return;
        if (!line) {
            editor.scrollOffset += no;
            decorating = true;
            //setting scroll margin triggers decorate
            editor.ace.renderer.setScrollMargin(editor.scrollOffset * editor.ace.renderer
                .lineHeight);
            decorating = false;
            return;
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: "diff",
        };
        editor.lineWidgets.push(w);
        editor.ace.session.widgetManager.addLineWidget(w);
    }

    var decorating;

    function highlight3(acediff, pair) {
        //the editted pane and origin pane
        var other, center,
            //relative position of origin
            centerPosition,
            conflict = acediff.options.classes.conflict,
            class_ = acediff.options.classes.removed,
            otherClass = acediff.options.classes.added;
        if (pair.right == C.EDITOR_CENTER) {
            center = pair.right;
            other = pair.left;
            centerPosition = C.EDITOR_RIGHT;
            class_ += " " + acediff.options.classes.fromLeft;
        } else {
            other = pair.right;
            center = pair.left;
            centerPosition = C.EDITOR_LEFT;
            class_ += " " + acediff.options.classes.fromRight;
        }
        pair.diffs.forEach(function(info) {
            var stops = info.stops;
            var start = info[centerPosition + "StartLine"];
            //highlight conflict blocks in center
            for (var i in stops) {
                if (stops[i][1] > start) {
                    showDiff(acediff, center, start, stops[i][1], stops[i][0] ?
                        conflict : class_);
                }
                start = stops[i][1];
            }
            if (info[centerPosition + "EndLine"] > start)
                showDiff(acediff, center, start, info[centerPosition + "EndLine"],
                    class_);
            showDiff(acediff, other, info[other + "StartLine"], info[other + "EndLine"],
                otherClass);
        });
        if (pair.rawDiffs) {
            showInlineDiffs(acediff, pair.left, pair.right, pair.rawDiffs);
        }
    }


    //used to get get the conflict zones
    //a diff
    function splitDiffs(diff1, diff2) {
        var line = 0;
        var index1 = 0;
        var index2 = 0;
        var offset1, offset2, end1, end2;
        var swapped = false;

        function swap() {
            var temp;
            temp = index2;
            index2 = index1;
            index1 = temp;
            temp = diff2;
            diff2 = diff1;
            diff1 = temp;
            temp = end2;
            end2 = end1;
            end1 = temp;
            temp = offset2;
            offset2 = offset1;
            offset1 = temp;
            swapped = !swapped;
        }
        while (index1 < diff1.length && index2 < diff2.length) {
            if (swapped) {
                offset2 = diff2[index2].rightStartLine;
                offset1 = diff1[index1].leftStartLine;
                end2 = diff2[index2].rightEndLine;
                end1 = diff1[index1].leftEndLine;
            } else {
                offset1 = diff1[index1].rightStartLine;
                offset2 = diff2[index2].leftStartLine;
                end1 = diff1[index1].rightEndLine;
                end2 = diff2[index2].leftEndLine;
            }
            if (offset1 <= offset2) {
                if (end1 <= offset2) {
                    index1++;
                    continue;
                }
                diff1[index1].stops || (diff1[index1].stops = []);
                diff2[index2].stops || (diff2[index2].stops = []);
                if (end1 <= end2) {
                    diff1[index1].stops.push([false, offset2]);
                    diff1[index1++].stops.push([true, end1]);
                    diff2[index2].stops.push([true, end1]);
                    swap();
                } else {
                    diff1[index1].stops.push([false, offset2]);
                    diff1[index1].stops.push([true, end2]);
                    diff2[index2++].stops.push([true, end2]);

                }
            } else {
                swap();
            }

        }
        if (swapped) swap();
    }

    //computeOffsets for aligning lines
    //provided no folding
    function computeOffsets(diffs, diff2) {
        var diff;
        var left = {};
        var right = {};
        var leftEndLine = 0,
            rightEndLine = 0;
        for (var j in diffs) {
            var info = diffs[j];
            rightEndLine = info.rightEndLine;
            leftEndLine = info.leftEndLine;
            var heightLeft = info.leftEndLine - info.leftStartLine;
            var heightRight = info.rightEndLine - info.rightStartLine;
            var offset = heightLeft - heightRight;
            if (offset > 0) {
                right[rightEndLine] = offset;
            } else if (offset < 0) {
                left[leftEndLine] = -offset;
            }
        }
        if (!diff2) {
            return {
                left: left,
                leftEndLine: leftEndLine,
                right: right,
                rightEndLine: rightEndLine
            };
        } else {
            var other = computeOffsets(diff2);
            var lastline = Math.max(rightEndLine, other.leftEndLine) + 1;
            var la = -1,
                lb = -1,
                a = 0,
                b = 0;
            for (var i = 0; i < lastline;) {
                var offsetLeft = right[i] || 0;
                var offsetRight = other.left[i] || 0;
                var delta = offsetLeft - offsetRight;
                var db = offsetRight - (other.right[i] || 0);
                var da = (left[i] || 0) - offsetLeft;

                if (delta > 0) {
                    other.right[b] = (other.right[b] || 0) + delta;
                    other.left[i] = offsetLeft;

                } else if (delta < 0) {
                    left[a] = (left[a] || 0) - delta;
                    right[i] = offsetRight;
                }
                a -= da;
                b += db;
                i++, a++, b++;
            }
            for (i in right)
                if (right[i] != other.left[i]) {
                    console.error(other.left);
                    throw Error("failed to merge offsets");
                }
            return {
                left: left,
                leftEndLine: leftEndLine,
                center: right,
                centerEndLine: lastline - 1,
                right: other.right,
                rightEndLine: other.rightEndLine
            };

        }
    }
    /*Note
    //Refactoring in progress
    //Functions with args(acediff,editor ....)
    //require a pane for editor value ie left,right,center,only etc
    //Functions with args(editor ..) require an editor object
    */
    function getScrollingInfo(acediff, editor) {
        return acediff.editors[editor].ace.getSession().getScrollTop();
    }

    function getEditorHeight(acediff) {
        //editorHeight: document.getElementById(acediff.options.left.id).clientHeight
        return document.getElementById(acediff.options.left.id).offsetHeight;
    }
    // note that this and everything else in this script uses 0-indexed row numbers
    function endOfLineClean(diff, i) {
        if (i == diff.length - 1) return true;
        var next = diff[i + 1][1];
        if ((next.length == 1 && i < diff.length - 2) || next.charCodeAt(0) != 10) return false;
        if (i == diff.length - 2) return true;
        next = diff[i + 2][1];
        return (next.length > 1 || i == diff.length - 3) && next.charCodeAt(0) == 10;
    }

    function startOfLineClean(diff, i) {
        if (i == 0) return true;
        var last = diff[i - 1][1];
        if (last.charCodeAt(last.length - 1) != 10) return false;
        if (i == 1) return true;
        last = diff[i - 2][1];
        return last.charCodeAt(last.length - 1) == 10;
    }


    function getLine(editor, line) {
        return editor.ace.getSession().getLine(line);
    }
    /*ace layer config
        rowScreen = session.documentToScreenRow(row,column).row
        
        row = session.screenToDocumentRow(row,column).row
        //column only matters in wrapped lines
        row == rowScreen when there are no
        folds, linewidgets, or wrapped lines
        
        renderer.layerConfig.offset
        //offset:the part of the first row that is above the screen
        renderer.layerConfig.firstRowScreen*renderer.lineHeight
        ===
        renderer.scrollTop
    */
    function getRowPosition(editor, row, onScreen) {
        if (onScreen === undefined)
            onScreen = true;
        var top = editor.ace.renderer.$cursorLayer.getPixelPosition({ row: row, column: 0 },
                onScreen).top -
            (onScreen ? editor.ace.renderer.layerConfig.offset : 0);
        return top;
    }

    function getLineAtHeight(editor, pos, local) {
        if (local == 'local')
            pos += editor.ace.renderer.scrollTop - editor.ace.renderer.layerConfig.offset;
        var row = pos / editor.ace.renderer.lineHeight;
        row -= editor.ace.renderer.layerConfig.firstRowScreen;
        row = editor.ace.session.screenToDocumentRow(row, 0);
        return row;
    }
    //clamp scrollTop to acceptable params
    function clampScroll(editor, scroll) {
        var r = editor.ace.renderer;
        var sm = r.scrollMargin;
        return Math.max(-sm.top,
            Math.min(scroll, r.layerConfig.maxHeight - r.$size.scrollerHeight + sm.bottom));

    }


    // acediff.editors.left.ace.getSession().getLength() * acediff.lineHeight
    function getTotalHeight(acediff, editor) {
        return acediff.editors[editor].ace.getSession().getScreenLength() * acediff.lineHeight;
    }

    // generates a Bezier curve in SVG format
    function getCurve(startX, startY, endX, endY) {
        var w = endX - startX;
        var halfWidth = startX + (w / 2);

        // position it at the initial x,y coords
        var curve = 'M ' + startX + ' ' + startY +

            // now create the curve. This is of the form "C M,N O,P Q,R" where C is a directive for SVG ("curveto"),
            // M,N are the first curve control point, O,P the second control point and Q,R are the final coords
            ' C ' + halfWidth + ',' + startY + ' ' + halfWidth + ',' + endY + ' ' + endX + ',' +
            endY;

        return curve;
    }


    function delegate(elSelector, eventName, selector, fn) {
        var element = document.getElementById(elSelector);
        var func = function(event) {
            var possibleTargets = element.querySelectorAll(selector);
            var target = event.target;

            for (var i = 0, l = possibleTargets.length; i < l; i++) {
                var el = target;
                var p = possibleTargets[i];

                while (el && el !== element) {
                    if (el === p) {
                        return fn.call(p, event);
                    }
                    el = el.parentNode;
                }
            }
        };
        element.addEventListener(eventName, func);
        return func;
    }

    //allow a function 'func' to only be executed once
    //ignoring the previous(or future if 'immediate') calls
    //if the intervals between them are all less than wait
    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this,
                args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    AceDiff.diff = function(container, opts) {
        function c(id, className) {
            var left = document.createElement('div');
            left.className = className;
            left.id = id;
            container.appendChild(left);
        }
        container.className += " acediff-container";
        c('acediff-left-editor', 'acediff-editor');
        if (opts.center && opts.threeWay !== false) {
            container.className += " acediff-three-pane";
            c('acediff-gutter-left', 'acediff-gutter');
            c('acediff-center-editor', 'acediff-editor');
            c('acediff-gutter-right', 'acediff-gutter');
        } else {
            c('acediff-gutter', 'acediff-gutter');
        }
        c('acediff-right-editor', 'acediff-editor');
        return new AceDiff(opts);
    };
    AceDiff.defaults = {
        mode: null,
        theme: null,
        ignoreWhitespace: false,
        diffGranularity: C.DIFF_GRANULARITY_BROAD,
        lockScrolling: undefined,
        showDiffs: true,
        showInlineDiffs: true,
        alignLines: true,
        maxDiffs: 5000,
        showConnectors: undefined,
        showCopyArrows: undefined,
        activeEditor: C.EDITOR_LEFT,
        threeWay: undefined,
        left: {
            id: 'acediff-left-editor',
            content: null,
            mode: null,
            theme: null,
            editable: true,
            copyLinkEnabled: true
        },
        center: {
            id: 'acediff-center-editor',
            content: null,
            mode: null,
            theme: null,
            editable: true,
            copyLinkEnabled: true
        },
        right: {
            id: 'acediff-right-editor',
            content: null,
            mode: null,
            theme: null,
            editable: true,
            copyLinkEnabled: true
        },
        classes: {
            gutterClass: 'acediff-gutter',
            gutterID: 'acediff-gutter',
            added: 'acediff-added',
            removed: 'acediff-removed',
            conflict: 'acediff-conflict',
            connector: 'acediff-connector',
            inline: 'acediff-inline',
            newCodeConnectorLink: 'acediff-new-code-connector-copy',
            newCodeConnectorLinkContent: '&#8594;',
            deletedCodeConnectorLink: 'acediff-deleted-code-connector-copy',
            deletedCodeConnectorLinkContent: '&#8592;',
            copyRightContainer: 'acediff-copy-right',
            copyLeftContainer: 'acediff-copy-left'
        },
        connectorYOffset: 0
    };
    return AceDiff;

});