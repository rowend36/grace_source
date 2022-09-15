define(function (require, exports, module) {
    /*
        Regexes are faster if written very carefully
        and while being smaller in size
        just more difficult to debug but perharps
        the stongest reason I chose them over a formal parser
        is to reduce the temptation to write full language support
        Grace might be a large project it's still a pet project
        Temporary at best
        
        Try this benchmarks
        var a = /^1?$|^(11+?)\1+$/,
            isPrime = function(n) {
                return a.test('1'.repeat(n))
        }
        var isPrime2 = function(e){
            if (e % 2 == 0) return e != 2;
            if (e % 3 == 0) return e != 3;
            if (e % 5 == 0) return e != 5;
            for (var i = 7, a = e >> 1; i <= a; i += 2)
                if (e % i == 0) return true
            return e == 1 ? true : false
        }


    */
    function RegexFind(passes) {
        RegexFind.super(this);
        this.passes = passes;
    }
    require('grace/core/utils').Utils.inherits(
        RegexFind,
        require('./async_find').AsyncFind,
    );
    RegexFind.prototype.onBatch = function (ctx) {
        ctx.index = ctx.index || 0;
        var currentPass = this.passes[ctx.index];
        ctx.name = currentPass.name;
        var re = currentPass.re;
        var text = ctx.res;
        re.lastIndex = ctx.pos || 0;
        var completions = ctx.found;
        console.log(re);
        for (var i = 0; i < 1; i++) {
            console.log(res);
            var res = re.exec(text);
            if (!res) {
                ctx.pos = 0;
                ctx.done = ++ctx.index >= this.passes.length;
                return;
            }
            var data = currentPass.handle.apply(
                currentPass,
                [res.index].concat(res),
            );
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
        return a ? a.trim().replace(/(\n)+|(\s)+/g, '$1$2') : '';
    }

    function join(a, sep, b) {
        return a ? (b ? a + sep + b : a) : b || '';
    }

    var param = /(\b[a-zA-Z_\\$]\w*)?\s*(\b[a-zA-Z_\\$]\w*)/;

    function declList(list, loc, scope, re) {
        re = re || param;
        return list
            .map(function (e) {
                var pos = loc;
                loc += e.length + 1;
                var parts = re.exec(e);
                if (parts) {
                    pos += e.indexOf(parts[2]);
                    var type = trim(parts[1]);
                    var name = trim(parts[2]);
                    var comment = trim(parts[3]);
                    return variable(pos, name, type, scope, comment);
                }
            })
            .filter(Boolean);
    }

    function argument(text, index, match, singleVarRe) {
        var loc = index + match.indexOf(text) + 1;
        var list = text.slice(1, -1).split(',');
        return declList(list, loc, 'parameter', singleVarRe);
    }

    function func(loc, name, argument, doc, returnType, type) {
        var ret = trim(returnType);
        var caption = trim(name);
        var signature = join(argument, ':', ret);
        type = type || '';
        var fullname =
            join(type, type.endsWith('.') ? '' : ' ', caption) +
            ' ' +
            signature;
        return {
            loc: loc,
            score: 500,
            isFunction: true,
            caption: caption,
            type: returnType,
            signature: 'fn ' + trim(signature),
            doc: join(fullname, '\n ', trim(doc)),
        };
    }

    function variable(loc, name, type, keyword, info, score) {
        //squeeze as much info into a completion entry
        if (name)
            return {
                loc: loc,
                caption: name,
                signature: type || (keyword == 'parameter' ? 'var' : keyword),
                type: type,
                isParam: keyword == 'parameter' || undefined,
                isClass: keyword == 'class' || undefined,
                //isProperty will be gotten by props.js
                doc: trim(info),
                score: score || keyword == 'class' ? 400 : 300,
            };
    }

    exports.RegexFind = RegexFind;

    var S = {
        //fork
        /** @returns {S} */
        s: function (start) {
            var obj = Object.create(S);
            obj.source =
                (S == this ? '' : this.source) +
                (start ? start.source || start : '');
            return obj;
        },
        source: Object.create(null),
        /** @returns {S} */
        add: function (reg, reg2, reg3, reg4, reg5, reg6, reg7, reg8, reg9) {
            var obj = this;
            obj.source += reg.source;
            return reg2 ? obj.add(reg2, reg3, reg4, reg5, reg6, reg7, reg8, reg9) : obj;
        },
        /** @returns {S} */
        _add: function (reg, reg2, reg3, reg4, reg5, reg6, reg7, reg8, reg9) {
            var obj = this;
            obj.source = '(' + obj.source + reg.source + '|' + obj.source + ')';
            return reg2 ? obj.add(reg2, reg3, reg4, reg5, reg6, reg7, reg8, reg9) : obj;
        },
        /** @returns {S} */
        wrap: function () {
            this.source = '(?:' + this.source + ')';
            return this;
        },
        /** @returns {S} */
        group: function (i) {
            this.source = '(' + this.source + ')';
            return this;
        },
        /** @returns {RegExp} */
        create: function () {
            return new RegExp(this.source, 'gm');
        },
        /** @returns {S} */
        or: function (reg1) {
            var obj = this,
                i = 0;
            if (this === S) {
                obj = S.s(reg1);
                i = 1;
            }
            for (; i < arguments.length; i++) {
                obj.source += '|' + arguments[i].source;
            }
            return obj;
        },
        //horizontal greedy whitespace
        /** @returns {S} */
        sp: function () {
            this.source += '[ \\t]*(?![ \\t])';
            return this;
        },
        //compulsory greedy multiline whitespace
        /** @returns {S} */
        sp1: function () {
            this.source += '\\s+(?!\\s)';
            return this;
        },
        //greedy multiline whitespace
        /** @returns {S} */
        sp2: function () {
            this.source += '\\s*(?!\\s)';
            return this;
        },
        //empty lines
        /** @returns {S} */
        sp3: function () {
            this.source +=
                '(?:(?:(?:[\r\n]{1,2}|^)[ \\t]*)*(?:[\r\n]{1,2}|$))?(?!s+$)';
            return this;
        },
        /** @returns {S} */
        star: function () {
            return this.wrap().t('*');
        },
        //create a static template function
        /** @returns {()=>S} */
        o: function () {
            if (!this.testing) {
                return this.s.bind(this);
            }
            this.create();
            var template = this;
            return function (source) {
                if (this && this !== window && this != S) {
                    throw new Error('Static method');
                }
                return template.s(source);
            };
        },
        //add text
        /** @returns {S} */
        t: function (text) {
            this.source += text;
            return this;
        },
        //everything I just said is optional
        /** @returns {S} */
        maybe: function (ignore) {
            if (!ignore && /(?:\*)\)*$/.test(this.source)) {
                //Catch the easy warning signs
                throw new Error('Possible Catastrophic BackTracking');
            }
            this.wrap().source += '?';
            return this;
        },
        //replace backreferences
        /** @returns {S} */
        pos: function (pos) {
            this.source = this.source.replace(/\\34/g, '\\' + pos);
            return this;
        },
        debug: function () {
            window.Clip.text = this.source.replace(/\n/g, '\\n');
            return this.create();
        },
        //use with care, crashed so many times before I got this right
        /** @returns {S} */
        recurse: function (placeholder, number) {
            for (
                var re = new RegExp(placeholder, 'g');
                number-- > 0;
                re.lastIndex = 0
            ) {
                this.source = this.source.replace(re, this.source);
            }
            this.source = this.source.replace(re, '^$');
            return this;
        },
        //In future we could just antlr it out actually or at least rule parser
        //It would improve support for comments
        //Recurses up to a depth of 2**2 = 4
        //Tried to nest different types but it
        //Took a bit too much time for regex to compile: up to 2s
        //And freezes on large documents,
        //So at least we know why it's typically not done this way
        /** @returns {S} */
        bracketRange: function (s, e) {
            if (this != S) throw new Error('Static method');
            s = '\\' + s;
            e = '\\' + e;
            return S.s(
                s +
                    '(?:[^' +
                    e +
                    s +
                    ']{1,100}(?![^' +
                    e +
                    s +
                    '])|#BRACKET){0,5}' +
                    e,
            ).recurse('#BRACKET', 2);
        },
        /** @returns {S} */
        string: function (s) {
            if (this != S) throw new Error('Static method');
            s = '\\' + s;
            return S.s(
                s + '(?:[^' + s + '\r\n\\\\]|\\\\\\\\|\\\\' + s + ')*' + s,
            );
        },
        oneOf: function (words) {
            if (this != S) throw new Error('Static method');
            return S.s(words.join('|')).wrap();
        },
        testing: false,
        forceGroups: false, //use it to find the regex is actually matching during failure
        test: function (str, willPass) {
            var debug = console;
            if (!this.testing) return this;
            var toChars = require('grace/core/utils').Utils.toChars;
            //null won't match
            //false match but wrong result
            //true match and correct result
            //string result
            var res = this.create().exec(str);
            if (!res && willPass !== null) {
                debug.log(this.source, str.split(''));
                throw new Error('Failed to match');
            } else if (S.forceGroups) {
                debug.log(res);
            } else if (res) {
                if (willPass === null) {
                    throw new Error('Expected fail and got :' + res[0]);
                } else {
                    var isCorrect =
                        res[0] ==
                        (typeof willPass == 'string' ? willPass : str);
                    if (willPass === false ? isCorrect : !isCorrect) {
                        debug.log(res);
                        debug.log(
                            toChars(res[0]),
                            toChars(
                                typeof willPass == 'string' ? willPass : str,
                            ),
                        );
                        throw new Error('Mismatch : ' + res[0]);
                    }
                }
            }
            return this;
        },
    };
    if (S.forceGroups) S.add = S._add;
    /*Basic variable name*/
    S.ident = S.s('[a-zA-Z_\\$][\\-_\\$a-zA-Z0-9]*\\b')
        .test('abcd')
        .test('9abc', 'abc')
        .test('}', null)
        .o();
    S.lineStart = S.s('^').add(S.s().sp()).o();
    //adds a group
    S.comments = S.s(/\/\*((?:[^\*]|\*[^\/]){0,150})\*\//).o();
    S.bracketRange('(', ')').test('(()))', '(())');
    //Javascript
    S.jsStrictStart = S.comments(/*1*/)
        .sp()
        .sp3()
        .maybe()
        .add(S.lineStart().group(2))
        .test('/*hello*/\n   ')
        .o();
    S.jsLaxStart = S.jsStrictStart().or(S.s('[;,]').sp()).o();
    //adds two groups, matches property keys ie strings or identifiers
    S.jsPropKey = S.s(/(\"|\'|\b)/)
        .add(S.ident().group())
        .add(/\34/)
        .o();

    S.jsPropChain = S.ident(S.s().sp2().t('\\.'))
        .sp2()
        .wrap()
        .test('pako.')
        .test('op.op', false)
        .o();
    //Don't really need the arguments since tern and typescript are available
    //just need to confirm it is not a function call with a negative
    S.jsArguments = S.s('\\(')
        .sp()
        .add(/(?!\d|[^\)]*function\b)/)
        .sp2()
        .add(S.s('[^\\)\\n\\r\\(]*(?:\\n[^\\(\\)\\n]*){0,3}\\)').maybe())
        .test('(hi)') //true
        .test('(function(kop){})', false)
        .o(); //signature

    S.jsVar = S.oneOf(['var', 'const', 'let', 'readOnly'])
        .t('\\b')
        .or(S.jsPropChain().t('+'))
        .group(3)
        .maybe()
        .sp()
        .add(S.jsPropKey(/*group 4 and 5*/).pos(4).sp().t('[=:]').sp2())
        .o();

    if (S.testing)
        S.s()
            .group()
            .group()
            .add(S.jsVar())
            .test('var a =')
            .test('vzr.top.a =')
            .test('pip.pop a =', ' a =')
            .test('pop:');
    var jsClass = S.jsStrictStart()
        .add(
            S.oneOf(['class', 'interface']).group(3),
            S.s().sp1(),
            S.ident().group(4),
            S.s(/[^\{]*/).group(5),
            S.s('\\{'),
        )
        .create();

    S.c_ident =
        //c pointers
        S.s('\\*')
            .sp()
            .maybe(true)
            .add(
                S.ident().add(S.s('[:\\.]:?').add(S.ident()).star()),
                //c templates
                S.s().sp().add(S.bracketRange('<', '>')).maybe(),
                //arrays
                S.s()
                    .sp()
                    .t('\\[')
                    .sp()
                    .add(S.s(/\d+/).sp().maybe())
                    .t('\\]')
                    .star(),
            )
            .wrap()
            .test('Main<STRING EXTAEnds Pako>[][67]')
            .test('Charact::maine.helloe')
            .o();
    S.scope = S.or(
        //Warning: leaves space for catastrophic backtracking
        //Basically accepts anything
        S.s(/[^'"$\;\,\/\{\}\(\)\[\]]+/),
        //But tries to respect
        //line comments,
        S.s('\\/\\/[^$]*$'),
        //js regexes approximation
        S.string('/'),
        //strings
        S.string("'"),
        S.string('"'),
        //division op if regex fails
        S.s('\\/'),
        //strings,
        S.bracketRange('{', '}').test('{abcd,{}}}', '{abcd,{}}'),
        S.bracketRange('(', ')'),
        S.bracketRange('[', ']'),
    )
        .wrap()
        .t('{1,3}')
        .o();

    //java/py decorators
    S.decorator = S.s('@[^\r\n]+[\r\n]{1,2}').wrap().o();
    S.safeVal = S.s().sp().t('[=:]').add(S.scope()).o();

    S.c_start = S.s(/^|[\;\{\}]/)
        .wrap()
        .o();
    S.c_start(' *p')
        .test('p')
        .test('\np', 'p')
        .test('{\n  p', '  p')
        .test('  p');
    S.modifier = S.oneOf([
        'public',
        'synchronized',
        'inline',
        'protected',
        'private',
        'abstract',
        'final',
        'static',
        'virtual',
        'default',
        'strictfp',
    ]).o();

    S.modifier_list = S.modifier().sp1().star().o();

    S.c_decl = S.c_start()
        .add(
            S.s().sp().group(1), //indent
        )
        .add(
            S.modifier_list().group(2), //modifier
        )
        .o(); //done
    S.c_args = S.s()
        .sp2()
        .t('\\(')
        .add(
            S.s()
                .sp()
                .add(S.scope().t(',').star().add(S.scope().maybe()))
                .sp()
                .t('\\)'),
        )
        .test('abcd(a b cd[ ], bcd ef{)', null)
        .test('abcd(a b cd[ ], bcd ef)hekko', '(a b cd[ ], bcd ef)')
        .o();

    S.splitDeclList = S.s()
        .sp2()
        .add(S.safeVal().maybe())
        .add(S.oneOf([',', '$']))
        .create();

    //C based languages keywords
    var sharedKeywords = [
        'if',
        'while',
        'for',
        'switch',
        'catch',
        'public',
        'private',
        'abstract',
        'final',
        'static',
        'virtual',
        'struct',
        'union',
        'default',
        'class',
        'enum',
        'interface',
        'new',
        'return',
        'throw',
        'throws',
        'else',
        'case',
    ];
    var Regexps = {
        jsFuncDeclaration: {
            //function/method declaration and calls
            re: S.jsStrictStart()
                .maybe()
                .add(/((?:async\b\s*)?function)?\s*(\w+)/)
                .sp2()
                .add(S.jsArguments().group(3))
                .sp2()
                .add(/\{?/)
                .create(),
            nonFnKeywords: ['if', 'while', 'for', 'switch', 'with'],
            handle: function (
                index,
                text,
                comments,
                indent,
                fnKeyword,
                name,
                args,
            ) {
                if (!fnKeyword && this.nonFnKeywords.indexOf(name) > -1)
                    return null;
                if (!fnKeyword && text[text.length - 1] != '{') {
                    return name;
                }
                if (name == 'function' || name == 'catch') {
                    fnKeyword = join(fnKeyword, '', name);
                    name = null;
                }
                return argument(args || '', index, text).concat(
                    name
                        ? [
                              func(
                                  index + text.indexOf(name),
                                  name,
                                  args,
                                  comments,
                                  '',
                                  fnKeyword || 'method',
                              ),
                          ]
                        : [],
                );
            },
        },
        jsVarFunction: {
            //variable function, extends jsFuncDecl
            re: S.jsStrictStart()
                .maybe()
                .add(
                    S.jsVar()
                        .sp2()
                        .maybe()
                        .test('')
                        .add(/((?:async\b\s*)?function)?\s*(\w+)?/)
                        .sp2()
                        .test('async function hello')
                        .add(S.jsArguments().group())
                        .sp2()
                        .test('async function hello(var y)')
                        .add(S.s(/=\s*>|\{/).maybe()),
                )
                .test('async  function     hello(){')
                .test('color: function (){}', 'color: function (){')
                .test("'pako': (k) =>")
                .create(),
            handle: function (
                index,
                text,
                comments,
                indent,
                propChain,
                isQuoted,
                key,
                fnKeyword,
                name2,
                args,
            ) {
                var anon = text[text.length - 1] == '>';
                var decl = text[text.length - 1] == '{';
                if (!fnKeyword && !anon && !decl) {
                    return name2; //function call, discard
                }
                var results;
                if (name2) {
                    results =
                        Regexps.jsFuncDeclaration.handle(
                            index,
                            text,
                            comments,
                            indent,
                            fnKeyword,
                            name2,
                            args,
                        ) || [];
                } else results = argument(args || '', index, text);
                if (key)
                    results.push(
                        func(
                            index + text.indexOf(key),
                            key,
                            args,
                            comments,
                            '',
                            join(anon && 'anonymous', ' ', 'function'),
                        ),
                    );

                return results;
            },
        },
        //find list declarations
        jsVarDeclList: {
            paramRe: S.s()
                .group(1)
                .add(S.c_ident().group(2))
                .sp()
                .add(S.safeVal().group(3).maybe())
                .create(),
            re: S.jsLaxStart()
                .maybe()
                .add(
                    S.oneOf(['var', 'const', 'let', 'readOnly']).group(3).sp1(),
                )
                .add(
                    S.c_ident()
                        .add(
                            S.safeVal()
                                .maybe()
                                .add(
                                    S.s()
                                        .sp2()
                                        .t(',')
                                        .sp2()
                                        .add(S.c_ident())
                                        .add(S.safeVal().maybe())
                                        .wrap()
                                        .t('+'),
                                )
                                .maybe(),
                        )
                        .test('a')
                        .test('a=b,p')
                        .test('a={},c')
                        .test('a=v,a={{}', 'a=v,a')
                        .test(
                            'a=v',
                            false,
                        ) /*Don't handle singleVariable assignments*/
                        .group(4),
                )
                .sp()
                .add(/[;$\n\r\{]/)
                .test('   var a = hello, hi= bye, whoa;')
                .test(' var t;')
                .create(),
            handle: function (pos, text, comments, indent, type, list) {
                var names = list.split(',');
                return declList(
                    names,
                    pos + text.indexOf(list),
                    type,
                    this.paramRe,
                );
            },
        },
        //finds properties and assignment declarations
        jsVarSingleDecl: {
            //variables
            re: S.jsLaxStart()
                .maybe()
                .add(S.jsVar(/*adds groups 3-5*/))
                .test('jsVarSingleDecl:')
                .add(
                    S.s(/(?:new *(\w+)\b)/)
                        .maybe() /*7*/
                        .add(S.s(/.{0,50}/).group(8), S.s(/\,\{|\;|$/).wrap())
                        .group(6),
                )
                .create(),
            handle: function (
                index,
                text,
                comments,
                indent,
                propChain,
                isQuoted,
                name,
                rightHandSide,
                type,
                value,
            ) {
                type =
                    type ||
                    (rightHandSide[0] == "'" || rightHandSide[0] == '"'
                        ? 'string'
                        : '');
                var res = [];
                var isProperty =
                    propChain && propChain[propChain.length - 1] == '.';
                //filter out functions
                if (
                    type ||
                    !(
                        value.startsWith('function') ||
                        /^\(.*=\s*>(?:\{|$)/.test(value)
                    )
                ) {
                    //figure out if it's a declaration
                    if (
                        !(
                            propChain ||
                            isQuoted ||
                            text.indexOf(':') < text.indexOf(rightHandSide)
                        )
                    ) {
                        //just an assignment
                        res = [name];
                    } else {
                        res = [
                            variable(
                                index + text.indexOf(name),
                                name,
                                type || propChain,
                                isProperty ? 'property' : 'var',
                                join(propChain, '\n', comments),
                            ),
                        ];
                    }
                }
                if (isProperty) {
                    var names = propChain.slice(0, -1).split('.');
                    res.push.apply(res, names);
                }
                return res;
            },
        },
        jsClass: {
            re: jsClass,
            handle: function (
                index,
                text,
                comments,
                indent,
                type,
                name,
                everyOtherThing,
            ) {
                return variable(
                    index,
                    name,
                    type,
                    'class',
                    join(everyOtherThing, '\n', comments),
                );
            },
        },
        cppFunc: {
            keywords: sharedKeywords,
            paramRe: S.c_ident()
                .group(1)
                .sp1()
                .add(S.c_ident().group(2))
                .add(S.s().sp().add(S.comments(/*group 3*/).maybe()))
                .create(),
            re: S.s()
                .add(
                    S.decorator().sp3().test('@Override maybe\n').maybe(),
                    S.s()
                        .sp2()
                        .add(
                            S.comments(/*group 1*/)
                                .test('  \n  /*hello*/   \n    ', '/*hello*/')
                                .sp()
                                .sp3()
                                .test(
                                    '  \n  /*hello*/   \n    p',
                                    '/*hello*/   \n',
                                ),
                        )
                        .maybe(),
                    S.s().sp2().add(S.decorator().sp3()).maybe(),
                )
                .test('')
                .test('\n', '') //leaking whitespace issue
                .test('@Override /*djxjdjdjs*/helloe', '')
                .test(
                    '@Override\n/*A simple comment*/\n@Another annotation\n    p',
                    '@Override\n/*A simple comment*/\n@Another annotation\n',
                )
                .add(S.c_decl(/*indent 2 and modifiers 3*/))
                .add(
                    S.c_ident()
                        .group(4)
                        .test('public static void', 'public')
                        .sp1()
                        .maybe(/*Optional for contructors*/),
                ) /*return type*/
                .test('/*Method comment*/\n@Override\npublic static void ')
                .add(S.c_ident().group(5)) /*function name*/
                .test('{\n    public static', '    public static')
                .test('public static Man[] main')
                .add(
                    S.c_args()
                        .group(6)
                        .test('pako(guyh{},klddjd())', '(guyh{},klddjd())'),
                )
                .test(
                    'class Test{   public static Man[] main()',
                    '{   public static Man[] main()',
                )
                .test('public static Man[] mako(String<kop> hi,/*opop*/)')
                .test(
                    '{\n    public static Man main(){\n        \n    }\n    public static Mako mail(){\n}',
                    '    public static Man main()',
                )
                .create(),
            handle: function (
                pos,
                all,
                comments,
                indent,
                modifier,
                ret,
                name,
                args,
            ) {
                if (this.keywords.indexOf(name.toLowerCase()) > -1) {
                    return null;
                } else if (ret) {
                    if (this.keywords.indexOf(ret) > -1) {
                        //a function call
                        return null;
                    }
                } else {
                    if (!modifier || /^A-Z/.test(name[0])) {
                        return null;
                    }
                }
                name = name.replace(/^.*[\:\.]/, '');

                return argument(args || '', pos, all, this.paramRe).concat([
                    func(
                        pos + all.indexOf(name),
                        name,
                        args,
                        join(join('modifiers:', ' ', modifier), '\n', comments),
                        ret,
                    ),
                ]);
            },
        },
        cppVar: {
            keywords: sharedKeywords,
            split: S.splitDeclList,
            pointer: /^\s*\*\s*/,
            re: S.c_decl(/*groups 1 and 2*/)
                .add(
                    S.c_ident().group(3).sp1(), //type
                )
                .add(
                    S.c_ident()
                        .add(
                            S.safeVal()
                                .maybe()
                                .add(
                                    S.s()
                                        .sp2()
                                        .t(',')
                                        .sp2()
                                        .add(S.c_ident())
                                        .add(S.safeVal().maybe())
                                        .star(),
                                ),
                        )
                        .group(4),
                )
                .sp()
                .add(/[;\n\{\r]/)
                .create(),
            handle: function (pos, all, indent, scope, type, name) {
                if (type && this.keywords.indexOf(type.toLowerCase()) > -1) {
                    return null;
                }
                name = name.split(this.split).filter(Boolean);
                return name.map(function (name) {
                    return variable(
                        pos + all.indexOf(name),
                        name.replace(this, ''),
                        type,
                        'var',
                        all,
                    );
                }, this.pointer);
            },
        },
        cppClass: {
            re: S.s('^')
                .sp()
                .group(1)
                .add(
                    S.oneOf([
                        'public',
                        'private',
                        'abstract',
                        'final',
                        'static',
                        'struct',
                        'union',
                        'virtual',
                        'default',
                        'protected',
                    ])
                        .test('pako', null)
                        .sp1()
                        .star()
                        .group(2)
                        .add(
                            S.oneOf([
                                '[Cc]lass',
                                '[Ee]num',
                                '[Ii]nterface',
                                'struct',
                                'union',
                            ]),
                        )
                        .test('class'),
                )
                .sp1()
                .add(S.ident().group(3))
                .sp2()
                .add(
                    S.s('[^\\{]')
                        .star()
                        .group(4)
                        .test(' extends Pako {', ' extends Pako '),
                )
                .sp()
                .t('(?=\\{)')
                .create(),
            handle: function (pos, all, indent, scope, name, olothers) {
                return variable(
                    pos + all.indexOf(name),
                    name,
                    scope,
                    'class',
                    olothers,
                );
            },
        },
        pyFunc: {
            re: S.s().add(
                S.decorator().group(1).sp3().maybe(),
                /(?:async\s*)?def/,
                S.s().sp1().group(2),
                S.ident().group(3),
                S.s().sp2(),
                S.c_args().group(4),
                S.s().sp2(),
                S.s(/\- ?\>[ \t]*(\S+)/)
                    .group(5)
                    .sp()
                    .maybe(),
                S.s(':'),
            ),
            handle: function (index, text, doc, indent, name, args, ret) {
                return argument(args || '', index, text).concat([
                    func(index + text.indexOf(name), name, args, doc, ret),
                ]);
            },
        },
        pyVar: {
            re: /^([ \t]*)(?:.*; *)?(?:(?:^|[a-z_A-Z0-9_$]+)\.(?=\w+ *\=))?([a-zA-Z_][a-zA-Z0-9_$]*)(?: *\= *([^\n\r\;]{0,50}))/gm,
            handle: function (index, text, indent, name) {
                return variable(index, name, '', 'variable', text);
            },
        },
        pyClass: {
            re: /^([ \t]*)(class)[ \t]+([a-zA-Z][a-z_$A-Z0-9]*)([^\:]*)\:/gm,
            handle: function (pos, res, indent, cls, name) {
                return variable(
                    pos + indent.length + 6,
                    name,
                    cls,
                    'class',
                    res,
                );
            },
        },
    };
    for (var i in Regexps) Regexps[i].name = i;
    S = null;
    ////////We no longer need the above mess.///////

    var JS_TAGS = new RegexFind([
        Regexps.jsVarFunction,
        // Regexps.jsFuncDeclaration,
        Regexps.jsVarDeclList,
        Regexps.jsVarSingleDecl,
        Regexps.jsClass,
    ]);

    var CPP_TAGS = new RegexFind([
        Regexps.cppClass,
        Regexps.cppVar,
        Regexps.cppFunc,
    ]);
    var PYTHON_TAGS = new RegexFind([
        Regexps.pyClass,
        Regexps.pyFunc,
        Regexps.pyVar,
    ]);
    var PHP_TAGS = new RegexFind([
        Regexps.jsFuncDeclaration,
        Regexps.pyVar,
        Regexps.cppClass,
    ]);

    Object.assign(require('./tags_completer').TagFinders, {
        javascript: JS_TAGS,
        jsx: JS_TAGS,
        json: JS_TAGS,
        java: CPP_TAGS,
        c_cpp: CPP_TAGS,
        php: PHP_TAGS,
        python: PYTHON_TAGS,
    });

    // require("./tags_completer").TagFinders.tsStyle = JS_TAGS;
    // require("./tags_completer").TagFinders.jsStyle = JS_TAGS;
    // require("./tags_completer").TagFinders.pythonStyle = PYTHON_TAGS;
    // require("./tags_completer").TagFinders.cStyle = CPP_TAGS;
}); /*_EndDefine*/