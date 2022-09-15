define(function (require, exports, module) {
  'use strict';
  var noop = require('./utils').Utils.noop;
  var removeFrom = require('./utils').Utils.removeFrom;
  function RefCounted() {
    this.$unref = this.unref.bind(this);
    this.$refs = [];
  }
  RefCounted.prototype.destroy = noop;
  RefCounted.prototype.ref = function (id) {
    if (this.$refs.indexOf(id) < 0) {
      this.$refs.push(id);
    }
  };
  RefCounted.prototype.unref = function (id) {
    removeFrom(this.$refs, id);
    if (this.$refs.length === 0) this.destroy();
  };
  RefCounted.prototype.hasRef = function (id) {
    return this.$refs.indexOf(id) > -1;
  };
  exports.RefCounted = RefCounted;
});