define(function (require, exports, module) {
  'use strict';
  var vsLspProtocol = require('./libs/open_rpc_lsp').VSCodeLSP;
  var Notify = require('grace/ui/notify').Notify;
  var Utils = require('grace/core/utils').Utils;
  var openRpc = require('./libs/open_rpc_lsp').OpenRPC;
  var RequestManager = openRpc.RequestManager;
  var Client = openRpc.Client;
  var WebSocketTransport = openRpc.WebSocketTransport;

  // https://microsoft.github.io/language-server-protocol/specifications/specification-current/
  /**
   * @constructor
   */
  function LspTransport(provider) {
    this.provider = provider;
    this.createConnection();
  }
  LspTransport.prototype._debug = true;
  LspTransport.prototype.createConnection = function () {
    this.initializing = true; //wait for hasInitialized
    this.initialized = false;
    this.socket = new WebSocketTransport(this.provider.address);
    this.client = new Client(new RequestManager([this.socket]));
    this.$processNotification = this.processNotification.bind(this);
    this.client.onNotification(this.$processNotification);
    var checkConnection = Utils.delay(this.checkConnection.bind(this), 10000);
    this.socket.connection.addEventListener(
      'message',
      function (message) {
        //OpenRpc does not understand requests
        const data = JSON.parse(message.data);
        if (data.method && data.id) this.processRequest(data);
      }.bind(this),
    );

    this.socket.connection.addEventListener('close', checkConnection.now);
    checkConnection();
  };
  LspTransport.prototype.checkConnection = function (err) {
    if (this.socket.connection.readyState !== WebSocket.OPEN) {
      if (this.initializing) {
        this.initializing = false;
        this.handleInit(new Error('Failed connection.'), null);
      }
      if (!this.provider) this.socket.close();
      //TODO Retry connection
    }
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
              change: vsLspProtocol.TextDocumentSyncKind.Incremental, //can no longer find this in the protocol spec
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
      this.handleInit.bind(this),
    );
  };
  LspTransport.prototype.handleInit = function (err, res) {
    var waiting = this.waiting;
    this.waiting = null;
    this.initializing = false;
    this.initialized = !err;
    if (!this.provider) return; //has been destroyed
    var has;
    if (err) {
      has = {failed: true};
      Notify.error('Failed to initialize Language Server');
    } else {
      has = res.capabilities;
      this.notify('initialized', {});
      //send this regardless of source of capabilities
      this.notify('lspServer/didInitialize', res);
    }
    this.capabilities = has;
    var prov = this.provider;
    /**@see LspClient*/
    var syncKind =
      has.textDocumentSync && typeof has.textDocumentSync === 'object'
        ? has.textDocumentSync.changes
        : has.textDocumentSync;
    if (syncKind !== vsLspProtocol.TextDocumentSyncKind.Incremental)
      prov.hasSynchronization = false;
    prov.updateCapabilities(has);

    if (waiting)
      waiting.forEach(function (e) {
        e();
      });
  };
  LspTransport.prototype.request = function (method, params, timeout, cb) {
    if (this._debug) {
      console.debug('Request ', method, params);
      cb = (function (cb) {
        return function (err, res) {
          console.log(method, ' got ', err ? 'error' : 'result', err || res);
          cb.apply(this, arguments);
        };
      })(cb);
    }
    return this.client
      .request({method, params}, timeout)
      .then(cb.bind(this, null), cb.bind(this));
  };

  LspTransport.prototype.notify = function (method, params, cb) {
    var conn = this.socket.connection;
    this.client.requestManager.connectPromise.then(function () {
      conn.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: method,
          params: params,
        }),
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
    this.socket.connection.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: null,
      }),
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
              notification.params.diagnostics,
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
            '>>>' + d.message,
          );
          break;
        default:
          console.log('Unhandled notification', notification);
      }
    } catch (error) {
      console.error(error);
      // console.error(new Error(error));
    }
  };
  LspTransport.prototype.destroy = function () {
    this.socket.close();
    this.initialized = true;
    if (this.waiting) {
      var waiting = this.waiting;
      this.waiting = null;
      if (waiting)
        waiting.forEach(function (e) {
          e();
        });
    }
  };
  exports.LspTransport = LspTransport;
});