(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports', './ace-diff-utils'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require(), require('./ace-diff-utils'));
    } else {
        root.AceInlineDiff = factory(root, root.AceDiffUtils);
    }
})(this, function (root, u) {
    'use strict';
    var EditSession = ace.require('ace/edit_session').EditSession;
    var Text = ace.require('ace/layer/text').Text;
    var Gutter = ace.require('ace/layer/gutter').Gutter;
    var dom = ace.require('ace/lib/dom');
    var FoldLine = ace.require('ace/edit_session/fold_line').FoldLine;
    var Range = ace.require('ace/range').Range;
    var Marker = ace.require('ace/layer/marker').Marker;
    var binarySearch = u.binarySearch;
    var ABOVE = u.ABOVE;
    //In AceInlineDiff, right is yours and left is origin.
    function WIDGET(invert, suffix) {
        return (invert ? u.EDITOR_RIGHT : u.EDITOR_LEFT) + (suffix || '');
    }

    function HOST(invert, suffix) {
        return (invert ? u.EDITOR_LEFT : u.EDITOR_RIGHT) + (suffix || '');
    }

    //Override object prototype or value
    //Override object prototype or value
    //Used to override gutterRenderer.$renderer, session.getScreenWidth and session.getFolding
    function override(host, attr, virus, val) {
        var hasProp = host.hasOwnProperty(attr);
        virus['$hostHas' + attr] = hasProp;
        virus['host' + attr] = host[attr];
        host[attr] = val || virus[attr];
    }

    //Revert object property that had been overidden
    function revert(host, attr, virus) {
        var hasProp = virus['$hostHas' + attr];
        if (hasProp) {
            host[attr] = virus['host' + attr];
        } else {
            delete host[attr];
        }
        delete virus['host' + attr];
        delete virus['$hostHas' + attr];
    }

    function DiffFoldMode(before, after) {
        this.diffs = [];
        this.ctxBefore = before === 0 ? 0 : before || 1;
        this.ctxAfter = after === 0 ? 0 : after || 1;
    }
    (function () {
        this.getFoldWidget = function (session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.rightEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end =
                    (diff ? diff.rightStartLine - 1 : session.getLength()) -
                    this.ctxBefore;
                if (end > start) {
                    if (row == start) {
                        return 'start';
                    } else if (style == 'markbeginend' && row == end) {
                        return 'end';
                    }
                }
            } else {
                start = this.diffs[i].rightStartLine;
                end = this.diffs[i].rightEndLine - 1;
            }
            if (this.sub && row > start && row < end) {
                var fold = this.sub.getFoldWidget(session, style, row);
                return fold;
            }
        };
        this.getFoldWidgetRange = function (session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end, range;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.rightEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end =
                    (diff ? diff.rightStartLine - 1 : session.getLength()) -
                    this.ctxBefore;
                if (end > start) {
                    if (
                        row == start ||
                        (style == 'markbeginend' && row == end)
                    ) {
                        range = new Range(start, 0, end, Infinity);
                        range.placeholder = {
                            type: 'comment.diff-fold',
                            text:
                                '  @@@ ' +
                                (end - start + 1) +
                                ' more line' +
                                (end > start ? 's' : '') +
                                ' @@@',
                        };
                        range.placeholder.length =
                            range.placeholder.text.length;
                        return range;
                    }
                }
                end += this.ctxBefore;
            } else {
                start = this.diffs[i].rightStartLine;
                end = this.diffs[i].rightEndLine - 1;
            }
            if (this.sub) {
                range = this.sub.getFoldWidgetRange(session, style, row);
                if (range) {
                    if (range.end.row >= end) {
                        range.end.row = end - 1;
                        range.end.column = session.getLine(end - 1).length;
                    }

                    if (range.start.row <= start) {
                        range.start.row = start + 1;
                        range.start.column = 0;
                    }
                    if (
                        range.end.row < range.start.row ||
                        (range.end.row == range.start.row &&
                            range.end.column - range.start.column < -5)
                    )
                        return null;
                }
                return range;
            }
            return null;
        };
        this.setSub = function (foldMode) {
            if (this !== foldMode) this.sub = foldMode;
        };
    }.call(DiffFoldMode.prototype));

    //A virus is a piece of code that attaches
    //itself to a host and lives off it.
    //This is an abstract class; Subclasses must
    //implement getNextFoldLine
    function VirusRenderer(renderer, element, Layer) {
        this.layer = new Layer(element);
        this.layer.$lines.computeLineTop = this.computeLineTop.bind(this);
        this.host = renderer;
        this.$onAfterRender = this.onAfterRender.bind(this);
    }
    (function () {
        //Attach the VirusRenderer to the renderer

        // this.$logChanges = function (changes) {
        //     var a = '';
        //     if (changes & this.CHANGE_CURSOR) a += ' cursor';
        //     if (changes & this.CHANGE_MARKER) a += ' marker';
        //     if (changes & this.CHANGE_GUTTER) a += ' gutter';
        //     if (changes & this.CHANGE_SCROLL) a += ' scroll';
        //     if (changes & this.CHANGE_LINES) a += ' lines';
        //     if (changes & this.CHANGE_TEXT) a += ' text';
        //     if (changes & this.CHANGE_SIZE) a += ' size';
        //     if (changes & this.CHANGE_MARKER_BACK) a += ' marker_back';
        //     if (changes & this.CHANGE_MARKER_FRONT) a += ' marker_front';
        //     if (changes & this.CHANGE_FULL) a += ' full';
        //     // if (changes & this.CHANGE_H_SCROLL) a += ' h_scroll';
        //     if (a) console.log(a.trim());
        // };
        this.onAfterRender = function (changes) {
            // this.$logChanges.call(this.host, changes);
            var config = this.computeConfig();
            if (this.$forceUpdate || changes & this.host.CHANGE_FULL) {
                this.$forceUpdate = false;
                this.lastWidget = null;
                this.layer.update(config);
            } else if (changes & this.host.CHANGE_SCROLL) {
                if (
                    this.layer.config &&
                    config.lineOffset != this.layer.config.lineOffset
                )
                    for (var line in this.layer.$lines.cells) {
                        var cell = this.layer.$lines.cells[line];
                        cell.element.style.top =
                            this.computeLineTop(
                                cell.row,
                                config,
                                this.layer.session
                            ) + 'px';
                    }
                this.layer.scrollLines(config);
            }
        };
        this.computeLineTop = function (row, config, session, column) {
            var tops = this.findWidget(row, true);
            var top;
            session = session.original;
            if (typeof tops == 'number') {
                top = this.host.session.documentToScreenRow(tops, column || 0);
            } else if (tops.row < 0) {
                top =
                    -tops.rowCount +
                    session.documentToScreenRow(row, column || 0) -
                    session.documentToScreenRow(tops.start, 0);
            } else {
                top =
                    this.host.session.documentToScreenRow(tops.row, Infinity) +
                    session.documentToScreenRow(row, column || 0) -
                    session.documentToScreenRow(tops.start, 0) +
                    1;
            }
            return top * config.lineHeight - config.lineOffset;
        };

        this.setSession = function (t) {
            var dummy;
            if (this.layer.session) {
                var key, m;
                for (key in this.layer.session)
                    if (m) console.warn('Added properties to dummy ' + key);
                if (key == '_tailProp') m = true;
            }
            if (t) {
                dummy = Object.create(t);
                dummy.original = t;
                dummy.documentToScreenPosition = t.documentToScreenPosition.bind(
                    t
                );
                dummy.screenToDocumentPosition = t.screenToDocumentPosition.bind(
                    t
                );
                dummy.getNextFoldLine = this.getNextFoldLine.bind(this);
                dummy.getFoldedRowCount = this.getFoldedRowCount.bind(this);
                dummy._eventRegistry = t._eventRegistry;
                dummy._tailProp = undefined;
            }
            this.layer.setSession(dummy);
        };
        //Subclasses implement getNextFoldLine
        //Thank you, Lord for helping me get this right.
        this.getFoldedRowCount = function (startRow, endRow) {
            var count = endRow - startRow + 1;
            var start = startRow,
                fold;
            do {
                fold = this.getNextFoldLine(start, fold);
                if (!fold) break;
                //TODO test properly
                if (endRow <= fold.start.row) break;
                start = fold.end.row + 1;
                if (startRow > fold.end.row) continue; //skip
                count -=
                    Math.min(endRow, fold.end.row) -
                    Math.max(fold.start.row + 1, startRow) +
                    1;
                //from 1 to 4 fold[1,2] => (4-1+1) - (2-2+1) = 4-1 = 3 rows
                //from 1 to 2 fold[1,4] => (2-1+1) - (2-2+1) => 2 - 1 = 1 row
                //from 2 to 4 fold[1,3] => (4-2+1) - (3-2+1)=>3 - 2 = 1 row
            } while (true);
            return count;
        };
        //Mapping functions
        /**
         * Find the line widget that contains this row from the widgetSession. When returnEqualRow is true, behaves identical with widgetToHostRow when on an equal row.
         */
        this.findWidget = function (row, returnEqualRow) {
            var lastW = this.lastWidget;
            if (lastW && lastW.end > row && lastW.start <= row) {
                return lastW; //30-40% speedup
            }
            if (this.host.session.topLineWidget) {
                var top = this.host.session.topLineWidget;
                if (row < top.end) return (this.lastWidget = top);
            }

            var mapped = binarySearch(this.diffs, row, WIDGET);

            if (mapped > -1) {
                var widgets = this.host.session.lineWidgets;
                //push invalid rows down
                if (!widgets) return this.host.session.getLength();
                var last = this.diffs[mapped].rightStartLine - 1;
                if (widgets[last] && widgets[last].type == u.WIDGET_INLINE) {
                    return (this.lastWidget = widgets[last]);
                }
                var next = this.diffs[mapped].rightEndLine - 1;
                if (widgets[next] && widgets[next].type == u.WIDGET_INLINE) {
                    return (this.lastWidget = widgets[next]);
                }
                return this.host.session.getLength();
            } else if (returnEqualRow) {
                //return the equal row
                var prev = this.diffs[ABOVE(mapped)];
                return prev ? prev.rightEndLine + row - prev.leftEndLine : row;
            }
            //return false
            return 0;
        };

        //find host row from widget row
        //When in  a diff, the below behaviour directs
        //whether to return the equal row above or the one below.
        this.hostToWidgetRow = function (row, below, invert) {
            var last, widgetLine;
            var mapped = binarySearch(this.diffs, row, HOST, invert);
            if (mapped > -1) {
                if (below === undefined || below === null) return below;
                //in diff
                //don't return host diff
                //return an equal row below or above the row
                if (below) {
                    widgetLine = WIDGET(invert, 'EndLine');
                    last = this.diffs[mapped];
                    return last[widgetLine];
                } else {
                    widgetLine = WIDGET(invert, 'StartLine');
                    last = this.diffs[mapped];
                    return last[widgetLine] - 1;
                }
            } else {
                //in equal row
                var hostLine = HOST(invert, 'EndLine');
                widgetLine = WIDGET(invert, 'EndLine');
                last = this.diffs[ABOVE(mapped)];
                return last ? row - last[hostLine] + last[widgetLine] : row;
            }
        };
        //find widget row from host row
        this.widgetToHostRow = function (row, below) {
            return this.hostToWidgetRow(row, below, true);
        };
        //The difference between $screenToWidgetPos Row and hostToWidgetRow is that the later accepts pixelRows and can return values for non-host rows.
        this.$screenToWidgetPos = function (widget, pixelRow, pixelColumn) {
            var widgetRow, offset;
            if (pixelRow >= 0) {
                widgetRow = widget.start;
                var lastScreenRow = this.host.session.documentToScreenRow(
                    widget.row,
                    Infinity
                );
                if (lastScreenRow >= pixelRow) return null;
                offset = pixelRow - lastScreenRow - 1;
            } else {
                widgetRow = widget.end - 1;
                if (-pixelRow > widget.rowCount) return null;
                offset = pixelRow + 1; //negative
            }
            var widgetScreenRow =
                this.layer.session.original.documentToScreenRow(
                    widgetRow,
                    pixelRow >= 0 ? 0 : Infinity
                ) + offset;
            var widgetPos = this.layer.session.original.screenToDocumentPosition(
                widgetScreenRow,
                pixelColumn || 0
            );
            return widgetPos;
        };
        this.pixelToWidgetRow = function (pixelRow, pixelColumn, returnPos) {
            var hostRow, widget;
            var widgets = this.host.session.lineWidgets || '';
            if (pixelRow >= 0) {
                hostRow = this.host.session.screenToDocumentRow(pixelRow, 0);
                if (
                    widgets[hostRow] &&
                    widgets[hostRow].type === u.WIDGET_INLINE
                ) {
                    widget = widgets[hostRow];
                }
            } else {
                widget = this.host.session.topLineWidget;
            }
            if (widget) {
                var pos = this.$screenToWidgetPos(
                    widget,
                    pixelRow,
                    pixelColumn
                );
                this.lastWidget = widget; //premature optimization for clickCopy
                if (pos) return returnPos ? pos : pos.row;
            }
            if (returnPos) return null;
            if (pixelRow < 0) return -1;
            if (widget) return widget.start - 1;

            var mapped = binarySearch(this.diffs, hostRow, HOST);
            if (mapped < 0) {
                //in an equal row
                mapped = ABOVE(mapped);
                return (
                    hostRow +
                    (mapped > -1
                        ? this.diffs[mapped].leftEndLine -
                          this.diffs[mapped].rightEndLine
                        : 0)
                );
            }
            //A diff can either be above or below specified row {@see removedFragmentsBelow}. Due to the asynchronous rendering we are better off gusessing which. Recall 'right' represents the host.
            var diff = this.diffs[mapped];
            widget = widgets[diff.rightEndLine - 1];
            if (widget && widget.type === u.WIDGET_INLINE)
                return widget.start - 1;
            widget = widgets[diff.rightStartLine - 1];
            if (widget && widget.type === u.WIDGET_INLINE)
                return widget.end - 1;
            else return diff.leftEndLine - 1;
        };

        this.computeConfig = function () {
            var host = this.host.session;
            var config = Object.assign({}, this.host.layerConfig);
            var numRows = Math.ceil(config.height / config.lineHeight);
            //causes issue with $lines.pageChanged(Gutter)
            //config.firstRowScreen = null;
            if (config.offset < 0 && host.topLineWidget) {
                var diff = Math.ceil(-config.offset / config.lineHeight);
                var lastOffsetRow = host.topLineWidget.rowCount;
                var firstRow = Math.max(0, lastOffsetRow - diff);
                config.firstRow = this.layer.session.screenToDocumentRow(
                    firstRow,
                    0
                );
                config.lastRow = this.layer.session.screenToDocumentRow(
                    firstRow + numRows,
                    Infinity
                ); //too much actually since there might be host rows inbetween
                config.lineOffset =
                    -(lastOffsetRow - firstRow) * config.lineHeight;
                config.offset -= config.lineOffset;
            } else {
                var firstRowScreen =
                    config.offset > 0
                        ? host.$scrollTop / config.lineHeight
                        : config.firstRowScreen;
                config.firstRow = Math.max(
                    0,
                    this.pixelToWidgetRow(Math.floor(firstRowScreen))
                );
                config.lastRow = this.pixelToWidgetRow(
                    Math.ceil(firstRowScreen + numRows)
                );
                config.lineOffset = 0;
            }
            config.gutterOffset = 1; //good enough for most purposes
            return config;
        };
    }.call(VirusRenderer.prototype));

    //Renders text and markers
    function TextAndMarkers(renderer) {
        var content = (this.content = document.createElement('div'));
        content.className = 'ace_content';
        this.markers = new Marker(content); //order matters must come before text
        VirusRenderer.call(this, renderer, content, Text);
        this.markers.$getTop = this.getTopForMarker.bind(this);

        this.getScreenWidth = this.getScreenWidth.bind(this);
        this.$updateWrapMode = this.updateWrapMode.bind(this);
        this.$changeWrapLimit = this.changeWrapLimit.bind(this);
        this.$updateMarkers = this.updateMarkers.bind(this);
    }
    (function () {
        Object.assign(this, VirusRenderer.prototype);
        this.detach = function (sessionOnly) {
            revert(this.host.session, 'getScreenWidth', this);
            this.host.session.off('changeWrapMode', this.$updateWrapMode);
            this.host.session.off('changeWrapLimit', this.$changeWrapLimit);
            if (!sessionOnly) {
                this.host.off('afterRender', this.$onAfterRender);
                this.content.remove();
            }
        };
        this.attach = function (sessionOnly) {
            if (!sessionOnly) {
                this.host.on('afterRender', this.$onAfterRender);
                this.host.scroller.appendChild(this.content);
            }
            override(this.host.session, 'getScreenWidth', this);
            this.host.session.on('changeWrapMode', this.$updateWrapMode);
            this.host.session.on('changeWrapLimit', this.$changeWrapLimit);
            if (this.layer.session) {
                this.updateWrapMode();
            }
        };

        //override
        this.superSetSession = this.setSession;
        this.setSession = function (t) {
            if (this.layer.session) {
                this.layer.session.off('changeBackMarker', this.$updateMarkers);
            }
            this.superSetSession(t);
            this.markers.setSession(this.layer.session);
            if (t) {
                //not supported yet
                // t.unfold();
                // t.$backMarkers = [];
                //t.lineWidgets = null
                t.on('changeBackMarker', this.$updateMarkers);
                this.updateMarkers();
                if (this.host.session) {
                    this.updateWrapMode();
                }
            }
        };
        this.superOnAfterRender = this.onAfterRender;
        this.onAfterRender = function (changes, renderer) {
            var forceUpdate =
                this.$forceUpdate || changes & renderer.CHANGE_FULL;
            this.superOnAfterRender(changes, renderer);
            var config = this.layer.config;
            if (forceUpdate) {
                this.layer.setPadding(this.host.$padding);
                this.markers.setPadding(this.host.$padding);
            }
            if (
                forceUpdate ||
                changes & renderer.CHANGE_SIZE ||
                changes & renderer.CHANGE_SCROLL ||
                changes & renderer.CHANGE_H_SCROLL
            ) {
                dom.setStyle(
                    this.content.style,
                    'height',
                    config.minHeight + config.offset + 'px'
                );
                dom.translate(
                    this.content,
                    -this.host.scrollLeft,
                    -config.offset
                );
                var width = config.width + 2 * this.host.$padding + 'px';
                dom.setStyle(this.content.style, 'width', width);
                if (forceUpdate || changes & renderer.CHANGE_SCROLL)
                    this.markers.update(config);
            }
        };
        this.getScreenWidth = function () {
            return Math.max(
                this.layer.session.original.getScreenWidth(),
                this.hostgetScreenWidth.call(this.host.session)
            );
        };
        this.updateMarkers = function () {
            this.markers.setMarkers(this.layer.session.original.getMarkers());
            //hopefully something else will call update
        };
        this.getTopForMarker = function (screenRow, config) {
            var pos = this.layer.session.screenToDocumentPosition(screenRow, 0);
            var top = this.computeLineTop(
                pos.row,
                config,
                this.layer.session,
                pos.column
            );
            return top - config.firstRowScreen * config.lineHeight;
        };
        this.updateWrapMode = function () {
            this.layer.session.original.setUseWrapMode(
                this.host.session.$useWrapMode
            );
            this.layer.session.original.setWrapLimitRange(
                this.host.session.$wrapLimitRange.min,
                this.host.session.$wrapLimitRange.max
            );
            this.changeWrapLimit();
        };
        this.changeWrapLimit = function () {
            this.layer.session.original.adjustWrapLimit(
                this.host.session.$wrapLimit
            );
        };
        this.EMPTY_FOLD = {
            type: 'text',
            text: '',
            length: 0,
        };
        //TODO use lineWidgets and hostToWidgetRow instead of diff for getNextFoldLine?. Unnecessary as long as DiffFoldMode is enabled.
        this.getNextFoldLine = function (row, start) {
            var diffs = this.diffs;
            var mapped, i;
            if (start) mapped = i = start.$index;
            else {
                mapped = binarySearch(diffs, row, WIDGET);
                if (mapped < 0) mapped = ABOVE(mapped);
                for (i = mapped; i > -1; i--) {
                    if (diffs[i].leftStartLine < diffs[i].leftEndLine) {
                        break;
                    }
                }
            }
            var startRow = i > -1 ? diffs[i].leftEndLine : 0;
            for (i = mapped + 1; i < diffs.length; i++) {
                if (diffs[i].leftStartLine < diffs[i].leftEndLine) {
                    break;
                }
            }
            var endRow =
                i < diffs.length
                    ? diffs[i].leftStartLine - 1
                    : this.layer.session.getLength() - 1;
            if (row > endRow || startRow > endRow) return null; //end of file or no common lines
            var fold = Object.create(FoldLine.prototype);
            fold.range = Range.fromPoints(
                {
                    row: startRow - 1, //last line of removed segment
                    column: Infinity,
                },
                {
                    row: endRow,
                    column: Infinity, //last line of common segment.
                }
            );
            fold.start = fold.range.start;
            fold.end = fold.range.end;
            fold.folds = [fold];
            fold.$index = i < diffs.length ? i : i - 1;
            fold.placeholder = this.EMPTY_FOLD;
            return fold;
        };
    }.call(TextAndMarkers.prototype));

    //Renders gutters
    function Gutters(renderer) {
        VirusRenderer.call(this, renderer, renderer.$gutter, Gutter);
        dom.translate(this.layer.element, 0, 0);
        this.layer.element.style.position = 'absolute';
        this.layer.element.style.top = '0px';
        this.layer.setShowFoldWidgets(false);
        this.layer.setHighlightGutterLine(false);

        this.layer.$renderer = this;
        this.layer.$updateGutterWidth = this.$updateGutterWidth.bind(this);
    }
    (function () {
        Object.assign(this, VirusRenderer.prototype);
        this.attach = function () {
            var gutter = this.host.$gutterLayer;
            gutter.element.parentNode.appendChild(this.layer.element);
            override(gutter, '$renderer', this, this);
            this.host.on('afterRender', this.$onAfterRender);
        };
        this.detach = function () {
            this.layer.element.remove();
            revert(this.host.$gutter, '$renderer', this, this);
            this.host.off('afterRender', this.$onAfterRender);
        };

        this.getNextFoldLine = function (row, start) {
            var rowF = this.widgetToHostRow(row, true);
            var hostFold = this.host.session.getNextFoldLine(
                rowF,
                start && start.$index
            );
            if (hostFold) {
                var fold = Object.create(FoldLine.prototype);
                fold.start = {
                    //closest row below or equal to host fold start
                    row: this.hostToWidgetRow(hostFold.start.row, true),
                };
                fold.end = {
                    //closest row above or equal to host fold end
                    row: this.hostToWidgetRow(hostFold.end.row, false),
                };
                fold.$index = hostFold;
                if (fold.end.row < fold.start.row)
                    fold.end.row = fold.start.row; //Fold started and ended in a diff, could also return next fold.
                if (fold.end.row >= row) return fold;
                //This should never be needed in practice. Needs testing.
                return this.getNextFoldLine(row + 1, fold);
                //Unneeded by Gutters
                //fold.range = new Range(fold.start.row, 0, fold.end.row, 0);
                //fold.folds = foldF.folds;
            }
        };
        this.getText = function (session, row) {
            var text = (session.$firstLineNumber + row).toString();
            return text;
        };
        this.getWidth = function (session, rowText, config) {
            var lastRow = this.layer.$lines.last();
            lastRow = lastRow
                ? lastRow.row
                : this.hostToWidgetRow(config.lastRow, false);
            var hostLastRow = this.host.$gutterLayer.$lines.last().row;
            rowText = this.getText(this.layer.session, lastRow);
            var otherRowText = this.getText(this.host.session, hostLastRow);
            return (
                (rowText.length + otherRowText.length + 1) *
                config.characterWidth
            );
        };
        this.$updateGutterWidth = function () {
            var layer = this.layer;
            var host = this.host.$gutterLayer;
            if (layer.gutterWidth != host.gutterWidth - 10) {
                layer.gutterWidth = host.gutterWidth - 10;
                layer.element.style.width = layer.gutterWidth + 'px';
            }
        };
    }.call(Gutters.prototype));

    //Acediff Methods
    //Method arguments generally mean
    //acediff - An Acediff/AceInlineDiff instance
    //session - An Ace EditSession
    //editor - Not an Ace Editor but the result of acediff.panes[side]
    function createSession(acediff, side) {
        var session = u.getOption(acediff, side, 'session');
        if (!session) session = new EditSession('');
        if (side === WIDGET()) {
            //since we can't caall setup editor
            var content = acediff.options[side].content;
            if (content) {
                session.setValue(acediff.options[side].content);
            }
            var mode = u.getOption(acediff, side, 'mode');
            if (mode) {
                session.setMode(mode);
            }
        }
        return session;
    }

    function updateDiffMarkers(pane, diffs, TYPE, className, start, end) {
        start = start || 0;
        end = end || diffs.length;
        var startLine = TYPE(null, 'StartLine');
        var endLine = TYPE(null, 'EndLine');
        u.clearDiffMarkers(pane);
        for (; start < end; start++) {
            var item = diffs[start];
            if (item[endLine] > item[startLine]) {
                pane.markers.push(
                    pane.ace.session.addMarker(
                        new Range(
                            item[startLine],
                            0,
                            item[endLine] - 1,
                            Infinity
                        ),
                        className,
                        'fullLine'
                    )
                );
            }
        }
    }

    //Just like acediff, right is ours, left is origin by default
    function AceInlineDiff(options) {
        this.options = {};
        u.extend(true, this.options, AceInlineDiff.defaults, {}, options);

        this.editor =
            u.getOption(this, u.EDITOR_RIGHT, 'editor') ||
            ace.edit(u.getOption(this, u.EDITOR_RIGHT, 'id'));

        //////////Make This Work With AcediffUtils Methods
        //Implement Pane interface
        this.ace = this.editor;
        this.markers = [];
        this.scrollMargin = {};
        this.editor.renderer.addScrollMargin(this.scrollMargin);
        //Implement Pair interface
        this.left = 'virtual'; //no left editor
        this.right = u.EDITOR_RIGHT;
        //Implement Acediff Interface
        this.panes = {
            virtual: {
                ace: {
                    session: null,
                    getSession: function () {
                        return this.session;
                    },
                },
                markers: [],
            },
            right: this,
        };
        this.pairs = [this];
        ///////////

        this.foldModes = {
            right: new DiffFoldMode(2, 1),
            //not used by Renderer unless swapped ie,
            //we do not use folds in VirusRenderer
            left: new DiffFoldMode(2, 1),
        };

        this.$gutters = new Gutters(this.editor.renderer);
        this.$texts = new TextAndMarkers(this.editor.renderer);

        // if (
        //     u.getOption(this, WIDGET(this.swapped), 'editable') &&
        //     !u.getOption(this, HOST(this.swapped), 'editable')
        // )
        //     this.swapped = !this.swapped;
        this.setCssClasses(true);

        this.setSession(createSession(this, u.EDITOR_RIGHT), HOST);
        u.setupEditor(this, this.right); //setup editor after setting session
        this.$decorate = this.decorate.bind(this); //used by setSession
        this.setSession(createSession(this, u.EDITOR_LEFT), WIDGET); //triggers diff
        this.$gutters.attach();
        this.$texts.attach();
        if (this.options.ignoreWhitespace == 'auto') {
            if (this.diffs.length < 2) {
                this.options.ignoreWhitespace = false;
                this.diff(true);
            } else this.options.ignoreWhitespace = true;
        }

        this.$handleClick = this.handleClick.bind(this);
        this.$handleDoubleClick = this.handleDoubleClick.bind(this);
        //this.$handleChangeSelection = this.handleChangeSelection.bind(this);
        this.editor.on('mousedown', this.$handleClick);
        this.editor.on('dblclick', this.$handleDoubleClick);
        this.$adjustDiffs = this.adjustDiffs.bind(this);
        this.$changeCharacterSize = u.updateScrollOffset.bind(null, this);
        this.editor.on('change', this.$adjustDiffs);
        this.editor.renderer.on(
            'changeCharacterSize',
            this.$changeCharacterSize
        );

        if (this.options.autoUpdate) {
            //without this the diffs will
            //eventually get muddled
            this.startUpdate();
        }
    }
    //Gutter and Folding
    //Three Structures, Alignables, Widgets and Diffs
    (function () {
        //Diffs can be updated with AceInlineDiff#diff but until
        //then, this is a way to keep things rolling to match
        //what WidgetManager does.
        //We do not edit rawDiffs so Inline markers will be cleared
        //Possible solutions:
        //Use RangeList for inline markers
        this.swapped = false;
        this.adjustDiffs = function (change) {
            var startRow = change.start.row;
            var endRow = change.end.row;
            var delta = endRow - startRow;
            if (delta < 1) return;
            if (change.action == 'remove') delta = -delta;
            var b = change.start.row;
            var start = binarySearch(this.diffs, b, HOST);
            if (start < 0) {
                //change in an equal row
                //Couldinsert a new diff.
                //Wait for rediff so we'll see wrong line number positioning in the gutter since we make use of leftEndLine
                start = ABOVE(start) + 1;
            } else {
                var changed = this.diffs[start++];
                if (
                    change.action == 'delete' &&
                    changed.rightEndLine < endRow
                ) {
                    changed.rightEndLine = startRow;
                } else changed.rightEndLine += delta;
            }
            var len = this.diffs.length;
            var i;
            if (change.action == 'insert') {
                for (i = start; i < len; i++) {
                    this.diffs[i].rightStartLine += delta;
                    this.diffs[i].rightEndLine += delta;
                }
            } else {
                for (i = start; i < len; i++) {
                    var r = this.diffs[i];

                    if (r.rightEndLine < endRow && startRow <= r.rightEndLine) {
                        r.rightEndLine = startRow;
                    } else if (r.rightEndLine >= endRow) {
                        r.rightEndLine += delta;
                    }

                    if (
                        r.rightStartLine < endRow &&
                        startRow <= r.rightStartLine
                    ) {
                        r.rightStartLine = startRow;
                    } else if (r.rightStartLine >= endRow) {
                        r.rightStartLine += delta;
                    }
                }
            }
            this.$texts.$forceUpdate = this.$gutters.$forceUpdate = true;
            var currentClass = this.swapped
                ? this.options.classes.removed
                : this.options.classes.added;
            updateDiffMarkers(this, this.diffs, HOST, currentClass);
        };
        this.startUpdate = function () {
            if (!this.$diff) {
                this.$diff = u.throttle(this.diff, 1500).bind(this);
                this.editor.on('change', this.$diff);
                this.widgetSession &&
                    this.widgetSession.on('change', this.$diff);
            }
        };
        this.stopUpdate = function () {
            if (this.$diff) {
                this.editor.off('change', this.$diff);
                this.widgetSession &&
                    this.widgetSession.off('change', this.$diff);
                this.$diff = null;
            }
        };
        this.diff = function (clean) {
            u.diff(this, this, clean);
            this.decorate();
        };
        this.diffs = [];
        this.decorate = function () {
            this.foldModes.right.diffs = this.foldModes.left.diffs = this.$gutters.diffs = this.$texts.diffs = this.diffs;
            u.clearLineWidgets(this);
            var putFragmentsAbove =
                this.swapped == this.options.removedFragmentsBelow;
            this.diffs.forEach(function (item) {
                if (item.leftEndLine > item.leftStartLine)
                    u.addLineWidget(
                        this,
                        putFragmentsAbove
                            ? item.rightStartLine
                            : item.rightEndLine,
                        item.leftStartLine,
                        item.leftEndLine,
                        this.widgetSession
                    );
            }, this);
            u.updateScrollOffset(this);
            var currentClass = this.swapped
                ? this.options.classes.removed
                : this.options.classes.added;
            updateDiffMarkers(this, this.diffs, HOST, currentClass);
            var otherClass = this.swapped
                ? this.options.classes.added
                : this.options.classes.removed;
            updateDiffMarkers(
                this.panes.virtual,
                this.diffs,
                WIDGET,
                otherClass
            );
            if (this.rawDiffs) {
                u.showInlineDiffs(this, this);
            }
        };
        this.setCssClasses = function (on) {
            var Widget, Host;
            if (this.swapped) {
                dom.setCssClass(
                    this.editor.container,
                    this.options.classes.swapped,
                    on
                );
                Widget = 'Added';
                Host = 'Removed';
            } else {
                Widget = 'Removed';
                Host = 'Added';
            }
            dom.setCssClass(
                this.editor.renderer.$gutterLayer.element,
                this.options.classes['gutter' + Host],
                on
            );
            dom.setCssClass(
                this.editor.renderer.content,
                this.options.classes['content' + Host],
                on
            );
            dom.setCssClass(
                this.$gutters.layer.element,
                this.options.classes['gutter' + Widget],
                on
            );
            dom.setCssClass(
                this.$texts.content,
                this.options.classes['content' + Widget],
                on
            );
        };
        this.goNextDiff = function (editor) {
            return u.goNearbyDiff(this, editor, 1);
        };
        this.goPrevDiff = function (editor) {
            return u.goNearbyDiff(this, editor, -1);
        };
        this.setSession = function (session, TYPE, isSwapping) {
            var side = TYPE(isSwapping ? !this.swapped : this.swapped);
            var oldSession =
                TYPE === WIDGET ? this.widgetSession : this.current;
            if (oldSession === session) return;
            if (TYPE === WIDGET) {
                if (oldSession) {
                    oldSession.off('changeWrapLimit', this.$decorate);
                    this.$diff && oldSession.off('change', this.$diff);
                }
                this.widgetSession = session;
                if (session) {
                    this.$diff && session.on('change', this.$diff);
                    session.on('changeWrapLimit', this.$decorate);
                }
                this.$texts.setSession(this.widgetSession);
                this.$gutters.setSession(this.widgetSession);
                this.panes.virtual.ace.session = this.widgetSession;
            } else {
                if (oldSession) this.$texts.detach(true);
                this.current = session;
                this.editor.setSession(this.current);
                this.editor.setReadOnly(!u.getOption(this, side, 'editable'));
                if (oldSession && session) this.$texts.attach(true);
            }
            if (isSwapping)
                //We have foldModes for both sessions
                return;
            var foldMode = this.foldModes[side];
            if (oldSession) {
                revert(oldSession, '$setFolding', foldMode);
                oldSession.$setFolding(foldMode.sub);
                if (!this.options[side].session) oldSession.destroy();
            }
            this.options[side].session = session;
            if (session) {
                foldMode.setSub(session.$foldMode);
                session.$setFolding(foldMode);
                override(session, '$setFolding', foldMode, function (newMode) {
                    if (newMode && newMode.constructor === DiffFoldMode)
                        foldMode.host$setFolding.call(session, newMode);
                    else foldMode.setSub(newMode);
                });
                if (this.current && this.widgetSession) this.diff(true);
            }
        };
        //Handle clicking the widgetSession
        this.clickSwap = function (row, column) {
            this.swap();
            this.editor.gotoLine(row + 1, column);
        };
        this.clickCopy = function (row, col) {
            var widget = this.$texts.findWidget(row);
            if (u.getOption(this, HOST(this.swapped), 'editable')) {
                var text = this.widgetSession.getLines(
                    widget.start,
                    widget.end - 1
                );
                this.current
                    .getDocument()
                    .insertFullLines(widget.row + 1, text);
            }
        };
        this.handleDoubleClick = function (e) {
            this.handleClick(e, true);
        };
        this.handleClick = function (e, swapOnEqualRow) {
            var screenPos = this.editor.renderer.pixelToScreenCoordinates(
                e.clientX,
                e.clientY
            );
            var doSwap = this.options.onClickWidget === 'swap';
            var widgetPos = this.$texts.pixelToWidgetRow(
                screenPos.row,
                screenPos.column,
                true
            );
            if (widgetPos) {
                e.stop();
                if (doSwap) {
                    this.clickSwap(widgetPos.row, widgetPos.column);
                } else this.clickCopy(widgetPos.row, widgetPos.column);
            } else if (
                doSwap &&
                swapOnEqualRow === true &&
                screenPos.row >= 0 &&
                u.getOption(this, WIDGET(this.swapped), 'editable') &&
                !u.getOption(this, HOST(this.swapped), 'editable')
            ) {
                var docPos = e.getDocumentPosition();
                var widgetRow = this.$texts.hostToWidgetRow(docPos.row);
                if (widgetRow !== undefined) {
                    e.stop();
                    this.clickSwap(widgetRow, docPos.column);
                }
            }
        };
        this.swap = function () {
            var offset = this.scrollMargin.top;
            var top = this.current.getScrollTop();
            //needed unless ace renderer will attempt to scroll to keep the previously visible rows visible
            this.editor.renderer.layerConfig.firstRowScreen = -1;
            this.widgetSession.setScrollTop(top + offset);
            u.clearLineWidgets(this);
            u.clearDiffMarkers(this);
            u.clearDiffMarkers(this.panes.virtual);
            this.setCssClasses(false);
            var widgetSession = this.widgetSession;
            this.setSession(this.current, WIDGET, true);
            this.setSession(widgetSession, HOST, true);
            this.swapped = !this.swapped;
            this.setCssClasses(true);
            this.diff();
            offset -= this.scrollMargin.top;
            this.current.setScrollTop(top + offset);

            //this.editor.off("changeSelection", this.$handleChangeSelection);
            // this.current.$scrollToY(top-this.scrollMargin.top);
            //this.editor.off("changeSelection", this.$handleChangeSelection);
        };

        this.resize = function (force) {
            this.editor.resize(force);
            u.updateScrollOffset(this);
        };
        this.destroy = function () {
            this.setCssClasses(false);
            this.stopUpdate();
            this.editor.renderer.removeScrollMargin(this.scrollMargin);
            this.editor.off('change', this.$adjustDiffs);
            this.editor.off('dblclick', this.$handleDoubleClick);
            this.editor.off('mousedown', this.$handleClick);
            this.editor.renderer.off(
                'changeCharacterSize',
                this.$changeCharacterSize
            );
            u.clearLineWidgets(this);
            u.clearDiffMarkers(this);
            u.clearDiffMarkers(this.panes.virtual);
            this.setSession(null, WIDGET);
            this.setSession(this.options.right.session, HOST);
            this.$gutters.detach();
            this.$texts.detach();
            for (var i in this.$commands)
                this.editor.commands.removeCommand(this.$commands[i]);
            if (!u.getOption(this, u.EDITOR_RIGHT, 'editor')) {
                this.editor.destroy();
            }
        };
    }.call(AceInlineDiff.prototype));
    AceInlineDiff.diff = function (editor, origin, options) {
        var args = arguments;
        function isEditor(e) {
            return e instanceof ace.Editor;
        }
        function isSession(e) {
            return e instanceof ace.EditSession;
        }
        function isOptions(e) {
            return !isEditor(e) && !isSession(e);
        }
        function isString(e) {
            return !e || typeof e === 'string';
        }
        function isID(e) {
            return isString(e) || e instanceof Element;
        }

        var origSession, editSession, origContent, editContent, id;
        editor = origin = options = undefined;

        var i = 0;
        if (isID(args[i])) id = args[i++];
        else if (isEditor(args[i])) {
            editor = args[i++];
            editSession = editor.getSession();
        }
        if (isSession(args[i])) origSession = args[i++];
        else if (isString(args[i])) origContent = args[i++];
        if (isSession(args[i])) editSession = args[i++];
        else if (isString(args[i])) editContent = args[i++];
        if (isOptions(args[i])) {
            options = args[i++];
        }
        if (i < args.length)
            throw new Error(
                'Invalid arguments supplied. Expected [editor or editorId,][origin[,edit]]][,options] where value is a string or editsession.'
            );

        options = u.extend(
            true,
            {
                id: id,
                editor: editor,
                mode: editSession && editSession.getOption('mode'),
                right: {
                    session: editSession,
                    content: editContent,
                },
                left: {
                    editable: !!origSession,
                    session: origSession,
                    content: origContent,
                },
            },
            options
        );
        return new AceInlineDiff(options);
    };
    AceInlineDiff.defaults = {
        mode: undefined,
        theme: null,
        removedFragmentsBelow: false,
        ignoreWhitespace: 'auto',
        editable: true,
        autoUpdate: true,
        showInlineDiffs: true,
        onClickWidget: 'swap',
        editor: undefined,
        id: 'diff-editor',
        right: {
            //Uses the editor
            editable: true,
        },
        left: {
            session: undefined,
            content: null,
        },
        classes: {
            swapped: 'acediff-swapped',
            gutterRemoved: 'acediff-gutter-removed',
            gutterAdded: 'acediff-gutter-added',
            contentRemoved: 'acediff-content-removed',
            contentAdded: 'acediff-content-added',
            added: 'acediff-added',
            removed: 'acediff-removed',
            inlineAdded: 'acediff-inline-added',
            inlineRemoved: 'acediff-inline-removed',
        },
    };
    return AceInlineDiff;
});