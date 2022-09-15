define(function (require, exports, module) {
  'use strict';
  var Parser = require('grace/core/parser').RuleParser;
  var parser;
  /**
   * Parse out Rule objects from keys.
   * {
     ctx?: string,
     eq?: '=|!=|>'etc
     val: [values]
   }
   */
  exports.parseKey = function (key, errHandler) {
    if (!parser) _createParser();
    parser.setState({text: key});
    try {
      parser.walk();
      return {
        rule: parser.listener.compile(),
        key: parser.listener.keys.join('.'),
      };
    } catch (e) {
      if (!parser.errorState) console.log(e);
      errHandler('Error parsing key {path} -> {cause}', key, null, e.message);
    } finally {
      parser.listener.reset();
    }
  };

  var _term = function (ctx, op, val) {
    return {
      ctx: ctx,
      op: op,
      val: val,
    };
  };
  var _unescape = function (match, char) {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      default:
        return char;
    }
  };
  var _createParser = function () {
    _createParser = null;
    parser = new Parser({
      start: {
        enter: 'PART',
        exit: 'end',
      },
      end: {
        select: ['pred', 'chain', null],
      },
      chain: {
        token: '.',
        enter: 'PART',
        exit: 'end',
      },
      PART: {
        select: ['pred', 'key'],
      },
      pred: {
        token: '[',
        enter: 'EXPR',
        exit: 'end_pred',
      },
      end_pred: {
        token: ']',
        select: ['chain', 'pred', 'key', null],
      },
      EXPR: {
        rules: ['space'],//every EXPR eats the space around it
        select: ['not', 'paren', 'expr'],
      },
      not: {
        token: '!',
        enter: 'EXPR',
      },
      paren: {
        rules: ['('],
        enter: 'EXPR',
        exit: 'end_paren',
      },
      end_paren: {
        rules: [')', 'space'],
        maybe: 'join',
      },
      expr: {
        rules: ['term'],
        maybe: 'join',
      },
      join: {
        rules: ['op'],
        enter: 'EXPR',
      },
      term: {
        rules: ['name', 'space'],
        maybe: 'compare',
      },
      compare: {
        rules: ['eq'],
        stopLookAhead: true,
        next: 'right',
      },
      right: {
        rules: ['space', 'value', 'space'],
      },
      value: {
        select: ['string', 'number', 'blob'],
      },
      eq: /=~|==|=|!=|<=|<|>|>=|/,
      op: /&&|\|\|/,
      key: /[^\.\[]+/,
      name: /[^<>!=[\]();|&#\s`'"]+/,
      blob: /[^<>!=[\]();|&#\s]+|\\./,
      space: /\s*/,
      number: /-?\.?\d+|\d+(?:\.\d+)?\b/,
      string: /\"(?:[^\"\\]|\\.)+\"|\'(?:[^\'\\]|\\.)+\'/,
      '(': '(',
      ')': ')',
    });
    parser.listener = {
      stack: [],
      acc: null, //acccumulator with right,op,left,not,bracket properties
      keys: [],
      exprs: [],
      reset: function () {
        this.stack.length = 0;
        this.acc = null;
        this.keys.length = 0;
        this.exprs.length = 0;
      },
      enter: function (type, pos, all) {
        if (type !== 'EXPR') return;
        this.stack.push(this.acc);
        this.acc = {};
      },
      token: function (type, pos, all, text) {
        switch (type) {
          case 'key':
            this.keys.push(text);
            break;
          case 'name':
            this.acc.ctx = text;
            break;
          case 'eq':
            this.acc.eq = text == '=' ? '==' : text;
            break;
          case 'number':
            this.acc.value = parseFloat(text);
            break;
          case 'string':
            this.acc.value = text.slice(1, -1).replace(/\\(.)/, _unescape);
            break;
          case 'blob':
            var val = text;
            if (text == 'true') val = true;
            else if (text == 'false') val = false;
            else if (text == 'null') val = null;
            else if (text == 'undefined') val = undefined;
            else val = val.replace(/\\(.)/, _unescape);
            this.acc.value = val;
            break;
          case 'op':
            this.acc = {
              left: this.acc,
              op: text,
              right: [],
            };
            break;
          case ')': //Utils.assert(this.acc.op==='(')
            this.acc.op = text;
            break;
          // The '(' is only a stand in for the later ')' value
          case '(':
          case 'not':
            this.acc.op = text;
            this.acc.right = [];
            break;
        }
      },
      exit: function (type, pos, all) {
        if (type !== 'EXPR') return;
        var left = this.stack.pop();
        if (left) {
          this.acc = this.merge(left, this.acc);
        } else {
          this.exprs.push(this.acc);
          this.acc = null;
        }
      },
      //Higher precedence ops split terms of lower precedence
      //ie a&& -(+)-  b||c  =>  (a&&b) || c
      prec: {
        undefined: 5,
        ')': 4, //B
        '!': 3, //O
        '&&': 2, //DM
        '||': 1, //AS
        '(': 0, //lower precedence than expressions inside bracket
      },
      merge: function (left, right) {
        var prec = this.prec[left.op] - this.prec[right.op];
        if (prec < 0 || (prec === 0 && !right.left)) {
          //Right precedence or equal precedence with unary operator
          //e.g a || b && c or !!b
          left.right.push(right);
        } else if (prec > 0) {
          //Left precedence e.g ! [[a && b] || c] => [[[!a] && b] || c]
          right.left = this.merge(left, right.left);
          left = right;
        } else {
          //Equal precedence but not unary operator
          //can be optimized for multi-input binary operators
          //e.g a && b && c, a||b||c,
          left.right.push(right.left);
          left.right.push.apply(left.right, right.right);
          right.right = right.op = null;
        }
        return left;
      },
      compile: function (expr) {
        if (!expr) {
          if (!this.exprs.length) return null;
          expr = this.exprs[0];
          if (this.exprs.length > 1)
            expr = {
              left: expr,
              op: '&&',
              right: this.exprs.slice(1),
            };
        }

        var term;
        switch (expr.op) {
          case undefined:
            return _term(expr.ctx, expr.eq || '!!', expr.value);
          case '!':
            term = this.compile(expr.right[0]);
            if (term.op == 'not') return term.val;
            else return _term(undefined, 'not', term);
            break;
          case ')':
            return this.compile(expr.right[0]);
          default:
            /* || && */
            term = _term(undefined, expr.op === '||' ? 'or' : 'and', [
              this.compile(expr.left),
            ]);
            var n = expr.right;
            for (var i = 0; i < n.length; i++) {
              term.val.push(this.compile(n[i]));
            }
            return term;
        }
      },
    };
    // parser._debug = true;
  };
});