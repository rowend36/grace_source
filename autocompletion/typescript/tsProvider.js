_Define(function(global) {
  var FileUtils = global.FileUtils;
  var Notify = global.Notify;
  var app = global.AppEvents;
  var getEditor = global.getEditor;
  var docs = global.docs;
  var Functions = global.Functions;
  var Utils = global.Utils;
  var Imports = global.Imports;
  var modules = ["none", "commonjs", "amd", "umd", "system", "es2015", "esnext"];
  var tsLibs = ["default", "dom", "dom.iterable", "es2015.collection", "es2015.core", "es2015", "es2015.generator",
    "es2015.iterable", "es2015.promise", "es2015.proxy", "es2015.reflect", "es2015.symbol", "es2015.symbol.wellknown",
    "es2016.array.include", "es2016", "es2016.full", "es2017", "es2017.full", "es2017.intl", "es2017.object",
    "es2017.sharedmemory", "es2017.string", "es5", "es6", "esnext.asynciterable", "esnext", "esnext.full", "scripthost",
    "webworker"
  ];
  var config = global.registerAll({
    "tsModuleKind": "commonjs",
    "tsModuleResolution": "classic",
    "tsLibs": "default,dom,es5",
    "noImplicitAny": false,
    "useWorkerForTs": false,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "alwaysStrict": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitUseStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": false,
    "strict": true,
    "strictNullChecks": true,
    "suppressExcessPropertyErrors": true,
    "suppressImplicitAnyIndexErrors": true
  }, "autocompletion.typescript");
  global.registerValues({
    "tsModuleKind": {
      values: modules
    },
    "tsModuleResolution": "Either 'classic' or 'node'",
    "tsLibs": {
      values: tsLibs
    },
  }, "autocompletion.typescript");
  var BasicTransport = function(getFile) {
    var server;
    this.postMessage = Imports.define(["./src-min-noconflict/worker-typescript.js"], function() {
      server = new TsServer(getFile);
    }, function(data, cb) {
      var res, error;
      try {
        res = (server[data.type] || server.getLSP()[data.type]).apply(server, data.args);
      } catch (e) {
        error = e;
        console.error(error);
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
      if (data.error) console.error(data.error);
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
    init: Imports.define(["./autocompletion/typescript/tsClient.js"], null, function(editor, cb) {
      var initOptions = this.options;
      var reuse = editor.tsServer || initOptions.server || (initOptions.shared !== false && this.instance);
      if (reuse) {
        reuse.bindAceKeys(editor);
        cb(reuse);
      } else {
        var Transport = config.useWorkerForTs ? WorkerTransport : BasicTransport;
        var instance = new global.TsServer(new Transport(function(path) {
          global.tsCompletionProvider.options.getFile(path, function(e, res) {
            if (!e && res) {
              instance.sendDoc(instance.addDoc(path, res, true));
            }
          });
        }), initOptions);
        instance.bindAceKeys(editor);
        if (initOptions.shared !== false) {
          this.instance = instance;
        }
        cb(instance);
      }
    }),
    triggerRegex: /[^\.]\.$/,
    options: {
      switchToDoc: Functions.switchToDoc,
      getFileName: Functions.getFileName,
      getFile: Functions.getFile,
      normalize: global.FileUtils.normalize,
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

  function restart(ev) {
    var b = global.tsCompletionProvider;
    b.options.compilerOptions = {
      "module": Math.max(0, modules.indexOf(config.tsModuleKind)),
      "moduleResolution": config.moduleResolution == 'node' ? 2 : 1,
      "lib": Utils.parseList(config.tsLibs).map(function(e) {
        if (e == 'default') return 'lib.d.ts';
        else return "lib." + e + ".d.ts";
      }),
      "noImplicitAny": config.noImplicitAny,
      "allowUnreachableCode": config.allowUnreachableCode,
      "allowUnusedLabels": config.allowUnusedLabels,
      "alwaysStrict": config.alwaysStrict,
      "noFallthroughCasesInSwitch": config.noFallthroughCasesInSwitch,
      "noImplicitUseStrict": config.noImplicitUseStrict,
      "noUnusedLocals": config.noUnusedLocals,
      "noUnusedParameters": config.noUnusedParameters,
      "strict": config.strict,
      "strictNullChecks": config.strictNullChecks,
      "suppressExcessPropertyErrors": config.suppressExcessPropertyErrors,
      "suppressImplicitAnyIndexErrors": config.suppressImplicitAnyIndexErrors
    };
    if (b.instance) {
      b.instance.restart(b.compilerOptions);
    }
  }
  restart();
  global.ConfigEvents.on("autocompletion.typescript", restart);
}); /*_EndDefine*/
