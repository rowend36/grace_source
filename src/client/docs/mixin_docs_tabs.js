define(function (require, exports, module) {
  'use strict';
  var Utils = require('../core/utils').Utils;
  var modelist = require('ace!ext/modelist');
  var Doc = require('./document').Doc;
  var Docs = require('./docs_base').Docs;
  var Config = require('../core/config').Config;
  Config.registerAll(
    {
      defaultMode: 'auto',
      keepDocumentsOnClose: true,
      autoCloseDocs: true, //used by fileutils.opendoc
    },
    'documents',
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
  var $checkInit = require('./mixin_docs_persist').$checkInit;
  var persist = require('./mixin_docs_persist').persist;
  var loadDocs = require('./mixin_docs_persist').loadDocs;
  var appEvents = require('../core/app_events').AppEvents;
  var Notify = require('../ui/notify').Notify;
  var debug = console;

  var tabRef = getPersistentRef('tabs');
  var finishedLoad = false;
  exports.initialize = function () {
    Tabs.registerPopulator('m', Docs);
    appEvents.on('changeTab', function (e) {
      if (Docs.has(e.tab)) {
        var doc = Docs.get(e.tab);
        if (!doc.hasRef(tabRef)) {
          openDoc(null, doc, null, {select: false, save: false});
        }
      }
    });
    loadDocs(Tabs.activeStore.get(), function afterLoad() {
      finishedLoad = true;
      Tabs.recreate();
      if (Tabs.numTabs() < 1) {
        openDoc('welcome', 'Welcome To Grace Editor', {
          select: false, //In case the active tab later gets loaded
          autoClose: true,
        });
        Tabs.updateActive();
      }
      appEvents.triggerForever('documentsLoaded'); //put here for convenience should be in persist
    });
    //Render any tabs that have been loaded.
    //The active tab hint passed tries to ensure the
    //active tab is loaded synchronously.
    if (!finishedLoad && Docs.numDocs() > 0) Tabs.recreate();
  };
  appEvents.on('loadDoc', function (ev) {
    if (Tabs.isSavedTab(ev.doc.id)) {
      openDoc('', ev.doc, {select: false, isLoading: true, save: false});
      if (finishedLoad) Tabs.recreate();
    }
  });
  appEvents.on('renameDoc', function (ev) {
    var id = ev.doc.id;
    Tabs.setName(id, Docs.getName(id));
  });

  appEvents.on('closeTab', function (ev) {
    var doc = Docs.get(ev.tab);
    if (!doc) return;
    if (doc.dirty) {
      ev.stopPropagation();
      ev.await('close-without-saving-' + doc.saveRev, function (resume) {
        Notify.ask(
          Docs.getName(doc.id) + ' has unsaved changes. Close without saving?',
          resume,
        );
      });
    }
  });
  exports.closeSession = function (session) {
    var doc = Docs.forSession(session);
    if (doc) doc.closeSession(session);
  };
  exports.closeDoc = function (docId, keepUndos) {
    var doc = Docs.get(docId);
    if (!doc) return;
    if (keepUndos === undefined)
      keepUndos =
        doc.hasRef(tabRef) &&
        Config.forPath(doc.getSavePath(), 'documents', 'keepDocumentsOnClose');
    if (keepUndos) stashDoc(docId);
    if (doc.hasRef(tabRef)) {
      doc.unref(tabRef);
      try {
        appEvents.trigger('closeDoc', {doc: doc}, true);
      } catch (e) {
        debug.error(e);
      }
    }
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
      save = !opts.isLoading;
    }
    var doc;
    //main use openDoc(name,doc,path,opts)
    //filebrowser openDoc(name,content,path)
    if (content && typeof content == 'object') {
      doc = content;
      content = undefined;
      path = doc.getSavePath();
      if (!doc.options.mode) {
        mode = exports.autoMode(path || name || '');
        if (mode != 'ace/mode/text') doc.session.setMode(mode);
      }
    } else {
      if (!mode) mode = exports.autoMode(path || name || '');
      doc = new Doc(content, path, mode);
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
      $checkInit(doc);
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
      grp.once('changeTab', clear); //This should depend on whether the tab is a new tab
      grp.on('closeDoc', function (e) {
        if (e.doc == doc) clear();
      });
      //Used by filebrowser when opening multiple docs
      doc.$removeAutoClose = clear;
    }
    return doc.id;
  }
  exports.openDoc = openDoc;
  exports.autoMode = function (path) {
    var mode = Config.forPath(path, 'documents', 'defaultMode');
    if (mode === 'auto') return modelist.getModeForPath(path || '').mode;
    else if (mode.indexOf('/') < 0) return 'ace/mode/' + mode;
    else return mode;
  };

  //Tabs
  exports.addTabAnnotation = function (id, anno) {
    Tabs.addAnnotation(id, anno);
  };
  exports.removeTabAnnotation = function (id, anno) {
    Tabs.removeAnnotation(id, anno);
  };

  //TabHolder interface
  //Docs_base implements Docs.getName
  exports.getAnnotations = function (id) {
    return Tabs.getAnnotations(id);
  };
  exports.canDiscard = function (id) {
    //If not loaded in this session, we can safely discard
    return finishedLoad && !$isPending(id);
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