define(function (require, exports, module) {
  'use strict';
  var Docs = require('grace/docs/docs').Docs;
  var State = require('grace/setup/setup_state').State;
  var appEvents = require('grace/core/app_events').AppEvents;
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var uiConfig = require('grace/core/config').Config.registerAll(null, 'ui');
  var openDoc = require('grace/docs/docs').openDoc;
  var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var Notify = require('grace/ui/notify').Notify;
  var setTab = require('grace/setup/setup_tab_host').setTab;

  /*
   * @method switchToDoc
   * Switch to a document
   * @param {String} name Path to the document
   * @param {Object} [pos] Selection start or cursor position
   * @param {Object} [end] Selection end
   * @param {EditSession|String|Boolean|undefined} [autoload] How to handle path not found
   * @param {Function(err?: Error, editor:Editor)} [callback]
   * @param {FileServer} [server] The server to use in loading the file
   * @related FileUtils#openDoc
   * @related FileUtils#getDoc
   */
  exports.switchToDoc = function switchToDoc(
    name,
    pos,
    end,
    autoLoad,
    cb,
    server
  ) {
    var doc, session, text;
    if (autoLoad && typeof autoLoad == 'object') {
      //autoload is a session
      session = autoLoad;
      autoLoad = undefined;
      doc = Docs.forSession(autoLoad);
    } else if (typeof autoLoad == 'string') {
      text = autoLoad;
      autoLoad = undefined;
    }
    if (!doc)
      doc = Docs.forPath(name, server) || Docs.forPath('/' + name, server);

    if (!doc) {
      var servers;
      if (server) {
        servers = [server];
      } else {
        var mainDoc = getActiveDoc();
        servers = [FileUtils.getProject().fileServer];
        if (mainDoc && mainDoc.getFileServer() != servers[0]) {
          servers.unshift(mainDoc.getFileServer());
        }
      }
      if (text || session) {
        if (session) text = session.getValue();
        doc = Docs.get(
          openDoc(null, text, name, {
            fileServer: servers[0].id,
          })
        );
        doc.setDirty();
        doc.refresh();
      } else {
        if (autoLoad === false) return cb(null, null);
        var tryGetFile = function (err) {
          var server = servers.pop();
          if (!server) return cb(err, null);
          FileUtils.openDoc('/' + name, server, function (err, doc) {
            if (doc) switchToDoc(doc.getPath(), pos, end, null, cb, server);
            else tryGetFile(err);
          });
        };
        return autoLoad ? tryGetFile() : Notify.ask('Open ' + name, tryGetFile);
      }
    }
    appEvents.trigger('showDoc', {
      doc: doc,
    }); //Give plugins a chance to handle this

    if (Docs.forSession(edit.session) !== doc) setTab(doc.id);
    State.ensure(uiConfig.disableBackButtonTabSwitch ? 'tabs' : doc.id);
    if (Docs.forSession(edit.session) !== doc) return cb(null, null);
    var edit = getEditor();
    if (pos) {
      edit.exitMultiSelectMode && edit.exitMultiSelectMode();
      edit.getSession().unfold(pos); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
      var sel = edit.getSelection();
      if (end) {
        edit.getSession().unfold(end); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
        sel.setSelectionRange({
          start: pos,
          end: end,
        });
      } else {
        sel.moveCursorToPosition(pos);
      }
      edit.centerSelection();
    }
    doc.$removeAutoClose();
    cb && cb(null, edit);
  };
});