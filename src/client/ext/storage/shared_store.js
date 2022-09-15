define(function (require, exports, module) {
  "use strict";
  var noop = require("grace/core/utils").Utils.noop;
  var debounce = require("grace/core/utils").Utils.debounce;
  var genID = require("grace/core/utils").Utils.genID;
  var TreeStack = require("./shared_store/tree_stack").TreeStack;
  var SetFormat = require("./shared_store/set_format").SetFormat;
  var LSTransport = require("./shared_store/local_storage_transport")
    .LSTransport;
  var MAX_PROPAGATION_TIME = 5;
  /**
   * Implements a store in which each client is aware of all
   * changes to the store using deterministic ordered transforms.
   **/
  function SharedStore(key, format) {
    this._key = key;
    this._counter = 0; //used to order nodes from the same source
    this.id = genID(key); //used to fix conflicts
    this.stack = new TreeStack();
    this.transport = new LSTransport(this, key);
    this.stack.onModify = debounce(
      this.stack.truncate.bind(this.stack),
      MAX_PROPAGATION_TIME
    );
    if (format) this._format = format;
    //The separate storeValue means clients don't have to
    //respond to changes
    this._storeValue = this._format.NULL;
  }
  SharedStore.prototype.getStore = function () {
    return this._storeValue;
  };
  SharedStore.prototype.allowMergeRebase = true;
  SharedStore.prototype.onEdit = noop;
  /**
   * Read the backend, any other changes to the backend no longer
   * concern the client unless it chooses to add them by calling
   * this.syncClient().
   **/
  SharedStore.prototype.syncClient = function () {
    this._clientValue = this._storeValue;
    this._isClientSynced = true;
  };
  SharedStore.prototype.get = function () {
    if (!this._hasRead) {
      this.stack.reset(
        this.transport.getInitialValue() || this.createNode(this._format.NULL)
      );
      this.syncStore(false);
      this._hasRead = true;
      this.syncClient();
    }
    return this._clientValue;
  };
  SharedStore.prototype.syncStore = function (wasFastForward, isLocal) {
    var m = this._storeValue;
    var n = this.stack.peek();
    this._storeValue = n.value;
    if (this._hasRead) {
      var changes = wasFastForward ? n.patches : this.getPatches(m, n.value);
      if (changes.length) {
        this._isClientSynced = false;
        this.onEdit(changes, isLocal);
      }
    }
  };
  SharedStore.prototype.set = function (value) {
    if (!this._hasRead) this.get();

    var changes = this.getPatches(this._clientValue, value);
    if (!changes.length) return;
    this._clientValue = value;
    this.onClientChange(changes);
  };

  /**
   * Upload changes to the store
   **/
  SharedStore.prototype.onClientChange = function (changes) {
    if (!this._isClientSynced) {
      var patches = this.getPatches(this._clientValue, this._storeValue);
      changes = this.forwardTransform(changes, patches);
    }
    var m = this.patch(this._storeValue, changes);
    var node = this.createNode(m, changes);
    this.stack.append(node);
    this.transport.submitNode(node);
    this.syncStore(true, true);
  };

  /**
   * Adds new non-local change.
   **/
  SharedStore.prototype.onRemoteNode = function (node) {
    if (!this._hasRead) return;
    var head = this.stack.head;
    var insertPoint = this.stack.insertChild(node);
    var isFastForward = node.base === head; //order matters
    if (insertPoint > -1) {
      if (this.stack.fixDuplicate(insertPoint)) {
        return;
      }
      if (isFastForward) {
        this.syncStore(true, false);
      } else if (node.isMerge) {
        this._electMerge(insertPoint);
      } else {
        this._createMerge(node);
      }
    } else if (node.version > head) {
      console.debug(this.id, " force syncing to " + node.version);
      this.stack.reset(node);
      this.syncStore(false, false);
    } else {
      if (!node.isMerge)
        console.warn(this.id, " discarded stale data:(" + node.version+")");
    }
  };
  SharedStore.prototype._electMerge = function (index) {
    var nodes = this.stack.nodes;
    var node = nodes[index];
    var end = nodes.length - 1;
    var base = node.base;
    for (var i = end; i > -1; i--) {
      if (nodes[i].base === base) {
        if (!nodes[i].isMerge) continue;
        if (i === index) continue;
        if (index < i) {
          this._onMergeElected(i, index);
        } else {
          this._onMergeElected(index, i);
        }
        break;
      } else if (nodes[i].version === base) {
        //There is no other merge on this base.
        if (index < end) {
          this._createMerge(nodes[index]);
        }
        break;
      }
    }
    //TODO not always needed, ie e.g when isSameMerge
    this.syncStore(false, false);
  };

  SharedStore.prototype._isSameMerge = function (winner, node2) {
    if (
      parseInt(winner.version) === parseInt(node2.version) &&
      //TODO We could compare the patches since they are available
      this._format.isEqual(winner.value, node2.value)
    ) {
      winner.versions = (node2.versions || []).concat(winner.versions || []);
      winner.versions.push(node2.version);
      return true;
    }
    //To discard wrong merges, still return true.
  };
  /**
   * 150 extra lines to handle this.
   * Merges should arrive at the same result.
   * However, sometimes, they don't, hence having different
   * versions is essential though rarely needed.
   * This method fixes this by updating the version
   * of a merge to the highest priority equivalent.
   * This is then used by _getInsertPoint to modify
   * any wrongly placed nodes.
   * When it can't do that, it transforms the lower priority
   * merges on the higher one.
   * WARNING: this method assumes one of the merges is new/childless.
   **/
  SharedStore.prototype._onMergeElected = function (winnerIndex, loserIndex) {
    var nodes = this.stack.nodes;
    var winner = nodes[winnerIndex];
    var loser = nodes[loserIndex];
    var adopted;
    var orphans = this.stack.remove(loserIndex, winnerIndex).slice(1);
    var head = this.stack.head;
    if (this._isSameMerge(winner, loser)) {
      if (loser.loserNode) winner.loserNode = loser.loserNode;
      return this.stack.batchInsert(orphans, true);
    }
    if (!this.allowMergeRebase) return;
    /*
      Transform loser merge node to be on winner
           a    b
           |\  /|
           | \/ |
           | /\ |
           |/  \|
           |    |
    (loser)ab   ba(winner)
           |      |
           abc    v(loser.rebaseNode)
                  |
                  ab(loser/winner.loserNode)
                 /| \
                / |  \
 (reverserNode)ba abc  \
               \______bac(new mergeNode)
      */

    var attachPoint = winner;
    var nextLoser;
    while (
      attachPoint.loserNode &&
      attachPoint.loserNode.version > loser.version
    ) {
      attachPoint = attachPoint.loserNode;
      if (this._isSameMerge(attachPoint, loser)) {
        return; //assumes no orphans
      }
    }
    if (loser.loserNode) {
      var nested = loser.loserNode;
      do {
        if (this._isSameMerge(winner, nested)) {
          var a = orphans.indexOf(nested.rebaseNode);
          var parent = orphans[a - 1];
          if (!parent || !parent.loserNode)
            //orphans[a-1] could be the parent's reverser node
            parent = orphans[a - 2] || loser;
          parent.loserNode = null;
          if (nested.loserNode) {
            this._mergeRebase(nested.loserNode, parent);
          }
          //ie get children of nested node minus rebaseNode,reverseNode and node itself
          adopted = orphans
            .splice(a, this.stack.getChildOffset(a, orphans) - a)
            .slice(3);
          this.stack.batchInsert(adopted, true);
          break;
        }
        nested = nested.loserNode;
      } while (nested);
    } else if (attachPoint.loserNode) {
      nextLoser = attachPoint.loserNode;
      //TODO this._isSameMerge(loser, nextLoser);
      attachPoint.loserNode = null;
      nextLoser.rebaseNode.version = "0.2"; //force after loser's rebaseNode
    }
    loser.originalPatches = loser.patches;
    loser.reverserNode = this.createNode();
    loser.reverserNode.version = "0.0." + loser.version;
    loser.rebaseNode = this.createNode();
    loser.base = loser.rebaseNode.version = "0.1." + loser.version;

    this._mergeRebase(loser, attachPoint);

    this.stack.batchInsert([loser.rebaseNode, loser, loser.reverserNode]);

    if (nextLoser) {
      nextLoser.rebaseNode.version = nextLoser.base;
      this._mergeRebase(nextLoser, loser);
    }
    if (orphans.length) {
      //TODO find out why removing forwarder is necessary
      if (orphans[orphans.length - 1].isForwarder) orphans.pop();
      this.stack.batchInsert(orphans, true);
    }
    if (attachPoint.isVirtual) return; //assumes no orphans
    if (
      orphans.some(function (e) {
        return !e.isVirtual;
      })
    ) {
      this._createMerge(winner); //winner is the conflict base
    } else if (head !== this.stack.head) {
      var forwarder = this.createNode();
      forwarder.version = head;
      forwarder.base = head;
      forwarder.value = winner.value;
      forwarder.isForwarder = true;
      this.stack.append(forwarder);
    }
  };

  SharedStore.prototype._mergeRebase = function (loser, base) {
    loser.rebaseNode.value = base.value;
    loser.rebaseNode.base = base.version;
    if (this._format.transform) {
      loser.patches = this.getPatches(base.value, loser.value);
      loser.reverserNode.patches = this.getPatches(loser.value, base.value);
    } else {
      //special handling for sets
      loser.patches = loser.reverserNode.patches = null;
      loser.value = base.value;
    }
    loser.reverserNode.value = base.value;
    loser.reverserNode.base = loser.version;
    loser.isVirtual = true;
    loser.isMerge = false;
    base.loserNode = loser;
  };
  SharedStore.prototype._createMerge = function (cause) {
    var nodes = this.stack.nodes;
    var rootIndex = this.stack.findConflictIndex(cause);
    var cachedIndex = Math.max(rootIndex + 1, nodes.indexOf(cause) - 1);
    var state = null;
    var conflictBase = nodes[rootIndex + 1].base;
    var self = this;
    //Walk the tree, gathering patches and transforming nodes
    var nodeCount = 0;

    var result = this.stack.walk(
      rootIndex,
      function onEnter(ctx, i, parent) {
        var node = ctx.node;
        var inBadMerge = parent
          ? (node.isMerge && node.base === conflictBase) || parent.inBadMerge
          : false;
        ctx.inherited = parent
          ? !inBadMerge && node.isMerge
            ? parent.inherited
            : parent.before
          : [];
        //Changes by previous nodes this change was not aware of
        ctx.before = ctx.inherited.slice(0);
        ctx.inBadMerge = inBadMerge;
        if (!parent || inBadMerge) return;

        var patches = node.patches;
        if (patches) {
          //TODO use actual merge nodeCount
          if (!node.isVirtual) nodeCount++;
          patches = self.forwardTransform(patches, ctx.before);
          ctx.before.push.apply(ctx.before, patches);
        }
        if (i > cachedIndex) {
          if (patches)
            state = node.value = self.patch(
              node.isMerge ? ctx.parent.node.value : state,
              patches
            );
          else node.value = state;
        } else state = node.value;
      },
      function onExit(ctx, i, parent) {
        parent.before = ctx.before;
      }
    );
    var mergeNode = this.createNode(
      state,
      result.before,
      conflictBase,
      nodeCount
    );
    var index = this.stack.append(mergeNode);
    this.transport.submitNode(mergeNode);
    this._electMerge(index);
  };

  SharedStore.prototype.createNode = function (
    value,
    patches,
    mergeBase,
    patchCount
  ) {
    var node = {
      //Base we are working with
      base: mergeBase || this.stack.head,
      //Version we are entering into
      version:
        (mergeBase ? patchCount || 0 : 1) +
        (parseInt(mergeBase || this.stack.head) || 0) + //only used for force syncing
        "." +
        this.id +
        "." +
        this._counter++,
      //The changes between the base and version
      patches: patches || undefined,
      isMerge: !!mergeBase,
      //The final value
      value: value,
      //A virtual node is not meant to be shared/counted
      isVirtual: !value,
      //A forwarder is a virtual node that points back at it's base
      isForwarder: false,
      loserNode: undefined,
      rebaseNode: undefined,
      reverserNode: undefined,
    };
    return node;
  };

  /**
   * A patch is an array of serializable change objects.
   * The format of the change object is specific to the _format.
   **/
  SharedStore.prototype.getPatches = function (oldValue, value) {
    return this._format.fuzzyDiff(oldValue, value);
  };
  SharedStore.prototype.patch = function (from, changes) {
    return this._format.applyPatch(from, changes);
  };
  /**
   * Given a set of changes, a,b,c and x,y,z.... Modify a,b,c.... to look
   * like they happened after x,y,z so the can be applied as x,y,z,a',b',c'.
   **/
  SharedStore.prototype.forwardTransform = function (changes, before) {
    return this._format.transform
      ? this._format.transform(changes, before)
      : changes;
  };
  /**
   * Stores both the change and the data in one value.
   * However, the value property can be computed on parse
   * or when needed with a getter property.
   **/
  SharedStore.prototype.parseNode = function (str) {
    var data = JSON.parse(str);
    return {
      base: data.b || TreeStack.ORIGIN,
      version: data.v || "",
      patches: data.p,
      isMerge: data.i,
      value: this._format.parse(data.c),
    };
  };
  SharedStore.prototype.stringifyNode = function (node) {
    return JSON.stringify({
      b: node.base,
      v: node.version,
      p: node.patches,
      i: node.isMerge,
      c: this._format.serialize(node.value),
    });
  };

  SharedStore.prototype._format = SetFormat;

  exports.SharedStore = SharedStore;
});