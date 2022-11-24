define(function (require, exports, module) {
    require('grace/ext/file_utils/glob');
    var Notify = require('grace/ui/notify').Notify;
    var Utils = require('grace/core/utils').Utils;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Configs = require('grace/ext/config/configs').Configs;
    var getFormatter = require('grace/ext/format/formatters').getFormatter;
    /**
     * @param {FS} server
     * @param {string} projectFolder
     * @param {Array<string>} extensions
     * @param {$Element} el
     * @param {Function} cb
     */
    function gatherGlobs(server, projectFolder, extensions, el, cb) {
        var isDir = FileUtils.isDirectory;
        var preload = [];

        function onResult(type, path, priority, parentPriority) {
            switch (type) {
                case 'load_recursively':
                    if (priority != parentPriority) {
                        preload.unshift({
                            pr: priority,
                            globPath: path + '**',
                        });
                        return [null, true];
                    } else return [path + '**', true];
                    // @ts-ignore - Jshint will complain without break
                    break;
                case 'load':
                    return [
                        {
                            priority: priority,
                            parentPriority: parentPriority,
                            path: path + '*',
                        },
                    ];
                case 'ignore':
                    return [null, true];
            }
        }

        var waiting = [],
            isShown = false,
            /*[path, onChoose, data]*/
            /*data = {storedValue?,results,errors,initialValue,data}*/
            /*data.initialValue = {path,priority,parentPriority}*/
            /*data.data = [{pr,path}]*/
            /*storedValue {priority,type}*/
            currentData;
        var PATH = 0,
            ON_CHOOSE = 1,
            DATA = 2;

        el.find('.modal-footer').css('height', 'auto');
        el.find('.btn').on('click', function () {
            if (!currentData)
                return console.error(
                    'Found impossible situation: currentData called twice'
                );
            var type = this.name;

            var nextItem = currentData[ON_CHOOSE];
            //prevent choosing twice
            if (type == 'stop') {
                currentData = null;
                nextItem(stop());
            } else {
                var options = el.find('input');
                var storeResult = options[1].checked;
                var priority = options[0].value;
                var path = currentData[PATH];
                var data = currentData[DATA];
                if (storeResult)
                    data.storedValue = {
                        type: type,
                        priority: priority,
                    };
                currentData = null;
                nextItem.apply(
                    null,
                    onResult(type, path, priority, data.initialValue.priority)
                );
            }
            if (waiting.length) {
                updateForm(waiting.shift());
            } else if (isShown) {
                isShown = false;
                hideModal();
            }
        });

        function updateForm(args) {
            el.find('.auto-filename')[0].innerText = args[PATH];
            el.find('input')[0].value = args[DATA].initialValue.priority;
            currentData = args;
        }
        function modal(path, next, stop, isDirectory, files, data) {
            if (data.storedValue) {
                next.apply(
                    null,
                    onResult(
                        data.storedValue.type,
                        path,
                        data.storedValue.priority,
                        data.initialValue.priority
                    )
                );
            } else if (isShown) {
                waiting.push([path, next, data]);
            } else {
                hideModal.cancel();
                el.modal('open');
                isShown = true;
                updateForm([path, next, data]);
            }
        }

        var hideModal = Utils.delay(function () {
            el.modal('close');
        }, 1000);
        var stop = FileUtils.walk({
            fs: server,
            dir: projectFolder,
            map: modal,
            reduce: function (folder, subFolders, data) {
                preload.push({
                    pr: data.initialValue.priority,
                    globPath: data.initialValue.path,
                });
                return true;
            },
            initialValue: {
                priority: 0,
                parentPriority: -1,
                path: '',
            },
            iterate: function (iterate, folder, children, data, done) {
                iterate(folder, children.filter(isDir), data, done);
            },
            finish: function () {
                el.find('button').off();
                hideModal.cancel();
                isShown = false;
                el.modal('close'); //necessary to reset modalsOpen
                el.modal('destroy');
                el.remove();
                var folders = [],
                    lastPr;
                preload
                    .sort(function (e, r) {
                        return r.pr - e.pr;
                    })
                    .forEach(function (f) {
                        if (f.pr === lastPr) {
                            folders[folders.length - 1].push(f.globPath);
                        } else {
                            lastPr = f.pr;
                            folders.push([f.globPath]);
                        }
                    });
                cb(folders);
            },
        });
    }

    function applyConfig(server, projectFolder, extensions, folders) {
        var config = {
            'intellisense.preloadConfigs+': folders.map(function (paths) {
                return {
                    extensions: extensions,
                    completer: ['ternClient', 'tsClient', 'tagsClient'],
                    rootDir: projectFolder,
                    loadEagerly: paths,
                    exclude: [],
                };
            }),
        };
        getFormatter('json')(
            JSON.stringify(config),
            {
                'end-expand': true,
                wrap_line_length: 20,
                mode: 'json',
            },
            function (res) {
                var JSONExt = require('grace/ext/json_ext').JSONExt;

                res = JSONExt.addComments(res, function (key) {
                    switch (key) {
                        case 'extensions':
                            return 'List of file extensions to load';
                        case 'loadEagerly':
                            return 'Files that will be loaded automatically on start';
                        case 'exclude':
                            return 'Files to exclude ie files that should be ignored in loadEagerly list';
                    }
                });
                Notify.ask(
                    'Add settings to project?',
                    function () {
                        require('grace/ext/fileview/fileviews').Fileviews.pickFile(
                            'Choose project configuration file',
                            function (ev) {
                                ev.preventDefault();
                                saveFile(server, ev.filepath, res);
                                if (ev.filepath) {
                                    Configs.setConfig(ev.filepath, config);
                                    Configs._debug = true;
                                    Configs.commit();
                                    Configs._debug = false;
                                }
                            },
                            true
                        );
                    },
                    function () {
                        Notify.ask('Apply settings? ', function () {
                            Configs.save(config);
                        });
                    }
                );
            }
        );
    }
    function saveFile(server, path, res) {
        server.readFile(path, function (oldContent) {
            if (oldContent) {
                res = oldContent.replace(/\{(\s*)|$/, '$&' + res + '$1');
            } else res = '//GRACE_CONFIG\n' + res;
            server.writeFile(path, res, function () {
                Notify.info('Saved');
            });
        });
    }
    exports.generateLoadConfig = function (ev) {
        var projectFolder = ev.filepath;
        var server = ev.fs;
        Notify.prompt(
            'Enter file extensions separated by commas',
            function (ans) {
                if (!ans) return false;
                Notify.modal({
                    header:
                        "Load files from <span class='auto-filename'></span>",
                    form: [
                        {
                            type: 'number',
                            value: '100',
                            name: 'priority',
                            caption: 'Priority: Higher values get loaded first',
                        },
                        {
                            type: 'checkbox',
                            name: 'repeatAction',
                            caption:
                                'Repeat action for remaining directories in this folder',
                        },
                        {
                            type: 'button',
                            name: 'stop',
                        },
                        {
                            type: 'button',
                            name: 'ignore',
                        },
                        {
                            type: 'button',
                            name: 'load',
                        },
                        {
                            type: 'button',
                            name: 'load_recursively',
                            caption: 'Load Recusrively',
                        },
                    ],
                    keepOnClose: true,
                    autoOpen: false,
                    dismissible: false,
                    onCreate: function (el) {
                        var extensions = Utils.parseList(ans);
                        gatherGlobs(
                            server,
                            projectFolder,
                            extensions,
                            el,
                            function (folders) {
                                applyConfig(
                                    server,
                                    projectFolder,
                                    extensions,
                                    folders
                                );
                            }
                        );
                    },
                });
            },
            'js',
            ['py', 'cpp,c,h,cxx', 'java', 'ts,tsx,js,jsx']
        );
    };
});