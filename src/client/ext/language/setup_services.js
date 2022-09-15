define(function (require, exports, module) {
    require('grace/ext/file_utils/glob');
    var appEvents = require('grace/core/app_events').AppEvents;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var MainMenu = require('grace/setup/setup_main_menu').MainMenu;
    var Utils = require('grace/core/utils').Utils;
    var Notify = require('grace/ui/notify').Notify;
    var configEvents = require('grace/core/config').Config;
    var ccompletions = ace.require('ace/ext/completions');
    var Editors = require('grace/editor/editors').Editors;
    var ServerHost = require('./server_host').ServerHost;
    var BaseClientProps = require('./base_client').BaseClient.prototype;
    require('./tags/setup_tags');
    require('./ts/ts_provider');
    require('./misc/snippets');
    require('./tern/tern_provider');
    require('./lsp/lsp_provider');
    var watchMemory = ServerHost.$watchMemory;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            functionHintOnlyOnBoundaries: true,
        },
        'autocompletion'
    );
    require('grace/core/config').Config.registerInfo(
        {
            '!root':
                'Setup autocompletion engines.\nTo disable autocompletion entirely, see editors.enableBasicAutocompletion',
            maxSingleFileSize: {
                type: 'size',
                doc:
                    'Prevent editor from hanging by stopping it from parsing large files',
            },
            preloadConfigs: {
                doc:
                    "Configure how files should be preloaded into the editor for autocompletion. Preloading improves completions and when used with restricting options like neverAllowLoad, enableTagGathering,etc gives you better control over memory usage. Format:\n\
{\n\
    extensions: Array<String> - the file extensions to load eg ['js','ts'],\n\
    completer: ?Array<String> - the name of the completer. Must be one or more of 'ternClient','tsClient'(ie typescript), 'tagsClient' or any registered lanaguage service name. Defaults to all.\n\
    rootDir: ?String - the filepath to resolve relative paths from. Defaults to current project directory.\n\
    loadEagerly: Array<String> - the list of files to load. Filepaths can contain wildcards. Note: The files are loaded in directory order.\n\
    exclude: ?Array<String> - Files to exclude ie files that should be ignored in loadEagerly list \n\
}\n\
Note: When multiple configs are specified, they are loaded in the order they are specified..  Users can interactively generate a config file using the Project menu option>Generate loader",
                type: [
                    {
                        extensions: 'array<filename>',
                        completer: '?array<[ternClient,tsClient,tagsClient]>',
                        rootDir: '?string',
                        loadEagerly: 'array<string>',
                        exclude: '?array<string>',
                    },
                ],
            },
            functionHintOnlyOnBoundaries:
                "When enabled, function hints will only show at ',' and beginning of argument list",
            maxFileLoadSize: {
                type: 'size',
                doc: 'The maximum total size of files to load into memory',
            },
            preloadTimeout: {
                type: 'time',
                doc:
                    'On startup, the maximum amount of time to spend load files into memory. Prevents background loading from disrupting editor user interface.',
            },
        },
        'autocompletion'
    );
    configEvents.on('autocompletion', updateBaseClient);
    function updateBaseClient() {
        BaseClientProps.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
        if (appConfig.functionHintOnlyOnBoundaries)
            BaseClientProps.functionHintTrigger = ',()';
        else BaseClientProps.functionHintTrigger = null;
    }
    updateBaseClient();

    MainMenu.addOption(
        'reload-project',
        {
            close: true,
            icon: 'autorenew',
            caption: 'Reload Completions',
            onclick: function () {
                appEvents.asyncTrigger('reloadProject', null, function (e) {
                    Notify.info('Reloaded');
                });
            },
        },
        true
    );

    /*
       It's faster to reload workers than to reload the application
       Especially on Android where we have to restart the entire activity
    */
    var stopServers = Utils.delay(
        function () {
            appEvents.trigger('pauseAutocomplete');
            Editors.forEach(function (e) {
                ccompletions.updateCompleter(e);
            });
            appEvents.once('appResumed', resumeServers);
        },
        Env.isWebView ? 10000 : 1000
    );

    function resumeServers() {
        appEvents.trigger('resumeAutocomplete');
        Editors.forEach(function (e) {
            ccompletions.updateCompleter(e);
        });
        ServerHost.loadAutocompleteFiles();
        appEvents.once('appPaused', stopServers);
    }

    //Replace this with a modal
    FileUtils.registerOption(['project'], 'load-comp', {
        caption: 'Project...',
        subTree: {
            'force-stop-servers': {
                caption: 'Force Reload Completions',
                onclick: function (ev) {
                    ev.preventDefault();
                    watchMemory.now();
                },
            },
            'generate-load-file': {
                caption: 'Generate Loader file',
                onclick: function (ev) {
                    ev.preventDefault();
                    require(['./misc/generate_load_config'], function (mod) {
                        mod.generateLoadConfig(ev);
                    });
                },
            },
            'export-tags': {
                caption: 'Export Tags',
                onclick: function (ev) {
                    ev.preventDefault();
                    var folder = ev.filepath + '/' + Utils.genID('tags');
                    ev.browser.fileServer.mkdir(folder, function () {
                        require('./tags/setup_tags').TagCompleter.exportTags(
                            ev.browser.fileServer,
                            folder,
                            Notify.info.bind(null, 'Done')
                        );
                    });
                },
            },
        },
    });

    appEvents.once('fullyLoaded', resumeServers);
    appEvents.on('appResumed', stopServers.cancel);

    function trimMemory() {
        stopServers.now();
        resumeServers();
    }
    appEvents.on('trimServerMemory', trimMemory);
}); /*_EndDefine*/