define(function (require, exports, module) {
    /*globals $*/
    var appEvents = require("../core/app_events").AppEvents;
    var getEditor = require("./setup_editors").getEditor;
    var Statusbar = require("ace!ext/statusbar").StatusBar;
    var DocsTab = require("./setup_tab_host").DocsTab;

    var statusBar = new (require("../ui/view").View)(
        $(
            '<div id="status-bar" class="editor-primary">' +
                '<span id="status-filename" class="clipper">Open a file</span>' +
                "</div>"
        )
    );

    function onChangeTab(ev) {
        var populator = DocsTab.getOwner(DocsTab.active);
        if (populator && populator.getInfo) {
            $("#status-filename", statusBar.$el).html(
                populator.getInfo(DocsTab.active)
            );
        }
    }
    require("../ui/focus_manager").FocusManager.trap(statusBar.$el, true);
    require("../ui/ui_utils").styleClip($("#status-filename"));

    var StatusBar = new Statusbar(getEditor(), statusBar.$el[0]);

    function handleEditorChange(e) {
        StatusBar.setEditor(e.editor);
        StatusBar.updateStatus(e.editor);
    }
    appEvents.on("changeEditor", handleEditorChange);
    require("./setup_root").rootView.addView(statusBar, 4, 20);
    appEvents.on("changeTab", onChangeTab);
    appEvents.on("renameDoc", onChangeTab);

    if (DocsTab.active)
        onChangeTab({
            tab: DocsTab.active,
        });
    exports.statusBarView = statusBar;
});