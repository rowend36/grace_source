define(function (require, exports, module) {
  'use strict';
  /*globals Env*/
  var $maxStoreSize = require('./mixin_docs_blob').$maxStoreSize;
  var routineCheck = require('./mixin_docs_blob').$routineCheck;
  var getBlobInfo = require('./mixin_docs_blob').getBlobInfo;
  var hasBlob = require('./mixin_docs_blob').hasBlob;
  var freeBlobSpace = require('./mixin_docs_blob').freeBlobSpace;
  var saveBlob = require('./mixin_docs_blob').saveBlob;
  var loadBlob = require('./mixin_docs_blob').loadBlob;
  var removeBlob = require('./mixin_docs_blob').removeBlob;
  var allBlobs = require('./mixin_docs_blob').allBlobs;
  var Store = require('../core/store').Store;

  var Doc = require('./document').Doc;
  var FileUtils = require('../core/file_utils').FileUtils;
  var Notify = require('../ui/notify').Notify;
  var Utils = require('../core/utils').Utils;
  var Breaks = require('../core/recovery').Recovery;
  var config = require('../core/config');
  var appEvents = require('../core/app_events').AppEvents;
  var Docs = require('./docs_base').Docs;
  var getDoc = Docs.get;
  var storage = config.storage;
  var configEvents = config.Config;
  var debug = console;

  var appConfig = config.Config.registerAll(
    {
      stashExpiryTime: '1day',
      maxDocDataSize: Env.isWebView ? '1mb' : '500kb',
      maxUndoHistory: 'Infinity',
    },
    'documents'
  );
  config.Config.registerInfo(
    {
      clearCache: 'Set to true to clear all cached content',
      stashExpiryTime: {
        type: 'time',
        doc:
          'If keepDocumentsOnClose is enabled, this specifies how long they should be kept',
      },
      maxUndoHistory: {
        type: 'size|[Infinity]',
      },
      maxDocDataSize: {
        type: 'size',
        doc:
          'The maximum size of data that should be stored for a single document. Avoid setting this value higher than 1mb.',
      },
    },
    'documents'
  );
  configEvents.on('documents', function (ev) {
    switch (ev.config) {
      case 'clearCache':
      case 'maxDocDataSize':
      case 'maxUndoHistory':
        updateSizes();
        break;
    }
  });

  //priority for statshed data
  var STASH_PRIORITY = 5;

  /*Loaders*/

  var contentLoader = require('./history_saver');

  /*Size Limits*/
  var limits = {
    maxDocDataSize: 0,
    maxUndoHistory: 0,
  };
  function updateSizes() {
    var maxStoreSize = $maxStoreSize();
    limits.maxUndoHistory =
      appConfig.maxUndoHistory === 'Infinity'
        ? Infinity
        : Utils.parseSize(appConfig.maxUndoHistory);
    limits.maxDocDataSize = Math.min(
      maxStoreSize,
      Math.max(100000, Utils.parseSize(appConfig.maxDocDataSize))
    );
  }
  updateSizes();
  contentLoader.limits = limits;

  /*Persist API*/
  var persistentRefs = [];
  exports.getPersistentRef = function (id) {
    persistentRefs.push(id);
    return id;
  };

  var persistDoc = function (id, force, cleaned) {
    if (id === undefined) {
      Docs.forEach(function (doc) {
        if ((force || !doc.$safe) && persistentRefs.some(doc.hasRef, doc))
          persistDoc(doc.id);
      });
      scheduleSave.cancel();
      lastSaveT = new Date().getTime();
      return;
    }
    var doc = getDoc(id);
    if (!doc) return debug.error(new Error('Cannot persist unmanaged doc.'));
    var data = contentLoader.save(doc);
    if (data === false) {
      return Notify.warn(
        'Cache limits exceeded!!!. Please save document to avoid losing changes.'
      );
    }
    try {
      storage.setItem(id, data);
      doc.$safe = true;
    } catch (e) {
      if (!cleaned && freeBlobSpace()) {
        return persistDoc(id, true, true);
      }
      Notify.inform(
        'There was an error caching ' +
          doc.getPath() +
          '. This might be as a result of low storage or wrong global configuration. Contact developer if issue persists.'
      );
      debug.log(e.message, {
        error: e,
        maxDocDataSize: limits.maxDocDataSize,
        maxStoreSize: $maxStoreSize(),
        dataSize: data !== undefined ? data.length : null,
      });
    }
  };
  var lastSaveT = 0;
  //A document is persisted either 5 seconds after we stop editting
  //or 60 seconds after the last save whichever comes first.
  //This way changes are persisted quickly for one-off changes 
  //but sparsely for long editting sessions.
  var PERSIST_DELAY = 1000;
  var scheduleSave = Utils.delay(persistDoc, PERSIST_DELAY);
  exports.$persistDoc = function () {
    var now = new Date().getTime();
    if (now - lastSaveT > 55000) scheduleSave();
    else scheduleSave.later();
  };
  
  var DB = new Store('docs', {});
  DB.onChange = function (old, newValue) {
    //Keep all open documents open
    var res = Object.assign(exports.toJSON(), newValue);
    if (Object.keys(res).length > Object.keys(newValue).length) this.set(res);
  };
  //Not called automatically.
  exports.persist = function () {
    DB.set(exports.toJSON());
  };

  exports.toJSON = function () {
    var h = {};
    Docs.forEach(function (doc) {
      h[doc.id] = doc.isTemp() ? null : doc.getSavePath();
    });
    return h;
  };
  appEvents.on('appPaused', scheduleSave.now.bind(null, undefined));
  /*Synchronization for all Docs*/
  if (storage instanceof Storage) {
    window.addEventListener('storage', function (ev) {
      var key = ev.key;
      var doc = key && getDoc(key);
      if (!doc) return;
      if (!ev.newValue) {
        doc.$safe = false;
        scheduleSave();
      } else {
        var state = JSON.parse(ev.newValue);
        contentLoader.onRemoteChange(doc, state);
      }
    });
  }

  //Plugin Doc Types
  var __factories = {};
  exports.registerFactory = function (type, constructor) {
    //check constructor to prevent infinite looping in loadDocFromState
    if (constructor) {
      __factories[type] = constructor;
      FileUtils.ownChannel('docs-' + type, loadDocFromState);
    }
  };

  var pending = [];
  exports.$isPending = function (id) {
    return pending.indexOf(id) > -1;
  };
  //Startup: The startup is an asynchronous process. It is fast enough but to speed up loading an id, you can run loadDocs(id, null true);
  //1. First we load the activeDoc.
  //2. Then we load the other docs asynchronously.
  //3. Each loaded doc fires loadDoc event.
  //4. When all docs have been loaded except those with factories, documentsLoaded is fired.
  //5. On fully loaded, all documents who have no refs are destroyed.
  //6. On checkInit, refresh the doc to let user know of changes and load from stash.
  exports.loadDocs = function (idToLoadSync, cb, ignoreFail) {
    var failures = Breaks.hasFailures('loadDocuments');
    var json = DB.get();
    if (failures || Math.random() > 0.5) {
      var keys = routineCheck('m');
      for (var i in keys) {
        if (!json.hasOwnProperty(keys[i])) {
          debug.warn('Leaked document ' + keys[i]);
          json[keys[i]] = null;
        }
      }
    }
    if (failures && !ignoreFail) {
      return onHandlePreviousFail(json, cb);
    }
    pending = Object.keys(json);
    Breaks.breakpoint('loadDocuments', null, 2000);
    var firstIdIndex = pending.indexOf(idToLoadSync);
    if (firstIdIndex > -1 && !Breaks.hasFailures(idToLoadSync)) {
      load(idToLoadSync, firstIdIndex, Utils.noop);
    }
    //Asyncify this to not block application start
    Utils.asyncForEach(pending.slice(), Utils.spread(load, 50), function () {
      cleanStash();
      cb();
    });

    function load(id, i, next) {
      if (Docs.has(id)) return next();
      var state = storage.getItem(id);
      if (state) {
        try {
          state = JSON.parse(state);
        } catch (e) {
          state = null;
        }
      }
      if (Breaks.hasFailures(id)) {
        Notify.ask(
          'Proceed to load ' + (json[id] || 'Document ' + id) + ' ?',
          loadDocFromState.bind(null, id, json[id], state),
          function () {
            clearDocData(id);
            exports.persist();
          }
        );
      } else {
        loadDocFromState(id, json[id], state);
      }
      return next();
    }
  };

  function loadDocFromState(id, path, state) {
    //Async calls will lead to repetition
    if (Docs.has(id)) return;
    var doc, forceReload;
    if (state) {
      if (!state.factory || __factories[state.factory]) {
        Breaks.setBreakpoint(id);
        var C = state.factory ? __factories[state.factory] : Doc;
        doc = new C('', path, undefined, id);
      } else {
        //factory not registered
        return FileUtils.postChannel('docs-' + state.factory, id, path, state);
      }
      Utils.removeFrom(pending, id);
      contentLoader.load(doc, state);
      doc.$safe = true;
    } else {
      doc = new Doc('', path, undefined, id);
      if (contentLoader.canRecover(id)) {
        //lost state, reload
        contentLoader.recover(id, doc);
      } else if (!doc.isTemp()) {
        forceReload = true;
      }
    }
    doc.ref('fullyLoaded');
    //Clearing any unreferenced documents
    //once fully loaded
    appEvents.once('fullyLoaded', function () {
      doc.unref('fullyLoaded');
    });
    if (!DB.get().hasOwnProperty(doc.id)) exports.persist();
    doc.refresh(Utils.noop, !forceReload, !forceReload);
    appEvents.trigger('loadDoc', {doc: doc}, true);

    Breaks.removeBreakpoint(id);
  }

  function onHandlePreviousFail(json, cb) {
    Notify.modal({
      header: "<h6 class='center'>Error Loading Documents</h6>",
      dismissible: false,
      form: /** @type {any}*/ ([
        "<div class='mb-10'><i class='material-icons text-icon'>error</i>There was an error during the last application start. To proceed, you can select which documents to keep.</div>",
      ]).concat(
        Object.keys(json).map(function (e) {
          return {
            type: 'accept',
            value: !json[e],
            name: e,
            caption: json[e] || 'Temporary ' + e,
          };
        })
      ),
      footers: ['Load All', 'Proceed'],
      onCreate: function (el, Forms) {
        el.submit(function (e) {
          e.preventDefault();
          el.modal('close');
          var result = Forms.parse(el);
          for (var id in result) {
            if (!result[id]) {
              delete json[id];
              clearDocData(id);
            }
          }
          Breaks.removeBreakpoint('loadDocuments');
          DB.set(json);
          exports.loadDocs(null, cb, true);
        });

        el.find('.modal-load_all')
          .click(function (e) {
            e.preventDefault();
            el.modal('close');
            Breaks.removeBreakpoint('loadDocuments');
            exports.loadDocs(null, cb, true);
          })
          .addClass('error');
      },
    });
  }
  
  //Keep documents on close
  exports.stashDoc = function (docId) {
    var key;
    var doc = getDoc(docId);
    if (!doc) return;
    var path = doc.getSavePath();
    if (!doc.isTemp() && path && !path.startsWith(':')) {
      var text = contentLoader.save(doc, true);
      if (text === false) return;
      key = saveBlob('stashExpiry', path, text, {
        expiry: Math.floor(new Date().getTime() / 1000),
        priority: STASH_PRIORITY,
      });
      return key;
    }
  };

  //Recover history from stash
  exports.$checkInit = function (doc) {
    if (doc.session.$undoManager) return;
    //Technically, this should also wait for load, but set this while it loads, to not lose history.
    var temp = doc.createHistory();
    temp.$isTemp = true;
    doc.setHistory(temp);
    if (doc.$needsRefreshToCompleteLoad) return; //Don't update loading document
    if (!doc.getSavePath()) return;
    var key = hasBlob('stashExpiry', doc.getSavePath());
    if (!key) return;
    loadBlob(key, function (text) {
      //Allow documents to be recovered by Docs.$recovery
      //Docs.removeBlob(key);
      var old = doc.session.$undoManager;
      if (!old.$isTemp) return;
      try {
        doc.$fromStash = true;
        var rev = doc.getRevision();
        var maxRev = old.$maxRev;
        var stash = JSON.parse(text);
        var isClean = !doc.dirty;
        var value = doc.getValue();
        doc.restoreState(stash);
        //Try to keep both revision and content but not history.
        var um2 = doc.session.$undoManager;
        var mark = doc.getRevision();
        doc.updateValue(value, isClean);
        var top = doc.getDeltas(mark).pop();
        if (top) top[0].rev = rev;
        um2.$maxRev = Math.max(um2.$maxRev, maxRev);
      } catch (e) {}
      doc.$fromStash = false;
    });
  };
  
  function cleanStash() {
    var current = new Date().getTime();
    current -= Utils.parseTime(appConfig.stashExpiryTime);
    current = current / 1000;
    var keys = allBlobs('stashExpiry');
    for (var j in keys) {
      var i = keys[j];
      if (getBlobInfo(i).expiry < current) {
        removeBlob(i);
      }
    }
  }

  function clearDocData(docId) {
    Breaks.removeBreakpoint(docId);
    var doc = Docs.get(docId);
    if (!storage.getItem(docId)) {
      if (doc && doc.$safe) debug.error('Unpersisted doc with safe flag');
    } else {
      var key;
      while ((key = hasBlob(docId))) {
        removeBlob(key);
      }
      storage.removeItem(docId);
    }
    if (!doc) return;
    Docs.$delete(docId);
    exports.persist(); //bug
  }
  exports.$clearDocData = clearDocData;
  
  exports.$finishLoad = function (doc, res) {
    contentLoader.refresh(doc, res);
    exports.$checkInit(doc);
  };
});