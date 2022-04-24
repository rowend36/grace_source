define(function(require, exports, module) {
    require("grace/ext/glob/glob");
    var getMode = ace.require("ace/ext/modelist").getModeForPath;
    var Docs = require("grace/docs/docs").Docs;
    var getProject = require("grace/core/file_utils").FileUtils.getProject;
    var Utils = require("grace/core/utils").Utils;
    var relative = require("grace/core/file_utils").FileUtils.relative;
    var JSONExt = require("grace/core/json_ext").JSONExt;
    var extname = require("grace/core/file_utils").FileUtils.extname;
    var globToRegex =require("grace/core/file_utils").FileUtils.globToRegex;
    var BaseServer = require("grace/ext/autocompletion/base_server").BaseServer;
    var getAllProps = require("./prop").inferProps;
    var scopeSolvers = require("./scope").ScopeSolvers;
    var DocStream = require("./scope").DocStream;
    var ServerUtils = require("grace/ext/autocompletion/base_server").ServerUtils;
    var TextStream = require("./scope").TextStream;
    var scopeIterator = require("./scope").scopeIterator;
    var ConfigEvents = require("grace/core/config").ConfigEvents;
    var Editors = require("grace/editor/editors").Editors;
    var lang = ace.require("ace/lib/lang");
    var completions = ace.require("ace/ext/completions");
    var debug = console;
    var supportedModes = ["java", "python", "javascript", "c_cpp", "json"];
    var resolvers = exports.ImportResolvers = {};
    var appConfig = require("grace/core/config").Config.registerAll({
        "enableTagGathering": "false,text,css," + supportedModes.join(","),
        "enableTagsCompletion": "false,css," + supportedModes.join(","),
        "showTagsInAllFileTypes": "false",
        "showTagsFromAllFileTypes": "true," + supportedModes.join(","),
        "enableWordsGathering": "false,python,json",
        'autoUpdateTags': "true",
        'tagFilePattern': '**/tags,**/.ctags,**/.ctags.d/*'
    }, "autocompletion.tags");
    
    var tagFormat = {
        invalid: function(e) {
            if (typeof e == 'boolean') return false;
            if (typeof e !== "string") {
                return "Unexpected value " + e;
            }
            e = Utils.parseList(e);
            if (e[0] != 'true' && e[0] != 'false') {
                return "First item must be true or false";
            }
            return false;
        }
    };
    require("grace/core/config").Config.registerValues({
        '!root': 'Use ctags for language support.\
You can either load ctag files (with autocompletion.tags.tagFilePattern),\
json tag files exported from the application( with .gtag extension)\
or actual source files( will be parsed if there is a parser available otherwise the default parser will naively collect all the words in the file).\
Except autocompletion.tags.tagFilePattern, all the options can be specified in a simple format of true|false followed by an optional list of modes to treat as exceptions. Example "true,javascript,css" means enable except in javascript and css modes',
        'tagFilePattern': {
            //until I figure out a better way to expose this
            type: 'string',
            doc: 'Used to determine is a file specified in autocompletion.loadConfigs is a ctag file or a source file.'
        },
        'enableTagsCompletion': {
            type: tagFormat,
            doc: 'Allow tags such as functions,properties,etc to show up in completions.'
        },
        'showTagsInAllFileTypes': {
            type: tagFormat,
            doc: 'Allow tokens from files of this mode to show up in other modes. To show certain tags only in specified files, use document flag fl-allowTagsFrom with a list of wildcards',
        },
        'enableTagGathering': {
            type: tagFormat,
            doc: 'Allow loading of tags from files of this mode. Currently supported modes include ' +
                supportedModes.join(", "),
        },
        'enableWordsGathering': {
            type: tagFormat,
            doc: 'Useful if inbuilt tag support is not good enough and only works if "enableTagGathering" is enabled for that mode.',
        },
        "autoUpdateTags": {
            type: tagFormat,
            doc: "Allow the system to gather tags from the current file whenever changes are made. Also automatically parses open documents.",
        }
    }, "autocompletion.tags");
    var WORD_RE =
        /[a-zA-Z\$\-\u00C0-\u1FFF\u2C00-\uD7FF][a-zA-Z_0-9\$\-\u00C0-\u1FFF\u2C00-\uD7FF\w]*/g;
    var tagFilePattern = globToRegex(appConfig.tagFilePattern);
    var tagFinders = exports.TagFinders = {
        "text": function(res) {
            var matches = res.match(WORD_RE);
            return matches && matches.map(function(e) {
                return (" " + e).substring(1);
            });
        }
    };
    var enabledCache = {};

    function isEnabled(option, mode) {
        var list = enabledCache[option] || (enabledCache[option] = Utils.parseList(option + ""));
        var enabled = list[0] == "true";
        if (list.indexOf(mode) > -1) {
            return !enabled;
        }
        return enabled;
    }

    var modes = ace.require("ace/config").$modes;
    var added = [];
    var keywords = [];

    function pretty(text) {
        for (var i in modes) {
            if (added.indexOf(i) < 0) {
                added.push(i);
                if (modes[i].$keywordList) {
                    keywords.push.apply(keywords, modes[i].$keywordList.filter(Utils.notIn(keywords)));
                }
            }
        }
        //dumbass syntax highlighting
        return typeof(text) == "string" ? lang.escapeHTML(text).replace(/\w+/g, function(match) {
            if (keywords.indexOf(match) > -1) {
                return '<span class="blue-text">' + match + '</span>';
            }
            return match;
        }) : "";
    }

    var TAGS = 'tags';

    var Tags = function() {
        Tags.super(this, arguments);
        this.clear();
    };
    /*
    * ScopeFormat{
        start: number,
        end: number,
        depth: number,
        parent?: number corresponding to index in list |ScopeFormat
    }
    * Header{
        !scopes: [ScopeFormat],
        !mode: string
        !lib: string - the filename this header was parsed from if it is a library
    }
    * Tag Format {
        caption: string
        doc: string
        loc: number,
        scope: ?, - for convenience this is generated from loc and scopes
                to save memory and also for object equality test
                If need arises, I might add the number index support
                but for now, nah
        score: number
        type: string,
        types: [string],
        signature: string,
        address: [{re:re,needle:needle,backwards:boolean}|number] used by ctags,
        isFunction: boolean //provides argument hints with it's signature
        isParam: boolean //used when the scope of a tag is in front of the match rather than around it
    }
    //Exported tag format
    {
        mode: string
        file: optional - used for jump to def,
        isLibrary: stops updates to this tagfile, as well as filtering
        scopes: optional
        tags: [TagFormat]
    }
    */
    Tags.prototype = {
        constructor: Tags,
        //manage tags
        importTags: function(res) {
            if (res.getValue) {
                res = res.getValue();
            }
            try {
                res = JSONExt.parse(res);
            } catch (e) {
                debug.error(e);
                return null;
            }
            var header = {
                "!preparsed": true
            };
            var filename = res.file;
            header["!mode"] = res.mode;
            header["!lib"] = res.isLibrary ? filename : undefined;
            if (res.scopes) {
                header["!scopes"] = res.scopes.filter(Boolean);
                header["!scopes"].forEach(function(e) {
                    //hehehe eslint would be appalled
                    if ((e.parent = res.scopes[e.parent]))
                        (e.parent.children || (e.parent.children = [])).push(e);
                });
            } else header["!scopes"] = [];
            var tags = res.tags;

            function extend(child) {
                child.isProperty = true;
                tags.push(child);
            }
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                if (tag.children) {
                    tag.children.forEach(extend);
                }
            }
            this.loadParsedTags(filename, header, tags);
        },
        exportTags: function(fs, folder, cb) {
            Utils.asyncForEach(Object.keys(this.files), (function(a, i, next) {
                var file = a.replace(/[^A-Za-z\-_0-9]/g, "_");
                var tagFile = this.files[a];
                var header = '//Grace-Tags version 1.0\n' + JSON.stringify({
                    "file": a,
                    "mode": tagFile["!mode"],
                    "isLibrary": false,
                    "scopes": tagFile["!scopes"].map(function(e, i, arr) {
                        var a = Object.assign({}, e);
                        if (a.parent) a.parent = arr.indexOf(a.parent);
                        a.children = undefined;
                        return a;
                    }),
                    "tags": tagFile.tags.map(function(a) {
                        if (a.scope) {
                            a.scope = undefined;
                        }
                        return a;
                    }).filter(Boolean)
                });
                fs.writeFile(folder + '/' + file + '.gtag', header, next);
            }).bind(this), cb);
        },
        loadTags: function(filename, res /*Doc or string*/ , noOverwrite /*false*/ , mode) {
            var files = this.files;
            if (!mode) {
                if (extname(filename) == "gtag") {
                    return this.importTags(res);
                } else if (typeof res == "string" && tagFilePattern.test(filename)) {
                    return require(["./ext/autocompletion/tags/ctags"],
                        function(mod) {
                            mod.Ctags.findAll(res, filename, false, Utils.noop);
                        });
                }
                if (typeof res == 'object') {
                    mode = res.session.$modeId.split("/").pop();
                } else mode = getMode(filename).name;
            }
            if (noOverwrite && files[filename] && files[filename]["!mode"] == mode) return;
            if (!files[filename] && !isEnabled(appConfig.enableTagGathering, mode, filename))
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
            if (!res) return;
            tags = (tagger.findAll || tagger)(res, filename, allowText, (function(tags) {
                if (!tags && tags.length) return;
                completions["!scopes"] = (scopeSolvers[mode] ? scopeSolvers[mode](
                    stream) : []);
                completions["!mode"] = mode;
                this.loadParsedTags(filename, completions, tags);
            }).bind(this));
        },
        loadParsedTags: function(filename, header, tags) {
            var iter = scopeIterator(header["!scopes"]);
            var maxDup = Infinity;
            //tags.length < 500 ? spaces.length : tags.length < 1000 ? 3 : 0;
            tags.forEach(function(a) {
                if (a.caption) {
                    a.scope = iter.find(a);
                    if (a.isParam) {
                        var next = iter.findNext(a);
                        if (next) a.scope = next;
                    }
                }
            });
            //in future, we could check if tags were already sorted
            tags.sort(function(a, b) {
                //ascending alphabetical order
                return (a.caption || a || "").localeCompare(b.caption || b || "") ||
                    //more data first
                    ((b.scope ? 3 : 0) + (b.signature ? 3 : 0) + (b.caption ? 1 :
                        0)) -
                    ((a.scope ? 3 : 0) + (a.signature ? 3 : 0) + (a.caption ? 1 :
                        0));
            });
            var last = "",
                // duplicates=[],
                hasData = false;
            var numDupl = 0;
            //remove duplicates
            if (header["!lib"]) header.tags = tags.filter(Boolean);
            else header.tags = tags.map(function(a) {
                var caption;
                if (!a) return false; //null match
                if (typeof(a) == "string") {
                    caption = a;
                    a = undefined;
                } else {
                    caption = a.caption;
                }
                if (!caption || caption[0] == "!") return false;
                if (last == caption) {
                    if (!a)
                        return false; //string match but a better match is already available
                    if (numDupl > maxDup)
                        return false; //if we later decide to use this again
                    if (hasData && !(
                            a.scope && a.scope !== hasData.scope ||
                            a.signature && a.signature !== hasData.signature
                        )) //duplicates.length)
                        return false;
                    /*var dup;
                    if (duplicates.some(function(b) {
                            return (!a.scope || b.scope == a.scope) &&
                                (!a.signature || a.signature == b.signature) && (dup = b);
                        })) {
                            //not worth the effort, if there are many of these, it's a problem with the tag finder
                        }*/
                    //duplicates.push(a);
                    hasData = a;
                    numDupl++;
                    return a;
                } else {
                    last = caption;
                    hasData = a;
                    //duplicates.length = 0;
                    //if (a)
                    //duplicates.push(a);
                    numDupl = 0;
                    return a || caption;
                }
            }).filter(Boolean);
            header.tags.forEach(function(a) {
                //add children for tags with isClass
                if (!a.isClass || a.children) return;
                var next = iter.findNext(a);
                if (next) {
                    a.children = [];
                    this.flatWalk(header, function(i, e) {
                        if (e && e.scope == next) {
                            a.children.push(e);
                        }
                    });
                }
            }, this);
            this.files[filename] = header;
        },
        //walk our flattened tree
        flatWalk: function(tagFile, each, opts) {
            var i = opts && opts.start || 0;
            var tags = tagFile.tags;
            var end = tags.length;
            if (end && opts && opts.name) { //binary search
                var name = opts.name;
                var start = 0;
                end = end - 1;
                do {
                    i = (start + end) >> 1;
                    var current = (tags[i].caption || tags[i]).localeCompare(name);
                    if (current > 0) {
                        end = i - 1;
                    } else if (current < 0) {
                        start = i + 1;
                    } else {
                        break;
                    }
                } while (start <= end);
                if (start <= end) { //found match
                    //Find the boundaries of the region we are looking with linear search
                    var j = i,
                        test;
                    while (j > start) {
                        test = tags[j - 1].caption || tags[j - 1];
                        if (test.localeCompare(name) !== 0) break;
                        j--;
                    }
                    start = j;
                    j = i + 1;
                    while (j < end) {
                        test = tags[j].caption || tags[j];
                        if (test.localeCompare(name) !== 0) break;
                        j++;
                    }
                    end = j;
                }
                i = start;
            }
            if (opts && opts.end)
                end = Math.min(tags.length, opts.end);
            if (opts && opts.limit)
                end = Math.min(i + opts.limit, end) || 0;
            //currently, we'd have to throw to get out of this
            for (; i < end; i++) {
                var e = tags[i];
                if (e[0] == "!") continue;
                each(e.caption || e, e.caption && e, i);
            }
        },
        //A dummy query service
        //Rather than resolve the name to a symbol using a
        //position provided, it simply gathers all the instances of said name
        //in the tag lists then sorts them using scope information
        //if available
        query: function(name, pos, file, fnOnly, allowGlobal) {
            this.updateTags(file);
            var data = this.files[file];

            function allWords(ctx, tags, name) {
                var words = [];
                //var duplicates = name + " ";
                ctx.flatWalk(tags, function(i, data) {
                    if (!data) return true;
                    if (fnOnly && !data.isFunction) {
                        return true;
                    }
                    words.push(data);
                    //if (i == name){// || i.startsWith(duplicates)) {
                    //}
                }, {
                    name: name,
                    //limit: 50
                    //end: Infinity //needed when we had space delimited duplicates
                });
                return words;
            }
            var locals, hasLocal;
            if (data) {
                var scopes = [false].concat((data["!scopes"] || []).filter(function(el) {
                    return el.start <= pos && el.end >= pos;
                }).reverse());
                locals = allWords(this, data, name).map(function(a) {
                    //in the same scope > lexically closer;
                    //can't choose 1
                    var scope, index = -1;
                    var posStart = a.locStart || a.loc || 0;
                    if (a.scope == undefined) {
                        var posEnd = a.locEnd || posStart;
                        //find the nearest scope
                        scopes.some(function(el, i) {
                            if (el.start <= posStart && el.end >=
                                posEnd) {
                                scope = el;
                                index = i;
                                return true;
                            }
                        });
                    } else {
                        index = scopes.indexOf(a.scope);
                        if (index > -1) scope = a.scope;
                    }
                    var score = 0;
                    if (index > -1) {
                        //items that share a scope have better chances
                        score = 10000 * (index + 1);
                    }
                    //but we do not ditch any item cus of properties etc
                    score += Math.abs(posStart - pos);
                    if (!hasLocal && scope) hasLocal = true;
                    return {
                        score: score,
                        scope: scope,
                        item: a,
                        file: data["!lib"] || file
                    };
                }).sort(function(a, b) {
                    return b.score - a.score;
                });
            } else locals = [];

            if (allowGlobal !== false) {
                var files = Array.isArray(allowGlobal) ? allowGlobal : this.files;
                for (var i in files) {
                    if (i !== file) {
                        var result = this.query(name, 0, i, false, false);
                        if (result) locals.push.apply(locals, result);
                    }
                }
            }
            if (locals.length) return locals;
            return null;
        },

        //the completion provider interface
        embeddable: false,
        isSupport: false,
        hasArgHints: true,
        priority: 10,
        hasAnnotations: false,
        hasKeyWords: false,
        hasText: false,
        hasStrings: false,
        name: "tagsClient",
        triggerRegex: /(?:\.|\-\>|\:\:)$/,
        init: function(editor, cb) {
            completions.removeCompleter(this);
            this.bindAceKeys(editor);
            cb(this);
        },
        release: function(editor) {
            this.unbindAceKeys(editor);
            this.docs = {};
            completions.addCompleter(this);
        },

        //base server interface
        normalizeName: function(name) {
            return name;
        },
        rename: null,
        removeDoc: Utils.noop,
        sendDoc: Utils.noop,
        refreshDoc: Utils.noop,
        docChanged: Utils.noop,
        trackChange: Utils.noop,
        addDoc: function(name, session) {
            this.docs = {};
            return (this.docs[name] = {
                name: name,
                doc: session
            });
        },
        requestDefinition: function(editor, cb) {
            var args = this.getQueryArgs(editor);
            if (!args) return this.ui.showInfo(editor, 'No name found at position');

            var tags = this.query(args.name, args.pos, args.file, false, true);
            if (tags) {
                // var safeTags = tags.filter(function(e) {
                //     return e.scope || e.item.isProperty;
                // });
                // if (safeTags.length) 
                //     tags = safeTags;
                cb(tags.map(function(tag) {
                    return {
                        file: tag.file,
                        span: tag.item.address ? undefined : {
                            start: tag.item.locStart || tag.item.loc ||
                                0,
                            length: 0
                        },
                        address: tag.item.address
                    };
                }));
            } else {
                if (!this.files[args.file]) return this.ui.showError(editor,
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
                if (!this.files[args.file]) return this.ui.showError(editor,
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
                if (!this.files[args.file]) return this.ui.showError(editor,
                    "No tags loaded for this file");
            }
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            this.ui.closeAllTips();
            var mode = session.getMode().$id.split("/").pop();
            var doc = Docs.forSession(session);
            var path = doc && doc.getSavePath() || doc.getPath();
            var allowTags;
            try {
                allowTags = doc && doc.flags && doc.flags.allowTagsFrom && globToRegex(
                        doc.flags.allowTagsFrom);
            } catch (e) {
                doc.flags.allowTagsFrom = "<Error reading list>";
                //do nothing
            }
            if (!isEnabled(appConfig.enableTagsCompletion, mode, path)) return callback();
            var files = this.files;
            var paths = Object.keys(files);
            var propStrings, props;

            if (path) {
                var resolver = resolvers[mode];
                if (resolver) {
                    paths = resolver.filter(paths, doc) || paths;
                } else {
                    paths = paths.filter(function(e) {
                        var tagMode = files[e]["!mode"];
                        if (tagMode === mode ||
                            (allowTags && allowTags.test(e)) ||
                            isEnabled(appConfig.showTagsFromAllFileTypes, mode,
                                e) ||
                            isEnabled(appConfig.showTagsInAllFileTypes, tagMode, e)
                        ) return true;
                        return false;
                    });
                }
                this.updateTags(path);
            }
            if (!prefix) {
                var line = session.getLine(pos.row).substring(0, pos.column);
                //basically the name or function call before the ./->
                var word = /(\w+)(?:\s*\((?:[^\(\)]+|\((?:[^\(\)])\))*\))?\s*(?:\.|->)$/
                    .exec(line);
                if (word && isNaN(word)) {
                    propStrings = getAllProps(this.propCache, word[1], path, session, paths);
                    //Gather properties as much as possible
                    props = [];
                    var results = [word[1]];
                    var addItem = function(e) {
                        if (e.item.children) {
                            e.item.children.forEach(function(p) {
                                propStrings[p.caption || p] = 100;
                            });
                        }
                        var types = e.item.types || [];
                        if (e.item.type) {
                            types.push(e.item.type);
                            var anno = e.item.type.indexOf("<");
                            if (anno > -1) {
                                types.push(e.item.type.slice(0, anno));
                            }
                        }
                        types.forEach(function(type) {
                            if (type && results.indexOf(type) < 0) {
                                results.push(type);
                            }
                        });
                    };
                    for (var i = 0; i < results.length; i++) {
                        var e = results[i];
                        var items = this.query(e, index, path, false, true);
                        items && items.forEach(addItem);
                    }
                }
            }

            var projectRoot = getProject().rootDir;
            var completions = [];
            var uniq = {};
            var now = new Date().getTime();

            if (now - this.lastUpdate > 5000) {
                for (var j in paths) {
                    this.updateTags(paths[j]);
                }
                this.lastUpdate = now;
            }
            var index = session.getDocument().positionToIndex(pos);
            //How does this scale with thousands of tags
            paths.some(function(filename) {
                var current = (filename == path);
                var rel = relative(projectRoot, filename) || filename;
                var tagsForFile = files[filename];

                var allowsText = isEnabled(appConfig.enableWordsGathering,
                    tagsForFile["!mode"],
                    filename);
                this.flatWalk(tagsForFile, function(tag, data) {
                    if (!data) {
                        if (current) return;
                        if (uniq[tag]) {
                            return;
                        }
                        uniq[tag] = true;
                    }
                    //prefilter
                    if (tag.indexOf(prefix) < 0) return;
                    var score = 0;
                    //based on scope 150 # -400
                    var scope = data && data.scope;
                    var inScope = false;
                    if (current)
                        score += 50;
                    if (!data) {
                        //words from other files
                        score -= 300;
                    } else if (!scope) {
                        //global scope
                    } else if (current) {
                        if (scope.start <= index && scope.end >= index) {
                            inScope = true;
                            score += 100;
                        }
                    } else {
                        if (scope.start != 0) {
                            score -= 400;
                        }
                    }
                    //props ~ -200
                    if (propStrings) {
                        if (propStrings[tag]) {
                            uniq[tag] = true;
                            score += propStrings[tag] * 5;
                        } else score -= 200;
                    }
                    //final addition +600
                    if (data) {
                        if (data.getScore) {
                            score += data.getScore(prefix, index);
                        } else score += (data.score || 1);
                        if (propStrings && data.isProperty)
                            score += 100;
                    } else if (allowsText) {
                        score = BaseServer.PRIORITY_LOW;
                    }
                    completions.push({
                        type: TAGS,
                        caption: (data && data.caption) || tag,
                        meta: rel,
                        value: (data && data.caption) || tag,
                        message: inScope && data.isParam ? (data &&
                                data.type ?
                                data.type + ' ' : '') +
                            "parameter" : (
                                data && data
                                .signature) || (propStrings &&
                                propStrings[
                                    tag] &&
                                "property"),
                        doc: data && data.doc,
                        score: score
                    });

                });
                if (completions.length > 10000) return true;
            }, this);
            for (var prop in propStrings) {
                if (!uniq[prop]) {
                    completions.push({
                        value: prop,
                        type: TAGS,
                        message: "property",
                        score: 300 + Math.min(propStrings[prop] * 5, 200)
                    });
                }
            }
            callback(null, completions);
        },
        getDocTooltip: function(item) {
            if (item.type == TAGS && !item.docHTML && (item.doc)) {
                item.docHTML = ["<h6 class='tag-tooltip-header'>" + pretty(item.value) +
                    "</h6>",
                    (item.doc ?
                        "<span class='tag-doc'>" + pretty(item.doc) + "</span>" : ""),
                    "   <p class='tag-path'><i>" + item.meta + "</i></p>",
                ].join("");
            }
        },
        genArgHintHtml: function(tip, pos) {
            return tip.map(function(e) {
                //works 90% of the time
                var text = e.item.signature;
                var head = text.substring(0, text.indexOf("(") + 1);
                var tail = text.substring(text.lastIndexOf(")"));
                var parts = text.substring(head.length, text.length - tail.length)
                    .split(",");
                parts = parts.map(function(e, i) {
                    return this.ui.createToken({
                        kind: pos === i ? 'parameterName' : 'localName',
                        text: Utils.htmlEncode(e)
                    }, pos === i ? 'active' : '');
                }, this);
                return pretty(head) + parts.join(",") + pretty(tail);
            }, this).join("</br>");
        },
        genInfoHtml: function(tip) {
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
                return "<p class='tag-tooltip'>" + info.map(pretty).join("</br>") + "</p>";
            else return "?";
        },

        //utility functions
        clear: function() {
            this.files = {};
            this.propCache = {};
            this.lastUpdate = 0;
        },
        onCreateDoc: function(doc) {
            if (isEnabled(appConfig.autoUpdateTags, doc.session.$modeId)) {
                this.loadTags(doc.getPath(), doc);
            }
        },
        updateTags: function(path) {
            var doc = Docs.forPath(path);
            if (!doc) return;
            if (doc.$lastTagUpdate === doc.getRevision()) return;
            doc.$lastTagUpdate = doc.getRevision();
            if (isEnabled(appConfig.autoUpdateTags, doc.session.$modeId))
                this.loadTags(path, doc);
            if (this.propCache[path]) {
                this.propCache[path] = null;
            }
        },
        getQueryArgs: function(editor, cursor, name) {
            cursor = cursor || editor.getSelection().cursor;
            var pos = editor.session.getDocument().positionToIndex(cursor);
            if (!name) {
                name = editor.session.getTokenAt(cursor.row, cursor
                    .column);
                if (!name || !/\w/.test(name.value)) name = editor.session.getTokenAt(
                    cursor.row, cursor.column + 1);
                if (!name || !/\w/.test(name.value)) return null;
                name = name.value;
                if (name[0] == '\"') {
                    name = name.replace(/\"/g, "");
                } else if (name[0] == '\'') {
                    name = name.replace(/\'/g, "");
                }
            }
            var file = this.options.getFileName(editor.session);
            var now = new Date().getTime();
            if (now - this.lastUpdate > 5000) {
                for (var filename in this.files) {
                    this.updateTags(filename);
                }
                this.lastUpdate = now;
            }
            if (!this.files[file]) {
                this.updateTags(file);
            }
            return {
                pos: pos,
                name: name,
                file: file
            };
        }
    };
    Utils.inherits(Tags, BaseServer);
    ServerUtils.createCommands(Tags.prototype, "tagsClient",
        TAGS);


    Editors.addCommands({
        bindKey: "Ctrl-Alt-.",
        name: "jumpToTag",
        exec: function(editor) {
            exports.TagCompleter.jumpToDef(editor);
        }
    });
    ConfigEvents.on("autocompletion.tags", function(e) {
        enabledCache = {};
        tagFilePattern = globToRegex(appConfig
            .tagFilePattern);
        if (e.config.indexOf('Gathering') > -1) {
            exports.TagCompleter.clear();
        }
    });

    function updateSupportedModes() {
        completions.removeCompletionProvider(exports.TagCompleter);
        completions.removeCompleter(exports.TagCompleter);
        //so that init can be called
        completions.addCompleter(exports.TagCompleter);
        completions.addCompletionProvider(exports.TagCompleter, supportedModes.filter(
            function(e) {
                return isEnabled(appConfig.enableTagsCompletion, e);
            }));
    }
    //todo move tag management to a separate file
    //the only issue is config management
    exports.TagCompleter = new Tags(require("grace/ext/autocompletion/server_host"));
    updateSupportedModes();
}); /*_EndDefine*/
