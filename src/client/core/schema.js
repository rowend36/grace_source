define(function(require,exports,module) {
    "use strict";
    //Class for validating json objects
    //Using serializable objects
    var debug = console;
    var Utils = require("./utils").Utils;
    var RuleParser = require("./json_ext").RuleParser;
    var TreeListener = require("./json_ext").TreeListener;

    function XObject(schema) {
        this.schema = schema;
    }
    XObject.prototype.invalid = function(value) {
        if (typeof value !== 'object') {
            return " Expected object got " + typeof value;
        }
        if (!value) {
            return " Expected object got " + value;
        }
        var error;
        for (var i in this.schema) {
            var schema = this.schema[i];
            if (schema.isOptional && !value.hasOwnProperty(i)) {
                continue;
            }
            if ((error = schema.invalid(value[i]))) {
                return "." + i + ": " + error;
            }
        }

        return false;
    };

    var XEnum = function(values) {
        this.values = values;
    };
    XEnum.prototype.invalid = function(v) {
        return this.values.indexOf(v) < 0 ? "Expected one of " + this.values.join(",") + ", got " + v :
            false;
    };

    var XNot = function(schema, message) {
        this.schema = schema;
        this.message = message;
    };
    XNot.prototype.invalid = function(v) {
        if (this.schema.invalid(v)) return false;
        return this.message || "Must not be " + v;
    };

    var XArray = function(type) {
        this.schema = type;
    };
    XArray.prototype.invalid = function(e) {
        if (!Array.isArray(e)) {
            return "Expected an array";
        }
        var error;
        for (var i = 0; i < e.length; i++) {
            if ((error = this.schema.invalid(e[i]))) {
                return e[i] + ":" + error;
            }
        }
        return false;
    };
    var XOneOf = function(schemas) {
        this.schemas = schemas;
    };
    XOneOf.prototype.invalid = function(v) {
        var errors = "";
        var passed = this.schemas.some(function(e) {
            var t = e.invalid(v);
            if (t) errors += " ," + t;
            else return true;
        });
        if (!passed) return errors;
    };
    //Only valid in the context of an object
    var XOptional = function(schema) {
        this.schema = schema;
    };
    XOptional.prototype.invalid = function(v) {
        return this.schema.invalid(v);
    };
    XOptional.prototype.isOptional = true;
    var XRegex = function(regex, name) {
        this.regex = regex;
        this.name = name;
    };
    XRegex.prototype.invalid = function(value) {
        return this.regex.test(value) ? false : "Failed to match format for " + this.name;
    };

    /*function StrictKeys(schema) {
        this.schema = schema;
    }
    StrictKeys.prototype.invalid = function(value) {
        return this.schema.invalid(Object.keys(value));
    };
    
    function StrictValues(schema) {
        this.schema = schema;
    }
    StrictValues.prototype.invalid = function(value) {
        return this.schema.invalid(Object.values(value));
    };
    
    var XAllOf = function(schemas) {
        this.schemas = schemas;
    };
    XAllOf.prototype.invalid = function(v) {
        return this.schemas.some((e) => e.invalid(v));
    };*/


    function XInvalidIf(func) {
        this.invalid = function(v) {
            if (func(v)) return "Failed test " + this.name;
        };
    }

    var NotNull = new XInvalidIf(function NotNull(value) {
        return value == null;
    });
    var IsString = new XInvalidIf(function IsString(value) {
        return typeof value != "string";
    });
    var IsNumber = new XInvalidIf(function IsNumber(value) {
        return typeof value != "number";
    });
    var IsBoolean = new XInvalidIf(function IsBoolean(value) {
        return typeof value != "boolean";
    });
    var IsNull = new XInvalidIf(function IsBoolean(value) {
        return value !== null;
    });
    var IsTime = new XOneOf([IsNumber, new XInvalidIf(function IsTime(value) {
        return Utils.parseTime(value, true) == false;
    })]);
    var Any = {
        invalid: Utils.noop
    };
    var IsObject = new XObject();
    var IsPlain = {
        invalid: function(value) {
            if (value == null || value == undefined ||
                typeof value !== "object")
                return false;
            return "Must be a boolean, string or number value";
        }
    };
    //need validation
    var IsUrl = new XInvalidIf(function IsUrl(url) {
        try {
            var parsed = new URL(url);
            if (
                parsed.protocol === 'http' ||
                parsed.protocol === 'https' ||
                parsed.protocol === 'file' ||
                parsed.protocol === 'ftp'
            )
                return false;
            return 'Invalid protocol ' + parsed.protocol;
        } catch (e) {
            return e.message;
        }
        return false;
    });
    var IsFilename = new XRegex(/[\w-~\(\)\/]+/);
    //Thanks to 200 extra lines in Jsonext, we can write a parser in 150 lines,
    //Is that gain, I think so
    var syntax = {
        'start': {
            enter: 'SCHEMA'
        },
        'sub_rule': {
            'token': '<',
            'enter': 'SCHEMA',
            'exit': '>'
        },
        'SCHEMA': {
            //multiple rules separated by slash
            enter: 'SINGLE_RULE',
            exit: 'or'
        },
        'or': {
            'maybe': '|'
        },
        '|': {
            token: '|',
            enter: 'SCHEMA'
        },
        'SINGLE_RULE': {
            select: ['TYPE', 'any', 'sub_rule', "?", "!", '[']
        },
        'TYPE': {
            re: /\w+/,
            maybe: 'sub_rule'
        },
        '[': {
            token: '[',
            enter: 'LIST',
            exit: ']'
        },
        'LIST': {
            re: /[^\]]*/
        },
        ']': {
            token: ']'
        },
        'any': {
            rules: ['<', '>'],
        },
        '<': {
            token: '<'
        },
        '>': {
            token: '>'
        },
        '?': {
            token: '?',
            enter: 'SINGLE_RULE'
        },
        '!': {
            token: '!',
            enter: 'SINGLE_RULE'
        }
    };
    var parser = new RuleParser();
    parser.rules = parser.parseRules(syntax);
    var parseNodes = function(right, left) {
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
                return new XEnum(left.text.split(","));
            case 'TYPE':
                var schema;
                switch (left.text) {
                    case "null":
                        schema = IsNull;
                        break;
                    case "boolean":
                        schema = IsBoolean;
                        break;
                    case "string":
                        schema = IsString;
                        break;
                    case "number":
                        schema = IsNumber;
                        break;
                    case "url":
                        schema = IsUrl;
                        break;
                    case "filename":
                        schema = IsFilename;
                        break;
                    case "object":
                        schema = IsObject;
                        break;
                    case "time":
                    case "size":
                        schema = IsTime;
                        break;
                    case "array":
                        schema = new XArray(right || Any);
                        break;
                    case "url":
                        schema = IsUrl;
                        break;
                    default:
                        throw new Error('Invalid Schema: ' + left.text);
                }
                if (right && schema.constructor !== XArray) {
                    throw new Error('Invalid Schema: ' + left.text + ' cannot have type');
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
                debug.log({
                    left,
                    right
                });
                throw new Error('Parser invalid state');
        }
    };
    var createSchema = new TreeListener();
    createSchema.onParse =
        function(node) {
            switch (node.type) {
                case 'SINGLE_RULE':
                    if (node.text == "<>") {
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
        //Get schema from a value
        fromValue: function(value) {
            //Plain works well since, mostly, 
            //For non-string values, we simply use parseInt,parseFloat,parseList methods
            //For strings, type is just one thing, 
            //you have to specify a type to get valid values
            //path,url,time,size etc 
            if (typeof value == "boolean") return IsBoolean;
            if (typeof value == "string") return IsString;
            if (typeof value == "number") return IsNumber;
            if (value == null || value == undefined) {
                debug.error('Cannot infer type');
                return IsPlain;
            }
            if (!IsPlain.invalid(value))
                return IsPlain;
            if (Array.isArray(value)) {
                return new XArray(Schema.fromValue(value[0]));
            }
            return IsObject;
        },
        /**
         * Get schema from a regex like syntax
         * of the form
         *   "<boolean>|<array>|<number...>" - appropriate type
         *   "array<type_string>" - Xarray(type)
         *   "[value1,value2...]" - XEnum
         *   <type_string|type_string> - Xoneof
         *     {[string]:type_string} - Xobject
         *   [type_string] - XArray
         */
        parse: function parse(value) {
            if (!value) throw new Error('Invalid Schema: cannot be empty');
            if (typeof value == "string") {
                parser.setState({
                    text: value
                });
                TreeListener.call(createSchema);
                parser.walk();
                return createSchema.getContext().children[0].schema;
            }
            if (typeof value == "object") {
                //a schema
                if (value.invalid) return value;
                if (value.constructor == RegExp) {
                    return new XRegex(value, value.name || value);
                }
                if (Array.isArray(value)) {
                    if (value.length > 1) throw new Error(
                        'Invalid Schema: Array schema must have only one value');
                    return new XArray(value.length ? Schema.parse(value[0]) : Any);
                }
                var schemas = {};
                for (var j in value) {
                    schemas[j] = Schema.parse(value[j]);
                }
                return new XObject(schemas);
            }
            throw new Error('Invalid Schema ' + value);
        },
        XObject: XObject,
        XArray: XArray,
        XOneOf: XOneOf,
        XOptional: XOptional,
        XInvalidIf: XInvalidIf,
        XRegex: XRegex,
        XNot: XNot,
        XEnum: XEnum,
        NotNull: NotNull,
        IsString: IsString,
        IsTime: IsTime,
        IsFilename: IsFilename,        
        IsObject: IsObject,
        IsNumber: IsNumber,
        IsUrl: IsUrl,
        IsBoolean: IsBoolean,
        IsPlain: IsPlain,
        IsNull: IsNull,
        Any: Any
    };
    for (var i in Schema) {
        if (i[0] == 'X') Schema[i].prototype.name = i;
        else if (typeof Schema[i] != "function") Schema[i].name = i.replace('Is','');
    }
    exports.Schema = Schema;
});