define(function (require, exports, module) {
    'use strict';
    //Class for validating json objects
    //Using serializable objects
    var Utils = require('./utils').Utils;
    var RuleParser = require('./parser').RuleParser;
    var TreeListener = require('./parser').TreeListener;

    function XObject(schemas) {
        this.schemas = schemas;
    }
    XObject.prototype.validate = function (value) {
        if (!value || typeof value !== 'object') {
            return 'Expected object got ' + (value && typeof value);
        }
        var error;
        for (var i in this.schemas) {
            var schema = this.schemas[i];
            if (schema.isOptional && !value.hasOwnProperty(i)) {
                continue;
            }
            if ((error = schema.validate(value[i]))) {
                return '.' + i + ': ' + error;
            }
        }
        return false;
    };

    function XMap(keys, values) {
        this.keys = keys;
        this.values = values;
        XMap.super(this);
    }
    Utils.inherits(XMap, XObject);
    XMap.prototype.validate = function (value) {
        var error = XObject.prototype.validate.call(this, value);
        if (error) return error;
        for (var i in value) {
            if (this.keys && !(error = this.keys.validate(i))) {
                return 'Unexpected key ' + i + ': ' + error;
            }
            if (this.values && !(error = this.values.validate(value[i]))) {
                return '.' + i + ': ' + error;
            }
        }
    };
    var XEnum = function (values) {
        this.values = values;
    };
    XEnum.prototype.validate = function (value) {
        return this.values.indexOf(value) < 0
            ? 'Is not one of ' +
                  this.values.slice(0, -1).join(',') +
                  (this.values.length > 1
                      ? ' or ' + this.values[this.values.length - 1]
                      : '')
            : false;
    };

    var XNot = function (schema, message) {
        this.schema = schema;
        this.message = message;
    };
    XNot.prototype.validate = function (value) {
        if (this.schema.validate(value)) return false;
        return this.message || 'Cannot be ' + value;
    };

    var XArray = function (type) {
        this.schema = type;
    };
    XArray.prototype.validate = function (value) {
        if (!Array.isArray(value)) {
            return 'Is not an array';
        }
        var error;
        for (var i = 0; i < value.length; i++) {
            if ((error = this.schema.validate(value[i]))) {
                return (
                    (value[i] && typeof value[i] == 'object'
                        ? ''
                        : value[i] + ':') + error
                );
            }
        }
        return false;
    };
    var XOneOf = function (schemas) {
        this.schemas = schemas;
    };
    XOneOf.prototype.validate = function (value) {
        var errors;
        var passed = this.schemas.some(function (schema) {
            var error = schema.validate(value);
            if (error) errors = (errors ? errors + ' and ' : '') + error;
            else return true;
        });
        if (!passed) return errors;
    };
    //Only valid in the context of an object
    var XOptional = function (schema) {
        this.schema = schema;
    };
    XOptional.prototype.validate = function (value) {
        return this.schema.validate(value);
    };
    XOptional.prototype.isOptional = true;

    /*
    var XAllOf = function(schemas) {
        this.schemas = schemas;
    };
    XAllOf.prototype.validate = function(v) {
        return this.schemas.some((schema) => schema.validate(v));
    };*/

    function XValidIf(func, name) {
        this.name = name;
        this.validate = function (value) {
            if (!func(value)) return 'Is not ' + this.name;
        };
    }

    var NotNull = new XValidIf(function NotNull(value) {
        return value != null;
    });
    var IsString = new XValidIf(function IsString(value) {
        return typeof value == 'string';
    });
    var IsNumber = new XValidIf(function IsNumber(value) {
        return typeof value == 'number';
    });
    var IsBoolean = new XValidIf(function IsBoolean(value) {
        return typeof value == 'boolean';
    });
    var IsNull = new XValidIf(function IsBoolean(value) {
        return value === null;
    });
    var IsTime = new XOneOf([
        IsNumber,
        new XValidIf(function IsTime(value) {
            return Utils.parseTime(value, true) !== false;
        }),
    ]);
    function XList(schema) {
        this.schema = schema;
    }
    XList.prototype.validate = function (list) {
        if (typeof list !== 'string') return 'Invalid type, expected string';
        return XArray.prototype.validate.call(this, Utils.parseList(list));
    };
    var Any = {
        validate: Utils.noop,
    };
    var IsObject = new XObject();
    var IsPlain = new XValidIf(function (value) {
        if (value == null || value == undefined || typeof value !== 'object')
            return true;
    }, 'a boolean, string or number value');
    //need validation
    var IsUrl = {
        validate: function (value) {
            try {
                var parsed = new URL(value);
                if (
                    parsed.protocol === 'http:' ||
                    parsed.protocol === 'https:' ||
                    parsed.protocol === 'file:' ||
                    parsed.protocol === 'ftp:' ||
                    parsed.protocol === 'ws:' ||
                    parsed.protocol === 'wss:'
                )
                    return false;
                return 'Invalid protocol ' + parsed.protocol;
            } catch (e) {
                return e.message;
            }
            return false;
        },
    };
    var IsKey = new XValidIf(function (value) {
        var tester = /^(?:Ctrl-)?(?:Alt-)?(?:Shift-)?(?:(?:(?:Page)?(?:Down|Up))|Left|Right|Delete|Tab|Home|End|Insert|Esc|Backspace|Space|Enter|.|F1?[0-9])$/i;
        if (
            typeof value === 'string' &&
            !value.split(/\|| /g).some(function (str) {
                return !tester.test(str);
            })
        )
            return true;
    }, 'valid keystring');
    var modelist = ace.require('ace/ext/modelist');
    var IsMode = new XValidIf(function (mode) {
        return modelist.modesByName[mode];
    }, 'a language mode');
    var XRegex = function (regex, name) {
        XRegex.super(this, [
            function (value) {
                return this.regex.test(value);
            },
            name,
        ]);
    };
    Utils.inherits(XRegex, XValidIf);

    var IsFilename = new XRegex(/[\w-~\(\)\/]+/);
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
    var parser = new RuleParser();
    parser.rules = parser.parseRules(syntax);
    var parseNodes = function (right, left) {
        switch (left.type) {
            case '<':
            case '>':
            case '[':
            case ']':
            case 'sub_rule':
                return right;
            case '?':
                return new XOptional(right);
            case '!':
                return new XNot(right);
            case '|':
                if (right.constructor == XOneOf) {
                    return right;
                }
                return new XOneOf([right]);
            case 'LIST':
                return new XEnum(left.text.split(','));
            case 'TYPE':
                var schema;
                switch (left.text) {
                    case 'null':
                        schema = IsNull;
                        break;
                    case 'boolean':
                        schema = IsBoolean;
                        break;
                    case 'string':
                        schema = IsString;
                        break;
                    case 'number':
                        schema = IsNumber;
                        break;
                    case 'array':
                        schema = new XArray(right || Any);
                        break;
                    case 'url':
                        schema = IsUrl;
                        break;
                    case 'filename':
                        schema = IsFilename;
                        break;
                    case 'object':
                        schema = IsObject;
                        break;
                    case 'mode':
                        schema = IsMode;
                        break;
                    case 'time':
                    case 'size':
                        schema = IsTime;
                        break;
                    case 'list':
                        schema = new XList(right || IsString);
                        break;
                    default:
                        throw new Error('Invalid Schema: ' + left.text);
                }
                if (right && !schema.schema) {
                    throw new Error(
                        'Invalid Schema: ' + left.text + ' cannot have type'
                    );
                }
                return schema;
            case 'SINGLE_RULE':
                if (right && right.constructor === XOneOf) {
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
            case 'SINGLE_RULE':
                if (node.text == '<>') {
                    node.schema = Any;
                    break;
                }
            /*fall through*/
            case 'SCHEMA':
                node.schema = node.children.reduceRight(parseNodes, null);
        }
    };
    parser.listener = createSchema;

    var Schema = {
        /**
         * Get schema from a value. Used when you fail to configure type of config.
         * @related {require('./config/namespaces')~inferSchema}
         */
        fromValue: function (value) {
            //For strings, type is just one thing,
            //you have to specify a type to get valid values
            //path,url,time,size etc
            if (typeof value == 'boolean') return IsBoolean;
            if (typeof value == 'string') return IsString;
            if (typeof value == 'number') return IsNumber;
            //Plain works well since, mostly for null and undefined values.
            if (!IsPlain.validate(value)) return IsPlain;
            if (Array.isArray(value)) {
                return new XArray(Schema.fromValue(value[0]));
            }
            return IsObject;
        },
        /**
         * Get schema from a regex like syntax
         * of the form
         *   "<boolean>,<array> or <number...>" - appropriate type
         *   "array<type_string>" - XArray(type)
         *   "[value1,value2...]" - XEnum
         *   <type_string|type_string> - XOneOf
         *   {[string]:type_string} - XObject
         *   ["type_string"] - XArray
         */
        parse: function parse(value) {
            if (!value) throw new Error('Invalid Schema: cannot be empty');
            if (typeof value == 'string') {
                parser.setState({
                    text: value,
                });
                TreeListener.call(createSchema); //reset
                parser.walk();
                return createSchema.getContext().children[0].schema;
            }
            if (typeof value == 'object') {
                //a schema
                if (typeof value.validate == 'function') return value;
                if (value.constructor == RegExp) {
                    return new XRegex(value, value.name || value);
                }
                if (Array.isArray(value)) {
                    if (value.length > 1)
                        throw new Error(
                            'Invalid Schema: Array schema must have only one value'
                        );
                    return new XArray(
                        value.length ? Schema.parse(value[0]) : Any
                    );
                }
                var schemas = {};
                for (var i in value) {
                    schemas[i] = Schema.parse(value[i]);
                }
                return new XObject(schemas);
            }
            throw new Error('Invalid Schema ' + value);
        },
        XObject: XObject,
        XArray: XArray,
        XOneOf: XOneOf,
        XOptional: XOptional,
        XValidIf: XValidIf,
        XRegex: XRegex,
        XNot: XNot,
        XEnum: XEnum,
        XMap: XMap,
        NotNull: NotNull,
        IsString: IsString,
        IsTime: IsTime,
        IsSize: IsTime,
        IsFilename: IsFilename,
        IsMode: IsMode,
        IsObject: IsObject,
        IsKey: IsKey,
        IsNumber: IsNumber,
        IsUrl: IsUrl,
        IsBoolean: IsBoolean,
        IsPlain: IsPlain,
        IsNull: IsNull,
        Any: Any,
    };
    for (var i in Schema) {
        if (i[0] == 'X') Schema[i].prototype.name = i;
        else if (typeof Schema[i] != 'function')
            Schema[i].name =
                Schema[i].name || i.replace('Is', '').toLowerCase();
    }
    exports.Schema = Schema;
});