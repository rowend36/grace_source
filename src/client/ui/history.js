define(function(require, exports, module) {
  'use strict';

  function History() {
    this.items = [];
    this.cursor = 0;
    this.size = 0;
    this.input = null;
  }
  Object.assign(History.prototype, {
    commands: {
      historyDown: function() {
        if (this.hasNext()) {
          this.input.value = this.next();
          return true;
        }
      },
      historyUp: function() {
        if (this.hasPrev()) {
          this.input.value = this.prev();
          return true;
        }
      },
      accept: function() {
        this.commit();
      },
    },
    bind: function(input) {
      this.input = input;
    },
    hasNext: function() {
      return this.cursor < this.size;
    },
    hasPrev: function() {
      if (this.cursor === this.size) this.commit();
      return this.cursor > 1;
    },
    prev: function() {
      if (this.cursor === this.size) this.commit();
      if (this.cursor < 2) return null;
      return this.items[--this.cursor - 1];
    },
    next: function() {
      if (this.cursor === this.size) return null;
      return this.items[this.cursor++];
    },
    commit: function() {
      if (this.cursor < this.size) this.cursor = this.size;
      var val = this.create();
      if (!this.equals(this.items[this.size - 1], val)) {
        this.items[(this.size++, this.cursor++)] = val;
      }
    },
    create: function() {
      return this.input.value;
    },
    equals: function(val, val2) {
      return val === val2;
    }
  });
  exports.History = History;
});