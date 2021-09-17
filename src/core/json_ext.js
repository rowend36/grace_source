_Define(function(global) {
    "use strict";
    var Utils = global.Utils;
    //Learnt from antlr: visitors and listeners
    /**
     * @typedef Node {start:number,end?:number,text?:string,type:string}
     */
    /**@constructor*/
    var TreeListener = function() {
        this.ctx = [{
            children: []
        }];
    };
    /** @returns {Node}*/
    TreeListener.prototype.getContext = function() {
        return this.ctx[this.ctx.length - 1];
    };
    TreeListener.prototype.exit = function(key, pos, json) {
        var node = this.ctx.pop();
        node.end = pos;
        node.text = json.slice(node.start, node.end);
        this.onParse(node);
    };
    TreeListener.prototype.enter = function(key, pos) {
        var last = this.getContext();
        var node = {
            type: key,
            start: pos,
            children: []
        };
        last && last.children.push(node);
        this.ctx.push(node);
    };
    TreeListener.prototype.token = function(key, pos, json, value) {
        var last = this.getContext();
        var node = {
            type: key,
            start: pos,
            end: pos + value.length,
            text: value
        };
        last && last.children.push(node);
        this.onParse(node);
    };

    function AbstractParser() {}

    //Override this method for better error recovery/reporting
    AbstractParser.prototype.walk = function(listener) {
        if (listener)
            this.listener = listener;
        if (this._debug) this.list = [];
        this.consumeFully();
        if (this._debug) console.log(Object.assign({}, this, {
            stream: null
        }));
        if (this.errorState == 0) return;
        var err;
        //possible stack overflow
        var state = this.getState();
        if (this.errorState == 1) {
            err = 'Unexpected characters at end of file';
        } else {
            var got = state.pos >= state.text.length ? 'eof' : state.text[state.pos] + '|' + Utils.toChars(
                state.text[state.pos]);
            var expected = this.rules[state.state];
            expected = (expected.select ? 'one of ' + expected.select.map(function(e) {
                return this.rules[e].name || e;
            }, this).join(" , ") : (expected.name || state.state));
            err = 'Unexpected token [' + got + ']. Expected ' + expected;
        }
        var e = new Error(err);
        var error = e.message.split("\n");
        var before = state.text.slice(Math.max(0, state.pos - 15), state.pos) + "[here]" +
            state.text.slice(
                state.pos, Math.min((state.text.indexOf("\n", state.pos + 1) + 1) || Infinity, state
                    .pos + 10));
        error[0] += " at position " + state.pos + "\n:->" + before;
        e.message = error.join("\n");
        console.error(e);
        throw e;
    };

    //Simple parser without lexer used by JsonExt and Schema and quite disappointingly, nothing else
    //Not optimized for parsing, but for editing, inspired by ace
    /**@typedef rule {
     *  rules?: [rules] -terminal rules read before this rule
        ///Input - One of re or token
     *  (re|token)?: regex or single character
        ///Output One of select,enter or next
     *  select?: [rules] - choose between multiple rules, uses lookahead
     *  enter?: start a new context, automatically validates any lookahead,
     *  exit?: context to return to after enter once all rules have been consumed
     *  next?: read the next token immediately after this rule,
     *  maybe?: like next but does not fail if there is no match so implies stopLookAhead
        /// Flags
     *  stopLookAhead: Use with next|select to automatically validate current lookahead
     *  isLookAhead: check this rule but don't consume any tokens
     *}
     */

    function RuleParser(rules) {
        RuleParser.super(this);
        if (rules) {
            this.rules = this.parseRules(rules);
        }
    }
    RuleParser.prototype.Rule = function(keys, p, name) {
        this.name = p.name || name;
        this.rules = this.enter = this.exit = this.next = this.select = undefined;
        if (p.rules) this.rules = p.rules.map(keys);
        if (p.select) this.select = p.select.map(keys);
        if (p.next) this.next = keys(p.next);
        if (p.enter) this.enter = keys(p.enter);
        if (p.exit) this.exit = keys(p.exit);
        this.re = p.re;
        this.token = p.token;
        this.stopLookAhead = !!p.stopLookAhead;
        this.isLookAhead = !!p.isLookAhead;
        this.canOptimize = !!p.canOptimize;
    };
    RuleParser.prototype.compile = function() {
        var keys = Object.create(null);
        var states = Object.keys(this.rules);
        states.forEach(function(e, i) {
            keys[i] = e;
            keys[e] = i;
        });

        function map(e) {
            return keys[e];
        }
        this.rules = states.map(function(state) {
            return new this.Rule(map, this.rules[state], state);
        }, this);
        return keys;
    };
    RuleParser.prototype.parseRules = function(rules) {
        var oneRules = [];
        for (var i in rules) {
            var e = rules[i];
            if (i === 'null') throw 'Use of reserved name null';
            if (i === '') throw 'Use of reserved name ""';
            if (typeof e == 'string') {
                e = rules[i] = {
                    token: e
                };
            }
            if (e.token && e.token.length !== 1)
                throw i + ' token length must be 1';
            if (e.re && !e.re.source.endsWith("|([^])")) {
                e.re = new RegExp(e.re.source + "|([^])", "g");
                if (e.token)
                    throw 'Cannot use .re and .token in the same rule. Perharps you mean to use .isLookAhead';
            }
            if (e.maybe) {
                if (e.select) throw 'Error: multiple exit clauses ' + i;
                e.stopLookAhead = true;
                e.select = [e.maybe, null];
            }
            if (!(e.next || e.select) || e.stopLookAhead) {
                if (e.rules) {
                    if (!(e.re || e.token) && e.rules.length == 1) {
                        oneRules.push(e);
                    } else e.canOptimize = false;
                } else e.canOptimize = true;
            } else e.canOptimize = false;
            //A rule has .canOptimize flag if it does not depend on any other rule,
            //ie it won't consume tokens unless successful 
            if ((e.select && e.enter) || (e.select && e.next) || (e.next && e.enter))
                throw 'Error: multiple exit clauses ' + i;
        }
        oneRules.forEach(function(e) {
            e.canOptimize = rules[e.rules[0]] && rules[e.rules[0]].canOptimize;
        });
        rules['null'] = {
            canOptimize: true,
            stopLookAhead: true
        }; //exit clause
        return rules;
    };
    /*Very inefficient editing using slice*/
    /*Insert in front of cursor. If advance, move cursor to front of inserted text.*/
    RuleParser.prototype.insertAfter = function(text, advance) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, pos) + text + str.slice(pos);
        if (advance) this.pos += text.length;
    };

    /*Insert text at index. Updates cursor if behind cursor */
    RuleParser.prototype.insert = function(text, index) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, index) + text + str.slice(index);
        if (pos >= index) {
            this.pos += text.length;
        }
    };
    /*Delete text of size : length at position index. Updates cursor if behind cursor*/
    RuleParser.prototype.delete = function(length, index) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, index) + str.slice(index + length);
        if (pos >= index) {
            if (pos <= index + length) this.pos = index;
            else this.pos -= length;
        }
    };

    RuleParser.prototype.setState = function(opts) {
        this.stream = opts.text;
        this.state = opts.hasOwnProperty('state') ? opts.state : 'start';
        this.pos = opts.pos || 0;
        this.inList = false;
        this.inLookAhead = false;
        this.stack = opts.stack ? opts.stack.slice(0) : [];
    };
    RuleParser.prototype.getState = function() {
        return {
            text: this.stream,
            pos: this.pos,
            stack: this.stack.slice(0),
            state: this.state
        };
    };
    RuleParser.prototype.inLookAhead = false;
    RuleParser.prototype.inList = false;
    //less is better
    RuleParser.prototype.numEmptyConsume = 0;
    RuleParser.prototype.lookAheads = 0;
    //order your rules to reduce triedConsume/consumed
    RuleParser.prototype.consumed = 0;
    RuleParser.prototype.triedConsume = 0;
    RuleParser.prototype._debug = false;

    RuleParser.prototype.consume = function(rule) {
        var text = "";
        if (this._debug) {
            if (this.inLookAhead) {
                this.lookAheadRules = this.lookAheadRules || [];
                if (this.lookAheadRules.indexOf(rule) < 0) {
                    this.lookAheadRules.push(rule);
                }
                this.lookAheads++;
            } else this.triedConsume++;
        }
        //single character
        if (rule.token) {
            if (rule.token !== this.stream[this.pos]) return false;
            text = rule.token;
        }
        //or regex
        else if (rule.re) {
            rule.re.lastIndex = this.pos;
            var match = rule.re.exec(this.stream);

            if (!match || match[match.length - 1] !== undefined) {
                return false;
            }
            text = match[0];
        }
        if (this._debug) {
            if (text) this.numEmptyConsume = 0;
            else if (++this.numEmptyConsume > 100) {
                throw new Error('Maximum number of empty tokens consumed ' + this.state);
            }
            if (!this.inLookAhead)
                this.consumed++;
        }
        return text;
    };

    //Try to consume one of multiple rules
    //Not optimal by default, tests paths twice, once in a
    //lookAhead and once again to notify listeners
    RuleParser.prototype.consumeSelect = function(rule) {
        var pos = this.pos;
        var wasInLookAhead = this.inLookAhead;
        var last = rule.select.length - 1;
        var name = this.state;
        for (var s = 0; s < rule.select.length; s++) {
            this.state = rule.select[s];
            this.inLookAhead = !(!wasInLookAhead && (s == last || this.rules[this.state].canOptimize));
            this.pos = pos;
            //lookahead
            if (this.consumeRules()) {
                if (this.inLookAhead && !wasInLookAhead) {
                    this.inLookAhead = false;
                    this.state = rule.select[s];
                    this.pos = pos;
                    //Found solution but must go through
                    //all rules again to notify the listener
                    return this.consumeRules();
                } else return true; //end of context
            } else if (!this.inLookAhead && this.pos !== pos) {
                //bug fix
                return false;
            }
        }
        //for debugging
        if (this.pos - pos < 10) {
            this.pos = pos;
            this.state = name;
        }
        return false;
    };
    RuleParser.prototype.consumeRules = function() {
        var rule = this.rules[this.state];
        if (!rule) throw new Error('Unknown rule ' + this.state);
        //consume pre rules one by one
        if (rule.rules) {
            var wasInList = this.inList;
            this.inList = this.state;
            for (var i = 0; i < rule.rules.length; i++) {
                var e = rule.rules[i];
                this.state = e;
                if (!this.consumeRules()) {
                    //wrong state
                    this.inList = wasInList;
                    return false;
                }
            }
            //wrong state
            this.state = this.inList;
            this.inList = wasInList;
        }

        //consume single tokens
        var result = this.consume(rule);
        if (result === false) return false;
        if (result && !rule.isLookAhead) {
            var pos = this.pos;
            this.pos += result.length;
            if (!this.inLookAhead)
                this.listener.token && this.listener.token(this.state, pos, this.stream, result);
        }
        if (this.list)
            this.list.push((this.inLookAhead ? "?" : "") + this.state);


        if (this.inLookAhead && rule.stopLookAhead) return true;
        //Start a new context, also notifies select as successful
        if (rule.enter !== undefined) {
            if (this.inList) throw new Error('Bad state, cannot use enter rule for ' + this.state +
                ' while in executing rules in ' + this.inList);
            //can't enter context while in select so enter implies stop select
            if (this.inLookAhead) return true;
            this.stack.push(this.state);
            this.state = rule.enter;
            this.listener.enter && this.listener.enter(this.state, this.pos, this.stream);
            return this.consumeRules(); //possible stack overflow, return true to fix
        } else if (rule.next !== undefined) {
            this.state = rule.next;
            return this.consumeRules(); //possible stack overflow, return true to fix
        } else if (rule.select)
            return this.consumeSelect(rule);
        this.state = null;
        //end of context
        return true;
    };
    //1 Unexpected characters at end of file
    //2 Unexpected character in middle of file, unexpected end of file or no viable alternative 
    RuleParser.prototype.errorState = 0; //okay
    RuleParser.prototype.consumeFully = function() {
        while (this.consumeRules()) {
            if (this.state == null) {
                while (this.stack.length) {
                    var rule = this.rules[this.stack.pop()];
                    this.listener.exit && this.listener.exit(rule.enter, this.pos, this.stream);
                    if (rule.exit) {
                        this.state = rule.exit;
                        break;
                    }
                }
                if (this.state !== null) continue;
                if (this.pos == this.stream.length) {
                    return (this.errorState = 0);
                } else
                    return (this.errorState = 1);
            }
            if (this.pos >= this.stream.length) {
                break;
            }
        }
        this.errorState = 2;
    };
    Utils.inherits(RuleParser, AbstractParser);


    //Reimplemented using rule parser
    function JSONParser(str) {
        this.setState({
            text: str,
            state: 'JSON'
        });
    }
    JSONParser.prototype = new RuleParser({
        'JSON': {
            rules: ['whitespace'],
            enter: 'ROOT_VALUE',
            exit: 'whitespace'
        },
        'ROOT_VALUE': {
            next: 'value'
        },
        'OBJ_VALUE': {
            next: 'value'
        },
        'ARR_VALUE': {
            next: 'value'
        },
        'value': {
            select: ['string', 'number', 'boolean', 'nullval', 'l{', 'l[']
        },
        'string': { //not validated
            re: /\"(?:[^\n\\\"]|\\.)*\"|\'(?:[^\n\\\']|\\.)*\'/
        },
        'nullval': {
            re: /null/
        },
        'number': { //not validated
            re: /[\-\+]?\d+(?:,\d+)*(?:\.\d*)?(?:[Ee][\-\+]?\d+)?/
        },
        'identifier': {
            re: /[a-zA-z_$][a-zA-Z_$0-9]*/
        },
        'boolean': {
            re: /true|false/
        },
        'l{': {
            name: 'object',
            token: '{',
            //add look ahead so that brace is part of next context
            isLookAhead: true,
            enter: 'OBJECT',
        },
        'l[': {
            name: 'array',
            token: '[',
            isLookAhead: true,
            enter: 'ARRAY'
        },
        'whitespace': {
            re: /\s*/
        },
        'OBJECT': {
            rules: ['{', 'whitespace'],
            select: ['}', 'item']
        },
        'KEY': {
            select: ["string", "identifier"]
        },
        'item': {
            enter: 'KEY',
            exit: 'colon'
        },
        'colon': {
            rules: ["whitespace", ":", "whitespace"],
            enter: 'OBJ_VALUE',
            exit: 'end_item'
        },
        'end_item': {
            rules: ["whitespace"],
            select: ["}", "obj_sep"]
        },
        "obj_sep": {
            rules: [",", "whitespace"],
            select: ["}", "item"]
        },
        'ARRAY': {
            rules: ["[", "whitespace"],
            select: ["]", 'arr_item']
        },
        'arr_item': {
            enter: 'ARR_VALUE',
            exit: 'close_arr_item'
        },
        'close_arr_item': {
            rules: ["whitespace"],
            select: ["]", "arr_sep"],
        },
        'arr_sep': {
            rules: [",", "whitespace"],
            select: ["]", "arr_item"]
        },
        "]": {
            token: "]"
        },
        "[": {
            token: "["
        },
        "{": {
            token: "{"
        },
        "}": {
            token: "}"
        },
        ':': {
            token: ':'
        },
        ",": {
            token: ","
        }
    });
    global.JSONParser = JSONParser;
    global.TreeListener = TreeListener;
    global.RuleParser = RuleParser;
});
_Define(function(global) {
    var JSONParser = global.JSONParser;
    var TreeListener = global.TreeListener;
    var Utils = global.Utils;
    var repeat = Utils.repeat;

    var JSONExt = new JSONParser();
    JSONExt.rules = Object.assign({}, JSONParser.prototype.rules, JSONExt.parseRules({
        "lax_start": {
            name: "lax_start",
            rules: ["not_json"],
            "enter": "JSON",
            "exit": "lax_end"
        },
        "not_json": {
            name: 'not_json',
            re: /[^\{]*/,
        },
        "lax_end": {
            re: /[^]*/
        },
        "whitespace": {
            name: "whitespace",
            rules: ["spaces"],
            maybe: "comment",
        },
        "spaces": JSONParser.prototype.rules.whitespace,
        "comment": {
            name: 'comment',
            re: /\/\/[^\n]*|\/\*(?:[^\*]|\*(?=[^\/]))*\*\//,
            maybe: "whitespace"
        }
    }));
    var keys = JSONExt.compile(),
        JSON_ = keys.JSON,
        LAX_START = keys.lax_start,
        COMMENT = keys.comment,
        LAX_END = keys.lax_end,
        NOT_JSON = keys.not_json,
        ARRAY = keys.ARRAY,
        OBJECT = keys.OBJECT,
        IDENTIFIER = keys.identifier,
        COMMA = keys[','],
        STRING = keys.string;
    keys = null;
    JSONExt._debug = false;
    /*Add comments to files: assumes pure json*/
    JSONExt.addComments = function(str, getInfo) {
        var walker = new JSONParser(str);
        /**@type {Array<{type:string,pos:number,indent:string,name?:string}>}*/
        var ctx = [];

        var next = "",
            nextPos = -1,
            key;

        function postComment(fullName, pos) {
            var info = getInfo(fullName);
            if (!info) return;
            var comments = info.split("\n").filter(Boolean);
            if (comments.length > 1) {
                var lines = [];
                for (var j in comments) {
                    lines.push(key.indent + (j == 0 ? "/* " : " * ") + comments[j]);
                }
                lines.push(key.indent + " */\n");
                next = "\n" + lines.join("\n");
            } else next = "\n" + key.indent + "/* " + comments[0] + " */\n";
            nextPos = pos;
        }
        var isFirst = false;
        //listener pattern
        try {
            walker.walk({
                enter: function(tag, pos, str) {
                    switch (tag) {
                        case "KEY":
                        case "ARR_VALUE":
                            if (next) {
                                //"outer_key": {
                                // comment
                                //    ^key
                                var newline = str.lastIndexOf("\n", pos);
                                if (newline >= nextPos) {
                                    key = ctx[ctx.length - 1];
                                    walker.insert(next.slice(0, -1), newline);
                                    key.handled = true;
                                }
                                next = "";
                            }
                            if (tag == 'ARR_VALUE') break;
                            //^"ke...
                            //start a key
                            var indent = str.lastIndexOf("\n", pos) + 1;
                            ctx.push({
                                type: "key",
                                pos: pos,
                                indent: repeat(pos - indent),
                            });
                            break;
                        case "ARRAY":
                        case "OBJECT":
                            //"key": ^{
                            if (!ctx.length) return;
                            if(isFirst){
                                var fullName = ctx.map(function(e) {
                                    return e.name;
                                }).join(".");
                                key = ctx[ctx.length - 1];
                                //TODO proper indenting
                                postComment(fullName, pos);
                            }
                            break;
                    }
                },
                exit: function(tag, pos, text) {
                    switch (tag) {
                        case "KEY":
                            //"key"^
                            //get key name
                            key = ctx[ctx.length - 1];
                            key.name = text.slice(key.pos + 1, pos - 1);
                            isFirst = true;
                            return;
                        case "OBJ_VALUE":
                            isFirst = false;
                            //"key": "value"^
                            //get the value of the key to insert after , { or [
                            //or before ] } hopefully all possible tokens
                            if (!ctx.length) return;
                            var fullName = ctx.map(function(e) {
                                return e.name;
                            }).join(".");
                            key = ctx.pop();
                            if (key.handled) return;
                            postComment(fullName, pos);
                            
                    }
                },
                token: function(type, pos, text, token) {
                    if (!next || isFirst) return;
                    switch (token) {
                        case "]":
                        case "}":
                            //try to insert it before token
                            var before = text.lastIndexOf("\n", pos);
                            if (before >= nextPos) {
                                //"key":"value"
                                //comment
                                //}
                                walker.insert(next.slice(0, -1), before);
                            } else {
                                //"key":"value"}
                                //comment
                                walker.insertAfter(next, true);
                            }
                            next = "";
                            break;
                        case ",":
                            //"key": "value",
                            //comment
                            //insert comment before next item
                            walker.insertAfter(next, true);
                            next = "";
                    }
                }
            });
        } catch (e) {
            console.error(e); //no errors
        }
        return walker.getState().text;
    };

    /*Parse files with json5 syntax*/
    JSONExt.parse = function(json, reviver, strict) {
        var hasComments = json.indexOf("//") > -1 || json.indexOf("/*") > -1;
        var trailingCommas = /,\s*[}\]]/.test(json);
        var wierdStrings = /\'|[^"\s]\s*:/.test(json);
        if (strict === false || hasComments || trailingCommas || wierdStrings) {
            var walker = this;
            this.setState({
                state: strict === false ? LAX_START : JSON_,
                text: json
            });
            var visitor = new TreeListener();
            //do we really need to construct this every time
            visitor.onParse = function(node) {
                //we have to be careful not to mess up any position info
                switch (node.type) {
                    case IDENTIFIER:
                        walker.insert('"', node.end);
                        walker.insert('"', node.start);
                        break;
                    case STRING:
                        if (node.text[0] == "\'") {
                            walker.delete(node.end - node.start, node.start);
                            var text = node.text.slice(1, -1).replace(/\"/g, "\\\"");
                            walker.insert('\"' + text + '\"', node.start);
                        }
                        break;
                    case OBJECT:
                    case ARRAY:
                        if (trailingCommas)
                            for (var i = node.children.length; i-- > 0;) {
                                var child = node.children[i];
                                if (child.type == COMMA) {
                                    walker.delete(1, child.start);
                                    walker.insert(" ", child.start);
                                } else if (child.children) break;
                            }
                        break;
                    case COMMENT:
                    case NOT_JSON:
                    case LAX_END:
                        walker.delete(node.text.length, node.start);
                        walker.insert(repeat(node.text.length), node.start);
                }
            };
            walker.walk(visitor);
            json = walker.getState().text;
            walker.setState({});
        }
        var t = JSON.parse(json, reviver);
        return t;
    };
    global.JSONExt = JSONExt;
});