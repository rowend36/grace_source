define(function (require, exports, module) {
  'use strict';
  var S = require('grace/core/schema').Schema;
  var RuleParser = require('grace/core/parser').RuleParser;
  var TreeListener = require('grace/core/parser').TreeListener;
  //Thanks to 200 extra lines for Jsonext, we can write a parser in 150 lines,
  //Is that gain?, I think so
  var syntax = {
    start: {
      enter: 'SCHEMA',
    },
    SCHEMA: {
      //multiple rules separated by slash
      enter: 'SINGLE_RULE',
      exit: 'or',
    },
    or: {
      maybe: '|',
    },
    '|': {
      token: '|',
      enter: 'SCHEMA',
    },
    SINGLE_RULE: {
      select: ['TYPE', 'any', 'sub_rule', '?', '!', '['],
    },
    sub_rule: {
      token: '<',
      enter: 'SCHEMA',
      exit: '>',
    },
    TYPE: {
      re: /\w+/,
      maybe: 'sub_rule',
    },
    '[': {
      token: '[',
      enter: 'LIST',
      exit: ']',
    },
    LIST: {
      re: /[^\]]*/,
    },
    ']': ']',
    any: {
      rules: ['<', '>'],
    },
    '<': '<',
    '>': '>',
    '?': {
      token: '?',
      enter: 'SINGLE_RULE',
    },
    '!': {
      token: '!',
      enter: 'SINGLE_RULE',
    },
  };
  var parser = new RuleParser(syntax);
  var keys = parser.compile();
  var parseNodes = function (right, left) {
    switch (keys[left.type]) {
      case '<':
      case '>':
      case '[':
      case ']':
      case 'sub_rule':
        return right;
      case '?':
        return new S.XOptional(right);
      case '!':
        return new S.XNot(right);
      case '|':
        if (right.constructor == S.XOneOf) {
          return right;
        }
        return new S.XOneOf([right]);
      case 'LIST':
        return new S.XEnum(left.text.split(','));
      case 'TYPE':
        var schema;
        switch (left.text) {
          case 'null':
            schema = S.IsNull;
            break;
          case 'boolean':
            schema = S.IsBoolean;
            break;
          case 'glob':
          case 'string':
            schema = S.IsString;
            break;
          case 'number':
            schema = S.IsNumber;
            break;
          case 'array':
            schema = new S.XArray(right || S.Any);
            break;
          case 'url':
            schema = S.IsUrl;
            break;
          case 'filename':
            schema = S.IsFilename;
            break;
          case 'object':
            schema = S.IsObject;
            break;
          case 'mode':
            schema = S.IsMode;
            break;
          case 'time':
          case 'size':
            schema = S.IsTime;
            break;
          case 'list':
            schema = new S.XList(right || S.IsString);
            break;
          default:
            throw new Error('Invalid Schema: ' + left.text);
        }
        if (right && !schema.schema) {
          throw new Error('Invalid Schema: ' + left.text + ' cannot have type');
        }
        return schema;
      case 'SINGLE_RULE':
        if (right && right.constructor === S.XOneOf) {
          right.schemas.push(left.schema);
          return right;
        }
        return left.schema;
      case 'SCHEMA':
        return left.schema;
      default:
        throw new Error('Parser validate state');
    }
  };
  var createSchema = new TreeListener();
  createSchema.onParse = function (node) {
    switch (node.type) {
      case keys.SINGLE_RULE:
        if (node.text == '<>') {
          node.schema = S.Any;
          break;
        }
      /*fall through*/
      case keys.SCHEMA:
        node.schema = node.children.reduceRight(parseNodes, null);
    }
  };
  parser.listener = createSchema;

  /**
   * Get schema from a regex like syntax
   * of the form
   *   "<boolean>,<array> or <number...>" - appropriate type
   *   "array<type_string>" - S.XArray(type)
   *   "[value1,value2...]" - S.XEnum
   *   <type_string|type_string> - S.XOneOf
   *   {[string]:type_string} - S.XObject
   *   ["type_string"] - S.XArray
   */
  S.parse = function parse(value) {
    if (!value) throw new Error('Invalid Schema: cannot be empty');
    if (typeof value == 'string') {
      parser.setState({
        text: value,
        state: keys.start
      });
      TreeListener.call(createSchema); //reset
      parser.walk();
      return createSchema.getContext().children[0].schema;
    }
    if (typeof value == 'object') {
      //a schema
      if (typeof value.validate == 'function') return value;
      if (value.constructor == RegExp) {
        return new S.XRegex(value, value.name || value);
      }
      if (Array.isArray(value)) {
        if (value.length > 1)
          throw new Error(
            'Invalid Schema: Array schema must have only one value'
          );
        return new S.XArray(value.length ? S.parse(value[0]) : S.Any);
      }
      var schemas = {};
      for (var i in value) {
        schemas[i] = S.parse(value[i]);
      }
      return new S.XObject(schemas);
    }
    throw new Error('Invalid Schema ' + value);
  };
});