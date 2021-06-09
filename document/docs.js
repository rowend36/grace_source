_Define(function(global) {
  "use strict";
  /*One class to mazter them all*/
  //todo replace confirm with Notify ask
  var appConfig = global.registerAll({
    "allowAutoSave": false,
    "stashExpiryTime": "1day",
    "keepDocumentsOnClose": true,
    "maxStoreSize": Env.isWebView ? "50mb" : "5mb",
    "maxDocCacheSize": "20kb",
    "maxDocDataSize": "2mb",
    "maxUndoHistory": "Infinity",
    "clearCache": false,
    "autosaveInterval": "1min",
    "nextCleanTime": 0
  }, "documents");
  global.registerValues({
    "clearCache": "Set to true to clear all cached content",
    "allowAutoSave": "Enable autosave once a document has been saved once",
    "stashExpiryTime": "If keepDocumentsOnClose is enabled, this specifies how long they should be kept",
    "keepDocumentsOnClose": "Allows the editor to save your undo history when a document is closed",
    "maxStoreSize": "Configures how much storage can be used in total for storing documents",
    "maxDocCacheSize": "The maximum size of documents that must be cached for later opening. Useful if using a network file server",
    "maxDocDataSize": "The maximum size of data that should be stored for a single document.",
    "nextCleanTime": "no-user-config"
  }, "documents");
  var configEvents = global.ConfigEvents;
  var configure = global.configure;
  configEvents.on("documents", function(ev) {
    switch (ev.config) {
      case "clearCache":
        if (ev.newValue === true) maxStoreSize = 0;
        Docs.cleanBlobs(true);
        configure(appConfig.nextCleanTime,Math.min(appConfig.nextCleanTime,new Date().getTime()+1000*60*60*24),"documents");
        ev.preventDefault();
        Notify.info("Cache cleared");
        /*fall through*/
      case "maxStoreSize":
      case "maxDocDataSize":
      case "maxDocCacheSize":
        updateSizes();
        break;
      case "autosaveInterval":
        autoSave = Utils.delay(Docs.saveDocs, Math.max(Utils.parseTime(appConfig.autosaveInterval), 5000));
    }
  });
  var appStorage = global.appStorage;
  var getObj = global.getObj;
  var putObj = global.putObj;
  var modelist = global.modelist;
  var lastRun = appConfig.lastRun;
  var app = global.AppEvents;
  var Range = global.Range;
  var FileUtils = global.FileUtils;
  var Notify = global.Notify;
  var Utils = global.Utils;
  var Breaks = global.Recovery;
  var Tabs;
  var State = global.State;
  //priority for content for recovering session
  var CONTENT_PRIORITY = 10;
  //priority for closed docs
  var STASH_PRIORITY = 5;
  var maxDocCacheSize, maxDocDataSize, maxStoreSize;

  function updateSizes() {
    maxStoreSize = Math.max(500000, Utils.parseSize(appConfig.maxStoreSize));
    maxDocCacheSize = Math.min(maxStoreSize / 10, Math.max(5000, Utils.parseSize(appConfig.maxDocCacheSize)));
    maxDocDataSize = Math.min(maxStoreSize, Math.max(100000, Utils.parseSize(appConfig.maxDocDataSize)));
  }
  updateSizes();

  function invalid(deltas) {
    var uniq = {};
    for (var i = deltas.length; i-- > 0;) {
      var d = deltas[i][0];
      if (!d) return [i, 'Empty delta'];
      if (uniq[d.id]) return [i, 'Duplicate id ' + d.id];
      else uniq[d.id] = true;
    }
    return false;
  }

  function updateContentFromUndos(session, undoManager, revision) {
    var diff, delta, i;
    var stack = undoManager.$undoStack;
    if (invalid(stack)) return false;
    if (revision === 0) diff = stack;
    else
      for (i = stack.length; i--;) {
        delta = stack[i][0];
        if (delta.id == revision) {
          diff = stack.slice(i + 1);
          break;
        } else if (delta.id < revision) {
          break;
        }
      }
    if (diff) {
      diff.forEach(function(deltaSet) {
        session.redoChanges(deltaSet, true);
      });
      return true;
    }
    stack = undoManager.$redoStack;
    if (invalid(stack)) return false;
    for (i = stack.length; i--;) {
      delta = stack[i][0];
      if (delta.id == revision) {
        diff = stack.slice(i);
        break;
      } else if (delta.id > revision) {
        break;
      }
    }
    if (diff) {
      diff.forEach(function(deltaSet) {
        session.undoChanges(deltaSet, true);
      });
      return true;
    }
    return false;
  }
  var historySaver = {
    save: function(doc) {
      var obj = doc.serialize();
      if (doc.isTemp() || doc.getSize() < maxDocCacheSize) return obj;
      obj.checksum = doc.getChecksum(obj.content);
      var res = obj.content;
      obj.content = "";
      //Try saving documents content
      if (res.length < maxDocDataSize / 2) {
        var lastSave = Docs.hasBlob(doc.id, "content");
        if (lastSave) {
          var a = blobRegistry[lastSave];
          if (20 > Math.abs(a.rev - doc.getRevision())) return obj;
        }
        Docs.saveBlob(doc.id, "content", res, CONTENT_PRIORITY, {
          rev: doc.getRevision()
        });
      }
      return obj;
    },
    load: function(doc, obj) {
      if (!obj.checksum) return doc.unserialize(obj);
      doc.unserialize(obj);
      delete obj.history;
      doc.savedState = obj;
      doc.savedUndos = doc.session.$undoManager;
      doc.session.setUndoManager(null);
      var contentKey = Docs.hasBlob(doc.id, "content");
      if (contentKey) {
        var res = Docs.restoreBlob(contentKey);
        if (res !== undefined) {
          var rev = blobRegistry[contentKey].rev;
          doc.$fromSerial = true;
          if (historySaver.$update(doc, res, rev)) {
            delete doc.savedUndos;
            delete doc.savedState;
            doc.$fromSerial = false;
            return;
          }
          doc.$fromSerial = false;
        }
      }
      doc.$needsRecoveryFromRefresh = true;
    },
    $update: function(doc, res, revision) {
      doc.setValue(res);
      var status = true;
      try {
        status = updateContentFromUndos(doc.session, doc.savedUndos, revision) || undefined;
      } catch (e) {
        doc.clearHistory();
        status = false;
      }
      if (doc.getChecksum() !== doc.savedState.checksum) {
        status = null;
      }
      var state = doc.savedState;
      doc.session.selection.fromJSON(state.selection);
      doc.session.setScrollTop(state.scrollTop);
      doc.session.setScrollLeft(state.scrollLeft);
      if (status) {
        doc.session.setUndoManager(doc.savedUndos);
        state.folds.forEach(function(fold) {
          doc.session.addFold(fold.placeholder, Range.fromPoints(fold.start, fold.end));
        });
      }
      return status;
    },
    refresh: function(doc, res) {
      var INCORRECT = null;
      var FAILURE;
      var SUCCESS = true;
      var ERROR = false;
      /*if (doc.getSize()) {
          console.error(new Error("Error: Unrefreshed doc modified"));
          //_LSC && lastSave are invalidated
      }*/
      //doc has not changed since last save
      //undos can be reused
      if (doc.isLastSavedValue(res)) {
        doc.$fromSerial = true;
        var result = historySaver.$update(doc, res, doc.lastSave);
        switch (result) {
          case ERROR:
            Notify.error('Error Loading ' + doc.getPath());
            /*fall through*/
          case INCORRECT:
            doc.setValue(res, true);
            break;
          case SUCCESS:
            doc.dirty = (doc.getRevision() != doc.lastSave);
            break;
          default:
            doc.setClean();
        }
        doc.$fromSerial = false;
      } else {
        doc.setValue(res, true);
      }
      delete doc.$needsRecoveryFromRefresh;
      delete doc.savedState;
      delete doc.savedUndos;
    },
    canRecover: function(id) {
      var contentKey = Docs.hasBlob(id, "content");
      var content = Docs.restoreBlob(contentKey);
      if (content && content.length) {
        return true;
      }
    },
    recover: function(id, doc) {
      var contentKey = Docs.hasBlob(id, "content");
      var content = Docs.restoreBlob(contentKey);
      if (content && content.length) {
        doc.setValue(content);
      }
    }
  };
  var defaultSaver = {
    save: function(doc) {
      return doc.serialize();
    },
    load: function(doc, obj) {
      doc.unserialize(obj);
    },
    refresh: function(doc, res) {
      doc.setValue(res, true);
      delete doc.$needsRecoveryFromRefresh;
    },
    canRecover: Utils.noop
  };
  var contentLoader = historySaver;
  var docs = global.docs;
  var Doc = global.Doc;
  var Docs = global.Docs;
  Docs.diffToAceDeltas = function(diff, start_line, start_col) {
    var line = start_line || 0,
      col = start_col || 0;
    var endOfLine = /\r\n|\n|\r/g;
    var deltas = [];
    var start = {
      row: line,
      column: col
    };

    function moveOver(text, type) {
      var a = text.split(endOfLine);
      if (a.length > 1) {
        line += (a.length - 1);
        col = a[a.length - 1].length;
      } else {
        col += a[0].length;
      }
      var end = {
        row: line,
        column: col
      };
      if (type) {
        deltas.push({
          action: type > 0 ? "insert" : "remove",
          lines: a,
          start: start,
          end: end
        });
      }
      if (type < 0 /*delete*/ ) {
        line = start.row;
        col = start.column;
      } else start = end;
    }
    for (var a = 0; a < diff.length; a++) {
      moveOver(diff[a][1], diff[a][0]);
    }
    return deltas;
  };
  Docs.generateDiff = function(from, value, start_line, start_col) {
    //TODO use a simpler and faster diff implementation
    //that just checks common head and tail?
    //split into 8 chunks and merge sortoff,
    //maybe even works async
    var dmp = new diff_match_patch();
    dmp.Diff_EditCost = 50;
    dmp.Diff_Timeout = 0.4;
    var diff = dmp.diff_main(from, value);
    dmp.diff_cleanupEfficiency(diff);
    return Docs.diffToAceDeltas(diff, start_line, start_col);
  };
  Docs.setValue = function(doc, res, callback, force, ignoreDirty) {
    var name = FileUtils.filename(doc.getPath());
    if (res === undefined || res === null) {
      doc.setDirty();
      Notify.info('File deleted ' + name);
      return callback && callback(doc, {
        code: 'ENOENT'
      });
    }
    if (doc.$needsRecoveryFromRefresh) {
      contentLoader.refresh(doc, res);
      updateIcon(doc.id);
    }
    if (res.length === doc.getSize() && res === doc.getValue()) {
      if (doc.dirty) doc.setClean();
    } else if (ignoreDirty && doc.dirty && doc.isLastSavedValue(res)) {
      //console.debug('Ignored changes ' + doc.getPath());
      //ignoreDirty :ignore docs whose changes were
      //caused by the editor
    } else if (force) {
      //force: do not ask confirmation
      doc.updateValue(res, true);
    } else {
      doc.setDirty();
      Notify.ask("File changed. Reload " + name + "?", function() {
        doc.updateValue(res, true);
      }, function() {
        doc._LSC = null;
        doc.lastSave = null;
      });
    }
    callback && callback(doc);
  };
  var notified = 0;
  Docs.tempSave = function(id, force, cleaned) {
    if (id === undefined) {
      for (var i in docs)
        if ((force || !docs[i].safe) && docs[i].bound) {
          Docs.tempSave(i);
        }
      sessionSave.cancel();
      return;
    }
    try {
      var doc = docs[id];
      var obj = contentLoader.save(doc);
      var data = JSON.stringify(obj);
      if (data.length > maxDocDataSize) {
        if (!doc.warned) Notify.warn("The internal data of this file has exceeded the configured limits\nCurrent size: " +
          doc.getPath() + "\n: " + Math.floor(data.length / 1024) + "kb > MaxDocDataSize: " + Math.floor(maxDocDataSize /
            1024) + "kb", "clear-history-" + doc.id);
        doc.warned = true;
        if (obj.history.undo && obj.history.undo.length) {
          obj.history.undo = obj.history.undo.slice((obj.history.undo.length / 2) + 1);
        } else if(obj.folds && obj.folds.length)obj.folds = [];
        else return;//whatever is keeping this doc from saving
        data = JSON.stringify(obj);
      }
      appStorage.setItem(id, data);
      docs[id].safe = true;
    } catch (e) {
      if (!cleaned) {
        var freeSpace = determineQuota();
        if (freeSpace < 1000000) {
          var clear = 1000000 - freeSpace;
          while (blobRegistry.size > clear) {
            Docs.cleanBlobs(true);
          }
          Docs.tempSave(id, true, true);
          return;
        } else {
          //todo handle low space scenarios
        }
      }
      if (notified < 3) {
        Notify.error('Error caching current document');
        notified++;
      }
      console.error(e);
    }
  };
  Docs.saveAs = function(id, newpath, fileServer, callback) {
    var doc = docs[id];
    fileServer = fileServer || FileUtils.defaultServer;
    if (doc.isTemp()) {
      doc.setPath(newpath);
      Tabs.setName(id, Docs.getName(id));
      Docs.persist();
    } else {
      id = addDoc("", "", newpath);
      Docs.$jsonToSession(docs[id].session, Docs.$sessionToJson(doc.session));
    }
    docs[id].fileServer = fileServer.id;
    if (doc.encoding) {
      var alias = fileServer.isEncoding(doc.encoding);
      if (!alias) {
        docs[id].encoding = FileUtils.encodingFor(newpath, fileServer);
        Notify.info('Encoding reset to default');
      } else docs[id].encoding = typeof(alias) == "string" ? alias : doc.encoding;
    }
    docs[id].save(callback);
  };
  Docs.rename = function(path, newpath, server) {
    var doc = Docs.forPath(path, server);
    if (doc) {
      doc.setPath(newpath);
      Tabs.setName(doc.id, Docs.getName(doc.id));
      doc.safe = false;
      sessionSave();
      Docs.persist();
      return true;
    }
    return false;
  };
  Docs.setEncoding = function(id, encoding) {
    ///TODO not quite working yet
    var doc = docs[id];
    var alias = doc.getFileServer().isEncoding(encoding);
    if (alias) {
      if (typeof(alias) == "string") doc.encoding = alias;
      else doc.encoding = encoding;
      if (!doc.isTemp()) {
        Notify.ask('Reload file with new encoding ' + encoding + "?", function() {
          doc.refresh(function() {
            Notify.info('Refreshed');
          }, true, true);
        });
      }
      sessionSave(id);
    } else {
      Notify.error('Encoding ' + encoding + ' not supported by this storage device');
    }
  };
  /*Save all non shadow docs
   *or specified doc
   */
  Docs.saveDocs = function(id, callback, force) {
    if (id !== undefined) {
      if (docs[id].shadowDoc) {
        var mainDoc = Docs.forPath(docs[id].getSavePath(), docs[id].getFileServer());
        if (mainDoc && mainDoc.allowAutoSave) {
          mainDoc.shadowDoc = docs[id].shadowDoc;
          mainDoc.allowAutoSave = undefined;
          if (!mainDoc.warned) {
            mainDoc.warned = true;
            Notify.warn("Saving Duplicate Document.</br> Autosave turned off.", 1000);
          }
        }
        docs[id].shadowDoc = false;
      }
      if (docs[id].allowAutoSave === undefined) {
        docs[id].allowAutoSave = appConfig.allowAutoSave;
        if (docs[id].allowAutoSave) Notify.info('Autosave enabled')
        //notify allowAutoSave
        ;
      }
      docs[id].save(callback);
    } else {
      for (var i in docs)
        if ((docs[i].dirty || force) && docs[i].allowAutoSave && !docs[i].shadowDoc) Docs.saveDocs(i, callback);
      autoSave.cancel();
    }
  };
  /*Refresh all docs*/
  Docs.refreshDocs = function(id) {
    var next = [];
    if (id) {
      if (!docs[id].isTemp()) next = [id];
    } else
      for (var i in docs) {
        if (!docs[i].isTemp()) next.push(i);
      }
    Utils.asyncForEach(next, function(i, n, advance) {
      try {
        var a = docs[i].refresh(advance, !!docs[i].forceReload, true);
        docs[i].forceReload = undefined;
        if (!a) advance();
      } catch (e) {
        console.error(e);
        advance();
      }
    }, null, 2);
  };
  Docs.dirty = function(id) {
    docs[id].setDirty();
  };
  var sessionSave = Docs.$sessionSave = Utils.delay(Docs.tempSave, 5000);
  var autoSave = Docs.$autoSave = Utils.delay(Docs.saveDocs, Math.max(Utils.parseTime(appConfig.autosaveInterval), 5000));
  Docs.numDocs = function() {
    //Just counting keys for now
    var num = 0;
    for (var i in docs) num++;
    return num;
  };
  Docs.forPath = function(path, server) {
    var shadow = null;
    for (var i in docs) {
      if (docs[i].getPath() == path) {
        if (server && (server.getDisk() !== docs[i].getFileServer().getDisk())) {
          continue;
        }
        return docs[i];
      }
    }
    return null;
  };
  Docs.addFlag = function(id, flag, data) {
    var flags = (docs[id].flags || (docs[id].flags = {}));
    flags[flag] = data;
    Docs.dirty(id);
    sessionSave();
  };
  Docs.createPlaceHolder = function(args) {
    var doc = docs[addDoc.apply(null, arguments)];
    var grp = Utils.eventGroup(app);

    function remove() {
      closeDoc(doc.id);
    }
    grp.once("createDoc", remove);
    grp.once("change", grp.off, doc.session);
    grp.on("closeDoc", function(e) {
      if (e.doc == doc) {
        grp.off();
      }
    });
  };
  Docs.forSession = function(session) {
    if (session) {
      var doc = session.getDocument();
      //ensure it is a doc not an ordinary ace document
      if (docs[doc.id]) return doc;
    }
    /*
    for (var id in docs) {
        var doc = docs[id];
        if (doc.session == session || (doc.clones && doc.clones.indexOf(session) > -
                1)) {
            return doc;
        }
    }*/
  };
  Docs.closeSession = function(session) {
    var doc = Docs.forSession(session);
    if (session == doc.session) {
      if (doc.clones && doc.clones.length > 0) {
        var temp = doc.clones[0];
        doc.clones[0] = session;
        doc.session = temp;
        if (doc.bound) {
          session.off("change", doc.onChange);
          session.off('changeMode', doc.onChangeMode);
          doc.session.on("change", doc.onChange);
          doc.session.on('changeMode', doc.onChangeMode);
        }
      }
      //don't close session without closing tab
      else return false;
    }
    doc.clones = doc.clones.filter(function(e) {
      if (e == session) return false;
      return true;
    });
    session.destroy();
    return true;
  };
  var blobRegistry = getObj('blobRegistry', {
    size: 0
  });
  var time = new Date().getTime() / 1000;
  if (appConfig.nextCleanTime < time) {
    if (appConfig.nextCleanTime) {
      var keys = routineCheck("b");
      keys.forEach(function(e) {
        if (!blobRegistry[e])
          appStorage.removeItem(e);
      });
    }
    configure("nextCleanTime", time + 60 /*s*/ * 60 /*m*/ * 24 /*h*/ * 7 /*days*/ , 'documents');
  }
  var blobClearTimeout;
  //must be a synchronous file storage
  var blobStorage = global.appStorage;
  var determineQuota = function(key) {
    key = key || 0;
    var a = "Getting Quota Using String Concatenation";
    try {
      while (true) {
        localStorage["s" + key] = a;
        a = a + a;
      }
    } catch (e) {
      var size = a.length / 2 + (a.length > 1000 ? determineQuota(key + 1) : 0);
      localStorage.removeItem('s' + key);
      return size;
    }
  };
  //blob is like stash for open documents
  //unlike stash it uses size as a metric
  Docs.saveBlob = function(id, name, value, priority, data) {
    var t = Docs.hasBlob(id, name);
    if (t) Docs.removeBlob(t);
    if (!value) return false;
    var manifest = {
      id: id,
      type: name,
      pr: priority || 1,
      key: Utils.genID('b', blobRegistry), //createKey
    };
    for (var i in data) {
      if (!manifest[i]) //cannot override
        manifest[i] = data[i];
    }
    if (typeof(value) == "object") {
      manifest.obj = true;
    }
    try {
      if (manifest.obj) {
        value = JSON.stringify(value);
      }
      manifest.size = value.length;
      if (value.length > maxStoreSize) {
        return false;
      }
      blobStorage.setItem(manifest.key, value);
    } catch (e) {
      try {
        blobStorage.removeItem(manifest.key);
      } catch (e) {}
      return false;
    }
    blobRegistry[manifest.key] = manifest;
    blobRegistry.size += manifest.size;
    if (blobRegistry.size > maxStoreSize) {
      if (!blobClearTimeout) {
        blobClearTimeout = Utils.setImmediate(function() {
          blobClearTimeout = null;
          Docs.cleanBlobs(true);
        });
      }
    }
    putObj("blobRegistry", blobRegistry);
    return manifest.key;
  };
  Docs.hasBlob = function(id, name) {
    for (var i in blobRegistry) {
      if (i == 'size') continue;
      if (blobRegistry[i].id == id && (!name || blobRegistry[i].type == name)) {
        return i;
      }
    }
  };
  Docs.removeBlob = function(key) {
    if (blobRegistry.hasOwnProperty(key)) {
      var manifest = blobRegistry[key];
      blobStorage.removeItem(manifest.key);
      blobRegistry.size -= manifest.size;
      delete blobRegistry[key];
      putObj("blobRegistry", blobRegistry);
      return true;
    }
    return false;
  };
  Docs.restoreBlob = function(key) {
    if (blobRegistry.hasOwnProperty(key)) {
      var manifest = blobRegistry[key];
      var value = blobStorage.getItem(manifest.key);
      if (!value) {
        Docs.removeBlob(key);
        return false;
      }
      if (manifest.obj) value = JSON.parse(value);
      return value;
    }
    return false;
  };
  Docs.cleanBlobs = function(force) {
    var maxSize = maxStoreSize;
    if (!force && blobRegistry.size < maxSize) return;
    var toClean = [];
    if (blobClearTimeout) {
      clearTimeout(blobClearTimeout);
      blobClearTimeout = null;
    }
    var now = new Date().getTime();
    //recent blobs have higher priority
    var t = 1;
    for (var i in blobRegistry) {
      if (i == 'size') continue;
      var size = blobRegistry[i].size;
      var priority = blobRegistry[i].pr;
      var score = t * priority / size;
      t += (Utils.getCreationTime(t) - now);
      toClean.push({
        key: i,
        score: score
      });
    }
    toClean[toClean.length - 1].score *= 2;
    toClean.sort(function(a, b) {
      return a.score - b.score;
    });
    var l = toClean.length / 3 || 1;
    for (var j = 0; j < l; j++) {
      Docs.removeBlob(toClean[j].key);
    }
    if (blobRegistry.size > maxSize) {
      Docs.cleanBlobs(true);
    }
  };
  Docs.allBlobs = function(id) {
    var ids = [];
    for (var i in blobRegistry) {
      if (i == 'size') continue;
      if (blobRegistry[i].id == id) {
        ids.push(i);
      }
    }
    return ids;
  };
  var __factory = {};
  Docs.registerFactory = function(type, constructor) {
    __factory[type] = constructor;
  };
  Docs.stashDoc = function(path, text) {
    var key;
    if (path && !path.startsWith(":")) key = Docs.saveBlob("stashExpiry", path, text, STASH_PRIORITY, {
      expiry: Math.floor(new Date().getTime() / 1000)
    });
    return key;
  };
  Docs.cleanStash = function() {
    var current = new Date().getTime();
    current -= Utils.parseTime(appConfig.stashExpiryTime);
    current = current / 1000;
    var keys = Docs.allBlobs('stashExpiry');
    for (var j in keys) {
      var i = keys[j];
      if (blobRegistry[i].expiry < current) {
        Docs.removeBlob(i);
      }
    }
  };
  Docs.restoreStash = function(path, doc) {
    var key = Docs.hasBlob('stashExpiry', path);
    if (key) {
      var text = Docs.restoreBlob(key);
      Docs.removeBlob(key);
      try {
        var content = JSON.parse(text);
        var value = doc.getValue();
        Docs.$jsonToSession(doc.session, content);
        if (content.content != value) {
          doc.updateValue(value);
        }
      } catch (e) {
        return null;
      }
      return doc;
    }
  };
  Docs.initialize = function(tabs, activeTab) {
    Tabs = tabs;
    app.on('changeTab', function(e) {
      updateIcon(e.tab, true);
    });
    app.on('app-paused', function() {
      Docs.tempSave();
    });
    app.once('app-loaded', function() {
      updateIcon(Tabs.active);
    });
    Tabs.registerPopulator('m', Docs);
    app.once("documents-loaded", Tabs.recreate.bind(Tabs));
    Docs.fromJSON(null, null, activeTab);
  };
  Docs.toJSON = function() {
    var h = {};
    for (var i in docs) {
      h[i] = docs[i].isTemp() ? null : docs[i].getSavePath();
    }
    return JSON.stringify(h);
  };

  function routineCheck(prefix) {
    var keys;
    if (appStorage.hasOwnProperty('getKeys')) {
      keys = JSON.parse(appStorage.getKeys());
    } else {
      keys = [];
      for (var i = 0; i < appStorage.length; i++) {
        keys.push(appStorage.key(i));
      }
    }
    keys = keys.filter(function(e) {
      return e.startsWith(prefix) && /^\d+$/.test(e.substring(prefix.length));
    });
    return keys;
  }
  window.routineCheck = routineCheck;
  Docs.fromJSON = function(json, ignoreFail, asyncStart) {
    var failures = Breaks.hasFailures("loadDocuments");
    if (!json) {
      json = getObj("docs", null);
      if (failures || !json || Math.random() > 0.8) {
        var keys = routineCheck("m");
        if (keys.length) {
          json = json || {};
          for (var i in keys) {
            if (!json.hasOwnProperty(keys[i])) json[keys[i]] = null;
          }
        } else if (!json) {
          return app.triggerForever('documents-loaded');
        }
      }
    }
    if (failures && !ignoreFail) {
      return onHandlePreviousFail(json);
    }
    var load;
    var ids = Object.keys(json);
    if (asyncStart) {
      var i = ids.indexOf(asyncStart);
      var loaded = false;
      if (i > -1) {
        loaded = loadOne(asyncStart, i, function() {
          return true;
        });
      }
      //Load at least one document
      for (i = 0; !loaded && i < ids.length; i++) {
        loaded = loadOne(ids[i], i, function() {
          return true;
        });
      }
      load = function(i, index, next) {
        setTimeout(loadOne.bind(null, i, index, next), 150);
      };
    } else load = loadOne;
    Breaks.breakpoint("loadDocuments", null, 2000);
    Utils.asyncForEach(ids, load, function() {
      Docs.cleanStash();
      //A new doc might have been created
      //Or one of the docs closed
      Docs.persist();
      app.triggerForever('documents-loaded');
    }, 2);

    function loadOne(i, index, next) {
      if (docs[i]) return next();
      var state = appStorage.getItem(i);
      if (state) {
        try {
          state = JSON.parse(state);
        } catch (e) {
          state = null;
        }
      }
      if (Breaks.hasFailures(i)) {
        Notify.ask('Proceed to load ' + (json[i] || "Document " + i) + " ?", Docs.$loadData.bind(null, i, json[i], state),
          Docs.persist);
      } else {
        Docs.$loadData(i, json[i], state);
      }
      return next();
    }
  };

  function onHandlePreviousFail(json) {
    var el = $(Notify.modal({
      header: "<i class='material-icons close-icon'>error</i><h5 class='center'>Error Loading Documents</h5>",
      dismissible: false,
      body: ["<h6>There seems to have been an error during the previous start.</br>Choose documents to load</h6><form>"].concat(Object.keys(json).map(
        function(e) {
          return "<input data-id='" + e + "' type='checkbox'" + (json[e] ? "" : " checked") + "></input><span>" + (
            json[e] || "Temporary " + e) + "</span>";
        })).concat(["</form>"]).join(""),
      footers: ['Load All', 'Proceed']
    }, function() {
      el.find('input').off();
      el.find('.modal-load_all').off();
      el.find('.modal-proceed').off();
    }));
    el.find('.modal-load_all').click(function() {
      el.modal('close');
      Breaks.removeBreakpoint('loadDocuments');
      Docs.fromJSON(json, true);
    }).addClass('red');
    el.find('.modal-proceed').click(function() {
      el.modal('close');
      var toDelete = [];
      var els = el.find('input');
      for (var i = els.length; i-- > 0;) {
        if (!els[i].checked) {
          toDelete.push(i);
          delete json[els[i].getAttribute('data-id')];
        }
      }
      for (var j in toDelete) {
        var id = toDelete[j];
        var key;
        while ((key = Docs.hasBlob(id))) {
          Docs.removeBlob(key);
        }
        appStorage.removeItem(id);
      }
      Breaks.removeBreakpoint('loadDocuments');
      Docs.fromJSON(json, true);
    });
    global.styleCheckbox(el);
  }
  Docs.$loadData = function(id, path, state) {
    Breaks.setBreakpoint(id);
    if (state) {
      if (state.factory) {
        if (__factory[state.factory]) {
          var C = __factory[state.factory];
          docs[id] = new C("", path, undefined, id);
        } else {
          //factory not registered
          console.error('Unknown factory ' + state.factory);
          return Breaks.removeBreakpoint(id);
        }
      } else docs[id] = new Doc("", path, undefined, id);
      contentLoader.load(docs[id], state);
      docs[id].safe = true;
      addDoc("", docs[id], {
        mode: state.mode,
        select: false,
        noSave: true
      });
      updateIcon(id);
    } else {
      if (contentLoader.canRecover(id)) {
        //lost state, reload
        docs[id] = new Doc("", path, undefined, id);
        contentLoader.recover(id, docs[id]);
      } else if (path) {
        docs[id] = new Doc("", path, undefined, id);
        if (!docs[id].isTemp()) {
          docs[id].forceReload = true;
        }
      }
      if (docs[id]) addDoc("", docs[id], {
        select: false
      });
    }
    Breaks.removeBreakpoint(id);
  };
  Docs.persist = function() {
    appStorage.setItem("docs", Docs.toJSON());
  };
  //move to tabs
  Docs.addTabAnnotation = function(id, anno) {
    Tabs.addAnnotation(id, anno);
  };
  Docs.removeTabAnnotation = function(id, anno) {
    Tabs.removeAnnotation(id, anno);
  };

  function addDoc(name, content /*:string|Doc*/ , path /*:string?*/ , opts) {
    /*-use true to keep mode-*/
    var mode, select = true,
      data, save = true;
    if (path && typeof path == 'object') {
      opts = path;
      path = undefined;
    }
    if (opts) {
      if (opts.mode) mode = opts.mode;
      if (opts.data) data = opts.data;
      if (opts.hasOwnProperty('select')) select = opts.select;
      save = !opts.noSave;
    }
    var doc;
    //use cases in searchtab addDoc(,doc,path)
    //main use adddoc(,doc,path,mode)
    //filebrowser adddoc(n,c,p)
    if (content && typeof content == "object") {
      doc = content;
      content = undefined;
      path = doc.getSavePath();
      if (!doc.options.mode) {
        mode = modelist.getModeForPath(path || name || "").mode;
        if (mode != "ace/mode/text") doc.session.setMode(mode);
      }
    } else {
      if (!mode) mode = modelist.getModeForPath(path || name || "").mode;
      doc = new Doc(content, path, mode);
    }
    if (!doc.session.$undoManager) {
      doc.session.setUndoManager(new ace.UndoManager());
    }
    if (data) {
      Object.assign(doc, data);
    }
    if (!doc.getPath()) {
      console.error('Bad factory: path cannot be null');
      doc.setPath(null);
    }
    if (!Tabs.hasTab(doc.id)) {
      //most likely a newly created doc
      if (!name) {
        name = Docs.getName(doc.id);
      }
      Tabs.addTab(doc.id, name, doc.annotations);
    }
    if (save)
      Docs.persist();
    if (!doc.bound) { //TODO replace this name with isTrackingChanges
      if (path) Docs.restoreStash(path, doc);
      doc.onChange = Doc.prototype.onChange.bind(doc);
      doc.onChangeMode = function() {
        var mode = doc.session.getMode();
        if (mode.$id != doc.options.mode) {
          doc.options.mode = mode.$id;
          doc.safe = false;
          sessionSave();
        }
      };
      doc.session.on("change", doc.onChange);
      doc.session.on('changeMode', doc.onChangeMode);
      doc.bound = true;
      app.trigger('createDoc', {
        doc: doc
      });
    }
    //this usually is a valid assumption
    if (content !== undefined && path) doc.setClean();
    if (select) {
      Tabs.setActive(doc.id, true, true);
    }
    return doc.id;
  }

  function closeDoc(docId, keepUndos) {
    var doc = docs[docId];
    if (doc.clones && doc.clones.length) {
      //Time to add recovery
      console.error("This document is being used by a plugin");
      return;
    }
    if (keepUndos === undefined) keepUndos = appConfig.keepDocumentsOnClose;
    var key;
    while ((key = Docs.hasBlob(docId))) {
      Docs.removeBlob(key);
    }
    if (doc.bound && keepUndos && !doc.isTemp() && doc.getSavePath()) {
      Docs.stashDoc(doc.getSavePath(), JSON.stringify(defaultSaver.save(doc)));
    }
    if (appStorage.getItem(docId)) {
      appStorage.removeItem(docId);
    } else {
      if (doc.safe) console.error("Unsafe doc with safe flag");
    }
    if (doc.bound) {
      doc.session.off("change", doc.onChange);
      doc.session.off("changeMode'", doc.onChangeMode);
      try {
        app.trigger('closeDoc', {
          doc: doc,
          id: docId
        });
      } catch (e) {
        console.error(e);
      }
    }
    delete docs[docId];
    Docs.persist(); //bug
    if (Tabs.hasTab(docId)) {
      Tabs.removeTab(docId);
      if (Docs.numDocs() === 0) {
        Docs.createPlaceHolder();
      }
    }

    doc.session.destroy();
  }

  function newDoc(editor) {
    var id = addDoc("unsaved*", "", {
      mode: editor ? editor.getOption('mode') : null
    });
  }
  var updateIcon = Docs.$updateIcon = function(id, fromEvent) {
    //status indicator
    //used to show change in status
    //if need be there might be a change status
    //event but for now, it has only one listener
    //TODO add status to tabs,see nametags
    if (!fromEvent && id != Tabs.active) return;
    if (!docs[id] || !docs[id].dirty) $("#save i").css("color", "inherit");
    else if (docs[id].allowAutoSave) $("#save i").css("color", "orange");
    else {
      $("#save i").css("color", "red");
    }
  };
  //this should be in Editors
  //it is just a legacy method now
  Docs.swapDoc = function(id) {
    if (Tabs.active != id) {
      Tabs.setActive(id, true, true);
    } else {
      State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : id);
    }
  };
  Docs.openDoc = function(path, server, cb) {
    FileUtils.getDoc(path, server, function(doc, error) {
      if (error) {
        var et = "";
        if (cb) return cb(error);
        else if (error == 'binary') et = 'Binary file';
        else switch (error.code) {
          case 'ENOENT':
            et = 'File does not exist';
            break;
          case 'EACCESS':
            et = 'Permission denied';
            break;
          case 'ETOOLARGE':
            et = 'File Too Large';
            break;
          default:
            et = error.code;
        }
        return Notify.error(et);
      }
      addDoc(null, doc);
      doc.setClean();
      cb && cb(null, doc);
    });
  };
  //TabHolder interface
  Docs.getName = function(id) {
    var doc = docs[id];
    if (doc) {
      if (doc.isTemp()) {
        return "unsaved(" + (Tabs.indexOf(id) < 0 ? Tabs.numTabs() : Tabs.indexOf(id)) + ")";
      } else return FileUtils.filename(doc.getPath());
    }
    return null;
  };
  var inspectMemory = function() {
    var t = appStorage.getKeys && typeof appStorage.getKeys == "function" ? (function() {
      var keys = JSON.parse(appStorage.getKeys());
      var obj = {};
      keys.forEach(function(e) {
        obj[e] = appStorage.getItem(e);
        if (obj[e].length > 100) obj[e] = obj[e].substring(0, 100) + "...";
      });
      return obj;
    })() : Object.create(appStorage);
    t["!determinedQuota"] = determineQuota();
    addDoc("memory_dump", JSON.stringify(t), {
      mode: "ace/mode/json"
    });
  };
  Docs.getAnnotations = function(id) {
    return Tabs.getAnnotations(id);
  };
  //BUG to fix
  Docs.getInfo = function(id) {
    return (docs[id] ? (docs[id].isTemp() ? "<i>" + docs[id].id + "</i>" : docs[id].getSavePath() || "<i>" + docs[id].id +
      "</i>") : null);
    //+"<i class='right' style='text-transform:uppercase'>"+docs[id].getEncoding()+"</i>";
  };
  
  global.$determineQuota = determineQuota;
  global.$inspect = inspectMemory;
  global.Functions.newDoc = newDoc;
  global.addDoc = addDoc;
  global.closeDoc = closeDoc;
}); /*_EndDefine*/