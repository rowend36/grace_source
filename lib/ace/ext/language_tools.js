/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2012, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";

var snippetManager = require("../snippets").snippetManager;
var Autocomplete = require("../autocomplete").Autocomplete;
var config = require("../config");
var lang = require("../lib/lang");
var util = require("../autocomplete/util");

var textCompleter = require("../autocomplete/text_completer");

var keyWordCompleter = {
    getCompletions: function(editor, session, pos, prefix, callback) {
        if (session.$mode.completer) {
            return session.$mode.completer.getCompletions(editor, session, pos, prefix, callback);
        }
        var state = editor.session.getState(pos.row);
        var completions = session.$mode.getCompletions(state, session, pos, prefix);
        callback(null, completions);
    }
};

var transformSnippetTooltip = function(str) {
    var record = {};
    return str.replace(/\${(\d+)(:(.*?))?}/g, function(_, p1, p2, p3) {
        return (record[p1] = p3 || '');
    }).replace(/\$(\d+?)/g, function (_, p1) {
        return record[p1];
    });
};

var snippetCompleter = {
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
                lang.escapeHTML(transformSnippetTooltip(item.snippet))
            ].join("");
        }
    }
};

var completers = [snippetCompleter, textCompleter, keyWordCompleter];
// Modifies list of default completers
exports.setCompleters = function(val, editor) {
    var list = editor ? editor.completers : completers;
    list.length = 0;
    if (val) list.push.apply(list, val);
};
exports.addCompleter = function(completer, editor) {
    var list = editor ? editor.completers : completers;
    var i = list.indexOf(completer);
    if (i < 0) list.push(completer);
};
exports.removeCompleter = function(completer, editor) {
    var list = editor ? editor.completers : completers;
    var i = list.indexOf(completer);
    if (i > -1) list.splice(i, 1);
};

// Exports existing completer so that user can construct his own set of completers.
exports.textCompleter = textCompleter;
exports.keyWordCompleter = keyWordCompleter;
exports.snippetCompleter = snippetCompleter;

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


Autocomplete.tabCommand = {
    name: 'tabAutoComplete',
    exec: function(editor/*, e*/) {
        var hasCompleter = editor.completer && editor.completer.activated;
        if (!hasCompleter && editor.getSelection().isEmpty() && util.getCompletionPrefix(editor)) {
            Autocomplete.startCommand.exec(editor,{tab:true});
        }
        else return false;
    },
    bindKey: "Tab"
};
Autocomplete.startCommand = {
    name: "startAutocomplete",
    exec: function(editor, e) {
        if (!editor.completer) {
            Autocomplete.for(editor).autoInsert = e && e.tab;
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

var Editor = require("../editor").Editor;
config.defineOptions(Editor.prototype, "editor", {
    enableAutocompletion: {
        set: function(val) {
            if (val) {
                if (!this.completers)
                    this.completers = completers.slice();
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
                    this.completers = completers.slice();
                this.commands.on('afterExec', doLiveAutocomplete);
            } else {
                this.commands.removeListener('afterExec', doLiveAutocomplete);
            }
        },
        value: false
    },
    enableBasicAutocompletion: {
        set: function (val) {
            if (!this.completers)
                this.completers = completers.slice();
            if (val) {
                exports.addCompleter(textCompleter, this);
                exports.addCompleter(keyWordCompleter, this);
            } else {
                exports.removeCompleter(textCompleter, this);
                exports.removeCompleter(keyWordCompleter, this);
            }
        },
        value: true,
        initialValue: true,
    },
    enableSnippets: {
        set: function(val) {
            if (!this.completers)
                this.completers = completers.slice();
            if (val) {
                this.commands.addCommand(expandSnippet);
                this.on('changeMode', onSnippetChangeMode);
                exports.addCompleter(snippetCompleter, this);
                onSnippetChangeMode(null, this);
            } else {
                exports.removeCompleter(snippetCompleter, this);
                this.commands.removeCommand(expandSnippet);
                this.off('changeMode', onSnippetChangeMode);
            }
        },
        value: true,
    },
    enableTabCompletion: {
        set: function(val) {
            if (val) {
                this.commands.addCommand(Autocomplete.tabCommand);
            }
            else this.commands.removeCommand(Autocomplete.tabCommand);
        },
        value: true
    }
});
});