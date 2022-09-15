define(function (require, exports, module) {
  "use strict";
  var notIn = require("grace/core/utils").Utils.notIn;
  exports.SetFormat = {
    parse: function (value) {
      return value ? value.split(",") : [];
    },
    serialize: function (value) {
      return value && value.length ? value.join(",") : "";
    },
    fuzzyDiff: function (m, n) {
      var changes = [];
      var added = n.filter(notIn(m));
      if (added.length) {
        changes.push({ type: 1, items: added });
      }
      var removed = m.filter(notIn(n));
      if (removed.length) {
        changes.push({ type: -1, items: removed });
      }
      return changes;
    },
    isEqual: function (a, b) {
      return a.length === b.length && !a.some(notIn(b));
    },
    /**
     * Uses notIn to handle double-insert conflicts
     **/
    applyPatch: function (t, changes) {
      changes.forEach(function (e) {
        if (e.type === -1) {
          t = t.filter(notIn(e.items));
        } else t = t.concat(e.items.filter(notIn(t)));
      });
      return t;
    },
    /**
     * Sets don't dig transforms.
     **/
    transform: null,
    NULL: [],
  };
});