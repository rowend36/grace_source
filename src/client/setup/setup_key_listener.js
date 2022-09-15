define(function (require, exports, module) {
  var event = require('ace!lib/event');
  var getEditor = require('./setup_editors').getEditor;
  var keys = require('ace!lib/keys');
  var FocusManager = require('../ui/focus_manager').FocusManager;
  exports.addListener = function (target, capture) {
    if (capture) {
      target.addEventListener('keydown', captureEvent, {
        passive: true,
        capture: true,
      });
    } else event.addCommandKeyListener(target, handleEvent);
  };
  function captureEvent(e) {
    var hashId = event.getModifierString(e);
    var keyCode = e.keyCode;
    handleEvent(e, hashId, keyCode);
  }
  /**This class is tied to Editor for simplicity.
  The alternative is to add a new hash handler
  */
  var CONTEXT = {};
  function ensureContext(e) {
    if (e.args === CONTEXT) {
      if (!e.command.hasOwnProperty('context')) {
        //Not an action
        event.stopEvent(e);
        return false;
      }
      if (e.command.passEvent != true) CONTEXT.stopEvent = true;
    }
  }
  var currentEvent;
  function handleEvent(e, hashId, keyCode) {
    var editor = getEditor();
    if (e.target === editor.textInput.getElement()) return;
    else if (hashId === -1 && FocusManager.isFocusable(e.target)) {
      return;
    }
    editor.commands.on('exec', ensureContext);
    var keyString = keys.keyCodeToString(keyCode);
    try {
      CONTEXT.stopEvent = false;
      var handlers = [editor.commands, editor.keyBinding.$userKbHandler]; //filter handlers that can actually have actions
      var commands = editor.commands;
      for (var i = handlers.length; i-- > 0; ) {
        var toExecute =
          handlers[i] &&
          handlers[i].handleKeyboard(CONTEXT, hashId, keyString, keyCode, e);
        if (
          toExecute &&
          toExecute.command &&
          (toExecute.command === 'null' ||
            commands.exec(toExecute.command, editor, CONTEXT))
        ) {
          if (e && hashId != -1 && CONTEXT.stopEvent) {
            event.stopEvent(e);
          }
          break;
        }
      }
    } finally {
      currentEvent = null;
      editor.commands.off('exec', ensureContext); //not needed most of the time
    }
  }
  exports.getEvent = function () {
    return currentEvent;
  };
  //Listen to events from the window
  exports.addListener(window);
});