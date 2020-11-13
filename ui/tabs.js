function PagerTab(el) {
    const self = this;
    var tabs = el.find(".tab a");
    tabs.each(function(e) {
        $($(this).attr('href')).hide()
    })
    var activeLink = tabs.filter(".active");
    if (activeLink.length < 1)
        activeLink = tabs.eq(0).addClass("active")
    var active = $(activeLink.attr("href"))
    active.show()
    el.on("click", ".tab", function(e) {
        if (self.beforeClick)
            if (self.beforeClick($(this), activeLink) === false)
                return;
        activeLink.removeClass("active");
        activeLink = $(this).children();
        activeLink.addClass("active");
        active.hide();
        active = $(activeLink.attr('href'));
        active.show();

    });
    this.getActivePage = function() {
        return active;
    }
    this.getActiveTab = function() {
        return activeLink;
    }
    this.goright = function() {
        prev = activeLink.parent().prev()
        prev.children('a').click()
    }
    this.goleft = function() {
        prev = activeLink.parent().next()
        prev.children('a').click()
    }
    this.select = function(id) {
        el.find(".tab a").filter("[href=\"#" + id + "\"]").click()
    }
}

function DocumentTab(tabEl, listEl, infoEl) {
    var tabs = [];
    listEl = listEl || $('nothing');
    infoEl = infoEl || $('nothing');
    tabEl = tabEl || $('nothing');
    var createTabAnnotations = function(anno) {
        var string = '<div id="tab-annotations" style="position:absolute;left:0;right:40px;height:\'\';top:0;">';
        for (var i in anno) {
            string += '<div style="float:left;margin-bottom:20px;margin-left:2px;border-radius:50%;max-width:30px;padding:4px;" class="' + anno[i].className + '">' +
                (anno[i].content || "") + '</div>';
        }
        return string + '</div>';
    };
    var createTabEl = function(id, name, annotations) {
        return '<li class="tab col s4" data-file=' + id +
            '><a href=#' + id + ' >' + name +
            (annotations ? createTabAnnotations(annotations) : "") +
            '<i class="material-icons close-icon">close</i></a></li>'
    }
    var createListEl = function(id, name, annotations) {
        return '<li class="file-item" data-file=' + id +
            '><i class="material-icons">insert_drive_file</i>' +
            '<span style="margin-left:10px">' + name +
            '</span><span class="dropdown-btn">' +
            '<i class="material-icons">close</i></span></li>'
    }
    var self = this;
    var setFadeCloseIcon = function() {
        tabEl.on("mouseover", ".tab", function(ev) {
            tabEl.find(".close-icon").hide();
            $(this).find(".close-icon").fadeIn("fast");
        }).on("mouseleave", ".tab", function(ev) {
            $(this).find(".close-icon").fadeOut("fast");
        });
    };
    setFadeCloseIcon();
    this.setSingleTabs = function(val) {
        if (val) {
            tabEl.addClass('singleTab');
        }
        else {
            tabEl.removeClass('singleTab');
        }
    }

    this.performClick = function(e) {
        e.stopPropagation();
        var id = $(this).attr("data-file");
        var target = $(e.target);
        var isClose = target.hasClass("close-icon") ||
            target.closest(".dropdown-btn").length > 1 ||
            target.hasClass("dropdown-btn");
        if (isClose) {
            if (!self.onClose || self.onClose(id)) {
                self.removeTab(id, true);
            }
            return;
        }
        self.setActive(id, false, false);
        if (self.afterClick)
            self.afterClick(id);
    };
    tabEl.on("click", ".tab", this.performClick);
    listEl.on("click", "li", this.performClick);
    var persisted = false;
    this.toJSON = function() {
        return tabs.filter(this.getOwner).join(",");
    };
    this.fromJSON = function(e) {
        tabs = e.split(",").filter(this.getOwner);
    };
    this.persist = function() {
        appStorage.setItem('tabs', this.toJSON());
        persisted = true;
    };
    var _populators = {};
    this.notifyPopulatorLoad = function() {
        //Doing this ensures that addTab and removeTab are not
        //called again thereby clearing tabData
        //by tweaking hasTab for saved tabs
        //If no client calls recreate after this call
        //There might be errors in navigation
        //eg while closing tabs or dragging tabs
        //since some tabs may not correspond to 
        //actual elements
        if (!persisted) {
            var t = appStorage.getItem("tabs");
            if (t)
                this.fromJSON(t);
        }
    }
    this.registerPopulator = function(char, pop) {
        _populators[char] = pop;
        this.notifyPopulatorLoad();
    }
    this.recreate = function() {
        Utils.assert(tabs.every(this.getOwner),
            'Error: cannot recreate orphaned tabs');
        tabEl.empty();
        listEl.empty()
        var tab;
        var doc;
        for (var i = 0; i < tabs.length; i++) {
            var id = tabs[i];
            var t = this.getOwner(id);
            var namefile = t.getName(id);
            if (namefile) {
                var annotations = t.getAnnotations(id)
                var tab = createTabEl(id, namefile, annotations);
                tabEl.append(tab);
                tab = createListEl(id, namefile, annotations)
                listEl.append(tab)
            }
            else tabs = tabs.filter(function(i) {
                return i != id;
            });
        }
        if (this.active)
            this.setActive(this.active, false, true);
    }
    this.setActive = function(id, click, scroll) {
        var el = tabEl.find(".tab a").filter("[href=\"#" + id + "\"]");
        if (scroll) {
            var menu = tabEl[0]
            var child = el.parent()[0]
            if (child) {
                menu.scrollLeft = -menu.clientWidth / 2 + (child.clientWidth) / 2 + child.offsetLeft;
            }
        }
        if (click) {
            return el.click();
        }
        listEl.children().removeClass('activeTab');
        var list = listEl.children('[data-file="' + id + '"]');
        list.addClass('activeTab')
        this.active = id;
        tabEl.find(".active").removeClass('active');
        el.addClass('active');
        el.parent().addClass('active');
        var owner = this.getOwner(id);
        var info = (owner && owner.getInfo) ? owner.getInfo(id) : "";
        infoEl.html(info);
    }
    this.getOwner = function(id) {
        return _populators[id] || _populators[id[0]];
    }
    this.replaceTab = function(id, name, annotations) {
        var tab = tabEl.find(".tab a").filter('[href="#' + id + '"]').parent();
        var list = listEl.children('[data-file="' + id + '"]');
        var newTab = createTabEl(id, name, annotations);
        tab.before(newTab);
        tab.remove();
        var newList = createListEl(id, name, annotations)
        list.before(newList);
        list.remove();
        if (id == this.active) {
            this.setActive(id, false, false);
        }
    }
    this.insertTab = function(index, id, name, annotations) {
        //
    }
    this.moveTab = function(index, id) {
        //
    }
    this.removeTab = function(id, select) {
        var tab = tabEl.find(".tab a").filter('[href="#' + id + '"]');
        tab.parent().remove();
        var list = listEl.children('[data-file="' + id + '"]').remove();
        list.remove();
        if (id == this.active) {
            if (select && tabs.length > 1) {
                var i = tabs.indexOf(id);
                this.setActive(tabs[i - 1] || tabs[i + 1], true, false);
            }
        }
        tabs = tabs.filter(function(i) {
            return i != id;
        });
        this.persist();
    }
    this.hasTab = function(id) {
        return tabs.indexOf(id) > -1;
    }
    this.numTabs = function() {
        return tabs.length;
    }
    this.addTab = function(id, name, annotations) {
        if (this.hasTab(id))
            this.replaceTab(id, name, annotations);
        var tab = createTabEl(id, name, annotations);
        tabEl.append(tab);
        tab = createListEl(id, name, annotations)
        listEl.append(tab)
        tabs.push(id);
        this.persist();
    }
    this.setAnnotations = function(id, annotations) {
        var tabElement = tabEl.find(".tab a").filter('[href="#' + id + '"]');
        tabElement.children('#tab-annotations').remove();
        if (annotations && annotations.length)
            tabElement.append(createTabAnnotations(annotations))
    }

}
/*
if (false && hasParent != parent) {
    //yet to test fully
    //hosts can use this method to focus
    //and setEditor if they cannot clone
    //they can also use the instance of
    //viewPager given in onEnter to call
    //exit on the other editor
    //hosts should clear the clones on exit;
    var clone = this.views[id].clone && this.views[id].clone(editor, this);
    if (clone) {
        this.remove(id, true);
        this.add(id, clone, true);
        hasParent = false;
        Utils.assert(!clone.element.parentNode);
    }
}
*/

//allows stuff like special editors
//terminals etc to be used like sessions
function ViewPager(editor) {
    var edit = editor.container;
    if (!edit) {
        //swap on elements is supported too
        edit = editor;
        editor = null;
    }

    //these three variables must be assigned together
    //and never copied as they can change in method calls
    //whether such cases will later be called an error is not
    //yet decided
    var isIn = false,
        node = edit,
        host;

    this.views = Object.create(this.sharedViews);

    this.enter = function(id) {
        var parent = node.parentNode;
        Utils.assert(parent, 'No parent node')
        if (id && this.views[id]) {
            var hasParent = this.views[id].element.parentNode;
            var newhost = this.views[id];
            //newhost == host => hasParent
            //even when element changes
            //but in future,
            //we might use cloned newhost
            if (!hasParent) { //&& newhost != host) {
                if (host)
                    host.onExit && host.onExit();
                /*start switch*/
                node.remove();
                node = newhost.element;
                host = newhost;
                isIn = id;
                parent.appendChild(node);
                /*end switch*/
                newhost.onEnter && newhost.onEnter(editor, this);
            }
            else isIn = id;
            host.swapDoc && host.swapDoc(isIn);
        }
        else if (isIn) {
            host.onExit && host.onExit();
            /*start switch*/
            node.remove()
            node = edit;
            host = null;
            isIn = false;
            parent.appendChild(node);
            /*end switch*/
            if (editor)
                editor.renderer.updateFull();
        }
    }
    this.exit = function() {
        this.enter(null);
    }
    //the clone parameter is not yet suppirted
    //don't use it
    this.remove = function(id, clone) {
        var views = clone ? this.views : this.sharedViews;
        delete views[id];
        //this can cause
        //recursive calls to enter
        if (id == isIn)
            this.exit();
    }
    this.add = function(id, host, clone) {
        var views = clone ? this.views : this.sharedViews;
        if (views.hasOwnProperty(id)) {
            throw 'Error id already taken'
        }
        else views[id] = host;
    }
    this.onChangeTab = (function(e) {
        if (isIn && !this.views[e.tab]) {
            this.exit();
        }
        else if (this.views[e.tab]) {
            this.enter(e.tab);
            e.preventDefault();
        }
    }).bind(this);
    var detached;
    this.onChangeEditor = (function(e) {
        if (e.editor != editor) {
            if (!detached) {
                e.target.off('changeTab', this.onChangeTab);
                detached = true;
            }
        }
        else if (detached) {
            e.target.on('changeTab', this.onChangeTab);
            detached = false;
        }
    }).bind(this);
    this.onCloseEditor = (function(e) {
        if (e.editor === editor) {
            this.detach(e.target);
            if (isIn)
                this.exit();
        }
    }).bind(this);
    this.attach = function(app) {
        detached = false;
        app.on('changeTab', this.onChangeTab);
        app.on('closeTab', this.onCloseTab);
        if (editor) {
            app.on('changeEditor', this.onChangeEditor);
            app.on('closeEditor', this.onCloseEditor);
        }
    }
    this.detach = function(app) {
        app.off('changeTab', this.onChangeTab);
        app.off('closeTab', this.onCloseTab);
        if (editor) {
            app.off('changeEditor', this.onChangeEditor);
            app.off('closeEditor', this.onCloseEditor);
        }

    }
}
ViewPager.prototype.sharedViews = {}
//Nice Way to have a doc that opens in a separate editor
ViewPager.createEditorHost = function(editor) {
    return {
        element: editor.container,
        onEnter: undefined,
        swapDoc: function(id) {
            editor.setSession(docs[id].session);
        },
        onExit: undefined,
    }
}
ViewPager.createEmptyHost = function(el) {
    return {
        element: el,
        onEnter: undefined,
        swapDoc: undefined,
        onExit: undefined,
    }
}