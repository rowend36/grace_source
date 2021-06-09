_Define(function (global) {
  "use strict";
  var FileBrowser = global.FileBrowser;
  var Hierarchy = global.Hierarchy;
  var ChildStub = global.NestedBrowser;
  var RecyclerViewHolder = global.RecyclerViewHolder;
  var RecyclerViewCache = global.RecyclerViewCache;
  var FastCache = global.FastCache;
  var RecyclerRenderer = global.RecyclerRenderer;
  var ScrollSaver = global.ScrollSaver;
  var NestedRenderer = global.NestedRenderer;
  var isDirectory = global.FileUtils.isDirectory;
  /**@constructor
   * 
   */
  function RecyclerStub(id, rootDir, fileServer, noReload, renderer) {
    //INITIAL IDEA
    //The height depends
    //on childStubs and extraSpaces
    //the y depends on height of above elements
    //getOrCreateViews return viewholders to store attr,class,visibility
    //pagesize is infinite, pageStart is 0
    this.cache = new FastCache(
      new RecyclerViewCache(function () {
        var view = document.createElement("div");
        view.innerHTML =
          "<li class=\"file-item\" style='position:absolute;top:0px;'><span><i class = 'type-icon material-icons'>folder</i></span><span class='filename'>" +
          '</span><span class="dropdown-btn right" data-target="">' +
          '<i class="material-icons" >more_vert</i>' +
          "</span><span class= 'file-info'></span></li></li>";
        return $(view.children[0]);
      }, null),
      true
    );
    this.renderer = renderer || new RecyclerRenderer();
    this.renderer.beforeRender = this.onBeforeRender.bind(this);
    FileBrowser.call(this, id, rootDir, fileServer, noReload);
  }
  RecyclerStub.prototype = Object.create(FileBrowser.prototype);
  RecyclerStub.prototype.constructor = RecyclerStub;
  RecyclerStub.prototype.superClass = FileBrowser.prototype;
  RecyclerStub.prototype.createView = function (stub) {
    this.superClass.createView.apply(this, arguments);
    this.scrollElement = $(document.createElement("div"));
    this.scrollElement.css("position", "absolute");
    this.scrollElement.css("top", "0px");
    this.scrollElement.css("width", "2px");
    this.scrollElement.css("visibility", "hidden");
    this.root[0].appendChild(this.scrollElement[0]);
    this.scrollElement.css("height", "0px");
    this.root.addClass("fileview-recycler");
    this.cache.container = this.root[0];
    if (this.renderer) this.renderer.views = [];
  };
  RecyclerStub.prototype.pageSize = 1000;
  RecyclerStub.prototype.destroy = function () {
    this.renderer.detach();
    this.renderer.views = null;
    this.renderer.beforeRender = true;
    this.cache = null;
    this.superClass.destroy.apply(this, arguments);
  };
  RecyclerStub.prototype.onBeforeRender = function () {
    var scroll;
    if (this.scroller && this.renderer.height > this.renderer.viewport.y * 2)
      scroll = ScrollSaver.saveScroll(this.scroller);
    //this.renderer.invalidate(Infinity);
    //if(this.debugRect)this.debugRect.update();
    //else if(!this.parentStub)this.debugRect = global.ViewportVisualizer.create(this.root[0],this.renderer);
    this.root.css(
      "height",
      this.paddingTop + this.renderer.height + this.paddingBottom + "px"
    );
    this.scrollElement.css(
      "height",
      this.paddingTop +
        this.renderer.height +
        this.paddingBottom +
        window.innerHeight / 2 +
        "px"
    );
    this.bottomElement &&
      this.bottomElement.css("top", this.renderer.height + "px");
    if (scroll && ScrollSaver.getScroll(this.scroller) != scroll._5sum) {
      this.ignoreScroll = true;
      ScrollSaver.restoreScroll(this.scroller, scroll);
    }
  };

  RecyclerStub.prototype.handleScroll = function (element) {
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
      for (var i = Math.min(this.pageEnd, this.pageSize); i > 0; ) {
        if (this.childViews[--i].bound) {
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
    if (this.inlineDialogStub) this.inlineDialogStub.removeClass("destroyed");
    if (this.inlineDialog) this.inlineDialog.detach();
    this.inlineDialog = this.inlineDialogStub = null;
    if (this.inlineDialogViewHolder) {
      this.renderer.unregister(this.inlineDialogViewHolder);
      this.inlineDialogViewHolder = null;
    }
  };
  RecyclerStub.prototype.showInlineDialog = function (el, m, status, p) {
    if (el) el = this.getElement(el.attr("filename"));
    this.superClass.showInlineDialog.apply(this, [
      el,
      m,
      status || "Enter name",
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
          this.view.css("top", this.y + "px");
        },
        offset: this.backButton ? this.itemHeight : 0,
        compute: function () {
          return getHeight(this.view, this) - this.offset;
        },
        detach: function (index) {
          this.visible = false;
        },
      };
      this.renderer.register(0, this.inlineDialogViewHolder);
    }
  };
  RecyclerStub.prototype.renderView = function (index, view) {
    view.attrs = {};
    view.attr("filename", this.hier[index]);
    view.classes.length = 0;
    view.index = index;
    view.hidden = false;
    if (!view.view) {
      view.visible = false;
      //view will be rendered in Viewholder.bindView()
      return;
    }
    this.superClass.renderView.apply(this, [index, view.view]);
  };
  RecyclerStub.prototype.getElement = function (name) {
    for (var i in this.childViews) {
      if (this.childViews[i].attr("filename") == name)
        return this.childViews[i];
    }
    return $("nothing");
  };
  RecyclerStub.prototype.createTreeView = function () {
    var stub = this;
    stub.tree = new RecyclerChildStub(
      stub.root,
      stub.rootDir,
      stub.fileServer,
      true
    );
    stub.tree.cache = stub.cache.back || stub.cache;
    stub.tree.cache.container = stub.tree.root[0];
    stub.renderer.detach();
  };

  function getHeight($el, item) {
    //hack for wrong height
    var height = $el.height();
    if ((height == 0 && !item.visible) || item.hidden) {
      return 54;
    }
    return height;
  }

  function FileItemHolder(browser) {
    RecyclerViewHolder.apply(this, [
      browser.cache,
      browser.renderer,
      browser.itemHeight,
    ]);
    this.bound = false;
    this.attrs = {};
    this.classes = [];
    this.widget = null;
    this.browser = browser;
  }
  FileItemHolder.prototype = Object.create(RecyclerViewHolder.prototype);
  FileItemHolder.prototype.constructor = FileItemHolder;
  /*Overrides*/
  FileItemHolder.prototype.compute = function () {
    return (
      (this.hidden ? 0 : this.height) +
      (this.widget ? getHeight(this.widget, this) : 0)
    );
  };
  Object.defineProperty(FileItemHolder.prototype, "0", {
    get: function () {
      this.find("");
      return this.bound[0];
    },
  });
  FileItemHolder.prototype.render = function (
    viewport,
    index,
    insertBefore,
    restack
  ) {
    if (this.widget) {
      this.widget.css("top", this.y + (this.hidden ? 0 : this.height) + "px");
      if (!this.visible || restack) {
        var next = this.widget[0].nextElementSibling;
        if (insertBefore && next != insertBefore) {
          this.browser.root[0].insertBefore(this.widget[0], insertBefore);
        } else if (
          next &&
          !insertBefore &&
          i != this.renderer.renderlist.length - 1
        ) {
          this.browser.root[0].appendChild(this.widget[0]);
        }
        arguments[2] = this.widget[0];
      }
    }
    if (this.bound && !this.view && !this.hidden) {
      this.bound.removeClass("destroyed");
      this.view = this.bound;
      var cbs = this.browser.childStubs;
      //override for buggy typeicon
      var filename = this.attr("filename");
      if (isDirectory(filename)) {
        if (cbs && cbs[filename] && !cbs[filename].renderer.hidden) {
          this.view.find(".type-icon").text("folder_open");
        } else this.view.find(".type-icon").text("folder");
      }
      if (this.widget) arguments[2] = this.widget[0];
      arguments[3] = true;
    }
    RecyclerViewHolder.prototype.render.apply(this, arguments);
  };
  FileItemHolder.prototype.unbind = function () {
    if (!this.view) {
      this.cache.push(this.bound);
      this.lastY = null;
    }
    this.bound = null;
  };
  FileItemHolder.prototype.detach = function () {
    if (this.bound) {
      this.view = null;
      this.bound.addClass("destroyed");
    }
    RecyclerViewHolder.prototype.detach.apply(this, arguments);
  };
  FileItemHolder.prototype.bindView = function () {
    var view = this.view;
    var filename = this.browser.hier[this.index];

    this.browser.superClass.renderView.apply(this.browser, [
      this.index,
      this.view,
    ]);
    //override for buggy typeicon

    for (var i in this.attrs) {
      view.attr(i, this.attrs[i]);
    }
    for (i in this.classes) {
      view.addClass(this.classes[i]);
    }
    if (isDirectory(filename)) {
      var cbs = this.browser.childStubs;
      if (cbs && cbs[filename] && !cbs[filename].renderer.hidden) {
        view.find(".type-icon").text("folder_open");
      } else view.find(".type-icon").text("folder");
    }
  };
  FileItemHolder.prototype.find = function (el) {
    //origin of buggy type-icon
    if (el === ".type-icon")
      return this.view ? this.view.find(el) : $("nothing");
    if (!this.bound) {
      this.bound = this.view;
      if (!this.view) {
        this.bound = this.cache.pop();
        this.view = this.bound;
        this.bindView();
        this.view.addClass("destroyed");
        this.view = null;
      }
    }
    return this.bound.find(el);
  };
  FileItemHolder.prototype.after = function (el) {
    var view = document.createElement("div");
    view.innerHTML = el;
    view = view.children[0];
    view.style.position = "absolute";
    view.style.top = this.y + this.height + "px";
    var insertBefore = this.view && this.view[0].nextElementSibling;
    if (insertBefore) {
      this.browser.root[0].insertBefore(view, insertBefore);
    } else {
      this.browser.root[0].appendChild(view);
    }
    this.widget = $(view);
    this.widget.before = function () {
      return this;
    };
    var self = this;
    this.widget.detach = function () {
      view.parentElement.removeChild(view);
      self.widget = null;
      self.renderer.invalidate(self);
    };
    this.renderer.invalidate(self);
    return this;
  };
  FileItemHolder.prototype.attr = function (
    text,
    value = FileItemHolder.prototype.null
  ) {
    if (value == this.null) {
      return this.attrs[text];
    } else {
      if (this.view) {
        this.view.attr(text, value);
      } else if (this.bound) this.bound.attr(text, value);
      if (text == "class") {
        this.classes.length = 0;
      }
      this.attrs[text] = value;
    }
  };
  FileItemHolder.prototype.next = function (el) {
    return this.widget;
  };
  FileItemHolder.prototype.addClass = function (text) {
    if (this.view) {
      this.view.addClass(text);
    } else if (this.bound) this.bound.addClass(text);
    this.classes.indexOf(text) < 0 && this.classes.push(text);
    if (text == "destroyed") {
      this.hide();
    }
  };
  FileItemHolder.prototype.hasClass = function (text) {
    return this.view
      ? this.view.hasClass(text)
      : this.classes.indexOf(text) > -1;
  };
  FileItemHolder.prototype.null = {};
  FileItemHolder.prototype.removeClass = function (text) {
    if (this.view) {
      this.view.removeClass(text);
    } else if (
      this.bound &&
      text !== "destroyed" /*Only I have the power to do that*/
    )
      this.bound.removeClass(text);

    var index = this.classes.indexOf(text);
    index > -1 && this.classes.splice(index, 1);
    if (text == "destroyed") {
      this.show();
    }
  };

  function RecyclerNavBehaviour(stub) {
    this.stub = stub;
  }
  RecyclerNavBehaviour.prototype = {
    getPrev: function (current, root, dir, $default) {
      var element = this.stub.parentStub.getElement(
        this.stub.parentStub.filename(this.stub.rootDir)
      );
      if (!element) return null;
      if (!element.view) {
        element.find("");
        element.bound.removeClass("destroyed");
      }
      return (element.view || element.bound)[0];
    },
    getNext: function (current, root, dir, $default) {
      var parent = this.stub.parentStub;
      var index = parent.hier.indexOf(parent.filename(this.stub.rootDir));
      var element = parent.childViews[index + 1];
      //ensure nextElement to parent is visible
      if (!element) return null;
      if (!element.view) {
        element.find("");
        element.bound.removeClass("destroyed");
      }
      return (element.view || element.bound)[0];
    },
    detect: function () {
      return this.stub.root[0];
    },
    horizontal: true,
  };

  /*var NestedBCache = new RecyclerViewCache(function() {
        var childStub = $(document.createElement('ul'));
        childStub.addClass("fileview");
        childStub.addClass("fileview-recycler");
        return childStub;
    });
    var TempNode = document.createElement('ul');
    TempNode.className = "fileview";

    function ChildStubRenderer() {
        ChildStubRenderer.super(this, arguments);
    }
    Utils.inherits(ChildStubRenderer, NestedRenderer);
    ChildStubRenderer.prototype.detach = function() {
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
    ChildStubRenderer.prototype.render = function() {
        if (!this.stub) {
            this.stub = this.owner.root = this.owner.stub = NestedBCache.pop(this.owner.getParent().root[0]);
            this.owner.cache.container = this.stub[0];
            this.stub.navBehaviour = this.navBehaviour;
            this.owner.attachEvents();
        }
        this.super.render.apply(this, arguments);
    };
    ChildStubRenderer.prototype.css = function(display) {
        if (display !== 'display') {
            throw 'Error: outside api';
        }
        return this.stub ? 'none' : 'block';
    };
*/
  function RecyclerChildStub(
    id,
    rootDir,
    fileServer,
    noReload = true,
    renderer = null
  ) {
    this.childStubs = {};
    if (noReload && typeof noReload == "object") {
      this.setParent(noReload);
    }
    RecyclerStub.apply(this, arguments);
  }
  RecyclerChildStub.prototype = Object.create(RecyclerStub.prototype);
  RecyclerChildStub.prototype.constructor = RecyclerChildStub;
  Object.assign(RecyclerChildStub.prototype, ChildStub.prototype);
  RecyclerChildStub.prototype.superChildStub = RecyclerStub.prototype;
  RecyclerChildStub.prototype.onChildRender = function () {
    this.root.css(
      "height",
      this.paddingTop + this.renderer.height + this.paddingBottom + "px"
    );
  };
  RecyclerChildStub.prototype.mixinChildStub = ChildStub.prototype;
  RecyclerChildStub.prototype.constructor = RecyclerChildStub;

  RecyclerChildStub.prototype.scrollItemIntoView = function (
    filename,
    updatePage
  ) {
    var self = this;
    var i = this.hier.indexOf(filename);
    if (i < 0 && !isDirectory(filename)) {
      filename += "/";
      i = this.hier.indexOf(filename);
    }
    if (i < 0) return "Not Child";

    var pageStart = Math.floor(i / this.pageSize) * this.pageSize;
    if (pageStart != this.pageStart && updatePage) {
      self.pageStart = pageStart;
      self.updateVisibleItems(true);
      self.updateBottomElements();
    } else self.pageStart = pageStart;
    var top = this.getItemTop(i);
    //because we can't accurately get screenTop without knowing scroll
    var rootTop = this.getOffsetTop();
    var finalTop = rootTop + top;
    var scrollParent = this.root[0];
    var sTop, screenTop, sHeight, cHeight;
    do {
      var overY = $(scrollParent).css("overflow");
      //Assumption 1: there is only one scrollable parent.
      //Assumption 2: that parent is always on screen2
      //Assumption 3: scroll parent is at least 200pixels tall
      if (overY != "hidden" && overY != "visible") {
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
      var baseBottom = baseTop + cHeight;
      if (finalTop < baseTop + 100 || finalTop > baseBottom - 100) {
        var targetTop = finalTop - cHeight / 2 - this.itemHeight;
        scrollParent.scrollTop = targetTop;
      }
    }
    scrollParent = this.root[0];
    var finalLeft = scrollParent.getBoundingClientRect().left;
    do {
      if (scrollParent.scrollWidth > scrollParent.clientWidth) {
        if (scrollParent.scrollWidth - scrollParent.scrollLeft > finalLeft) {
          break;
        } else {
          //nested scroll
        }
      }
      scrollParent = scrollParent.parentElement;
    } while (scrollParent);
    if (scrollParent) {
      scrollParent.scrollLeft += finalLeft;
    }
  };
  RecyclerChildStub.prototype.expandFolder = function (name, callback) {
    var el = this.getElement(name);
    var callback2 = function () {
      this.extraSpace[this.hier.indexOf(name)] = this.childStubs[
        name
      ].renderer.height;
      if (callback) callback(this.childStubs[name]);
    }.bind(this);

    if (el.length < 1) {
      throw (
        "Not child folder " + name + " of " + this.rootDir + new Error().stack
      );
    }
    var icon = el.find(".type-icon");
    icon.text("folder_open");
    if (!this.childStubs[name]) {
      //will be redone in render
      //var childStub = NestedBCache.pop(TempNode);
      var childStub = $(document.createElement("ul"));
      childStub.addClass("fileview");
      var renderer = new NestedRenderer(childStub, this.renderer, this.root[0]);
      this.renderer.register(this.renderer.views.indexOf(el) + 1, renderer);
      this.childStubs[name] = new RecyclerChildStub(
        childStub,
        this.childFilePath(name),
        this.fileServer,
        this,
        renderer
      );
      childStub[0].navBehaviour = new RecyclerNavBehaviour(
        this.childStubs[name]
      );
      //renderer.owner = this.childStubs[name];
      this.childStubs[name].cache = this.cache.clone(
        this.childStubs[name].root[0]
      );
      this.childStubs[name].renderer.onBeforeRender = this.onChildRender.bind(
        this.childStubs[name]
      );
      this.childStubs[name].reload(false, callback2);
    } else {
      this.childStubs[name].stub.show();
      this.childStubs[name].renderer.show();
      if (callback) setTimeout(callback2, 1);
      else callback2();
    }
  };
  RecyclerChildStub.prototype.getOffsetTop = function () {
    var top = 0;
    var parent = this;
    while (parent.getParent()) {
      top += parent.renderer.y;
      parent = parent.getParent();
    }
    top += parent.root[0].getBoundingClientRect().top;
    return top;
  };
  RecyclerChildStub.prototype.clearChildStubs = function () {
    for (var i in this.childStubs) {
      this.childStubs[i].renderer.detach();
      this.childStubs[i].root[0].navBehaviour = null;
      this.renderer.unregister(this.childStubs[i].renderer);
    }
    this.mixinChildStub.clearChildStubs.apply(this, arguments);
  };
  RecyclerChildStub.prototype.foldFolder = function (name) {
    this.mixinChildStub.foldFolder.bind(this).apply(this, arguments);
    var fb = this.childStubs[name];
    if(fb.inSelectMode)
        fb.exitSelectMode();
    fb.renderer.hide();
    this.handleScroll();
  };

  function RecyclerHierarchy(id, rootDir, fileServer, noReload) {
    Hierarchy.apply(this, arguments);
  }
  RecyclerHierarchy.prototype = Object.create(RecyclerChildStub.prototype);
  RecyclerHierarchy.prototype.constructor = RecyclerHierarchy;
  Object.assign(RecyclerHierarchy.prototype, Hierarchy.prototype);
  RecyclerHierarchy.prototype.superHierarchy = RecyclerChildStub.prototype;
  global.RFileBrowser = RecyclerStub;
  global.RHierarchy = RecyclerHierarchy;
  global.RNestedBrowser = RecyclerChildStub;
}); /*_EndDefine*/