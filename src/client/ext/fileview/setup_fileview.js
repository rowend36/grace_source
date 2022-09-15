define(function (require, exports, module) {
    /*globals $*/
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Fileviews = require('grace/ext/fileview/fileviews').Fileviews;
    var appEvents = require('grace/core/app_events').AppEvents;
    require('grace/setup/setup_sideview');
    var appConfig = require('grace/core/config').Config.registerAll({
        disableOptimizedFileBrowser: false,
    });
    require('grace/core/config').Config.registerInfo({
        disableOptimizedFileBrowser:
            'On some devices, this feature has been known to cause scrolling defects. Set to true to disable. Requires restart.',
    });
    //FileBrowsers
    if (
        !appConfig.disableOptimizedFileBrowser &&
        require('./recycler_browser').RFileBrowser
    ) {
        Fileviews.Impl = require('./recycler_browser').RFileBrowser;
    } else Fileviews.Impl = require('./file_browser').FileBrowser;
    Fileviews.initialize(
        require('grace/setup/setup_sideview').SideView,
        require('grace/setup/setup_sideview').SideViewTabs
    );
    var ProjectView =
        require('./recycler_browser').RProjectView ||
        require('./file_browser').ProjectView;
    var projectView = new ProjectView($('#hierarchy'), '');
    projectView.id = 'projectView';

    FileUtils.ownChannel(
        'fileviews',
        Fileviews.Impl.prototype.onNewOption.bind(Fileviews.Impl.prototype)
    );
    Fileviews.addBrowser(projectView);

    function update(e) {
        var n = e.project.rootDir;
        if (n == FileUtils.NO_PROJECT) {
            projectView.close();
        } else {
            projectView.fileServer = e.project.fileServer;
            projectView.setRootDir(n);
            projectView.rename(projectView.names[0], e.project.name);
        }
    }
    update({
        project: FileUtils.getProject(),
    });
    appEvents.on('changeProject', update);
    appEvents.on('renameProject', function () {
        projectView.rename(projectView.names[0], FileUtils.getProject().name);
    });

    function stopFind() {
        if ($('#find_file_cancel_btn').text() == 'stop') {
            projectView.stopFind();
            $('#find_file_cancel_btn').text('refresh');
        } else {
            projectView.cancelFind();
        }
    }

    function doFind() {
        if ($('#search_text').val()) {
            projectView.findFile($('#search_text').val(), null, function () {
                $('#find_file_cancel_btn').text('refresh');
            });
            $('#find_file_cancel_btn').text('stop');
        }
    }
    require('grace/ui/ui_utils').createSearch(
        '#search_text',
        '#find_file_btn',
        doFind
    );
    $('#find_file_cancel_btn').click(stopFind);
});