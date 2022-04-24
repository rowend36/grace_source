define(function(require, exports, module) {
    "use strict";
    /*globals $*/
    var Config = require("../core/config").Config;
    var appConfig = Config.appConfig;
    var appEvents = require("../core/events").AppEvents;
    var configure = Config.configure;
    var register = Config.register;
    var AutoCloseable = require("../ui/autocloseable").AutoCloseable;
    var FileUtils = require("../core/file_utils").FileUtils;
    var Fileviews = require("../ext/fileview/fileviews").Fileviews;
    var FocusManager = require("../core/focus_manager").FocusManager;
    var Navigation = require("../core/navigation").Navigation;
    var TabHost = require("../ui/tab_host").TabHost;
    var TabRenderer = require("../ui/tab_renderer").TabRenderer;
    var TabPager = require("../ui/tab_pager").TabPager;
    var Sidenav = require("../ui/sidenav").Sidenav;
    var rootView = require("./setup_root").rootView;
    var actionBar = require("./setup_actionbar").actionBar;
    var DocsTab = require("./setup_tab_host").DocsTab;
    var View = require("../ui/view").View;
    var Utils = require("../core/utils").Utils;


    var sideViewEl = $(require("text!./setup_sideview.html"));
    $("body").eq(0).append(sideViewEl);
    //update currently push on openstart or dragstart
    var refocus = false;
    var SidenavLeft = new Sidenav(sideViewEl, {
        draggable: true,
        edge: "left",
        minWidthPush: appConfig.tabletView ? 600 : Infinity,
        pushElements: rootView.$el,
        dragTarget: rootView.$el[0],
        onOpenStart: function() {
            FocusManager.hintChangeFocus();
            /*if (window.innerWidth < 992) {
                SidenavRight.close();
            }*/
        },
        onOpenEnd: function() {
            if (SidenavLeft.isOverlay) {
                if (!Env.isHardwareKeyboard) {
                    if (FocusManager.keyboardVisible) {
                        refocus = FocusManager
                            .activeElement;
                        if (refocus) {
                            refocus.blur();
                        }
                    } else document.activeElement.blur();
                }
                Navigation.addRoot(SidenavLeft.el,
                    SidenavLeft.close.bind(SidenavLeft));
                AutoCloseable.add(this.id, SidenavLeft);
            }
            FileUtils.trigger("sidenav-open");
        },
        onCloseStart: function() {
            try {
                if (Fileviews.activeFileBrowser) {
                    Fileviews.activeFileBrowser.menu.hide();
                }
            } catch (e) {
                console.error(e);
            }
        },
        onCloseEnd: function() {
            if (SidenavLeft.isOverlay) {
                Navigation.removeRoot(SidenavLeft.el);
                AutoCloseable.close(this.id);
            }
            Fileviews.exitSaveMode();
            if (refocus) {
                FocusManager.focusIfKeyboard(refocus, false,
                    true);
                refocus = null;
            }
        },
    });

    var pager, renderer;
    var SidenavLeftTab = new TabHost("sideview", [
        (renderer = new TabRenderer(sideViewEl.find(
            "#selector"))),
        (pager = new TabPager(sideViewEl)),
    ]);
    renderer.createItem = function(id, name) {
        return (
            '<li class="tab" data-tab="' +
            id +
            '">' +
            '<i class="material-icons" style="width:100%">' +
            name +
            "</i>" +
            "</li>"
        );
    };

    renderer.$el.on("click", ".tab", renderer.getOnClickListener(
        SidenavLeftTab));

    SidenavLeftTab.pager = pager;
    pager.ID_ATTR = 'id';
    pager.createItem = function(id) {
        if (this.$el.children("#" + id).length === 0) {
            return '<div id="' + id +
                '" class="tab-page"></div>';
        } else return this.$el.children("#" + id);
    };

    SidenavLeftTab.addTab("hierarchy_tab", "work");
    var doclist = new TabRenderer(sideViewEl.find("#opendocs"));
    doclist.createItem = function(id, name) {
        return '<li tabIndex=0 draggable=true class="file-item" data-file=' +
            id +
            '><i class="material-icons">insert_drive_file</i>' +
            '<span class="filename">' + name +
            '</span><span class="dropdown-btn">' +
            '<i class="material-icons">close</i></span></li>';
    };
    doclist.ID_ATTR = 'data-file';
    doclist.TAB_ITEM_CLS = 'file-item';
    doclist.CLOSE_BTN_CLS = 'dropdown-btn';
    doclist.createAnnotationItem = Utils.noop;
    doclist.scrollIntoView = Utils.noop;
    //depending on execution order here
    doclist.$el.on("click", ".dropdown-btn", function(e) {
        if (SidenavLeft.isOpen && SidenavLeft.isOverlay) {
            e.stopPropagation();
            //closing tabs in doclist causes tab switch
            //which might want to close a tab
            AutoCloseable.remove(SidenavLeft.id);
            this.parentElement.click();
            appEvents.once("closedTab", function() {
                AutoCloseable.add(SidenavLeft.id,
                    SidenavLeft);
            });
        }
    });
    doclist.$el.on("click", ".file-item", doclist.getOnClickListener(
        DocsTab, true));
    appEvents.on("docStatusChange", function(ev) {
        var doc = ev.doc;
        $("[data-file=" + doc.id + "]").toggleClass(
            "status_pending", doc.dirty);
    });
    DocsTab.addRenderer(doclist);
    appEvents.once("documentsLoaded", DocsTab.recreate.bind(DocsTab));


    SidenavLeftTab.addTab("search_container", "search");

    var sidenavTrigger = new View($(
        '<button class="sidenav-trigger sidenav-menu-button"' +
        'data-target="side-menu">' +
        '<i class="material-icons big menu-icon">menu</i>' +
        "</button>"
    ));
    sidenavTrigger.$el.click(SidenavLeft.toggle.bind(SidenavLeft));
    actionBar.addView(sidenavTrigger, 1, 40);
    actionBar.render();

    //toggle below in hierarchy_tabs
    (function(toggles) {
        var toggleBelow = function(e) {
            var target = $("#" + this.id.replace("-toggle",
                ""));
            e.stopPropagation();
            if (target.css("display") == "none") {
                configure(this.id + ":shown", true);
                target.show();
                $(this).children().removeClass(
                    "btn-toggle__activated");
                if (this.id == "find_file-toggle") {
                    $("#project_view").removeClass(
                        "find_file_hidden");
                }
            } else {
                configure(this.id + ":shown", false);
                target.hide();
                $(this).children().addClass(
                    "btn-toggle__activated");
                if (this.id == "find_file-toggle") {
                    $("#project_view").addClass(
                        "find_file_hidden");
                }
            }
        };
        $(".toggleBelow")
            .click(toggleBelow)
            .each(function(e, el) {
                appConfig[el.id + ":shown"] = true;
                register(el.id + ":shown");
                toggles[el.id + ":shown"] = "no-user-config";
                if (!appConfig[el.id + ":shown"]) {
                    el.click();
                }
            });
        Config.registerValues(toggles);
    })({});

    exports.SideView = SidenavLeft;
    exports.SideViewTabs = SidenavLeftTab;
});