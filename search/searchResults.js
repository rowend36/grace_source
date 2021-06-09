_Define(function(global) {
    var RecyclerViewCache = global.RecyclerViewCache;
    var RangeRenderer = global.RangeRenderer;
    var RecyclerRenderer = global.RecyclerRenderer;
    var switchToDoc = global.Functions.switchToDoc;
    var Utils = global.Utils;
    var RecyclerViewHolder = global.RecyclerViewHolder;
    var MAX_KEEP_LINES_RANGE_LENGTH = 300;
    var ScrollSaver = global.ScrollSaver;
    var getEditor = global.getEditor;

    function createHeader(noRecycle) {
        var div = document.createElement("div");
        div.className = "searchResultTitle";
        div.innerHTML = "<h6 class='clipper searchResultFile'></h6>" + "<div class='edge_box-1 h-30'>" +
            "<i class='fill_box center numRanges'></i>" +
            "<i class='material-icons side-1 foldResult'>keyboard_arrow_up</i></div>";
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
            div.className = renderer.config.themeClass;
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
            var mode = ace.config.$modes[doc.session.$modeId];
            var lines;
            //Better syntax highlighting if context is not lost
            //But no keeping large documents because of that
            if (doc.session.$modeId != "ace/mode/text" && mode && ranges[ranges.length - 1].end.row <
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
                hidden: ranges.length>100,
                views: []
            }, holder_props);
            holder.session.setUseWorker(false);
            return holder;
        };
        recycler = new RecyclerRenderer();
        //var visualizer = ViewportVisualizer.create(el[0], recycler);
        var scrollers = ScrollSaver.getScrollingElements(el);
        recycler.beforeRender = function() {
            el.css('height', recycler.height);
            if (el.css('height') != recycler.height + "px") {
                var store = ScrollSaver.saveScroll(scrollers);
                el.css('height', recycler.height + 'px');
                if (store._5sum != ScrollSaver.getScroll(scrollers)) {
                    ScrollSaver.restoreScroll(scrollers, els);
                }
            }
            //visualizer.update();
        };
        //recycler.viewport = recycler.INFINITE_VIEWPORT;
        //load everything at once?
        var doScroll = function(e) {
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
            var edit = getEditor();
            renderer.config.themeClass = 'ace_editor '+edit.renderer.$theme;
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
            el.html("");
            renderer.config.width = el.width() - 20;
            renderer.config.themeClass = $('.editor')[0].className;
        };
        ctx.render = function(doc, ranges) {
            var header = createHeader(true);
            setTitle(header[0], doc.getPath(), ranges.length);
            var body = renderer.render(ranges, doc.session);
            bindClickListeners(body.children, ranges, doc.getPath());
            header.searchData = $(body);
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
            if (a.css("display") == "none") {
                a.show();
                $(this).html("keyboard_arrow_up");
            } else {
                a.hide();
                $(this).html("keyboard_arrow_down");
            }
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
    ResultsView.prototype.renderRanges = function(doc,ranges) {
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
        global.styleClip(el);
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
            if (this.holder.hidden) {
                this.view.find('.foldResult').html("keyboard_arrow_down");
            } else {
                this.view.find('.foldResult').html("keyboard_arrow_up");
            }
        };
        HeaderViewHolder.prototype.detach = function() {
            if (this.view) this.view[0].searchData = null;
            RecyclerViewHolder.prototype.detach.apply(this, arguments);
        };
        var ResultViewHolder = function(holder, renderer) {
            RecyclerViewHolder.apply(this, [holder.lineCache, renderer, 0]);
            var start = holder.start || 0;
            this.holder = holder;
            this.hidden  = holder.hidden;
            this.renderer = renderer;
            this.height = 0;
            this.range = holder.ranges;
            if (holder.maxHeight <= 0) {
                throw 'Error Invalid maxHeight';
            }
            for (var i = start; this.height < holder.maxHeight && i < holder.ranges.length; i++) {
                this.height += this.range[i].end.row - this.range[i].start.row + 1;
            }
            var end = i;
            this.range = holder.ranges.slice(start, end);
            holder.start = i;
            this.height *= (holder.config.lineHeight+holder.config.padding*2);
            renderer.register(Infinity, this);
        };
        ResultViewHolder.prototype = Object.create(RecyclerViewHolder.prototype);
        ResultViewHolder.prototype.compute = function() {
            return this.hidden ? 0 : this.height;
        };
        ResultViewHolder.prototype.bindView = function() {
            //quite unfortunate,
            this.view[0].innerHTML = "";
            //maybe later we can reuse
            //the lineelements
            var ranges = this.range;
            this.view.css('height', this.height + 'px');
            this.holder.renderer.render(ranges, this.holder.session, null, this.view[0], this.holder.lastLine);
            bindClickListeners(this.view[0].children, ranges, this.holder.path);
        };
    }
    global.SearchResults = ResultsView;
}); /*_EndDefine*/