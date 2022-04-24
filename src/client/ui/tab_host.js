define(function(require, exports, module) {
    var appStorage = require("../core/config").appStorage;
    var Utils = require("../core/utils").Utils;

    function TabHost(id, renderers) {
        //Renderers show visually depict the state of the tabhost
        //On adding a renderer, call TabHost#recreate to
        //resync the renderers with the tabhost state
        this.$renderers = renderers || [];

        //When the tabhost tries to load a tab,
        //and which has no populator,
        //it stores the tab id here.
        //When the populator loads, it can check whether,
        //the tab is discarded in isClosedTab and add it back
        this.oldTabs = [];

        //List of tab id
        this.tabs = [];

        //The first letter of a tab id shows the populator
        //m -> Docs
        //d -> Diffs
        //v -> TabWindow
        //The populator provides tab name and info
        this._populators = {};

        //Used for persistence
        this.id = id;
        this.persisted = true;
    }
    //Internal - Controls whether the tab should reset the active tab to saved value
    TabHost.prototype.$usePersistedActive = true;

    TabHost.prototype.addRenderer = function(renderer) {
        this.$renderers.push(renderer);
    };

    TabHost.prototype.registerPopulator = function(char, pop) {
        this._populators[char] = pop;
    };

    TabHost.prototype.toJSON = function() {
        return this.tabs.filter(this.getOwner, this).join(",");
    };
    TabHost.prototype.fromJSON = function() {
        var e = appStorage.getItem(this.id) || "";
        var savedTabs = e.split(",");
        //It is unlikely that any new this.tabs will not be saved
        //but to be on the safe side
        this.tabs = savedTabs.concat(this.tabs.filter(Utils.notIn(
            savedTabs)));
    };
    TabHost.prototype.updateActive = function() {
        if (this.$usePersistedActive) {
            var active = appStorage.getItem(this.id + ".active");
            if (this.hasTab(active)) {
                this.setActive(active, true, true);
            } else if (this.tabs.length > 0) {
                this.setActive(this.tabs[0], true, true);
            }
            if (active && this.active !== active) {
                this.$usePersistedActive = true;
                appStorage.setItem(this.id + ".active", active);
            }
        }
    };
    TabHost.prototype.persist = function() {
        appStorage.setItem(this.id, this.toJSON());
        this.persisted = true;
    };

    TabHost.prototype.isClosedTab = function(id) {
        return this.oldTabs.indexOf(id) < 0;
    };
    //todo only recreate if changed
    TabHost.prototype.recreate = function() {
        this.$renderers.forEach(function(e) {
            e.$el.empty();
        });
        var tab;
        this.oldTabs = [];
        var id, namefile, annotations;

        function render(r) {
            tab = r.createItem(id, namefile, annotations);
            r.$el.append(tab);
            r.setAnnotations(
                id,
                annotations && annotations.length ? r
                .createAnnotationItem(annotations) : undefined
            );
        }
        for (var i = 0; i < this.tabs.length;) {
            id = this.tabs[i];
            var t = this.getOwner(id) || this;
            namefile = t.getName(id);
            if (namefile) {
                annotations = t.getAnnotations(id);
                this.$renderers.forEach(render);
                i++;
            } else this.oldTabs.push(this.tabs.splice(i, 1)[0]);
        }
        if (this.active && this.hasTab(this.active)) this.setActive(
            this.active, false, true);
    };
    TabHost.prototype.setActive = function(id, click, scroll) {
        console.log({id});
        if (scroll) {
            this.$renderers.forEach(function(r) {
                r.scrollIntoView(r.getTabEl(id));
            });
        }
        if (click) {
            var _active = this.active;
            this.active = id;
            if (this.afterClick(id, _active) === false) {
                this.active = _active;
                return;
            }
        }
        this.$renderers.forEach(function(r) {
            r.setActive(r.getTabEl(id));
        });
        if (this.$usePersistedActive) this.$usePersistedActive =
            false;
        appStorage.setItem(this.id + ".active", this.active);
    };
    TabHost.prototype.getOwner = function(id) {
        return this._populators[id] || this._populators[id[0]];
    };

    //A populator might want to know is its tab is still open
    TabHost.prototype.hasTab = function(id) {
        return this.tabs.indexOf(id) > -1;
    };
    TabHost.prototype.numTabs = function() {
        return this.tabs.length;
    };
    TabHost.prototype.indexOf = function(id) {
        return this.tabs.indexOf(id);
    };

    TabHost.prototype.replaceTab = function(id, name, annotations) {
        this.$renderers.forEach(function(r) {
            var tab = r.getTabEl(id);
            var newtab = r.createItem(id, name,
                annotations);
            tab.before(newtab);
            tab.remove();
            r.setAnnotations(
                id,
                annotations && annotations.length ? r
                .createAnnotationItem(annotations) :
                undefined
            );
        });
        if (id == this.active) {
            this.setActive(id, false, false);
        }
    };
    TabHost.prototype.insertTab = function(index, id, name, annotations,
        info) {
        if (!index && index !== 0) index = this.tabs.indexOf(this
            .active);
        this.addTab(id, name, annotations, info);
        this.moveTab(index, id);
    };
    TabHost.prototype.moveTab = function(index, id, relative,
        isOldTab) {
        var oldIndex = this.tabs.indexOf(id);
        Utils.assert(oldIndex > -1, "Tab does not exist");
        if (relative) index = oldIndex + index;
        if (oldIndex == index) {
            return;
        }
        if (index >= this.tabs.length && oldIndex === this.tabs
            .length - 1) {
            return;
        }
        this.$renderers.forEach(function(r) {
            var oldEl = r.getTabEl(id)[0];
            if (!oldEl) return console.warn(
                "Cannot move missing tab: call recreate"
                );
            if (index < this.tabs.length - 1) {
                var beforeEl = r.getTabEl(this.tabs[index >
                    oldIndex ? index + 1 : index])[0];
                r.$el[0].insertBefore(oldEl, beforeEl);
            } else {
                r.$el[0].appendChild(oldEl);
            }
        }, this);
        //--thank You for splice
        this.tabs.splice(index, 0, this.tabs.splice(oldIndex, 1)[
            0]);
        if (!isOldTab) this.persist();
        return true;
    };
    TabHost.prototype.removeTab = function(id) {
        delete this.tempPopulators[id];
        this.$renderers.forEach(function(r) {
            r.getTabEl(id).remove();
        });
        var pos = this.tabs.indexOf(id);
        if (pos < 0) throw new Error("Item not a child");
        this.tabs.splice(pos, 1);
        if (id == this.active) {
            if (this.tabs.length > 0) {
                this.setActive(this.tabs[pos - 1] || this.tabs[pos],
                    true, false);
            }
        }
        this.persist();
    };
    TabHost.prototype.addTab = function(id, name, annotations, info) {
        if (this.hasTab(id)) return this.replaceTab(id, name,
            annotations);
        if (!this.getOwner(id)) {
            this.tempPopulators[id] = {
                name: name,
                annotations: annotations,
                info: info,
            };
        }
        this.$renderers.forEach(function(r) {
            r.$el.append(r.createItem(id, name,
                annotations));
            r.setAnnotations(
                id,
                annotations && annotations.length ? r
                .createAnnotationItem(annotations) :
                undefined
            );
        });
        this.tabs.push(id);
        var index = this.oldTabs.indexOf(id);
        if (index > -1) {
            var pos = 0;
            var insertPt = 0;
            for (var i = index - 1; i > -1; i--) {
                pos = this.tabs.indexOf(this.oldTabs[i]);
                if (pos > -1) {
                    insertPt = pos + 1;
                    break;
                }
            }
            if (!insertPt)
                for (i = index + 1; i < this.oldTabs.length; i++) {
                    pos = this.tabs.indexOf(this.oldTabs[i]);
                    if (pos > -1) {
                        insertPt = pos;
                        break;
                    }
                }
            this.moveTab(insertPt, id, false, true);
            if (this.persisted) this.persist();
        } else this.persist();
    };
    TabHost.prototype.afterClick = Utils.noop;

    TabHost.prototype.setAnnotations = function(id, annotations) {
        if (this.tempPopulators[id]) this.tempPopulators[id]
            .annotations = annotations;
        this.$renderers.forEach(function(r) {
            r.setAnnotations(
                id,
                annotations && annotations.length ? r
                .createAnnotationItem(annotations) :
                undefined
            );
        });
    };
    TabHost.prototype.addAnnotation = function(id, annotation) {
        if (!this.tempPopulators[id]) this.tempPopulators[id] = {};
        if (!this.tempPopulators[id].annotations) this
            .tempPopulators[id].annotations = [];
        var i = this.tempPopulators[id].annotations;
        if (i.indexOf(annotation) < 0) {
            i.push(annotation);
            this.setAnnotations(id, i);
        }
    };
    TabHost.prototype.removeAnnotation = function(id, annotation) {
        if (this.tempPopulators[id] && this.tempPopulators[id]
            .annotations) {
            var all = this.tempPopulators[id].annotations;
            var index = all.indexOf(annotation);
            if (index > -1) {
                all.splice(index, 1);
                this.setAnnotations(id, all);
            }
        }
    };
    TabHost.prototype.setName = function(id, name) {
        if (this.tempPopulators[id]) this.tempPopulators[id].name =
            name;
        this.replaceTab(id, name, (this.getOwner(id) || this)
            .getAnnotations(id));
    };

    /*Populator Interface*/
    TabHost.prototype.tempPopulators = {};
    TabHost.prototype.getAnnotations = function(id) {
        return this.tempPopulators[id] && this.tempPopulators[id]
            .annotations;
    };
    TabHost.prototype.getName = function(id) {
        return this.tempPopulators[id] && this.tempPopulators[id]
            .name;
    };
    TabHost.prototype.getInfo = function(id) {
        return this.tempPopulators[id].info;
    };
    exports.TabHost = TabHost;
});