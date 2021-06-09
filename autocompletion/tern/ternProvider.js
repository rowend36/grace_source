_Define(function(global) {
  "use strict";
  var Functions = global.Functions;
  var Docs = global.Docs;
  var docs = global.docs;
  var Utils = global.Utils;
  var Editors = global.Editors;
  var FileUtils = global.FileUtils;
  var configEvents = global.ConfigEvents;
  var loadFiles = Functions.loadAutocompleteFiles;
  var appEvents = global.AppEvents;
  var Imports = global.Imports;
  var setImmediate = Utils.setImmediate;
  var ternConfig = global.registerAll({
    "ternDefFiles": "",
    "ternDefsInbuilt": "browser, ecmascript",
    "ternPlugins": "doc_comment",
    "useWebWorkerForTern": false
  }, "autocompletion.tern");
  global.registerValues({
    'ternDefFiles': "List of absolute paths or paths relative to to <project folder> containing tern json definition files",
    'ternDefsInbuilt': "browser ecmascript jquery react underscore mongoose",
    'ternPlugins': "requirejs angular node es_modules commonjs complete_strings node-express",
  }, "autocompletion.tern");
  var ternCompletionProvider = {
    init: Imports.define(["./autocompletion/tern/ternClient.js"], null, function(editor, cb) {
      var ternOptions = this.options || {};
      var reuse = editor.ternServer || (ternOptions.shared !== false && this.instance);
      if (reuse) {
        reuse.bindAceKeys(editor);
        cb(reuse);
        return;
      }
      editor.ternServer = null;
      if (!ternOptions.workerScript) {
        ternOptions.workerScript = ace.config.moduleUrl('worker/tern');
      }
      if (!window.tern && ternOptions.useWorker === false) {
        var id = 'ace_tern_files';
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('load', inner);
        } else {
          el = document.createElement('script');
          el.setAttribute('id', id);
          document.head.appendChild(el);
          el.onload = inner;
          el.setAttribute('src', ternOptions.workerScript);
        }
      } else inner();

      function inner() {
        if (editor.ternServer) return cb(editor.ternServer);
        var aceTs = new global.TernServer(ternOptions);
        aceTs.bindAceKeys(editor);
        if (ternOptions.shared !== false) ternCompletionProvider.instance = aceTs;
        onStarted(aceTs);
        cb(aceTs);
      }
    }),
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
        ternServer = null;
      }
      for (var i in instance.docs) {
        instance.closeDoc(i);
      }
      if (instance.server.terminate) instance.server.terminate();
    },
    options: {
      switchToDoc: Functions.switchToDoc,
      getFileName: Functions.getFileName,
      getFile: Functions.getFile,
      fileFilter: function(val, name, doc) {
        if (!doc.getMode) {
          console.error("Tern possible Corruption: " + name);
        } else if (doc.getMode().$id != "ace/mode/javascript") {
          //does not deal well with <script> tag in strings
          return getJsFromMixedHtml(val);
        }
        return val;
      },
      startedCb: function(server) {},
    },
    embeddable: true,
    isSupport: false,
    hasArgHints: true,
    hasKeyWords: true,
    hasText: false,
    hasStrings: false,
    priority: 1000,
    hasAnnotations: false,
    name: "ternServer",
  };
  var restart = Utils.delay(function() {
    if (ternServer) {
      loadConfig();
      ternServer.restart(ternDefsInbuilt, ternPlugins);
      loadDefs();
      loadFiles(null, ternServer);
    }
  }, 1000);

  function onStarted(server) {
    if (!ternServer) {
      ternServer = server;
      loadDefs();
      loadFiles(null, server);
      for (var id in docs) {
        if (ternModes[docs[id].options.mode || docs[id].session.getMode().$id]) server.addDoc(docs[id].getPath(), docs[id]
          .session);
      }
      appEvents.on('createDoc', onTernCreateDoc);
    }
  }
  //add option to load tern config
  var loadedDefs = {};
  var ternServer, ternDefsInbuilt, ternPlugins;

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
      timeout: parseInt(ternConfig.completionTimeout) || (ternConfig.useWebWorkerForTern ? 3000 : 1000),
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
      case "completionTimeout":
        if (ternServer) {
          ternServer.queryTimeout = Utils.parseTime(e.newValue) || ternServer.queryTimeout;
        }
    }
  });
  var ternModes = {
    "ace/mode/javascript": true,
    "ace/mode/html": true,
  };

  function getJsFromMixedHtml(s, debug) {
    var r = '';
    var d = '';
    var inScript = false;
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (debug) d += '\n inScript=' + inScript + '; ' + i + '. ' + l;
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
    if (debug) console.log('GetJsFromMixedHtml debug', d);
    return r;
  }

  function loadDef(path, fs, cb) {
    function fail(e) {
      console.error(e);
      Notify.error('Unable to add defs from ' + path);
      cb && cb(e);
    }
    fs.readFile(path, FileUtils.encodingFor(path, server), function(e, res) {
      if (res) {
        try {
          var json = JSON.parse(res);
          loadedDefs[path] = json;
          json.changed = new Date().getTime();
          if (!json["!name"]) json["!name"] = path;
          ternServer.addDefs(json, true);
          cb && cb();
        } catch (e) {
          fail(e);
        }
      } else fail(e);
    });
  }

  function loadDefs() {
    if (!ternServer) return;
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
            ternServer.addDefs(loadedDefs[path]);
          }
        });
      } else loadDef(path, fs);
    });
  }

  function onTernCreateDoc(e) {
    var doc = e.doc;
    if (ternServer && ternModes.hasOwnProperty(doc.options.mode)) {
      ternServer.addDoc(doc.getPath(), doc.session);
    }
  }
  global.ternCompletionProvider = ternCompletionProvider;
}); /*_EndDefine*/