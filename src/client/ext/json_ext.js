define(function (require, exports, module) {
  'use strict';
  var RuleParser = require('grace/core/parser').RuleParser;
  var TreeListener = require('grace/core/parser').TreeListener;
  var Utils = require('grace/core/utils').Utils;
  var debug = console;
  //Reimplemented using rule parser
  function JSONParser(str) {
    this.setState({
      text: str,
      state: 'JSON',
    });
  }
  JSONParser.prototype = new RuleParser({
    JSON: {
      rules: ['whitespace'],
      enter: 'ROOT_VALUE',
      exit: 'whitespace',
    },
    ROOT_VALUE: {
      next: 'value',
    },
    OBJ_VALUE: {
      next: 'value',
    },
    ARR_VALUE: {
      next: 'value',
    },
    value: {
      //allows undefined
      select: [
        'string',
        'number',
        'boolean',
        'nullval',
        'l{',
        'l[',
        '_undefined',
      ],
    },
    string: {
      //not validated, spans multilines
      re: /\"(?:[^\n\\\"]|\\[^])*\"|\'(?:[^\n\\\']|\\[^])*\'/,
    },
    nullval: {
      re: /null/,
    },
    number: {
      //not validated, allows prefix + and ,
      re: /[\-\+]?\d+(?:,\d+)*(?:\.\d*)?(?:[Ee][\-\+]?\d+)?/,
    },
    identifier: {
      re: /[a-zA-z_$][a-zA-Z_$0-9]*/,
    },
    boolean: {
      re: /true|false/,
    },
    _undefined: {
      re: /undefined/,
    },
    'l{': {
      name: 'check_object',
      token: '{',
      //add look ahead so that brace is part of next context
      isLookAhead: true,
      enter: 'OBJECT',
    },
    'l[': {
      name: 'check_array',
      token: '[',
      isLookAhead: true,
      enter: 'ARRAY',
    },
    whitespace: {
      re: /\s*/,
    },
    OBJECT: {
      rules: ['{', 'whitespace'],
      select: ['}', 'item'],
    },
    item: {
      enter: 'OBJ_ITEM',
      exit: 'end_item',
    },
    OBJ_ITEM: {
      enter: 'KEY',
      exit: 'colon',
    },
    KEY: {
      //allows identifier
      select: ['string', 'identifier'],
    },
    colon: {
      rules: ['whitespace', ':', 'whitespace'],
      enter: 'OBJ_VALUE',
    },
    end_item: {
      rules: ['whitespace'],
      select: ['}', 'obj_sep'],
    },
    obj_sep: {
      //allows traling comma
      rules: ['comma', 'whitespace'],
      select: ['}', 'item'],
    },
    ARRAY: {
      rules: ['[', 'whitespace'],
      select: [']', 'arr_item'],
    },
    arr_item: {
      enter: 'ARR_VALUE',
      exit: 'close_arr_item',
    },
    close_arr_item: {
      rules: ['whitespace'],
      select: [']', 'arr_sep'],
    },
    arr_sep: {
      rules: ['comma', 'whitespace'],
      select: [']', 'arr_item'],
    },
    ']': ']',
    '[': '[',
    '{': '{',
    '}': '}',
    ':': ':',
    comma: ',',
  });
  exports.JSONParser = JSONParser;

  var repeat = Utils.repeat;

  var JSONExt = new JSONParser();
  JSONExt.rules = Object.assign(
    {},
    JSONParser.prototype.rules,
    JSONExt.parseRules({
      lax_start: {
        name: 'lax_start',
        rules: ['not_json'],
        enter: 'JSON',
        exit: 'lax_end',
      },
      not_json: {
        name: 'not_json',
        re: /[^\{]*/,
      },
      lax_end: {
        re: /[^]*/,
      },
      whitespace: {
        name: 'whitespace',
        rules: ['spaces'],
        maybe: 'comment',
      },
      spaces: JSONParser.prototype.rules.whitespace,
      comment: {
        name: 'comment',
        re: /\/\/[^\n]*|\/\*(?:[^\*]|\*(?=[^\/]))*\*\//,
        maybe: 'whitespace',
      },
    }),
  );
  var keys = JSONExt.compile(),
    JSON_ = keys.JSON,
    LAX_START = keys.lax_start,
    COMMENT = keys.comment,
    LAX_END = keys.lax_end,
    UNDEFINED = keys._undefined,
    NOT_JSON = keys.not_json,
    ARR_VALUE = keys.ARR_VALUE,
    ARRAY = keys.ARRAY,
    KEY = keys.KEY,
    OBJ_VALUE = keys.OBJ_VALUE,
    OBJ_ITEM = keys.OBJ_ITEM,
    OBJECT = keys.OBJECT,
    IDENTIFIER = keys.identifier,
    NUMBER = keys.number,
    COMMA = keys.comma,
    STRING = keys.string;
  keys = null;
  JSONExt._debug = false;

  /*Add comments to files: assumes no comments present*/
  JSONExt.addComments = function (str, getInfo) {
    JSONExt.setState({
      state: JSON_,
      text: str,
    });
    var parser = JSONExt;
    /**@type {Array<{
      type:string,
      pos:number,
      indent:string,
      start:number,
      name?:string}>}*/
    var ctx = [];

    var comment = '',
      key;

    function insertComment() {
      var fullName = ctx
        .map(function (e) {
          return e.name;
        })
        .join('.');
      var info = getInfo(fullName);
      if (!info) return;
      var comments = info.split('\n').filter(Boolean);
      var affected =
        key.start < key.pos - key.indent.length
          ? ctx.filter(function (e) {
              return e.pos >= key.start;
            })
          : [key];
      if (affected.length > 1) {
        comments.unshift(
          '~' +
            affected
              .map(function (e) {
                return e.name;
              })
              .join('.'),
        );
      }
      if (comments.length > 1) {
        var lines = [];
        for (var j in comments) {
          lines.push(key.indent + '// ' + comments[j]);
        }
        lines.push('');
        comment = '\n' + lines.join('\n');
      } else comment = '\n' + key.indent + '// ' + comments[0] + '\n';

      if (comment) {
        parser.insert(comment, key.start);
        affected.forEach(function (e) {
          e.pos += comment.length;
        });
        comment = '';
      }
    }
    /**
      Comments are inserted in two places above each item.
      //Comment
      name: hello
    */
    //listener pattern
    try {
      parser.walk({
        enter: function (tag, pos, str) {
          switch (tag) {
            case KEY:
              //^"ke...
              //start a key
              var start = str.lastIndexOf('\n', pos) + 1;
              //@ts-ignore
              var indent = /[ \t]*/.exec(str.slice(start))[0];
              ctx.push({
                type: 'key',
                pos: pos,
                start: start,
                handled: false, //set if the comment is inserted inside the object/array
                indent: indent,
              });
              break;
          }
        },
        exit: function (tag, pos, str) {
          switch (tag) {
            case KEY:
              key = ctx[ctx.length - 1];
              var name = str.slice(key.pos, pos);
              if (name[0] === '"' || name[0] == "'") name = name.slice(1, -1);
              key.name = name;
              insertComment();
              break;
            case OBJ_VALUE:
              ctx.pop();
          }
        },
        token: function (type) {},
      });
    } catch (e) {
      debug.error(e); //no errors
    }
    var text = parser.getState().text;
    parser.setState({});
    return text;
  };
  /** @constructor */
  function JSONConverter(parser, json, strict) {
    JSONConverter.super(this);
    this.textOffset = 0;
    this.parser = parser;
    parser.setState({
      state: strict === false ? LAX_START : JSON_,
      text: json,
    });
    // this.hasComments = json.indexOf("//") > -1 || json.indexOf("/*") > -1;
    this.trailingCommas = /,\s*[}\]]/.test(json);
    // this.wierdStrings = /\'|[^"\s]\s*:/.test(json);
    this.multilineStrings = /\\[\n\r]/.test(json);
    // if (strict === false || hasComments || trailingCommas || wierdStrings || multilineStrings) {
    //     this.onParse = Utils.noop;
    // }
  }
  Utils.inherits(JSONConverter, TreeListener);
  JSONConverter.prototype.delete = function (node) {
    var len =
      node.text === undefined ? node.end - node.start : node.text.length;
    this.parser.delete(len, node.start);
    this.textOffset -= len;
    if (this.textOffset < 0) {
      var padding = Math.min(-this.textOffset, len);
      this.parser.insert(repeat(padding), node.start);
      this.textOffset += len;
    }
  };
  JSONConverter.prototype.replace = function (node, text) {
    if (text === node.text) return;
    var len = node.text.length;
    this.parser.delete(node.end - node.start, node.start);
    this.parser.insert(text, node.start);
    this.textOffset += text.length - len;
  };
  JSONConverter.prototype.onParse = function (node) {
    //We have to be careful not to invalidate
    //any position info while editting.
    //Precisely, node.start should be kept valid.
    switch (node.type) {
      case IDENTIFIER:
        this.replace(node, '"' + node.text + '"');
        break;
      case STRING:
        var text = node.text;
        if (this.multilineStrings) {
          text = text.replace(
            /\\(?:(\n)|(\r\n)|(\r))/g,
            function (e, n, rn, r) {
              return '\\' + (n ? 'n' : r ? 'r' : 'r\\n');
            },
          );
        }
        if (text[0] == "'") {
          text = '"' + text.slice(1, -1).replace(/\"/g, '\\"') + '"';
        }
        this.replace(node, text);
        break;
      case OBJECT:
      case ARRAY:
        if (this.trailingCommas || node.deleteNextComma)
          for (var i = node.children.length; i-- > 0; ) {
            var child = node.children[i];
            if (child.type == COMMA) {
              this.delete(child);
            } else if (child.children && !child.isDeleted) break;
          }
        break;
      case NUMBER:
        this.replace(node, node.text.replace(/^\+|,/g, ''));
        break;
      case UNDEFINED:
          var parent = node.parent;
          if (parent.type === OBJ_VALUE) parent = parent.parent;
          parent.isDeleted = true;
          parent.parent.deleteNextComma = true;
        
        break;
      case OBJ_ITEM:
      case ARR_VALUE:
        if (node.isDeleted) this.delete(node);
        break;
      case COMMA:
        if (node.parent.deleteNextComma) {
          this.delete(node);
          node.parent.deleteNextComma = false;
        }
        break;
      case COMMENT:
      case NOT_JSON:
      case LAX_END:
        this.delete(node);
    }
  };
  /*Parse files with json5 syntax*/
  JSONExt.parse = function (json, reviver, strict) {
    //do we really need to construct this every time
    var visitor = new JSONConverter(this, json, strict);
    this.walk(visitor);
    json = this.getState().text;
    this.setState({});
    return JSON.parse(json, reviver);
  };
  JSONExt.stringify = function (obj, transformer, spaces) {
    return JSON.stringify(
      obj,
      function keepUndefined(key, value) {
        if (transformer) value = transformer(key, value);
        if (value !== undefined) return value;
        return '~#x~UnDF~x#~';
      },
      spaces,
    ).replace(/"~#x~UnDF~x#~"/g, 'undefined');
  };
  console.log(JSONExt.parse(JSONExt.stringify({p: undefined})));
  // JSONExt._debug = true;
  exports.JSONExt = JSONExt;
});