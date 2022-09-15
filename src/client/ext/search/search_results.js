define(function(require,exports,module) {
    /*globals $, ace*/
    var RecyclerViewCache = require("grace/ui/recycler").RecyclerViewCache;
    var RangeRenderer = require("grace/ui/range_renderer").RangeRenderer;
    var RecyclerRenderer = require("grace/ui/recycler").RecyclerRenderer;
    var switchToDoc = require("grace/ext/switch_to_doc").switchToDoc;
    var RecyclerViewHolder = require("grace/ui/recycler").RecyclerViewHolder;
    var MAX_KEEP_LINES_RANGE_LENGTH = 300;
    var ScrollSaver = require("grace/ui/recycler").ScrollSaver;
    var getEditor = require("grace/setup/setup_editors").getEditor;

    function createHeader(noRecycle) {
        var div = document.createElement("div");
        div.className = "searchResultTitle";
        div.innerHTML = "<h6 class='clipper searchResultFile'></h6>" + "<div class='edge_box-1 h-30'>" +
            "<i class='fill_box center numRanges'></i>" +
            "<button class='material-icons side-1 hoverable btn-toggle foldResult'>keyboard_arrow_up</button></div>";
        div.style.width = '100%';
        if (!noRecycle) div.style.position = 'absolute';
        return $(div);
    }

    function withRecycler(el, renderer, ctx) {
        var recycler, lineCache, getHolder;
        el.css('position', 'relative');
        var headerCache = new RecyclerViewCache(createHeader, el[0]);
        lineCache = new RecyclerViewCache(function() {
            var div = document.createElement("div");
            div.style.width = '100%';
            div.style.position = 'absolute';
            return $(div);
        }, el[0]);
        var holder_props = {
            css: function(i) {
                if (i != 'display') {
                    console.warn('Unimplemented property ' + i);
                } else if (this.hidden) {
                    return 'none';
                } else {
                    return 'block';
                }
            },
            show: function() {
                this.hidden = false;
                for (var i in this.views) {
                    this.views[i].show();
                }
            },
            hide: function() {
                this.hidden = true;
                for (var i in this.views) {
                    this.views[i].hide();
                }
            },
            renderer: renderer,
            headerCache: headerCache,
            lineCache: lineCache
        };
        getHolder = function(doc, ranges) {
            var endLine = 0;
            var mode = ace.config.$modes[doc.session.getMode().$id];
            var lines;
            //Better syntax highlighting if no data is not lost
            //But no keeping large documents because of that
            if (doc.session.getModeName() !=="text" && mode && ranges[ranges.length - 1].end.row <
                MAX_KEEP_LINES_RANGE_LENGTH) {
                endLine = ranges[ranges.length - 1].end.row;
                lines = doc.session.getLines(0, endLine);
            } else {
                var value = [];
                for (var i in ranges) {
                    var start = ranges[i].start.row;
                    if (start > endLine) {
                        //reset tokenizer
                        var reset = "*/\"\"\"-->";
                        value.push(reset);
                        endLine++;
                        while (start > endLine) {
                            value.push("");
                            endLine++;
                        }
                    }
                    if (start == endLine) {
                        endLine = ranges[i].end.row;
                        value.push.apply(value, (doc.session.getLines(start, endLine)));
                        endLine++;
                    }
                }
                lines = value;
            }
            var session = new ace.EditSession(lines, mode);
            var holder = Object.assign({
                ranges: ranges,
                lastLine: endLine,
                session: session,
                path: doc.getPath(),
                config: renderer.config,
                //ranges are split into line chunks of maxHeight for renderering
                maxHeight: 5,
                start: 0,
                hidden: ranges.length > ctx.searchConfig.resultsAutoShowLines,
                views: []
            }, holder_props);
            holder.session.setUseWorker(false);
            return holder;
        };
        recycler = new RecyclerRenderer();
        // var visualizer = ViewportVisualizer.create(el[0], recycler);
        var scrollers = ScrollSaver.getScrollingParents(el);
        recycler.beforeRender = function() {
            el.css('height', recycler.height+'px');
            //if (el.css('height') != recycler.height + "px") {
                // var store = ScrollSaver.saveScroll(scrollers);
                // el.css('height', recycler.height + 'px');
                // if (store._5sum != ScrollSaver.getScroll(scrollers)) {
                //     ScrollSaver.restoreScroll(scrollers, store);
                // }
            //}
            // visualizer.update();
        };
        //recycler.viewport = recycler.INFINITE_VIEWPORT;
        //load everything at once?
        var doScroll = function() {
            var y = ScrollSaver.getScroll(scrollers);
            recycler.scrollTo(y);
        };
        scrollers.on('scroll.resultview', doScroll);
        doScroll();
        ctx.scrollers = scrollers;
        ctx.clear = function() {
            recycler.detach();
            recycler.views = [];
            el.find(".search_line").each(function(i, e) {
                e.searchData = null;
            });
            renderer.config.width = el.width() - 20;
            var editor = getEditor();
            renderer.config.themeClass = "ace_editor " + (editor.renderer.theme.isDark ? "ace_dark " : "") + editor.renderer.$theme;
        };
        ctx.render = function(doc, ranges) {
            var holder = getHolder(doc, ranges);
            new HeaderViewHolder(holder, recycler);
            while (holder.start < ranges.length) {
                var list = new ResultViewHolder(holder, recycler);
                holder.views.push(list);
            }
        };
    }

    function noRecycler(el, renderer, ctx) {
        ctx.clear = function() {
            el.find(".searchResultTitle").each(function(i, e) {
                e.searchData = null;
            });
            //clear searchline data??
            el.children().not('.no-results').remove();
            renderer.config.width = el.width() - 20;
            var editor = getEditor();
            renderer.config.themeClass = "ace_editor " + (editor.renderer.theme.isDark ? "ace_dark " : "") + editor.renderer.$theme;
        };
        ctx.render = function(doc, ranges) {
            var header = createHeader(true);
            setTitle(header[0], doc.getPath(), ranges.length);
            var body = renderer.render(ranges, doc.session);
            bindClickListeners(body.children, ranges, doc.getPath());
            header[0].searchData = $(body);
            if (ranges.length > this.searchConfig.resultsAutoShowLines) {
                body.style.display = 'none';
                header.find('.foldResult').addClass('btn-toggle__activated');
            }
            el[0].appendChild(header[0]);
            el[0].appendChild(body);
        };
    }

    function ResultsView(el, useRecycler) {
        var renderer = new RangeRenderer();
        if (useRecycler && RecyclerViewCache) {
            withRecycler(el, renderer, this);
        } else {
            noRecycler(el, renderer, this);
        }
        el.on("click.resultview", ".foldResult", function() {
            var a = $(this).closest(".searchResultTitle")[0].searchData;
            var visible = a.css("display") != "none";
            if (visible) a.hide();
            else a.show();
            $(this).toggleClass('btn-toggle__activated', visible);
        });
        var self = this;
        el.on('click.resultview', '.search_line', function(e) {
            e.stopPropagation();
            self.onLineClicked(this);
        });
        this.el = el;
    }
    ResultsView.prototype.onLineClicked = function(el) {
        switchToDoc(el.searchData.path, el.searchData.range.start, el.searchData.range.end, true, this
            .afterLineClicked, this.server);
    };
    ResultsView.prototype.renderRanges = function(doc, ranges) {
        this.clear();
        this.render(doc, ranges);
    };
    ResultsView.prototype.destroy = function() {
        this.el.off("click.resultview", ".foldResult");
        this.el.off("click.resultview", ".search_line");
        if (this.scrollers) {
            this.scrollers.off("scroll.resultview");
        }
    };

    function setTitle(el, path, c) {
        el = $(el);
        el.find(".searchResultFile").empty().text(path);
        el.find(".numRanges").text(c + " results");
        require("grace/ui/ui_utils").styleClip(el);
    }

    function bindClickListeners(elements, ranges, path) {
        for (var i = 0, j = 0; i < elements.length; j++) {
            var range = ranges[j];
            if (!range) {
                console.warn('Renderer error more elements than ranges');
                break;
            }
            var data = {
                path: path,
                range: range
            };
            //if you use renderPlain, diff is always 1
            //because results are merged
            //var diff = 1
            var diff = (range.end.row - range.start.row + 1);
            for (var k = 0; k < diff; k++, i++) {
                elements[i].className += ' search_line';
                elements[i].searchData = data;
                elements[i].tabIndex = 0;
            }
        }
    }
    if (RecyclerViewHolder) {
        var HeaderViewHolder = function(holder, renderer) {
            /*todo calculate header size*/
            RecyclerViewHolder.apply(this, [holder.headerCache, renderer, 80]);
            renderer.register(Infinity, this);
            this.path = holder.path;
            this.numResults = holder.ranges.length;
            this.holder = holder;
        };
        HeaderViewHolder.prototype = Object.create(RecyclerViewHolder.prototype);
        HeaderViewHolder.prototype.bindView = function() {
            setTitle(this.view, this.path, this.numResults);
            this.view[0].searchData = this.holder;
            this.view.find('.foldResult').toggleClass('btn-toggle__activated', this.holder.hidden);
        };
        HeaderViewHolder.prototype.detach = function() {
            if (this.view) this.view[0].searchData = null;
            RecyclerViewHolder.prototype.detach.apply(this, arguments);
        };
        var ResultViewHolder = function(holder, renderer) {
            RecyclerViewHolder.apply(this, [holder.lineCache, renderer, 0]);
            var start = holder.start || 0;
            this.holder = holder;
            this.hidden = holder.hidden;
            this.renderer = renderer;
            this.height = 0;
            this.range = holder.ranges;
            if (holder.maxHeight <= 0) {
                throw 'Error Invalid maxHeight';
            }
            this.isFirst = (start == 0);
            for (var i = start; this.height < holder.maxHeight && i < holder.ranges.length; i++) {
                this.height += this.range[i].end.row - this.range[i].start.row + 1;
            }
            this.isLast = (i == this.holder.ranges.length);
            var end = i;
            this.range = holder.ranges.slice(start, end);
            holder.start = i;
            this.height *= (holder.config.lineHeight + holder.config.padding * 2);
            if (this.isFirst) this.height += 3;
            if (this.isLast) this.height += 3;
            renderer.register(Infinity, this);
        };
        ResultViewHolder.prototype = Object.create(RecyclerViewHolder.prototype);
        ResultViewHolder.prototype.compute = function() {
            return this.hidden ? 0 : this.height;
        };
        ResultViewHolder.prototype.bindView = function() {
            //quite unfortunate,
            $(this.view[0]).empty();
            this.view[0].className = this.holder.config.themeClass + " border-secondary";
            //maybe later we can reuse
            //the lineelements
            var ranges = this.range;
            this.view.css('height', this.height + 'px');
            this.view.toggleClass('range_renderer__first', this.isFirst);
            this.view.toggleClass('range_renderer__last', this.isLast);
            this.holder.renderer.render(ranges, this.holder.session, null, this.view[0], this.holder.lastLine);
            bindClickListeners(this.view[0].children, ranges, this.holder.path);
        };
    }
    exports.SearchResults = ResultsView;
}); /*_EndDefine*/