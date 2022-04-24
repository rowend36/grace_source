define(function(require,exports,module) {
    var Config = require("./edit_config");
    var config = Config.registerAll({
        "filters": {
            "ignore": ["*should not be qualified*"],
            "setInfo": [],
            "setWarning": [],
            "setError": [],
            "maxNumErrors": 200
        },
        "jshint": {
            // JSHint Default Configuration File (as on JSHint website)
            // See http://jshint.com/docs/ for more details

            "maxerr": 101, // {int} Maximum error before stopping
            "passfail": true,
            // Enforcing
            "bitwise": false, // true: Prohibit bitwise operators (&, |, ^, etc.)
            "camelcase": false, // true: Identifiers must be in camelCase
            "curly": false, // true: Require {} for every new block or scope
            "eqeqeq": false, // true: Require triple equals (===) for comparison
            "forin": false, // true: Require filtering for..in loops with obj.hasOwnProperty()
            "freeze": true, // true: prohibits overwriting prototypes of native objects such as Array, Date etc.
            "immed": false, // true: Require immediate invocations to be wrapped in parens e.g. `(function () { } ());`
            "latedef": false, // true: Require variables/functions to be defined before being used
            "newcap": false, // true: Require capitalization of all constructor functions e.g. `new F()`
            "noarg": true, // true: Prohibit use of `arguments.caller` and `arguments.callee`
            "noempty": false, // true: Prohibit use of empty blocks
            "nonbsp": true, // true: Prohibit "non-breaking whitespace" characters.
            "nonew": false, // true: Prohibit use of constructors for side-effects (without assignment)
            "plusplus": false, // true: Prohibit use of `++` and `--`
            "quotmark": false, // Quotation mark consistency:
            "undef": true, // true: Require all non-global variables to be declared (prevents global leaks)
            "unused": true, // Unused variables:
            "strict": false, // true: Requires all functions run in ES5 Strict Mode
            "maxparams": false, // {int} Max number of formal params allowed per function
            "maxdepth": false, // {int} Max depth of nested blocks (within functions)
            "maxstatements": false, // {int} Max number statements per function
            "maxcomplexity": false, // {int} Max cyclomatic complexity per function
            "maxlen": false, // {int} Max number of characters per line
            "varstmt": false, // true: Disallow any var statements. Only `let` and `const` are allowed.

            // Relaxing
            "asi": false, // true: Tolerate Automatic Semicolon Insertion (no semicolons)
            "boss": false, // true: Tolerate assignments where comparisons would be expected
            "debug": false, // true: Allow debugger statements e.g. browser breakpoints.
            "eqnull": false, // true: Tolerate use of `== null`
            "esversion": 8, // {int} Specify the ECMAScript version to which the code must adhere.
            "moz": true, // true: Allow Mozilla specific syntax (extends and overrides esnext features)
            // (ex: `for each`, multiple try/catch, function expression…)
            "evil": false, // true: Tolerate use of `eval` and `new Function()`
            "expr": true, // true: Tolerate `ExpressionStatement` as Programs
            "funcscope": false, // true: Tolerate defining variables inside control statements
            "globalstrict": true, // true: Allow global "use strict" (also enables 'strict')
            "iterator": false, // true: Tolerate using the `__iterator__` property
            "lastsemic": true, // true: Tolerate omitting a semicolon for the last statement of a 1-line block
            "laxbreak": false, // true: Tolerate possibly unsafe line breakings
            "laxcomma": false, // true: Tolerate comma-first style coding
            "loopfunc": false, // true: Tolerate functions being defined in loops
            "multistr": true, // true: Tolerate multi-line strings
            "noyield": false, // true: Tolerate generator functions with no yield statement in them.
            "notypeof": false, // true: Tolerate invalid typeof operator values
            "proto": false, // true: Tolerate using the `__proto__` property
            "scripturl": false, // true: Tolerate script-targeted URLs
            "shadow": false, // true: Allows re-define variables later in code e.g. `var x=1; x=2;`
            "sub": false, // true: Tolerate using `[]` notation when it can still be expressed in dot notation
            "supernew": false, // true: Tolerate `new function () { ... };` and `new Object;`
            "validthis": false, // true: Tolerate using this in a non-constructor function
            // Environments
            "browser": true, // Web Browser (window, document, etc)
            "browserify": false, // Browserify (node.js code in the browser)
            "couch": false, // CouchDB
            "devel": true, // Development/debugging (alert, confirm, etc)
            "dojo": false, // Dojo Toolkit
            "jasmine": false, // Jasmine
            "jquery": false, // jQuery
            "mocha": true, // Mocha
            "mootools": false, // MooTools
            "node": true, // Node.js
            "nonstandard": false, // Widely adopted globals (escape, unescape, etc)
            "phantom": false, // PhantomJS
            "prototypejs": false, // Prototype and Scriptaculous
            "qunit": false, // QUnit
            "rhino": false, // Rhino
            "shelljs": false, // ShellJS
            "typed": false, // Globals for typed array constructions
            "worker": false, // Web Workers
            "wsh": false, // Windows Scripting Host
            "yui": false, // Yahoo User Interface
            // Custom Globals
        }
    }, "linting");
    var Utils = require("grace/core/utils").Utils;
    Config.registerValues({
            "!root": "See http://jshint.com/docs/ for more details",
            "maxerr": "{int} Maximum error before stopping",
            "bitwise": "true: Prohibit bitwise operators (&, |, ^, etc.)",
            "camelcase": "true: Identifiers must be in camelCase",
            "curly": "true: Require {} for every new block or scope",
            "eqeqeq": "true: Require triple equals (===) for comparison",
            "forin": "true: Require filtering for..in loops with obj.hasOwnProperty()",
            "freeze": "true: prohibits overwriting prototypes of native objects, such as Array, Date etc.",
            "immed": "true: Require immediate invocations to be wrapped in parens e.g. `(function () { } ());`",
            "latedef": "true: Require variables/functions to be defined before being used",
            "newcap": "true: Require capitalization of all constructor, functions e.g. `new F()`",
            "noarg": "true: Prohibit use of `arguments.caller` and `arguments.callee`",
            "noempty": "true: Prohibit use of empty blocks",
            "nonbsp": "true: Prohibit 'non-breaking whitespace' characters.",
            "nonew": "true: Prohibit use of constructors for side-effects(without assignment)",
            "plusplus": "true: Prohibit use of `++` and `--`",
            "quotmark": {
                doc: "Quotation mark consistency:",
                values: [
                    [false, "do nothing (default)"],
                    [true, "ensure whatever is used is consistent"],
                    ["single", "require single quotes"],
                    ["double", "require double quotes"],
                ]
            },
            "undef": "true: Require all non-global variables to be declared (prevents global leaks)",
            "unused": {
                doc: "Unused variables:",
                values: [
                    [true, "all variables, last function parameter"],
                    ["vars", "all variables only"],
                    ["strict", "all variables, all function parameters"],
                    false
                ]
            },
            "strict": "true: Requires all functions run in ES5 Strict Mode",
            "maxparams": "{int} Max number of formal params allowed per function",
            "maxdepth": "{int} Max depth of nested blocks (within functions)",
            "maxstatements": "{int} Max number statements per function",
            "maxcomplexity": "{int} Max cyclomatic complexity per function",
            "maxlen": "{int} Max number of characters per line",
            "varstmt": "true: Disallow any var statements. Only `let` and `const` are allowed.",

            "asi": "true: Tolerate Automatic Semicolon Insertion (no semicolons)",
            "boss": "true: Tolerate assignments where comparisons would be expected",
            "debug": "true: Allow debugger statements e.g. browser breakpoints.",
            "eqnull": "true: Tolerate use of `== null`",
            "esversion": "{int} Specify the ECMAScript version to which the code must adhere.",
            "moz": "true: Allow Mozilla specific syntax (extends and overrides esnext features)\n (ex: `for each`, multiple try/catch, function expression…)",
            "evil": "true: Tolerate use of `eval` and `new Function()`",
            "expr": "true: Tolerate `ExpressionStatement` as Programs",
            "funcscope": "true: Tolerate defining variables inside control statements",
            "globalstrict": ' true: Allow global "use strict" (also enables", "strict")',
            "iterator": "true: Tolerate using the `__iterator__` property",
            "lastsemic": "true: Tolerate omitting a semicolon for the last statement of a 1-line block",
            "laxbreak": "true: Tolerate possibly unsafe line breakings",
            "laxcomma": "true: Tolerate comma-first style coding",
            "loopfunc": "true: Tolerate functions being defined in loops",
            "multistr": "true: Tolerate multi-line strings",
            "noyield": "true: Tolerate generator functions with no yield statement in them.",
            "notypeof": "true: Tolerate invalid typeof operator values",
            "proto": "true: Tolerate using the `__proto__` property",
            "scripturl": "true: Tolerate script-targeted URLs",
            "shadow": "true: Allows re-define variables later in code e.g.`var x=1; x=2;`",
            "sub": "true: Tolerate using `[]` notation when it can still be expressed in dot notation",
            "supernew": "true: Tolerate `new function () { ... };` and `new Object;`",
            "validthis": "true: Tolerate using this in a non-constructor function",
            "browser": "Web Browser (window, document, etc)",
            "browserify": "Browserify (node.js code in the browser)",
            "couch": "CouchDB",
            "devel": "Development/debugging (alert, confirm, etc)",
            "dojo": "Dojo Toolkit",
            "jasmine": "Jasmine",
            "jquery": "jQuery",
            "mocha": "Mocha",
            "mootools": "MooTools",
            "node": "Node.js",
            "nonstandard": "Widely adopted globals (escape, unescape, etc)",
            "phantom": "PhantomJS",
            "prototypejs": "Prototype and Scriptaculous",
            "qunit": "QUnit",
            "rhino": "Rhino",
            "shelljs": "ShellJS",
            "typed": "Globals for typed array constructions",
            "worker": "Web Workers",
            "wsh": "Windows Scripting Host",
            "yui": "Yahoo User Interface",
            // Custom Globals
            "globals": "Additional predefined global variables"
        },
        "linting.jshint");

    var typeFilter = {
        type: ["string"]
    };
    Config.registerValues({
            "filters": "Modify how errors are displayed. Use document flag fl-lintFilters to add document specific options ",
            "filters.ignore": {
                type: typeFilter.type,
                doc: "A list of warnings/errors to suppress, suppressed warnings will be replaced with a single annotation. You can use * to represent any extra characters."
            },
            "filters.setError": typeFilter,
            "filters.setInfo": typeFilter,
            "filters.setWarning": typeFilter
        },
        "linting");
    //Hack to save this as a single value
    var jshintGlobals = Config.getObj("linting.jshint.globals", {});
    Config.setHandler("linting.jshint.globals", {
        getValue: function() {
            return jshintGlobals;
        },
        updateValue: function(from, overwrite, opts) {
            if (!from || typeof from != 'object' || Array.isArray(from)) {
                require("grace/ui/notify").Notify.error("Invalid option value for jshint.globals");
                return true;
            }
            if (opts && opts.depth) {
                //this should be loadsettings:deepSet or aceinlinediff:extend when opts.depth>1
                from = Object.assign(jshintGlobals, from);
            }
            if (overwrite) Config.putObj("linting.jshint.globals", from);
            jshintGlobals = from;
            liveUpdate();
        }
    });
    var liveUpdate = require("grace/core/utils").Utils.delay(function() {
        for (var id in docs) {
            var workers = ace.require("ace/annotations").Annotations.listWorkers(docs[id].session);
            workers.forEach(update);
        }
    }, 300);
    var docs = require("grace/docs/document").docs;
    var appEvents = require("grace/core/events").AppEvents;

    function setOptions(id, worker) {
        switch (id) {
            case "ace/mode/javascript":
                worker.call("setOptions", [Object.assign({}, config.jshint, {
                    globals: jshintGlobals
                })]);
        }
    }

    function update(m) {
        setOptions(m.id, m.worker);
    }

    function transform(e) {
        return new RegExp("^" + Utils.regEscape(String(e)).replace(/\s\s+/, " ").replace(/\\\*/g, ".*") + "$");
    }
    var filterAll = function(anno) {
        // var mode = this.session.getMode().$id.split("/").pop();
        //todo use the source of the annotation
        var regexIgnore = config.filters.ignore.map(transform);
        var regexError = config.filters.setError.map(transform);
        var regexInfo = config.filters.setInfo.map(transform);
        var regexWarning = config.filters.setWarning.map(transform);
        var maxNumErrors = parseInt(config.filters.maxNumErrors);
        if (this.flags && this.flags.linting) {
            var opts = this.flags.linting;
            if (opts.ignore)
                regexIgnore.push.apply(regexIgnore, opts.ignore);
            if (opts.setError)
                regexIgnore.push.apply(regexIgnore, opts.ignore);
            if (opts.setWarning)
                regexWarning.push.apply(regexWarning, opts.warning);
            if (opts.setInfo)
                regexInfo.push.apply(regexInfo, opts.setInfo);
            if (opts.maxNumErrors)
                maxNumErrors = parseInt(opts.maxNumErrors);
        }
        var found = 0;
        var last;

        if (regexIgnore.length ||
            regexWarning.length ||
            regexInfo.length ||
            regexError.length
        ) {
            anno = anno.filter(function(e) {
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
        if (found) {
            anno.push({
                row: last || this.session.getLength() - 1,
                column: 0,
                text: "Suppressed " + Utils.plural(found, "warning") + ".",
                type: 'info'
            });
        }
        return anno;
    };

    function trackDoc(doc) {
        doc.session.annotationFilters = [filterAll.bind(doc)];
        doc.session.on("startWorker", update);
        var workers = ace.require("ace/annotations").Annotations.listWorkers(doc.session);
        workers.forEach(update);
    }
    for (var id in docs) {
        trackDoc(docs[id]);
    }
    appEvents.on("createDoc", function(e) {
        trackDoc(e.doc);
    });

});