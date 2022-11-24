define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    var FileBrowser = require('./file_browser').FileBrowser;
    var ProjectView = require('./file_browser').ProjectView;
    var NestedBrowser = require('./file_browser').NestedBrowser;
    var RecyclerViewHolder = require('grace/ui/recycler').RecyclerViewHolder;
    var RecyclerViewCache = require('grace/ui/recycler').RecyclerViewCache;
    var FastCache = require('grace/ui/recycler').FastCache;
    var RecyclerRenderer = require('grace/ui/recycler').RecyclerRenderer;
    var ScrollSaver = require('grace/ui/recycler').ScrollSaver;
    var NestedRenderer = require('grace/ui/recycler').NestedRenderer;
    var isDirectory = require('grace/core/file_utils').FileUtils.isDirectory;
    var Icons = require('./file_icons').FileIcons;
    var Utils = require('grace/core/utils').Utils;
    /** @constructor */
    function RecyclerStub(id, rootDir, fileServer, noReload, renderer) {
        //INITIAL IDEA
        //The height depends
        //on nestedViews and extraSpaces
        //the y depends on height of above elements
        //getOrCreateViews return viewholders to store attr,class,visibility
        //pagesize is infinite, pageStart is 0
        this.cache = new FastCache(
            new RecyclerViewCache(this.createFileItem.bind(this), null),
            true
        );
        this.renderer = renderer || new RecyclerRenderer();
        this.$savedScroll = this.ignoreScroll = null;
        FileBrowser.call(this, id, rootDir, fileServer, noReload);
    }
    Utils.inherits(RecyclerStub, FileBrowser);
    RecyclerStub.prototype.superClass = FileBrowser.prototype;
    RecyclerStub.prototype.pageSize = 1000;
    RecyclerStub.prototype.createFileItem = function () {
        var view = document.createElement('div');
        view.innerHTML = this.viewTemplate;
        view.children[0].style.position = 'absolute';
        return $(view.children[0]);
    };
    RecyclerStub.prototype.scrollPastEnd = true;
    RecyclerStub.prototype.createView = function (/*stub*/) {
        this.superClass.createView.apply(this, arguments);
        this.scrollElement = $(document.createElement('div'));
        this.scrollElement.css('position', 'absolute');
        this.scrollElement.css('top', '0px');
        this.scrollElement.css('width', '2px');
        this.scrollElement.css('visibility', 'hidden');
        this.root[0].appendChild(this.scrollElement[0]);
        this.scrollElement.css('height', '0px');
        this.root.addClass('fileview-recycler');
        this.cache.container = this.root[0];
        if (this.renderer) {
            this.renderer.views = [];
            this.renderer.beforeRender = this.onBeforeRender.bind(this);
            this.renderer.onRender = this.onRender.bind(this);
        }
    };
    RecyclerStub.prototype.destroy = function () {
        this.renderer.detach();
        this.renderer.views = null;
        this.renderer.beforeRender = null;
        this.renderer.beforeCompute = null;
        this.cache = null;
        this.superClass.destroy.apply(this, arguments);
    };
    RecyclerStub.prototype.onBeforeRender = function () {
        if (
            this.renderer.sizeChanged() &&
            this.scroller &&
            this.renderer.height > this.renderer.viewport.y * 2
        )
            this.$savedScroll = ScrollSaver.saveScroll(this.scroller);
        else this.$savedScroll = null;
    };
    RecyclerStub.prototype.onRender = function () {
        // this.renderer.invalidate(Infinity);
        // if (this.debugRect) this.debugRect.update();
        // else if (!this.parentStub)
        //     this.debugRect = require('grace/ui/recycler').ViewportVisualizer.create(
        //         this.root[0],
        //         this.renderer
        //     );
        var height =
            this.paddingTop +
            this.renderer.height +
            this.paddingBottom +
            (this.scrollPastEnd ? window.innerHeight / 3 : 0);
        this.root.css('height', height + 'px');
        this.scrollElement.css('height', height + 'px');
        if (this.bottomElement)
            this.bottomElement.css('top', this.renderer.height + 'px');
        if (this.backButton)
            this.backButton.css(
                'top',
                this.paddingTop - this.itemHeight + 'px'
            );
        if (this.$savedScroll) {
            // ScrollSaver.getScroll(this.scroller) != scroll._5sum
            this.ignoreScroll = true;
            ScrollSaver.restoreScroll(this.scroller, this.$savedScroll);
            this.$savedScroll = null;
        }
    };

    RecyclerStub.prototype.handleScroll = function (/*element*/) {
        if (this.ignoreScroll) {
            this.ignoreScroll = false;
            return;
        }
        if (this.scroller) {
            var scrollTop = ScrollSaver.getScroll(this.scroller);
            this.renderer.scrollTo(scrollTop);
        }
        this.superClass.handleScroll.apply(this, arguments);
    };

    RecyclerStub.prototype.updateVisibleItems = function (force) {
        if (force) {
            for (
                var i = Math.min(this.pageEnd, this.pageSize) - 1;
                i >= 0;
                i--
            ) {
                if (this.childViews[i].boundView) {
                    this.childViews[i].unbind();
                }
            }
        }
        this.superClass.updateVisibleItems.apply(this, [force]);
        this.renderer.paddingTop = this.paddingTop || 0;
        this.renderer.invalidate(-1);
    };

    RecyclerStub.prototype.getOrCreateView = function (i) {
        if (!this.childViews[i]) {
            this.childViews[i] = new FileItemHolder(this);
            this.renderer.register(i, this.childViews[i]);
        }
        return this.childViews[i];
    };
    RecyclerStub.prototype.closeInlineDialog = function () {
        this.superClass.closeInlineDialog.call(this);
        if (this.inlineDialogViewHolder) {
            this.renderer.unregister(this.inlineDialogViewHolder);
            this.inlineDialogViewHolder = null;
        }
    };
    RecyclerStub.prototype.showInlineDialog = function (el, m, status, p) {
        if (el) el = this.getElement(el.attr('filename'));
        this.superClass.showInlineDialog.apply(this, [
            el,
            m,
            status || 'Enter name', //Must not be empty
            p,
        ]);
        if (!el && this.inlineDialog) {
            // this.inlineDialog.css('position','absolute');
            this.inlineDialogViewHolder = {
                view: this.inlineDialog,
                renderer: this.renderer,
                //prevent detaching because it does nothing
                height: Infinity,
                render: function () {
                    this.view.css('top', this.y + 'px');
                },
                offset: this.backButton ? this.itemHeight : 0,
                compute: function () {
                    return (this.height =
                        getInlineDialogHeight(this.view, this) - this.offset);
                },
                detach: function () {
                    this.visible = false;
                },
            };
            this.renderer.register(0, this.inlineDialogViewHolder);
        }
    };
    RecyclerStub.prototype.renderView = function (index, view) {
        view.attrs = {};
        view.classes.length = 0;
        view.hidden = false;
        view.index = index;
        if (!view.view) {
            //view will be rendered in Viewholder.bindView()
            //Do only the necessary work
            var filename = this.names[index];
            view.attr('filename', filename);
            //fileNameToSelect and newFiles will be cleared after updateVisibleItems
            if (
                filename == this.fileNameToSelect ||
                (this.newFiles && this.newFiles.indexOf(filename) > -1)
            )
                //Classes added to the FileItemHolder are not reset by bindView
                view.addClass('emphasis');
            view.visible = false; //In case it was hidden
            return;
        }
        this.superClass.renderView.apply(this, [index, view.view]);
    };
    RecyclerStub.prototype.getElement = function (name) {
        for (var i in this.childViews) {
            if (this.childViews[i].attr('filename') == name)
                return this.childViews[i];
        }
        return $('nothing');
    };
    RecyclerStub.prototype.createTreeView = function () {
        var stub = this;
        stub.renderer.detach();
        stub.tree = new RecyclerNestedBrowser(
            stub.root,
            stub.rootDir,
            stub.fileServer,
            true,
            stub.renderer
        );
        stub.tree.cache = stub.cache.back || stub.cache;
        stub.tree.cache.container = stub.tree.root[0];
    };

    function getInlineDialogHeight($el, item) {
        var height = $el.height();
        if (height == 0 && !(!item.visible || item.hidden)) {
            //hack for wrong height
            return 54;
        }
        return height;
    }

    /** @constructor */
    function FileItemHolder(parent) {
        RecyclerViewHolder.apply(this, [
            parent.cache,
            parent.renderer,
            parent.itemHeight,
        ]);
        this.index = 0;
        this.boundView = false;
        this.attrs = {};
        this.classes = [];
        this.widget = null;
        this.parent = parent;
    }
    Utils.inherits(FileItemHolder, RecyclerViewHolder);
    /*Overrides*/
    FileItemHolder.prototype.compute = function () {
        return (
            (this.hidden ? 0 : this.height) +
            (this.widget ? getInlineDialogHeight(this.widget, this) : 0)
        );
    };
    //Allow element[0] access
    Object.defineProperty(FileItemHolder.prototype, '0', {
        get: function () {
            this.find(''); //force binding
            return this.boundView[0];
        },
    });
    var stats = require('grace/ui/recycler').renderStats;
    FileItemHolder.prototype.render = function (
        viewport,
        index,
        insertBefore,
        restack
    ) {
        if (this.widget) {
            this.widget.css(
                'top',
                this.y + (this.hidden ? 0 : this.height) + 'px'
            );
            if (!this.visible || restack) {
                var next = this.widget[0].nextElementSibling;
                if (insertBefore && next != insertBefore) {
                    stats.insert++;
                    this.parent.root[0].insertBefore(
                        this.widget[0],
                        insertBefore
                    );
                } else if (
                    next &&
                    !insertBefore &&
                    index != this.renderer.renderlist.length - 1
                ) {
                    stats.append++;
                    this.parent.root[0].appendChild(this.widget[0]);
                }
                arguments[2] = this.widget[0]; //insertBefore
            }
        }
        if (this.boundView && !this.view && !this.hidden) {
            this.boundView.removeClass('destroyed');
            this.view = this.boundView;
            //override for buggy typeicon
            var filename = this.attr('filename');
            if (isDirectory(filename)) {
                var cbs = this.parent.nestedViews;
                var icon = cbs
                    ? cbs[filename] && !cbs[filename].isClosed
                        ? 'folder_open'
                        : 'folder_close'
                    : 'folder';
                Icons.renderEl(this.view.find('.type-icon'), icon, filename);
            }
            if (this.widget) arguments[2] = this.widget[0];
            arguments[3] = true; //restack
        }
        RecyclerViewHolder.prototype.render.apply(this, arguments);
    };
    /*Not related to #unbind. Called by RecyclerViewHolder#render*/
    FileItemHolder.prototype.bindView = function () {
        var view = this.view;
        var filename = this.parent.names[this.index];

        this.parent.superClass.renderView.apply(this.parent, [
            this.index,
            this.view,
        ]);

        for (var i in this.attrs) {
            view.attr(i, this.attrs[i]);
        }
        for (i in this.classes) {
            view.addClass(this.classes[i]);
        }
        //override for buggy typeicon
        if (isDirectory(filename)) {
            var cbs = this.parent.nestedViews;
            var icon = cbs
                ? cbs[filename] && !cbs[filename].isClosed
                    ? 'folder_open'
                    : 'folder_close'
                : 'folder';
            Icons.renderEl(this.view.find('.type-icon'), icon, filename);
        }
    };

    FileItemHolder.prototype.detach = function () {
        if (this.boundView) {
            this.view = null;
            this.boundView.addClass('destroyed');
        }
        RecyclerViewHolder.prototype.detach.apply(this, arguments);
    };
    FileItemHolder.prototype.find = function (el) {
        //origin of buggy type-icon
        if (el === '.type-icon')
            return this.view ? this.view.find(el) : $('nothing');
        if (!this.boundView) {
            this.boundView = this.view;
            if (!this.view) {
                this.boundView = this.cache.pop();
                this.view = this.boundView;
                this.bindView();
                this.view.addClass('destroyed');
                this.view = null;
            }
        }
        return this.boundView.find(el);
    };
    FileItemHolder.prototype.unbind = function () {
        if (!this.view) {
            this.cache.push(this.boundView);
            this.lastY = null;
        }
        this.boundView = null;
    };
    //Used for creating inline dialogs
    FileItemHolder.prototype.after = function (html) {
        var view = $(html)[0];
        view.style.position = 'absolute';
        view.style.top = this.y + this.height + 'px';
        var insertBefore = this.view && this.view[0].nextElementSibling;
        if (insertBefore) {
            stats.insert++;
            this.parent.root[0].insertBefore(view, insertBefore);
        } else {
            stats.append++;
            this.parent.root[0].appendChild(view);
        }
        //Todo find a cleaner way to do this
        this.widget = $(view);
        this.widget.before = function () {
            return this;
        };
        var self = this;
        this.widget.remove = function () {
            $(view).remove();
            self.widget = null;
            self.renderer.invalidate(self);
        };
        this.renderer.invalidate(self);
        return this;
    };
    FileItemHolder.prototype.next = function () {
        return this.widget;
    };
    FileItemHolder.prototype.attr = function (key, value) {
        if (arguments.length === 1) {
            return this.attrs[key];
        } else {
            if (this.view) {
                this.view.attr(key, value);
            } else if (this.boundView) this.boundView.attr(key, value);
            if (key == 'class') {
                this.classes.length = 0;
            }
            this.attrs[key] = value;
        }
    };
    FileItemHolder.prototype.addClass = function (text) {
        if (this.view) {
            this.view.addClass(text);
        } else if (this.boundView) this.boundView.addClass(text);
        this.classes.indexOf(text) < 0 && this.classes.push(text);
        if (text == 'destroyed') {
            this.hide();
        }
    };
    FileItemHolder.prototype.hasClass = function (text) {
        return this.view
            ? this.view.hasClass(text)
            : this.classes.indexOf(text) > -1;
    };
    FileItemHolder.prototype.removeClass = function (text) {
        if (this.view) {
            this.view.removeClass(text);
        } else if (
            this.boundView &&
            text !== 'destroyed' /*Only I have the power to do that*/
        )
            this.boundView.removeClass(text);

        Utils.removeFrom(this.classes, text);
        if (text == 'destroyed') {
            this.show();
        }
    };

    function RecyclerNavBehaviour(stub) {
        this.stub = stub;
    }
    RecyclerNavBehaviour.prototype = {
        getPrev: function (/*current, root, dir, $default*/) {
            var element = this.stub.parentStub.getElement(
                this.stub.parentStub.filename(this.stub.rootDir)
            );
            if (!element) return null;
            if (!element.view) {
                element.find('');
                element.boundView.removeClass('destroyed');
            }
            return (element.view || element.boundView)[0];
        },
        getNext: function (/*current, root, dir, $default*/) {
            var parent = this.stub.parentStub;
            var index = parent.names.indexOf(
                parent.filename(this.stub.rootDir)
            );
            var element = parent.childViews[index + 1];
            //ensure nextElement to parent is visible
            if (!element) return null;
            if (!element.view) {
                element.find('');
                element.boundView.removeClass('destroyed');
            }
            return (element.view || element.boundView)[0];
        },
        detect: function () {
            return this.stub.root[0];
        },
        horizontal: true,
    };

    /*var NestedBCache = new RecyclerViewCache(function() {
        var child = $(document.createElement('ul'));
        child.addClass("fileview");
        child.addClass("fileview-recycler");
        return child;
    });
    var TempNode = document.createElement('ul');
    TempNode.className = "fileview";

    function NestedBrowserRenderer() {
        NestedBrowserRenderer.super(this, arguments);
    }
    Utils.inherits(NestedBrowserRenderer, NestedRenderer);
    NestedBrowserRenderer.prototype.detach = function() {
        this.super.detach.apply(this, arguments);
        if (this.stub && this.owner) {
            this.navBehaviour = this.stub.navBehaviour;
            this.stub.navBehaviour = null;
            NestedBCache.push(this.stub);
            this.owner.removeEvents();
            this.owner.cache.container = null;
            this.stub = null;
            //used by handleScroll
            this.owner.root = this.owner.stub = this;
        }
    };
    NestedBrowserRenderer.prototype.render = function() {
        if (!this.stub) {
            this.stub = this.owner.root = this.owner.stub = NestedBCache.pop(this.owner.getParent().root[0]);
            this.owner.cache.container = this.stub[0];
            this.stub.navBehaviour = this.navBehaviour;
            this.owner.attachEvents();
        }
        this.super.render.apply(this, arguments);
    };
    NestedBrowserRenderer.prototype.css = function(display) {
        if (display !== 'display') {
            throw 'Error: outside api';
        }
        return this.stub ? 'none' : 'block';
    };
*/
    /** @constructor */
    function RecyclerNestedBrowser(/*
    id,
    rootDir,
    fileServer,
    noReload,
    renderer*/) {
        NestedBrowser.apply(this, arguments);
        this.scrollPastEnd = true; //Will be overridden in expandFolder
    }
    Utils.inherits(RecyclerNestedBrowser, RecyclerStub, NestedBrowser);
    RecyclerNestedBrowser.prototype.superNestedBrowser = RecyclerStub.prototype;
    RecyclerNestedBrowser.prototype.mixinNestedBrowser =
        NestedBrowser.prototype;

    RecyclerNestedBrowser.prototype.getOffsetTop = function () {
        var topParent = this;
        while (topParent.getParent()) {
            topParent = topParent.getParent();
        }
        //Force rendering
        topParent.renderer.compute();
        topParent.renderer.render();
        var top = topParent.root[0].getBoundingClientRect().top;
        var parent = this;
        while (parent !== topParent) {
            top += parent.renderer.y;
            parent = parent.getParent();
        }
        return top;
    };
    RecyclerNestedBrowser.prototype.scrollItemIntoView = function (
        filename,
        updatePage
    ) {
        var top = this.showItemAndGetTop(filename, updatePage);
        if (top === false) return 'Not child';
        //Because the view might not be rendered, we can't accurately get screenTop
        var rootTop = this.getOffsetTop();
        var finalTop = rootTop + top;
        var scrollParent = this.root[0];
        var sTop, screenTop, sHeight, cHeight;
        do {
            var overY = $(scrollParent).css('overflow');
            //Assumption 1: there is only one scrollable parent.
            //Assumption 2: that parent is always on screen hence getBoundingCR is correct
            //Assumption 3: scroll parent is at least 200pixels tall
            if (overY != 'hidden' && overY != 'visible') {
                var rect = scrollParent.getBoundingClientRect();
                screenTop = rect.top;
                sTop = scrollParent.scrollTop;
                sHeight = scrollParent.scrollHeight;
                cHeight = scrollParent.clientHeight;
                if (sHeight - sTop > finalTop - screenTop) {
                    //scrolling down will bring the element into view
                    break;
                } else if (sTop > finalTop - screenTop) {
                    //scrolling up will bring the element into view
                    break;
                }
                /*else if(sHeight>cHeight){
                    scrollParent.scrollTop = sHeight - cHeight;
                    finalTop -= sHeight-cHeight;
                }*/
            }
            scrollParent = scrollParent.parentElement;
        } while (scrollParent);
        if (scrollParent) {
            var baseTop = screenTop + sTop;
            var baseBottom =
                baseTop + Math.min(window.innerHeight - 56, cHeight);
            if (finalTop < baseTop + 100 || finalTop > baseBottom - 100) {
                var targetTop = finalTop - cHeight / 2 - this.itemHeight;
                scrollParent.scrollTop = targetTop;
            }
        }
        this.scrollToRight();
    };
    RecyclerNestedBrowser.prototype.expandFolder = function (name, callback) {
        var nestedView;
        if (this.nestedViews[name])
            return this.mixinNestedBrowser.expandFolder.call(
                this,
                name,
                callback
            );
        //Copied code
        var el = this.getElement(name);
        var callback2 = function () {
            if (nestedView === this.nestedViews[name])
                this.extraSpace[this.names.indexOf(name)] =
                    nestedView.renderer.height;
            if (callback) callback(nestedView);
        }.bind(this);

        if (el.length < 1) {
            throw (
                'Not child folder ' +
                name +
                ' of ' +
                this.rootDir +
                new Error().stack
            );
        }
        var icon = el.find('.type-icon');
        Icons.renderEl(icon, 'folder_open', name);
        //will be redone in render
        //var child = NestedBCache.pop(TempNode);
        var child = $(document.createElement('ul'));
        child.addClass('fileview');
        var renderer = new NestedRenderer(child, this.renderer, this.root[0]);
        this.renderer.register(this.renderer.views.indexOf(el) + 1, renderer);
        nestedView = this.nestedViews[name] = new RecyclerNestedBrowser(
            child,
            this.childFilePath(name),
            this.fileServer,
            this,
            renderer
        );
        child[0].navBehaviour = new RecyclerNavBehaviour(nestedView);
        //renderer.owner = nestedView;
        nestedView.cache = this.cache.clone(nestedView.root[0]);
        nestedView.scrollPastEnd = !!this.isProjectView;
        nestedView.reload(false, callback2);
    };
    RecyclerNestedBrowser.prototype.clearNestedBrowsers = function () {
        for (var i in this.nestedViews) {
            this.nestedViews[i].renderer.detach();
            this.nestedViews[i].root[0].navBehaviour = null;
            this.renderer.unregister(this.nestedViews[i].renderer);
        }
        this.mixinNestedBrowser.clearNestedBrowsers.apply(this, arguments);
    };
    RecyclerNestedBrowser.prototype.close = function () {
        if (!this.isClosed) {
            this.isClosed = true;
            this.renderer.hide();
            this.handleScroll();
        }
    };
    RecyclerNestedBrowser.prototype.expand = function () {
        if (this.isClosed) {
            this.isClosed = false;
            this.renderer.show();
        }
    };
    function RProjectView(/*id, rootDir, fileServer, noReload*/) {
        ProjectView.apply(this, arguments);
    }
    Utils.inherits(RProjectView, RecyclerNestedBrowser, ProjectView);
    RProjectView.prototype.superProjectView = RecyclerNestedBrowser.prototype;
    exports.RFileBrowser = RecyclerStub;
    exports.RProjectView = RProjectView;
    exports.RNestedBrowser = RecyclerNestedBrowser;
    // for (var i in RecyclerStub.prototype) {
    //   var a = RecyclerStub.prototype,
    //     b = a[i];
    //   if (typeof b == "function")
    //     a[i] = ((i, b) =>
    //       function () {
    //         console.log(i);
    //         return b.apply(this, arguments);
    //       })(i, b);
    // }
}); /*_EndDefine*/