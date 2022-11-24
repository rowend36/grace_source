define(function (require, exports, module) {
    /* globals $ */
    var TabRenderer = require('./tab_renderer').TabRenderer;
    var Utils = require('../core/utils').Utils;

    function TabPager($el) {
        TabRenderer.apply(this, arguments);
        $el.on('scroll', function () {
            this.scrollLeft = 0;
        });
        $el.on('transitionend', function (e) {
            var target = $(e.target);
            if (
                target.hasClass('tab-page-left') ||
                target.hasClass('tab-page-right')
            ) {
                target.hide();
            }
        });
    }
    Utils.inherits(TabPager, TabRenderer);
    TabPager.prototype.setActive = function (el) {
        if (el.length && el.attr('class').indexOf('tab-page-') < 0) {
            //A newly created tab.
            this.setActive(this.$el.find('.tab-page-active'));
        }
        el.blur();//prevent scrolling
        el.show();
        el.prevAll('.tab-page')
            .addClass('tab-page-left')
            .removeClass('tab-page-active')
            .removeClass('tab-page-right');
        el.nextAll('.tab-page')
            .removeClass('tab-page-left')
            .removeClass('tab-page-active')
            .addClass('tab-page-right');
        el.removeClass('tab-page-left')
            .addClass('tab-page-active')
            .removeClass('tab-page-right');
    };
    TabPager.prototype.scrollIntoView = Utils.noop;
    TabPager.prototype.TAB_ITEM_CLS = 'tab-page';
    exports.TabPager = TabPager;
});