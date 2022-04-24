define("ace/ext/menu_tools/get_editor_keyboard_shortcuts",["require","exports","module","ace/lib/keys"], function(require, exports, module) {
"use strict";
var keys = require("../../lib/keys");
var mods = {"C-": "Ctrl-", "S-": "Shift", "M-": "alt", "Cmd-": "command"};

function upper(x) {
    return x.toUpperCase(); }
function toMod(key){
    return mods[key]||key;
}
function normalize(k){
    var a = k.toLowerCase();
    a = a.replace(/(?:^|\-| )\w/g,upper);
    a = a.replace(/(?:Cmd|[CSM])\-/g,toMod);
    return a;
}
module.exports.getCommandsByName = function(editor,validate) {
    var KEY_MODS = keys.KEY_MODS;
    var commandMap = Object.create(null);
    var bindings;
    if(validate){
        bindings = module.exports.getCommandsByKey(editor);
    }
    editor.keyBinding.$handlers.forEach(function(handler) {
        var ckb = handler.commandKeyBinding;
        for (var i in ckb) {
            var key = normalize(i);
            var commands = ckb[i];
            if (!Array.isArray(commands))
                commands = [commands];
            for(var k=0;k<commands.length;k++){
                var command = commands[k];
                var item,obj;
                if (typeof command != "string"){
                    item = command;
                    command  = command.name;
                    obj = commandMap[command];
                    if(obj && obj.item!=item){
                        if(obj.item){
                        }
                        obj.item = item;
                    }
                }
                else obj = commandMap[command];
                var binding = key;
                if(validate && bindings[key] && bindings[key][bindings[key].length-1]!=command){
                    binding = "??"+key;
                }
                if(!obj){
                    commandMap[command]={item:item,keys:binding};
                }
                else{
                    var keys = obj.keys;
                    if(!keys)obj.keys = binding;
                    else if(keys!=binding){
                        if(("|"+keys+"|").indexOf("|"+binding+"|")>0){
                            keys = ("|"+keys+"|").replace("|"+binding+"|","|").substring(0,-1);
                        }
                        obj.keys = keys+"|"+binding;
                    }
                }
            }
        }
        var unmapped = handler.commands;
        for(var t in unmapped){
            if(!commandMap[t]){
                commandMap[t]={item:unmapped[t],keys:""};
            }
        }
    });
    return commandMap;
};
module.exports.getCommandsByKey = function(editor) {
    var KEY_MODS = keys.KEY_MODS;
    var keyBindings = Object.create(null);
    editor.keyBinding.$handlers.forEach(function(handler) {
        var ckb = handler.commandKeyBinding;
        for (var i in ckb) {
            var key = normalize(i);
            var commands = ckb[i];
            if (!Array.isArray(commands))
                commands = [commands];
            var keys = keyBindings[key];
            if(!keys){
                keys = keyBindings[key]=[];
            }
            for(var k=0;k<commands.length;k++){
                var command = commands[k];
                if (typeof command != "string")
                    command  = command.name;
                var pos = keys.indexOf(command);
                if(pos>-1){
                    keys.splice(pos,1);
                }
                keys.push(command);
            }
        }
    });
    return keyBindings;
};
module.exports.normalizeKey = normalize;
});

define("ace/ext/menu_tools/overlay_page",["require","exports","module","ace/lib/dom"], function(require, exports, module) {
'use strict';
var dom = require("../../lib/dom");
var cssText = "#ace_settingsmenu, #kbshortcutmenu {\
background-color: #F7F7F7;\
color: black;\
box-shadow: -5px 4px 5px rgba(126, 126, 126, 0.55);\
padding: 1em 0.5em 2em 1em;\
overflow: auto;\
position: absolute;\
margin: 0;\
bottom: 0;\
right: 0;\
top: 0;\
z-index: 9991;\
cursor: default;\
}\
.ace_dark #ace_settingsmenu, .ace_dark #kbshortcutmenu {\
box-shadow: -20px 10px 25px rgba(126, 126, 126, 0.25);\
background-color: rgba(255, 255, 255, 0.6);\
color: black;\
}\
.ace_optionsMenuEntry:hover {\
background-color: rgba(100, 100, 100, 0.1);\
transition: all 0.3s\
}\
.ace_closeButton {\
background: rgba(245, 146, 146, 0.5);\
border: 1px solid #F48A8A;\
border-radius: 50%;\
padding: 7px;\
position: absolute;\
right: -8px;\
top: -8px;\
z-index: 100000;\
}\
.ace_closeButton{\
background: rgba(245, 146, 146, 0.9);\
}\
.ace_optionsMenuKey {\
color: darkslateblue;\
font-weight: bold;\
}\
.ace_optionsMenuCommand {\
color: darkcyan;\
font-weight: normal;\
}\
.ace_optionsMenuEntry input, .ace_optionsMenuEntry button {\
vertical-align: middle;\
}\
.ace_optionsMenuEntry button[ace_selected_button=true] {\
background: #e7e7e7;\
box-shadow: 1px 0px 2px 0px #adadad inset;\
border-color: #adadad;\
}\
.ace_optionsMenuEntry button {\
background: white;\
border: 1px solid lightgray;\
margin: 0px;\
}\
.ace_optionsMenuEntry button:hover{\
background: #f0f0f0;\
}";
dom.importCssString(cssText);

module.exports.overlayPage = function overlayPage(editor, contentElement, callback) {
    var closer = document.createElement('div');
    var ignoreFocusOut = false;

    function documentEscListener(e) {
        if (e.keyCode === 27) {
            close();
        }
    }

    function close() {
        if (!closer) return;
        document.removeEventListener('keydown', documentEscListener);
        closer.parentNode.removeChild(closer);
        if (editor) {
            editor.focus();
        }
        closer = null;
        callback && callback();
    }
    function setIgnoreFocusOut(ignore) {
        ignoreFocusOut = ignore;
        if (ignore) {
            closer.style.pointerEvents = "none";
            contentElement.style.pointerEvents = "auto";
        }
    }

    closer.style.cssText = 'margin: 0; padding: 0; ' +
        'position: fixed; top:0; bottom:0; left:0; right:0;' +
        'z-index: 300; ' +
        (editor ? 'background-color: rgba(0, 0, 0, 0.3);' : '');
    closer.addEventListener('click', function(e) {
        if (!ignoreFocusOut) {
            close();
        }
    });
    document.addEventListener('keydown', documentEscListener);

    contentElement.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    closer.appendChild(contentElement);
    document.body.appendChild(closer);
    if (editor) {
        editor.blur();
    }
    return {
        close: close,
        setIgnoreFocusOut: setIgnoreFocusOut
    };
};

});

define("ace/ext/prompt",["require","exports","module","ace/range","ace/lib/dom","ace/ext/menu_tools/get_editor_keyboard_shortcuts","ace/autocomplete","ace/autocomplete/popup","ace/autocomplete/popup","ace/undomanager","ace/tokenizer","ace/ext/menu_tools/overlay_page","ace/ext/modelist"], function(require, exports, module) {
"use strict";

var Range = require("../range").Range;
var dom = require("../lib/dom");
var shortcuts = require("../ext/menu_tools/get_editor_keyboard_shortcuts");
var FilteredList= require("../autocomplete").FilteredList;
var AcePopup = require('../autocomplete/popup').AcePopup;
var $singleLineEditor = require('../autocomplete/popup').$singleLineEditor;
var UndoManager = require("../undomanager").UndoManager;
var Tokenizer = require("../tokenizer").Tokenizer;
var overlayPage = require("./menu_tools/overlay_page").overlayPage;
var modelist = require("./modelist");
var openPrompt;

function prompt(editor, message, options, callback) {
    if (typeof message == "object") {
        return prompt(editor, "", message, options);
    }
    if (openPrompt) {
        var lastPrompt = openPrompt;
        editor = lastPrompt.editor;
        lastPrompt.close();
        if (lastPrompt.name && lastPrompt.name == options.name)
            return;
    }
    if (options.$type)
       return prompt[options.$type](editor, callback);

    var cmdLine = $singleLineEditor();
    cmdLine.renderer.setTheme(editor.renderer.theme);
    cmdLine.session.setUndoManager(new UndoManager());

    var el = dom.buildDom(["div", {class: "ace_prompt_container" + (options.hasDescription ? " input-box-with-description" : "")}]);
    var overlay = overlayPage(editor, el, done);
    el.appendChild(cmdLine.container);

    if (editor) {
        editor.cmdLine = cmdLine;
        cmdLine.setOption("fontSize", Math.min(24,Math.max(16,editor.getOption("fontSize")*1.2)));
    }
    if (message) {
        cmdLine.setValue(message, 1);
    }
    if (options.selection) {
        cmdLine.selection.setRange({
            start: cmdLine.session.doc.indexToPosition(options.selection[0]),
            end: cmdLine.session.doc.indexToPosition(options.selection[1])
        });
    }

    if (options.getCompletions) {
        var popup = new AcePopup();
        popup.renderer.setStyle("ace_autocomplete_inline");
        popup.copyTheme(editor);
        popup.container.style.display = "block";
        popup.container.style.maxWidth = "600px";
        popup.container.style.width = "100%";
        popup.container.style.marginTop = "3px";
        popup.renderer.setScrollMargin(2, 2, 0, 0);
        popup.autoSelect = false;
        popup.setRow(-1);
        popup.on("click", function(e) {
            var data = popup.getData(popup.getRow());
            if (!data.error) {
                cmdLine.setValue(data.value || data.name || data);
                accept();
                e.stop();
            }
        });
        popup.renderer.on('resize',function(){
            popup.renderer.$maxLines = Math.min(Math.floor(0.5 * (window.innerHeight - 100) / popup.renderer.lineHeight) || 1, 15);
        });
        el.appendChild(popup.container);
        updateCompletions();
    }

    if (options.$rules) {
        var tokenizer = new Tokenizer(options.$rules);
        cmdLine.session.bgTokenizer.setTokenizer(tokenizer);
    }

    if (options.placeholder) {
        cmdLine.setOption("placeholder", options.placeholder);
    }

    if (options.hasDescription) {
        var promptTextContainer = dom.buildDom(["div", {class: "ace_prompt_text_container"}]);
        dom.buildDom(options.prompt || "Press 'Enter' to confirm or 'Escape' to cancel", promptTextContainer);
        el.appendChild(promptTextContainer);
    }

    overlay.setIgnoreFocusOut(options.ignoreFocusOut);

    function accept() {
        var val;
        if (popup && popup.getCursorPosition().row > 0) {
            val = valueFromRecentList();
        } else {
            val = cmdLine.getValue();
        }
        var curData = popup ? popup.getData(popup.getRow()) : val;
        if (curData && !curData.error) {
            done();
            options.onAccept && options.onAccept({
                value: val,
                item: curData
            }, cmdLine);
        }
    }

    var keys = {
        "Enter": accept,
        "Esc|Shift-Esc": function() {
            options.onCancel && options.onCancel(cmdLine.getValue(), cmdLine);
            done();
        }
    };

    if (popup) {
        Object.assign(keys, {
            "Up": function(editor) { popup.goTo("up"); valueFromRecentList();},
            "Down": function(editor) { popup.goTo("down"); valueFromRecentList();},
            "Ctrl-Up|Ctrl-Home": function(editor) { popup.goTo("start"); valueFromRecentList();},
            "Ctrl-Down|Ctrl-End": function(editor) { popup.goTo("end"); valueFromRecentList();},
            "Tab": function(editor) {
                popup.goTo("down"); valueFromRecentList();
            },
            "PageUp": function(editor) { popup.gotoPageUp(); valueFromRecentList();},
            "PageDown": function(editor) { popup.gotoPageDown(); valueFromRecentList();}
        });
    }

    cmdLine.commands.bindKeys(keys);

    function done() {
        overlay.close();
        callback && callback();
        openPrompt = null;
    }

    cmdLine.on("input", function() {
        options.onInput && options.onInput();
        updateCompletions();
    });

    function updateCompletions() {
        if (options.getCompletions) {
            var prefix;
            if (options.getPrefix) {
                prefix = options.getPrefix(cmdLine);
            }

            var completions = options.getCompletions(cmdLine);
            popup.setData(completions, prefix);
            popup.resize(true);
        }
    }

    function valueFromRecentList() {
        var current = popup.getData(popup.getRow());
        if (current && !current.error)
            return current.value || current.caption || current;
    }

    cmdLine.resize(true);
    if (popup) {
        popup.resize(true);
    }
    cmdLine.focus();
    openPrompt = {
        close: done,
        name: options.name,
        editor: editor
    };
}

prompt.gotoLine = function(editor, callback) {
    function stringifySelection(selection) {
        if (!Array.isArray(selection))
            selection = [selection];
        return selection.map(function(r) {
            var cursor = r.isBackwards ? r.start: r.end;
            var anchor = r.isBackwards ? r.end: r.start;
            var row = anchor.row;
            var s = (row + 1) + ":" + anchor.column;

            if (anchor.row == cursor.row) {
                if (anchor.column != cursor.column)
                    s += ">" + ":" + cursor.column;
            } else {
                s += ">" + (cursor.row + 1) + ":" + cursor.column;
            }
            return s;
        }).reverse().join(", ");
    }
    var HELP = [{
        value: "c1",
        caption: "c1 - goto index 1",
        meta: "HELP"
    },{
        value: "1:0",
        caption: "1:0 Go to line 1, column 0",
        meta: "HELP"
    },{
        value: "1:0,1:3",
        caption: "To select multiple, separate with commas",
        meta: "HELP"
    }];
    function parseRanges(value){
        var pos = editor.getCursorPosition();
        var ranges = [];
        value.replace(/^:/, "").split(/,/).map(function(str) {
            var parts = str.split(/([<>:+-]|c?\d+)|[^c\d<>:+-]+/).filter(Boolean);
            var i = 0;

            function readPosition() {
                var c = parts[i++];
                if (!c) return;
                if (c[0] == "c") {
                    var index = parseInt(c.slice(1)) || 0;
                    return editor.session.doc.indexToPosition(index);
                }
                var row = pos.row;
                var column = 0;
                if (/\d/.test(c)) {
                    row = parseInt(c) - 1;
                    c = parts[i++];
                }
                if (c == ":") {
                    c = parts[i++];
                    if (/\d/.test(c)) {
                        column = parseInt(c) || 0;
                    }
                }
                return {
                    row: row,
                    column: column
                };
            }
            pos = readPosition();
            if(pos){
                var range = Range.fromPoints(pos, pos);
                if (parts[i] == ">") {
                    i++;
                    range.end = readPosition();
                } else if (parts[i] == "<") {
                    i++;
                    range.start = readPosition();
                }
                ranges.unshift(range);
            }
        });
        return ranges;
    }
    prompt(editor, ":" + stringifySelection(editor.selection.toJSON()), {
        name: "gotoLine",
        selection: [1, Number.MAX_VALUE],
        onAccept: function(data) {
            var value = data.value;
            var _history = prompt.gotoLine._history;
            if (!_history)
                prompt.gotoLine._history = _history = [];
            if (_history.indexOf(value) != -1)
                _history.splice(_history.indexOf(value), 1);
            _history.unshift(value);
            if (_history.length > 20) _history.length = 20;
            
            var ranges = parseRanges(value);
            editor.selection.fromJSON(ranges);
            editor.session.unfold(ranges);
            var scrollTop = editor.renderer.scrollTop;
            editor.renderer.scrollSelectionIntoView(
                editor.selection.anchor, 
                editor.selection.cursor, 
                0.5
            );
            editor.renderer.animateScrolling(scrollTop);
        },
        history: function() {
            var undoManager = editor.session.getUndoManager();
            if (!prompt.gotoLine._history)
                return HELP;
            return prompt.gotoLine._history;

        },
        getCompletions: function(cmdLine) {
            var value = cmdLine.getValue();
            var ranges = parseRanges(value);
            return ranges.map(function(e){
                var value = editor.session.getLine(e.start.row);
                return e.start.row+1+":"+e.start.column + "  " + value;
            }).concat(this.history());
        },
        $rules: {
            start: [{
                regex: /\d+/,
                token: "string"
            }, {
                regex: /[:,><+\-c]/,
                token: "keyword"
            }]
        }
    });
};

prompt.commands = function(editor, callback) {
    function normalizeName(name) {
        return (name || "").replace(/^./, function(x) {
            return x.toUpperCase(x);
        }).replace(/[a-z][A-Z]/g, function(x) {
            return x[0] + " " + x[1].toLowerCase(x);
        });
    }
    var excludeCommandsList = ["insertstring", "inserttext", "setIndentation", "paste"];
    var shortcutsObj = shortcuts.getCommandsByName(editor,true);
    var shortcutsArray = [];
    for(var a in excludeCommandsList){
        delete shortcutsObj[excludeCommandsList[a]];
    }
    for(var b in shortcutsObj){
        var description = (shortcutsObj[b].item && shortcutsObj[b].item.description)||normalizeName(b);
        shortcutsArray.push({
            value: description,
            meta: shortcutsObj[b].keys,
            command: b
        });
    }
    shortcutsArray.sort(function(a,b){
        return a.value<b.value?-1:1;
    });
    prompt(editor, "",  {
        name: "commands",
        selection: [0, Number.MAX_VALUE],
        maxHistoryCount: 5,
        onAccept: function(data) {
            if (data.item) {
                var commandName = data.item.command;
                this.addToHistory(data.item);

                editor.execCommand(commandName);
            }
        },
        addToHistory: function(item) {
            var history = this.history();
            history.unshift(item);
            delete item.message;
            for (var i = 1; i < history.length; i++) {
                if (history[i]["command"] == item.command ) {
                    history.splice(i, 1);
                    break;
                }
            }
            if (this.maxHistoryCount > 0 && history.length > this.maxHistoryCount) {
                history.splice(history.length - 1, 1);
            }
            prompt.commands.history = history;
        },
        history: function() {
            return prompt.commands.history || [];
        },
        getPrefix: function(cmdLine) {
            var currentPos = cmdLine.getCursorPosition();
            var filterValue = cmdLine.getValue();
            return filterValue.substring(0, currentPos.column);
        },
        getCompletions: function(cmdLine) {
            function getFilteredCompletions(commands, prefix) {
                var resultCommands = JSON.parse(JSON.stringify(commands));

                var filtered = new FilteredList(resultCommands);
                return filtered.filterCompletions(resultCommands, prefix);
            }

            function getUniqueCommandList(commands, usedCommands) {
                if (!usedCommands || !usedCommands.length) {
                    return commands;
                }
                var excludeCommands = [];
                usedCommands.forEach(function(item) {
                    excludeCommands.push(item.command);
                });

                var resultCommands = [];

                commands.forEach(function(item) {
                    if (excludeCommands.indexOf(item.command) === -1) {
                        resultCommands.push(item);
                    }
                });

                return resultCommands;
            }

            var prefix = this.getPrefix(cmdLine);
            var recentlyUsedCommands = getFilteredCompletions(this.history(), prefix);
            var otherCommands = getUniqueCommandList(shortcutsArray, recentlyUsedCommands);
            otherCommands = getFilteredCompletions(otherCommands, prefix);

            if (recentlyUsedCommands.length && otherCommands.length) {
                recentlyUsedCommands[0]["message"] = " Recently used";
                otherCommands[0]["message"] = " Other commands";
            }

            var completions = recentlyUsedCommands.concat(otherCommands);
            return completions.length > 0 ? completions : [{
                value: "No matching commands",
                error: 1
            }];
        }
    });
};

prompt.modes = function(editor, callback) {
    var modesArray = modelist.modes;
    modesArray = modesArray.map(function(item) {
        return {value: item.caption, mode: item.name};
    });
    prompt(editor, "",  {
        name: "modes",
        selection: [0, Number.MAX_VALUE],
        onAccept: function(data) {
            if (data.item) {
                var modeName = "ace/mode/" + data.item.mode;
                editor.session.setMode(modeName);
            }
        },
        getPrefix: function(cmdLine) {
            var currentPos = cmdLine.getCursorPosition();
            var filterValue = cmdLine.getValue();
            return filterValue.substring(0, currentPos.column);
        },
        getCompletions: function(cmdLine) {
            function getFilteredCompletions(modes, prefix) {
                var resultCommands = JSON.parse(JSON.stringify(modes));

                var filtered = new FilteredList(resultCommands);
                return filtered.filterCompletions(resultCommands, prefix);
            }

            var prefix = this.getPrefix(cmdLine);
            var completions = getFilteredCompletions(modesArray, prefix);
            return completions.length > 0 ? completions : [{
                "caption": "No mode matching",
                "value": "No mode matching",
                "error": 1
            }];
        }
    });
};

dom.importCssString(".ace_prompt_container {\
    max-width: 600px;\
    width: 90%;\
    margin: 20px auto;\
    padding: 3px;\
    background: white;\
    border-radius: 2px;\
    box-shadow: 0px 2px 3px 0px #555;\
}");


exports.prompt = prompt;

});                (function() {
                    window.require(["ace/ext/prompt"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            