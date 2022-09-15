define(function (require, exports, module) {
    var Utils = require('../core/utils').Utils;
    var View = require('./view').View;

    /** @constructor */
    function LinearLayout(root, size, orientation) {
        this.orientation = orientation;
        this.size = size;
        this.$el = root;
        this.views = [];
    }
    LinearLayout.VERTICAL = 1;
    LinearLayout.HORIZONTAL = 2;
    Utils.inherits(LinearLayout, View);
    LinearLayout.prototype.render = function () {
        var edge1 = this.orientation == LinearLayout.VERTICAL ? 'top' : 'left';
        var edge2 =
            this.orientation == LinearLayout.VERTICAL ? 'bottom' : 'right';
        var size =
            this.orientation == LinearLayout.VERTICAL ? 'height' : 'width';
        var totalSize = 0,
            totalWeight = 0;
        this.size =
            parseInt(this.$el.css(size)) ||
            window['inner' + Utils.sentenceCase(size)];
        var view;
        for (var i in this.views) {
            view = this.views[i];
            if (view.hidden) continue;
            totalSize += view['layout_' + size] || 0;
            totalWeight += view.layout_weight || 0;
        }
        if (this.size < totalSize) this.size = totalSize;
        var remSize = this.size - totalSize;
        var sizePerWeight = remSize / (totalWeight || 1);
        var lastPos = 0;
        var pivot = this.views.length - 1;
        for (i in this.views) {
            view = this.views[i];
            if (view.hidden) continue;
            view[size] =
                (view['layout_' + size] || 0) +
                (view.layout_weight || 0) * sizePerWeight;
            var nextPos = lastPos + view[size];
            if (view.layout_weight) {
                pivot = i;
                view.$el.css(edge1, lastPos);
                view.$el.css(edge2, this.size - nextPos);
                view.$el.css(size, 'auto');
            } else if (i < pivot) {
                view.$el.css(edge1, lastPos);
                view.$el.css(size, view[size]);
                view.$el.css(edge2, 'auto');
            } else {
                view.$el.css(edge2, this.size - nextPos);
                view.$el.css(size, view[size]);
                view.$el.css(edge1, 'auto');
            }
            lastPos = nextPos;
        }
        this.onRender();
    };
    LinearLayout.prototype.onContentChanged = function () {
        this.render();
    };
    LinearLayout.prototype.addView = function (view, index, size, weight) {
        view.layout_weight = weight;
        view[
            'layout_' +
                (this.orientation == LinearLayout.VERTICAL ? 'height' : 'width')
        ] = size;
        View.prototype.addView.apply(this, arguments);
        return view;
    };

    //Extend View Prototype
    View.prototype.hide = function () {
        this.$el.hide();
        this.hidden = true;
        this.parent.render();
    };
    View.prototype.show = function () {
        this.$el.show();
        this.hidden = false;
        this.parent.render();
    };
    View.prototype.toggle = function () {
        if (this.hidden) {
            this.show();
        } else this.hide();
    };
    LinearLayout.prototype.onRender = Utils.noop;
    exports.LinearLayout = LinearLayout;
}); /*_EndDefine*/