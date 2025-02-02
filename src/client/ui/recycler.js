define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    var stats = (exports.renderStats = {
        append: 0,
        insert: 0,
        detach: 0,
    });
    var Errors = {
        INVALID_INDEX: 'No child at index {index}',
        NOT_CHILD: 'View is not a child of this renderer',
    };
    var requestAnimationFrame =
        window.requestAnimationFrame ||
        function (func) {
            return setTimeout(func, 34);
        };
    var cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

    var ScrollSaver = {
        getScroll: function (els) {
            var s,
                sum = 0;
            for (s = 0; s < els.length; s++) {
                sum += els[s].scrollTop;
            }
            return sum;
        },
        getScrollingParents: function (el) {
            //copied from filebrowser
            el[0] || (el = $(el));
            var a = [];
            var p = el.add(el.parents());
            for (var i = 0; i < p.length; i++) {
                var overflow = p.eq(i).css('overflowY');
                if (overflow != 'hidden') {
                    a.push(p[i]);
                }
            }
            return $(a);
        },
        saveScroll: function (els) {
            var s,
                sum = 0,
                scrolls = [];
            for (s = 0; s < els.length; s++) {
                sum += scrolls[s] = els[s].scrollTop;
            }
            scrolls._5sum = sum;
            return scrolls;
        },
        restoreScroll: function (els, scrolls) {
            var sum = 0;
            for (var s = 0; s < els.length; s++) {
                sum += els[s].scrollTop = scrolls[s];
            }
            return sum;
        },
    };
    var ViewportVisualizer = {
        create: function (root, renderer) {
            this.renderer = renderer;

            function svg(el, styles, attribs) {
                var b = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    el
                );
                for (var i in styles) {
                    b.style[i] = styles[i];
                }
                for (i in attribs) {
                    b.setAttribute(i, attribs[i]);
                }
                return b;
            }
            var svgEl = svg(
                'svg',
                {
                    border: '1px solid red',
                    position: 'absolute',
                    height: this.renderer.viewport.height + 'px',
                    top: this.renderer.viewport.y + 'px',
                    width: '100%',
                    zIndex: 4,
                    pointerEvents: 'none',
                },
                {
                    version: '1.1',
                    viewBox: '0 0 1000 300',
                }
            );

            var frameCountEl = svg(
                'text',
                {},
                {
                    'font-family': 'monospace',
                    'font-size': '40px',
                    fill: 'blue',
                    x: 500,
                    y: 100,
                }
            );
            svgEl.appendChild(frameCountEl);

            var fpsEl = svg(
                'text',
                {},
                {
                    'font-family': 'monospace',
                    'font-size': '40px',
                    fill: 'red',
                    x: 500,
                    y: 150,
                }
            );
            svgEl.appendChild(fpsEl);
            root.appendChild(svgEl);
            var obj = Object.create(this);
            this.el = obj.el = svgEl;
            this.renderer = obj.renderer = renderer;
            //The number of frames drawn so far
            this.frames = obj.frames = 0;
            this.frameCountEl = obj.frameCountEl = frameCountEl;
            //The last time we rendered a frame
            this.last = obj.lastTime = new Date().getTime();
            //Total amount of time we've been rendering
            this.totalTime = obj.totalTime = 0;
            this.fpsEl = obj.fpsEl = fpsEl;
            //Number of frames the last time we measured fps
            this.lastFrame = obj.lastFrame = 0;
            return obj;
        },
        update: function () {
            //causes infinite scroll
            this.el.style.top = this.renderer.viewport.y + 'px';
            this.el.style.height =
                Math.min(
                    this.renderer.height - this.renderer.viewport.y,
                    this.renderer.viewport.height
                ) + 'px';
            this.frameCountEl.innerHTML = ' frames: ' + this.frames++;
            var t = new Date().getTime();
            if (t - this.lastTime < 100) {
                this.totalTime += t - this.lastTime;
                this.fpsEl.innerHTML =
                    ' fps: ' +
                    Math.round(this.totalTime) / 1000 +
                    ':' +
                    Math.round(
                        ((this.frames - this.lastFrame) / this.totalTime) *
                            100000
                    ) /
                        100;
            } else this.frames--;
            this.lastTime = t;
            if (this.frames - this.lastFrame > 300) {
                this.lastFrame = this.frames;
                this.totalTime = 0;
            }
        },
    };
    function onRender() {
        this.renderTimeout = null;
        this.compute();
        stats.append = 0;
        stats.detach = 0;
        stats.insert = 0;
        this.render();
    }
    var Utils = require('../core/utils').Utils;

    var toClear = [];
    var clear = Utils.debounce(function () {
        // var total = 0;
        toClear.forEach(function (e) {
            // total += e.length;
            e.length = 0;
        });
        toClear = [];
    }, 30000);

    function postClear(array) {
        clear();
        if (toClear.indexOf(array) < 0) {
            toClear.push(array);
        }
    }
    //Sharable cache
    function RecyclerViewCache(factory, el, els) {
        this.els = els || [];
        this.factory = factory;
        this.container = el;
    }
    RecyclerViewCache.prototype.pop = function (container, before) {
        var el;
        if (this.els.length > 0) {
            el = this.els.pop();
        } else {
            el = this.factory();
        }
        if (before) {
            stats.insert++;
            (container || this.container).insertBefore(el[0] || el, before);
        } else {
            stats.append++;
            (container || this.container).appendChild(el[0] || el);
        }
        return el;
    };
    RecyclerViewCache.prototype.push = function (el) {
        el.detach();
        //Also possible
        //el.addClass('destroyed');
        this.els.push(el);
        if (this.els.length === 1) postClear(this.els);
    };
    RecyclerViewCache.prototype.clone = function (el) {
        return new RecyclerViewCache(this.factory, el, this.els);
    };

    //FastCache reduces the number of
    //detach operations for long lists
    //The gains are not so much actually.
    //+(1-4) fps while scrolling
    function FastCache(cache, autosync) {
        this.back = cache;
        this.container = this.back.container;
        this.els = [];
        this.autosync = autosync;
        this.$sync = this.sync.bind(this);
    }
    FastCache.prototype.pop = function (container, before) {
        if (this.els.length > 0) {
            var el = this.els.pop();
            if (before) {
                stats.insert++;
                (container || this.container).insertBefore(el[0] || el, before);
            } else {
                stats.append++;
                (container || this.container).appendChild(el[0] || el);
            }
            return el;
        } else {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }
            return this.back.pop(container || this.container, before);
        }
    };
    FastCache.prototype.push = function (el) {
        this.els.push(el);
        if (!this.timeout && this.autosync)
            this.timeout = setTimeout(this.$sync, 400);
    };
    FastCache.prototype.clone = function (el) {
        return new FastCache(this.back.clone(el), this.autosync);
    };
    FastCache.prototype.sync = function () {
        this.timeout = null;
        while (this.els.length > 0) {
            this.back.push(this.els.pop());
        }
    };

    function RecyclerViewHolder(cache, parent, height) {
        this.visible = false; //onscreen
        this.renderer = parent;
        this.cache = cache;
        this.view = null;
        this.hidden = false; //display:none
        this.y = 0;
        this.height = height;
    }
    RecyclerViewHolder.prototype.bindView = function (/*vh, index*/) {};
    RecyclerViewHolder.prototype.render = function (
        viewport,
        index,
        insertBefore,
        restack
    ) {
        this.visible = true;
        if (this.hidden) {
            return;
        }
        if (!this.view) {
            this.view = this.cache.pop(null, insertBefore);
            this.lastY = this.y;
            this.view.css('top', this.y + 'px');
            this.bindView(this, index);
        } else {
            if (restack) {
                if (insertBefore) {
                    stats.insert++;
                    this.view[0].parentElement.insertBefore(
                        this.view[0],
                        insertBefore
                    );
                } else {
                    stats.append++;
                    this.view[0].parentElement.appendChild(this.view[0]);
                }
            }
        }
        if (this.lastY != this.y) {
            this.lastY = this.y;
            this.view.css('top', this.y + 'px');
        }
    };
    RecyclerViewHolder.prototype.detach = function (/*index*/) {
        if (!this.visible) return;
        this.visible = false;
        this.lastY = null;
        if (!this.view) return;
        this.cache.push(this.view);
        this.view = null;
    };
    RecyclerViewHolder.prototype.compute = function (/*viewport, index*/) {
        if (this.hidden) return 0;
        else return this.height;
    };
    RecyclerViewHolder.prototype.hide = function () {
        if (this.hidden) return;
        if (this.visible) {
            this.detach();
            this.hidden = true;
            this.visible = true;
        } else this.hidden = true;
        this.invalidate();
    };
    RecyclerViewHolder.prototype.invalidate = function () {
        this.renderer && this.renderer.invalidate(this);
    };
    RecyclerViewHolder.prototype.show = function () {
        if (!this.hidden) return;
        this.hidden = false;
        this.invalidate();
    };
    var SCROLL_UP = 2;
    var SCROLL_DOWN = 1;
    var NO_CHANGE = 0;
    //var MODIFY_SINGLE_INSERT = 16;//not yet supported
    //var MODIFY_ABOVE = 132;//not yet supported
    var MODIFY_NOT_BELOW = 4;
    var INVALIDATE = 128;

    function RecyclerRenderer() {
        this.views = [];
        this.height = 0;
        this.renderlist = [];
        this.start = -1;
        this.changes = NO_CHANGE;
        this.viewport = Object.create(this.DEFAULT_VIEWPORT);
        this.paddingTop;
        this.lastIndex = 0;
        this.onRender = null;
        this.onBeforeRender = null;
    }
    /*Overrides*/
    RecyclerRenderer.prototype.DEFAULT_VIEWPORT = {
        y: -window.innerHeight,
        height: Math.max(window.innerHeight * 2.5, 1400),
    };
    window.addEventListener('resize', function () {
        RecyclerRenderer.prototype.DEFAULT_VIEWPORT.height =
            window.innerHeight * 2.5;
        RecyclerRenderer.prototype.DEFAULT_VIEWPORT.y = -window.innerHeight;
    });
    RecyclerRenderer.prototype.INFINITE_VIEWPORT = {
        y: -Infinity,
        height: Infinity,
    };
    RecyclerRenderer.prototype.createViewport = function (y, height, margin) {
        if (margin === undefined) margin = height / 2;
        return {
            y: y - margin,
            height: height + margin * 2,
        };
    };
    //Warning, calling this method in render might give true negatives
    //due to the modify_not_below check in compute
    RecyclerRenderer.prototype.sizeChanged = function () {
        return this.changes > 3;
    };
    RecyclerRenderer.prototype.compute = function (viewport) {
        var end = this.views.length;
        if (this.start >= end) {
            return this.height;
        }
        viewport = this.getViewport(viewport);
        var a = this.paddingTop || 0;
        var h = 0;
        var i = 0;
        if (this.start > -1) {
            //&& this.height > 0) {
            //the height>0 condition can be a band-aid
            //to fix some rendering bugs
            i = this.start + 1;
            a = this.views[this.start].y;
            h = this.views[this.start].compute(viewport, i);
            if (!(this.changes & MODIFY_NOT_BELOW)) {
                if (a + h > viewport.y + viewport.height) {
                    //all increments in viewport.y must be done in scrollTop
                    //to get correct values
                    //change happened below screen
                    this.changes ^= INVALIDATE;
                    //still force rendering
                    this.changes |= SCROLL_UP;
                } else this.changes |= MODIFY_NOT_BELOW;
            }
            a += h;
        }
        for (i; i < end; i++) {
            this.views[i].y = a | 0;
            h = this.views[i].compute(viewport, i);
            a += h;
        }
        this.start = end;
        this.height = a;
        if (this.onBeforeRender) this.onBeforeRender();
        return this.height;
    };
    RecyclerRenderer.prototype.getViewport = function (viewport) {
        if (viewport) {
            throw 'Error: use scrollTo to change viewport';
        }
        return this.viewport;
    };

    RecyclerRenderer.prototype.render = function (viewport) {
        viewport = this.getViewport(viewport);
        if (this.renderTimeout) {
            cancelAnimationFrame(this.renderTimeout);
            this.renderTimeout = null;
        }
        if (this.onRender) this.onRender();
        if (this.changes === NO_CHANGE) return;
        //you can invalidate again here
        //to animate
        var start = viewport.y;
        var end = viewport.y + viewport.height;
        if (end > this.height) {
            start -= end - this.height;
        }
        var renderlist = [];
        var begin = this.lastIndex;
        var isFirst = true;
        var view,
            views = this.views;
        //if (true || this.changes > SCROLL_DOWN){
        for (var i = begin - 1; i >= 0; i--) {
            view = views[i];
            if (view.height + view.y < start) break;
            else if (view.y > end) {
                continue;
            }
            if (isFirst) {
                this.lastIndex = i;
                isFirst = false;
            }
            renderlist.unshift(view);
        }
        //}
        var below = views.length;
        for (var l = begin; l < below; l++) {
            view = views[l];
            if (view.height + view.y < start) continue;
            else if (view.y > end) {
                break;
            }
            if (isFirst) {
                this.lastIndex = l;
                isFirst = false;
            }
            renderlist.push(this.views[l]);
        }
        for (var t = 0; t < this.renderlist.length; t++) {
            if (renderlist.indexOf(this.renderlist[t]) < 0) {
                this.renderlist[t].detach(t);
            }
        }
        //Find insert point for scrollup and invalidate
        var insertBefore, ins;
        if (this.changes > SCROLL_DOWN) {
            for (var k = 0; k < this.renderlist.length; k++) {
                if (this.renderlist[k].visible && this.renderlist[k].view) {
                    insertBefore = this.renderlist[k].view[0];
                    ins = renderlist.indexOf(this.renderlist[k]);
                    break;
                }
            }
        }
        this.renderlist = renderlist;
        var len = this.renderlist.length;
        if (this.changes <= SCROLL_UP) {
            //scroll
            for (var s = 0; s < len; s++) {
                renderlist[s].render(viewport, s, insertBefore);
            }
        } else {
            //render invalidated screen by restacking
            for (var p = 0; p < len; p++) {
                if (p == ins) {
                    renderlist[p].render(viewport, p);
                    insertBefore = undefined;
                    for (var m = p + 1; m < stop; m++) {
                        if (renderlist[m].visible && renderlist[m].view) {
                            insertBefore = renderlist[m].view[0];
                            ins = m;
                            break;
                        }
                    }
                } else renderlist[p].render(viewport, p, insertBefore, true);
            }
        }
        this.changes = NO_CHANGE;
    };
    RecyclerRenderer.prototype.detach = function () {
        for (var i in this.renderlist) {
            this.renderlist[i].detach();
        }
        this.renderlist = [];
        this.lastIndex = 0;
    };
    RecyclerRenderer.prototype.register = function (index, view) {
        if (index < 0) {
            index = this.views.length + index;
            if (index > -1) index = this.views.length;
            //throw new Error(Errors.INVALID_INDEX.replace("{index}", index));
        } else if (index > this.views.length) index = this.views.length;
        if (index == this.views.length) {
            this.views[index] = view;
        } else {
            this.views.splice(index, 0, view);
        }
        this.views[index].y =
            index < this.views.length - 1
                ? this.views[index + 1].y
                : 0 /*warn unsorted*/;
        //this.height += this.views[index].height;
        //index-1 not index because of a few wierd cases
        //index<this.views.length
        this.invalidate(index - 1);
    };
    RecyclerRenderer.prototype.unregister = function (view) {
        var index = view;
        if (typeof view == 'object') {
            index = this.views.indexOf(view);
            if (index < 0) throw new Error(Errors.NOT_CHILD);
        } else if (index < 0)
            throw new Error(Errors.INVALID_INDEX.replace('{index}', index));
        this.views[index].renderer = null;
        if (index < this.views.length) {
            view = this.views.splice(index, 1)[0];
            Utils.removeFrom(this.renderlist, view);
        } else throw new Error(Errors.INVALID_INDEX.replace('{index}', index));
        this.invalidate(index - 1);
    };
    /** @param {(number|RecyclerViewHolder)} start - The view whose height or display has changed. Pass -1 to invalidate the whole view
     */
    RecyclerRenderer.prototype.invalidate = function (start) {
        if (typeof start == 'object') {
            start = this.views.indexOf(start);
            if (start < 0) throw new Error(Errors.NOT_CHILD);
        }
        this.start = Math.max(-1, Math.min(this.start, start || 0));
        this.changes |= INVALIDATE;
        this.schedule();
    };
    RecyclerRenderer.prototype.scrollTo = function (scrollTop, topMargin) {
        //we clip bottom in render because of invalidates
        scrollTop = Math.max(
            0,
            scrollTop - (topMargin || -this.DEFAULT_VIEWPORT.y)
        );
        if (scrollTop < this.viewport.y) {
            this.changes |= SCROLL_UP;
        } else if (scrollTop > this.viewport.y) {
            this.changes |= SCROLL_DOWN;
        } else return;
        this.viewport.y = scrollTop;
        this.schedule();
    };
    RecyclerRenderer.prototype.schedule = function (/*viewport*/) {
        if (this.renderTimeout) return;
        if (this.changes) {
            this.renderTimeout = requestAnimationFrame(onRender.bind(this));
        }
    };
    //RecyclerRenderer+RecyclerViewHolder
    //= NestedRenderer
    //Warning: NestedRenderer never releases its
    //root element because of possible eventlisteners
    //override detach and render to fix this
    function NestedRenderer(view, renderer, root) {
        RecyclerViewHolder.apply(this, [null, renderer, 0]);
        RecyclerRenderer.apply(this);
        this.stub = view;
        this.root = root;
        stats.append++;
        root.appendChild(view[0]);
        this.stub.css('position', 'absolute');
    }
    NestedRenderer.prototype = Object.create(RecyclerRenderer.prototype);
    NestedRenderer.prototype.constructor = NestedRenderer;
    NestedRenderer.prototype.superRenderer = RecyclerRenderer.prototype;
    NestedRenderer.prototype.compute = function (viewport /*, index*/) {
        if (this.hidden) return 0;
        else if (!viewport)
            throw new Error('Nested Renderer cannot be used as Root Renderer');
        this.computed = true;
        return this.superRenderer.compute.apply(this, [viewport]);
    };
    NestedRenderer.prototype.getViewport = function (viewport) {
        if (viewport) {
            this.viewport.y = viewport.y - this.y;
            this.viewport.height = viewport.height;
        }
        return this.viewport;
    };
    NestedRenderer.prototype.detach = function () {
        if (!this.visible) return;
        this.visible = false;
        if (this.hidden) return;
        this.superRenderer.detach.apply(this, arguments);
        this.view[0].style.display = 'none';
        this.view = null;
        this.lastY = null;
    };
    NestedRenderer.prototype.render = function (
        viewport,
        index,
        insertBefore,
        restack
    ) {
        this.visible = true;
        if (this.hidden) return;
        if (restack || !this.view) {
            if (!this.view) {
                this.view = this.stub;
                this.view[0].style.display = 'block';
            }
            if (insertBefore) {
                stats.insert++;
                this.root.insertBefore(this.view[0], insertBefore);
            } else {
                stats.append++;
                this.root.appendChild(this.view[0]);
            }
        }

        if (this.lastY != this.y) {
            this.lastY = this.y;
            this.view.css('top', this.y + 'px');
        }
        this.changes |= this.renderer.changes & (SCROLL_DOWN | SCROLL_UP);
        this.superRenderer.render.apply(this, [viewport]);
    };

    NestedRenderer.prototype.schedule = function () {
        if (this.renderer) {
            this.renderer.invalidate(this);
        }
    };

    NestedRenderer.prototype.hide = function () {
        this.superViewHolder.hide.apply(this);
    };
    NestedRenderer.prototype.show = function () {
        this.superViewHolder.show.apply(this);
    };
    NestedRenderer.prototype.superViewHolder = RecyclerViewHolder.prototype;
    exports.ScrollSaver = ScrollSaver;
    exports.ViewportVisualizer = ViewportVisualizer;
    exports.RecyclerRenderer = RecyclerRenderer;
    exports.FastCache = FastCache;
    exports.NestedRenderer = NestedRenderer;
    exports.RecyclerViewHolder = RecyclerViewHolder;
    exports.RecyclerViewCache = RecyclerViewCache;
}); /*_EndDefine*/