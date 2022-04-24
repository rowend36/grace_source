define(function(require, exports, module) {
    var getObj = require("grace/core/config").Config.getObj;
    var putObj = require("grace/core/config").Config.putObj;
    var Utils = require("grace/core/utils").Utils;
    var Config = require("./edit_config");
    var getConfigInfo = require("grace/core/config").Config
        .getConfigInfo;
    var getEditor = require("grace/setup/setup_editors").getMainEditor;
    var Handler = require(
            "grace/ext/ace_loader!ace/keyboard/hash_handler")
        .MultiHashHandler;
    var defaultBindings = require("./default_bindings.js");
    require("grace/core/config").Config.registerValues({
        "!root": "Configure ace keybindings",
        "$shadowed": "The following commands are shadowed by later key bindings ie. they might not be executed."
    }, "keyBindings");
    require("grace/core/config").Config.registerValues(defaultBindings,
        "keyBindings");

    var userKbHandler = new Handler();
    //TODO move keys to appConfig instead of json
    var saveBindings = Utils.delay(function() {
            var bindings = {};
            var a = exports.getBindings();
            for (var command in a) {
                var keyString = a[command];
                //if it is unset ignore if no default
                if (!command || !keyString) continue;
                if (getConfigInfo('keyBindings.' + command) !=
                    'no-user-config')
                    bindings[command] = keyString;
            }

            putObj("keyBindings", bindings);
        },
        3000);

    //bind a keyString to a command while optionally removing old command
    var bindKeyString = exports.bindKeyString = function(
        keyString, command,
        editor, noSave, oldKeyString) {
        if (oldKeyString) {
            userKbHandler._unbindKey(oldKeyString.toLowerCase(),
                command);
        }
        if (!keyString) {
            return;
        }
        userKbHandler.bindKey(keyString, command);
        if (noSave) return;
        saveBindings(getEditor());
    };
    //Overridable
    exports.restoreBindings = function(editor) {
        if (editor.editor) editor = editor.editor;
        var kbHandler = editor.keyBinding;
        if (kbHandler.$userKbHandler ==
            userKbHandler)
            return;
        kbHandler.removeKeyboardHandler(kbHandler.$userKbHandler);
        kbHandler.$userKbHandler = userKbHandler;
        kbHandler.addKeyboardHandler(userKbHandler, (!!
            kbHandler.$mainKeyboardHandler) + (!!kbHandler
            .$defaultHandler));
    };
    //Overrideable
    exports.getBindings = function(editor, includeOverrides) {
        var bindings = {};
        var commands = userKbHandler.commandKeyBinding;
        var overriden = {};
        for (var i in commands) {
            var item = commands[i];
            if (!Array.isArray(item)) {
                item = [item];
            }
            var j = item.length - 1;
            var name = item[j];
            var binding;
            if (typeof name != "string") {
                name = name.name;
            }
            binding = [i.split("-").map(Utils.sentenceCase).join(
                "-")];
            if (getConfigInfo(
                    'keyBindings.' + name) !== 'no-user-config') {
                if (bindings[name]) {
                    for (var k in binding) {
                        var t = binding[k];
                        if (("|" + bindings[name] + "|").indexOf(
                                t) < 0) {
                            bindings[name] += "|" + t;
                        }
                    }
                } else bindings[name] = binding.join("|");
            }
            if (includeOverrides) {
                for (var u = 0; u < j; u++) {
                    var other = item[u];
                    if (typeof other != "string") {
                        other = other.name;
                    }
                    if (other != name)
                        overriden[other] = (overriden[other] ||
                            "") + "<" + binding + " by:" + name +
                        ">";
                }
            }
        }
        if (editor) {
            if (editor.editor) editor = editor.editor;
            editor.keyBinding.$handlers.forEach(function(handler) {
                var b = handler.byName;
                for (var o in b) {
                    if (getConfigInfo(
                            'keyBindings.' + o) !=
                        'no-user-config')
                        if (!bindings.hasOwnProperty(o)) {
                            bindings[o] = "";
                        }
                }
            });
        }
        var sorted = {};
        Object.keys(bindings).sort(function(a, b) {
            return !bindings[a] && bindings[b] ? 1 : !
                bindings[b] && bindings[a] ? -1 : a
                .toLowerCase().localeCompare(b
                    .toLowerCase());
        }).forEach(function(t) {
            sorted[t] = bindings[t];
        });
        if (includeOverrides) {
            sorted.$shadowed = overriden;
        }
        return sorted;
    };
    var Notify = require("grace/ui/notify").Notify;
    var Schema = require("grace/core/schema").Schema;
    Schema.IsKey = {
        invalid: function(key) {
            var s = key.split(/\|| /g);
            if (s.some(function(e) {
                    return !
                        /^(?:Ctrl-)?(?:Alt-)?(?:Shift-)?(?:(?:(?:Page)?(?:Down|Up))|Left|Right|Delete|Tab|Home|End|Insert|Esc|Backspace|Space|Enter|.|F1?[0-9])$/i
                        .test(e);
                }))
                return "Invalid Key " + key;
        }
    };
    Config.setHandler(
        "keyBindings", {
            updateValue: function(commandToKeyMap, saveToMemory) {
                var failed = false;
                var editor = getEditor();
                var currentBindings = exports.getBindings(
                    editor);
                for (var command in commandToKeyMap) {
                    var newKeyString = commandToKeyMap[command];
                    if (command == "$shadowed") continue;
                    if (typeof newKeyString == 'object') {
                        Config.apply(newKeyString, null,
                            "keyBindings." + command);
                        continue;
                    }
                    // if (!currentBindings.hasOwnProperty(
                    //         command)) {
                    //     continue;
                    //     // Notify.warn('Unknown command ' + command);
                    //     // failed = true;
                    // }
                    if (newKeyString) {
                        var error = Schema.IsKey.invalid(
                            newKeyString);
                        if (error) {
                            Notify.warn(error);
                            failed = true;
                            continue;
                        }
                    }
                    if (currentBindings[command] !=
                        newKeyString) bindKeyString(
                        newKeyString, command, editor, !
                        saveToMemory, currentBindings[
                            command]);

                }
                return failed;
            },
            getValue: function() {
                return exports.getBindings(getEditor(), true);
            }
        });
    var appEvents = require("grace/core/events").AppEvents;
    appEvents.once(
        'fullyLoaded',
        function() {
            var Editors = require("grace/editor/editors").Editors;
            Editors.forEach(function(e) {
                exports.restoreBindings(e);
            });
            appEvents.on("createEditor", exports.restoreBindings);

            var bindings = getObj('keyBindings', {});
            for (var command in bindings) {
                bindKeyString(bindings[command], command, null,
                    true);
            }

        }, true /*necessary to execute before settings doc*/ );
}); /*_EndDefine*/