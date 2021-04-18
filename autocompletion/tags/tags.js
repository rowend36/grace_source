//See analogy.txt
_Define(function(global) {
    var words = {};
    var getMode = global.modelist.getModeForPath;
    var supportedModes = ["java", "python", "javascript", "c_cpp", "tsx", "typescript", "jsx"];
    var RE = /[a-zA-Z\$\-\u00C0-\u1FFF\u2C00-\uD7FF][a-zA-Z_0-9\$\-\u00C0-\u1FFF\u2C00-\uD7FF\w]*/g;
    var Docs = global.Docs;
    var getProject = global.FileUtils.getProject;
    var Utils = global.Utils;
    var relative = global.FileUtils.relative;
    var BaseServer = global.BaseServer;
    var tagFinders = global.TagFinders = {
        "text": function(res) {
            var matches = res.match(RE);
            return matches && matches.map(function(e) {
                return (" " + e).substring(1);
            });
        }
    };

    var appConfig = global.registerAll({
        "enableTagGathering": "javascript,python,c_cpp,java,text,php",
        "disableTags": "jsx,typescript,tsx",
        "enableWordsGathering": "python"
    }, "autocompletion");
    global.registerValues({
        'disableTags': 'A comma-separated list of modes eg python,c_cpp,js to in which disable tag completion.\nSpecifying true disables tags globally',
        'enableTagGathering': 'A comma-separated list of modes from which tags can be gathered\nSpecifying "true" enables tag gathering for all file types\nUnsupported modes will fall back to words ie modes outside ' + supportedModes.join(", "),
        'enableWordsGathering': 'A comma-separated list of modes from which all words should be gathered to supplement tags.\nUseful if tag support is not good enough and only works if enableTagGathering is enabled for that mode'
    });
    global.configEvents.on("autocompletion", function(e) {
        switch (e.config) {
            case "disableTags":
                updateSupportedModes(e.newValue);
        }
    });
    var completions = global.Completions;
    var disabledModes;

    function updateSupportedModes(t) {
        disabledModes = {};
        completions.removeCompletionProvider(global.TagCompleter);
        completions.removeCompleter(global.TagCompleter);
        if (t === true) {
            return;
        }
        completions.addCompleter(global.TagCompleter);
        completions.addCompletionProvider(global.TagCompleter, supportedModes);
        var a = Utils.parseList(t);
        for (var i in a) {
            disabledModes[a[i]] = true;
        }
    }
    var lastUpdate = 0;

    function pretty(text) {
        //dumbass syntax highlighting
        return typeof(text) == "string" ? text.replace(/\w+/g, function(match) {
            switch (match.toLowerCase()) {
                case 'fn':
                case 'class':
                case 'private':
                case 'const':
                case 'var':
                case 'public':
                case 'enum':
                case 'interface':
                case 'private':
                    return '<span class="red-text">' + match + '</span>';
            }
            return '<span class="blue-text">' + match + '</span>';
        }) : "";
    }

    var lang = global.libLang;
    var TAGS = 'tags';
    var resolvers = global.ImportResolvers = {};
    var scopeSolvers = global.ScopeSolvers = {};
    var defaultScope = [{
        start: 0,
        end: Infinity
    }];

    function scopeIterator(scopes) {
        var rootScopes = [];
        for (var i = scopes.length - 1; i >= 0; i--) {
            if (scopes[i].parent) break;
            rootScopes.push(scopes[i]);
        }
        var lastScope = rootScopes[0];
        if (!lastScope) return Utils.noop;
        scopes = null;
        var findScope = function(scope, loc, fromChild, fromParent) {
            if (scope.end >= loc && scope.start <= loc) {
                for (var i in scope.children) {
                    if (scope.children[i] != fromChild) {
                        //go deeper
                        var deeper = findScope(scope.children[i], loc, null, scope);
                        if (deeper) return deeper;
                    }
                } //last correct opt
                lastScope = scope;
                return scope;
            } else if (scope.parent && !fromParent) {
                return findScope(scope.parent, loc, scope);
            }
            //last wrong op
            lastScope = scope;
        };
        return function(loc) {
            var res = findScope(lastScope, loc);
            if (res) return res;
            var checked = lastScope;
            if (rootScopes.length > 1) {
                return rootScopes.some(function(e) {
                    return e != checked && findScope(e, loc);
                });
            }
        };
    }
    var TextStream = function(text) {
        this.res = text;
        this.index = 0;
    };
    TextStream.prototype.next = function() {
        if (this.res) {
            this.current = this.res;
            this.res = null;
        } else {
            if (this.current)
                this.index += this.current.length;
            this.current = null;
        }
        return this.current;
    };
    TextStream.prototype.getCurrentIndex = function() {
        return this.index;
    };
    var DocStream = function(doc) {
        this.res = doc.session.getDocument();
        this.lineEnding = doc.session.getNewLineCharacter();
        this.lineIndex = this.index = 0;
        this.current = "";
        this.index = 0;
    };
    DocStream.prototype.next = function() {
        if (this.lineIndex == this.res.getLength()) return (this.current = null);
        this.index += this.current.length;
        this.current = this.res.getLine(this.lineIndex++) + this.lineEnding;
        return this.current;
    };
    DocStream.prototype.getCurrentIndex = function() {
        return this.index;
    };
    var Tags = function() {
        Tags.super(this, [global.Functions]);
    };
    Tags.prototype = {
        constructor: Tags,
        loadTags: function(filename, res, noOverwrite, mode) {
            if (noOverwrite && words[filename]) return;
            mode = mode || getMode(filename).name;
            if (appConfig.enableTagGathering !== true) {
                if (Utils.parseList(appConfig.enableTagGathering).indexOf(mode) < 0) return;
            }
            var allowText = true;
            if (appConfig.enableWordsGathering !== true) {
                if (Utils.parseList(appConfig.enableWordsGathering).indexOf(mode) < 0) allowText = false;
            }
            var completions = {};
            var tagger = (tagFinders[mode] || tagFinders.text);
            var tags;
            var stream;
            if (typeof res == 'object') {
                res.$lastTagUpdate = res.getRevision();
                stream = new DocStream(res);
                if (tagger.findAllDoc) {
                    tags = tagger.findAllDoc(res, filename, allowText);
                    res = null;
                } else res = res.getValue();
            } else stream = new TextStream(res);
            if (res)
                tags = (tagger.findAll || tagger)(res, filename, allowText);
            if (!tags) return;
            completions["!scopes"] = (scopeSolvers[mode] ? scopeSolvers[mode](stream) : [])
            var findScope = scopeIterator(completions["!scopes"]);
            tags.forEach(function(a, b) {
                //remove duplicates unless they
                //have a different scope or signature
                var caption;
                if (!a) return;
                if (typeof(a) == "string") {
                    caption = a;
                    a = undefined;
                } else {
                    caption = a.caption;
                    if (a.signature)
                        a.scope = findScope(a.loc);
                }
                if (!caption) return;
                var left = a && (a.scope || a.signature);
                var i = 0,
                    key = caption;
                while (true) {
                    var dup = completions[key];
                    if (!dup) {
                        completions[key] = a;
                        break;
                    } else if (!left) break;
                    var right = (dup.scope && (!a || a.scope != dup.scope)) ||
                        (dup.signature && (!a || dup.signature != a.signature));
                    if (!right) {
                        if (dup.doc) a.doc = (a.doc ? a.doc + "\n" : "") + dup.doc;
                        completions[key] = a;
                        break;
                    }
                    key = caption + "(" + i++ + ")";
                }
            });
            words[filename] = completions;
        },
        embeddable: false,
        isSupport: false,
        hasArgHints: true,
        priority: 10,
        hasAnnotations: false,
        hasKeyWords: false,
        hasText: false,
        hasStrings: false,
        name: "tagServer",
        triggerRegex: /(?:\.|\-\>|\:\:)$/,
        normalizeName: function(name) {
            return name;
        },
        removeDoc: Utils.noop,
        sendDoc: Utils.noop,
        refreshDoc: Utils.noop,
        docChanged: Utils.noop,
        trackChange: Utils.noop,
        requestDefinition: function(editor, cb, varName) {
            var cursor = editor.getSelection().cursor;
            var pos = editor.session.getDocument().positionToIndex(cursor);
            var name = varName || editor.session.getTokenAt(cursor.row, cursor.column);
            name = varName || name && name.value;
            if (!name) return this.ui.showError(editor, 'No name found at position');
            var tags = this.query(name, pos, this.options.getFileName(editor.session), false, true);
            if (tags) {
                cb({
                    file: tags[0].fileName,
                    span: {
                        start: tags[0].item.locStart || tags[0].item.loc || 0,
                        length: 0
                    }
                });
            } else this.ui.showInfo(editor, 'No tag found');
        },
        requestType: function(editor, pos, cb) {
            pos = pos || editor.getSelectionRange().end;
            var name = editor.session.getTokenAt(pos.row, pos.column);
            if (!name || !/\w/.test(name.value)) name = editor.session.getTokenAt(pos.row, pos.column + 1);
            if (!name) cb('No name found at position');
            var tags = this.query(name.value, pos, this.options.getFileName(editor.session), false, true);
            if (tags) {
                cb(null, tags)
            } else this.ui.showInfo(editor, 'No tag found');

        },
        requestArgHints: function(editor, cursor, cb) {
            var pos = editor.session.getDocument().positionToIndex(cursor);
            var name = editor.session.getTokenAt(cursor.row, cursor.column + 1);
            var doc = this.query(name.value, pos, this.options.getFileName(editor.session), true, true);
            if (doc) cb(doc);
            else {
                //get constructor
                //this.query(name.value,pos, this.options.getFileName(editor.session),true,true);
            }
        },
        genArgHintHtml: function(tip, pos) {
            return tip.map(function(e) {
                return e.item.signature;
            }).join("</br>");
        },
        genInfoHtml: function(tip, notCompletion) {
            return "<pre>" + tip.map(function(e) {
                return e.item.doc;
            }).join("\n\n") + "</pre>";
        },
        get allTags() {
            return words;
        },
        query: function(name, pos, file, fnOnly, allowGlobal) {
            this.updateDoc(file);
            var tags = words[file];
            if (fnOnly) name += "(";

            function allWords(tags, name) {
                var words = [];
                var duplicates = name + "(";
                for (var i in tags) {
                    if (tags[i] && i == name || i.startsWith(duplicates)) {
                        words.push(tags[i]);
                    }
                }
                return words;
            }
            if (tags) {
                var scopes = (tags["!scopes"] || []).filter(function(el) {
                    return el.start <= pos && el.end >= pos;
                });
                var locals = allWords(tags, name).map(function(a) {
                    //in the same scope > lexically closer;
                    var posStart = a.locStart || a.loc || 0;
                    var pos_ = a.locEnd || posStart;
                    var score = 0;
                    var found;
                    scopes.some(function(el, i) {
                        //is this a shared scope
                        return (el.start <= posStart && el.end >= posStart && (found = arguments));
                    });
                    if (found) {
                        //outer scopes are at the end
                        score += 100000 * (scopes.length - found[1]);
                    }
                    score += Math.abs(posStart - pos);
                    return {
                        score: score,
                        scope: found && found[0],
                        item: a,
                        fileName: file
                    };
                }).sort(function(a, b) {
                    return a.score - b.score;
                });
                if (locals.length) return locals;
            }


            if (allowGlobal !== false) {
                for (var i in words) {
                    var result = this.query(name, 0, i, false, false);
                    if (result) return result;
                }
            }
            return null;
        },
        init: function(editor, cb) {
            completions.removeCompleter(this);
            this.bindAceKeys(editor);
            cb(this);
        },
        release: function(editor, self) {
            this.unbindAceKeys(editor);
            this.docs = {};
            completions.addCompleter(this);
        },
        addDoc: function(name, session) {
            this.docs = {};
            return (this.docs[name] = {
                name: name,
                doc: session
            });
        },
        clear: function() {
            words = {};
        },
        updateDoc: function(path) {
            var doc = Docs.forPath(path);
            if (doc) {
                if (doc.$lastTagUpdate !== doc.getRevision()) {
                    doc.$lastTagUpdate = doc.getRevision();
                    global.TagCompleter.loadTags(path, doc.getValue(), null, doc.session.getMode().$id.split("/").pop());
                }
            }
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            var mode = session.getMode().$id.split("/").pop();
            if (disabledModes[mode]) return;
            var doc = Docs.forSession(session);
            var paths = Object.keys(words);
            var path = doc && doc.getSavePath();
            if (path) {
                var resolver = resolvers[mode];
                if (resolver) {
                    paths = resolver.filter(paths, doc) || paths;
                } else {

                }
            }
            var projectRoot = getProject().rootDir;
            var completions = [];
            var uniq = {};
            var now = new Date().getTime();

            if (now - lastUpdate > 5000) {
                for (var i in paths) {
                    this.updateDoc(paths[i]);
                }
                lastUpdate = now;
            }
            paths.forEach(function(a) {
                var current = (a == path);
                var rel = relative(projectRoot, a) || a;
                var opts = words[a];
                for (var i in opts) {
                    if (i[0] == "!") continue;
                    if (!opts[i]) {
                        if (current) continue;
                        if (uniq[i]) {
                            continue;
                        }
                        uniq[i] = true;
                    }

                    if (i.indexOf(prefix) > -1) {
                        completions.push({
                            type: TAGS,
                            caption: i,
                            meta: rel,
                            value: (opts[i] && opts[i].caption) || i,
                            message: opts[i] && opts[i].signature,
                            doc: opts[i] && opts[i].doc,
                            score: (opts[i] && (opts[i].getScore ? opts[i].getScore(prefix) : opts[i].score)) || 0
                        });
                    }
                }
            });
            callback(null, completions);
        },
        getDocTooltip: function(item) {
            if (item.type == TAGS && !item.docHTML && (item.doc)) {
                item.docHTML = ["<span>" + item.value + "</span>",
                    (item.doc ? "<br/><pre style='font-family:monospace;width:100%;padding:0;margin:5px;background:rgb(0,0,0,0.1)'>" + lang.escapeHTML(item.doc) + "</pre>" : ""),
                    "<br/><i style:'font-size:smaller'class='grey-text'>" + item.meta + "</i>",
                ].join("");
            }
        }
    };
    Utils.inherits(Tags, BaseServer);
    global.ServerUtils.createCommands(Tags.prototype, "tagServer", "tags")
    global.TagCompleter = new Tags();
    updateSupportedModes(appConfig.disableTags);
}); /*_EndDefine*/
_Define(function(global) {
    var LineStream = function(stream, regex) {
        this.stream = stream;
        this.buf = "";
        this.regex = regex || /\r\n|\n|\r/g;
    }
    LineStream.prototype.next = function() {
        if (!this.buf) {
            this.buf = this.stream.next();
            this.index = 0;
        } else this.index += this.current.length;
        if (this.buf === null) return (this.current = this.buf = null);
        var lineEnd = this.regex;
        lineEnd.lastIndex = 0;
        var next = lineEnd.exec(this.buf);
        while (!next && this.stream.current) {
            this.buf += (this.stream.next() || "");
            //can \r\n be split into two
            next = lineEnd.exec(this.buf);
        }
        var index = next ? lineEnd.lastIndex : this.buf.length;
        this.current = this.buf.substring(0, index);
        this.buf = this.buf.substring(index);
        return this.current;
    }
    LineStream.prototype.getCurrentIndex = function() {
        return this.index + this.stream.getCurrentIndex();
    }
    var BlockFilter = function(start, stream) {
        this.start = new RegExp(start, 'g');
        this.stream = stream;
        this.buf = "";
        this.index = 0;
    }
    BlockFilter.prototype.next = function() {
        if (!this.buf) {
            this.buf = this.stream.next();
            this.index = 0;
        } else this.index += (this.current.length + this.filteredLength);
        this.isPending = !!this.buf;
        this.filteredLength = 0;
        if (this.buf === null) return (this.current = this.buf = null);
        this.start.lastIndex = 0;
        var blockStart = this.start.exec(this.buf);
        if (blockStart) {
            this.current = this.buf.substring(0, blockStart.index);
            var end, start = blockStart[0].length + blockStart.index;
            var filtered = "";
            //shows if the search has spanned more than one block
            var finish = true;
            do {
                end = this.findEnding(blockStart, start);
                if (end < 0) {
                    filtered += this.buf;
                    if (finish) {
                        start = 0;
                        finish = false;
                    }
                    this.buf = this.stream.next();
                } else {
                    filtered += this.buf.substring(blockStart.index, end);
                    this.buf = this.buf.substring(end);
                    break;
                }
            }
            while (this.buf)
            this.isPending = finish && !!this.buf;
            this.filteredLength = filtered.length;
            return this.current;
        }
        this.current = this.buf;
        this.buf = "";
        this.isPending = false;
        return this.current;
    }
    BlockFilter.prototype.getCurrentIndex = function() {
        return this.stream.getCurrentIndex() + this.index;
    }
    var LineFilter = function(start, stream) {
        LineFilter.super(this, [start, stream]);
        this.end = new RegExp("\\r\\n|\\r|\\n", 'g');
    }
    LineFilter.prototype.findEnding = function(blockStart, start) {
        this.end.lastIndex = start;
        var blockEnd = this.end.exec(this.buf);
        return (blockEnd ? this.end.lastIndex : -1);
    }
    var RegionFilter = function(starts, stream) {
        var start = [];
        for (var i in starts) {
            start.push("(" + starts[i].open + ")");
        }
        this.starts = starts;
        RegionFilter.super(this, [start.join("|"), stream]);
    }
    RegionFilter.prototype.findEnding = function(start, from) {
        for (var k in this.starts) {
            if (start[k]) {
                var end = this.starts[k];
                var close = end.close || start[0];
                var escaped = false;
                var brkNewLine = end.breaksOnNewLine;
                var hasEscape = end.hasEscapes;
                for (var i = from; i < this.buf.length; i++) {
                    var char = this.buf[i];
                    if (escaped) escaped = false;
                    else if (hasEscape && char == "\\") escaped = true;
                    else if (char == close[0] && (close.length == 1 || this.buf.substring(i, i + close.length) == close)) break;
                    else if (end.breaksOnNewLine && char == '\n') break;
                }
                if (i == this.buf.length) {
                    return -1;
                }
                return i + close.length;
            }
        }
        return -1;
    }
    global.Utils.inherits(LineFilter, BlockFilter);
    global.Utils.inherits(RegionFilter, BlockFilter);
    var pyScopeFinder = function(stream) {
        var multiLine;
        stream =
            new LineFilter("\\#",
                (multiLine = new RegionFilter([{
                    open: "\\\"",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\\'",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\\`",
                    hasEscapes: true,
                    breaksOnNewLine: true
                }, {
                    open: "\"\"\"",
                    hasEscapes: true,
                }, {
                    open: "'''",
                    hasEscapes: true,
                }], new LineStream(stream))));
        var scopes = [],
            scope;
        var colon = ":";
        var indent = /^[ \t]+\S/g;
        var rootIndent = 0;
        var lastIndent = rootIndent;
        var s = new global.Document(stream.stream.stream.stream.res);
        while (stream.next() != null) {
            var current = stream.current;
            var index = stream.getCurrentIndex();
            while (stream.current != null && multiLine.isPending) {
                current += (stream.next() || "");
            }
            indent.lastIndex = 0;
            var found = indent.exec(current),
                newIndent;
            var newIndent;
            if (found) {
                newIndent = found[0].length - 1;
            } else continue;
            if (newIndent > lastIndent) {
                var newscope = {
                    indent: newIndent,
                    start: index,
                    pos: s.indexToPosition(index),
                    parent: scope
                };
                if (scope) {
                    if (scope.children) scope.children.push(newscope);
                    else scope.children = [newscope];
                }
                lastIndent = newIndent;
                scope = newscope;
            } else
                while (newIndent < lastIndent) {
                    scope.end = index - 1;
                    scopes.push(scope);
                    scope = scope.parent;
                    if (scope)
                        lastIndent = scope.indent;
                    else lastIndent = 0;
                }
        }
        while (scope) {
            scope.end = stream.getCurrentIndex();
            scopes.push(scope);
            scope = scope.parent;
        }
        return scopes;
    }
    var cScopeFinder = function(stream) {
        stream = new LineFilter("\\/\\/",
            new RegionFilter([{
                open: "\\\"",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\'",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\`",
                hasEscapes: true,
                breaksOnNewLine: true
            }, {
                open: "\\/\\*",
                close: "*/"
            }, {
                name: 'regex',
                open: "(?:(?:[^\w]|^)) *\\/",
                close: "/",
                hasEscapes: true
            }], stream));
        var scopes = [],
            scope,
            depth = 0;
        var tag = /(\{)|(\})/g;
        while (stream.next() != null) {
            var current = stream.current;
            var index = stream.getCurrentIndex();
            tag.lastIndex = 0;
            var found = tag.exec(current);
            while (found) {
                if (found[1]) {
                    var newscope = {
                        start: index + found.index,
                        depth: depth++,
                        parent: scope
                    };
                    if (scope) {
                        if (scope.children) scope.children.push(newscope);
                        else scope.children = [newscope];
                    }
                    scope = newscope;
                } else if (scope) {
                    depth--;
                    scope.end = index + found.index - found[0].length;
                    scopes.push(scope);
                    scope = scope.parent;
                } else {
                    //scopes[scopes.length-1].end = found.index+found[0].length;
                }
                found = tag.exec(current);
            }
        }
        return scopes;
    }
    Object.assign(global.ScopeSolvers, {
        'jsx': cScopeFinder,
        'javascript': cScopeFinder,
        'typescript': cScopeFinder,
        'tsx': cScopeFinder,
        'java': cScopeFinder,
        'python': pyScopeFinder,
        'c_cpp': cScopeFinder
    });
}); /*_EndDefine*/
_Define(function(global) {
    var defaultGroups = {
        FUNCTION_NAME: 4,
        FUNCTION_NAME_ALT: -1,
        FUNCTION_TYPE: -1,
        INDENT: 2,
        ARGUMENT: 5,
        RETURN_TYPE: 3,
        RETURN_TYPE_ALT: -1,
        DOC_ALT: 1,
        DOC: 6,
        VALIDATE_1: 0,
        VALIDATE_2: 0,
        VAR_INDENT: 1,
        VAR_TYPE: 2,
        VAR_NAME: 3,
        VAR_VALUE: 4,
        CLASS_NAME: 3,
        CLASS_TYPE: -1,
        CLASS_SIGNATURE: 2,
        CLASS_INDENT: 1,
        CLASS_DOC: 4,
        CLASS_DOC_ALT: -1
    };

    function trim(a) {
        return a ? a.trim().replace(/(\n)+|(\s)+/g, "$1$2") : "";
    }

    function join(a, sep, b) {
        return a ? (b ? (a + sep + b) : a) : (b || "");
    }
    var cStyleTags = function(functionRe, declarationRe, classRe, groups) {
        return function(res, filename, allowText) {
            groups = groups || defaultGroups;
            var completions = [];
            var guard = 30;
            if (functionRe) {
                functionRe.lastIndex = 0;
                var func = functionRe.exec(res);
                while (func && --guard > 0) {
                    var valid = groups.VALIDATE_1 ? func[groups.VALIDATE_1] || func[groups.VALIDATE_2] : true;
                    if (true) { //valid) {
                        var ret = trim(func[groups.RETURN_TYPE] || func[groups.RETURN_TYPE_ALT]);
                        var caption = trim(func[groups.FUNCTION_NAME] || func[groups.FUNCTION_NAME_ALT]);
                        var doc = join(func[groups.DOC], "\n", func[groups.DOC_ALT]);
                        var signature = join(trim(func[groups.ARGUMENT]), ":", ret);
                        var type = func[groups.FUNCTION_TYPE] || "";
                        var fullname = join(type, type.endsWith(".") ? "" : " ", caption) + signature;
                        if (valid)
                            completions.push({
                                loc: func.index,
                                score: 500,
                                caption: caption + "(",
                                signature: "fn" + signature,
                                doc: join(fullname, "\n ", doc)
                            });
                    }
                    func = functionRe.exec(res);
                }
            }
            if (declarationRe) {
                declarationRe.lastIndex = 0;
                var field = declarationRe.exec(res);
                while (field && --guard > 0) {
                    completions.push({
                        loc: field.index,
                        caption: trim(field[groups.VAR_NAME]),
                        signature: trim(field[groups.VAR_TYPE]),
                        score: 300,
                        doc: trim(field[groups.VAR_VALUE])
                    });
                    field = declarationRe.exec(res);
                }
            }
            if (classRe) {
                classRe.lastIndex = 0;
                var clas = classRe.exec(res);
                while (clas && --guard > 0) {
                    var doc = (clas[groups.CLASS_DOC] || "") + (clas[groups.CLASS_DOC_ALT] || "");
                    var type = trim(clas[groups.CLASS_TYPE]);
                    var name = trim(clas[groups.CLASS_NAME]);
                    var signature = trim(clas[groups.CLASS_SIGNATURE])
                    completions.push({
                        loc: clas.index,
                        caption: name,
                        signature: join(type, " ", signature),
                        score: 400,
                        doc: join(join(join(type, " ", name), " ", signature), "\n ", trim(doc))
                    });
                    clas = classRe.exec(res);
                }
            }
            if (--guard > 0 && allowText !== false) {
                completions.push.apply(completions, global.TagFinders.text(res).slice(0, guard));
            }
            return completions;
        };
    };
    //limitations variable declaration lists
    //Helper created when things became too difficult
    S = {
        s: function(start) {
            var obj = Object.create(S);
            obj.source = ((S==this)?"":this.source) + (start?(start.source || start):"")
            return obj;
        },
        source: Object.create(null),
        add: function(reg, reg2, reg3, reg4, reg5, reg6) {
            var obj = this;
            obj.source += reg.source;
            return reg2 ? obj.add(reg2, reg3, reg4, reg5, reg6) : obj;
        },
        wrap: function() {
            this.source = "(?:" + this.source + ")";
            return this;
        },
        group: function() {
            this.source = "(" + this.source + ")";
            return this;
        },
        create: function() {
            return new RegExp(this.source, "gm");
        },
        or: function(reg1, reg2, reg3, reg4, reg5, reg6) {
            var obj = this;
            obj.source += "|" + reg1.source;
            return reg2 ? obj.or(reg2, reg3, reg4, reg5, reg6) : obj;
        },
        sp: function() {
            this.source += "[ \\t]*";
            return this;
        },
        sp2: function() {
            this.source += "[\\n\\r\\s]*";
            return this;
        },
        o: function() {
            return this.s.bind(this);
        },
        t: function(text) {
            this.source += text;
            return this;
        },
        decl: /(?:var|const|get|set)/,
        maybe: function() {
            this.wrap().source += "?";
            return this;
        },
        pos: function(pos) {
            this.source = this.source.replace(/\\34/g, "\\" + pos);
            return this;
        }
    }
    S.ident = S.s("[a-zA-Z_\\$][\\-_\\$a-zA-Z0-9]*").o();
    S.keyProp = S.s(/(\"|\'|\b)/).add(S.ident().group()).add(/\34/).o();
    S.string = S.s(/(\"|\')/).add(S.s(/\\\\|\\\34|[^\\34]/).wrap().t("+")).add(/\34/).o();
    S.indent = S.s("^").add(S.s().sp().maybe()).o();
    S.jsPropChain = S.ident("\\.").wrap().o();
    S.jsArguments = S.s("\\([^\\)\\n\\(]*(?:\\n[^\\)\\(\\n]*){0,3}\\)").o();
    S.comments = S.s().sp2().add(/\/\*((?:[^\*]|\*[^\/]){0,150})\*\//).sp2().o();

    S.jsVar = S.s("var\\b|const\\b|let\\b|readOnly\\b").or(S.jsPropChain().t("*").group(3)).maybe().sp().add(
            S.keyProp().pos(4) //adds groups 4 and 5
            .sp().t("[=:]").sp2()).o();
    S.jsNamedFunc = S.s("async\\b").sp().maybe()
        .add(/*S.s(/get\\b|set\\b/).sp().maybe(),*/ 
            S.s("function\\b").or(
                S.s("(?=").add(
                    S.jsArguments().sp().t("=>")
                ).t(")").sp())).o();
    S.jsFuncDecl = S.jsNamedFunc().maybe().add(/(?!if\b|while\b|for\b|switch\b|catch\b)/).o();
    var jsAnonFunc = S.s("async\\b").sp().maybe().t("(?=").add(S.jsArguments().sp().add(/\=\>/).t(")"));
    window.loper= jsAnonFunc.create();
    S.jsFuncBase = S.comments( /*group 1*/ ).maybe().add(S.indent().group(2),
            S.jsVar(S.jsNamedFunc().or(jsAnonFunc).wrap() /*adds groups 3-5,4 is quotes*/ ).or(
                S.jsFuncDecl(S.ident().group(6))).wrap())
        .sp().add(S.jsArguments().group(7)).sp2().add(S.s("=>").sp2().wrap().maybe()).o();
    var jsClass = S.comments( /*group 1*/ ).add(S.indent().group(2), S.s("class|interface").group(3), /[ \t]+/, S.ident().group(4), S.s(/[^\{]*/).group(5), S.s("\\{")).create()
    var JS_TAGS =
        cStyleTags(
            S.jsFuncBase().sp2().t("\\{").create(),
            S.comments( /*group 1*/ ).maybe()
            .add(S.indent().group(2))
            .add(S.s(".*[;,]").sp().maybe())
            .add(S.jsVar( /*adds groups 3-5*/ )).add(S.s("(?!").sp2().add(S.jsNamedFunc().or(jsAnonFunc).wrap()).t(")"))
            .add(
                S.s(/(?:new *)?/).add(
                    S.s(/[-\.\(\)\[\'\"a-zA-Z 0-9]{0,50}/).group(5),
                    S.s(/\,|\;|$/).wrap()).group(6)
            ).create(),
            jsClass, {
                VAR_INDENT: 2,
                VAR_TYPE: 3,
                VAR_NAME: 5,
                VAR_VALUE: 0,
                CLASS_DOC: 1,
                CLASS_INDENT: 2,
                CLASS_TYPE: 3,
                CLASS_NAME: 4,
                CLASS_SIGNATURE: 5,
                DOC: 1,
                INDENT: 2,
                FUNCTION_TYPE: 3,
                FUNCTION_NAME: 5,
                FUNCTION_NAME_ALT: 6,
                ARGUMENT: 7,
            });
    var TS_TAGS =
        cStyleTags(
            S.jsFuncBase().t(/(?:\s*\:[ \t]*(\w+)\;?\{?|\s*\{)/).create(),
            /*indent(((property chain)name:=)|name)(args?){*/
            /^([ \t]*)(?:.*; *)?(?:((?:var|const|get|set|readOnly)\b)|(?:^|[a-zA-Z0-9_$]+)\.(?=\w+ *\=)|(?=([\"\'])[^\2\n]+\2 *\:|[a-zA-Z]+\:))(?!.*[\=\:][ \t]*function)([a-zA-Z][a-zA-Z0-9]*)(?:\s*\:\s*(\w+)(?!\s*(?:\,|\})))(?: *[\=\:] *(?:new *)?([-\.\(\)\[\'\"a-zA-Z 0-9]{0,50})(?:\,|\;|$))?/gm,
            jsClass, {
                VAR_INDENT: 1,
                VAR_TYPE: 2,
                VAR_NAME: 4,
                VAR_TYPE: 5,
                VAR_VALUE: 0,
                CLASS_INDENT: 1,
                CLASS_TYPE: 2,
                CLASS_NAME: 3,
                CLASS_SIGNATURE: 4,
                DOC: 1,
                INDENT: 2,
                FUNCTION_TYPE: 3,
                FUNCTION_NAME: 5,
                FUNCTION_NAME_ALT: 6,
                ARGUMENT: 7,
                RETURN_TYPE: 8,
            });
    var CPP_TAGS =
        cStyleTags(
            /*indent(scope)ret name(args?){*/
            /^([ \t]*)(?:.*; *)?((?:public|protected|private|abstract|final|static|virtual|default)\s+)*(?!(?:if|while|for|switch|catch|public|private|abstract|final|static|virtual|struct|union|default|[Cc]lass|[Ee]num|[Ii]nterface)\b)([\*a-zA-Z\_\$][a-zA-Z0-9\]\[\_\$\>\> ]*\s+)?([\*a-zA-Z_][_a-zA-Z0-9]*)\s*(\([^\)\n\(]*(?:\n[^\)\(\n]*){0,3}\))\s*(\{)?/gm,
            /^([ \t]*)(?:.*; *)?((?:public|protected|private|abstract|final|static|virtual|default)\s+)*((?!(?:public|private|abstract|final|static|virtual|struct|union|default|[Cc]lass|[Ee]num|[Ii]nterface)\b)[\*a-zA-Z\[\_\$][a-zA-Z0-9\]\_\$\>\> ]*(?: *\[ *\])?)\s+([\*_a-zA-Z][a-zA-Z0-9]*(?: *\[ *\])?)(?: *[\=\:]\s*(?:new *)?([^\:\;|$|\{\n]{0,50}))?(?:\:|\;|$|\{)/gm,
            /^([ \t]*)((?:(?:public|private|abstract|final|static|struct|union|virtual|default|protected)\s*)*[Cc]lass|[Ee]num|[Ii]nterface|struct|union)[ \t]+([a-zA-Z][a-zA-Z0-9]*)([^\{]*)\{/gm, {
                INDENT: 1,
                VAR_INDENT: 1,
                CLASS_INDENT: 1,
                CLASS_TYPE: 2,
                CLASS_NAME: 3,
                CLASS_SIGNATURE: 4,
                VAR_TYPE: 3,
                VAR_NAME: 4,
                VAR_VALUE: 0,
                FUNCTION_TYPE: 2,
                RETURN_TYPE: 3,
                FUNCTION_NAME: 4,
                ARGUMENT: 5,
                VALIDATE_1: 3,
                VALIDATE_2: 6,
            });
    var PYTHON_TAGS =
        cStyleTags(
            /^((?:\@.*\n)*)([ \t]*)(?:async\s*)?def[ \t]+([_a-z\$A-Z][_\$a-zA-Z0-9]*)?[ \t]*(\([^\)\n\(]*(?:\n[^\)\(\n]*){0,3}\))(?:\s*\- ?\>[ \t]*(\S+))?[ \t]*\:/gm,
            /^([ \t]*)(?:.*; *)?(?:(?:^|[a-z_A-Z0-9_$]+)\.(?=\w+ *\=))?([a-zA-Z_][a-zA-Z0-9_$]*)(?: *\= *([^\n\;]{0,50}))/gm,
            /^([ \t]*)(class)[ \t]+([a-zA-Z][a-z_$A-Z0-9]*)([^\:]*)\:/gm, {
                DOC: 1,
                INDENT: 2,
                FUNCTION_NAME: 3,
                ARGUMENT: 4,
                RETURN_TYPE: 5,
                VAR_INDENT: 1,
                VAR_NAME: 2,
                VAR_VALUE: 0,
                CLASS_INDENT: 1,
                CLASS_NAME: 3,
                CLASS_TYPE: 2,
                CLASS_SIGNATURE: 4,
            });
    S.jsVar = S.jsNamedFunc = S.jsFuncDecl = S.jsFuncBase = S = null;
    Object.assign(global.TagFinders, {
        'jsx': JS_TAGS,
        'javascript': JS_TAGS,
        'typescript': TS_TAGS,
        'tsx': TS_TAGS,
        'java': CPP_TAGS,
        'python': PYTHON_TAGS,
        'c_cpp': CPP_TAGS
    });

    // global.TagFinders.tsStyle = JS_TAGS;
    // global.TagFinders.jsStyle = JS_TAGS;
    // global.TagFinders.pythonStyle = PYTHON_TAGS;
    // global.TagFinders.cStyle = CPP_TAGS;
}); /*_EndDefine*/