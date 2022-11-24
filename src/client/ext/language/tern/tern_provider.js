define(function (require, exports, module) {
  'use strict';
  var ServerHost = require('grace/ext/language/server_host').ServerHost;
  var Docs = require('grace/docs/docs').Docs;
  var Utils = require('grace/core/utils').Utils;
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var configEvents = require('grace/core/config').Config;
  var loadFiles = ServerHost.loadAutocompleteFiles;
  var setImmediate = Utils.setImmediate;
  var ternConfig = require('grace/core/config').Config.registerAll(
    {
      enableTern: true,
      ternPriority: 500,
      ternDefFiles: '',
      ternDefsInbuilt: 'browser, ecmascript',
      ternPlugins: 'doc_comment',
      useWebWorkerForTern: false,
    },
    'intellisense.tern'
  );
  var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
  require('grace/core/config').Config.registerInfo(
    {
      enableTern: 'Use ternjs engine for javascript.',
      ternDefFiles:
        'List of absolute paths or paths relative to to <project folder> containing tern json definition files',
      ternDefsInbuilt: 'browser ecmascript jquery react underscore mongoose',
      ternPlugins:
        'requirejs angular node es_modules commonjs complete_strings node-express',
      ternPriority: {
        type: 'number',
      },
    },
    'intellisense.tern'
  );

  var restart = Utils.delay(function () {
    updateOptions();
  }, 1000);

  configEvents.on('intellisense.tern', function (e) {
    switch (e.config) {
      case 'ternDefsInbuilt':
      case 'ternPlugins':
        restart();
        break;
      case 'ternDefFiles':
        setImmediate(loadDefs);
        break;
      case 'ternPriority':
        TERN.priority = e.value();
        /* fall through */
      case 'enableTern':
        ServerHost.toggleProvider(TERN);
    }
  });
  var debug = console;
  var TERN = new BaseProvider('ternClient', ['javascript', 'html']);
  TERN.init = function (editor, callback) {
    var ternOptions = this.options || {};
    var reuse = editor.ternClient || this.instance;
    if (reuse) {
      return this.attachToEditor(editor, reuse, callback);
    }
    require(['./tern_client'], function (mod) {
      if (!ternOptions.workerScript) {
        ternOptions.workerScript = FileUtils.resolve(
          FileUtils.dirname(module.uri),
          './libs/tern_worker.js'
        );
      }
      if (ternOptions.useWorker === false) {
        require(['./libs/tern_worker'], inner);
      } else inner();

      function inner() {
        if (editor.ternClient) return callback(editor.ternClient);
        if (!TERN.instance) {
          var aceTs = new mod.TernServer(ternOptions);
          TERN.instance = aceTs;
          loadDefs();
          loadFiles(null, aceTs);
          Docs.forEach(function (doc) {
            TERN.addDocToInstance(doc);
          });
        }
        return TERN.attachToEditor(editor, TERN.instance, callback);
      }
    });
  };

  TERN.options = {
    switchToDoc: ServerHost.switchToDoc,
    getFileName: ServerHost.getFileName,
    readFile: ServerHost.readFile,
    fileFilter: function (val, name, session) {
      if (!session.getModeName) {
        debug.error('Tern possible Corruption: ' + name);
      } else if (session.getModeName() !== 'javascript') {
        //does not deal well with <script> tag in strings
        return getJsFromMixedHtml(val);
      }
      return val;
    },
    startedCb: function (/*server*/) {},
  };
  TERN.isEnabled = function () {
    return ternConfig.enableTern;
  };
  Object.assign(TERN, {
    triggerRegex: /[^\.]\.$/,
    embeddable: true,
    hasArgHints: true,
    hasRename: true,
    hasKeyWords: true,
    priority: ternConfig.ternPriority,
  });
  BaseProvider.setupLifeCycle(TERN);
  BaseProvider.keepDocumentsOnClose(TERN, true);
  BaseProvider.addDocumentsOnOpen(TERN);

  function updateOptions() {
    var plugins = Utils.parseList(ternConfig.ternPlugins);
    ternPlugins = {};
    for (var i in plugins) {
      ternPlugins[plugins[i]] = true;
    }
    ternDefsInbuilt = Utils.parseList(ternConfig.ternDefsInbuilt);
    Object.assign(TERN.options, {
      defs: ternDefsInbuilt,
      /* http://ternjs.net/doc/manual.html#plugins */
      plugins: ternPlugins,
      useWorker: ternConfig.useWebWorkerForTern,
      /* if your editor supports switching between different files (such as tabbed interface) then tern can do this when jump to defnition of function in another file is called, but you must tell tern what to execute in order to jump to the specified file */
      timeout: ternConfig.useWebWorkerForTern ? 3000 : 1000,
    });
    if (TERN.instance) {
      TERN.instance.restart(ternDefsInbuilt, ternPlugins);
      loadDefs();
      loadFiles(null, TERN.instance);
    }
  }
  updateOptions();
  //add option to load tern config
  var loadedDefs = {};
  var ternDefsInbuilt, ternPlugins;

  function loadDef(path, fs, cb) {
    function fail(e) {
      debug.error(e);
      require('grace/ui/notify').Notify.error(
        'Unable to add defs from ' + path
      );
      cb && cb(e);
    }
    FileUtils.readFile(path, fs, function (e, res) {
      if (res) {
        try {
          var json = JSON.parse(res);
          loadedDefs[path] = json;
          json.changed = new Date().getTime();
          if (!json['!name']) json['!name'] = path;
          TERN.instance.addDefs(json, true);
          cb && cb();
        } catch (e) {
          fail(e);
        }
      } else fail(e);
    });
  }

  function loadDefs() {
    if (!TERN.instance) return;
    var ternDefFiles = Utils.parseList(ternConfig.ternDefFiles);
    var proj = FileUtils.getProject();
    var fs = proj.fileServer;
    var root = proj.rootDir;
    ternDefFiles.forEach(function (path) {
      if (path[0] !== '/') {
        path = FileUtils.join(root, path);
      }
      path = FileUtils.normalize(path);
      if (loadedDefs[path]) {
        fs.stat(path, function (e, s) {
          if (s && s.mtimeMs > loadedDefs[path].changed) {
            loadDef(path, fs);
          } else {
            TERN.instance.addDefs(loadedDefs[path]);
          }
        });
      } else loadDef(path, fs);
    });
  }

  function getJsFromMixedHtml(s) {
    var r = '';
    var inScript = false;
    var lines = s.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (inScript) {
        if (l.match(/\s*\/script/)) {
          inScript = false;
          r += '\n';
          continue;
        }
        r += '\n' + l;
      } else {
        if (l.match(/\s*<script/)) {
          if (!l.match(/src="/)) {
            //dont add <scirpt src lines
            inScript = true;
          }
        }
        r += '\n';
      }
      if (i === 0) {
        r = r.replace('\n', ''); //dont add break for first line
      }
    }
    return r;
  }

  exports.ternCompletionProvider = TERN;
}); /*_EndDefine*/