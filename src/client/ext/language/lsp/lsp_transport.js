define(function (require, exports, module) {
  'use strict';
  require('./libs/open_rpc_lsp');
  var ServerHost = require('grace/ext/language/server_host').ServerHost;
  var openRpc = window.lspDeps.OpenRPC;
  var RequestManager = openRpc.RequestManager;
  var Client = openRpc.Client;
  var WebSocketTransport = openRpc.WebSocketTransport;
  var vsLsp = window.lspDeps.VSCodeLSP;
  var Notify = require('grace/ui/notify').Notify;
  var Utils = require('grace/core/utils').Utils;

  // https://microsoft.github.io/language-server-protocol/specifications/specification-current/
  function LspTransport(provider) {
    this.provider = provider;
    this.createConnection();
  }

  LspTransport.prototype.reset = function () {
    this.initialized = false;
    this.initializing = false;
  };
  LspTransport.prototype.checkConnection = function () {
    if (this.transport.connection.readyState !== WebSocket.OPEN) {
      Notify.warn('Failed connection to ' + this.provider.address);
    }
  };
  LspTransport.prototype.createConnection = function () {
    this.transport = new WebSocketTransport(this.provider.address);
    this.client = new Client(new RequestManager([this.transport]));
    this.$processNotification = this.processNotification.bind(this);
    this.client.onNotification(this.$processNotification);
    this.transport.connection.addEventListener(
      'message',
      function (message) {
        const data = JSON.parse(message.data);
        if (data.method && data.id) this.processRequest(data);
      }.bind(this)
    );

    this.checkConnection = this.checkConnection.bind(this);
    this.transport.connection.addEventListener('close', this.checkCcnnection);
    this.initializing = true; //wait for hasInitialized
    this.initialized = false;
    setTimeout(this.checkConnection, 10000);
  };
  LspTransport.prototype.destroy = function () {
    this.transport.close();
    this.provider = null;
  };
  LspTransport.prototype.initialize = function (cb) {
    if (this.initialized) return cb();
    this.waiting = this.waiting || [];
    if (cb) this.waiting.push(cb);
    if (this.initializing) return;
    this.initializing = true;
    var project = this.provider.workspace;
    this.request(
      'initialize',
      {
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: true,
              willSave: false,
              didSave: false,
              willSaveWaitUntil: false,
              change: vsLsp.TextDocumentSyncKind.Incremental, //can no longer find this in the protocol spec
            },

            completion: {
              dynamicRegistration: true,
              completionItem: {
                snippetSupport: false, //ToDo
                commitCharactersSupport: true,
                documentationFormat: ['plaintext', 'markdown'],
                deprecatedSupport: false,
                preselectSupport: false,
                insertReplaceSupport: true,
                resolveSupport: true,
              },
              contextSupport: true,
            },
            hover: {
              dynamicRegistration: true,
              contentFormat: ['plaintext', 'markdown'],
            },
            signatureHelp: {
              dynamicRegistration: true,
              signatureInformation: {
                documentationFormat: ['plaintext', 'markdown'],
                activeParameterSupport: true,
                parameterInformation: {
                  labelOffsetSupport: true,
                },
              },
            },
            definition: {
              dynamicRegistration: true,
              linkSupport: true,
            },
            references: {
              dynamicRegistration: true,
            },
            codeAction: {
              dynamicRegistration: true,
            },
            codeLens: {
              dynamicRegistration: true,
            },
            formatting: {
              dynamicRegistration: true,
            },
            rangeFormatting: {
              dynamicRegistration: true,
            },
            // declaration: {
            //   dynamicRegistration: true,
            //   linkSupport: true,
            // },
            // typeDefinition: {
            //   dynamicRegistration: true,
            //   linkSupport: true,
            // },
            // implementation: {
            //   dynamicRegistration: true,
            //   linkSupport: true,
            // },
          },
          workspace: {
            didChangeConfiguration: {
              dynamicRegistration: true,
            },
            applyEdit: true,
            workspaceEdit: {
              documentChanges: true,
              normalizesLineEndings: true,
            },
            executeCommands: {
              dynamicRegistration: true,
            },
          },
        },
        initializationOptions: this.provider.options,
        processId: null,
        rootUri: project && project.rootUri,
        workspaceFolders: [project],
      },
      90000,
      this.handleInit.bind(this)
    );
  };
  LspTransport.prototype.handleInit = function (err, res) {
    var waiting = this.waiting;
    this.waiting = null;
    this.initializing = false;
    this.initialized = !err;
    if (!this.provider) return; //has been destroyed
    if (err) {
      console.error(err);
      Notify.error('Failed to initialize Language Server');
    } else {
      var has = (this.capabilities = res.capabilities);
      this.notify('initialized', {});
      //send it either way
      this.notify('lspServer/didInitialize', res);
      var prov = this.provider;
      if (has.completionProvider) {
        if (has.completionProvider.triggerCharacters) {
          prov.triggerRegex = new RegExp(
            '[' +
              has.completionProvider.triggerCharacters
                .map(Utils.regEscape)
                .join('') +
              ']$'
          );
        }
      } else prov.hasCompletions = false;
      if (!has.definitionProvider) prov.hasDefinition = false;
      if (!has.referencesProvider) prov.hasReferences = false;
      if (!has.signatureHelpProvider) prov.hasArgHints = false;
      if (!has.documentFormattingProvider) prov.hasFormatting = false;
      if (!has.documentRangeFormattingProvider) prov.hasRangeFormatting = false;
      if (!has.renameProvider) prov.hasRename = false;
      var syncKind =
        has.textDocumentSync && typeof has.textDocumentSync === 'object'
          ? has.textDocumentSync.changes
          : has.textDocumentSync;
      /**@see LspClient*/
      if (syncKind !== vsLsp.TextDocumentSyncKind.Incremental)
        prov.hasSynchronization = false;
      ServerHost.toggleProvider(prov, prov.modes, true);
      if (waiting)
        waiting.forEach(function (e) {
          e();
        });
    }
  };
  LspTransport.prototype.request = function (method, params, timeout, cb) {
    // cb = (function (cb) {
    //   return function (err, res) {
    //     console.log(method, ' got ', err ? 'error' : 'result', err || res);
    //     cb.apply(this, arguments);
    //   };
    // })(cb);
    return this.client
      .request({method, params}, timeout)
      .then(cb.bind(this, null), cb.bind(this));
  };

  LspTransport.prototype.notify = function (method, params, cb) {
    var conn = this.transport.connection;
    this.client.requestManager.connectPromise.then(function () {
      conn.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: method,
          params: params,
        })
      );
      if (cb) {
        //The notify promise does not resolve on all browsers
        //so we resort to polling
        setTimeout(function () {
          if (conn.bufferedAmount < 1) cb();
          else
            var a = setInterval(function () {
              if (conn.bufferedAmount < 1) {
                clearInterval(a);
                cb();
              }
            }, 25);
        }, 500);
      }
    });
  };
  LspTransport.prototype.processRequest = function (request) {
    this.transport.connection.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: null,
      })
    );
  };

  LspTransport.prototype.processNotification = function (notification) {
    try {
      switch (notification.method) {
        case 'textDocument/publishDiagnostics':
          var instance = this.provider.instance;
          if (instance)
            instance.onAnnotations(
              notification.params.uri,
              notification.params.diagnostics
            );
          break;
        case 'lspServer/hasInitialized':
          if (notification.params) {
            this.handleInit(null, notification.params);
            this.provider.changeWorkspace();
            this.provider.changeOptions();
          } else {
            this.initializing = false;
            if (this.waiting) this.initialize();
          }
          break;
        case 'window/logMessage':
          var d = notification.params;
          console[d.type === 1 ? 'error' : d.type === 2 ? 'warning' : 'debug'](
            '>>>' + d.message
          );
          break;
        default:
          console.log('Unhandled notification', notification);
      }
    } catch (error) {
      console.log(error);
      // console.error(new Error(error));
    }
  };
  exports.LspTransport = LspTransport;
});