define(function (require, exports, module) {
  'use strict';
  var IsKey = require('grace/core/schema').Schema.IsKey;
  var Utils = require('grace/core/utils').Utils;
  var Editors = require('grace/editor/editors').Editors;
  var config = require('grace/core/config').Config.registerAll(
    {
      jumpToDef: 'Alt-.',
      rename: 'Ctrl-Shift-E',
      findRefs: 'Ctrl-E',
      markPosition: 'Alt-M',
      showType: 'Ctrl-I',
      refresh: 'Alt-R',
      jumpBack: 'Alt-,',
    },
    'keyBindings.intellisense'
  );
  var keyValue = {
    type: IsKey,
  };
  require('grace/core/config').Config.registerInfo(
    {
      '!root': 'Keybindings used by language providers',
      jumpToDef: keyValue,
      rename: keyValue,
      findRefs: keyValue,
      markPosition: keyValue,
      showType: keyValue,
      refresh: keyValue,
      jumpBack: keyValue,
    },
    'keyBindings.intellisense'
  );
  var commandHandlers = new (require('grace/core/registry').Registry)(
    null,
    'intellisense'
  );
  var getActiveHandlers = commandHandlers.getActive;
  var isHandlerAvailable = function (editor) {
    return getActiveHandlers().some(function (e) {
      return e && editor[e.name];
    });
  };
  var callHandlers = function (editor, method, cb) {
    var hasMain, instance;
    Utils.asyncForEach(getActiveHandlers(editor), function (server, i, n) {
      if (hasMain && !server.isSupport) return n();
      if (!server[method]) return n();
      hasMain = hasMain || !server.isSupport;
      instance = editor[server.name];

      if (instance)
        cb(instance, function (t) {
          if (!t) n();
        });
      else
        server.init(editor, function (instance) {
          if (!instance) return;
          editor[server.name] = instance;
          cb(instance, function (t) {
            if (!t) n();
          });
        });
    });
  };

  function createCommands(prefix) {
    var commands = {};
    prefix = 'lsp';
    commands.markPosition = {
      exec: function (editor) {
        callHandlers(editor, 'hasDefinitions', function (e) {
          e.markPos(editor);
        });
      },
      bindKey: config.markPosition,
    };
    commands.jumpBack = {
      name: prefix + 'JumpBack',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        callHandlers(editor, 'hasDefinitions', function (e, n) {
          e.jumpBack(editor, n);
        });
      },
      bindKey: config.jumpBack,
    };
    commands.jumpToDef = {
      name: prefix + 'JumpToDef',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        callHandlers(editor, 'hasDefinitions', function (e, n) {
          e.jumpToDef(editor, n);
        });
      },
      bindKey: config.jumpToDef,
    };
    commands.showType = {
      name: prefix + 'ShowType',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        callHandlers(editor, 'hasTypeInformation', function (e, n) {
          e.showType(editor, n);
        });
      },
      bindKey: config.showType,
    };
    commands.findRefs = {
      name: prefix + 'FindRefs',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        callHandlers(editor, 'hasReferences', function (e, n) {
          e.findRefs(editor, n);
        });
      },
      bindKey: config.findRefs,
    };
    commands.rename = {
      name: prefix + 'Rename',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        callHandlers(editor, 'hasRename', function (e, n) {
          e.rename(editor, n);
        });
      },
      bindKey: config.rename,
    };
    commands.refresh = {
      name: prefix + 'Refresh',
      isAvailable: isHandlerAvailable,
      exec: function (editor) {
        getActiveHandlers().forEach(function (s) {
          var e = editor[s.name];
          if (e) {
            var full = false;
            if (e.refreshDocLastCalled != null) {
              if (new Date().getTime() - e.refreshDocLastCalled < 1000) {
                //less than 1 second
                full = true;
              }
            }
            e.refreshDocLastCalled = new Date().getTime();
            e.refreshDoc(editor, full);
          }
        });
      },
      bindKey: config.refresh,
    };
    var noConf = {};
    //hide them from normal keybindings since they change depending on client
    for (var i in commands) {
      noConf[commands[i].name] = 'no-user-config';
    }
    require('grace/core/config').Config.registerInfo(noConf, 'keyBindings');
    return commands;
  }
  var commands = createCommands('do');
  Editors.addCommands(commands);
  require('grace/core/config').Config.on(
    'keyBindings.intellisense',
    Utils.debounce(function () {
      //Plugin editors cannot react to this.
      Editors.forEach(function (e) {
        for (var i in commands) {
          e.commands.removeCommand(commands[i]);
        }
      });
      Object.assign(commands, createCommands());
      Editors.addCommands(commands);
    }, 30)
  );
  exports.LanguageServiceCommands = commands;
  exports.registerProvider = commandHandlers.register;
  exports.unregisterProvider = commandHandlers.unregister;
});