(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    }
    else if (typeof exports === 'object') {
        module.exports = factory(require());
    }
    else {
        root.AceDiff = factory(root);
    }
}(this, function() {
    'use strict';

    var Range = require('ace/range').Range;

    var C = {
        DIFF_EQUAL: 0,
        DIFF_DELETE: -1,
        DIFF_INSERT: 1,
        EDITOR_RIGHT: 'right',
        EDITOR_LEFT: 'left',
        EDITOR_CENTER: 'center',
        RTL: 'rtl',
        LTR: 'ltr',
        SVG_NS: 'http://www.w3.org/2000/svg',
        DIFF_GRANULARITY_SPECIFIC: 'specific',
        DIFF_GRANULARITY_BROAD: 'broad'
    };

    // our constructor
    function AceDiff(options) {
        this.options = {};

        extend(true, this.options, {
            mode: null,
            theme: null,
            diffGranularity: C.DIFF_GRANULARITY_BROAD,
            lockScrolling: false, // not implemented yet
            showDiffs: true,
            showConnectors: true,
            alignLines: true,
            maxDiffs: 5000,
            threeWay: true,
            left: {
                id: 'acediff-left-editor',
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
                diff: 'acediff-diff',
                connector: 'acediff-connector',
                newCodeConnectorLink: 'acediff-new-code-connector-copy',
                newCodeConnectorLinkContent: '&#8594;',
                deletedCodeConnectorLink: 'acediff-deleted-code-connector-copy',
                deletedCodeConnectorLinkContent: '&#8592;',
                copyRightContainer: 'acediff-copy-right',
                copyLeftContainer: 'acediff-copy-left'
            },
            connectorYOffset: 0
        }, options);
        if (this.options.threeWay) {
            options = {}
            extend(true, options, {
                center: {
                    id: 'acediff-center-editor',
                    content: null,
                    mode: null,
                    theme: null,
                    editable: true,
                    copyLinkEnabled: true
                },
                classes: {
                    gutterLeftID: this.options.classes.gutterID + "-left",
                    gutterRightID: this.options.classes.gutterID + "-right"
                }
            }, this.options);
            this.options = options;
        }
        // instantiate the editors in an internal data structure that will store a little info about the diffs and
        // editor content
        var setup = (function(side) {
            this.editors[side].ace.getSession().setMode(getMode(this, side));
            this.editors[side].ace.setReadOnly(!this.options[side].editable);
            this.editors[side].ace.setTheme(getTheme(this, side));
            // if the data is being supplied by an option, set the editor values now
            if (this.options[side].content) {
                this.editors[side].ace.setValue(this.options[side].content, -1);
            }
        }).bind(this)
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
        }
        setup(C.EDITOR_LEFT)
        setup(C.EDITOR_RIGHT)
        addEventHandlers(this, 'left')
        addEventHandlers(this, 'right')
        this.lineHeight = this.editors.left.ace.renderer.lineHeight || 14; // assumption: both editors have same line heights
        if (this.options.threeWay) {
            this.editors['center'] = {
                ace: ace.edit(this.options.center.id),
                markers: [],
                lineLengths: []
            }
            setup(C.EDITOR_CENTER)

            addEventHandlers(this, 'center')
            addGutterEventHandlers(this, this.options.classes.gutterLeftID, 'left', 'center')
            addGutterEventHandlers(this, this.options.classes.gutterRightID, 'center', 'right')
            createGutter(this, "left")
            createCopyContainers(this, this.options.classes.gutterLeftID)
            createGutter(this, "right")
            createCopyContainers(this, this.options.classes.gutterRightID)
        }
        else {
            addGutterEventHandlers(this, this.options.classes.gutterID, 'left', 'right')
            createCopyContainers(this, this.options.classes.gutterID);
            createGutter(this);
        }
        addWindowResizeHandler(this);
        // if the editors start out with display:none this breaks without the OR condition and some line height pre-set

        // set up the editors


        // store the visible height of the editors (assumed the same)
        this.editorHeight = getEditorHeight(this);

        this.diff();
    }


    // our public API
    AceDiff.prototype = {

        // allows on-the-fly changes to the AceDiff instance settings
        setOptions: function(options) {
            extend(true, this.options, options);
            this.diff();
        },

        getNumDiffs: function() {
            return this.diffs.length;
        },

        // exposes the Ace editors in case the dev needs it
        getEditors: function() {
            return {
                left: this.editors.left.ace,
                right: this.editors.right.ace
            }
        },
        mergeRight: function() {
            var text1 = this.editors.left.ace.getSession().getValue();
            var text2 = this.editors.right.ace.getSession().getValue();
            var result = automerge(text1, text2, text1)
            this.editors.right.ace.setValue(result.result)
        },
        diff: function() {
            var text1 = this.editors.left.ace.getSession().getValue();
            var text2 = this.editors.right.ace.getSession().getValue();
            if (this.options.threeWay) {
                var orig = this.editors.center.ace.getSession().getValue();
                this.ldiffs = obtainDiffs(text1, orig, true)
                this.rdiffs = obtainDiffs(text2, orig, true)
            }
            else {
                this.diffs = obtainDiffs(text1, text2, true)
            }


            // if we're dealing with too many diffs, fail silently
            if (this.diffs.length > this.options.maxDiffs) {
                return;
            }

            decorate(this);
        },


        destroy: function() {

            // destroy the two editors
            var leftValue = this.editors.left.ace.getValue();
            this.editors.left.ace.destroy();
            var oldDiv = this.editors.left.ace.container;
            var newDiv = oldDiv.cloneNode(false);
            newDiv.textContent = leftValue;
            oldDiv.parentNode.replaceChild(newDiv, oldDiv);

            var rightValue = this.editors.right.ace.getValue();
            this.editors.right.ace.destroy();
            oldDiv = this.editors.right.ace.container;
            newDiv = oldDiv.cloneNode(false);
            newDiv.textContent = rightValue;
            oldDiv.parentNode.replaceChild(newDiv, oldDiv);

            document.getElementById(this.options.classes.gutterID).innerHTML = '';
        }
    };


    function getMode(acediff, editor) {
        var mode = acediff.options.mode;
        if (acediff.options[editor].mode !== null) {
            mode = acediff.options[editor].mode;
        }
        return mode;
    }

    function mergeDiff(dest, src) {
        dest.leftStartLine = Math.min(dest.leftStartLine, src.leftStartLine)
        dest.rightStartLine = Math.min(dest.rightStartLine, src.rightStartLine)
        dest.leftEndLine = Math.max(dest.leftEndLine, src.leftEndLine)
        dest.rightEndLine = Math.max(dest.rightEndLine, src.rightEndLine)
    }

    function obtainDiffs(text1, text2, automerge) {
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
        var dmp = new diff_match_patch();
        //if (!/\n$/.test(text1))
            text1 += "\n"
        //if (!/\n$/.test(text2))
            text2 += "\n"
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
        }
        var last = null
        diff.forEach(function(chunk, i) {
            var obj = transformDiff(chunk, offset, last)
            if (obj) {
                if (last && automerge) {
                    mergeDiff(last, obj);
                }
                else {
                    diffs.push(obj);
                }
            }
            last = obj;
        });
        return diffs;
    }

    var types = {};
    types[C.DIFF_DELETE] = C.EDITOR_LEFT;
    types[C.DIFF_INSERT] = C.EDITOR_RIGHT;

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
        var trailinglines = offset.trailinglines
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
            offset.left += numlines
            offset.right += numlines
            if (trailinglines) {
                //trailinglines are pushed down(prepended to next line)
                //a better implementation might
                //push them up(append to previous line)
                //todo extend regex to catch text that only startswith newlines
                if (/^\n+$/.test(text)) {
                    var type = types[trailinglines[0]];
                    last[type + "EndLine"] -= trailinglines[1];
                    offset[type] -= trailinglines[1];
                    obj = {
                        leftStartLine: offset.left,
                        leftEndLine: offset.left,
                        rightStartLine: offset.right,
                        rightEndLine: offset.right
                    };
                    obj[type + "EndLine"] += trailinglines[1];
                    offset[type] += trailinglines[1];
                    //todo or remove update chunks
                    //last.chunks = text.split("\n");
                    offset.trailinglines = null;
                    return obj;
                }
                else {
                    offset.trailinglines = null;
                }
            }
            return
            //pass
        }
        if (endsWithNewline) {
            var countNewlines = /\n+$/.exec(text)[0].length;
            if (countNewlines > 1) {
                if (trailinglines)
                    console.warn('Unexpected trailing empty lines')
                trailinglines = [chunkType, countNewlines - 1];
            }
        }

        obj = {
            leftStartLine: offset.left,
            leftEndLine: offset.left,
            rightStartLine: offset.right,
            rightEndLine: offset.right,
            chunks: text.split("\n")
        }
        obj[types[chunkType] + "EndLine"] += numlines;
        offset[types[chunkType]] += numlines
        offset.trailinglines = trailinglines
        return obj
    }

    function getTheme(acediff, editor) {
        var theme = acediff.options.theme;
        if (acediff.options[editor].theme !== null) {
            theme = acediff.options[editor].theme;
        }
        return theme;
    }


    function addEventHandlers(acediff, side) {

        var lastScrollTime = new Date().getTime();
        var now = 0;

        acediff.editors[side].ace.getSession().on('changeScrollTop', function(scroll) {
            now = new Date().getTime();
            if (lastScrollTime + 50 < now) {
                updateGap(acediff, side, scroll);
            }
        });

        var diff = acediff.diff.bind(acediff);
        acediff.editors[side].ace.on('change', diff);
    }

    function addGutterEventHandlers(acediff, gutterID, left, right) {
        if (acediff.options[left].copyLinkEnabled) {
            on('#' + gutterID, 'click', '.' + acediff.options.classes.newCodeConnectorLink, function(e) {
                copy(acediff, e, left, right);
            });
        }
        if (acediff.options[right].copyLinkEnabled) {
            on('#' + gutterID, 'click', '.' + acediff.options.classes.deletedCodeConnectorLink, function(e) {
                copy(acediff, e, right, left);
            });
        }
    }

    function addWindowResizeHandler(acediff) {
        var onResize = debounce(function() {
            acediff.editors.availableHeight = document.getElementById(acediff.options.left.id).offsetHeight;

            // TODO this should re-init gutter
            acediff.diff();
        }, 250);

        window.addEventListener('resize', onResize);
    }


    function copy(acediff, e, from, to) {
        var diffIndex = parseInt(e.target.getAttribute('data-diff-index'), 10);
        var diff = acediff.diffs[diffIndex];
        var sourceEditor, targetEditor;

        var startLine, endLine, targetStartLine, targetEndLine;
        sourceEditor = acediff.editors[from];
        targetEditor = acediff.editors[to];
        startLine = diff[from + "StartLine"];
        endLine = diff[from + "EndLine"];
        targetStartLine = diff[to + "StartLine"];
        targetEndLine = diff[to + "EndLine"];


        var contentToInsert = '';
        for (var i = startLine; i < endLine; i++) {
            contentToInsert += getLine(sourceEditor, i) + '\n';
        }

        var startContent = '';
        for (var i = 0; i < targetStartLine; i++) {
            startContent += getLine(targetEditor, i) + '\n';
        }

        var endContent = '';
        var totalLines = targetEditor.ace.getSession().getLength();
        for (var i = targetEndLine; i < totalLines; i++) {
            endContent += getLine(targetEditor, i);
            if (i < totalLines - 1) {
                endContent += '\n';
            }
        }

        endContent = endContent.replace(/\s*$/, '');

        // keep track of the scroll height
        var h = targetEditor.ace.getSession().getScrollTop();
        targetEditor.ace.getSession().setValue(startContent + contentToInsert + endContent);
        targetEditor.ace.getSession().setScrollTop(parseInt(h));

        acediff.diff();
    }


    function getLineLengths(editor) {
        var lines = editor.ace.getSession().doc.getAllLines();
        var lineLengths = [];
        lines.forEach(function(line) {
            lineLengths.push(line.length + 1); // +1 for the newline char
        });
        return lineLengths;
    }


    // shows a diff in one of the two editors.
    function showDiff(acediff, editor, startLine, endLine, className) {
        var editor = acediff.editors[editor];

        if (endLine < startLine) { // can this occur? Just in case.
            endLine = startLine;
        }

        var classNames = className + ' ' + ((endLine > startLine) ? 'lines' : 'targetOnly');
        endLine--; // because endLine is always + 1
        if (acediff.options.alignLines && endLine < startLine) {
            startLine--
            endLine--
            classNames += " shifted"
        }
        // to get Ace to highlight the full row we just set the start and end chars to 0 and 1
        editor.markers.push(editor.ace.session.addMarker(new Range(startLine, 0, endLine, 1), classNames, 'fullLine'));
    }


    // called onscroll. Updates the gap to ensure the connectors are all lining up
    function updateGap(acediff, editor, scroll) {

        decorate(acediff);

        // reposition the copy containers containing all the arrows
        //positionCopyContainers(acediff);
    }


    function clearDiffs(acediff) {
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


    function addConnector(acediff, gutterSVG, leftStartLine, leftEndLine, rightStartLine, rightEndLine) {
        var leftScrollTop = acediff.editors.left.ace.getSession().getScrollTop();
        var rightScrollTop = acediff.editors.right.ace.getSession().getScrollTop();
        // All connectors, regardless of ltr or rtl have the same point system, even if p1 === p3 or p2 === p4
        //  p1   p2
        //
        //  p3   p4

        acediff.connectorYOffset = 1;

        var p1_x = -1;
        var p1_y = (leftStartLine * acediff.lineHeight) - leftScrollTop + 0.5;
        var p2_x = acediff.gutterWidth + 1;
        var p2_y = rightStartLine * acediff.lineHeight - rightScrollTop + 0.5;
        var p3_x = -1;
        var p3_y = (leftEndLine * acediff.lineHeight) - leftScrollTop + acediff.connectorYOffset + 0.5;
        var p4_x = acediff.gutterWidth + 1;
        var p4_y = (rightEndLine * acediff.lineHeight) - rightScrollTop + acediff.connectorYOffset + 0.5;
        var curve1 = getCurve(p1_x, p1_y, p2_x, p2_y);
        var curve2 = getCurve(p4_x, p4_y, p3_x, p3_y);

        var verticalLine1 = 'L' + p2_x + ',' + p2_y + ' ' + p4_x + ',' + p4_y;
        var verticalLine2 = 'L' + p3_x + ',' + p3_y + ' ' + p1_x + ',' + p1_y;
        var d = curve1 + ' ' + verticalLine1 + ' ' + curve2 + ' ' + verticalLine2;

        var el = document.createElementNS(C.SVG_NS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('class', acediff.options.classes.connector);
        gutterSVG.appendChild(el);
    }


    function addCopyArrows(acediff, info, diffIndex, gutterID) {
        if (info.leftEndLine > info.leftStartLine && acediff.options.left.copyLinkEnabled) {
            var arrow = createArrow({
                className: acediff.options.classes.newCodeConnectorLink,
                topOffset: info.leftStartLine * acediff.lineHeight,
                tooltip: 'Copy to right',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.newCodeConnectorLinkContent
            });
            acediff.copyContainers[gutterID + "-right"].appendChild(arrow);
        }

        if (info.rightEndLine > info.rightStartLine && acediff.options.right.copyLinkEnabled) {
            var arrow = createArrow({
                className: acediff.options.classes.deletedCodeConnectorLink,
                topOffset: info.rightStartLine * acediff.lineHeight,
                tooltip: 'Copy to left',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.deletedCodeConnectorLinkContent
            });
            acediff.copyContainers[gutterID + "-left"].appendChild(arrow);
        }
    }


    function positionCopyContainers(acediff) {
        var leftTopOffset = acediff.editors.left.ace.getSession().getScrollTop() //+acediff.editors.left.scrollOffset*acediff.lineHeight;
        var rightTopOffset = acediff.editors.right.ace.getSession().getScrollTop() //+acediff.editors.right.scrollOffset*acediff.lineHeight;
        function setStyle(gutterID, leftTopOffset, rightTopOffset) {
            acediff.copyContainers[gutterID + '-left'].style.cssText = 'top: ' + (-leftTopOffset) + 'px';
            acediff.copyContainers[gutterID + '-right'].style.cssText = 'top: ' + (-rightTopOffset) + 'px';
        }
        if (acediff.options.threeWay) {
            var centerTopOffset = acediff.editors.center.ace.getSession().getScrollTop()
            setStyle(acediff.options.classes.gutterLeftID, leftTopOffset, centerTopOffset)
            setStyle(acediff.options.classes.gutterRightID, centerTopOffset, rightTopOffset)
        }
        setStyle(acediff.options.classes.gutterLeftID, leftTopOffset, centerTopOffset)

    }
    /**
     * This method takes the raw diffing info from the Google lib and returns a nice clean object of the following
     * form:
     * {
     *   leftStartLine:
     *   leftEndLine:
     *   rightStartLine:
     *   rightEndLine:
     * }
     *
     * Ultimately, that's all the info we need to highlight the appropriate lines in the left + right editor, add the
     * SVG connectors, and include the appropriate <<, >> arrows.
     *
     * Note: leftEndLine and rightEndLine are always the start of the NEXT line, so for a single line diff, there will
     * be 1 separating the startLine and endLine values. So if leftStartLine === leftEndLine or rightStartLine ===
     * rightEndLine, it means that new content from the other editor is being inserted and a single 1px line will be
     * drawn.
     */

    // helper to return the startline, endline, startChar and endChar for a diff in a particular editor. Pretty
    // fussy function


    // note that this and everything else in this script uses 0-indexed row numbers
    function getCharsOnLine(editor, line) {
        return getLine(editor, line).length;
    }


    function getLine(editor, line) {
        return editor.ace.getSession().doc.getLine(line);
    }


    function getLineForCharPosition(editor, offsetChars) {
        var lines = editor.ace.getSession().doc.getAllLines(),
            foundLine = 0,
            runningTotal = 0;

        for (var i = 0; i < lines.length; i++) {
            runningTotal += lines[i].length + 1; // +1 needed for newline char
            if (offsetChars <= runningTotal) {
                foundLine = i;
                break;
            }
        }
        return foundLine;
    }


    function isLastChar(editor, char, startsWithNewline) {
        var lines = editor.ace.getSession().doc.getAllLines(),
            runningTotal = 0,
            isLastChar = false;

        for (var i = 0; i < lines.length; i++) {
            runningTotal += lines[i].length + 1; // +1 needed for newline char
            var comparison = runningTotal;
            if (startsWithNewline) {
                comparison--;
            }

            if (char === comparison) {
                isLastChar = true;
                break;
            }
        }
        return isLastChar;
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


    function createGutter(acediff, side) {
        side = side || ""
        var id = acediff.options.classes.gutterID
        var svg = "gutterSVG"
        var left = "left"
        var right = "right"
        if (side == 'left') {
            id = acediff.options.classes.gutterLeftID;
            svg = "gutterLeftSVG"
            right = "center"
        }
        else if (side == 'right') {
            id = acediff.options.classes.gutterRightID;
            svg = 'gutterRightSVG'
            left = 'center'
        }
        acediff.gutterHeight = document.getElementById(id).clientHeight;
        acediff.gutterWidth = document.getElementById(id).clientWidth;
        var leftHeight = getTotalHeight(acediff, left);
        var rightHeight = getTotalHeight(acediff, right);
        var height = Math.max(leftHeight, rightHeight, acediff.gutterHeight);

        acediff[svg] = document.createElementNS(C.SVG_NS, 'svg');
        acediff[svg].setAttribute('width', acediff.gutterWidth);
        acediff[svg].setAttribute('height', height);

        document.getElementById(id).appendChild(acediff[svg]);
        document.getElementById(id).className += " " + acediff.options.classes.gutterClass;
    }


    // acediff.editors.left.ace.getSession().getLength() * acediff.lineHeight
    function getTotalHeight(acediff, editor) {
        return acediff.editors[editor].ace.getSession().getLength() * acediff.lineHeight;
    }

    // creates two contains for positioning the copy left + copy right arrows
    function createCopyContainers(acediff, gutterID) {
        acediff.copyContainers = acediff.copyContainers || {};
        var left = acediff.copyContainers[gutterID + "-left"] = document.createElement('div');
        acediff.copyContainers[gutterID + "-left"].setAttribute('class', acediff.options.classes.copyLeftContainer);
        var right = acediff.copyContainers[gutterID + "-right"] = document.createElement('div');
        acediff.copyContainers[gutterID + "-right"].setAttribute('class', acediff.options.classes.copyRightContainer);

        document.getElementById(gutterID).appendChild(right);
        document.getElementById(gutterID).appendChild(left);
    }

    function automerge(origin, text1, text2) {
        var dmp = new diff_match_patch();
        var patches = dmp.patch_make(origin, text1)
        var result = dmp.patch_apply(patches, text2 || origin)
        var status = true
        for (var i in result[1]) {
            if (!i) { status = false; break; }
        }
        return { result: result[0], status: status }
    }

    function clearGutter(acediff) {
        //gutter.innerHTML = '';
        if (!acediff.options.threeWay) {
            var gutterEl = document.getElementById(acediff.options.classes.gutterID);
            gutterEl.removeChild(acediff.gutterSVG);
        }
        else {
            gutterEl = document.getElementById(acediff.options.classes.gutterLeftID);
            gutterEl.removeChild(acediff.gutterLeftSVG);
            gutterEl = document.getElementById(acediff.options.classes.gutterRightID);
            gutterEl.removeChild(acediff.gutterRightSVG);
            createGutter(acediff, "left");
            createGutter(acediff, "right");
        }
    }


    function clearArrows(acediff) {
        for (var i in acediff.copyContainers) {
            acediff.copyContainers[i].innerHTML = '';
        }
    }


    /*
     * This combines multiple rows where, say, line 1 => line 1, line 2 => line 2, line 3-4 => line 3. That could be
     * reduced to a single connector line 1=4 => line 1-3
     */
    var LineWidgets = require("ace/line_widgets").LineWidgets;

    function addLineWidget(editor, line, no) {
        if (!editor.lineWidgets) {
            editor.lineWidgets = [] //editor.ace.session.widgetManager
        }
        if (!editor.ace.session.widgetManager) {
            editor.ace.session.widgetManager = new LineWidgets(editor.ace.session)
            editor.ace.session.widgetManager.attach(editor.ace)
        }
        if (!no) return
        if (!line) {
            editor.scrollOffset += no
            decorating = true
            //setting scroll margin triggers decorate
            editor.ace.renderer.setScrollMargin(editor.scrollOffset * editor.ace.renderer.lineHeight)
            decorating = false
            return
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: "diff",
            el: document.createElement("div")
            //el: document.createElement("div"),
            //type: "ace_line"
        };
        w.el.style.height = no * editor.ace.renderer.lineHeight + "px";
        w.el.style.width = "100%" //editor.ace.renderer.lineHeight;
        //w.el.style.backgroundColor = "red" //editor.ace.renderer.lineHeight;
        w.el.onmousedown = editor.ace.focus.bind(editor.ace);

        editor.lineWidgets.push(w)
        editor.ace.session.widgetManager.addLineWidget(w)
    }

    function clearLineWidgets(editor) {
        editor.scrollOffset = 0
        editor.ace.renderer.setScrollMargin(0)
        if (!editor.lineWidgets) return

        for (var i in editor.lineWidgets) {
            editor.ace.session.widgetManager.removeLineWidget(editor.lineWidgets[i])
        }
    }

    var decorating;

    function decorate(acediff) {
        if (decorating)
            return
        clearDiffs(acediff)
        clearGutter(acediff)
        clearLineWidgets(acediff.editors.left)
        clearLineWidgets(acediff.editors.right)
        clearArrows(acediff)
        var offsetLeft = 0,
            offsetRight = 0;
        var offsets = computeOffsets(acediff)
        acediff.diffs.forEach(function(info, diffIndex) {
            //info.rightEndLine--
            var offset = Math.abs(heightLeft - heightRight)
            var newLeft = offsetLeft
            var newRight = offsetRight
            if (this.options.alignLines) {
                if (heightLeft < heightRight) {
                    addLineWidget(this.editors[C.EDITOR_LEFT], info.leftEndLine, offset)
                    if (info.leftEndLine)
                        newLeft += offset
                }
                else if (heightLeft > heightRight) {
                    addLineWidget(this.editors[C.EDITOR_RIGHT], info.rightEndLine, offset)
                    if (info.rightEndLine)
                        newRight += offset
                }
            }
            // info.rightStartLine+=this.editors[C.EDITOR_RIGHT].scrollOffset;
            // info.leftEndLine+=this.editors[C.EDITOR_LEFT].scrollOffset;
            // info.rightEndLine+=this.editors[C.EDITOR_RIGHT].scrollOffset;
            showDiff(this, C.EDITOR_LEFT, info.leftStartLine, info.leftEndLine, this.options.classes.diff);
            showDiff(this, C.EDITOR_RIGHT, info.rightStartLine, info.rightEndLine, this.options.classes.diff);
            info.leftStartLine += offsetLeft
            info.leftEndLine += offsetLeft
            info.rightStartLine += offsetRight
            info.rightEndLine += offsetRight
            offsetLeft = newLeft
            offsetRight = newRight
            addCopyArrows(this, info, diffIndex, this.options.classes.gutterLeftID);

            var connect = Math.max(info.leftStartLine, info.rightStartLine)
            if (this.options.showConnectors) {
                //addConnector(this, connect-this.editors[C.EDITOR_LEFT].scrollOffset, connect + heightLeft-this.editors[C.EDITOR_LEFT].scrollOffset, connect-this.editors[C.EDITOR_RIGHT].scrollOffset, connect -this.editors[C.EDITOR_RIGHT].scrollOffset+ heightRight);
                addConnector(this, this.gutterLeftSVG, info.leftStartLine, info.leftEndLine, info.rightStartLine, info.rightEndLine);
                addConnector(this, this.gutterRightSVG, info.leftStartLine, info.leftEndLine, info.rightStartLine, info.rightEndLine);
                //         
            }
        }, acediff)
        acediff.editors.left.ace.renderer.updateFull() //Lines(0, Infinity, acediff.editors.left.ace.session.$useWrapMode);
        acediff.editors.right.ace.renderer.updateFull() //Lines(0, Infinity, acediff.editors.right.ace.session.$useWrapMode);
        positionCopyContainers(acediff)
        // clearGutter(acediff);
        // clearArrows(acediff);

        // acediff.diffs.forEach(function(info, diffIndex) {
        //     if (this.options.showDiffs) {
        //         showDiff(this, C.EDITOR_LEFT, info.leftStartLine, info.leftEndLine, this.options.classes.diff);
        //         showDiff(this, C.EDITOR_RIGHT, info.rightStartLine, info.rightEndLine, this.options.classes.diff);

        //         if (this.options.showConnectors) {
        //             addConnector(this, info.leftStartLine, info.leftEndLine, info.rightStartLine, info.rightEndLine);
        //         }
        //         addCopyArrows(this, info, diffIndex);
        //     }
        // }, acediff);
    }

    function computeOffsets(diffs, diff2) {
        var diff;
        var left = {}
        var right = {}
        var leftEndLine, rightEndLine;
        for (var i in diffs) {
            var info = diffs[i]
            var rightEndLine = info.rightEndLine;
            var leftEndLine = info.leftEndLine
            var heightLeft = info.leftEndLine - info.leftStartLine
            var heightRight = info.rightEndLine - info.rightStartLine
            var offset = heightLeft - heightRight
            if (offset > 0) {
                right[rightEndLine] = offset
            }
            else if (offset < 0) {
                left[leftEndLine] = -offset
            }
        }
        if (!diff2) {
            return {
                left: left,
                leftEndLine: leftEndLine,
                right: right,
                rightEndLine: rightEndLine
            }
        }
        else {
            var other = computeOffsets(diff2)
            var cummLeft = 0,
                cummRight = 0,
                cumCenter = 0;
            var lastline = Math.max(leftEndLine, rightEndLine, offset.leftEndLine, offset.rightEndLine);
            for (var i = 0; i < lastline; i++) {
                offsetLeft = right[i] || 0
                offsetRight = other.left[i] || 0
                var offset = offsetLeft - offsetRight
                if (offset > 0) {
                    other.right[i] += offset
                    other.left[i] += offset
                }
                else {
                    left[i] -= offset
                    right[i] -= offset
                }
            }
        }
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
                    }
                    catch (e) {
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
                        }
                        else {
                            clone = src && jQuery.isPlainObject(src) ? src : {};
                        }
                        // WARNING: RECURSION
                        target[name] = extend(deep, clone, copy);
                    }
                    else if (copy !== undefined) {
                        target[name] = copy;
                    }
                }
            }
        }

        return target;
    }


    function getScrollingInfo(acediff, dir) {
        return (dir == C.EDITOR_LEFT) ? acediff.editors.left.ace.getSession().getScrollTop() : acediff.editors.right.ace.getSession().getScrollTop();
    }


    function getEditorHeight(acediff) {
        //editorHeight: document.getElementById(acediff.options.left.id).clientHeight
        return document.getElementById(acediff.options.left.id).offsetHeight;
    }

    // generates a Bezier curve in SVG format
    function getCurve(startX, startY, endX, endY) {
        var w = endX - startX;
        var halfWidth = startX + (w / 2);

        // position it at the initial x,y coords
        var curve = 'M ' + startX + ' ' + startY +

            // now create the curve. This is of the form "C M,N O,P Q,R" where C is a directive for SVG ("curveto"),
            // M,N are the first curve control point, O,P the second control point and Q,R are the final coords
            ' C ' + halfWidth + ',' + startY + ' ' + halfWidth + ',' + endY + ' ' + endX + ',' + endY;

        return curve;
    }


    function on(elSelector, eventName, selector, fn) {
        var element = (elSelector === 'document') ? document : document.querySelector(elSelector);
        element.addEventListener(eventName, function(event) {
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
        });
    }


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

    return AceDiff;

}));