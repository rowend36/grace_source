define(function(require, exports, module) {
"use strict";
var config = require("../config");
var lang = require("../lib/lang"); 
var util = require("../autocomplete/util");
var snippetManager = require("../snippets").snippetManager;
var EventEmitter = require("../lib/event_emitter").EventEmitter;
var Annotations = require("../annotations").Annotations;

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
    exec: function(editor, e) {
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
        var useIntellisense = false;
        var server = editor.completionProvider,
            instance;
        if (editor.$enableIntelligentAutocompletion) {
            if (server && isEnabled(server, editor) && (instance = editor[server.name])) {
                useIntellisense = instance;
            }
        }
        if (useIntellisense !== editor.$usedIntellisense) {
            editor.completers = completers.slice(0);
            if (useIntellisense) {
                editor.completers.unshift(instance);
                if (editor.$enableBasicAutocompletion) {
                    if (!server.hasText) {
                        editor.completers.push(textCompleter);
                    }
                    if (!server.hasKeyWords) {
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
//More like completer provider
var completionProviders = {};
/*interface provider{
    //allows bundling diverse helper functionality
    //into a single worker or service, override
    //release and init to add more functions
    //use updateAnnotations/updateArgHints as example
    name: string,
    init?: function(editor,cb),
    release?: function(editor,instance),
    destroy?: <unused>
    options: object
    embeddable: boolean,//can be used in embedded modes eg only eg actually :) a javascript completer in html file
    hasArgHints: boolean,//implements updateArgHints(editor)
    hasKeyWords: boolean,//completes keywords ie disables keyword completer
    hasText: boolean,//completes random text ie disables text completer
    hasStrings: boolean,//completes strings <unused>
    priority: 0,
    hasAnnotations: boolean,//instances implements updateAnnotations(editor)
    hasReferences: boolean //<unused>
    hasDefinition: boolean //<unused>
}
*/
exports.addCompletionProvider = function(provider, modes) {
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


var onAfterExecDot = function(e, commandManager) {
    if (e.command.name === "insertstring") {
        var editor = e.editor;
        var hasCompleter = editor.completer && editor.completer.activated;
        var completer = editor.completionProvider;
        if (hasCompleter || !completer || !isEnabled(completer, e.editor)) {
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

var onCursorChange = function(e,editor) {
    clearTimeout(editor.$debounceArgHints);
    editor.$debounceArgHints = setTimeout($onCursorChange.bind(editor),100);
};
var $onCursorChange = function(){
    var editor=this,server = editor.completionProvider,
        instance;
    if (isEnabled(server, editor) && (instance = editor[server.name])) {
        instance.updateArgHints(editor);
    }
};

var onValueChangeForAnnotations = function(e,editor) {
    clearTimeout(editor.$debounceAnnotations);
    editor.$debounceAnnotations = setTimeout($onValueChange.bind(editor), 2000);
};
var $onValueChange = function(){
    var editor = this,server = editor.completionProvider,
        instance;
    if (isEnabled(server, editor) && (instance = editor[server.name])) {
        instance.updateAnnotations(editor,editor.$errorsProvider.update.bind(editor.$errorsProvider,editor.session.id));
    }
};
var onChangeMode = function(e, editor) {
    updateCompleter(editor);
};


function getCurrentMode(editor) {
    var scope = editor.session.$mode.$id || "";
    scope = scope.split("/").pop();
    return scope;
}

function getInnerMode(editor) {
    var embeds = editor.session.$mode.$embeds;
    if (embeds) {
        var c = editor.getCursorPosition();
        var state = editor.session.getState(c.row);
        if (typeof state === "object" && state[0]) {
            state = state[0];
        }
        if (typeof state == 'string') {
            for (var i in embedMap) {
                if (state.slice(0,i.length)==i)
                    return embedMap[i];
            }
        }
    }
}

function isEnabled(completer, editor) {
    var mode = getCurrentMode(editor);
    var completers = completionProviders[mode];
    if (completers && completers.indexOf(completer) > -1) {
        return true;
    }
    if (completer.embeddable) {
        var innerMode = getInnerMode(editor);
        completers = completionProviders[innerMode];
        if (completers && completers.indexOf(completer) > -1) {
            return true;
        }
    }
    return false;
}

var embedMap = exports.embedMappings = {
    "js-": "javascript",
    "css-": "css",
    "php-": "php"
};

function initCompleter(completer, editor, cb) {
    if (completer.init) {
        var instance = editor[completer.name];
        if (instance) {
            editor.completers.unshift(instance);
            cb && cb(instance);
        }
        else {
            completer.init(editor, function(instance) {
                if (instance && completer.name) {
                    editor[completer.name] = instance;
                    editor.completers.unshift(instance);
                }
                cb && cb(instance);
            });
        }
    }
    else {
        editor[completer.name] = completer;
        editor.completers.unshift(completer);
        cb && cb(completer);
    }
}

function releaseCompleter(editor) {
    if (editor.completionProvider.release) {
        editor.completionProvider.release(editor, editor[editor.completionProvider.name]);
        delete editor[editor.completionProvider.name];
    }
    else if (!editor.completionProvider.init)
        delete editor[editor.completionProvider.name];
    editor.completionProvider = null;
}

function getCompleter(scope, embeddable) {
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

function getActiveCompleter(mode) {
    var scope = mode.$id.split("/").pop();
    var main = getCompleter(scope);
    if (!mode.$embeds || main) {
        return {
            main: main
        };
    }
    var embeds = {};
    for (var j in mode.$embeds) {
        var innerMode = embedMap[mode.$embeds[j]];
        var inner = getCompleter(innerMode, true);
        if (inner) {
            if (!main) {
                main = inner;
            }
            embeds[innerMode] = inner;
        }
        return {
            main: main,
            embeds: embeds
        };
    }
}

function updateArgHints(editor, primary) {
    if (primary && primary.hasArgHints && editor.$enableArgumentHints) {
        if (!editor.$onSmartCursorChange) {
            editor.$onSmartCursorChange = onCursorChange;
            editor.on('changeSelection', editor.$onSmartCursorChange);
        }
    }
    else if (editor.$onSmartCursorChange) {
        editor.off('changeSelection', editor.$onSmartCursorChange);
        editor.$onSmartCursorChange = null;
        clearTimeout(editor.$debounceArgHints);
    }
}
//Gotten from ace tests
function SimpleWorker(editor) {
    this.isGlobal = true;
    this.editor = editor;
}
SimpleWorker.prototype = Object.create(EventEmitter);
SimpleWorker.prototype.addDocument = function(id, doc) {
};
SimpleWorker.prototype.removeDocument = function(id) {
};
SimpleWorker.prototype.terminate = function() {
    this._signal('terminate');
};
SimpleWorker.prototype.update = function(id, data) {
    this._emit('annotate', { data: {doc:id, data: data } });
};
SimpleWorker.prototype.canHandle = function(mode, session) {
    //handles only the currently active session
    return (this.editor.completionProvider && session === this.editor.session) ? this.editor.completionProvider.priority : false;
};
SimpleWorker.prototype.createWorker = function() {
    return this;
};

var onChangeSessionForAnnotations = function(e,editor){
    var session = editor.session;
    //This is guaranteed to be a no-op if the editor is
    //already enabled for this session
    if (session) {
        Annotations.updateWorkers(session);
        //To avoid restarting workers unnecessarily
        if (!session.$restartWorker)
            scheduleRestartWorker(session);
        $onValueChange.apply(editor);
    }
};
/*reset the sessions worker to mode default*/
function scheduleRestartWorker(session){
    session.$restartWorker = function (e) {
        if (e.editor && !e.editor.$onChangeSessionForAnnotations) {
            session.off("changeEditor", session.$restartWorker);
            session.$restartWorker = null;
            Annotations.updateWorkers(session);
        }
    };
    session.on("changeEditor", session.$restartWorker);
}
/*
 * Overrides the default worker for the editor's session
 * Automatically resets it when the session is moved to another editor
 */
function updateAnnotations(editor,primary){
    if(primary && primary.hasAnnotations){
        /*Create the annotation provider interface that will be reused in subsequent runs*/
        if(!editor.$errorsProvider){
            editor.$errorsProvider = new SimpleWorker(editor);
        }
        if(!editor.$onChangeSessionForAnnotations){
            var id = Annotations.registerProvider(editor.$errorsProvider);
            //store the id so it can be reused
            editor.$errorsProvider.$id = id;
            
            //enable the interface for only the active session
            editor.$onChangeSessionForAnnotations = onChangeSessionForAnnotations;
            editor.on("changeSession",editor.$onChangeSessionForAnnotations);
            editor.on("change",onValueChangeForAnnotations);
            editor.$onChangeSessionForAnnotations(editor,editor);
        }
    }
    else if(editor.$onChangeSessionForAnnotations){
        clearTimeout(editor.$debounceAnnotations);
        editor.off("change",onValueChangeForAnnotations);
        editor.off("changeSession",editor.$onChangeSessionForAnnotations);
        Annotations.unregisterProvider(editor.$errorsProvider);
        editor.$onChangeSessionForAnnotations = null;
        if(editor.session.$restartWorker)
            editor.session.$restartWorker({editor:editor});
    }
}

function updateCompleter(editor) {
    editor.$completerNeedsUpdate = completerNeedsUpdate;
    editor.$usedIntellisense = undefined;
    var mode = editor.session.$mode;
    var completers = getActiveCompleter(mode);
    var primary = editor.$enableIntelligentAutocompletion?completers.main:null;
    if (completers.embeds) {
    }
    if (primary === editor.completionProvider)
        return;
    if (editor.completionProvider) {
        releaseCompleter(editor);
    }
    var waiting = false;
    if (primary) {
        editor.completionProvider = primary;
        initCompleter(primary, editor,function(/*instance*/){
            if(editor.completionProvider == primary && waiting){
                $onValueChange.apply(editor);
            }
        });
        if (!editor.$enableDotCompletion && primary.triggerRegex) {
            editor.$enableDotCompletion = primary.triggerRegex;
            editor.commands.on('afterExec', onAfterExecDot);
        }
    }
    else if (editor.$enableDotCompletion) {
        editor.commands.off('afterExec', onAfterExecDot);
        editor.$enableDotCompletion = false;
    }
    waiting = primary && primary.hasAnnotations && !editor[primary.name];
    updateAnnotations(editor, primary);
    updateArgHints(editor, primary);
    editor._signal('changeCompleter',{provider:primary,instance:primary && editor[primary.name]});
}

exports.updateCompleter = updateCompleter;

var Editor = require("../editor").Editor;
Editor.prototype.getMainCompleter = function(){
    return this.completionProvider && this.completionProvider[this.completionProvider.name];
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
    enableArgumentHints: {
        set: function(val) {
            updateArgHints(this, this.completionProvider);
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