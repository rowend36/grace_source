define(function (require, exports, module) {
  'use strict';
  var Utils = require('../core/utils').Utils;
  var modelist = ace.require('ace/ext/modelist');
  var Doc = require('./document').Doc;
  var Docs = require('./docs_base').Docs;
  var Config = require('../core/config').Config;
  Config.registerAll(
    {
      defaultMode: 'auto',
      keepDocumentsOnClose: true,
      autoCloseDocs: true, //used by fileutils.opendoc
    },
    'documents'
  );
  Config.registerInfo({
    defaultMode: {
      doc: 'Sets the default file type. Uses resource context.',
      type: '[auto]|mode',
    },
    keepDocumentsOnClose:
      'Allows the editor to save your undo history when a document is closed. Uses resource context.',
  });
  var $isPending = require('./mixin_docs_persist').$isPending;
  var getPersistentRef = require('./mixin_docs_persist').getPersistentRef;
  var Tabs = require('../setup/setup_tab_host').DocsTab;
  var stashDoc = require('./mixin_docs_persist').stashDoc;
  var restoreStash = require('./mixin_docs_persist').restoreStash;
  var persist = require('./mixin_docs_persist').persist;
  var fromJSON = require('./mixin_docs_persist').fromJSON;
  var appEvents = require('../core/app_events').AppEvents;
  var debug = console;
  appEvents.on('renameDoc', function (ev) {
    var id = ev.doc.id;
    Tabs.setName(id, Docs.getName(id));
  });
  var finishedLoad = false;

  appEvents.on('loadDoc', function (ev) {
    if (Tabs.isSavedTab(ev.doc.id)) {
      openDoc('', ev.doc, {select: false, noSave: true});
      if (finishedLoad) Tabs.recreate();
    }
  });
  exports.initialize = function () {
    Tabs.registerPopulator('m', Docs);
    fromJSON(null, Tabs.active, function () {
      if (Tabs.numTabs() < 1) {
        openDoc('welcome', 'Welcome To Grace Editor', {
          select: false,
          autoClose: true,
        });
      }
      appEvents.triggerForever('documentsLoaded');
      Tabs.recreate();
      finishedLoad = true;
    });

    //Render any tabs that have been loaded.
    //The active tab hint passed tries to ensure the
    //active tab is loaded synchronously.
    if (Docs.numDocs() > 0) Tabs.recreate();
  };
  var tabRef = getPersistentRef('tabs');
  exports.closeSession = function (session) {
    var doc = Docs.forSession(session);
    doc.closeSession(session);
  };
  exports.closeDoc = function (docId, keepUndos) {
    var doc = Docs.get(docId);
    if (!doc) return;
    if (doc.hasRef(tabRef)) {
      if (keepUndos === undefined)
        keepUndos = Config.forPath(
          doc.getSavePath(),
          'documents',
          'keepDocumentsOnClose'
        );
      if (keepUndos) {
        stashDoc(docId);
      }
      doc.unref(tabRef);
      try {
        appEvents.trigger('closeDoc', {doc: doc}, true);
      } catch (e) {
        debug.error(e);
      }
      doc.session.getDocument().off('change', doc.onChange);
      doc.session.off("changeMode'", doc.syncMode);
    }
  };

  //Tabs
  exports.addTabAnnotation = function (id, anno) {
    Tabs.addAnnotation(id, anno);
  };
  exports.removeTabAnnotation = function (id, anno) {
    Tabs.removeAnnotation(id, anno);
  };
  exports.autoMode = function (path) {
    var mode = Config.forPath(path, 'documents', 'defaultMode');
    if (mode === 'auto') return modelist.getModeForPath(path || '').mode;
    else if (mode.indexOf('/') < 0) return 'ace/mode/' + mode;
  };
  function openDoc(name, content /*:string|Doc*/, path /*:string?*/, opts) {
    var mode,
      select = true,
      save = true,
      autoClose = false;
    if (path && typeof path == 'object') {
      opts = path;
      path = undefined;
    }
    if (opts) {
      if (opts.mode) mode = opts.mode;
      autoClose = opts.autoClose;
      if (opts.hasOwnProperty('select')) select = opts.select;
      save = !opts.noSave;
    }
    var doc;
    //use cases in searchtab openDoc(,doc,path)
    //main use openDoc(,doc,path,mode)
    //filebrowser openDoc(n,c,p)
    if (content && typeof content == 'object') {
      doc = content;
      content = undefined;
      path = doc.getSavePath();
      if (!doc.options.mode) {
        mode = exports.autoMode(path || name || '');
        if (mode.name != 'text') doc.session.setMode(mode);
      }
    } else {
      if (!mode) mode = exports.autoMode(path || name || '');
      doc = new Doc(content, path, mode);
    }
    if (!doc.session.$undoManager) {
      //Can happen if document is still being loaded
      doc.session.setUndoManager(new ace.UndoManager());
    }
    if (opts && opts.fileServer) {
      doc.fileServer = opts.fileServer;
    }
    if (opts && opts.encoding) {
      doc.encoding = opts.encoding;
    }
    if (!doc.getPath()) {
      debug.error('Bad factory: path cannot be null');
      doc.setPath(null);
    }
    //Don't add loading documents, see TabHost#recreate
    if (!Tabs.isSavedTab(doc.id)) {
      if (!name) {
        name = Docs.getName(doc.id);
      }
      Tabs.addTab(doc.id, name, doc.annotations);
    }
    if (save) persist();
    if (!doc.hasRef(tabRef)) {
      if (!Tabs.isSavedTab(doc.id)) if (path) restoreStash(path, doc);
      doc.onChange = Doc.prototype.onChange.bind(doc);
      doc.syncMode = Doc.prototype.syncMode.bind(doc);
      doc.session.getDocument().on('change', doc.onChange);
      doc.session.on('changeMode', doc.syncMode);
      doc.session.once('destroy', function (e, session) {
        session.off('changeMode', doc.syncMode);
        if (doc.hasRef(tabRef)) {
          Utils.assert(
            doc.session !== session,
            'Destroying session while doc is still open'
          );
          doc.session.on('changeMode', doc.syncMode);
        }
      });
      doc.ref(tabRef);
      //the doc must be already bound for this event to be handled correctly
      appEvents.trigger('openDoc', {doc: doc});
    }
    //this is usually a valid assumption
    if (content !== undefined && path) doc.setClean();
    if (select) {
      Tabs.setActive(doc.id, true, true);
    }
    if (autoClose) {
      var grp = Utils.groupEvents(appEvents);

      var clear = function () {
        if (doc.$fromStash) return;
        grp.off();
        doc.$removeAutoClose = null;
      };
      grp.once('openDoc', function remove() {
        Tabs.onClose(doc.id);
      });
      grp.once('change', clear, doc.session);
      grp.once('changeSelection', clear, doc.session.selection);
      grp.once('changeTab', clear);
      grp.on('closeDoc', function (e) {
        if (e.doc == doc) {
          clear();
        }
      });
      //Used by filebrowser when opening multiple docs
      doc.$removeAutoClose = clear;
    }
    return doc.id;
  }
  exports.openDoc = openDoc;

  //TabHolder interface
  //Docs.getName

  exports.getAnnotations = function (id) {
    return Tabs.getAnnotations(id);
  };
  exports.canDiscard = function (id) {
    //If not loaded in this session, we can safely discard
    return !$isPending(id);
  };
  exports.getInfo = function (id) {
    if (!Docs.has(id)) return null;
    if (!Docs.get(id).getSavePath()) {
      return '<i>' + id + '</i>';
    }
    return Utils.htmlEncode(Docs.get(id).getSavePath());
    //+"<i class='right' style='text-transform:uppercase'>"+docs[id].getEncoding()+"</i>";
  };
});