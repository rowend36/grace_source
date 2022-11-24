define(function (require, exports, module) {
    var Utils = require('grace/core/utils').Utils;
    var getEditor = require('grace/setup/setup_editors').getEditor;
    var BaseClient = require('grace/ext/language/base_client').BaseClient;
    var Range = require('ace!range').Range;
    var S = require('grace/ext/language/base_client').ClientUtils;
    //Reuse methods from TsClient
    var TsClient = require('grace/ext/language/ts/ts_client').TsClient;
    var getDoc = S.getDoc;
    var vsLspProtocol = require('./libs/open_rpc_lsp').VSCodeLSP;
    var EditSession = require('ace!edit_session').EditSession;

    var CompletionTriggerKind = vsLspProtocol.CompletionTriggerKind;

    var CompletionItemKindMap = _MAP(vsLspProtocol.CompletionItemKind);
    CompletionItemKindMap[vsLspProtocol.CompletionItemKind.Variable] = 'var';
    CompletionItemKindMap[vsLspProtocol.CompletionItemKind.Constant] = 'const';
    CompletionItemKindMap[vsLspProtocol.CompletionItemKind.TypeParameter] =
        'type-parameter';
    CompletionItemKindMap[vsLspProtocol.CompletionItemKind.EnumMember] =
        'enum-member';

    var DiagnosticSeverityMap = _MAP(vsLspProtocol.DiagnosticSeverity);
    DiagnosticSeverityMap[vsLspProtocol.DiagnosticSeverity.Information] =
        'info';
    DiagnosticSeverityMap[vsLspProtocol.DiagnosticSeverity.Hint] = 'info';

    /**
     * @constructor
     */

    function LspClient(transport, options) {
        BaseClient.call(this, options);
        this.transport = {
            postMessage: function () {
                var m = arguments;
                transport.initialize(function () {
                    transformTsMessage.apply(transport, m);
                });
            },
            terminate: function () {
                transport.destroy();
            },
        };
        this.provider = transport.provider;
    }

    LspClient.prototype = {
        queryTimeout: 10000,
        sendFragments: false,
        $getPos: function (editor, pos) {
            return toLspPosition(pos || editor.getSelection().getCursor());
        },
        $toAceRefs: function (data) {
            var name;
            data = {
                refs: data.map(function (e) {
                    name = name || e.name;
                    return {
                        file: this.$unfixName(toFile(e.uri)),
                        start: toAceLoc(null, e.range.start),
                        end: toAceLoc(null, e.range.end),
                    };
                }, this),
            };
            data.name = name;
            return data;
        },
        trackChange: function (change, session) {
            if (!this.provider.hasSynchronization)
                this.invalidateDoc(getDoc(this, session));
            BaseClient.prototype.trackChange.call(this, change, session);
        },
        getCompletions: function (editor, session, pos, prefix, callback) {
            var self = this;
            this.ui.closeAllTips();
            editor = editor || getEditor();
            session = session || editor.session;
            pos = pos || session.selection.getCursor();
            var wasTriggered =
                //TODO stop guessing if it was triggered
                editor && editor.completer && editor.completer.autoInsert;
            var a, char;
            var trigKind, trigChar;
            if (
                !wasTriggered &&
                (a = this.transport.capabilities) &&
                (a = a.completionProvider) &&
                (a = a.triggerCharacters) &&
                (char = session.getLine(pos.row)[pos.column - 1]) &&
                a.indexOf(char) > -1
            ) {
                trigKind = CompletionTriggerKind.TriggerCharacter;
                trigChar = char;
            } else trigKind = CompletionTriggerKind.Invoked;

            this.send(
                'getCompletions',
                [
                    getDoc(this, session).name,
                    toLspPosition(pos),
                    trigKind,
                    trigChar,
                ],
                function (e, r) {
                    if (r) {
                        callback(e, buildCompletions(r, self));
                    } else callback(e);
                }
            );
        },
        requestRenameLocations: function (editor, newName, cb) {
            if (newName === null) newName = 'temp';
            var ts = this;
            this.send(
                'findRenameLocations',
                [
                    getDoc(this, editor.session).name,
                    this.$getPos(editor),
                    newName,
                ],
                function (e, r) {
                    cb(e, r && toAceChanges(ts, r));
                }
            );
        },
        setupForRename: function (editor, newName, cb, data) {
            BaseClient.prototype.setupForRename.call(
                this,
                editor,
                newName,
                cb,
                null
            );
        },
        requestAnnotations: function (editor, cb) {
            this.send('getAnnotations', editor, cb);
        },
        // Called by lsp_transport
        onAnnotations: function (uri, anno) {
            var file = this.$unfixName(toFile(uri));
            var data = this.hasDoc(file);
            if (data && data.doc) {
                this.trigger('annotate', {
                    data: toAceAnnotations(data.doc, anno),
                    session: data.doc,
                });
            } else {
                //unused
                console.debug('Ignored diagnostics for ', file);
                if (file.startsWith('temp:')) {
                    this.releaseDoc(file);
                }
            }
        },
        genInfoHtml: function (value, fromCompletion /*, fromCursorActivity*/) {
            return formatContents(fromCompletion ? value : value.contents);
        },
        getCallPos: function (editor, pos, cb) {
            switch (editor.session.getModeName()) {
                case 'javascript':
                case 'typescript':
                case 'tsx':
                case 'jsx':
                case 'c_cpp':
                case 'java':
                case 'python':
                    return BaseClient.prototype.getCallPos.apply(
                        this,
                        arguments
                    );
            }
            return cb(null, {
                activeIndex:
                    this.cachedArgHints && this.cachedArgHints.activeIndex,
                name: this.cachedArgHints && this.cachedArgHints.name,
                start: pos, //always update whenever pos changes
            });
        },
        genArgHintHtml: function (args, activeIndex) {
            var e = args.signatures[args.activeSignature || 0];

            var selected = !isNaN(activeIndex)
                ? activeIndex
                : e.hasOwnProperty('activeParameter')
                ? e.activeParameter
                : args.activeParameter;
            var prefix = e.label;

            var html = [];
            if (e.parameters) {
                var label = e.parameters[selected].label;
                var start =
                    typeof label == 'string' ? prefix.indexOf(label) : label[0];
                if (start > -1) {
                    var active =
                        typeof label === 'string'
                            ? label
                            : prefix.slice(start, label[1]);
                    var suffix = prefix.slice(start + label.length);
                    prefix = prefix.slice(0, start);
                    html.push(
                        this.ui.createToken(
                            {text: active, type: 'parameterName'},
                            'active'
                        )
                    );
                    html.push(suffix);
                }
                if (e.parameters[selected].documentation) {
                    html.push(
                        '</br>',
                        formatContents(e.parameters[selected].documentation)
                    );
                }
            }
            html.unshift(prefix);
            return html.join('');
        },
        format: function (value, opts, cb, info) {
            var ts = this;
            var data, session, text, hasData, filterResults;
            Utils.waterfall([
                function (n) {
                    session = typeof value === 'string' ? null : value;
                    text = session ? null : value;
                    hasData = Boolean((data = session && ts.hasDoc(session)));
                    if (!hasData) {
                        var mode;
                        if (session) {
                            mode = session.getModeName();
                        } else {
                            mode = opts.mode || ts.provider.modes[0];
                        }
                        data = ts.addDoc(
                            Utils.genID('x') + '.' + S.getExtension(mode),
                            //Don't add the session yet
                            session ? S.docValue({doc: session}) : text
                        );
                    }
                    var partial = info && info.isPartialFormat;
                    if (partial && !ts.provider.hasRangeFormatting) {
                        filterResults = true;
                        partial = false;
                    }
                    opts = {
                        tabSize: opts && opts.indent_size,
                        insertSpaces: opts && opts.indent_char !== '\t',
                    }; //TODO more format options
                    ts.send(
                        partial ? 'rangeFormatting' : 'formatting',
                        [data.name, opts, partial && toLspRange(info.range)],
                        n
                    );
                },
                function (n, e, r) {
                    if (!r) return cb(e);
                    if (!hasData) {
                        var temp = session || new EditSession(text);
                        data.doc = temp; //Now add the session
                    }
                    var _temp = {};
                    _temp[data.name] = r;
                    var changes = toAceChanges(ts, {changes: _temp}).refs;
                    if (filterResults) {
                        var range = Range.fromPoints(
                            info.range.start,
                            info.range.end
                        );
                        changes = changes.filter(function (e) {
                            return range.itersects(e);
                        });
                    }
                    S.applyChanges(ts, changes, null, n.bind(null, null));
                },
                true,
                function (e, results) {
                    var result;
                    if(value === session){
                        result = session;
                    } else{
                        result = data? S.docValue(data):value; 
                    }
                    if (data && !hasData) ts.removeDoc(data.name);
                    return cb(result, null, false);
                },
            ]);
        },
    };

    Utils.inherits(LspClient, BaseClient, TsClient);
    var toLspChange = function (delta) {
        return {
            range: {
                start: toLspPosition(delta.start),
                end: toLspPosition(
                    delta.action === 'insert' ? delta.start : delta.end
                ),
            },
            text: delta.action === 'insert' ? delta.lines.join('\n') : '',
        };
    };
    var toLspRange = function (range) {
        return {
            start: toLspPosition(range.start),
            end: toLspPosition(range.end),
        };
    };
    var toLspPosition = function (pos) {
        return {
            line: pos.row,
            character: pos.column,
        };
    };
    function toFile(uri) {
        return decodeURIComponent(uri.replace('file://', ''));
    }
    function toAceLoc(session, position) {
        return {
            row: position.line,
            column: position.character,
        };
    }
    function toAceChanges(ts, edits) {
        var changes = edits.changes;
        var refs = [];
        for (var uri in changes) {
            for (var i = 0; i < changes[uri].length; i++) {
                var e = changes[uri][i];
                refs.push({
                    start: toAceLoc(null, e.range.start),
                    end: toAceLoc(null, e.range.end),
                    text: e.newText,
                    file: ts.$unfixName(toFile(uri)),
                });
            }
        }
        return {refs: refs};
    }

    function buildCompletions(completions, ts) {
        var entries;
        var MAX = 5000;
        entries =
            completions &&
            completions.map(function (e) {
                return {
                    value: e.label,
                    data: e,
                    message: CompletionItemKindMap[e.kind],
                    iconClass: ts.ui.iconClass(
                        e.kind ? CompletionItemKindMap[e.kind] : 'unknown'
                    ),
                    docHTML: e.description
                        ? ts.getInfoHtml(e.description)
                        : undefined,
                    score: MAX - (parseInt(e.sortText) || 0),
                    __type: ts,
                    completer: ts,
                };
            });
        return entries;
    }

    function formatContents(contents) {
        if (Array.isArray(contents)) {
            return contents.map(formatContents).filter(Boolean).join('\n');
        } else if (typeof contents === 'string') {
            return contents;
        } else {
            return contents.value;
        }
    }

    function toAceAnnotations(session, anno) {
        return anno
            ? anno.map(function (diag) {
                  var start = toAceLoc(session, diag.range.start);
                  return {
                      row: start.row,
                      column: start.column,
                      end: toAceLoc(session, diag.range.end),
                      type: DiagnosticSeverityMap[diag.severity],
                      text: diag.message,
                  };
              })
            : [];
    }

    /**@this {LspTransport}*/
    /** TsClient and LspClient are very similar. Since TsClient has less
  dependencies and is likely to be more often used, it makes sense for LspClient
  to mixin TsClient rather than the other way round.*/
    function transformTsMessage(data, cb) {
        if (!this.provider) return cb({message: 'Transport has closed'});
        var ts = this.provider.instance;
        var timeout = ts && ts.queryTimeout;
        var languageId = this.provider.languageId || this.provider.modes[0]; //todo infer based on file
        var uri = 'file://' + data.args[0]; // add this here since jumpstack is shared
        switch (data.type) {
            case 'addDoc':
                return this.notify(
                    'textDocument/didOpen',
                    {
                        textDocument: {
                            uri: uri,
                            languageId: languageId,
                            text: data.args[1],
                            version: data.args[2],
                        },
                    },
                    function (err) {
                        if (err) cb(err);
                        else cb && cb(null, data.args[2]);
                    }
                );
            case 'updateDoc':
                return this.notify(
                    'textDocument/didChange',
                    {
                        textDocument: {
                            uri: uri,
                            version: data.args[2],
                            languageId: languageId,
                        },
                        contentChanges: data.args[1].map(toLspChange),
                    },
                    function (err) {
                        if (err) cb(err);
                        else cb && cb(null, data.args[2]);
                    }
                );
            case 'delDoc':
                return this.notify(
                    'textDocument/didClose',
                    {
                        textDocument: {
                            uri: uri,
                        },
                    },
                    cb
                );
            case 'getCompletions':
                return this.request(
                    'textDocument/completion',
                    {
                        textDocument: {
                            uri: uri,
                        },
                        position: data.args[1],
                        context: {
                            triggerKind: data.args[2],
                            triggerCharacter: data.args[3],
                        },
                    },
                    timeout,
                    function (err, items) {
                        console.log('Got completions');
                        console.log(err, items);
                        if (err) cb(err);
                        else {
                            items =
                                !items || Array.isArray(items)
                                    ? items
                                    : items.items;
                            cb(null, null);
                        }
                    }
                );
            case 'getCompletionEntryDetails':
                return this.request(
                    'completionItem/resolve',
                    {data: data.args[2].data},
                    timeout,
                    function (err, result) {
                        if (!err) {
                            cb(err, result.documentation);
                        } else cb(err);
                    }
                );
            case 'getQuickInfoAtPosition':
                var method = 'textDocument/hover';
            /*fall through*/
            case 'getReferencesAtPosition':
                method = method || 'textDocument/references';
            /*fall through*/
            case 'getSignatureHelpItems':
                method = method || 'textDocument/signatureHelp';
            /*fall through*/
            case 'getDefinitionAtPosition':
                method = method || 'textDocument/definition';
                return this.request(
                    method,
                    {
                        textDocument: {uri: uri},
                        position: data.args[1],
                    },
                    timeout,
                    cb
                );
            case 'findRenameLocations':
                return this.request(
                    'textDocument/rename',
                    {
                        textDocument: {uri: uri},
                        position: data.args[1],
                        newName: data.args[2],
                    },
                    timeout,
                    function (err, res) {
                        cb(err, res);
                    }
                );
            case 'rangeFormatting':
            case 'formatting':
                return this.request(
                    'textDocument/' + data.type,
                    {
                        textDocument: {uri: uri},
                        options: data.args[1],
                        range: data.args[2],
                    },
                    timeout,
                    cb
                );
            case 'getAnnotations':
            //The changed documents cause publishAnnotations
            case 'restart': //Not possible for now
                return cb();

            default:
                throw new Error('Unknown Message ' + data.type);
        }
    }
    function _MAP(Enum) {
        return Object.keys(Enum).reduce(function (ctx, name) {
            ctx[Enum[name]] = name.toLowerCase();
            return ctx;
        }, {});
    }
    exports.LspClient = LspClient;
}); /*_EndDefine*/