define(function(require, exports, module) {
    var appConfig = require("grace/core/config").Config.appConfig;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var EventsEmitter = require("grace/core/events").EventsEmitter;
    var classic = require("./file_browser");
    var Fileviews = require("grace/ext/fileview/fileviews").Fileviews;
    require("grace/setup/setup_sideview");
    //FileBrowsers
    if (!appConfig.disableOptimizedFileBrowser &&
        require("./recycler_browser").RFileBrowser) {
        Fileviews.Impl = require("./recycler_browser").RFileBrowser;
    } else Fileviews.Impl = require("./file_browser").FileBrowser;
    Fileviews.initialize(require("grace/setup/setup_sideview").SideView, require("grace/setup/setup_sideview")
        .SideViewTabs);
    var ProjectView = require("./recycler_browser").RProjectView || classic
        .ProjectView;
    var projectView = new ProjectView($(
        "#hierarchy"), "");
    projectView.id = "projectView";
    projectView.emitter = new EventsEmitter(
        projectView.emitter);
    FileUtils.ownChannel("project", projectView
        .onNewOption.bind(projectView));
    Fileviews.addBrowser(projectView);

    function update(e) {
        var n = e.project.rootDir;
        if (n == FileUtils.NO_PROJECT) {
            projectView.close();
        } else {
            projectView.fileServer = e.project
                .fileServer;
            projectView.setRootDir(n);
            projectView.rename(projectView.names[0],
                e.project.name);
        }
    }
    update({
        project: FileUtils.getProject(),
    });
    FileUtils.on("change-project", update);
    FileUtils.on("change-project-name", function() {
        projectView.rename(
            projectView.names[0],
            FileUtils.getProject().name
        );
    });

    function stopFind() {
        if ($("#find_file_cancel_btn").text() ==
            "stop") {
            projectView.stopFind();
            $("#find_file_cancel_btn").text(
                "refresh");
        } else {
            projectView.cancelFind();
        }
    }

    function doFind() {
        if ($("#search_text").val()) {
            projectView.findFile(
                $("#search_text").val(),
                null,
                function() {
                    $("#find_file_cancel_btn")
                        .text("refresh");
                }
            );
            $("#find_file_cancel_btn").text("stop");
        }
    }
    require("grace/ui/ui_utils").createSearch('#search_text',
        "#find_file_btn", doFind);
    $("#find_file_cancel_btn").click(stopFind);
});