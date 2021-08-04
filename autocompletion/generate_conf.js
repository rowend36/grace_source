_Define(function(global) {
    var Notify = global.Notify;
    var Utils = global.Utils;
    var FileUtils = global.FileUtils;
    var appConfig = global.registerAll({}, "autocompletion");
    var configure = global.configure;
    global.generate_conf = function(ev) {
        var e = ev.filepath;
        var server = ev.browser.fileServer;
        Notify.prompt("Enter file extensions separated by commas/space", function(ans) {
            if (!ans) return false;
            var extensions = Utils.parseList(ans);
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

            var el = $(Notify.modal({
                header: "Load files from <span class='auto-filename'></span>",
                form: [{
                    type: 'number',
                    value: '100',
                    name: 'priority',
                    caption: 'Priority: Higher values get loaded first'
                }, {
                    type: 'checkbox',
                    name: 'repeatAction',
                    caption: 'Repeat action for remaining directories in this folder'
                }, {
                    type: 'button',
                    name: 'stop'
                }, {
                    type: 'button',
                    name: 'ignore'
                }, {
                    type: 'button',
                    name: 'load'
                }, {
                    type: 'button',
                    name: "load_recursively",
                    caption: 'Load Recusrively'
                }],
                keepOnClose: true,
                autoOpen: false,
                dismissible: false
            }));

            function show(args) {
                el.find('.auto-filename')[0].innerText = args[PATH];
                el.find('input')[0].value = args[DATA].initialValue.priority;
                currentData = args;
            }
            global.styleCheckbox(el);
            el.find('.modal-footer').css('height', 'auto');
            var preload = [];

            function onResult(type, path, priority, parentPriority) {
                switch (type) {
                    case 'load_recursively':
                        if (priority != parentPriority) {
                            preload.unshift({
                                pr: priority,
                                globPath: path + "**"
                            });
                            return [null, true];
                        } else return [path + "**", true];
                        break;
                    case 'load':
                        return [{
                            priority: priority,
                            parentPriority: parentPriority,
                            path: path + "*"
                        }];
                    case 'ignore':
                        return [null, true];
                }
            }
            el.find('.btn').on('click', function() {
                if (!currentData) return console.warn(
                    "Found impossible situation: currentData called twice");
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
                    if (storeResult) data.storedValue = {
                        type: type,
                        priority: priority
                    };
                    currentData = null;
                    nextItem.apply(null, onResult(type, path, priority, data
                        .initialValue.priority));
                }

                if (waiting.length) {
                    show(waiting.shift());
                } else if (isShown) {
                    isShown = false;
                    close();
                }
            });
            var close = Utils.delay(function() {
                el.modal('close');
            }, 1000);

            function modal(path, next, stop, isDirectory, files, data) {
                if (data.storedValue) {
                    next.apply(null, onResult(data.storedValue.type, path, data.storedValue
                        .priority, data
                        .initialValue
                        .priority));
                } else if (isShown) {
                    waiting.push([path, next, data]);
                } else {
                    close.cancel();
                    el.modal('open');
                    isShown = true;
                    show([path, next, data]);
                }
            }
            var isDir = FileUtils.isDirectory;
            var stop = FileUtils.walk({
                fs: server,
                dir: e,
                map: modal,
                reduce: function(folder, children, data) {
                    children.unshift(data.initialValue.path);
                    var folders = children.filter(Boolean);
                    var res = folders.join(",");
                    if (data.initialValue.priority != data.initialValue
                        .parentPriority) {
                        if (res) preload.push({
                            pr: data.initialValue.priority,
                            globPath: res
                        });
                        return null;
                    } else return res;
                },
                initialValue: {
                    priority: 0,
                    parentPriority: -1,
                    path: ""
                },
                iterate: function(iterate, folder, children, data, done) {
                    iterate(folder, children.filter(isDir), data, done);
                },
                finish: function() {
                    el.find('button').off();
                    close.cancel();
                    isShown = false;
                    el.modal('close'); //necessary to reset modalsOpen
                    el.modal('destroy');
                    el.remove();
                    var folders = [],
                        lastPr;
                    preload.sort(function(e, r) {
                        return r.pr - e.pr;
                    }).forEach(function(f) {
                        if (f.pr == lastPr) {
                            folders[folders.length - 1].push(f.globPath);
                        } else {
                            lastPr = f.pr;
                            folders.push([f.globPath]);
                        }
                    });
                    var JSONExt = global.JSONExt;
                    var config = {
                        "autocompletion.preloadConfigs+": folders.map(function(
                            paths) {
                            return {
                                extensions: extensions,
                                completer: ["ternServer", "tsServer",
                                    "tagServer"
                                ],
                                rootDir: e,
                                loadEagerly: paths,
                                exclude: []
                            };
                        })
                    };
                    global.getBeautifier('json')(JSON.stringify(config), {
                        "end-expand": true,
                        "wrap_line_length": 20
                    }, function(res) {
                        res = JSONExt.addComments(res, function(key) {
                            switch (key) {
                                case "extensions":
                                    return "List of file extensions to load";
                                case "loadEagerly":
                                    return "Files that will be loaded automatically on start";
                                case "exclude":
                                    return "Files to exclude ie files that should be ignored in loadEagerly list";
                            }
                        });
                        Notify.prompt(
                            res+
                            "\n\nTo save config to this folder, enter file name:",
                            function(name) {
                                global.Config.apply(config, null, null,
                                    name == undefined);
                                if (name) {
                                    ev.browser.fileServer.readFile(FileUtils
                                        .join(ev.filepath,
                                            name),
                                        function(e, content) {
                                            if (content) {
                                                res = content.replace(
                                                    /\{(\s*)|$/,
                                                    "$&" + res +
                                                    "$1");
                                            } else res =
                                                "//GRACE_CONFIG\n" +
                                                res;
                                            ev.browser.fileServer
                                                .writeFile(
                                                    FileUtils.join(ev
                                                        .filepath, name
                                                        ),
                                                    res,
                                                    function() {
                                                        Notify.info(
                                                            "Saved");
                                                    });
                                        });
                                }
                            }, "grace-load.json");
                    });
                }
            });
        }, "js", ["py", "cpp,c,h,cxx", "java", "ts,tsx,js,jsx"]);

    };
});