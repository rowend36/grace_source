define(function (require, exports, module) {
    require('grace/ext/file_utils/glob');
    var appEvents = require('grace/core/app_events').AppEvents;
    var Actions = require('grace/core/actions').Actions;
    var Utils = require('grace/core/utils').Utils;
    var Notify = require('grace/ui/notify').Notify;
    var ServerHost = require('./server_host').ServerHost;

    require('./tags/setup_tags');
    require('./ts/ts_provider');
    require('./misc/snippets');
    require('./tern/tern_provider');
    require('./lsp/lsp_provider');
    
    
    /*
       It's faster to reload workers than to reload the application
       Especially on Android where we have to restart the entire activity.
    */
    var stopServers = Utils.delay(
        function () {
            appEvents.trigger('pauseAutocomplete');
            appEvents.once('appResumed', resumeServers);
        },
        Env.isWebView ? 10000 : 1000,
    );
    appEvents.on('appResumed', stopServers.cancel);

    function resumeServers() {
        appEvents.trigger('resumeAutocomplete');
        ServerHost.loadAutocompleteFiles();
        appEvents.once('appPaused', stopServers);
    }
    //Do this before Annotations.updateWorkers delayed in setup_editors
    appEvents.once('fullyLoaded', resumeServers, true);

    function trimMemory() {
        stopServers.now();
        if (!appEvents.paused) resumeServers();
    }
    appEvents.on('trimServerMemory', trimMemory);

    Actions.addAction({
        showIn: 'actionbar.more',
        icon: 'autorenew',
        caption: 'Reload completions',
        handle: function () {
            appEvents.asyncTrigger('reloadProject', null, function (e) {
                Notify.info('Reloaded');
            });
        },
    });

    var watchMemory = ServerHost.$watchMemory;
    var languageOptions = {};
    Actions.addAction({
        caption: 'Project...',
        showIn: 'fileview.project',
        subTree: languageOptions,
    });
    Actions.addActions(
        {
            'force-stop-servers': {
                caption: 'Force reload completions',
                handle: function (ev) {
                    ev.preventDefault();
                    watchMemory.now();
                },
            },
            //Replace this with a modal
            'generate-load-file': {
                caption: 'Generate loader file',
                handle: function (ev) {
                    ev.preventDefault();
                    require(['./misc/generate_load_config'], function (mod) {
                        mod.generateLoadConfig(ev);
                    });
                },
            },
        },
        {showIn: 'fileview.language'},
    );
    Actions.registerActionHost('fileview.language', function (action) {
        languageOptions[action.id] = action;
        languageOptions['!changed'] = true;
    });
    
    appEvents.on('showDocInfo', function (e) {
        var editor = require('grace/setup/setup_editors').getEditor();
        var instance = editor.getMainCompleter();
        e.data['Completion Providers'] =
            editor.completers &&
            editor.completers.map(function (e) {
                return (
                    e.name ||
                    (e.provider && e.provider.name) ||
                    e.constructor.name
                );
            });
        e.data['Loaded Documents'] = instance ? Object.keys(instance.docs) : '';
    });
}); /*_EndDefine*/