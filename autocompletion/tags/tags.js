//See analogy.txt
_Define(function(global) {
    var words = {};
    var getMode = global.modelist.getModeForPath;
    var supportedModes = ["java", "python", "javascript", "c_cpp",
        "jsx"
    ];
    var RE =
        /[a-zA-Z\$\-\u00C0-\u1FFF\u2C00-\uD7FF][a-zA-Z_0-9\$\-\u00C0-\u1FFF\u2C00-\uD7FF\w]*/g;
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
    var ServerUtils = global.ServerUtils;
    var appConfig = global.registerAll({
        "enableTagGathering": "false,javascript,python,c_cpp,java,text,php,css",
        "enableTagsCompletion": "false,javascript,python,c_cpp,java,text,php,css",
        "enableCompletionAcrossModes": "false,css",
        "enableWordsGathering": "false,python",
        'allowTagsOnRequest': "true"
    }, "autocompletion.tags");
    global.registerValues({
        '!root': 'Ctags like implementation for language support. All the options can be specified in the format of true|false followed by an optional list of exceptions as modes. Example "true,javascript,css" means enable except in javascript and css modes',
        'enableTagsCompletion': 'Allow tokens such as functions,properties,etc to show up in comppetions.',
        'enableCompletionAcrossModes': 'Allow tokens from files of this mode to show up in other modes',
        'enableTagGathering': 'Gtags can find contextual information rather than just plain text for any of the ' +
            supportedModes.join(", "),
        'enableWordsGathering': 'Useful if tag support is not good enough and only works if "enableTagGathering" is enabled for that mode',
        "allowTagsOnRequest": "Allow the system to gather tags from the current file whenever a request is made even if not explicitly loaded"
    }, "autocompletion.tags");
    global.ConfigEvents.on("autocompletion.tags", function(e) {
        if (e.newValue && !(/^(?:true|false)[$,]/)){
            global.Notify.info("Invalid value for "+e.config);
            return e.preventDefault();
        }
        cache = {};
        if (e.config.indexOf('Gathering')>-1) {
            global.TagCompleter.clear();
        }
    });
    var cache = {};

    function isEnabled(option, mode, filepath) {
        var list = cache[option] || (cache[option] = Utils.parseList(option + ""));
        var enabled = list[0] == "true";
        if (list.indexOf(mode) > -1) {
            return !enabled;
        }
        return enabled;
    }
    var completions = global.Completions;

    function updateSupportedModes() {
        completions.removeCompletionProvider(global.TagCompleter);
        completions.removeCompleter(global.TagCompleter);
        //so that init can be called
        completions.addCompleter(global.TagCompleter);
        completions.addCompletionProvider(global.TagCompleter, supportedModes.filter(
            function(e) {
                return isEnabled(appConfig.enableTagsCompletion, e);
            }));
    }
    var lastUpdate = 0;

    function pretty(text) {
        //dumbass syntax highlighting
        return typeof(text) == "string" ? text.replace(/\w+/g, function(match) {
            switch (match.toLowerCase()) {
                case 'fn':
                case 'function':
                case 'public':
                case 'private':
                case 'protected':
                case 'def':
                case 'synnchronized':
                case 'var':
                case 'class':
                case 'enum':
                case 'abstract':
                case 'interface':
                    return '<span class="blue-text">' + match + '</span>';
            }
            return lang.escapeHTML(match);
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
                } //last correct scope
                lastScope = scope;
                return scope;
            } else if (scope.parent && !fromParent) {
                return findScope(scope.parent, loc, scope);
            }
            //last wrong scope
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
        var pos = [];
        var t = /\n|\r\n|\r/g;
        var m;
        while ((m = t.exec(text))) {
            pos.push(m.index + m[0].length);
        }
        this.pos = pos;
    };
    TextStream.prototype.indexToPosition = function(i) {
        var t = 0;
        while (t < this.pos.length && i > this.pos[t + 1]) {
            t++;
        }
        return {
            row: t,
            column: i - this.pos[t]
        };
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
        this.lineEnding = this.res.getNewLineCharacter();
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
    DocStream.prototype.indexToPosition = function(i) {
        return this.res.indexToPosition(i);
    };

    var Tags = function() {
        Tags.super(this, [global.Functions]);
    };
    Tags.prototype = {
        constructor: Tags,
        loadTags: function(filename, res /*Doc or string*/ , noOverwrite /*false*/ , mode) {
            if (!mode) {
                if (typeof res == 'object') {
                    mode = res.session.$modeId.split("/").pop();
                } else mode = getMode(filename).name;
            }
            if (noOverwrite && words[filename] && words[filename]["!mode"] == mode) return;
            if (!words[filename] && !isEnabled(appConfig.enableTagGathering, mode, filename))
                return;

            var allowText = isEnabled(appConfig.enableWordsGathering, mode, filename);
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
            completions["!scopes"] = (scopeSolvers[mode] ? scopeSolvers[mode](
                stream) : []);
            completions["!mode"] = mode;
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
                    if (a.signature) {
                        a.scope = findScope(a.loc);
                        if (a.scope && a.signature == 'parameter') {
                            var i = 0;
                            for (var i in a.scope.children) {
                                if (a.scope.children[i].start > a.loc) {
                                    a.scope = a.scope.children[i];
                                    break;
                                }
                            }
                        }
                    }
                }
                if (!caption) return;
                var left = a && (a.scope || a.signature);
                var i = 1,
                    key = caption;
                do {
                    var dup = completions[key];
                    if (!dup) {
                        completions[key] = a;
                        break;
                    } else if (!left) break;
                    var right = (dup.scope && (!a || a.scope != dup
                            .scope)) ||
                        (dup.signature && (!a || dup.signature != a
                            .signature));
                    if (!right) {
                        if (dup.doc) a.doc = ((a.doc && a.doc != dup.doc) ? a.doc + "\n" : "") +
                            dup.doc;
                        completions[key] = a;
                        break;
                    }
                    if (dup.score && a.score && dup.score < a.score) {
                        completions[key] = a;
                        a = dup;
                    }
                    a.score--;
                    key = i++ + ")" + caption;
                } while (i < 9);
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
        rename: null,
        removeDoc: Utils.noop,
        sendDoc: Utils.noop,
        refreshDoc: Utils.noop,
        docChanged: Utils.noop,
        trackChange: Utils.noop,
        getQueryArgs: function(editor, cursor, name) {
            cursor = cursor || editor.getSelection().cursor;
            var pos = editor.session.getDocument().positionToIndex(cursor);
            if (!name) {
                var name = editor.session.getTokenAt(cursor.row, cursor
                    .column);
                if (!name || !/\w/.test(name.value)) name = editor.session.getTokenAt(
                    cursor.row, cursor.column + 1);
                if (!name || !/\w/.test(name.value)) return null;
                name = name.value;
            }
            if (!words[file]) {
                var file = this.options.getFileName(editor.session);
                var mode = editor.session.getMode().$id.split("/").pop();
                if (isEnabled(appConfig.allowTagsOnRequest, mode, file)) {
                    this.loadTags(file, editor.session.getValue(), true);
                }
            }
            return {
                pos: pos,
                name: name,
                file: file
            };
        },
        requestDefinition: function(editor, cb, varName) {
            var args = this.getQueryArgs(editor);
            if (!args) return this.ui.showInfo(editor, 'No name found at position');

            var tags = this.query(args.name, args.pos, args.file, false, true);
            if (tags) {
                cb({
                    file: tags[0].fileName,
                    span: {
                        start: tags[0].item.locStart || tags[0].item.loc ||
                            0,
                        length: 0
                    }
                });
            } else {
                if (!words[args.file]) return this.ui.showError(editor,
                    "No tags loaded for this file");
                this.ui.showInfo(editor, 'No tag found');
            }
        },
        requestType: function(editor, pos, cb) {
            var args = this.getQueryArgs(editor);
            if (!args) return this.ui.showInfo(editor, 'No name found at position');

            var tags = this.query(args.name, args.pos, args.file, false, true);
            if (tags) {
                cb(null, tags);
            } else {
                if (!words[args.file]) return this.ui.showError(editor,
                    "No tags loaded for this file");
                this.ui.showInfo(editor, 'No tag found');
            }
        },
        requestArgHints: function(editor, cursor, cb) {
            var args = this.getQueryArgs(editor, cursor);
            if (!args) return;

            var tags = this.query(args.name, args.pos, args.file, true, true);
            if (tags) {
                cb(tags);
            } else {
                if (!words[args.file]) return this.ui.showError(editor,
                    "No tags loaded for this file");
            }

        },
        get allTags() {
            return words;
        },
        query: function(name, pos, file, fnOnly, allowGlobal) {
            this.updateDoc(file);
            var tags = words[file];

            function allWords(tags, name) {
                var words = [];
                var duplicates = ")" + name;
                for (var i in tags) {
                    if (!tags[i]) continue;
                    if (fnOnly && !tags[i].isFunction) {
                        continue;
                    }
                    if (i == name || i.endsWith(duplicates)) {
                        words.push(tags[i]);
                    }
                }
                return words;
            }
            if (tags) {
                var scopes = (tags["!scopes"] || []).filter(function(el) {
                    return el.start <= pos && el.end >= pos;
                }).reverse();
                var locals = allWords(tags, name).map(function(a) {
                    //in the same scope > lexically closer;
                    //can't choose 1
                    var scope, index = -1;
                    var posStart = a.locStart || a.loc || 0;
                    if (!a.scope) {
                        var posEnd = a.locEnd || posStart;
                        scopes.some(function(el, i) {
                            if (el.start <= posStart && el.end >=
                                posEnd) {
                                scope = el;
                                index = i;
                                return true;
                            }
                        });
                    } else {
                        scope = a.scope;
                        index = scopes.indexOf(scope);
                    }
                    var score = 0;
                    if (index > -1) {
                        //items that share a scope have better chances
                        score = 10000 * (index + 1);
                    }
                    //but we do not ditch any item
                    score += Math.abs(posStart - pos);
                    return {
                        score: score,
                        scope: scope,
                        item: a,
                        fileName: file
                    };
                }).sort(function(a, b) {
                    return b.score - a.score;
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
            this.propCache = {};
        },
        updateDoc: function(path) {
            var doc = Docs.forPath(path);
            if (doc) {
                if (doc.$lastTagUpdate !== doc.getRevision()) {
                    doc.$lastTagUpdate = doc.getRevision();
                    global.TagCompleter.loadTags(path, doc);
                }
            }
            if (this.propCache[path]) {
                this.propCache[path] = null;
            }
        },
        propCache: {

        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            this.ui.closeAllTips();
            var mode = session.getMode().$id.split("/").pop();
            var doc = Docs.forSession(session);
            var path = doc && doc.getSavePath() || doc.getPath();
            if (!isEnabled(appConfig.enableTagsCompletion, mode, path)) return callback();

            var paths = Object.keys(words);
            var props;

            if (path) {
                var resolver = resolvers[mode];
                if (resolver) {
                    paths = resolver.filter(paths, doc) || paths;
                } else {
                    //just use all of them
                }
                if (isEnabled(appConfig.allowTagsOnRequest, mode, path))
                    this.updateDoc(path);
            }
            if (!prefix) {
                var line = session.getLine(pos.row).substring(0, pos.column);
                var word = /(\w+)(?:\.|->)$/.exec(line);
                if (word && isNaN(word)) {
                    props = getAllProps(word[1], path, session.getValue(), paths);
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
            var index = session.getDocument().positionToIndex(pos);
            paths.forEach(function(filename) {
                var current = (filename == path);
                var rel = relative(projectRoot, filename) || filename;
                var tagsForFile = words[filename];
                if (tagsForFile["!mode"] != mode) {
                    if (!isEnabled(appConfig.enableCompletionAcrossModes, tagsForFile["!mode"], filename)) return;
                }
                for (var tag in tagsForFile) {
                    var data = tagsForFile[tag];
                    if (tag[0] == "!") continue;

                    if (!data) {
                        if (current) continue;
                        if (uniq[tag]) {
                            continue;
                        }
                        uniq[tag] = true;
                    }
                    //prefilter
                    if (tag.indexOf(prefix) > -1) {
                        var score = 0;
                        //based on scope 100 # -400
                        var scope = data && data.scope;
                        if (current) {
                            score += 50;
                            if (scope) {
                                if (scope.start <= index && scope.end >= index) {
                                    score += 100;
                                }
                            }
                        } else if (scope) {
                            if (scope.start != 0) {
                                score -= 400;
                            }
                        } else score -= 300;
                        
                        //props ~ -200
                        if (props) {
                            if (props[tag]) {
                                uniq[tag] = true;
                                score += props[tag] * 5;
                            } else score -= 200;
                        }
                        
                        if (data) {
                            if (data.getScore) {
                                score += data.getScore(prefix);
                            } else score += (data.score || 1);
                            if (props && data.isProperty)
                                score += 100;
                            if (score < 0) score = tag[1] == ")" ? 0 : 1;

                        }
                        completions.push({
                            type: TAGS,
                            caption: tag,
                            meta: rel,
                            value: (data && data.caption) ||
                                tag,
                            message: (data && data.signature) || (props && props[tag] && "property"),
                            doc: data && data.doc,
                            score: score
                        });
                    }
                }
            });
            for (var prop in props) {
                if (!uniq[prop]) {
                    completions.push({
                        value: prop,
                        type: TAGS,
                        message: "property",
                        score: 300 + Math.min(props[prop] * 5, 200)

                    });
                }
            }
            callback(null, completions);
        },
        getDocTooltip: function(item) {
            if (item.type == TAGS && !item.docHTML && (item.doc)) {
                item.docHTML = ["<h6 class='tag-tooltip-header'>" + item.value + "</h6>",
                    (item.doc ?
                        "<span class='tag-doc'>" + pretty(item.doc) + "</span>" : ""),
                    "   <p class='tag-path'><i>" + item.meta + "</i></p>",
                ].join("");
            }
        },
        genArgHintHtml: function(tip, pos) {
            return tip.map(function(e) {
                return pretty(e.item.signature);
            }).join("</br>");
        },
        genInfoHtml: function(tip, notCompletion) {
            var prev;

            var info = tip.map(function(e) {
                return e.item.doc;
            }).sort().filter(function(b) {
                if (!b) return false;
                if (b == prev) return false;
                prev = b;
                return true;
            });
            if (info.length)
                return "<p class='tag-tooltip'>" + pretty(info.join("</br>")) + "</p>";
            else return "?";
        }

    };
    var word = /^[\$_\w]+/;

    function nextIdent(text, a) {
        return word.exec(text.substring(a, a + 50));
    }
    var word2 = /[\$_\w]+$/;

    function prevIdent(text, a) {
        return word2.exec(text.substring(Math.max(0, a - 50), a));
    }
    //further work, use type and shit, but that's for another person
    function createProps(name, doc, timeout) {
        var props = getProps(name, doc, ".", 5, timeout);
        var prop2 = getProps(name, doc, "->", 5, timeout);
        for (var i in prop2) {
            props[i] = props[i] ? props[i] + prop2[i] : prop2[i];
        }
        return props;
    }

    function getAllProps(name, path, doc, paths, timeout) {
        timeout = timeout || new Date().getTime() + 1000;
        var tags = global.TagCompleter;
        var cache = tags.propCache[path];
        var res = {};
        if (path) {
            cache = cache || (tags.propCache[path] = {});
            if (!cache[name]) {
                cache[name] = createProps(name, doc, timeout);
            }
            Object.assign(res, cache[name]);
        }
        var toCheck = [];

        function add(otherFileTags) {
            for (var i in otherFileTags) {
                res[i] = (res[i] || 0) + otherFileTags[i] / 20;
            }
        }
        paths.forEach(function(e) {
            if (e == path) return;
            if (tags.propCache[e]) {
                if (tags.propCache[e][name]) {
                    add(tags.propCache[e][name]);
                } else toCheck.push(e);
            } else {
                tags.propCache[e] = {};
                toCheck.push(e);
            }
        });
        var delta, file;
        while ((delta = (timeout - new Date().getTime())) > 0) {
            file = toCheck.pop();
            if (!file) return res;
            var doc = tags.docs[file];
            if (!doc) continue;
            if (!doc.doc.getValue && typeof doc.doc != 'string') {
                console.error(doc.doc);
            } else {
                var props = createProps(name, doc.doc.getValue ? doc.doc.getValue() : doc.doc, timeout);
                tags.propCache[file][name] = props;
                add(props);
            }
        }
        if (delta < 0) tags.propCache[file] = null;
        return res;
    }

    function getProps(name, text, dot, score, timeout) {
        var props = {};
        var parents = [name];
        var i = 0;

        var start = 0;
        var score = 5;
        while (i < parents.length) {
            var val = score * score;
            name = parents[i];
            var x = name.length + dot.length;
            var a = text.indexOf(name + dot);
            while (a > -1 && score) {
                a += x;
                var child = nextIdent(text, a);
                if (child) {

                    child = child[0];
                    if (props[child]) {
                        if(i==0)props[child]+=25;
                        else props[child] ++;
                    }
                    else {

                        props[child] = val;
                        var b = text.indexOf(dot + child);
                        while (b > -1) {
                            var similar = prevIdent(text, b);
                            if (similar) {
                                similar = similar[0];
                                if (parents.indexOf(similar) < 0) {

                                    parents.push(similar);
                                }
                            }
                            b = text.indexOf(dot + child, b + 1);
                        }
                    }
                    a += child.length;
                }
                a = text.indexOf(name + dot, a + 1);
            }
            if (i == start) {
                score -= 1;
                start = parents.length - 1;
            }
            i++;
            if (timeout < new Date().getTime()) break;
        }
        return props;
    }

    Utils.inherits(Tags, BaseServer);
    global.ServerUtils.createCommands(Tags.prototype, "tagServer", "tags");
    global.TagCompleter = new Tags();
    updateSupportedModes(appConfig.enableTagsCompletion);
}); /*_EndDefine*/
_Define(function(global) {
    var LineStream = function(stream, regex) {
        this.stream = stream;
        this.buf = "";
        this.regex = regex || /\r\n|\n|\r/g;
    };
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
    };
    LineStream.prototype.getCurrentIndex = function() {
        return this.index + this.stream.getCurrentIndex();
    };
    var BlockFilter = function(start, stream) {
        this.start = new RegExp(start, 'g');
        this.stream = stream;
        this.buf = "";
        this.index = 0;
    };
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
            while (this.buf);
            this.isPending = finish && !!this.buf;
            this.filteredLength = filtered.length;
            return this.current;
        }
        this.current = this.buf;
        this.buf = "";
        this.isPending = false;
        return this.current;
    };
    BlockFilter.prototype.getCurrentIndex = function() {
        return this.stream.getCurrentIndex() + this.index;
    };
    var LineFilter = function(start, stream) {
        LineFilter.super(this, [start, stream]);
        this.end = new RegExp("\\r\\n|\\r|\\n", 'g');
    };
    LineFilter.prototype.findEnding = function(blockStart, start) {
        this.end.lastIndex = start;
        var blockEnd = this.end.exec(this.buf);
        return (blockEnd ? this.end.lastIndex : -1);
    };
    var RegionFilter = function(starts, stream) {
        var start = [];
        for (var i in starts) {
            start.push("(" + starts[i].open + ")");
        }
        this.starts = starts;
        RegionFilter.super(this, [start.join("|"), stream]);
    };
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
                    else if (char == close[0] && (close.length == 1 || this.buf
                            .substring(i, i + close.length) == close)) break;
                    else if (end.breaksOnNewLine && char == '\n') break;
                }
                if (i == this.buf.length) {
                    return -1;
                }
                return i + close.length;
            }
        }
        return -1;
    };
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
    };
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
    };
    Object.assign(global.ScopeSolvers, {
        'jsx': cScopeFinder,
        'javascript': cScopeFinder,
        'typescript': cScopeFinder,
        'java': cScopeFinder,
        'python': pyScopeFinder,
        'c_cpp': cScopeFinder
    });
}); /*_EndDefine*/
_Define(function(global) {

    function trim(a) {
        return a ? a.trim().replace(/(\n)+|(\s)+/g, "$1$2") : "";
    }

    function join(a, sep, b) {
        return a ? (b ? (a + sep + b) : a) : (b || "");
    }

    var gTags = function(tokens, addText) {
        return function(stream, filename, allowText) {
            var completions = [];
            var guard = 1000;
            for (var i in tokens) {
                var token = tokens[i];
                token.re.lastIndex = 0;
                var res = token.re.exec(stream);
                while (res && --guard != 0) {
                    var data = token.handle.apply(token, [res.index].concat(res));
                    if (data) {
                        if (data.length) {
                            for (var ti in data)
                                completions.push(data[ti]);
                        } else completions.push(data);
                    }
                    res = token.re.exec(stream);
                }
                if (guard == 0) break;
            }
            guard -= 500;
            if (--guard > 0 && (addText || allowText != false)) {
                completions.push.apply(completions, global.TagFinders.text(stream)
                    .slice(0, guard));
            }
            return completions;
        };
    };
    var regex = /^\s*(?:(.+)\s+)?([\w\d\$]+\b)\s*(\/\*.*\*\/\s*)?$/;

    function declList(list, loc, scope) {
        return list.map(function(e) {
            var pos = loc;
            loc += e.length + 1;
            var parts = regex.exec(e);
            if (parts) {
                var type = trim(parts[1]);
                var name = trim(parts[2]);
                var comment = trim(parts[3]).slice(2, -2);
                return variable(pos, name, type, scope, comment);
            }
        }).filter(Boolean);
    }

    function argument(text, index, match) {
        var loc = index + match.indexOf(text) + 1;
        var list = text.slice(1, -1).split(",");
        return declList(list, loc, 'parameter');
    }

    function func(loc, name, argument, doc, returnType, type) {
        var ret = trim(returnType);
        var caption = trim(name);;
        var signature = join(argument, ":", ret);
        type = type || "";
        var fullname = join(type, type.endsWith(".") ? "" : " ", caption) + " " + signature;
        return {
            loc: loc,
            score: 500,
            isFunction: true,
            caption: caption,
            signature: "fn " + trim(signature),
            doc: join(fullname, "\n ", trim(doc))
        };
    }

    function variable(loc, name, type, keyword, info, score) {
        return {
            loc: loc,
            caption: name,
            signature: type || keyword,
            doc: trim(info),
            score: score || keyword == "class" ? 400 : 300
        };
    }
    //limitations variable declaration lists
    //Helper created when things became too difficult
    var S = {
        s: function(start) {
            var obj = Object.create(S);
            obj.source = ((S == this) ? "" : this.source) + (start ? (start
                .source || start) : "");
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
        },
        debug: function() {
            Clip.text = this.source;
            return this.create();
        }
    };

    //One [.] guessing 
    //1 Find names that have . 
    //2 Duck typing - find similar protos
    //3 Transforming add Values to the tree
    S.ident = S.s("[a-zA-Z_\\$][\\-_\\$a-zA-Z0-9]*").o();
    S.keyProp = S.s(/(\"|\'|\b)/).add(S.ident().group()).add(/\34/).o();
    S.string = S.s(/(\"|\')/).add(S.s(/\\\\|\\\34|[^\\34]/).wrap().t("+")).add(/\34/).o();
    S.indent = S.s("^").add(S.s().sp().maybe()).o();
    S.jsPropChain = S.ident("\\.").wrap().o();
    S.jsArguments = S.s("\\([^\\)\\n\\(]*(?:\\n[^\\)\\(\\n]*){0,3}\\)").o();
    S.comments = S.s().sp2().add(/\/\*((?:[^\*]|\*[^\/]){0,150})\*\//).sp2().o();

    S.jsVar = S.s("var\\b|const\\b|let\\b|readOnly\\b").or(S.jsPropChain().t("+")).group(3).sp().maybe()
        .add(
            S.keyProp( /*group 4 and 5*/ ).pos(4) //adds groups 4 and 5
            .sp().t("[=:]").sp2()).o();


    var jsClass = S.comments( /*group 1*/ ).maybe().add(S.indent().group(2), S.s("class|interface")
            .group(3), /[ \t]+/, S.ident().group(4), S.s(/[^\{]*/).group(5), S.s("\\{"))
        .create();

    var JS_TAGS =
        gTags([{ //function/method declaration
                    re: S.comments( /*1*/ ).maybe().add(S.indent().group(2).maybe()).add(/((?:async\b\s*)?function)?\s*(\w+)/).sp2().add(S.jsArguments().group(3)).sp2().add(/\{?/).create(),
                    handle: function(index, text, comments, indent, fnKeyword, name, args) {
                        if (!fnKeyword && (/^if|while|for|switch|with$/).test(name))
                            return null;
                        if (!fnKeyword && text[text.length - 1] != "{") {
                            return name;
                        }
                        if (name == "function" || name == "catch") {
                            fnKeyword = join(fnKeyword, "", name);
                            name = null;
                        }
                        return argument(args || "", index, text).concat(name ? [func(index + text.indexOf(name), name, args, comments, "", fnKeyword || "method")] : []);
                    }
                },
                { //variable function
                    re: S.comments( /*1*/ ).maybe().add(S.indent().group(2)).add(S.jsVar().sp2().maybe().add(/((?:async\b\s*)?function)?\s*(\w+)?/).add(S.jsArguments().group()).sp2().add(S.s(/=\s*>/).maybe())).create(),
                    handle: function(index, text, comments, indent, propChain, isQuoted, key, fnKeyword, name2, args) {
                        var anon = text[text.length - 1] == ">";
                        if (!fnKeyword && !anon) return null;
                        var ret = argument(args || "", index, text);
                        if (key)
                            ret.push(func(index + text.indexOf(key), key, args, comments, "", join(anon && "anonymous", " ", "function")));
                        if (name2)
                            ret.push(func(index + text.indexOf(name2), name2, args, comments, "", join(anon && "anonymous", " ", "function")));
                        return ret;
                    }
                },
                {
                    re: S.comments( /*group 1*/ ).maybe()
                        .add(S.indent().group(2)) ///all this add could be a parser
                        .add(S.s(".*[;,]").sp().maybe())
                        .add(S.s(/var\b|const\b|let\b|readOnly\b/).wrap().group(3)).sp().add(S.ident().sp().add(S.s(/=\s*[^;,]{0,40}\s*/).maybe()).t(",").sp().wrap().t("*").sp2().add(S.ident(/[$;]/)).group(4)).create(),
                    handle: function(pos, text, comments, indent, type, list) {
                        var names = list.split(",");
                        return declList(names, pos + text.indexOf(list), type);
                    }
                },
                { //variables
                    re: S.comments( /*group 1*/ ).maybe()
                        .add(S.indent().group(2)) ///all this add could be a parser
                        .add(S.s(".*[;,]").sp().maybe())
                        .add(S.jsVar( /*adds groups 3-5*/ ))
                        .add(
                            S.s(/(new *\w+ *)?/) /*7*/ .add(
                                S.s(/.{0,50}/).group(8),
                                S.s(/\,\{|\;|$/).wrap()).group(6)
                        ).create(),
                    handle: function(index, text, comments, indent, propChain, isQuoted, name, whole, type, value) {
                        type = type || (whole[0] == "'" || whole[0] == '"' ? "string" : "");
                        var res = [];
                        var isProperty = propChain && propChain[propChain.length - 1] == ".";
                        if ((type || !(value.indexOf("function") > -1 || /=?s*>/.test(value)))) {
                            if (!(propChain || isQuoted || (text.indexOf(":") > text.indexOf("whole")))) {
                                //just an assignment
                                res = [name];
                            } else {
                                res = [
                                    variable(index + text.indexOf(name), name, join(type, " ", propChain), isProperty?"property":"local", comments)
                                ];
                            }
                            if (isProperty) {
                                var names = propChain.slice(0, -1).split(".");
                                res.push.apply(res, names);
                            }
                        }
                        return res;
                    }
                },
                {
                    re: jsClass,
                    handle: function(index, text, comments, indent, type, name, everyOtherThing) {
                        return variable(index, name, type, type, join(everyOtherThing, "\n", comments));
                    }
                }
            ],
            false);

    var CPP_TAGS =
        gTags([{
                /*indent(scope)ret name(args?){*/
                re: /^([ \t]*)(?:.*; *)?((?:public|protected|private|abstract|final|static|virtual|default)\s+)*(?!(?:if|while|for|switch|catch|public|private|abstract|final|static|virtual|struct|union|default|[Cc]lass|[Ee]num|[Ii]nterface|new|return|throw)\b)((?=[A-Z])|[\*a-zA-Z\_\$][a-zA-Z0-9\]\[\_\$\>\> ]*\s+)([\*a-zA-Z_][_a-zA-Z0-9]*)\s*(\([^\)\n\(]*(?:\n[^\)\(\n]*){0,3}\))\s*(\{)?/gm,
                handle: function(pos, all, indent, scope, ret, name, args) {
                    return argument(args || "", pos, all).concat[func(pos + all.indexOf(name), name, args, scope, ret)];
                }
            },
            {
                re: /^([ \t]*)(?:.*; *)?((?:public|protected|private|abstract|final|static|virtual|default)\s+)*((?!(?:public|private|abstract|final|static|virtual|struct|union|default|[Cc]lass|[Ee]num|[Ii]nterface|new|return|throw)\b)[\*a-zA-Z\[\_\$][a-zA-Z0-9\]\_\$\>\> ]*(?: *\[ *\])?)\s+([\*_a-zA-Z][a-zA-Z0-9]*(?: *\[ *\])?)(?: *[\=\:]\s*(?:new *)?([^\:\;|$|\{\n]{0,50}))?(?:\:|\;|$|\{)/gm,
                handle: function(pos, all, indent, scope, type, name, value) {
                    return variable(pos + all.indexOf(name), name, type, "var", all);
                }
            }, {
                re: /^([ \t]*)((?:(?:public|private|abstract|final|static|struct|union|virtual|default|protected)\s*)*[Cc]lass|[Ee]num|[Ii]nterface|struct|union)[ \t]+([a-zA-Z][a-zA-Z0-9]*)([^\{]*)\{/gm,

                handle: function(pos, all, indent, scope, name, olothers) {
                    return variable(pos + all.indexOf(name), name, scope, "", olothers);                }
            }
        ]);
    var PYTHON_TAGS =
        gTags([{
                re: /^((?:\@.*\n)*)([ \t]*)(?:async\s*)?def[ \t]+([_a-z\$A-Z][_\$a-zA-Z0-9]*)?[ \t]*(\([^\)\n\(]*(?:\n[^\)\(\n]*){0,3}\))(?:\s*\- ?\>[ \t]*(\S+))?[ \t]*\:/gm,
                handle: function(index, text, doc, indent, name, args, ret) {
                    return argument(args || "", index, text).concat[func(index + text.indexOf(name), name, args, doc, ret)];
                }
            }, {
                re: /^([ \t]*)(?:.*; *)?(?:(?:^|[a-z_A-Z0-9_$]+)\.(?=\w+ *\=))?([a-zA-Z_][a-zA-Z0-9_$]*)(?: *\= *([^\n\;]{0,50}))/gm,
                handle: function(index, text, indent, name) {
                    return variable(index, name, "variable", "", text);
                }
            },
            {
                re: /^([ \t]*)(class)[ \t]+([a-zA-Z][a-z_$A-Z0-9]*)([^\:]*)\:/gm,
                handle: function(pos, res, indent, cls, name) {
                    return variable(pos + 6, name, "", cls, res);
                }
            }
        ]);
    S.jsVar = S.jsFuncStart = S.jsFuncDeclStart = S.jsFuncBase = S = null;
    Object.assign(global.TagFinders, {
        'jsx': JS_TAGS,
        'javascript': JS_TAGS,
        'java': CPP_TAGS,
        'python': PYTHON_TAGS,
        'c_cpp': CPP_TAGS
    });

    // global.TagFinders.tsStyle = JS_TAGS;
    // global.TagFinders.jsStyle = JS_TAGS;
    // global.TagFinders.pythonStyle = PYTHON_TAGS;
    // global.TagFinders.cStyle = CPP_TAGS;
}); /*_EndDefine*/