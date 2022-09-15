define(function (require, exports, module) {
    'use strict';
    var Utils = require('./utils').Utils;
    var debug = console;
    //Learnt from antlr: visitors and listeners
    /**
     * @this {RuleParser}
     */
    function AbstractParser() {}

    //Override this method for better error recovery/reporting
    AbstractParser.prototype.walk = function (listener) {
        if (listener) this.listener = listener;
        if (this._debug) {
            this.list = [];
            this.lookAheads = 0;
            this.numEmptyConsume = 0;
            this.consumed = 0;
            this.triedToConsume = 0;
        }
        this.consumeFully();
        if (this._debug) {
            var stats = Object.assign({}, this, {
                stream: null,
                efficiency:
                    Math.floor(
                        (100 * this.consumed) /
                            (this.lookAheads + this.triedToConsume),
                    ) + '%',
            });
            debug.log(stats);
        }
        if (this.errorState == 0) return;

        throw this.getError();
    };
    AbstractParser.prototype.EXTRANEOUS = 1;
    AbstractParser.prototype.UNEXPECTED = 2;
    AbstractParser.prototype.OK = 0;
    AbstractParser.prototype.getError = function () {
        var err;
        if (this.errorState === this.OK) return null;
        //possible stack overflow
        var state = this.getState();
        if (this.errorState == this.EXTRANEOUS) {
            err = 'Unexpected characters at end of file.';
        } else if (this.errorState == this.UNEXPECTED) {
            var got =
                state.pos >= state.text.length
                    ? 'eof'
                    : state.text[state.pos] +
                      '|' +
                      Utils.toChars(state.text[state.pos]);
            var expected = this.rules[state.state];
            expected = expected.select
                ? 'one of ' +
                  expected.select
                      .map(function (e) {
                          return this.rules[e].name || e;
                      }, this)
                      .join(' , ')
                : expected.name || state.state;
            err = 'Unexpected token [' + got + ']. Expected ' + expected;
        }
        var e = new Error(err);
        var error = e.message.split('\n');
        var before =
            state.text.slice(Math.max(0, state.pos - 15), state.pos) +
            '[here]' +
            state.text.slice(
                state.pos,
                Math.min(
                    state.text.indexOf('\n', state.pos + 1) + 1 || Infinity,
                    state.pos + 10,
                ),
            );
        error[0] += ' at position ' + state.pos + '\n:->' + before;
        e.message = error.join('\n');
        return e;
    };

    //Simple parser without lexer used by JsonExt and Schema and quite disappointingly, nothing else
    //Not optimized, allows editing, inspired by ace Tokenizer
    /**
     * @typedef {{
        ///Input - One of re or token or rules
        rules?: Rule[]; // matches all the rules in order
        token?: string // single character
        re?: RegExp // regex or single character
        ///Output One of select,enter or next or maybe
        select?: Rule[] // choose between multiple rules using lookahead
        enter?: string // start a new context, automatically validates any lookahead,
        exit?: string // rule to read after the context in enter has been consumed
        next?: string // read the next token immediately after this rule,
        maybe?: string // like next but does not fail if there is no match so implies stopLookAhead
        /// Flags
        stopLookAhead: boolean // Use with next|select to automatically validate current lookahead
        isLookAhead: boolean // check this rule but don't consume any tokens
     *}} Rule
     * @constructor
     * @param {Record<string,Rule|string|RegExp>} [rules]
     */

    function RuleParser(rules) {
        RuleParser.super(this);
        if (rules) {
            this.rules = this.parseRules(rules);
        }
    }
    RuleParser.prototype.Rule = function Rule(keys, p, name) {
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
    RuleParser.prototype.compile = function () {
        var keys = Object.create(null);
        var states = Object.keys(this.rules);
        states.forEach(function (e, i) {
            keys[i] = e;
            keys[e] = i;
        });

        function map(e) {
            return keys[e];
        }
        this.rules = states.map(function (state) {
            return new this.Rule(map, this.rules[state], state);
        }, this);
        return keys;
    };
    RuleParser.prototype.lintRule = function (i, rule) {
        if (i === 'null') throw 'Use of reserved name null in ' + i;
        if (i === '') throw 'Use of reserved name "" ' + i;
        if (rule.token && rule.token.length != 1)
            throw 'Token length must be 1 in ' + i;
        if (!!rule.re + !!rule.token + !!rule.rules > 1)
            throw 'Multiple input clauses ' + i;
        if (
            !!rule.select + !!rule.enter + !!rule.next > 1 ||
            (rule.maybe &&
                rule.select &&
                (rule.select.length !== 2 ||
                    rule.select[0] != rule.maybe ||
                    rule.select[1] !== null))
        )
            throw 'Multiple exit clauses ' + i;
        if (rule.exit && !rule.enter)
            throw 'Cannot have exit without enter in ' + i;
    };
    RuleParser.prototype.parseRules = function (rules) {
        var rulesRules = [];
        var selectRules = [];
        for (var i in rules) {
            var e = rules[i];
            if (typeof e == 'string') e = rules[i] = {token: e};
            else if (e.constructor === RegExp) e = rules[i] = {re: e};

            if (e.re && !e.re.source.endsWith('|([^])'))
                e.re = new RegExp(e.re.source + '|([^])', 'g');

            this.lintRule(i, e);
            if (e.select) {
                if (e.select.indexOf(null) > -1) e.stopLookAhead = true;
            } else if (e.maybe) {
                e.stopLookAhead = true;
                e.select = [e.maybe, null];
            }

            //A rule has .canOptimize flag if it does not depend on any other rule,
            //ie it won't consume tokens unless successful
            if (!(e.next || e.select) || e.stopLookAhead) {
                if (e.rules) rulesRules.push(e);
                else e.canOptimize = true;
            } else if (!(e.re || e.token || e.rules) && e.select) {
                selectRules.push(e); //branch node
            } else e.canOptimize = false;
        }
        //Context Exit clause
        rules['null'] = {
            canOptimize: true,
            stopLookAhead: true,
        };
        //Optimizations
        function optimizeRules(e) {
            return (
                !e.canOptimize &&
                (e.canOptimize =
                    rules[e.rules[0]] &&
                    rules[e.rules[0]].canOptimize &&
                    (e.rules.length === 1 || rules[e.rules[0]].stopLookAhead))
            );
        }
        function optimizeSelect(e) {
            return (
                !e.canOptimize &&
                (e.canOptimize = !e.select.some(function (rule) {
                    return !rules[rule] || !rules[rule].canOptimize;
                }))
            );
        }
        while (
            selectRules.some(optimizeSelect) ||
            rulesRules.some(optimizeRules)
        ); //Do all possible optimizations
        return rules;
    };
    /*Very inefficient editing using slice*/
    /*Insert in front of cursor. If advance, move cursor to front of inserted text.*/
    RuleParser.prototype.insertAfter = function (text, advance) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, pos) + text + str.slice(pos);
        if (advance) this.pos += text.length;
    };

    /*Insert text at index. Updates cursor if behind cursor */
    RuleParser.prototype.insert = function (text, index) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, index) + text + str.slice(index);
        if (pos >= index) {
            this.pos += text.length;
        }
    };
    /*Delete text of size : length at position index. Updates cursor if behind cursor*/
    RuleParser.prototype.delete = function (length, index) {
        var str = this.stream;
        var pos = this.pos;
        this.stream = str.slice(0, index) + str.slice(index + length);
        if (pos >= index) {
            if (pos <= index + length) this.pos = index;
            else this.pos -= length;
        }
    };

    RuleParser.prototype.setState = function (opts) {
        this.stream = opts.text;
        this.state = opts.hasOwnProperty('state') ? opts.state : 'start';
        this.pos = opts.pos || 0;
        this.inList = false;
        this.inLookAhead = false;
        this.stack = opts.stack ? opts.stack.slice(0) : [];
    };
    RuleParser.prototype.getState = function () {
        return {
            text: this.stream,
            pos: this.pos,
            stack: this.stack && this.stack.slice(0),
            state: this.state,
        };
    };
    RuleParser.prototype.inLookAhead = false;
    RuleParser.prototype.inList = false;
    //less is better for  lookAheads
    RuleParser.prototype.lookAheads = 0;
    //Used to stop infinite loops
    RuleParser.prototype.numEmptyConsume = 0;
    //Order your rules to reduce triedToConsume/consumed
    RuleParser.prototype.consumed = 0;
    RuleParser.prototype.triedToConsume = 0;
    //Efficiency = consumed/(lookAheads + triedToConsume)
    RuleParser.prototype._debug = false;

    RuleParser.prototype.consume = function (rule) {
        //single character
        if (rule.token) {
            if (rule.token !== this.stream[this.pos]) return false;
            return rule.token;
        }
        //or regex
        if (rule.re) {
            rule.re.lastIndex = this.pos;
            var match = rule.re.exec(this.stream);

            if (!match || match[match.length - 1] !== undefined) {
                return false;
            }
            return match[0];
        }
    };

    //Try to consume one of multiple rules
    //Not optimal by default, tests paths twice, once in a
    //lookAhead and once again to notify listeners
    RuleParser.prototype.consumeSelect = function (rule) {
        var pos = this.pos;
        var wasInLookAhead = this.inLookAhead;
        var last = rule.select.length - 1;
        var name = this.state;
        for (var s = 0; s < rule.select.length; s++) {
            this.state = rule.select[s];
            //lookahead
            this.inLookAhead =
                wasInLookAhead ||
                (s !== last && !this.rules[this.state].canOptimize);
            this.pos = pos;
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
        //for debugging, keep failures local if parse went far
        if (this.pos - pos < 10) {
            this.pos = pos;
            this.state = name;
        }
        return false;
    };
    RuleParser.prototype.consumeRules = function () {
        var rule = this.rules[this.state];
        if (!rule) throw new Error('Unknown rule ' + this.state);
        if (!rule.rules) {
            if (this._debug) {
                if (this.inLookAhead) {
                    this.lookAheadRules = this.lookAheadRules || [];
                    if (this.lookAheadRules.indexOf(rule) < 0) {
                        rule.$state = this.state;
                        this.lookAheadRules.push(rule);
                    }
                    this.lookAheads++;
                } else this.triedToConsume++;
            }
            //consume single tokens
            var result = this.consume(rule);
            if (result === false) return false;
            if (this._debug) {
                if (result && !rule.isLookAhead) this.numEmptyConsume = 0;
                else if (++this.numEmptyConsume > 100) {
                    throw new Error(
                        'Maximum number of empty tokens consumed ' + this.state,
                    );
                }
                if (!this.inLookAhead) this.consumed++;
            }
            if (result && !rule.isLookAhead) {
                var pos = this.pos;
                this.pos += result.length;
                if (!this.inLookAhead)
                    this.listener.token(this.state, pos, this.stream, result);
            }
        } else {
            var prevList = this.inList;
            this.inList = this.state;
            for (var i = 0; i < rule.rules.length; i++) {
                var e = rule.rules[i];
                this.state = e;
                if (!this.consumeRules()) {
                    //wrong state
                    this.inList = prevList;
                    return false;
                }
            }
            this.state = this.inList; //used by enter rule
            this.inList = prevList;
        }

        if (this.list)
            this.list.push(
                Utils.repeat(this.stack.length, '-') +
                    ('|' + (rule.rules ? '' : '-')) +
                    (this.inLookAhead ? '??' : '') +
                    this.state,
            );

        if (this.inLookAhead && rule.stopLookAhead) return true;
        //Start a new context, also notifies select as successful
        if (rule.enter !== undefined) {
            if (this.inList)
                throw new Error(
                    'Bad state, cannot use enter rule for ' +
                        this.state +
                        ' while executing rules in ' +
                        this.inList,
                );
            //can't enter context while in select so enter implies stop select
            if (this.inLookAhead) return true;
            this.stack.push(this.state);
            this.state = rule.enter;
            this.listener.enter(this.state, this.pos, this.stream);
            return this.consumeRules(); //possible stack overflow, return true to fix
        } else if (rule.next !== undefined) {
            this.state = rule.next;
            return this.consumeRules(); //possible stack overflow, return true to fix
        } else if (rule.select !== undefined) return this.consumeSelect(rule);
        else this.state = null;
        //end of context
        return true;
    };
    RuleParser.prototype.errorState = 0; //okay
    RuleParser.prototype.consumeFully = function () {
        this.inLookAhead = false;
        this.inList = false;
        while (this.consumeRules()) {
            if (this.state == null) {
                while (this.stack.length) {
                    var rule = this.rules[this.stack.pop()];
                    this.listener.exit(rule.enter, this.pos, this.stream);
                    if (rule.exit) {
                        this.state = rule.exit;
                        break;
                    }
                }
                if (this.state !== null) continue;
                if (this.pos == this.stream.length) {
                    return (this.errorState = this.OK);
                } else return (this.errorState = this.EXTRANEOUS);
            }
            if (this.pos >= this.stream.length) {
                break;
            }
        }
        this.errorState = this.UNEXPECTED;
    };
    Utils.inherits(RuleParser, AbstractParser);
    /**
     * @typedef {{start:number,end?:number,text?:string,depth:number,type:string}} Node
     * @typedef {Node & {children:Node[]}} ParentNode
     * Generates Concrete Syntax Tree from a parser
     */
    /**@constructor*/
    var TreeListener = function () {
        /**@type {Array<ParentNode>} */
        this.stack = [
            {
                start: 0,
                type: '',
                depth: -1,
                children: [],
            },
        ];
    };
    /** @returns {ParentNode}*/
    TreeListener.prototype.getContext = function () {
        return this.stack[this.stack.length - 1];
    };
    TreeListener.prototype.exit = function (key, pos, json) {
        var node = /**@type {Node}*/ (this.stack.pop());
        node.end = pos;
        node.text = json.slice(node.start, node.end);
        this.onParse(node);
    };
    TreeListener.prototype.enter = function (key, pos) {
        var ctx = this.getContext();
        var node = {
            type: key,
            start: pos,
            depth: ctx ? ctx.depth + 1 : 0,
            parent: ctx,
            children: [],
        };
        ctx && ctx.children.push(node);
        this.stack.push(node);
    };
    TreeListener.prototype.token = function (key, pos, json, value) {
        var ctx = this.getContext();
        var node = {
            type: key,
            start: pos,
            parent: ctx,
            depth: ctx ? ctx.depth + 1 : 0,
            end: pos + value.length,
            text: value,
        };
        ctx && ctx.children.push(node);
        this.onParse(node);
    };

    exports.TreeListener = TreeListener;
    exports.RuleParser = RuleParser;
});