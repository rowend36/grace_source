define(function(require,exports,module) {
    var Utils = require("grace/core/utils").Utils;
    var AsyncTags = require("./async_tags").AsyncTags;
    var LineStream = require("./scope").LineStream;
    var DocStream = require("./scope").DocStream;
    var TextStream = require("./scope").TextStream;
    var TagParser = new require("grace/core/json_ext").RuleParser({
        'name': {
            re: /[^ !][^\t]+/
        },
        'tab': '\t',
        'file': {
            re: /[^ !][^\t]+/
        },
        'start': {
            rules: ['name', 'tab', 'file', 'tab', 'one_or_more_fields', 'eof'],
        },
        'one_or_more_fields': {
            //Expressing this one or more relationship
            //but we chose to keep the api small and lightweight
            //During parse, rules are ignored and only tokens are parsed
            rules: ['address'],
            next: 'others'
        },
        'eof': {
            select: ['lf', 'crlf', 'cr', null],
        },
        'cr': '\r',
        'lf': '\n',
        'crlf': {
            rules: ['cr', 'lf']
        },
        'address': {
            rules: ['whitespace'],
            select: ['re_f', 're_b', 'line']
        },
        're_b': {
            isLookAhead: true,
            token: '?',
            stopLookAhead: true,
            next: 'search_back'
        },
        'search_back': {
            re: /\?(?:\\\.|[^\\\?])*\?/
        },
        're_f': {
            isLookAhead: true,
            token: '/',
            stopLookAhead: true,
            next: 'search_forward'
        },
        'search_forward': {
            re: /\/(?:\\\.|[^\\\/])*\//
        },
        'line': {
            re: /[0-9]+/
        },
        'whitespace': {
            re: /\s*/
        },
        ';': ';',
        //The last 3 rules are optional, but rather than lookaheads, we just blunder through
        //which renders eof useless
        'others': {
            rules: ['whitespace', ';', 'whitespace'],
            select: ['comment', 'address']
        },
        'comment': {
            token: "\"",
            stopLookAhead: true,
            next: "tagFields"
            // maybe: "tagFields"
        },
        'tagFields': {
            rules: ["whitespace", "tagField"],
            next: "tagFields"
            // maybe: "tagFields"
        },
        "tagField": {
            re: /[^\s]+/
        }
    });
    var keys = TagParser.compile();

    function toRegex(val) {
        var start = 1;
        var end = val.length - 1;
        if (val[start] == '^') start++;
        if (val[end - 1] == "$") end--;
        return val.slice(1, start) + Utils.regEscape(val.slice(start, end)) + val.slice(end, -1);
    }

    function toSignature(char) {
        if (char.length > 1) return char;
        switch (char) {
            case 'c':
                return 'class';
            case 'd':
                return 'define';
            case 'e':
                return 'enumerator';
            case 'f':
                return 'function';
            case 'F':
                return 'file name';
            case 'g':
                return 'enumeration';
            case 'm':
                return 'member';
            case 'p':
                return 'prototype';
            case 's':
                return 'struct';
            case 't':
                return 'typedef';
            case 'u':
                return 'union';
            case 'v':
                return 'variable';
            default:
                return char;
        }
    }
    var fileScope = {
        start: 0,
        end: Infinity
    };
    var TagFactory = TagParser.listener = {
        data: null,
        file: null,
        token: function(key, pos, json, value) {
            var data = this.data;
            switch (key) {
                case keys.name:
                    data.caption = value;
                    break;
                case keys.file:
                    this.file = value;
                    data.address = [];
                    break;
                case keys.line:
                    data.address.push(parseInt(value));
                    break;
                case keys.search_forward:
                    data.address.push({
                        needle: toRegex(value),
                        regExp: true
                    });
                    break;
                case keys.search_back:
                    data.address.push({
                        needle: toRegex(value),
                        regExp: true,
                        backwards: true
                    });
                    break;
                case keys.tagField:
                    var colon = value.indexOf(":");
                    if (colon < 0) {
                        var signature = toSignature(value);
                        if (signature == "member") {
                            data.isProperty = true;
                        } else data.signature = signature;
                    } else {
                        var tagKey = value.substring(0, colon);
                        var tagValue = value.substring(colon + 1);
                        if (tagKey == 'kind') {
                            if (tagValue == "member") {
                                data.isProperty = true;
                            } else data.signature = tagValue;
                        } else if (tagKey == 'class' || tagKey == 'struct') {
                            if (tagValue == 'class' || tagValue == 'struct') {
                                data.isProperty = true;
                            }
                            if (tagKey == "function") {
                                data.scope = fileScope;
                            }
                        }
                        data.docHTML = (data.docHTML || "") +
                            "<div><span class='Ace-Tern-jsdoc-tag'>" + tagKey + "</span>" + tagValue +
                            "</div>";
                    }
                    //This part is a bit involved
                    //Currently, the props.js code works quite well so I don't really see the need
                    // if (tagKey == 'scope') {
                    // Could attempt to construct scope information like the one Grace generates
                    // But since gotoDefinition ignores it, it can only help in sorting completions basically
                    // So not today, perharps tomorrow, perharps later in future, perharps never
                    //  }
            }
        }
    };

    var Ctags = new AsyncTags();
    var FileUtils = require("grace/core/file_utils").FileUtils;
    Ctags.onFinish = function(ctx) {
        var Tags = require("./completer").TagCompleter;
        var tagFile = ctx.file || "";
        var tagDirectory = FileUtils.dirname(tagFile) || "";
        if (tagDirectory.endsWith("/.ctags.d")) {
            //todo use tag fields
            tagDirectory = FileUtils.dirname(tagDirectory);
        }
        var tagSuffix = ':' + (
            FileUtils.relative(FileUtils.getProject().rootDir, tagFile, false, true) ||
            FileUtils.filename(tagFile));
        for (var file in ctx.files) {
            var header = {
                "!scopes": [], //required by completer
                "!mode": ace.require("ace/ext/modelist").getModeForPath(file).name,
                "!lib": FileUtils.resolve(tagDirectory, file)
            };
            Tags.loadParsedTags(file + tagSuffix, header, ctx.files[file]);
        }
        //profile
        AsyncTags.prototype.onFinish.call(this, ctx);
    };
    Ctags.onBatch = function(ctx) {
        var pos = ctx.pos;
        if (!ctx.stream) {
            ctx.found = {
                length: 0
            }; //for profiling
            if (typeof ctx.res == "string") {
                ctx.stream = new LineStream(new TextStream(ctx.res));
            } else ctx.stream = new DocStream(ctx.res);
        }
        var str = ctx.stream;
        if (!ctx.files) ctx.files = {};
        for (var i = 0; i < 100 && str.next() !== null; i++) {
            //Reset parser state
            var data = TagFactory.data = {};
            TagFactory.file = undefined;
            TagParser.setState({
                state: keys.start,
                text: str.current
            });
            //ignore any errors due to incomplete lines/comments
            TagParser.consumeFully();
            if (!data.caption || data.caption.startsWith('AnonymousFunction')) continue;
            //if it got this far we can help out
            if (data.address && data.address.length < 1) {
                data.address.push(0);
                data.address.push(data.caption);
            }
            var file = TagFactory.file || 'ctags';
            if (!ctx.files[file]) {
                ctx.files[file] = [];
            }
            ctx.found.length++;
            ctx.files[file].push(data);
        }
        ctx.done = str.current === null;
        ctx.pos = pos;
    };
    exports.Ctags = Ctags;
});