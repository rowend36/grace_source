define(function (require, exports, module) {
  "use strict";
  var setImmediate = require("./utils").Utils.setImmediate;
  var noop = require("./utils").Utils.noop;
  var storage = require("./config").storage;
  function AsyncStorage(syncStorage) {
    if (syncStorage) this.s = syncStorage;
  }
  AsyncStorage.prototype.s = storage;
  function asyncify(f) {
    return function () {
      var err, res;
      try {
        res = f.apply(this, arguments);
      } catch (e) {
        err = e;
      }
      var cb = arguments[f.length - 1];
      if (typeof cb === "function") {
        setImmediate(cb.bind(this, err, res));
      }
      return err ? Promise.reject(err) : Promise.resolve(res);
    };
  }
  AsyncStorage.prototype.setItem = asyncify(function (key, value) {
    return this.s.setItem(key, value);
  });
  AsyncStorage.prototype.getItem = asyncify(function (key) {
    return this.s.getItem(key);
  });
  AsyncStorage.prototype.removeItem = asyncify(function (key) {
    return this.s.removeItem(key);
  });
  AsyncStorage.prototype.clear = asyncify(function () {
    return this.s.clear();
  });
  AsyncStorage.prototype.getKeys = asyncify(function () {
    return this.s.getKeys();
  });
  AsyncStorage.prototype.isAsync = true;
  AsyncStorage.prototype.__doSync = asyncify(noop);
  exports.AsyncStorage = AsyncStorage;
});