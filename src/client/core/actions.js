define(function (require, exports, module) {
  'use strict';
  var FileUtils = require('./file_utils').FileUtils;
  var Utils = require('./utils').Utils;
  var Docs = require('../docs/docs_base').Docs;
  var appEvents = require('./app_events').AppEvents;
  var _editor;
  var _isAvailable = function (editor) {
    editor = editor || _editor;
    if (this.context && !exports.checkContext(this.context, this)) {
      return false;
    }
    if (this.$isAvailable && (!editor || !this.$isAvailable(editor))) {
      return false;
    }
    return true;
  };
  var _update = function (self, update) {
    if (!this.isAvailable()) return update(this.id, null);
    else if (this.$$update) return this.$$update(self, update);
    else update(this.id, this);
  };
  var _handleFromExec = function (e) {
    if (!_editor) return false;
    this.exec(_editor, e);
  };
  var _execFromHandle = function (editor) {
    this.handle(createEvent(editor));
  };
  function createEvent(editor) {
    editor = editor || _editor;
    var doc = Docs.forSession(editor.session);
    return {
      editor: editor,
      filepath: (doc && doc.getSavePath()) || '',
      filename: FileUtils.filename((doc && doc.getSavePath()) || ''),
      fs: doc ? doc.getFileServer() : FileUtils.getFileServer(),
      rootDir: FileUtils.dirname((doc && doc.getSavePath()) || '/') || '/',
      preventDefault: Utils.noop,
      stopPropagation: Utils.noop,
    };
  }
  var _execCommand = function (editor, event) {
    if (!this.command) return;
    if (Array.isArray(this.command)) {
      this.command.forEach(function (e) {
        var temp = {};
        temp.command = e;
        _execCommand.call(temp, editor, event);
      });
    } else if (typeof this.command == 'object') {
      return editor.commands.exec(
        this.command.command,
        editor,
        this.command.args,
      );
    } else {
      return editor.commands.exec(this.command, editor, this.args || event);
    }
  };
  exports.checkContext = Utils.noop;
  function split(str) {
    return (
      str[0].toUpperCase() +
      str.slice(1).replace(/[A-Z]/g, function (e) {
        return ' ' + e.toLowerCase();
      })
    );
  }
  function join(str) {
    return (
      str[0].toLowerCase() +
      str
        .slice(1)
        .toLowerCase()
        .replace(/ \w?/g, function (e) {
          return e[1] ? e[1].toUpperCase() : '';
        })
    );
  }
  /**
   * @param {Partial<Action> & {$isAvailable,$$update}} action
   */
  exports.addAction = function (action) {
    if (action.id) throw new Error('No more id');
    //Editor command polyfills
    action.$isAvailable = action.isAvailable;
    action.isAvailable = _isAvailable;
    action.name = action.name || join(action.caption || action.description);
    if (action.command) action.exec = _execCommand;

    //Menu/Fileview items
    action.$$update = action['!update'];
    action['!update'] = _update;
    action.id = action.name;
    action.caption = action.caption || action.description || split(action.name);

    var hosts = Array.isArray(action.showIn)
      ? action.showIn
      : action.showIn
      ? [action.showIn]
      : [];
    if (action.showIn === undefined) {
      if (action.handle || action.subTree) {
        hosts.push('actionbar.more');
      }
    }
    if ((action.bindKey || action.exec) && hosts.indexOf('editor') < 0) {
      hosts.push('editor');
    }
    if (!action.handle) {
      if (action.exec) action.handle = _handleFromExec;
    } else if (!action.exec) action.exec = _execFromHandle;
    if (action.subTree) {
      exports.addActions(action.subTree, {showIn: null});
    }
    action.showIn = null;
    for (var i in hosts) {
      if (!action.context) action.context = undefined; //Needed to differentiate from editor commands which only work when the editor is focused.
      FileUtils.postChannel('action_hosts-' + hosts[i], action);
    }
  };
  /**
   * @param {Record<string,Partial<Action>>|Array<Partial<Action>>} actions
   * @param {Partial<Action>} actions
   */
  exports.addActions = function (actions, defaults) {
    var inferName = !Array.isArray(actions);
    for (var i in actions) {
      if (inferName && !actions[i].name) actions[i].name = i;
      if (defaults)
        Object.assign(actions[i], Object.assign({}, defaults, actions[i]));
      exports.addAction(actions[i]);
    }
  };
  exports.registerActionHost = function (name, handler) {
    FileUtils.ownChannel('action_hosts-' + name, handler);
  };
  //Unsafe
  appEvents.on('changeEditor', function (e) {
    _editor = e.editor;
  });
  exports.createEvent = createEvent;
  exports.Actions = exports;
});