"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
(function () {
  var k = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : typeof module === 'object';
  return function () {
    var module = k ? module : {};
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
    (function () {
      try {
        if (typeof setTimeout === 'function') {
          cachedSetTimeout = setTimeout;
        } else {
          cachedSetTimeout = defaultSetTimout;
        }
      } catch (e) {
        cachedSetTimeout = defaultSetTimout;
      }
      try {
        if (typeof clearTimeout === 'function') {
          cachedClearTimeout = clearTimeout;
        } else {
          cachedClearTimeout = defaultClearTimeout;
        }
      } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
      }
    })();
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
      } catch (e) {
        try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
          return cachedSetTimeout.call(null, fun, 0);
        } catch (e) {
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
      } catch (e) {
        try {
          // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
          return cachedClearTimeout.call(null, marker);
        } catch (e) {
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
      } else {
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
    process.nextTick = function (fun) {
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
    Item.prototype.run = function () {
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
    process.listeners = function (name) {
      return [];
    };
    process.binding = function (name) {
      throw new Error('process.binding is not supported');
    };
    process.cwd = function () {
      return '/';
    };
    process.chdir = function (dir) {
      throw new Error('process.chdir is not supported');
    };
    process.umask = function () {
      return 0;
    };
    if (!k) module = undefined;
    (function webpackUniversalModuleDefinition(root, factory) {
      if (typeof exports === 'object' && typeof module === 'object') module.exports = factory();else if (typeof define === 'function' && define.amd) define([], factory);else if (typeof exports === 'object') exports["micromatch"] = factory();else root["micromatch"] = factory();
    })(self, function () {
      return /******/function () {
        // webpackBootstrap
        /******/
        var __webpack_modules__ = {
          /***/744: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var stringify = __webpack_require__(349);
            var compile = __webpack_require__(529);
            var expand = __webpack_require__(50);
            var parse = __webpack_require__(339);

            /**
             * Expand the given pattern or create a regex-compatible string.
             *
             * ```js
             * const braces = require('braces');
             * console.log(braces('{a,b,c}', { compile: true })); //=> ['(a|b|c)']
             * console.log(braces('{a,b,c}')); //=> ['a', 'b', 'c']
             * ```
             * @param {String} `str`
             * @param {Object} `options`
             * @return {String}
             * @api public
             */

            var braces = function braces(input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var output = [];
              if (Array.isArray(input)) {
                var _iterator = _createForOfIteratorHelper(input),
                  _step;
                try {
                  for (_iterator.s(); !(_step = _iterator.n()).done;) {
                    var pattern = _step.value;
                    var result = braces.create(pattern, options);
                    if (Array.isArray(result)) {
                      var _output;
                      (_output = output).push.apply(_output, _toConsumableArray(result));
                    } else {
                      output.push(result);
                    }
                  }
                } catch (err) {
                  _iterator.e(err);
                } finally {
                  _iterator.f();
                }
              } else {
                output = [].concat(braces.create(input, options));
              }
              if (options && options.expand === true && options.nodupes === true) {
                output = _toConsumableArray(new Set(output));
              }
              return output;
            };

            /**
             * Parse the given `str` with the given `options`.
             *
             * ```js
             * // braces.parse(pattern, [, options]);
             * const ast = braces.parse('a/{b,c}/d');
             * console.log(ast);
             * ```
             * @param {String} pattern Brace pattern to parse
             * @param {Object} options
             * @return {Object} Returns an AST
             * @api public
             */

            braces.parse = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              return parse(input, options);
            };

            /**
             * Creates a braces string from an AST, or an AST node.
             *
             * ```js
             * const braces = require('braces');
             * let ast = braces.parse('foo/{a,b}/bar');
             * console.log(stringify(ast.nodes[2])); //=> '{a,b}'
             * ```
             * @param {String} `input` Brace pattern or AST.
             * @param {Object} `options`
             * @return {Array} Returns an array of expanded values.
             * @api public
             */

            braces.stringify = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              if (typeof input === 'string') {
                return stringify(braces.parse(input, options), options);
              }
              return stringify(input, options);
            };

            /**
             * Compiles a brace pattern into a regex-compatible, optimized string.
             * This method is called by the main [braces](#braces) function by default.
             *
             * ```js
             * const braces = require('braces');
             * console.log(braces.compile('a/{b,c}/d'));
             * //=> ['a/(b|c)/d']
             * ```
             * @param {String} `input` Brace pattern or AST.
             * @param {Object} `options`
             * @return {Array} Returns an array of expanded values.
             * @api public
             */

            braces.compile = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              if (typeof input === 'string') {
                input = braces.parse(input, options);
              }
              return compile(input, options);
            };

            /**
             * Expands a brace pattern into an array. This method is called by the
             * main [braces](#braces) function when `options.expand` is true. Before
             * using this method it's recommended that you read the [performance notes](#performance))
             * and advantages of using [.compile](#compile) instead.
             *
             * ```js
             * const braces = require('braces');
             * console.log(braces.expand('a/{b,c}/d'));
             * //=> ['a/b/d', 'a/c/d'];
             * ```
             * @param {String} `pattern` Brace pattern
             * @param {Object} `options`
             * @return {Array} Returns an array of expanded values.
             * @api public
             */

            braces.expand = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              if (typeof input === 'string') {
                input = braces.parse(input, options);
              }
              var result = expand(input, options);

              // filter out empty strings if specified
              if (options.noempty === true) {
                result = result.filter(Boolean);
              }

              // filter out duplicates if specified
              if (options.nodupes === true) {
                result = _toConsumableArray(new Set(result));
              }
              return result;
            };

            /**
             * Processes a brace pattern and returns either an expanded array
             * (if `options.expand` is true), a highly optimized regex-compatible string.
             * This method is called by the main [braces](#braces) function.
             *
             * ```js
             * const braces = require('braces');
             * console.log(braces.create('user-{200..300}/project-{a,b,c}-{1..10}'))
             * //=> 'user-(20[0-9]|2[1-9][0-9]|300)/project-(a|b|c)-([1-9]|10)'
             * ```
             * @param {String} `pattern` Brace pattern
             * @param {Object} `options`
             * @return {Array} Returns an array of expanded values.
             * @api public
             */

            braces.create = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              if (input === '' || input.length < 3) {
                return [input];
              }
              return options.expand !== true ? braces.compile(input, options) : braces.expand(input, options);
            };

            /**
             * Expose "braces"
             */

            module.exports = braces;

            /***/
          }),
          /***/529: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var fill = __webpack_require__(664);
            var utils = __webpack_require__(305);
            var compile = function compile(ast) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var walk = function walk(node) {
                var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                var invalidBlock = utils.isInvalidBrace(parent);
                var invalidNode = node.invalid === true && options.escapeInvalid === true;
                var invalid = invalidBlock === true || invalidNode === true;
                var prefix = options.escapeInvalid === true ? '\\' : '';
                var output = '';
                if (node.isOpen === true) {
                  return prefix + node.value;
                }
                if (node.isClose === true) {
                  return prefix + node.value;
                }
                if (node.type === 'open') {
                  return invalid ? prefix + node.value : '(';
                }
                if (node.type === 'close') {
                  return invalid ? prefix + node.value : ')';
                }
                if (node.type === 'comma') {
                  return node.prev.type === 'comma' ? '' : invalid ? node.value : '|';
                }
                if (node.value) {
                  return node.value;
                }
                if (node.nodes && node.ranges > 0) {
                  var args = utils.reduce(node.nodes);
                  var range = fill.apply(void 0, _toConsumableArray(args).concat([_objectSpread(_objectSpread({}, options), {}, {
                    wrap: false,
                    toRegex: true
                  })]));
                  if (range.length !== 0) {
                    return args.length > 1 && range.length > 1 ? "(".concat(range, ")") : range;
                  }
                }
                if (node.nodes) {
                  var _iterator2 = _createForOfIteratorHelper(node.nodes),
                    _step2;
                  try {
                    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                      var child = _step2.value;
                      output += walk(child, node);
                    }
                  } catch (err) {
                    _iterator2.e(err);
                  } finally {
                    _iterator2.f();
                  }
                }
                return output;
              };
              return walk(ast);
            };
            module.exports = compile;

            /***/
          }),
          /***/611: ( /***/function _(module) {
            "use strict";

            module.exports = {
              MAX_LENGTH: 1024 * 64,
              // Digits
              CHAR_0: '0',
              /* 0 */
              CHAR_9: '9',
              /* 9 */

              // Alphabet chars.
              CHAR_UPPERCASE_A: 'A',
              /* A */
              CHAR_LOWERCASE_A: 'a',
              /* a */
              CHAR_UPPERCASE_Z: 'Z',
              /* Z */
              CHAR_LOWERCASE_Z: 'z',
              /* z */

              CHAR_LEFT_PARENTHESES: '(',
              /* ( */
              CHAR_RIGHT_PARENTHESES: ')',
              /* ) */

              CHAR_ASTERISK: '*',
              /* * */

              // Non-alphabetic chars.
              CHAR_AMPERSAND: '&',
              /* & */
              CHAR_AT: '@',
              /* @ */
              CHAR_BACKSLASH: '\\',
              /* \ */
              CHAR_BACKTICK: '`',
              /* ` */
              CHAR_CARRIAGE_RETURN: '\r',
              /* \r */
              CHAR_CIRCUMFLEX_ACCENT: '^',
              /* ^ */
              CHAR_COLON: ':',
              /* : */
              CHAR_COMMA: ',',
              /* , */
              CHAR_DOLLAR: '$',
              /* . */
              CHAR_DOT: '.',
              /* . */
              CHAR_DOUBLE_QUOTE: '"',
              /* " */
              CHAR_EQUAL: '=',
              /* = */
              CHAR_EXCLAMATION_MARK: '!',
              /* ! */
              CHAR_FORM_FEED: '\f',
              /* \f */
              CHAR_FORWARD_SLASH: '/',
              /* / */
              CHAR_HASH: '#',
              /* # */
              CHAR_HYPHEN_MINUS: '-',
              /* - */
              CHAR_LEFT_ANGLE_BRACKET: '<',
              /* < */
              CHAR_LEFT_CURLY_BRACE: '{',
              /* { */
              CHAR_LEFT_SQUARE_BRACKET: '[',
              /* [ */
              CHAR_LINE_FEED: '\n',
              /* \n */
              CHAR_NO_BREAK_SPACE: "\xA0",
              /* \u00A0 */
              CHAR_PERCENT: '%',
              /* % */
              CHAR_PLUS: '+',
              /* + */
              CHAR_QUESTION_MARK: '?',
              /* ? */
              CHAR_RIGHT_ANGLE_BRACKET: '>',
              /* > */
              CHAR_RIGHT_CURLY_BRACE: '}',
              /* } */
              CHAR_RIGHT_SQUARE_BRACKET: ']',
              /* ] */
              CHAR_SEMICOLON: ';',
              /* ; */
              CHAR_SINGLE_QUOTE: '\'',
              /* ' */
              CHAR_SPACE: ' ',
              /*   */
              CHAR_TAB: '\t',
              /* \t */
              CHAR_UNDERSCORE: '_',
              /* _ */
              CHAR_VERTICAL_LINE: '|',
              /* | */
              CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF" /* \uFEFF */
            };

            /***/
          }),
          /***/50: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var fill = __webpack_require__(664);
            var stringify = __webpack_require__(349);
            var utils = __webpack_require__(305);
            var append = function append() {
              var queue = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
              var stash = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
              var enclose = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
              var result = [];
              queue = [].concat(queue);
              stash = [].concat(stash);
              if (!stash.length) return queue;
              if (!queue.length) {
                return enclose ? utils.flatten(stash).map(function (ele) {
                  return "{".concat(ele, "}");
                }) : stash;
              }
              var _iterator3 = _createForOfIteratorHelper(queue),
                _step3;
              try {
                for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                  var item = _step3.value;
                  if (Array.isArray(item)) {
                    var _iterator4 = _createForOfIteratorHelper(item),
                      _step4;
                    try {
                      for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
                        var value = _step4.value;
                        result.push(append(value, stash, enclose));
                      }
                    } catch (err) {
                      _iterator4.e(err);
                    } finally {
                      _iterator4.f();
                    }
                  } else {
                    var _iterator5 = _createForOfIteratorHelper(stash),
                      _step5;
                    try {
                      for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
                        var ele = _step5.value;
                        if (enclose === true && typeof ele === 'string') ele = "{".concat(ele, "}");
                        result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
                      }
                    } catch (err) {
                      _iterator5.e(err);
                    } finally {
                      _iterator5.f();
                    }
                  }
                }
              } catch (err) {
                _iterator3.e(err);
              } finally {
                _iterator3.f();
              }
              return utils.flatten(result);
            };
            var expand = function expand(ast) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var rangeLimit = options.rangeLimit === void 0 ? 1000 : options.rangeLimit;
              var walk = function walk(node) {
                var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                node.queue = [];
                var p = parent;
                var q = parent.queue;
                while (p.type !== 'brace' && p.type !== 'root' && p.parent) {
                  p = p.parent;
                  q = p.queue;
                }
                if (node.invalid || node.dollar) {
                  q.push(append(q.pop(), stringify(node, options)));
                  return;
                }
                if (node.type === 'brace' && node.invalid !== true && node.nodes.length === 2) {
                  q.push(append(q.pop(), ['{}']));
                  return;
                }
                if (node.nodes && node.ranges > 0) {
                  var args = utils.reduce(node.nodes);
                  if (utils.exceedsLimit.apply(utils, _toConsumableArray(args).concat([options.step, rangeLimit]))) {
                    throw new RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
                  }
                  var range = fill.apply(void 0, _toConsumableArray(args).concat([options]));
                  if (range.length === 0) {
                    range = stringify(node, options);
                  }
                  q.push(append(q.pop(), range));
                  node.nodes = [];
                  return;
                }
                var enclose = utils.encloseBrace(node);
                var queue = node.queue;
                var block = node;
                while (block.type !== 'brace' && block.type !== 'root' && block.parent) {
                  block = block.parent;
                  queue = block.queue;
                }
                for (var i = 0; i < node.nodes.length; i++) {
                  var child = node.nodes[i];
                  if (child.type === 'comma' && node.type === 'brace') {
                    if (i === 1) queue.push('');
                    queue.push('');
                    continue;
                  }
                  if (child.type === 'close') {
                    q.push(append(q.pop(), queue, enclose));
                    continue;
                  }
                  if (child.value && child.type !== 'open') {
                    queue.push(append(queue.pop(), child.value));
                    continue;
                  }
                  if (child.nodes) {
                    walk(child, node);
                  }
                }
                return queue;
              };
              return utils.flatten(walk(ast));
            };
            module.exports = expand;

            /***/
          }),
          /***/339: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var stringify = __webpack_require__(349);

            /**
             * Constants
             */

            var _webpack_require__ = __webpack_require__(611),
              MAX_LENGTH = _webpack_require__.MAX_LENGTH,
              CHAR_BACKSLASH = _webpack_require__.CHAR_BACKSLASH,
              CHAR_BACKTICK = _webpack_require__.CHAR_BACKTICK,
              CHAR_COMMA = _webpack_require__.CHAR_COMMA,
              CHAR_DOT = _webpack_require__.CHAR_DOT,
              CHAR_LEFT_PARENTHESES = _webpack_require__.CHAR_LEFT_PARENTHESES,
              CHAR_RIGHT_PARENTHESES = _webpack_require__.CHAR_RIGHT_PARENTHESES,
              CHAR_LEFT_CURLY_BRACE = _webpack_require__.CHAR_LEFT_CURLY_BRACE,
              CHAR_RIGHT_CURLY_BRACE = _webpack_require__.CHAR_RIGHT_CURLY_BRACE,
              CHAR_LEFT_SQUARE_BRACKET = _webpack_require__.CHAR_LEFT_SQUARE_BRACKET,
              CHAR_RIGHT_SQUARE_BRACKET = _webpack_require__.CHAR_RIGHT_SQUARE_BRACKET,
              CHAR_DOUBLE_QUOTE = _webpack_require__.CHAR_DOUBLE_QUOTE,
              CHAR_SINGLE_QUOTE = _webpack_require__.CHAR_SINGLE_QUOTE,
              CHAR_NO_BREAK_SPACE = _webpack_require__.CHAR_NO_BREAK_SPACE,
              CHAR_ZERO_WIDTH_NOBREAK_SPACE = _webpack_require__.CHAR_ZERO_WIDTH_NOBREAK_SPACE;

            /**
             * parse
             */

            var parse = function parse(input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              if (typeof input !== 'string') {
                throw new TypeError('Expected a string');
              }
              var opts = options || {};
              var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
              if (input.length > max) {
                throw new SyntaxError("Input length (".concat(input.length, "), exceeds max characters (").concat(max, ")"));
              }
              var ast = {
                type: 'root',
                input: input,
                nodes: []
              };
              var stack = [ast];
              var block = ast;
              var prev = ast;
              var brackets = 0;
              var length = input.length;
              var index = 0;
              var depth = 0;
              var value;
              var memo = {};

              /**
               * Helpers
               */

              var advance = function advance() {
                return input[index++];
              };
              var push = function push(node) {
                if (node.type === 'text' && prev.type === 'dot') {
                  prev.type = 'text';
                }
                if (prev && prev.type === 'text' && node.type === 'text') {
                  prev.value += node.value;
                  return;
                }
                block.nodes.push(node);
                node.parent = block;
                node.prev = prev;
                prev = node;
                return node;
              };
              push({
                type: 'bos'
              });
              while (index < length) {
                block = stack[stack.length - 1];
                value = advance();

                /**
                 * Invalid chars
                 */

                if (value === CHAR_ZERO_WIDTH_NOBREAK_SPACE || value === CHAR_NO_BREAK_SPACE) {
                  continue;
                }

                /**
                 * Escaped chars
                 */

                if (value === CHAR_BACKSLASH) {
                  push({
                    type: 'text',
                    value: (options.keepEscaping ? value : '') + advance()
                  });
                  continue;
                }

                /**
                 * Right square bracket (literal): ']'
                 */

                if (value === CHAR_RIGHT_SQUARE_BRACKET) {
                  push({
                    type: 'text',
                    value: '\\' + value
                  });
                  continue;
                }

                /**
                 * Left square bracket: '['
                 */

                if (value === CHAR_LEFT_SQUARE_BRACKET) {
                  brackets++;
                  var closed = true;
                  var next = void 0;
                  while (index < length && (next = advance())) {
                    value += next;
                    if (next === CHAR_LEFT_SQUARE_BRACKET) {
                      brackets++;
                      continue;
                    }
                    if (next === CHAR_BACKSLASH) {
                      value += advance();
                      continue;
                    }
                    if (next === CHAR_RIGHT_SQUARE_BRACKET) {
                      brackets--;
                      if (brackets === 0) {
                        break;
                      }
                    }
                  }
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }

                /**
                 * Parentheses
                 */

                if (value === CHAR_LEFT_PARENTHESES) {
                  block = push({
                    type: 'paren',
                    nodes: []
                  });
                  stack.push(block);
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }
                if (value === CHAR_RIGHT_PARENTHESES) {
                  if (block.type !== 'paren') {
                    push({
                      type: 'text',
                      value: value
                    });
                    continue;
                  }
                  block = stack.pop();
                  push({
                    type: 'text',
                    value: value
                  });
                  block = stack[stack.length - 1];
                  continue;
                }

                /**
                 * Quotes: '|"|`
                 */

                if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
                  var open = value;
                  var _next = void 0;
                  if (options.keepQuotes !== true) {
                    value = '';
                  }
                  while (index < length && (_next = advance())) {
                    if (_next === CHAR_BACKSLASH) {
                      value += _next + advance();
                      continue;
                    }
                    if (_next === open) {
                      if (options.keepQuotes === true) value += _next;
                      break;
                    }
                    value += _next;
                  }
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }

                /**
                 * Left curly brace: '{'
                 */

                if (value === CHAR_LEFT_CURLY_BRACE) {
                  depth++;
                  var dollar = prev.value && prev.value.slice(-1) === '$' || block.dollar === true;
                  var brace = {
                    type: 'brace',
                    open: true,
                    close: false,
                    dollar: dollar,
                    depth: depth,
                    commas: 0,
                    ranges: 0,
                    nodes: []
                  };
                  block = push(brace);
                  stack.push(block);
                  push({
                    type: 'open',
                    value: value
                  });
                  continue;
                }

                /**
                 * Right curly brace: '}'
                 */

                if (value === CHAR_RIGHT_CURLY_BRACE) {
                  if (block.type !== 'brace') {
                    push({
                      type: 'text',
                      value: value
                    });
                    continue;
                  }
                  var type = 'close';
                  block = stack.pop();
                  block.close = true;
                  push({
                    type: type,
                    value: value
                  });
                  depth--;
                  block = stack[stack.length - 1];
                  continue;
                }

                /**
                 * Comma: ','
                 */

                if (value === CHAR_COMMA && depth > 0) {
                  if (block.ranges > 0) {
                    block.ranges = 0;
                    var _open = block.nodes.shift();
                    block.nodes = [_open, {
                      type: 'text',
                      value: stringify(block)
                    }];
                  }
                  push({
                    type: 'comma',
                    value: value
                  });
                  block.commas++;
                  continue;
                }

                /**
                 * Dot: '.'
                 */

                if (value === CHAR_DOT && depth > 0 && block.commas === 0) {
                  var siblings = block.nodes;
                  if (depth === 0 || siblings.length === 0) {
                    push({
                      type: 'text',
                      value: value
                    });
                    continue;
                  }
                  if (prev.type === 'dot') {
                    block.range = [];
                    prev.value += value;
                    prev.type = 'range';
                    if (block.nodes.length !== 3 && block.nodes.length !== 5) {
                      block.invalid = true;
                      block.ranges = 0;
                      prev.type = 'text';
                      continue;
                    }
                    block.ranges++;
                    block.args = [];
                    continue;
                  }
                  if (prev.type === 'range') {
                    siblings.pop();
                    var before = siblings[siblings.length - 1];
                    before.value += prev.value + value;
                    prev = before;
                    block.ranges--;
                    continue;
                  }
                  push({
                    type: 'dot',
                    value: value
                  });
                  continue;
                }

                /**
                 * Text
                 */

                push({
                  type: 'text',
                  value: value
                });
              }

              // Mark imbalanced braces and brackets as invalid
              do {
                block = stack.pop();
                if (block.type !== 'root') {
                  var _parent$nodes;
                  block.nodes.forEach(function (node) {
                    if (!node.nodes) {
                      if (node.type === 'open') node.isOpen = true;
                      if (node.type === 'close') node.isClose = true;
                      if (!node.nodes) node.type = 'text';
                      node.invalid = true;
                    }
                  });

                  // get the location of the block on parent.nodes (block's siblings)
                  var parent = stack[stack.length - 1];
                  var _index = parent.nodes.indexOf(block);
                  // replace the (invalid) block with it's nodes
                  (_parent$nodes = parent.nodes).splice.apply(_parent$nodes, [_index, 1].concat(_toConsumableArray(block.nodes)));
                }
              } while (stack.length > 0);
              push({
                type: 'eos'
              });
              return ast;
            };
            module.exports = parse;

            /***/
          }),
          /***/349: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var utils = __webpack_require__(305);
            module.exports = function (ast) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var stringify = function stringify(node) {
                var parent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                var invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent);
                var invalidNode = node.invalid === true && options.escapeInvalid === true;
                var output = '';
                if (node.value) {
                  if ((invalidBlock || invalidNode) && utils.isOpenOrClose(node)) {
                    return '\\' + node.value;
                  }
                  return node.value;
                }
                if (node.value) {
                  return node.value;
                }
                if (node.nodes) {
                  var _iterator6 = _createForOfIteratorHelper(node.nodes),
                    _step6;
                  try {
                    for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
                      var child = _step6.value;
                      output += stringify(child);
                    }
                  } catch (err) {
                    _iterator6.e(err);
                  } finally {
                    _iterator6.f();
                  }
                }
                return output;
              };
              return stringify(ast);
            };

            /***/
          }),
          /***/305: ( /***/function _(__unused_webpack_module, exports) {
            "use strict";

            exports.isInteger = function (num) {
              if (typeof num === 'number') {
                return Number.isInteger(num);
              }
              if (typeof num === 'string' && num.trim() !== '') {
                return Number.isInteger(Number(num));
              }
              return false;
            };

            /**
             * Find a node of the given type
             */

            exports.find = function (node, type) {
              return node.nodes.find(function (node) {
                return node.type === type;
              });
            };

            /**
             * Find a node of the given type
             */

            exports.exceedsLimit = function (min, max) {
              var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
              var limit = arguments.length > 3 ? arguments[3] : undefined;
              if (limit === false) return false;
              if (!exports.isInteger(min) || !exports.isInteger(max)) return false;
              return (Number(max) - Number(min)) / Number(step) >= limit;
            };

            /**
             * Escape the given node with '\\' before node.value
             */

            exports.escapeNode = function (block) {
              var n = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
              var type = arguments.length > 2 ? arguments[2] : undefined;
              var node = block.nodes[n];
              if (!node) return;
              if (type && node.type === type || node.type === 'open' || node.type === 'close') {
                if (node.escaped !== true) {
                  node.value = '\\' + node.value;
                  node.escaped = true;
                }
              }
            };

            /**
             * Returns true if the given brace node should be enclosed in literal braces
             */

            exports.encloseBrace = function (node) {
              if (node.type !== 'brace') return false;
              if (node.commas >> 0 + node.ranges >> 0 === 0) {
                node.invalid = true;
                return true;
              }
              return false;
            };

            /**
             * Returns true if a brace node is invalid.
             */

            exports.isInvalidBrace = function (block) {
              if (block.type !== 'brace') return false;
              if (block.invalid === true || block.dollar) return true;
              if (block.commas >> 0 + block.ranges >> 0 === 0) {
                block.invalid = true;
                return true;
              }
              if (block.open !== true || block.close !== true) {
                block.invalid = true;
                return true;
              }
              return false;
            };

            /**
             * Returns true if a node is an open or close node
             */

            exports.isOpenOrClose = function (node) {
              if (node.type === 'open' || node.type === 'close') {
                return true;
              }
              return node.open === true || node.close === true;
            };

            /**
             * Reduce an array of text nodes.
             */

            exports.reduce = function (nodes) {
              return nodes.reduce(function (acc, node) {
                if (node.type === 'text') acc.push(node.value);
                if (node.type === 'range') node.type = 'text';
                return acc;
              }, []);
            };

            /**
             * Flatten an array
             */

            exports.flatten = function () {
              var result = [];
              var flat = function flat(arr) {
                for (var i = 0; i < arr.length; i++) {
                  var ele = arr[i];
                  Array.isArray(ele) ? flat(ele, result) : ele !== void 0 && result.push(ele);
                }
                return result;
              };
              for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
              }
              flat(args);
              return result;
            };

            /***/
          }),
          /***/924: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var GetIntrinsic = __webpack_require__(210);
            var callBind = __webpack_require__(559);
            var $indexOf = callBind(GetIntrinsic('String.prototype.indexOf'));
            module.exports = function callBoundIntrinsic(name, allowMissing) {
              var intrinsic = GetIntrinsic(name, !!allowMissing);
              if (typeof intrinsic === 'function' && $indexOf(name, '.prototype.') > -1) {
                return callBind(intrinsic);
              }
              return intrinsic;
            };

            /***/
          }),
          /***/559: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var bind = __webpack_require__(612);
            var GetIntrinsic = __webpack_require__(210);
            var setFunctionLength = __webpack_require__(771);
            var $TypeError = GetIntrinsic('%TypeError%');
            var $apply = GetIntrinsic('%Function.prototype.apply%');
            var $call = GetIntrinsic('%Function.prototype.call%');
            var $reflectApply = GetIntrinsic('%Reflect.apply%', true) || bind.call($call, $apply);
            var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
            var $max = GetIntrinsic('%Math.max%');
            if ($defineProperty) {
              try {
                $defineProperty({}, 'a', {
                  value: 1
                });
              } catch (e) {
                // IE 8 has a broken defineProperty
                $defineProperty = null;
              }
            }
            module.exports = function callBind(originalFunction) {
              if (typeof originalFunction !== 'function') {
                throw new $TypeError('a function is required');
              }
              var func = $reflectApply(bind, $call, arguments);
              return setFunctionLength(func, 1 + $max(0, originalFunction.length - (arguments.length - 1)), true);
            };
            var applyBind = function applyBind() {
              return $reflectApply(bind, $apply, arguments);
            };
            if ($defineProperty) {
              $defineProperty(module.exports, 'apply', {
                value: applyBind
              });
            } else {
              module.exports.apply = applyBind;
            }

            /***/
          }),
          /***/296: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var hasPropertyDescriptors = __webpack_require__(44)();
            var GetIntrinsic = __webpack_require__(210);
            var $defineProperty = hasPropertyDescriptors && GetIntrinsic('%Object.defineProperty%', true);
            if ($defineProperty) {
              try {
                $defineProperty({}, 'a', {
                  value: 1
                });
              } catch (e) {
                // IE 8 has a broken defineProperty
                $defineProperty = false;
              }
            }
            var $SyntaxError = GetIntrinsic('%SyntaxError%');
            var $TypeError = GetIntrinsic('%TypeError%');
            var gopd = __webpack_require__(275);

            /** @type {(obj: Record<PropertyKey, unknown>, property: PropertyKey, value: unknown, nonEnumerable?: boolean | null, nonWritable?: boolean | null, nonConfigurable?: boolean | null, loose?: boolean) => void} */
            module.exports = function defineDataProperty(obj, property, value) {
              if (!obj || typeof obj !== 'object' && typeof obj !== 'function') {
                throw new $TypeError('`obj` must be an object or a function`');
              }
              if (typeof property !== 'string' && typeof property !== 'symbol') {
                throw new $TypeError('`property` must be a string or a symbol`');
              }
              if (arguments.length > 3 && typeof arguments[3] !== 'boolean' && arguments[3] !== null) {
                throw new $TypeError('`nonEnumerable`, if provided, must be a boolean or null');
              }
              if (arguments.length > 4 && typeof arguments[4] !== 'boolean' && arguments[4] !== null) {
                throw new $TypeError('`nonWritable`, if provided, must be a boolean or null');
              }
              if (arguments.length > 5 && typeof arguments[5] !== 'boolean' && arguments[5] !== null) {
                throw new $TypeError('`nonConfigurable`, if provided, must be a boolean or null');
              }
              if (arguments.length > 6 && typeof arguments[6] !== 'boolean') {
                throw new $TypeError('`loose`, if provided, must be a boolean');
              }
              var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
              var nonWritable = arguments.length > 4 ? arguments[4] : null;
              var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
              var loose = arguments.length > 6 ? arguments[6] : false;

              /* @type {false | TypedPropertyDescriptor<unknown>} */
              var desc = !!gopd && gopd(obj, property);
              if ($defineProperty) {
                $defineProperty(obj, property, {
                  configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
                  enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
                  value: value,
                  writable: nonWritable === null && desc ? desc.writable : !nonWritable
                });
              } else if (loose || !nonEnumerable && !nonWritable && !nonConfigurable) {
                // must fall back to [[Set]], and was not explicitly asked to make non-enumerable, non-writable, or non-configurable
                obj[property] = value; // eslint-disable-line no-param-reassign
              } else {
                throw new $SyntaxError('This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.');
              }
            };

            /***/
          }),
          /***/664: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            /*!
             * fill-range <https://github.com/jonschlinkert/fill-range>
             *
             * Copyright (c) 2014-present, Jon Schlinkert.
             * Licensed under the MIT License.
             */
            var util = __webpack_require__(539);
            var toRegexRange = __webpack_require__(702);
            var isObject = function isObject(val) {
              return val !== null && typeof val === 'object' && !Array.isArray(val);
            };
            var transform = function transform(toNumber) {
              return function (value) {
                return toNumber === true ? Number(value) : String(value);
              };
            };
            var isValidValue = function isValidValue(value) {
              return typeof value === 'number' || typeof value === 'string' && value !== '';
            };
            var isNumber = function isNumber(num) {
              return Number.isInteger(+num);
            };
            var zeros = function zeros(input) {
              var value = "".concat(input);
              var index = -1;
              if (value[0] === '-') value = value.slice(1);
              if (value === '0') return false;
              while (value[++index] === '0');
              return index > 0;
            };
            var stringify = function stringify(start, end, options) {
              if (typeof start === 'string' || typeof end === 'string') {
                return true;
              }
              return options.stringify === true;
            };
            var pad = function pad(input, maxLength, toNumber) {
              if (maxLength > 0) {
                var dash = input[0] === '-' ? '-' : '';
                if (dash) input = input.slice(1);
                input = dash + input.padStart(dash ? maxLength - 1 : maxLength, '0');
              }
              if (toNumber === false) {
                return String(input);
              }
              return input;
            };
            var toMaxLen = function toMaxLen(input, maxLength) {
              var negative = input[0] === '-' ? '-' : '';
              if (negative) {
                input = input.slice(1);
                maxLength--;
              }
              while (input.length < maxLength) input = '0' + input;
              return negative ? '-' + input : input;
            };
            var toSequence = function toSequence(parts, options) {
              parts.negatives.sort(function (a, b) {
                return a < b ? -1 : a > b ? 1 : 0;
              });
              parts.positives.sort(function (a, b) {
                return a < b ? -1 : a > b ? 1 : 0;
              });
              var prefix = options.capture ? '' : '?:';
              var positives = '';
              var negatives = '';
              var result;
              if (parts.positives.length) {
                positives = parts.positives.join('|');
              }
              if (parts.negatives.length) {
                negatives = "-(".concat(prefix).concat(parts.negatives.join('|'), ")");
              }
              if (positives && negatives) {
                result = "".concat(positives, "|").concat(negatives);
              } else {
                result = positives || negatives;
              }
              if (options.wrap) {
                return "(".concat(prefix).concat(result, ")");
              }
              return result;
            };
            var toRange = function toRange(a, b, isNumbers, options) {
              if (isNumbers) {
                return toRegexRange(a, b, _objectSpread({
                  wrap: false
                }, options));
              }
              var start = String.fromCharCode(a);
              if (a === b) return start;
              var stop = String.fromCharCode(b);
              return "[".concat(start, "-").concat(stop, "]");
            };
            var toRegex = function toRegex(start, end, options) {
              if (Array.isArray(start)) {
                var wrap = options.wrap === true;
                var prefix = options.capture ? '' : '?:';
                return wrap ? "(".concat(prefix).concat(start.join('|'), ")") : start.join('|');
              }
              return toRegexRange(start, end, options);
            };
            var rangeError = function rangeError() {
              return new RangeError('Invalid range arguments: ' + util.inspect.apply(util, arguments));
            };
            var invalidRange = function invalidRange(start, end, options) {
              if (options.strictRanges === true) throw rangeError([start, end]);
              return [];
            };
            var invalidStep = function invalidStep(step, options) {
              if (options.strictRanges === true) {
                throw new TypeError("Expected step \"".concat(step, "\" to be a number"));
              }
              return [];
            };
            var fillNumbers = function fillNumbers(start, end) {
              var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
              var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
              var a = Number(start);
              var b = Number(end);
              if (!Number.isInteger(a) || !Number.isInteger(b)) {
                if (options.strictRanges === true) throw rangeError([start, end]);
                return [];
              }

              // fix negative zero
              if (a === 0) a = 0;
              if (b === 0) b = 0;
              var descending = a > b;
              var startString = String(start);
              var endString = String(end);
              var stepString = String(step);
              step = Math.max(Math.abs(step), 1);
              var padded = zeros(startString) || zeros(endString) || zeros(stepString);
              var maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0;
              var toNumber = padded === false && stringify(start, end, options) === false;
              var format = options.transform || transform(toNumber);
              if (options.toRegex && step === 1) {
                return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), true, options);
              }
              var parts = {
                negatives: [],
                positives: []
              };
              var push = function push(num) {
                return parts[num < 0 ? 'negatives' : 'positives'].push(Math.abs(num));
              };
              var range = [];
              var index = 0;
              while (descending ? a >= b : a <= b) {
                if (options.toRegex === true && step > 1) {
                  push(a);
                } else {
                  range.push(pad(format(a, index), maxLen, toNumber));
                }
                a = descending ? a - step : a + step;
                index++;
              }
              if (options.toRegex === true) {
                return step > 1 ? toSequence(parts, options) : toRegex(range, null, _objectSpread({
                  wrap: false
                }, options));
              }
              return range;
            };
            var fillLetters = function fillLetters(start, end) {
              var step = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
              var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
              if (!isNumber(start) && start.length > 1 || !isNumber(end) && end.length > 1) {
                return invalidRange(start, end, options);
              }
              var format = options.transform || function (val) {
                return String.fromCharCode(val);
              };
              var a = "".concat(start).charCodeAt(0);
              var b = "".concat(end).charCodeAt(0);
              var descending = a > b;
              var min = Math.min(a, b);
              var max = Math.max(a, b);
              if (options.toRegex && step === 1) {
                return toRange(min, max, false, options);
              }
              var range = [];
              var index = 0;
              while (descending ? a >= b : a <= b) {
                range.push(format(a, index));
                a = descending ? a - step : a + step;
                index++;
              }
              if (options.toRegex === true) {
                return toRegex(range, null, {
                  wrap: false,
                  options: options
                });
              }
              return range;
            };
            var fill = function fill(start, end, step) {
              var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
              if (end == null && isValidValue(start)) {
                return [start];
              }
              if (!isValidValue(start) || !isValidValue(end)) {
                return invalidRange(start, end, options);
              }
              if (typeof step === 'function') {
                return fill(start, end, 1, {
                  transform: step
                });
              }
              if (isObject(step)) {
                return fill(start, end, 0, step);
              }
              var opts = _objectSpread({}, options);
              if (opts.capture === true) opts.wrap = true;
              step = step || opts.step || 1;
              if (!isNumber(step)) {
                if (step != null && !isObject(step)) return invalidStep(step, opts);
                return fill(start, end, 1, step);
              }
              if (isNumber(start) && isNumber(end)) {
                return fillNumbers(start, end, step, opts);
              }
              return fillLetters(start, end, Math.max(Math.abs(step), 1), opts);
            };
            module.exports = fill;

            /***/
          }),
          /***/29: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var isCallable = __webpack_require__(320);
            var toStr = Object.prototype.toString;
            var hasOwnProperty = Object.prototype.hasOwnProperty;
            var forEachArray = function forEachArray(array, iterator, receiver) {
              for (var i = 0, len = array.length; i < len; i++) {
                if (hasOwnProperty.call(array, i)) {
                  if (receiver == null) {
                    iterator(array[i], i, array);
                  } else {
                    iterator.call(receiver, array[i], i, array);
                  }
                }
              }
            };
            var forEachString = function forEachString(string, iterator, receiver) {
              for (var i = 0, len = string.length; i < len; i++) {
                // no such thing as a sparse string.
                if (receiver == null) {
                  iterator(string.charAt(i), i, string);
                } else {
                  iterator.call(receiver, string.charAt(i), i, string);
                }
              }
            };
            var forEachObject = function forEachObject(object, iterator, receiver) {
              for (var k in object) {
                if (hasOwnProperty.call(object, k)) {
                  if (receiver == null) {
                    iterator(object[k], k, object);
                  } else {
                    iterator.call(receiver, object[k], k, object);
                  }
                }
              }
            };
            var forEach = function forEach(list, iterator, thisArg) {
              if (!isCallable(iterator)) {
                throw new TypeError('iterator must be a function');
              }
              var receiver;
              if (arguments.length >= 3) {
                receiver = thisArg;
              }
              if (toStr.call(list) === '[object Array]') {
                forEachArray(list, iterator, receiver);
              } else if (typeof list === 'string') {
                forEachString(list, iterator, receiver);
              } else {
                forEachObject(list, iterator, receiver);
              }
            };
            module.exports = forEach;

            /***/
          }),
          /***/648: ( /***/function _(module) {
            "use strict";

            /* eslint no-invalid-this: 1 */
            var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
            var toStr = Object.prototype.toString;
            var max = Math.max;
            var funcType = '[object Function]';
            var concatty = function concatty(a, b) {
              var arr = [];
              for (var i = 0; i < a.length; i += 1) {
                arr[i] = a[i];
              }
              for (var j = 0; j < b.length; j += 1) {
                arr[j + a.length] = b[j];
              }
              return arr;
            };
            var slicy = function slicy(arrLike, offset) {
              var arr = [];
              for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
                arr[j] = arrLike[i];
              }
              return arr;
            };
            var joiny = function joiny(arr, joiner) {
              var str = '';
              for (var i = 0; i < arr.length; i += 1) {
                str += arr[i];
                if (i + 1 < arr.length) {
                  str += joiner;
                }
              }
              return str;
            };
            module.exports = function bind(that) {
              var target = this;
              if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
                throw new TypeError(ERROR_MESSAGE + target);
              }
              var args = slicy(arguments, 1);
              var bound;
              var binder = function binder() {
                if (this instanceof bound) {
                  var result = target.apply(this, concatty(args, arguments));
                  if (Object(result) === result) {
                    return result;
                  }
                  return this;
                }
                return target.apply(that, concatty(args, arguments));
              };
              var boundLength = max(0, target.length - args.length);
              var boundArgs = [];
              for (var i = 0; i < boundLength; i++) {
                boundArgs[i] = '$' + i;
              }
              bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);
              if (target.prototype) {
                var Empty = function Empty() {};
                Empty.prototype = target.prototype;
                bound.prototype = new Empty();
                Empty.prototype = null;
              }
              return bound;
            };

            /***/
          }),
          /***/612: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var implementation = __webpack_require__(648);
            module.exports = Function.prototype.bind || implementation;

            /***/
          }),
          /***/210: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var undefined;
            var $SyntaxError = SyntaxError;
            var $Function = Function;
            var $TypeError = TypeError;

            // eslint-disable-next-line consistent-return
            var getEvalledConstructor = function getEvalledConstructor(expressionSyntax) {
              try {
                return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
              } catch (e) {}
            };
            var $gOPD = Object.getOwnPropertyDescriptor;
            if ($gOPD) {
              try {
                $gOPD({}, '');
              } catch (e) {
                $gOPD = null; // this is IE 8, which has a broken gOPD
              }
            }
            var throwTypeError = function throwTypeError() {
              throw new $TypeError();
            };
            var ThrowTypeError = $gOPD ? function () {
              try {
                // eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
                arguments.callee; // IE 8 does not throw here
                return throwTypeError;
              } catch (calleeThrows) {
                try {
                  // IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
                  return $gOPD(arguments, 'callee').get;
                } catch (gOPDthrows) {
                  return throwTypeError;
                }
              }
            }() : throwTypeError;
            var hasSymbols = __webpack_require__(405)();
            var hasProto = __webpack_require__(185)();
            var getProto = Object.getPrototypeOf || (hasProto ? function (x) {
              return x.__proto__;
            } // eslint-disable-line no-proto
            : null);
            var needsEval = {};
            var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined : getProto(Uint8Array);
            var INTRINSICS = {
              '%AggregateError%': typeof AggregateError === 'undefined' ? undefined : AggregateError,
              '%Array%': Array,
              '%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
              '%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined,
              '%AsyncFromSyncIteratorPrototype%': undefined,
              '%AsyncFunction%': needsEval,
              '%AsyncGenerator%': needsEval,
              '%AsyncGeneratorFunction%': needsEval,
              '%AsyncIteratorPrototype%': needsEval,
              '%Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
              '%BigInt%': typeof BigInt === 'undefined' ? undefined : BigInt,
              '%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined : BigInt64Array,
              '%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined : BigUint64Array,
              '%Boolean%': Boolean,
              '%DataView%': typeof DataView === 'undefined' ? undefined : DataView,
              '%Date%': Date,
              '%decodeURI%': decodeURI,
              '%decodeURIComponent%': decodeURIComponent,
              '%encodeURI%': encodeURI,
              '%encodeURIComponent%': encodeURIComponent,
              '%Error%': Error,
              '%eval%': eval,
              // eslint-disable-line no-eval
              '%EvalError%': EvalError,
              '%Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
              '%Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
              '%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined : FinalizationRegistry,
              '%Function%': $Function,
              '%GeneratorFunction%': needsEval,
              '%Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
              '%Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
              '%Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
              '%isFinite%': isFinite,
              '%isNaN%': isNaN,
              '%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined,
              '%JSON%': typeof JSON === 'object' ? JSON : undefined,
              '%Map%': typeof Map === 'undefined' ? undefined : Map,
              '%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Map()[Symbol.iterator]()),
              '%Math%': Math,
              '%Number%': Number,
              '%Object%': Object,
              '%parseFloat%': parseFloat,
              '%parseInt%': parseInt,
              '%Promise%': typeof Promise === 'undefined' ? undefined : Promise,
              '%Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
              '%RangeError%': RangeError,
              '%ReferenceError%': ReferenceError,
              '%Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
              '%RegExp%': RegExp,
              '%Set%': typeof Set === 'undefined' ? undefined : Set,
              '%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Set()[Symbol.iterator]()),
              '%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
              '%String%': String,
              '%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined,
              '%Symbol%': hasSymbols ? Symbol : undefined,
              '%SyntaxError%': $SyntaxError,
              '%ThrowTypeError%': ThrowTypeError,
              '%TypedArray%': TypedArray,
              '%TypeError%': $TypeError,
              '%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
              '%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
              '%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
              '%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
              '%URIError%': URIError,
              '%WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
              '%WeakRef%': typeof WeakRef === 'undefined' ? undefined : WeakRef,
              '%WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet
            };
            if (getProto) {
              try {
                null.error; // eslint-disable-line no-unused-expressions
              } catch (e) {
                // https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
                var errorProto = getProto(getProto(e));
                INTRINSICS['%Error.prototype%'] = errorProto;
              }
            }
            var doEval = function doEval(name) {
              var value;
              if (name === '%AsyncFunction%') {
                value = getEvalledConstructor('async function () {}');
              } else if (name === '%GeneratorFunction%') {
                value = getEvalledConstructor('function* () {}');
              } else if (name === '%AsyncGeneratorFunction%') {
                value = getEvalledConstructor('async function* () {}');
              } else if (name === '%AsyncGenerator%') {
                var fn = doEval('%AsyncGeneratorFunction%');
                if (fn) {
                  value = fn.prototype;
                }
              } else if (name === '%AsyncIteratorPrototype%') {
                var gen = doEval('%AsyncGenerator%');
                if (gen && getProto) {
                  value = getProto(gen.prototype);
                }
              }
              INTRINSICS[name] = value;
              return value;
            };
            var LEGACY_ALIASES = {
              '%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
              '%ArrayPrototype%': ['Array', 'prototype'],
              '%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
              '%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
              '%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
              '%ArrayProto_values%': ['Array', 'prototype', 'values'],
              '%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
              '%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
              '%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
              '%BooleanPrototype%': ['Boolean', 'prototype'],
              '%DataViewPrototype%': ['DataView', 'prototype'],
              '%DatePrototype%': ['Date', 'prototype'],
              '%ErrorPrototype%': ['Error', 'prototype'],
              '%EvalErrorPrototype%': ['EvalError', 'prototype'],
              '%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
              '%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
              '%FunctionPrototype%': ['Function', 'prototype'],
              '%Generator%': ['GeneratorFunction', 'prototype'],
              '%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
              '%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
              '%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
              '%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
              '%JSONParse%': ['JSON', 'parse'],
              '%JSONStringify%': ['JSON', 'stringify'],
              '%MapPrototype%': ['Map', 'prototype'],
              '%NumberPrototype%': ['Number', 'prototype'],
              '%ObjectPrototype%': ['Object', 'prototype'],
              '%ObjProto_toString%': ['Object', 'prototype', 'toString'],
              '%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
              '%PromisePrototype%': ['Promise', 'prototype'],
              '%PromiseProto_then%': ['Promise', 'prototype', 'then'],
              '%Promise_all%': ['Promise', 'all'],
              '%Promise_reject%': ['Promise', 'reject'],
              '%Promise_resolve%': ['Promise', 'resolve'],
              '%RangeErrorPrototype%': ['RangeError', 'prototype'],
              '%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
              '%RegExpPrototype%': ['RegExp', 'prototype'],
              '%SetPrototype%': ['Set', 'prototype'],
              '%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
              '%StringPrototype%': ['String', 'prototype'],
              '%SymbolPrototype%': ['Symbol', 'prototype'],
              '%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
              '%TypedArrayPrototype%': ['TypedArray', 'prototype'],
              '%TypeErrorPrototype%': ['TypeError', 'prototype'],
              '%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
              '%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
              '%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
              '%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
              '%URIErrorPrototype%': ['URIError', 'prototype'],
              '%WeakMapPrototype%': ['WeakMap', 'prototype'],
              '%WeakSetPrototype%': ['WeakSet', 'prototype']
            };
            var bind = __webpack_require__(612);
            var hasOwn = __webpack_require__(824);
            var $concat = bind.call(Function.call, Array.prototype.concat);
            var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
            var $replace = bind.call(Function.call, String.prototype.replace);
            var $strSlice = bind.call(Function.call, String.prototype.slice);
            var $exec = bind.call(Function.call, RegExp.prototype.exec);

            /* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */
            var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
            var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */
            var stringToPath = function stringToPath(string) {
              var first = $strSlice(string, 0, 1);
              var last = $strSlice(string, -1);
              if (first === '%' && last !== '%') {
                throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
              } else if (last === '%' && first !== '%') {
                throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
              }
              var result = [];
              $replace(string, rePropName, function (match, number, quote, subString) {
                result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
              });
              return result;
            };
            /* end adaptation */

            var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
              var intrinsicName = name;
              var alias;
              if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
                alias = LEGACY_ALIASES[intrinsicName];
                intrinsicName = '%' + alias[0] + '%';
              }
              if (hasOwn(INTRINSICS, intrinsicName)) {
                var value = INTRINSICS[intrinsicName];
                if (value === needsEval) {
                  value = doEval(intrinsicName);
                }
                if (typeof value === 'undefined' && !allowMissing) {
                  throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
                }
                return {
                  alias: alias,
                  name: intrinsicName,
                  value: value
                };
              }
              throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
            };
            module.exports = function GetIntrinsic(name, allowMissing) {
              if (typeof name !== 'string' || name.length === 0) {
                throw new $TypeError('intrinsic name must be a non-empty string');
              }
              if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
                throw new $TypeError('"allowMissing" argument must be a boolean');
              }
              if ($exec(/^%?[^%]*%?$/, name) === null) {
                throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
              }
              var parts = stringToPath(name);
              var intrinsicBaseName = parts.length > 0 ? parts[0] : '';
              var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
              var intrinsicRealName = intrinsic.name;
              var value = intrinsic.value;
              var skipFurtherCaching = false;
              var alias = intrinsic.alias;
              if (alias) {
                intrinsicBaseName = alias[0];
                $spliceApply(parts, $concat([0, 1], alias));
              }
              for (var i = 1, isOwn = true; i < parts.length; i += 1) {
                var part = parts[i];
                var first = $strSlice(part, 0, 1);
                var last = $strSlice(part, -1);
                if ((first === '"' || first === "'" || first === '`' || last === '"' || last === "'" || last === '`') && first !== last) {
                  throw new $SyntaxError('property names with quotes must have matching quotes');
                }
                if (part === 'constructor' || !isOwn) {
                  skipFurtherCaching = true;
                }
                intrinsicBaseName += '.' + part;
                intrinsicRealName = '%' + intrinsicBaseName + '%';
                if (hasOwn(INTRINSICS, intrinsicRealName)) {
                  value = INTRINSICS[intrinsicRealName];
                } else if (value != null) {
                  if (!(part in value)) {
                    if (!allowMissing) {
                      throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
                    }
                    return void undefined;
                  }
                  if ($gOPD && i + 1 >= parts.length) {
                    var desc = $gOPD(value, part);
                    isOwn = !!desc;

                    // By convention, when a data property is converted to an accessor
                    // property to emulate a data property that does not suffer from
                    // the override mistake, that accessor's getter is marked with
                    // an `originalValue` property. Here, when we detect this, we
                    // uphold the illusion by pretending to see that original data
                    // property, i.e., returning the value rather than the getter
                    // itself.
                    if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
                      value = desc.get;
                    } else {
                      value = value[part];
                    }
                  } else {
                    isOwn = hasOwn(value, part);
                    value = value[part];
                  }
                  if (isOwn && !skipFurtherCaching) {
                    INTRINSICS[intrinsicRealName] = value;
                  }
                }
              }
              return value;
            };

            /***/
          }),
          /***/275: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var GetIntrinsic = __webpack_require__(210);
            var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%', true);
            if ($gOPD) {
              try {
                $gOPD([], 'length');
              } catch (e) {
                // IE 8 has a broken gOPD
                $gOPD = null;
              }
            }
            module.exports = $gOPD;

            /***/
          }),
          /***/44: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var GetIntrinsic = __webpack_require__(210);
            var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
            var hasPropertyDescriptors = function hasPropertyDescriptors() {
              if ($defineProperty) {
                try {
                  $defineProperty({}, 'a', {
                    value: 1
                  });
                  return true;
                } catch (e) {
                  // IE 8 has a broken defineProperty
                  return false;
                }
              }
              return false;
            };
            hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
              // node v0.6 has a bug where array lengths can be Set but not Defined
              if (!hasPropertyDescriptors()) {
                return null;
              }
              try {
                return $defineProperty([], 'length', {
                  value: 1
                }).length !== 1;
              } catch (e) {
                // In Firefox 4-22, defining length on an array throws an exception.
                return true;
              }
            };
            module.exports = hasPropertyDescriptors;

            /***/
          }),
          /***/185: ( /***/function _(module) {
            "use strict";

            var test = {
              foo: {}
            };
            var $Object = Object;
            module.exports = function hasProto() {
              return {
                __proto__: test
              }.foo === test.foo && !({
                __proto__: null
              } instanceof $Object);
            };

            /***/
          }),
          /***/405: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var origSymbol = typeof Symbol !== 'undefined' && Symbol;
            var hasSymbolSham = __webpack_require__(419);
            module.exports = function hasNativeSymbols() {
              if (typeof origSymbol !== 'function') {
                return false;
              }
              if (typeof Symbol !== 'function') {
                return false;
              }
              if (typeof origSymbol('foo') !== 'symbol') {
                return false;
              }
              if (typeof Symbol('bar') !== 'symbol') {
                return false;
              }
              return hasSymbolSham();
            };

            /***/
          }),
          /***/419: ( /***/function _(module) {
            "use strict";

            /* eslint complexity: [2, 18], max-statements: [2, 33] */
            module.exports = function hasSymbols() {
              if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') {
                return false;
              }
              if (typeof Symbol.iterator === 'symbol') {
                return true;
              }
              var obj = {};
              var sym = Symbol('test');
              var symObj = Object(sym);
              if (typeof sym === 'string') {
                return false;
              }
              if (Object.prototype.toString.call(sym) !== '[object Symbol]') {
                return false;
              }
              if (Object.prototype.toString.call(symObj) !== '[object Symbol]') {
                return false;
              }

              // temp disabled per https://github.com/ljharb/object.assign/issues/17
              // if (sym instanceof Symbol) { return false; }
              // temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
              // if (!(symObj instanceof Symbol)) { return false; }

              // if (typeof Symbol.prototype.toString !== 'function') { return false; }
              // if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }

              var symVal = 42;
              obj[sym] = symVal;
              for (sym in obj) {
                return false;
              } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
              if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) {
                return false;
              }
              if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) {
                return false;
              }
              var syms = Object.getOwnPropertySymbols(obj);
              if (syms.length !== 1 || syms[0] !== sym) {
                return false;
              }
              if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
                return false;
              }
              if (typeof Object.getOwnPropertyDescriptor === 'function') {
                var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
                if (descriptor.value !== symVal || descriptor.enumerable !== true) {
                  return false;
                }
              }
              return true;
            };

            /***/
          }),
          /***/410: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var hasSymbols = __webpack_require__(419);
            module.exports = function hasToStringTagShams() {
              return hasSymbols() && !!Symbol.toStringTag;
            };

            /***/
          }),
          /***/824: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var call = Function.prototype.call;
            var $hasOwn = Object.prototype.hasOwnProperty;
            var bind = __webpack_require__(612);

            /** @type {(o: {}, p: PropertyKey) => p is keyof o} */
            module.exports = bind.call(call, $hasOwn);

            /***/
          }),
          /***/717: ( /***/function _(module) {
            if (typeof Object.create === 'function') {
              // implementation from standard node.js 'util' module
              module.exports = function inherits(ctor, superCtor) {
                if (superCtor) {
                  ctor.super_ = superCtor;
                  ctor.prototype = Object.create(superCtor.prototype, {
                    constructor: {
                      value: ctor,
                      enumerable: false,
                      writable: true,
                      configurable: true
                    }
                  });
                }
              };
            } else {
              // old school shim for old browsers
              module.exports = function inherits(ctor, superCtor) {
                if (superCtor) {
                  ctor.super_ = superCtor;
                  var TempCtor = function TempCtor() {};
                  TempCtor.prototype = superCtor.prototype;
                  ctor.prototype = new TempCtor();
                  ctor.prototype.constructor = ctor;
                }
              };
            }

            /***/
          }),
          /***/584: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var hasToStringTag = __webpack_require__(410)();
            var callBound = __webpack_require__(924);
            var $toString = callBound('Object.prototype.toString');
            var isStandardArguments = function isArguments(value) {
              if (hasToStringTag && value && typeof value === 'object' && Symbol.toStringTag in value) {
                return false;
              }
              return $toString(value) === '[object Arguments]';
            };
            var isLegacyArguments = function isArguments(value) {
              if (isStandardArguments(value)) {
                return true;
              }
              return value !== null && typeof value === 'object' && typeof value.length === 'number' && value.length >= 0 && $toString(value) !== '[object Array]' && $toString(value.callee) === '[object Function]';
            };
            var supportsStandardArguments = function () {
              return isStandardArguments(arguments);
            }();
            isStandardArguments.isLegacyArguments = isLegacyArguments; // for tests

            module.exports = supportsStandardArguments ? isStandardArguments : isLegacyArguments;

            /***/
          }),
          /***/320: ( /***/function _(module) {
            "use strict";

            var fnToStr = Function.prototype.toString;
            var reflectApply = typeof Reflect === 'object' && Reflect !== null && Reflect.apply;
            var badArrayLike;
            var isCallableMarker;
            if (typeof reflectApply === 'function' && typeof Object.defineProperty === 'function') {
              try {
                badArrayLike = Object.defineProperty({}, 'length', {
                  get: function get() {
                    throw isCallableMarker;
                  }
                });
                isCallableMarker = {};
                // eslint-disable-next-line no-throw-literal
                reflectApply(function () {
                  throw 42;
                }, null, badArrayLike);
              } catch (_) {
                if (_ !== isCallableMarker) {
                  reflectApply = null;
                }
              }
            } else {
              reflectApply = null;
            }
            var constructorRegex = /^\s*class\b/;
            var isES6ClassFn = function isES6ClassFunction(value) {
              try {
                var fnStr = fnToStr.call(value);
                return constructorRegex.test(fnStr);
              } catch (e) {
                return false; // not a function
              }
            };
            var tryFunctionObject = function tryFunctionToStr(value) {
              try {
                if (isES6ClassFn(value)) {
                  return false;
                }
                fnToStr.call(value);
                return true;
              } catch (e) {
                return false;
              }
            };
            var toStr = Object.prototype.toString;
            var objectClass = '[object Object]';
            var fnClass = '[object Function]';
            var genClass = '[object GeneratorFunction]';
            var ddaClass = '[object HTMLAllCollection]'; // IE 11
            var ddaClass2 = '[object HTML document.all class]';
            var ddaClass3 = '[object HTMLCollection]'; // IE 9-10
            var hasToStringTag = typeof Symbol === 'function' && !!Symbol.toStringTag; // better: use `has-tostringtag`

            var isIE68 = !(0 in [,]); // eslint-disable-line no-sparse-arrays, comma-spacing

            var isDDA = function isDocumentDotAll() {
              return false;
            };
            if (typeof document === 'object') {
              // Firefox 3 canonicalizes DDA to undefined when it's not accessed directly
              var all = document.all;
              if (toStr.call(all) === toStr.call(document.all)) {
                isDDA = function isDocumentDotAll(value) {
                  /* globals document: false */
                  // in IE 6-8, typeof document.all is "object" and it's truthy
                  if ((isIE68 || !value) && (typeof value === 'undefined' || typeof value === 'object')) {
                    try {
                      var str = toStr.call(value);
                      return (str === ddaClass || str === ddaClass2 || str === ddaClass3 // opera 12.16
                      || str === objectClass // IE 6-8
                      ) && value('') == null; // eslint-disable-line eqeqeq
                    } catch (e) {/**/}
                  }
                  return false;
                };
              }
            }
            module.exports = reflectApply ? function isCallable(value) {
              if (isDDA(value)) {
                return true;
              }
              if (!value) {
                return false;
              }
              if (typeof value !== 'function' && typeof value !== 'object') {
                return false;
              }
              try {
                reflectApply(value, null, badArrayLike);
              } catch (e) {
                if (e !== isCallableMarker) {
                  return false;
                }
              }
              return !isES6ClassFn(value) && tryFunctionObject(value);
            } : function isCallable(value) {
              if (isDDA(value)) {
                return true;
              }
              if (!value) {
                return false;
              }
              if (typeof value !== 'function' && typeof value !== 'object') {
                return false;
              }
              if (hasToStringTag) {
                return tryFunctionObject(value);
              }
              if (isES6ClassFn(value)) {
                return false;
              }
              var strClass = toStr.call(value);
              if (strClass !== fnClass && strClass !== genClass && !/^\[object HTML/.test(strClass)) {
                return false;
              }
              return tryFunctionObject(value);
            };

            /***/
          }),
          /***/662: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var toStr = Object.prototype.toString;
            var fnToStr = Function.prototype.toString;
            var isFnRegex = /^\s*(?:function)?\*/;
            var hasToStringTag = __webpack_require__(410)();
            var getProto = Object.getPrototypeOf;
            var getGeneratorFunc = function getGeneratorFunc() {
              // eslint-disable-line consistent-return
              if (!hasToStringTag) {
                return false;
              }
              try {
                return Function('return function*() {}')();
              } catch (e) {}
            };
            var GeneratorFunction;
            module.exports = function isGeneratorFunction(fn) {
              if (typeof fn !== 'function') {
                return false;
              }
              if (isFnRegex.test(fnToStr.call(fn))) {
                return true;
              }
              if (!hasToStringTag) {
                var str = toStr.call(fn);
                return str === '[object GeneratorFunction]';
              }
              if (!getProto) {
                return false;
              }
              if (typeof GeneratorFunction === 'undefined') {
                var generatorFunc = getGeneratorFunc();
                GeneratorFunction = generatorFunc ? getProto(generatorFunc) : false;
              }
              return getProto(fn) === GeneratorFunction;
            };

            /***/
          }),
          /***/130: ( /***/function _(module) {
            "use strict";

            /*!
             * is-number <https://github.com/jonschlinkert/is-number>
             *
             * Copyright (c) 2014-present, Jon Schlinkert.
             * Released under the MIT License.
             */
            module.exports = function (num) {
              if (typeof num === 'number') {
                return num - num === 0;
              }
              if (typeof num === 'string' && num.trim() !== '') {
                return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
              }
              return false;
            };

            /***/
          }),
          /***/692: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var whichTypedArray = __webpack_require__(430);
            module.exports = function isTypedArray(value) {
              return !!whichTypedArray(value);
            };

            /***/
          }),
          /***/850: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var util = __webpack_require__(539);
            var braces = __webpack_require__(744);
            var picomatch = __webpack_require__(444);
            var utils = __webpack_require__(371);
            var isEmptyString = function isEmptyString(val) {
              return val === '' || val === './';
            };

            /**
             * Returns an array of strings that match one or more glob patterns.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm(list, patterns[, options]);
             *
             * console.log(mm(['a.js', 'a.txt'], ['*.js']));
             * //=> [ 'a.js' ]
             * ```
             * @param {String|Array<string>} `list` List of strings to match.
             * @param {String|Array<string>} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `options` See available [options](#options)
             * @return {Array} Returns an array of matches
             * @summary false
             * @api public
             */

            var micromatch = function micromatch(list, patterns, options) {
              patterns = [].concat(patterns);
              list = [].concat(list);
              var omit = new Set();
              var keep = new Set();
              var items = new Set();
              var negatives = 0;
              var onResult = function onResult(state) {
                items.add(state.output);
                if (options && options.onResult) {
                  options.onResult(state);
                }
              };
              for (var i = 0; i < patterns.length; i++) {
                var isMatch = picomatch(String(patterns[i]), _objectSpread(_objectSpread({}, options), {}, {
                  onResult: onResult
                }), true);
                var negated = isMatch.state.negated || isMatch.state.negatedExtglob;
                if (negated) negatives++;
                var _iterator7 = _createForOfIteratorHelper(list),
                  _step7;
                try {
                  for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
                    var item = _step7.value;
                    var matched = isMatch(item, true);
                    var match = negated ? !matched.isMatch : matched.isMatch;
                    if (!match) continue;
                    if (negated) {
                      omit.add(matched.output);
                    } else {
                      omit.delete(matched.output);
                      keep.add(matched.output);
                    }
                  }
                } catch (err) {
                  _iterator7.e(err);
                } finally {
                  _iterator7.f();
                }
              }
              var result = negatives === patterns.length ? _toConsumableArray(items) : _toConsumableArray(keep);
              var matches = result.filter(function (item) {
                return !omit.has(item);
              });
              if (options && matches.length === 0) {
                if (options.failglob === true) {
                  throw new Error("No matches found for \"".concat(patterns.join(', '), "\""));
                }
                if (options.nonull === true || options.nullglob === true) {
                  return options.unescape ? patterns.map(function (p) {
                    return p.replace(/\\/g, '');
                  }) : patterns;
                }
              }
              return matches;
            };

            /**
             * Backwards compatibility
             */

            micromatch.match = micromatch;

            /**
             * Returns a matcher function from the given glob `pattern` and `options`.
             * The returned function takes a string to match as its only argument and returns
             * true if the string is a match.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.matcher(pattern[, options]);
             *
             * const isMatch = mm.matcher('*.!(*a)');
             * console.log(isMatch('a.a')); //=> false
             * console.log(isMatch('a.b')); //=> true
             * ```
             * @param {String} `pattern` Glob pattern
             * @param {Object} `options`
             * @return {Function} Returns a matcher function.
             * @api public
             */

            micromatch.matcher = function (pattern, options) {
              return picomatch(pattern, options);
            };

            /**
             * Returns true if **any** of the given glob `patterns` match the specified `string`.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.isMatch(string, patterns[, options]);
             *
             * console.log(mm.isMatch('a.a', ['b.*', '*.a'])); //=> true
             * console.log(mm.isMatch('a.a', 'b.*')); //=> false
             * ```
             * @param {String} `str` The string to test.
             * @param {String|Array} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `[options]` See available [options](#options).
             * @return {Boolean} Returns true if any patterns match `str`
             * @api public
             */

            micromatch.isMatch = function (str, patterns, options) {
              return picomatch(patterns, options)(str);
            };

            /**
             * Backwards compatibility
             */

            micromatch.any = micromatch.isMatch;

            /**
             * Returns a list of strings that _**do not match any**_ of the given `patterns`.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.not(list, patterns[, options]);
             *
             * console.log(mm.not(['a.a', 'b.b', 'c.c'], '*.a'));
             * //=> ['b.b', 'c.c']
             * ```
             * @param {Array} `list` Array of strings to match.
             * @param {String|Array} `patterns` One or more glob pattern to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Array} Returns an array of strings that **do not match** the given patterns.
             * @api public
             */

            micromatch.not = function (list, patterns) {
              var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
              patterns = [].concat(patterns).map(String);
              var result = new Set();
              var items = [];
              var onResult = function onResult(state) {
                if (options.onResult) options.onResult(state);
                items.push(state.output);
              };
              var matches = new Set(micromatch(list, patterns, _objectSpread(_objectSpread({}, options), {}, {
                onResult: onResult
              })));
              for (var _i = 0, _items = items; _i < _items.length; _i++) {
                var item = _items[_i];
                if (!matches.has(item)) {
                  result.add(item);
                }
              }
              return _toConsumableArray(result);
            };

            /**
             * Returns true if the given `string` contains the given pattern. Similar
             * to [.isMatch](#isMatch) but the pattern can match any part of the string.
             *
             * ```js
             * var mm = require('micromatch');
             * // mm.contains(string, pattern[, options]);
             *
             * console.log(mm.contains('aa/bb/cc', '*b'));
             * //=> true
             * console.log(mm.contains('aa/bb/cc', '*d'));
             * //=> false
             * ```
             * @param {String} `str` The string to match.
             * @param {String|Array} `patterns` Glob pattern to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Boolean} Returns true if any of the patterns matches any part of `str`.
             * @api public
             */

            micromatch.contains = function (str, pattern, options) {
              if (typeof str !== 'string') {
                throw new TypeError("Expected a string: \"".concat(util.inspect(str), "\""));
              }
              if (Array.isArray(pattern)) {
                return pattern.some(function (p) {
                  return micromatch.contains(str, p, options);
                });
              }
              if (typeof pattern === 'string') {
                if (isEmptyString(str) || isEmptyString(pattern)) {
                  return false;
                }
                if (str.includes(pattern) || str.startsWith('./') && str.slice(2).includes(pattern)) {
                  return true;
                }
              }
              return micromatch.isMatch(str, pattern, _objectSpread(_objectSpread({}, options), {}, {
                contains: true
              }));
            };

            /**
             * Filter the keys of the given object with the given `glob` pattern
             * and `options`. Does not attempt to match nested keys. If you need this feature,
             * use [glob-object][] instead.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.matchKeys(object, patterns[, options]);
             *
             * const obj = { aa: 'a', ab: 'b', ac: 'c' };
             * console.log(mm.matchKeys(obj, '*b'));
             * //=> { ab: 'b' }
             * ```
             * @param {Object} `object` The object with keys to filter.
             * @param {String|Array} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Object} Returns an object with only keys that match the given patterns.
             * @api public
             */

            micromatch.matchKeys = function (obj, patterns, options) {
              if (!utils.isObject(obj)) {
                throw new TypeError('Expected the first argument to be an object');
              }
              var keys = micromatch(Object.keys(obj), patterns, options);
              var res = {};
              var _iterator8 = _createForOfIteratorHelper(keys),
                _step8;
              try {
                for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
                  var key = _step8.value;
                  res[key] = obj[key];
                }
              } catch (err) {
                _iterator8.e(err);
              } finally {
                _iterator8.f();
              }
              return res;
            };

            /**
             * Returns true if some of the strings in the given `list` match any of the given glob `patterns`.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.some(list, patterns[, options]);
             *
             * console.log(mm.some(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
             * // true
             * console.log(mm.some(['foo.js'], ['*.js', '!foo.js']));
             * // false
             * ```
             * @param {String|Array} `list` The string or array of strings to test. Returns as soon as the first match is found.
             * @param {String|Array} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Boolean} Returns true if any `patterns` matches any of the strings in `list`
             * @api public
             */

            micromatch.some = function (list, patterns, options) {
              var items = [].concat(list);
              var _iterator9 = _createForOfIteratorHelper([].concat(patterns)),
                _step9;
              try {
                var _loop = function _loop() {
                    var pattern = _step9.value;
                    var isMatch = picomatch(String(pattern), options);
                    if (items.some(function (item) {
                      return isMatch(item);
                    })) {
                      return {
                        v: true
                      };
                    }
                  },
                  _ret;
                for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
                  _ret = _loop();
                  if (_ret) return _ret.v;
                }
              } catch (err) {
                _iterator9.e(err);
              } finally {
                _iterator9.f();
              }
              return false;
            };

            /**
             * Returns true if every string in the given `list` matches
             * any of the given glob `patterns`.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.every(list, patterns[, options]);
             *
             * console.log(mm.every('foo.js', ['foo.js']));
             * // true
             * console.log(mm.every(['foo.js', 'bar.js'], ['*.js']));
             * // true
             * console.log(mm.every(['foo.js', 'bar.js'], ['*.js', '!foo.js']));
             * // false
             * console.log(mm.every(['foo.js'], ['*.js', '!foo.js']));
             * // false
             * ```
             * @param {String|Array} `list` The string or array of strings to test.
             * @param {String|Array} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Boolean} Returns true if all `patterns` matches all of the strings in `list`
             * @api public
             */

            micromatch.every = function (list, patterns, options) {
              var items = [].concat(list);
              var _iterator10 = _createForOfIteratorHelper([].concat(patterns)),
                _step10;
              try {
                var _loop2 = function _loop2() {
                    var pattern = _step10.value;
                    var isMatch = picomatch(String(pattern), options);
                    if (!items.every(function (item) {
                      return isMatch(item);
                    })) {
                      return {
                        v: false
                      };
                    }
                  },
                  _ret2;
                for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
                  _ret2 = _loop2();
                  if (_ret2) return _ret2.v;
                }
              } catch (err) {
                _iterator10.e(err);
              } finally {
                _iterator10.f();
              }
              return true;
            };

            /**
             * Returns true if **all** of the given `patterns` match
             * the specified string.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.all(string, patterns[, options]);
             *
             * console.log(mm.all('foo.js', ['foo.js']));
             * // true
             *
             * console.log(mm.all('foo.js', ['*.js', '!foo.js']));
             * // false
             *
             * console.log(mm.all('foo.js', ['*.js', 'foo.js']));
             * // true
             *
             * console.log(mm.all('foo.js', ['*.js', 'f*', '*o*', '*o.js']));
             * // true
             * ```
             * @param {String|Array} `str` The string to test.
             * @param {String|Array} `patterns` One or more glob patterns to use for matching.
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Boolean} Returns true if any patterns match `str`
             * @api public
             */

            micromatch.all = function (str, patterns, options) {
              if (typeof str !== 'string') {
                throw new TypeError("Expected a string: \"".concat(util.inspect(str), "\""));
              }
              return [].concat(patterns).every(function (p) {
                return picomatch(p, options)(str);
              });
            };

            /**
             * Returns an array of matches captured by `pattern` in `string, or `null` if the pattern did not match.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.capture(pattern, string[, options]);
             *
             * console.log(mm.capture('test/*.js', 'test/foo.js'));
             * //=> ['foo']
             * console.log(mm.capture('test/*.js', 'foo/bar.css'));
             * //=> null
             * ```
             * @param {String} `glob` Glob pattern to use for matching.
             * @param {String} `input` String to match
             * @param {Object} `options` See available [options](#options) for changing how matches are performed
             * @return {Array|null} Returns an array of captures if the input matches the glob pattern, otherwise `null`.
             * @api public
             */

            micromatch.capture = function (glob, input, options) {
              var posix = utils.isWindows(options);
              var regex = picomatch.makeRe(String(glob), _objectSpread(_objectSpread({}, options), {}, {
                capture: true
              }));
              var match = regex.exec(posix ? utils.toPosixSlashes(input) : input);
              if (match) {
                return match.slice(1).map(function (v) {
                  return v === void 0 ? '' : v;
                });
              }
            };

            /**
             * Create a regular expression from the given glob `pattern`.
             *
             * ```js
             * const mm = require('micromatch');
             * // mm.makeRe(pattern[, options]);
             *
             * console.log(mm.makeRe('*.js'));
             * //=> /^(?:(\.[\\\/])?(?!\.)(?=.)[^\/]*?\.js)$/
             * ```
             * @param {String} `pattern` A glob pattern to convert to regex.
             * @param {Object} `options`
             * @return {RegExp} Returns a regex created from the given pattern.
             * @api public
             */

            micromatch.makeRe = function () {
              return picomatch.makeRe.apply(picomatch, arguments);
            };

            /**
             * Scan a glob pattern to separate the pattern into segments. Used
             * by the [split](#split) method.
             *
             * ```js
             * const mm = require('micromatch');
             * const state = mm.scan(pattern[, options]);
             * ```
             * @param {String} `pattern`
             * @param {Object} `options`
             * @return {Object} Returns an object with
             * @api public
             */

            micromatch.scan = function () {
              return picomatch.scan.apply(picomatch, arguments);
            };

            /**
             * Parse a glob pattern to create the source string for a regular
             * expression.
             *
             * ```js
             * const mm = require('micromatch');
             * const state = mm.parse(pattern[, options]);
             * ```
             * @param {String} `glob`
             * @param {Object} `options`
             * @return {Object} Returns an object with useful properties and output to be used as regex source string.
             * @api public
             */

            micromatch.parse = function (patterns, options) {
              var res = [];
              var _iterator11 = _createForOfIteratorHelper([].concat(patterns || [])),
                _step11;
              try {
                for (_iterator11.s(); !(_step11 = _iterator11.n()).done;) {
                  var pattern = _step11.value;
                  var _iterator12 = _createForOfIteratorHelper(braces(String(pattern), options)),
                    _step12;
                  try {
                    for (_iterator12.s(); !(_step12 = _iterator12.n()).done;) {
                      var str = _step12.value;
                      res.push(picomatch.parse(str, options));
                    }
                  } catch (err) {
                    _iterator12.e(err);
                  } finally {
                    _iterator12.f();
                  }
                }
              } catch (err) {
                _iterator11.e(err);
              } finally {
                _iterator11.f();
              }
              return res;
            };

            /**
             * Process the given brace `pattern`.
             *
             * ```js
             * const { braces } = require('micromatch');
             * console.log(braces('foo/{a,b,c}/bar'));
             * //=> [ 'foo/(a|b|c)/bar' ]
             *
             * console.log(braces('foo/{a,b,c}/bar', { expand: true }));
             * //=> [ 'foo/a/bar', 'foo/b/bar', 'foo/c/bar' ]
             * ```
             * @param {String} `pattern` String with brace pattern to process.
             * @param {Object} `options` Any [options](#options) to change how expansion is performed. See the [braces][] library for all available options.
             * @return {Array}
             * @api public
             */

            micromatch.braces = function (pattern, options) {
              if (typeof pattern !== 'string') throw new TypeError('Expected a string');
              if (options && options.nobrace === true || !/\{.*\}/.test(pattern)) {
                return [pattern];
              }
              return braces(pattern, options);
            };

            /**
             * Expand braces
             */

            micromatch.braceExpand = function (pattern, options) {
              if (typeof pattern !== 'string') throw new TypeError('Expected a string');
              return micromatch.braces(pattern, _objectSpread(_objectSpread({}, options), {}, {
                expand: true
              }));
            };

            /**
             * Expose micromatch
             */

            module.exports = micromatch;

            /***/
          }),
          /***/470: ( /***/function _(module) {
            "use strict";

            // 'path' module extracted from Node.js v8.11.1 (only the posix part)
            // transplited with Babel

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
            function assertPath(path) {
              if (typeof path !== 'string') {
                throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
              }
            }

            // Resolves . and .. elements in a path with directory names
            function normalizeStringPosix(path, allowAboveRoot) {
              var res = '';
              var lastSegmentLength = 0;
              var lastSlash = -1;
              var dots = 0;
              var code;
              for (var i = 0; i <= path.length; ++i) {
                if (i < path.length) code = path.charCodeAt(i);else if (code === 47 /*/*/) break;else code = 47 /*/*/;
                if (code === 47 /*/*/) {
                  if (lastSlash === i - 1 || dots === 1) {
                    // NOOP
                  } else if (lastSlash !== i - 1 && dots === 2) {
                    if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
                      if (res.length > 2) {
                        var lastSlashIndex = res.lastIndexOf('/');
                        if (lastSlashIndex !== res.length - 1) {
                          if (lastSlashIndex === -1) {
                            res = '';
                            lastSegmentLength = 0;
                          } else {
                            res = res.slice(0, lastSlashIndex);
                            lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
                          }
                          lastSlash = i;
                          dots = 0;
                          continue;
                        }
                      } else if (res.length === 2 || res.length === 1) {
                        res = '';
                        lastSegmentLength = 0;
                        lastSlash = i;
                        dots = 0;
                        continue;
                      }
                    }
                    if (allowAboveRoot) {
                      if (res.length > 0) res += '/..';else res = '..';
                      lastSegmentLength = 2;
                    }
                  } else {
                    if (res.length > 0) res += '/' + path.slice(lastSlash + 1, i);else res = path.slice(lastSlash + 1, i);
                    lastSegmentLength = i - lastSlash - 1;
                  }
                  lastSlash = i;
                  dots = 0;
                } else if (code === 46 /*.*/ && dots !== -1) {
                  ++dots;
                } else {
                  dots = -1;
                }
              }
              return res;
            }
            function _format(sep, pathObject) {
              var dir = pathObject.dir || pathObject.root;
              var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
              if (!dir) {
                return base;
              }
              if (dir === pathObject.root) {
                return dir + base;
              }
              return dir + sep + base;
            }
            var posix = {
              // path.resolve([from ...], to)
              resolve: function resolve() {
                var resolvedPath = '';
                var resolvedAbsolute = false;
                var cwd;
                for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                  var path;
                  if (i >= 0) path = arguments[i];else {
                    if (cwd === undefined) cwd = process.cwd();
                    path = cwd;
                  }
                  assertPath(path);

                  // Skip empty entries
                  if (path.length === 0) {
                    continue;
                  }
                  resolvedPath = path + '/' + resolvedPath;
                  resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
                }

                // At this point the path should be resolved to a full absolute path, but
                // handle relative paths to be safe (might happen when process.cwd() fails)

                // Normalize the path
                resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
                if (resolvedAbsolute) {
                  if (resolvedPath.length > 0) return '/' + resolvedPath;else return '/';
                } else if (resolvedPath.length > 0) {
                  return resolvedPath;
                } else {
                  return '.';
                }
              },
              normalize: function normalize(path) {
                assertPath(path);
                if (path.length === 0) return '.';
                var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
                var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;

                // Normalize the path
                path = normalizeStringPosix(path, !isAbsolute);
                if (path.length === 0 && !isAbsolute) path = '.';
                if (path.length > 0 && trailingSeparator) path += '/';
                if (isAbsolute) return '/' + path;
                return path;
              },
              isAbsolute: function isAbsolute(path) {
                assertPath(path);
                return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
              },
              join: function join() {
                if (arguments.length === 0) return '.';
                var joined;
                for (var i = 0; i < arguments.length; ++i) {
                  var arg = arguments[i];
                  assertPath(arg);
                  if (arg.length > 0) {
                    if (joined === undefined) joined = arg;else joined += '/' + arg;
                  }
                }
                if (joined === undefined) return '.';
                return posix.normalize(joined);
              },
              relative: function relative(from, to) {
                assertPath(from);
                assertPath(to);
                if (from === to) return '';
                from = posix.resolve(from);
                to = posix.resolve(to);
                if (from === to) return '';

                // Trim any leading backslashes
                var fromStart = 1;
                for (; fromStart < from.length; ++fromStart) {
                  if (from.charCodeAt(fromStart) !== 47 /*/*/) break;
                }
                var fromEnd = from.length;
                var fromLen = fromEnd - fromStart;

                // Trim any leading backslashes
                var toStart = 1;
                for (; toStart < to.length; ++toStart) {
                  if (to.charCodeAt(toStart) !== 47 /*/*/) break;
                }
                var toEnd = to.length;
                var toLen = toEnd - toStart;

                // Compare paths to find the longest common path from root
                var length = fromLen < toLen ? fromLen : toLen;
                var lastCommonSep = -1;
                var i = 0;
                for (; i <= length; ++i) {
                  if (i === length) {
                    if (toLen > length) {
                      if (to.charCodeAt(toStart + i) === 47 /*/*/) {
                        // We get here if `from` is the exact base path for `to`.
                        // For example: from='/foo/bar'; to='/foo/bar/baz'
                        return to.slice(toStart + i + 1);
                      } else if (i === 0) {
                        // We get here if `from` is the root
                        // For example: from='/'; to='/foo'
                        return to.slice(toStart + i);
                      }
                    } else if (fromLen > length) {
                      if (from.charCodeAt(fromStart + i) === 47 /*/*/) {
                        // We get here if `to` is the exact base path for `from`.
                        // For example: from='/foo/bar/baz'; to='/foo/bar'
                        lastCommonSep = i;
                      } else if (i === 0) {
                        // We get here if `to` is the root.
                        // For example: from='/foo'; to='/'
                        lastCommonSep = 0;
                      }
                    }
                    break;
                  }
                  var fromCode = from.charCodeAt(fromStart + i);
                  var toCode = to.charCodeAt(toStart + i);
                  if (fromCode !== toCode) break;else if (fromCode === 47 /*/*/) lastCommonSep = i;
                }
                var out = '';
                // Generate the relative path based on the path difference between `to`
                // and `from`
                for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
                  if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) {
                    if (out.length === 0) out += '..';else out += '/..';
                  }
                }

                // Lastly, append the rest of the destination (`to`) path that comes after
                // the common path parts
                if (out.length > 0) return out + to.slice(toStart + lastCommonSep);else {
                  toStart += lastCommonSep;
                  if (to.charCodeAt(toStart) === 47 /*/*/) ++toStart;
                  return to.slice(toStart);
                }
              },
              _makeLong: function _makeLong(path) {
                return path;
              },
              dirname: function dirname(path) {
                assertPath(path);
                if (path.length === 0) return '.';
                var code = path.charCodeAt(0);
                var hasRoot = code === 47 /*/*/;
                var end = -1;
                var matchedSlash = true;
                for (var i = path.length - 1; i >= 1; --i) {
                  code = path.charCodeAt(i);
                  if (code === 47 /*/*/) {
                    if (!matchedSlash) {
                      end = i;
                      break;
                    }
                  } else {
                    // We saw the first non-path separator
                    matchedSlash = false;
                  }
                }
                if (end === -1) return hasRoot ? '/' : '.';
                if (hasRoot && end === 1) return '//';
                return path.slice(0, end);
              },
              basename: function basename(path, ext) {
                if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
                assertPath(path);
                var start = 0;
                var end = -1;
                var matchedSlash = true;
                var i;
                if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
                  if (ext.length === path.length && ext === path) return '';
                  var extIdx = ext.length - 1;
                  var firstNonSlashEnd = -1;
                  for (i = path.length - 1; i >= 0; --i) {
                    var code = path.charCodeAt(i);
                    if (code === 47 /*/*/) {
                      // If we reached a path separator that was not part of a set of path
                      // separators at the end of the string, stop now
                      if (!matchedSlash) {
                        start = i + 1;
                        break;
                      }
                    } else {
                      if (firstNonSlashEnd === -1) {
                        // We saw the first non-path separator, remember this index in case
                        // we need it if the extension ends up not matching
                        matchedSlash = false;
                        firstNonSlashEnd = i + 1;
                      }
                      if (extIdx >= 0) {
                        // Try to match the explicit extension
                        if (code === ext.charCodeAt(extIdx)) {
                          if (--extIdx === -1) {
                            // We matched the extension, so mark this as the end of our path
                            // component
                            end = i;
                          }
                        } else {
                          // Extension does not match, so our result is the entire path
                          // component
                          extIdx = -1;
                          end = firstNonSlashEnd;
                        }
                      }
                    }
                  }
                  if (start === end) end = firstNonSlashEnd;else if (end === -1) end = path.length;
                  return path.slice(start, end);
                } else {
                  for (i = path.length - 1; i >= 0; --i) {
                    if (path.charCodeAt(i) === 47 /*/*/) {
                      // If we reached a path separator that was not part of a set of path
                      // separators at the end of the string, stop now
                      if (!matchedSlash) {
                        start = i + 1;
                        break;
                      }
                    } else if (end === -1) {
                      // We saw the first non-path separator, mark this as the end of our
                      // path component
                      matchedSlash = false;
                      end = i + 1;
                    }
                  }
                  if (end === -1) return '';
                  return path.slice(start, end);
                }
              },
              extname: function extname(path) {
                assertPath(path);
                var startDot = -1;
                var startPart = 0;
                var end = -1;
                var matchedSlash = true;
                // Track the state of characters (if any) we see before our first dot and
                // after any path separator we find
                var preDotState = 0;
                for (var i = path.length - 1; i >= 0; --i) {
                  var code = path.charCodeAt(i);
                  if (code === 47 /*/*/) {
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
                  if (code === 46 /*.*/) {
                    // If this is our first dot, mark it as the start of our extension
                    if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
                  } else if (startDot !== -1) {
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
              },
              format: function format(pathObject) {
                if (pathObject === null || typeof pathObject !== 'object') {
                  throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
                }
                return _format('/', pathObject);
              },
              parse: function parse(path) {
                assertPath(path);
                var ret = {
                  root: '',
                  dir: '',
                  base: '',
                  ext: '',
                  name: ''
                };
                if (path.length === 0) return ret;
                var code = path.charCodeAt(0);
                var isAbsolute = code === 47 /*/*/;
                var start;
                if (isAbsolute) {
                  ret.root = '/';
                  start = 1;
                } else {
                  start = 0;
                }
                var startDot = -1;
                var startPart = 0;
                var end = -1;
                var matchedSlash = true;
                var i = path.length - 1;

                // Track the state of characters (if any) we see before our first dot and
                // after any path separator we find
                var preDotState = 0;

                // Get non-dir info
                for (; i >= start; --i) {
                  code = path.charCodeAt(i);
                  if (code === 47 /*/*/) {
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
                  if (code === 46 /*.*/) {
                    // If this is our first dot, mark it as the start of our extension
                    if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
                  } else if (startDot !== -1) {
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
                  if (end !== -1) {
                    if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);else ret.base = ret.name = path.slice(startPart, end);
                  }
                } else {
                  if (startPart === 0 && isAbsolute) {
                    ret.name = path.slice(1, startDot);
                    ret.base = path.slice(1, end);
                  } else {
                    ret.name = path.slice(startPart, startDot);
                    ret.base = path.slice(startPart, end);
                  }
                  ret.ext = path.slice(startDot, end);
                }
                if (startPart > 0) ret.dir = path.slice(0, startPart - 1);else if (isAbsolute) ret.dir = '/';
                return ret;
              },
              sep: '/',
              delimiter: ':',
              win32: null,
              posix: null
            };
            posix.posix = posix;
            module.exports = posix;

            /***/
          }),
          /***/444: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            module.exports = __webpack_require__(87);

            /***/
          }),
          /***/6: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var path = __webpack_require__(470);
            var WIN_SLASH = '\\\\/';
            var WIN_NO_SLASH = "[^".concat(WIN_SLASH, "]");

            /**
             * Posix glob regex
             */

            var DOT_LITERAL = '\\.';
            var PLUS_LITERAL = '\\+';
            var QMARK_LITERAL = '\\?';
            var SLASH_LITERAL = '\\/';
            var ONE_CHAR = '(?=.)';
            var QMARK = '[^/]';
            var END_ANCHOR = "(?:".concat(SLASH_LITERAL, "|$)");
            var START_ANCHOR = "(?:^|".concat(SLASH_LITERAL, ")");
            var DOTS_SLASH = "".concat(DOT_LITERAL, "{1,2}").concat(END_ANCHOR);
            var NO_DOT = "(?!".concat(DOT_LITERAL, ")");
            var NO_DOTS = "(?!".concat(START_ANCHOR).concat(DOTS_SLASH, ")");
            var NO_DOT_SLASH = "(?!".concat(DOT_LITERAL, "{0,1}").concat(END_ANCHOR, ")");
            var NO_DOTS_SLASH = "(?!".concat(DOTS_SLASH, ")");
            var QMARK_NO_DOT = "[^.".concat(SLASH_LITERAL, "]");
            var STAR = "".concat(QMARK, "*?");
            var POSIX_CHARS = {
              DOT_LITERAL: DOT_LITERAL,
              PLUS_LITERAL: PLUS_LITERAL,
              QMARK_LITERAL: QMARK_LITERAL,
              SLASH_LITERAL: SLASH_LITERAL,
              ONE_CHAR: ONE_CHAR,
              QMARK: QMARK,
              END_ANCHOR: END_ANCHOR,
              DOTS_SLASH: DOTS_SLASH,
              NO_DOT: NO_DOT,
              NO_DOTS: NO_DOTS,
              NO_DOT_SLASH: NO_DOT_SLASH,
              NO_DOTS_SLASH: NO_DOTS_SLASH,
              QMARK_NO_DOT: QMARK_NO_DOT,
              STAR: STAR,
              START_ANCHOR: START_ANCHOR
            };

            /**
             * Windows glob regex
             */

            var WINDOWS_CHARS = _objectSpread(_objectSpread({}, POSIX_CHARS), {}, {
              SLASH_LITERAL: "[".concat(WIN_SLASH, "]"),
              QMARK: WIN_NO_SLASH,
              STAR: "".concat(WIN_NO_SLASH, "*?"),
              DOTS_SLASH: "".concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$)"),
              NO_DOT: "(?!".concat(DOT_LITERAL, ")"),
              NO_DOTS: "(?!(?:^|[".concat(WIN_SLASH, "])").concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$))"),
              NO_DOT_SLASH: "(?!".concat(DOT_LITERAL, "{0,1}(?:[").concat(WIN_SLASH, "]|$))"),
              NO_DOTS_SLASH: "(?!".concat(DOT_LITERAL, "{1,2}(?:[").concat(WIN_SLASH, "]|$))"),
              QMARK_NO_DOT: "[^.".concat(WIN_SLASH, "]"),
              START_ANCHOR: "(?:^|[".concat(WIN_SLASH, "])"),
              END_ANCHOR: "(?:[".concat(WIN_SLASH, "]|$)")
            });

            /**
             * POSIX Bracket Regex
             */

            var POSIX_REGEX_SOURCE = {
              alnum: 'a-zA-Z0-9',
              alpha: 'a-zA-Z',
              ascii: '\\x00-\\x7F',
              blank: ' \\t',
              cntrl: '\\x00-\\x1F\\x7F',
              digit: '0-9',
              graph: '\\x21-\\x7E',
              lower: 'a-z',
              print: '\\x20-\\x7E ',
              punct: '\\-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
              space: ' \\t\\r\\n\\v\\f',
              upper: 'A-Z',
              word: 'A-Za-z0-9_',
              xdigit: 'A-Fa-f0-9'
            };
            module.exports = {
              MAX_LENGTH: 1024 * 64,
              POSIX_REGEX_SOURCE: POSIX_REGEX_SOURCE,
              // regular expressions
              REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
              REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
              REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
              REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
              REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
              REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
              // Replace globs with equivalent patterns to reduce parsing time.
              REPLACEMENTS: {
                '***': '*',
                '**/**': '**',
                '**/**/**': '**'
              },
              // Digits
              CHAR_0: 48,
              /* 0 */
              CHAR_9: 57,
              /* 9 */

              // Alphabet chars.
              CHAR_UPPERCASE_A: 65,
              /* A */
              CHAR_LOWERCASE_A: 97,
              /* a */
              CHAR_UPPERCASE_Z: 90,
              /* Z */
              CHAR_LOWERCASE_Z: 122,
              /* z */

              CHAR_LEFT_PARENTHESES: 40,
              /* ( */
              CHAR_RIGHT_PARENTHESES: 41,
              /* ) */

              CHAR_ASTERISK: 42,
              /* * */

              // Non-alphabetic chars.
              CHAR_AMPERSAND: 38,
              /* & */
              CHAR_AT: 64,
              /* @ */
              CHAR_BACKWARD_SLASH: 92,
              /* \ */
              CHAR_CARRIAGE_RETURN: 13,
              /* \r */
              CHAR_CIRCUMFLEX_ACCENT: 94,
              /* ^ */
              CHAR_COLON: 58,
              /* : */
              CHAR_COMMA: 44,
              /* , */
              CHAR_DOT: 46,
              /* . */
              CHAR_DOUBLE_QUOTE: 34,
              /* " */
              CHAR_EQUAL: 61,
              /* = */
              CHAR_EXCLAMATION_MARK: 33,
              /* ! */
              CHAR_FORM_FEED: 12,
              /* \f */
              CHAR_FORWARD_SLASH: 47,
              /* / */
              CHAR_GRAVE_ACCENT: 96,
              /* ` */
              CHAR_HASH: 35,
              /* # */
              CHAR_HYPHEN_MINUS: 45,
              /* - */
              CHAR_LEFT_ANGLE_BRACKET: 60,
              /* < */
              CHAR_LEFT_CURLY_BRACE: 123,
              /* { */
              CHAR_LEFT_SQUARE_BRACKET: 91,
              /* [ */
              CHAR_LINE_FEED: 10,
              /* \n */
              CHAR_NO_BREAK_SPACE: 160,
              /* \u00A0 */
              CHAR_PERCENT: 37,
              /* % */
              CHAR_PLUS: 43,
              /* + */
              CHAR_QUESTION_MARK: 63,
              /* ? */
              CHAR_RIGHT_ANGLE_BRACKET: 62,
              /* > */
              CHAR_RIGHT_CURLY_BRACE: 125,
              /* } */
              CHAR_RIGHT_SQUARE_BRACKET: 93,
              /* ] */
              CHAR_SEMICOLON: 59,
              /* ; */
              CHAR_SINGLE_QUOTE: 39,
              /* ' */
              CHAR_SPACE: 32,
              /*   */
              CHAR_TAB: 9,
              /* \t */
              CHAR_UNDERSCORE: 95,
              /* _ */
              CHAR_VERTICAL_LINE: 124,
              /* | */
              CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
              /* \uFEFF */

              SEP: path.sep,
              /**
               * Create EXTGLOB_CHARS
               */
              extglobChars: function extglobChars(chars) {
                return {
                  '!': {
                    type: 'negate',
                    open: '(?:(?!(?:',
                    close: "))".concat(chars.STAR, ")")
                  },
                  '?': {
                    type: 'qmark',
                    open: '(?:',
                    close: ')?'
                  },
                  '+': {
                    type: 'plus',
                    open: '(?:',
                    close: ')+'
                  },
                  '*': {
                    type: 'star',
                    open: '(?:',
                    close: ')*'
                  },
                  '@': {
                    type: 'at',
                    open: '(?:',
                    close: ')'
                  }
                };
              },
              /**
               * Create GLOB_CHARS
               */
              globChars: function globChars(win32) {
                return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
              }
            };

            /***/
          }),
          /***/376: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var constants = __webpack_require__(6);
            var utils = __webpack_require__(371);

            /**
             * Constants
             */

            var MAX_LENGTH = constants.MAX_LENGTH,
              POSIX_REGEX_SOURCE = constants.POSIX_REGEX_SOURCE,
              REGEX_NON_SPECIAL_CHARS = constants.REGEX_NON_SPECIAL_CHARS,
              REGEX_SPECIAL_CHARS_BACKREF = constants.REGEX_SPECIAL_CHARS_BACKREF,
              REPLACEMENTS = constants.REPLACEMENTS;

            /**
             * Helpers
             */

            var expandRange = function expandRange(args, options) {
              if (typeof options.expandRange === 'function') {
                return options.expandRange.apply(options, _toConsumableArray(args).concat([options]));
              }
              args.sort();
              var value = "[".concat(args.join('-'), "]");
              try {
                /* eslint-disable-next-line no-new */
                new RegExp(value);
              } catch (ex) {
                return args.map(function (v) {
                  return utils.escapeRegex(v);
                }).join('..');
              }
              return value;
            };

            /**
             * Create the message for a syntax error
             */

            var syntaxError = function syntaxError(type, char) {
              return "Missing ".concat(type, ": \"").concat(char, "\" - use \"\\\\").concat(char, "\" to match literal characters");
            };

            /**
             * Parse the given input string.
             * @param {String} input
             * @param {Object} options
             * @return {Object}
             */

            var parse = function parse(input, options) {
              if (typeof input !== 'string') {
                throw new TypeError('Expected a string');
              }
              input = REPLACEMENTS[input] || input;
              var opts = _objectSpread({}, options);
              var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
              var len = input.length;
              if (len > max) {
                throw new SyntaxError("Input length: ".concat(len, ", exceeds maximum allowed length: ").concat(max));
              }
              var bos = {
                type: 'bos',
                value: '',
                output: opts.prepend || ''
              };
              var tokens = [bos];
              var capture = opts.capture ? '' : '?:';
              var win32 = utils.isWindows(options);

              // create constants based on platform, for windows or posix
              var PLATFORM_CHARS = constants.globChars(win32);
              var EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
              var DOT_LITERAL = PLATFORM_CHARS.DOT_LITERAL,
                PLUS_LITERAL = PLATFORM_CHARS.PLUS_LITERAL,
                SLASH_LITERAL = PLATFORM_CHARS.SLASH_LITERAL,
                ONE_CHAR = PLATFORM_CHARS.ONE_CHAR,
                DOTS_SLASH = PLATFORM_CHARS.DOTS_SLASH,
                NO_DOT = PLATFORM_CHARS.NO_DOT,
                NO_DOT_SLASH = PLATFORM_CHARS.NO_DOT_SLASH,
                NO_DOTS_SLASH = PLATFORM_CHARS.NO_DOTS_SLASH,
                QMARK = PLATFORM_CHARS.QMARK,
                QMARK_NO_DOT = PLATFORM_CHARS.QMARK_NO_DOT,
                STAR = PLATFORM_CHARS.STAR,
                START_ANCHOR = PLATFORM_CHARS.START_ANCHOR;
              var globstar = function globstar(opts) {
                return "(".concat(capture, "(?:(?!").concat(START_ANCHOR).concat(opts.dot ? DOTS_SLASH : DOT_LITERAL, ").)*?)");
              };
              var nodot = opts.dot ? '' : NO_DOT;
              var qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
              var star = opts.bash === true ? globstar(opts) : STAR;
              if (opts.capture) {
                star = "(".concat(star, ")");
              }

              // minimatch options support
              if (typeof opts.noext === 'boolean') {
                opts.noextglob = opts.noext;
              }
              var state = {
                input: input,
                index: -1,
                start: 0,
                dot: opts.dot === true,
                consumed: '',
                output: '',
                prefix: '',
                backtrack: false,
                negated: false,
                brackets: 0,
                braces: 0,
                parens: 0,
                quotes: 0,
                globstar: false,
                tokens: tokens
              };
              input = utils.removePrefix(input, state);
              len = input.length;
              var extglobs = [];
              var braces = [];
              var stack = [];
              var prev = bos;
              var value;

              /**
               * Tokenizing helpers
               */

              var eos = function eos() {
                return state.index === len - 1;
              };
              var peek = state.peek = function () {
                var n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
                return input[state.index + n];
              };
              var advance = state.advance = function () {
                return input[++state.index] || '';
              };
              var remaining = function remaining() {
                return input.slice(state.index + 1);
              };
              var consume = function consume() {
                var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
                var num = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
                state.consumed += value;
                state.index += num;
              };
              var append = function append(token) {
                state.output += token.output != null ? token.output : token.value;
                consume(token.value);
              };
              var negate = function negate() {
                var count = 1;
                while (peek() === '!' && (peek(2) !== '(' || peek(3) === '?')) {
                  advance();
                  state.start++;
                  count++;
                }
                if (count % 2 === 0) {
                  return false;
                }
                state.negated = true;
                state.start++;
                return true;
              };
              var increment = function increment(type) {
                state[type]++;
                stack.push(type);
              };
              var decrement = function decrement(type) {
                state[type]--;
                stack.pop();
              };

              /**
               * Push tokens onto the tokens array. This helper speeds up
               * tokenizing by 1) helping us avoid backtracking as much as possible,
               * and 2) helping us avoid creating extra tokens when consecutive
               * characters are plain text. This improves performance and simplifies
               * lookbehinds.
               */

              var push = function push(tok) {
                if (prev.type === 'globstar') {
                  var isBrace = state.braces > 0 && (tok.type === 'comma' || tok.type === 'brace');
                  var isExtglob = tok.extglob === true || extglobs.length && (tok.type === 'pipe' || tok.type === 'paren');
                  if (tok.type !== 'slash' && tok.type !== 'paren' && !isBrace && !isExtglob) {
                    state.output = state.output.slice(0, -prev.output.length);
                    prev.type = 'star';
                    prev.value = '*';
                    prev.output = star;
                    state.output += prev.output;
                  }
                }
                if (extglobs.length && tok.type !== 'paren') {
                  extglobs[extglobs.length - 1].inner += tok.value;
                }
                if (tok.value || tok.output) append(tok);
                if (prev && prev.type === 'text' && tok.type === 'text') {
                  prev.value += tok.value;
                  prev.output = (prev.output || '') + tok.value;
                  return;
                }
                tok.prev = prev;
                tokens.push(tok);
                prev = tok;
              };
              var extglobOpen = function extglobOpen(type, value) {
                var token = _objectSpread(_objectSpread({}, EXTGLOB_CHARS[value]), {}, {
                  conditions: 1,
                  inner: ''
                });
                token.prev = prev;
                token.parens = state.parens;
                token.output = state.output;
                var output = (opts.capture ? '(' : '') + token.open;
                increment('parens');
                push({
                  type: type,
                  value: value,
                  output: state.output ? '' : ONE_CHAR
                });
                push({
                  type: 'paren',
                  extglob: true,
                  value: advance(),
                  output: output
                });
                extglobs.push(token);
              };
              var extglobClose = function extglobClose(token) {
                var output = token.close + (opts.capture ? ')' : '');
                var rest;
                if (token.type === 'negate') {
                  var extglobStar = star;
                  if (token.inner && token.inner.length > 1 && token.inner.includes('/')) {
                    extglobStar = globstar(opts);
                  }
                  if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
                    output = token.close = ")$))".concat(extglobStar);
                  }
                  if (token.inner.includes('*') && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
                    // Any non-magical string (`.ts`) or even nested expression (`.{ts,tsx}`) can follow after the closing parenthesis.
                    // In this case, we need to parse the string and use it in the output of the original pattern.
                    // Suitable patterns: `/!(*.d).ts`, `/!(*.d).{ts,tsx}`, `**/!(*-dbg).@(js)`.
                    //
                    // Disabling the `fastpaths` option due to a problem with parsing strings as `.ts` in the pattern like `**/!(*.d).ts`.
                    var expression = parse(rest, _objectSpread(_objectSpread({}, options), {}, {
                      fastpaths: false
                    })).output;
                    output = token.close = ")".concat(expression, ")").concat(extglobStar, ")");
                  }
                  if (token.prev.type === 'bos') {
                    state.negatedExtglob = true;
                  }
                }
                push({
                  type: 'paren',
                  extglob: true,
                  value: value,
                  output: output
                });
                decrement('parens');
              };

              /**
               * Fast paths
               */

              if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
                var backslashes = false;
                var output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, function (m, esc, chars, first, rest, index) {
                  if (first === '\\') {
                    backslashes = true;
                    return m;
                  }
                  if (first === '?') {
                    if (esc) {
                      return esc + first + (rest ? QMARK.repeat(rest.length) : '');
                    }
                    if (index === 0) {
                      return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : '');
                    }
                    return QMARK.repeat(chars.length);
                  }
                  if (first === '.') {
                    return DOT_LITERAL.repeat(chars.length);
                  }
                  if (first === '*') {
                    if (esc) {
                      return esc + first + (rest ? star : '');
                    }
                    return star;
                  }
                  return esc ? m : "\\".concat(m);
                });
                if (backslashes === true) {
                  if (opts.unescape === true) {
                    output = output.replace(/\\/g, '');
                  } else {
                    output = output.replace(/\\+/g, function (m) {
                      return m.length % 2 === 0 ? '\\\\' : m ? '\\' : '';
                    });
                  }
                }
                if (output === input && opts.contains === true) {
                  state.output = input;
                  return state;
                }
                state.output = utils.wrapOutput(output, state, options);
                return state;
              }

              /**
               * Tokenize input until we reach end-of-string
               */

              while (!eos()) {
                value = advance();
                if (value === "\0") {
                  continue;
                }

                /**
                 * Escaped characters
                 */

                if (value === '\\') {
                  var next = peek();
                  if (next === '/' && opts.bash !== true) {
                    continue;
                  }
                  if (next === '.' || next === ';') {
                    continue;
                  }
                  if (!next) {
                    value += '\\';
                    push({
                      type: 'text',
                      value: value
                    });
                    continue;
                  }

                  // collapse slashes to reduce potential for exploits
                  var match = /^\\+/.exec(remaining());
                  var slashes = 0;
                  if (match && match[0].length > 2) {
                    slashes = match[0].length;
                    state.index += slashes;
                    if (slashes % 2 !== 0) {
                      value += '\\';
                    }
                  }
                  if (opts.unescape === true) {
                    value = advance();
                  } else {
                    value += advance();
                  }
                  if (state.brackets === 0) {
                    push({
                      type: 'text',
                      value: value
                    });
                    continue;
                  }
                }

                /**
                 * If we're inside a regex character class, continue
                 * until we reach the closing bracket.
                 */

                if (state.brackets > 0 && (value !== ']' || prev.value === '[' || prev.value === '[^')) {
                  if (opts.posix !== false && value === ':') {
                    var inner = prev.value.slice(1);
                    if (inner.includes('[')) {
                      prev.posix = true;
                      if (inner.includes(':')) {
                        var idx = prev.value.lastIndexOf('[');
                        var pre = prev.value.slice(0, idx);
                        var _rest = prev.value.slice(idx + 2);
                        var posix = POSIX_REGEX_SOURCE[_rest];
                        if (posix) {
                          prev.value = pre + posix;
                          state.backtrack = true;
                          advance();
                          if (!bos.output && tokens.indexOf(prev) === 1) {
                            bos.output = ONE_CHAR;
                          }
                          continue;
                        }
                      }
                    }
                  }
                  if (value === '[' && peek() !== ':' || value === '-' && peek() === ']') {
                    value = "\\".concat(value);
                  }
                  if (value === ']' && (prev.value === '[' || prev.value === '[^')) {
                    value = "\\".concat(value);
                  }
                  if (opts.posix === true && value === '!' && prev.value === '[') {
                    value = '^';
                  }
                  prev.value += value;
                  append({
                    value: value
                  });
                  continue;
                }

                /**
                 * If we're inside a quoted string, continue
                 * until we reach the closing double quote.
                 */

                if (state.quotes === 1 && value !== '"') {
                  value = utils.escapeRegex(value);
                  prev.value += value;
                  append({
                    value: value
                  });
                  continue;
                }

                /**
                 * Double quotes
                 */

                if (value === '"') {
                  state.quotes = state.quotes === 1 ? 0 : 1;
                  if (opts.keepQuotes === true) {
                    push({
                      type: 'text',
                      value: value
                    });
                  }
                  continue;
                }

                /**
                 * Parentheses
                 */

                if (value === '(') {
                  increment('parens');
                  push({
                    type: 'paren',
                    value: value
                  });
                  continue;
                }
                if (value === ')') {
                  if (state.parens === 0 && opts.strictBrackets === true) {
                    throw new SyntaxError(syntaxError('opening', '('));
                  }
                  var extglob = extglobs[extglobs.length - 1];
                  if (extglob && state.parens === extglob.parens + 1) {
                    extglobClose(extglobs.pop());
                    continue;
                  }
                  push({
                    type: 'paren',
                    value: value,
                    output: state.parens ? ')' : '\\)'
                  });
                  decrement('parens');
                  continue;
                }

                /**
                 * Square brackets
                 */

                if (value === '[') {
                  if (opts.nobracket === true || !remaining().includes(']')) {
                    if (opts.nobracket !== true && opts.strictBrackets === true) {
                      throw new SyntaxError(syntaxError('closing', ']'));
                    }
                    value = "\\".concat(value);
                  } else {
                    increment('brackets');
                  }
                  push({
                    type: 'bracket',
                    value: value
                  });
                  continue;
                }
                if (value === ']') {
                  if (opts.nobracket === true || prev && prev.type === 'bracket' && prev.value.length === 1) {
                    push({
                      type: 'text',
                      value: value,
                      output: "\\".concat(value)
                    });
                    continue;
                  }
                  if (state.brackets === 0) {
                    if (opts.strictBrackets === true) {
                      throw new SyntaxError(syntaxError('opening', '['));
                    }
                    push({
                      type: 'text',
                      value: value,
                      output: "\\".concat(value)
                    });
                    continue;
                  }
                  decrement('brackets');
                  var prevValue = prev.value.slice(1);
                  if (prev.posix !== true && prevValue[0] === '^' && !prevValue.includes('/')) {
                    value = "/".concat(value);
                  }
                  prev.value += value;
                  append({
                    value: value
                  });

                  // when literal brackets are explicitly disabled
                  // assume we should match with a regex character class
                  if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
                    continue;
                  }
                  var escaped = utils.escapeRegex(prev.value);
                  state.output = state.output.slice(0, -prev.value.length);

                  // when literal brackets are explicitly enabled
                  // assume we should escape the brackets to match literal characters
                  if (opts.literalBrackets === true) {
                    state.output += escaped;
                    prev.value = escaped;
                    continue;
                  }

                  // when the user specifies nothing, try to match both
                  prev.value = "(".concat(capture).concat(escaped, "|").concat(prev.value, ")");
                  state.output += prev.value;
                  continue;
                }

                /**
                 * Braces
                 */

                if (value === '{' && opts.nobrace !== true) {
                  increment('braces');
                  var open = {
                    type: 'brace',
                    value: value,
                    output: '(',
                    outputIndex: state.output.length,
                    tokensIndex: state.tokens.length
                  };
                  braces.push(open);
                  push(open);
                  continue;
                }
                if (value === '}') {
                  var brace = braces[braces.length - 1];
                  if (opts.nobrace === true || !brace) {
                    push({
                      type: 'text',
                      value: value,
                      output: value
                    });
                    continue;
                  }
                  var _output2 = ')';
                  if (brace.dots === true) {
                    var arr = tokens.slice();
                    var range = [];
                    for (var i = arr.length - 1; i >= 0; i--) {
                      tokens.pop();
                      if (arr[i].type === 'brace') {
                        break;
                      }
                      if (arr[i].type !== 'dots') {
                        range.unshift(arr[i].value);
                      }
                    }
                    _output2 = expandRange(range, opts);
                    state.backtrack = true;
                  }
                  if (brace.comma !== true && brace.dots !== true) {
                    var out = state.output.slice(0, brace.outputIndex);
                    var toks = state.tokens.slice(brace.tokensIndex);
                    brace.value = brace.output = '\\{';
                    value = _output2 = '\\}';
                    state.output = out;
                    var _iterator13 = _createForOfIteratorHelper(toks),
                      _step13;
                    try {
                      for (_iterator13.s(); !(_step13 = _iterator13.n()).done;) {
                        var t = _step13.value;
                        state.output += t.output || t.value;
                      }
                    } catch (err) {
                      _iterator13.e(err);
                    } finally {
                      _iterator13.f();
                    }
                  }
                  push({
                    type: 'brace',
                    value: value,
                    output: _output2
                  });
                  decrement('braces');
                  braces.pop();
                  continue;
                }

                /**
                 * Pipes
                 */

                if (value === '|') {
                  if (extglobs.length > 0) {
                    extglobs[extglobs.length - 1].conditions++;
                  }
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }

                /**
                 * Commas
                 */

                if (value === ',') {
                  var _output3 = value;
                  var _brace = braces[braces.length - 1];
                  if (_brace && stack[stack.length - 1] === 'braces') {
                    _brace.comma = true;
                    _output3 = '|';
                  }
                  push({
                    type: 'comma',
                    value: value,
                    output: _output3
                  });
                  continue;
                }

                /**
                 * Slashes
                 */

                if (value === '/') {
                  // if the beginning of the glob is "./", advance the start
                  // to the current index, and don't add the "./" characters
                  // to the state. This greatly simplifies lookbehinds when
                  // checking for BOS characters like "!" and "." (not "./")
                  if (prev.type === 'dot' && state.index === state.start + 1) {
                    state.start = state.index + 1;
                    state.consumed = '';
                    state.output = '';
                    tokens.pop();
                    prev = bos; // reset "prev" to the first token
                    continue;
                  }
                  push({
                    type: 'slash',
                    value: value,
                    output: SLASH_LITERAL
                  });
                  continue;
                }

                /**
                 * Dots
                 */

                if (value === '.') {
                  if (state.braces > 0 && prev.type === 'dot') {
                    if (prev.value === '.') prev.output = DOT_LITERAL;
                    var _brace2 = braces[braces.length - 1];
                    prev.type = 'dots';
                    prev.output += value;
                    prev.value += value;
                    _brace2.dots = true;
                    continue;
                  }
                  if (state.braces + state.parens === 0 && prev.type !== 'bos' && prev.type !== 'slash') {
                    push({
                      type: 'text',
                      value: value,
                      output: DOT_LITERAL
                    });
                    continue;
                  }
                  push({
                    type: 'dot',
                    value: value,
                    output: DOT_LITERAL
                  });
                  continue;
                }

                /**
                 * Question marks
                 */

                if (value === '?') {
                  var isGroup = prev && prev.value === '(';
                  if (!isGroup && opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
                    extglobOpen('qmark', value);
                    continue;
                  }
                  if (prev && prev.type === 'paren') {
                    var _next2 = peek();
                    var _output4 = value;
                    if (_next2 === '<' && !utils.supportsLookbehinds()) {
                      throw new Error('Node.js v10 or higher is required for regex lookbehinds');
                    }
                    if (prev.value === '(' && !/[!=<:]/.test(_next2) || _next2 === '<' && !/<([!=]|\w+>)/.test(remaining())) {
                      _output4 = "\\".concat(value);
                    }
                    push({
                      type: 'text',
                      value: value,
                      output: _output4
                    });
                    continue;
                  }
                  if (opts.dot !== true && (prev.type === 'slash' || prev.type === 'bos')) {
                    push({
                      type: 'qmark',
                      value: value,
                      output: QMARK_NO_DOT
                    });
                    continue;
                  }
                  push({
                    type: 'qmark',
                    value: value,
                    output: QMARK
                  });
                  continue;
                }

                /**
                 * Exclamation
                 */

                if (value === '!') {
                  if (opts.noextglob !== true && peek() === '(') {
                    if (peek(2) !== '?' || !/[!=<:]/.test(peek(3))) {
                      extglobOpen('negate', value);
                      continue;
                    }
                  }
                  if (opts.nonegate !== true && state.index === 0) {
                    negate();
                    continue;
                  }
                }

                /**
                 * Plus
                 */

                if (value === '+') {
                  if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
                    extglobOpen('plus', value);
                    continue;
                  }
                  if (prev && prev.value === '(' || opts.regex === false) {
                    push({
                      type: 'plus',
                      value: value,
                      output: PLUS_LITERAL
                    });
                    continue;
                  }
                  if (prev && (prev.type === 'bracket' || prev.type === 'paren' || prev.type === 'brace') || state.parens > 0) {
                    push({
                      type: 'plus',
                      value: value
                    });
                    continue;
                  }
                  push({
                    type: 'plus',
                    value: PLUS_LITERAL
                  });
                  continue;
                }

                /**
                 * Plain text
                 */

                if (value === '@') {
                  if (opts.noextglob !== true && peek() === '(' && peek(2) !== '?') {
                    push({
                      type: 'at',
                      extglob: true,
                      value: value,
                      output: ''
                    });
                    continue;
                  }
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }

                /**
                 * Plain text
                 */

                if (value !== '*') {
                  if (value === '$' || value === '^') {
                    value = "\\".concat(value);
                  }
                  var _match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
                  if (_match) {
                    value += _match[0];
                    state.index += _match[0].length;
                  }
                  push({
                    type: 'text',
                    value: value
                  });
                  continue;
                }

                /**
                 * Stars
                 */

                if (prev && (prev.type === 'globstar' || prev.star === true)) {
                  prev.type = 'star';
                  prev.star = true;
                  prev.value += value;
                  prev.output = star;
                  state.backtrack = true;
                  state.globstar = true;
                  consume(value);
                  continue;
                }
                var rest = remaining();
                if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
                  extglobOpen('star', value);
                  continue;
                }
                if (prev.type === 'star') {
                  if (opts.noglobstar === true) {
                    consume(value);
                    continue;
                  }
                  var prior = prev.prev;
                  var before = prior.prev;
                  var isStart = prior.type === 'slash' || prior.type === 'bos';
                  var afterStar = before && (before.type === 'star' || before.type === 'globstar');
                  if (opts.bash === true && (!isStart || rest[0] && rest[0] !== '/')) {
                    push({
                      type: 'star',
                      value: value,
                      output: ''
                    });
                    continue;
                  }
                  var isBrace = state.braces > 0 && (prior.type === 'comma' || prior.type === 'brace');
                  var isExtglob = extglobs.length && (prior.type === 'pipe' || prior.type === 'paren');
                  if (!isStart && prior.type !== 'paren' && !isBrace && !isExtglob) {
                    push({
                      type: 'star',
                      value: value,
                      output: ''
                    });
                    continue;
                  }

                  // strip consecutive `/**/`
                  while (rest.slice(0, 3) === '/**') {
                    var after = input[state.index + 4];
                    if (after && after !== '/') {
                      break;
                    }
                    rest = rest.slice(3);
                    consume('/**', 3);
                  }
                  if (prior.type === 'bos' && eos()) {
                    prev.type = 'globstar';
                    prev.value += value;
                    prev.output = globstar(opts);
                    state.output = prev.output;
                    state.globstar = true;
                    consume(value);
                    continue;
                  }
                  if (prior.type === 'slash' && prior.prev.type !== 'bos' && !afterStar && eos()) {
                    state.output = state.output.slice(0, -(prior.output + prev.output).length);
                    prior.output = "(?:".concat(prior.output);
                    prev.type = 'globstar';
                    prev.output = globstar(opts) + (opts.strictSlashes ? ')' : '|$)');
                    prev.value += value;
                    state.globstar = true;
                    state.output += prior.output + prev.output;
                    consume(value);
                    continue;
                  }
                  if (prior.type === 'slash' && prior.prev.type !== 'bos' && rest[0] === '/') {
                    var end = rest[1] !== void 0 ? '|$' : '';
                    state.output = state.output.slice(0, -(prior.output + prev.output).length);
                    prior.output = "(?:".concat(prior.output);
                    prev.type = 'globstar';
                    prev.output = "".concat(globstar(opts)).concat(SLASH_LITERAL, "|").concat(SLASH_LITERAL).concat(end, ")");
                    prev.value += value;
                    state.output += prior.output + prev.output;
                    state.globstar = true;
                    consume(value + advance());
                    push({
                      type: 'slash',
                      value: '/',
                      output: ''
                    });
                    continue;
                  }
                  if (prior.type === 'bos' && rest[0] === '/') {
                    prev.type = 'globstar';
                    prev.value += value;
                    prev.output = "(?:^|".concat(SLASH_LITERAL, "|").concat(globstar(opts)).concat(SLASH_LITERAL, ")");
                    state.output = prev.output;
                    state.globstar = true;
                    consume(value + advance());
                    push({
                      type: 'slash',
                      value: '/',
                      output: ''
                    });
                    continue;
                  }

                  // remove single star from output
                  state.output = state.output.slice(0, -prev.output.length);

                  // reset previous token to globstar
                  prev.type = 'globstar';
                  prev.output = globstar(opts);
                  prev.value += value;

                  // reset output with globstar
                  state.output += prev.output;
                  state.globstar = true;
                  consume(value);
                  continue;
                }
                var token = {
                  type: 'star',
                  value: value,
                  output: star
                };
                if (opts.bash === true) {
                  token.output = '.*?';
                  if (prev.type === 'bos' || prev.type === 'slash') {
                    token.output = nodot + token.output;
                  }
                  push(token);
                  continue;
                }
                if (prev && (prev.type === 'bracket' || prev.type === 'paren') && opts.regex === true) {
                  token.output = value;
                  push(token);
                  continue;
                }
                if (state.index === state.start || prev.type === 'slash' || prev.type === 'dot') {
                  if (prev.type === 'dot') {
                    state.output += NO_DOT_SLASH;
                    prev.output += NO_DOT_SLASH;
                  } else if (opts.dot === true) {
                    state.output += NO_DOTS_SLASH;
                    prev.output += NO_DOTS_SLASH;
                  } else {
                    state.output += nodot;
                    prev.output += nodot;
                  }
                  if (peek() !== '*') {
                    state.output += ONE_CHAR;
                    prev.output += ONE_CHAR;
                  }
                }
                push(token);
              }
              while (state.brackets > 0) {
                if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ']'));
                state.output = utils.escapeLast(state.output, '[');
                decrement('brackets');
              }
              while (state.parens > 0) {
                if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', ')'));
                state.output = utils.escapeLast(state.output, '(');
                decrement('parens');
              }
              while (state.braces > 0) {
                if (opts.strictBrackets === true) throw new SyntaxError(syntaxError('closing', '}'));
                state.output = utils.escapeLast(state.output, '{');
                decrement('braces');
              }
              if (opts.strictSlashes !== true && (prev.type === 'star' || prev.type === 'bracket')) {
                push({
                  type: 'maybe_slash',
                  value: '',
                  output: "".concat(SLASH_LITERAL, "?")
                });
              }

              // rebuild the output if we had to backtrack at any point
              if (state.backtrack === true) {
                state.output = '';
                var _iterator14 = _createForOfIteratorHelper(state.tokens),
                  _step14;
                try {
                  for (_iterator14.s(); !(_step14 = _iterator14.n()).done;) {
                    var _token = _step14.value;
                    state.output += _token.output != null ? _token.output : _token.value;
                    if (_token.suffix) {
                      state.output += _token.suffix;
                    }
                  }
                } catch (err) {
                  _iterator14.e(err);
                } finally {
                  _iterator14.f();
                }
              }
              return state;
            };

            /**
             * Fast paths for creating regular expressions for common glob patterns.
             * This can significantly speed up processing and has very little downside
             * impact when none of the fast paths match.
             */

            parse.fastpaths = function (input, options) {
              var opts = _objectSpread({}, options);
              var max = typeof opts.maxLength === 'number' ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
              var len = input.length;
              if (len > max) {
                throw new SyntaxError("Input length: ".concat(len, ", exceeds maximum allowed length: ").concat(max));
              }
              input = REPLACEMENTS[input] || input;
              var win32 = utils.isWindows(options);

              // create constants based on platform, for windows or posix
              var _constants$globChars = constants.globChars(win32),
                DOT_LITERAL = _constants$globChars.DOT_LITERAL,
                SLASH_LITERAL = _constants$globChars.SLASH_LITERAL,
                ONE_CHAR = _constants$globChars.ONE_CHAR,
                DOTS_SLASH = _constants$globChars.DOTS_SLASH,
                NO_DOT = _constants$globChars.NO_DOT,
                NO_DOTS = _constants$globChars.NO_DOTS,
                NO_DOTS_SLASH = _constants$globChars.NO_DOTS_SLASH,
                STAR = _constants$globChars.STAR,
                START_ANCHOR = _constants$globChars.START_ANCHOR;
              var nodot = opts.dot ? NO_DOTS : NO_DOT;
              var slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
              var capture = opts.capture ? '' : '?:';
              var state = {
                negated: false,
                prefix: ''
              };
              var star = opts.bash === true ? '.*?' : STAR;
              if (opts.capture) {
                star = "(".concat(star, ")");
              }
              var globstar = function globstar(opts) {
                if (opts.noglobstar === true) return star;
                return "(".concat(capture, "(?:(?!").concat(START_ANCHOR).concat(opts.dot ? DOTS_SLASH : DOT_LITERAL, ").)*?)");
              };
              var create = function create(str) {
                switch (str) {
                  case '*':
                    return "".concat(nodot).concat(ONE_CHAR).concat(star);
                  case '.*':
                    return "".concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);
                  case '*.*':
                    return "".concat(nodot).concat(star).concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);
                  case '*/*':
                    return "".concat(nodot).concat(star).concat(SLASH_LITERAL).concat(ONE_CHAR).concat(slashDot).concat(star);
                  case '**':
                    return nodot + globstar(opts);
                  case '**/*':
                    return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(slashDot).concat(ONE_CHAR).concat(star);
                  case '**/*.*':
                    return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(slashDot).concat(star).concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);
                  case '**/.*':
                    return "(?:".concat(nodot).concat(globstar(opts)).concat(SLASH_LITERAL, ")?").concat(DOT_LITERAL).concat(ONE_CHAR).concat(star);
                  default:
                    {
                      var match = /^(.*?)\.(\w+)$/.exec(str);
                      if (!match) return;
                      var _source = create(match[1]);
                      if (!_source) return;
                      return _source + DOT_LITERAL + match[2];
                    }
                }
              };
              var output = utils.removePrefix(input, state);
              var source = create(output);
              if (source && opts.strictSlashes !== true) {
                source += "".concat(SLASH_LITERAL, "?");
              }
              return source;
            };
            module.exports = parse;

            /***/
          }),
          /***/87: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var path = __webpack_require__(470);
            var scan = __webpack_require__(921);
            var parse = __webpack_require__(376);
            var utils = __webpack_require__(371);
            var constants = __webpack_require__(6);
            var isObject = function isObject(val) {
              return val && typeof val === 'object' && !Array.isArray(val);
            };

            /**
             * Creates a matcher function from one or more glob patterns. The
             * returned function takes a string to match as its first argument,
             * and returns true if the string is a match. The returned matcher
             * function also takes a boolean as the second argument that, when true,
             * returns an object with additional information.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch(glob[, options]);
             *
             * const isMatch = picomatch('*.!(*a)');
             * console.log(isMatch('a.a')); //=> false
             * console.log(isMatch('a.b')); //=> true
             * ```
             * @name picomatch
             * @param {String|Array} `globs` One or more glob patterns.
             * @param {Object=} `options`
             * @return {Function=} Returns a matcher function.
             * @api public
             */

            var picomatch = function picomatch(glob, options) {
              var returnState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
              if (Array.isArray(glob)) {
                var fns = glob.map(function (input) {
                  return picomatch(input, options, returnState);
                });
                var arrayMatcher = function arrayMatcher(str) {
                  var _iterator15 = _createForOfIteratorHelper(fns),
                    _step15;
                  try {
                    for (_iterator15.s(); !(_step15 = _iterator15.n()).done;) {
                      var isMatch = _step15.value;
                      var _state = isMatch(str);
                      if (_state) return _state;
                    }
                  } catch (err) {
                    _iterator15.e(err);
                  } finally {
                    _iterator15.f();
                  }
                  return false;
                };
                return arrayMatcher;
              }
              var isState = isObject(glob) && glob.tokens && glob.input;
              if (glob === '' || typeof glob !== 'string' && !isState) {
                throw new TypeError('Expected pattern to be a non-empty string');
              }
              var opts = options || {};
              var posix = utils.isWindows(options);
              var regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, false, true);
              var state = regex.state;
              delete regex.state;
              var isIgnored = function isIgnored() {
                return false;
              };
              if (opts.ignore) {
                var ignoreOpts = _objectSpread(_objectSpread({}, options), {}, {
                  ignore: null,
                  onMatch: null,
                  onResult: null
                });
                isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
              }
              var matcher = function matcher(input) {
                var returnObject = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
                var _picomatch$test = picomatch.test(input, regex, options, {
                    glob: glob,
                    posix: posix
                  }),
                  isMatch = _picomatch$test.isMatch,
                  match = _picomatch$test.match,
                  output = _picomatch$test.output;
                var result = {
                  glob: glob,
                  state: state,
                  regex: regex,
                  posix: posix,
                  input: input,
                  output: output,
                  match: match,
                  isMatch: isMatch
                };
                if (typeof opts.onResult === 'function') {
                  opts.onResult(result);
                }
                if (isMatch === false) {
                  result.isMatch = false;
                  return returnObject ? result : false;
                }
                if (isIgnored(input)) {
                  if (typeof opts.onIgnore === 'function') {
                    opts.onIgnore(result);
                  }
                  result.isMatch = false;
                  return returnObject ? result : false;
                }
                if (typeof opts.onMatch === 'function') {
                  opts.onMatch(result);
                }
                return returnObject ? result : true;
              };
              if (returnState) {
                matcher.state = state;
              }
              return matcher;
            };

            /**
             * Test `input` with the given `regex`. This is used by the main
             * `picomatch()` function to test the input string.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch.test(input, regex[, options]);
             *
             * console.log(picomatch.test('foo/bar', /^(?:([^/]*?)\/([^/]*?))$/));
             * // { isMatch: true, match: [ 'foo/', 'foo', 'bar' ], output: 'foo/bar' }
             * ```
             * @param {String} `input` String to test.
             * @param {RegExp} `regex`
             * @return {Object} Returns an object with matching info.
             * @api public
             */

            picomatch.test = function (input, regex, options) {
              var _ref = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {},
                glob = _ref.glob,
                posix = _ref.posix;
              if (typeof input !== 'string') {
                throw new TypeError('Expected input to be a string');
              }
              if (input === '') {
                return {
                  isMatch: false,
                  output: ''
                };
              }
              var opts = options || {};
              var format = opts.format || (posix ? utils.toPosixSlashes : null);
              var match = input === glob;
              var output = match && format ? format(input) : input;
              if (match === false) {
                output = format ? format(input) : input;
                match = output === glob;
              }
              if (match === false || opts.capture === true) {
                if (opts.matchBase === true || opts.basename === true) {
                  match = picomatch.matchBase(input, regex, options, posix);
                } else {
                  match = regex.exec(output);
                }
              }
              return {
                isMatch: Boolean(match),
                match: match,
                output: output
              };
            };

            /**
             * Match the basename of a filepath.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch.matchBase(input, glob[, options]);
             * console.log(picomatch.matchBase('foo/bar.js', '*.js'); // true
             * ```
             * @param {String} `input` String to test.
             * @param {RegExp|String} `glob` Glob pattern or regex created by [.makeRe](#makeRe).
             * @return {Boolean}
             * @api public
             */

            picomatch.matchBase = function (input, glob, options) {
              var posix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : utils.isWindows(options);
              var regex = glob instanceof RegExp ? glob : picomatch.makeRe(glob, options);
              return regex.test(path.basename(input));
            };

            /**
             * Returns true if **any** of the given glob `patterns` match the specified `string`.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch.isMatch(string, patterns[, options]);
             *
             * console.log(picomatch.isMatch('a.a', ['b.*', '*.a'])); //=> true
             * console.log(picomatch.isMatch('a.a', 'b.*')); //=> false
             * ```
             * @param {String|Array} str The string to test.
             * @param {String|Array} patterns One or more glob patterns to use for matching.
             * @param {Object} [options] See available [options](#options).
             * @return {Boolean} Returns true if any patterns match `str`
             * @api public
             */

            picomatch.isMatch = function (str, patterns, options) {
              return picomatch(patterns, options)(str);
            };

            /**
             * Parse a glob pattern to create the source string for a regular
             * expression.
             *
             * ```js
             * const picomatch = require('picomatch');
             * const result = picomatch.parse(pattern[, options]);
             * ```
             * @param {String} `pattern`
             * @param {Object} `options`
             * @return {Object} Returns an object with useful properties and output to be used as a regex source string.
             * @api public
             */

            picomatch.parse = function (pattern, options) {
              if (Array.isArray(pattern)) return pattern.map(function (p) {
                return picomatch.parse(p, options);
              });
              return parse(pattern, _objectSpread(_objectSpread({}, options), {}, {
                fastpaths: false
              }));
            };

            /**
             * Scan a glob pattern to separate the pattern into segments.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch.scan(input[, options]);
             *
             * const result = picomatch.scan('!./foo/*.js');
             * console.log(result);
             * { prefix: '!./',
             *   input: '!./foo/*.js',
             *   start: 3,
             *   base: 'foo',
             *   glob: '*.js',
             *   isBrace: false,
             *   isBracket: false,
             *   isGlob: true,
             *   isExtglob: false,
             *   isGlobstar: false,
             *   negated: true }
             * ```
             * @param {String} `input` Glob pattern to scan.
             * @param {Object} `options`
             * @return {Object} Returns an object with
             * @api public
             */

            picomatch.scan = function (input, options) {
              return scan(input, options);
            };

            /**
             * Compile a regular expression from the `state` object returned by the
             * [parse()](#parse) method.
             *
             * @param {Object} `state`
             * @param {Object} `options`
             * @param {Boolean} `returnOutput` Intended for implementors, this argument allows you to return the raw output from the parser.
             * @param {Boolean} `returnState` Adds the state to a `state` property on the returned regex. Useful for implementors and debugging.
             * @return {RegExp}
             * @api public
             */

            picomatch.compileRe = function (state, options) {
              var returnOutput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
              var returnState = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
              if (returnOutput === true) {
                return state.output;
              }
              var opts = options || {};
              var prepend = opts.contains ? '' : '^';
              var append = opts.contains ? '' : '$';
              var source = "".concat(prepend, "(?:").concat(state.output, ")").concat(append);
              if (state && state.negated === true) {
                source = "^(?!".concat(source, ").*$");
              }
              var regex = picomatch.toRegex(source, options);
              if (returnState === true) {
                regex.state = state;
              }
              return regex;
            };

            /**
             * Create a regular expression from a parsed glob pattern.
             *
             * ```js
             * const picomatch = require('picomatch');
             * const state = picomatch.parse('*.js');
             * // picomatch.compileRe(state[, options]);
             *
             * console.log(picomatch.compileRe(state));
             * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
             * ```
             * @param {String} `state` The object returned from the `.parse` method.
             * @param {Object} `options`
             * @param {Boolean} `returnOutput` Implementors may use this argument to return the compiled output, instead of a regular expression. This is not exposed on the options to prevent end-users from mutating the result.
             * @param {Boolean} `returnState` Implementors may use this argument to return the state from the parsed glob with the returned regular expression.
             * @return {RegExp} Returns a regex created from the given pattern.
             * @api public
             */

            picomatch.makeRe = function (input) {
              var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var returnOutput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
              var returnState = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
              if (!input || typeof input !== 'string') {
                throw new TypeError('Expected a non-empty string');
              }
              var parsed = {
                negated: false,
                fastpaths: true
              };
              if (options.fastpaths !== false && (input[0] === '.' || input[0] === '*')) {
                parsed.output = parse.fastpaths(input, options);
              }
              if (!parsed.output) {
                parsed = parse(input, options);
              }
              return picomatch.compileRe(parsed, options, returnOutput, returnState);
            };

            /**
             * Create a regular expression from the given regex source string.
             *
             * ```js
             * const picomatch = require('picomatch');
             * // picomatch.toRegex(source[, options]);
             *
             * const { output } = picomatch.parse('*.js');
             * console.log(picomatch.toRegex(output));
             * //=> /^(?:(?!\.)(?=.)[^/]*?\.js)$/
             * ```
             * @param {String} `source` Regular expression source string.
             * @param {Object} `options`
             * @return {RegExp}
             * @api public
             */

            picomatch.toRegex = function (source, options) {
              try {
                var opts = options || {};
                return new RegExp(source, opts.flags || (opts.nocase ? 'i' : ''));
              } catch (err) {
                if (options && options.debug === true) throw err;
                return /$^/;
              }
            };

            /**
             * Picomatch constants.
             * @return {Object}
             */

            picomatch.constants = constants;

            /**
             * Expose "picomatch"
             */

            module.exports = picomatch;

            /***/
          }),
          /***/921: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var utils = __webpack_require__(371);
            var _webpack_require__2 = __webpack_require__(6),
              CHAR_ASTERISK = _webpack_require__2.CHAR_ASTERISK,
              CHAR_AT = _webpack_require__2.CHAR_AT,
              CHAR_BACKWARD_SLASH = _webpack_require__2.CHAR_BACKWARD_SLASH,
              CHAR_COMMA = _webpack_require__2.CHAR_COMMA,
              CHAR_DOT = _webpack_require__2.CHAR_DOT,
              CHAR_EXCLAMATION_MARK = _webpack_require__2.CHAR_EXCLAMATION_MARK,
              CHAR_FORWARD_SLASH = _webpack_require__2.CHAR_FORWARD_SLASH,
              CHAR_LEFT_CURLY_BRACE = _webpack_require__2.CHAR_LEFT_CURLY_BRACE,
              CHAR_LEFT_PARENTHESES = _webpack_require__2.CHAR_LEFT_PARENTHESES,
              CHAR_LEFT_SQUARE_BRACKET = _webpack_require__2.CHAR_LEFT_SQUARE_BRACKET,
              CHAR_PLUS = _webpack_require__2.CHAR_PLUS,
              CHAR_QUESTION_MARK = _webpack_require__2.CHAR_QUESTION_MARK,
              CHAR_RIGHT_CURLY_BRACE = _webpack_require__2.CHAR_RIGHT_CURLY_BRACE,
              CHAR_RIGHT_PARENTHESES = _webpack_require__2.CHAR_RIGHT_PARENTHESES,
              CHAR_RIGHT_SQUARE_BRACKET = _webpack_require__2.CHAR_RIGHT_SQUARE_BRACKET;
            var isPathSeparator = function isPathSeparator(code) {
              return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
            };
            var depth = function depth(token) {
              if (token.isPrefix !== true) {
                token.depth = token.isGlobstar ? Infinity : 1;
              }
            };

            /**
             * Quickly scans a glob pattern and returns an object with a handful of
             * useful properties, like `isGlob`, `path` (the leading non-glob, if it exists),
             * `glob` (the actual pattern), `negated` (true if the path starts with `!` but not
             * with `!(`) and `negatedExtglob` (true if the path starts with `!(`).
             *
             * ```js
             * const pm = require('picomatch');
             * console.log(pm.scan('foo/bar/*.js'));
             * { isGlob: true, input: 'foo/bar/*.js', base: 'foo/bar', glob: '*.js' }
             * ```
             * @param {String} `str`
             * @param {Object} `options`
             * @return {Object} Returns an object with tokens and regex source string.
             * @api public
             */

            var scan = function scan(input, options) {
              var opts = options || {};
              var length = input.length - 1;
              var scanToEnd = opts.parts === true || opts.scanToEnd === true;
              var slashes = [];
              var tokens = [];
              var parts = [];
              var str = input;
              var index = -1;
              var start = 0;
              var lastIndex = 0;
              var isBrace = false;
              var isBracket = false;
              var isGlob = false;
              var isExtglob = false;
              var isGlobstar = false;
              var braceEscaped = false;
              var backslashes = false;
              var negated = false;
              var negatedExtglob = false;
              var finished = false;
              var braces = 0;
              var prev;
              var code;
              var token = {
                value: '',
                depth: 0,
                isGlob: false
              };
              var eos = function eos() {
                return index >= length;
              };
              var peek = function peek() {
                return str.charCodeAt(index + 1);
              };
              var advance = function advance() {
                prev = code;
                return str.charCodeAt(++index);
              };
              while (index < length) {
                code = advance();
                var next = void 0;
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  if (code === CHAR_LEFT_CURLY_BRACE) {
                    braceEscaped = true;
                  }
                  continue;
                }
                if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
                  braces++;
                  while (eos() !== true && (code = advance())) {
                    if (code === CHAR_BACKWARD_SLASH) {
                      backslashes = token.backslashes = true;
                      advance();
                      continue;
                    }
                    if (code === CHAR_LEFT_CURLY_BRACE) {
                      braces++;
                      continue;
                    }
                    if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
                      isBrace = token.isBrace = true;
                      isGlob = token.isGlob = true;
                      finished = true;
                      if (scanToEnd === true) {
                        continue;
                      }
                      break;
                    }
                    if (braceEscaped !== true && code === CHAR_COMMA) {
                      isBrace = token.isBrace = true;
                      isGlob = token.isGlob = true;
                      finished = true;
                      if (scanToEnd === true) {
                        continue;
                      }
                      break;
                    }
                    if (code === CHAR_RIGHT_CURLY_BRACE) {
                      braces--;
                      if (braces === 0) {
                        braceEscaped = false;
                        isBrace = token.isBrace = true;
                        finished = true;
                        break;
                      }
                    }
                  }
                  if (scanToEnd === true) {
                    continue;
                  }
                  break;
                }
                if (code === CHAR_FORWARD_SLASH) {
                  slashes.push(index);
                  tokens.push(token);
                  token = {
                    value: '',
                    depth: 0,
                    isGlob: false
                  };
                  if (finished === true) continue;
                  if (prev === CHAR_DOT && index === start + 1) {
                    start += 2;
                    continue;
                  }
                  lastIndex = index + 1;
                  continue;
                }
                if (opts.noext !== true) {
                  var isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
                  if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
                    isGlob = token.isGlob = true;
                    isExtglob = token.isExtglob = true;
                    finished = true;
                    if (code === CHAR_EXCLAMATION_MARK && index === start) {
                      negatedExtglob = true;
                    }
                    if (scanToEnd === true) {
                      while (eos() !== true && (code = advance())) {
                        if (code === CHAR_BACKWARD_SLASH) {
                          backslashes = token.backslashes = true;
                          code = advance();
                          continue;
                        }
                        if (code === CHAR_RIGHT_PARENTHESES) {
                          isGlob = token.isGlob = true;
                          finished = true;
                          break;
                        }
                      }
                      continue;
                    }
                    break;
                  }
                }
                if (code === CHAR_ASTERISK) {
                  if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
                  isGlob = token.isGlob = true;
                  finished = true;
                  if (scanToEnd === true) {
                    continue;
                  }
                  break;
                }
                if (code === CHAR_QUESTION_MARK) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  if (scanToEnd === true) {
                    continue;
                  }
                  break;
                }
                if (code === CHAR_LEFT_SQUARE_BRACKET) {
                  while (eos() !== true && (next = advance())) {
                    if (next === CHAR_BACKWARD_SLASH) {
                      backslashes = token.backslashes = true;
                      advance();
                      continue;
                    }
                    if (next === CHAR_RIGHT_SQUARE_BRACKET) {
                      isBracket = token.isBracket = true;
                      isGlob = token.isGlob = true;
                      finished = true;
                      break;
                    }
                  }
                  if (scanToEnd === true) {
                    continue;
                  }
                  break;
                }
                if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
                  negated = token.negated = true;
                  start++;
                  continue;
                }
                if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  if (scanToEnd === true) {
                    while (eos() !== true && (code = advance())) {
                      if (code === CHAR_LEFT_PARENTHESES) {
                        backslashes = token.backslashes = true;
                        code = advance();
                        continue;
                      }
                      if (code === CHAR_RIGHT_PARENTHESES) {
                        finished = true;
                        break;
                      }
                    }
                    continue;
                  }
                  break;
                }
                if (isGlob === true) {
                  finished = true;
                  if (scanToEnd === true) {
                    continue;
                  }
                  break;
                }
              }
              if (opts.noext === true) {
                isExtglob = false;
                isGlob = false;
              }
              var base = str;
              var prefix = '';
              var glob = '';
              if (start > 0) {
                prefix = str.slice(0, start);
                str = str.slice(start);
                lastIndex -= start;
              }
              if (base && isGlob === true && lastIndex > 0) {
                base = str.slice(0, lastIndex);
                glob = str.slice(lastIndex);
              } else if (isGlob === true) {
                base = '';
                glob = str;
              } else {
                base = str;
              }
              if (base && base !== '' && base !== '/' && base !== str) {
                if (isPathSeparator(base.charCodeAt(base.length - 1))) {
                  base = base.slice(0, -1);
                }
              }
              if (opts.unescape === true) {
                if (glob) glob = utils.removeBackslashes(glob);
                if (base && backslashes === true) {
                  base = utils.removeBackslashes(base);
                }
              }
              var state = {
                prefix: prefix,
                input: input,
                start: start,
                base: base,
                glob: glob,
                isBrace: isBrace,
                isBracket: isBracket,
                isGlob: isGlob,
                isExtglob: isExtglob,
                isGlobstar: isGlobstar,
                negated: negated,
                negatedExtglob: negatedExtglob
              };
              if (opts.tokens === true) {
                state.maxDepth = 0;
                if (!isPathSeparator(code)) {
                  tokens.push(token);
                }
                state.tokens = tokens;
              }
              if (opts.parts === true || opts.tokens === true) {
                var prevIndex;
                for (var idx = 0; idx < slashes.length; idx++) {
                  var n = prevIndex ? prevIndex + 1 : start;
                  var i = slashes[idx];
                  var value = input.slice(n, i);
                  if (opts.tokens) {
                    if (idx === 0 && start !== 0) {
                      tokens[idx].isPrefix = true;
                      tokens[idx].value = prefix;
                    } else {
                      tokens[idx].value = value;
                    }
                    depth(tokens[idx]);
                    state.maxDepth += tokens[idx].depth;
                  }
                  if (idx !== 0 || value !== '') {
                    parts.push(value);
                  }
                  prevIndex = i;
                }
                if (prevIndex && prevIndex + 1 < input.length) {
                  var _value = input.slice(prevIndex + 1);
                  parts.push(_value);
                  if (opts.tokens) {
                    tokens[tokens.length - 1].value = _value;
                    depth(tokens[tokens.length - 1]);
                    state.maxDepth += tokens[tokens.length - 1].depth;
                  }
                }
                state.slashes = slashes;
                state.parts = parts;
              }
              return state;
            };
            module.exports = scan;

            /***/
          }),
          /***/371: ( /***/function _(__unused_webpack_module, exports, __webpack_require__) {
            "use strict";

            var path = __webpack_require__(470);
            var win32 = process.platform === 'win32';
            var _webpack_require__3 = __webpack_require__(6),
              REGEX_BACKSLASH = _webpack_require__3.REGEX_BACKSLASH,
              REGEX_REMOVE_BACKSLASH = _webpack_require__3.REGEX_REMOVE_BACKSLASH,
              REGEX_SPECIAL_CHARS = _webpack_require__3.REGEX_SPECIAL_CHARS,
              REGEX_SPECIAL_CHARS_GLOBAL = _webpack_require__3.REGEX_SPECIAL_CHARS_GLOBAL;
            exports.isObject = function (val) {
              return val !== null && typeof val === 'object' && !Array.isArray(val);
            };
            exports.hasRegexChars = function (str) {
              return REGEX_SPECIAL_CHARS.test(str);
            };
            exports.isRegexChar = function (str) {
              return str.length === 1 && exports.hasRegexChars(str);
            };
            exports.escapeRegex = function (str) {
              return str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1');
            };
            exports.toPosixSlashes = function (str) {
              return str.replace(REGEX_BACKSLASH, '/');
            };
            exports.removeBackslashes = function (str) {
              return str.replace(REGEX_REMOVE_BACKSLASH, function (match) {
                return match === '\\' ? '' : match;
              });
            };
            exports.supportsLookbehinds = function () {
              var segs = process.version.slice(1).split('.').map(Number);
              if (segs.length === 3 && segs[0] >= 9 || segs[0] === 8 && segs[1] >= 10) {
                return true;
              }
              return false;
            };
            exports.isWindows = function (options) {
              if (options && typeof options.windows === 'boolean') {
                return options.windows;
              }
              return win32 === true || path.sep === '\\';
            };
            exports.escapeLast = function (input, char, lastIdx) {
              var idx = input.lastIndexOf(char, lastIdx);
              if (idx === -1) return input;
              if (input[idx - 1] === '\\') return exports.escapeLast(input, char, idx - 1);
              return "".concat(input.slice(0, idx), "\\").concat(input.slice(idx));
            };
            exports.removePrefix = function (input) {
              var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var output = input;
              if (output.startsWith('./')) {
                output = output.slice(2);
                state.prefix = './';
              }
              return output;
            };
            exports.wrapOutput = function (input) {
              var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
              var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
              var prepend = options.contains ? '' : '^';
              var append = options.contains ? '' : '$';
              var output = "".concat(prepend, "(?:").concat(input, ")").concat(append);
              if (state.negated === true) {
                output = "(?:^(?!".concat(output, ").*$)");
              }
              return output;
            };

            /***/
          }),
          /***/771: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var GetIntrinsic = __webpack_require__(210);
            var define = __webpack_require__(296);
            var hasDescriptors = __webpack_require__(44)();
            var gOPD = __webpack_require__(275);
            var $TypeError = GetIntrinsic('%TypeError%');
            var $floor = GetIntrinsic('%Math.floor%');
            module.exports = function setFunctionLength(fn, length) {
              if (typeof fn !== 'function') {
                throw new $TypeError('`fn` is not a function');
              }
              if (typeof length !== 'number' || length < 0 || length > 0xFFFFFFFF || $floor(length) !== length) {
                throw new $TypeError('`length` must be a positive 32-bit integer');
              }
              var loose = arguments.length > 2 && !!arguments[2];
              var functionLengthIsConfigurable = true;
              var functionLengthIsWritable = true;
              if ('length' in fn && gOPD) {
                var desc = gOPD(fn, 'length');
                if (desc && !desc.configurable) {
                  functionLengthIsConfigurable = false;
                }
                if (desc && !desc.writable) {
                  functionLengthIsWritable = false;
                }
              }
              if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
                if (hasDescriptors) {
                  define(fn, 'length', length, true, true);
                } else {
                  define(fn, 'length', length);
                }
              }
              return fn;
            };

            /***/
          }),
          /***/702: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            /*!
             * to-regex-range <https://github.com/micromatch/to-regex-range>
             *
             * Copyright (c) 2015-present, Jon Schlinkert.
             * Released under the MIT License.
             */
            var isNumber = __webpack_require__(130);
            var toRegexRange = function toRegexRange(min, max, options) {
              if (isNumber(min) === false) {
                throw new TypeError('toRegexRange: expected the first argument to be a number');
              }
              if (max === void 0 || min === max) {
                return String(min);
              }
              if (isNumber(max) === false) {
                throw new TypeError('toRegexRange: expected the second argument to be a number.');
              }
              var opts = _objectSpread({
                relaxZeros: true
              }, options);
              if (typeof opts.strictZeros === 'boolean') {
                opts.relaxZeros = opts.strictZeros === false;
              }
              var relax = String(opts.relaxZeros);
              var shorthand = String(opts.shorthand);
              var capture = String(opts.capture);
              var wrap = String(opts.wrap);
              var cacheKey = min + ':' + max + '=' + relax + shorthand + capture + wrap;
              if (toRegexRange.cache.hasOwnProperty(cacheKey)) {
                return toRegexRange.cache[cacheKey].result;
              }
              var a = Math.min(min, max);
              var b = Math.max(min, max);
              if (Math.abs(a - b) === 1) {
                var result = min + '|' + max;
                if (opts.capture) {
                  return "(".concat(result, ")");
                }
                if (opts.wrap === false) {
                  return result;
                }
                return "(?:".concat(result, ")");
              }
              var isPadded = hasPadding(min) || hasPadding(max);
              var state = {
                min: min,
                max: max,
                a: a,
                b: b
              };
              var positives = [];
              var negatives = [];
              if (isPadded) {
                state.isPadded = isPadded;
                state.maxLen = String(state.max).length;
              }
              if (a < 0) {
                var newMin = b < 0 ? Math.abs(b) : 1;
                negatives = splitToPatterns(newMin, Math.abs(a), state, opts);
                a = state.a = 0;
              }
              if (b >= 0) {
                positives = splitToPatterns(a, b, state, opts);
              }
              state.negatives = negatives;
              state.positives = positives;
              state.result = collatePatterns(negatives, positives, opts);
              if (opts.capture === true) {
                state.result = "(".concat(state.result, ")");
              } else if (opts.wrap !== false && positives.length + negatives.length > 1) {
                state.result = "(?:".concat(state.result, ")");
              }
              toRegexRange.cache[cacheKey] = state;
              return state.result;
            };
            function collatePatterns(neg, pos, options) {
              var onlyNegative = filterPatterns(neg, pos, '-', false, options) || [];
              var onlyPositive = filterPatterns(pos, neg, '', false, options) || [];
              var intersected = filterPatterns(neg, pos, '-?', true, options) || [];
              var subpatterns = onlyNegative.concat(intersected).concat(onlyPositive);
              return subpatterns.join('|');
            }
            function splitToRanges(min, max) {
              var nines = 1;
              var zeros = 1;
              var stop = countNines(min, nines);
              var stops = new Set([max]);
              while (min <= stop && stop <= max) {
                stops.add(stop);
                nines += 1;
                stop = countNines(min, nines);
              }
              stop = countZeros(max + 1, zeros) - 1;
              while (min < stop && stop <= max) {
                stops.add(stop);
                zeros += 1;
                stop = countZeros(max + 1, zeros) - 1;
              }
              stops = _toConsumableArray(stops);
              stops.sort(compare);
              return stops;
            }

            /**
             * Convert a range to a regex pattern
             * @param {Number} `start`
             * @param {Number} `stop`
             * @return {String}
             */

            function rangeToPattern(start, stop, options) {
              if (start === stop) {
                return {
                  pattern: start,
                  count: [],
                  digits: 0
                };
              }
              var zipped = zip(start, stop);
              var digits = zipped.length;
              var pattern = '';
              var count = 0;
              for (var i = 0; i < digits; i++) {
                var _zipped$i = _slicedToArray(zipped[i], 2),
                  startDigit = _zipped$i[0],
                  stopDigit = _zipped$i[1];
                if (startDigit === stopDigit) {
                  pattern += startDigit;
                } else if (startDigit !== '0' || stopDigit !== '9') {
                  pattern += toCharacterClass(startDigit, stopDigit, options);
                } else {
                  count++;
                }
              }
              if (count) {
                pattern += options.shorthand === true ? '\\d' : '[0-9]';
              }
              return {
                pattern: pattern,
                count: [count],
                digits: digits
              };
            }
            function splitToPatterns(min, max, tok, options) {
              var ranges = splitToRanges(min, max);
              var tokens = [];
              var start = min;
              var prev;
              for (var i = 0; i < ranges.length; i++) {
                var _max = ranges[i];
                var obj = rangeToPattern(String(start), String(_max), options);
                var zeros = '';
                if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
                  if (prev.count.length > 1) {
                    prev.count.pop();
                  }
                  prev.count.push(obj.count[0]);
                  prev.string = prev.pattern + toQuantifier(prev.count);
                  start = _max + 1;
                  continue;
                }
                if (tok.isPadded) {
                  zeros = padZeros(_max, tok, options);
                }
                obj.string = zeros + obj.pattern + toQuantifier(obj.count);
                tokens.push(obj);
                start = _max + 1;
                prev = obj;
              }
              return tokens;
            }
            function filterPatterns(arr, comparison, prefix, intersection, options) {
              var result = [];
              var _iterator16 = _createForOfIteratorHelper(arr),
                _step16;
              try {
                for (_iterator16.s(); !(_step16 = _iterator16.n()).done;) {
                  var ele = _step16.value;
                  var string = ele.string;

                  // only push if _both_ are negative...
                  if (!intersection && !contains(comparison, 'string', string)) {
                    result.push(prefix + string);
                  }

                  // or _both_ are positive
                  if (intersection && contains(comparison, 'string', string)) {
                    result.push(prefix + string);
                  }
                }
              } catch (err) {
                _iterator16.e(err);
              } finally {
                _iterator16.f();
              }
              return result;
            }

            /**
             * Zip strings
             */

            function zip(a, b) {
              var arr = [];
              for (var i = 0; i < a.length; i++) arr.push([a[i], b[i]]);
              return arr;
            }
            function compare(a, b) {
              return a > b ? 1 : b > a ? -1 : 0;
            }
            function contains(arr, key, val) {
              return arr.some(function (ele) {
                return ele[key] === val;
              });
            }
            function countNines(min, len) {
              return Number(String(min).slice(0, -len) + '9'.repeat(len));
            }
            function countZeros(integer, zeros) {
              return integer - integer % Math.pow(10, zeros);
            }
            function toQuantifier(digits) {
              var _digits = _slicedToArray(digits, 2),
                _digits$ = _digits[0],
                start = _digits$ === void 0 ? 0 : _digits$,
                _digits$2 = _digits[1],
                stop = _digits$2 === void 0 ? '' : _digits$2;
              if (stop || start > 1) {
                return "{".concat(start + (stop ? ',' + stop : ''), "}");
              }
              return '';
            }
            function toCharacterClass(a, b, options) {
              return "[".concat(a).concat(b - a === 1 ? '' : '-').concat(b, "]");
            }
            function hasPadding(str) {
              return /^-?(0+)\d/.test(str);
            }
            function padZeros(value, tok, options) {
              if (!tok.isPadded) {
                return value;
              }
              var diff = Math.abs(tok.maxLen - String(value).length);
              var relax = options.relaxZeros !== false;
              switch (diff) {
                case 0:
                  return '';
                case 1:
                  return relax ? '0?' : '0';
                case 2:
                  return relax ? '0{0,2}' : '00';
                default:
                  {
                    return relax ? "0{0,".concat(diff, "}") : "0{".concat(diff, "}");
                  }
              }
            }

            /**
             * Cache
             */

            toRegexRange.cache = {};
            toRegexRange.clearCache = function () {
              return toRegexRange.cache = {};
            };

            /**
             * Expose `toRegexRange`
             */

            module.exports = toRegexRange;

            /***/
          }),
          /***/384: ( /***/function _(module) {
            module.exports = function isBuffer(arg) {
              return arg && typeof arg === 'object' && typeof arg.copy === 'function' && typeof arg.fill === 'function' && typeof arg.readUInt8 === 'function';
            };

            /***/
          }),
          /***/955: ( /***/function _(__unused_webpack_module, exports, __webpack_require__) {
            "use strict";

            // Currently in sync with Node.js lib/internal/util/types.js
            // https://github.com/nodejs/node/commit/112cc7c27551254aa2b17098fb774867f05ed0d9
            var isArgumentsObject = __webpack_require__(584);
            var isGeneratorFunction = __webpack_require__(662);
            var whichTypedArray = __webpack_require__(430);
            var isTypedArray = __webpack_require__(692);
            function uncurryThis(f) {
              return f.call.bind(f);
            }
            var BigIntSupported = typeof BigInt !== 'undefined';
            var SymbolSupported = typeof Symbol !== 'undefined';
            var ObjectToString = uncurryThis(Object.prototype.toString);
            var numberValue = uncurryThis(Number.prototype.valueOf);
            var stringValue = uncurryThis(String.prototype.valueOf);
            var booleanValue = uncurryThis(Boolean.prototype.valueOf);
            if (BigIntSupported) {
              var bigIntValue = uncurryThis(BigInt.prototype.valueOf);
            }
            if (SymbolSupported) {
              var symbolValue = uncurryThis(Symbol.prototype.valueOf);
            }
            function checkBoxedPrimitive(value, prototypeValueOf) {
              if (typeof value !== 'object') {
                return false;
              }
              try {
                prototypeValueOf(value);
                return true;
              } catch (e) {
                return false;
              }
            }
            exports.isArgumentsObject = isArgumentsObject;
            exports.isGeneratorFunction = isGeneratorFunction;
            exports.isTypedArray = isTypedArray;

            // Taken from here and modified for better browser support
            // https://github.com/sindresorhus/p-is-promise/blob/cda35a513bda03f977ad5cde3a079d237e82d7ef/index.js
            function isPromise(input) {
              return typeof Promise !== 'undefined' && input instanceof Promise || input !== null && typeof input === 'object' && typeof input.then === 'function' && typeof input.catch === 'function';
            }
            exports.isPromise = isPromise;
            function isArrayBufferView(value) {
              if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
                return ArrayBuffer.isView(value);
              }
              return isTypedArray(value) || isDataView(value);
            }
            exports.isArrayBufferView = isArrayBufferView;
            function isUint8Array(value) {
              return whichTypedArray(value) === 'Uint8Array';
            }
            exports.isUint8Array = isUint8Array;
            function isUint8ClampedArray(value) {
              return whichTypedArray(value) === 'Uint8ClampedArray';
            }
            exports.isUint8ClampedArray = isUint8ClampedArray;
            function isUint16Array(value) {
              return whichTypedArray(value) === 'Uint16Array';
            }
            exports.isUint16Array = isUint16Array;
            function isUint32Array(value) {
              return whichTypedArray(value) === 'Uint32Array';
            }
            exports.isUint32Array = isUint32Array;
            function isInt8Array(value) {
              return whichTypedArray(value) === 'Int8Array';
            }
            exports.isInt8Array = isInt8Array;
            function isInt16Array(value) {
              return whichTypedArray(value) === 'Int16Array';
            }
            exports.isInt16Array = isInt16Array;
            function isInt32Array(value) {
              return whichTypedArray(value) === 'Int32Array';
            }
            exports.isInt32Array = isInt32Array;
            function isFloat32Array(value) {
              return whichTypedArray(value) === 'Float32Array';
            }
            exports.isFloat32Array = isFloat32Array;
            function isFloat64Array(value) {
              return whichTypedArray(value) === 'Float64Array';
            }
            exports.isFloat64Array = isFloat64Array;
            function isBigInt64Array(value) {
              return whichTypedArray(value) === 'BigInt64Array';
            }
            exports.isBigInt64Array = isBigInt64Array;
            function isBigUint64Array(value) {
              return whichTypedArray(value) === 'BigUint64Array';
            }
            exports.isBigUint64Array = isBigUint64Array;
            function isMapToString(value) {
              return ObjectToString(value) === '[object Map]';
            }
            isMapToString.working = typeof Map !== 'undefined' && isMapToString(new Map());
            function isMap(value) {
              if (typeof Map === 'undefined') {
                return false;
              }
              return isMapToString.working ? isMapToString(value) : value instanceof Map;
            }
            exports.isMap = isMap;
            function isSetToString(value) {
              return ObjectToString(value) === '[object Set]';
            }
            isSetToString.working = typeof Set !== 'undefined' && isSetToString(new Set());
            function isSet(value) {
              if (typeof Set === 'undefined') {
                return false;
              }
              return isSetToString.working ? isSetToString(value) : value instanceof Set;
            }
            exports.isSet = isSet;
            function isWeakMapToString(value) {
              return ObjectToString(value) === '[object WeakMap]';
            }
            isWeakMapToString.working = typeof WeakMap !== 'undefined' && isWeakMapToString(new WeakMap());
            function isWeakMap(value) {
              if (typeof WeakMap === 'undefined') {
                return false;
              }
              return isWeakMapToString.working ? isWeakMapToString(value) : value instanceof WeakMap;
            }
            exports.isWeakMap = isWeakMap;
            function isWeakSetToString(value) {
              return ObjectToString(value) === '[object WeakSet]';
            }
            isWeakSetToString.working = typeof WeakSet !== 'undefined' && isWeakSetToString(new WeakSet());
            function isWeakSet(value) {
              return isWeakSetToString(value);
            }
            exports.isWeakSet = isWeakSet;
            function isArrayBufferToString(value) {
              return ObjectToString(value) === '[object ArrayBuffer]';
            }
            isArrayBufferToString.working = typeof ArrayBuffer !== 'undefined' && isArrayBufferToString(new ArrayBuffer());
            function isArrayBuffer(value) {
              if (typeof ArrayBuffer === 'undefined') {
                return false;
              }
              return isArrayBufferToString.working ? isArrayBufferToString(value) : value instanceof ArrayBuffer;
            }
            exports.isArrayBuffer = isArrayBuffer;
            function isDataViewToString(value) {
              return ObjectToString(value) === '[object DataView]';
            }
            isDataViewToString.working = typeof ArrayBuffer !== 'undefined' && typeof DataView !== 'undefined' && isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1));
            function isDataView(value) {
              if (typeof DataView === 'undefined') {
                return false;
              }
              return isDataViewToString.working ? isDataViewToString(value) : value instanceof DataView;
            }
            exports.isDataView = isDataView;

            // Store a copy of SharedArrayBuffer in case it's deleted elsewhere
            var SharedArrayBufferCopy = typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : undefined;
            function isSharedArrayBufferToString(value) {
              return ObjectToString(value) === '[object SharedArrayBuffer]';
            }
            function isSharedArrayBuffer(value) {
              if (typeof SharedArrayBufferCopy === 'undefined') {
                return false;
              }
              if (typeof isSharedArrayBufferToString.working === 'undefined') {
                isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy());
              }
              return isSharedArrayBufferToString.working ? isSharedArrayBufferToString(value) : value instanceof SharedArrayBufferCopy;
            }
            exports.isSharedArrayBuffer = isSharedArrayBuffer;
            function isAsyncFunction(value) {
              return ObjectToString(value) === '[object AsyncFunction]';
            }
            exports.isAsyncFunction = isAsyncFunction;
            function isMapIterator(value) {
              return ObjectToString(value) === '[object Map Iterator]';
            }
            exports.isMapIterator = isMapIterator;
            function isSetIterator(value) {
              return ObjectToString(value) === '[object Set Iterator]';
            }
            exports.isSetIterator = isSetIterator;
            function isGeneratorObject(value) {
              return ObjectToString(value) === '[object Generator]';
            }
            exports.isGeneratorObject = isGeneratorObject;
            function isWebAssemblyCompiledModule(value) {
              return ObjectToString(value) === '[object WebAssembly.Module]';
            }
            exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;
            function isNumberObject(value) {
              return checkBoxedPrimitive(value, numberValue);
            }
            exports.isNumberObject = isNumberObject;
            function isStringObject(value) {
              return checkBoxedPrimitive(value, stringValue);
            }
            exports.isStringObject = isStringObject;
            function isBooleanObject(value) {
              return checkBoxedPrimitive(value, booleanValue);
            }
            exports.isBooleanObject = isBooleanObject;
            function isBigIntObject(value) {
              return BigIntSupported && checkBoxedPrimitive(value, bigIntValue);
            }
            exports.isBigIntObject = isBigIntObject;
            function isSymbolObject(value) {
              return SymbolSupported && checkBoxedPrimitive(value, symbolValue);
            }
            exports.isSymbolObject = isSymbolObject;
            function isBoxedPrimitive(value) {
              return isNumberObject(value) || isStringObject(value) || isBooleanObject(value) || isBigIntObject(value) || isSymbolObject(value);
            }
            exports.isBoxedPrimitive = isBoxedPrimitive;
            function isAnyArrayBuffer(value) {
              return typeof Uint8Array !== 'undefined' && (isArrayBuffer(value) || isSharedArrayBuffer(value));
            }
            exports.isAnyArrayBuffer = isAnyArrayBuffer;
            ['isProxy', 'isExternal', 'isModuleNamespaceObject'].forEach(function (method) {
              Object.defineProperty(exports, method, {
                enumerable: false,
                value: function value() {
                  throw new Error(method + ' is not supported in userland');
                }
              });
            });

            /***/
          }),
          /***/539: ( /***/function _(__unused_webpack_module, exports, __webpack_require__) {
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

            var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors || function getOwnPropertyDescriptors(obj) {
              var keys = Object.keys(obj);
              var descriptors = {};
              for (var i = 0; i < keys.length; i++) {
                descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
              }
              return descriptors;
            };
            var formatRegExp = /%[sdj%]/g;
            exports.format = function (f) {
              if (!isString(f)) {
                var objects = [];
                for (var i = 0; i < arguments.length; i++) {
                  objects.push(inspect(arguments[i]));
                }
                return objects.join(' ');
              }
              var i = 1;
              var args = arguments;
              var len = args.length;
              var str = String(f).replace(formatRegExp, function (x) {
                if (x === '%%') return '%';
                if (i >= len) return x;
                switch (x) {
                  case '%s':
                    return String(args[i++]);
                  case '%d':
                    return Number(args[i++]);
                  case '%j':
                    try {
                      return JSON.stringify(args[i++]);
                    } catch (_) {
                      return '[Circular]';
                    }
                  default:
                    return x;
                }
              });
              for (var x = args[i]; i < len; x = args[++i]) {
                if (isNull(x) || !isObject(x)) {
                  str += ' ' + x;
                } else {
                  str += ' ' + inspect(x);
                }
              }
              return str;
            };

            // Mark that a method should not be used.
            // Returns a modified function which warns once by default.
            // If --no-deprecation is set, then it is a no-op.
            exports.deprecate = function (fn, msg) {
              if (typeof process !== 'undefined' && process.noDeprecation === true) {
                return fn;
              }

              // Allow for deprecating things in the process of starting up.
              if (typeof process === 'undefined') {
                return function () {
                  return exports.deprecate(fn, msg).apply(this, arguments);
                };
              }
              var warned = false;
              function deprecated() {
                if (!warned) {
                  if (process.throwDeprecation) {
                    throw new Error(msg);
                  } else if (process.traceDeprecation) {
                    console.trace(msg);
                  } else {
                    console.error(msg);
                  }
                  warned = true;
                }
                return fn.apply(this, arguments);
              }
              return deprecated;
            };
            var debugs = {};
            var debugEnvRegex = /^$/;
            if (process.env.NODE_DEBUG) {
              var debugEnv = process.env.NODE_DEBUG;
              debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*').replace(/,/g, '$|^').toUpperCase();
              debugEnvRegex = new RegExp('^' + debugEnv + '$', 'i');
            }
            exports.debuglog = function (set) {
              set = set.toUpperCase();
              if (!debugs[set]) {
                if (debugEnvRegex.test(set)) {
                  var pid = process.pid;
                  debugs[set] = function () {
                    var msg = exports.format.apply(exports, arguments);
                    console.error('%s %d: %s', set, pid, msg);
                  };
                } else {
                  debugs[set] = function () {};
                }
              }
              return debugs[set];
            };

            /**
             * Echos the value of a value. Trys to print the value out
             * in the best way possible given the different types.
             *
             * @param {Object} obj The object to print out.
             * @param {Object} opts Optional options object that alters the output.
             */
            /* legacy: obj, showHidden, depth, colors*/
            function inspect(obj, opts) {
              // default options
              var ctx = {
                seen: [],
                stylize: stylizeNoColor
              };
              // legacy...
              if (arguments.length >= 3) ctx.depth = arguments[2];
              if (arguments.length >= 4) ctx.colors = arguments[3];
              if (isBoolean(opts)) {
                // legacy...
                ctx.showHidden = opts;
              } else if (opts) {
                // got an "options" object
                exports._extend(ctx, opts);
              }
              // set default options
              if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
              if (isUndefined(ctx.depth)) ctx.depth = 2;
              if (isUndefined(ctx.colors)) ctx.colors = false;
              if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
              if (ctx.colors) ctx.stylize = stylizeWithColor;
              return formatValue(ctx, obj, ctx.depth);
            }
            exports.inspect = inspect;

            // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
            inspect.colors = {
              'bold': [1, 22],
              'italic': [3, 23],
              'underline': [4, 24],
              'inverse': [7, 27],
              'white': [37, 39],
              'grey': [90, 39],
              'black': [30, 39],
              'blue': [34, 39],
              'cyan': [36, 39],
              'green': [32, 39],
              'magenta': [35, 39],
              'red': [31, 39],
              'yellow': [33, 39]
            };

            // Don't use 'blue' not visible on cmd.exe
            inspect.styles = {
              'special': 'cyan',
              'number': 'yellow',
              'boolean': 'yellow',
              'undefined': 'grey',
              'null': 'bold',
              'string': 'green',
              'date': 'magenta',
              // "name": intentionally not styling
              'regexp': 'red'
            };
            function stylizeWithColor(str, styleType) {
              var style = inspect.styles[styleType];
              if (style) {
                return "\x1B[" + inspect.colors[style][0] + 'm' + str + "\x1B[" + inspect.colors[style][1] + 'm';
              } else {
                return str;
              }
            }
            function stylizeNoColor(str, styleType) {
              return str;
            }
            function arrayToHash(array) {
              var hash = {};
              array.forEach(function (val, idx) {
                hash[val] = true;
              });
              return hash;
            }
            function formatValue(ctx, value, recurseTimes) {
              // Provide a hook for user-specified inspect functions.
              // Check that value is an object with an inspect function on it
              if (ctx.customInspect && value && isFunction(value.inspect) &&
              // Filter out the util module, it's inspect function is special
              value.inspect !== exports.inspect &&
              // Also filter out any prototype objects using the circular check.
              !(value.constructor && value.constructor.prototype === value)) {
                var ret = value.inspect(recurseTimes, ctx);
                if (!isString(ret)) {
                  ret = formatValue(ctx, ret, recurseTimes);
                }
                return ret;
              }

              // Primitive types cannot have properties
              var primitive = formatPrimitive(ctx, value);
              if (primitive) {
                return primitive;
              }

              // Look up the keys of the object.
              var keys = Object.keys(value);
              var visibleKeys = arrayToHash(keys);
              if (ctx.showHidden) {
                keys = Object.getOwnPropertyNames(value);
              }

              // IE doesn't make error fields non-enumerable
              // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
              if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
                return formatError(value);
              }

              // Some type of object without properties can be shortcutted.
              if (keys.length === 0) {
                if (isFunction(value)) {
                  var name = value.name ? ': ' + value.name : '';
                  return ctx.stylize('[Function' + name + ']', 'special');
                }
                if (isRegExp(value)) {
                  return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                }
                if (isDate(value)) {
                  return ctx.stylize(Date.prototype.toString.call(value), 'date');
                }
                if (isError(value)) {
                  return formatError(value);
                }
              }
              var base = '',
                array = false,
                braces = ['{', '}'];

              // Make Array say that they are Array
              if (isArray(value)) {
                array = true;
                braces = ['[', ']'];
              }

              // Make functions say that they are functions
              if (isFunction(value)) {
                var n = value.name ? ': ' + value.name : '';
                base = ' [Function' + n + ']';
              }

              // Make RegExps say that they are RegExps
              if (isRegExp(value)) {
                base = ' ' + RegExp.prototype.toString.call(value);
              }

              // Make dates with properties first say the date
              if (isDate(value)) {
                base = ' ' + Date.prototype.toUTCString.call(value);
              }

              // Make error with message first say the error
              if (isError(value)) {
                base = ' ' + formatError(value);
              }
              if (keys.length === 0 && (!array || value.length == 0)) {
                return braces[0] + base + braces[1];
              }
              if (recurseTimes < 0) {
                if (isRegExp(value)) {
                  return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
                } else {
                  return ctx.stylize('[Object]', 'special');
                }
              }
              ctx.seen.push(value);
              var output;
              if (array) {
                output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
              } else {
                output = keys.map(function (key) {
                  return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
                });
              }
              ctx.seen.pop();
              return reduceToSingleString(output, base, braces);
            }
            function formatPrimitive(ctx, value) {
              if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');
              if (isString(value)) {
                var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + '\'';
                return ctx.stylize(simple, 'string');
              }
              if (isNumber(value)) return ctx.stylize('' + value, 'number');
              if (isBoolean(value)) return ctx.stylize('' + value, 'boolean');
              // For some reason typeof null is "object", so special case here.
              if (isNull(value)) return ctx.stylize('null', 'null');
            }
            function formatError(value) {
              return '[' + Error.prototype.toString.call(value) + ']';
            }
            function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
              var output = [];
              for (var i = 0, l = value.length; i < l; ++i) {
                if (hasOwnProperty(value, String(i))) {
                  output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
                } else {
                  output.push('');
                }
              }
              keys.forEach(function (key) {
                if (!key.match(/^\d+$/)) {
                  output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
                }
              });
              return output;
            }
            function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
              var name, str, desc;
              desc = Object.getOwnPropertyDescriptor(value, key) || {
                value: value[key]
              };
              if (desc.get) {
                if (desc.set) {
                  str = ctx.stylize('[Getter/Setter]', 'special');
                } else {
                  str = ctx.stylize('[Getter]', 'special');
                }
              } else {
                if (desc.set) {
                  str = ctx.stylize('[Setter]', 'special');
                }
              }
              if (!hasOwnProperty(visibleKeys, key)) {
                name = '[' + key + ']';
              }
              if (!str) {
                if (ctx.seen.indexOf(desc.value) < 0) {
                  if (isNull(recurseTimes)) {
                    str = formatValue(ctx, desc.value, null);
                  } else {
                    str = formatValue(ctx, desc.value, recurseTimes - 1);
                  }
                  if (str.indexOf('\n') > -1) {
                    if (array) {
                      str = str.split('\n').map(function (line) {
                        return '  ' + line;
                      }).join('\n').slice(2);
                    } else {
                      str = '\n' + str.split('\n').map(function (line) {
                        return '   ' + line;
                      }).join('\n');
                    }
                  }
                } else {
                  str = ctx.stylize('[Circular]', 'special');
                }
              }
              if (isUndefined(name)) {
                if (array && key.match(/^\d+$/)) {
                  return str;
                }
                name = JSON.stringify('' + key);
                if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
                  name = name.slice(1, -1);
                  name = ctx.stylize(name, 'name');
                } else {
                  name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                  name = ctx.stylize(name, 'string');
                }
              }
              return name + ': ' + str;
            }
            function reduceToSingleString(output, base, braces) {
              var numLinesEst = 0;
              var length = output.reduce(function (prev, cur) {
                numLinesEst++;
                if (cur.indexOf('\n') >= 0) numLinesEst++;
                return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
              }, 0);
              if (length > 60) {
                return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
              }
              return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
            }

            // NOTE: These type checking functions intentionally don't use `instanceof`
            // because it is fragile and can be easily faked with `Object.create()`.
            exports.types = __webpack_require__(955);
            function isArray(ar) {
              return Array.isArray(ar);
            }
            exports.isArray = isArray;
            function isBoolean(arg) {
              return typeof arg === 'boolean';
            }
            exports.isBoolean = isBoolean;
            function isNull(arg) {
              return arg === null;
            }
            exports.isNull = isNull;
            function isNullOrUndefined(arg) {
              return arg == null;
            }
            exports.isNullOrUndefined = isNullOrUndefined;
            function isNumber(arg) {
              return typeof arg === 'number';
            }
            exports.isNumber = isNumber;
            function isString(arg) {
              return typeof arg === 'string';
            }
            exports.isString = isString;
            function isSymbol(arg) {
              return typeof arg === 'symbol';
            }
            exports.isSymbol = isSymbol;
            function isUndefined(arg) {
              return arg === void 0;
            }
            exports.isUndefined = isUndefined;
            function isRegExp(re) {
              return isObject(re) && objectToString(re) === '[object RegExp]';
            }
            exports.isRegExp = isRegExp;
            exports.types.isRegExp = isRegExp;
            function isObject(arg) {
              return typeof arg === 'object' && arg !== null;
            }
            exports.isObject = isObject;
            function isDate(d) {
              return isObject(d) && objectToString(d) === '[object Date]';
            }
            exports.isDate = isDate;
            exports.types.isDate = isDate;
            function isError(e) {
              return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
            }
            exports.isError = isError;
            exports.types.isNativeError = isError;
            function isFunction(arg) {
              return typeof arg === 'function';
            }
            exports.isFunction = isFunction;
            function isPrimitive(arg) {
              return arg === null || typeof arg === 'boolean' || typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'symbol' ||
              // ES6 symbol
              typeof arg === 'undefined';
            }
            exports.isPrimitive = isPrimitive;
            exports.isBuffer = __webpack_require__(384);
            function objectToString(o) {
              return Object.prototype.toString.call(o);
            }
            function pad(n) {
              return n < 10 ? '0' + n.toString(10) : n.toString(10);
            }
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            // 26 Feb 16:19:34
            function timestamp() {
              var d = new Date();
              var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(':');
              return [d.getDate(), months[d.getMonth()], time].join(' ');
            }

            // log is just a thin wrapper to console.log that prepends a timestamp
            exports.log = function () {
              console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
            };

            /**
             * Inherit the prototype methods from one constructor into another.
             *
             * The Function.prototype.inherits from lang.js rewritten as a standalone
             * function (not on Function.prototype). NOTE: If this file is to be loaded
             * during bootstrapping this function needs to be rewritten using some native
             * functions as prototype setup using normal JavaScript does not work as
             * expected during bootstrapping (see mirror.js in r114903).
             *
             * @param {function} ctor Constructor function which needs to inherit the
             *     prototype.
             * @param {function} superCtor Constructor function to inherit prototype from.
             */
            exports.inherits = __webpack_require__(717);
            exports._extend = function (origin, add) {
              // Don't do anything if add isn't an object
              if (!add || !isObject(add)) return origin;
              var keys = Object.keys(add);
              var i = keys.length;
              while (i--) {
                origin[keys[i]] = add[keys[i]];
              }
              return origin;
            };
            function hasOwnProperty(obj, prop) {
              return Object.prototype.hasOwnProperty.call(obj, prop);
            }
            var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;
            exports.promisify = function promisify(original) {
              if (typeof original !== 'function') throw new TypeError('The "original" argument must be of type Function');
              if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
                var fn = original[kCustomPromisifiedSymbol];
                if (typeof fn !== 'function') {
                  throw new TypeError('The "util.promisify.custom" argument must be of type Function');
                }
                Object.defineProperty(fn, kCustomPromisifiedSymbol, {
                  value: fn,
                  enumerable: false,
                  writable: false,
                  configurable: true
                });
                return fn;
              }
              function fn() {
                var promiseResolve, promiseReject;
                var promise = new Promise(function (resolve, reject) {
                  promiseResolve = resolve;
                  promiseReject = reject;
                });
                var args = [];
                for (var i = 0; i < arguments.length; i++) {
                  args.push(arguments[i]);
                }
                args.push(function (err, value) {
                  if (err) {
                    promiseReject(err);
                  } else {
                    promiseResolve(value);
                  }
                });
                try {
                  original.apply(this, args);
                } catch (err) {
                  promiseReject(err);
                }
                return promise;
              }
              Object.setPrototypeOf(fn, Object.getPrototypeOf(original));
              if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
                value: fn,
                enumerable: false,
                writable: false,
                configurable: true
              });
              return Object.defineProperties(fn, getOwnPropertyDescriptors(original));
            };
            exports.promisify.custom = kCustomPromisifiedSymbol;
            function callbackifyOnRejected(reason, cb) {
              // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
              // Because `null` is a special error value in callbacks which means "no error
              // occurred", we error-wrap so the callback consumer can distinguish between
              // "the promise rejected with null" or "the promise fulfilled with undefined".
              if (!reason) {
                var newReason = new Error('Promise was rejected with a falsy value');
                newReason.reason = reason;
                reason = newReason;
              }
              return cb(reason);
            }
            function callbackify(original) {
              if (typeof original !== 'function') {
                throw new TypeError('The "original" argument must be of type Function');
              }

              // We DO NOT return the promise as it gives the user a false sense that
              // the promise is actually somehow related to the callback's execution
              // and that the callback throwing will reject the promise.
              function callbackified() {
                var args = [];
                for (var i = 0; i < arguments.length; i++) {
                  args.push(arguments[i]);
                }
                var maybeCb = args.pop();
                if (typeof maybeCb !== 'function') {
                  throw new TypeError('The last argument must be of type Function');
                }
                var self = this;
                var cb = function cb() {
                  return maybeCb.apply(self, arguments);
                };
                // In true node style we process the callback on `nextTick` with all the
                // implications (stack, `uncaughtException`, `async_hooks`)
                original.apply(this, args).then(function (ret) {
                  process.nextTick(cb.bind(null, null, ret));
                }, function (rej) {
                  process.nextTick(callbackifyOnRejected.bind(null, rej, cb));
                });
              }
              Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
              Object.defineProperties(callbackified, getOwnPropertyDescriptors(original));
              return callbackified;
            }
            exports.callbackify = callbackify;

            /***/
          }),
          /***/430: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var forEach = __webpack_require__(29);
            var availableTypedArrays = __webpack_require__(83);
            var callBind = __webpack_require__(559);
            var callBound = __webpack_require__(924);
            var gOPD = __webpack_require__(275);
            var $toString = callBound('Object.prototype.toString');
            var hasToStringTag = __webpack_require__(410)();
            var g = typeof globalThis === 'undefined' ? __webpack_require__.g : globalThis;
            var typedArrays = availableTypedArrays();
            var $slice = callBound('String.prototype.slice');
            var getPrototypeOf = Object.getPrototypeOf; // require('getprototypeof');

            var $indexOf = callBound('Array.prototype.indexOf', true) || function indexOf(array, value) {
              for (var i = 0; i < array.length; i += 1) {
                if (array[i] === value) {
                  return i;
                }
              }
              return -1;
            };
            var cache = {
              __proto__: null
            };
            if (hasToStringTag && gOPD && getPrototypeOf) {
              forEach(typedArrays, function (typedArray) {
                var arr = new g[typedArray]();
                if (Symbol.toStringTag in arr) {
                  var proto = getPrototypeOf(arr);
                  var descriptor = gOPD(proto, Symbol.toStringTag);
                  if (!descriptor) {
                    var superProto = getPrototypeOf(proto);
                    descriptor = gOPD(superProto, Symbol.toStringTag);
                  }
                  cache['$' + typedArray] = callBind(descriptor.get);
                }
              });
            } else {
              forEach(typedArrays, function (typedArray) {
                var arr = new g[typedArray]();
                var fn = arr.slice || arr.set;
                if (fn) {
                  cache['$' + typedArray] = callBind(fn);
                }
              });
            }
            var tryTypedArrays = function tryAllTypedArrays(value) {
              var found = false;
              forEach(cache, function (getter, typedArray) {
                if (!found) {
                  try {
                    if ('$' + getter(value) === typedArray) {
                      found = $slice(typedArray, 1);
                    }
                  } catch (e) {/**/}
                }
              });
              return found;
            };
            var trySlices = function tryAllSlices(value) {
              var found = false;
              forEach(cache, function (getter, name) {
                if (!found) {
                  try {
                    getter(value);
                    found = $slice(name, 1);
                  } catch (e) {/**/}
                }
              });
              return found;
            };
            module.exports = function whichTypedArray(value) {
              if (!value || typeof value !== 'object') {
                return false;
              }
              if (!hasToStringTag) {
                var tag = $slice($toString(value), 8, -1);
                if ($indexOf(typedArrays, tag) > -1) {
                  return tag;
                }
                if (tag !== 'Object') {
                  return false;
                }
                // node < 0.6 hits here on real Typed Arrays
                return trySlices(value);
              }
              if (!gOPD) {
                return null;
              } // unknown engine
              return tryTypedArrays(value);
            };

            /***/
          }),
          /***/83: ( /***/function _(module, __unused_webpack_exports, __webpack_require__) {
            "use strict";

            var possibleNames = ['BigInt64Array', 'BigUint64Array', 'Float32Array', 'Float64Array', 'Int16Array', 'Int32Array', 'Int8Array', 'Uint16Array', 'Uint32Array', 'Uint8Array', 'Uint8ClampedArray'];
            var g = typeof globalThis === 'undefined' ? __webpack_require__.g : globalThis;
            module.exports = function availableTypedArrays() {
              var out = [];
              for (var i = 0; i < possibleNames.length; i++) {
                if (typeof g[possibleNames[i]] === 'function') {
                  out[out.length] = possibleNames[i];
                }
              }
              return out;
            };

            /***/
          })

          /******/
        };
        /************************************************************************/
        /******/ // The module cache
        /******/
        var __webpack_module_cache__ = {};
        /******/
        /******/ // The require function
        /******/
        function __webpack_require__(moduleId) {
          /******/ // Check if module is in cache
          /******/var cachedModule = __webpack_module_cache__[moduleId];
          /******/
          if (cachedModule !== undefined) {
            /******/return cachedModule.exports;
            /******/
          }
          /******/ // Create a new module (and put it into the cache)
          /******/
          var module = __webpack_module_cache__[moduleId] = {
            /******/ // no module.id needed
            /******/ // no module.loaded needed
            /******/exports: {}
            /******/
          };
          /******/
          /******/ // Execute the module function
          /******/
          __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
          /******/
          /******/ // Return the exports of the module
          /******/
          return module.exports;
          /******/
        }
        /******/
        /************************************************************************/
        /******/ /* webpack/runtime/global */
        /******/
        !function () {
          /******/__webpack_require__.g = function () {
            /******/if (typeof globalThis === 'object') return globalThis;
            /******/
            try {
              /******/return this || new Function('return this')();
              /******/
            } catch (e) {
              /******/if (typeof window === 'object') return window;
              /******/
            }
            /******/
          }();
          /******/
        }();
        /******/
        /************************************************************************/
        /******/
        /******/ // startup
        /******/ // Load entry module and return exports
        /******/ // This entry module is referenced by other modules so it can't be inlined
        /******/
        var __webpack_exports__ = __webpack_require__(850);
        /******/
        /******/
        return __webpack_exports__;
        /******/
      }();
    });
  }();
})();