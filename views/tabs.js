function PagerTab(el, container) {
    const self = this;
    var TAB = ".tab a";
    var tabs = el.find(TAB);
    tabs.each(function(e) {
        container.find($(this).attr('href')).hide();
    });
    var activeLink = tabs.filter(".active");
    if (activeLink.length < 1)
        activeLink = tabs.eq(0).addClass("active");
    var active = container.find(activeLink.attr("href"));
    active.show();
    el.on("click", TAB, function(e) {
        e.stopPropagation();
        e.preventDefault();
        if (this == activeLink[0]) return;
        if (self.beforeClick($(this), activeLink) === false)
            return;
        activeLink.removeClass("active");
        activeLink = $(this);
        activeLink.addClass("active");
        active.hide();
        active = container.find(activeLink.attr('href'));
        active.show();
    });
    this.getActivePage = function() {
        return active;
    };
    this.getActiveTab = function() {
        return activeLink;
    };
    this.goright = function() {
        prev = activeLink.parent().prev();
        prev.children('a').click();
    };
    this.goleft = function() {
        prev = activeLink.parent().next();
        prev.children('a').click();
    };
    this.delete = function(id) {
        var e = container.children("#" + id);
        e.remove();
        e = el.find(TAB).filter("[href=\"#" + id + "\"]").parent();
        e.remove();
    };
    this.select = function(id) {
        el.find(TAB).filter("[href=\"#" + id + "\"]").click();
    };
    this.add = function(id, icon, before) {
        var newTab = '<li class="tab center">\
                    <a href="#' + id + '">\
                        <i class="material-icons" style="width:100%">' + icon + '</i>\
                    </a>\
                </li>';
        if (before) {
            if (before === true) {
                el.prepend(newTab);
            }
            else {
                el.find(TAB).filter("[href=\"#" + before + "\"]").before(newTab);
            }
        }
        else el.append(newTab);
        var page = document.createElement('div');
        page.setAttribute("id", id);
        page.style.display = 'none';
        container[0].appendChild(page);
        return page;
    };
}

function DocumentTab(tabEl, listEl, infoEl) {
    var tabs = [];
    var appStorage = Modules.appStorage;
    infoEl = infoEl || $('nothing');
    var TAB = ".tab a";
    var Utils = Modules.Utils;
    var State = Modules.State;
    var createTabAnnotations = function(anno) {
        var string = '<div id="tab-annotations" style="position:absolute;left:0;right:40px;height:\'\';top:0;">';
        for (var i in anno) {
            string += '<div style="float:left;margin-bottom:20px;margin-left:2px;border-radius:50%;max-width:30px;padding:4px;" class="' + anno[i].className + '">' +
                (anno[i].content || "") + '</div>';
        }
        return string + '</div>';
    };

    var createTabEl = function(id, name, annotations) {
        return '<li draggable=true class="tab" data-file=' + id +
            '><a href=#' + id + ' >' + name +
            (annotations ? createTabAnnotations(annotations) : "") +
            '<i class="material-icons close-icon">close</i></a></li>';
    };
    var createListEl = function(id, name, annotations) {
        return '<li tabIndex=0 draggable=true class="file-item" data-file=' + id +
            '><i class="material-icons">insert_drive_file</i>' +
            '<span style="margin-left:10px">' + name +
            '</span><span class="dropdown-btn">' +
            '<i class="material-icons">close</i></span></li>';
    };

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
    };

    this.performClick = function(e) {
        e.stopPropagation();
        var id = $(this).attr("data-file");
        var target = $(e.target);
        var isClose = target.hasClass("close-icon") ||
            (target.closest(".dropdown-btn").length > 0) ||
            target.hasClass("dropdown-btn");
        if (isClose) {
            if (!self.onClose || self.onClose(id)) {
                self.removeTab(id, true);
            }
            return;
        }
        if (self.afterClick(id)) {
            self.setActive(self.active, false, this.className.indexOf('tab') < 0);
        }
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
            /*setTimeout(function(){
                this.recreate()
            })*/
        }
    }
    this.registerPopulator = function(char, pop) {
        _populators[char] = pop;
        this.notifyPopulatorLoad();
    }
    this.getName = function(id) {
        return this.tempPopulators[id].name;
    }
    this.getAnnotations = function(id) {
        return this.tempPopulators[id].annotations;
    }
    this.getInfo = function(id) {
        return this.tempPopulators[id].info;
    }
    this.recreate = function() {
        tabEl.empty();
        listEl.empty()
        var tab;
        for (var i = 0; i < tabs.length;) {
            var id = tabs[i];
            var t = this.getOwner(id) || this;
            var namefile = t.getName(id);
            if (namefile) {
                var annotations = t.getAnnotations(id)
                var tab = createTabEl(id, namefile, annotations);
                tabEl.append(tab);
                tab = createListEl(id, namefile, annotations)
                listEl.append(tab)
                i++;
            }
            else tabs.splice(i, 1);
        }
        if (this.active)
            this.setActive(this.active, false, true);
    }
    this.setActive = function(id, click, scroll) {
        var el = tabEl.find(TAB).filter("[href=\"#" + id + "\"]");
        if (scroll) {
            var menu = tabEl[0]
            var child = el.parent()[0]
            if (child) {
                menu.scrollLeft = Math.max(0, -menu.clientWidth / 2 + (child.clientWidth) / 2 + child.offsetLeft);
            }
        }
        if (click) {
            return el.click();
        }
        listEl.children(".activeTab").removeClass('activeTab');
        var list = listEl.children('[data-file="' + id + '"]');
        list.addClass('activeTab')
        //this.active = id;
        tabEl.find(".active").removeClass('active');
        el.addClass('active');
        el.parent().addClass('active');
        var owner = this.getOwner(id) || this;
        var info = owner.getInfo(id) || "&nbsp;";
        infoEl.html(info);
    }
    this.getOwner = function(id) {
        return _populators[id] || _populators[id[0]];
    }
    this.replaceTab = function(id, name, annotations) {
        var tab = tabEl.find(TAB).filter('[href="#' + id + '"]').parent();
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
    this.insertTab = function(index, id, name, annotations,info) {
        if (!index && index !== 0)
            index = tabs.indexOf(this.active);
        this.addTab(id, name, annotations,info);
        this.moveTab(index, id);
    }
    this.moveTab = function(index, id, relative) {
        var oldIndex = tabs.indexOf(id);
        Utils.assert(oldIndex > -1)
        if (relative)
            index = oldIndex + index;
        if (oldIndex == index){
            return;
        }
        if (index >= tabs.length && oldIndex === tabs.length - 1) {
            return;
        }
        var oldEl = tabEl.find(TAB).filter('[href="#' + id + '"]').parent()[0];
        if (index < tabs.length - 1) {
            var currentEl = tabEl.children(".tab")[index > oldIndex ? index + 1 : index];
            tabEl[0].insertBefore(oldEl, currentEl);
        }
        else {
            tabEl[0].appendChild(oldEl)
        }
        var oldEl = listEl.children('[data-file="' + id + '"]')[0];
        if (index < tabs.length - 1) {
            currentEl = listEl.children()[index > oldIndex ? index + 1 : index];
            listEl[0].insertBefore(oldEl, currentEl);
        }
        else {
            listEl[0].appendChild(oldEl)
        }

        //--thank You for splice
        tabs.splice(index, 0, tabs.splice(oldIndex, 1)[0]);
        this.persist()

    }
    this.removeTab = function(id, select) {
        var tab = tabEl.find(TAB).filter('[href="#' + id + '"]');
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
    this.indexOf = function(id) {
        return tabs.indexOf(id);
    }

    this.tempPopulators = {}
    this.addTab = function(id, name, annotations, info) {
        if (this.hasTab(id))
            return this.replaceTab(id, name, annotations);
        if (!this.getOwner(id)) {
            this.tempPopulators[id] = {
                name: name,
                annotations: annotations,
                info: info
            }
        }
        var tab = createTabEl(id, name, annotations);
        tabEl.append(tab);
        tab = createListEl(id, name, annotations)
        listEl.append(tab)
        tabs.push(id);
        this.persist();
    }
    this.setAnnotations = function(id, annotations) {
        var tabElement = tabEl.find(TAB).filter('[href="#' + id + '"]');
        tabElement.children('#tab-annotations').remove();
        if (annotations && annotations.length)
            tabElement.append(createTabAnnotations(annotations))
    }
    this.setName = function(id, name) {
        //var tabElement = tabEl.find(TAB).filter('[href="#' + id + '"]');
        this.replaceTab(id, name, (this.getOwner(id) || this).getAnnotations(id));
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