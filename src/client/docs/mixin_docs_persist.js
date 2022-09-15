define(function (require, exports, module) {
  'use strict';

  var $maxStoreSize = require('./mixin_docs_blob').$maxStoreSize;
  var routineCheck = require('./mixin_docs_blob').$routineCheck;
  var getBlobInfo = require('./mixin_docs_blob').getBlobInfo;
  var hasBlob = require('./mixin_docs_blob').hasBlob;
  var freeBlobSpace = require('./mixin_docs_blob').freeBlobSpace;
  var saveBlob = require('./mixin_docs_blob').saveBlob;
  var loadBlob = require('./mixin_docs_blob').loadBlob;
  var removeBlob = require('./mixin_docs_blob').removeBlob;
  var allBlobs = require('./mixin_docs_blob').allBlobs;

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
  var getObj = config.Config.getObj;
  var configEvents = config.Config;
  var debug = console;

  var appConfig = config.Config.registerAll(
    {
      stashExpiryTime: '1day',
      maxDocCacheSize: '20kb',
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
      maxDocCacheSize: {
        type: 'size',
        doc:
          'The maximum size of documents that can be cached for later opening. Useful if using a slow network file server.',
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
      case 'maxDocCacheSize':
        updateSizes();
        break;
    }
  });

  //priority for statshed data
  var STASH_PRIORITY = 5;

  /*Loaders*/

  var contentLoader = require('./history_saver');
  var defaultSaver = {
    save: function (doc) {
      return doc.serialize();
    },
    load: function (doc, obj) {
      doc.unserialize(obj);
    },
    refresh: function (doc, res) {
      doc.setValue(res, true);
      delete doc.$needsRefreshToCompleteLoad;
    },
    canRecover: Utils.noop,
    onRemoteChange: function (doc, obj) {
      defaultSaver.load(doc, obj);
    },
  };
  /*Size Limits*/
  var limits = {
    maxDocDataSize: 0,
    maxDocCacheSize: 0,
    maxUndoHistory: 0,
  };
  function updateSizes() {
    var maxStoreSize = $maxStoreSize();
    limits.maxUndoHistory =
      appConfig.maxUndoHistory === 'Infinity'
        ? Infinity
        : Utils.parseSize(appConfig.maxUndoHistory);
    limits.maxDocCacheSize = Math.min(
      maxStoreSize / 10,
      Math.max(5000, Utils.parseSize(appConfig.maxDocCacheSize))
    );
    limits.maxDocDataSize = Math.min(
      maxStoreSize,
      Math.max(100000, Utils.parseSize(appConfig.maxDocDataSize))
    );
  }
  updateSizes();
  contentLoader.limits = limits;
  var notified = 0;
  function shrinkData(obj, targetSize) {
    var data;
    do {
      if (obj.history.undo && obj.history.undo.length > 1) {
        obj.history.undo = obj.history.undo.slice(obj.history.undo.length / 2);
      } else if (obj.folds && obj.folds.length) obj.folds = [];
      else if (obj.history.undo && obj.history.undo.length == 1) {
        obj.history.undo = [];
      } else if (obj.history.redo && obj.history.redo.length) {
        obj.history = null;
      } else return false; //whatever is keeping this doc from saving
      data = JSON.stringify(obj);
    } while (data.length > targetSize);
    return data;
  }

  /*Persist API*/
  var persistentRefs = [];
  exports.getPersistentRef = function (id) {
    persistentRefs.push(id);
    return id;
  };
  var hasRef = Doc.prototype.hasRef;
  exports.tempSave = function (id, force, cleaned) {
    if (id === undefined) {
      Docs.forEach(function (doc) {
        if ((force || !doc.safe) && persistentRefs.some(hasRef, doc))
          exports.tempSave(doc.id);
      });
      sessionSave.cancel();
      return;
    }
    var data;
    var doc = getDoc(id);
    if (!doc) return debug.error(new Error('Cannot persist unmanaged doc.'));
    var obj = contentLoader.save(doc);
    try {
      data = JSON.stringify(obj);
      if (data.length > limits.maxDocDataSize) {
        if (doc.isTemp())
          return Notify.warn(
            'Cache size exceeded!!!. Please save your document to avoid losing changes.'
          );
        data = shrinkData(obj, limits.maxDocDataSize);
      }
      storage.setItem(id, data);
      getDoc(id).safe = true;
    } catch (e) {
      if (!cleaned) {
        if (freeBlobSpace()) {
          exports.tempSave(id, true, true);
          return;
        } else {
          //nothing can really be done
        }
      }
      if (notified < 2) {
        Notify.error(
          'There was an error caching ' +
            doc.getPath() +
            '. This might be as a result of low storage or wrong global configuration. Contact developer if issue persists.'
        );
        notified++;
      }
      debug.log(e, {
        maxDocCacheSize: limits.maxDocCacheSize,
        maxDocDataSize: limits.maxDocDataSize,
        maxStoreSize: $maxStoreSize(),
        dataSize: data === undefined ? data.length : null,
      });
    }
  };
  exports.persist = function () {
    storage.setItem('docs', exports.toJSON());
  };
  var sessionSave = (exports.$sessionSave = Utils.delay(
    exports.tempSave,
    5000
  ));
  appEvents.on('appPaused', sessionSave.now.bind(null, undefined));
  /*Synchronization*/
  if (storage instanceof Storage) {
    window.addEventListener('storage', function (ev) {
      var key = ev.key;
      var doc = getDoc(key);
      if (!doc) return;
      if (!ev.newValue) {
        doc.safe = false;
        sessionSave();
      } else {
        var state = JSON.parse(ev.newValue);
        contentLoader.onRemoteChange(doc, state);
      }
    });
  }

  //Plugin Doc Types
  var __factories = {};
  exports.registerFactory = function (type, constructor) {
    if (constructor) {
      //to prevent infinite looping in loadDocFromState
      __factories[type] = constructor;
      FileUtils.ownChannel('docs-' + type, loadDocFromState);
    }
  };

  exports.toJSON = function () {
    var h = {};
    Docs.forEach(function (doc) {
      h[doc.id] = doc.isTemp() ? null : doc.getSavePath();
    });
    return JSON.stringify(h);
  };

  //Startup
  exports.fromJSON = function (json, idToLoadSync, cb, ignoreFail) {
    var failures = Breaks.hasFailures('loadDocuments');
    if (!json) {
      json = getObj('docs', null);
      if (failures || !json || true || Math.random() > 0.8) {
        var keys = routineCheck('m');
        json = json || {};
        for (var i in keys) {
          if (!json.hasOwnProperty(keys[i])) {
            debug.warn('Leaked document ' + keys[i]);
            json[keys[i]] = null;
          }
        }
      }
    }
    if (failures && !ignoreFail) {
      return onHandlePreviousFail(json, cb);
    }
    var load;
    var ids = Object.keys(json);
    if (idToLoadSync) {
      var firstId = ids.indexOf(idToLoadSync);
      if (firstId > -1 && !Breaks.hasFailures(firstId)) {
        tryLoadSync(idToLoadSync, firstId, Utils.noop);
      }
      if (!Docs.has(idToLoadSync))
        //Load at least one document
        for (firstId = 0; firstId < ids.length; firstId++) {
          if (Breaks.hasFailures(firstId)) continue;
          tryLoadSync(ids[firstId], firstId, Utils.noop);
          if (Docs.has(firstId)) break;
        }
      load = Utils.spread(tryLoadSync, 300);
    } else load = tryLoadSync;
    Breaks.breakpoint('loadDocuments', null, 2000);
    Utils.asyncForEach(
      ids,
      load,
      function () {
        cleanStash();
        cb();
      },
      2
    );

    function tryLoadSync(id, index, next) {
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

  function onHandlePreviousFail(json, cb) {
    Notify.modal({
      header: "<h6 class='center'>Error Loading Documents</h6>",
      dismissible: false,
      form: [
        "<i class='material-icons text-icon'>error</i>There was an error during the last application start. To proceed, you can select which documents to keep.",
      ].concat(
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
      onCreate: function (el) {
        el.submit(function (e) {
          e.preventDefault();
          el.modal('close');
          require(['../ui/forms'], function (mod) {
            var result = mod.Forms.parse(el);
            for (var id in result) {
              if (!result[id]) {
                delete json[id];
                clearDocData(id);
              }
            }
            Breaks.removeBreakpoint('loadDocuments');
            exports.fromJSON(json, null, cb, true);
          });
        });

        el.find('.modal-load_all')
          .click(function (e) {
            e.preventDefault();
            el.modal('close');
            Breaks.removeBreakpoint('loadDocuments');
            exports.fromJSON(json, null, cb, true);
          })
          .addClass('error');
      },
    });
  }
  var pending = [];
  exports.$isPending = function (id) {
    return pending.indexOf(id) > -1;
  };
  function loadDocFromState(id, path, state) {
    if (Docs.has(id)) return; //async calls might lead to repetition
    var doc;
    if (state) {
      if (!state.factory || __factories[state.factory]) {
        var C = state.factory ? __factories[state.factory] : Doc;
        doc = new C('', path, undefined, id);
      } else {
        //factory not registered
        pending.push(id);
        return FileUtils.postChannel('docs-' + state.factory, id, path, state);
      }

      Utils.removeFrom(pending, id);
      Breaks.setBreakpoint(id);
      contentLoader.load(doc, state);
      doc.safe = true;
    } else {
      doc = new Doc('', path, undefined, id);
      if (contentLoader.canRecover(id)) {
        //lost state, reload
        contentLoader.recover(id, doc);
      } else if (!doc.isTemp()) {
        doc.forceReload = true;
      }
    }
    doc.ref('fullyLoaded');
    //Clearing any unreferenced documents
    //once fully loaded
    appEvents.once('fullyLoaded', function () {
      doc.unref('fullyLoaded');
    });
    appEvents.trigger('loadDoc', {doc: doc}, true);

    Breaks.removeBreakpoint(id);
  }

  //Keep documents on close
  exports.stashDoc = function (docId) {
    var key;
    var doc = getDoc(docId);
    var path = doc.getSavePath();
    if (!doc.isTemp() && path && !path.startsWith(':')) {
      var text = JSON.stringify(defaultSaver.save(doc));
      key = saveBlob('stashExpiry', path, text, {
        expiry: Math.floor(new Date().getTime() / 1000),
        priority: STASH_PRIORITY,
      });
      return key;
    }
  };
  exports.restoreStash = function (path, doc) {
    var key = hasBlob('stashExpiry', path);
    if (key) {
      loadBlob(key, function (text) {
        //Allow documents to be recovered by Docs.$recovery
        //Docs.removeBlob(key);
        try {
          doc.$fromStash = true;
          var stash = JSON.parse(text);
          var value = doc.getValue();
          doc.restoreState(stash);
          doc.updateValue(value);
        } catch (e) {}
        doc.$fromStash = false;
      });
    }
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

  function determineQuota(key) {
    key = key || 0;
    var a = 'Getting Quota Using String Concatenation';
    try {
      while (true) {
        localStorage['s' + key] = a;
        a = a + a;
      }
    } catch (e) {
      var size = a.length / 2 + (a.length > 1000 ? determineQuota(key + 1) : 0);
      localStorage.removeItem('s' + key);
      return size;
    }
  }

  function clearDocData(docId) {
    var doc = Docs.get(docId);
    if (!storage.getItem(docId)) {
      if (doc && doc.safe) debug.error('Unsafe doc with safe flag');
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
  exports.$determineQuota = determineQuota;
  exports.$finishLoad = contentLoader.refresh;
});