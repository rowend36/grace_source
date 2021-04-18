_Define(function(global) {
    var FileUtils = global.FileUtils;
    var Notify = global.Notify;
    var app = global.AppEvents;
    var getEditor = global.getEditor;
    var docs = global.docs;
    var Functions = global.Functions;
    var TimeoutTransport = function() {
        BasicTransport.call(this, arguments);
        var a = this.postMessage;
        this.postMessage = function(data, cb) {
            setTimeout(a.bind(this, data, cb), 20);
        };
    };
    var modules = "none,commonjs,amd,umd,system,es2015,esnext";
    var config = global.registerAll({
        "tsModuleKind": "none"
    }, "autocompletion");
    global.registerValues({
        "tsModuleKind": modules
    });
    var BasicTransport = function(getFile) {
        var server;
        this.postMessage = global.BootList.define(["./src-min-noconflict/worker-typescript.js"], function() {
            console.log('loaded');
            server = new TsServer(getFile);
        }, function(data, cb) {
            var res, error;
            try {
                res = (server[data.type] || server.getLSP()[data.type]).apply(server, data.args);
            } catch (e) {
                error = e;
                console.log(error);
            }
            cb && cb(error, res);
        });
    };
    var WorkerTransport = function(getFile) {
        var waiting = {};
        var lastId = 1;
        var worker = new Worker("./src-min-noconflict/worker-typescript.js");
        this.postMessage = function(data, cb) {
            if (cb) {
                data.id = lastId;
                waiting[lastId++] = cb;
            } else data.id = 0;
            worker.postMessage(data);
        };
        worker.onmessage = function(e) {
            var data = e.data;
            if (data.type == 'getFile') {
                return getFile(data.path);
            }
            var cb = waiting[data.id];
            if (cb) {
                delete waiting[data.id];
                cb(data.error, data.res);
            }
        };
        worker.onerror = function(e) {
            for (var i in waiting) {
                waiting[i](e);
            }
            console.error(e);
            waiting = {};
        };
        this.terminate = function() {
            worker.terminate();
            waiting = {};
        };
    };

    global.tsCompletionProvider = {
        init: function(editor, cb) {
            var initOptions = this.options;
            var reuse = editor.tsServer || initOptions.server || (initOptions.shared !== false && this.instance);
            if (reuse) {
                cb(reuse);
            } else {
                var instance = new global.TsServer(new WorkerTransport(function(path) {
                    global.tsCompletionProvider.options.getFile(path, function(e, res) {
                        console.log('sent', data.path);
                        if (!e && res) {
                            instance.sendDoc(instance.addDoc(path,res,true));
                        }
                    });
                }), initOptions);
                instance.bindAceKeys(editor);
                if (initOptions.shared !== false) {
                    this.instance = instance;
                }
                cb(instance);
            }
        },
        triggerRegex: /[^\.]\.$/,
        options: {
            switchToDoc: Functions.switchToDoc,
            getFileName: Functions.getFileName,
            getFile: Functions.getFile,
            normalize: global.FileUtils.normalize,
            compilerOptions: {
                strict: true,
                module: Math.max(0, modules.indexOf(config.tsModuleKind)),
                noImplicitAny: false
            },
            server: null /*Memory Leak and Buggy. Use shared*/
        },
        release: function(editor, server) {
            if (server) {
                server.unbindAceKeys(editor);
                if (server != this.instance) {
                    this.destroy(server);
                }
            }
        },
        destroy: function(instance) {
            if (!instance) {
                if (!this.instance) return;
                instance = this.instance;
                this.instance = null;
            } else if (instance == this.instance) {
                this.instance = null;
            }
            for (var i in instance.docs) {
                instance.closeDoc(i);
            }
            instance.transport.terminate();
        },
        embeddable: false,
        isSupport: false,
        hasArgHints: true,
        priority: 900,
        hasAnnotations: true,
        hasKeyWords: false,
        hasText: false,
        hasStrings: false,
        name: "tsServer",
    };
});
