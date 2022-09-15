define(function (require, exports, module) {
  'use strict';
  var storage = require('./config').storage;
  var noop = require('./utils').Utils.noop;
  var stores = {};
  function Store(id, _default) {
    if (stores[id]) throw new Error('Duplicate store ' + id);
    this.id = id;
    this._default = JSON.stringify(_default || null);
    this.$data = undefined;
  }
  Store.prototype.get = function () {
    if (this.$data !== undefined) return this.$data;
    try {
      var res = storage.getItem(this.id);
      if (res !== null) this.$data = JSON.parse(res);
    } catch (e) {}
    if (this.$data == undefined) this.$data = JSON.parse(this._default);
    return this.$data;
  };
  Store.prototype.set = function (data) {
    this.$data = data;
    storage.setItem(this.id, JSON.stringify(data));
  };
  Store.prototype.save = function () {
    this.set(this.get());
  };
  Store.prototype.destroy = function () {
    storage.removeItem(this.id);
    delete stores[this.id];
  };
  Store.prototype.$onChange = function (data) {
    if (data != undefined)
      this.onChange(this.$data, (this.$data = JSON.parse(data)));
    else this.save();
  };
  Store.prototype.onChange = noop;
  if (storage instanceof Storage) {
    window.addEventListener('storage', function (ev) {
      if (ev.storageArea == storage && stores[ev.key]) {
        stores[ev.key].$onChange(ev.newValue);
      }
    });
  }
  exports.Store = Store;
});