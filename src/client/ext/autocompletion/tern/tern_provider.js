define(function(require, exports, module) {
  "use strict";
  var ServerHost = require("grace/ext/autocompletion/server_host").ServerHost;
  var docs = require("grace/docs/document").docs;
  var Utils = require("grace/core/utils").Utils;
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var configEvents = require("grace/core/config").ConfigEvents;
  var loadFiles = ServerHost.loadAutocompleteFiles;
  var appEvents = require("grace/core/events").AppEvents;
  var setImmediate = Utils.setImmediate;
  var ternConfig = require("grace/core/config").Config.registerAll({
    "ternDefFiles": "",
    "ternDefsInbuilt": "browser, ecmascript",
    "ternPlugins": "doc_comment",
    "useWebWorkerForTern": false
  }, "autocompletion.tern");
  require("grace/core/config").Config.registerValues({
    'ternDefFiles': "List of absolute paths or paths relative to to <project folder> containing tern json definition files",
    'ternDefsInbuilt': "browser ecmascript jquery react underscore mongoose",
    'ternPlugins': "requirejs angular node es_modules commonjs complete_strings node-express",
  }, "autocompletion.tern");
  var debug = console;
  var ternCompletionProvider = {
    init: function(editor, cb) {
      var ternOptions = this.options || {};
      var reuse = editor.ternClient || (ternOptions.shared !== false && this.instance);
      if (reuse) {
        reuse.bindAceKeys(editor);
        cb(reuse);
        return;
      }
      require(["./tern_client"], function(mod) {
        if (!ternOptions.workerScript) {
          ternOptions.workerScript = ace.config.moduleUrl('worker/tern');
        }
        if (ternOptions.useWorker === false) {
          require([ternOptions.workerScript], inner);
        } else inner();

        function inner() {
          if (editor.ternClient) return cb(editor.ternClient);
          var aceTs = new mod.TernServer(ternOptions);
          aceTs.bindAceKeys(editor);
          if (ternOptions.shared !== false) ternCompletionProvider.instance = aceTs;
          onStarted(aceTs);
          cb(aceTs);
        }
      });
    },
    release: function(editor, server) {
      if (server) {
        server.unbindAceKeys(editor);
        if (server != this.instance) {
          this.destroy(server);
        }
      }
    },
    triggerRegex: /[^\.]\.$/,
    destroy: function(instance) {
      if (!instance) {
        if (!this.instance) return;
        instance = this.instance;
        this.instance = null;
      } else if (instance == this.instance) {
        this.instance = null;
        ternClient = null;
      }
      for (var i in instance.docs) {
        instance.closeDoc(i);
      }
      if (instance.server.terminate) instance.server.terminate();
    },
    options: {
      switchToDoc: ServerHost.switchToDoc,
      getFileName: ServerHost.getFileName,
      readFile: ServerHost.readFile,
      fileFilter: function(val, name, doc) {
        if (!doc.getMode) {
          debug.error("Tern possible Corruption: " + name);
        } else if (doc.getMode().$id != "ace/mode/javascript") {
          //does not deal well with <script> tag in strings
          return getJsFromMixedHtml(val);
        }
        return val;
      },
      startedCb: function( /*server*/ ) {},
    },
    embeddable: true,
    isSupport: false,
    hasArgHints: true,
    hasKeyWords: true,
    hasText: false,
    hasStrings: false,
    priority: 1000,
    hasAnnotations: false,
    name: "ternClient",
  };
  var restart = Utils.delay(function() {
    if (ternClient) {
      loadConfig();
      ternClient.restart(ternDefsInbuilt, ternPlugins);
      loadDefs();
      loadFiles(null, ternClient);
    }
  }, 1000);

  function onStarted(server) {
    if (!ternClient) {
      ternClient = server;
      loadDefs();
      loadFiles(null, server);
      for (var id in docs) {
        if (ternModes[docs[id].options.mode || docs[id].session.getMode().$id]) server.addDoc(docs[id].getPath(),
          docs[id]
          .session);
      }
      appEvents.on('createDoc', onTernCreateDoc);
    }
  }
  //add option to load tern config
  var loadedDefs = {};
  var ternClient, ternDefsInbuilt, ternPlugins;

  function loadConfig() {
    var defs = Utils.parseList(ternConfig.ternPlugins);
    ternPlugins = {};
    for (var i in defs) {
      ternPlugins[defs[i]] = true;
    }
    ternDefsInbuilt = Utils.parseList(ternConfig.ternDefsInbuilt);
    Object.assign(ternCompletionProvider.options, {
      defs: ternDefsInbuilt,
      /* http://ternjs.net/doc/manual.html#plugins */
      plugins: ternPlugins,
      useWorker: ternConfig.useWebWorkerForTern,
      /* if your editor supports switching between different files (such as tabbed interface) then tern can do this when jump to defnition of function in another file is called, but you must tell tern what to execute in order to jump to the specified file */
      timeout: ternConfig.useWebWorkerForTern ? 3000 : 1000,
    });
  }
  loadConfig();
  configEvents.on("autocompletion.tern", function(e) {
    switch (e.config) {
      case "ternDefsInbuilt":
      case "ternPlugins":
        restart();
        break;
      case "ternDefFiles":
        setImmediate(loadDefs);
        break;
    }
  });
  var ternModes = {
    "ace/mode/javascript": true,
    "ace/mode/html": true,
  };

  function getJsFromMixedHtml(s) {
    var r = '';
    var inScript = false;
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (inScript) {
        if (l.match(/\s*\/script/)) {
          inScript = false;
          r += "\n";
          continue;
        }
        r += "\n" + l;
      } else {
        if (l.match(/\s*<script/)) {
          if (!l.match(/src="/)) { //dont add <scirpt src lines
            inScript = true;
          }
        }
        r += "\n";
      }
      if (i === 0) {
        r = r.replace("\n", ""); //dont add break for first line
      }
    }
    return r;
  }

  function loadDef(path, fs, cb) {
    function fail(e) {
      debug.error(e);
      require("grace/ui/notify").Notify.error('Unable to add defs from ' + path);
      cb && cb(e);
    }
    fs.readFile(path, FileUtils.encodingFor(path, fs), function(e, res) {
      if (res) {
        try {
          var json = JSON.parse(res);
          loadedDefs[path] = json;
          json.changed = new Date().getTime();
          if (!json["!name"]) json["!name"] = path;
          ternClient.addDefs(json, true);
          cb && cb();
        } catch (e) {
          fail(e);
        }
      } else fail(e);
    });
  }

  function loadDefs() {
    if (!ternClient) return;
    var ternDefFiles = Utils.parseList(ternConfig.ternDefFiles);
    var proj = FileUtils.getProject();
    var fs = proj.fileServer;
    var root = proj.rootDir;
    ternDefFiles.forEach(function(path) {
      if (path[0] !== "/") {
        path = FileUtils.join(root, path);
      }
      path = FileUtils.normalize(path);
      if (loadedDefs[path]) {
        fs.stat(path, function(e, s) {
          if (s && s.mtimeMs > loadedDefs[path].changed) {
            loadDef(path, fs);
          } else {
            ternClient.addDefs(loadedDefs[path]);
          }
        });
      } else loadDef(path, fs);
    });
  }

  function onTernCreateDoc(e) {
    var doc = e.doc;
    if (ternClient && ternModes.hasOwnProperty(doc.options.mode)) {
      ternClient.addDoc(doc.getPath(), doc.session);
    }
  }
  exports.ternCompletionProvider = ternCompletionProvider;
}); /*_EndDefine*/