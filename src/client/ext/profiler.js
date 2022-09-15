define(function (require, exports, module) {
  "use strict";
  var entries = [];
  var current = null;

  //Returns a new function that records profile information
  var _profileFunc = function (label, func, event) {
    const t = function (name2) {
      const datum = {
        label: event ? label + name2 : label,
        t: Date.now(),
        error: true,
        m: 0,
      };
      entries.push(datum);
      var _current = current;
      current = datum;
      var res;
      try {
        res = func.apply(this, arguments);
      } finally {
        current = _current;
      }
      datum.t = Date.now() - datum.t;
      if (current) {
        current.m += datum.t;
      }
      datum.error = false;
      return !res && this && this.constructor === func ? this : res;
    };
    t.prototype = func.prototype;
    t._original = func;
    return t;
  };
  //Records profile info using given label
  exports.profileFunc = function (label, func) {
    return _profileFunc(label, func, false);
  };
  //Records profile info using first argument
  exports.profileEvents = function (func) {
    return _profileFunc("event-", func, true);
  };

  //Records profile info of listeners
  exports.profileListeners = function (emitter) {
    var on = emitter.on,
      off = emitter.off;
    emitter.on = function (e, cb) {
      var args = Array.prototype.slice.call(arguments, 0);
      if (!cb._profiled)
        cb._profiled = _profileFunc(
          "on" +
            e +
            "-" +
            (cb.name ? cb.name : new Error().stack.split("\n")[2]),
          cb,
          false
        );
      args[1] = cb._profiled;
      return on.apply(this, args);
    };
    emitter.on._original = on;
    emitter.off = function () {
      var args = Array.prototype.slice.call(arguments, 0);
      args[1] = args[1]._profiled || args[1];
      return off.apply(this, args);
    };
    emitter.off._original = off;
  };

  //Records profile info of methods
  exports.profileObject = function (obj) {
    var label = obj.constructor && obj.constructor.name;
    label = label ? label + "." : "";
    for (var i in obj) {
      if (obj.hasOwnProperty(i)) {
        var t = obj[i];
        if (typeof t === "function") {
          if (!t._original) obj[i] = exports.profileFunc(label + i, t);
        }
      }
    }
  };

  //Calculates results
  exports.computeResults = function () {
    var t = {};
    entries.forEach(function (o) {
      if (!t[o.label]) {
        t[o.label] = {
          pureRuntime: 0,
          totalRuntime: 0,
          called: 0,
          error: 0,
        };
      }
      t[o.label].called++;
      if (t[o.label].error) t[o.label].error++;
      else {
        t[o.label].totalRuntime += o.t;
        t[o.label].pureRuntime += o.t - o.m;
      }
    });
    return t;
  };

  //Sorts and Displays results in table
  exports.displayResults = function (sort, size) {
    sort = sort || "pureRuntime";
    size = size || 50;
    var t = exports.computeResults();
    var l = Object.keys(t)
      .sort(function (a, b) {
        return t[b][sort] - t[a][sort];
      })
      .slice(0, size)
      .reduce(function (a, o) {
        a[o] = t[o];
        return a;
      }, {});
    console.table(l);
  };
  exports.clear = function () {
    entries = [];
  };
  window.Perf = exports;
});