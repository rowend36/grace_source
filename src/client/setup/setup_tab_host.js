define(function(require, exports, module) {
    //add noexit before documents
    require("./setup_state");
    /**
     * The TabHost aka DocsTab is a controller for the tabs in the ActionBar.
     * Each document that is open has a tab which when active, opens the document in the active main editor
     * See setup_editors.js
     */
    var State = require("../core/state_manager").State;
    var appConfig = require("../core/config").Config.appConfig;
    var Utils = require("../core/utils").Utils;
    var appEvents = require("../core/events").AppEvents;
    var TabHost = require("../ui/tab_host").TabHost;
    State.addListener(
        function(tab) {
            if (tab && DocsTab.getOwner(tab)) {
                //can try to reopen previously closed docs
                if (!appConfig.disableBackButtonTabSwitch && DocsTab
                    .hasTab(tab)) {
                    if (tab != DocsTab.active) setTab(tab);
                    return true;
                }
                return false;
            } else if (tab === "tabs") {
                return true;
            }
        },
        function(state) {
            return state === "tabs" || DocsTab.hasTab(state);
        }
    );
    appEvents.on("appResumed", function() {
        State.ensure(appConfig.disableBackButtonTabSwitch ?
            "tabs" : DocsTab.active);
    });
    var DocsTab = new TabHost("docstab");
    DocsTab.onClose = closeTab;
    DocsTab.afterClick = Utils.guardEntry(function switchTab(id,
        previousTab) {
        if (previousTab === id) {
            return false;
        }
        lastTab = previousTab;
        
        //An error in handling this event will give an invalid state
        //and so must be handled by the handler itself
        var handled = appEvents.trigger("changeTab", {
            oldTab: lastTab,
            tab: id,
        }).defaultPrevented;
        if (!handled) {
            return false;
        }
        State.ensure(appConfig.disableBackButtonTabSwitch ?
            "tabs" : id);
        return true;
    });
    exports.DocsTab = DocsTab;

    function setTab(tab) {
        if (DocsTab.active != tab) {
            DocsTab.setActive(tab, true, true);
        } else {
            State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" :
                tab);
        }
    }
    exports.setTab = setTab;

    var lastTab;
    exports.swapTab = function() {
        if (!DocsTab.hasTab(lastTab))
            lastTab = DocsTab.tabs[DocsTab.indexOf(DocsTab.active) +
                1] || DocsTab.tabs[0];
        setTab(lastTab);
    };

    //This should be an async function,
    //The user could want to save the file before closing,
    //click a dialog, etc
    //Instead, I use a taglist which means we close the tab ourselves
    //when it is done without fear of transient scenarios
    function closeTab(id, flags) {
        if (
            appEvents.trigger("confirmCloseTab", {
                tab: id,
                flags: flags || []
            }).defaultPrevented
        )
            return false;
        appEvents.trigger("closeTab", {
            tab: id,
        }, true);
        DocsTab.removeTab(id);
        appEvents.trigger("closedTab", {
            tab: id
        });
        //rebase && AutoCloseable.add(SidenavLeft.id, SidenavLeft);

    }
    exports.closeTab = closeTab;
    console.debug('setup tab host');
    /*
     * @method switchToDoc
     * Switch to a document
     * @param {String} name Path to the document
     * @param {Object} [pos] Selection start or cursor position
     * @param {Object} [end] Selection end
     * @param {EditSession|String|Boolean|undefined} [autoload] How to handle path not found
     * @param {Function} [callback]
     * @param {FileServer} [server] The server to use in loading the file
     * @related Docs#openDoc
     * @related FileUtils#getDoc
     */
});