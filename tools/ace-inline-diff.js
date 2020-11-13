(function(root, factory) {
    if (typeof Modules === 'object') {
        Modules.AceInlineDiff = factory(Modules);
    }
    else if (typeof define === 'function' && define.amd) {
        define([], factory);
    }
    else if (typeof exports === 'object') {
        module.exports = factory(require());
    }
    else {
        root.AceInlineDiff = factory(root);
    }
}(window, function() {
    'use strict';

    var Range = require('ace/range').Range;
    var LineWidgets = require("ace/line_widgets").LineWidgets;
    var EditSession = require('ace/edit_session').EditSession;
    var Text = require('ace/layer/text').Text;
    var Gutter = require('ace/layer/gutter').Gutter;
    var oop = require("ace/lib/oop");
    var dom = require("ace/lib/dom")
    var FoldLine = require('ace/edit_session/fold_line').FoldLine;
    var Marker = require('ace/layer/marker').Marker;

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
            showInlineDiffs: true,
            removedFragmentsBelow: false,
            ignoreWhitespace: false,
            maxDiffs: 5000,
            editable: true,
            automerge: true,
            autoupdate: false,
            lineMode: false,
            editor: undefined,
            id: "ace-diff-left-editor",
            theme: null,
            left: {
                content: null,
            },
            right: {
                session: undefined,
                content: null,
                editable: false
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
        }, options);
        this.options.threeWay = false;
        this.options.alignLines = false;
        this.editor = this.options.editor || ace.edit(getOption(this, C.EDITOR_LEFT, "id"));

        //////////Hacks To Make It Work With Acediff Methods
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
        this.editors.other = {
            ace: {
                session: this.other,
                getSession: function() {
                    return this.session;
                }
            },
            markers: []
        };
        ///////////

        this.foldModes = {
            left: new DiffFoldMode(2,2),
            right: new DiffFoldMode(2,2)
        }
        if (this.options.left.session) {
            this.editor.setSession(this.options.left.session);
        }
        this.sessions = {
            left: createSession(this, C.EDITOR_LEFT, this.editor.session),
            right: createSession(this, C.EDITOR_RIGHT, this.options.right.session)
        };


        this.current = this.sessions.left;
        this.other = this.sessions.right;

        setupEditor(this, C.EDITOR_LEFT);
        this.markers = [];
        this.lineWidgets = [];

        //array of equal line segments
        this.lines = []
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
        this.other.once('tokenizerUpdate', this.$decorate);
        this.other.on('changeWrapLimit', this.$decorate);
    }

    AceInlineDiff.prototype = {
        handleMouseDown: function(e) {
            var offset = this.scrollOffset;
            var pos = this.editor.renderer.pixelToScreenCoordinates(e.clientX, e.clientY);
            var swap = (function(middle, row) {
                e.stop();
                this.swap();
                if (middle && !getOption(this, this.swapped ? C.EDITOR_RIGHT : C.EDITOR_LEFT, 'editable') &&
                    getOption(this, this.swapped ? C.EDITOR_LEFT : C.EDITOR_RIGHT, 'editable'))
                    this.allowSwap = true; //this.editor.on('changeSelection', this.$handleChangeSelection);
                this.editor.gotoLine(row + 1, pos.column);
            }).bind(this);
            //clicked topLineWidget
            if (pos.row < 0 && offset > 0) {
                var post = this.other.screenToDocumentPosition(pos.row + offset, pos.column, pos.offsetX);
                return swap(true, post.row, post.column);
            }
            //clicked equal row;
            var position = this.current.screenToDocumentPosition(pos.row, pos.column, pos.offsetX);
            if (this.allowSwap) {
                var end = this.gutter.isHostEqualRow(position.row);
                if (end !== false) {
                    return swap(false, end, position.column);
                }
            }
            //clicked widget
            var widget = this.current.lineWidgets && this.current.lineWidgets[position.row];
            if (widget) {
                var screenRow = this.current.documentToScreenRow(position.row, Infinity);
                if (pos.row > screenRow) {
                    position = this.other.screenToDocumentPosition(this.other.documentToScreenRow(widget.start, 0) + (pos.row - screenRow - 1), pos.column, pos.offsetX);
                    return swap(false, position.row, position.column);
                }
            }
        },
        startUpdate: function() {
            if (!this.$diff) {
                this.$diff = throttle(this.diff, 1000).bind(this);
                this.editor.on('change', this.$diff);
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
            }
            else {
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
            }
            else {
                dom.addCssClass(this.editor.renderer.$gutterLayer.element, this.options.classes.gutterAdded);
                dom.addCssClass(this.editor.renderer.content, this.options.classes.contentAdded);
                dom.addCssClass(this.gutter.layer.element, this.options.classes.gutterRemoved);
                dom.addCssClass(this.renderer.content, this.options.classes.contentRemoved);
            }
        },
        setSession: function(session, isRight,isSwap) {
            isRight = !!isRight;
            isSwap = !!isSwap;
            var side = (isRight?C.EDITOR_RIGHT:C.EDITOR_LEFT);
            var oldSession = this.sessions[side];
            if(oldSession==session)
                return;
            if(this.swapped !== isRight){
                oldSession && oldSession.off('changeWrapLimit', this.$decorate);
                this.other = session;
                this.renderer.setSession(this.other);
                this.gutter.setSession(this.other);
                this.editors.other.ace.session = this.other;
            }
            else {
                this.session = this.current = session;
                this.renderer.detach(true);
                this.editor.setSession(this.current);
                this.editor.setReadOnly(!getOption(this, (isSwap==this.swapped)?C.EDITOR_LEFT:C.EDITOR_RIGHT, "editable"));
                this.renderer.attach(true);
            }
            if(isSwap)
                return;
            var foldMode = this.foldModes[side];
            this.sessions[side]=session;
            this.options[side].session = session;
            if(oldSession){
                revert(oldSession, "$setFolding", oldSession);
                oldSession.$setFolding(foldMode.sub);
            }
            if(session){
                foldMode.setFolding(session.$foldMode);
                session.$setFolding(foldMode);
                override(session, "$setFolding", session, foldMode.setFolding.bind(foldMode));
                this.diff();
            }
        },
        diff: function() {
            var text1 = this.current.getValue();
            var text2 = this.other.getValue();
            if (!this.options.lineMode) {
                this.rawDiffs = getDiff(text1, text2, false);
                this.diffs = getChunks(this.rawDiffs, this.options.ignoreWhitespace ? getDiff(text1, text2, true) : this.rawDiffs);
            }
            else {
                this.diffs = getLineChunks(text1, text2, this.options.automerge);
            }
            // if we're dealing with too many diffs, fail silently
            if (this.diffs.length > this.options.maxDiffs) {
                return;
            }
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
            this.setSession(this.sessions.left,true,true);
            this.setSession(right,false,true);
            this.swapped = !this.swapped;
            this.addCssClasses();
            this.diff();
        },
        decorate: function() {
            var diffs = this.diffs;
            this.clear()
            var putFragmentsAbove = (this.swapped == this.options.removedFragmentsBelow);
            var currentClass = this.swapped ? this.options.classes.removed : this.options.classes.added;
            var otherClass = this.swapped ? this.options.classes.added : this.options.classes.removed;
            var align = this.lines;
            var editor = this.editor;
            var equal = { start: 0, end: 0, mapStart: 0 };
            var eq_start = function(s, m) {
                equal = {
                    start: s,
                    mapStart: m
                };
            }
            var eq_end = function(e) {
                //if (e != equal.start) {
                equal.end = e;
                align.push(equal);
                //}
            }
            diffs.forEach(function(item) {
                eq_end(item.rightStartLine);
                eq_start(item.rightEndLine, item.leftEndLine);
                if (item.rightEndLine > item.rightStartLine) addLineWidget(this, this.current, putFragmentsAbove ? item.leftStartLine : item.leftEndLine, item.rightStartLine, item.rightEndLine, this.other); //.addEventListener("click", swap(item.rightStartLine));
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
            clearLineWidgets(this)
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
            this.editor.off('change', this.$diff);
            this.editor.off('mousedown', this.$handleMouseDown);
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
                this.sessions.right.getValue();
            }
        }
    };
    AceInlineDiff.diff = function(editor, value_or_session, options) {
        var isSession = typeof(value_or_session) == "object";
        var options = extend({
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


    function DiffFoldMode(before,after) {
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
        this.ctxBefore = before===0?0:before || 1;
        this.ctxAfter = before===0?0:before || 1;
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
            }
            else if (this.sub) {
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
            }
            else last = null;
            return last;
        }
    }
    var CellVirusProps = (function() {
        this.computeLineTop = function(row, config, session, column) {
            var tops = this.isWidget(row, config, true);
            var top;
            if (tops.type) {
                if (tops.row < 0) {
                    top = (-tops.rowCount + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0));
                }
                else {
                    top = this.host.session.documentToScreenRow(tops.row, 0) + this.layer.session.documentToScreenRow(row, column || 0) - this.layer.session.documentToScreenRow(tops.start, 0) + 1;
                }
            }
            else
                top = this.host.session.documentToScreenRow(tops, column || 0);
            return top * config.lineHeight - config.lineOffset;
        };
        this.hook = function(host_) {
            this.host = host_;
            var hostUpdate = host_.update.bind(host_);
            override(host_, "update", this, (function(config) {
                hostUpdate(config);
                this.update(this.computeConfig());
                //this.update(config);
            }).bind(this));
            var hostScroll = host_.scrollLines.bind(host_);
            override(host_, "scrollLines", this, (function(config) {
                hostScroll(config);
                this.scrollLines(this.computeConfig());
                //this.update(config);
            }).bind(this));
        };
        this.unhook = function() {
            revert(this.host, "update", this);
            revert(this.host, "scrollLines", this);
            this.host = null;
        };


        this.isWidget = function(row, config, returnRow) {
            if (this.host.session.topLineWidget) {
                var top = this.host.session.topLineWidget;
                if (row < top.end)
                    return top;
            }
            var mapped = binarySearch(this.alignables, row);
            var widgets = this.host.session.lineWidgets;
            if (widgets && widgets.length && mapped < 0) {
                var last = this.alignables[-mapped - 2];
                var next = this.alignables[-mapped - 1];
                last = last ? last.end - 1 - last.start + last.mapStart : -1;
                next = (next ? next.mapStart : widgets.length) - 1;
                if (widgets[last] && widgets[last].type == C.WIDGET_INLINE) {
                    return widgets[last];
                }
                if (next != last && widgets[next] && widgets[next].type == C.WIDGET_INLINE) {
                    return widgets[next];
                }
                else return 0;
            }
            if (returnRow) {
                last = this.alignables[mapped];
                if (last) //error state 
                    return row - last.start + last.mapStart;
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
            }
            else {
                last = this.alignables[mapped];
                return row - last.start + last.mapStart;
            }
        }
        this.mapLine = function(row) {
            var last;
            //*
            if (this.alignables[0].mapStart > row)
                return 0;
            var mapped = inverseSearch(this.alignables, row);
            if (mapped < 0) {
                last = this.alignables[-mapped - 2];
                return last.end - 1;
            }
            else {
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
            var host = this.host;
            var hostConfig = host.config;
            var config = Object.assign({}, host.config);
            var firstRowScreen = config.firstRowScreen;
            var lastEqualRow = this.mapLine(hostConfig.lastRow);
            var lastEqualRowScreen = host.session.documentToScreenRow(this.unmapLine(lastEqualRow), 0);
            var lastRowScreen = hostConfig.firstRowScreen + Math.ceil(config.minHeight / config.lineHeight);
            //To get exact row in wrapped lines
            //config.lastRow = screenToDoc(docToScreen(lastEqualRow,0)+(lastRowScreen-lastEqualRowScreen))
            //However both methods fail if config.lastRow is on another widget
            //there might be a bunch of other tweaks to get it right but
            //why bother?
            config.lastRow = lastEqualRow + (lastRowScreen - lastEqualRowScreen);
            //triggers bug in pageChanged(Gutter)config.firstRowScreen = null;
            if (config.offset < 0 && host.session.topLineWidget) {
                var diff = Math.ceil(-config.offset / config.lineHeight);
                var lastOffsetRow = host.session.topLineWidget.rowCount;
                var firstRow = Math.max(0, lastOffsetRow - diff);
                //config.lineOffset = -host.session.topLineWidget.rowCount * config.lineHeight;
                //above line causes a small bug in TextLineVirus.dorender
                config.lineOffset = -(lastOffsetRow - firstRow) * config.lineHeight;
                config.offset -= config.lineOffset;
                config.firstRow = this.layer.session.screenToDocumentRow(firstRow, 0);
                config.lastRow = Math.max(config.lastRow, Math.min(config.firstRow + lastRowScreen, host.session.topLineWidget.end));
            }
            else {
                config.lineOffset = 0;
                //config.offset -= config.lineOffset;
                config.firstRow = this.mapLine(config.firstRow);
            }
            return config;
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

        content.style.height = "200%";
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
        }
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
                var mapRange = new Range(this.mapLine(start), data.data.range.start.column, this.mapLine(end), data.data.range.end.column)
                this.layer.session.addFold("...", mapRange);
            }
            else if (data.action == "remove") {
                var row = this.mapLine(data.data.range.start.row);
                var fold = this.layer.session.getFoldAt(row, this.layer.session.getLine(row).length, 1);
                if (fold)
                    this.layer.session.removeFold(fold);
            }
        }
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
            }
            else if (config.firstRow < oldFirstRow) {
                _this.$lines.unshift(this.renderLinesFragment(config, config.firstRow, oldFirstRow - 1, 1));
            }
            if (oldLastRow > config.lastRow) {
                while (_this.$lines.cells.length &&
                    _this.$lines.cells[_this.$lines.cells.length - 1].row > config.lastRow) {
                    _this.$lines.pop();
                }
            }
            else if (config.lastRow > oldLastRow) {
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
        }
        else session = new EditSession(content, mode);
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
                    bindKey: "Ctrl-Shift-N"
                },
                prevDiff: {
                    name: "Go previous diff",
                    exec: function(editor) {
                        acediff.goPrevDiff(editor);
                    },
                    bindKey: "Ctrl-Shift-P"
                },
                swapDiffs: {
                    name: "Swap origin",
                    exec: function(editor) {
                        var right = acediff.sessions.right;
                        acediff.clear();
                        acediff.setSession(acediff.sessions.left,true);
                        acediff.setSession(right,false);
                    },
                }
            }
        var commands = acediff.$commands;

        var options = getOption(acediff, side, 'options');
        if (options) {
            acediff.editors[side].ace.setOptions(options)
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
            acediff.editors[side].ace.commands.addCommand(commands[i])
    }

    function getOption(acediff, side, option) {
        var opt = acediff.options[option];
        if (acediff.options[side][option] !== undefined) {
            opt = acediff.options[side][option];
        }
        return opt;
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
            editor.lineWidgets = [] //editor.ace.session.widgetManager
        }
        if (!session.widgetManager) {
            session.widgetManager = new LineWidgets(session)
            session.widgetManager.editor = editor.ace;
        }
        var no;
        if (other) {
            var screenStart = other.documentToScreenRow(start, 0);
            var screenEnd = other.documentToScreenRow(end - 1, 0);
            no = screenEnd - screenStart + 1;
        }
        else no = end - start;

        if (!no) return
        if (!line) {
            editor.scrollOffset += no
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
        editor.lineWidgets.push(w)
        session.widgetManager.addLineWidget(w)
        return w;
    }

    function inlineMarker(acediff, side, line, from, toLine, to, allowMultiline) {
        var editor = acediff.editors[side];
        var session = (editor && editor.ace.getSession());
        if (!session) return false;

        if (to === 0) {
            toLine--;
            to = 100000;
        }
        if (from >= session.getLine(line).length - 1) {
            from = 0;
            line++;
        }
        if ((line > toLine) ||
            (line != toLine && !allowMultiline) ||
            ((toLine - line + 1) > (acediff.options.maxInlineDiffLines || 3)) ||
            (from === 0 && to >= session.getLine(toLine).length))
            return false;
        acediff.editors[side].markers.push(session.addMarker(new Range(line, from, toLine, to), acediff.options.classes.inline, 'text', false));
        return true;
    }

    function showInlineDiffs(acediff, left, right, diffs) {
        var pos = {};
        pos[left] = new Pos(0, 0);
        pos[right] = new Pos(0, 0);
        var lastMarker;
        for (var i in diffs) {
            var type = diffs[i][0];
            var text = diffs[i][1];
            if (type == C.DIFF_EQUAL) {
                if (lastMarker) {
                    inlineMarker(acediff, lastMarker.side, lastMarker.line, lastMarker.ch, lastMarker.toLine, lastMarker.toCh, false);
                    lastMarker = null;
                }
                moveOver(pos[left], text, null, pos[right]);
                continue;
            }
            var side = (type == C.DIFF_DELETE ? left : right);
            var line = pos[side].line;
            var ch = pos[side].ch;
            moveOver(pos[side], text);
            if (lastMarker && lastMarker.side != side) {
                if (inlineMarker(acediff, lastMarker.side, lastMarker.line, lastMarker.ch, lastMarker.toLine, lastMarker.toCh, false))
                    inlineMarker(acediff, side, line, ch, pos[side].line, pos[side].ch, true);
                else if (inlineMarker(acediff, side, line, ch, pos[side].line, pos[side].ch, false))
                    inlineMarker(acediff, lastMarker.side, lastMarker.line, lastMarker.ch, lastMarker.toLine, lastMarker.toCh, true);
                lastMarker = null;
            }
            else {
                if (lastMarker) {
                    inlineMarker(acediff, lastMarker.side, lastMarker.line, lastMarker.ch, lastMarker.toLine, lastMarker.toCh, false);
                    lastMarker = null;
                }
                lastMarker = {
                    side: side,
                    line: line,
                    ch: ch,
                    toLine: pos[side].line,
                    toCh: pos[side].ch
                }
            };
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
                continue;
            }
            var pos = dir < 0 ? findPrevDiff(diff, line, isOrig) : findNextDiff(diff, line, isOrig);

            if (pos !== undefined && (found === null || (dir < 0 ? pos > found : pos < found)))
                found = pos;
        }
        if (found !== null)
            editor.gotoLine(found + 1, 0);

        else
            return false;
    }


    //Diff Utilities
    //-Two modes of obtaining diffs,
    //line mode and character mode
    //working to add ignoreWhitespace
    //option to line mode but for now
    //word mode is the default

    //get Diffs using line mode
    var dmp;
    var types = {};
    types[C.DIFF_DELETE] = C.EDITOR_LEFT;
    types[C.DIFF_INSERT] = C.EDITOR_RIGHT;

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
        if (!dmp)
            dmp = new diff_match_patch();
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
    //bug: ignore whitespace causes 
    //issues with inline offsets

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

    function Pos(line, ch) {
        if (!this) return new Pos(line, ch)
        this.line = line || 0
        this.ch = ch || 0
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

    //Language Utilities
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
            if (timeout)
                return;
            var now = new Date().getTime()
            if (now - last > wait) {
                later()
            }
            else {
                timeout = setTimeout(later, wait - (now - last))
            }
        }
    }

    //binary search through an array of start end objects
    function binarySearch(lines, row) {
        var first = 0;
        var last = lines.length - 1;

        while (first <= last) {
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

        while (first <= last) {
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
        }
        else {
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
        }
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
        var arg2 = []
        arg2.push.apply(arg2, args);
        arg2.push(arg);
        return arg2;
    }

    return AceInlineDiff;
}));