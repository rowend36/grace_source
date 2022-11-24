define(function (require, exports, module) {
    "use strict";
    var Utils = require("grace/core/utils").Utils;
    var Actions = require("grace/core/actions").Actions;

    var commandHandlers = new (require("grace/core/registry").Registry)(
        null,
        "intellisense.commands"
    );
    var getActiveHandlers = commandHandlers.getActive;
    var isHandlerAvailable = function (editor) {
        return getActiveHandlers(editor).length > 0;
    };
    var callHandlers = function (editor, method, cb) {
        var hasMain, instance;
        Utils.asyncForEach(getActiveHandlers(editor), function (server, i, n) {
            if (hasMain && !server.isSupport) return n();
            if (!server[method]) return n();
            hasMain = hasMain || !server.isSupport;
            instance = editor[server.name];
            if (instance)
                cb(instance, function (err) {
                    if (err) n();
                });
            else
                server.init(editor, function (instance) {
                    if (!instance) return;
                    cb(instance, function (t) {
                        if (!t) n();
                    });
                });
        });
    };

    (function createCommands() {
        var commands = {};
        commands.markPosition = {
            exec: function (editor) {
                callHandlers(editor, "hasDefinitions", function (e) {
                    e.markPos(editor);
                });
            },
            showIn: ["actionbar.go"],
        };
        commands.jumpBack = {
            name: "jumpBack",
            exec: function (editor) {
                callHandlers(editor, "hasDefinitions", function (e, n) {
                    e.jumpBack(editor, n);
                });
            },
            showIn: ["actionbar.go"],
            bindKey: "Alt-,",
        };
        commands.jumpToDef = {
            name: "jumpToDefinition",
            exec: function (editor) {
                callHandlers(editor, "hasDefinitions", function (e, n) {
                    e.jumpToDef(editor, n);
                });
            },
            showIn: ["actionbar.go"],
            bindKey: "Alt-.",
        };
        commands.showType = {
            name: "showType",
            exec: function (editor) {
                callHandlers(editor, "hasTypeInformation", function (e, n) {
                    e.showType(editor, null, false, n);
                });
            },
            bindKey: "Ctrl-I",
        };
        commands.findRefs = {
            name: "findReferences",
            exec: function (editor) {
                callHandlers(editor, "hasReferences", function (e, n) {
                    e.findRefs(editor, n);
                });
            },
            bindKey: "Ctrl-E",
        };
        commands.rename = {
            name: "rename",
            exec: function (editor) {
                callHandlers(editor, "hasRename", function (e, n) {
                    e.rename(editor, n);
                });
            },
            showIn: ["actionbar.edit"],
            bindKey: "Ctrl-Shift-E",
        };
        commands.refresh = {
            name: "refresh",
            exec: function (editor) {
                getActiveHandlers(editor).forEach(function (s) {
                    var e = editor[s.name];
                    if (e) {
                        var full = false;
                        if (e.refreshDocLastCalled != null) {
                            if (
                                new Date().getTime() - e.refreshDocLastCalled <
                                1000
                            ) {
                                //less than 1 second
                                full = true;
                            }
                        }
                        e.refreshDocLastCalled = new Date().getTime();
                        e.refreshDoc(editor, full);
                    }
                });
            },
            bindKey: "Alt-R",
        };
        Actions.addActions(commands, {isAvailable: isHandlerAvailable});
    })();
    exports.registerProvider = commandHandlers.register;
    exports.unregisterProvider = commandHandlers.unregister;
});