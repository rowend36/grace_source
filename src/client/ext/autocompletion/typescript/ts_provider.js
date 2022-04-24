define(function(require, exports, module) {
  var ServerHost = require("grace/ext/autocompletion/server_host")
    .ServerHost;
  var Utils = require("grace/core/utils").Utils;
  var modules = ["none", "commonjs", "amd", "umd", "system", "es2015",
    "esnext"
  ];
  var Depend = require("grace/core/depend");
  var tsLibs = ["default", "dom", "dom.iterable", "es2015.collection",
    "es2015.core", "es2015", "es2015.generator",
    "es2015.iterable", "es2015.promise", "es2015.proxy", "es2015.reflect",
    "es2015.symbol",
    "es2015.symbol.wellknown",
    "es2016.array.include", "es2016", "es2016.full", "es2017",
    "es2017.full", "es2017.intl", "es2017.object",
    "es2017.sharedmemory", "es2017.string", "es5", "es6",
    "esnext.asynciterable", "esnext", "esnext.full",
    "scripthost",
    "webworker"
  ];
  var config = require("grace/core/config").Config.registerAll({
    "tsModuleKind": "commonjs",
    "tsLibs": "default,dom,es5",
    "noImplicitAny": false,
    "useWebWorkerForTs": true,
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
    "suppressImplicitAnyIndexErrors": true,
    "jsxFactory": undefined,
    "jsxFragmentFactory": undefined,
    "baseUrl": undefined
  }, "autocompletion.typescript");
  require("grace/core/config").Config.registerAll({
    'tsModuleResolution': config.tsModuleKind == 'commonjs' ? 'node' :
      'classic'
  }, 'autocompletion.typescript');

  require("grace/core/config").Config.registerValues({
    "tsModuleKind": {
      values: modules,
    },
    "tsModuleResolution": "Either 'classic' or 'node'",
    "tsLibs": {
      values: tsLibs,
      multiple: true
    },
    "jsxFactory": {
      type: "string|null"
    },
    "jsxFragmentFactory": {
      type: "string|null"
    },
    "baseUrl": {
      type: "string|null"
    },

  }, "autocompletion.typescript");
  var debug = console;
  var BasicTransport = function(onRequestFile) {
    /*globals TsServer*/
    var server;
    this.postMessage = Depend.define(function(cb) {
      require(["grace/src-min-noconflict/worker-typescript"],
        function() {
          server = new TsServer(onRequestFile);
          cb();
        });
    }, function(data, cb) {
      var res, error;
      try {
        res = (server[data.type] || server.getLSP()[data.type]).apply(
          server, data.args);
      } catch (e) {
        error = e;
        debug.error(error);
      }
      cb && cb(error, res);
    });
  };
  var WorkerTransport = function(onRequestFile) {
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
        return onRequestFile(data.path);
      }
      var cb = waiting[data.id];
      if (data.error) debug.error(data.error);
      if (cb) {
        delete waiting[data.id];
        cb(data.error, data.res);
      }
    };
    worker.onerror = function(e) {
      for (var i in waiting) {
        waiting[i](e);
      }
      debug.error(e);
      waiting = {};
    };
    this.terminate = function() {
      worker.terminate();
      waiting = {};
    };
  };
  var loadFiles = ServerHost.loadAutocompleteFiles;
  var updateAnnotations = Utils.debounce(function() {
    var instance = exports.tsCompletionProvider.instance;
    if (instance) {
      instance.triggerUpdateAnnotations();
    }
  }, 30);
  exports.tsCompletionProvider = {
    init: function(editor, cb) {
      require(["./ts_client"], (function(mod) {
        var initOptions = this.options;
        var reuse = editor.tsClient || initOptions.server || (
          initOptions.shared !== false && this
          .instance);
        if (reuse) {
          reuse.bindAceKeys(editor);
          cb(reuse);
        } else {
          var Transport = config.useWebWorkerForTs ?
            WorkerTransport : BasicTransport;
          var instance = new mod.TsServer(new Transport(function(
            path) {
            exports.tsCompletionProvider.options.readFile(
              path,
              function(e, res) {
                if (!e && res) {
                  instance.sendDoc(instance.addDoc(path,
                    res, true), updateAnnotations);
                }
              });
          }), initOptions);
          instance.bindAceKeys(editor);
          if (initOptions.shared !== false) {
            this.instance = instance;
          }
          cb(instance);
          loadFiles(function() {
            updateAnnotations();
          }, instance);
        }
      }).bind(this));
    },
    triggerRegex: /[^\.]\.$/,
    options: {
      switchToDoc: ServerHost.switchToDoc,
      getFileName: ServerHost.getFileName,
      readFile: ServerHost.readFile,
      normalize: require("grace/core/file_utils").FileUtils.normalize,
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
      instance.destroy();
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
    name: "tsClient",
  };

  function restart() {
    var b = exports.tsCompletionProvider;
    b.options.compilerOptions = {
      "module": Math.max(0, modules.indexOf(config.tsModuleKind)),
      "moduleResolution": config.tsModuleResolution == 'node' ? 2 : 1,
      "lib": Utils.parseList(config.tsLibs).map(function(e) {
        if (e == 'default') return 'lib.d.ts';
        else return "lib." + e + ".d.ts";
      }),
      "noImplicitAny": config.noImplicitAny,
      "allowUnreachableCode": config.allowUnreachableCode,
      "allowUnusedLabels": config.allowUnusedLabels,
      "alwaysStrict": config.alwaysStrict,
      "jsxFactory": config.jsxFactory,
      "jsxFragmentFactory": config.jsxFragmentFactory,
      "baseUrl": config.baseUrl,
      "noFallthroughCasesInSwitch": config.noFallthroughCasesInSwitch,
      "noImplicitUseStrict": config.noImplicitUseStrict,
      "noUnusedLocals": config.noUnusedLocals,
      "noUnusedParameters": config.noUnusedParameters,
      "strict": config.strict,
      "strictNullChecks": config.strictNullChecks,
      "suppressExcessPropertyErrors": config.suppressExcessPropertyErrors,
      "suppressImplicitAnyIndexErrors": config
        .suppressImplicitAnyIndexErrors
    };
    if (b.instance) {
      b.instance.restart(b.options.compilerOptions);
    }
  }
  restart();
  require("grace/core/config").ConfigEvents.on("autocompletion.typescript",
    restart);
}); /*_EndDefine*/
