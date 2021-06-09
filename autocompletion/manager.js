_Define(function(global) {
  var appEvents = global.AppEvents;
  var getEditor = global.getEditor;
  var FileUtils = global.FileUtils;
  var MainMenu = global.MainMenu;
  var Utils = global.Utils;
  var BootList = global.BootList;
  var FileLoader = global.FileLoader;
  var Tags = global.TagCompleter;
  var configure = global.configure;
  var docs = global.docs;
  var Docs = global.Docs;
  var Functions = global.Functions;
  var Notify = global.Notify;
  var configEvents = global.ConfigEvents;
  var providers = global.Completions;
  var Editors = global.Editors;
  var appConfig = global.registerAll({
    "autoLoadOpenDocs": true,
    "completionTimeout": "auto",
    "enableTypescript": true,
    "enableTern": true,
    "fileLoadConfigFiles": "",
    "maxAutoLoadSize": "5mb",
    "functionHintOnlyOnBoundaries": true,
    "maxSingleFileSize": "2mb",
    "maxAutoLoadTime": "30s",
    "snippetsToLoad": "grace.snippets",
    "enableFilenameCompletion": true,
    "enableColorCompletion": true,
    "tagsLoadConfigFiles": "",
  }, "autocompletion");
  global.registerValues({
    '!root': 'Configure ternjs, typescript and Gtags autocompletion engines\nTo disable autocompletion entirely, see editors.enableBasicAutocompletion',
    'enableTern': 'Use ternjs engine for javascript. Takes precedence over typescript for pure javascript files if enabled',
    'enableTypescript': 'Supports js,jsx,ts,tsx files. This completer can be heavy at times. Avoid loading too many files at once.\n For best performance, to load files from only node_modules/@types and src folders',
    'enableColorCompletion': 'Allow completing with html colors as well as colors found in files',
    'enableFilenameCompletion': 'Allow completing with filenames from project directory as well as filepaths found in files',
    'maxSingleFileSize': 'Prevent editor from hanging on autocompletion by setting this',
    "snippetsToLoad": "Load tmsnippet files. Example files are on ace github repository. Specify snippets as filepath followed by optional list of scopes. path[:scope[,scope]] eg main.snippets:javascript,typescript",
    'functionHintOnlyOnBoundaries': "When enabled, function hints will only show at ',' and beginning of argument list",
    'tagsLoadConfigFiles': 'Comma separated list of files containing list of glob paths to load automatically for tag completion',
    'fileLoadConfigFiles': "Comma separated list of files containing list of glob paths to load automatically for intellisense completion",
    'maxAutoLoadSize': 'The maximum total size of files to load into memory',
    'maxAutoLoadTime': 'The maximum total time load files into memory. Prevents background loading from hanging editor',
  }, "autocompletion");
  var fileLoader = new FileLoader({
    maxCount: Infinity,
    maxSize: Utils.parseSize(appConfig.maxAutoLoadSize),
    parallel: 3
  });
  configEvents.on("autocompletion", function(e) {
    var BaseServer = global.BaseServer;
    switch (e.config) {
      case 'enableTern':
      case 'enableTypescript':
        var prov = e.config == 'enableTern' ? global.ternCompletionProvider : global.tsCompletionProvider;
        if (e.newValue && !e.oldValue) {
          var modes = e.config == 'enableTern' ? ["javascript"] : ["typescript", "tsx", "javascript", "jsx"];
          providers.addCompletionProvider(prov, modes);
        } else if (e.oldValue) {
          providers.removeCompletionProvider(prov);
        }
        break;
      case "fileLoadConfigFiles":
        loadFiles(function() {
          Notify.info('Files Loaded');
        });
        break;
      case "snippetsToLoad":
        loadSnippets();
        break;
      case 'maxSingleFileSize':
        if (BaseServer) BaseServer.prototype.maxSize = Utils.parseSize(e.newValue);
        break;
      case 'functionHintOnlyOnBoundaries':
        if (!BaseServer) return;
        if (e.newValue) BaseServer.prototype.functionHintTrigger = ',()';
        else BaseServer.prototype.functionHintTrigger = null;
    }
  });

  function loadSnippets() {
    var snippetManager = ace.require("ace/snippets").snippetManager;
    var files = Utils.parseList(appConfig.snippetsToLoad);
    var fs = FileUtils.getProject().fileServer || FileUtils.defaultServer;
    if (!fs) return;
    if(!snippetManager.files)return;
    var error = function(path, type) {
      Notify.info("Failed " + type + " snippet file: " + path);
    };
    var resume = Utils.asyncForEach(files, function(name, i, n) {
      var parts = name.split(":");
      var path = parts[0];
      if (snippetManager.files[path] && !snippetManager.files[path].isStale) return n();
      fs.readFile(FileUtils.resolve(FileUtils.getProject().rootDir, path), "utf8", function(e, r) {
        n();
        if (e && e.code != 'ENOENT') {
          error(path, 'loading');
        }
        if (e) return;
        try {
          var m = {
            name: path
          };
          m.snippets = snippetManager.parseSnippetFile(r);
          snippetManager.files[path] = m;
          if (parts.length > 1) {
            var scopes = parts[1].split(",");
            scopes.forEach(function(scope) {
              snippetManager.register(m.snippets || [], scope);
            });
          } else snippetManager.register(m.snippets || []);
        } catch (e) {
          console.log(e);
          error(path, "parsing");
        }
      });
    }, null);
  }
  //load a bunch of filelists
  //the list defaults to appConfig.fileLoadConfigFiles
  //the lsp defaults to a combo of current smartCompleter and tags
  var activeOp;
  var loadFiles = function(cb, lsp, list) {
    if (activeOp) {
      activeOp.abort('Aborted for New Task');
    }
    var abort = new Utils.AbortSignal();
    activeOp = abort;
    abort.notify(console.log.bind(console));
    var a = getEditor();
    var loadTags, loadLsp;
    if (!lsp) {
      lsp = (a.smartCompleter && a[a.smartCompleter.name]);
      loadTags = !!Tags;
      loadLsp = (lsp && lsp !== Tags);
    } else if (lsp == Tags) {
      loadTags = !!Tags;
    } else {
      loadLsp = true;
    }
    var toLoad = [];
    var uniq = {};
    var p = FileUtils.getProject();
    if (loadLsp) {
      lsp.docChanged(a);
      var lspLoad = (list || Utils.parseList(appConfig.fileLoadConfigFiles));
      for (var o in lspLoad) {
        var s = lspLoad[o];
        var isAbsolute = s[0] == "/";
        var path = FileUtils.normalize(isAbsolute ? s : FileUtils.join(p.rootDir, s));
        if (!uniq[path]) {
          toLoad.push((uniq[path] = [path, true, false, isAbsolute]));
        }
      }
    }
    if (loadTags) {
      var tagLoad = Utils.parseList(appConfig.tagsLoadConfigFiles);
      for (var o in tagLoad) {
        var s = tagLoad[o];
        var isAbsolute = s[0] == "/";
        var path = FileUtils.normalize(isAbsolute ? s : FileUtils.join(p.rootDir, s));
        if (!uniq[path]) {
          toLoad.push((uniq[path] = [path, false, true, isAbsolute]));
        } else {
          uniq[path][2] = true;
          if (isAbsolute) uniq[path][3] = true;
        }
      }
    }
    //todo make merge list use this algorithm
    var loaded = {};
    var server = p.fileServer;
    var loadFile = Utils.throttle(abort.control(fileLoader.loadFile.bind(fileLoader)), 70);
    //For each config file
    fileLoader.setSize(0, 0);
    var timeout = Utils.parseTime(appConfig.maxAutoLoadTime);
    if (timeout > 0) {
      setTimeout(abort.control(function() {
        abort.abort('Timed Out');
      }), timeout);
    }
    //Controlled
    Utils.asyncForEach(toLoad, function(item, i, readNextFile, stopReading) {
      var configFilePath = item[0];
      var commonRoot = item[3] ? server.getRoot() : p.rootDir;
      //This is how to use abort controller with asyncForEach
      readNextFile = abort.control(readNextFile, stopReading);
      //Read and parse the file
      server.readFile(configFilePath, "utf8", abort.control(function(e, res) {
        if (e || !res) return readNextFile();
        res = global.stripComments(res);
        var config = JSON.parse(res);
        commonRoot = config.rootDir || commonRoot;
        var extension = new RegExp(config.extensions.map(Utils.regEscape).join("$|") + "$");
        var exclude = config.exclude && FileUtils.globToRegex(config.exclude.join(","));
        //todo,make finding commonRoot easier to find by not 
        //merging folders, remove walk, maybe
        Utils.asyncForEach(config.folders, function(res, i, nextFolder, stopLoadingConfig) {
          nextFolder = abort.control(nextFolder, stopLoadingConfig);
          var match = FileUtils.globToWalkParams(Utils.parseList(res).join(","));
          var dirmatch = match.canMatch;
          var base = match.root;
          match = match.matches;
          //walk has its own way of handling abort
          var stopWalk = FileUtils.walk({
            dir: FileUtils.join(commonRoot, base),
            fs: server,
            map: function(name, go, stopWalking, isDir, fileList, data) {
              name = base + name;
              if (isDir) {
                return dirmatch.test(name);
              }
              if (!extension.test(name)) return false;
              if (exclude && exclude.test(name)) return false;
              if (!match.test(name)) return false;
              var path = FileUtils.join(commonRoot, name);
              if (loaded[path]) {
                return true;
              }
              //load the file
              loadFile(path, server, function(e, res) {
                loaded[path] = true;
                if (!e && res) {
                  if (item[1]) lsp.addDoc(path, res, true);
                  if (item[2]) Tags.loadTags(path, res, true);
                } else if (e && (e.reason == "size" || e.reason == "count")) {
                  return stopLoadingConfig();
                }
                return go(); //load next file
              });
            },
            finish: function(res, stopped) {
              abort.unNotify(stopWalk);
              if (stopped) stopLoadingConfig();
              else nextFolder();
            },
            failOnError: false
          });
          abort.notify(stopWalk);
        }, function(stopped) {
          if (stopped) stopReading();
          else readNextFile();
        }, 0, false, true);
      }), stopReading);
    }, function() {
      console.debug('Server Load', Utils.toSize(fileLoader.getSize().size));
      abort.clear();
      if (abort == activeOp) {
        activeOp = null;
      }
      abort = null;
      cb && cb();
    }, 0, false, true);
  };

  function getFile(name, cb) {
    var doc = global.getActiveDoc();
    var server = doc ? doc.getFileServer() : FileUtils.defaultServer;
    if (!name.startsWith("/")) name = "/" + name;
    fileLoader.loadFile(name, server, cb);
  }

  function getFileName(s) {
    var doc = Docs.forSession(s);
    if (doc) return doc.getPath();
  }

  function onCreateDoc(doc) {
    if (Tags) Tags.loadTags(doc.getSavePath() || doc.getPath(), doc.getValue());
  }

  function onCloseDoc(doc) {
    var tern = global.ternCompletionProvider;
    if (tern && tern.instance && tern.instance.hasDoc(doc.session)) tern.instance.addDoc(doc.getPath(), doc.getValue(),
      false);
    var ts = global.tsCompletionProvider;
    if (ts && ts.instance && ts.instance.hasDoc(doc.session)) ts.instance.addDoc(doc.getPath(), doc.getValue(), false);
    if (Tags && Tags.hasDoc(doc.session))
      Tags.delDoc(doc.getPath());
  }
  MainMenu.addOption("reload-project", {
    close: true,
    icon: "autorenew",
    caption: "Reload Completions",
    onclick: function() {
      loadFiles(function() {
        Notify.info('Reloaded');
      }, null, null);
      var snippets = ace.require("ace/snippets").snippetManager.files;
      for (var i in snippets) {
        snippets[i].isStale = true;
      }
      loadSnippets();
    }
  }, true);
  var reduceLoad = Utils.delay(function(e) {
    //clear servers on pause
    var editor = getEditor();
    loadFiles.cancel && loadFiles.cancel();
    var ts = global.tsCompletionProvider;
    if (appConfig.enableTypescript) {
      providers.removeCompletionProvider(ts);
      ts.destroy();
    }
    var tern = global.ternCompletionProvider;
    if (appConfig.enableTern) {
      providers.removeCompletionProvider(tern);
      tern.destroy();
    }
    if (Tags) Tags.clear();
    Editors.forEach(function(e) {
      providers.updateCompleter(e);
    });
    appEvents.once('app-resumed', resumeLoad);
  }, 10000);

  function resumeLoad(e) {
    loadSnippets();
    var BaseServer = global.BaseServer;
    if (BaseServer) {
      BaseServer.prototype.maxSize = Utils.parseSize(appConfig.maxSingleFileSize);
      if (appConfig.functionHintOnlyOnBoundaries) BaseServer.prototype.functionHintTrigger = ',()';
      else BaseServer.prototype.functionHintTrigger = null;
    }
    var ts = global.tsCompletionProvider;
    if (appConfig.enableTypescript) providers.addCompletionProvider(ts, ["javascript", "jsx", "typescript", "tsx"]);
    var tern = global.ternCompletionProvider;
    if (appConfig.enableTern) providers.addCompletionProvider(tern, ["javascript"]);
    Editors.forEach(function(e) {
      providers.updateCompleter(e);
    });
    loadFiles();
    for (var i in docs) {
      onCreateDoc(docs[i]);
    }
    appEvents.on('createDoc', function(e) {
      onCreateDoc(e.doc);
    });
    appEvents.on('closeDoc', function(e) {
      onCloseDoc(e.doc);
    });
    appEvents.once('app-paused', reduceLoad);
  }
  
  /*var preview = function() {
    var editor = getEditor();
    var ui = new global.Ui();
    emmetExt.load(function(){
      
    });
  };*/
  //Replace this with a modal
  FileUtils.registerOption("project", ["project"], "load-comp", "Generate Config", function(ev) {
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
        body: "<label for='priority'>Priority: Higher values get loaded first</label><input type='number' name='priority' value=100>" +
          "<input type='checkbox'/><span>Do this for remaining folders</span>",
        footers: ["Stop", "Ignore", "Load", "Load Recursively"],
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
                paths: path + "**"
              });
              return [null, true];
            } else return [path + "**", true];
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
        if (!currentData) return console.warn("Found impossible situation currentData called twice");
        var type = /modal\-(\w+)/.exec(this.className)[1];
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
          nextItem.apply(null, onResult(type, path, priority, data.initialValue.priority));
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
          next.apply(null, onResult(data.storedValue.type, path, data.storedValue.priority, data.initialValue
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
        reduce: function(folder, children, data, next) {
          children.unshift(data.initialValue.path);
          var folders = children.filter(Boolean);
          var res = folders.join(",");
          if (data.initialValue.priority != data.initialValue.parentPriority) {
            if (res) preload.push({
              pr: data.initialValue.priority,
              paths: res
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
              folders[folders.length - 1] += "," + f.paths;
            } else {
              lastPr = f.pr;
              folders.push(f.paths);
            }
          });
          var config = JSON.stringify({
            extensions: extensions,
            rootDir: e,
            exclude: [],
            folders: folders
          });
          global.getBeautifier('json')(config, {
            "end-expand": true,
            "wrap_line_length": 20
          }, function(res) {
            Notify.prompt("Save config to this folder?\nEnter file name" + res, function(name) {
              if (Utils.parseList(appConfig.fileLoadConfigFiles).indexOf(name) < 0) {
                configure("fileLoadConfigFiles",
                  (appConfig.fileLoadConfigFiles ? appConfig.fileLoadConfigFiles + "," : "") + name,
                  "autocompletion");
              }
              ev.browser.fileServer.writeFile(FileUtils.join(ev.filepath, name), "//GRACE_CONFIG\n" +
                res,
                function() {
                  Notify.info("Saved");
                });
            }, "grace-load.json");
          });
        }
      });
    }, "js", ["py", "cpp,c,h,cxx", "java", "ts,tsx,js,jsx"]);
    ev.preventDefault();
  });
  appEvents.on("fully-loaded", resumeLoad);
  appEvents.on('app-resumed', reduceLoad.cancel);
  BootList.add("./autocompletion/tern/ternProvider.js", "./autocompletion/typescript/tsProvider.js", "./autocompletion/fileNameColors.js");
  BootList = null;
  Functions.getFile = getFile;
  Functions.getFileName = getFileName;
  Functions.loadAutocompleteFiles = loadFiles;
}); /*_EndDefine*/