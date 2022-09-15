(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['exports', './ace-diff-utils'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(require(), require('./ace-diff-utils'));
    } else {
        root.AceDiff = factory(root, root.AceDiffUtils);
    }
})(this, function (root, u) {
    'use strict';
    var LineWidgets = ace.require('ace/line_widgets').LineWidgets;
    
    
    function HOST(invert, type) {
        return (invert ? u.EDITOR_RIGHT : u.EDITOR_LEFT) + (type || '');
    }

    function ABOVE(line) {
        return -line - 2;
    }
    
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

    // our constructor
    //Technically most methods can handle more than 3 diffs
    //except for the options parsing and splitDiffs
    function AceDiff(options) {
        this.options = {};
        u.extend(
            true,
            this.options,
            AceDiff.defaults,
            {
                left: {
                    id: null,
                    content: null,
                    editable: true,
                },
                right: {
                    id: null,
                    content: null,
                },
                activePane: u.EDITOR_LEFT,
                showConnectors: !(options && options.lockScrolling),
                showCopyArrows: window.innerWidth > 700,
            },
            options
        );
        if (this.options.center) {
            options = {};
            u.extend(
                true,
                options,
                {
                    center: {
                        id: null,
                        content: null,
                    },
                    classes: {
                        gutterLeftID: this.options.classes.gutterID + '-left',
                        gutterRightID: this.options.classes.gutterID + '-right',
                    },
                },
                this.options
            );
            this.options = options;
        }
        // instantiate the editors in an internal data structure that will store a little info about the diffs and
        // editor content

        this.editors = {
            left: {
                ace: this.options.left.editor || ace.edit(this.options.left.id),
                markers: [],
                lineLengths: [],
            },
            right: {
                ace:
                    this.options.right.editor ||
                    ace.edit(this.options.right.id),
                markers: [],
                lineLengths: [],
            },
        };

        setupEditor(this, u.EDITOR_RIGHT);
        setupEditor(this, u.EDITOR_LEFT);
        // this.lineHeight = this.editors.left.ace.renderer.lineHeight ||
        //     14; // assumption: both editors have same line heights
        this.pairs = [];
        addEventHandlers(this, u.EDITOR_LEFT);
        addEventHandlers(this, u.EDITOR_RIGHT);
        if (this.options.center) {
            this.editors[u.EDITOR_CENTER] = {
                ace:
                    this.options.center.editor ||
                    ace.edit(this.options.center.id),
                markers: [],
                lineLengths: [],
            };
            this.pairs.push({
                left: u.EDITOR_LEFT,
                right: u.EDITOR_CENTER,
                gutterID: this.options.classes.gutterLeftID,
            });
            this.pairs.push({
                left: u.EDITOR_CENTER,
                right: u.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterRightID,
            });
            setupEditor(this, u.EDITOR_CENTER);
            addEventHandlers(this, u.EDITOR_CENTER);
        } else {
            this.pairs.push({
                left: u.EDITOR_LEFT,
                right: u.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterID,
            });
        }
        this.activePane = this.options.activePane;
        this.editors[this.activePane].ace.focus();
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

        //decorate after all the editors have rendered at least once
        var count = 0,
            total = 0;
        var init = function () {
            if (++count < total) return;
            this.decorate();
        }.bind(this);
        for (var i in this.editors) {
            this.editors[i].ace.renderer.once('afterRender', init);
            total++;
        }

        this.diff();
        this.goNextDiff(this.editors[this.options.activePane].ace);
    }

    // our public API
    AceDiff.prototype = {
        getNumDiffs: function () {
            return this.diffs.length;
        },

        // exposes the Ace editors
        getEditors: function () {
            return {
                left: this.editors.left.ace,
                center: this.editors.right.ace,
                right: this.editors.right.ace,
            };
        },
        goNextDiff: function (editor) {
            return u.goNearbyDiff(this, editor, 1);
        },
        goPrevDiff: function (editor) {
            return u.goNearbyDiff(this, editor, -1);
        },

        diff: function (clean) {
            var count = 0;
            for (var i in this.pairs) {
                var pair = this.pairs[i];
                var ses1 = this.editors[pair.left].ace.getSession();
                var ses2 = this.editors[pair.right].ace.getSession();
                var text1 = ses1.getValue();
                var text2 = ses2.getValue();
                //reset clean based on size
                this.$reset(
                    pair,
                    clean === true
                        ? 0
                        : text1.length + text2.length < 100000
                        ? 5
                        : text1.length + text2.length > 1000000
                        ? 50
                        : 25
                );
                if (clean) pair.savedDiffs = null;
                pair.diffs = u.getDiffs(
                    text1,
                    text2,
                    this.options,
                    pair,
                    ses1.getLength() + ses2.getLength() < 30000
                );
                count += pair.diffs.length;
            }
            if (count > this.options.maxDiffs) return;
            if (this.pairs.length > 1) {
                splitDiffs(this.pairs[0].diffs, this.pairs[1].diffs);
            }
            decorating = false;
            this.decorate();
        },
        $reset: function (pair, min) {
            pair.$i = pair.$i || 0;
            if (++pair.$i > min) {
                pair.$i = 0;
                pair.savedDiffs = null;
            }
        },
        decorate: function () {
            var acediff = this;
            if (decorating) return;
            decorating = true;
            clearDiffMarkers(acediff);
            if (acediff.options.alignLines) {
                alignEditors(acediff, acediff.pairs[0], acediff.pairs[1]);
            }
            if (acediff.pairs.length == 1) {
                var pair = acediff.pairs[0];
                if (acediff.options.showDiffs) {
                    acediff.pairs[0].diffs.forEach(function (info) {
                        addDiffMarker(
                            acediff,
                            u.EDITOR_RIGHT,
                            info.rightStartLine,
                            info.rightEndLine,
                            acediff.options.classes.added
                        );
                        addDiffMarker(
                            acediff,
                            u.EDITOR_LEFT,
                            info.leftStartLine,
                            info.leftEndLine,
                            acediff.options.classes.removed
                        );
                    });
                }
                if (pair.rawDiffs)
                    u.showInlineDiffs(
                        acediff,
                        pair.left,
                        pair.right,
                        pair.rawDiffs
                    );
            } else {
                if (acediff.options.showDiffs) {
                    highlight3(acediff, acediff.pairs[0]);
                    highlight3(acediff, acediff.pairs[1]);
                }
            }
            this.updateGutter(true);
            decorating = false;
        },
        updateGutter: function (updateCopyArrows) {
            var acediff = this;
            if (!this.options.showCopyArrows) {
                updateCopyArrows = false;
            }
            var updateConnectors = this.options.showConnectors;
            if (!(updateConnectors || updateCopyArrows)) return;

            if (updateCopyArrows) {
                clearArrows(acediff);
            }
            if (updateConnectors) clearSvgContainer(acediff);

            acediff.pairs.forEach(function (pair) {
                pair.diffs.forEach(function (info, diffIndex) {
                    if (updateCopyArrows) {
                        addCopyArrows(acediff, info, diffIndex, pair);
                    }
                    if (updateConnectors) {
                        var left = pair.left;
                        var right = pair.right;
                        var leftScrollTop = acediff.editors[left].ace
                            .getSession()
                            .getScrollTop();
                        var rightScrollTop = acediff.editors[right].ace
                            .getSession()
                            .getScrollTop();
                        var side = u.EDITOR_LEFT;
                        if (pair.left == u.EDITOR_CENTER) {
                            side = u.EDITOR_RIGHT;
                        }
                        addConnector(
                            acediff,
                            pair,
                            info.leftStartLine,
                            info.leftEndLine,
                            info.rightStartLine,
                            info.rightEndLine,
                            leftScrollTop,
                            rightScrollTop,
                            acediff.options.classes[side + 'Diff']
                        );
                    }
                });
            });
            if (this.options.showCopyArrows) {
                positionCopyContainers(acediff);
            }
        },

        destroy: function () {
            window.removeEventListener('resize', this.$onResize);
            removeEventHandlers(this);
            clearDiffMarkers(this);
            if (this.options.showCopyArrows) {
                clearArrows(this);
                this.pairs.forEach(function (pair) {
                    var gutter = document.getElementById(pair.gutterID);
                    gutter.removeEventListener('click', pair.$gutterClickLeft);
                    gutter.removeEventListener('click', pair.$gutterClickRight);
                });
            }
            for (var i in this.editors) {
                if (!this.options[i].editor) {
                    this.editors[i].ace.destroy();
                }
            }
            if (this.options.showConnectors) {
                this.pairs.forEach(function (pair) {
                    document
                        .getElementById(pair.gutterID)
                        .removeChild(pair.svg);
                });
            }
        },
    };

    function setupEditor(acediff, side) {
        var ace = acediff.editors[side].ace;
        var commands = {
            nextDiff: {
                name: 'nextDiff',
                exec: function (editor) {
                    acediff.goNextDiff(editor);
                },
                bindKey: 'Ctrl-N',
            },
            prevDiff: {
                name: 'prevDiff',
                exec: function (editor) {
                    acediff.goPrevDiff(editor);
                },
                bindKey: 'Ctrl-P',
            },
        };
        var options = u.getOption(acediff, side, 'options');
        if (options) {
            ace.setOptions(options);
        }
        var mode = u.getOption(acediff, side, 'mode');
        if (mode) {
            ace.getSession().setMode(mode);
        }
        var editable = u.getOption(acediff, side, 'editable');
        if (editable != null) {
            ace.setReadOnly(!editable);
        }
        var theme = u.getOption(acediff, side, 'theme');
        if (theme) {
            ace.setTheme(theme);
        }
        // if the data is being supplied by an option, set the editor values now
        var content = acediff.options[side].content;
        if (content) {
            ace.setValue(acediff.options[side].content, -1);
        }
        acediff.editors[side].$acediff3Commands = commands;
        for (var i in commands) ace.commands.addCommand(commands[i]);
    }
    /*
     @param side - left|right|center The editor whose scroll changed
     @param lastScrollT - used to keep track of which editors have been auto scrolled 
                    recently to prevent them from later scrolling other editors
     @param isAutoScroll - shows that the scroll is as a result of another editor scrolling
    */
    function syncScrolling(acediff, side, lastScrollT, isAutoScroll) {
        //this can end up in an endless loop
        if (isAutoScroll && !lastScrollT)
            throw new Error('ValueError: missing lastScrollT parameter');
        if (!isAutoScroll) {
            lastScrollT =
                new Date().getTime() -
                (acediff.options.alignLines ? 100 : 1000);
            //scroll cooldown
            if (lastScrollT - acediff.editors[side].lastScrollT < 0) {
                if (side === acediff.activePane) {
                    return acediff.synchronize(acediff, side);
                }
            }
        }
        acediff.scrollSyncing = true;
        try {
            acediff.editors[side].lastScrollT = lastScrollT;
            for (var i in acediff.pairs) {
                var pair = acediff.pairs[i];
                var other =
                    pair.left == side
                        ? pair.right
                        : pair.right == side
                        ? pair.left
                        : null;
                if (!other) continue;
                var editor = acediff.editors[other];
                if (editor.lastScrollT == lastScrollT) continue;
                var result = syncPair(acediff, pair, side == pair.left);
                if (result) syncScrolling(acediff, other, lastScrollT, true);
            }
        } catch (e) {
            console.error(e);
        }
        acediff.scrollSyncing = !!isAutoScroll;
        if (!acediff.scrollSyncing) {
            acediff.editors[side].lastScrollT = 0;
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
            scroll =
                getScrollingInfo(acediff, side) -
                editor.scrollOffset * editor.ace.renderer.lineHeight;
            var top = getScrollingInfo(acediff, other);
            var offset =
                otherEditor.scrollOffset * editor.ace.renderer.lineHeight;
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
            var offOther = getOffsets(
                otherEditor,
                isLeft ? around.orig : around.edit
            );
            var ratio = (midY - off.top) / (off.bot - off.top);
            targetPos =
                offOther.top -
                halfScreen +
                ratio * (offOther.bot - offOther.top);
            var botDist, mix;
            // Some careful tweaking to make sure no space is left out of view
            // when scrolling to top or bottom.
            halfScreen = Math.min(
                config.maxHeight - size.scrollerHeight,
                halfScreen
            );
            if (targetPos > scroll && (mix = scroll / halfScreen) < 1) {
                targetPos = targetPos * mix + scroll * (1 - mix);
            } else if (
                (botDist = config.maxHeight - size.scrollerHeight - scroll) <
                halfScreen
            ) {
                //var otherInfo = getScrollingInfo(acediff, other);
                var otherConfig = otherEditor.ace.renderer.layerConfig;
                var otherSize = otherEditor.ace.renderer.$size;

                var botDistOther =
                    otherConfig.maxHeight -
                    otherSize.scrollerHeight -
                    targetPos;
                if (botDistOther > botDist && (mix = botDist / halfScreen) < 1)
                    targetPos =
                        targetPos * mix +
                        (otherConfig.maxHeight -
                            otherSize.scrollerHeight -
                            botDist) *
                            (1 - mix);
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
            var fromLocal = nInEdit
                ? chunk.leftStartLine
                : chunk.rightStartLine;
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
        return {
            edit: {
                before: beforeE,
                after: afterE,
            },
            orig: {
                before: beforeO,
                after: afterO,
            },
        };
    }

    function getOffsets(editor, around) {
        var bot = around.after;
        if (bot == null) bot = editor.ace.getSession().getLength();
        return {
            top: getRowPosition(editor, around.before || 0, false),
            bot: getRowPosition(editor, bot, false),
        };
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
        var synchronize = u.throttle(syncScrolling, 70);
        acediff.synchronize = synchronize;
        addEvent(acediff.editors[side].ace, 'mousedown', function () {
            acediff.activePane = side;
        });
        if (acediff.options.alignLines) {
            addEvent(
                acediff.editors[side].ace.getSession(),
                'changeFold',
                function (ev) {
                    alignEditors(acediff, acediff.pairs[0], acediff.pairs[1]);
                }
            );
        }

        addEvent(
            acediff.editors[side].ace.renderer,
            'changeCharacterSize',
            debounce(function (e) {
                var editor = acediff.editors[side].ace;
                var fontSettings = {
                    fontFamily: editor.renderer.$fontFamily,
                    fontSize: editor.renderer.$fontSize,
                    lineSpacing: editor.renderer.$lineSpacing,
                };
                for (var i in acediff.editors) {
                    if (i != side) {
                        acediff.editors[i].ace.renderer.setOptions(
                            fontSettings
                        );
                    }
                }
            }, 700)
        );
        addEvent(
            acediff.editors[side].ace.getSession(),
            'changeScrollTop',
            function (scroll) {
                if (acediff.options.lockScrolling && !acediff.scrollSyncing) {
                    synchronize(acediff, side);
                }
                acediff.editors[side].ace.renderer.once(
                    'afterRender',
                    function () {
                        acediff.updateGutter(false);
                    }
                );
            }
        );
        if (acediff.options.showConnectors || acediff.options.showCopyArrows) {
            addEvent(
                acediff.editors[side].ace.getSession(),
                'changeFold',
                function (scroll) {
                    acediff.updateGutter(true);
                }
            );
        }
        var diff = u.throttle(acediff.diff, 500).bind(acediff);
        addEvent(acediff.editors[side].ace, 'change', diff);
    }

    function addGutterEventHandlers(acediff) {
        acediff.pairs.forEach(function (pair) {
            var gutterID = pair.gutterID;
            if (acediff.options[pair.left].copyLinkEnabled) {
                pair.$gutterClickLeft = delegate(
                    gutterID,
                    'click',
                    '.' + acediff.options.classes.newCodeConnectorLink,
                    function (e) {
                        copy(acediff, e, pair, u.LTR);
                    }
                );
            }
            if (acediff.options[pair.right].copyLinkEnabled) {
                pair.$gutterClickRight = delegate(
                    gutterID,
                    'click',
                    '.' + acediff.options.classes.deletedCodeConnectorLink,
                    function (e) {
                        copy(acediff, e, pair, u.RTL);
                    }
                );
            }
        });
    }

    function addWindowResizeHandler(acediff) {
        var onResize = debounce(function () {
            acediff.availableHeight = getEditorHeight(acediff);
            acediff.updateGutter(true);
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
        if (dir == u.LTR) {
            sourceEditor = acediff.editors[left];
            targetEditor = acediff.editors[right];
            startLine = diff.leftStartLine;
            endLine = diff.leftEndLine;
            targetStartLine = diff.rightStartLine;
            targetEndLine = diff.rightEndLine;
        } else if (dir == u.RTL) {
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
            contentToInsert = contentToInsert.substring(
                0,
                contentToInsert.length - 1
            );
        }

        //endContent = endContent.replace(/\s*$/, '');

        // keep track of the scroll height
        var h = targetEditor.ace.getSession().getScrollTop();
        targetEditor.ace
            .getSession()
            .setValue(startContent + contentToInsert + endContent);
        targetEditor.ace.getSession().setScrollTop(parseInt(h));

        acediff.diff();
    }

    function removeMarker(editor, marker) {
        editor.ace.getSession().removeMarker(marker);
    }

    function clearDiffMarkers(acediff) {
        for (var i in acediff.editors) {
            var clear = removeMarker.bind(null, acediff.editors[i]);
            acediff.editors[i].markers.forEach(clear);
        }
    }

    function clearLineWidgets(editor) {
        editor.scrollOffset = 0;
        editor.ace.renderer.setScrollMargin(0);
        if (!editor.lineWidgets) return;

        for (var i in editor.lineWidgets) {
            editor.ace.session.widgetManager.removeLineWidget(
                editor.lineWidgets[i]
            );
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
            class: info.className,
            style: 'top:' + info.topOffset + 'px',
            title: info.tooltip,
            'data-diff-index': info.diffIndex,
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
            var height = Math.max(
                leftHeight,
                rightHeight,
                acediff.gutterHeight
            );

            pair.svg = document.createElementNS(u.SVG_NS, 'svg');
            pair.svg.setAttribute('width', acediff.gutterWidth);
            pair.svg.setAttribute('height', height);

            gutter.appendChild(pair.svg);
            if (
                (' ' + gutter.className + ' ').indexOf(
                    acediff.options.classes.gutterClass
                ) < 0
            ) {
                gutter.className += ' ' + acediff.options.classes.gutterClass;
            }
        }
    }
    // shows a diff in one of the two editors.
    function addDiffMarker(acediff, side, startLine, endLine, className) {
        var editor = acediff.editors[side];
        if (endLine < startLine) {
            // can this occur? Just in case.
            endLine = startLine;
        }

        var classNames =
            className + ' ' + (endLine > startLine ? 'lines' : 'targetOnly');
        endLine--; // because endLine is always + 1
        if (acediff.options.alignLines && endLine < startLine) {
            endLine++;
        }
        // to get Ace to highlight the full row we just set the start and end chars to 0 and 1
        editor.markers.push(
            editor.ace.session.addMarker(
                new Range(startLine, 0, endLine, 1),
                classNames,
                'fullLine'
            )
        );
    }

    function addConnector(
        acediff,
        pair,
        leftStartLine,
        leftEndLine,
        rightStartLine,
        rightEndLine,
        leftScrollTop,
        rightScrollTop,
        className
    ) {
        // All connectors, regardless of ltr or rtl have the same point system, even if p1 === p3 or p2 === p4
        //  p1   p2
        //
        //  p3   p4
        className = acediff.options.classes.connector + ' ' + className;
        acediff.connectorYOffset = 1;
        var editorLeft = acediff.editors[pair.left];
        var editorRight = acediff.editors[pair.right];
        var p1_x = -1;
        var p1_y = getRowPosition(editorLeft, leftStartLine) + 0.5;
        var p2_x = acediff.gutterWidth + 1;
        var p2_y = getRowPosition(editorRight, rightStartLine) + 0.5;
        var p3_x = -1;
        var p3_y =
            getRowPosition(editorLeft, leftEndLine) +
            acediff.connectorYOffset +
            0.5;
        var p4_x = acediff.gutterWidth + 1;
        var p4_y =
            getRowPosition(editorRight, rightEndLine) +
            acediff.connectorYOffset +
            0.5;
        var curve1 = getCurve(p1_x, p1_y, p2_x, p2_y);
        var curve2 = getCurve(p4_x, p4_y, p3_x, p3_y);

        var verticalLine1 = 'L' + p2_x + ',' + p2_y + ' ' + p4_x + ',' + p4_y;
        var verticalLine2 = 'L' + p3_x + ',' + p3_y + ' ' + p1_x + ',' + p1_y;
        var d =
            curve1 + ' ' + verticalLine1 + ' ' + curve2 + ' ' + verticalLine2;

        var el = document.createElementNS(u.SVG_NS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('class', className);
        pair.svg.appendChild(el);
    }

    function addCopyArrows(acediff, info, diffIndex, pair) {
        var arrow;
        if (
            info.leftEndLine > info.leftStartLine &&
            acediff.options.left.copyLinkEnabled
        ) {
            arrow = createArrow({
                className: acediff.options.classes.newCodeConnectorLink,
                topOffset: getRowPosition(
                    acediff.editors[pair.left],
                    info.leftStartLine,
                    false
                ),
                tooltip: 'Copy to right',
                diffIndex: diffIndex,
                arrowContent:
                    acediff.options.classes.newCodeConnectorLinkContent,
            });
            pair.rightDiv.appendChild(arrow);
        }

        if (
            info.rightEndLine > info.rightStartLine &&
            acediff.options.right.copyLinkEnabled
        ) {
            arrow = createArrow({
                className: acediff.options.classes.deletedCodeConnectorLink,
                topOffset: getRowPosition(
                    acediff.editors[pair.right],
                    info.rightStartLine,
                    false
                ),
                tooltip: 'Copy to left',
                diffIndex: diffIndex,
                arrowContent:
                    acediff.options.classes.deletedCodeConnectorLinkContent,
            });
            pair.leftDiv.appendChild(arrow);
        }
    }

    function positionCopyContainers(acediff) {
        function setStyle(pair, leftTopOffset, rightTopOffset) {
            pair.leftDiv.style.cssText = 'top: ' + -rightTopOffset + 'px';
            pair.rightDiv.style.cssText = 'top: ' + -leftTopOffset + 'px';
        }
        acediff.pairs.forEach(function (pair) {
            var leftTopOffset = acediff.editors[pair.left].ace
                .getSession()
                .getScrollTop(); //+acediff.editors.left.scrollOffset*acediff.lineHeight;
            var rightTopOffset = acediff.editors[pair.right].ace
                .getSession()
                .getScrollTop(); //+acediff.editors.right.scrollOffset*acediff.lineHeight;
            setStyle(pair, leftTopOffset, rightTopOffset);
        });
    }
    // creates two contains for positioning the copy left + copy right arrows
    function createCopyContainers(acediff) {
        acediff.pairs.forEach(function (cont) {
            cont.leftDiv = document.createElement('div');
            cont.rightDiv = document.createElement('div');
            cont.leftDiv.setAttribute(
                'class',
                acediff.options.classes.copyLeftContainer
            );
            cont.rightDiv.setAttribute(
                'class',
                acediff.options.classes.copyRightContainer
            );

            document.getElementById(cont.gutterID).appendChild(cont.rightDiv);
            document.getElementById(cont.gutterID).appendChild(cont.leftDiv);
        });
    }

    function addLineWidget(editor, line, no) {
        if (!editor.lineWidgets) {
            editor.lineWidgets = []; //editor.ace.session.widgetManager
        }
        if (!editor.ace.session.widgetManager) {
            editor.ace.session.widgetManager = new LineWidgets(
                editor.ace.session
            );
            editor.ace.session.widgetManager.attach(editor.ace);
        }
        if (!no) return;
        if (!line) {
            editor.scrollOffset += no;
            decorating = true;
            //setting scroll margin triggers decorate
            editor.ace.renderer.setScrollMargin(
                editor.scrollOffset * editor.ace.renderer.lineHeight
            );
            decorating = false;
            return;
        }
        var w = {
            row: line - 1,
            rowCount: no,
            fixedWidth: false,
            coverGutter: false,
            type: 'diff',
        };
        editor.lineWidgets.push(w);
        editor.ace.session.widgetManager.addLineWidget(w);
    }

    var decorating;

    function highlight3(acediff, pair) {
        //the editted pane and origin pane
        var other,
            center,
            //relative position of origin
            centerPosition,
            conflict = acediff.options.classes.conflict,
            class_ = acediff.options.classes.removed,
            otherClass = acediff.options.classes.added;
        if (pair.right == u.EDITOR_CENTER) {
            center = pair.right;
            other = pair.left;
            centerPosition = u.EDITOR_RIGHT;
            class_ += ' ' + acediff.options.classes.fromLeft;
        } else {
            other = pair.right;
            center = pair.left;
            centerPosition = u.EDITOR_LEFT;
            class_ += ' ' + acediff.options.classes.fromRight;
        }
        var centerStartLine = centerPosition + 'StartLine';
        var centerEndLine = centerPosition + 'EndLine';
        var otherStartLine = other + 'StartLine';
        var otherEndLine = other + 'EndLine';
        pair.diffs.forEach(function (lineDiff) {
            var stops = lineDiff.stops;
            var start = lineDiff[centerStartLine];
            //highlight conflict blocks in center
            for (var i in stops) {
                if (stops[i][1] > start) {
                    addDiffMarker(
                        acediff,
                        center,
                        start,
                        stops[i][1],
                        stops[i][0] ? conflict : class_
                    );
                }
                start = stops[i][1];
            }
            if (lineDiff[centerEndLine] > start)
                addDiffMarker(
                    acediff,
                    center,
                    start,
                    lineDiff[centerEndLine],
                    class_
                );
            addDiffMarker(
                acediff,
                other,
                lineDiff[otherStartLine],
                lineDiff[otherEndLine],
                otherClass
            );
        });
        if (pair.rawDiffs) {
            u.showInlineDiffs(acediff, pair.left, pair.right, pair.rawDiffs);
        }
    }

    //Get the conflict zones
    //in a diff
    function splitDiffs(diff1, diff2) {
        var index1 = 0;
        var index2 = 0;
        var start1, start2, end1, end2;
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
            temp = start2;
            start2 = start1;
            start1 = temp;
            swapped = !swapped;
        }
        //starts represent the positions of line diffs
        //diff1 is the diff that comes earlier in the center ie origin document
        while (index1 < diff1.length && index2 < diff2.length) {
            if (swapped) {
                start2 = diff2[index2].rightStartLine;
                start1 = diff1[index1].leftStartLine;
                end2 = diff2[index2].rightEndLine;
                end1 = diff1[index1].leftEndLine;
            } else {
                start1 = diff1[index1].rightStartLine;
                start2 = diff2[index2].leftStartLine;
                end1 = diff1[index1].rightEndLine;
                end2 = diff2[index2].leftEndLine;
            }
            //if diff1 is still above diff2
            if (start1 <= start2) {
                //if completely above, move to the next diff
                if (end1 <= start2) {
                    index1++;
                    continue;
                }
                //A stop is used for markers
                //given      |start [true, s1] [false s2] end
                //represents |   conflict   |  noconflict   |
                diff1[index1].stops || (diff1[index1].stops = []);
                diff2[index2].stops || (diff2[index2].stops = []);
                //Conflict is not dependent on whether chunks match
                //each other just on whether diffs overlap
                if (end1 <= end2) {
                    diff1[index1].stops.push([false, start2]);
                    diff1[index1++].stops.push([true, end1]);
                    diff2[index2].stops.push([true, end1]);
                    swap();
                } else {
                    diff1[index1].stops.push([false, start2]);
                    diff1[index1].stops.push([true, end2]);
                    diff2[index2++].stops.push([true, end2]);
                }
            } else {
                swap();
            }
        }
        //if (swapped) swap();
    }

    function alignEditors(acediff, pairL, pairR, changes) {
        if (acediff.isAligning == pairL) return;
        acediff.isAligning = pairL;
        var equal = {};
        //map of lines aligned between left and center
        //In the end we have something like,
        // row: [left?,right?]

        //move from left to right
        var editors = [
            acediff.editors[pairL.left],
            acediff.editors[pairL.right],
        ];
        pairL.diffs.forEach(function (e) {
            equal[e.rightEndLine] = [e.leftEndLine, e.rightEndLine];
        });
        if (pairR) {
            editors.push(acediff.editors[pairR.right]);
            pairR.diffs.forEach(function (e) {
                if (equal[e.leftEndLine]) {
                    equal[e.leftEndLine].push(e.rightEndLine);
                } else equal[e.leftEndLine] = [null, e.leftEndLine, e.rightEndLine];
                //to add more to the right, we'd then add a new equal object
                //and make this array a value inside, but why
            });
        }
        var start = 0;
        if (changes) {
            start = Infinity;
            var row;
            for (var i in changes) {
                if (i == pairL.right) {
                    row = changes[i];
                } else {
                    var pair = i == pairL.left ? pairL : pairR;
                    var index = binarySearch(
                        pair.diffs,
                        changes[i],
                        HOST,
                        i == pairL.right
                    );
                    if (index < 0) index = ABOVE(index);
                    row =
                        index < 0
                            ? 0
                            : pair.diffs[index][
                                  HOST(i !== pairL.right, 'StartLine')
                              ];
                }
                if (row < start) start = row;
            }
            //incomplete
        } else {
            for (var k in acediff.editors) {
                clearLineWidgets(acediff.editors[k]);
            }
        }
        if (equal[0])
            equal[0] = editors.map(function (e, i) {
                return equal[0][i] || 0;
            });
        var endOfLines = editors.map(function (el) {
            return el.ace.session.getLength();
        });
        var len = endOfLines[1];
        equal[len] = endOfLines;
        for (var j = start; j <= len; j++) {
            var rows = equal[j];
            if (rows) {
                alignLines(rows, editors);
            }
        }
        if (acediff.isAligning == pairL) acediff.isAligning = null;
    }

    function alignLines(rows, panes) {
        var max = 0;
        var offsets = {};
        panes.forEach(function (e, i) {
            if (rows[i] != undefined) {
                offsets[i] =
                    e.ace.session.documentToScreenRow(rows[i], 0) +
                    e.scrollOffset;
                if (offsets[i] > max) max = offsets[i];
            }
        });
        panes.forEach(function (e, i) {
            if (rows[i] != undefined && max > offsets[i])
                addLineWidget(e, rows[i], max - offsets[i]);
        });
    }

    function getScrollingInfo(acediff, side) {
        return acediff.editors[side].ace.getSession().getScrollTop();
    }

    function getEditorHeight(acediff) {
        return acediff
            .editors[acediff.pairs[0].left].ace.container.offsetHeight;
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
        if (onScreen === undefined) onScreen = true;
        var top =
            editor.ace.renderer.$cursorLayer.getPixelPosition(
                {
                    row: row,
                    column: 0,
                },
                onScreen
            ).top - (onScreen ? editor.ace.renderer.layerConfig.offset : 0);
        return top;
    }

    function getLineAtHeight(editor, pos, local) {
        if (local == 'local')
            pos +=
                editor.ace.renderer.scrollTop -
                editor.ace.renderer.layerConfig.offset;
        var row = pos / editor.ace.renderer.lineHeight;
        row -= editor.ace.renderer.layerConfig.firstRowScreen;
        row = editor.ace.session.screenToDocumentRow(row, 0);
        return row;
    }
    //clamp scrollTop to acceptable params
    function clampScroll(editor, scroll) {
        var r = editor.ace.renderer;
        var sm = r.scrollMargin;
        return Math.max(
            -sm.top,
            Math.min(
                scroll,
                r.layerConfig.maxHeight - r.$size.scrollerHeight + sm.bottom
            )
        );
    }

    // acediff.editors.left.ace.getSession().getLength() * acediff.lineHeight
    function getTotalHeight(acediff, side) {
        return (
            acediff.editors[side].ace.getSession().getScreenLength() *
            acediff.editors[side].ace.renderer.lineHeight
        );
    }

    // generates a Bezier curve in SVG format
    function getCurve(startX, startY, endX, endY) {
        var w = endX - startX;
        var halfWidth = startX + w / 2;

        // position it at the initial x,y coords
        var curve =
            'M ' +
            startX +
            ' ' +
            startY +
            // now create the curve. This is of the form "u M,N O,P Q,R" where u is a directive for SVG ("curveto"),
            // M,N are the first curve control point, O,P the second control point and Q,R are the final coords
            ' u ' +
            halfWidth +
            ',' +
            startY +
            ' ' +
            halfWidth +
            ',' +
            endY +
            ' ' +
            endX +
            ',' +
            endY;

        return curve;
    }

    function delegate(elSelector, eventName, selector, fn) {
        var element = document.getElementById(elSelector);
        var func = function (event) {
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
        return function () {
            var context = this,
                args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
    AceDiff.createContainer = function (container, opts) {
        //unlike ace-inline diff, we create the editor
        function c(id, className) {
            var div = document.createElement('div');
            div.className = className;
            div.id = id;
            container.appendChild(div);
        }
        container.className += ' acediff-container';
        c('acediff-left-editor', 'acediff-editor');
        u.extend(opts, {
            left: {
                id: 'acediff-left-editor',
            },
            right: {
                id: 'acediff-right-editor',
            },
        });
        var showGutter = opts.showCopyArrows || opts.showConnectors;
        if (opts.center && opts.left && opts.right && opts.threeWay !== false) {
            u.extend(opts, {
                center: {
                    id: 'acediff-center-editor',
                },
            });
            container.className += ' acediff-three-pane';
            showGutter && c('acediff-gutter-left', 'acediff-gutter');
            c('acediff-center-editor', 'acediff-editor');
            showGutter && c('acediff-gutter-right', 'acediff-gutter');
        } else {
            showGutter && c('acediff-gutter', 'acediff-gutter');
        }
        c('acediff-right-editor', 'acediff-editor');
    };
    AceDiff.diff = function (container, opts) {
        AceDiff.createContainer(container, opts);
        return new AceDiff(opts);
    };
    AceDiff.defaults = {
        ignoreWhitespace: false,
        diffGranularity: u.DIFF_GRANULARITY_BROAD,
        lockScrolling: true,
        showDiffs: true,
        showInlineDiffs: true,
        alignLines: true,
        maxDiffs: 5000,
        showConnectors: undefined,
        showCopyArrows: undefined,
        activePane: u.EDITOR_LEFT,
        theme: null, //can be configured per session
        mode: null,
        editable: false,
        content: null,
        copyLinkEnabled: true,
        id: null,
        left: null,
        right: null,
        center: null,
        classes: {
            gutterClass: 'acediff-gutter',
            gutterID: 'acediff-gutter',
            added: 'acediff-added',
            removed: 'acediff-removed',
            conflict: 'acediff-conflict',
            connector: 'acediff-connector',
            inlineRemoved: 'acediff-inline-removed',
            inlineAdded: 'acediff-inline-added',
            newCodeConnectorLink: 'acediff-new-code-connector-copy',
            newCodeConnectorLinkContent: '&#8594;',
            deletedCodeConnectorLink: 'acediff-deleted-code-connector-copy',
            deletedCodeConnectorLinkContent: '&#8592;',
            copyRightContainer: 'acediff-copy-right',
            copyLeftContainer: 'acediff-copy-left',
        },
        connectorYOffset: 0,
    };
    AceDiff.Utils = u;
    return AceDiff;
});