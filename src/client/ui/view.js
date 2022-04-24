define(function (require, exports, module) {
    /*globals $*/
    var Utils = require("../core/utils").Utils;
    /** @constructor
     * Simple helper wrapper object to hold onMount and onDismount events,
     * Element insert/remove notification
     **/
    function View($el) {
        this._debugId = "#" + Utils.genID();
        this.views = [];
        this.$el = $el;
        this.parent = $el && $el.parent().length ? {$el: $el.parent()} : null;
        this._mounted = !!this.parent;
    }
    View.prototype.onMount = Utils.noop;
    View.prototype.onContentChanged = Utils.noop;
    View.prototype.onDismount = Utils.noop;
    View.prototype.onDestroy = Utils.noop;
    View.prototype.render = Utils.noop;

    View.prototype.addView = function (view, index) {
        if (view.parent) {
            view.parent.removeView(view);
        }
        if (!isNaN(index)) {
            view._sortIndex = Number(index);
        } else view._sortIndex = 100 + this.views.length;
        var beforeEl, i;
        for (i = 0; i < this.views.length; ++i) {
            if (this.views[i]._sortIndex > view._sortIndex) {
                beforeEl = this.views[i].$el[0];
                break;
            }
        }
        this.views.splice(i, 0, view);
        view._mount(this, beforeEl);
        this.onContentChanged();
    };
    View.prototype.removeView = function (view) {
        var index = this.views.indexOf(view);
        if (index > -1) {
            this.views.splice(index, 1);
            view._dismount();
            this.onContentChanged();
        }
    };

    View.prototype._mount = function (parent, beforeEl) {
        if (this._mounted) {
            throw new Error("Invalid State");
        }
        this.parent = parent;
        if (!this.$el) {
            this.createElement();
        }
        if (beforeEl) {
            parent.$el[0].insertBefore(this.$el[0], beforeEl);
        } else parent.$el.append(this.$el);
        this._mounted = true;
        this.onMount(this);
        return true;
    };

    View.prototype._dismount = function () {
        if (!this._mounted) return false;
        this._mounted = false;
        this.$el.detach();
        this.parent = null;
        this.onDismount(this);
        return true;
    };

    View.prototype.createElement = function () {
        this.$el = $("<div></div>");
    };

    View.prototype.remove = function () {
        this.parent && this.parent.removeView(this);
    };
    

    //completely tear down a view and descendants
    View.prototype.destroy = function () {
        this.views.forEach(function (view) {
            view.destroy();
        });
        this.remove();
        this.onDestroy();
    };
    
    exports.View = View;
});