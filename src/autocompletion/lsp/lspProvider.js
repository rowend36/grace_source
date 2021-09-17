_Define(function(global) {
    var Utils = global.Utils;
    var appConfig = global.registerAll({
        lspConfigs: []
    }, "autocompletion");
    global.registerValues({
        "lspConfigs": "Array of configurations. Format {\n\
address: string- Address default: localhost\n\
port: number-Port of the language service provider. default: 80\n\
name: name of provider\n\
method: get|post\n\
modes: list of modes where it is enabled"
    }, "autocompletion");
    var completions = global.Completions;
    /** @constructor */
    function LspTransport(provider,transformCalls) {
        this.ctx = provider;
        this.transformCalls = !!transformCalls;
    }
    /**Incomplete */
    /**
     * Methods from typescript.js
     * Here, we would have to override send/getPos to use row/column
     * getSignatureHelpItems
     * getDefinitionAtPosition
     * getRenameInfo
     * getQuickInfoAtPosition
     * getCompletions
     * getCompletionEntryDetails
     * 
     * Additional methods
     * requestCapabilities(): {
         ["rename"|"requestDefinition"|"showType"|"findRefs"]: boolean
     }
     * addDoc(filename:string, value: string, version: number) : number 
     * The returned version must match the version sent
     * 
     * updateDoc(filename: string, changes: AceDelta, version: number): number
     * Server ensures the current version matches sent version.
     * Also, the last delta has a checksum property which is the total length of the document after the change
     * (Line separator \r\n is counted as 1 character)
     * The returned version must be the version sent +1
     * 
     * For both updateDoc and addDoc, the returned version represents the version stored on the server
     * delDoc(filename:string) 
     * restart(options?)
     * getAnnotations(filename: string,pos?:number): AceAnnotations
     * Issues: updateDoc and getAnnotations need adapters since their format is non-standard
     * ie using AceDelta and AceAnnotation
     * typedef AceDelta  {{
        start: {
            row: number,
            column: number
        }
        end: {
            row: number,
            column: number,
        }
        lines: Array<String>
        action: "remove"|"insert",
        checksum?: number
     }}
     * typedef AceAnnotation  {{
        row: number,
        column?: number,
        end?: {
            row: number,
            column: number,
        }
        text: 'string'
        type: "error"|"warning"|"info"
     }}
     * @typedef {string} Method
     * @typedef {{
        type: Method,
        args: Array<any>
      }} DataObj
     * @param data {DataObj}
    **/
    LspTransport.prototype.postMessage = function(data, cb) {
        //This is the area that needs work
        //Basically, one has to transform the api calls
        // to LSP type calls, I looked at the detailed 
        // lsp specification and promptly decided
        // this is where I would rest my oars
        if(this.transformCalls)throw new Error('Unsupported operation');
        else $.ajax({
            url: this.ctx.address + "/" + data.type,
            data: data,
            type: this.ctx.method
        }).then(cb.bind(null, null), cb);
    };
    /** @constructor*/
    function LspProvider(address, method, modes) {
        this.address = address;
        this.method = method;
        this.modes = modes;
        this.transport = new LspTransport(this);
        this.instance = null;
        this.capabilities = null;
        //todo specify project dir and update on change
        this.id = Utils.genID('lsp');
    }
    LspProvider.prototype.init = function(editor, cb) {
        var self = this;
        if (this.instance) {
            return cb(this.instance);
        }
        global.Imports.define([{
            script: "./autocompletion/lsp/lspClient.js",
            returns: 'LspClient'
        }, {
            path: this.id,
            isGlobal: true,
            asyncFunc: function(cb) {
                self.transport.postMessage({
                    type: "requestCapabilities"
                }, function(err, capabilities) {
                    if (!err) {
                        self.capabilities = capabilities;
                    } else self.capabilities = {
                        findRefs: true,
                        rename: true,
                        requestDefinition: true,
                        showType: true
                    };
                    cb(err);
                });
            }
        }])(function(Client) {
            if (!self.instance) {
                self.instance = new Client(self.capabilities, self.transport);
            }
            return cb(self.instance);
        });
    };
    var providers = {
        //name: config
    };

    function toConfig(conf) {
        var t = {
            address: 'localhost',
            method: 'GET'
        };
        if (conf.address) {
            t.address = conf.address;
        }
        if (conf.port) {
            t.address += ":" + conf.port;
        }
        t.modes = Utils.parseList(conf.modes);
        if (conf.method) {
            t.method = conf.method;
        }
        return t;
    }

    function notIn(arr) {
        return function(e) {
            return !arr.some(function(l) {
                return l.name = e.name;
            });
        };
    }

    function update(ev) {
        if (ev.config == 'lspConfigs') {
            Utils.assert(!ev.newValue.some(Utils.not(Boolean)), 'Invalid config');
            var removed = ev.oldValue.filter(notIn(ev.newValue));
            removed.map(toConfig).forEach(function(e) {
                if (providers[e.name]) {
                    completions.removeCompletionProvider(providers[e.name]);
                    providers[e.name].destroy();
                    providers[e.name] = null;
                }
            });
            var added = ev.newValue.filter(notIn(ev.oldValue));
            added.map(toConfig).forEach(function(e) {
                global.createLspProvider(e);
            });
        }
    }
    global.createLspProvider = function(config) {
        if (providers[config.name])
            completions.removeCompletionProvider(providers[config.name]);
        if (providers[config.name] && config.address == providers[config.name].address && config.method == providers[config.name].method) {
            var provider = providers[config.name];
            provider.modes = config.modes;
        } else {
            providers[config.name] = new LspProvider(config.address, config.method, config.modes);
        }
        completions.addCompletionProvider(providers[config.name], providers[config.name].modes);
    };
    update({
        config: 'lspCconfigs',
        oldValue: [],
        newValue: appConfig.lspConfigs
    });
    global.ConfigEvents.on("autocompletion", update);
});