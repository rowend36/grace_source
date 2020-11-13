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
    var LineWidgets = require("ace/line_widgets").LineWidgets;
    var EditSession = require('ace/edit_session').EditSession;
    var Text = require('ace/layer/text').Text;
    var Gutter = require('ace/layer/gutter').Gutter;
    var Lines = require('ace/layer/lines').Lines;
    var oop = require("ace/lib/oop");
    var dom = require("ace/lib/dom")
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

    function AceInlineDiff(options) {
        this.options = {}
        extend(true, this.options, {
            mode: null,
            diffGranularity: C.DIFF_GRANULARITY_BROAD,
            maxInlineDiff: 50,
            maxDiffs: 5000,
            editable: true,
            lineMode: false,
            id: "ace-diff-left-editor",
            theme: null,
            left: {
                content: null,
            },
            right: {
                content: null,
            },
            classes: {
                gutterCell: "acediff_gutter-cell",
                added: "acediff-added",
                removed: "acediff-removed"
            }
        }, options)
        this.options.threeWay = false;
        this.options.alignLines = false;
        this.editor = ace.edit(this.options.id);

        this.sessions = {
            left: this.editor.session,
            right: new EditSession(this.options.right.content, this.options.mode)
        };
        this.options.left.content && this.editor.session.setValue(this.options.left.content);
        this.options.mode && this.editor.session.setMode(this.options.mode);
        this.current = this.sessions.left;
        this.other = this.sessions.right;

        var self = this
        //////////Hacks To Make It Work With Acediff Methods
        this.editors = {
            left: {
                ace: null
            },
            only: this
        }
        this.pairs = [this]
        this.left = "left"
        this.right = "only"
        this.options.only = this.options;
        this.ace = this.editor;
        ///////////

        setupEditor(this, "only")
        this.markers = []
        this.lineWidgets = []
        this.gutter = this.editor.renderer.$gutterLayer;
        this.lines = []
        this.editor.renderer.$gutter.style.paddingRight = "30px"
        var layer = document.createElement("div");
        this.editor.renderer.$gutter.appendChild(layer)
        this.gutterLayer = new Lines(layer);
        layer.style.position = "absolute"
        layer.style.top = "0px";
        layer.style.right = "0px";
        layer.style.width = "30px";

        var diffSafe = throttle(this.diff, 500).bind(this);
        /*this.current.gutterRenderer = {
            getWidth:function(session,lastline,config){
                return (lastline.length+1) *config.characterWidth;
            },
            getText: function(session,row){
                return row+"";
            }
        }*/
        this.editor.on('change', diffSafe);
        this.other.once('tokenizerUpdate', function() {
            self.decorate()
        })
        this.editor.session.on('changeScrollTop', function() {
            self.editor.renderer.once('afterRender',doRender)
        })
        function doRender(){
            var cells = self.gutter.$lines.cells;
            while (cells.length < self.gutterLayer.getLength()) {
                self.gutterLayer.pop();
            }
            while (self.gutterLayer.getLength() > 0) {
                self.gutterLayer.pop();
                //self.gutterLayer.cellCache.push(self.gutterLayer.cells.pop())
            }
            for (var i = 0; i < cells.length; i++) {
                var cell = cells[i];
                renderCells(self, cell.row, cell.element, self.editor.renderer)
            }
            renderOffsetWidget(self, self.editor.renderer)
        }
        this.diff()
        
    }

    AceInlineDiff.prototype = {
        diff: function() {

            var text2 = this.current.getValue()
            var text1 = this.other.getValue()
            if (!this.options.lineMode) {
                this.rawDiffs = getDiff(text1, text2, true)
                this.diffs = getChunks(this.rawDiffs)
            }
            else {
                this.diffs = getLineChunks(text1, text2, true)
            }
            // if we're dealing with too many diffs, fail silently
            if (this.diffs.length > this.options.maxDiffs) {
                return;
            }
            decorating = false
            this.decorate()
        },
        swap: function() {
            this.clear()
            this.swapped = !this.swapped;
            this.session = this.other;
            this.other = this.current;
            this.current = this.session;
            this.editor.setSession(this.current);
            this.diff()
        },
        decorate: function() {
            var diffs = this.diffs;
            var lineNum = 0;
            var lastline = 0;
            var diff = {};
            this.clear()
            var doSwap = this.swap.bind(this);
            var editor = this.editor;
            var swap = function(start) {
                return function(e) {
                    var scrollTop = editor.session.scrollTop;
                    doSwap();
                    editor.gotoLine(start + 1);
                    editor.session.setScrollTop(scrollTop);
                };
            };
            var last = 0;
            var offset = 0;
            diffs.forEach(function(item) {
                for (var i = last; i < item.rightStartLine; i++) {
                    this.lines[i] = i + offset;
                }
                last = item.rightEndLine;
                if (!this.swapped) {
                    if (item.leftEndLine > item.leftStartLine) addTextLineWidget(this, this.other, item.rightStartLine, item.leftStartLine, item.leftEndLine, this.options.classes.removed).addEventListener("click", swap(item.leftStartLine));
                    if (item.rightEndLine > item.rightStartLine) this.markers.push(this.current.addMarker(new Range(item.rightStartLine + lineNum, 0, item.rightEndLine + lineNum - 1, 1), this.options.classes.added, 'fullLine'));
                }
                else {
                    if (item.leftEndLine > item.leftStartLine) addTextLineWidget(this, this.other, item.rightEndLine, item.leftStartLine, item.leftEndLine, this.options.classes.added).addEventListener("click", swap(item.leftStartLine));
                    if (item.rightEndLine > item.rightStartLine) this.markers.push(this.current.addMarker(new Range(item.rightStartLine + lineNum, 0, item.rightEndLine + lineNum - 1, 1), this.options.classes.removed, 'fullLine'));
                }
                for (var i = item.rightStartLine; i < item.rightEndLine; i++) {
                    this.lines[i] = null;
                }
                var offsetLeft = item.leftStartLine - item.leftEndLine;
                var offsetRight = item.rightStartLine - item.rightEndLine;
                offset += (offsetRight - offsetLeft)

            }, this);
            for (var i = last; i < this.current.getLength(); i++) {
                this.lines[i] = i + offset;

            }
            if (this.rawDiffs)
                showInlineDiffs(this, null, "only", this.rawDiffs)
        },
        goNextDiff: function(editor) {
            return goNearbyDiff(this, editor, 1);
        },
        goPrevDiff: function(editor) {
            return goNearbyDiff(this, editor, -1);
        },
        clear: function() {
            this.lineWidgets.forEach(function(widget) {
                if (widget.type == C.WIDGET_OFFSET) {
                    try {
                        widget.parent.removeChild(widget.el);
                    }
                    catch (w) {

                    }
                }
            }, this)
            clearLineWidgets(this)
            this.markers.forEach(function(marker) {
                this.editor.getSession().removeMarker(marker);
            }, this);

        }
    }

    // our constructor
    function AceDiff(options) {
        this.options = {};

        extend(true, this.options, {
            mode: null,
            theme: null,
            diffGranularity: C.DIFF_GRANULARITY_BROAD,
            lockScrolling: true, // not implemented yet
            showDiffs: true,
            showConnectors: true,
            alignLines: false,
            maxDiffs: 5000,
            maxInlineDiff: 50,
            activeEditor: C.EDITOR_LEFT,
            threeWay: false,
            lineMode: false,
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
                activeEditor: C.EDITOR_CENTER,
                classes: {
                    gutterLeftID: this.options.classes.gutterID + "-left",
                    gutterRightID: this.options.classes.gutterID + "-right",
                }
            }, this.options);
            this.options = options;
        }
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
        }

        setupEditor(this, C.EDITOR_RIGHT)
        setupEditor(this, C.EDITOR_LEFT)
        this.lineHeight = this.editors.left.ace.renderer.lineHeight || 14; // assumption: both editors have same line heights
        this.pairs = []
        if (this.options.threeWay) {
            this.editors[C.EDITOR_CENTER] = {
                ace: ace.edit(this.options.center.id),
                markers: [],
                lineLengths: []
            }
            this.pairs.push({
                left: C.EDITOR_LEFT,
                right: C.EDITOR_CENTER,
                gutterID: this.options.classes.gutterLeftID
            })
            this.pairs.push({
                left: C.EDITOR_CENTER,
                right: C.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterRightID
            })
            setupEditor(this, C.EDITOR_CENTER)
            addEventHandlers(this, C.EDITOR_CENTER)
        }
        else {
            this.pairs.push({
                left: C.EDITOR_LEFT,
                right: C.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterID
            })
        }
        this.editors[this.options.activeEditor].ace.focus()
        createGutter(this)
        createCopyContainers(this)
        addGutterEventHandlers(this)
        addEventHandlers(this, C.EDITOR_LEFT)
        addEventHandlers(this, C.EDITOR_RIGHT);

        addWindowResizeHandler(this);
        // store the visible height of the editors (assumed the same)
        this.editorHeight = getEditorHeight(this);
        this.diff();

        var count = 0,
            total = 0;
        var init = (function() {
            if (++count < total) return;
            this.decorate(true);
        }).bind(this);
        for (var i in this.editors) {
            this.editors[i].ace.renderer.once('afterRender', init);
            total++;
        }
        this.goNextDiff(this.editors[this.options.activeEditor].ace);
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
                center: this.editors.right.ace,
                right: this.editors.right.ace
            }
        },
        goNextDiff: function(editor) {
            return goNearbyDiff(this, editor, 1);
        },
        goPrevDiff: function(editor) {
            return goNearbyDiff(this, editor, -1);
        },

        diff: function() {
            console.time('compute')
            var count = 0
            for (var i in this.pairs) {
                var pair = this.pairs[i]
                var text1 = this.editors[pair.left].ace.getSession().getValue();
                var text2 = this.editors[pair.right].ace.getSession().getValue();
                if (!this.options.lineMode) {
                    pair.rawDiffs = getDiff(text1, text2, true)
                    pair.diffs = getChunks(pair.rawDiffs)
                }
                else {
                    pair.diffs = getLineChunks(text1, orig, true)
                }
                count += pair.diffs.length;
            }
            if (count > this.options.maxDiffs) return;
            console.timeEnd('compute')
            if (this.pairs.length > 1)
                splitDiffs(this.pairs[0].diffs, this.pairs[1].diffs)
            decorating = false
            this.decorate(true);
        },
        decorate: function(full) {
            var acediff = this;
            if (decorating)
                return;
            console.time('decorate');
            decorating = true;
            if (full !== false) {
                //resize
                clearArrows(acediff);
                if (full) {
                    clearDiffMarkers(acediff);
                }
                if (full) {
                    for (var i in this.editors) {
                        clearLineWidgets(acediff.editors[i])
                    }
                    if (acediff.options.alignLines) {
                        var offsets = computeOffsets(acediff.pairs[0].diffs, acediff.pairs[1] ? acediff.pairs[1].diffs : null)
                        for (i in this.editors) {
                            for (var j in offsets[i]) {
                                addLineWidget(acediff.editors[i], Number(j), offsets[i][j])
                            }
                        }
                    }
                }
            }
            clearGutter(acediff);

            function drawGap(info, diffIndex, pair) {
                var left = pair.left
                var right = pair.right
                var leftScrollTop = acediff.editors[left].ace.getSession().getScrollTop();
                var rightScrollTop = acediff.editors[right].ace.getSession().getScrollTop();
                var side = C.EDITOR_LEFT;
                if (pair.left == C.EDITOR_CENTER) {
                    side = C.EDITOR_RIGHT
                }
                addConnector(acediff, pair, info.leftStartLine, info.leftEndLine, info.rightStartLine, info.rightEndLine, leftScrollTop, rightScrollTop, acediff.options.classes[side + "Diff"]);
            }
            acediff.pairs.forEach(function(pair) {
                pair.diffs.forEach(function(info, diffIndex) {
                    if (full !== false) {
                        if (full && acediff.options.showDiffs) {
                            highlight(acediff, info, pair.left, pair.right);

                        }
                        addCopyArrows(acediff, info, diffIndex, pair);
                    }
                    if (acediff.options.showConnectors)
                        drawGap(info, diffIndex, pair);
                });
                if (pair.rawDiffs)
                    showInlineDiffs(acediff, pair.left, pair.right, pair.rawDiffs);
            });
            positionCopyContainers(acediff)
            decorating = false
            console.timeEnd('decorate')
        },
        decorateFull: function(full) {
            var acediff = this;
            if (decorating)
                return;
            clearGutter(acediff);
            var offsets = acediff.offsets || {
                left: [],
                right: [],
                center: []
            }
            if (full !== false)
                clearArrows(acediff)
            if (full) {
                clearDiffMarkers(acediff);
                for (var i in this.editors) {
                    clearLineWidgets(acediff.editors[i])
                }
                if (acediff.options.alignLines) {
                    offsets = computeOffsets(acediff.pairs[0].diffs, acediff.pairs[1] ? acediff.pairs[1].diffs : null)
                    for (i in this.editors) {
                        for (var j in offsets[i]) {
                            addLineWidget(acediff.editors[i], Number(j), offsets[i][j])
                        }
                    }
                    lastLeft = lastRight = 1
                }
            }
            acediff.offsets = offsets;
            var lastLeft = Infinity,
                lastRight = Infinity;

            var offsetLeft, offsetRight;

            function drawGap(info, diffIndex, pair, offsetsLeft, offsetsRight) {
                var left = pair.left
                var right = pair.right
                /*for (var i = lastLeft; i < info.leftEndLine; i++)
                    if (offsetsLeft[i])
                        offsetLeft += offsetsLeft[i]
                lastLeft = i

                for (var i = lastRight; i < info.rightEndLine; i++)
                    if (offsetsRight[i])
                        offsetRight += offsetsRight[i]
                lastRight = i*/
                if (full !== false)
                    addCopyArrows(acediff, info, diffIndex, pair);
                var leftScrollTop = acediff.editors[left].ace.getSession().getScrollTop();
                var rightScrollTop = acediff.editors[right].ace.getSession().getScrollTop();
                var side = C.EDITOR_LEFT;
                if (pair.left == C.EDITOR_CENTER) {
                    side = C.EDITOR_RIGHT
                }
                if (acediff.options.showConnectors) {
                    addConnector(acediff, pair, info.leftStartLine, info.leftEndLine, info.rightStartLine, info.rightEndLine, leftScrollTop, rightScrollTop, acediff.options.classes[side + "Diff"]);
                }

            }
            offsetLeft = offsetRight = 0
            acediff.pairs.forEach(function(pair) {
                lastLeft = lastRight = 1
                offsetLeft = offsetRight = 0
                pair.diffs.forEach(function(info, diffIndex) {
                    if (full && acediff.options.showDiffs) {
                        highlight(acediff, info, pair.left, pair.right)
                    }
                    drawGap(info, diffIndex, pair, offsets[pair.left], offsets[pair.right])
                })
            })

            //acediff.editors.center.ace.renderer.updateFull() //Lines(0, Infinity, acediff.editors.left.ace.session.$useWrapMode);
            //acediff.editors.left.ace.renderer.updateFull() //Lines(0, Infinity, acediff.editors.left.ace.session.$useWrapMode);
            //acediff.editors.right.ace.renderer.updateFull() //Lines(0, Infinity, acediff.editors.right.ace.session.$useWrapMode);
            positionCopyContainers(acediff)


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
        }
        var options = getOptions(acediff, side);
        if (options) {
            acediff.editors[side].ace.setOptions(options)
        }
        acediff.editors[side].ace.getSession().setMode(getMode(acediff, side));
        acediff.editors[side].ace.setReadOnly(!acediff.options[side].editable);
        acediff.editors[side].ace.setTheme(getTheme(acediff, side));
        // if the data is being supplied by an option, set the editor values now
        if (acediff.options[side].content) {
            acediff.editors[side].ace.setValue(acediff.options[side].content, -1);
        }
        for (var i in commands)
            acediff.editors[side].ace.commands.addCommand(commands[i])
    }

    function syncScrolling(acediff, side, tag, close) {
        //this can end up in an endless loop
        if (!close) {
            tag = new Date().getTime();
            //scroll cooldown
            if (tag - acediff.editors[side].tag < 1000)
                return;
        }
        else if (!tag) throw 'ValueError';
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
        }
        catch (e) {
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
            scroll = getScrollingInfo(acediff, side) - acediff.editors[side].scrollOffset * acediff.lineHeight
            var top = getScrollingInfo(acediff, other)
            var offset = otherEditor.scrollOffset * acediff.lineHeight;

            if (offset + top != clampScroll(otherEditor, scroll + offset)) {
                targetScrollTop = scroll + offset;
            }
        }

        else {
            //Copied from codemirror source
            var config = editor.ace.renderer.layerConfig;
            var size = editor.ace.renderer.$size;
            var targetPos = 0
            scroll = getScrollingInfo(acediff, side);

            var halfScreen = .5 * size.scrollerHeight,
                midY = scroll + halfScreen;
            var mid = getLineAtHeight(editor, midY);
            var around = chunkBoundariesAround(pair.diffs, mid, isLeft);
            var off = getOffsets(editor, isLeft ? around.edit : around.orig);
            var offOther = getOffsets(otherEditor, isLeft ? around.orig : around.edit);
            var ratio = (midY - off.top) / (off.bot - off.top);
            var targetPos = (offOther.top - halfScreen) + ratio * (offOther.bot - offOther.top);
            var botDist, mix;
            // Some careful tweaking to make sure no space is left out of view
            // when scrolling to top or bottom.
            halfScreen = Math.min(config.maxHeight - size.scrollerHeight, halfScreen)
            if (targetPos > scroll && (mix = scroll / halfScreen) < 1) {
                targetPos = targetPos * mix + scroll * (1 - mix);
            }
            else if ((botDist = config.maxHeight - size.scrollerHeight - scroll) < halfScreen) {
                var otherInfo = getScrollingInfo(acediff, other);
                var otherConfig = otherEditor.ace.renderer.layerConfig;
                var otherSize = otherEditor.ace.renderer.$size;

                var botDistOther = otherConfig.maxHeight - otherSize.scrollerHeight - targetPos;
                if (botDistOther > botDist && (mix = botDist / (halfScreen)) < 1)
                    targetPos = targetPos * mix + (otherConfig.maxHeight - otherSize.scrollerHeight - botDist) * (1 - mix);
            }
            targetScrollTop = clampScroll(otherEditor, targetPos);
        }
        otherEditor.ace.session.setScrollTop(targetScrollTop)
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
                }
                else if (toLocal > n) {
                    afterE = chunk.leftEndLine;
                    afterO = chunk.rightEndLine;
                }
            }
            if (toLocal <= n) {
                beforeE = chunk.leftEndLine;
                beforeO = chunk.rightEndLine;
            }
            else if (fromLocal <= n) {
                beforeE = chunk.leftStartLine;
                beforeO = chunk.rightStartLine;
            }
        }
        return { edit: { before: beforeE, after: afterE }, orig: { before: beforeO, after: afterO } };
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
        pos.left += editor.renderer.gutterWidth - editor.session.getScrollLeft() + editor.renderer.margin.left;
        pos.top += editor.renderer.margin.top - editor.renderer.layerConfig.offset;
        return pos;
    }


    function addEventHandlers(acediff, side) {
        var self = acediff
        var gapUpdate = function() {
            updateGap(acediff, acediff.editors[side].ace, acediff.editors[side].ace.renderer.scrollTop);
        }
        var synchronize = throttle(syncScrolling, 70);
        acediff.editors[side].ace.on("mousedown", function() {
            acediff.activeEditor = side
        })
        acediff.editors[side].ace.getSession().on('changeScrollTop', function(scroll) {
            if (acediff.options.lockScrolling && !acediff.scrollSyncing) {
                synchronize(acediff, side);
            }
            acediff.editors[side].ace.renderer.once('afterRender', gapUpdate);
        });
        acediff.editors[side].ace.getSession().on('changeFold', function(scroll) {
            acediff.decorate()
        });
        var diff = throttle(acediff.diff, 500).bind(acediff);
        acediff.editors[side].ace.on('change', diff);
    }

    function addGutterEventHandlers(acediff) {
        acediff.pairs.forEach(function(pair) {
            var gutterID = pair.gutterID;
            if (acediff.options[pair.left].copyLinkEnabled) {
                on('#' + gutterID, 'click', '.' + acediff.options.classes.newCodeConnectorLink, function(e) {
                    copy(acediff, e, pair, C.LTR);
                });
            }
            if (acediff.options[pair.right].copyLinkEnabled) {
                on('#' + gutterID, 'click', '.' + acediff.options.classes.deletedCodeConnectorLink, function(e) {
                    copy(acediff, e, pair, C.RTL);
                });
            }
        });
    }

    function addWindowResizeHandler(acediff) {
        var onResize = debounce(function() {
            acediff.availableHeight = document.getElementById(acediff.options.left.id).offsetHeight;

            // TODO this should re-init gutter
            acediff.decorate();
        }, 250);

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
        }
        else if (dir == C.RTL) {
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
        for (var i = startLine; i < endLine; i++) {
            contentToInsert += getLine(sourceEditor, i) + '\n';
        }

        var endContent = '';
        var totalLines = targetEditor.ace.getSession().getLength();
        for (var i = targetEndLine; i < totalLines; i++) {
            endContent += getLine(targetEditor, i);
            if (i < totalLines - 1) {
                endContent += '\n';
            }
        }
        if (!endContent) {
            contentToInsert = contentToInsert.substring(0, contentToInsert.length - 1)
        }

        //endContent = endContent.replace(/\s*$/, '');

        // keep track of the scroll height
        var h = targetEditor.ace.getSession().getScrollTop();
        targetEditor.ace.getSession().setValue(startContent + contentToInsert + endContent);
        targetEditor.ace.getSession().setScrollTop(parseInt(h));

        acediff.diff();
    }

    // called onscroll. Updates the gap to ensure the connectors are all lining up
    function updateGap(acediff, editor, scroll) {
        acediff.decorate(false);
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
        editor.lineWidgets = []
    }

    function clearGutter(acediff) {
        //gutter.innerHTML = '';
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i]
            var gutterEl = document.getElementById(pair.gutterID);
            gutterEl.removeChild(pair.svg);
        }
        createGutter(acediff)
    }


    function clearArrows(acediff) {
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i]
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

    function createGutter(acediff) {
        for (var i in acediff.pairs) {
            var pair = acediff.pairs[i]
            var id = pair.gutterID;
            pair.gutter = document.getElementById(id)
            acediff.gutterHeight = pair.gutter.clientHeight;
            acediff.gutterWidth = pair.gutter.clientWidth;
            var leftHeight = getTotalHeight(acediff, pair.left);
            var rightHeight = getTotalHeight(acediff, pair.right);
            var height = Math.max(leftHeight, rightHeight, acediff.gutterHeight);

            pair.svg = document.createElementNS(C.SVG_NS, 'svg');
            pair.svg.setAttribute('width', acediff.gutterWidth);
            pair.svg.setAttribute('height', height);

            pair.gutter.appendChild(pair.svg);
            pair.gutter.className += " " + acediff.options.classes.gutterClass;
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
            //if (startLine == 0) {
            endLine++
            /*}
            else {
                startLine--
                endLine--
                alert(side+endLine)
                alert(acediff.offsets[side][endLine])
                classNames += acediff.options.classes.shiftDown
            }*/
        }
        // to get Ace to highlight the full row we just set the start and end chars to 0 and 1
        editor.markers.push(editor.ace.session.addMarker(new Range(startLine, 0, endLine, 1), classNames, 'fullLine'));
        if (acediff.options.alignLines) {
            var widgets = editor.lineWidgets;
            for (var i in widgets) {
                if (widgets[i].row == endLine) {
                    widgets[i].el.className += " " + classNames;
                    break
                }
            }
        }
    }

    function addConnector(acediff, pair, leftStartLine, leftEndLine, rightStartLine, rightEndLine, leftScrollTop, rightScrollTop, className) {
        // All connectors, regardless of ltr or rtl have the same point system, even if p1 === p3 or p2 === p4
        //  p1   p2
        //
        //  p3   p4
        className = acediff.options.classes.connector + " " + className
        acediff.connectorYOffset = 1;
        var editorLeft = acediff.editors[pair.left]
        var editorRight = acediff.editors[pair.right]
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
        if (info.leftEndLine > info.leftStartLine && acediff.options.left.copyLinkEnabled) {
            var arrow = createArrow({
                className: acediff.options.classes.newCodeConnectorLink,
                topOffset: getRowPosition(acediff.editors[pair.left], info.leftStartLine, false),
                tooltip: 'Copy to right',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.newCodeConnectorLinkContent
            });
            pair.rightDiv.appendChild(arrow);
        }

        if (info.rightEndLine > info.rightStartLine && acediff.options.right.copyLinkEnabled) {
            var arrow = createArrow({
                className: acediff.options.classes.deletedCodeConnectorLink,
                topOffset: getRowPosition(acediff.editors[pair.right], info.rightStartLine, false),
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
            var leftTopOffset = acediff.editors[pair.left].ace.getSession().getScrollTop() //+acediff.editors.left.scrollOffset*acediff.lineHeight;
            var rightTopOffset = acediff.editors[pair.right].ace.getSession().getScrollTop() //+acediff.editors.right.scrollOffset*acediff.lineHeight;
            setStyle(pair, leftTopOffset, rightTopOffset)
        })
    }
    // creates two contains for positioning the copy left + copy right arrows
    function createCopyContainers(acediff) {
        acediff.pairs.forEach(function(cont) {
            cont.leftDiv = document.createElement('div')
            cont.rightDiv = document.createElement('div')
            cont.leftDiv.setAttribute('class', acediff.options.classes.copyLeftContainer);
            cont.rightDiv.setAttribute('class', acediff.options.classes.copyRightContainer);

            document.getElementById(cont.gutterID).appendChild(cont.rightDiv);
            document.getElementById(cont.gutterID).appendChild(cont.leftDiv);
        })
    }

    function renderSingleCell(acediff, row, top, config) {
        var layer = acediff.gutterLayer;
        var cell = layer.createCell(row, config, acediff.other, onCreateCell)
        layer.push(cell);
        var className = "ace_gutter-cell";

        if (acediff.options.classes.gutterCell) {
            className += " " + acediff.options.classes.gutterCell;
        }
        cell.element.className = className;
        cell.element.childNodes[0].data = "" + (1 + row);
        cell.element.style.top = top - config.offset + "px";

    }

    function renderCells(acediff, row, element, renderer) {
        var widgets = acediff.lineWidgets;
        var widget, element;
        var config = renderer.layerConfig;
        var start = renderer.$cursorLayer.getPixelPosition({ row: row, column: 0 }, true).top;
        var relNum = acediff.lines[row];

        var top;
        if (relNum != null) {
            top = start + (acediff.scrollOffset) * config.lineHeight;
            renderSingleCell(acediff, relNum, top, config)
        }
        if (acediff.swapped) {
            relNum = acediff.lines[row + 1] - 2;
        }
        for (var w in widgets) {
            widget = widgets[w]
            if (widget.row != row) {
                continue
            }
            for (var i = 0; i < widget.rowCount; i++) {
                top = start + (i + 1 + acediff.scrollOffset) * config.lineHeight;
                renderSingleCell(acediff, relNum + i + 1, top, config)
            }
            return
        }

    }

    function onCreateCell(element) {
        var textNode = document.createTextNode('');
        element.appendChild(textNode);
        var foldWidget = dom.createElement("span");
        element.appendChild(foldWidget);

        return element;
    }

    function renderOffsetWidget(acediff, renderer) {
        var lineWidgets = acediff.lineWidgets;
        if (!lineWidgets)
            return;
        var lineWidgets = lineWidgets.filter(function(w) {
            return w.type == C.WIDGET_OFFSET && w.row == -1
        })

        var w = lineWidgets[0]
        if (!w) return;
        var config = renderer.layerConfig;
        var top = renderer.$cursorLayer.getPixelPosition({ row: 0, column: 0 }, true).top;
        top -= w.rowCount * config.lineHeight;

        for (var i = 0; i < w.rowCount; i++) {
            renderSingleCell(acediff, i, top + i * renderer.lineHeight, config);
        }
        w.el.style.top = top - config.offset + "px";

        var left = w.coverGutter ? 0 : renderer.gutterWidth;
        if (!w.fixedWidth)
            left -= renderer.scrollLeft;
        w.el.style.left = left + "px";

        if (w.fullWidth && w.screenWidth) {
            w.el.style.minWidth = config.width + 2 * config.padding + "px";
        }

        if (w.fixedWidth) {
            w.el.style.right = renderer.scrollBar.getWidth() + "px";
        }
        else {
            w.el.style.right = "";
        }
    }

    function createTextLineWidget(session, theme, lineStart, lineEnd, config, marker) {
        lineStart = parseInt(lineStart || 0, 10);
        var outerEl = document.createElement("div");
        if (marker) {
            var markerEl = document.createElement('div');
            outerEl.appendChild(markerEl)
            markerEl.style.height = "100%"
            markerEl.style.width = "100%"
            markerEl.className = marker;
        }
        var lineHeight = config.lineHeight || 14;
        var gutterWidth = (gutterWidth || 48);
        var padding = config.padding || 0;
        // var gutter = document.createElement("div")
        // gutter.className = "ace_gutter"
        // gutter.style.width = gutterWidth + "px"
        // outerEl.appendChild(gutter)
        var textLayer = new Text(outerEl);
        var innerEl = textLayer.$lines.element;
        innerEl.style.left = /*gutterWidth + */ padding + 'px';
        textLayer.setSession(session);
        outerEl.className = theme.cssClass;
        //todo wrap lines
        for (var ix = lineStart; ix < lineEnd; ix++) {
            var lineEl = document.createElement("div");
            lineEl.className = "ace_line";
            lineEl.style.top = (ix - lineStart) * lineHeight + "px";
            lineEl.style.height = lineHeight + "px";

            textLayer.$renderLine(lineEl, ix, false);
            innerEl.appendChild(lineEl);
        }

        outerEl.style.height = (lineEnd - lineStart) * lineHeight+"px";
        outerEl.style.position = 'absolute';
        outerEl.style.width = "100%";

        session.$computeWidth()
        if (outerEl.clientWidth < session.screenWidth * config.characterWidth) {
            outerEl.style.width = session.screenWidth * config.characterWidth + 5 + "px"
        }
        outerEl.style.zIndex = "3";
        //console.log(JSON.stringify(outerEl, null, 2));
        //console.log(outerEl.toString());

        return outerEl;

    }

    function addTextLineWidget(editor, session, line, start, end, className, config) {
        if (!editor.lineWidgets) {
            editor.lineWidgets = [] //editor.ace.session.widgetManager
        }
        if (!editor.ace.session.widgetManager) {
            editor.ace.session.widgetManager = new LineWidgets(editor.ace.session);
            editor.ace.session.widgetManager.attach(editor.ace);
        }
        var no = end - start;
        if (!no) return;
        var widget = createTextLineWidget(session, editor.ace.renderer.theme, start, end, editor.ace.renderer.layerConfig, className)
        if (!line) {
            editor.lineWidgets.push({ type: C.WIDGET_OFFSET, row: -1, rowCount: no, el: widget, parent: editor.ace.renderer.container })
            editor.scrollOffset += no
            decorating = true
            editor.ace.container.append(widget)
            //setting scroll margin triggers decorate
            editor.ace.renderer.setScrollMargin(editor.scrollOffset * editor.ace.renderer.lineHeight)
            decorating = false
            return widget
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: C.WIDGET_INLINE,
            el: widget
            //el: document.createElement("div"),
            //type: "ace_line"
        };
        //w.el.style.backgroundColor = "red" //editor.ace.renderer.lineHeight;
        w.el.onmousedown = editor.ace.focus.bind(editor.ace);

        editor.lineWidgets.push(w)
        editor.ace.session.widgetManager.addLineWidget(w)
        return widget;
    }

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
        w.el.style.height = (no * editor.ace.renderer.lineHeight) + "px";
        w.el.style.width = "100%" //editor.ace.renderer.lineHeight;
        //w.el.style.backgroundColor = "red" //editor.ace.renderer.lineHeight;
        w.el.onmousedown = editor.ace.focus.bind(editor.ace);
        editor.lineWidgets.push(w)
        editor.ace.session.widgetManager.addLineWidget(w)
    }

    function inlineMarker(acediff, side, line, from, toLine, to) {
        var editor = acediff.editors[side];
        if (!editor) return //inline diffs
        if (to === 0) {
            toLine--;
            to = 100000
        }
        var session = acediff.editors[side].ace.getSession();
        acediff.editors[side].markers.push(session.addMarker(new Range(line, from, toLine, to), acediff.options.classes.inline, null, false));
    }

    function showInlineDiffs(acediff, left, right, diffs) {
        var pos = {}
        pos[left] = new Pos(0, 0)
        pos[right] = new Pos(0, 0);
        for (var i in diffs) {
            var type = diffs[i][0];
            var text = diffs[i][1];
            if (type == C.DIFF_EQUAL) {
                moveOver(pos[left], text, null, pos[right])
                continue;
            }
            var side = (type == C.DIFF_DELETE ? left : right)
            var line = pos[side].line;
            var ch = pos[side].ch;
            moveOver(pos[side], text);
            if (text.length < acediff.options.maxInlineDiff) {
                inlineMarker(acediff, side, line, ch, pos[side].line, pos[side].ch);
            }

        }
    }

    var decorating;

    function highlight(acediff, info, left, right) {
        if (info.stops) {
            var stops = info.stops
            var other = right,
                main = left,
                side = C.EDITOR_LEFT,
                class_ = 'removed';
            if (left == C.EDITOR_LEFT) {
                main = right
                other = left
                class_ = 'added'
                side = C.EDITOR_RIGHT
            }
            var start = info[side + "StartLine"]
            for (var i in stops) {
                if (stops[i][1] > start) {
                    showDiff(acediff, main, start, stops[i][1], acediff.options.classes[stops[i][0] ? 'conflict' : class_])
                }
                start = stops[i][1]
            }
            if (!i) console.error('Empty replace')
            if (info[side + "EndLine"] > start)
                showDiff(acediff, main, start, info[side + "EndLine"], acediff.options.classes[class_])
            showDiff(acediff, other, info[other + "StartLine"], info[other + "EndLine"], acediff.options.classes[class_])

        }
        else {
            showDiff(acediff, right, info.rightStartLine, info.rightEndLine, acediff.options.classes.added);
            showDiff(acediff, left, info.leftStartLine, info.leftEndLine, acediff.options.classes.removed);
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
            var from = (isOrig ? chunk.leftStartLine : chunk.rightStartLine);
            console.log(from, start);
            if (from > start) return from;
        }
    }

    function getAlignableDiffs(acediff, side, line) {
        var pairs = acediff.pairs;
        var alignables = {

        }
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            var isOrig = false;
            if (pair.left == side)
                isOrig = true
            else if (pair.right != side)
                continue
            var diffs = pair.diffs;
            var prev, next;
            for (var j = 0; j < diffs.length; j++) {
                var diff = diffs[j];
                var from = isOrig ? diff.leftStartLine : diff.rightStartLine;
                var to = isOrig ? diff.leftEndLine : diff.rightEndLine;
                if (line < from && line < to) {
                    prev = diff;
                }
                else if (line >= from && line < to) {
                    alignables[isOrig ? pair.right : pair.left] = {
                        from: {
                            line: from
                        }
                    };
                    break
                }
                else if (line >= to && line > from) {
                    alignables[isOrig ? pair.right : pair.left] = {

                    }
                }
            }
            var posPrev = findPrevDiff(diff, line, isOrig)
            pos = findNextDiff(diff, line, isOrig);
            if (pos != null && (found == null || (dir < 0 ? pos > found : pos < found)))
                found = pos;
            console.log(i, diff);
        }
    }

    function goNearbyDiff(acediff, editor, dir) {
        var found = null,
            pairs = acediff.pairs,
            editors = acediff.editors;
        var line = editor.getCursorPosition().row;
        for (var i = 0; i < pairs.length; i++) {
            var diff = pairs[i].diffs,
                isOrig = editor == editors[pairs[i].left].ace
            if (!isOrig && editor != editors[pairs[i].right].ace) {
                continue
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


    function splitDiffs(diff1, diff2) {
        var line = 0
        var index1 = 0
        var index2 = 0
        var offset1, offset2, end1, end2;
        var swapped = false

        function swap() {
            var temp;
            temp = index2
            index2 = index1
            index1 = temp
            temp = diff2
            diff2 = diff1
            diff1 = temp
            temp = end2
            end2 = end1
            end1 = temp
            temp = offset2
            offset2 = offset1
            offset1 = temp
            swapped = !swapped
        }
        while (index1 < diff1.length && index2 < diff2.length) {
            if (swapped) {
                offset2 = diff2[index2].rightStartLine;
                offset1 = diff1[index1].leftStartLine;
                end2 = diff2[index2].rightEndLine;
                end1 = diff1[index1].leftEndLine;
            }
            else {
                offset1 = diff1[index1].rightStartLine;
                offset2 = diff2[index2].leftStartLine;
                end1 = diff1[index1].rightEndLine;
                end2 = diff2[index2].leftEndLine;
            }
            if (offset1 <= offset2) {
                if (end1 <= offset2) {
                    index1++;
                    continue
                }
                diff1[index1].stops || (diff1[index1].stops = [])
                diff2[index2].stops || (diff2[index2].stops = [])
                if (end1 <= end2) {
                    diff1[index1].stops.push([false, offset2])
                    diff1[index1++].stops.push([true, end1])
                    diff2[index2].stops.push([true, end1])
                    swap()
                }
                else {
                    diff1[index1].stops.push([false, offset2])
                    diff1[index1].stops.push([true, end2])
                    diff2[index2++].stops.push([true, end2])

                }
            }
            else {
                swap()
            }

        }
        if (swapped) swap()
    }

    //computeOffsets for aligning lines
    function computeOffsets(diffs, diff2) {
        var diff;
        var left = {}
        var right = {}
        var leftEndLine = 0,
            rightEndLine = 0;
        for (var i in diffs) {
            var info = diffs[i]
            rightEndLine = info.rightEndLine;
            leftEndLine = info.leftEndLine
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
            var lastline = Math.max(rightEndLine, other.leftEndLine) + 1;
            var la = -1,
                lb = -1,
                a = 0,
                b = 0;
            for (var i = 0; i < lastline;) {
                var offsetLeft = right[i] || 0
                var offsetRight = other.left[i] || 0
                var offset = offsetLeft - offsetRight
                var db = offsetRight - (other.right[i] || 0);
                var da = (left[i] || 0) - offsetLeft

                if (offset > 0) {
                    console.log(i, b, 'right');
                    other.right[b] = (other.right[b] || 0) + offset
                    other.left[i] = offsetLeft

                }
                else if (offset < 0) {
                    console.log(a, i, 'left');
                    left[a] = (left[a] || 0) - offset
                    right[i] = offsetRight
                }
                a -= da
                b += db
                i++, a++, b++;

                /*if (i - a > la) {
                    var l = (left[i - a] || 0)
                    console.log(i,a,i-a,l - (right[i - a] || 0));
                    a += l - (right[i - a] || 0)
                    //console.log(a,la);
                    //console.log(i,i-a,i-b);
                    la = i - a
                }
                if (i - b > lb) {
                    var r = (other.right[i - b] || 0)
                    b += r - (other.left[i - a] || 0)
                    lb = i - b
                }*/
            }
            for (i in right)
                if (right[i] != other.left[i]) {
                    console.error(other.left);
                    throw Error("failed to merge offsets")
                }
            return {
                left: left,
                leftEndLine: leftEndLine,
                center: right,
                centerEndLine: lastline - 1,
                right: other.right,
                rightEndLine: other.rightEndLine
            }

        }
    }

    //get Diffs using line mode
    function getLineChunks(text1, text2, automerge) {
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
        // if (!/\n$/.test(text1)) 
        text1 += "\n"
        // if (!/\n$/.test(text2)) 
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

    function mergeDiff(dest, src) {
        dest.leftStartLine = Math.min(dest.leftStartLine, src.leftStartLine)
        dest.rightStartLine = Math.min(dest.rightStartLine, src.rightStartLine)
        dest.leftEndLine = Math.max(dest.leftEndLine, src.leftEndLine)
        dest.rightEndLine = Math.max(dest.rightEndLine, src.rightEndLine)
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
                    last.chunks = text.split("\n");
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

    //getDiff,getChunk: copied from codemirror merge.js
    //up to 3-5x slower but allows us to 
    //mark inline differences
    var dmp;

    function getDiff(a, b, ignoreWhitespace) {
        if (!dmp) dmp = new diff_match_patch();

        var diff = dmp.diff_main(a, b);
        // The library sometimes leaves in empty parts, which confuse the algorithm
        for (var i = 0; i < diff.length; ++i) {
            var part = diff[i];
            if (ignoreWhitespace ? !/[^ \t]/.test(part[1]) : !part[1]) {
                diff.splice(i--, 1);
            }
            else if (i && diff[i - 1][0] == part[0]) {
                diff.splice(i--, 1);
                diff[i][1] += part[1];
            }
        }
        return diff;
    }
    var Pos = function(line, ch) {
        if (!this) return new Pos(line, ch)
        this.line = line || 0
        this.ch = ch || 0
        this.toAce = function() {
            return {
                row: this.line,
                column: this.ch
            }
        }
    };

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
    function getChunks(diff) {
        var chunks = [];
        if (!diff.length) return chunks;
        var startEdit = 0,
            startOrig = 0;
        var edit = Pos(0, 0),
            orig = Pos(0, 0);
        for (var i = 0; i < diff.length; ++i) {
            var part = diff[i],
                tp = part[0];
            if (tp == DIFF_EQUAL) {
                var startOff = !startOfLineClean(diff, i) || edit.line < startEdit || orig.line < startOrig ? 1 : 0;
                var cleanFromEdit = edit.line + startOff,
                    cleanFromOrig = orig.line + startOff;
                moveOver(edit, part[1], null, orig);
                var endOff = endOfLineClean(diff, i) ? 1 : 0;
                var cleanToEdit = edit.line + endOff,
                    cleanToOrig = orig.line + endOff;
                if (cleanToEdit > cleanFromEdit) {
                    if (i) chunks.push({
                        leftStartLine: startOrig,
                        leftEndLine: cleanFromOrig,
                        rightStartLine: startEdit,
                        rightEndLine: cleanFromEdit
                    });
                    startEdit = cleanToEdit;
                    startOrig = cleanToOrig;
                }
            }
            else {
                moveOver(tp == DIFF_INSERT ? edit : orig, part[1]);
            }
        }
        if (startEdit <= edit.line || startOrig <= orig.line)
            chunks.push({
                leftStartLine: startOrig,
                leftEndLine: orig.line + 1,
                rightStartLine: startEdit,
                rightEndLine: edit.line + 1
            });
        return chunks;
    }

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
    function getCharsOnLine(editor, line) {
        return getLine(editor, line).length;
    }

    function getLine(editor, line) {
        return editor.ace.getSession().doc.getLine(line);
    }
    /*ace config
        rowScreen = session.documentToScreenRow(row,column).row
        
        row = session.screenToDocumentRow(row,column).row
        //column only matters in wrapped lines
        row == rowScreen when there are no
        folds, linewidgets, or wrapped lines
        
        renderer.layerConfig.offset+
        //offset:the part of the first row that is above the screen
        renderer.layerConfig.firstRowScreen*renderer.lineHeight
        ===
        renderer.scrollTop
    */
    function getRowPosition(editor, row, onScreen) {
        if (onScreen === undefined)
            onScreen = true
        var top = editor.ace.renderer.$cursorLayer.getPixelPosition({ row: row, column: 0 }, onScreen).top -
            (onScreen ? editor.ace.renderer.layerConfig.offset : 0);
        return top
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

    function getMode(acediff, editor) {
        var mode = acediff.options.mode;
        if (acediff.options[editor].mode !== null) {
            mode = acediff.options[editor].mode;
        }
        return mode;
    }

    function getOptions(acediff, editor) {
        var mode = acediff.options.options;
        if (acediff.options[editor].options !== null) {
            mode = acediff.options[editor].options;
        }
        return mode;
    }

    // acediff.editors.left.ace.getSession().getLength() * acediff.lineHeight
    function getTotalHeight(acediff, editor) {
        return acediff.editors[editor].ace.getSession().getScreenLength() * acediff.lineHeight;
    }

    function getTheme(acediff, editor) {
        var theme = acediff.options.theme;
        if (acediff.options[editor].theme !== null) {
            theme = acediff.options[editor].theme;
        }
        return theme;
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

    function getViewPort(editor) {
        var conf = editor.renderer.layerConfig;
        return {
            from: conf.firstRowScreen,
            to: conf.lastRowScreen
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

    //limit the number of times a function
    //is called in a time frame
    function throttle(func, wait) {
        var last = 0,
            timeout;
        var context, args;
        var later = function() {
            timeout = null
            last = new Date().getTime()
            func.apply(context, args)
        }
        return function() {
            context = this
            args = arguments;
            var now = new Date().getTime()
            if (now - last > wait) {
                later()
            }
            else if (!timeout) {
                setTimeout(later, wait - (now - last))
            }
        }
    }
    AceDiff.Inline = AceInlineDiff;
    return AceDiff;

}));