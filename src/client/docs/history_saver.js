define(function (require, exports, module) {
  var setBlob = require('./mixin_docs_blob').setBlob;
  var getBlob = require('./mixin_docs_blob').getBlob;
  var getBlobInfo = require('./mixin_docs_blob').getBlobInfo;
  var hasBlob = require('./mixin_docs_blob').hasBlob;
  var removeBlob = require('./mixin_docs_blob').removeBlob;
  var Notify = require('../ui/notify').Notify;
  var syncRequire = require('../core/depend').syncRequire;
  var CONTENT_PRIORITY = 10;
  var debug = console;
  //The original simple implementation.
  // var defaultSaver = {
  //   save: function (doc) {
  //     return JSON.stringify(doc.serialize());
  //   },
  //   load: function (doc, obj) {
  //     doc.unserialize(obj);
  //   },
  //   canRecover: function(){
  //     return false;
  //   },
  //   onRemoteChange: function (doc, obj) {
  //     doc.unserialize(obj);
  //   },
  // };
  var id = null;
  var context = function (doc) {
    id = doc.id;
    entry('Handling {id} ...');
  };
  function entry(e) {
    if (!exports._debug) return;
    var args = arguments;
    var i = 0;
    debug.log(
      e.replace(/{([^}]+)}/g, function (o, m) {
        return m == 'id' ? id : i < args.length ? args[++i] : o;
      }),
    );
  }
  function isInvalid(deltas) {
    var uniq = {};
    for (var i = deltas.length; i-- > 0; ) {
      var d = deltas[i][0];
      if (!d) return [i, 'Empty delta in undos'];
      if (uniq[d.id]) return [i, 'Duplicate id in undos ' + d.id];
      else uniq[d.id] = true;
    }
    entry('Delta Stack for {id} seems valid');
    return false;
  }
  var INCORRECT = null; //revision not on stack
  var SUCCESS = true;
  var ERROR = false; //stack is invalid
  /**
    The History Saver uses a revision and the content of that revision
    to update the value of a session reducing how often we have to save
    the entire content.
    
   * Issue(willnotfix): bails out too early for revs from swapped undos in undo stack. id'rev
   * 1 2 3 4 [7'10] [5'11] 6'7 8 |9 12 <-- find 10 or 11 fails because of 9
   * Similar issue in redo stack
   * 9 8 [6'7] |5'11 7'10 4 3 2 1 <-- find 7 will fail because of 5'11
   * 
  */
  function _findIndex(stack, revision, isRedo) {
    if (revision === 0 && !isRedo) return 0; // Assumption
    for (var i = stack.length; i--; ) {
      var delta = stack[i][0];
      if ((delta.rev || delta.id) == revision) {
        return isRedo ? i : i + 1;
      } else if (isRedo ? delta.id > revision : delta.id < revision) {
        return -1;
      }
    }
    return -1;
  }

  //Update value, the undomanager must not be active
  //Given an undomanager, try to update a session at revision = currentRev to match the revision of the undomanager.
  function trySyncContent(session, undoManager, currentRev) {
    entry('Syncing content from {currentRev} ...', currentRev);
    var stack = undoManager.$undoStack;
    if (isInvalid(stack)) return ERROR;
    var i = currentRev === 0 ? 0 : _findIndex(stack, currentRev);
    if (i > -1) {
      entry('Redoing ' + (stack.length - i) + ' changes');
      stack.slice(i).forEach(function (deltaSet) {
        session.redoChanges(deltaSet, true);
      });
      return SUCCESS;
    } else {
      stack = undoManager.$redoStack;
      if (isInvalid(stack)) return ERROR;
      i = _findIndex(stack, currentRev, true);
      if (i > -1) {
        entry('Undoing ' + (stack.length - i) + ' changes');
        stack.slice(i).forEach(function (deltaSet) {
          session.undoChanges(deltaSet, true);
        });
        return SUCCESS;
      }
    }
    entry(
      'Failed to find revision {currentRev} in {stack}',
      currentRev,
      undoManager.$undoStack
        .map(function (e) {
          return e[0].id;
        })
        .join(','),
    );
    return INCORRECT;
  }
  exports._debug = false;
  exports.limits = null; //Will be set by doc_persist
  exports.save = function (doc, keepContent) {
    context(doc);
    var obj = doc.serialize();
    //Truncate Undo History
    if (
      obj.history &&
      obj.history.undo &&
      obj.history.undo.length > this.limits.maxUndoHistory
    ) {
      entry('old size {history_len}', obj.history.length);
      entry('truncating obj.history');
      obj.history.undo = obj.history.undo.slice(
        obj.history.length - this.limits.maxUndoHistory,
      );
      entry('new size ' + obj.history.length);
    }
    entry('Serializing {id}...');
    var content;
    if (keepContent === undefined)
      keepContent =
        obj.content.length < exports.limits.maxDocDataSize / 10; //50kb
    //Compute checksum
    if (!keepContent) {
      content = obj.content;
      obj.checksum = doc.getChecksum(content);
      obj.content = null;
    }
    entry('{Action} content ..', keepContent ? 'Keeping' : 'Discarding');
    entry('Data has{hist} history', obj.history ? '' : ' no');

    //Shrink Data
    var res = exports.shrinkData(obj);
    if (res === false) {
      entry('Serialization failed. Data too large.');
      return false;
    } else if (keepContent) return res;
    else if (!obj.history) return res;
    //Try caching documents content
    var history = obj.history;
    var lastSave = hasBlob(doc.id, 'content');
    var cacheIndex = 0;
    if (lastSave) {
      //add 1 to index to make this falsy
      var info = getBlobInfo(lastSave);
      cacheIndex =
        -(_findIndex(history.undo, info.rev) + 1) ||
        _findIndex(history.redo, info.rev, true) + 1;

      var editDistance =
        cacheIndex > 0
          ? history.redo.length - cacheIndex
          : cacheIndex < 0
          ? history.undo.length + cacheIndex
          : Infinity;
      if (editDistance < 75) {
        entry('Reused last save');
        return res;
      }
    }
    if (
      (history.undo.length || history.redo.length) &&
      content.length < this.limits.maxDocDataSize / 2 //250kb
    ) {
      entry('Creating new save');
      setBlob(doc.id, 'content', content, {
        rev: doc.getRevision(),
        priority: CONTENT_PRIORITY,
      });
    } else if (cacheIndex !== 0) {
      entry('Forced to reuse last save');
      return res;
    } else if (!doc.isTemp() && doc.saveRev !== null) {
      //Ensure cache is still valid
      entry(
        'Using disk as cache with revision: {rev} checksum {check}',
        doc.saveRev,
        doc.getChecksum(),
      );
      if (
        _findIndex(history.undo, doc.saveRev) > -1 ||
        _findIndex(history.redo, doc.saveRev, true) > -1
      )
        return res;
    }
    entry('Failed to save content');
    return false;
  };
  exports.shrinkData = function (obj) {
    var targetSize = exports.limits.maxDocDataSize;
    var data = JSON.stringify(obj);
    while (data.length > targetSize) {
      if (obj.folds && obj.folds.length) obj.folds = [];
      else if (obj.history) {
        if (obj.history.undo.length > 1) {
          entry('Discarding some undos');
          obj.history.undo = obj.history.undo.slice(
            obj.history.undo.length / 2,
          );
        } else if (obj.history.undo && obj.history.undo.length == 1) {
          entry('Discarded all undos');
          obj.history.undo = [];
        } else if (
          obj.history.redo &&
          obj.history.redo.length &&
          !obj.checksum
        ) {
          entry('Discarded all history');
          obj.history = null;
        } else return false;
      } else return false; //whatever is keeping this doc from saving
      data = JSON.stringify(obj);
    }
    return data;
  };
  exports.$completeLoad = function (doc, res, currentRev) {
    var status = SUCCESS;
    entry('Attempting to load {id} at ' + currentRev);
    try {
      var um = doc.session.getUndoManager();
      if (um.$undoStack && um.$undoStack.length) {
        debug.warn('Discarding user history....');
        doc.clearHistory();
      }
      doc.setValue(res);
      status = trySyncContent(doc.session, doc.savedHistory, currentRev);
    } catch (e) {
      entry('Unknown error {error}', e.message);
      debug.log(e);
      //prevent user from triggering errors due to
      //bad history
      doc.clearHistory();
      status = ERROR;
    }
    if (doc.getChecksum() !== doc.savedState.checksum) {
      entry(
        'Incorrect checksum ' +
          doc.getChecksum() +
          ' instead of ' +
          doc.savedState.checksum,
      );
      status = status && INCORRECT;
    } else if (status === SUCCESS) {
      entry('success');
      var state = doc.savedState;
      doc.restoreView(state);
      doc.savedState = undefined;
      doc.setHistory(doc.savedHistory);
      doc.savedHistory = undefined;
    }
    return status;
  };
  exports.load = function (doc, obj) {
    context(doc);
    entry('Loading ' + doc.id);
    doc.$fromSerial = true;
    doc.unserialize(obj);
    doc.$fromSerial = false;
    if (!obj.checksum) return;
    //View and History are yet to be loaded
    doc.savedState = obj;
    doc.savedHistory = doc.createHistory(obj);
    var contentKey = hasBlob(doc.id, 'content');
    if (contentKey) {
      var info = getBlobInfo(contentKey);
      var content = getBlob(contentKey);
      if (content !== undefined) {
        doc.$fromSerial = true;
        if (!exports.$completeLoad(doc, content, info.rev))
          removeBlob(contentKey);
        doc.$fromSerial = false;
      }
    }
    entry('Waiting for refresh....');
    doc.$needsRefreshToCompleteLoad = !!doc.savedState; //removed on complete load success
  };
  exports.refresh = function (doc, res) {
    doc.$needsRefreshToCompleteLoad = undefined;
    if (doc.isLastSavedValue(res)) {
      entry('Reload from refresh');
      doc.$fromSerial = true;
      var result = exports.$completeLoad(doc, res, doc.saveRev);
      switch (result) {
        // @ts-ignore
        case ERROR:
          Notify.error('Error Loading ' + doc.getPath());
        /*fall through*/
        case INCORRECT:
          doc.savedState = doc.savedHistory = undefined;
          doc.setValue(res, true);
          break;
        case SUCCESS:
          if (doc.getRevision() != doc.saveRev) doc.setDirty(true);
          else doc.setClean();
          break;
      }
      doc.$fromSerial = false;
    } else {
      entry(
        'Failed to refresh because file changed from {res} to {res}',
        doc._LSC,
        doc.getChecksum(res),
      );
      doc.setValue(res, true);
    }
  };
  exports.canRecover = function (id) {
    return !!hasBlob(id, 'content');
  };
  exports.recover = function (id, doc) {
    var contentKey = hasBlob(id, 'content');
    var content = contentKey && getBlob(contentKey);
    if (content && content.length) {
      doc.setValue(content);
    }
  };
  //When dealing with remote changes, history saver does not need content or the complete undo history, just a common base revision.
  exports.onRemoteChange = function (doc, obj) {
    doc.$fromSerial = true;
    doc.unserialize(obj);
    doc.$fromSerial = false;
    if (!obj.checksum) return true;
    return syncRequire(['../ext/docs/doc_patch'], function (mod) {
      var um = doc.session.getUndoManager();
      var target = doc.createHistory(obj);
      var patch = mod.getPatch(um, target);
      if (!patch) {
        return Notify.warn('Document Synchronization Failed!!');
      }
      doc.$fromSerial = true;
      mod.applyPatch(patch, um, doc.session);
      doc.$fromSerial = false;
      um.$maxRev = target.$maxRev;
      obj.content = null;
      obj.history = null;
      doc.restoreView(obj);
      return true;
    });
  };
});