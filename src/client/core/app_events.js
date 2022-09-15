define(function (require, exports, module) {
  'use strict';
  //See FileUtils, ConfigEvents, ItemList for more events
  var EventsEmitter = require('./events_emitter').EventsEmitter;
  /**
   * @type {EventsEmitter & Any} 
   */
  var app = new EventsEmitter();
  app.checkEvents = true;
  // app._debug = true;
  app.paused = false;
  app.pause = function () {
    if (!this.paused) {
      this.paused = true;
      this.trigger('appPaused', null, true);
    }
  }.bind(app);
  app.resume = function () {
    if (this.paused) {
      this.paused = false;
      this.trigger('appResumed', null, true);
    }
  }.bind(app);
  window.addEventListener('focus', app.resume);
  window.addEventListener('blur', app.pause);
  window.addEventListener('beforeunload', app.pause);
  app._eventRegistry = {
    appLoaded: null, //once on first render
    appPaused: null, //app is possibly being minimized
    appResumed: null, //app is resumed from appPaused

    //core/file_servers.js
    registerFileServer: null,
    replaceFileServer: null,
    deleteFileServer: null,
    fileServersLoaded: null,

    //core/project_manager.js
    changeProject: null,
    renameProject: null,

    //docs/active_doc.js
    changeDoc: null, //active doc changed

    //docs/docs.js
    loadDoc: null, //document opened from cache
    openDoc: null, //opened new document
    deleteDoc: null, //deleted open document's file on filesystem
    renameDoc: null, //renamed open document's file on filesystem
    saveDoc: null, //about to save open document to filesystem
    closeDoc: null, //closed document
    docStatusChanged: null, //updated document state whether saved/unsaved; not necessarily changed
    documentsLoaded: null, //all cached documents have been loaded

    //editor/editors.js
    createEditor: null, //created new editor
    changeEditor: null, //active editor changed
    closeEditor: null, //closed editor
    editorThemeLoaded: null,

    //setup/setup_tab_host.js
    changeTab: null, //active tab changed
    closeTab: null, //user wants to close a tab
    tabClosed: null, //finished closing a tab

    //theme/theme.js
    themeChanged: null, //app theme change

    //setup/setup_root.js
    layoutChanged: null, //any layout change (does not include window resize)

    //ui/focus_manager.js
    keyboardChanged: null, //soft keyboard shown or hidden

    //setup/ext/index.js
    fullyLoaded: null, //all extensions have been started

    //ext/language/setup_services.js
    reloadProject: null, //User has requested a project reload
    pauseAutocomplete: null,
    resumeAutocomplete: null,
    trimServerMemory: null, //language servers restart in response to this event

    //ext/setup_sidenav.js
    sidenavOpened: null,
    sidenavClosed: null,

    //ext/switch_to_doc.js
    showDoc: null, //allows plugin editors to handle switching to document
    //setup/setup_menu_items
    showDocInfo: null, //add information about document to document info menu
  };
  exports.AppEvents = app;
});