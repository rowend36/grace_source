define(function (require, exports, module) {
    /*globals $*/
    var appEvents = require('../core/app_events').AppEvents;
    var rootView = require('./setup_root').rootView;
    var View = require('../ui/view').View;
    var LinearLayout = require('../ui/linear_layout').LinearLayout;
    var Dropdown = require('../ui/dropdown').Dropdown;
    var TabRenderer = require('../ui/tab_renderer').TabRenderer;
    var FocusManager = require('../ui/focus_manager').FocusManager;
    var DocsTab = require('./setup_tab_host').DocsTab;
    var Actions = require('../core/actions').Actions;
    var Config = require('../core/config').Config;
    var appConfig = Config.registerAll(
        {
            autoHideActionBar: 'landscape',
            singleTabLayout: false,
        },
        'ui'
    );
    Config.registerInfo({
        autoHideActionBar: {
            doc:
                'Automatically hide tabs when keyboard is visible. Set to false to disable.',
            values: [
                'always',
                ['viewport', 'Auto-hide only on short screens'],
                ['landscape', 'Auto-hide only in landscape'],
                [
                    'landscape_viewport',
                    'Auto-hide in both short screens and in landscape',
                ],
                'auto',
                'never',
            ],
        },
    });
    Config.on('ui', function (ev) {
        if (ev.config == 'singleTabLayout') DocsTab.setSingleTabs(ev.value());
    });
    var ActionBar = new LinearLayout(null, null, 'horizontal');
    exports.actionBar = ActionBar;
    ActionBar.createElement();
    ActionBar.$el.addClass('nav-main');
    ActionBar.$el.attr('id', 'action_bar');
    rootView.addView(ActionBar, 0, 56);
    ActionBar.shorter = window.innerHeight < 400;
    if (ActionBar.shorter) {
        ActionBar.layout_height = 48;
        ActionBar.$el.addClass('short-action_bar');
    }

    var tabView = new View();
    ActionBar.addView(tabView, 2, 100, 1);
    tabView.$el.attr('id', 'docstab');
    tabView.$el.addClass('tabs');
    FocusManager.trap(tabView.$el, true);

    var tabs = new TabRenderer();
    tabs.$el = tabView.$el;
    tabs.$setSingleTabs(appConfig.singleTabLayout);
    tabs.setFadeCloseIcon();
    tabs.$el.on('click', '.tab a', tabs.getOnClickListener(DocsTab));
    DocsTab.addRenderer(tabs);
    DocsTab.recreate();

    var menuTrigger = new View(
        $(
            '<button class="dropdown-trigger sidenav-more-button"' +
                'data-target="overflow-menu">' +
                '<i class="material-icons big menu-icon">more_vert</i>' +
                '</button>'
        )
    );
    ActionBar.addView(menuTrigger, 3, 40);
    ActionBar.render();

    function updateSize(ev) {
        $(document.body).toggleClass('virtual-keyboard-visible', ev.visible);
        if (appConfig.autoHideActionBar) {
            if (
                !ActionBar.$forcedOpen &&
                !ActionBar.hidden &&
                ev.visible &&
                ev.isTrusted
            ) {
                var isLandscape = window.innerWidth > window.innerHeight;
                var isSmall = window.innerHeight < 300;
                if (
                    (function () {
                        switch (appConfig.autoHideActionBar) {
                            case 'always':
                                return true;
                            case 'never':
                                return false;
                            case 'auto':
                                return isLandscape && isSmall;
                            case 'viewport':
                                return isSmall;
                            case 'landscape':
                                return isLandscape;
                            case 'landscape_viewport':
                                return isLandscape || isSmall;
                        }
                    })()
                )
                    return ActionBar.hide();
            } else if (ActionBar.hidden) {
                ActionBar.show();
            }
        }
        if (
            ActionBar.shorter !=
            //Media query used by filebrowser.css
            (window.innerHeight <= 400 || window.innerWidth >= 720)
        ) {
            ActionBar.shorter = window.innerHeight < 400;
            ActionBar.$el.toggleClass('short-action_bar', ActionBar.shorter);
            ActionBar.layout_height = ActionBar.shorter ? 48 : 56;
            ActionBar.parent.render();
        }
    }
    //should also be window on resize
    appEvents.on('keyboardChanged', updateSize);
    Actions.addAction({
        name: 'toggleFullscreen',
        icon: 'fullscreen',
        bindKey: 'F11',
        exec: function () {
            ActionBar.$forcedOpen = ActionBar.hidden;
            ActionBar.toggle();
        },
    });

    var settingsItems = {};
    var moreItems = {
        settings: {
            caption: 'Configuration',
            icon: 'settings_application',
            subTree: settingsItems,
        },
    };

    var menuItems = {
        more: {
            icon: 'more_vert',
            caption: 'More',
            subTree: moreItems,
            sortIndex: 10000,
        },
    };
    var menu = new Dropdown();
    menu.onclick = function (ev, id, element, item, anchor) {
        if (!item.handle) return;
        var event = Actions.createEvent();
        event.element = element;
        event.anchor = anchor;
        event.event = ev;
        item.handle(event);
    };
    menu.setData(menuItems);
    Actions.registerActionHost('actionbar', function (action) {
        if (
            !menuItems[action.name] &&
            Object.keys(menuItems).filter(function (e) {
                return (
                    e !== '!changed' && e !== '!update' && !menuItems['!' + e]
                );
            }).length > 6
        )
            addTo(moreItems, action);
        else addTo(menuItems, action);
    });
    Actions.registerActionHost('actionbar.more', function (action) {
        addTo(moreItems, action);
    });
    Actions.registerActionHost('actionbar.settings', function (action) {
        addTo(settingsItems, action);
    });
    function addTo(items, option) {
        if (items[option.name]) {
            var extend = {};
            extend['!' + option.name] = option;
            Dropdown.assign(items, extend);
        } else {
            items[option.name] = null;
            items[(option.isHeader ? '' : '!') + option.name] = option;
        }
        menu.setData();
        if (option.subTree)
            Actions.registerActionHost(
                'actionbar.' + option.name,
                function (child) {
                    addTo(option.subTree, child);
                }
            );
    }
    menu.createTrigger(menuTrigger.$el[0]);
});