define(function (require, exports, module) {
    'use strict';
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    var Utils = require('grace/core/utils').Utils;
    var ItemList = require('grace/ui/item_list').ItemList;

    function QuickList(/*id, items, container*/) {
        QuickList.super(this, arguments);
        this.$clear = function (e) {
            this.items.length = 0;
            this.trigger('clear', null, true);
            this.hide(e);
        }.bind(this);
        this.$close = this.hide.bind(this);
    }
    QuickList.prototype.getHtml = function (index) {
        return Utils.htmlEncode(
            String(this.items[index]).substring(0, 10000)
        ).replace(/(?:\r\n|\r|\n)+/g, '<br/>');
    };
    QuickList.prototype.containerClass = 'modal bottom-list';
    QuickList.prototype.itemClass = 'part bottom-list-item';
    QuickList.prototype.footer = ['Clear', 'Close'];
    QuickList.prototype.hide = function (e) {
        if (e) e.stopPropagation();
        if (!this.shown) return;
        this.shown = false;
        this.trigger('dismiss', null, true);
        this.$el.fadeOut();
        this.lastFocus();
        this.lastFocus = null;
    };
    QuickList.prototype.onEsc = function () {
        ItemList.prototype.onEsc.call(this, arguments);
        this.hide();
        return true;
    };
    QuickList.prototype.show = function () {
        if (this.shown) return;
        this.shown = true;
        this.render();
        this.$el.fadeIn();
        this.$el.css('z-index', 500);
        this.$el.css('position', 'absolute');
        this.lastFocus = FocusManager.visit(this.$receiver);
    };
    Utils.inherits(QuickList, ItemList);
    exports.ClipboardList = QuickList;
});