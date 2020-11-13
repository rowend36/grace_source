(function (global){
    var require = (function() {
        function r(e, n, t) {
            function o(i, f) { if (!n[i]) { if (!e[i]) { var c = "function" == typeof require && require; if (!f && c) return c(i, !0); if (u) return u(i, !0); var a = new Error("Cannot find module '" + i + "'"); throw a.code = "MODULE_NOT_FOUND", a } var p = n[i] = { exports: {} };
                    e[i][0].call(p.exports, function(r) { var n = e[i][1][r]; return o(n || r) }, p, p.exports, r, e, n, t) } return n[i].exports } for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]); return o } return r })()({
        1: [function(require, module, exports) {
            /*!
             * arr-diff <https://github.com/jonschlinkert/arr-diff>
             *
             * Copyright (c) 2014 Jon Schlinkert, contributors.
             * Licensed under the MIT License
             */

            'use strict';

            var flatten = require('arr-flatten');
            var slice = [].slice;

            /**
             * Return the difference between the first array and
             * additional arrays.
             *
             * ```js
             * var diff = require('{%= name %}');
             *
             * var a = ['a', 'b', 'c', 'd'];
             * var b = ['b', 'c'];
             *
             * console.log(diff(a, b))
             * //=> ['a', 'd']
             * ```
             *
             * @param  {Array} `a`
             * @param  {Array} `b`
             * @return {Array}
             * @api public
             */

            function diff(arr, arrays) {
                var argsLen = arguments.length;
                var len = arr.length,
                    i = -1;
                var res = [],
                    arrays;

                if (argsLen === 1) {
                    return arr;
                }

                if (argsLen > 2) {
                    arrays = flatten(slice.call(arguments, 1));
                }

                while (++i < len) {
                    if (!~arrays.indexOf(arr[i])) {
                        res.push(arr[i]);
                    }
                }
                return res;
            }

            /**
             * Expose `diff`
             */

            module.exports = diff;

        }, { "arr-flatten": 2 }],
        2: [function(require, module, exports) {
            /*!
             * arr-flatten <https://github.com/jonschlinkert/arr-flatten>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            module.exports = function(arr) {
                return flat(arr, []);
            };

            function flat(arr, res) {
                var i = 0,
                    cur;
                var len = arr.length;
                for (; i < len; i++) {
                    cur = arr[i];
                    Array.isArray(cur) ? flat(cur, res) : res.push(cur);
                }
                return res;
            }

        }, {}],
        3: [function(require, module, exports) {
            /*!
             * array-unique <https://github.com/jonschlinkert/array-unique>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            module.exports = function unique(arr) {
                if (!Array.isArray(arr)) {
                    throw new TypeError('array-unique expects an array.');
                }

                var len = arr.length;
                var i = -1;

                while (i++ < len) {
                    var j = i + 1;

                    for (; j < arr.length; ++j) {
                        if (arr[i] === arr[j]) {
                            arr.splice(j--, 1);
                        }
                    }
                }
                return arr;
            };

        }, {}],
        4: [function(require, module, exports) {
            /*!
             * braces <https://github.com/jonschlinkert/braces>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT license.
             */

            'use strict';

            /**
             * Module dependencies
             */

            var expand = require('expand-range');
            var repeat = require('repeat-element');
            var tokens = require('preserve');

            /**
             * Expose `braces`
             */

            module.exports = function(str, options) {
                if (typeof str !== 'string') {
                    throw new Error('braces expects a string');
                }
                return braces(str, options);
            };

            /**
             * Expand `{foo,bar}` or `{1..5}` braces in the
             * given `string`.
             *
             * @param  {String} `str`
             * @param  {Array} `arr`
             * @param  {Object} `options`
             * @return {Array}
             */

            function braces(str, arr, options) {
                if (str === '') {
                    return [];
                }

                if (!Array.isArray(arr)) {
                    options = arr;
                    arr = [];
                }

                var opts = options || {};
                arr = arr || [];

                if (typeof opts.nodupes === 'undefined') {
                    opts.nodupes = true;
                }

                var fn = opts.fn;
                var es6;

                if (typeof opts === 'function') {
                    fn = opts;
                    opts = {};
                }

                if (!(patternRe instanceof RegExp)) {
                    patternRe = patternRegex();
                }

                var matches = str.match(patternRe) || [];
                var m = matches[0];

                switch (m) {
                    case '\\,':
                        return escapeCommas(str, arr, opts);
                    case '\\.':
                        return escapeDots(str, arr, opts);
                    case '\/.':
                        return escapePaths(str, arr, opts);
                    case ' ':
                        return splitWhitespace(str);
                    case '{,}':
                        return exponential(str, opts, braces);
                    case '{}':
                        return emptyBraces(str, arr, opts);
                    case '\\{':
                    case '\\}':
                        return escapeBraces(str, arr, opts);
                    case '${':
                        if (!/\{[^{]+\{/.test(str)) {
                            return arr.concat(str);
                        }
                        else {
                            es6 = true;
                            str = tokens.before(str, es6Regex());
                        }
                }

                if (!(braceRe instanceof RegExp)) {
                    braceRe = braceRegex();
                }

                var match = braceRe.exec(str);
                if (match == null) {
                    return [str];
                }

                var outter = match[1];
                var inner = match[2];
                if (inner === '') { return [str]; }

                var segs, segsLength;

                if (inner.indexOf('..') !== -1) {
                    segs = expand(inner, opts, fn) || inner.split(',');
                    segsLength = segs.length;

                }
                else if (inner[0] === '"' || inner[0] === '\'') {
                    return arr.concat(str.split(/['"]/).join(''));

                }
                else {
                    segs = inner.split(',');
                    if (opts.makeRe) {
                        return braces(str.replace(outter, wrap(segs, '|')), opts);
                    }

                    segsLength = segs.length;
                    if (segsLength === 1 && opts.bash) {
                        segs[0] = wrap(segs[0], '\\');
                    }
                }

                var len = segs.length;
                var i = 0,
                    val;

                while (len--) {
                    var path = segs[i++];

                    if (/(\.[^.\/])/.test(path)) {
                        if (segsLength > 1) {
                            return segs;
                        }
                        else {
                            return [str];
                        }
                    }

                    val = splice(str, outter, path);

                    if (/\{[^{}]+?\}/.test(val)) {
                        arr = braces(val, arr, opts);
                    }
                    else if (val !== '') {
                        if (opts.nodupes && arr.indexOf(val) !== -1) { continue; }
                        arr.push(es6 ? tokens.after(val) : val);
                    }
                }

                if (opts.strict) { return filter(arr, filterEmpty); }
                return arr;
            }

            /**
             * Expand exponential ranges
             *
             *   `a{,}{,}` => ['a', 'a', 'a', 'a']
             */

            function exponential(str, options, fn) {
                if (typeof options === 'function') {
                    fn = options;
                    options = null;
                }

                var opts = options || {};
                var esc = '__ESC_EXP__';
                var exp = 0;
                var res;

                var parts = str.split('{,}');
                if (opts.nodupes) {
                    return fn(parts.join(''), opts);
                }

                exp = parts.length - 1;
                res = fn(parts.join(esc), opts);
                var len = res.length;
                var arr = [];
                var i = 0;

                while (len--) {
                    var ele = res[i++];
                    var idx = ele.indexOf(esc);

                    if (idx === -1) {
                        arr.push(ele);

                    }
                    else {
                        ele = ele.split('__ESC_EXP__').join('');
                        if (!!ele && opts.nodupes !== false) {
                            arr.push(ele);

                        }
                        else {
                            var num = Math.pow(2, exp);
                            arr.push.apply(arr, repeat(ele, num));
                        }
                    }
                }
                return arr;
            }

            /**
             * Wrap a value with parens, brackets or braces,
             * based on the given character/separator.
             *
             * @param  {String|Array} `val`
             * @param  {String} `ch`
             * @return {String}
             */

            function wrap(val, ch) {
                if (ch === '|') {
                    return '(' + val.join(ch) + ')';
                }
                if (ch === ',') {
                    return '{' + val.join(ch) + '}';
                }
                if (ch === '-') {
                    return '[' + val.join(ch) + ']';
                }
                if (ch === '\\') {
                    return '\\{' + val + '\\}';
                }
            }

            /**
             * Handle empty braces: `{}`
             */

            function emptyBraces(str, arr, opts) {
                return braces(str.split('{}').join('\\{\\}'), arr, opts);
            }

            /**
             * Filter out empty-ish values
             */

            function filterEmpty(ele) {
                return !!ele && ele !== '\\';
            }

            /**
             * Handle patterns with whitespace
             */

            function splitWhitespace(str) {
                var segs = str.split(' ');
                var len = segs.length;
                var res = [];
                var i = 0;

                while (len--) {
                    res.push.apply(res, braces(segs[i++]));
                }
                return res;
            }

            /**
             * Handle escaped braces: `\\{foo,bar}`
             */

            function escapeBraces(str, arr, opts) {
                if (!/\{[^{]+\{/.test(str)) {
                    return arr.concat(str.split('\\').join(''));
                }
                else {
                    str = str.split('\\{').join('__LT_BRACE__');
                    str = str.split('\\}').join('__RT_BRACE__');
                    return map(braces(str, arr, opts), function(ele) {
                        ele = ele.split('__LT_BRACE__').join('{');
                        return ele.split('__RT_BRACE__').join('}');
                    });
                }
            }

            /**
             * Handle escaped dots: `{1\\.2}`
             */

            function escapeDots(str, arr, opts) {
                if (!/[^\\]\..+\\\./.test(str)) {
                    return arr.concat(str.split('\\').join(''));
                }
                else {
                    str = str.split('\\.').join('__ESC_DOT__');
                    return map(braces(str, arr, opts), function(ele) {
                        return ele.split('__ESC_DOT__').join('.');
                    });
                }
            }

            /**
             * Handle escaped dots: `{1\\.2}`
             */

            function escapePaths(str, arr, opts) {
                str = str.split('\/.').join('__ESC_PATH__');
                return map(braces(str, arr, opts), function(ele) {
                    return ele.split('__ESC_PATH__').join('\/.');
                });
            }

            /**
             * Handle escaped commas: `{a\\,b}`
             */

            function escapeCommas(str, arr, opts) {
                if (!/\w,/.test(str)) {
                    return arr.concat(str.split('\\').join(''));
                }
                else {
                    str = str.split('\\,').join('__ESC_COMMA__');
                    return map(braces(str, arr, opts), function(ele) {
                        return ele.split('__ESC_COMMA__').join(',');
                    });
                }
            }

            /**
             * Regex for common patterns
             */

            function patternRegex() {
                return /\${|( (?=[{,}])|(?=[{,}]) )|{}|{,}|\\,(?=.*[{}])|\/\.(?=.*[{}])|\\\.(?={)|\\{|\\}/;
            }

            /**
             * Braces regex.
             */

            function braceRegex() {
                return /.*(\\?\{([^}]+)\})/;
            }

            /**
             * es6 delimiter regex.
             */

            function es6Regex() {
                return /\$\{([^}]+)\}/;
            }

            var braceRe;
            var patternRe;

            /**
             * Faster alternative to `String.replace()` when the
             * index of the token to be replaces can't be supplied
             */

            function splice(str, token, replacement) {
                var i = str.indexOf(token);
                return str.substr(0, i) + replacement +
                    str.substr(i + token.length);
            }

            /**
             * Fast array map
             */

            function map(arr, fn) {
                if (arr == null) {
                    return [];
                }

                var len = arr.length;
                var res = new Array(len);
                var i = -1;

                while (++i < len) {
                    res[i] = fn(arr[i], i, arr);
                }

                return res;
            }

            /**
             * Fast array filter
             */

            function filter(arr, cb) {
                if (arr == null) return [];
                if (typeof cb !== 'function') {
                    throw new TypeError('braces: filter expects a callback function.');
                }

                var len = arr.length;
                var res = arr.slice();
                var i = 0;

                while (len--) {
                    if (!cb(arr[len], i++)) {
                        res.splice(len, 1);
                    }
                }
                return res;
            }

        }, { "expand-range": 6, "preserve": 40, "repeat-element": 47 }],
        5: [function(require, module, exports) {
            /*!
             * expand-brackets <https://github.com/jonschlinkert/expand-brackets>
             *
             * Copyright (c) 2015 Jon Schlinkert.
             * Licensed under the MIT license.
             */

            'use strict';

            var isPosixBracket = require('is-posix-bracket');

            /**
             * POSIX character classes
             */

            var POSIX = {
                alnum: 'a-zA-Z0-9',
                alpha: 'a-zA-Z',
                blank: ' \\t',
                cntrl: '\\x00-\\x1F\\x7F',
                digit: '0-9',
                graph: '\\x21-\\x7E',
                lower: 'a-z',
                print: '\\x20-\\x7E',
                punct: '-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
                space: ' \\t\\r\\n\\v\\f',
                upper: 'A-Z',
                word: 'A-Za-z0-9_',
                xdigit: 'A-Fa-f0-9',
            };

            /**
             * Expose `brackets`
             */

            module.exports = brackets;

            function brackets(str) {
                if (!isPosixBracket(str)) {
                    return str;
                }

                var negated = false;
                if (str.indexOf('[^') !== -1) {
                    negated = true;
                    str = str.split('[^').join('[');
                }
                if (str.indexOf('[!') !== -1) {
                    negated = true;
                    str = str.split('[!').join('[');
                }

                var a = str.split('[');
                var b = str.split(']');
                var imbalanced = a.length !== b.length;

                var parts = str.split(/(?::\]\[:|\[?\[:|:\]\]?)/);
                var len = parts.length,
                    i = 0;
                var end = '',
                    beg = '';
                var res = [];

                // start at the end (innermost) first
                while (len--) {
                    var inner = parts[i++];
                    if (inner === '^[!' || inner === '[!') {
                        inner = '';
                        negated = true;
                    }

                    var prefix = negated ? '^' : '';
                    var ch = POSIX[inner];

                    if (ch) {
                        res.push('[' + prefix + ch + ']');
                    }
                    else if (inner) {
                        if (/^\[?\w-\w\]?$/.test(inner)) {
                            if (i === parts.length) {
                                res.push('[' + prefix + inner);
                            }
                            else if (i === 1) {
                                res.push(prefix + inner + ']');
                            }
                            else {
                                res.push(prefix + inner);
                            }
                        }
                        else {
                            if (i === 1) {
                                beg += inner;
                            }
                            else if (i === parts.length) {
                                end += inner;
                            }
                            else {
                                res.push('[' + prefix + inner + ']');
                            }
                        }
                    }
                }

                var result = res.join('|');
                var rlen = res.length || 1;
                if (rlen > 1) {
                    result = '(?:' + result + ')';
                    rlen = 1;
                }
                if (beg) {
                    rlen++;
                    if (beg.charAt(0) === '[') {
                        if (imbalanced) {
                            beg = '\\[' + beg.slice(1);
                        }
                        else {
                            beg += ']';
                        }
                    }
                    result = beg + result;
                }
                if (end) {
                    rlen++;
                    if (end.slice(-1) === ']') {
                        if (imbalanced) {
                            end = end.slice(0, end.length - 1) + '\\]';
                        }
                        else {
                            end = '[' + end;
                        }
                    }
                    result += end;
                }

                if (rlen > 1) {
                    result = result.split('][').join(']|[');
                    if (result.indexOf('|') !== -1 && !/\(\?/.test(result)) {
                        result = '(?:' + result + ')';
                    }
                }

                result = result.replace(/\[+=|=\]+/g, '\\b');
                return result;
            }

            brackets.makeRe = function(pattern) {
                try {
                    return new RegExp(brackets(pattern));
                }
                catch (err) {}
            };

            brackets.isMatch = function(str, pattern) {
                try {
                    return brackets.makeRe(pattern).test(str);
                }
                catch (err) {
                    return false;
                }
            };

            brackets.match = function(arr, pattern) {
                var len = arr.length,
                    i = 0;
                var res = arr.slice();

                var re = brackets.makeRe(pattern);
                while (i < len) {
                    var ele = arr[i++];
                    if (!re.test(ele)) {
                        continue;
                    }
                    res.splice(i, 1);
                }
                return res;
            };

        }, { "is-posix-bracket": 22 }],
        6: [function(require, module, exports) {
            /*!
             * expand-range <https://github.com/jonschlinkert/expand-range>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT license.
             */

            'use strict';

            var fill = require('fill-range');

            module.exports = function expandRange(str, options, fn) {
                if (typeof str !== 'string') {
                    throw new TypeError('expand-range expects a string.');
                }

                if (typeof options === 'function') {
                    fn = options;
                    options = {};
                }

                if (typeof options === 'boolean') {
                    options = {};
                    options.makeRe = true;
                }

                // create arguments to pass to fill-range
                var opts = options || {};
                var args = str.split('..');
                var len = args.length;
                if (len > 3) { return str; }

                // if only one argument, it can't expand so return it
                if (len === 1) { return args; }

                // if `true`, tell fill-range to regexify the string
                if (typeof fn === 'boolean' && fn === true) {
                    opts.makeRe = true;
                }

                args.push(opts);
                return fill.apply(null, args.concat(fn));
            };

        }, { "fill-range": 10 }],
        7: [function(require, module, exports) {
            /*!
             * extglob <https://github.com/jonschlinkert/extglob>
             *
             * Copyright (c) 2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            /**
             * Module dependencies
             */

            var isExtglob = require('is-extglob');
            var re, cache = {};

            /**
             * Expose `extglob`
             */

            module.exports = extglob;

            /**
             * Convert the given extglob `string` to a regex-compatible
             * string.
             *
             * ```js
             * var extglob = require('extglob');
             * extglob('!(a?(b))');
             * //=> '(?!a(?:b)?)[^/]*?'
             * ```
             *
             * @param {String} `str` The string to convert.
             * @param {Object} `options`
             *   @option {Boolean} [options] `esc` If `false` special characters will not be escaped. Defaults to `true`.
             *   @option {Boolean} [options] `regex` If `true` a regular expression is returned instead of a string.
             * @return {String}
             * @api public
             */


            function extglob(str, opts) {
                opts = opts || {};
                var o = {},
                    i = 0;

                // fix common character reversals
                // '*!(.js)' => '*.!(js)'
                str = str.replace(/!\(([^\w*()])/g, '$1!(');

                // support file extension negation
                str = str.replace(/([*\/])\.!\([*]\)/g, function(m, ch) {
                    if (ch === '/') {
                        return escape('\\/[^.]+');
                    }
                    return escape('[^.]+');
                });

                // create a unique key for caching by
                // combining the string and options
                var key = str +
                    String(!!opts.regex) +
                    String(!!opts.contains) +
                    String(!!opts.escape);

                if (cache.hasOwnProperty(key)) {
                    return cache[key];
                }

                if (!(re instanceof RegExp)) {
                    re = regex();
                }

                opts.negate = false;
                var m;

                while (m = re.exec(str)) {
                    var prefix = m[1];
                    var inner = m[3];
                    if (prefix === '!') {
                        opts.negate = true;
                    }

                    var id = '__EXTGLOB_' + (i++) + '__';
                    // use the prefix of the _last_ (outtermost) pattern
                    o[id] = wrap(inner, prefix, opts.escape);
                    str = str.split(m[0]).join(id);
                }

                var keys = Object.keys(o);
                var len = keys.length;

                // we have to loop again to allow us to convert
                // patterns in reverse order (starting with the
                // innermost/last pattern first)
                while (len--) {
                    var prop = keys[len];
                    str = str.split(prop).join(o[prop]);
                }

                var result = opts.regex ?
                    toRegex(str, opts.contains, opts.negate) :
                    str;

                result = result.split('.').join('\\.');

                // cache the result and return it
                return (cache[key] = result);
            }

            /**
             * Convert `string` to a regex string.
             *
             * @param  {String} `str`
             * @param  {String} `prefix` Character that determines how to wrap the string.
             * @param  {Boolean} `esc` If `false` special characters will not be escaped. Defaults to `true`.
             * @return {String}
             */

            function wrap(inner, prefix, esc) {
                if (esc) inner = escape(inner);

                switch (prefix) {
                    case '!':
                        return '(?!' + inner + ')[^/]' + (esc ? '%%%~' : '*?');
                    case '@':
                        return '(?:' + inner + ')';
                    case '+':
                        return '(?:' + inner + ')+';
                    case '*':
                        return '(?:' + inner + ')' + (esc ? '%%' : '*')
                    case '?':
                        return '(?:' + inner + '|)';
                    default:
                        return inner;
                }
            }

            function escape(str) {
                str = str.split('*').join('[^/]%%%~');
                str = str.split('.').join('\\.');
                return str;
            }

            /**
             * extglob regex.
             */

            function regex() {
                return /(\\?[@?!+*$]\\?)(\(([^()]*?)\))/;
            }

            /**
             * Negation regex
             */

            function negate(str) {
                return '(?!^' + str + ').*$';
            }

            /**
             * Create the regex to do the matching. If
             * the leading character in the `pattern` is `!`
             * a negation regex is returned.
             *
             * @param {String} `pattern`
             * @param {Boolean} `contains` Allow loose matching.
             * @param {Boolean} `isNegated` True if the pattern is a negation pattern.
             */

            function toRegex(pattern, contains, isNegated) {
                var prefix = contains ? '^' : '';
                var after = contains ? '$' : '';
                pattern = ('(?:' + pattern + ')' + after);
                if (isNegated) {
                    pattern = prefix + negate(pattern);
                }
                return new RegExp(prefix + pattern);
            }

        }, { "is-extglob": 8 }],
        8: [function(require, module, exports) {
            /*!
             * is-extglob <https://github.com/jonschlinkert/is-extglob>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            module.exports = function isExtglob(str) {
                return typeof str === 'string' &&
                    /[@?!+*]\(/.test(str);
            };

        }, {}],
        9: [function(require, module, exports) {
            /*!
             * filename-regex <https://github.com/regexps/filename-regex>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert
             * Licensed under the MIT license.
             */

            module.exports = function filenameRegex() {
                return /([^\\\/]+)$/;
            };

        }, {}],
        10: [function(require, module, exports) {
            /*!
             * fill-range <https://github.com/jonschlinkert/fill-range>
             *
             * Copyright (c) 2014-2018, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            var isObject = require('isobject');
            var isNumber = require('is-number');
            var randomize = require('randomatic');
            var repeatStr = require('repeat-string');
            var repeat = require('repeat-element');

            /**
             * Expose `fillRange`
             */

            module.exports = fillRange;

            /**
             * Return a range of numbers or letters.
             *
             * @param  {String} `a` Start of the range
             * @param  {String} `b` End of the range
             * @param  {String} `step` Increment or decrement to use.
             * @param  {Function} `fn` Custom function to modify each element in the range.
             * @return {Array}
             */

            function fillRange(a, b, step, options, fn) {
                if (a == null || b == null) {
                    throw new Error('fill-range expects the first and second args to be strings.');
                }

                if (typeof step === 'function') {
                    fn = step;
                    options = {};
                    step = null;
                }

                if (typeof options === 'function') {
                    fn = options;
                    options = {};
                }

                if (isObject(step)) {
                    options = step;
                    step = '';
                }

                var expand, regex = false,
                    sep = '';
                var opts = options || {};

                if (typeof opts.silent === 'undefined') {
                    opts.silent = true;
                }

                step = step || opts.step;

                // store a ref to unmodified arg
                var origA = a,
                    origB = b;

                b = (b.toString() === '-0') ? 0 : b;

                if (opts.optimize || opts.makeRe) {
                    step = step ? (step += '~') : step;
                    expand = true;
                    regex = true;
                    sep = '~';
                }

                // handle special step characters
                if (typeof step === 'string') {
                    var match = stepRe().exec(step);

                    if (match) {
                        var i = match.index;
                        var m = match[0];

                        // repeat string
                        if (m === '+') {
                            return repeat(a, b);

                            // randomize a, `b` times
                        }
                        else if (m === '?') {
                            return [randomize(a, b)];

                            // expand right, no regex reduction
                        }
                        else if (m === '>') {
                            step = step.substr(0, i) + step.substr(i + 1);
                            expand = true;

                            // expand to an array, or if valid create a reduced
                            // string for a regex logic `or`
                        }
                        else if (m === '|') {
                            step = step.substr(0, i) + step.substr(i + 1);
                            expand = true;
                            regex = true;
                            sep = m;

                            // expand to an array, or if valid create a reduced
                            // string for a regex range
                        }
                        else if (m === '~') {
                            step = step.substr(0, i) + step.substr(i + 1);
                            expand = true;
                            regex = true;
                            sep = m;
                        }
                    }
                    else if (!isNumber(step)) {
                        if (!opts.silent) {
                            throw new TypeError('fill-range: invalid step.');
                        }
                        return null;
                    }
                }

                if (/[.&*()[\]^%$#@!]/.test(a) || /[.&*()[\]^%$#@!]/.test(b)) {
                    if (!opts.silent) {
                        throw new RangeError('fill-range: invalid range arguments.');
                    }
                    return null;
                }

                // has neither a letter nor number, or has both letters and numbers
                // this needs to be after the step logic
                if (!noAlphaNum(a) || !noAlphaNum(b) || hasBoth(a) || hasBoth(b)) {
                    if (!opts.silent) {
                        throw new RangeError('fill-range: invalid range arguments.');
                    }
                    return null;
                }

                // validate arguments
                var isNumA = isNumber(zeros(a));
                var isNumB = isNumber(zeros(b));

                if ((!isNumA && isNumB) || (isNumA && !isNumB)) {
                    if (!opts.silent) {
                        throw new TypeError('fill-range: first range argument is incompatible with second.');
                    }
                    return null;
                }

                // by this point both are the same, so we
                // can use A to check going forward.
                var isNum = isNumA;
                var num = formatStep(step);

                // is the range alphabetical? or numeric?
                if (isNum) {
                    // if numeric, coerce to an integer
                    a = +a;
                    b = +b;
                }
                else {
                    // otherwise, get the charCode to expand alpha ranges
                    a = a.charCodeAt(0);
                    b = b.charCodeAt(0);
                }

                // is the pattern descending?
                var isDescending = a > b;

                // don't create a character class if the args are < 0
                if (a < 0 || b < 0) {
                    expand = false;
                    regex = false;
                }

                // detect padding
                var padding = isPadded(origA, origB);
                var res, pad, arr = [];
                var ii = 0;

                // character classes, ranges and logical `or`
                if (regex) {
                    if (shouldExpand(a, b, num, isNum, padding, opts)) {
                        // make sure the correct separator is used
                        if (sep === '|' || sep === '~') {
                            sep = detectSeparator(a, b, num, isNum, isDescending);
                        }
                        return wrap([origA, origB], sep, opts);
                    }
                }

                while (isDescending ? (a >= b) : (a <= b)) {
                    if (padding && isNum) {
                        pad = padding(a);
                    }

                    // custom function
                    if (typeof fn === 'function') {
                        res = fn(a, isNum, pad, ii++);

                        // letters
                    }
                    else if (!isNum) {
                        if (regex && isInvalidChar(a)) {
                            res = null;
                        }
                        else {
                            res = String.fromCharCode(a);
                        }

                        // numbers
                    }
                    else {
                        res = formatPadding(a, pad);
                    }

                    // add result to the array, filtering any nulled values
                    if (res !== null) arr.push(res);

                    // increment or decrement
                    if (isDescending) {
                        a -= num;
                    }
                    else {
                        a += num;
                    }
                }

                // now that the array is expanded, we need to handle regex
                // character classes, ranges or logical `or` that wasn't
                // already handled before the loop
                if ((regex || expand) && !opts.noexpand) {
                    // make sure the correct separator is used
                    if (sep === '|' || sep === '~') {
                        sep = detectSeparator(a, b, num, isNum, isDescending);
                    }
                    if (arr.length === 1 || a < 0 || b < 0) { return arr; }
                    return wrap(arr, sep, opts);
                }

                return arr;
            }

            /**
             * Wrap the string with the correct regex
             * syntax.
             */

            function wrap(arr, sep, opts) {
                if (sep === '~') { sep = '-'; }
                var str = arr.join(sep);
                var pre = opts && opts.regexPrefix;

                // regex logical `or`
                if (sep === '|') {
                    str = pre ? pre + str : str;
                    str = '(' + str + ')';
                }

                // regex character class
                if (sep === '-') {
                    str = (pre && pre === '^') ?
                        pre + str :
                        str;
                    str = '[' + str + ']';
                }
                return [str];
            }

            /**
             * Check for invalid characters
             */

            function isCharClass(a, b, step, isNum, isDescending) {
                if (isDescending) { return false; }
                if (isNum) { return a <= 9 && b <= 9; }
                if (a < b) { return step === 1; }
                return false;
            }

            /**
             * Detect the correct separator to use
             */

            function shouldExpand(a, b, num, isNum, padding, opts) {
                if (isNum && (a > 9 || b > 9)) { return false; }
                return !padding && num === 1 && a < b;
            }

            /**
             * Detect the correct separator to use
             */

            function detectSeparator(a, b, step, isNum, isDescending) {
                var isChar = isCharClass(a, b, step, isNum, isDescending);
                if (!isChar) {
                    return '|';
                }
                return '~';
            }

            /**
             * Correctly format the step based on type
             */

            function formatStep(step) {
                return Math.abs(step >> 0) || 1;
            }

            /**
             * Format padding, taking leading `-` into account
             */

            function formatPadding(ch, pad) {
                var res = pad ? pad + ch : ch;
                if (pad && ch.toString().charAt(0) === '-') {
                    res = '-' + pad + ch.toString().substr(1);
                }
                return res.toString();
            }

            /**
             * Check for invalid characters
             */

            function isInvalidChar(str) {
                var ch = toStr(str);
                return ch === '\\' ||
                    ch === '[' ||
                    ch === ']' ||
                    ch === '^' ||
                    ch === '(' ||
                    ch === ')' ||
                    ch === '`';
            }

            /**
             * Convert to a string from a charCode
             */

            function toStr(ch) {
                return String.fromCharCode(ch);
            }


            /**
             * Step regex
             */

            function stepRe() {
                return /\?|>|\||\+|\~/g;
            }

            /**
             * Return true if `val` has either a letter
             * or a number
             */

            function noAlphaNum(val) {
                return /[a-z0-9]/i.test(val);
            }

            /**
             * Return true if `val` has both a letter and
             * a number (invalid)
             */

            function hasBoth(val) {
                return /[a-z][0-9]|[0-9][a-z]/i.test(val);
            }

            /**
             * Normalize zeros for checks
             */

            function zeros(val) {
                if (/^-*0+$/.test(val.toString())) {
                    return '0';
                }
                return val;
            }

            /**
             * Return true if `val` has leading zeros,
             * or a similar valid pattern.
             */

            function hasZeros(val) {
                return /[^.]\.|^-*0+[0-9]/.test(val);
            }

            /**
             * If the string is padded, returns a curried function with
             * the a cached padding string, or `false` if no padding.
             *
             * @param  {*} `origA` String or number.
             * @return {String|Boolean}
             */

            function isPadded(origA, origB) {
                if (hasZeros(origA) || hasZeros(origB)) {
                    var alen = length(origA);
                    var blen = length(origB);

                    var len = alen >= blen ?
                        alen :
                        blen;

                    return function(a) {
                        return repeatStr('0', len - length(a));
                    };
                }
                return false;
            }

            /**
             * Get the string length of `val`
             */

            function length(val) {
                return val.toString().length;
            }

        }, { "is-number": 21, "isobject": 25, "randomatic": 42, "repeat-element": 47, "repeat-string": 48 }],
        11: [function(require, module, exports) {
            /*!
             * for-in <https://github.com/jonschlinkert/for-in>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            module.exports = function forIn(obj, fn, thisArg) {
                for (var key in obj) {
                    if (fn.call(thisArg, obj[key], key, obj) === false) {
                        break;
                    }
                }
            };

        }, {}],
        12: [function(require, module, exports) {
            /*!
             * for-own <https://github.com/jonschlinkert/for-own>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            var forIn = require('for-in');
            var hasOwn = Object.prototype.hasOwnProperty;

            module.exports = function forOwn(obj, fn, thisArg) {
                forIn(obj, function(val, key) {
                    if (hasOwn.call(obj, key)) {
                        return fn.call(thisArg, obj[key], key, obj);
                    }
                });
            };

        }, { "for-in": 11 }],
        13: [function(require, module, exports) {
            /*!
             * glob-base <https://github.com/jonschlinkert/glob-base>
             *
             * Copyright (c) 2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var path = require('path');
            var parent = require('glob-parent');
            var isGlob = require('is-glob');

            module.exports = function globBase(pattern) {
                if (typeof pattern !== 'string') {
                    throw new TypeError('glob-base expects a string.');
                }

                var res = {};
                res.base = parent(pattern);
                res.isGlob = isGlob(pattern);

                if (res.base !== '.') {
                    res.glob = pattern.substr(res.base.length);
                    if (res.glob.charAt(0) === '/') {
                        res.glob = res.glob.substr(1);
                    }
                }
                else {
                    res.glob = pattern;
                }

                if (!res.isGlob) {
                    res.base = dirname(pattern);
                    res.glob = res.base !== '.' ?
                        pattern.substr(res.base.length) :
                        pattern;
                }

                if (res.glob.substr(0, 2) === './') {
                    res.glob = res.glob.substr(2);
                }
                if (res.glob.charAt(0) === '/') {
                    res.glob = res.glob.substr(1);
                }
                return res;
            };

            function dirname(glob) {
                if (glob.slice(-1) === '/') return glob;
                return path.dirname(glob);
            }

        }, { "glob-parent": 14, "is-glob": 16, "path": 39 }],
        14: [function(require, module, exports) {
            'use strict';

            var path = require('path');
            var isglob = require('is-glob');

            module.exports = function globParent(str) {
                str += 'a'; // preserves full path in case of trailing path separator
                do { str = path.dirname(str) } while (isglob(str));
                return str;
            };

        }, { "is-glob": 16, "path": 39 }],
        15: [function(require, module, exports) {
            arguments[4][8][0].apply(exports, arguments)
        }, { "dup": 8 }],
        16: [function(require, module, exports) {
            /*!
             * is-glob <https://github.com/jonschlinkert/is-glob>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            var isExtglob = require('is-extglob');

            module.exports = function isGlob(str) {
                return typeof str === 'string' &&
                    (/[*!?{}(|)[\]]/.test(str) ||
                        isExtglob(str));
            };
        }, { "is-extglob": 15 }],
        17: [function(require, module, exports) {
            /*!
             * Determine if an object is a Buffer
             *
             * @author   Feross Aboukhadijeh <https://feross.org>
             * @license  MIT
             */

            // The _isBuffer check is for Safari 5-7 support, because it's missing
            // Object.prototype.constructor. Remove this eventually
            module.exports = function(obj) {
                return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
            }

            function isBuffer(obj) {
                return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
            }

            // For Node v0.10 support. Remove this eventually.
            function isSlowBuffer(obj) {
                return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
            }

        }, {}],
        18: [function(require, module, exports) {
            /*!
             * is-dotfile <https://github.com/jonschlinkert/is-dotfile>
             *
             * Copyright (c) 2015-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            module.exports = function(str) {
                if (str.charCodeAt(0) === 46 /* . */ && str.indexOf('/', 1) === -1) {
                    return true;
                }
                var slash = str.lastIndexOf('/');
                return slash !== -1 ? str.charCodeAt(slash + 1) === 46 /* . */ : false;
            };

        }, {}],
        19: [function(require, module, exports) {
            /*!
             * is-equal-shallow <https://github.com/jonschlinkert/is-equal-shallow>
             *
             * Copyright (c) 2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var isPrimitive = require('is-primitive');

            module.exports = function isEqual(a, b) {
                if (!a && !b) { return true; }
                if (!a && b || a && !b) { return false; }

                var numKeysA = 0,
                    numKeysB = 0,
                    key;
                for (key in b) {
                    numKeysB++;
                    if (!isPrimitive(b[key]) || !a.hasOwnProperty(key) || (a[key] !== b[key])) {
                        return false;
                    }
                }
                for (key in a) {
                    numKeysA++;
                }
                return numKeysA === numKeysB;
            };

        }, { "is-primitive": 23 }],
        20: [function(require, module, exports) {
            /*!
             * is-extendable <https://github.com/jonschlinkert/is-extendable>
             *
             * Copyright (c) 2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            module.exports = function isExtendable(val) {
                return typeof val !== 'undefined' && val !== null &&
                    (typeof val === 'object' || typeof val === 'function');
            };

        }, {}],
        21: [function(require, module, exports) {
            /*!
             * is-number <https://github.com/jonschlinkert/is-number>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var typeOf = require('kind-of');

            module.exports = function isNumber(num) {
                var type = typeOf(num);
                if (type !== 'number' && type !== 'string') {
                    return false;
                }
                var n = +num;
                return (n - n + 1) >= 0 && num !== '';
            };

        }, { "kind-of": 26 }],
        22: [function(require, module, exports) {
            /*!
             * is-posix-bracket <https://github.com/jonschlinkert/is-posix-bracket>
             *
             * Copyright (c) 2015-2016, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            module.exports = function isPosixBracket(str) {
                return typeof str === 'string' && /\[([:.=+])(?:[^\[\]]|)+\1\]/.test(str);
            };

        }, {}],
        23: [function(require, module, exports) {
            /*!
             * is-primitive <https://github.com/jonschlinkert/is-primitive>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            // see http://jsperf.com/testing-value-is-primitive/7
            module.exports = function isPrimitive(value) {
                return value == null || (typeof value !== 'function' && typeof value !== 'object');
            };

        }, {}],
        24: [function(require, module, exports) {
            var toString = {}.toString;

            module.exports = Array.isArray || function(arr) {
                return toString.call(arr) == '[object Array]';
            };

        }, {}],
        25: [function(require, module, exports) {
            /*!
             * isobject <https://github.com/jonschlinkert/isobject>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var isArray = require('isarray');

            module.exports = function isObject(val) {
                return val != null && typeof val === 'object' && isArray(val) === false;
            };

        }, { "isarray": 24 }],
        26: [function(require, module, exports) {
            var isBuffer = require('is-buffer');
            var toString = Object.prototype.toString;

            /**
             * Get the native `typeof` a value.
             *
             * @param  {*} `val`
             * @return {*} Native javascript type
             */

            module.exports = function kindOf(val) {
                // primitivies
                if (typeof val === 'undefined') {
                    return 'undefined';
                }
                if (val === null) {
                    return 'null';
                }
                if (val === true || val === false || val instanceof Boolean) {
                    return 'boolean';
                }
                if (typeof val === 'string' || val instanceof String) {
                    return 'string';
                }
                if (typeof val === 'number' || val instanceof Number) {
                    return 'number';
                }

                // functions
                if (typeof val === 'function' || val instanceof Function) {
                    return 'function';
                }

                // array
                if (typeof Array.isArray !== 'undefined' && Array.isArray(val)) {
                    return 'array';
                }

                // check for instances of RegExp and Date before calling `toString`
                if (val instanceof RegExp) {
                    return 'regexp';
                }
                if (val instanceof Date) {
                    return 'date';
                }

                // other objects
                var type = toString.call(val);

                if (type === '[object RegExp]') {
                    return 'regexp';
                }
                if (type === '[object Date]') {
                    return 'date';
                }
                if (type === '[object Arguments]') {
                    return 'arguments';
                }
                if (type === '[object Error]') {
                    return 'error';
                }

                // buffer
                if (isBuffer(val)) {
                    return 'buffer';
                }

                // es6: Map, WeakMap, Set, WeakSet
                if (type === '[object Set]') {
                    return 'set';
                }
                if (type === '[object WeakSet]') {
                    return 'weakset';
                }
                if (type === '[object Map]') {
                    return 'map';
                }
                if (type === '[object WeakMap]') {
                    return 'weakmap';
                }
                if (type === '[object Symbol]') {
                    return 'symbol';
                }

                // typed arrays
                if (type === '[object Int8Array]') {
                    return 'int8array';
                }
                if (type === '[object Uint8Array]') {
                    return 'uint8array';
                }
                if (type === '[object Uint8ClampedArray]') {
                    return 'uint8clampedarray';
                }
                if (type === '[object Int16Array]') {
                    return 'int16array';
                }
                if (type === '[object Uint16Array]') {
                    return 'uint16array';
                }
                if (type === '[object Int32Array]') {
                    return 'int32array';
                }
                if (type === '[object Uint32Array]') {
                    return 'uint32array';
                }
                if (type === '[object Float32Array]') {
                    return 'float32array';
                }
                if (type === '[object Float64Array]') {
                    return 'float64array';
                }

                // must be a plain object
                return 'object';
            };

        }, { "is-buffer": 17 }],
        27: [function(require, module, exports) {
            module.exports = (function(global) {
                var uint32 = 'Uint32Array' in global
                var crypto = global.crypto || global.msCrypto
                var rando = crypto && typeof crypto.getRandomValues === 'function'
                var good = uint32 && rando
                if (!good) return Math.random

                var arr = new Uint32Array(1)
                var max = Math.pow(2, 32)

                function random() {
                    crypto.getRandomValues(arr)
                    return arr[0] / max
                }

                random.cryptographic = true
                return random
            })(typeof self !== 'undefined' ? self : window)

        }, {}],
        28: [function(require, module, exports) {
            'use strict';

            var chars = {},
                unesc, temp;

            function reverse(object, prepender) {
                return Object.keys(object).reduce(function(reversed, key) {
                    var newKey = prepender ? prepender + key : key; // Optionally prepend a string to key.
                    reversed[object[key]] = newKey; // Swap key and value.
                    return reversed; // Return the result.
                }, {});
            }

            /**
             * Regex for common characters
             */

            chars.escapeRegex = {
                '?': /\?/g,
                '@': /\@/g,
                '!': /\!/g,
                '+': /\+/g,
                '*': /\*/g,
                '(': /\(/g,
                ')': /\)/g,
                '[': /\[/g,
                ']': /\]/g
            };

            /**
             * Escape characters
             */

            chars.ESC = {
                '?': '__UNESC_QMRK__',
                '@': '__UNESC_AMPE__',
                '!': '__UNESC_EXCL__',
                '+': '__UNESC_PLUS__',
                '*': '__UNESC_STAR__',
                ',': '__UNESC_COMMA__',
                '(': '__UNESC_LTPAREN__',
                ')': '__UNESC_RTPAREN__',
                '[': '__UNESC_LTBRACK__',
                ']': '__UNESC_RTBRACK__'
            };

            /**
             * Unescape characters
             */

            chars.UNESC = unesc || (unesc = reverse(chars.ESC, '\\'));

            chars.ESC_TEMP = {
                '?': '__TEMP_QMRK__',
                '@': '__TEMP_AMPE__',
                '!': '__TEMP_EXCL__',
                '*': '__TEMP_STAR__',
                '+': '__TEMP_PLUS__',
                ',': '__TEMP_COMMA__',
                '(': '__TEMP_LTPAREN__',
                ')': '__TEMP_RTPAREN__',
                '[': '__TEMP_LTBRACK__',
                ']': '__TEMP_RTBRACK__'
            };

            chars.TEMP = temp || (temp = reverse(chars.ESC_TEMP));

            module.exports = chars;

        }, {}],
        29: [function(require, module, exports) {
            /*!
             * micromatch <https://github.com/jonschlinkert/micromatch>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var utils = require('./utils');
            var Glob = require('./glob');

            /**
             * Expose `expand`
             */

            module.exports = expand;

            /**
             * Expand a glob pattern to resolve braces and
             * similar patterns before converting to regex.
             *
             * @param  {String|Array} `pattern`
             * @param  {Array} `files`
             * @param  {Options} `opts`
             * @return {Array}
             */

            function expand(pattern, options) {
                if (typeof pattern !== 'string') {
                    throw new TypeError('micromatch.expand(): argument should be a string.');
                }

                var glob = new Glob(pattern, options || {});
                var opts = glob.options;

                if (!utils.isGlob(pattern)) {
                    glob.pattern = glob.pattern.replace(/([\/.])/g, '\\$1');
                    return glob;
                }

                glob.pattern = glob.pattern.replace(/(\+)(?!\()/g, '\\$1');
                glob.pattern = glob.pattern.split('$').join('\\$');

                if (typeof opts.braces !== 'boolean' && typeof opts.nobraces !== 'boolean') {
                    opts.braces = true;
                }

                if (glob.pattern === '.*') {
                    return {
                        pattern: '\\.' + star,
                        tokens: tok,
                        options: opts
                    };
                }

                if (glob.pattern === '*') {
                    return {
                        pattern: oneStar(opts.dot),
                        tokens: tok,
                        options: opts
                    };
                }

                // parse the glob pattern into tokens
                glob.parse();
                var tok = glob.tokens;
                tok.is.negated = opts.negated;

                // dotfile handling
                if ((opts.dotfiles === true || tok.is.dotfile) && opts.dot !== false) {
                    opts.dotfiles = true;
                    opts.dot = true;
                }

                if ((opts.dotdirs === true || tok.is.dotdir) && opts.dot !== false) {
                    opts.dotdirs = true;
                    opts.dot = true;
                }

                // check for braces with a dotfile pattern
                if (/[{,]\./.test(glob.pattern)) {
                    opts.makeRe = false;
                    opts.dot = true;
                }

                if (opts.nonegate !== true) {
                    opts.negated = glob.negated;
                }

                // if the leading character is a dot or a slash, escape it
                if (glob.pattern.charAt(0) === '.' && glob.pattern.charAt(1) !== '/') {
                    glob.pattern = '\\' + glob.pattern;
                }

                /**
                 * Extended globs
                 */

                // expand braces, e.g `{1..5}`
                glob.track('before braces');
                if (tok.is.braces) {
                    glob.braces();
                }
                glob.track('after braces');

                // expand extglobs, e.g `foo/!(a|b)`
                glob.track('before extglob');
                if (tok.is.extglob) {
                    glob.extglob();
                }
                glob.track('after extglob');

                // expand brackets, e.g `[[:alpha:]]`
                glob.track('before brackets');
                if (tok.is.brackets) {
                    glob.brackets();
                }
                glob.track('after brackets');

                // special patterns
                glob._replace('[!', '[^');
                glob._replace('(?', '(%~');
                glob._replace(/\[\]/, '\\[\\]');
                glob._replace('/[', '/' + (opts.dot ? dotfiles : nodot) + '[', true);
                glob._replace('/?', '/' + (opts.dot ? dotfiles : nodot) + '[^/]', true);
                glob._replace('/.', '/(?=.)\\.', true);

                // windows drives
                glob._replace(/^(\w):([\\\/]+?)/gi, '(?=.)$1:$2', true);

                // negate slashes in exclusion ranges
                if (glob.pattern.indexOf('[^') !== -1) {
                    glob.pattern = negateSlash(glob.pattern);
                }

                if (opts.globstar !== false && glob.pattern === '**') {
                    glob.pattern = globstar(opts.dot);

                }
                else {
                    glob.pattern = balance(glob.pattern, '[', ']');
                    glob.escape(glob.pattern);

                    // if the pattern has `**`
                    if (tok.is.globstar) {
                        glob.pattern = collapse(glob.pattern, '/**');
                        glob.pattern = collapse(glob.pattern, '**/');
                        glob._replace('/**/', '(?:/' + globstar(opts.dot) + '/|/)', true);
                        glob._replace(/\*{2,}/g, '**');

                        // 'foo/*'
                        glob._replace(/(\w+)\*(?!\/)/g, '$1[^/]*?', true);
                        glob._replace(/\*\*\/\*(\w)/g, globstar(opts.dot) + '\\/' + (opts.dot ? dotfiles : nodot) + '[^/]*?$1', true);

                        if (opts.dot !== true) {
                            glob._replace(/\*\*\/(.)/g, '(?:**\\/|)$1');
                        }

                        // 'foo/**' or '{**,*}', but not 'foo**'
                        if (tok.path.dirname !== '' || /,\*\*|\*\*,/.test(glob.orig)) {
                            glob._replace('**', globstar(opts.dot), true);
                        }
                    }

                    // ends with /*
                    glob._replace(/\/\*$/, '\\/' + oneStar(opts.dot), true);
                    // ends with *, no slashes
                    glob._replace(/(?!\/)\*$/, star, true);
                    // has 'n*.' (partial wildcard w/ file extension)
                    glob._replace(/([^\/]+)\*/, '$1' + oneStar(true), true);
                    // has '*'
                    glob._replace('*', oneStar(opts.dot), true);
                    glob._replace('?.', '?\\.', true);
                    glob._replace('?:', '?:', true);

                    glob._replace(/\?+/g, function(match) {
                        var len = match.length;
                        if (len === 1) {
                            return qmark;
                        }
                        return qmark + '{' + len + '}';
                    });

                    // escape '.abc' => '\\.abc'
                    glob._replace(/\.([*\w]+)/g, '\\.$1');
                    // fix '[^\\\\/]'
                    glob._replace(/\[\^[\\\/]+\]/g, qmark);
                    // '///' => '\/'
                    glob._replace(/\/+/g, '\\/');
                    // '\\\\\\' => '\\'
                    glob._replace(/\\{2,}/g, '\\');
                }

                // unescape previously escaped patterns
                glob.unescape(glob.pattern);
                glob._replace('__UNESC_STAR__', '*');

                // escape dots that follow qmarks
                glob._replace('?.', '?\\.');

                // remove unnecessary slashes in character classes
                glob._replace('[^\\/]', qmark);

                if (glob.pattern.length > 1) {
                    if (/^[\[?*]/.test(glob.pattern)) {
                        // only prepend the string if we don't want to match dotfiles
                        glob.pattern = (opts.dot ? dotfiles : nodot) + glob.pattern;
                    }
                }

                return glob;
            }

            /**
             * Collapse repeated character sequences.
             *
             * ```js
             * collapse('a/../../../b', '../');
             * //=> 'a/../b'
             * ```
             *
             * @param  {String} `str`
             * @param  {String} `ch` Character sequence to collapse
             * @return {String}
             */

            function collapse(str, ch) {
                var res = str.split(ch);
                var isFirst = res[0] === '';
                var isLast = res[res.length - 1] === '';
                res = res.filter(Boolean);
                if (isFirst) res.unshift('');
                if (isLast) res.push('');
                return res.join(ch);
            }

            /**
             * Negate slashes in exclusion ranges, per glob spec:
             *
             * ```js
             * negateSlash('[^foo]');
             * //=> '[^\\/foo]'
             * ```
             *
             * @param  {String} `str` glob pattern
             * @return {String}
             */

            function negateSlash(str) {
                return str.replace(/\[\^([^\]]*?)\]/g, function(match, inner) {
                    if (inner.indexOf('/') === -1) {
                        inner = '\\/' + inner;
                    }
                    return '[^' + inner + ']';
                });
            }

            /**
             * Escape imbalanced braces/bracket. This is a very
             * basic, naive implementation that only does enough
             * to serve the purpose.
             */

            function balance(str, a, b) {
                var aarr = str.split(a);
                var alen = aarr.join('').length;
                var blen = str.split(b).join('').length;

                if (alen !== blen) {
                    str = aarr.join('\\' + a);
                    return str.split(b).join('\\' + b);
                }
                return str;
            }

            /**
             * Special patterns to be converted to regex.
             * Heuristics are used to simplify patterns
             * and speed up processing.
             */

            /* eslint no-multi-spaces: 0 */
            var qmark = '[^/]';
            var star = qmark + '*?';
            var nodot = '(?!\\.)(?=.)';
            var dotfileGlob = '(?:\\/|^)\\.{1,2}($|\\/)';
            var dotfiles = '(?!' + dotfileGlob + ')(?=.)';
            var twoStarDot = '(?:(?!' + dotfileGlob + ').)*?';

            /**
             * Create a regex for `*`.
             *
             * If `dot` is true, or the pattern does not begin with
             * a leading star, then return the simpler regex.
             */

            function oneStar(dotfile) {
                return dotfile ? '(?!' + dotfileGlob + ')(?=.)' + star : (nodot + star);
            }

            function globstar(dotfile) {
                if (dotfile) { return twoStarDot; }
                return '(?:(?!(?:\\/|^)\\.).)*?';
            }

        }, { "./glob": 30, "./utils": 31 }],
        30: [function(require, module, exports) {
            'use strict';

            var chars = require('./chars');
            var utils = require('./utils');

            /**
             * Expose `Glob`
             */

            var Glob = module.exports = function Glob(pattern, options) {
                if (!(this instanceof Glob)) {
                    return new Glob(pattern, options);
                }
                this.options = options || {};
                this.pattern = pattern;
                this.history = [];
                this.tokens = {};
                this.init(pattern);
            };

            /**
             * Initialize defaults
             */

            Glob.prototype.init = function(pattern) {
                this.orig = pattern;
                this.negated = this.isNegated();
                this.options.track = this.options.track || false;
                this.options.makeRe = true;
            };

            /**
             * Push a change into `glob.history`. Useful
             * for debugging.
             */

            Glob.prototype.track = function(msg) {
                if (this.options.track) {
                    this.history.push({ msg: msg, pattern: this.pattern });
                }
            };

            /**
             * Return true if `glob.pattern` was negated
             * with `!`, also remove the `!` from the pattern.
             *
             * @return {Boolean}
             */

            Glob.prototype.isNegated = function() {
                if (this.pattern.charCodeAt(0) === 33 /* '!' */ ) {
                    this.pattern = this.pattern.slice(1);
                    return true;
                }
                return false;
            };

            /**
             * Expand braces in the given glob pattern.
             *
             * We only need to use the [braces] lib when
             * patterns are nested.
             */

            Glob.prototype.braces = function() {
                if (this.options.nobraces !== true && this.options.nobrace !== true) {
                    // naive/fast check for imbalanced characters
                    var a = this.pattern.match(/[\{\(\[]/g);
                    var b = this.pattern.match(/[\}\)\]]/g);

                    // if imbalanced, don't optimize the pattern
                    if (a && b && (a.length !== b.length)) {
                        this.options.makeRe = false;
                    }

                    // expand brace patterns and join the resulting array
                    var expanded = utils.braces(this.pattern, this.options);
                    this.pattern = expanded.join('|');
                }
            };

            /**
             * Expand bracket expressions in `glob.pattern`
             */

            Glob.prototype.brackets = function() {
                if (this.options.nobrackets !== true) {
                    this.pattern = utils.brackets(this.pattern);
                }
            };

            /**
             * Expand bracket expressions in `glob.pattern`
             */

            Glob.prototype.extglob = function() {
                if (this.options.noextglob === true) return;

                if (utils.isExtglob(this.pattern)) {
                    this.pattern = utils.extglob(this.pattern, { escape: true });
                }
            };

            /**
             * Parse the given pattern
             */

            Glob.prototype.parse = function(pattern) {
                this.tokens = utils.parseGlob(pattern || this.pattern, true);
                return this.tokens;
            };

            /**
             * Replace `a` with `b`. Also tracks the change before and
             * after each replacement. This is disabled by default, but
             * can be enabled by setting `options.track` to true.
             *
             * Also, when the pattern is a string, `.split()` is used,
             * because it's much faster than replace.
             *
             * @param  {RegExp|String} `a`
             * @param  {String} `b`
             * @param  {Boolean} `escape` When `true`, escapes `*` and `?` in the replacement.
             * @return {String}
             */

            Glob.prototype._replace = function(a, b, escape) {
                this.track('before (find): "' + a + '" (replace with): "' + b + '"');
                if (escape) b = esc(b);
                if (a && b && typeof a === 'string') {
                    this.pattern = this.pattern.split(a).join(b);
                }
                else {
                    this.pattern = this.pattern.replace(a, b);
                }
                this.track('after');
            };

            /**
             * Escape special characters in the given string.
             *
             * @param  {String} `str` Glob pattern
             * @return {String}
             */

            Glob.prototype.escape = function(str) {
                this.track('before escape: ');
                var re = /["\\](['"]?[^"'\\]['"]?)/g;

                this.pattern = str.replace(re, function($0, $1) {
                    var o = chars.ESC;
                    var ch = o && o[$1];
                    if (ch) {
                        return ch;
                    }
                    if (/[a-z]/i.test($0)) {
                        return $0.split('\\').join('');
                    }
                    return $0;
                });

                this.track('after escape: ');
            };

            /**
             * Unescape special characters in the given string.
             *
             * @param  {String} `str`
             * @return {String}
             */

            Glob.prototype.unescape = function(str) {
                var re = /__([A-Z]+)_([A-Z]+)__/g;
                this.pattern = str.replace(re, function($0, $1) {
                    return chars[$1][$0];
                });
                this.pattern = unesc(this.pattern);
            };

            /**
             * Escape/unescape utils
             */

            function esc(str) {
                str = str.split('?').join('%~');
                str = str.split('*').join('%%');
                return str;
            }

            function unesc(str) {
                str = str.split('%~').join('?');
                str = str.split('%%').join('*');
                return str;
            }

        }, { "./chars": 28, "./utils": 31 }],
        31: [function(require, module, exports) {
            (function(process) {
                'use strict';

                var win32 = process && process.platform === 'win32';
                var path = require('path');
                var fileRe = require('filename-regex');
                var utils = module.exports;

                /**
                 * Module dependencies
                 */

                utils.diff = require('arr-diff');
                utils.unique = require('array-unique');
                utils.braces = require('braces');
                utils.brackets = require('expand-brackets');
                utils.extglob = require('extglob');
                utils.isExtglob = require('is-extglob');
                utils.isGlob = require('is-glob');
                utils.typeOf = require('kind-of');
                utils.normalize = require('normalize-path');
                utils.omit = require('object.omit');
                utils.parseGlob = require('parse-glob');
                utils.cache = require('regex-cache');

                /**
                 * Get the filename of a filepath
                 *
                 * @param {String} `string`
                 * @return {String}
                 */

                utils.filename = function filename(fp) {
                    var seg = fp.match(fileRe());
                    return seg && seg[0];
                };

                /**
                 * Returns a function that returns true if the given
                 * pattern is the same as a given `filepath`
                 *
                 * @param {String} `pattern`
                 * @return {Function}
                 */

                utils.isPath = function isPath(pattern, opts) {
                    opts = opts || {};
                    return function(fp) {
                        var unixified = utils.unixify(fp, opts);
                        if (opts.nocase) {
                            return pattern.toLowerCase() === unixified.toLowerCase();
                        }
                        return pattern === unixified;
                    };
                };

                /**
                 * Returns a function that returns true if the given
                 * pattern contains a `filepath`
                 *
                 * @param {String} `pattern`
                 * @return {Function}
                 */

                utils.hasPath = function hasPath(pattern, opts) {
                    return function(fp) {
                        return utils.unixify(pattern, opts).indexOf(fp) !== -1;
                    };
                };

                /**
                 * Returns a function that returns true if the given
                 * pattern matches or contains a `filepath`
                 *
                 * @param {String} `pattern`
                 * @return {Function}
                 */

                utils.matchPath = function matchPath(pattern, opts) {
                    var fn = (opts && opts.contains) ?
                        utils.hasPath(pattern, opts) :
                        utils.isPath(pattern, opts);
                    return fn;
                };

                /**
                 * Returns a function that returns true if the given
                 * regex matches the `filename` of a file path.
                 *
                 * @param {RegExp} `re`
                 * @return {Boolean}
                 */

                utils.hasFilename = function hasFilename(re) {
                    return function(fp) {
                        var name = utils.filename(fp);
                        return name && re.test(name);
                    };
                };

                /**
                 * Coerce `val` to an array
                 *
                 * @param  {*} val
                 * @return {Array}
                 */

                utils.arrayify = function arrayify(val) {
                    return !Array.isArray(val) ?
                        [val] :
                        val;
                };

                /**
                 * Normalize all slashes in a file path or glob pattern to
                 * forward slashes.
                 */

                utils.unixify = function unixify(fp, opts) {
                    if (opts && opts.unixify === false) return fp;
                    if (opts && opts.unixify === true || win32 || path.sep === '\\') {
                        return utils.normalize(fp, false);
                    }
                    if (opts && opts.unescape === true) {
                        return fp ? fp.toString().replace(/\\(\w)/g, '$1') : '';
                    }
                    return fp;
                };

                /**
                 * Escape/unescape utils
                 */

                utils.escapePath = function escapePath(fp) {
                    return fp.replace(/[\\.]/g, '\\$&');
                };

                utils.unescapeGlob = function unescapeGlob(fp) {
                    return fp.replace(/[\\"']/g, '');
                };

                utils.escapeRe = function escapeRe(str) {
                    return str.replace(/[-[\\$*+?.#^\s{}(|)\]]/g, '\\$&');
                };

                /**
                 * Expose `utils`
                 */

                module.exports = utils;

            }).call(this, require('_process'))
        }, { "_process": 41, "arr-diff": 1, "array-unique": 3, "braces": 4, "expand-brackets": 5, "extglob": 7, "filename-regex": 9, "is-extglob": 32, "is-glob": 33, "kind-of": 26, "normalize-path": 34, "object.omit": 35, "parse-glob": 36, "path": 39, "regex-cache": 45 }],
        32: [function(require, module, exports) {
            arguments[4][8][0].apply(exports, arguments)
        }, { "dup": 8 }],
        33: [function(require, module, exports) {
            arguments[4][16][0].apply(exports, arguments)
        }, { "dup": 16, "is-extglob": 32 }],
        34: [function(require, module, exports) {
            /*!
             * normalize-path <https://github.com/jonschlinkert/normalize-path>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            var removeTrailingSeparator = require('remove-trailing-separator');

            module.exports = function normalizePath(str, stripTrailing) {
                if (typeof str !== 'string') {
                    throw new TypeError('expected a string');
                }
                str = str.replace(/[\\\/]+/g, '/');
                if (stripTrailing !== false) {
                    str = removeTrailingSeparator(str);
                }
                return str;
            };

        }, { "remove-trailing-separator": 46 }],
        35: [function(require, module, exports) {
            /*!
             * object.omit <https://github.com/jonschlinkert/object.omit>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var isObject = require('is-extendable');
            var forOwn = require('for-own');

            module.exports = function omit(obj, keys) {
                if (!isObject(obj)) return {};

                keys = [].concat.apply([], [].slice.call(arguments, 1));
                var last = keys[keys.length - 1];
                var res = {},
                    fn;

                if (typeof last === 'function') {
                    fn = keys.pop();
                }

                var isFunction = typeof fn === 'function';
                if (!keys.length && !isFunction) {
                    return obj;
                }

                forOwn(obj, function(value, key) {
                    if (keys.indexOf(key) === -1) {

                        if (!isFunction) {
                            res[key] = value;
                        }
                        else if (fn(value, key, obj)) {
                            res[key] = value;
                        }
                    }
                });
                return res;
            };

        }, { "for-own": 12, "is-extendable": 20 }],
        36: [function(require, module, exports) {
            /*!
             * parse-glob <https://github.com/jonschlinkert/parse-glob>
             *
             * Copyright (c) 2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var isGlob = require('is-glob');
            var findBase = require('glob-base');
            var extglob = require('is-extglob');
            var dotfile = require('is-dotfile');

            /**
             * Expose `cache`
             */

            var cache = module.exports.cache = {};

            /**
             * Parse a glob pattern into tokens.
             *
             * When no paths or '**' are in the glob, we use a
             * different strategy for parsing the filename, since
             * file names can contain braces and other difficult
             * patterns. such as:
             *
             *  - `*.{a,b}`
             *  - `(**|*.js)`
             */

            module.exports = function parseGlob(glob) {
                if (cache.hasOwnProperty(glob)) {
                    return cache[glob];
                }

                var tok = {};
                tok.orig = glob;
                tok.is = {};

                // unescape dots and slashes in braces/brackets
                glob = escape(glob);

                var parsed = findBase(glob);
                tok.is.glob = parsed.isGlob;

                tok.glob = parsed.glob;
                tok.base = parsed.base;
                var segs = /([^\/]*)$/.exec(glob);

                tok.path = {};
                tok.path.dirname = '';
                tok.path.basename = segs[1] || '';
                tok.path.dirname = glob.split(tok.path.basename).join('') || '';
                var basename = (tok.path.basename || '').split('.') || '';
                tok.path.filename = basename[0] || '';
                tok.path.extname = basename.slice(1).join('.') || '';
                tok.path.ext = '';

                if (isGlob(tok.path.dirname) && !tok.path.basename) {
                    if (!/\/$/.test(tok.glob)) {
                        tok.path.basename = tok.glob;
                    }
                    tok.path.dirname = tok.base;
                }

                if (glob.indexOf('/') === -1 && !tok.is.globstar) {
                    tok.path.dirname = '';
                    tok.path.basename = tok.orig;
                }

                var dot = tok.path.basename.indexOf('.');
                if (dot !== -1) {
                    tok.path.filename = tok.path.basename.slice(0, dot);
                    tok.path.extname = tok.path.basename.slice(dot);
                }

                if (tok.path.extname.charAt(0) === '.') {
                    var exts = tok.path.extname.split('.');
                    tok.path.ext = exts[exts.length - 1];
                }

                // unescape dots and slashes in braces/brackets
                tok.glob = unescape(tok.glob);
                tok.path.dirname = unescape(tok.path.dirname);
                tok.path.basename = unescape(tok.path.basename);
                tok.path.filename = unescape(tok.path.filename);
                tok.path.extname = unescape(tok.path.extname);

                // Booleans
                var is = (glob && tok.is.glob);
                tok.is.negated = glob && glob.charAt(0) === '!';
                tok.is.extglob = glob && extglob(glob);
                tok.is.braces = has(is, glob, '{');
                tok.is.brackets = has(is, glob, '[:');
                tok.is.globstar = has(is, glob, '**');
                tok.is.dotfile = dotfile(tok.path.basename) || dotfile(tok.path.filename);
                tok.is.dotdir = dotdir(tok.path.dirname);
                return (cache[glob] = tok);
            }

            /**
             * Returns true if the glob matches dot-directories.
             *
             * @param  {Object} `tok` The tokens object
             * @param  {Object} `path` The path object
             * @return {Object}
             */

            function dotdir(base) {
                if (base.indexOf('/.') !== -1) {
                    return true;
                }
                if (base.charAt(0) === '.' && base.charAt(1) !== '/') {
                    return true;
                }
                return false;
            }

            /**
             * Returns true if the pattern has the given `ch`aracter(s)
             *
             * @param  {Object} `glob` The glob pattern.
             * @param  {Object} `ch` The character to test for
             * @return {Object}
             */

            function has(is, glob, ch) {
                return is && glob.indexOf(ch) !== -1;
            }

            /**
             * Escape/unescape utils
             */

            function escape(str) {
                var re = /\{([^{}]*?)}|\(([^()]*?)\)|\[([^\[\]]*?)\]/g;
                return str.replace(re, function(outter, braces, parens, brackets) {
                    var inner = braces || parens || brackets;
                    if (!inner) { return outter; }
                    return outter.split(inner).join(esc(inner));
                });
            }

            function esc(str) {
                str = str.split('/').join('__SLASH__');
                str = str.split('.').join('__DOT__');
                return str;
            }

            function unescape(str) {
                str = str.split('__SLASH__').join('/');
                str = str.split('__DOT__').join('.');
                return str;
            }

        }, { "glob-base": 13, "is-dotfile": 18, "is-extglob": 37, "is-glob": 38 }],
        37: [function(require, module, exports) {
            arguments[4][8][0].apply(exports, arguments)
        }, { "dup": 8 }],
        38: [function(require, module, exports) {
            arguments[4][16][0].apply(exports, arguments)
        }, { "dup": 16, "is-extglob": 37 }],
        39: [function(require, module, exports) {
            (function(process) {
                // .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
                // backported and transplited with Babel, with backwards-compat fixes

                // Copyright Joyent, Inc. and other Node contributors.
                //
                // Permission is hereby granted, free of charge, to any person obtaining a
                // copy of this software and associated documentation files (the
                // "Software"), to deal in the Software without restriction, including
                // without limitation the rights to use, copy, modify, merge, publish,
                // distribute, sublicense, and/or sell copies of the Software, and to permit
                // persons to whom the Software is furnished to do so, subject to the
                // following conditions:
                //
                // The above copyright notice and this permission notice shall be included
                // in all copies or substantial portions of the Software.
                //
                // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
                // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
                // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
                // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
                // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
                // USE OR OTHER DEALINGS IN THE SOFTWARE.

                // resolves . and .. elements in a path array with directory names there
                // must be no slashes, empty elements, or device names (c:\) in the array
                // (so also no leading and trailing slashes - it does not distinguish
                // relative and absolute paths)
                function normalizeArray(parts, allowAboveRoot) {
                    // if the path tries to go above the root, `up` ends up > 0
                    var up = 0;
                    for (var i = parts.length - 1; i >= 0; i--) {
                        var last = parts[i];
                        if (last === '.') {
                            parts.splice(i, 1);
                        }
                        else if (last === '..') {
                            parts.splice(i, 1);
                            up++;
                        }
                        else if (up) {
                            parts.splice(i, 1);
                            up--;
                        }
                    }

                    // if the path is allowed to go above the root, restore leading ..s
                    if (allowAboveRoot) {
                        for (; up--; up) {
                            parts.unshift('..');
                        }
                    }

                    return parts;
                }

                // path.resolve([from ...], to)
                // posix version
                exports.resolve = function() {
                    var resolvedPath = '',
                        resolvedAbsolute = false;

                    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                        var path = (i >= 0) ? arguments[i] : process.cwd();

                        // Skip empty and invalid entries
                        if (typeof path !== 'string') {
                            throw new TypeError('Arguments to path.resolve must be strings');
                        }
                        else if (!path) {
                            continue;
                        }

                        resolvedPath = path + '/' + resolvedPath;
                        resolvedAbsolute = path.charAt(0) === '/';
                    }

                    // At this point the path should be resolved to a full absolute path, but
                    // handle relative paths to be safe (might happen when process.cwd() fails)

                    // Normalize the path
                    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
                        return !!p;
                    }), !resolvedAbsolute).join('/');

                    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
                };

                // path.normalize(path)
                // posix version
                exports.normalize = function(path) {
                    var isAbsolute = exports.isAbsolute(path),
                        trailingSlash = substr(path, -1) === '/';

                    // Normalize the path
                    path = normalizeArray(filter(path.split('/'), function(p) {
                        return !!p;
                    }), !isAbsolute).join('/');

                    if (!path && !isAbsolute) {
                        path = '.';
                    }
                    if (path && trailingSlash) {
                        path += '/';
                    }

                    return (isAbsolute ? '/' : '') + path;
                };

                // posix version
                exports.isAbsolute = function(path) {
                    return path.charAt(0) === '/';
                };

                // posix version
                exports.join = function() {
                    var paths = Array.prototype.slice.call(arguments, 0);
                    return exports.normalize(filter(paths, function(p, index) {
                        if (typeof p !== 'string') {
                            throw new TypeError('Arguments to path.join must be strings');
                        }
                        return p;
                    }).join('/'));
                };


                // path.relative(from, to)
                // posix version
                exports.relative = function(from, to) {
                    from = exports.resolve(from).substr(1);
                    to = exports.resolve(to).substr(1);

                    function trim(arr) {
                        var start = 0;
                        for (; start < arr.length; start++) {
                            if (arr[start] !== '') break;
                        }

                        var end = arr.length - 1;
                        for (; end >= 0; end--) {
                            if (arr[end] !== '') break;
                        }

                        if (start > end) return [];
                        return arr.slice(start, end - start + 1);
                    }

                    var fromParts = trim(from.split('/'));
                    var toParts = trim(to.split('/'));

                    var length = Math.min(fromParts.length, toParts.length);
                    var samePartsLength = length;
                    for (var i = 0; i < length; i++) {
                        if (fromParts[i] !== toParts[i]) {
                            samePartsLength = i;
                            break;
                        }
                    }

                    var outputParts = [];
                    for (var i = samePartsLength; i < fromParts.length; i++) {
                        outputParts.push('..');
                    }

                    outputParts = outputParts.concat(toParts.slice(samePartsLength));

                    return outputParts.join('/');
                };

                exports.sep = '/';
                exports.delimiter = ':';

                exports.dirname = function(path) {
                    if (typeof path !== 'string') path = path + '';
                    if (path.length === 0) return '.';
                    var code = path.charCodeAt(0);
                    var hasRoot = code === 47 /*/*/ ;
                    var end = -1;
                    var matchedSlash = true;
                    for (var i = path.length - 1; i >= 1; --i) {
                        code = path.charCodeAt(i);
                        if (code === 47 /*/*/ ) {
                            if (!matchedSlash) {
                                end = i;
                                break;
                            }
                        }
                        else {
                            // We saw the first non-path separator
                            matchedSlash = false;
                        }
                    }

                    if (end === -1) return hasRoot ? '/' : '.';
                    if (hasRoot && end === 1) {
                        // return '//';
                        // Backwards-compat fix:
                        return '/';
                    }
                    return path.slice(0, end);
                };

                function basename(path) {
                    if (typeof path !== 'string') path = path + '';

                    var start = 0;
                    var end = -1;
                    var matchedSlash = true;
                    var i;

                    for (i = path.length - 1; i >= 0; --i) {
                        if (path.charCodeAt(i) === 47 /*/*/ ) {
                            // If we reached a path separator that was not part of a set of path
                            // separators at the end of the string, stop now
                            if (!matchedSlash) {
                                start = i + 1;
                                break;
                            }
                        }
                        else if (end === -1) {
                            // We saw the first non-path separator, mark this as the end of our
                            // path component
                            matchedSlash = false;
                            end = i + 1;
                        }
                    }

                    if (end === -1) return '';
                    return path.slice(start, end);
                }

                // Uses a mixed approach for backwards-compatibility, as ext behavior changed
                // in new Node.js versions, so only basename() above is backported here
                exports.basename = function(path, ext) {
                    var f = basename(path);
                    if (ext && f.substr(-1 * ext.length) === ext) {
                        f = f.substr(0, f.length - ext.length);
                    }
                    return f;
                };

                exports.extname = function(path) {
                    if (typeof path !== 'string') path = path + '';
                    var startDot = -1;
                    var startPart = 0;
                    var end = -1;
                    var matchedSlash = true;
                    // Track the state of characters (if any) we see before our first dot and
                    // after any path separator we find
                    var preDotState = 0;
                    for (var i = path.length - 1; i >= 0; --i) {
                        var code = path.charCodeAt(i);
                        if (code === 47 /*/*/ ) {
                            // If we reached a path separator that was not part of a set of path
                            // separators at the end of the string, stop now
                            if (!matchedSlash) {
                                startPart = i + 1;
                                break;
                            }
                            continue;
                        }
                        if (end === -1) {
                            // We saw the first non-path separator, mark this as the end of our
                            // extension
                            matchedSlash = false;
                            end = i + 1;
                        }
                        if (code === 46 /*.*/ ) {
                            // If this is our first dot, mark it as the start of our extension
                            if (startDot === -1)
                                startDot = i;
                            else if (preDotState !== 1)
                                preDotState = 1;
                        }
                        else if (startDot !== -1) {
                            // We saw a non-dot and non-path separator before our dot, so we should
                            // have a good chance at having a non-empty extension
                            preDotState = -1;
                        }
                    }

                    if (startDot === -1 || end === -1 ||
                        // We saw a non-dot character immediately before the dot
                        preDotState === 0 ||
                        // The (right-most) trimmed path component is exactly '..'
                        preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
                        return '';
                    }
                    return path.slice(startDot, end);
                };

                function filter(xs, f) {
                    if (xs.filter) return xs.filter(f);
                    var res = [];
                    for (var i = 0; i < xs.length; i++) {
                        if (f(xs[i], i, xs)) res.push(xs[i]);
                    }
                    return res;
                }

                // String.prototype.substr - negative index don't work in IE8
                var substr = 'ab'.substr(-1) === 'b' ?
                    function(str, start, len) { return str.substr(start, len) } :
                    function(str, start, len) {
                        if (start < 0) start = str.length + start;
                        return str.substr(start, len);
                    };

            }).call(this, require('_process'))
        }, { "_process": 41 }],
        40: [function(require, module, exports) {
            /*!
             * preserve <https://github.com/jonschlinkert/preserve>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT license.
             */

            'use strict';

            /**
             * Replace tokens in `str` with a temporary, heuristic placeholder.
             *
             * ```js
             * tokens.before('{a\\,b}');
             * //=> '{__ID1__}'
             * ```
             *
             * @param  {String} `str`
             * @return {String} String with placeholders.
             * @api public
             */

            exports.before = function before(str, re) {
                return str.replace(re, function(match) {
                    var id = randomize();
                    cache[id] = match;
                    return '__ID' + id + '__';
                });
            };

            /**
             * Replace placeholders in `str` with original tokens.
             *
             * ```js
             * tokens.after('{__ID1__}');
             * //=> '{a\\,b}'
             * ```
             *
             * @param  {String} `str` String with placeholders
             * @return {String} `str` String with original tokens.
             * @api public
             */

            exports.after = function after(str) {
                return str.replace(/__ID(.{5})__/g, function(_, id) {
                    return cache[id];
                });
            };

            function randomize() {
                return Math.random().toString().slice(2, 7);
            }

            var cache = {};
        }, {}],
        41: [function(require, module, exports) {
            // shim for using process in browser
            var process = module.exports = {};

            // cached from whatever global is present so that test runners that stub it
            // don't break things.  But we need to wrap it in a try catch in case it is
            // wrapped in strict mode code which doesn't define any globals.  It's inside a
            // function because try/catches deoptimize in certain engines.

            var cachedSetTimeout;
            var cachedClearTimeout;

            function defaultSetTimout() {
                throw new Error('setTimeout has not been defined');
            }

            function defaultClearTimeout() {
                throw new Error('clearTimeout has not been defined');
            }
            (function() {
                try {
                    if (typeof setTimeout === 'function') {
                        cachedSetTimeout = setTimeout;
                    }
                    else {
                        cachedSetTimeout = defaultSetTimout;
                    }
                }
                catch (e) {
                    cachedSetTimeout = defaultSetTimout;
                }
                try {
                    if (typeof clearTimeout === 'function') {
                        cachedClearTimeout = clearTimeout;
                    }
                    else {
                        cachedClearTimeout = defaultClearTimeout;
                    }
                }
                catch (e) {
                    cachedClearTimeout = defaultClearTimeout;
                }
            }())

            function runTimeout(fun) {
                if (cachedSetTimeout === setTimeout) {
                    //normal enviroments in sane situations
                    return setTimeout(fun, 0);
                }
                // if setTimeout wasn't available but was latter defined
                if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
                    cachedSetTimeout = setTimeout;
                    return setTimeout(fun, 0);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedSetTimeout(fun, 0);
                }
                catch (e) {
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                        return cachedSetTimeout.call(null, fun, 0);
                    }
                    catch (e) {
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                        return cachedSetTimeout.call(this, fun, 0);
                    }
                }


            }

            function runClearTimeout(marker) {
                if (cachedClearTimeout === clearTimeout) {
                    //normal enviroments in sane situations
                    return clearTimeout(marker);
                }
                // if clearTimeout wasn't available but was latter defined
                if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
                    cachedClearTimeout = clearTimeout;
                    return clearTimeout(marker);
                }
                try {
                    // when when somebody has screwed with setTimeout but no I.E. maddness
                    return cachedClearTimeout(marker);
                }
                catch (e) {
                    try {
                        // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                        return cachedClearTimeout.call(null, marker);
                    }
                    catch (e) {
                        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                        // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                        return cachedClearTimeout.call(this, marker);
                    }
                }


            }
            var queue = [];
            var draining = false;
            var currentQueue;
            var queueIndex = -1;

            function cleanUpNextTick() {
                if (!draining || !currentQueue) {
                    return;
                }
                draining = false;
                if (currentQueue.length) {
                    queue = currentQueue.concat(queue);
                }
                else {
                    queueIndex = -1;
                }
                if (queue.length) {
                    drainQueue();
                }
            }

            function drainQueue() {
                if (draining) {
                    return;
                }
                var timeout = runTimeout(cleanUpNextTick);
                draining = true;

                var len = queue.length;
                while (len) {
                    currentQueue = queue;
                    queue = [];
                    while (++queueIndex < len) {
                        if (currentQueue) {
                            currentQueue[queueIndex].run();
                        }
                    }
                    queueIndex = -1;
                    len = queue.length;
                }
                currentQueue = null;
                draining = false;
                runClearTimeout(timeout);
            }

            process.nextTick = function(fun) {
                var args = new Array(arguments.length - 1);
                if (arguments.length > 1) {
                    for (var i = 1; i < arguments.length; i++) {
                        args[i - 1] = arguments[i];
                    }
                }
                queue.push(new Item(fun, args));
                if (queue.length === 1 && !draining) {
                    runTimeout(drainQueue);
                }
            };

            // v8 likes predictible objects
            function Item(fun, array) {
                this.fun = fun;
                this.array = array;
            }
            Item.prototype.run = function() {
                this.fun.apply(null, this.array);
            };
            process.title = 'browser';
            process.browser = true;
            process.env = {};
            process.argv = [];
            process.version = ''; // empty string to avoid regexp issues
            process.versions = {};

            function noop() {}

            process.on = noop;
            process.addListener = noop;
            process.once = noop;
            process.off = noop;
            process.removeListener = noop;
            process.removeAllListeners = noop;
            process.emit = noop;
            process.prependListener = noop;
            process.prependOnceListener = noop;

            process.listeners = function(name) { return [] }

            process.binding = function(name) {
                throw new Error('process.binding is not supported');
            };

            process.cwd = function() { return '/' };
            process.chdir = function(dir) {
                throw new Error('process.chdir is not supported');
            };
            process.umask = function() { return 0; };

        }, {}],
        42: [function(require, module, exports) {
            /*!
             * randomatic <https://github.com/jonschlinkert/randomatic>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            var isNumber = require('is-number');
            var typeOf = require('kind-of');
            var mathRandom = require('math-random');

            /**
             * Expose `randomatic`
             */

            module.exports = randomatic;
            module.exports.isCrypto = !!mathRandom.cryptographic;

            /**
             * Available mask characters
             */

            var type = {
                lower: 'abcdefghijklmnopqrstuvwxyz',
                upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                number: '0123456789',
                special: '~!@#$%^&()_+-={}[];\',.'
            };

            type.all = type.lower + type.upper + type.number + type.special;

            /**
             * Generate random character sequences of a specified `length`,
             * based on the given `pattern`.
             *
             * @param {String} `pattern` The pattern to use for generating the random string.
             * @param {String} `length` The length of the string to generate.
             * @param {String} `options`
             * @return {String}
             * @api public
             */

            function randomatic(pattern, length, options) {
                if (typeof pattern === 'undefined') {
                    throw new Error('randomatic expects a string or number.');
                }

                var custom = false;
                if (arguments.length === 1) {
                    if (typeof pattern === 'string') {
                        length = pattern.length;

                    }
                    else if (isNumber(pattern)) {
                        options = {};
                        length = pattern;
                        pattern = '*';
                    }
                }

                if (typeOf(length) === 'object' && length.hasOwnProperty('chars')) {
                    options = length;
                    pattern = options.chars;
                    length = pattern.length;
                    custom = true;
                }

                var opts = options || {};
                var mask = '';
                var res = '';

                // Characters to be used
                if (pattern.indexOf('?') !== -1) mask += opts.chars;
                if (pattern.indexOf('a') !== -1) mask += type.lower;
                if (pattern.indexOf('A') !== -1) mask += type.upper;
                if (pattern.indexOf('0') !== -1) mask += type.number;
                if (pattern.indexOf('!') !== -1) mask += type.special;
                if (pattern.indexOf('*') !== -1) mask += type.all;
                if (custom) mask += pattern;

                // Characters to exclude
                if (opts.exclude) {
                    var exclude = typeOf(opts.exclude) === 'string' ? opts.exclude : opts.exclude.join('');
                    exclude = exclude.replace(new RegExp('[\\]]+', 'g'), '');
                    mask = mask.replace(new RegExp('[' + exclude + ']+', 'g'), '');

                    if (opts.exclude.indexOf(']') !== -1) mask = mask.replace(new RegExp('[\\]]+', 'g'), '');
                }

                while (length--) {
                    res += mask.charAt(parseInt(mathRandom() * mask.length, 10));
                }
                return res;
            };

        }, { "is-number": 43, "kind-of": 44, "math-random": 27 }],
        43: [function(require, module, exports) {
            /*!
             * is-number <https://github.com/jonschlinkert/is-number>
             *
             * Copyright (c) 2014-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            module.exports = function isNumber(num) {
                var type = typeof num;

                if (type === 'string' || num instanceof String) {
                    // an empty string would be coerced to true with the below logic
                    if (!num.trim()) return false;
                }
                else if (type !== 'number' && !(num instanceof Number)) {
                    return false;
                }

                return (num - num + 1) >= 0;
            };

        }, {}],
        44: [function(require, module, exports) {
            var toString = Object.prototype.toString;

            module.exports = function kindOf(val) {
                if (val === void 0) return 'undefined';
                if (val === null) return 'null';

                var type = typeof val;
                if (type === 'boolean') return 'boolean';
                if (type === 'string') return 'string';
                if (type === 'number') return 'number';
                if (type === 'symbol') return 'symbol';
                if (type === 'function') {
                    return isGeneratorFn(val) ? 'generatorfunction' : 'function';
                }

                if (isArray(val)) return 'array';
                if (isBuffer(val)) return 'buffer';
                if (isArguments(val)) return 'arguments';
                if (isDate(val)) return 'date';
                if (isError(val)) return 'error';
                if (isRegexp(val)) return 'regexp';

                switch (ctorName(val)) {
                    case 'Symbol':
                        return 'symbol';
                    case 'Promise':
                        return 'promise';

                        // Set, Map, WeakSet, WeakMap
                    case 'WeakMap':
                        return 'weakmap';
                    case 'WeakSet':
                        return 'weakset';
                    case 'Map':
                        return 'map';
                    case 'Set':
                        return 'set';

                        // 8-bit typed arrays
                    case 'Int8Array':
                        return 'int8array';
                    case 'Uint8Array':
                        return 'uint8array';
                    case 'Uint8ClampedArray':
                        return 'uint8clampedarray';

                        // 16-bit typed arrays
                    case 'Int16Array':
                        return 'int16array';
                    case 'Uint16Array':
                        return 'uint16array';

                        // 32-bit typed arrays
                    case 'Int32Array':
                        return 'int32array';
                    case 'Uint32Array':
                        return 'uint32array';
                    case 'Float32Array':
                        return 'float32array';
                    case 'Float64Array':
                        return 'float64array';
                }

                if (isGeneratorObj(val)) {
                    return 'generator';
                }

                // Non-plain objects
                type = toString.call(val);
                switch (type) {
                    case '[object Object]':
                        return 'object';
                        // iterators
                    case '[object Map Iterator]':
                        return 'mapiterator';
                    case '[object Set Iterator]':
                        return 'setiterator';
                    case '[object String Iterator]':
                        return 'stringiterator';
                    case '[object Array Iterator]':
                        return 'arrayiterator';
                }

                // other
                return type.slice(8, -1).toLowerCase().replace(/\s/g, '');
            };

            function ctorName(val) {
                return typeof val.constructor === 'function' ? val.constructor.name : null;
            }

            function isArray(val) {
                if (Array.isArray) return Array.isArray(val);
                return val instanceof Array;
            }

            function isError(val) {
                return val instanceof Error || (typeof val.message === 'string' && val.constructor && typeof val.constructor.stackTraceLimit === 'number');
            }

            function isDate(val) {
                if (val instanceof Date) return true;
                return typeof val.toDateString === 'function' &&
                    typeof val.getDate === 'function' &&
                    typeof val.setDate === 'function';
            }

            function isRegexp(val) {
                if (val instanceof RegExp) return true;
                return typeof val.flags === 'string' &&
                    typeof val.ignoreCase === 'boolean' &&
                    typeof val.multiline === 'boolean' &&
                    typeof val.global === 'boolean';
            }

            function isGeneratorFn(name, val) {
                return ctorName(name) === 'GeneratorFunction';
            }

            function isGeneratorObj(val) {
                return typeof val.throw === 'function' &&
                    typeof val.return === 'function' &&
                    typeof val.next === 'function';
            }

            function isArguments(val) {
                try {
                    if (typeof val.length === 'number' && typeof val.callee === 'function') {
                        return true;
                    }
                }
                catch (err) {
                    if (err.message.indexOf('callee') !== -1) {
                        return true;
                    }
                }
                return false;
            }

            /**
             * If you need to support Safari 5-7 (8-10 yr-old browser),
             * take a look at https://github.com/feross/is-buffer
             */

            function isBuffer(val) {
                if (val.constructor && typeof val.constructor.isBuffer === 'function') {
                    return val.constructor.isBuffer(val);
                }
                return false;
            }

        }, {}],
        45: [function(require, module, exports) {
            /*!
             * regex-cache <https://github.com/jonschlinkert/regex-cache>
             *
             * Copyright (c) 2015-2017, Jon Schlinkert.
             * Released under the MIT License.
             */

            'use strict';

            var equal = require('is-equal-shallow');
            var basic = {};
            var cache = {};

            /**
             * Expose `regexCache`
             */

            module.exports = regexCache;

            /**
             * Memoize the results of a call to the new RegExp constructor.
             *
             * @param  {Function} fn [description]
             * @param  {String} str [description]
             * @param  {Options} options [description]
             * @param  {Boolean} nocompare [description]
             * @return {RegExp}
             */

            function regexCache(fn, str, opts) {
                var key = '_default_',
                    regex, cached;

                if (!str && !opts) {
                    if (typeof fn !== 'function') {
                        return fn;
                    }
                    return basic[key] || (basic[key] = fn(str));
                }

                var isString = typeof str === 'string';
                if (isString) {
                    if (!opts) {
                        return basic[str] || (basic[str] = fn(str));
                    }
                    key = str;
                }
                else {
                    opts = str;
                }

                cached = cache[key];
                if (cached && equal(cached.opts, opts)) {
                    return cached.regex;
                }

                memo(key, opts, (regex = fn(str, opts)));
                return regex;
            }

            function memo(key, opts, regex) {
                cache[key] = { regex: regex, opts: opts };
            }

            /**
             * Expose `cache`
             */

            module.exports.cache = cache;
            module.exports.basic = basic;

        }, { "is-equal-shallow": 19 }],
        46: [function(require, module, exports) {
            (function(process) {
                var isWin = process.platform === 'win32';

                module.exports = function(str) {
                    var i = str.length - 1;
                    if (i < 2) {
                        return str;
                    }
                    while (isSeparator(str, i)) {
                        i--;
                    }
                    return str.substr(0, i + 1);
                };

                function isSeparator(str, i) {
                    var char = str[i];
                    return i > 0 && (char === '/' || (isWin && char === '\\'));
                }

            }).call(this, require('_process'))
        }, { "_process": 41 }],
        47: [function(require, module, exports) {
            /*!
             * repeat-element <https://github.com/jonschlinkert/repeat-element>
             *
             * Copyright (c) 2015-present, Jon Schlinkert.
             * Licensed under the MIT license.
             */

            'use strict';

            module.exports = function repeat(ele, num) {
                var arr = new Array(num);

                for (var i = 0; i < num; i++) {
                    arr[i] = ele;
                }

                return arr;
            };

        }, {}],
        48: [function(require, module, exports) {
            /*!
             * repeat-string <https://github.com/jonschlinkert/repeat-string>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            /**
             * Results cache
             */

            var res = '';
            var cache;

            /**
             * Expose `repeat`
             */

            module.exports = repeat;

            /**
             * Repeat the given `string` the specified `number`
             * of times.
             *
             * **Example:**
             *
             * ```js
             * var repeat = require('repeat-string');
             * repeat('A', 5);
             * //=> AAAAA
             * ```
             *
             * @param {String} `string` The string to repeat
             * @param {Number} `number` The number of times to repeat the string
             * @return {String} Repeated string
             * @api public
             */

            function repeat(str, num) {
                if (typeof str !== 'string') {
                    throw new TypeError('expected a string');
                }

                // cover common, quick use cases
                if (num === 1) return str;
                if (num === 2) return str + str;

                var max = str.length * num;
                if (cache !== str || typeof cache === 'undefined') {
                    cache = str;
                    res = '';
                }
                else if (res.length >= max) {
                    return res.substr(0, max);
                }

                while (max > res.length && num > 1) {
                    if (num & 1) {
                        res += str;
                    }

                    num >>= 1;
                    str += str;
                }

                res += str;
                res = res.substr(0, max);
                return res;
            }

        }, {}],
        "micromatch": [function(require, module, exports) {
            /*!
             * micromatch <https://github.com/jonschlinkert/micromatch>
             *
             * Copyright (c) 2014-2015, Jon Schlinkert.
             * Licensed under the MIT License.
             */

            'use strict';

            var expand = require('./lib/expand');
            var utils = require('./lib/utils');

            /**
             * The main function. Pass an array of filepaths,
             * and a string or array of glob patterns
             *
             * @param  {Array|String} `files`
             * @param  {Array|String} `patterns`
             * @param  {Object} `opts`
             * @return {Array} Array of matches
             */

            function micromatch(files, patterns, opts) {
                if (!files || !patterns) return [];
                opts = opts || {};

                if (typeof opts.cache === 'undefined') {
                    opts.cache = true;
                }

                if (!Array.isArray(patterns)) {
                    return match(files, patterns, opts);
                }

                var len = patterns.length,
                    i = 0;
                var omit = [],
                    keep = [];

                while (len--) {
                    var glob = patterns[i++];
                    if (typeof glob === 'string' && glob.charCodeAt(0) === 33 /* ! */ ) {
                        omit.push.apply(omit, match(files, glob.slice(1), opts));
                    }
                    else {
                        keep.push.apply(keep, match(files, glob, opts));
                    }
                }
                return utils.diff(keep, omit);
            }

            /**
             * Return an array of files that match the given glob pattern.
             *
             * This function is called by the main `micromatch` function If you only
             * need to pass a single pattern you might get very minor speed improvements
             * using this function.
             *
             * @param  {Array} `files`
             * @param  {String} `pattern`
             * @param  {Object} `options`
             * @return {Array}
             */

            function match(files, pattern, opts) {
                if (utils.typeOf(files) !== 'string' && !Array.isArray(files)) {
                    throw new Error(msg('match', 'files', 'a string or array'));
                }

                files = utils.arrayify(files);
                opts = opts || {};

                var negate = opts.negate || false;
                var orig = pattern;

                if (typeof pattern === 'string') {
                    negate = pattern.charAt(0) === '!';
                    if (negate) {
                        pattern = pattern.slice(1);
                    }

                    // we need to remove the character regardless,
                    // so the above logic is still needed
                    if (opts.nonegate === true) {
                        negate = false;
                    }
                }

                var _isMatch = matcher(pattern, opts);
                var len = files.length,
                    i = 0;
                var res = [];

                while (i < len) {
                    var file = files[i++];
                    var fp = utils.unixify(file, opts);

                    if (!_isMatch(fp)) { continue; }
                    res.push(fp);
                }

                if (res.length === 0) {
                    if (opts.failglob === true) {
                        throw new Error('micromatch.match() found no matches for: "' + orig + '".');
                    }

                    if (opts.nonull || opts.nullglob) {
                        res.push(utils.unescapeGlob(orig));
                    }
                }

                // if `negate` was defined, diff negated files
                if (negate) { res = utils.diff(files, res); }

                // if `ignore` was defined, diff ignored filed
                if (opts.ignore && opts.ignore.length) {
                    pattern = opts.ignore;
                    opts = utils.omit(opts, ['ignore']);
                    res = utils.diff(res, micromatch(res, pattern, opts));
                }

                if (opts.nodupes) {
                    return utils.unique(res);
                }
                return res;
            }

            /**
             * Returns a function that takes a glob pattern or array of glob patterns
             * to be used with `Array#filter()`. (Internally this function generates
             * the matching function using the [matcher] method).
             *
             * ```js
             * var fn = mm.filter('[a-c]');
             * ['a', 'b', 'c', 'd', 'e'].filter(fn);
             * //=> ['a', 'b', 'c']
             * ```
             * @param  {String|Array} `patterns` Can be a glob or array of globs.
             * @param  {Options} `opts` Options to pass to the [matcher] method.
             * @return {Function} Filter function to be passed to `Array#filter()`.
             */

            function filter(patterns, opts) {
                if (!Array.isArray(patterns) && typeof patterns !== 'string') {
                    throw new TypeError(msg('filter', 'patterns', 'a string or array'));
                }

                patterns = utils.arrayify(patterns);
                var len = patterns.length,
                    i = 0;
                var patternMatchers = Array(len);
                while (i < len) {
                    patternMatchers[i] = matcher(patterns[i++], opts);
                }

                return function(fp) {
                    if (fp == null) return [];
                    var len = patternMatchers.length,
                        i = 0;
                    var res = true;

                    fp = utils.unixify(fp, opts);
                    while (i < len) {
                        var fn = patternMatchers[i++];
                        if (!fn(fp)) {
                            res = false;
                            break;
                        }
                    }
                    return res;
                };
            }

            /**
             * Returns true if the filepath contains the given
             * pattern. Can also return a function for matching.
             *
             * ```js
             * isMatch('foo.md', '*.md', {});
             * //=> true
             *
             * isMatch('*.md', {})('foo.md')
             * //=> true
             * ```
             * @param  {String} `fp`
             * @param  {String} `pattern`
             * @param  {Object} `opts`
             * @return {Boolean}
             */

            function isMatch(fp, pattern, opts) {
                if (typeof fp !== 'string') {
                    throw new TypeError(msg('isMatch', 'filepath', 'a string'));
                }

                fp = utils.unixify(fp, opts);
                if (utils.typeOf(pattern) === 'object') {
                    return matcher(fp, pattern);
                }
                return matcher(pattern, opts)(fp);
            }

            /**
             * Returns true if the filepath matches the
             * given pattern.
             */

            function contains(fp, pattern, opts) {
                if (typeof fp !== 'string') {
                    throw new TypeError(msg('contains', 'pattern', 'a string'));
                }

                opts = opts || {};
                opts.contains = (pattern !== '');
                fp = utils.unixify(fp, opts);

                if (opts.contains && !utils.isGlob(pattern)) {
                    return fp.indexOf(pattern) !== -1;
                }
                return matcher(pattern, opts)(fp);
            }

            /**
             * Returns true if a file path matches any of the
             * given patterns.
             *
             * @param  {String} `fp` The filepath to test.
             * @param  {String|Array} `patterns` Glob patterns to use.
             * @param  {Object} `opts` Options to pass to the `matcher()` function.
             * @return {String}
             */

            function any(fp, patterns, opts) {
                if (!Array.isArray(patterns) && typeof patterns !== 'string') {
                    throw new TypeError(msg('any', 'patterns', 'a string or array'));
                }

                patterns = utils.arrayify(patterns);
                var len = patterns.length;

                fp = utils.unixify(fp, opts);
                while (len--) {
                    var isMatch = matcher(patterns[len], opts);
                    if (isMatch(fp)) {
                        return true;
                    }
                }
                return false;
            }

            /**
             * Filter the keys of an object with the given `glob` pattern
             * and `options`
             *
             * @param  {Object} `object`
             * @param  {Pattern} `object`
             * @return {Array}
             */

            function matchKeys(obj, glob, options) {
                if (utils.typeOf(obj) !== 'object') {
                    throw new TypeError(msg('matchKeys', 'first argument', 'an object'));
                }

                var fn = matcher(glob, options);
                var res = {};

                for (var key in obj) {
                    if (obj.hasOwnProperty(key) && fn(key)) {
                        res[key] = obj[key];
                    }
                }
                return res;
            }

            /**
             * Return a function for matching based on the
             * given `pattern` and `options`.
             *
             * @param  {String} `pattern`
             * @param  {Object} `options`
             * @return {Function}
             */

            function matcher(pattern, opts) {
                // pattern is a function
                if (typeof pattern === 'function') {
                    return pattern;
                }
                // pattern is a regex
                if (pattern instanceof RegExp) {
                    return function(fp) {
                        return pattern.test(fp);
                    };
                }

                if (typeof pattern !== 'string') {
                    throw new TypeError(msg('matcher', 'pattern', 'a string, regex, or function'));
                }

                // strings, all the way down...
                pattern = utils.unixify(pattern, opts);

                // pattern is a non-glob string
                if (!utils.isGlob(pattern)) {
                    return utils.matchPath(pattern, opts);
                }
                // pattern is a glob string
                var re = makeRe(pattern, opts);

                // `matchBase` is defined
                if (opts && opts.matchBase) {
                    return utils.hasFilename(re, opts);
                }
                // `matchBase` is not defined
                return function(fp) {
                    fp = utils.unixify(fp, opts);
                    return re.test(fp);
                };
            }

            /**
             * Create and cache a regular expression for matching
             * file paths.
             *
             * If the leading character in the `glob` is `!`, a negation
             * regex is returned.
             *
             * @param  {String} `glob`
             * @param  {Object} `options`
             * @return {RegExp}
             */

            function toRegex(glob, options) {
                // clone options to prevent  mutating the original object
                var opts = Object.create(options || {});
                var flags = opts.flags || '';
                if (opts.nocase && flags.indexOf('i') === -1) {
                    flags += 'i';
                }

                var parsed = expand(glob, opts);

                // pass in tokens to avoid parsing more than once
                opts.negated = opts.negated || parsed.negated;
                opts.negate = opts.negated;
                glob = wrapGlob(parsed.pattern, opts);
                var re;

                try {
                    re = new RegExp(glob, flags);
                    return re;
                }
                catch (err) {
                    err.reason = 'micromatch invalid regex: (' + re + ')';
                    if (opts.strict) throw new SyntaxError(err);
                }

                // we're only here if a bad pattern was used and the user
                // passed `options.silent`, so match nothing
                return /$^/;
            }

            /**
             * Create the regex to do the matching. If the leading
             * character in the `glob` is `!` a negation regex is returned.
             *
             * @param {String} `glob`
             * @param {Boolean} `negate`
             */

            function wrapGlob(glob, opts) {
                var prefix = (opts && !opts.contains) ? '^' : '';
                var after = (opts && !opts.contains) ? '$' : '';
                glob = ('(?:' + glob + ')' + after);
                if (opts && opts.negate) {
                    return prefix + ('(?!^' + glob + ').*$');
                }
                return prefix + glob;
            }

            /**
             * Create and cache a regular expression for matching file paths.
             * If the leading character in the `glob` is `!`, a negation
             * regex is returned.
             *
             * @param  {String} `glob`
             * @param  {Object} `options`
             * @return {RegExp}
             */

            function makeRe(glob, opts) {
                if (utils.typeOf(glob) !== 'string') {
                    throw new Error(msg('makeRe', 'glob', 'a string'));
                }
                return utils.cache(toRegex, glob, opts);
            }

            /**
             * Make error messages consistent. Follows this format:
             *
             * ```js
             * msg(methodName, argNumber, nativeType);
             * // example:
             * msg('matchKeys', 'first', 'an object');
             * ```
             *
             * @param  {String} `method`
             * @param  {String} `num`
             * @param  {String} `type`
             * @return {String}
             */

            function msg(method, what, type) {
                return 'micromatch.' + method + '(): ' + what + ' should be ' + type + '.';
            }

            /**
             * Public methods
             */

            /* eslint no-multi-spaces: 0 */
            micromatch.any = any;
            micromatch.braces = micromatch.braceExpand = utils.braces;
            micromatch.contains = contains;
            micromatch.expand = expand;
            micromatch.filter = filter;
            micromatch.isMatch = isMatch;
            micromatch.makeRe = makeRe;
            micromatch.match = match;
            micromatch.matcher = matcher;
            micromatch.matchKeys = matchKeys;

            /**
             * Expose `micromatch`
             */

            module.exports = micromatch;

        }, { "./lib/expand": 29, "./lib/utils": 31 }]
    }, {}, []);
    window.micromatch = require('micromatch');
})(window)