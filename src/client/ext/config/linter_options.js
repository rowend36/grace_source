define(function (require, exports, module) {
    var Utils = require('grace/core/utils').Utils;
    var Schema = require('grace/core/schema').Schema;
    var Config = require('grace/core/config').Config;
    var appEvents = require('grace/core/app_events').AppEvents;
    var Docs = require('grace/docs/docs').Docs;
    Config.registerAll(
        {
            ignore: ['*should not be qualified*'],
            setInfo: [],
            setWarning: [],
            setError: [],
            maxNumErrors: 200,
            showSuppressed: true,
        },
        'linting.filters'
    );
    /**
     * Handles the filtering of output for linters.
     **/
    var typeFilter = {
        type: ['string'],
    };
    Config.registerInfo(
        {
            '!root': 'Modify how errors are displayed. Uses resource context.',
            ignore: {
                type: ['string'],
                doc:
                    'A list of warnings/errors to suppress, suppressed warnings will be replaced with a single annotation. Accepts * as a wildcard to represent any extra characters.',
            },
            setError: {
                type: ['string'],
                doc: 'Diagnostics that must be shown as errors',
            },
            setInfo: typeFilter,
            setWarning: typeFilter,
        },
        'linting.filters'
    );

    function transform(e) {
        return new RegExp(
            '^' +
                Utils.regEscape(String(e))
                    .replace(/\s+/, '\\s+')
                    .replace(/(\\\*)+/g, '.*') +
                '$'
        );
    }
    
    /** @this Doc*/
    var filterAll = function (anno) {
        var config = Config.forPath(this.getSavePath(),'linting.filters');
        var regexIgnore = config.ignore.map(transform);
        var regexError = config.setError.map(transform);
        var regexInfo = config.setInfo.map(transform);
        var regexWarning = config.setWarning.map(transform);
        var maxNumErrors = parseInt(config.maxNumErrors);

        var found = 0;
        var last;

        if (
            regexIgnore.length ||
            regexWarning.length ||
            regexInfo.length ||
            regexError.length
        ) {
            anno = anno.filter(function (e) {
                function test(t) {
                    return t.test(e.text);
                }
                if (regexIgnore.some(test)) {
                    found++;
                    last = e.row;
                    return false;
                }
                if (regexError.some(test)) {
                    e.type = 'error';
                } else if (regexWarning.some(test)) {
                    e.type = 'warning';
                } else if (regexInfo.some(test)) {
                    e.type = 'info';
                }
                return true;
            });
        }
        if (maxNumErrors && anno.length > maxNumErrors) {
            found = anno.length - maxNumErrors;
            last = anno[maxNumErrors].row;
            anno = anno.slice(0, maxNumErrors);
        }
        if (found && config.showSuppressed) {
            anno.push({
                row: last || this.session.getLength() - 1,
                column: 0,
                text: 'Suppressed ' + Utils.plural(found, 'warning') + '.',
                type: 'info',
            });
        }
        return anno;
    };

    Config.registerAll(
        {
            // JSHint Default Configuration File (as on JSHint website)
            // See http://jshint.com/docs/ for more details
            maxerr: 101,
            passfail: true,
            // Enforcing
            bitwise: false,
            camelcase: false,
            curly: false,
            eqeqeq: false,
            forin: false,
            freeze: true,
            immed: false,
            latedef: false,
            newcap: false,
            noarg: true,
            noempty: false,
            nonbsp: true,
            nonew: false,
            plusplus: false,
            quotmark: false,
            undef: true,
            unused: true,
            strict: false,
            maxparams: false,
            maxdepth: false,
            maxstatements: false,
            maxcomplexity: false,
            maxlen: false,
            varstmt: false,

            // Relaxing
            asi: false,
            boss: false,
            debug: false,
            eqnull: false,
            esversion: 8,
            moz: true,
            evil: false,
            expr: true,
            funcscope: false,
            globalstrict: true,
            iterator: false,
            lastsemic: true,
            laxbreak: false,
            laxcomma: false,
            loopfunc: false,
            multistr: true,
            noyield: false,
            notypeof: false,
            proto: false,
            scripturl: false,
            shadow: false,
            sub: false,
            supernew: false,
            validthis: false,

            // Environments
            browser: true,
            browserify: false,
            couch: false,
            devel: true,
            dojo: false,
            jasmine: false,
            jquery: false,
            mocha: true,
            mootools: false,
            node: true,
            nonstandard: false,
            phantom: false,
            prototypejs: false,
            qunit: false,
            rhino: false,
            shelljs: false,
            typed: false,
            worker: false,
            wsh: false,
            yui: false,
            // Custom Globals
        },
        'linting.jshint'
    );
    Config.registerInfo(
        {
            '!root': 'Set options for jshint linter. Uses resource context. See http://jshint.com/docs/ for more details.',
            maxerr: 'Maximum number of errors before stopping.',
            bitwise: 'true: Prohibit bitwise operators (&, |, ^, etc.)',
            camelcase: 'true: Identifiers must be in camelCase',
            curly: 'true: Require {} for every new block or scope',
            eqeqeq: 'true: Require triple equals (===) for comparison',
            forin:
                'true: Require filtering for..in loops with obj.hasOwnProperty()',
            freeze:
                'true: prohibits overwriting prototypes of native objects, such as Array, Date etc.',
            immed:
                'true: Require immediate invocations to be wrapped in parens e.g. `(function () { } ());`',
            latedef:
                'true: Require variables/functions to be defined before being used',
            newcap:
                'true: Require capitalization of all constructor, functions e.g. `new F()`',
            noarg:
                'true: Prohibit use of `arguments.caller` and `arguments.callee`',
            noempty: 'true: Prohibit use of empty blocks',
            nonbsp: "true: Prohibit 'non-breaking whitespace' characters.",
            nonew:
                'true: Prohibit use of constructors for side-effects(without assignment)',
            plusplus: 'true: Prohibit use of `++` and `--`',
            quotmark: {
                doc: 'Quotation mark consistency:',
                values: [
                    [false, 'do nothing (default)'],
                    [true, 'ensure whatever is used is consistent'],
                    ['single', 'require single quotes'],
                    ['double', 'require double quotes'],
                ],
            },
            undef:
                'true: Require all non-global variables to be declared (prevents global leaks)',
            unused: {
                doc: 'Unused variables:',
                values: [
                    [true, 'all variables, last function parameter'],
                    ['vars', 'all variables only'],
                    ['strict', 'all variables, all function parameters'],
                    false,
                ],
            },
            strict: 'true: Requires all functions run in ES5 Strict Mode',
            maxparams: '{int} Max number of formal params allowed per function',
            maxdepth: '{int} Max depth of nested blocks (within functions)',
            maxstatements: '{int} Max number statements per function',
            maxcomplexity: '{int} Max cyclomatic complexity per function',
            maxlen: '{int} Max number of characters per line',
            varstmt:
                'true: Disallow any var statements. Only `let` and `const` are allowed.',

            asi: 'true: Tolerate Automatic Semicolon Insertion (no semicolons)',
            boss:
                'true: Tolerate assignments where comparisons would be expected',
            debug: 'true: Allow debugger statements e.g. browser breakpoints.',
            eqnull: 'true: Tolerate use of `== null`',
            esversion:
                '{int} Specify the ECMAScript version to which the code must adhere.',
            moz:
                'true: Allow Mozilla specific syntax (extends and overrides esnext features)\n (ex: `for each`, multiple try/catch, function expression…)',
            evil: 'true: Tolerate use of `eval` and `new Function()`',
            expr: 'true: Tolerate `ExpressionStatement` as Programs',
            funcscope:
                'true: Tolerate defining variables inside control statements',
            globalstrict:
                ' true: Allow global "use strict" (also enables", "strict")',
            iterator: 'true: Tolerate using the `__iterator__` property',
            lastsemic:
                'true: Tolerate omitting a semicolon for the last statement of a 1-line block',
            laxbreak: 'true: Tolerate possibly unsafe line breakings',
            laxcomma: 'true: Tolerate comma-first style coding',
            loopfunc: 'true: Tolerate functions being defined in loops',
            multistr: 'true: Tolerate multi-line strings',
            noyield:
                'true: Tolerate generator functions with no yield statement in them.',
            notypeof: 'true: Tolerate invalid typeof operator values',
            proto: 'true: Tolerate using the `__proto__` property',
            scripturl: 'true: Tolerate script-targeted URLs',
            shadow:
                'true: Allows re-define variables later in code e.g.`var x=1; x=2;`',
            sub:
                'true: Tolerate using `[]` notation when it can still be expressed in dot notation',
            supernew:
                'true: Tolerate `new function () { ... };` and `new Object;`',
            validthis:
                'true: Tolerate using this in a non-constructor function',
            browser: 'Web Browser (window, document, etc)',
            browserify: 'Browserify (node.js code in the browser)',
            couch: 'CouchDB',
            devel: 'Development/debugging (alert, confirm, etc)',
            dojo: 'Dojo Toolkit',
            jasmine: 'Jasmine',
            jquery: 'jQuery',
            mocha: 'Mocha',
            mootools: 'MooTools',
            node: 'Node.js',
            nonstandard: 'Widely adopted globals (escape, unescape, etc)',
            phantom: 'PhantomJS',
            prototypejs: 'Prototype and Scriptaculous',
            qunit: 'QUnit',
            rhino: 'Rhino',
            shelljs: 'ShellJS',
            typed: 'Globals for typed array constructions',
            worker: 'Web Workers',
            wsh: 'Windows Scripting Host',
            yui: 'Yahoo User Interface',
            globals: {
                doc: 'Additional predefined global variables',
                type: new Schema.XObject(),
            },
        },
        'linting.jshint'
    );

    Config.registerObj('globals', 'linting.jshint');

    var update = function (m) {
        switch (m.id) {
            case 'ace/mode/javascript':
                var config = Config.forPath(
                    this.getSavePath(),
                    'linting.jshint'
                );
                m.worker.call('setOptions', [config]);
        }
    };

    var liveUpdate = require('grace/core/utils').Utils.delay(function () {
        Docs.forEach(function (doc) {
            var workers = ace
                .require('ace/annotations')
                .Annotations.listWorkers(doc.session);
            workers.forEach(update, doc);
        });
    }, 300);
    Config.on('linting.jshint', liveUpdate);

    //Track all docs for linting
    function trackDoc(doc) {
        doc.session.annotationFilters = [filterAll.bind(doc)];
        doc.session.on('startWorker', update.bind(doc));
        var workers = ace
            .require('ace/annotations')
            .Annotations.listWorkers(doc.session);
        workers.forEach(update, doc);
    }
    Docs.forEach(trackDoc);
    appEvents.on('openDoc', function (e) {
        trackDoc(e.doc);
    });
});