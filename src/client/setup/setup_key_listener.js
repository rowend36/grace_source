define(function (require, exports, module) {
  var event = require('ace!lib/event');
  var getEditor = require('./setup_editors').getEditor;
  var keys = require('ace!lib/keys');
  /**
   * captureAll takes all the key events from this listener.
   * Mostly for use with invisible textareas.
   */
  exports.addListener = function (target, captureAll) {
    event.addCommandKeyListener(target, handleEvent);
    if (captureAll) {
      target.addEventListener('beforeinput', captureInput, {
        capture: true,
        passive: false,
      });
    }
  };

  function captureInput(e) {
    var keyCode = e.data.charCodeAt(e.data.length - 1);
    if (keyCode !== undefined) handleEvent(e, 0, keyCode);
    event.stopEvent(e);
  }
  /**
   * This class is tied to Editor for simplicity.
   * The alternative is to add a new hash handler
   */
  var CONTEXT = {};
  function ensureContext(e) {
    if (e.args === CONTEXT) {
      if (!e.command.hasOwnProperty('context')) {
        //Not an action
        return event.stopEvent(e); //returns false preventing scrollintoview
      }
      if (e.command.passEvent != true) CONTEXT.stopEvent = true;
      return e.command.exec(e.editor, CONTEXT, e.event, false);
    }
  }
  var currentEvent, lastEvent;
  function handleEvent(e, hashId, keyCode) {
    if (e === lastEvent) return;
    //Action would have already been handled
    if (e.target.className.indexOf('ace_text-input') > -1) return;
    lastEvent = currentEvent = e;
    var editor = getEditor();
    editor.commands.setDefaultHandler('exec', ensureContext);
    try {
      var keyString = keys.keyCodeToString(keyCode);
      CONTEXT.stopEvent = false;
      //Use only handlers that can actually have actions
      var handler = editor.commands;
      var commands = editor.commands;
      var i = 0;
      do {
        var toExecute =
          handler &&
          handler.handleKeyboard(CONTEXT, hashId, keyString, keyCode, e);
        if (
          toExecute &&
          toExecute.command &&
          (toExecute.command === 'null' ||
            commands.exec(toExecute.command, editor, CONTEXT))
        ) {
          if (e && hashId !== 0 && CONTEXT.stopEvent) {
            event.stopEvent(e);
          }
          break;
        }
        //Repeat this with the userKbHandler
        handler = editor.keyBinding.$userKbHandler;
      } while (++i === 1);
    } finally {
      currentEvent = null;
      editor.commands.removeDefaultHandler('exec', ensureContext);
    }
  }
  exports.getEvent = function () {
    return currentEvent;
  };
  //Listen to events from the window
  exports.addListener(window);
});