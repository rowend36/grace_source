define(function (require, exports, module) {
  'use strict';
  /* globals ace */
  /**
   * For two delta sets, the following should be the same if
   * uid - applying both of them would duplicate a change
   * rev - applying both of them will produce the same content.
   * id - should never be the same. ids should be roughly sorted in the undo stack.
   * origin - if they originated from the same source. The uid, id and rev rules are localized to origins ie only respected when they originated from the same origin.
   */

  function _findCommonBase(ds1, ds2) {
    for (var i = ds1.length - 1, j = ds2.length - 1; i > -1 && j > -1; ) {
      if (ds1[i][0].id < ds2[j][0].id) j--;
      else if (ds1[i][0].id > ds2[j][0].id) i--;
      //Undefined ids as a result of generated deltas
      else if (ds2[j][0].id === undefined) j--;
      else if (ds1[i][0].id === undefined) i--;
      //Rev can change without changing id due to rearrangeUndoStack
      else if (ds1[i][0].rev != ds2[j][0].rev) i--;
      //Two synced origins will generate unrelated changes with the same id.
      else if (ds1[i][0].origin !== ds2[j][0].origin) i--;
      //Sometimes deltas are modified after sending
      else if (ds1[i].length != ds2[j].length) i--;
      else return {src: i, dest: j};
    }
  }

  function _rev(e) {
    return e[0].rev || e[0].id;
  }
  function getPatch(um1, um2, originId) {
    var from = um1.$undoStack;
    var fromOffset = 0;
    if (um1.$redoStackBaseRev === um1.$rev) {
      from = from.concat(um1.$redoStack.slice().reverse());
      fromOffset = um1.$redoStack.length;
    }
    var to = um2.$undoStack;
    var toOffset = 0;
    //Todo transform these deltas so we can keep redo stack.
    if (um2.$redoStackBaseRev === um2.$rev) {
      to = to.concat(um2.$redoStack.slice().reverse());
      toOffset = um2.$redoStack.length;
    }
    var base = _findCommonBase(from, to);
    if (!base) {
      //Try to see this as a fast-forward patch
      if (to[0] && to[0][0].id === um1.$maxRev + 1)
        base = {src: from.length - 1, dest: -1};
      else if (!base) return false;
    }
    //The position of the undo stack head.
    //When base.dest = to.length-1; offset = -toOffset
    //e.g 1,[2] (3), + 1,2,(3),4 => 1,[2],(3),4
    //to.length=3, toOffset = 1, base.dest(3) = 2
    //offset = -1;
    var offset = to.length - 1 - base.dest - toOffset;
    //Confirm that the revs that will be undone by the offset are in from.
    for (var k = offset; k < 0; k++) {
      if (
        from[base.src + k] &&
        _rev(from[base.src + k]) === _rev(to[base.dest + k])
      ) {
        break;
      }
    }
    if (k > offset) {
      base.src -= k - offset;
      base.dest -= k - offset;
      offset = k;
    }
    var patch = {
      //The direction from origin revision, we should undo/redo to get to the base. Call expandPatch to convert this to an array of deltas to be undone.
      undo: base.src - from.length + fromOffset + 1,
      // common: from[base.src],
      //Deltas to be applied from the base to get to the top of the target stack.
      add: [],
      //Offset determines how far the target revision is from the top base along the target stack.
      offset: offset,
    };

    for (var j = base.dest + 1; j < to.length; j++) {
      var change = to[j][0];
      if (!change.origin) change.origin = originId;
      patch.add.push(to[j]);
    }
    return patch;
  }
  //Fill in the deltas so we do not need the origin to apply a patch.
  function expandPatch(patch, origin) {
    var len = origin.$undoStack.length;
    var offset = patch.offset;
    if (typeof patch.undo === 'number') {
      if (patch.undo < 0) {
        //changes from origin undone before add
        var toUndo = -patch.undo;
        patch.undo = origin.$undoStack.slice(len - toUndo);
        len -= toUndo;
      } else {
        //changes from origin redone before add
        var toRedo = patch.undo;
        patch.undo = [];
        patch.add.unshift.apply(
          patch.add,
          origin.$redoStack.slice(origin.$redoStack.length - toRedo).reverse(),
        );
        offset += toRedo;
      }
    }
    for (var i = offset; i < 0; i++) {
      var top = origin.$undoStack[len + patch.offset - i - 1];
      patch.undo.push(top);
      patch.add.unshift(top);
    }
    patch.offset = i;
    return patch;
  }
  // //Only compresses undos to negative offsets not redos
  // function compressPatch(patch) {
  //   if (Array.isArray(patch.undo)) {
  //     for (; patch.add.length > 0; ) {
  //       var m = patch.undo[patch.undo.length - 1];
  //       var n = patch.add[0];
  //       if (m == n) {
  //         patch.undo.pop();
  //         patch.add.shift();
  //       } else break;
  //     }
  //     patch.undo = -patch.undo.length;
  //   }
  //   return patch;
  // }
  var _splice = Array.prototype.splice;
  function applyPatch(patch, um, session) {
    if (!session && session !== null)
      throw new Error('Missing parameter session');
    var isCompressed = patch.offset < 0;
    patch = expandPatch(patch, um);
    var u = um.$undoStack;
    for (var i = 0; i < patch.undo.length; i++) {
      var top = patch.undo[i];
      //Without offset compression, this will not undo swapped undos.
      if (isCompressed ? u[u.length - 1] !== top : um.$rev != _rev(top))
        throw new Error('Failed Precondition');
      var ignore = top[0].ignore;
      if (ignore) top[0].ignore = false;
      session ? um.undo(session) : um.$undoStack.pop();
      if (ignore) top[0].ignore = ignore;
    }
    um.$syncRev();
    var r = um.$redoStack;
    _splice.apply(r, [0, r.length].concat(patch.add));
    r.reverse();
    r.forEach(function (e) {
      if (!e[0].id) e[0].id = ++um.$maxRev;
    });
    for (var j = 0; j < patch.offset; j++) {
      var next = patch.add[j];
      session ? um.redo(session) : u.push(r.pop());
      if (u[u.length - 1] !== next) throw new Error('Failed Postcondition');
    }
    if (!session) um.$syncRev();
  }
  var cloneDeltaSet = ace.UndoManager.prototype.cloneDeltas;
  var transformDeltas = ace.UndoManager.prototype.transformDeltas;
  function invertDeltas(delta) {
    var uid = delta[0].uid || delta[0].id;
    var origin = delta[0].origin;
    var rev = _rev(delta);
    delta = delta
      .filter(function (m) {
        return (m.action =
          m.action === 'insert'
            ? 'remove'
            : m.action === 'remove'
            ? 'insert'
            : false);
      })
      .reverse();
    if (uid) delta[0].uid = -uid;
    if (rev) delta[0].rev = -rev; //will be cleared after transform
    if (uid && rev) delta[0].id = null; //use rev to check equality
    if (origin) delta[0].origin = origin;
    return delta;
  }

  //find the last instance of a change in a delta stack, this enables us to know whether to mark it as a duplicate or not.
  function _last(e, i, arr) {
    if (arr.indexOf(-e, i + 1) > -1) {
      return undefined;
    } else if (arr.indexOf(e, i + 1) > -1) {
      return undefined;
    }
    return e;
  }

  //Uniquely identify a change
  function _uid(d) {
    return d[0].origin + '.' + (d[0].uid || d[0].id);
  }
  function transformDeltasUnique(deltas, prevDeltas) {
    var base = _findCommonBase(deltas, prevDeltas);
    if (base) {
      //Optimization for common base
      prevDeltas = prevDeltas.slice(base.dest + 1);
      deltas.splice(0, base.src + 1);
    }
    var uids1 = deltas.map(_uid).map(_last);
    var uids2 = prevDeltas.map(_uid).map(_last);
    for (var i = uids1.length; i-- > 0; ) {
      if (uids1[i] && uids2.indexOf(uids1[i]) > -1) {//Remove duplicate deltas
        var result = deltas.splice(i);
        var inverse = invertDeltas(result.shift());
        transformDeltas(result, [inverse]);
        result.unshift(i, 0);
        _splice.apply(deltas, result);
      }
    }
    deltas.forEach(function (e) {
      e[0].uid = e[0].uid || e[0].id;
      if (e[0].rev !== undefined) e[0].rev = undefined;//has no meaning after transforms
      e[0].id = undefined; //will be set on apply
    });
    transformDeltas(deltas, prevDeltas);
  }
  function transformPatch(patch, prev, origin) {
    patch = Object.assign({}, patch);
    prev = Object.assign({}, prev);
    patch = expandPatch(patch, origin);
    prev = expandPatch(prev, origin);
    //clone for inverting
    patch.undo = patch.undo.map(cloneDeltaSet);
    prev.undo = prev.undo.map(cloneDeltaSet);
    //clone for transforming
    patch.add = patch.add.map(cloneDeltaSet);
    var flatPrev = prev.undo
      .map(invertDeltas)
      .concat(prev.add.slice(0, prev.offset));
    var flatPatch = patch.undo.map(invertDeltas).concat(patch.add);
    transformDeltasUnique(flatPatch, flatPrev);
    var offset = flatPatch.length;
    if (patch.offset < patch.add.length) {
      //find the best place to put the offset
      //although some deltas have been deleted
      //TODO split this into two loops perhaps
      for (var n = patch.add.length; n-- > 0; ) {
        var o = flatPatch.indexOf(patch.add[n]);
        if (o < 0) continue;
        if (n < patch.offset) {
          offset = o + 1;
          break;
        } else {
          offset = o;
        }
      }
    }
    //redos from prev, clone for transforming after the new patch
    var afterPrev = prev.add.slice(prev.offset).map(cloneDeltaSet);
    transformDeltasUnique(afterPrev, flatPatch);
    return {
      undo: 0,
      offset: offset,
      // common: prev.add[prev.add.length - 1],
      add: flatPatch.concat(afterPrev),
    };
  }
  // exports.compressPatch = compressPatch;
  exports.invertDeltas = invertDeltas;
  exports.getPatch = getPatch;
  exports.applyPatch = applyPatch;
  exports.transform = transformPatch;
});