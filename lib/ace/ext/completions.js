define(function(require, exports, module) {
"use strict";
var config = require("../config");
var lang = require("../lib/lang"); 
var util = require("../autocomplete/util");
var snippetManager = require("../snippets").snippetManager;

var textCompleter = require("../autocomplete/text_completer");
textCompleter.name = "textCompleter";

var keyWordCompleter = {
    name: "keywordCompleter",
    getCompletions: function(editor, session, pos, prefix, callback) {
        if (session.$mode.completer) {
            return session.$mode.completer.getCompletions(editor, session, pos, prefix, callback);
        }
        var state = editor.session.getState(pos.row);
        var completions = session.$mode.getCompletions(state, session, pos, prefix);
        callback(null, completions);
    }
};

var snippetCompleter = {
    name: "snipppetCompleter",
    getCompletions: function(editor, session, pos, prefix, callback) {
        var scopes = [];
        var token = session.getTokenAt(pos.row, pos.column);
        if (token && token.type.match(/(tag-name|tag-open|tag-whitespace|attribute-name|attribute-value)\.xml$/))
            scopes.push('html-tag');
        else
            scopes = snippetManager.getActiveScopes(editor);

        var snippetMap = snippetManager.snippetMap;
        var completions = [];
        scopes.forEach(function(scope) {
            var snippets = snippetMap[scope] || [];
            for (var i = snippets.length; i--;) {
                var s = snippets[i];
                var caption = s.name || s.tabTrigger;
                if (!caption)
                    continue;
                completions.push({
                    caption: caption,
                    snippet: s.content,
                    iconClass: "completion-snippet",
                    meta: s.tabTrigger && !s.name ? s.tabTrigger + "\u21E5 " : "snippet",
                    type: "snippet"
                });
            }
        }, this);
        callback(null, completions);
    },
    getDocTooltip: function(item) {
        if (item.type == "snippet" && !item.docHTML) {
            item.docHTML = [
                "<b>", lang.escapeHTML(item.caption), "</b>", "<hr></hr>",
                lang.escapeHTML(item.snippet)
            ].join("");
        }
    }
};
var expandSnippet = {
    name: "expandSnippet",
    exec: function(editor) {
        return snippetManager.expandWithTab(editor);
    },
    bindKey: "Tab"
};

var onSnippetChangeMode = function(e, editor) {
    loadSnippetsForMode(editor.session.$mode);
};

var loadSnippetsForMode = function(mode) {
    var id = mode.$id;
    if (!snippetManager.files)
        snippetManager.files = {};
    loadSnippetFile(id);
    if (mode.modes)
        mode.modes.forEach(loadSnippetsForMode);
};

var loadSnippetFile = function(id) {
    if (!id || snippetManager.files[id])
        return;
    var snippetFilePath = id.replace("mode", "snippets");
    snippetManager.files[id] = {};
    config.loadModule(snippetFilePath, function(m) {
        if (m) {
            snippetManager.files[id] = m;
            if (!m.snippets && m.snippetText)
                m.snippets = snippetManager.parseSnippetFile(m.snippetText);
            snippetManager.register(m.snippets || [], m.scope);
            if (m.includeScopes) {
                snippetManager.snippetMap[m.scope].includeScopes = m.includeScopes;
                m.includeScopes.forEach(function(x) {
                    loadSnippetFile("ace/mode/" + x);
                });
            }
        }
    });
};

var Autocomplete = require("../autocomplete").Autocomplete;

Autocomplete.tabCommand = {
    name: 'tabAutoComplete',
    exec: function(editor/*, e*/) {
        var hasCompleter = editor.completer && editor.completer.activated;
        if (!hasCompleter && editor.getSelection().isEmpty() && util.getCompletionPrefix(editor)) {
            var completer = Autocomplete.for(editor);
            completer.autoInsert = true;
            Autocomplete.startCommand.exec(editor);
        }
        else return false;
    },
    bindKey: "Tab"
};
Autocomplete.startCommand = {
    name: "startAutocomplete",
    exec: function(editor, e) {
        if (editor.$completerNeedsUpdate!=completerNeedsUpdate)
            updateCompleter(editor);
        if (!editor.completer) {
            Autocomplete.for(editor);
        }
        editor.completer.autoInsert = !(e && e.live);
        var provider,instance = false;
        if (editor.$enableIntelligentAutocompletion) {
            provider = getCurrentProvider(editor);
            instance = editor[provider.name];
        }
        if (instance !== editor.$usedIntellisense) {
            editor.completers = completers.slice(0);
            if (instance) {
                editor.completers.unshift(instance);
                if (editor.$enableBasicAutocompletion) {
                    if (!provider.hasText) {
                        editor.completers.push(textCompleter);
                    }
                    if (!provider.hasKeyWords) {
                        editor.completers.push(keyWordCompleter);
                    }
                }
            }
            else {
                if (editor.$enableBasicAutocompletion) {
                    editor.completers.push(textCompleter, keyWordCompleter);
                }
            }
            editor.$usedIntellisense = instance || false;
        }
        editor.completer.showPopup(editor);
        editor.completer.cancelContextMenu();
    },
    bindKey: "Ctrl-Space|Ctrl-Shift-Space|Alt-Space"
};

var doLiveAutocomplete = function(e) {
    var editor = e.editor;
    var hasCompleter = editor.completer && editor.completer.activated;
    if (e.command.name === "backspace") {
        if (hasCompleter && !util.getCompletionPrefix(editor))
            editor.completer.detach();
    }
    else if (!hasCompleter && e.command.name === "insertstring") {
        var prefix = util.getCompletionPrefix(editor);
        if (prefix) {
            var completer = Autocomplete.for(editor);
            completer.autoInsert = false;
            Autocomplete.startCommand.exec(editor,{live:true});
        }
    }
};


var completerNeedsUpdate = 0;
/**
 * A completion provider provides a completer on demand delaying
 * loading of potentially heavy resources. While most ServiceManagers
 * are tied to EditSessions, completionProviders are tied to editors.
 * Only one completion provider is enabled at a time.
 * 
 */
var completionProviders = {};
/*interface provider{
    name: string,
    init?: function(editor,cb),
    destroy?: <unused>
    options: object
    embeddable: boolean,//can be used in embedded modes eg only eg actually :) a javascript completer in html file
    hasKeyWords: boolean,//completes keywords ie disables keyword completer
    hasText: boolean,//completes random text ie disables text completer
    hasStrings: boolean,//completes strings <unused>
    priority: 0,
}
*/
exports.addCompletionProvider = function(provider, modes) {
    exports.removeCompletionProvider(provider);
    for (var i in modes) {
        if (completionProviders[modes[i]]) {
            completionProviders[modes[i]].push(provider);
        }
        else completionProviders[modes[i]] = [provider];
    }
    completerNeedsUpdate ++;
};
exports.removeCompletionProvider = function(provider) {
    var filter = function(p) {
        return p != provider;
    };
    for (var i in completionProviders) {
        if (completionProviders[i] && completionProviders[i].indexOf(provider)>-1) {
            completionProviders[i] = completionProviders[i].filter(filter);
        }
    }
    completerNeedsUpdate ++;
};
exports.getCompletionProviderByName = function getCompletionProviderByName(name) {
    for (var k in completers) {
        if (completers[k].name == name) {
            return completers[k];
        }
    }
    for (var i in completionProviders) {
        for (var j in completionProviders[i]) {
            var d = completionProviders[i][j];
            if (d.name == name) {
                return d;
            }
        }
    }
};
exports.setOptions = function(name, options) {
    var completer = exports.getCompletionProviderByName(name);
    if (completer) {
        completer.options = Object.assign({}, completer.options,options);
        if (completer.instance) {
            if (completer.onOptionChanged) {
                completer.onOptionChanged();
            }
        }
    }
};

var completers = [];
exports.setCompleters = function(val) {
    completers = val?val.slice(0):[];
    completerNeedsUpdate ++;
};
exports.addCompleter = function(completer,inFront) {
    if(completers.indexOf(completer)>0){
        return;
    }
    completers[inFront?"unshift":"push"](completer);
    completerNeedsUpdate ++;
};
exports.removeCompleter = function(completer){
    var index;
    while((index=completers.indexOf(completer))>0){
        completers.splice(index,1);
    }
    completerNeedsUpdate ++;
};


var onAfterExecDot = function(e/*, commandManager*/) {
    if (e.command.name === "insertstring") {
        var editor = e.editor;
        var hasCompleter = editor.completer && editor.completer.activated;
        var completer = getCurrentProvider(editor);
        if (hasCompleter || !completer || !completer.triggerRegex) {
            return;
        }
        var pos = editor.getSelectionRange().end;
        var tok = editor.session.getTokenAt(pos.row, pos.column);
        if(!completer.triggerRegex.test(editor.session.getLine(pos.row).substring(0,pos.column)))
            return;
        if (tok && !/string|comment/.test(tok.type.toString())) {
            editor.execCommand("startAutocomplete");
        }
    }
};

var onChangeMode = function(e, editor) {
    updateCompleter(editor);
};


function getInnerMode(editor) {
    return editor.session.getInnerMode();
    
}

function getCurrentProvider(editor) {
    if (!editor.activeProviders) return null;
    var mode = getInnerMode(editor);
    var active = completionProviders[mode];
    if (active) {
        for (var i = 0; i < editor.activeProviders.length; i++) {
            if (active.indexOf(editor.activeProviders[i]) > -1) {
                return editor.activeProviders[i];
            }
        }
    }
    return null;
}

var embedMap = exports.embedMappings = {
    "js-": "javascript",
    "css-": "css",
    "php-": "php"
};


function getProvider(scope, embeddable) {
    var primary;
    var completers = completionProviders[scope];
    if (completers && completers.length) {
        for (var i = 0; i < completers.length; i++) {
            if ((!embeddable || completers[i].embeddable) && (!primary || primary.priority <= completers[i].priority)) {
                primary = completers[i];
            }
        }
    }
    return primary;
}

function getActiveProviders(mode) {
    var all = [];
    var scope = mode.$id.split("/").pop();
    var main = getProvider(scope);
    if (main) all.push(main);
    for (var j in mode.$embeds) {
        var innerMode = embedMap[mode.$embeds[j]];
        var inner = getProvider(innerMode, true);
        if (inner) {
            if (all.indexOf(inner) < 0) all.push(inner);
        }
    }
    return all;
}

function initProvider(editor,provider){
    editor.activeProviders.push(provider);
    var token = completerNeedsUpdate;
    if (provider.init) {
        var instance = editor[provider.name];
        if (instance) {
            editor.completers.unshift(instance);
        } else {
            provider.init(editor, function (instance) {
                if (instance && provider.name) {
                    editor[provider.name] = instance;
                    editor.completers.unshift(instance);
                    if (
                        editor[provider.name] &&
                        completerNeedsUpdate == token
                    ) {
                        editor._signal("updateCompleter", {
                            provider: provider,
                            instance: instance,
                        });
                    }
                }
            });
        }
    } else {
        editor[provider.name] = provider;
        editor.completers.unshift(provider);
    }
    if (!editor.$enabledDotCompletion && provider.triggerRegex) {
        editor.$enabledDotCompletion = !!provider.triggerRegex;
        editor.commands.on("afterExec", onAfterExecDot);
    }
}
function releaseProvider(editor, provider) {
    var m = editor.activeProviders.indexOf(provider);
    if (m > -1) {
        editor.activeProviders.splice(m, 1);
    }
}

function updateCompleter(editor) {
    if (!editor.activeProviders) editor.activeProviders = [];
    editor.$completerNeedsUpdate = completerNeedsUpdate;
    editor.$usedIntellisense = undefined;
    var mode = editor.session.$mode;
    var completers = getActiveProviders(mode);
    for (var i = 0; i < editor.activeProviders.length; i++) {
        if (completers.indexOf(editor.activeProviders[i]) < 0) {
            releaseProvider(editor, editor.activeProviders[i]);
        }
    }
    for (var j = 0; j < completers.length; j++) {
        if (editor.activeProviders.indexOf(completers[j]) < 0) {
            initProvider(editor, completers[j]);
        }
    }
    if (completers.length < 1 && editor.$enabledDotCompletion) {
        editor.commands.off("afterExec", onAfterExecDot);
        editor.$enabledDotCompletion = false;
    }
}


exports.updateCompleter = updateCompleter;

var Editor = require("../editor").Editor;
Editor.prototype.getMainCompleter = function(){
    var m = getCurrentProvider(this);
    return m && this[m.name];
};
config.defineOptions(Editor.prototype, "editor", {
    enableBasicAutocompletion: {
        set: function(val) {
            if (val) {
                if (!this.completers)
                    this.completers = Array.isArray(val)? val: completers;
                this.commands.addCommand(Autocomplete.startCommand);
            } else {
                this.commands.removeCommand(Autocomplete.startCommand);
            }
        },
        value: false
    },
    //Used by Autocomplete when showing doc tooltips
    enableCompletionTooltips: {
        value: true
    },
    enableLiveAutocompletion: {
        set: function(val) {
            if (val) {
                if (!this.completers)
                    this.completers = Array.isArray(val)? val: completers;
                this.commands.on('afterExec', doLiveAutocomplete);
            } else {
                this.commands.removeListener('afterExec', doLiveAutocomplete);
            }
        },
        value: false
    },
    enableSnippets: {
        set: function(val) {
            if (val) {
                this.commands.addCommand(expandSnippet);
                this.on("changeMode", onSnippetChangeMode);
                exports.addCompleter(snippetCompleter);
                onChangeMode(null, this);
            } else {
                exports.removeCompleter(snippetCompleter);
                this.commands.removeCommand(expandSnippet);
                this.off("changeMode", onSnippetChangeMode);
            }
        },
        value: false
    },
    enableTabCompletion: {
        set: function(val) {
            if (val) {
                this.commands.addCommand(Autocomplete.tabCommand);
            }
            else this.commands.removeCommand(Autocomplete.tabCommand);
        },
        value: true
    },
    enableIntelligentAutocompletion: {
        set: function(val) {
            if (val) {
                this.on("changeMode", onChangeMode);
                this.completers = [];
                updateCompleter(this);
                if (!this.$enableBasicAutocompletion) {
                    this.commands.addCommand(Autocomplete.startCommand);
                }
            }
            else {
                this.off('changeMode', onChangeMode);
                updateCompleter(this);
                if (!this.$enableBasicAutocompletion) {
                    this.commands.removeCommand(Autocomplete.startCommand);
                }
            }
        },
        value: true
    }
});
});