define(function (require, exports, module) {
  var setBlob = require('./mixin_docs_blob').setBlob;
  var getBlob = require('./mixin_docs_blob').getBlob;
  var Range = ace.require('ace/range').Range;
  var getBlobInfo = require('./mixin_docs_blob').getBlobInfo;
  var hasBlob = require('./mixin_docs_blob').hasBlob;
  var Notify = require('../ui/notify').Notify;
  var CONTENT_PRIORITY = 10;
  var debug = console;
  function isInvalid(deltas) {
    var uniq = {};
    for (var i = deltas.length; i-- > 0; ) {
      var d = deltas[i][0];
      if (!d) return [i, 'Empty delta in undos'];
      if (uniq[d.id]) return [i, 'Duplicate id in undos ' + d.id];
      else uniq[d.id] = true;
    }
    return false;
  }
  var INCORRECT = null; //revision not on stack
  var SUCCESS = true;
  var ERROR = false; //stack is invalid
  /**
    The History Saver uses a revision and the content of that revision
    to update the value of a session reducing how often we have to save
    the entire content.
  */
  function _findIndex(stack, revision, isRedo) {
    for (var i = stack.length; i--; ) {
      var delta = stack[i][0];
      if (delta.id == revision) {
        return isRedo ? i : i + 1;
      } else if (isRedo ? delta.id > revision : delta.id < revision) {
        return -1;
      }
    }
    return -1;
  }

  //Update value, the undomanager must not be active
  function tryUpdateContent(session, undoManager, currentRev) {
    var stack = undoManager.$undoStack;
    if (isInvalid(stack)) return ERROR;
    var i = currentRev === 0 ? 0 : _findIndex(stack, currentRev);
    if (i > -1) {
      stack.slice(i).forEach(function (deltaSet) {
        session.redoChanges(deltaSet, true);
      });
      return SUCCESS;
    } else {
      stack = undoManager.$redoStack;
      if (isInvalid(stack)) return ERROR;
      i = _findIndex(stack, currentRev, true);
      if (i > -1) {
        stack.slice(i).forEach(function (deltaSet) {
          session.undoChanges(deltaSet, true);
        });
        return SUCCESS;
      }
    }
    return INCORRECT;
  }

  var historySaver = {
    limits: null,
    save: function (doc) {
      var obj = doc.serialize();
      if (
        obj.history &&
        obj.history.undo &&
        obj.history.undo.length > this.limits.maxUndoHistory
      ) {
        obj.history.undo = obj.history.undo.slice(-this.limits.maxUndoHistory);
      }
      if (doc.isTemp() || doc.getSize() < this.limits.maxDocCacheSize)
        return obj;
      obj.checksum = doc.getChecksum(obj.content);
      var content = obj.content;
      obj.content = null;
      //Try saving documents content
      if (
        obj.history &&
        (obj.history.undo.length || obj.history.redo.length) &&
        content.length < this.limits.maxDocDataSize / 2
      ) {
        var lastSave = hasBlob(doc.id, 'content');
        if (lastSave) {
          //Between 15 and 75 revisions
          var maxDeviation = Math.min(
            Math.max(
              15,
              obj.history.redo.length / 5,
              obj.history.undo.length / 5
            ),
            75
          );
          var a = getBlobInfo(lastSave);
          if (Math.abs(a.rev - doc.getRevision()) < maxDeviation) return obj;
        }
        setBlob(doc.id, 'content', content, {
          rev: doc.getRevision(),
          priority: CONTENT_PRIORITY,
        });
      }
      return obj;
    },
    $completeLoad: function (doc, res, currentRev) {
      var status = SUCCESS;
      try {
        status = tryUpdateContent(doc.session, doc.savedUndos, currentRev);
      } catch (e) {
        debug.log(e);
        //prevent user from triggering errors due to
        //bad history
        doc.clearHistory();
        status = ERROR;
      }
      if (doc.getChecksum() !== doc.savedState.checksum) {
        status = INCORRECT;
      } else if (status === SUCCESS) {
        var state = doc.savedState;
        doc.restoreView(state);
        doc.session.setUndoManager(doc.savedUndos);
      }
      return status;
    },
    load: function (doc, obj) {
      if (!obj.checksum) {
        doc.unserialize(obj);
        return;
      }
      doc.savedState = obj;
      doc.savedUndos = doc.createUndoManager(obj);
      var contentKey = hasBlob(doc.id, 'content');
      if (contentKey) {
        var info = getBlobInfo(contentKey);
        var content = getBlob(contentKey);
        if (content !== undefined) {
          doc.$fromSerial = true;
          if (historySaver.$completeLoad(doc, content, info.rev)) {
            doc.savedUndos = undefined;
            doc.savedState = undefined;
            doc.$fromSerial = false;
          }
          doc.$fromSerial = false;
        }
      } else doc.$needsRefreshToCompleteLoad = true;
    },
    refresh: function (doc, res) {
      if (doc.isLastSavedValue(res)) {
        doc.$fromSerial = true;
        var result = historySaver.$completeLoad(doc, res, doc.lastSave);
        switch (result) {
          case ERROR:
            Notify.error('Error Loading ' + doc.getPath());
          /*fall through*/
          case INCORRECT:
            doc.setValue(res, true);
            break;
          case SUCCESS:
            if (doc.getRevision() != doc.lastSave) doc.setDirty(true);
            else doc.setClean();
            break;
        }
        doc.$fromSerial = false;
      } else {
        doc.setValue(res, true);
      }
      doc.$needsRefreshToCompleteLoad = doc.savedState = doc.savedUndos = undefined;
    },
    canRecover: function (id) {
      return !!hasBlob(id, 'content');
    },
    recover: function (id, doc) {
      var contentKey = hasBlob(id, 'content');
      var content = getBlob(contentKey);
      if (content && content.length) {
        doc.setValue(content);
      }
    },
    onRemoteChange: function (doc, obj) {
      // if (!obj.checksum) {
      //   doc.$fromSerial = true;
      //   doc.unserialize(obj);
      //   doc.$fromSerial = false;
      //   return true;
      // }
      var um = doc.session.getUndoManager();
      var target = doc.createUndoManager(obj);
      var src = um.$undoStack;
      if (um.$redoStackBaseRev === um.$rev) {
        src = src.concat(um.$redoStack.slice().reverse());
      }

      var u2 = target.$undoStack;
      do {
        //find base rev
        for (var i = src.length - 1, j = u2.length - 1; i > -1 && j > -1; ) {
          if (src[i].id < u2[j].id) j--;
          else if (src[i].id > u2[j].id) i--;
          else if (src[i].rev != u2[i].rev) i--;
          else break;
        }
        if (i > -1 && j > -1) {
          var base = src[i];
          var backup = doc.serialize();
          for (; i < um.$undoStack.length - 1; ) if (!um.undo()) break;
          for (; i > um.$undoStack.length - 1; ) if (!um.redo()) break;

          if (um[um.$undoStack.length - 1] === base) {
            var result = tryUpdateContent(doc.session, target, base.id);
            if (result === SUCCESS) {
              obj.content = null;
              obj.history = null;
              doc.unserialize(obj);
              doc.session.setUndoManager(target);
              return true;
            } else doc.unserialize(backup);
            break;
          }
          if (u2 === target.$redoStack) break;
          u2 = target.$redoStack;
        }
      } while (true);
      Notify.warn('Document Synchronization Failed!!');
    },
  };
  module.exports = historySaver;
});