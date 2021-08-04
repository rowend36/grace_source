_Define(function(global) {
    /* Use regex to find tags
     * Inspired by exuberant ctags
     * Rather than do everything in one pass,
     * This approach allows you to find tags using
     * multiple passes each suited to a specific set of tags.
     * You can find definitions of any kind with this,
     * However, to handle more complex stuff eg rename,
     * I think, you just have to subclass Tags, or better still use an lsp
     */
    var Utils = global.Utils;
    var unimplemented = global.unimplemented;
    var profile;
    profile = console.debug;

    function AsyncTags() {
        this.findAll = this.findAll.bind(this);
    }
    AsyncTags.prototype.onStart = Utils.noop;
    AsyncTags.prototype.onBatch = unimplemented;
    AsyncTags.prototype.findAll = function(stream, filename, allowText, cb) {
        var ctx = {
            res: stream,
            pos: 0,
            file: filename,
            allowText: allowText,
            cb: cb,
            name: 'Tags',
            found: [],
            endT: new Date().getTime() + 500,
            numPhases: 0,
            startT: new Date().getTime()
        };
        this.onStart(ctx);
        var self = this;
        return (function run() {
            ctx.numPhases++;
            do {
                var num, t;
                if (profile) {
                    num = ctx.found.length,
                        t = Date.now();
                }
                self.onBatch(ctx);
                if (profile) {
                    num = ctx.found.length - num;
                    t = Date.now() - t;
                    profile({
                        "matches": num,
                        "name": ctx.name,
                        "time": t,
                        "matches/ms": num / t + '/ms',
                        "Adjusted matches/ms": num / t / Math.log(stream
                            .length) + '/ms',
                        "percent": ctx.pos / stream.length * 100 +
                            "%"
                    });
                }
                if (new Date().getTime() > ctx.endT) {
                    if (!cb) return self.onFinish(ctx);
                    if (ctx.done) return self.onFinish(ctx);
                    ctx.endT += 1500;
                    setTimeout(run, 1000);
                    return ctx;
                }
                if (ctx.done) {
                    return self.onFinish(ctx);
                }
            } while (true);
        })();
    };
    AsyncTags.prototype.onFinish = function(ctx) {
        if (profile) profile({
            "total": ctx.found.length,
            "phases": ctx.numPhases,
            "time": new Date().getTime()-ctx.startT
        });
        var found = ctx.found;
        if (found.length < 5000 && ctx.allowText !== false) {
            //supplement
            found.push.apply(found, global.TagFinders.text(ctx.res)
                .slice(0, 5000 - found.length));
        }
        ctx.cb && ctx.cb(found);
        return found;
    };
    global.AsyncTags = AsyncTags;
});
_Define(function(global) {
    function RegexTags(passes) {
        RegexTags.super(this);
        this.passes = passes;
    }
    global.Utils.inherits(RegexTags, global.AsyncTags);
    RegexTags.prototype.onBatch = function(ctx) {
        ctx.index = ctx.index || 0;
        var currentPass = this.passes[ctx.index];
        ctx.name = currentPass.name;
        var re = currentPass.re;
        var text = ctx.res;
        re.lastIndex = ctx.pos || 0;
        var completions = ctx.found;
        for (var i = 0; i < 100; i++) {
            var res = re.exec(text);
            if (!res) {
                ctx.pos = 0;
                ctx.done = ++ctx.index >= this.passes.length;
                return;
            }
            var data = currentPass.handle.apply(currentPass, [res.index].concat(res));
            if (data) {
                if (data.forEach) {
                    for (var ti in data) {
                        completions.push(data[ti]);
                    }
                } else {
                    completions.push(data);
                }
            }

        }
        ctx.pos = re.lastIndex;
    };

    function trim(a) {
        return a ? a.trim().replace(/(\n)+|(\s)+/g, "$1$2") : "";
    }

    function join(a, sep, b) {
        return a ? (b ? (a + sep + b) : a) : (b || "");
    }


    var param = /(?:([a-zA-Z_\\$]\w*)\s*)?(\b[a-zA-Z_\\$]\w*)\s*.*(?:\/\*(.*)\*\/)?\s*/;

    function declList(list, loc, scope) {
        return list.map(function(e) {
            var pos = loc;
            loc += e.length + 1;
            var parts = param.exec(e);
            if (parts) {
                pos += parts.index;
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
        var caption = trim(name);
        var signature = join(argument, ":", ret);
        type = type || "";
        var fullname = join(type, type.endsWith(".") ? "" : " ", caption) + " " + signature;
        return {
            loc: loc,
            score: 500,
            isFunction: true,
            caption: caption,
            type: returnType,
            signature: "fn " + trim(signature),
            doc: join(fullname, "\n ", trim(doc))
        };
    }

    function variable(loc, name, type, keyword, info, score) {
        return {
            loc: loc,
            caption: name,
            signature: type || (keyword == "parameter" ? "var" : keyword),
            type: type,
            isParam: keyword == "parameter" || undefined,
            isClass: keyword == "class" || undefined,
            doc: trim(info),
            score: score || keyword == "class" ? 400 : 300
        };
    }
    RegexTags.TagTypes = {
        variable: variable,
        argument: argument,
        func: func,
        declList: declList,
        join: join
    };
    global.RegexTags = RegexTags;
});
/*region - U thought u knw regular expressions*/
_Define(function(global) {
    var RegexTags = global.RegexTags,
        types = RegexTags.TagTypes,
        variable = types.variable,
        argument = types.argument,
        func = types.func,
        declList = types.declList,
        join = types.join;
    //Won't stop a simple case of catastrophic backtracking
    //But should reduce the impact which is seen sometimes seen
    //in really long documents, needed mainly for bracketMatch
    function ChunkedRegex(re, longestMatchSize) {
        this.re = re;
        this.lastIndex = re.lastIndex;
        this.chunkIndex = 0;
        this.chunkSize = Math.max(500, longestMatchSize * 5);
        this.chunkAdvance = this.chunkSize - longestMatchSize + 1;
    }
    ChunkedRegex.prototype.exec = function(text) {
        if (this.chunkIndex > this.lastIndex) this.chunkIndex = Math.max(0,this.lastIndex-1);
        this.re.lastIndex = this.lastIndex - this.chunkIndex;
        var match;
        do {
            var chunk = text.substring(this.chunkIndex, this.chunkIndex + this.chunkSize);
            match = this.re.exec(chunk);
            if (match) break;
            if (this.chunkIndex > text.length - this.chunkSize) {
                //reached eof
                break;
            }
            //advance
            this.chunkIndex += this.chunkAdvance;
            this.re.lastIndex = 0;
        } while (true);
        if (match) {
            match.index += this.chunkIndex;
            this.lastIndex = this.chunkIndex + this.re.lastIndex;
        } else {
            this.lastIndex = this.chunkIndex = 0;
        }
        return match;
    };

    //Helper created when things became too difficult
    //Splices regexp strings together to create bigger ones
    var S = {
        //fork
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
        create: function(limit) {
            if (limit==undefined || typeof limit == 'number') {
                return new ChunkedRegex(new RegExp(this.source, "gm"), limit||100);
            }
            return new RegExp(this.source, "gm");
        },
        or: function(reg1, reg2, reg3, reg4, reg5, reg6) {
            var obj = reg1;
            if (this !== S) {
                obj = this;
                obj.source += "|" + reg1.source;
            }
            return reg2 ? obj.or(reg2, reg3, reg4, reg5, reg6) : obj;
        },
        //single line space
        sp: function() {
            this.source += "[ \\t]*";
            return this;
        },
        //compulsory whitespace
        sp1: function() {
            this.source += "\\s+";
            return this;
        },
        //whitespace
        sp2: function() {
            this.source += "[\\n\\r\\s]*";
            return this;
        },
        //create a template function
        o: function() {
            this.create();
            return this.s.bind(this);
        },
        //add text
        t: function(text) {
            this.source += text;
            return this;
        },
        //everything I just said is optional
        maybe: function() {
            this.wrap().source += "?";
            return this;
        },
        //replace backreferences
        pos: function(pos) {
            this.source = this.source.replace(/\\34/g, "\\" + pos);
            return this;
        },
        debug: function() {
            window.Clip.text = this.source;
            return this.create();
        },
        //use with care, crashed so many times before I got this right
        recurse: function(placeholder, number) {
            for (
                var re = new RegExp(placeholder, "g"); number-- > 0; re.lastIndex = 0) {
                this.source = this.source.replace(re, this.source);
            }
            this.source = this.source.replace(re, "[]");
            return this;
        },
        //Recurses up to a depth of 2**2 = 4
        //Tried to nest different types but it
        //Took a bit too much time for regex to compile: up to 2s
        //And freezes on large documents,
        //So at least we know why it's typically not done this way
        bracketRange: function(s, e) {
            s = "\\" + s;
            e = "\\" + e;
            return S.s(s + "(?:[^" + e + "]{0,100}|#BRACKET)" + e).recurse("#BRACKET", 2);
        },
        string: function(s) {
            s = "\\" + s;
            return S.s(s + "(?:[^" + s + "\n\\\\]|\\\\\\\\|\\\\" + s + ")*" + s);
        }
    };

    //One [.] guessing 
    //1 Find names that have . 
    //2 Duck typing - find similar protos
    //3 Transforming add Values to the tree
    S.ident = S.s("[a-zA-Z_\\$][\\-_\\$a-zA-Z0-9]*").o();
    S.indent = S.s("^").add(S.s().sp().maybe()).o();
    //adds two groups
    S.jsPropKey = S.s(/(\"|\'|\b)/).add(S.ident().group()).add(
        /\34/).o();

    S.jsPropChain = S.ident("\\.").wrap().o();
    S.jsArguments = S.s(
        "\\([^\\)\\n\\(]*(?:\\n[^\\)\\(\\n]*){0,3}\\)").o();
    //adds a group
    S.comments = S.s().sp2().add(
        /\/\*((?:[^\*]|\*[^\/]){0,150})\*\//).sp2().o();

    S.jsVar = S.s("var\\b|const\\b|let\\b|readOnly\\b").or(S.jsPropChain().t("+")).group(3).sp().maybe()
        .add(
            S.jsPropKey( /*group 4 and 5*/ ).pos(4)
            .sp().t("[=:]").sp2()).o();


    var jsClass =
        S.comments( /*group 1*/ ).maybe()
        .add(S.indent().group(2),
            S.s("class|interface").group(3),
            /[ \t]+/,
            S.ident().group(4),
            S.s(/[^\{]*/).group(5),
            S.s("\\{")
        ).create();

    S.c_ident =
        //c pointers
        S.s("\\*").sp().maybe().add(
            S.ident()).add(
            //c templates
            S.s().sp().add(S.bracketRange("<", ">")).maybe()
        ).wrap().o();
    //java/py decorators
    S.decorator = S.s("(?:\@.*\n)").o();
    S.scope = S.or(
        //Eats anything but respects
        S.s(/[^'"$\;\,\/\{\}\(\)\[\]]+/),
        //line comments,
        S.s("\\/\\/[^$]*$"),
        //js regexes approximation
        S.string("/"),
        //strings
        S.string("'"),
        S.string('"'),
        //division op if regex fails
        S.s("\\/"),
        //strings,
        S.bracketRange("{", "}"),
        S.bracketRange("(", ")"),
        S.bracketRange("[", "]")
    ).wrap().t("{0,3}").o();
    S.safeVal = S.s(/ *[\=\:]\s*/).add(S.scope()).o();

    S.c_start = S.s(/^|[\;\}]/).wrap().o();

    S.modifier = S.s(/(?:public|synchronized|inline|protected|private|abstract|final|static|virtual|default)/)
        .o();

    S.modifier_list = S.modifier().sp1().wrap().t("*").o();

    S.c_decl = S.c_start().add(
        S.s(/[ \t]*/).group(1) //indent
    ).add(
        S.modifier_list().group(2) //modifier
    ).o(); //done

    S.c_args = S.s().sp2().t("\\(")
        .add(
            S.s().sp().add(
                S.scope()
                .add(S.s(",").add(S.scope()).wrap().t("*")).maybe()
            ).sp().t("\\)")
        ).o();

    S.splitDeclList = S.s().sp2().add(S.safeVal().maybe()).t("(?:,|$)").create();
    var Regexps = {
        "jsFuncDeclaration": {
            //function/method declaration and calls
            re: S.comments( /*1*/ ).maybe().add(S.indent().group(2).maybe()).add(
                    /((?:async\b\s*)?function)?\s*(\w+)/).sp2()
                .add(S.jsArguments().group(3)).sp2().add(/\{?/).create(),
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
                return argument(args || "", index, text).concat(name ? [func(index + text.indexOf(name),
                    name, args,
                    comments, "", fnKeyword || "method")] : []);
            }
        },
        "jsVarFunction": {
            //variable function, extends jsFuncDecl
            re: S.comments( /*1*/ ).maybe().add(S.indent().group(2).maybe()).add(S.jsVar().sp2().maybe()
                .add(
                    /((?:async\b\s*)?function)?\s*(\w+)?/).add(S.jsArguments().group()).sp2().add(S.s(
                    /=\s*>|\{/).maybe())).create(1000),
            handle: function(index, text, comments, indent, propChain, isQuoted, key, fnKeyword, name2,
                args) {
                var anon = text[text.length - 1] == ">";
                var decl = text[text.length - 1] == "{";
                if (!fnKeyword && !anon && !decl) {
                    return name2; //function call
                }
                var results;
                if (name2) {
                    results = Regexps.jsFuncDeclaration.handle(index, text, comments, indent, fnKeyword,
                        name2, args) || [];
                } else if (key) results = argument(args || "", index, text);
                if (key)
                    results.push(func(index + text.indexOf(key), key, args, comments, "", join(anon &&
                        "anonymous", " ", "function")));

                return results;
            }
        },
        //find list declarations, leaves sungle to jsVar singledecl
        "jsVarDeclList": {
            re: S.comments( /*group 1*/ ).maybe()
                .add(S.indent().group(2)) ///all this add could be a parser
                .add(S.s(".*[;,]").sp().maybe())
                .add(S.s(/var\b|const\b|let\b|readOnly\b/).sp1().group(3))
                .add(S.c_ident().add(S.safeVal().maybe().add(
                    S.s().sp2().t(",").sp2().add(
                        S.c_ident()).add(S.safeVal().maybe()).wrap().t("+")
                )).group(4)).sp().add(/[;\n\{]/)
                .create(),
            handle: function(pos, text, comments, indent, type, list) {
                var names = list.split(",");
                return declList(names, pos + text.indexOf(list), type);
            }
        },
        //finds properties and declarations
        "jsVarSingleDecl": { //variables
            re: S.comments( /*group 1*/ ).maybe()
                .add(S.indent().group(2)) ///all this add could be a parser
                .add(S.s(".*[;,]").sp().maybe())
                .add(S.jsVar( /*adds groups 3-5*/ ))
                .add(
                    S.s(/(?:new *(\w+) *)?/) /*7*/ .add(
                        S.s(/.{0,50}/).group(8),
                        S.s(/\,\{|\;|$/).wrap()).group(6)
                ).create(),
            handle: function(index, text, comments, indent, propChain, isQuoted, name, whole, type,
                value) {
                type = type || (whole[0] == "'" || whole[0] == '"' ? "string" : "");
                var res = [];
                var isProperty = propChain && propChain[propChain.length - 1] == ".";
                if ((type || !(value.indexOf("function") > -1 || /=?s*>/.test(value)))) {
                    if (!(propChain || isQuoted || (text.indexOf(":") > text.indexOf("whole")))) {
                        //just an assignment
                        res = [name];
                    } else {
                        res = [
                            variable(index + text.indexOf(name), name, join(type, " ",
                                propChain), isProperty ? "property" : "var", comments)
                        ];
                    }
                }
                if (isProperty) {
                    var names = propChain.slice(0, -1).split(".");
                    res.push.apply(res, names);
                }
                return res;
            }
        },
        "jsClass": {
            re: jsClass,
            handle: function(index, text, comments, indent, type, name, everyOtherThing) {
                return variable(index, name, type, "class", join(everyOtherThing, "\n", comments));
            }
        },
        "cppFunc": {
            keywords: ["if", "while", "for", "switch", "catch", "public", "private", "abstract", "final",
                "static", "virtual", "struct", "union", "default", "class", "enum", "interface", "new",
                "return", "throw"
            ],
            /*indent(scope)ret name(args?){*/
            re: S.decorator().sp2().maybe().add(S.comments().sp2().maybe(), S.decorator().sp2().maybe()).
            add(S.c_decl()).
            add(S.c_ident().group(3).sp1().maybe()).
            add(S.c_ident().group(4)).
            add(S.c_args().group(5)).create(500),
            handle: function(pos, all, comments, indent, scope, ret, name, args) {
                if (this.keywords.indexOf(name.toLowerCase()) > -1) {
                    return null;
                } else if (ret) {
                    if (this.keywords.indexOf(ret) > -1) {
                        //a function call
                        return null;
                    }
                } else {
                    if (!scope || /A-Z/.test(name[0])) {
                        return null;
                    }
                }
                return argument(args || "", pos, all).concat([func(pos + all.indexOf(name), name,
                    args, join(join("modifiers:", " ", scope), '\n', comments), ret)]);
            }
        },
        "cppVar": {
            keywords: ["if", "while", "for", "switch", "catch", "public", "private", "abstract", "final",
                "static", "virtual", "struct", "union", "default", "class", "enum", "interface", "new",
                "return", "throw", "else", "case"
            ],
            split: S.splitDeclList,
            pointer: /^\s*\*\s*/,
            re: S.c_decl().add(
                    S.c_ident().group(3).sp1() //type
                )
                .add(S.c_ident().add(S.safeVal().maybe().add(
                    S.s().sp2().t(",").sp2().add(
                        S.c_ident()).add(S.safeVal().maybe()).wrap().t("*")
                )).group(4)).sp().add(/[;\n\{]/)
                .create(500),
            handle: function(pos, all, indent, scope, type, name) {
                if (type && this.keywords.indexOf(type.toLowerCase()) > -1) {
                    return null;
                }
                name = name.split(this.split).filter(Boolean);
                return name.map(function(name) {
                    return variable(pos + all.indexOf(name), name.replace(this, ""), type,
                        "var", all);
                }, this.pointer);
            }
        },
        "cppClass": {
            re: /^([ \t]*)((?:(?:public|private|abstract|final|static|struct|union|virtual|default|protected)\s*)*[Cc]lass|[Ee]num|[Ii]nterface|struct|union)[ \t]+([a-zA-Z][a-zA-Z0-9]*)([^\{]*)\{/gm,
            handle: function(pos, all, indent, scope, name, olothers) {
                return variable(pos + all.indexOf(name), name, scope, "class", olothers);
            }

        },
        "pyFunc": {
            re: /^((?:\@.*\n)*)([ \t]*)(?:async\s*)?def[ \t]+([_a-z\$A-Z][_\$a-zA-Z0-9]*)?[ \t]*(\([^\)\n\(]*(?:\n[^\)\(\n]*){0,3}\))(?:\s*\- ?\>[ \t]*(\S+))?[ \t]*\:/gm,
            handle: function(index, text, doc, indent, name, args, ret) {
                return argument(args || "", index, text).concat([func(index + text.indexOf(name),
                    name, args, doc, ret)]);
            }
        },
        "pyVar": {
            re: /^([ \t]*)(?:.*; *)?(?:(?:^|[a-z_A-Z0-9_$]+)\.(?=\w+ *\=))?([a-zA-Z_][a-zA-Z0-9_$]*)(?: *\= *([^\n\;]{0,50}))/gm,
            handle: function(index, text, indent, name) {
                return variable(index, name, "variable", "", text);
            }
        },
        "pyClass": {
            re: /^([ \t]*)(class)[ \t]+([a-zA-Z][a-z_$A-Z0-9]*)([^\:]*)\:/gm,
            handle: function(pos, res, indent, cls, name) {
                return variable(pos + indent.length + 6, name, cls, "class", res);
            }
        }
    };
    for (var i in Regexps) Regexps[i].name = i;
    S.jsVar = S.jsFuncStart = S.jsFuncDeclStart = S.jsFuncBase = S = null;
    ////////We no longer need this///////

    var JS_TAGS =
        new RegexTags([Regexps.jsVarFunction,
            // Regexps.jsFuncDeclaration,
            Regexps.jsVarDeclList,
            Regexps.jsVarSingleDecl,
            Regexps.jsClass
        ]);

    var CPP_TAGS =
        new RegexTags([Regexps.cppClass,
            Regexps.cppVar,
            Regexps.cppFunc
        ]);
    var PYTHON_TAGS =
        new RegexTags([
            Regexps.pyClass,
            Regexps.pyFunc,
            Regexps.pyVar
        ]);
    var PHP_TAGS = new RegexTags([
        Regexps.jsFuncDeclaration,
        Regexps.pyVar,
        Regexps.cppClass
    ]);

    Object.assign(global.TagFinders, {
        'javascript': JS_TAGS,
        'jsx': JS_TAGS,
        'json': JS_TAGS,
        'java': CPP_TAGS,
        'c_cpp': CPP_TAGS,
        'php': PHP_TAGS,
        'python': PYTHON_TAGS
    });

    // global.TagFinders.tsStyle = JS_TAGS;
    // global.TagFinders.jsStyle = JS_TAGS;
    // global.TagFinders.pythonStyle = PYTHON_TAGS;
    // global.TagFinders.cStyle = CPP_TAGS;
}); /*_EndDefine*/