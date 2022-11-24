define(function (require, exports, module) {
    'use strict';
    var Config = require('grace/core/config').Config;
    var Schema = require('grace/core/schema').Schema;
    var Docs = require('grace/docs/docs').Docs;
    var removeFrom = require('grace/core/utils').Utils.removeFrom;
    /** @constructor */
    function Provider(name, modes) {
        if (name) this.name = name;
        if (modes) this.modes = modes;
    }
    Provider.prototype.ALL = [];
    Provider.prototype.modes = Provider.prototype.ALL;
    Provider.prototype.name = '';
    Provider.prototype.names = null;
    Provider.prototype.priority = 0;
    Provider.prototype.addName = function (alias) {
        (this.names || (this.names = [])).push(alias);
    };

    /** @constructor */
    function Registry(action, namespace) {
        var names = [null];
        if (namespace) {
            Config.registerAll({defaultProvider: null}, namespace);
            Config.registerInfo(
                {
                    defaultProvider: {
                        values: names,
                    },
                },
                namespace
            );
        }
        var providers = [];
        /**
         * @returns {Provider|undefined}
         */
        function getProviderByName(name) {
            for (var j = 0; j < providers.length; j++) {
                if (providers[j].name == name) {
                    return providers[j];
                }
            }
            for (j = 0; j < providers.length; j++) {
                if (
                    providers[j].names &&
                    providers[j].names.indexOf(name) > -1
                ) {
                    return providers[j];
                }
            }
        }

        /**
         * @returns {Provider|undefined}
         */
        function getProviderByHandle(handle) {
            for (var j = 0; j < providers.length; j++) {
                if (providers[j][action] === handle) {
                    return providers[j];
                }
            }
        }

        /**
         * @returns {Provider|undefined}
         */
        function getProviderForMode(mode) {
            for (var j = 0; j < providers.length; j++) {
                if (
                    providers[j].modes === providers[j].ALL ||
                    providers[j].modes.indexOf(mode) > -1
                ) {
                    return providers[j];
                }
            }
        }

        function getProviderForPath(path, mode) {
            var provider;
            if (namespace) {
                var name = Config.forPath(path, namespace, 'defaultProvider');
                if (name) provider = getProviderByName(name);
            }
            if (provider) return provider;
            mode = mode || Docs.autoMode(path);
            return getProviderForMode(mode);
        }

        /**
         * @returns {Array<Provider>} - All the providers enabled for this editor
         */
        function getActiveProviders(editor, mode) {
            var main;
            var active = [];
            if (!editor.session) return active;
            mode = mode || editor.session.getModeName();
            var doc = Docs.forSession(editor.session);
            if (doc) main = getProviderForPath(doc.getSavePath(), mode);
            if (main) active.push(main);
            for (var j = 0; j < providers.length; j++) {
                if (
                    providers[j] !== main &&
                    providers[j].modes.indexOf(mode) > -1
                ) {
                    active.push(providers[j]);
                }
            }
            return active;
        }

        function unregisterProvider(provider) {
            if (typeof provider === 'string')
                provider = getProviderByName(provider);
            if (typeof provider === 'function')
                provider = getProviderByHandle(provider);
            if (removeFrom(providers, provider) > -1) {
                removeFrom(names, provider.name);
                if (provider.names)
                    provider.names.forEach(removeFrom.bind(null, names));
            }
        }

        /** Sort in descending order of name/priority **/
        function byPriority(a, b) {
            return (
                (b.priority || 0) - (a.priority || 0) ||
                (b.name > a.name ? 1 : a.name > b.name ? -1 : 0)
            );
        }

        function registerProvider(provider, modes, handle, aliases) {
            if (typeof handle === 'function') {
                unregisterProvider(handle);
                provider = new Provider(provider, modes);
                provider[action] = handle;
                if (aliases) aliases.forEach(provider.addName, provider);
            }
            unregisterProvider(provider.name);
            providers.push(provider);
            names.push(provider.name);
            if (provider.names)
                provider.names.forEach(function (e) {
                    names.push(e);
                });
            providers.sort(byPriority);
            names.sort();
            return provider;
        }

        this.register = registerProvider;
        this.forEach = providers.forEach.bind(providers);
        this.unregister = unregisterProvider;
        this.getForMode = getProviderForMode;
        this.getForPath = getProviderForPath;
        this.getActive = getActiveProviders;
        this.getByName = getProviderByName;
        this.names = names;
    }
    exports.Provider = Provider;
    exports.Registry = Registry;
});