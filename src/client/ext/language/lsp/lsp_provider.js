define(function (require, exports, module) {
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            lspConfigs: [],
        },
        'autocompletion'
    );
    require('grace/core/config').Config.registerInfo(
        {
            lspConfigs: {
                doc:
                    'Array of configurations. Format {\n\
address: string- Address default: ws: or wss:\n\
name: name of provider\n\
modes: list of language modes where it is enabled\n\
options: server options to send to language service\n\
languageId: languageId to report.',
                type: [
                    {
                        address: 'url',
                        name: 'string',
                        modes: ['string'],
                        options: '?object',
                        languageId: 'string',
                    },
                ],
            },
        },
        'autocompletion'
    );
    var ServerHost = require('grace/ext/language/server_host').ServerHost;
    var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
    var Depend = require('grace/core/depend');
    var Utils = require('grace/core/utils').Utils;
    var appEvents = require('grace/core/app_events').AppEvents;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    /** @constructor*/
    function LspProvider(config) {
        this.address = config.address;
        this.name = config.name + '_LSP';
        this.options = config.options;
        this.languageId = config.languageId;
        this.instance = null;
        this.modes = config.modes;
        this.id = Utils.genID('lsp');
        this.changeWorkspace = this.changeWorkspace.bind(this);
        appEvents.on('changeProject', this.changeWorkspace);
    }
    Utils.inherits(LspProvider, BaseProvider);
    var LspClient;
    LspProvider.prototype.init = Depend.after(
        function (cb) {
            var self = this;
            require(['./lsp_transport', './lsp_client'], function (mod1, mod) {
                self.changeWorkspace();
                self.changeOptions();
                self.transport = new mod1.LspTransport(self);
                LspClient = mod.LspClient;
                cb();
            });
        },
        function (editor, cb) {
            var self = this;
            if (this.instance) {
                return cb(this.instance);
            }
            self.instance = new LspClient(self.transport, {
                switchToDoc: ServerHost.switchToDoc,
                getFileName: ServerHost.getFileName,
                readFile: ServerHost.readFile,
                normalize: FileUtils.normalize,
                name: self.name,
            });
            this.attachToEditor(editor, self.instance, cb);
        }
    );
    LspProvider.prototype.changeOptions = function () {
        if (this.transport) {
            this.transport.initialize(
                function () {
                    this.transport.notify(
                        'workspace/didChangeWorkspaceFolders',
                        {
                            settings: this.options,
                        }
                    );
                }.bind(this)
            );
        }
    };
    LspProvider.prototype.changeWorkspace = function (e) {
        var old = this.workspace;
        var project = e ? e.project : FileUtils.getProject();
        var current =
            project.rootDir === FileUtils.NO_PROJECT
                ? {
                      rootUri: 'file://temp/',
                      name: 'No Project',
                  }
                : {
                      rootUri: 'file://' + project.rootDir,
                      name: project.name,
                  };
        this.workspace = current;
        if (this.transport) {
            this.transport.initialize(
                function () {
                    this.transport.notify(
                        'workspace/didChangeWorkspaceFolders',
                        {
                            event: {
                                added: current && [current],
                                removed: old && [old],
                            },
                        }
                    );
                }.bind(this)
            );
        }
    };
    //Add everything initially, then modify as needed
    LspProvider.prototype.hasArgHints = true;
    LspProvider.prototype.hasAnnotations = true;
    LspProvider.prototype.hasFormatting = true;
    LspProvider.prototype.hasRename = true;
    LspProvider.prototype.priority = 12000;
    LspProvider.prototype.destroy = function () {
        BaseProvider.prototype.destroy.apply(this, arguments);
        this.transport.destroy();
    };
    //Todo codeLens, codeAction and executeCommand
    var providers = {
        //[name]: LspProvider
    };

    var lspConfigs = [];
    function update(ev) {
        if (ev.config !== 'lspConfigs') return;
        var m = appConfig.lspConfigs,
            o = lspConfigs;
        var removed = o.filter(Utils.notIn(m));
        var added = m.filter(Utils.notIn(o));
        removed.forEach(function (e) {
            if (providers[e.name]) {
                ServerHost.unregisterProvider(providers[e.name]);
                providers[e.name].destroy();
                providers[e.name] = null;
            }
        });
        added.forEach(function (e) {
            exports.getLanguageServer(e);
        });
    }
    exports.getLanguageServer = function (config) {
        if (providers[config.name])
            ServerHost.unregisterProvider(providers[config.name]);
        if (!providers[config.name]) {
            providers[config.name] = new LspProvider(config);
        }
        ServerHost.registerProvider(providers[config.name]);
        return providers[config.name];
    };
    update({
        config: 'lspConfigs',
        oldValue: [],
        newValue: appConfig.lspConfigs,
    });
    require('grace/core/config').Config.on('autocompletion', update);
});