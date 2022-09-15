define(function (require, exports, module) {
  'use strict';
  /**
   * Blob is a storage mechanism for data the
   * client is not likely to use soon.
   * It is adaptable, cleans up after itself,
   * supports both sync and async data
   * and stores metadata for the data.
   * Managed data storage for stuff you can afford to lose.
   */
  var config = require('../core/config');
  var getObj = config.Config.getObj;
  var putObj = config.Config.putObj;
  var configure = config.Config.configure;
  var storage = config.storage;
  var Utils = require('../core/utils').Utils;
  var appConfig = config.Config.registerAll(
    {
      nextCleanTime: 0,
      clearCache: false,
    },
    'documents'
  );
  config.Config.registerInfo(
    {
      maxStoreSize: {
        type: 'size',
        doc:
          'Configures how much storage can be used in total for storing documents',
      },
      nextCleanTime: 'no-user-config',
    },
    'documents'
  );
  var maxStoreSize;
  config.Config.on('documents', updateSize);
  function updateSize(e) {
    if (!e || e.config === 'maxStoreSize') {
      maxStoreSize = Math.max(500000, Utils.parseSize(appConfig.maxStoreSize));
    } else if (e.config == 'clearCache') {
      exports.cleanBlobs(true, 0);
      configure(
        'nextCleanTime',
        Math.min(
          appConfig.nextCleanTime,
          new Date().getTime() + 1000 * 60 * 60 * 24
        ),
        'documents'
      );
      e.preventDefault();
    }
  }
  updateSize();

  var _blobRegistry;
  function getRegister() {
    return (
      _blobRegistry ||
      (_blobRegistry = getObj('blobRegistry', {
        size: 0,
      }))
    );
  }
  var blobStorage = config.storage;

  exports.hasBlob = function (id, type) {
    var register = getRegister();
    for (var i in register) {
      if (i == 'size') continue;
      if (register[i].id == id && (!type || register[i].type == type)) {
        return i;
      }
    }
  };
  exports.getBlobInfo = function (key) {
    return Object.assign({}, getRegister()[key]);
  };
  exports.getBlob = function (key) {
    exports.loadBlob(key);
  };
  exports.loadBlob = function (key, cb) {
    var value, metaData;
    var register = getRegister();
    if (register.hasOwnProperty(key)) {
      metaData = register[key];
      value = blobStorage.getItem(metaData.key);
      if (!value) {
        value = undefined;
        exports.removeBlob(key);
      } else if (metaData.obj) value = JSON.parse(value);
    }
    if (metaData && metaData.async) {
      if (!cb)
        throw new Error('Must provide callback when retrieving async data');
      Utils.setImmediate(cb, value);
    } else {
      if (cb)
        throw new Error('Tried to retrieve synchronous data asynchronously');
      return value;
    }
  };

  var blobCleanTimer;
  /**
   * Save data that will be read synchronously
   */
  exports.setBlob = function (id, type, value, data) {
    exports.saveBlob(id, type, value, Object.assign({async: false}, data));
  };
  /**
   * Save data that will be read asynchronously
   */
  exports.saveBlob = function (id, type, value, data, cb) {
    var metaData = {
      id: id,
      type: type,
      pr: (data && data.priority) || 1,
      key: Utils.genID('b', getRegister()), //createKey
    };
    if (value) {
      for (var i in data) {
        if (!metaData[i])
          //cannot override
          metaData[i] = data[i];
      }
      if (!metaData.hasOwnProperty('async')) {
        metaData.async = true;
      }
      if (typeof value == 'object') {
        metaData.obj = true;
      }
    }
    ///Stage 1 - Confirm item saved
    if (value) {
      try {
        if (metaData.obj) {
          value = JSON.stringify(value);
        }
        metaData.size = value.length;
        if (value.length > maxStoreSize) {
          return onSave(false);
        }
        blobStorage.setItem(metaData.key, value);
        return onSave(true);
      } catch (e) {
        try {
          blobStorage.removeItem(metaData.key);
        } catch (e) {}
        return onSave(false);
      }
    } else return onSave(true);

    //Stage 2 - Remove duplicates and update registry
    function onSave(saved) {
      var register = getRegister();
      if (!saved) {
        return ret(false);
      }
      var oldKey = exports.hasBlob(id, name);
      if (oldKey) exports.removeBlob(oldKey);
      if (!value) return ret(false);
      register[metaData.key] = metaData;
      register.size += metaData.size;
      if (register.size > maxStoreSize) {
        if (!blobCleanTimer) {
          blobCleanTimer = Utils.setImmediate(function () {
            blobCleanTimer = null;
            exports.cleanBlobs(true);
          });
        }
      }
      putObj('blobRegistry', register);
      return ret(metaData.key);
    }

    //Stage 3 - Send result to caller
    function ret(val) {
      if (metaData.async) {
        cb && Utils.setImmediate(cb, val);
      } else {
        return val;
      }
    }
  };
  /**
   * Delete a blob.
   */
  exports.removeBlob = function (key) {
    var register = getRegister();
    if (register.hasOwnProperty(key)) {
      var metaData = register[key];
      blobStorage.removeItem(metaData.key);
      register.size -= metaData.size;
      delete register[key];
      putObj('blobRegistry', register);
      return true;
    }
    return false;
  };
  exports.cleanBlobs = function (force, maxSize) {
    var register = getRegister();
    if (maxSize === undefined) maxSize = maxStoreSize;
    if (!force && register.size < maxSize) return;
    var toClean = [];
    if (blobCleanTimer) {
      clearTimeout(blobCleanTimer);
      blobCleanTimer = null;
    }
    var now = new Date();
    //recent blobs have higher priority
    var t = 1;
    for (var i in register) {
      if (i == 'size') continue;
      var size = register[i].size;
      var priority = register[i].pr;
      var score = (t * priority) / size;
      t += Utils.getCreationDate(i) - now;
      toClean.push({
        key: i,
        score: score,
      });
    }
    toClean[toClean.length - 1].score *= 2;
    toClean.sort(function (a, b) {
      return a.score - b.score;
    });
    var l = toClean.length / 3 || 1;
    for (var j = 0; j < l; j++) {
      exports.removeBlob(toClean[j].key);
    }
    if (register.size > maxSize) {
      exports.cleanBlobs(true);
    }
  };
  exports.allBlobs = function (id) {
    var ids = [],
      register = getRegister();
    for (var i in register) {
      if (i == 'size') continue;
      if (register[i].id == id) {
        ids.push(i);
      }
    }
    return ids;
  };

  exports.freeBlobSpace = function () {
    var freeSpace = determineQuota();
    var register = getRegister();
    if (freeSpace < 1000000) {
      var clear = 1000000 - freeSpace;
      while (register.size > clear) {
        exports.cleanBlobs(true);
      }
      return true;
    }
    return false;
  };

  function determineQuota(key) {
    if (storage instanceof Storage) {
      key = key || 0;
      var a = 'Getting Quota Using String Concatenation';
      try {
        while (true) {
          localStorage['s' + key] = a;
          a = a + a;
        }
      } catch (e) {
        var size =
          a.length / 2 + (a.length > 1000 ? determineQuota(key + 1) : 0);
        localStorage.removeItem('s' + key);
        return size;
      }
    }
    return 1e10;
  }
  function getKeys() {
    var keys = [];
    for (var i = 0; i < storage.length; i++) {
      keys.push(storage.key(i));
    }
    return keys;
  }
  function routineCheck(prefix) {
    var keys = (typeof storage.getKeys == 'function'
      ? storage.getKeys()
      : getKeys()
    ).filter(function (e) {
      return e.startsWith(prefix) && /^\d+$/.test(e.substring(prefix.length));
    });
    return keys;
  }

  exports.$maxStoreSize = function () {
    return maxStoreSize;
  };
  exports.$determineQuota = determineQuota;
  exports.$routineCheck = routineCheck;
  (function () {
    if (blobStorage instanceof Storage) {
      window.addEventListener('storage', function (ev) {
        if (ev.key === 'blobRegistry') {
          _blobRegistry = null;
        }
      });
    }
    var time = new Date().getTime() / 1000;
    if (appConfig.nextCleanTime < time) {
      if (appConfig.nextCleanTime) {
        var keys = routineCheck('b');
        var register = getRegister();
        keys.forEach(function (e) {
          if (!register[e]) blobStorage.removeItem(e);
        });
      }
      configure(
        'nextCleanTime',
        Math.floor(time) + 60 /*s*/ * 60 /*m*/ * 24 /*h*/ * 7 /*days*/,
        'documents'
      );
    }
  })();
});