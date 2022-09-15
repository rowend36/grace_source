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
    var Marker = ace.require('ace/layer/marker').Marker;
    var LineWidgets = ace.require('ace/line_widgets').LineWidgets;
    //Acediff Methods
    //Method arguments generally mean
    //acediff - An Acediff/AceInlineDiff instance
    //session - An Ace EditSession
    //editor - Not an Ace Editor but the result of acediff.editors[side]
    //left,right,diffs - acediff.pairs[i].left,acediff.pairs[i].right,acediff.pairs[i].diffs
    function createSession(acediff, side, session) {
        var mode = u.getOption(acediff, side, 'mode');
        var content = acediff.options[side].content;
        if (session) {
            if (mode) session.setMode(mode);
            if (content) {
                session.setValue(content);
            }
        } else session = new EditSession(content || '', mode);
        acediff.foldModes[side].setFolding(session.$foldMode);
        session.$setFolding(acediff.foldModes[side]);
        override(session, '$setFolding', session, function (e) {
            acediff.foldModes[side].setFolding(e);
        });
        return session;
    }

    function setupEditor(acediff, side) {
        if (!acediff.$commands)
            acediff.$commands = {
                nextDiff: {
                    name: 'Go next diff',
                    exec: function (editor) {
                        acediff.goNextDiff(editor);
                    },
                    readOnly: true,
                    bindKey: 'Ctrl-Shift-N',
                },
                prevDiff: {
                    name: 'Go previous diff',
                    exec: function (editor) {
                        acediff.goPrevDiff(editor);
                    },
                    readOnly: true,
                    bindKey: 'Ctrl-Shift-P',
                },
                swapDiffOrigin: {
                    name: 'Swap diff origin',
                    exec: function () {
                        acediff.swap();
                    },
                    readOnly: true,
                },
            };
        var commands = acediff.$commands;

        var options = u.getOption(acediff, side, 'options');
        if (options) {
            acediff.editors[side].ace.setOptions(options);
        }
        /*var mode = getOption(acediff, side, 'mode');
        if(mode)
            acediff.editors[side].ace.getSession().setMode(mode);
        */
        var readOnly = !u.getOption(acediff, side, 'editable');
        if (readOnly) acediff.editors[side].ace.setReadOnly(readOnly);
        var theme = u.getOption(acediff, side, 'theme');
        if (theme) acediff.editors[side].ace.setTheme(theme);
        // if the data is being supplied by an option, set the editor values now
        if (acediff.options[side].content) {
            acediff.editors[side].ace.setValue(
                acediff.options[side].content,
                -1
            );
        }
        for (var i in commands)
            acediff.editors[side].ace.commands.addCommand(commands[i]);
    }

    function clearLineWidgets(editor) {
        editor.scrollOffset = 0;

        if (!editor.lineWidgets) return;

        for (var i in editor.lineWidgets) {
            editor.ace.session.widgetManager.removeLineWidget(
                editor.lineWidgets[i]
            );
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
                type: u.WIDGET_OFFSET,
                start: start,
                end: end,
            };
            return;
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: u.WIDGET_INLINE,
            start: start,
            end: end,
        };
        acediff.lineWidgets.push(w);
        session.widgetManager.addLineWidget(w);
        return w;
    }

    //binary search through an array of start end objects
    function binarySearch(diffs, row, TYPE, invert) {
        var startLine = TYPE(invert, 'StartLine');
        var endLine = TYPE(invert, 'EndLine');
        var recursionHead = 0;
        var first = 0;
        var last = diffs.length - 1;
        while (first <= last) {
            if (++recursionHead > 1000) {
                throw new Error('Loop Limit Exceeded');
            }
            var mid = (first + last) >> 1;
            if (diffs[mid][startLine] > row) last = mid - 1;
            else if (diffs[mid][endLine] <= row) first = mid + 1;
            else return mid;
        }
        //use ABOVE to get first
        return -(first + 1);
    }
    //Override object prototype or value
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

    function WIDGET(invert, type) {
        return (invert ? u.EDITOR_LEFT : u.EDITOR_RIGHT) + (type || '');
    }

    function HOST(invert, type) {
        return (invert ? u.EDITOR_RIGHT : u.EDITOR_LEFT) + (type || '');
    }

    function ABOVE(line) {
        return -line - 2;
    }

    function updateDiffMarkers(
        acediff,
        session,
        diffs,
        TYPE,
        className,
        start,
        end
    ) {
        start = start || 0;
        end = end || diffs.length;
        var startLine = TYPE(null, 'StartLine');
        var endLine = TYPE(null, 'EndLine');
        for (var i = 0, m = acediff.markers, n = m.length; i < n; i++) {
            session.removeMarker(m[i]);
        }
        acediff.markers = [];
        for (; start < end; start++) {
            var item = diffs[start];
            if (item[endLine] > item[startLine]) {
                acediff.markers.push(
                    session.addMarker(
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

    function InlineDiffFolding(before, after) {
        this.diffs = null;
        this.getFoldWidget = function (session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.leftEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end =
                    (diff ? diff.leftStartLine - 1 : session.getLength()) -
                    this.ctxBefore;
                if (end > start) {
                    if (row == start) {
                        return 'start';
                    } else if (style == 'markbeginend' && row == end) {
                        return 'end';
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
        this.ctxAfter = after === 0 ? 0 : after || 1;
        this.getFoldWidgetRange = function (session, style, row) {
            var i = binarySearch(this.diffs, row, HOST);
            var start, end, range;
            if (i < 0) {
                var diff = this.diffs[ABOVE(i)];
                start = (diff ? diff.leftEndLine : 0) + this.ctxAfter;
                diff = this.diffs[ABOVE(i) + 1];
                end =
                    (diff ? diff.leftStartLine - 1 : session.getLength()) -
                    this.ctxBefore;
                if (end > start) {
                    if (
                        row == start ||
                        (style == 'markbeginend' && row == end)
                    ) {
                        range = new Range(start, 0, end, Infinity);
                        range.placeholder = {
                            type: 'comment',
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
                start = this.diffs[i].leftStartLine;
                end = this.diffs[i].leftEndLine - 1;
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
        this.setFolding = function (mode) {
            this.sub = mode;
        };
    }

    //A virus is a piece of code that attaches
    //itself to a host and lives of it.
    //This is an abstract class; Subclasses must
    //implement update and scrollLines
    function CellVirus(element, Layer) {
        this.layer = new Layer(element);
        this.layer.$lines.computeLineTop = this.computeLineTop.bind(this);
    }
    var CellVirusProps = function () {
        this.computeLineTop = function (row, config, session, column) {
            var tops = this.isWidget(row, true);
            var top;
            if (typeof tops == 'number') {
                top = this.host.session.documentToScreenRow(tops, column || 0);
            } else if (tops.row < 0) {
                top =
                    -tops.rowCount +
                    this.layer.session.documentToScreenRow(row, column || 0) -
                    this.layer.session.documentToScreenRow(tops.start, 0);
            } else {
                top =
                    this.host.session.documentToScreenRow(tops.row, Infinity) +
                    this.layer.session.documentToScreenRow(row, column || 0) -
                    this.layer.session.documentToScreenRow(tops.start, 0) +
                    1;
            }
            return top * config.lineHeight - config.lineOffset;
        };
        this.hook = function (host_) {
            this.host = host_;
            var hostUpdate = host_.update.bind(host_);
            override(
                host_,
                'update',
                this,
                function (config) {
                    hostUpdate(config);
                    this.update(this.computeConfig());
                    this.lastWidget = null;
                }.bind(this)
            );
            var hostScroll = host_.scrollLines.bind(host_);
            override(
                host_,
                'scrollLines',
                this,
                function (config) {
                    hostScroll(config);
                    this.scrollLines(this.computeConfig());
                    this.lastWidget = null;
                }.bind(this)
            );
        };
        this.unhook = function () {
            revert(this.host, 'update', this);
            revert(this.host, 'scrollLines', this);
            this.lastWidget = null;
            this.host = null;
        };

        /*@return widget || number if equal
         **/
        this.setSession = function (t) {
            this.layer.setSession(t);
        };

        this.isWidget = function (row, returnRow) {
            var lastW = this.lastWidget;
            if (lastW && lastW.end > row && lastW.start <= row) {
                return lastW;
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
                var last = this.diffs[mapped].leftStartLine - 1;
                if (widgets[last] && widgets[last].type == u.WIDGET_INLINE) {
                    return (this.lastWidget = widgets[last]);
                }
                var next = this.diffs[mapped].leftEndLine - 1;
                if (widgets[next] && widgets[next].type == u.WIDGET_INLINE) {
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
        this.isHostEqualRow = function (row, config) {
            var result = this.hostToWidgetRow(row, undefined);
            return result === undefined ? false : result;
        };
        //find host row from widget row
        this.hostToWidgetRow = function (row, below, invert) {
            var last, widgetLine;
            var mapped = binarySearch(this.diffs, row, HOST, invert);
            if (mapped > -1) {
                if (below === undefined || below === null) return below;
                //in widget
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

        this.computeConfig = function () {
            var host = this.host.session;
            var config = Object.assign({}, this.host.config);
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
                ); //too much actually
                config.lineOffset =
                    -(lastOffsetRow - firstRow) * config.lineHeight;
                config.offset -= config.lineOffset;
            } else {
                var firstRowScreen =
                    config.offset > 0
                        ? host.$scrollTop / config.lineHeight
                        : config.firstRowScreen; //not counting scrollMargin
                config.firstRow = Math.max(
                    0,
                    this.$screenToInlineWidgetRow(Math.floor(firstRowScreen)) -
                        1
                );
                config.lastRow = this.$screenToInlineWidgetRow(
                    Math.ceil(firstRowScreen + numRows)
                );
                config.lineOffset = 0;
            }
            config.gutterOffset = 1; //good enough for most purposes
            return config;
        };
        this.$screenToInlineWidgetRow = function (screenRow) {
            var host = this.host.session;
            var self = this.layer.session;
            var widgets = host.lineWidgets;
            //real screen row is assured to be at
            //least this
            var row = host.screenToDocumentRow(screenRow, 0);
            var widgetRow /*the last shared widget row*/, diff;
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
                if (
                    !widgets ||
                    !widgets[row] ||
                    widgets[row].type !== u.WIDGET_INLINE
                )
                    return widgetRow;
            } else {
                //A diff can either be above or below specified row {@see removedFragmentsBelow}. Due to the asynchronous rendering we are better off gusessing which, right represents the widgets
                diff = this.diffs[widget];
                //assuming there is at least one equal line between the two diffs, that equal line would have the widget ie the line above if diffs are rendered below
                var lineAbove = diff.leftStartLine - 1;
                //only one can have a widget typically
                if (lineAbove < 1 && host.topLineWidget)
                    widgetRow = diff.rightEndLine - 1;
                else if (
                    widgets &&
                    widgets[lineAbove] &&
                    widgets[lineAbove].type === u.WIDGET_INLINE
                ) {
                    //widget is above this row
                    return diff.rightEndLine - 1;
                } else {
                    widgetRow = diff.rightStartLine;
                    if (
                        !(
                            widgets &&
                            widgets[row] &&
                            widgets[row].type === u.WIDGET_INLINE
                        )
                    ) {
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
    }; //.call(CellVirus.prototype);

    //Renders text and markers
    function TextLineVirus(renderer) {
        var content = (this.content = document.createElement('div'));
        this.markers = new Marker(content);
        CellVirus.call(this, content, Text);
        this.markers.$getTop = function (row, config) {
            var main = this.session.screenToDocumentPosition(row, 0);
            var top = layer.$lines.computeLineTop(
                main.row,
                config,
                layer.session,
                main.column
            );
            return top - config.firstRowScreen * config.lineHeight;
        };
        //override
        this.setSession = function (t) {
            if (this.layer.session) {
                this.layer.session.off('changeBackMarker', this.$updateMarkers);
            }
            this.layer.setSession(t);
            this.markers.setSession(t);
            if (t) {
                //not supported yet
                t.unfold();
                t.$backMarkers = [];
                t.on('changeBackMarker', this.$updateMarkers);
                this.updateMarkers();
                if (this.host && this.host.session) {
                    this.updateWrapMode();
                }
            }
        };

        content.className = 'ace_content';
        this.renderer = renderer;
        var layer = this.layer;

        this.$getLongestLine = function () {
            var charCount = Math.max(
                layer.session.getScreenWidth(),
                this.session.getScreenWidth()
            );
            if (this.showInvisibles && !this.session.$useWrapMode)
                charCount += 1;

            if (this.$textLayer && charCount > this.$textLayer.MAX_LINE_LENGTH)
                charCount = this.$textLayer.MAX_LINE_LENGTH + 30;

            return Math.max(
                this.$size.scrollerWidth - 2 * this.$padding,
                Math.round(charCount * this.characterWidth)
            );
        };
        this.$updateWrapMode = this.updateWrapMode.bind(this);
        this.$changeWrapLimit = this.changeWrapLimit.bind(this);

        this.$updateMarkers = this.updateMarkers.bind(this);
        this.$renderLinesFragment = this.renderLinesFragment.bind(this);
        override(this.layer, '$renderLinesFragment', this);
        this.$doRender = this.doRender.bind(this);
        this.attach();
    }
    (function () {
        CellVirusProps.call(this);
        this.detach = function (sessionOnly) {
            this.host.session.off('changeWrapMode', this.$updateWrapMode);
            this.host.session.off('changeWrapLimit', this.$changeWrapLimit);
            if (!sessionOnly) {
                this.renderer.off('afterRender', this.$doRender);
                this.content.remove();
                revert(this.renderer, '$getLongestLine', this);
                this.unhook();
            }
        };
        this.attach = function (sessionOnly) {
            if (!sessionOnly) {
                this.hook(this.renderer.$textLayer);
                this.renderer.on('afterRender', this.$doRender);
                override(this.renderer, '$getLongestLine', this);
                this.renderer.scroller.appendChild(this.content);
            }
            this.host.session.on('changeWrapMode', this.$updateWrapMode);
            this.host.session.on('changeWrapLimit', this.$changeWrapLimit);
            if (this.layer.session) {
                this.updateWrapMode();
            }
        };
        this.updateMarkers = function () {
            this.markers.setMarkers(this.layer.session.getMarkers());
            //hopefully something else will call update
        };

        this.renderLinesFragment = function (config, first, last, which) {
            var widgets = [];
            var host = this.host;
            if (config.lineOffset < 0) widgets.push(host.session.topLineWidget);
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
                    if (
                        widget &&
                        widget.end >= first &&
                        widget.type === u.WIDGET_INLINE
                    ) {
                        widgets.push(widget);
                        if (widget.end >= last) break;
                    }
                }
            }
            var fragment = [];
            if (widgets.length) {
                for (var j in widgets) {
                    this.lastWidget = widgets[j];
                    fragment.push.apply(
                        fragment,
                        this.host$renderLinesFragment.apply(this.layer, [
                            config,
                            Math.max(first, widgets[j].start),
                            Math.min(last, widgets[j].end - 1),
                        ])
                    );
                }
            }
            return fragment;
        };
        this.doRender = function () {
            var width =
                this.renderer.layerConfig.width +
                2 * this.renderer.$padding +
                'px';
            dom.setStyle(this.content.style, 'width', width);
            dom.setStyle(
                this.content.style,
                'height',
                this.layer.config.minHeight + this.layer.config.offset + 'px'
            );
            dom.translate(
                this.content,
                -this.renderer.scrollLeft,
                -this.layer.config.offset
            );
        };
        this.updateWrapMode = function () {
            this.layer.session.setWrapLimitRange(
                this.host.session.$wrapLimitRange.min,
                this.host.session.$wrapLimitRange.max
            );
            this.layer.session.setUseWrapMode(this.host.session.$useWrapMode);
            this.changeWrapLimit();
        };
        this.changeWrapLimit = function () {
            this.layer.session.adjustWrapLimit(this.host.session.$wrapLimit);
        };
        this.scrollLines = function (config) {
            //optimize
            this.layer.setPadding(this.renderer.$padding);
            this.markers.setPadding(this.renderer.$padding);
            this.markers.update(config);

            var _this = this.layer;
            if (_this.$lines.cells.length == 0) return this.update(config);
            var oldFirstRow = _this.$lines.cells[0].row;
            var lastRow = config.lastRow;
            var oldLastRow = _this.config
                ? _this.$lines.cells[_this.$lines.cells.length - 1].row
                : -1;
            if (_this.$lines.pageChanged(_this.config, config))
                return this.update(config);
            if (!_this.config || oldLastRow < config.firstRow)
                return this.update(config);

            if (lastRow < oldFirstRow) return this.update(config);

            if (oldLastRow < config.firstRow) return this.update(config);

            if (lastRow < oldFirstRow) return this.update(config);

            if (config.lineOffset != _this.config.lineOffset)
                for (var line in _this.$lines.cells) {
                    var cell = _this.$lines.cells[line];
                    cell.element.style.top =
                        this.computeLineTop(cell.row, config, _this.session) +
                        'px';
                }
            _this.$lines.moveContainer(config);
            _this.config = config;
            if (oldFirstRow < config.firstRow) {
                while (
                    _this.$lines.cells.length &&
                    _this.$lines.cells[0].row < config.firstRow
                ) {
                    _this.$lines.shift();
                }
            } else if (config.firstRow < oldFirstRow) {
                _this.$lines.unshift(
                    this.renderLinesFragment(
                        config,
                        config.firstRow,
                        oldFirstRow - 1,
                        1
                    )
                );
            }
            if (oldLastRow > config.lastRow) {
                while (
                    _this.$lines.cells.length &&
                    _this.$lines.cells[_this.$lines.cells.length - 1].row >
                        config.lastRow
                ) {
                    _this.$lines.pop();
                }
            } else if (config.lastRow > oldLastRow) {
                _this.$lines.push(
                    this.renderLinesFragment(
                        config,
                        oldLastRow + 1,
                        config.lastRow,
                        -1
                    )
                );
            }
            /*test(uniq(_this.$lines.cells, function(r) {
                return r.row;
            }));*/
        };
        this.update = function (config) {
            this.layer.setPadding(this.renderer.$padding);
            this.markers.setPadding(this.renderer.$padding);
            this.markers.update(config);
            this.layer.update(config);
        };
    }.call(TextLineVirus.prototype));

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
        this.layer.$updateGutterWidth = function () {
            if (this.gutterWidth != gutter.gutterWidth - 10) {
                this.gutterWidth = gutter.gutterWidth - 10;
                this.element.style.width = this.gutterWidth + 'px';
            }
        };
        var last, lastF;
        this.getNextFoldLine = function (row, start) {
            var rowF = this.widgetToHostRow(row, true);
            var ind;
            if (start == last) ind = lastF;
            lastF = this.host.session.getNextFoldLine(rowF, ind);
            if (lastF) {
                last = Object.create(FoldLine.prototype);
                last.start = {
                    row: this.hostToWidgetRow(lastF.start.row, true),
                };
                last.end = {
                    row: this.hostToWidgetRow(lastF.end.row, false),
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

        this.attach = function () {
            gutter = renderer.$gutterLayer;
            gutter.element.parentNode.appendChild(this.layer.element);
            override(gutter, '$renderer', this, this);
            this.hook(gutter);
        };
        this.attach();
    }
    (function () {
        CellVirusProps.call(this);

        function onCreateCell(element) {
            var textNode = document.createTextNode('');
            element.appendChild(textNode);

            var foldWidget = dom.createElement('span');
            element.appendChild(foldWidget);

            return element;
        }

        this.detach = function () {
            this.layer.element.remove();
            revert(this.host, '$renderer', this, this);
            this.unhook();
        };
        this.update = function (config) {
            var _this = this.layer;
            _this.config = config;
            var session = _this.session;
            var lastRow = Math.min(
                config.lastRow + config.gutterOffset, // needed to compensate for hor scollbar
                session.getLength() - 1
            );
            _this.oldLastRow = lastRow;
            _this.config = config;

            _this.$lines.moveContainer(config);
            _this.$updateCursorRow();
            _this.$lines.push(
                this.renderLines(config, config.firstRow, config.lastRow, true)
            );
            _this._signal('afterRender');
            _this.$updateGutterWidth(config);
        };
        this.getFoldedRowCount = function (startRow, endRow) {
            //when all things fail
            var lines = this.layer.$lines.cells;
            var count = 0;
            for (var i = 0, len = lines.length; i < len; i++) {
                var a = lines[i];
                if (a.row < startRow) {
                    continue;
                }
                if (a.row <= endRow) count++;
                else break;
            }
            return count;
        };
        //so much duplicated code
        this.renderLines = function (config, firstRow, lastRow, useCache) {
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
                if (row > lastRow) break;

                var cell;
                if (index < len) {
                    cell = cache[index++];
                } else {
                    cell = _lines.createCell(
                        row,
                        config,
                        session,
                        onCreateCell
                    );
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
        this.scrollLines = function (config) {
            if (config.lineOffset != this.layer.config.lineOffset)
                for (var line in this.layer.$lines.cells) {
                    var cell = this.layer.$lines.cells[line];
                    cell.element.style.top =
                        this.computeLineTop(
                            cell.row,
                            config,
                            this.layer.session
                        ) + 'px';
                }
            var _this = this.layer;
            var oldConfig = _this.config;
            _this.config = config;

            _this.$updateCursorRow();
            if (_this.$lines.pageChanged(oldConfig, config))
                return this.update(config);

            _this.$lines.moveContainer(config);
            var lastRow = Math.min(
                config.lastRow + config.gutterOffset, // needed to compensate for hor scollbar
                _this.session.getLength() - 1
            );
            var oldLastRow = _this.oldLastRow;
            _this.oldLastRow = lastRow;
            if (!oldConfig || oldLastRow < config.firstRow)
                return this.update(config);

            if (lastRow < oldConfig.firstRow) return this.update(config);

            if (oldConfig.firstRow < config.firstRow)
                for (
                    var row = this.getFoldedRowCount(
                        oldConfig.firstRow,
                        config.firstRow - 1
                    );
                    row > 0;
                    row--
                )
                    _this.$lines.shift();

            if (oldLastRow > lastRow)
                for (
                    var row = this.getFoldedRowCount(lastRow + 1, oldLastRow);
                    row > 0;
                    row--
                )
                    _this.$lines.pop();
            if (config.firstRow < oldConfig.firstRow) {
                _this.$lines.unshift(
                    this.renderLines(
                        config,
                        config.firstRow,
                        oldConfig.firstRow - 1
                    )
                );
            }
            if (lastRow > oldLastRow) {
                _this.$lines.push(
                    this.renderLines(config, oldLastRow + 1, lastRow)
                );
            }
            _this.updateLineHighlight();

            _this._signal('afterRender');
            _this.$updateGutterWidth(config);
        };
        this.getText = function (session, row) {
            var text = (session.$firstLineNumber + row).toString();
            return text;
        };
        this.getWidth = function (session, rowText, config) {
            var lastRow = this.layer.$lines.last();
            lastRow = lastRow
                ? lastRow.row
                : this.hostToWidgetRow(config.lastRow);
            var hostLastRow = this.host.$lines.last().row;
            rowText = this.getText(this.layer.session, lastRow);
            var otherRowText = this.getText(this.host.session, hostLastRow);
            return (
                (rowText.length + otherRowText.length + 1) *
                config.characterWidth
            );
        };
    }.call(GutterLineVirus.prototype));

    function AceInlineDiff(options) {
        this.options = {};
        u.extend(true, this.options, AceInlineDiff.defaults, {}, options);

        //////////Hacks To Make It Work With AcediffUtils Methods
        this.options.threeWay = false;
        this.options.alignLines = false;
        this.editor = this.options.editor || ace.edit(this.options.id);
        this.editors = {
            left: this,
            hack: {
                ace: null,
            },
        };
        this.pairs = [this];
        this.left = u.EDITOR_LEFT;
        this.right = 'diffhack';
        this.options.only = this.options;
        this.ace = this.editor;
        ///////////

        this.foldModes = {
            left: new InlineDiffFolding(2, 1),
            //not used by virus unless swapped
            right: new InlineDiffFolding(2, 1),
        };
        if (this.options.left.session) {
            this.editor.setSession(this.options.left.session);
        }
        this.sessions = {
            left: createSession(this, u.EDITOR_LEFT, this.editor.session),
            right: createSession(
                this,
                u.EDITOR_RIGHT,
                this.options.right.session
            ),
        };

        this.current = this.sessions.left;
        this.other = this.sessions.right;
        this.editors.other = {
            ace: {
                session: this.other,
                getSession: function () {
                    return this.session;
                },
            },
            markers: [],
        };

        setupEditor(this, u.EDITOR_LEFT);
        this.markers = [];

        this.$decorate = this.decorate.bind(this);
        this.gutter = new GutterLineVirus(this.editor.renderer);
        this.gutter.setSession(this.other);

        this.renderer = new TextLineVirus(this.editor.renderer);
        this.renderer.setSession(this.other);

        this.addCssClasses();
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
        this.editor.renderer.on(
            'changeCharacterSize',
            this.$changeCharacterSize
        );
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
    (function () {
        this.updateAligns = function (change) {
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
                if (change.action == 'delete' && changed.leftEndLine < endRow) {
                    changed.leftEndLine = startRow;
                } else changed.leftEndLine += delta;
            }
            var len = this.diffs.length;
            var i;
            if (change.action == 'insert') {
                for (i = start; i < len; i++) {
                    this.diffs[i].leftStartLine += delta;
                    this.diffs[i].leftEndLine += delta;
                }
            } else {
                for (i = start; i < len; i++) {
                    var r = this.diffs[i];

                    if (r.leftEndLine < endRow && startRow <= r.leftEndLine) {
                        r.leftEndLine = startRow;
                    } else if (r.leftEndLine >= endRow) {
                        r.leftEndLine += delta;
                    }

                    if (
                        r.leftStartLine < endRow &&
                        startRow <= r.leftStartLine
                    ) {
                        r.leftStartLine = startRow;
                    } else if (r.leftStartLine >= endRow) {
                        r.leftStartLine += delta;
                    }
                }
            }
            var currentClass = this.swapped
                ? this.options.classes.removed
                : this.options.classes.added;
            updateDiffMarkers(
                this,
                this.current,
                this.diffs,
                HOST,
                currentClass
            );
        };
        this.stopUpdate = function () {
            if (this.$diff) {
                this.editor.off('change', this.$diff);
                this.$diff = null;
            }
        };
        this.clickSwap = function (isWidget, row, column) {
            this.swap();
            if (
                isWidget &&
                !u.getOption(this, WIDGET(this.swapped), 'editable') &&
                u.getOption(this, HOST(this.swapped), 'editable')
            )
                this.allowSwap = true;
            this.editor.gotoLine(row + 1, column);
        };
        this.clickCopy = function (isWidget, row, col, origPos) {
            if (isWidget && u.getOption(this, HOST(this.swapped), 'editable')) {
                var widget =
                    origPos.row < 0
                        ? this.current.topLineWidget
                        : this.current.lineWidgets[origPos.row];
                var text = this.other.getLines(widget.start, widget.end - 1);
                this.current
                    .getDocument()
                    .insertFullLines(widget.row + 1, text);
            }
        };
        this.handleDoubleClick = function (e) {
            var linesAbove = this.scrollOffset;
            var pos = this.editor.renderer.pixelToScreenCoordinates(
                e.clientX,
                e.clientY
            );
            var swap = (this.options.onClick == 'swap'
                ? this.clickSwap
                : this.clickCopy
            ).bind(this);
            //clicked topLineWidget
            if (pos.row < 0 && linesAbove > 0) {
                var post = this.other.screenToDocumentPosition(
                    pos.row + linesAbove,
                    pos.column,
                    pos.offsetX
                );
                e.stop();
                return swap(true, post.row, post.column, pos);
            }
            //clicked equal row;
            var position = this.current.screenToDocumentPosition(
                pos.row,
                pos.column,
                pos.offsetX
            );
            if (this.allowSwap) {
                var end = this.gutter.isHostEqualRow(position.row);
                if (end !== false) {
                    e.stop();
                    return swap(false, end, position.column, position);
                }
            }
            //clicked widget
            var widget =
                this.current.lineWidgets &&
                this.current.lineWidgets[position.row];
            if (widget) {
                var screenRow = this.current.documentToScreenRow(
                    position.row,
                    Infinity
                );
                if (pos.row > screenRow) {
                    var otherPos = this.other.screenToDocumentPosition(
                        this.other.documentToScreenRow(widget.start, 0) +
                            (pos.row - screenRow - 1),
                        pos.column,
                        pos.offsetX
                    );
                    e.stop();
                    return swap(true, otherPos.row, otherPos.column, position);
                }
            }
        };
        this.startUpdate = function () {
            if (!this.$diff) {
                this.$diff = u.throttle(this.diff, 1500).bind(this);
                this.editor.on('change', this.$diff);
            }
        };
        this.removeCssClasses = function () {
            if (this.swapped) {
                dom.removeCssClass(
                    this.editor.container,
                    this.options.classes.swapped
                );
                dom.removeCssClass(
                    this.renderer.content,
                    this.options.classes.contentAdded
                );
                dom.removeCssClass(
                    this.gutter.layer.element,
                    this.options.classes.gutterAdded
                );
                dom.removeCssClass(
                    this.editor.renderer.$gutterLayer.element,
                    this.options.classes.gutterRemoved
                );
                dom.removeCssClass(
                    this.editor.renderer.content,
                    this.options.classes.contentRemoved
                );
            } else {
                dom.removeCssClass(
                    this.renderer.content,
                    this.options.classes.contentRemoved
                );
                dom.removeCssClass(
                    this.gutter.layer.element,
                    this.options.classes.gutterRemoved
                );
                dom.removeCssClass(
                    this.editor.renderer.$gutterLayer.element,
                    this.options.classes.gutterAdded
                );
                dom.removeCssClass(
                    this.editor.renderer.content,
                    this.options.classes.contentAdded
                );
            }
        };
        this.addCssClasses = function () {
            if (this.swapped) {
                dom.addCssClass(
                    this.editor.container,
                    this.options.classes.swapped
                );
                dom.addCssClass(
                    this.editor.renderer.$gutterLayer.element,
                    this.options.classes.gutterRemoved
                );
                dom.addCssClass(
                    this.gutter.layer.element,
                    this.options.classes.gutterAdded
                );
                dom.addCssClass(
                    this.renderer.content,
                    this.options.classes.contentAdded
                );
                dom.addCssClass(
                    this.editor.renderer.content,
                    this.options.classes.contentRemoved
                );
            } else {
                dom.addCssClass(
                    this.editor.renderer.$gutterLayer.element,
                    this.options.classes.gutterAdded
                );
                dom.addCssClass(
                    this.editor.renderer.content,
                    this.options.classes.contentAdded
                );
                dom.addCssClass(
                    this.gutter.layer.element,
                    this.options.classes.gutterRemoved
                );
                dom.addCssClass(
                    this.renderer.content,
                    this.options.classes.contentRemoved
                );
            }
        };
        this.setSession = function (session, isRight, isSwap) {
            isRight = !!isRight;
            isSwap = !!isSwap;
            var side = isRight ? u.EDITOR_RIGHT : u.EDITOR_LEFT;
            var oldSession = this.sessions[side];
            if (oldSession == session) return;
            if (side == WIDGET(this.swapped)) {
                oldSession && oldSession.off('changeWrapLimit', this.$decorate);
                this.other = session;
                this.renderer.setSession(this.other);
                this.gutter.setSession(this.other);
                this.editors.other.ace.session = this.other;
            } else {
                this.session = this.current = session;
                if (oldSession) this.renderer.detach(true);
                this.editor.setSession(this.current);
                this.editor.setReadOnly(
                    !u.getOption(
                        this,
                        isSwap == this.swapped ? u.EDITOR_LEFT : u.EDITOR_RIGHT,
                        'editable'
                    )
                );
                if (session) this.renderer.attach(true);
            }
            if (isSwap)
                //keep notion of left and right
                return;
            var foldMode = this.foldModes[side];
            this.sessions[side] = session;
            this.options[side].session = session;
            if (oldSession) {
                revert(oldSession, '$setFolding', oldSession);
                oldSession.$setFolding(foldMode.sub);
            }
            if (session) {
                foldMode.setFolding(session.$foldMode);
                session.$setFolding(foldMode);
                override(
                    session,
                    '$setFolding',
                    session,
                    foldMode.setFolding.bind(foldMode)
                );
                if (this.sessions.left && this.sessions.right) this.diff(true);
            }
        };
        this.diff = function (clean) {
            var count = 0;
            var ses1 = this.sessions.left;
            var ses2 = this.sessions.right;
            var text1 = ses1.getValue();
            var text2 = ses2.getValue();
            //reset clean based on size
            this.$reset(
                clean === true
                    ? 0
                    : text1.length + text2.length < 100000
                    ? 5
                    : text1.length + text2.length > 1000000
                    ? 50
                    : 25
            );
            this.diffs = u.getDiffs(
                text1,
                text2,
                this.options,
                this,
                ses1.getLength() + ses2.getLength() < 30000
            );
            count = this.diffs.length;
            if (count > this.options.maxDiffs) return this.clear();
            this.decorate();
        };
        this.$reset = (function () {
            var i = 0;
            return function (min) {
                if (++i > min) {
                    i = 0;
                    this.savedDiffs = null;
                }
            };
        })();
        this.swap = function () {
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
        };
        this.decorate = function () {
            var diffs = this.diffs;
            this.foldModes.left.diffs = this.foldModes.right.diffs = this.gutter.diffs = this.renderer.diffs = this.diffs;
            this.clear();
            var putFragmentsAbove =
                this.swapped == this.options.removedFragmentsBelow;
            var currentClass = this.swapped
                ? this.options.classes.removed
                : this.options.classes.added;
            var otherClass = this.swapped
                ? this.options.classes.added
                : this.options.classes.removed;

            diffs.forEach(function (item) {
                if (item.rightEndLine > item.rightStartLine)
                    addLineWidget(
                        this,
                        this.current,
                        putFragmentsAbove
                            ? item.leftStartLine
                            : item.leftEndLine,
                        item.rightStartLine,
                        item.rightEndLine,
                        this.other
                    );
                if (item.leftEndLine > item.leftStartLine) {
                    this.markers.push(
                        this.current.addMarker(
                            new Range(
                                item.leftStartLine,
                                0,
                                item.leftEndLine - 1,
                                Infinity
                            ),
                            currentClass,
                            'fullLine'
                        )
                    );
                }
                if (item.rightEndLine > item.rightStartLine) {
                    this.editors.other.markers.push(
                        this.other.addMarker(
                            new Range(
                                item.rightStartLine,
                                0,
                                item.rightEndLine - 1,
                                Infinity
                            ),
                            otherClass,
                            'fullLine'
                        )
                    );
                }
            }, this);
            if (!this.scrollOffset && this.scrollMargin.top) {
                this.scrollMargin.top = 0;
                this.editor.renderer.updateScrollMargins();
            }
            if (this.rawDiffs) {
                u.showInlineDiffs(this, u.EDITOR_LEFT, 'other', this.rawDiffs);
            }
        };
        this.goNextDiff = function (editor) {
            return u.goNearbyDiff(this, editor, 1);
        };
        this.goPrevDiff = function (editor) {
            return u.goNearbyDiff(this, editor, -1);
        };
        this.clear = function () {
            clearLineWidgets(this);
            this.editors.other.markers.forEach(function (marker) {
                this.other.removeMarker(marker);
            }, this);
            this.markers.forEach(function (marker) {
                this.current.removeMarker(marker);
            }, this);
            this.markers = [];
            this.editors.other.markers = [];
        };
        this.changeCharacterSize = function () {
            if (this.scrollOffset) {
                this.scrollMargin.top =
                    this.scrollOffset * (this.ace.renderer.lineHeight || 14);
                this.ace.renderer.updateScrollMargins();
            }
        };
        this.resize = function (force) {
            this.editor.resize(force);
            this.changeCharacterSize();
        };
        this.destroy = function () {
            //Work in progress
            this.removeCssClasses();
            this.stopUpdate();
            this.editor.renderer.removeScrollMargin(this.scrollMargin);
            this.editor.off('change', this.$update);
            this.editor.off('dblclick', this.$handleDoubleClick);
            this.editor.renderer.off(
                'changeCharacterSize',
                this.$changeCharacterSize
            );
            this.other.off('changeWrapLimit', this.$decorate);

            revert(this.sessions.left, '$setFolding', this.sessions.left);
            revert(this.sessions.right, '$setFolding', this.sessions.right);
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
        };
    }.call(AceInlineDiff.prototype));
    AceInlineDiff.diff = function (editor, value_or_session, value_or_options) {
        var isSession;
        value_or_session = value_or_session || '';
        var options;
        if (typeof value_or_session !== 'string') {
            isSession = true;
        }
        if (typeof value_or_options == 'string') {
            if (isSession) editor.setSession(value_or_session);
            else editor.setValue(value_or_session);
            options = {
                right: {
                    content: value_or_options,
                },
            };
        } else options = value_or_options;
        options = u.extend(
            true,
            {
                editor: editor,
                mode: editor.getOption('mode'),
                right: {
                    editable: isSession,
                    session: isSession ? value_or_session : undefined,
                    content: isSession ? undefined : value_or_session,
                },
            },
            options
        );
        return new AceInlineDiff(options);
    };
    AceInlineDiff.defaults = {
        mode: undefined,
        theme: null,
        diffGranularity: u.DIFF_GRANULARITY_BROAD,
        removedFragmentsBelow: false,
        ignoreWhitespace: 'auto',
        maxDiffs: 5000,
        editable: true,
        autoupdate: true,
        alignLines: false,
        showInlineDiffs: false,
        editor: undefined,
        id: 'diff-editor',
        left: {},
        right: {
            session: undefined,
            content: null,
            editable: true,
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