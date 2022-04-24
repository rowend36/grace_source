define(function(require, exports, module) {
    var TabRenderer = require("./tab_renderer").TabRenderer;
    var Utils = require("../core/utils").Utils;

    function TabPager($el) {
        TabRenderer.apply(this, arguments);
        $el.on('scroll', function() {
            this.scrollLeft = 0;
        });
    }
    Utils.inherits(TabPager, TabRenderer);
    TabPager.prototype.setActive = function(el) {
        el.blur();
        el.prevAll(".tab-page").addClass("tab-page-left")
            .removeClass("tab-page-right");
        el.nextAll(".tab-page").addClass("tab-page-right")
            .removeClass("tab-page-left");
        el.removeClass("tab-page-right").removeClass(
            "tab-page-left");
    };
    TabPager.prototype.scrollIntoView = Utils.noop;
    TabPager.prototype.TAB_ITEM_CLS = "tab-page";
    exports.TabPager = TabPager;
});