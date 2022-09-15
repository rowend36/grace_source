define(function (require, exports, module) {
    'use strict';
    /*globals $*/
    var Config = require('../core/config').Config;
    var uiConfig = Config.registerAll(null, 'ui');
    var appEvents = require('../core/app_events').AppEvents;
    var configure = Config.configure;
    var register = Config.register;
    var AutoCloseables = require('../ui/auto_closeables').AutoCloseables;
    var FocusManager = require('../ui/focus_manager').FocusManager;
    var Navigation = require('../ui/navigation').Navigation;
    var TabHost = require('../ui/tab_host').TabHost;
    var TabRenderer = require('../ui/tab_renderer').TabRenderer;
    var TabPager = require('../ui/tab_pager').TabPager;
    var Sidenav = require('../ui/sidenav').Sidenav;
    var rootView = require('./setup_root').rootView;
    var actionBar = require('./setup_actionbar').actionBar;
    var DocsTab = require('./setup_tab_host').DocsTab;
    var getEditor = require('./setup_editors').getEditor;
    var View = require('../ui/view').View;
    var Utils = require('../core/utils').Utils;
    Config.on('ui', function (ev) {
        if (ev.config == 'tabletView') {
            SidenavLeft.options.minWidthPush = ev.value() ? 600 : Infinity;
        }
    });
    var sideViewEl = $(require('text!./setup_sideview.html'));
    $('body')[0].insertBefore(sideViewEl[0], rootView.$el[0]);
    //update currently push on openstart or dragstart
    //TODo - move this to FocusManager so other tabs can use
    var refocus = false;
    var SidenavLeft = new Sidenav(sideViewEl, {
        draggable: true,
        edge: 'left',
        minWidthPush: uiConfig.tabletView ? 600 : Infinity,
        pushElements: rootView.$el,
        dragTarget: rootView.$el[0],
        onOpenStart: function () {
            FocusManager.hintChangeFocus();
            /*if (window.innerWidth < 992) {
                SidenavRight.close();
            }*/
        },
        onOpenEnd: function () {
            if (SidenavLeft.isOverlay) {
                if (!Env.isHardwareKeyboard) {
                    if (FocusManager.keyboardVisible) {
                        refocus = FocusManager.activeElement;
                        if (refocus && refocus !== Navigation.$el) {
                            refocus.blur();
                            if (
                                refocus === getEditor().textInput.getElement()
                            ) {
                                refocus = true;
                            }
                        }
                    }// else document.activeElement.blur();
                }
                Navigation.addRoot(
                    SidenavLeft.el,
                    SidenavLeft.close.bind(SidenavLeft)
                );
                AutoCloseables.add(this.id, SidenavLeft);
            }
            appEvents.trigger('sidenavOpened');
        },
        onCloseStart: function () {
            require(['../ext/fileview/fileviews'], function (mod) {
                try {
                    if (mod.Fileviews.activeFileBrowser) {
                        mod.Fileviews.activeFileBrowser.menu.hide();
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        },
        onCloseEnd: function () {
            if (SidenavLeft.isOverlay) {
                Navigation.removeRoot(SidenavLeft.el);
                AutoCloseables.close(this.id);
            }
            appEvents.trigger('sidenavClosed');
            if (refocus) {
                if (refocus === true) getEditor().focus();
                else refocus.focus();
                refocus = null;
            }
        },
    });

    var pager, renderer;
    var SidenavLeftTab = new TabHost('sideview', [
        (renderer = new TabRenderer(sideViewEl.find('#selector'))),
        (pager = new TabPager(sideViewEl)),
    ]);
    renderer.createItem = function (id, name) {
        return (
            '<li class="tab" data-tab="' +
            id +
            '"><a href="#">' +
            '<i class="material-icons" style="width:100%">' +
            name +
            '</i></a>' +
            '</li>'
        );
    };

    renderer.$el.on(
        'click',
        '.tab',
        renderer.getOnClickListener(SidenavLeftTab)
    );

    SidenavLeftTab.pager = pager;
    pager.ID_ATTR = 'id';
    pager.createItem = function (id) {
        if (this.$el.children('#' + id).length === 0) {
            return (
                '<div id="' +
                id +
                '" style="display:none" class="tab-page"></div>'
            );
        } else return this.$el.children('#' + id).hide();
    };

    SidenavLeftTab.addTab('hierarchy_tab', 'work');
    var doclist = new TabRenderer(sideViewEl.find('#opendocs'));
    doclist.createItem = function (id, name) {
        return (
            '<li tabIndex=0 draggable=true class="file-item" data-file=' +
            id +
            '><i class="material-icons">insert_drive_file</i>' +
            '<span class="filename">' +
            name +
            '</span><span class="dropdown-btn">' +
            '<i class="material-icons">close</i></span></li>'
        );
    };
    doclist.ID_ATTR = 'data-file';
    doclist.TAB_ITEM_CLS = 'file-item';
    doclist.CLOSE_BTN_CLS = 'dropdown-btn';
    doclist.createAnnotationItem = Utils.noop;
    doclist.scrollIntoView = Utils.noop;
    //depending on execution order here
    doclist.$el.on('click', '.dropdown-btn', function (e) {
        if (SidenavLeft.isOpen && SidenavLeft.isOverlay) {
            e.stopPropagation();
            //closing tabs in doclist causes tab switch
            //which might want to close a tab
            AutoCloseables.remove(SidenavLeft.id);
            this.parentElement.click();
            appEvents.once('tabClosed', function () {
                AutoCloseables.add(SidenavLeft.id, SidenavLeft);
            });
        }
    });
    doclist.$el.on(
        'click',
        '.file-item',
        doclist.getOnClickListener(DocsTab, true)
    );
    appEvents.on('docStatusChanged', function (ev) {
        var doc = ev.doc;
        $('[data-file=' + doc.id + ']').toggleClass(
            'indicator-pending',
            doc.dirty
        );
    });
    DocsTab.addRenderer(doclist);
    appEvents.once('documentsLoaded', DocsTab.recreate.bind(DocsTab));

    var sidenavTrigger = new View(
        $(
            '<button class="sidenav-trigger sidenav-menu-button"' +
                'data-target="side-menu">' +
                '<i class="material-icons big menu-icon">menu</i>' +
                '</button>'
        )
    );
    sidenavTrigger.$el.click(SidenavLeft.toggle.bind(SidenavLeft));
    actionBar.addView(sidenavTrigger, 1, 40);
    actionBar.render();

    //toggle below in hierarchy_tabs
    (function (temp) {
        var toggleBelow = function (e) {
            var KEY = 'expand-' + this.id;
            var target = $('#' + this.id.replace('-toggle', ''));
            e.stopPropagation();
            if (uiConfig[KEY]) {
                configure(KEY, true, 'ui');
                target.show();
                $(this).children().removeClass('btn-toggle__activated');
                if (this.id == 'find_file-toggle') {
                    $('#project_view').removeClass('find_file_hidden');
                }
            } else {
                configure(KEY, false, 'ui');
                target.hide();
                $(this).children().addClass('btn-toggle__activated');
                if (this.id == 'find_file-toggle') {
                    $('#project_view').addClass('find_file_hidden');
                }
            }
        };
        $('.toggleBelow')
            .click(toggleBelow)
            .each(function (e, el) {
                var KEY = 'expand-' + el.id;
                register(KEY, null, true);
                temp[KEY] = 'no-user-config';
                if (!uiConfig[KEY]) {
                    el.click();
                }
            });
        Config.registerInfo(temp);
    })({});

    exports.SideView = SidenavLeft;
    exports.SideViewTabs = SidenavLeftTab;
});