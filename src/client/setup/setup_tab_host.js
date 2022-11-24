define(function (require, exports, module) {
    //add noexit before documents
    /**
     * The TabHost aka DocsTab is a controller for the tabs in the ActionBar.
     * Each document that is open has a tab which when active, opens the document in the active main editor
     * See setup_editors.js
     */
    var appConfig = require('../core/config').Config.registerAll(
        {
            autoCloseTabs: true,
            backButtonDelay: '700ms',
            disableBackButtonTabSwitch: false,
        },
        'ui'
    );
    var Actions = require('../core/actions').Actions;

    require('../core/config').Config.registerInfo({
        backButtonDelay: {
            type: 'time',
        },
    });
    var State = require('./setup_state').State;
    var appEvents = require('../core/app_events').AppEvents;
    var TabHost = require('../ui/tab_host').TabHost;
    State.addListener(
        function (tab) {
            if (tab && DocsTab.getOwner(tab)) {
                //can try to reopen previously closed docs
                if (
                    !appConfig.disableBackButtonTabSwitch &&
                    DocsTab.hasTab(tab)
                ) {
                    if (tab != DocsTab.active) setTab(tab);
                    return true;
                }
                return false;
            } else if (tab === 'tabs') {
                return true;
            }
        },
        function (state) {
            return state === 'tabs' || DocsTab.hasTab(state);
        }
    );
    appEvents.on('appResumed', function () {
        State.ensure(
            appConfig.disableBackButtonTabSwitch ? 'tabs' : DocsTab.active
        );
    });
    var DocsTab = new TabHost('docstab');
    DocsTab.onClose = closeTab;
    DocsTab.afterClick = function (id, previousTab) {
        if (previousTab === id) {
            return true;
        }
        lastTab = previousTab;
        var handled = appEvents.signal(
            'changeTab',
            {
                oldTab: lastTab,
                tab: id,
            },
            true
        ).defaultPrevented;
        if (!handled) return false;
        State.ensure(
            appConfig.disableBackButtonTabSwitch ? 'tabs' : DocsTab.active
        );
        return true;
    };
    exports.DocsTab = DocsTab;

    function setTab(tab) {
        if (DocsTab.active != tab) {
            DocsTab.setActive(tab, true, true);
        } else {
            State.ensure(appConfig.disableBackButtonTabSwitch ? 'tabs' : tab);
        }
    }
    exports.setTab = setTab;

    var lastTab;
    Actions.addAction({
        name: 'swapTabs',
        bindKey: {
            win: 'Alt-Tab',
            mac: 'Command-Alt-N',
        },
        exec: function () {
            if (!DocsTab.hasTab(lastTab))
                lastTab =
                    DocsTab.tabs[DocsTab.indexOf(DocsTab.active) + 1] ||
                    DocsTab.tabs[0];
            setTab(lastTab);
        },
    });
    function closeTab(id) {
        if (!DocsTab.hasTab(id)) return false;
        var res = appEvents.asyncTrigger('closeTab', {tab: id}, function (ev) {
            if (ev.isDelayed) return ev.repeat();
            else if (!ev.defaultPrevented) {
                DocsTab.removeTab(id);
                appEvents.trigger('tabClosed', {tab: id}, false);
            }
        });
        return !(res.isDelayed || res.defaultPrevented);
    }
    exports.closeTab = closeTab;
});