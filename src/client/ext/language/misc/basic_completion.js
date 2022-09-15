define(function (require, exports, module) {
  'use strict';
  var appEvents = require('grace/core/app_events').AppEvents;
  var Settings = require('grace/editor/editors').Editors.getSettingsEditor();
  var languageTools = require('ace!ext/language_tools');
  languageTools.textCompleter.name = 'Word Completer';
  languageTools.keyWordCompleter.name = 'Keywords';
  languageTools.snippetCompleter.name = 'Snippets';

  exports.addCompleter = languageTools.addCompleter;
  exports.removeCompleter = languageTools.removeCompleter;
  var getActiveEditor = require('grace/setup/setup_editors').getEditor;

  var FocusManager = require('grace/ui/focus_manager').FocusManager;
  var AutoComplete = require('ace!autocomplete').Autocomplete;

  //Reduce number of event listeners by attaching this to the active editor
  var doBlur = AutoComplete.prototype.blurListener;
  //Don't lose autocomplete when trapping focus
  AutoComplete.prototype.blurListener = function () {
    if (FocusManager.activeElement == getActiveEditor().textInput.getElement())
      return;
    doBlur.apply(this, arguments);
  };
  //Automatically hide popups when kb is hidden
  appEvents.on('keyboardChanged', function (ev) {
    if (ev.isTrusted && !ev.visible) {
      var a = AutoComplete.for(getActiveEditor());
      if (a.activated) a.detach();
    }
  });
  
  var Editor = require('ace!editor').Editor;
  //Hack to ensure that this is true for editors created with Editors.createEditor only.
  Editor.prototype.$options.enableAutocompletion.value = true;
  Settings.addOption('enableAutocompletion');
  Settings.addOption('enableBasicAutocompletion');
  Editor.prototype.$options.enableAutocompletion.value = false;
  Settings.addOption('enableSnippets');
  Settings.addOption('enableLiveAutocompletion');
  Settings.addOption('enableTabCompletion');
  Settings.addOption('enableCompletionTooltips');
});