define(function (require, exports, module) {
    "use strict";
    var vsLspProtocol = require("./libs/open_rpc_lsp").VSCodeLSP;
    var Notify = require("grace/ui/notify").Notify;
    //TODO: remove this dependency since we monkey patch around it for most operations.
    var openRpc = require("./libs/open_rpc_lsp").OpenRPC;
    var RequestManager = openRpc.RequestManager;
    var Client = openRpc.Client;
    var WebSocketTransport = openRpc.WebSocketTransport;
    /**
     * @constructor
     */
    function LspTransport(provider) {
        this.provider = provider;
        this.state = LspTransport.RESET;
        this.$checkConnection = this.checkConnection.bind(this);
    }

    LspTransport.RESET = 0;
    LspTransport.READY = 2;
    //Connection State
    LspTransport.CONNECTING = 1;
    LspTransport.DISCONNECTED = 4 | LspTransport.READY;
    LspTransport.CONNECTED = 8;
    //Initialization State
    LspTransport.INITIALIZING = 16;
    LspTransport.INITIALIZED = 32 | LspTransport.READY;
    LspTransport.prototype._debug = true;
    LspTransport.prototype.createConnection = function () {
        //Set to initializing to wait for connection to open and also the hasInitialized notification
        this.state = LspTransport.CONNECTING | LspTransport.INITIALIZING;
        this.socket = new WebSocketTransport(this.provider.address);
        this.client = new Client(new RequestManager([this.socket]));
        this.$handleNotification = this.handleNotification.bind(this);
        this.client.onNotification(this.$handleNotification);
        this.socket.connection.addEventListener(
            "message",
            function (message) {
                //OpenRpc does not understand requests
                const data = JSON.parse(message.data);
                if (data.method && data.id) this.handleRequest(data);
            }.bind(this)
        );
        this.socket.connection.addEventListener("open", this.$checkConnection);
        this.socket.connection.addEventListener("close", this.$checkConnection);
    };
    LspTransport.prototype.checkConnection = function () {
        switch (this.socket.connection.readyState) {
            case WebSocket.CLOSED:
                if (this.state & LspTransport.CONNECTING) {
                    this.state ^= LspTransport.CONNECTING;
                    this.state |= LspTransport.DISCONNECTED;
                    this.handleInit(new Error("Failed connection."), null);
                }
                //TODO Retry connection
                break;
            case WebSocket.OPEN:
                if (this.state & LspTransport.CONNECTING) {
                    this.state ^= LspTransport.CONNECTING;
                    this.state |= LspTransport.CONNECTED;
                }
        }
    };
    // https://microsoft.github.io/language-server-protocol/specifications/specification-current/
    //Must be called before each request/notify
    LspTransport.prototype.initialize = function (cb) {
        if (this.state & LspTransport.READY) return cb();
        this.waitInit = this.waitInit || [];
        if (cb) this.waitInit.push(cb);
        if (this.state === LspTransport.RESET) return this.createConnection();
        else if (this.state & LspTransport.INITIALIZING) return;
        this.state |= LspTransport.INITIALIZING;
        var project = this.provider.workspace;
        this.request(
            "initialize",
            {
                capabilities: {
                    textDocument: {
                        synchronization: {
                            dynamicRegistration: true,
                            willSave: false,
                            didSave: false,
                            willSaveWaitUntil: false,
                            change:
                                vsLspProtocol.TextDocumentSyncKind.Incremental, //can no longer find this in the protocol spec
                        },

                        completion: {
                            dynamicRegistration: true,
                            completionItem: {
                                snippetSupport: false, //ToDo
                                commitCharactersSupport: true,
                                documentationFormat: ["plaintext", "markdown"],
                                deprecatedSupport: false,
                                preselectSupport: false,
                                insertReplaceSupport: true,
                                resolveSupport: true,
                            },
                            contextSupport: true,
                        },
                        hover: {
                            dynamicRegistration: true,
                            contentFormat: ["plaintext", "markdown"],
                        },
                        signatureHelp: {
                            dynamicRegistration: true,
                            signatureInformation: {
                                documentationFormat: ["plaintext", "markdown"],
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
            90000, //large timeout for server to start
            this.handleInit.bind(this)
        );
    };
    LspTransport.prototype.handleInit = function (err, res) {
        this.state ^= LspTransport.INITIALIZING;
        this.state |= LspTransport.INITIALIZED;
        var has;
        if (err) {
            has = {failed: true};
            Notify.error("Failed to initialize Language Server");
        } else {
            has = res.capabilities;
            this.notify("initialized", {});
            //send this regardless of source of capabilities
            this.notify("lspServer/didInitialize", res);
        }
        this.capabilities = has;
        if (this.provider) {
            var prov = this.provider;
            /**@see LspClient*/
            var syncKind =
                has.textDocumentSync && typeof has.textDocumentSync === "object"
                    ? has.textDocumentSync.changes
                    : has.textDocumentSync;
            if (syncKind !== vsLspProtocol.TextDocumentSyncKind.Incremental)
                prov.hasSynchronization = false;
            prov.updateCapabilities(has);
        }
        var waitInit = this.waitInit;
        this.waitInit = null;
        if (waitInit)
            waitInit.forEach(function (e) {
                e();
            });
    };
    LspTransport.prototype.request = function (method, params, timeout, cb) {
        if (this._debug) {
            console.debug("Request ", method, params);
            cb = (function (cb) {
                return function (err, res) {
                    console.log(
                        method,
                        " got ",
                        err ? "error" : "result",
                        err || res
                    );
                    cb.apply(this, arguments);
                };
            })(cb);
        }
        if (!(this.state & LspTransport.CONNECTED))
            return cb(new Error("Disconnected"));
        return this.client
            .request({method: method, params: params}, timeout)
            .then(cb.bind(this, null), cb.bind(this));
    };

    LspTransport.prototype.notify = function (method, params, cb) {
        if (!(this.state & LspTransport.CONNECTED))
            return cb && cb(new Error("Disconnected"));
        var conn = this.socket.connection;
        conn.send(
            JSON.stringify({
                jsonrpc: "2.0",
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
    };
    LspTransport.prototype.handleRequest = function (request) {
        this.socket.connection.send(
            JSON.stringify({
                jsonrpc: "2.0",
                id: request.id,
                result: null,
            })
        );
    };

    LspTransport.prototype.handleNotification = function (notification) {
        try {
            switch (notification.method) {
                case "textDocument/publishDiagnostics":
                    var instance = this.provider.instance;
                    if (instance)
                        instance.onAnnotations(
                            notification.params.uri,
                            notification.params.diagnostics
                        );
                    break;
                case "lspServer/hasInitialized":
                    if (notification.params) {
                        this.handleInit(null, notification.params);
                        this.provider.changeWorkspace();
                        this.provider.changeOptions();
                    } else {
                        this.state ^= LspTransport.INITIALIZING;
                        if (this.waitInit) this.initialize();
                    }
                    break;
                case "window/logMessage":
                    var d = notification.params;
                    console[
                        d.type === 1
                            ? "error"
                            : d.type === 2
                            ? "warning"
                            : "debug"
                    ](">>>" + d.message);
                    break;
                default:
                    console.log("Unhandled notification", notification);
            }
        } catch (error) {
            console.error(error);
            // console.error(new Error(error));
        }
    };
    LspTransport.prototype.destroy = function () {
        if (this.waitInit) {
            var waitInit = this.waitInit;
            this.waitInit = null;
            if (waitInit)
                waitInit.forEach(function (e) {
                    e();
                });
        }
        if (this.socket) {
            if (this.socket.connection) {
                this.socket.connection.removeEventListener(
                    "close",
                    this.$checkConnection
                );
                this.socket.connection.removeEventListener(
                    "open",
                    this.$checkConnection
                );
            }
            this.socket.close();
            this.socket = null;
        }
        this.state = LspTransport.DISCONNECTED;
    };
    exports.LspTransport = LspTransport;
});