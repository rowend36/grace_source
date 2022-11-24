define(function (require, exports, module) {
    'use strict';
    var applyChanges = require('grace/ext/language/base_client').ClientUtils
        .applyChanges;
    var Utils = require('grace/core/utils').Utils;
    var waterfall = Utils.waterfall;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var expect = require('chai').expect;
    var appEvents = require('grace/core/app_events').AppEvents;
    var expect = require('chai').expect;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var Utils = require('grace/core/utils').Utils;
    var ServerHost = require('grace/ext/language/server_host').ServerHost;
    var override = require('override');
    var revert = require('revert');
    const ensureCb = require('ensureCb');
    require('ace!mode/javascript');
    exports.createTests = function (provider) {
        var editor, plugin;
        function warn() {
            console.warn(
                'Changing Session during test!!! ' + new Error().stack
            );
        }
        function stage(lines) {
            var cursor = lines
                .replace(
                    /\n/g,
                    editor.session.getDocument().getNewLineCharacter()
                )
                .indexOf('^');
            editor.setValue(lines.replace('^', ''));
            editor.clearSelection();
            cursor = editor.session.getDocument().indexToPosition(cursor);
            editor.selection.moveCursorTo(cursor.row, cursor.column);
        }

        before(function (done) {
            done = ensureCb(done);
            editor = getEditor();
            editor.on('changeSession', warn);
            override(provider, 'priority', Infinity);
            ServerHost.registerProvider(provider);
            Utils.waterfall([
                function (n) {
                    provider.init(editor, n);
                },
                function () {
                    plugin = editor[provider.name];
                    expect(plugin).to.be.ok;
                },
                done,
            ]);
        });
        after(function () {
            editor.off('changeSession', warn);
            revert(provider, 'priority');
            ServerHost.registerProvider(provider);
        });
        it('should be registered', function () {
            editor.session.setMode('ace/mode/javascript');
            expect(editor.session.getModeName()).to.equal('javascript');
            appEvents.signal('resumeAutocomplete');
            editor.execCommand('startAutocomplete');
            expect(editor.$activeProviders).to.include(provider);
            expect(editor.getMainCompleter()).to.equal(plugin);
        });
        var loaded = false;
        it('!setup', function (done) {
            this.timeout(plugin.queryTimeout * 2); //Take up to 7s for first start
            waterfall([
                function (n) {
                    stage('document.^');
                    plugin.resetDocs(editor);
                    plugin.getCompletions(editor, null, null, null, n);
                },
                true,
                function (err) {
                    loaded = !err;
                    done(err);
                },
            ]);
        });
        it('should fulfil spec for normalizeName', function () {
            expect(plugin.normalizeName('pako')).to.equal(
                plugin.normalizeName(plugin.normalizeName('pako'))
            );
            expect(plugin.normalizeName('///pako')).to.equal(
                plugin.normalizeName(plugin.normalizeName('///pako'))
            );
            expect(plugin.normalizeName('plugin.md')).to.equal(
                plugin.normalizeName(plugin.normalizeName('plugin.md'))
            );
            expect(plugin.normalizeName('current.js')).to.equal(
                plugin.normalizeName(plugin.normalizeName('current.js'))
            );

            expect(
                plugin.normalizeName(plugin.normalizeName('current.js'))
            ).to.equal('current.js');
        });
        it('should get completions', function (done) {
            if (!loaded) return this.skip();
            waterfall([
                function (n) {
                    stage('document.^');
                    plugin.getCompletions(editor, null, null, null, n);
                },
                function (err, res) {
                    expect(res).to.be.an('array');
                    expect(
                        res.map(function (e) {
                            return e.value;
                        })
                    ).to.include.members(['getElementById', 'activeElement']);
                },
                done,
            ]);
        });
        it('should show type', function (done) {
            if (!loaded) return this.skip();
            waterfall([
                function (n) {
                    stage('var a^ = "hi"');
                    plugin.requestType(editor, null, n);
                },
                function (err, res) {
                    expect(res).to.be.ok;
                    if (res.name) expect(res.name).to.equal('string');
                },
                done,
            ]);
        });
        it('should rename items', function (done) {
            if (!loaded) return this.skip();
            waterfall([
                function (n) {
                    n = ensureCb(n);
                    stage('var a^ = "hi"\na="hello"');
                    plugin.setupForRename(editor, 'pako', n);
                },
                function (n, e, data) {
                    expect(data).to.be.ok;
                    n = ensureCb(n);
                    applyChanges(plugin, data.refs, 'pako', n);
                },
                function (results) {
                    expect(results.replaced).to.equal(2);
                    expect(editor.getValue()).to.equal(
                        'var pako = "hi"\npako="hello"'
                    );
                },
                done,
            ]);
        });
        it('should get definition', function (done) {
            if (!loaded) return this.skip();
            waterfall([
                function (n) {
                    n = ensureCb(n);
                    stage(
                        '\
var foo = "hi:"\n\
function pop(foo){\n\
  foo="hello"\n\
}\n\
pop(foo^)'
                    );
                    plugin.jumpToDef(editor, n);
                },
                function (n) {
                    var c = editor.selection.getRange();
                    expect(c.start).to.eql({
                        row: 0,
                        column: 4,
                    });
                    expect(c.end).to.eql({
                        row: 0,
                        column: 7,
                    });
                    stage(
                        '\
var foo = "hi:"\n\
function pop(foo){\n\
  foo^="hello"\n\
}\n\
pop(foo)'
                    );
                    n = ensureCb(n);
                    plugin.jumpToDef(editor, n);
                },
                function () {
                    var c = editor.selection.getRange();
                    expect(c.start).to.eql({
                        row: 1,
                        column: 13,
                    });
                    expect(c.end).to.eql({
                        row: 1,
                        column: 16,
                    });
                },
                done,
            ]);
        });

        it('should apply formatting', function (done) {
            if (!loaded) return this.skip();
            if (!plugin.format) return this.skip();
            waterfall([
                function (n) {
                    stage('\
function pop(foo){\n\
foo=hello\n\
}');
                    plugin.format(
                        editor.session,
                        {
                            indent_char: ' ',
                            indent_size: 4,
                        },
                        n
                    );
                },
                function (n) {
                    expect(editor.session.getLine(1)).to.equal(
                        '    foo = hello'
                    );
                },
                done,
            ]);
        });
    };
});