define(function (require, exports, module) {
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            lspConfigs: [],
        },
        'intellisense',
    );
    var Notify = require('grace/ui/notify').Notify;

    require('grace/core/config').Config.registerInfo(
        {
            lspConfigs: {
                doc:
                    'Array of configurations. Format {\n\
name: Name of provider.\n\
address: string- Address default: ws: or wss:\n\
modes: List of language modes where it is enabled\n\
languageId?: Override languageID to report. Necessary for some language servers to work properly.\n\
isSupport?: Whether this language service provides full support or should allow other services to support it.\n\
priority?: An LSP will be called before those with lower priority.\n\
options?: Server options to send to language service',
                type: [
                    {
                        name: 'string',
                        address: 'url',
                        modes: ['string'],
                        languageId: '?string',
                        isSupport: '?boolean',
                        priority: '?number',
                        options: '?object',
                    },
                ],
            },
        },
        'intellisense',
    );
    var ServerHost = require('grace/ext/language/server_host').ServerHost;
    var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
    var Depend = require('grace/core/depend');
    var Utils = require('grace/core/utils').Utils;
    var appEvents = require('grace/core/app_events').AppEvents;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    /** @constructor*/
    function LspProvider(config) {
        this.id = Utils.genID('lsp');
        this.address = config.address;
        this.modes = config.modes;
        this.name = config.name ? config.name + '_LSPClient' : this.id;
        this.languageId = config.languageId;
        this.isSupport = !!config.isSupport;
        if (typeof config.priority === 'number')
            this.priority = config.priority;
        this.options = config.options;
        this.instance = null;
        this.transport = null;
        this.changeWorkspace = this.changeWorkspace.bind(this);
        this.changeWorkspace();
        appEvents.on('changeProject', this.changeWorkspace);
    }
    Utils.inherits(LspProvider, BaseProvider);
    var LspClient, LspTransport;
    LspProvider.prototype.init = Depend.after(
        function (cb) {
            var self = this;
            require(['./lsp_transport', './lsp_client'], function (mod1, mod) {
                self.changeOptions();
                LspTransport = mod1.LspTransport;
                LspClient = mod.LspClient;
                cb();
            });
        },
        function (editor, cb) {
            var self = this;
            if (!self.transport) {
                try {
                    self.transport = new LspTransport(self);
                } catch (e) {
                    Notify.error(e.message);
                    console.error(e);
                    self.updateCapabilities({});
                    return cb();
                }
            }
            if (self.instance) {
                return cb(self.instance);
            }
            self.instance = new LspClient(self.transport, {
                switchToDoc: ServerHost.switchToDoc,
                getFileName: ServerHost.getFileName,
                readFile: ServerHost.readFile,
                normalize: FileUtils.normalize,
                name: self.name,
            });
            self.attachToEditor(editor, self.instance, cb);
        },
    );
    LspProvider.prototype.updateCapabilities = function (has) {
        var prov = this;
        if (has.completionProvider) {
            if (has.completionProvider.triggerCharacters) {
                prov.triggerRegex = new RegExp(
                    '(?:' +
                        has.completionProvider.triggerCharacters
                            .map(Utils.regEscape)
                            .join('|') +
                        ')$',
                );
            }
        } else prov.hasCompletions = false;
        if (!has.definitionProvider) prov.hasDefinition = false;
        if (!has.referencesProvider) prov.hasReferences = false;
        if (!has.signatureHelpProvider) prov.hasArgHints = false;
        if (!has.signatureHelpProvider) prov.hasArgHints = false;
        if (!has.documentFormattingProvider) prov.hasFormatting = false;
        if (!has.documentRangeFormattingProvider)
            prov.hasRangeFormatting = false;
        if (!has.renameProvider) prov.hasRename = false;
        ServerHost.toggleProvider(prov, prov.modes, true);
    };
    LspProvider.prototype.changeOptions = function () {
        if (this.transport) {
            this.transport.initialize(
                function () {
                    this.transport.notify(
                        'workspace/didChangeWorkspaceFolders',
                        {
                            settings: this.options,
                        },
                    );
                }.bind(this),
            );
        }
    };
    LspProvider.prototype.changeWorkspace = function (e) {
        var old = this.workspace;
        var project = e ? e.project : FileUtils.getProject();
        var current =
            project.rootDir === FileUtils.NO_PROJECT
                ? {
                      rootUri: 'file://tmp/',
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
                        },
                    );
                }.bind(this),
            );
        }
    };
    //Add everything initially, then modify as needed
    LspProvider.prototype.hasArgHints = true;
    LspProvider.prototype.hasAnnotations = true;
    LspProvider.prototype.hasFormatting = true;
    LspProvider.prototype.hasRangeFormatting = true;
    LspProvider.prototype.hasSynchronization = true;
    LspProvider.prototype.hasRename = true;
    LspProvider.prototype.priority = 12000;
    //Todo codeLens, codeAction and executeCommand
    var providers = {
        //[name]: LspProvider
    };

    var lspConfigs = [];
    function update(ev) {
        if (ev.config !== 'lspConfigs') return;
        var m = appConfig.lspConfigs,
            o = lspConfigs;
        lspConfigs = appConfig.lspConfigs;
        var removed = o.filter(Utils.notIn(m));
        var added = m.filter(Utils.notIn(o));
        removed.forEach(function (e) {
            if (providers[e.name]) {
                ServerHost.unregisterProvider(providers[e.name]);
                providers[e.name].destroyInstance();
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
    update({config: 'lspConfigs'});
    require('grace/core/config').Config.on('intellisense', update);
});