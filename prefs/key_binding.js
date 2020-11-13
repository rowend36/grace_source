(function(global) {
    var appStorage = global.appStorage;
    var appEvents = global.AppEvents;
    var Utils = global.Utils;
    var SettingsDoc = global.SettingsDoc;
    var getEditor = global.getMainEditor;
    var defaultBindings = {
        "showSettingsMenu": "Ctrl-,",
        "goToNextError": "Alt-E",
        "goToPreviousError": "Alt-Shift-E",
        "selectall": "Ctrl-A",
        "centerselection": null,
        "gotoline": "Ctrl-L",
        "fold": "Alt-L|Ctrl-F1",
        "unfold": "Alt-Shift-L|Ctrl-Shift-F1",
        "toggleFoldWidget": "F2",
        "toggleParentFoldWidget": "Alt-F2",
        "foldall": null,
        "foldOther": "Alt-0",
        "unfoldall": "Alt-Shift-0",
        "findnext": "Ctrl-K",
        "findprevious": "Ctrl-Shift-K",
        "selectOrFindNext": "Alt-K",
        "selectOrFindPrevious": "Alt-Shift-K",
        "find": "Ctrl-F",
        "overwrite": "Insert",
        "selecttostart": "Ctrl-Shift-Home",
        "gotostart": "Ctrl-Home",
        "selectup": "Shift-Up",
        "golineup": "Up",
        "selecttoend": "Ctrl-Shift-End",
        "gotoend": "Ctrl-End",
        "selectdown": "Shift-Down",
        "golinedown": "Down",
        "selectwordleft": "Ctrl-Shift-Left",
        "gotowordleft": "Ctrl-Left",
        "selecttolinestart": "Alt-Shift-Left",
        "gotolinestart": "Alt-Left|Home",
        "selectleft": "Shift-Left",
        "gotoleft": "Left",
        "selectwordright": "Ctrl-Shift-Right",
        "gotowordright": "Ctrl-Right",
        "selecttolineend": "Alt-Shift-Right",
        "gotolineend": "Alt-Right|End",
        "selectright": "Shift-Right",
        "gotoright": "Right",
        "selectpagedown": "Shift-PageDown",
        "pagedown": null,
        "gotopagedown": "PageDown",
        "selectpageup": "Shift-PageUp",
        "pageup": null,
        "gotopageup": "PageUp",
        "scrollup": "Ctrl-Up",
        "scrolldown": "Ctrl-Down",
        "selectlinestart": "Shift-Home",
        "selectlineend": "Shift-End",
        "togglerecording": "Ctrl-Alt-E",
        "replaymacro": "Ctrl-Shift-E",
        "jumptomatching": "Ctrl-\\|Ctrl-P",
        "selecttomatching": "Ctrl-Shift-\\|Ctrl-Shift-P",
        "expandToMatching": "Ctrl-Shift-M",
        "passKeysToBrowser": null,
        "removeline": "Ctrl-D",
        "duplicateSelection": "Ctrl-Shift-D",
        "sortlines": "Ctrl-Alt-S",
        "togglecomment": "Ctrl-/",
        "toggleBlockComment": "Ctrl-Shift-/",
        "modifyNumberUp": "Ctrl-Shift-Up",
        "modifyNumberDown": "Ctrl-Shift-Down",
        "replace": "Ctrl-H",
        "undo": "Ctrl-Z",
        "redo": "Ctrl-Shift-Z|Ctrl-Y",
        "copylinesup": "Alt-Shift-Up",
        "movelinesup": "Alt-Up",
        "copylinesdown": "Alt-Shift-Down",
        "movelinesdown": "Alt-Down",
        "del": "Delete",
        "backspace": "Shift-Backspace|Backspace",
        "cut_or_delete": "Shift-Delete",
        "removetolinestart": "Alt-Backspace",
        "removetolineend": "Alt-Delete",
        "removetolinestarthard": "Ctrl-Shift-Backspace",
        "removetolineendhard": "Ctrl-Shift-Delete",
        "removewordleft": "Ctrl-Backspace",
        "removewordright": "Ctrl-Delete",
        "outdent": "Shift-Tab",
        "indent": "Tab",
        "blockoutdent": "Ctrl-[",
        "blockindent": "Ctrl-]",
        "splitline": null,
        "transposeletters": "Alt-Shift-X",
        "touppercase": "Ctrl-U",
        "tolowercase": "Ctrl-Shift-U",
        "expandtoline": "Ctrl-Shift-L",
        "joinlines": null,
        "invertSelection": null,
        "openCommandPallete": "F1",
        "modeSelect": null,
        "addCursorAbove": "Ctrl-Alt-Up",
        "addCursorBelow": "Ctrl-Alt-Down",
        "addCursorAboveSkipCurrent": "Ctrl-Alt-Shift-Up",
        "addCursorBelowSkipCurrent": "Ctrl-Alt-Shift-Down",
        "selectMoreBefore": "Ctrl-Alt-Left",
        "selectMoreAfter": "Ctrl-Alt-Right",
        "selectNextBefore": "Ctrl-Alt-Shift-Left",
        "selectNextAfter": "Ctrl-Alt-Shift-Right",
        "splitIntoLines": "Ctrl-Alt-L",
        "alignCursors": "Ctrl-Alt-A",
        "findAll": "Ctrl-Alt-K",
        "beautify": "Ctrl-B",
        "beautifyEndExpand": "Ctrl-Alt-B",
        "removeBlank": "Ctrl-Shift-B",
        "expandSnippet": "Tab",
        "startAutocomplete": "Ctrl-Space|Ctrl-Shift-Space|Alt-Space",
        "toggleFullscreen": "F11",
        "swapTabs": "Alt-Tab",
        "newFile": "Ctrl-N",
        "save": "Ctrl-S",
        "saveAs": "Ctrl-Shift-S",
        "openClipboard": "Ctrl-Shift-V",
        "ternJumpToDef": "Alt-.",
        "ternJumpBack": "Alt-,",
        "ternShowType": "Ctrl-I",
        "ternFindRefs": "Ctrl-E",
        "ternRename": "Ctrl-Shift-E",
        "ternRefresh": "Alt-R",
        "run": "F7",
        "Add Split": "F10",
        "Add Split Vertical": "F9",
        "Remove Split": "F8"
    };
    global.registerValues({
        "keyBindings": "Note: These bindings are overriden by the vim/emacs/sublime keymaps\nAlso some plugins like tern,emmet,etc might override the bindings.",
    });
    global.saveBindings = function(editor) {
        var bindings = {};
        var a = global.getBindings(editor);
        for (var i in a) {
            var binding = a[i];
            if (binding && binding.toLowerCase() != defaultBindings[i].toLowerCase()) {
                bindings[i] = binding;
            }
        }
        appStorage.setItem("keyBindings", JSON.stringify(bindings));
    };
    global.setBinding = function(command, value, editor) {
        var a = editor.commands;
        var mappings = value.split("|");
        mappings.forEach(function(u) {
            var named = (editor.editor || editor).commands.commandKeyBinding;
            var key = u.toLowerCase();
            if (named[key]) {
                if (Array.isArray(named[key])) {
                    named[key].push(command);
                }
                else named[key] = [named[key], command];
            }
            else named[key] = command;
        });
        if (!saveBindings) saveBindings = Utils.delay(function() {
            global.saveBindings(getEditor());
            saveBindings = null;
        },10000);
        saveBindings();
    };
    global.restoreBindings = function(editor) {
        var bindings = appStorage.getItem('keyBindings');
        if (bindings) {
            bindings = JSON.parse(bindings);
            for (var i in bindings) {
                global.setBinding(i, bindings[i], editor);
            }
        }
    };
    global.getBindings = function(editor, includeOverrides) {
        var bindings = {};
        if (editor.editor) editor = editor.editor;
        var commands = editor.commands.commandKeyBinding;
        var platform = editor.commands.platform;
        var overriden = {};
        for (var i in commands) {
            var item = commands[i];
            if (!Array.isArray(item)) {
                item = [item];
            }
            j = item.length - 1;
            var name = item[j];
            var binding;
            if (typeof name != "string") {
                name = name.name;
            }
            binding = [i.split("-").map(function(e) {
                return e[0].toUpperCase() + e.substring(1);
            }).join("-")];

            if (bindings[name]) {
                for (var k in binding) {
                    var t = binding[k];
                    if (("|" + bindings[name] + "|").indexOf(t) < 0) {
                        bindings[name] += "|" + t;
                    }
                }
            }
            else bindings[name] = binding.join("|");
            if (includeOverrides) {
                for (var u = 0; u < j; u++) {
                    var other = item[u];
                    if (typeof other != "string") {
                        other = other.name;
                        /*binding = (typeof item[j].bindKey == "object" ? (item[j].bindKey[platform]) : item[j].bindKey);
                                if (binding)
                                    binding = binding.toLowerCase().split("|");
                            */
                    }
                    if (other != name)
                        overriden[other] = (overriden[other] || "") + "<" + binding + ":" + name + ">";
                }
            }
        }
        var b = editor.commands.byName;
        for (var o in b) {
            if (!bindings.hasOwnProperty(o)) {
                bindings[o] = "";
            }
        }
        
        sorted = {};
        Object.keys(bindings).sort(function(a,b){
            return !bindings[a] && bindings[b]?1:!bindings[b] && bindings[a]?-1:!(bindings[a]||bindings[b])?0:a.toLowerCase().localeCompare(b.toLowerCase());
        }).forEach(function(t){
            sorted[t]=bindings[t];
        });
        if (includeOverrides) {
            sorted.$shadowed = overriden;
        }
        return sorted;
    };
    var saveBindings;
    appEvents.on("createEditor", function(e) {
        global.restoreBindings(e.editor);
    });
})(Modules);