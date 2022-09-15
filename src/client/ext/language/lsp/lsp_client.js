define(function (require, exports, module) {
  var Utils = require('grace/core/utils').Utils;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var BaseClient = require('grace/ext/language/base_client').BaseClient;
  var S = require('grace/ext/language/base_client').ClientUtils;
  var modelist = ace.require('ace/ext/modelist');
  var Docs = require('grace/docs/docs').Docs;
  //Reuse methods from TsClient
  var TsClient = require('grace/ext/language/ts/ts_client').TsClient;
  var getDoc = S.getDoc;

  require('./libs/open_rpc_lsp');
  var vsLsp = window.lspDeps.VSCodeLSP;
  var CompletionTriggerKind = vsLsp.CompletionTriggerKind;
  var CompletionItemKindMap = _MAP(vsLsp.CompletionItemKind);
  var DiagnosticSeverity = vsLsp.DiagnosticSeverity;
  var DiagnosticSeverityMap = _MAP(DiagnosticSeverity);
  DiagnosticSeverityMap[DiagnosticSeverity.Information] = 'info';
  DiagnosticSeverityMap[DiagnosticSeverity.Hint] = 'info';

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
    };
    this.provider = transport.provider;
    this.queryTimeout = 10000;
  }

  LspClient.prototype = {
    normalizeName: function (name) {
      return name.startsWith('temp:')
        ? getTempFileName(this, name)
        : name.startsWith('file://')
        ? name
        : 'file://' + name;
    },
    $getPos: function (editor, pos) {
      return toLspPosition(pos || editor.getSelection().getCursor());
    },
    $toAceRefs: function (data) {
      var name;
      data = {
        refs: data.map(function (e) {
          name = name || e.name;
          return {
            file: e.uri,
            start: toAceLoc(null, e.range.start),
            end: toAceLoc(null, e.range.end),
          };
        }),
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
        [getDoc(this, session).name, toLspPosition(pos), trigKind, trigChar],
        function (e, r) {
          if (r) {
            callback(e, buildCompletions(r, self));
          } else callback(e);
        }
      );
    },
    insertMatch: function (editor, match) {
      console.log(match.data);
      editor.execCommand('insertstring', match.data.label);
    },
    requestRenameLocations: function (editor, newName, cb) {
      if (newName === null) newName = 'temp';
      this.send(
        'findRenameLocations',
        [getDoc(this, editor.session).name, this.$getPos(editor), newName],
        function (e, r) {
          cb(e, r && toAceChanges(r));
        }
      );
    },
    setupForRename: function (editor, newName, cb, data) {
      BaseClient.prototype.setupForRename.call(this, editor, newName, cb, null);
    },
    requestAnnotations: function (editor, cb) {
      var session = editor.session;
      this.send('getAnnotations', editor, Utils.noop);
      this.once('annotate', function (ev) {
        if (ev.session === session) cb(ev.data);
      });
    },
    onAnnotations: function (file, anno) {
      var data = this.hasDoc(file);
      if (!data || !data.doc) {
        console.log('Ignored diagnostics for ', file);
        if(file.startsWith('file://tmp/')){
          this.releaseDoc(file);
        }
      }
      //unused
      else
        this.trigger('annotate', {
          data: toAceAnnotations(data.doc, anno),
          session: data.doc,
        });
    },
    genInfoHtml: function (value /*,from Completion, fromCursorActivity*/) {
      return formatContents(value);
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
          return BaseClient.prototype.getCallPos.apply(this, arguments);
      }
      return cb(null, true); //always update
    },
    genArgHintHtml: function (args, argpos) {
      var activeSignature = args.activeSignature || 0;
      var e = args.signatures[activeSignature];

      var selected = e.hasOwnProperty('activeParameter')
        ? e.activeParameter
        : args.activeParameter;
      var prefix = e.label;

      var html = [];
      if (e.parameters) {
        var label = e.parameters[selected].label;
        var start = typeof label == 'string' ? prefix.indexOf(label) : label[0];
        if (start > -1) {
          var active =
            typeof label === 'string' ? label : prefix.slice(start, label[1]);
          var suffix = prefix.slice(start + label.length);
          prefix = prefix.slice(0, start);
          html.push(
            this.ui.createToken({text: active, type: 'parameter'}, 'active')
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
              'file://' + Utils.genId('x') + '.' + getExtension(mode),
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
            var temp = session || new ace.EditSession(text);
            data.doc = temp; //Now add the session
          }
          var _temp = {};
          _temp[data.name] = r;
          var changes = toAceChanges({changes: _temp}).refs;
          if (filterResults) {
            var range = Range.from(info.range.start, info.range.end);
            changes = changes.filter(function (e) {
              return range.itersects(e);
            });
          }
          S.applyChanges(ts, changes, null, n);
        },
        true,
        function (e, results) {
          if (!hasData) this.removeDoc(data.name);
          return cb(e, null, !e && !hasData);
        },
      ]);
    },
  };

  Utils.inherits(LspClient, BaseClient, TsClient);
  var toLspChange = function (delta) {
    return {
      range: {
        start: toLspPosition(delta.start),
        end: toLspPosition(delta.action === 'insert' ? delta.start : delta.end),
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

  //Most Language Service Providers have problems
  //dealing with non-local files, but can handle
  //non-existent local files all right
  function getTempFileName(ts, name) {
    var doc = Docs.forPath(name);
    if (!doc) return '';
    if (doc.$lspName) {
      return doc.$lspName;
    }
    var t = doc.session.getModeName();
    if (!t || t == 'text') return '';
    var ext = getExtension(t);
    return (ext ? name.replace('temp:', 'file:///tmp/') + '.' : '') + ext;
  }
  function getExtension(mode) {
    var m = modelist.modesByName[mode];
    if (!m) return '';
    return m.extensions ? m.extensions.split('|').shift() : '';
  }
  function toAceLoc(session, position) {
    return {
      row: position.line,
      column: position.character,
    };
  }
  function toAceChanges(edits) {
    var changes = edits.changes;
    var refs = [];
    for (var uri in changes) {
      for (var i = 0; i < changes[uri].length; i++) {
        var e = changes[uri][i];
        refs.push({
          start: toAceLoc(null, e.range.start),
          end: toAceLoc(null, e.range.end),
          text: e.newText,
          file: uri,
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
          docHTML: e.description ? ts.getInfoHtml(e.description) : undefined,
          score: MAX - (parseInt(e.sortText) || 0),
          __type: ts,
          completer: ts,
        };
      });
    return entries;
  }

  function formatContents(contents) {
    if (Array.isArray(contents)) {
      return contents.map(c => formatContents(c) + '\n\n').join('');
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
    var ts = this.provider.instance;
    var timeout = ts.queryTimeout;
    var languageId = this.provider.languageId;
    switch (data.type) {
      case 'addDoc':
        return this.notify(
          'textDocument/didOpen',
          {
            textDocument: {
              uri: data.args[0],
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
              uri: data.args[0],
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
              uri: data.args[0],
            },
          },
          cb
        );
      case 'getCompletions':
        return this.request(
          'textDocument/completion',
          {
            textDocument: {
              uri: data.args[0],
            },
            position: data.args[1],
            context: {
              triggerKind: data.args[2],
              triggerCharacter: data.args[3],
            },
          },
          timeout,
          function (err, items) {
            if (err) cb(err);
            else {
              items = !items || Array.isArray(items) ? items : items.items;
              cb(null, items);
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
            textDocument: {uri: data.args[0]},
            position: data.args[1],
          },
          timeout,
          cb
        );
      case 'findRenameLocations':
        return this.request(
          'textDocument/rename',
          {
            textDocument: {uri: data.args[0]},
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
            textDocument: {uri: data.args[0]},
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