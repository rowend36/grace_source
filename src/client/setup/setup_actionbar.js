define(function(require, exports, module) {
    /*globals $*/
    var appConfig = require("../core/config").Config.appConfig;
    var appEvents = require("../core/events").AppEvents;
    var rootView = require("./setup_root").rootView;
    var View = require("../ui/view").View;
    var LinearLayout = require("../ui/linear_layout").LinearLayout;
    var TabRenderer = require("../ui/tab_renderer").TabRenderer;
    var FocusManager = require("../core/focus_manager").FocusManager;
    var DocsTab = require("./setup_tab_host").DocsTab;
    var MainMenu = require("./setup_main_menu").MainMenu;

    var ActionBar = new LinearLayout(null, null, "horizontal");
    exports.actionBar = ActionBar;
    ActionBar.createElement();
    ActionBar.$el.addClass('nav-main');
    ActionBar.$el.attr("id", "action_bar");
    rootView.addView(ActionBar, 0, 56);
    ActionBar.shorter = window.innerHeight < 400;
    if (ActionBar.shorter) {
        ActionBar.layout_height = 48;
        ActionBar.$el.addClass("short-action_bar");
    }

    var tabView = new View();
    ActionBar.addView(tabView, 2, 100, 1);
    tabView.$el.attr("id", "menu");
    tabView.$el.addClass("tabs");
    FocusManager.trap(tabView.$el, true);

    var tabs = new TabRenderer();
    tabs.$el = tabView.$el;
    tabs.$setSingleTabs(appConfig.singleTabLayout);
    tabs.setFadeCloseIcon();
    DocsTab.addRenderer(tabs);
    tabs.$el.on("click", ".tab a", tabs.getOnClickListener(DocsTab));
    appEvents.once("documentsLoaded", DocsTab.recreate.bind(DocsTab));


    var menuTrigger = new View($(
        '<button class="dropdown-trigger sidenav-more-button"' +
        'data-target="overflow-menu">' +
        '<i class="material-icons big menu-icon">more_vert</i>' +
        "</button>"
    ));
    ActionBar.addView(menuTrigger, 3, 40);
    ActionBar.render();
    MainMenu.createTrigger(menuTrigger.$el[0]);

    function updateSize(ev) {
        $(document.body).toggleClass("virtual-keyboard-visible", ev
            .visible);
        if (appConfig.autoHideTabs) {
            if (!ActionBar.hidden && ev.visible && ev.isTrusted && !
                ActionBar.$forcedOpen) {
                var isLandscape = window.innerWidth > window
                    .innerHeight;
                var isSmall = window.innerHeight < 300;
                if (
                    (function() {
                        switch (appConfig.autoHideTabs) {
                            case true:
                                return true;
                            case "never":
                                return false;
                            case "auto":
                                return isLandscape && isSmall;
                            case "viewport":
                                return isSmall;
                            case "landscape":
                                return isLandscape;
                            case "landscape_small":
                                return isLandscape || isSmall;
                        }
                    })()
                )
                    return ActionBar.hide();
            } else if (ActionBar.hidden) {
                ActionBar.show();
            }
        }
        if (ActionBar.shorter != window.innerHeight < 400) {
            ActionBar.shorter = window.innerHeight < 400;
            ActionBar.$el.toggleClass("short-action_bar", ActionBar
                .shorter);
            ActionBar.layout_height = ActionBar.shorter ? 48 : 56;
            ActionBar.parent.show();
        }
    }
    appEvents.on("keyboardChange", updateSize);
    console.debug("state: created action bar");
});