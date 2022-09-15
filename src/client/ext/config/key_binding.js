define(function (require, exports, module) {
    var Handler = require('ace!keyboard/hash_handler').MultiHashHandler;
    // var defaultBindings = require('./default_bindings.js');
    // require('grace/core/config').Config.registerInfo(
    //     defaultBindings,
    //     'keyBindings'
    // );
    var Config = require('grace/core/config').Config;
    var getEditor = require('grace/setup/setup_editors').getActiveEditor;
    var shortcuts = require('ace!ext/menu_tools/get_editor_keyboard_shortcuts');
    var Schema = require('grace/core/schema').Schema;
    var Editors = require('grace/editor/editors').Editors;
    var appEvents = require('grace/core/app_events').AppEvents;
    var keyConfig = require('grace/core/config').Config.registerAll(
        {
            store: {},
        },
        'keyBindings'
    );
    Config.registerInfo(
        {
            '!root': {
                doc: 'Configure ace key bindings.',
                type: new Schema.XMap(
                    Schema.IsString,
                    new Schema.XOneOf(
                        Schema.IsKey,
                        Schema.parse([Schema.IsKey])
                    )
                ),
            },
            store: 'no-user-config',
        },
        'keyBindings'
    );

    var userKbHandler = new Handler();
    Config.on('keyBindings', function (e) {
        if (e.saved) throw new Error('Invalid operation!!!');
        userKbHandler.bindKey(e.value(), e.config);
    });

    //Overridable
    exports.addUserBindings = function (editor) {
        if (editor.editor) editor = editor.editor;
        var kbHandler = editor.keyBinding;
        if (kbHandler.$userKbHandler) return;
        kbHandler.$userKbHandler = userKbHandler;
        kbHandler.addKeyboardHandler(
            userKbHandler,
            !!kbHandler.$mainKeyboardHandler + !!kbHandler.$defaultHandler
        );
    };

    Config.setHandler('keyBindings', {
        toJSON: function () {
            //Add plceholders for the loaded commands
            //TODO remove stale placeholders
            var editor = getEditor();
            if (!editor) return keyConfig;
            var clone = Object.assign({}, keyConfig);
            var info = {};
            var commands = shortcuts.getCommandsByName(editor, true);
            for (var name in info) {
                var m = Config.getConfigInfo('keyBindings.' + name);
                if (!m || m !== 'no-user-config') {
                    if (m !== commands[name].keys)
                        info[name] = commands[name].keys;
                    if (!clone.hasOwnProperty(name)) {
                        clone[name] = undefined;
                    }
                }
            }
            Config.registerInfo(info, 'keyBindings');
            return clone;
        },
        update: function (val, old, path) {
            Config.withoutStorage(function () {
                for (var i in val) {
                    Config.configure(i, val[i], 'keyBindings', true);
                }
            });
            return Config.configureObj('data', keyConfig, 'keyBindings.store');
        },
    });
    (function () {
        //Store keys as a single object in a virtual namespace
        var store = Config.registerObj('data', 'keyBindings.store', {});
        Config.withoutStorage(function () {
            for (var i in store) {
                Config.configure(i, store[i], 'keyBindings');
                userKbHandler.bindKey(store[i], i);
            }
        });
        Editors.forEach(function (e) {
            exports.addUserBindings(e);
        });
        appEvents.on('createEditor', exports.addUserBindings);
    })();
}); /*_EndDefine*/