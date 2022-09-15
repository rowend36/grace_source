define(function (require, exports, module) {
    'use strict';
    /*globals $*/

    function TabRenderer($el) {
        this.$el = $el;
    }
    //used to get id o tab
    TabRenderer.prototype.ID_ATTR = 'data-tab';
    //used to get tab elements
    TabRenderer.prototype.TAB_ITEM_CLS = 'tab';
    //used to get close icon elememt
    TabRenderer.prototype.CLOSE_BTN_CLS = 'tab-close-icon';
    TabRenderer.prototype.createItem = function (id, name) {
        return (
            '<li draggable=true class="' +
            this.TAB_ITEM_CLS +
            '" ' +
            this.ID_ATTR +
            '=' +
            id +
            '><a href=#' +
            id +
            ' >' +
            name +
            '<i class="material-icons close-icon tab-close-icon">close</i></a></li>'
        );
    };
    TabRenderer.prototype.createAnnotationItem = function (anno) {
        var string =
            '<div id="tab-annotations" style="position:absolute;left:0;right:40px;height:\'\';top:0;">';
        for (var i in anno) {
            string +=
                '<div style="float:left;margin-bottom:20px;margin-left:2px;border-radius:50%;max-width:30px;padding:4px;" class="' +
                anno[i].className +
                '">' +
                (anno[i].content || '') +
                '</div>';
        }
        return string + '</div>';
    };
    TabRenderer.prototype.$el = null;
    TabRenderer.prototype.scrollIntoView = function (el) {
        var menu = this.$el[0],
            child = el[0];

        if (!child) return;
        menu.scrollLeft = Math.max(
            0,
            -menu.clientWidth / 2 + child.clientWidth / 2 + child.offsetLeft,
        );
    };
    TabRenderer.prototype.$setSingleTabs = function (val) {
        this.$el.toggleClass('singleTab', !!val);
    };
    TabRenderer.prototype.setFadeCloseIcon = function () {
        var m = '.' + this.CLOSE_BTN_CLS;
        var $el = this.$el;
        $el.on('mouseover', '.' + this.TAB_ITEM_CLS, function () {
            if ($(this).find(m).css('display') !== 'none') {
                $(this).finish().fadeIn(1);
                return;
            }
            $($el).children().not($(this)).find(m).hide();
            $(this)
                .find(m)
                .finish()
                .delay(17) //to avoid receiving click event
                .fadeIn('fast')
                .delay(5000);
        }).on('mouseleave', '.' + this.TAB_ITEM_CLS, function () {
            console.log('mouseleave');
            $(this).find(m).fadeOut('slow');
        });
    };
    TabRenderer.prototype.getTabEl = function (id) {
        return this.$el
            .find('.' + this.TAB_ITEM_CLS)
            .filter('[' + this.ID_ATTR + '=' + id + ']');
    };
    TabRenderer.prototype.getTabId = function (el) {
        return el.closest('.' + this.TAB_ITEM_CLS).attr(this.ID_ATTR);
    };
    TabRenderer.prototype.setActive = function (el) {
        this.$el.find('.active').removeClass('active');
        el.addClass('active');
        el.children('a').addClass('active');
    };
    TabRenderer.prototype.getOnClickListener = function (host, scroll) {
        var self = this;
        return function (e) {
            e.stopPropagation();
            var id = self.getTabId($(this));
            var target = $(e.target);
            var isClose = target.closest('.' + self.CLOSE_BTN_CLS);
            if (isClose.length) {
                e.preventDefault();
                host.onClose(id);
            } else host.setActive(id, true, scroll);
        };
    };

    TabRenderer.prototype.setAnnotations = function (id, el) {
        var tabElement = this.getTabEl(id).children('a');
        tabElement.children('#tab-annotations').remove();
        if (el) tabElement.append(el);
    };
    exports.TabRenderer = TabRenderer;
});