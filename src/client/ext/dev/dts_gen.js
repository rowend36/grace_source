define(function () {
    /*
    Issues:mostly due to holes in my knowledeg of typescript syntax
    1 Invalid typescript syntax for function definitions based on : or => for return types
    2 Duplicate identifiers for nnamespace "exports"
    3 Does not add template types for Array and Promise etc 
    4 Exporting classes vs exporting instances of a class
    WONT FIX CUS CURRENT OUTTPUT IS GOOD ENOUGH
  */
    var Utils = require('grace/core/utils').Utils;
    var Objects = new WeakSet();
    addGlobalObjects();
    /**
   * @type {Window & {
     require: any
   }} window
   */
    require(['grace/core/parser', 'grace/docs/docs'], function () {
        let modules = require.s.contexts._.defined;
        var doc = require('grace/docs/docs').Docs.get(
            require('grace/docs/docs').openDoc('grace.d.ts', 'Loading...')
        );
        buffer = [];
        onChangeBuffer = Utils.delay(function () {
            doc.updateValue(buffer.join(''));
        }, 1000);
        try {
            Object.keys(modules)
                .sort()
                .forEach(function (m) {
                    print('declare module "', m, '" {');
                    if (modules[m] !== undefined) {
                        print('\n');
                        printModule(modules[m]);
                        print('\n');
                    }
                    print('}\n');
                });
        } finally {
            onChangeBuffer.now();
        }
    });
    var buffer = [],
        onChangeBuffer = () => {};
    /**
     * @typedef {{reset:()=>void,move:(size:number)=>void} & Cursor} EditableCursor
     * @typedef {((...tokens:string[])=>void)} Cursor
     * @type {Cursor} print
     */
    function print(...args) {
        buffer.push(...args);
    }
    /** @type {Cursor} */
    var declare;
    /**
     * @param {Partial<EditableCursor> & Cursor} from
     * @returns {EditableCursor}
     */
    function createCursor(from) {
        var start = new String();
        var end = new String();
        var s = -1,
            e = -1;
        var t = function (...args) {
            if (s > -1 && e > -1) {
                buffer.splice(e, 0, ...args);
                t.move(args.length);
            }
        };
        t.reset = function () {
            s = buffer[s] === start ? s : buffer.indexOf(start);
            e = buffer[e] === end ? e : buffer.indexOf(end);
            if (s > -1 && e > -1) {
                buffer.splice(s + 1, e - s - 1);
                t.move(s + 1 - e);
                onChangeBuffer();
            }
        };
        t.move = function (size) {
            e += size;
            if (from.move) from.move(size);
        };
        // @ts-ignore - Ignore warning about String being a wrapper object
        from(start, end);
        t.reset();
        return t;
    }
    function addGlobalObjects() {
        for (var i in window) {
            if (
                window[i] &&
                (typeof window[i] === 'function' ||
                    typeof window[i] === 'object')
            )
                Objects.add(window[i]);
        }
    }
    /** @type {(i:number)=>string} indent*/
    var indent = String.prototype.repeat.bind(' ');
    function printModule(exports) {
        var depth = 1;
        declare = createCursor(print);
        if (isFunction(exports)) {
            print(indent(depth));
            print('export = ');
            printExpr(exports, depth, exports.name, print);
        } else {
            print(indent(depth));
            print('const exports');
            printExpr(exports, depth, '', print);
            print('\n');
            print(indent(depth));
            print('export = exports');
        }
    }
    /**
 * @typedef {{
    type:keyof rules,
    text:string,
    children?:Node[],
    depth: number,
    parent?:ParentNode
  }} Node
 * @typedef {Node & {children:Node[]}} ParentNode
*/
    /** @param {Node} node
     * @returns {Node|undefined} prev
     */
    function prevSibling(node) {
        return (
            node.parent &&
            node.parent.children[node.parent.children.indexOf(node) - 1]
        );
    }
    var temp = safe;
    /**
     * @param {any} e
     * @param {number} depth
     * @param {string} name
     * @param {Cursor} cursor
     */
    function printExpr(e, depth, name, cursor) {
        if (typeof e === 'function') {
            if (
                name !== 'constructor' &&
                isConstructor(e) &&
                !Objects.has(e.prototype)
            ) {
                /*if (name !== e.name) */ cursor(name, ' : ', e.name);
                var m = getSuper(e);
                var n = getMixins(e);
                depth = 1; //fixed depth
                cursor = createCursor(declare);
                cursor(indent(depth));
                cursor(
                    'class ',
                    e.name,
                    m ? ' extends ' + m.name : '',
                    n.names.length
                        ? '/* mixins ' + n.names.join(', ') + ' */'
                        : '',
                    ' {'
                );
                var hasStatic = false;
                for (var i in e) {
                    if (i !== '__inspector' && !temp[i]) {
                        cursor('\n');
                        cursor(indent(depth + 1));
                        cursor('static ');
                        printExpr(e[i], depth + 1, i, cursor);
                        hasStatic = true;
                    }
                }
                if (
                    printProps(
                        e.prototype,
                        depth + 1,
                        m ? [...n.values, m.prototype] : n.values,
                        cursor
                    ) ||
                    hasStatic
                ) {
                    cursor('\n');
                    cursor(indent(depth));
                }
                cursor('}\n');
            } else {
                if (name === 'Rule') console.error('Rulename', e.name);
                cursor(name || e.name);
                if ((name || e.name)[0] == '"') cursor(' : ');
                printFunc(e, depth, cursor);
            }
        } else {
            cursor(name, ': ');
            if (typeof e === 'boolean') {
                cursor('boolean');
            } else if (typeof e === 'number') {
                cursor('number');
            } else if (typeof e === 'string') {
                cursor('string');
            } else if (!e) {
                cursor('any');
            } else {
                var props = e;
                if (!e.constructor || e.constructor === Object) {
                    if (!e.constructor || Objects.has(e)) return cursor('{}');
                } else {
                    cursor(e.constructor.name);
                    props = getOwnProps(e);
                    if (!props) return;
                    cursor(' & ');
                    if (Objects.has(e)) return cursor('{/*<recursive>*/}');
                    Objects.add(e);
                }
                cursor('{');
                if (printProps(props, depth + 1, null, cursor)) {
                    cursor('\n');
                    cursor(indent(depth));
                }
                cursor('}');
                if (e !== props) Objects.delete(e);
            }
        }
    }
    /**
     * @param {any} e
     * @param {number} depth
     * @param {Array<{}>|null} parents
     * @param {Cursor} cursor
     */

    function printProps(e, depth, parents, cursor) {
        Objects.add(e);
        var first = true;
        var keys = Object.keys(e).sort();
        keys.unshift('constructor');
        keys.splice(keys.lastIndexOf('constructor'), 1);
        outer: for (var o in keys) {
            var i = keys[o];
            if (i === '__inspector') continue;
            for (var j in parents) {
                if (e[i] === parents[j][i]) continue outer;
            }
            if (first) {
                first = false;
            }
            cursor('\n');
            cursor(indent(depth));
            printExpr(e[i], depth, safe(i), cursor);
        }
        return !first;
    }
    /**
     * @param {any} e
     * @param {number} depth
     * @param {Cursor} cursor
     */
    function printFunc(e, depth, cursor) {
        var depth = 0;
        var args = [];
        var currentArg = '';
        var hasCurrentArg = false;
        var inBody = false;
        var code = e.toString();
        var noReturn = code.indexOf('return') < 0;
        var isNative = noReturn && code.indexOf('[native') > -1;
        var returnTypes = [];
        var inNestedFunction = 0;
        /** @type Record<string,string[]> */
        var context = {};
        function getType(node) {
            switch (node && node.type) {
                case '[':
                    return 'Array';
                case '{':
                    return '{}';
                case 'string':
                case 'number':
                    return node.type;
                case 'constructor':
                    return node.text;
                case 'word':
                    switch (node.text) {
                        case 'function':
                            return 'Function';
                        //Unsafe assumption that cast types are the final type
                        //ie stuff like String(a).indexOf(p) will never happen
                        case 'parseInt':
                            return 'number';
                        case 'String':
                            return 'string';
                        case 'Boolean':
                            return 'boolean';
                    }
                    break;
                case 'atom':
                    switch (node.text) {
                        case 'null':
                        case 'undefined':
                            return node.text;
                        case 'true':
                        case 'false':
                            return 'boolean';
                    }
                    return '@' + node.text;
            }
        }
        walk(
            'start',
            code,
            /** @param {Node} node */
            function (node) {
                if (!node.children)
                    switch (node.type) {
                        case '[':
                        case '(':
                        case '{':
                            depth++;
                            if (node.type === '{' && depth === 1) inBody = true;
                            return;
                        case ']':
                        case ')':
                        case '}':
                            depth--;
                            if (depth === 0 && !inBody && node.type === ')') {
                                if (hasCurrentArg) {
                                    args.push(' , ', currentArg, ': any');
                                }
                                if (noReturn) throw CANCEL;
                            }
                            return;
                        case 'space':
                            return;
                    }
                if (inBody) {
                    if (
                        !inNestedFunction &&
                        node.type === 'word' &&
                        node.text === 'function'
                    ) {
                        inNestedFunction = node.depth;
                    } else if (inNestedFunction) {
                        if (node.depth < inNestedFunction - 1)
                            inNestedFunction = 0;
                        else if (node.depth < inNestedFunction)
                            switch (node.type) {
                                case '_//':
                                case '_/*':
                                    return;
                                case 'TOKEN':
                                    //skip the next two tokens
                                    if (
                                        node.children &&
                                        node.children[0] &&
                                        node.children[0].type !== 'word'
                                    ) {
                                        inNestedFunction = 0;
                                    }
                                    break;
                                default:
                            }
                    }
                    if (
                        !node.children ||
                        (node.type !== 'RETURNED' && node.type !== 'TOKEN')
                    )
                        return;
                    for (var i = 0; i < node.children.length; i++) {
                        if (
                            node.children[i].type !== '_/*' &&
                            node.children[i].type !== '_//' &&
                            node.children[i].type !== 'space' &&
                            node.children[i].type !== 'new'
                        )
                            break;
                    }
                    if (i === node.children.length) return;
                    if (node.type === 'RETURNED') {
                        if (inNestedFunction && node.depth >= inNestedFunction)
                            return;
                        var type = getType(node.children[i]);
                        if (type) returnTypes.push(type);
                    } else {
                        var type = getType(node.children[i]);
                        if (!type) return;
                        /* Look for stuff like
               b = a
               b = 'hello'
               b = '5'
               b = new Cons
            */
                        var path = ['atom', '='];
                        var prev = node;
                        //@ts-ignore - Stop warining that prev might be undefined.
                        while ((prev = prevSibling(prev))) {
                            if (prev.type === 'space') continue;
                            if (prev.type === '_//') continue;
                            if (prev.type === '_/*') continue;
                            if (prev.type !== path.pop()) return;
                            if (path.length === 0) {
                                var varTypes =
                                    context[prev.text] ||
                                    (context[prev.text] = []);
                                varTypes.push(type);
                                break;
                            }
                        }
                    }
                } else if (depth > 0) {
                    if (node.type === ',') {
                        args.push(' , ', currentArg, ': any');
                        currentArg = '';
                        hasCurrentArg = false;
                    } else if (
                        node.type === 'word' ||
                        node.type === 'atom' ||
                        node.type === '_/*' ||
                        node.type === '_//'
                    ) {
                        currentArg += node.text;
                        if (node.type[0] !== '_') hasCurrentArg = true;
                    }
                }
            }
        );
        var templates = [];
        args.forEach(function (e, i) {
            if (i % 3 !== 1) return;
            if (!context[e] && returnTypes.indexOf('@' + e) > -1) {
                var Letter = String.fromCharCode(
                    'T'.charCodeAt(0) + (i - 1) / 3
                );
                (context[e] || (context[e] = [])).push(Letter);
                templates.push(Letter);
                args[i + 1] = ': ' + Letter;
            }
        });
        var returnType = noReturn && !isNative ? 'void' : 'any';
        if (returnTypes.length) {
            context._all = returnTypes;
            resolve('@_all', 0, [], context);
            returnType = returnTypes.sort().filter(uniq).join('|');
            if (
                !returnType ||
                returnType === 'null' ||
                returnType === 'undefined'
            )
                returnType = 'any';
        }
        var edit = createCursor(cursor);
        printFuncType(edit, args.slice(1), templates, returnType);
        if (e.__inspector) {
            e.__inspector.watch(function (a, b, c) {
                args.forEach(function (e, i) {
                    if (i % 3 !== 1) return;
                    args[i + 1] = ': ' + a[(i - 1) / 3];
                });
                edit.reset();
                printFuncType(edit, args.slice(1), b, c);
            });
        }
    }
    function printFuncType(cursor, args, templates, returnType) {
        if (templates.length) {
            cursor('<');
            cursor(templates.join(', '));
            cursor('>');
        }
        cursor('(');
        cursor(...args);
        cursor(')', ' : ', returnType);
    }

    function uniq(e, i, arr) {
        return e !== arr[i - 1];
    }
    function resolve(e, i, arr, varTypes) {
        if (e === undefined || e[0] !== '@') return;
        arr.splice(i, 1);
        var t = varTypes[e.slice(1)] || [];
        for (var j = t.length; j-- > 0; ) resolve(t[j], j, t, varTypes);
        arr.splice(i, 0, ...t);
    }
    function safe(str) {
        return /^[_a-zA-Z\$][a-zA-Z\$_0-9]*$/.test(str)
            ? str
            : JSON.stringify(str);
    }
    function getSuper(e) {
        var m = Object.getPrototypeOf(e.prototype);
        if (
            e.super ||
            (m &&
                m.constructor !== Object &&
                isConstructor(m.constructor || {}))
        ) {
            return m.constructor;
        }
    }
    function getOwnProps(e) {
        var props = Object.keys(e);
        if (props.length) {
            var m = e.constructor;
            if (m === Storage) return;
            do {
                //Get props referenced by constructor;
                var text = m.toString();
                props = props.filter(function (prop) {
                    return (
                        /[a-zA-Z]/.test(prop[0]) &&
                        text.indexOf('this.' + prop) < 0
                    );
                });
            } while ((m = getSuper(m)));
            if (props.length) {
                return props.reduce(function (acc, a) {
                    acc[a] = e[a];
                    return acc;
                }, {});
            }
        }
    }
    function getMixins(e) {
        var possible = [
            'asyncTrigger',
            require('grace/core/events_emitter').EventsEmitter,
            'ref',
            require('grace/core/ref_counted').RefCounted,
        ];
        var mixins = {
            /** @type {string[]} */
            names: [],
            /** @type {{}[]} */
            values: [],
        };
        for (var i = 1; i < possible.length; i += 2) {
            if (
                e !== possible[i] &&
                e.prototype.hasOwnProperty(possible[i - 1]) &&
                typeof e.prototype[possible[i - 1]] === 'function' &&
                !(e.prototype instanceof possible[i])
            ) {
                mixins.names.push(possible[i].name);
                // mixins.values.push(possible[i].prototype);
            }
        }
        return mixins;
    }
    function isConstructor(e) {
        return e.name && /[A-Z]/.test(e.name[0]);
    }
    function isFunction(e) {
        return typeof e === 'function';
    }

    function wrap(start, inner, end) {
        return {
            rules: [start, 'space'],
            enter: inner,
            exit: end,
        };
    }
    function strings(...types) {
        return new RegExp(
            types
                .map(function (e) {
                    return e + '([^' + e + '\n\\\\]|\\\\.)*' + e;
                })
                .join('|')
        );
    }
    var parser;
    var CANCEL = {};
    var stack = [];
    function saveState() {
        stack.push({
            state: parser.getState(),
            ctx: parser.listener.stack,
        });
    }
    function restoreState() {
        let m = stack.pop();
        parser.setState(m.state);
        parser.listener.stack = m.ctx;
    }
    function walk(state, string, cb) {
        if (!parser) {
            parser = new (require('grace/core/parser').RuleParser)(rules);
            parser.listener = new (require('grace/core/parser').TreeListener)();
            // parser._debug = true;
        }
        saveState();
        parser.listener.constructor.call(parser.listener);
        parser.setState({
            state: state,
            text: string,
        });
        parser.listener.onParse = cb;
        try {
            parser.walk();
        } catch (e) {
            if (e !== CANCEL) {
                console.log(parser.listener.stack);
                print('/*', e.message, '*/');
            }
        }
        restoreState();
    }
    var rules = {
        start: {rules: ['space'], next: 'TOKENS'},
        TOKENS: {
            re: /[^\}\]\)]/,
            isLookAhead: true,
            enter: 'TOKEN',
            exit: 'plusTOKENS',
        },
        RETURNED: {
            next: 'TOKEN',
        },
        plusTOKENS: {rules: ['space'], maybe: 'TOKENS'},
        TOKEN: {
            rules: ['_comments?'],
            select: [
                'chain',
                'number',
                'string',
                'bvar',
                'bnew',
                'bret',
                ',',
                //Expr is a complex atom, ie too complex to be handled for now.
                'expr',
                'atom',
                '_(',
                '_{',
                '_[',
                //Depend on the fact that we are likely dealing with valid code
                //And stuff like x / 10 / is both rare and meaningless to us.
                'regex',
                'any',
                null,
            ],
        },

        '_comments?': {maybe: '_comments+'},
        '_comments+': {rules: ['comments', 'space'], maybe: '_comments+'},
        'TOKENS?': {maybe: 'TOKENS'},
        comments: {token: '/', isLookAhead: true, select: ['_/*', '_//']},
        expr: {rules: ['word', 'space'], select: ['chain', '_op', '_(', '_[']},
        word: /\b\w+\b/,
        constructor: /\b\w+\b/,
        //a = b
        atom: {re: /\b\w+\b/, maybe: 'assign'},
        assign: {rules: ['space', '=', 'space'], enter: 'TOKEN'},
        //var a = b
        bvar: {rules: ['var'], next: 'atom'},
        //new Name()
        bnew: {rules: ['new', 'space', 'constructor']},
        bret: {rules: ['return', 'space'], enter: 'RETURNED'},
        _op: {rules: ['op', 'space'], next: 'TOKEN'},
        op: /[\?\&\|][\?\&\|]?/, //TODO These ops can use the right-hand side to get type.
        chain: {rules: ['.', 'space'], maybe: 'expr'},
        '_(': wrap('(', 'TOKENS?', ')'),
        '_[': wrap('[', 'TOKENS?', ']'),
        '_{': wrap('{', 'TOKENS?', '}'),
        '_/*': /\/\*(?:[^\*]|\*[^/])*\*\//,
        '_//': /\/\/[^\n]*\n/,
        string: strings('"', "'"),
        regex: strings('/', '/'),
        var: /let|const|var/,
        new: /new/,
        return: /return/,
        number: /\d+/,
        '{': '{',
        '[': '[',
        '=': '=',
        '(': '(',
        ')': ')',
        ']': ']',
        '}': '}',
        ',': ',',
        '.': '.',
        '\n': '\n',
        '/*': {rules: ['/', '*']},
        '*/': {rules: ['*/', '/']},
        '//': {rules: ['/', '/']},
        '*': '*',
        '/': '/',
        space: /\s*/,
        any: /[^\}\]\)]/,
    };
});