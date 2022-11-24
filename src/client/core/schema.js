define(function (require, exports, module) {
    'use strict';
    //Class for validating json objects
    //Using serializable objects
    var Utils = require('./utils').Utils;

    /** @constructor*/
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

    /** @constructor*/
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
    /** @constructor*/
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

    /** @constructor*/
    var XNot = function (schema, message) {
        this.schema = schema;
        this.message = message;
    };
    XNot.prototype.validate = function (value) {
        if (this.schema.validate(value)) return false;
        return this.message || 'Cannot be ' + value;
    };

    /** @constructor*/
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

    /** @constructor*/
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
    /** @constructor*/
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

    
    /** @constructor*/
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
    
    /** @constructor*/
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
    var modelist = require('ace!ext/modelist');
    var IsMode = new XValidIf(function (mode) {
        return modelist.modesByName[mode];
    }, 'a language mode');
    
    /** @constructor*/
    var XRegex = function (regex, name) {
        XRegex.super(this, [
            function (value) {
                return regex.test(value);
            },
            name,
        ]);
    };
    Utils.inherits(XRegex, XValidIf);

    var IsFilename = new XRegex(/[\w-~\(\)\/]+/);

    var api = {
        /**
         * Get schema from a value. Used when you fail to configure type of config.
         * @related {require('./config/namespaces')~inferSchema}
         * @returns {Schema}
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
                return new XArray(IsPlain);
            }
            return IsObject;
        },
        parse: function () {
            throw new Error(
                'Must require grace/ext/parse_schema to use this feature.'
            );
        },
        XObject: XObject,
        XArray: XArray,
        XOneOf: XOneOf,
        XOptional: XOptional,
        XValidIf: XValidIf,
        XRegex: XRegex,
        XNot: XNot,
        XList: XList,
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
    for (var i in api) {
        if (i[0] == 'X') api[i].prototype.name = i;
        else if (typeof api[i] != 'function')
            api[i].name =
                api[i].name || i.replace('Is', '').toLowerCase();
    }
    exports.Schema = api;
});