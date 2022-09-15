define(function (require, exports, module) {
    'use strict';

    var Annotations = ace.require('ace/annotations').Annotations;
    var Editors = require('grace/editor/editors').Editors;
    var appEvents = require('grace/core/app_events').AppEvents;
    var EventsEmitter = require('grace/core/events_emitter').EventsEmitter;
    var Utils = require('grace/core/utils').Utils;
    var getActiveEditor = require('grace/setup/setup_editors').getEditor;

    var lintProviders = new (require('grace/core/registry').Registry)(
        'getAnnotations',
        'linting'
    );
    var lintWrappers = [];

    function createLintWrapper(editor, provider, instance) {
        //ace.Annotations.Provider interface.
        //Known issues:
        //Providers are tied to editor lifecycle not session lifecycle
        //Also createWorker is synchronous and does not pass the session.
        //Solution:
        //Create AnnotationProvider wrappers for each instance.
        var stub = {
            name: provider.name,
            get provider() {
                return provider;
            },
            createWorker: function () {
                var worker = new EventsEmitter();
                worker.attachToDocument = function (doc) {
                    this.doc = doc;
                };
                var grp = Utils.groupEvents(instance);
                worker.terminate = function () {
                    this.trigger('terminate');
                    grp.off();
                };
                grp.on('annotate', function (data) {
                    if (data.session.getDocument() == this.doc) {
                        this.trigger('annotate', data, true);
                    }
                });
                grp.once('destroy', worker.terminate.bind(worker));
            },
            getPriority: function (mode, session) {
                return (
                    editor.session === session &&
                    provider.modes.indexOf(mode.split('/').pop()) && // mode matches
                    provider.priority
                );
            },
            destroy: function () {
                instance.$lintWrapper = null;
                lintWrappers.splice(lintWrappers.indexOf(this), 1);
                Annotations.unregisterProvider(stub);
                onChangeSessionForLint(null, editor);
            },
        };
        instance.$lintWrapper = stub;
        lintWrappers.push(stub);
        Annotations.registerProvider(stub);
        instance.on('destroy', stub.destroy.bind(stub));
    }

    var onValueChangeForAnnotations = function (e, editor) {
        clearTimeout(editor.$debounceAnnotations);
        if (!editor.session.$useWorker) return;
        editor.$debounceAnnotations = setTimeout(
            $invokeLinters.bind(editor),
            2000
        );
    };
    var $invokeLinters = function () {
        var editor = this,
            hasMain;
        if (!editor.session.$useWorker) return;
        lintProviders.getActive(editor).forEach(function (server) {
            var instance;
            if (hasMain && !server.isSupport) return;
            hasMain = hasMain || !server.isSupport;
            if ((instance = editor[server.name])) {
                if (!instance.$lintWrapper)
                    createLintWrapper(editor, server, instance);
                instance.updateAnnotations(editor);
            }
            server.init(editor, function (instance) {
                if (!instance) return;
                editor[server.name] = instance;
                if (!instance.$lintWrapper)
                    createLintWrapper(editor, server, instance);
                instance.updateAnnotations(editor);
            });
        });
    };

    /**
     * Used to avoid restarting workers unnecessarily.
     */
    var onChangeSessionForLint = function (e, editor) {
        var session = editor.session;
        if (session) {
            Annotations.updateWorkers(session);
            if (!session.$restartWorker) scheduleRestartWorker(session);
            $invokeLinters.apply(editor);
        }
    };

    function scheduleRestartWorker(session) {
        session.$restartWorker = function (e) {
            if (e.editor && !e.editor.$onChangeSessionForLint) {
                session.off('changeEditor', session.$restartWorker);
                session.$restartWorker = null;
                Annotations.updateWorkers(session);
            }
        };
        session.on('changeEditor', session.$restartWorker);
    }

    /*
     * Overrides the default worker for the editor's session
     * Automatically resets it when the session is moved to another editor
     */
    function setupLinters(editor) {
        if (!editor.$onChangeSessionForLint) {
            editor.$onChangeSessionForLint = onChangeSessionForLint;
            editor.on('changeSession', editor.$onChangeSessionForLint);
            editor.on('change', onValueChangeForAnnotations);
            editor.$onChangeSessionForLint(editor, editor);
        }
    }
    Editors.forEach(setupLinters);
    appEvents.on('createEditor', function (e) {
        setupLinters(e.editor);
    });

    exports.registerLintProvider = function (provider) {
        lintProviders.register(provider);
        if (getActiveEditor())
            onValueChangeForAnnotations(null, getActiveEditor());
    };
    exports.unregisterLintProvider = function (provider) {
        lintProviders.unregister(provider);
        if (provider.$lintWrappers)
            lintWrappers.forEach(function (e) {
                if (e.provider === provider) e.remove();
            });
        if (getActiveEditor())
            onValueChangeForAnnotations(null, getActiveEditor());
    };
});