define(function (require, exports, module) {
    'use strict';
    var storage = require('../core/config').storage;
    var Utils = require('../core/utils').Utils;

    function _transformIndex(from, to, index) {
        var r, o; //closes known sibling to the right and offset
        for (var i = index; i < from.length; i++) {
            var t = to.indexOf(from[i]);
            if (t > -1) {
                r = t;
                o = i - index;
                break;
            }
        }
        for (i = index - 1; i > -1; i--) {
            var l = to.indexOf(from[i]);
            if (l > -1) {
                if (index - i < o) {
                    return l + 1;
                }
                return r;
            }
        }
    }

    // function _confirmSync(tabs, renderer) {
    //     try {
    //         renderer.$el.children().each(function (i) {
    //             Utils.assert(this.getAttribute(renderer.ID_ATTR) == tabs[i], tabs[i]);
    //         });
    //         console.log("in sync");
    //     } catch (e) {
    //         console.error(e);
    //     }
    // }
    function TabHost(id, renderers) {
        //Used for persistence
        this.id = id;

        //Renderers show visually depict the state of the tabhost
        //On adding a renderer, call TabHost#recreate to
        //resync the renderers with the tabhost state
        this.$renderers = renderers || [];

        //List of tab ids
        this.tabs = [];

        //List of all tabs whether loaded or not
        //When a populator loads, it can check whether
        //a tab is in isSavedTab to not add it manually
        //and instead call recreate
        //Saved Tabs are thus never deleted
        this.savedTabs = [];
        this.$fromJSON(storage.getItem(this.id) || '');

        //The first letter of a tab id shows the populator
        //m -> Docs
        //d -> Diffs
        //v -> TabWindow
        //The populator provides tab name and info
        this._populators = {};
    }
    //Internal - Controls whether the tab should reset the active tab to saved value
    TabHost.prototype.$usePersistedActive = true;
    TabHost.prototype.$toJSON = function () {
        return this.savedTabs.filter(this.getOwner, this).join(',');
    };
    TabHost.prototype.$fromJSON = function (json) {
        this.savedTabs = json.split(',').filter(Boolean);
    };
    TabHost.prototype.$persist = Utils.delay(function () {
        storage.setItem(this.id, this.$toJSON());
    }, 2000);

    TabHost.prototype.addRenderer = function (renderer) {
        this.$renderers.push(renderer);
    };

    TabHost.prototype.registerPopulator = function (char, pop) {
        this._populators[char] = pop;
    };

    TabHost.prototype.getOwner = function (id) {
        return this._populators[id] || this._populators[id[0]];
    };

    //TODO should only recreate if changed
    TabHost.prototype.recreate = function () {
        //Does 3 things,
        //Adds back closed tabs,
        //Creates views for them
        //Remove orphaned tabs
        this.tabs = this.savedTabs;
        this.$renderers.forEach(function (e) {
            e.$el.empty();
        });
        var tab;
        var id, namefile, annotations;

        function render(r) {
            tab = r.createItem(id, namefile, annotations);
            r.$el.append(tab);
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined
            );
        }
        for (var i = 0; i < this.tabs.length; ) {
            id = this.tabs[i];
            var t = this.getOwner(id) || this;
            namefile = t.getName(id);
            if (namefile) {
                annotations = t.getAnnotations(id);
                this.$renderers.forEach(render);
                i++;
            } else {
                if (!t.canDiscard || t.canDiscard(id)) {
                    this.$deleteTab(i, id);
                } else {
                    //remove from visible tabs
                    if (this.tabs === this.savedTabs) {
                        this.tabs = this.savedTabs.slice(0);
                    }
                    this.tabs.splice(i, 1);
                }
            }
        }
        // this.$renderers.forEach((r) => _confirmSync(this.tabs, r));
        this.updateActive();
    };
    TabHost.prototype.updateActive = function () {
        var active = this.active;
        if (this.$usePersistedActive) {
            active = storage.getItem(this.id + '.active');
        }
        if (this.hasTab(active)) {
            this.setActive(active, active !== this.active, true);
        } else if (this.tabs.length > 0) {
            var fallback = this.hasTab(this.active)
                ? this.active
                : this.tabs[0];
            this.setActive(fallback, fallback !== this.active, true);
        }
        if (active && this.active !== active) {
            this.$usePersistedActive = true;
            storage.setItem(this.id + '.active', active);
        }
    };

    TabHost.prototype.afterClick = Utils.noop;
    TabHost.prototype.setActive = function (id, click, scroll) {
        if (scroll) {
            this.$renderers.forEach(function (r) {
                r.scrollIntoView(r.getTabEl(id));
            });
        }
        if (click) {
            var _active = this.active;
            this.active = id;
            if (this.afterClick(id, _active) === false && this.active === id) {
                this.active = _active;
                return;
            }
        }
        this.$renderers.forEach(function (r) {
            r.setActive(r.getTabEl(this.active));
        }, this);
        if (this.$usePersistedActive) this.$usePersistedActive = false;
        storage.setItem(this.id + '.active', this.active);
    };

    //A populator might want to know if its tab is still open
    TabHost.prototype.hasTab = function (id) {
        return this.tabs.indexOf(id) > -1;
    };
    TabHost.prototype.isSavedTab = function (id) {
        return this.savedTabs.indexOf(id) > -1;
    };
    TabHost.prototype.numTabs = function () {
        return this.tabs.length;
    };
    TabHost.prototype.indexOf = function (id) {
        return this.tabs.indexOf(id);
    };

    TabHost.prototype.replaceTab = function (id, name, annotations) {
        this.$renderers.forEach(function (r) {
            var tab = r.getTabEl(id);
            var newtab = r.createItem(id, name, annotations);
            tab.before(newtab);
            tab.remove();
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined
            );
            // _confirmSync(this.tabs, r);
        }, this);
        if (id == this.active) {
            this.setActive(id, false, false);
        }
    };
    TabHost.prototype.insertTab = function (
        index,
        id,
        name,
        annotations,
        info
    ) {
        if (!index && index !== 0) index = this.tabs.indexOf(this.active);
        this.addTab(id, name, annotations, info);
        this.moveTab(index, id);
    };
    TabHost.prototype.moveTab = function (index, id, relative) {
        var oldIndex = this.tabs.indexOf(id);
        Utils.assert(oldIndex > -1, 'Tab does not exist');
        if (relative) index = oldIndex + index;
        if (index >= this.tabs.length) {
            index = this.tabs.length - 1;
            return;
        }
        if (oldIndex == index) {
            return;
        }
        //--thank You for splice
        this.tabs.splice(index, 0, this.tabs.splice(oldIndex, 1)[0]);
        if (this.tabs !== this.savedTabs) {
            //update savedTabs also
            var tIndex = this.savedTabs.indexOf(id);
            Utils.assert(tIndex > -1, 'Tab sync error');
            this.savedTabs.splice(
                _transformIndex(index),
                0,
                this.savedTabs.splice(tIndex, 1)[0]
            );
        }
        this.$persist();

        this.$renderers.forEach(function (r) {
            var oldEl = r.getTabEl(id)[0];
            if (!oldEl)
                return console.warn('Cannot move missing tab: call recreate');
            if (index < this.tabs.length - 1) {
                var beforeEl = r.getTabEl(this.tabs[index + 1])[0];
                r.$el[0].insertBefore(oldEl, beforeEl);
            } else {
                r.$el[0].appendChild(oldEl);
            }
            // _confirmSync(this.tabs, r);
        }, this);
        return true;
    };
    TabHost.prototype.$deleteTab = function (index, id) {
        this.tabs.splice(index, 1);
        if (this.tabs !== this.savedTabs) {
            //update savedTabs also
            var tIndex = this.savedTabs.indexOf(id);
            Utils.assert(tIndex > -1, 'Tab sync error');
            this.savedTabs.splice(tIndex, 1);
        }
        this.$persist();
    };
    TabHost.prototype.removeTab = function (id) {
        delete this.tempPopulators[id];
        var pos = this.tabs.indexOf(id);
        if (pos < 0) throw new Error('Item not a child');
        this.$deleteTab(pos, id);
        this.$renderers.forEach(function (r) {
            r.getTabEl(id).remove();
            // _confirmSync(this.tabs, r);
        }, this);
        if (id == this.active) {
            if (this.tabs.length > 0) {
                this.setActive(
                    this.tabs[pos - 1] || this.tabs[pos],
                    true,
                    false
                );
            }
        }
    };
    TabHost.prototype.addTab = function (id, name, annotations, info) {
        if (this.hasTab(id)) return this.replaceTab(id, name, annotations);
        if (this.isSavedTab(id)) {
            console.warn(
                'To keep tab order, do not add closed tabs. Call recreate instead'
            );
            this.savedTabs.splice(this.savedTabs.indexOf(id), 1);
        }
        this.tabs.push(id);
        if (this.tabs !== this.savedTabs) {
            //update savedTabs also
            this.savedTabs.push(id);
        }
        this.$persist();
        if (!this.getOwner(id)) {
            this.tempPopulators[id] = {
                name: name,
                annotations: annotations,
                info: info,
            };
        }

        //exactly what happens in recreate
        this.$renderers.forEach(function (r) {
            r.$el.append(r.createItem(id, name, annotations));
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined
            );
            // _confirmSync(this.tabs, r);
        }, this);
    };

    //Modify existing tabs
    TabHost.prototype.setAnnotations = function (id, annotations) {
        if (this.tempPopulators[id])
            this.tempPopulators[id].annotations = annotations;
        this.$renderers.forEach(function (r) {
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined
            );
        });
    };
    TabHost.prototype.addAnnotation = function (id, annotation) {
        if (!this.tempPopulators[id]) this.tempPopulators[id] = {};
        if (!this.tempPopulators[id].annotations)
            this.tempPopulators[id].annotations = [];
        var i = this.tempPopulators[id].annotations;
        if (i.indexOf(annotation) < 0) {
            i.push(annotation);
            this.setAnnotations(id, i);
        }
    };
    TabHost.prototype.removeAnnotation = function (id, annotation) {
        if (this.tempPopulators[id] && this.tempPopulators[id].annotations) {
            var all = this.tempPopulators[id].annotations;
            if (Utils.removeFrom(all, annotation) > -1) {
                this.setAnnotations(id, all);
            }
        }
    };
    TabHost.prototype.setName = function (id, name) {
        if (this.tempPopulators[id]) this.tempPopulators[id].name = name;
        this.replaceTab(
            id,
            name,
            (this.getOwner(id) || this).getAnnotations(id)
        );
    };

    /*Populator Interface*/
    TabHost.prototype.tempPopulators = {};
    TabHost.prototype.getAnnotations = function (id) {
        return this.tempPopulators[id] && this.tempPopulators[id].annotations;
    };
    TabHost.prototype.getName = function (id) {
        return this.tempPopulators[id] && this.tempPopulators[id].name;
    };
    TabHost.prototype.getInfo = function (id) {
        return this.tempPopulators[id].info;
    };
    exports.TabHost = TabHost;
});