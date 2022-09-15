define(function (require, exports, module) {
  'use strict';
  var storage = require('grace/core/config').storage;
  var noop = require('grace/core/utils').Utils.noop;

  function LSTransport(store, key) {
    this._key = key;
    this.store = store;
  }
  LSTransport.prototype.backend = storage;
  LSTransport.prototype.submitNode = function (node) {
    this.backend.setItem(this._key, this.store.stringifyNode(node));
  };
  LSTransport.prototype.getInitialValue = function () {
    try {
      return this.store.parseNode(this.backend.getItem(this._key));
    } catch (e) {}
  };

  /**
   * Starts listening for change nodes
   **/
  LSTransport.prototype.connect =
    storage instanceof Storage
      ? function () {
          if (this.$onStorage) return;
          this.$onStorage =
            this.$onStorage ||
            function (ev) {
              if (
                ev.storageArea === this.backend &&
                (!ev.key || ev.key === this._key)
              ) {
                this.store.onRemoteNode(this.store.parseNode(ev.newValue));
              }
            }.bind(this);
          window.addEventListener('storage', this.$onStorage);
        }
      : noop;
  LSTransport.prototype.disconnect =
    storage instanceof Storage
      ? function () {
          window.removeEventListener('storage', this.$onStorage);
          this.$onStorage = null;
        }
      : noop;
  exports.LSTransport = LSTransport;
});