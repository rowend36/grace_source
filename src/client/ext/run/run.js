define(function (require, exports, module) {
    /*globals $*/
    var Docs = require('grace/docs/docs').Docs;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Editors = require('grace/editor/editors').Editors;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
    var configure = require('grace/core/config').Config.configure;
    var Notify = require('grace/ui/notify').Notify;
    var Form = require('grace/ui/forms').Forms;
    var Config = require('grace/core/config').Config;
    var Menu = require('grace/setup/setup_main_menu').MainMenu;

    var appConfig = require('grace/core/config').Config.registerAll(
        {
            allowLiveReload: true,
            previewMode: 'split',
            useIframePreview: !Env.newWindow,
            runPath: '',
            lastRun: '',
            forceRun: '',
            folderPrefix: null,
        },
        'execute'
    );
    require('grace/core/config').Config.registerInfo(
        {
            lastRun: 'no-user-config',
            useIframePreview: Env.newWindow
                ? 'Allows running code using current window rather than opening a new window.'
                : 'no-user-config',
            previewMode: {
                doc:
                    'If useIframePreview is enabled, set how iframe should be positioned',
                values: [
                    ['split', 'Split screen into two parts'],
                    ['tab', 'Put in a separate tab'],
                    ['overlay', 'Show as overlay window'],
                ],
            },
            runPath:
                'The url to preview. If not set, it defaults to the currently open document.',
            folderPrefix: {
                type: 'string|null',
                doc:
                    'Use this to map file paths to server paths, eg name/index.html will be mapped to <runPath>/index.html if folderPrefix is name/',
            },
        },
        'execute'
    );

    var api = (exports.Execute = {});
    var runModes = {};

    var previewer;
    var viewModes = ['split', 'overlay', 'tab'];

    function preview(path, reloader) {
        require(['./previewer'], function () {
            if (Env.newWindow && !appConfig.useIframePreview) {
                return Env.newWindow(path);
            }
            var viewMode = viewModes.indexOf(appConfig.previewMode);
            if (viewMode < 0) {
                viewMode = 0;
            }
            if (previewer) {
                previewer.setEditor(getEditor());
                if (previewer.isHidden()) previewer.show(viewMode);
            } else {
                previewer = api.createPreview(getEditor());
                previewer.show(viewMode);
            }
            previewer.setPath(path, reloader);
            if (viewMode !== 1 && appConfig.allowLiveReload) {
                previewer.startLiveUpdate();
            } else previewer.stopLiveUpdate();
        });
    }
    api.preview = preview;

    api.runCode = function (editor, options) {
        var runPath = appConfig.runPath;
        var forceRun;
        var doc;
        var path = '';
        // execCommand-
        if (editor && editor.session) {
            if (options && typeof options == 'object') {
                if (typeof options.path == 'string') {
                    path = options.path;
                    //If you options.path is passed,
                    //no further processing is performed on the path
                    doc = null;
                }
                if (options.forceRun) {
                    doc = Docs.forSession(editor.session);
                    forceRun = runModes[options.forceRun];
                }
            }
        } else {
            //Default: from mouseevent
            doc = getActiveDoc();
            if (doc) path = doc.getSavePath();
        }
        //App configuration
        if (!forceRun) {
            forceRun = runModes[appConfig.forceRun];
            if (forceRun && runPath) path = runPath;
        }

        if (forceRun) {
            return forceRun.run(path, doc);
        }
        //detect using file extension
        if (path) {
            var ext = FileUtils.extname(path);
            for (var i in runModes) {
                if (runModes[i].extensions && runModes[i].extensions[ext]) {
                    return runModes[i].run(path, doc);
                }
            }
        }
        //detect using mode if it's an unsaved document
        if (doc && doc.isTemp()) {
            var mode = doc.session.getModeName();
            for (var m in runModes) {
                if (runModes[m].modes && runModes[m].modes[mode]) {
                    return runModes[m].run(doc.getPath(), doc);
                }
            }
        }
        //Finally try lastRun
        if (appConfig.lastRun) {
            HTMLFilePreview.run(appConfig.lastRun);
        } else {
            Notify.info('No configuration set!!!');
        }
    };

    api.registerRunMode = function (id, mode) {
        if (mode) runModes[id] = mode;
        Config.registerInfo(
            {
                forceRun: {
                    doc: 'The id of the preview mode',
                    values: Object.keys(runModes),
                },
            },
            'execute'
        );
    };

    //InBuilt Run Modes
    function Preview(id, name, transformFunc) {
        this.id = id;
        this.name = name;
        this.transform = transformFunc;
        this.$setDoc = function (doc) {
            this.doc = doc;
            var value = this.transform(doc.getValue());
            preview(
                './preview.html?html=' + encodeURIComponent(btoa(value)),
                this
            );
        }.bind(this);
    }
    Preview.prototype.run = function (path, doc) {
        doc = doc || Docs.forPath(path);
        if (doc) {
            this.$setDoc(doc);
        } else
            FileUtils.readFile(path, null, function (e, r) {
                if (e) return;
                this.$setDoc({
                    getValue: function () {
                        return r;
                    },
                });
            });
    };
    //only called when running in iframe
    Preview.prototype.reload = function (frame, path, live) {
        var previewPath =
            location.origin +
            FileUtils.join(
                location.pathname.replace('/index.html', ''),
                'preview.html'
            );
        var value = this.transform(this.doc.getValue());
        if (
            live &&
            frame.contentWindow &&
            frame.contentWindow.location.pathname == previewPath
        ) {
            frame.contentWindow.postMessage(
                {
                    action: 'reload',
                    type: 'html',
                    data: value,
                },
                location.origin
            );
        } else
            frame.src =
                previewPath + '?html=' + encodeURIComponent(btoa(value));
    };

    api.BasePreview = Preview;

    var InBrowserPreview = new Preview('iframe', 'Snippet', function (code) {
        return code;
    });
    InBrowserPreview.modes = {
        html: true,
    };

    var HTMLFilePreview = {
        id: 'html',
        name: 'Webpage',
        extensions: {
            html: true,
            htm: true,
            xhtml: true,
        },
        modes: {
            html: true,
        },
        run: function (path, doc) {
            //Add prefix folderPrefix, not added for execCommand path
            if (path.startsWith('temp:/')) {
                return InBrowserPreview.run(path, doc);
            }
            if (doc && appConfig.folderPrefix) {
                var runPath = path;
                path = doc.getSavePath();
                var folderPrefix = FileUtils.resolve(
                    FileUtils.getProject().rootDir,
                    appConfig.folderPrefix
                );
                if (path && path.startsWith(folderPrefix)) {
                    path = FileUtils.join(
                        runPath,
                        path.substring(folderPrefix.length)
                    );
                }
            }
            if (path.indexOf(':/') < 0) {
                //assume we were given a filepath
                var fs;
                if (doc) fs = doc.getFileServer();
                else fs = FileUtils.getFileServer();
                if (fs.href) path = FileUtils.join(fs.href, path);
                else return InBrowserPreview.run(path, doc);
            }
            if (appConfig.lastRun != path)
                configure('lastRun', path, 'execute', true);
            preview(path, this);
        },
        reload: function (preview, path, live) {
            var a = getActiveDoc();
            if (live) {
                Docs.saveDocs(a.id, function () {
                    preview.src = path + '#' + new Date().getTime();
                });
            } else {
                preview.src = path + '#' + new Date().getTime();
            }
        },
        getConfig: function () {
            return [
                {
                    type: 'text',
                    name: 'preview-url',
                    caption: 'Force Preview Url',
                    value: appConfig.runPath,
                },
                {
                    type: 'checkbox',
                    name: 'add-prefix',
                    caption: 'Add filepath to url',
                },
                {
                    type: 'text',
                    name: 'preview-prefix',
                    caption: 'Root directory',
                },
            ];
        },
        onConfigChanged: function (data) {
            configure('runPath', data['preview-url'], 'execute', true);
            if (data['add-prefix']) {
                configure(
                    'folderPrefix',
                    data['preview-prefix'],
                    'execute',
                    true
                );
            } else configure('folderPrefix', null, 'execute', true);
        },
    };
    api.registerRunMode(HTMLFilePreview.id, HTMLFilePreview);
    var ScriptRunnerSnippets = {
        log:
            '<script>function log(a){\n' +
            "if(typeof(a)=='object')a = JSON.stringify(a);\n" +
            "document.body.innerHTML += a+'<br/>'};\n</script>",
        fallbackConsole:
            '<script>if(!window.eruda){' +
            'window.onerror = function(a,b,c,d){\n' +
            "log('ERROR '+a+' at position: '+(c/*-NUM_LINES*/)+','+d);}\n" +
            'console.log=console.error=console.warn=log}</script>\n',
    };
    var ScriptRunner = new Preview('js', 'Script', function (value) {
        return (
            '<html><body>Hello' +
            this.scriptStub +
            "<script type='text/javascript'>eval(\"" +
            value
                .replace(/<\/script/g, '%SCR%ipt')
                .replace(/["\\]/g, '\\$&')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/%SCR%/g, '</scr') +
            '")</script></body></html>'
        );
    });
    ScriptRunner.modes = {
        javascript: true,
    };
    ScriptRunner.scriptStub =
        ScriptRunnerSnippets.log + ScriptRunnerSnippets.fallbackConsole;
    ScriptRunner.scriptStub = ScriptRunner.scriptStub.replace(
        'NUM_LINES',
        ScriptRunner.scriptStub.split('\n').length - 1 + ''
    );
    api.registerRunMode(ScriptRunner.id, ScriptRunner);

    //Setup
    FileUtils.registerOption(['file'], 'run-as', {
        caption: 'Set as preview url',
        extension: 'html',
        onclick: function (ev) {
            ev.preventDefault();
            configure('runPath', ev.filepath, 'execute', true);
            configure('forceRun', HTMLFilePreview.id, 'execute', true);
        },
    });
    Editors.addCommands([
        {
            name: 'run',
            bindKey: {
                win: 'F7',
                mac: 'Command-Alt-N',
            },
            exec: api.runCode,
        },
    ]);
    Menu.addOption(
        'run-now',
        {
            icon: 'play_arrow',
            caption: 'Preview',
            onclick: api.runCode,
            sortIndex: 1000,
        },
        false
    );
    Menu.extendOption(
        'load-settings',
        {
            caption: 'Configuration',
            subTree: {
                'run-as': {
                    icon: 'play_arrow',
                    subIcon: 'settings',
                    caption: 'Run Options',
                    onclick: function () {
                        var modal = $(
                            Notify.modal({
                                header: 'Preview Configuration',
                                large: true,
                                form: [
                                    {
                                        type: 'checkbox',
                                        name: 'run-in-split',
                                        caption: 'Live Preview',
                                        value: !appConfig.useIframePreview,
                                    },
                                    {
                                        type: 'select',
                                        name: 'run-mode-select',
                                        caption: 'Run as',
                                    },
                                ],
                                footers: ['Save'],
                            })
                        );
                        var content = modal.find('.modal-content')[0];
                        var controller = modal.find('#run-mode-select');
                        controller.append(
                            "<option value='default'>Auto</option>"
                        );
                        for (var i in runModes) {
                            if (runModes[i].getConfig) {
                                content.appendChild(
                                    Form.create(
                                        runModes[i].getConfig(),
                                        $(
                                            "<div class='config config-" +
                                                i +
                                                "'></div>"
                                        )[0]
                                    )
                                );
                            }
                            controller.append(
                                '<option value="' +
                                    i +
                                    '">' +
                                    runModes[i].name +
                                    '</option>'
                            );
                        }

                        function update() {
                            modal.find('.config').hide();
                            var config = modal.find(
                                '.config-' + controller.val()
                            );
                            config.show();
                        }
                        controller.change(update);

                        //Todo Perharps Add these basic behaviours to Form.create
                        if (appConfig.folderPrefix == null) {
                            modal.find('#preview-prefix').val('./public/');
                            modal
                                .find('#preview-prefix')
                                .attr('disabled', true);
                        } else {
                            modal
                                .find('#preview-prefix')
                                .val(appConfig.folderPrefix);
                            modal.find('#add-prefix')[0].checked = true;
                        }
                        modal.find('#add-prefix').change(function () {
                            modal
                                .find('#preview-prefix')
                                .attr('disabled', !this.checked);
                        });

                        modal
                            .find('#run-preview-url')
                            .attr('disabled', appConfig.runPath == '!norun');
                        modal.find('#no-run').change(function () {
                            modal
                                .find('#run-preview-url')
                                .attr('disabled', this.checked)
                                .focus();
                        });

                        if (runModes[appConfig.forceRun]) {
                            controller.val(appConfig.forceRun);
                        } else controller.val('default');
                        update();
                        modal.submit(function (e) {
                            e.stopPropagation();
                            e.preventDefault();
                            var id = controller.val();
                            configure(
                                'useIframePreview',
                                !modal.find('#run-in-split')[0].checked,
                                'execute',
                                true
                            );
                            var data = Form.parse(modal[0]);
                            if (runModes[id] && runModes[id].getConfig) {
                                runModes[id].onConfigChanged(data);
                            }
                            configure('forceRun', id, 'execute', true);
                            if (previewer) {
                                previewer.hide();
                            }
                            modal.modal('close');
                        });
                    },
                },
            },
        },
        true
    );
}); /*_EndDefine*/
