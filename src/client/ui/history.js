define(function (require, exports, module) {
  'use strict';

  function History() {
    this.items = [];
    this.popItems = [];
    this.currentItem = null;
    this.input = null;
  }

  Object.assign(History.prototype, {
    commands: {
      historyDown: function () {
        if (this.hasNext()) {
          this.input.value = this.next();
          return true;
        }
      },
      historyUp: function () {
        if (this.hasPrev()) {
          this.input.value = this.prev();
          return true;
        }
      },
      accept: function () {
        this.push(this.input.value);
      },
    },
    bind: function(input){
      this.input = input;
    },
    hasNext: function () {
      return this.popItems.length;
    },
    commit: function () {
      this.currentItem = null;
    },
    hasPrev: function () {
      return this.items.length
        ? this.dir
          ? this.items.length
          : this.items.length - 1
        : 0;
    },
    prev: function () {
      var a = this.items.pop();
      if (!a) return;
      this.popItems.unshift(a);
      if (this.dir > -1) {
        this.dir = -1;
        return this.prev();
      }
      return a;
    },
    next: function () {
      var a = this.popItems.shift();
      if (!a) return;
      this.items.push(a);
      if (this.dir < 1) {
        this.dir = 1;
        return this.next();
      }
      return a;
    },
    modify: function (val, sb) {
      val = val || this.create(sb);
      if (this.hasNext() || this.currentItem === null) {
        this.push(val);
        this.currentItem = this.items[this.items.length - 1];
      } else {
        if (val.search) this.currentItem.search = val.search;
        if (val.replace) this.currentItem.replace = val.replace;
      }
    },
    create: function (sb) {
      return {
        search: sb.searchInput.value,
        replace: sb.replaceOption.checked && sb.replaceInput.value,
      };
    },
    push: function (val, sb) {
      val = val || this.create(sb);
      this.items = this.items.concat(this.popItems);
      this.currentItem = null;
      this.popItems = [];
      this.dir = 0;

      if (this.canPush(this.items[this.items.length - 1], val)) {
        this.items.push(val);
      }
    },
    canPush: function (val, val2) {
      return (
        val2.search &&
        !(val && val.search == val2.search && val.replace == val2.replace)
      );
    },
  });
});