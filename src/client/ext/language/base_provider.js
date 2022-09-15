define(function (require, exports, module) {
  'use strict';
  var ServerHost = require('grace/ext/language/server_host').ServerHost;
  var Utils = require('grace/core/utils').Utils;
  var Docs = require('grace/docs/docs').Docs;
  var appEvents = require('grace/core/app_events').AppEvents;
  var Provider = require('grace/core/registry').Provider;
  function BaseProvider(name, modes) {
    BaseProvider.super(this, [name, modes]);
  }
  Utils.inherits(BaseProvider, Provider);

  /**
   * @function
   * @param {Editor} editor
   * @param {Function} cb
   * Create a client for this editor and invoke the callback with the instance.
   * Implementations should call attachToEditor to prevent memory leaks.
   * Warning: this method can be called multiple times.
   *
   */
  BaseProvider.prototype.init = Utils.noop;
  BaseProvider.prototype.attachToEditor = function (editor, instance, cb) {
    if (editor[this.name]) cb(editor[this.name]);
    var self = this;
    var name = instance.name;
    var grp = Utils.groupEvents();
    editor[this.name] = instance;
    if (instance.once) {
      grp.once(
        'destroy',
        function () {
          if (editor[name] == instance) editor[name] = null;
        },
        instance,
      );
    }
    grp.once(
      'destroy',
      function () {
        if (editor[name] == instance) editor[name] = null;
        if (instance !== self.instance) {
          self.destroy(instance);
        }
      },
      editor,
    );
    cb(instance);
  };

  /**
   * Tells the provider to destroy this instance.
   * When when no instance is passed, release all
   * internal memory.
   */
  BaseProvider.prototype.destroy = function (instance) {
    if (!instance) {
      if (!this.instance) return;
      instance = this.instance;
      this.instance = null;
    } else if (instance == this.instance) {
      this.instance = null;
    }
    for (var i in instance.docs) {
      instance.closeDoc(i);
    }
    instance.trigger('destroy');
    instance.destroy();
  };

  /** This is used to set a property on the editor e.g editor.baseClient */
  BaseProvider.prototype.name = 'baseClient';

  BaseProvider.prototype.addDocToInstance = function (doc) {
    var mode = doc.session.getModeName();
    if (this.instance && this.modes.indexOf(mode) > -1) {
      this.instance.addDoc(doc.getPath(), doc.session);
    }
  };
  /**
   * Used to automatically reregister this provider by
   * setupLifeCycle
   */
  BaseProvider.prototype.isEnabled = function () {
    return true;
  };
  //used by BaseClient.js
  BaseProvider.prototype.options = ServerHost;

  //Allow this provider to be used in the presence of other providers.
  BaseProvider.prototype.isSupport = false;

  //Provider has .getCompletions
  BaseProvider.prototype.hasCompletions = true;
  //completion provider interface
  BaseProvider.prototype.hasKeyWords = false;
  BaseProvider.prototype.hasStrings = false;
  BaseProvider.prototype.hasText = false;
  BaseProvider.prototype.embeddable = false;
  BaseProvider.prototype.priority = 1;

  //Provider has .updateAnnotations
  BaseProvider.prototype.hasAnnotations = false;
  
  
  //Provider has .jumpToDef, .jumpBack and .markPos
  BaseProvider.prototype.hasDefinitions = true;
  //Provider has .showType
  BaseProvider.prototype.hasTypeInformation = true;
  //Provider has .findRefs
  BaseProvider.prototype.hasReferences = true;
  //Provider has .rename
  BaseProvider.prototype.hasRename = false;

  //Set to true if instance has .updateArgHints
  BaseProvider.prototype.hasArgHints = false;
  
  //Set to true if instance has .format
  BaseProvider.prototype.hasFormatting = false;


  //Common setup methods
  BaseProvider.addDocumentsOnOpen = function (provider) {
    if (!provider) throw 'Missing argument provider';
    appEvents.on(
      'openDoc',
      function (e) {
        this.addDocToInstance(e.doc);
      }.bind(provider),
    );
    provider.$addDocumentsOnRestart = true;
  };
  BaseProvider.setupLifeCycle = function (provider) {
    if (!provider) throw 'Missing argument provider';
    appEvents.on(
      'pauseAutocomplete',
      function () {
        ServerHost.toggleProvider(this, ['javascript', 'html'], false);
        this.destroy();
      }.bind(provider),
    );
    appEvents.on(
      'resumeAutocomplete',
      function () {
        ServerHost.toggleProvider(this, this.modes, this.isEnabled());
        if (this.$addDocumentsOnRestart) {
          Docs.forEach(this.addDocToInstance.bind(this));
        }
      }.bind(provider),
    );
  };
  BaseProvider.keepDocumentsOnClose = function (provider, yes) {
    if (!provider) throw 'Missing argument provider';
    appEvents.on(
      'closeDoc',
      function (e) {
        var doc = e.doc;
        if (!this.instance) return;
        var data = this.instance.hasDoc(doc.session);
        if (data) this.instance.closeDoc(data.name);
        if (yes && data && doc.getSize() < 1000000) {
          if (doc.getSavePath()) {
            this.instance.addDoc(doc.getSavePath(), doc.getValue());
            ServerHost.$fileLoader.increment(e.doc.getSize());
            ServerHost.$watchMemory();
          }
        }
      }.bind(provider),
    );
  };

  exports.BaseProvider = BaseProvider;
});