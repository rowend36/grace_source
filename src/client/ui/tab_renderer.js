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
            '><a  >' +
            name +
            '<i class="material-icons close-icon tab-close-icon red-text">close</i></a></li>'
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
            -menu.clientWidth / 2 + child.clientWidth / 2 + child.offsetLeft
        );
    };
    TabRenderer.prototype.$setSingleTabs = function (val) {
        this.$el.toggleClass('singleTab', !!val);
    };
    TabRenderer.prototype.setFadeCloseIcon = function () {
        var m = '.' + this.CLOSE_BTN_CLS;
        var $el = this.$el;
        //Problems with cash make this buggy when delegated.
        function mouseleave() {
            $(this).find(m).fadeOut('slow');
        }
        function mouseenter() {
            var tab = $(this);
            var closeIcon = tab.find(m).finish();
            if (closeIcon.css('display') !== 'none') {
                return closeIcon.fadeIn(0);
            }
            // var otherIcons = $el.children().not(tab).find(m);
            // otherIcons.finish().fadeOut(0);
            closeIcon
                .delay(17) //hack to prevent receiving click event
                .fadeIn('fast')
                .delay(5000); //wait 5s before fading out
        }
        //But thank God for StackOverflow
        var tabItem = '.' + this.TAB_ITEM_CLS;
        $el.on('mouseover mouseout', function (e) {
            var tab = $(e.target).closest(tabItem)[0];
            if (!tab) return;
            if (
                !e.relatedTarget ||
                (e.relatedTarget !== tab &&
                    !(
                        tab.compareDocumentPosition(e.relatedTarget) &
                        Node.DOCUMENT_POSITION_CONTAINED_BY
                    ))
            ) {
                (e.type === 'mouseout' ? mouseleave : mouseenter).call(this);
            }
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