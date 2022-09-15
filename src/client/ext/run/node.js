define(function (require, exports, module) {
    var Utils = require('grace/core/utils').Utils;
    var Execute = require('./run').Execute;
    var preview = Execute.preview;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var ajax = require('grace/core/ajax').ajax;
    var appConfig = require('grace/core/config').Config.allConfigs.execute;
    var configure = require('grace/core/config').Config.configure;
    var Notify = require('grace/ui/notify').Notify;
    var debug = console;
    require('grace/core/config').Config.registerInfo({
        buildCommand: '',
        commandServer: 'The url of the fileserver eg http://localhost:3000',
        commandServerPassphrase:
            'Passphrase if present will be sent with command requests',
    });
    var TerminalPreview = {
        id: 'node',
        name: 'Terminal',
        run: function (path, doc) {
            if (this.pending) return;
            this.pending = setTimeout(
                function () {
                    this.pending = null;
                }.bind(this),
                Utils.parseTime('5s')
            );
            //does not give failure
            var currentDir = FileUtils.getProject().rootDir;
            ajax(appConfig.commandServer, {
                method: 'POST',
                data: {
                    command: appConfig.buildCommand
                        ? appConfig.buildCommand.replace(
                              '%',
                              doc && doc.getSavePath()
                          )
                        : 'npm build',
                    currentDir:
                        currentDir == FileUtils.NO_PROJECT ? '/' : currentDir,
                    password: appConfig.commandServerPassphrase,
                },
                responseType: 'text',
            }).then(function (req) {
                var res = req.responseText;
                if (TerminalPreview.pending) {
                    clearTimeout(TerminalPreview.pending);
                    TerminalPreview.pending = null;
                }
                try {
                    var result = JSON.parse(res);
                    if (result.output) {
                        debug.log(result.output);
                        if (path == '!norun') {
                            if (result.output)
                                Notify.modal({
                                    body: result.output,
                                });
                        }
                    }
                    if (result.error) {
                        console.error(result.error);
                        Notify.modal({
                            header: 'Error',
                            body: Array.isArray(result.error)
                                ? result.error.join('\n')
                                : result.error,
                        });
                    } else if (path != '!norun') preview(path);
                } catch (e) {
                    debug.log(e, res);
                    Notify.error('Invalid output received from server');
                }
            });
        },
        getConfig: function () {
            return [
                {
                    type: 'text',
                    caption: 'Server address',
                    name: 'preview-server',
                    value: appConfig.commandServer,
                },
                {
                    caption: 'Server passphrase',
                    type: 'text',
                    name: 'preview-server-pass',
                    value: appConfig.commandServerPassphrase,
                },
                "<div><span class='blue-text'>%</span> is replaced with the current document path.</div>",

                {
                    type: 'text',
                    caption: 'Build Command',
                    name: 'preview-command',
                    value: appConfig.buildCommand || 'npm build',
                },
                {
                    type: 'checkbox',
                    caption: 'Disable preview',
                    name: 'no-run',
                    value: appConfig.runPath == '!norun',
                },
                {
                    type: 'text',
                    caption: 'Preview Url',
                    name: 'run-preview-url',
                    value: appConfig.runPath,
                },
            ];
        },
        onConfigChanged: function (data) {
            configure('buildCommand', data['preview-command'], 'execute', true);
            configure('commandServer', data['preview-server'], 'execute', true);
            configure(
                'commandServerPassphrase',
                data['preview-server-pass'],
                'execute',
                true
            );
            var runPath = data['no-run'] ? '!norun' : data['run-preview-url'];
            configure('runPath', runPath, 'execute', true);
        },
    };
    Execute.registerRunMode('node', TerminalPreview);
});
