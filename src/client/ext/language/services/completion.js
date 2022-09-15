define(function (require, exports, module) {
  'use strict';
  var Editor = require('ace!editor').Editor;
  var Editors = require('grace/editor/editors').Editors;
  var Utils = require('grace/core/utils').Utils;
  require('../misc/basic_completion');
  var Autocomplete = require('ace!autocomplete').Autocomplete;
  var completionProviders = new (require('grace/core/registry').Registry)(
    'getCompletions',
    'intellisense.completion',
  );
  var languageTools = require('ace!ext/language_tools');
  /*Currently Completion ignores the fact that all Editors share the same completion object by updating completers before each completion.
  However this will not work for stuff like enable_basic_completion/enable_snippets.
  */
  exports.registerCompletionProvider = completionProviders.register;
  exports.unregisterCompletionProvider = completionProviders.unregister;
  exports.getCompletionProviderByName = completionProviders.byName;

  Editor.prototype.getMainCompleter = function () {
    var m = this.$activeProviders && this.$activeProviders[0];
    return m && this[m.name];
  };

  var _hasTriggerRegex = function (e) {
    var m = this[e.name];
    if (m && e.triggerRegex) {
      var pos = this.getSelectionRange().end;
      if (
        e.triggerRegex.test(
          this.session.getLine(pos.row).substring(0, pos.column),
        )
      )
        return m;
    }
  };
  var onAfterExec = function (e /*, commandManager*/) {
    if (e.command.name === 'insertstring') {
      var editor = e.editor;
      var hasCompleter = editor.completer && editor.completer.activated;
      if (hasCompleter) return;
      var pos = editor.getSelectionRange().end;
      var tok = editor.session.getTokenAt(pos.row, pos.column);
      if (!tok || /string|comment/.test(tok.type.toString())) return;
      updateCompleters(editor);
      var completers = editor.$activeProviders
        .map(_hasTriggerRegex, editor)
        .filter(Boolean);
      if (completers.length < 1) return;
      if(editor.$enableBasicAutocompletion){
        completers.unshift(languageTools.textCompleter);
      }
      try {
        editor.$inDotCompletion = true;
        var initial = editor.completers;
        editor.completers = completers;
        editor.execCommand('startAutocomplete');
      } finally {
        editor.completers = initial;
        editor.$inDotCompletion = false;
      }
    }
  };

  var getActiveHandlers = completionProviders.getActive;
  function disableProvider(editor, p) {
    if (Utils.removeFrom(editor.$activeProviders, p) < 0)
      Utils.removeFrom(editor.completers, editor[p.name]);
  }
  function addCompleter(editor, e) {
    if (editor.completers.indexOf(e) < 0) editor.completers.push(e);
  }
  function updateCompleters(editor) {
    if (editor.$inDotCompletion) return true;
    //TODO can we cheaply memoize the result of this call based on editor session, mode and registered providers???
    var mode = editor.session.getInnerMode();
    var active = editor.$activeProviders || (editor.$activeProviders = []);
    var toEnable = editor.$enableIntelligentAutocompletion
      ? getActiveHandlers(editor, mode)
      : [];
    active
      .filter(Utils.notIn(toEnable))
      .forEach(disableProvider.bind(null, editor));
    var hasMain;
    toEnable.forEach(function (provider) {
      if (hasMain && !provider.isSupport) {
        return disableProvider(editor, provider);
      }
      hasMain = hasMain || !provider.isSupport;
      if (active.indexOf(provider) < 0) {
        active.push(provider);
      }
      if (editor[provider.name]) {
        addCompleter(editor, editor[provider.name]);
      } else {
        provider.init(editor, function (instance) {
          if (!instance) return;
          if (active.indexOf(provider) > -1) {
            addCompleter(editor, instance);
          }
        });
      }
    });
    return true; //because we are overriding isAvailable
  }

  //Piggy back this check
  Autocomplete.startCommand.isAvailable = updateCompleters;
  var EditorSettings = Editors.getSettingsEditor();
  EditorSettings.addOption('enableIntelligentAutocompletion', {
    set: function (val) {
      if (val) {
        if (this.$inDotCompletion === undefined) this.$inDotCompletion = false;
        this.commands.on('afterExec', onAfterExec);
        updateCompleters(this); //startup completers that need init.
        if (!this.$enableBasicAutocompletion) {
          this.commands.addCommand(Autocomplete.startCommand);
        }
      } else {
        this.commands.off('afterExec', onAfterExec);
        updateCompleters(this);
        if (!this.$enableBasicAutocompletion) {
          this.commands.removeCommand(Autocomplete.startCommand);
        }
      }
    },
    value: true,
  });
});