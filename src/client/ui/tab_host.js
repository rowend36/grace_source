define(function (require, exports, module) {
    'use strict';
    var Utils = require('../core/utils').Utils;
    var Store = require('../core/store').Store;
    function _transformIndex(from, to, index) {
        var r, o=Infinity; //closes known sibling to the right and offset
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
    // var dup = (e, i, a) => a.indexOf(e, i + 1) > -1;
    // var _check2 = function (t) {
    //     if (t.oldTabs) {
    //         console.log('Added ', t.tabs.filter(Utils.notIn(t.oldTabs)));
    //         console.log('Removed ', t.oldTabs.filter(Utils.notIn(t.tabs)));
    //     }
    //     Utils.assert(Object.keys(t.tempData).filter(t.getOwner, t).length == 0,'Temp with owner');
    //     t.oldTabs = t.tabs.slice(0);
    //     Utils.assert(t.tabs.filter(dup).length == 0, 'Duplicate');
    //     Utils.assert(t.store.get().filter(dup).length == 0, 'Duplicate');
    //     Utils.assert(
    //         t.tabs
    //             .filter(Utils.notIn(t.store.get()))
    //             .filter(Utils.notIn(Object.keys(t.tempData))).length === 0,
    //         'Tab sync error',
    //     );
    // };
    // function _confirmSync(tabs, renderer) {
    //     try {
    //         renderer.$el.children().each(function (i) {
    //             Utils.assert(this.getAttribute(renderer.ID_ATTR) == tabs[i], tabs[i]);
    //         });
    //     } catch (e) {
    //         console.error(e);
    //     }
    // }
    function TabHost(id, renderers) {
        //Renderers show the state of the tabhost
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
        /** @type {Store<string[]>} */
        this.store = new Store(id, []);
        this.activeStore = new Store(id + '.active');
        this.$persist = Utils.delay(this.store.save.bind(this.store), 2000);
        //The first letter of a tab id shows the populator
        //m -> Docs
        //d -> Diffs
        //v -> TabWindow
        //The populator provides tab name and info
        this._populators = {};
    }

    //Internal - Controls whether the tab should reset the active tab to saved value
    TabHost.prototype.$usePersistedActive = true;

    TabHost.prototype.addRenderer = function (renderer) {
        this.$renderers.push(renderer);
    };

    TabHost.prototype.registerPopulator = function (char, pop) {
        this._populators[char + '_'] = pop;
    };

    TabHost.prototype.getOwner = function (id) {
        return this._populators[id && id.slice(0, 2)];
    };
    //TODO should only recreate if changed
    TabHost.prototype.recreate = function () {
        //Does 3 things,
        //Adds back hidden tabs,
        //Creates views for them
        //Hides unloaded tabs
        //Removes orphaned tabs
        var tabs = this.store.get();
        this.tabs.forEach(function (e, i) {
            //Could remote changes have saved a tempData tab?
            if (tabs.indexOf(e) < 0 && this.tempData[e]) {
                if (tabs === this.store.get()) tabs = tabs.slice(0);
                tabs.splice(_transformIndex(this.tabs, tabs, i), 0, e);
            }
        }, this);
        this.tabs = tabs;
        this.$renderers.forEach(function (e) {
            e.$el.empty();
        });
        var tab;
        var id, tabName, annotations;

        function render(r) {
            tab = r.createItem(id, tabName, annotations);
            r.$el.append(tab);
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined,
            );
        }
        for (var i = 0; i < this.tabs.length; ) {
            id = this.tabs[i];
            var t = this.tempData[id] ? this : this.getOwner(id);
            tabName = t && t.getName(id);
            if (tabName || t === this) {
                //Never remove tempData
                annotations = t.getAnnotations(id);
                this.$renderers.forEach(render);
                i++;
            } else {
                if (t && (!t.canDiscard || t.canDiscard(id))) {
                    this.$deleteTab(i, id);
                } else {
                    //remove from visible tabs
                    if (this.tabs === this.store.get()) {
                        this.tabs = this.store.get().slice(0);
                    }
                    this.tabs.splice(i, 1);
                }
            }
        }

        // _check2(this);
        // this.$renderers.forEach((r) => _confirmSync(this.tabs, r));
        this.updateActive();
    };
    TabHost.prototype.updateActive = function () {
        var active = this.active;
        if (this.$usePersistedActive) {
            active = this.activeStore.get();
        }
        if (this.hasTab(active)) {
            this.setActive(active, active !== this.active, true);
        } else if (this.tabs.length > 0) {
            var fallback = this.hasTab(this.active)
                ? this.active
                : this.tabs[0];
            this.setActive(fallback, fallback !== this.active, true);
        }
        if (active && this.activeStore.get() !== active) {
            this.$usePersistedActive = true;
            this.activeStore.set(active);
        }
    };

    TabHost.prototype.afterClick = Utils.noop;
    TabHost.prototype.setActive = function (id, click, scroll) {
        if (scroll) {
            this.$renderers.forEach(function (r) {
                r.scrollIntoView(r.getTabEl(id));
            });
        }
        if (click !=+ false) {
            var _active = this.active;
            this.active = id;
            if (this.afterClick(id, _active) === false && this.active === id) {
                this.active = _active;
                return;
            }
            if (this.$usePersistedActive) this.$usePersistedActive = false;
            this.activeStore.set(this.active);
        }
        this.$renderers.forEach(function (r) {
            r.setActive(r.getTabEl(this.active));
        }, this);
    };

    //A populator might want to know if its tab is still open
    TabHost.prototype.hasTab = function (id) {
        return this.tabs.indexOf(id) > -1;
    };
    TabHost.prototype.isSavedTab = function (id) {
        return this.store.get().indexOf(id) > -1;
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
                    : undefined,
            );

            // _check2(this);
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
        info,
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
        }
        if (oldIndex == index) return;

        //--thank You for splice
        this.tabs.splice(index, 0, this.tabs.splice(oldIndex, 1)[0]);
        if (!this.tempData[id] && this.tabs !== this.store.get()) {
            //update store.get( also
            var tIndex = this.store.get().indexOf(id);
            Utils.assert(tIndex > -1, 'Tab sync error');
            var m = this.store.get().splice(tIndex, 1)[0];
            this.store
                .get()
                .splice(
                    _transformIndex(this.tabs, this.store.get(), index),
                    0,
                    m,
                );
        }
        this.$persist();

        // _check2(this);
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
        if (this.tempData[id]) delete this.tempData[id];
        else if (this.tabs !== this.store.get()) {
            //update store.get( also
            var tIndex = this.store.get().indexOf(id);
            Utils.assert(tIndex > -1, 'Tab sync error');
            this.store.get().splice(tIndex, 1);
        }
        this.$persist();
        if (this.tempAnnotations[id]) delete this.tempAnnotations[id];
    };
    TabHost.prototype.removeTab = function (id) {
        // _check2(this);
        var pos = this.tabs.indexOf(id);
        if (pos < 0) throw new Error('Cannot close unexisting tab.');
        this.$deleteTab(pos, id);

        // _check2(this);
        this.$renderers.forEach(function (r) {
            r.getTabEl(id).remove();
            // _confirmSync(this.tabs, r);
        }, this);
        if (id == this.active) {
            this.active = undefined;
            if (this.tabs.length > 0) {
                this.setActive(
                    this.tabs[pos - 1] || this.tabs[pos],
                    true,
                    false,
                );
            }
        }
    };
    TabHost.prototype.addTab = function (id, name, annotations, info) {
        if (this.hasTab(id)) return this.replaceTab(id, name, annotations);
        if (this.isSavedTab(id)) {
            console.warn(
                'To keep tab order, do not add closed tabs[' +
                    id +
                    ']. Call recreate instead.',
            );
            this.store.get().splice(this.store.get().indexOf(id), 1);
        }
        var owner = this.getOwner(id);
        if (!owner) {
            //This will stop this tab from ever being saved
            //Do we remove tempData for tabs with owners in recreate?
            this.tempData[id] = {
                name: name,
                annotations: annotations,
                info: info,
            };
            if (this.tabs === this.store.get())
                this.tabs = this.store.get().slice();
            owner = this;
        }
        this.tabs.push(id);
        if (!this.tempData[id] && this.tabs !== this.store.get()) {
            this.store.get().push(id);
        }
        this.$persist();

        // _check2(this);
        //Exactly what happens in recreate
        if (!name) name = owner.getName(id);
        if (!annotations) annotations = owner.getAnnotations(id);
        this.$renderers.forEach(function (r) {
            r.$el.append(r.createItem(id, name, annotations));
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined,
            );
            // _confirmSync(this.tabs, r);
        }, this);
    };

    //Modify existing tabs
    TabHost.prototype.tempAnnotations = {};
    TabHost.prototype.setAnnotations = function (id, annotations) {
        this.tempAnnotations[id] = annotations;
        this.$renderers.forEach(function (r) {
            r.setAnnotations(
                id,
                annotations && annotations.length
                    ? r.createAnnotationItem(annotations)
                    : undefined,
            );
        });
    };
    TabHost.prototype.addAnnotation = function (id, annotation) {
        if (!this.tempAnnotations[id]) this.tempAnnotations[id] = [];
        var i = this.tempAnnotations[id];
        if (i.indexOf(annotation) < 0) {
            i.push(annotation);
            this.setAnnotations(id, i);
        }
    };
    TabHost.prototype.removeAnnotation = function (id, annotation) {
        var all = this.tempAnnotations[id];
        if (all && Utils.removeFrom(all, annotation) > -1) {
            this.setAnnotations(id, all);
        }
    };
    TabHost.prototype.setName = function (id, name) {
        if (this.tempData[id]) this.tempData[id].name = name;
        this.replaceTab(
            id,
            name,
            (this.getOwner(id) || this).getAnnotations(id),
        );
    };

    /*Populator Interface*/
    TabHost.prototype.tempData = {};
    TabHost.prototype.getAnnotations = function (id) {
        return this.tempAnnotations[id];
    };
    TabHost.prototype.getName = function (id) {
        return this.tempData[id] && this.tempData[id].name;
    };
    TabHost.prototype.getInfo = function (id) {
        return this.tempData[id].info;
    };
    exports.TabHost = TabHost;
});