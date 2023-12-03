define(function (require, exports, module) {
    /*globals $*/

    require('css!./libs/mocha.css');
    var chai = require('./libs/chai.js');
    var mocha = require('./libs/mocha.min.js');
    var splits = require('grace/ui/split_manager').SplitManager;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var Editors = require('grace/editor/editors').Editors;
    var Utils = require('grace/core/utils').Utils;
    require('../setup/setup_console');
    /*
        Already, there are a lot of runtime tests embedded in the code using Utils.assert
        Only the more expensive tests are kept separate
    */
    define('revert', function () {
        return function (o, prop) {
            if (o['no-prop-' + prop]) {
                delete o['no-prop-' + prop];
                delete o[prop];
            } else if (o.hasOwnProperty('default-' + prop)) {
                o[prop] = o['default-' + prop];
                delete o['default-' + prop];
            }
        };
    });
    define('override', function () {
        return function (o, prop, value) {
            var d = o[prop];
            if (!o['no-prop-' + prop] && !o.hasOwnProperty('default-' + prop)) {
                if (!o.hasOwnProperty(prop)) o['no-prop-' + prop] = true;
                else o['default-' + prop] = o[prop];
            }
            o[prop] = value;
            return d;
        };
    });
    var waiting = [];
    var data = new WeakMap();
    var _id = 1;
    var clearWaiting = Utils.debounce(function () {
        waiting.forEach(function (e) {
            var err = new Error(
                'Callback(' + data.get(e).id + ') never called'
            );
            err.stack = err.message + '\n' + data.get(e).stack;
            console.error(err);
            data.delete(e);
        });
        waiting.length = 0;
    }, 5000);
    define('ensureCb', function (require, exports, module) {
        module.exports = function (_cb) {
            function cb() {
                if (!data.has(cb)) console.error('Delayed callback ' + info.id);
                else if (Utils.removeFrom(waiting, cb) < 0) {
                    var err = new Error(
                        'Callback(' + info.id + ') called twice'
                    );
                    err.stack +=
                        '\n====Async====\n' +
                        info.stack +
                        '\n====First called====\n' +
                        info.firstCalled;
                    throw err;
                } else {
                    info.firstCalled = new Error('h').stack;
                }
                _cb.apply(this, arguments);
            }
            var info = {
                id: _id++,
                stack: String(new Error().stack)
                    .split('\n')
                    .slice(2)
                    .join('\n'),
            };
            waiting.push(cb);
            data.set(cb, info);
            clearWaiting();
            return cb;
        };
    });
    define('chai', chai);
    Error.stackTraceLimit = 30;
    ['Hammer', 'Base64', 'afs', 'lfs', 'rfs', 'git'].forEach(function (e) {
        window[e] || (window[e] = undefined);
    });
    Editors.onEach(function (editor) {
        //Used by tests to prevent recursion in stringify.
        Utils.defProp(editor, 'completers', editor.completers);
        Utils.defProp(editor, '$activeProviders', editor.$activeProviders);
        Utils.defProp(editor, 'renderer', editor.renderer);
        Utils.defProp(editor, 'session', editor.session);
        Utils.defProp(editor, '$minimap', editor.$minimap);
        Utils.defProp(editor, 'commands', editor.commands);
        Utils.defProp(editor, 'keyBinding', editor.keyBinding);
    });
    var editEl = getEditor().container;
    var container = splits.add($(editEl), 'vertical');
    $(container).append("<div id='mocha'></div>");
    mocha.setup('bdd');
    mocha.checkLeaks();

    require([
        './docs/test_docs',
        './core/test_core',
        './core/test_ajax',
        './core/test_schema',
        './core/test_fs',
        './core/test_parser',
        './ext/test_shared_store',
        './ext/test_glob',
        './ext/test_config',
        './ext/test_tab_window',
        './ext/test_language',
        './ext/test_diff',
        './ext/test_git',
    ], function () {
        mocha.run();
    });
});