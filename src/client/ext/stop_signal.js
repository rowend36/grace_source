define(function (require, exports, module) {
  'use strict';
  var removeFrom = require('grace/core/utils').Utils.removeFrom;
  function StopSignal() {
    this.aborted = false;
    this.listeners = [];
    this.stop = this.control(this.stop.bind(this), false);
  }
  StopSignal.prototype.control = function (func, onAborted) {
    var self = this;
    return function () {
      if (!self.aborted) return func.apply(this, arguments);
      return typeof onAborted == 'function'
        ? onAborted.apply(this, arguments)
        : onAborted;
    };
  };
  StopSignal.prototype.stop = function (cause) {
    this.aborted = cause || true;
    var listeners = this.listeners;
    this.listeners = null;
    for (var i = listeners.length; i > 0; ) {
      listeners[--i].apply(null, arguments);
    }
    return true;
  };
  StopSignal.prototype.subscribe = function (func) {
    if (this.aborted) setImmediate(func, this.aborted);
    else if (this.listeners.indexOf(func) < 0) this.listeners.push(func);
  };
  StopSignal.prototype.unsubscribe = function (func) {
    if (!this.aborted) removeFrom(this.listeners, func);
  };
  StopSignal.prototype.clear = function () {
    this.aborted = true;
    this.listeners = null;
  };
  exports.StopSignal = StopSignal;
});