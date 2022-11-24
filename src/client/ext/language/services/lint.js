define(function (require, exports, module) {
    'use strict';

    var Annotations = require('ace!annotations').Annotations;
    var Editors = require('grace/editor/editors').Editors;
    var EventsEmitter = require('grace/core/events_emitter').EventsEmitter;
    var Utils = require('grace/core/utils').Utils;
    var appEvents = require('grace/core/app_events').AppEvents;

    var lintProviders = new (require('grace/core/registry').Registry)(
        'getAnnotations',
        'intellisense.linting'
    );
    var lintWrappers = [];

    function createLintWrapper(editor, provider) {
        var wrapper = lintWrappers.find(function (e) {
            return e.provider === provider && e.editor === editor;
        });
        if (wrapper) return wrapper;
        //ace Annotations.Provider interface.
        //Known issues:
        //Providers are tied to editor/application lifecycle not session.
        //Also createWorker is synchronous and does not pass the session.
        //Solution:
        //Create AnnotationProvider wrappers for each Editor and for each Provider and Workers for each instance.
        wrapper = {
            name: provider.name,
            provider: provider,
            editor: editor,
            createWorker: function () {
                //Create a worker for each session
                var worker = new EventsEmitter();
                worker.attachToDocument = function (doc) {
                    this.doc = doc;
                };
                var grp = Utils.groupEvents();
                worker.terminate = function () {
                    worker.terminated = true;
                    this.trigger('terminate');
                    grp.off();
                };
                provider.init(editor, function (instance) {
                    if (!instance || worker.terminated) return;
                    grp.on(
                        'annotate',
                        function (data) {
                            if (data.session.getDocument() == worker.doc) {
                                worker.trigger('annotate', data, true);
                            }
                        },
                        instance
                    );
                    grp.once(
                        'destroy',
                        worker.terminate.bind(worker),
                        instance
                    );
                    instance.updateAnnotations(editor);
                });
                return worker;
            },
            getPriority: function (mode, session) {
                if (
                    editor.session === session &&
                    provider.modes.indexOf(mode.split('/').pop()) > -1
                )
                    // mode matches
                    return !editor.$preferDefaultLinters
                        ? provider.priority
                        : provider.priority - 100000;
            },
            destroy: function () {
                lintWrappers.splice(lintWrappers.indexOf(this), 1);
                Annotations.unregisterProvider(wrapper);
                onChangeSessionForLint(null, editor);
            },
        };
        lintWrappers.push(wrapper);
        Annotations.registerProvider(wrapper);
        Annotations.updateWorkers(editor.session);
        return wrapper;
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
            if (hasMain && !server.isSupport) return;
            hasMain = hasMain || !server.isSupport;
            createLintWrapper(editor, server);
            if (editor[server.name]) {
                editor[server.name].updateAnnotations(editor, Utils.noop);
            }
        });
    };

    /**
     * Used to avoid restarting workers unnecessarily.
     */
    var onChangeSessionForLint = function (e, editor) {
        var session = editor.session;
        if (session) {
            Annotations.updateWorkers(session);
            scheduleRestartWorker(session);
            $invokeLinters.apply(editor);
        }
    };

    /*
     * Overrides the default worker for the editor's session
     * Automatically resets it when the session is moved to another editor
     */
    function scheduleRestartWorker(session) {
        if (session.$restartWorker) return;
        session.$restartWorker = function (e) {
            if (e.editor && !e.editor.$onChangeSessionForLint) {
                session.off('changeEditor', session.$restartWorker);
                session.$restartWorker = null;
                Annotations.updateWorkers(session);
            }
        };
        session.on('changeEditor', session.$restartWorker);
    }


    //Wait for all linters to be registered.
    appEvents.on('fullyLoaded', function () {
        Editors.onEach(function (editor) {
            if (!editor.$onChangeSessionForLint) {
                editor.$onChangeSessionForLint = onChangeSessionForLint;
                editor.on('changeSession', editor.$onChangeSessionForLint);
                editor.on('change', onValueChangeForAnnotations);
                editor.$onChangeSessionForLint(editor, editor);
                editor.on('destroy', function () {
                    if (editor.$debounceAnnotations) {
                        clearTimeout(editor.$debounceAnnotations);
                    }
                    lintWrappers.forEach(function (e) {
                        if (e.editor === editor) e.destroy();
                    });
                });
            }
        });
    });

    exports.registerLintProvider = function (provider) {
        lintProviders.register(provider);
        Editors.forEach(function (e) {
            onValueChangeForAnnotations(null, e);
        });
    };
    exports.unregisterLintProvider = function (provider) {
        lintProviders.unregister(provider);
        lintWrappers.forEach(function (e) {
            if (e.provider === provider) e.destroy();
        });
        Editors.forEach(function (e) {
            onValueChangeForAnnotations(null, e);
        });
    };
    Editors.getSettingsEditor().addOption('preferDefaultLinters', {
        set: function () {
            Annotations.updateWorkers(this.session);
        },
        value: false,
    });
});