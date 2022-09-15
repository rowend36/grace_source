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
    var Range = ace.require('ace/range').Range;
    //Left is origin by default.
    //The advantage of this naming strategy is that it is visual ie what you see compared with say (origin and edit/theirs/ours) etc.
    //To use a different layout, pass leftIsYours=true in options.

    // our constructor
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
                    editable: options && options.leftIsYours,
                },
                right: {
                    id: null,
                    content: null,
                    editable: !(options && options.leftIsYours),
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
        // instantiate the panes in an internal data structure that will store a little info about the diffs and
        // editor content
        this.panes = {
            left: {
                ace: this.options.left.editor || ace.edit(this.options.left.id),
            },
            right: {
                ace:
                    this.options.right.editor ||
                    ace.edit(this.options.right.id),
            },
        };

        // this.lineHeight = this.panes.left.ace.renderer.lineHeight ||
        //     14; // assumption: both panes have same line heights
        this.pairs = [];
        if (this.options.center) {
            this.panes[u.EDITOR_CENTER] = {
                ace:
                    this.options.center.editor ||
                    ace.edit(this.options.center.id),
            };
            this.pairs.push({
                left: u.EDITOR_LEFT,
                swapped: true,
                right: u.EDITOR_CENTER,
                gutterID: this.options.classes.gutterLeftID,
            });
            this.pairs.push({
                left: u.EDITOR_CENTER,
                right: u.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterRightID,
            });
        } else {
            this.pairs.push({
                left: u.EDITOR_LEFT,
                swapped: this.options.leftIsYours,
                right: u.EDITOR_RIGHT,
                gutterID: this.options.classes.gutterID,
            });
        }

        //decorate after all the panes have rendered at least once
        var count = 0,
            total = 0;
        var init = function () {
            if (++count < total) return;
            this.decorate();
        }.bind(this);
        for (var i in this.panes) {
            var pane = this.panes[i];
            pane.markers = [];
            pane.scrollMargin = {};
            pane.ace.renderer.addScrollMargin(pane.scrollMargin);
            u.setupEditor(this, i);
            addEventHandlers(this, i);
            pane.ace.renderer.once('afterRender', init);
            total++;
        }
        this.activePane = this.options.activePane;
        this.panes[this.activePane].ace.focus();
        if (this.options.showConnectors) {
            createSvgContainer(this);
        }
        if (this.options.showCopyArrows) {
            createCopyContainers(this);
            addGutterEventHandlers(this);
        }

        addWindowResizeHandler(this);
        // store the visible height of the panes (assumed the same)
        // this.editorHeight = getEditorHeight(this);

        this.diff();
        this.goNextDiff(this.panes[this.options.activePane].ace);
    }

    // our public API
    AceDiff.prototype = {
        getNumDiffs: function () {
            return this.diffs.length;
        },

        // exposes the Ace panes
        getEditors: function () {
            return {
                left: this.panes.left.ace,
                center: this.panes.center && this.panes.center.ace,
                right: this.panes.right.ace,
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
                u.diff(this, this.pairs[i], clean);
                count += this.pairs[i].diffs.length;
            }
            if (this.pairs.length > 1) {
                computeConflicts(this.pairs[0].diffs, this.pairs[1].diffs);
            }
            if (this.options.alignLines) computeAligns(this);
            this.decorate();
        },
        decorate: function () {
            var acediff = this;
            for (var j in acediff.panes) u.clearDiffMarkers(acediff.panes[j]);
            if (this.toAlign) {
                alignEditors(acediff);
            }
            for (var i in acediff.pairs) {
                var pair = acediff.pairs[i];
                if (this.options.showDiffs) highlight3(acediff, pair);
                if (pair.rawDiffs) u.showInlineDiffs(acediff, pair);
            }
            this.updateGutter(true);
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
                        addCopyArrows(acediff, pair, info, diffIndex);
                    }
                    if (updateConnectors) {
                        addConnector(acediff, pair, info);
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
            if (this.options.showCopyArrows) {
                clearArrows(this);
                this.pairs.forEach(function (pair) {
                    var gutter = document.getElementById(pair.gutterID);
                    gutter.removeEventListener('click', pair.$gutterClickLeft);
                    gutter.removeEventListener('click', pair.$gutterClickRight);
                });
            }
            if (this.options.showConnectors) {
                this.pairs.forEach(function (pair) {
                    document
                        .getElementById(pair.gutterID)
                        .removeChild(pair.svg);
                });
            }
            for (var i in this.panes) {
                var pane = this.panes[i];
                u.clearLineWidgets(pane);
                u.clearDiffMarkers(pane);
                pane.ace.renderer.removeScrollMargin(pane.scrollMargin);
                for (var j in this.$commands)
                    pane.ace.commands.removeCommand(this.$commands[j]);
                if (!this.options[i].editor) {
                    pane.ace.destroy();
                }
            }
        },
    };
    /*
     @param side - left|right|center The editor whose scroll changed
     @param lastScrollT - used to keep track of which panes have been auto scrolled 
                    recently to prevent them from later scrolling other panes
     @param isAutoScroll - shows that the scroll is as a result of another editor scrolling
    */
    function syncScrolling(acediff, side, lastScrollT, isAutoScroll) {
        if (!isAutoScroll) {
            acediff.scrollSyncing = true;
            lastScrollT =
                new Date().getTime() -
                (acediff.options.alignLines ? 100 : 1000);
            //stop delayed scroll events
            //wait for scroll to cooldown
            if (lastScrollT - acediff.panes[side].lastScrollT < 0) {
                if (side === acediff.activePane) {
                    return acediff.synchronize(acediff, side);
                }
            }
            //This can end up in an endless loop
        } else if (!lastScrollT) throw new Error('ValueError: missing lastScrollT parameter');

        try {
            acediff.panes[side].lastScrollT = lastScrollT;
            for (var i in acediff.pairs) {
                var pair = acediff.pairs[i];
                var other =
                    pair.left == side
                        ? pair.right
                        : pair.right == side
                        ? pair.left
                        : null;
                if (!other) continue;
                var pane = acediff.panes[other];
                if (pane.lastScrollT === lastScrollT) continue;
                var result = syncPair(acediff, pair, side === pair.left);
                if (result) syncScrolling(acediff, other, lastScrollT, true);
            }
        } catch (e) {
            console.error(e);
        }
        if (!isAutoScroll) {
            acediff.scrollSyncing = false;
            acediff.panes[side].lastScrollT = 0;
        }
    }

    function syncPair(acediff, pair, isLeft) {
        var side = isLeft ? pair.left : pair.right;
        var target = isLeft ? pair.right : pair.left;
        var pane = acediff.panes[side];
        var targetPane = acediff.panes[target];
        if (!targetPane.ace) return;
        var scrollTop = getScrollingInfo(acediff, side);
        var targetScrollTop;
        if (acediff.options.alignLines) {
            var paneOffset = pane.scrollOffset * pane.ace.renderer.lineHeight;
            var currTop = getScrollingInfo(acediff, target);
            var offset = targetPane.scrollOffset * pane.ace.renderer.lineHeight;
            if (
                currTop + offset !=
                clampScroll(targetPane, scrollTop + paneOffset - offset)
            ) {
                targetScrollTop = scrollTop + paneOffset - offset;
            } else return true;
        } else {
            //Copied target codemirror source
            var config = pane.ace.renderer.layerConfig;
            var size = pane.ace.renderer.$size;
            var targetPos = 0;
            scrollTop = getScrollingInfo(acediff, side);

            var halfScreen = 0.5 * size.scrollerHeight;
            var midY = scrollTop + halfScreen;
            var mid = getLineAtHeight(pane, midY);
            var around = chunkBoundariesAround(pair.diffs, mid, isLeft);
            var offsets = getLinePositions(
                pane,
                isLeft ? around.left : around.right
            );
            var targetOffsets = getLinePositions(
                targetPane,
                isLeft ? around.right : around.left
            );
            var ratio = (midY - offsets.top) / (offsets.bot - offsets.top);
            targetPos =
                targetOffsets.top -
                halfScreen +
                ratio * (targetOffsets.bot - targetOffsets.top);
            var botDist, mix;
            // Some careful tweaking to make sure no space is left out of view
            // when scrolling to top or bottom.
            halfScreen = Math.min(
                config.maxHeight - size.scrollerHeight,
                halfScreen
            );
            if (targetPos > scrollTop && (mix = scrollTop / halfScreen) < 1) {
                targetPos = targetPos * mix + scrollTop * (1 - mix);
            } else if (
                (botDist = config.maxHeight - size.scrollerHeight - scrollTop) <
                halfScreen
            ) {
                //var otherInfo = getScrollingInfo(acediff, other);
                var otherConfig = targetPane.ace.renderer.layerConfig;
                var otherSize = targetPane.ace.renderer.$size;

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
            targetScrollTop = clampScroll(targetPane, targetPos);
        }
        targetPane.ace.session.setScrollTop(targetScrollTop);
        return true;
    }

    function chunkBoundariesAround(chunks, line, isLeft) {
        var beforeLeft, afterLeft, beforeRight, afterRight;
        for (var i = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            var chunkStart = isLeft
                ? chunk.leftStartLine
                : chunk.rightStartLine;
            var chunkEnd = isLeft ? chunk.leftEndLine : chunk.rightEndLine;
            if (afterLeft == null) {
                if (chunkStart > line) {
                    afterLeft = chunk.leftStartLine;
                    afterRight = chunk.rightStartLine;
                    break;
                } else if (chunkEnd > line) {
                    afterLeft = chunk.leftEndLine;
                    afterRight = chunk.rightEndLine;
                    break;
                }
            }
            if (chunkEnd <= line) {
                beforeLeft = chunk.leftEndLine;
                beforeRight = chunk.rightEndLine;
            } else if (chunkStart <= line) {
                beforeLeft = chunk.leftStartLine;
                beforeRight = chunk.rightStartLine;
            }
        }
        return {
            left: {
                before: beforeLeft,
                after: afterLeft,
            },
            right: {
                before: beforeRight,
                after: afterRight,
            },
        };
    }

    function getLinePositions(pane, around) {
        var bot = around.after;
        if (bot == null) bot = pane.ace.getSession().getLength();
        return {
            top: getRowPosition(pane, around.before || 0, false),
            bot: getRowPosition(pane, bot, false),
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
        var align = u.throttle(alignEditors, 100);
        acediff.synchronize = synchronize;
        addEvent(acediff.panes[side].ace, 'focus', function () {
            acediff.activePane = side;
        });
        if (acediff.options.alignLines) {
            addEvent(
                acediff.panes[side].ace.getSession(),
                'changeFold',
                function (ev) {
                    if (!acediff.isAligning) align(acediff);
                }
            );
        }

        addEvent(
            acediff.panes[side].ace.renderer,
            'changeCharacterSize',
            debounce(function (e) {
                var editor = acediff.panes[side].ace;
                var fontSettings = {
                    fontFamily: editor.renderer.$fontFamily,
                    fontSize: editor.renderer.$fontSize,
                    lineSpacing: editor.renderer.$lineSpacing,
                };
                for (var i in acediff.panes) {
                    if (i != side) {
                        acediff.panes[i].ace.renderer.setOptions(fontSettings);
                    }
                }
                u.updateScrollOffset(acediff.panes[side]);
            }, 700)
        );
        addEvent(
            acediff.panes[side].ace.getSession(),
            'changeScrollTop',
            function (scroll) {
                if (acediff.panes[side].ignoreScroll) return;//see addLineWidget
                if (acediff.options.lockScrolling && !acediff.scrollSyncing) {
                    synchronize(acediff, side);
                }
                acediff.panes[side].ace.renderer.once(
                    'afterRender',
                    function () {
                        acediff.updateGutter(false);
                    }
                );
            }
        );
        if (acediff.options.showConnectors || acediff.options.showCopyArrows) {
            addEvent(
                acediff.panes[side].ace.getSession(),
                'changeFold',
                function (scroll) {
                    acediff.updateGutter(true);
                }
            );
        }
        var diff = u.throttle(acediff.diff, 500).bind(acediff);
        addEvent(acediff.panes[side].ace, 'change', diff);
    }

    function addGutterEventHandlers(acediff) {
        acediff.pairs.forEach(function (pair) {
            var gutterID = pair.gutterID;
            if (acediff.options[pair.left].copyLinkEnabled) {
                pair.$gutterClickLeft = delegate(
                    gutterID,
                    'click',
                    '.' + acediff.options.classes.addedCodeArrow,
                    function (e) {
                        copy(acediff, e, pair, u.LTR);
                    }
                );
            }
            if (acediff.options[pair.right].copyLinkEnabled) {
                pair.$gutterClickRight = delegate(
                    gutterID,
                    'click',
                    '.' + acediff.options.classes.deletedCodeArrow,
                    function (e) {
                        copy(acediff, e, pair, u.RTL);
                    }
                );
            }
        });
    }

    function addWindowResizeHandler(acediff) {
        var onResize = debounce(function () {
            // acediff.availableHeight = getEditorHeight(acediff);
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
            sourceEditor = acediff.panes[left];
            targetEditor = acediff.panes[right];
            startLine = diff.leftStartLine;
            endLine = diff.leftEndLine;
            targetStartLine = diff.rightStartLine;
            targetEndLine = diff.rightEndLine;
        } else if (dir == u.RTL) {
            targetEditor = acediff.panes[left];
            sourceEditor = acediff.panes[right];
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
    // shows a diff in one of the two panes.
    function addDiffMarker(acediff, side, startLine, endLine, className) {
        var pane = acediff.panes[side];
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
        pane.markers.push(
            pane.ace.session.addMarker(
                new Range(startLine, 0, endLine, 1),
                classNames,
                'fullLine'
            )
        );
    }

    function addConnector(acediff, pair, info) {
        // All connectors, regardless of ltr or rtl have the same point system, even if p1 === p3 or p2 === p4
        //  p1   p2
        //
        //  p3   p4
        var leftPane = acediff.panes[pair.left];
        var rightPane = acediff.panes[pair.right];
        acediff.connectorYOffset = 1;
        var p1_x = -1;
        var p1_y = getRowPosition(leftPane, info.leftStartLine) + 0.5;
        var p2_x = acediff.gutterWidth + 1;
        var p2_y = getRowPosition(rightPane, info.rightStartLine) + 0.5;
        var p3_x = -1;
        var p3_y =
            getRowPosition(leftPane, info.leftEndLine) +
            acediff.connectorYOffset +
            0.5;
        var p4_x = acediff.gutterWidth + 1;
        var p4_y =
            getRowPosition(rightPane, info.rightEndLine) +
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

        var className =
            acediff.options.classes.connector +
            ' ' +
            (pair.swapped
                ? acediff.options.classes.fromRight
                : acediff.options.classes.fromLeft);

        el.setAttribute('class', className);
        pair.svg.appendChild(el);
    }

    function addCopyArrows(acediff, pair, info, diffIndex) {
        var arrow;
        if (
            info.leftEndLine > info.leftStartLine &&
            acediff.options.left.copyLinkEnabled
        ) {
            arrow = createArrow({
                className: acediff.options.classes.addedCodeArrow,
                topOffset: getRowPosition(
                    acediff.panes[pair.left],
                    info.leftStartLine,
                    false
                ),
                tooltip: 'Copy to right',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.addedCodeArrowContent,
            });
            pair.rightDiv.appendChild(arrow);
        }

        if (
            info.rightEndLine > info.rightStartLine &&
            acediff.options.right.copyLinkEnabled
        ) {
            arrow = createArrow({
                className: acediff.options.classes.deletedCodeArrow,
                topOffset: getRowPosition(
                    acediff.panes[pair.right],
                    info.rightStartLine,
                    false
                ),
                tooltip: 'Copy to left',
                diffIndex: diffIndex,
                arrowContent: acediff.options.classes.deletedCodeArrowContent,
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
            var leftTopOffset = acediff.panes[pair.left].ace
                .getSession()
                .getScrollTop(); //+acediff.panes.left.scrollOffset*acediff.lineHeight;
            var rightTopOffset = acediff.panes[pair.right].ace
                .getSession()
                .getScrollTop(); //+acediff.panes.right.scrollOffset*acediff.lineHeight;
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

    //Get the conflict zones
    //in a diff. Works on only two diffs for now.
    function computeConflicts(diff1, diff2, sideOrigin1, sideOrigin2) {
        var index1 = 0;
        var index2 = 0;
        var swapped = false;
        if (!sideOrigin1) {
            sideOrigin1 = u.EDITOR_RIGHT;
            sideOrigin2 = u.EDITOR_LEFT;
        }
        var originStart1 = sideOrigin1 + 'StartLine';
        var originEnd1 = sideOrigin1 + 'EndLine';
        var originStart2 = sideOrigin2 + 'StartLine';
        var originEnd2 = sideOrigin2 + 'EndLine';
        function swap() {
            var temp;
            temp = index2;
            index2 = index1;
            index1 = temp;
            temp = diff2;
            diff2 = diff1;
            diff1 = temp;
            temp = originStart2;
            originStart2 = originStart1;
            originStart1 = temp;
            temp = originEnd2;
            originEnd2 = originEnd1;
            originEnd1 = temp;
            swapped = !swapped;
        }
        //starts,ends represent the positions of line diffs
        while (index1 < diff1.length && index2 < diff2.length) {
            var start1 = diff1[index1][originStart1];
            var start2 = diff2[index2][originStart2];
            //diff1 is the diff that comes earlier in the center ie origin document
            if (start1 > start2) {
                swap();
                continue;
            }
            var end1 = diff1[index1][originEnd1];
            var end2 = diff2[index2][originEnd2];
            //diff1 is completely above, move to the next diff
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
        }
        //if (swapped) swap();
    }

    function highlight3(acediff, pair) {
        //the editted pane and origin pane
        var PANE_EDIT, PANE_ORIG, ignoreConflicts;
        var origStartLine, editStartLine, origEndLine, editEndLine;
        var classesConflict = acediff.options.classes.conflict,
            classesRemoved = acediff.options.classes.removed,
            classesAdded = acediff.options.classes.added;
        if (pair.swapped) {
            //right is origin
            PANE_EDIT = pair.left;
            PANE_ORIG = pair.right;
            origStartLine = 'rightStartLine';
            origEndLine = 'rightEndLine';
            editStartLine = 'leftStartLine';
            editEndLine = 'leftEndLine';
            classesRemoved += ' ' + acediff.options.classes.fromLeft;
        } else {
            ignoreConflicts = true; //only draw conflicts for one side.
            PANE_EDIT = pair.right;
            PANE_ORIG = pair.left;
            origStartLine = 'leftStartLine';
            origEndLine = 'leftEndLine';
            editStartLine = 'rightStartLine';
            editEndLine = 'rightEndLine';
            classesRemoved += ' ' + acediff.options.classes.fromRight;
        }
        pair.diffs.forEach(function (lineDiff, index) {
            var stops = lineDiff.stops;
            var start = lineDiff[origStartLine];
            //highlight conflict blocks in PANE_ORIG
            for (var i in stops) {
                if ((ignoreConflicts && stops[i][0]) || stops[i][1] === start)
                    continue;
                addDiffMarker(
                    acediff,
                    PANE_ORIG,
                    start,
                    stops[i][1],
                    stops[i][0] ? classesConflict : classesRemoved
                );
                start = stops[i][1];
            }
            if (lineDiff[origEndLine] > start)
                addDiffMarker(
                    acediff,
                    PANE_ORIG,
                    start,
                    lineDiff[origEndLine],
                    classesRemoved
                );
            addDiffMarker(
                acediff,
                PANE_EDIT,
                lineDiff[editStartLine],
                lineDiff[editEndLine],
                classesAdded
            );
        });
    }

    //Possible TODO handle multiple origins
    function computeAligns(acediff) {
        var align = [];
        // [origin]: [origin,left?,right?,....]
        acediff.pairs.forEach(function (pair, i) {
            i++; //reserve 0 for origin
            var origin = pair.swapped ? pair.right : pair.left;
            var edit = pair.swapped ? pair.left : pair.right;
            // align[0][i] = 0;
            pair.diffs.forEach(function (d) {
                var origRow = pair.swapped ? d.rightEndLine : d.leftEndLine;
                var editRow = pair.swapped ? d.leftEndLine : d.rightEndLine;
                (align[origRow] || (align[origRow] = [origRow]))[i] = editRow;
            });
            var origEnd = acediff.panes[origin].ace.getSession().getLength();
            var editEnd = acediff.panes[edit].ace.getSession().getLength();
            (align[origEnd] || (align[origEnd] = [origEnd]))[i] = editEnd;
        });
        acediff.toAlign = align;
    }
    function alignEditors(acediff) {
        if (acediff.isAligning) return;
        var toAlign = acediff.toAlign;
        var panes = []; //sort by origin first
        acediff.pairs.forEach(function (pair, i) {
            var origin = pair.swapped ? pair.right : pair.left;
            if (!panes[0]) panes[0] = acediff.panes[origin];
            panes[i + 1] = acediff.panes[pair.swapped ? pair.left : pair.right];
        });
        //An array of array of lines that should bbe aligned.
        //Does not yet support modification changes
        acediff.isAligning = true;
        var start = 0,
            end = toAlign.length - 1;
        for (var k in panes) {
            u.clearLineWidgets(panes[k]);
        }
        for (var j = start; j <= end; j++) {
            if (toAlign[j] !== undefined) {
                alignLines(toAlign[j], panes);
            }
        }
        for (var l in panes) {
            u.updateScrollOffset(panes[l]);
        }
        acediff.isAligning = false;
    }

    function alignLines(matchingRows, panes) {
        var max = 0;
        var screenRows = {};
        panes.forEach(function (e, i) {
            if (matchingRows[i] != undefined) {
                var externalOffset = Math.floor(
                    (e.ace.renderer.scrollMargin.top - e.scrollMargin.top) /
                        e.ace.renderer.lineHeight
                );
                screenRows[i] =
                    e.ace.session.documentToScreenRow(matchingRows[i], 0) +
                    e.scrollOffset +
                    externalOffset;
                if (screenRows[i] > max) max = screenRows[i];
            }
        });
        if (!matchingRows[0])
        panes.forEach(function (e, i) {
            if (matchingRows[i] != undefined && max > screenRows[i])
                u.addLineWidget(e, matchingRows[i], 0, max - screenRows[i]);
        });
    }

    function getScrollingInfo(acediff, side) {
        return acediff.panes[side].ace.getSession().getScrollTop();
    }

    // function getEditorHeight(acediff) {
    //     return acediff.panes[acediff.pairs[0].left].ace.container.offsetHeight;
    // }

    function getLine(pane, line) {
        return pane.ace.getSession().getLine(line);
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
    function getRowPosition(pane, row, onScreen) {
        if (onScreen === undefined) onScreen = true;
        var top =
            pane.ace.renderer.$cursorLayer.getPixelPosition(
                {
                    row: row,
                    column: 0,
                },
                onScreen
            ).top - (onScreen ? pane.ace.renderer.layerConfig.offset : 0);
        return top;
    }

    function getLineAtHeight(pane, pos) {
        var row = pos / pane.ace.renderer.lineHeight;
        return pane.ace.session.screenToDocumentRow(row, 0);
    }
    //clamp scrollTop to acceptable params
    function clampScroll(pane, scroll) {
        var r = pane.ace.renderer;
        var sm = r.scrollMargin;
        return Math.max(
            -sm.top,
            Math.min(
                scroll,
                r.layerConfig.maxHeight - r.$size.scrollerHeight + sm.bottom
            )
        );
    }

    // acediff.panes.left.ace.getSession().getLength() * acediff.lineHeight
    function getTotalHeight(acediff, side) {
        return (
            acediff.panes[side].ace.getSession().getScreenLength() *
            acediff.panes[side].ace.renderer.lineHeight
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
            // now create the curve. This is of the form "C M,N O,P Q,R" where u is a directive for SVG ("curveto"),
            // M,N are the first curve control point, O,P the second control point and Q,R are the final coords
            ' C ' +
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
        function $$(id, className) {
            var div = document.createElement('div');
            div.className = className;
            div.id = id;
            container.appendChild(div);
        }
        container.className += ' acediff-container';
        $$('acediff-left-editor', 'acediff-editor');
        u.extend(true, opts, {
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
            showGutter && $$('acediff-gutter-left', 'acediff-gutter');
            $$('acediff-center-editor', 'acediff-editor');
            showGutter && $$('acediff-gutter-right', 'acediff-gutter');
        } else {
            showGutter && $$('acediff-gutter', 'acediff-gutter');
        }
        $$('acediff-right-editor', 'acediff-editor');
    };
    AceDiff.diff = function (container, opts) {
        AceDiff.createContainer(container, opts);
        return new AceDiff(opts);
    };
    AceDiff.defaults = {
        ignoreWhitespace: false,
        // diffGranularity: u.DIFF_GRANULARITY_BROAD,
        lockScrolling: true,
        showDiffs: true,
        leftIsYours: false,
        showInlineDiffs: true,
        alignLines: true,
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
            //inferred from gutterID + -left and -right
            gutterLeftID: null,
            gutterRightID: null,
            added: 'acediff-added',
            removed: 'acediff-removed',
            conflict: 'acediff-conflict',
            connector: 'acediff-connector',
            inlineRemoved: 'acediff-inline-removed',
            inlineAdded: 'acediff-inline-added',
            addedCodeArrow: 'acediff-new-code-connector-copy',
            addedCodeArrowContent: '&#8594;',
            deletedCodeArrow: 'acediff-deleted-code-connector-copy',
            deletedCodeArrowContent: '&#8592;',
            copyRightContainer: 'acediff-copy-right',
            copyLeftContainer: 'acediff-copy-left',
        },
    };
    AceDiff.Utils = u;
    return AceDiff;
});