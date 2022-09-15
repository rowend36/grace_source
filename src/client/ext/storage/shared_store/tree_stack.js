define(function (require, exports, module) {
  "use strict";
  var noop = require("grace/core/utils").Utils.noop;
  var ORIGIN = 0;
  /**
   * Stores children in a simple sorted parent-first stack
     allowing for fast order comparisons.
   **/

  function TreeStack() {
    this.nodes = [];
  }
  Object.assign(TreeStack.prototype, {
    append: function (node) {
      this.head = node.version;
      this.onModify();
      return this.nodes.push(node) - 1;
    },
    insertChild: function (node) {
      var i = this._getInsertPoint(node);
      if (i === this.nodes.length) {
        this.append(node);
      } else if (i > -1) {
        this.nodes.splice(i, 0, node);
        this.onModify();
      }
      return i;
    },
    batchInsert: function (nodes, check) {
      if (!nodes.length) return;
      if (check) {
        var s = 0,
          e = 0;
        do {
          e = this.getChildOffset(s, nodes);
          this.batchInsert(nodes.slice(s, e));
          s = e;
        } while (e < nodes.length);
      } else {
        var pilot = this.insertChild(nodes[0]);
        if (pilot > -1) {
          if (this.peek() === nodes[0]) {
            this.head = nodes[nodes.length - 1].version;
          }
          this.nodes.splice.apply(this.nodes, [pilot, 1].concat(nodes));
          this.onModify();
        }
        return pilot;
      }
    },
    remove: function (start, end) {
      return this.nodes.splice(start, end - start);
    },
    walk: function (startIndex, enter, exit) {
      var ctxStack = [];
      var ctx;
      for (var i = startIndex; i < this.nodes.length; i++) {
        var node = this.nodes[i]; //can be undefined
        if (ctx) {
          while (node.base !== ctx.node.version) {
            exit(ctx, i - 1, (ctx = ctxStack.pop()));
          }
          ctxStack.push(ctx);
        }
        var m = {
          node: i > -1 ? node : { version: this.nodes[0].base },
          parent: ctx,
        };
        enter(m, i, ctx);
        ctx = m;
      }
      return ctx;
    },
    /**
     * @returns - Item position in stack if exists or where it should be if not.
     * Modifies child's base for duplicate merges.
     **/
    _getInsertPoint: function (child) {
      var len = this.nodes.length;
      var saved = len;
      var base = child.base;
      var version = child.version;
      //1, 1.1, 1.1.1, 1.1.2, 1.1.2.1, 1.2, 1.4,
      for (var i = len - 1; i > -1; i--) {
        var node = this.nodes[i];
        if (node.base === base && version) {
          if (version <= node.version) {
            saved = i;
          } else if (i === len - 1 || saved < len) {
            return saved; //e.g child is 1.5 or 1.3(saved=[1.4])
          } else {
            //child is after last child e.g 1.1.3, node is 1.1.2
            return this.getChildOffset(i);
          }
        } else if (node.version === base) {
          //no siblings e.g child is 1.2.1, node is 1.2
          return version ? i + 1 : i;
        } else if (node.versions && node.versions.indexOf(base) > -1) {
          child.base = node.version;
          return this._getInsertPoint(child);
        }
      }
      if (saved < len) {
        return saved; //best guess without base
      }
      return -1;
    },
    /**
     * @returns - index of next element that is not a child of the element
     * at nodeIndex.
     **/
    getChildOffset: function (nodeIndex, nodes) {
      var bases = [];
      if (!nodes) nodes = this.nodes;
      var len = nodes.length;
      for (var i = nodeIndex + 1; i < len; i++) {
        if (nodes[i - 1].version === nodes[i].base) {
          bases.push(nodes[i].base);
        } else if (bases.indexOf(nodes[i].base) < 0) {
          return i;
        }
      }
      return len;
    },
    fixDuplicate: function (i) {
      if (
        this.nodes[i + 1] &&
        this.nodes[i + 1].version === this.nodes[i].version
      ) {
        this.remove(i, i + 1);
        return true;
      }
    },
    /**
     * @returns - The index of the common node between
     * the given node and the stack head.
     **/
    findConflictIndex: function (node) {
      var head = this.peek();
      var len = this.nodes.length;
      if (node === head) head = this.nodes[len - 2];
      for (var i = len - 1; i > -1; i--) {
        var temp = this.nodes[i];
        if (node.base === temp.version) {
          node = temp;
        }
        if (head.base === temp.version) {
          head = temp;
        }
        if (node === head) {
          return i;
        }
      }
      return -1; // Merge from origin?
    },
    head: ORIGIN,
    ORIGIN: ORIGIN,
    reset: function (firstNode) {
      this.nodes.length = 0;
      this.append(firstNode);
    },
    peek: function () {
      return this.nodes[this.nodes.length - 1];
    },
    onModify: noop,
    truncate: function () {
      var baseIndex = this._getInsertPoint({ base: this.peek().base });
      if (baseIndex > 0) {
        // console.assert(this.nodes[baseIndex].version == this.peek().base);
        // console.assert(this.getChildOffset(baseIndex) == this.nodes.length);
        this.remove(0, baseIndex);
        // console.assert(this.nodes[0].version == this.peek().base);
      }
    },
  });
  exports.TreeStack = TreeStack;
});