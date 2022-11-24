define(function (require, exports, module) {
    'use strict';
    var Config = require('grace/core/config').Config;
    var appEvents = require('grace/core/app_events').AppEvents;
    var Actions = require('grace/core/actions').Actions;
    var modelist = require('ace!ext/modelist');
    var getActiveEditor = require('grace/setup/setup_editors').getEditor;
    var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
    var Editors = require('grace/editor/editors').Editors;
    var Context = require('grace/ext/config/context').Context;
    var assert = require('grace/core/utils').Utils.assert;
    var FocusManager = require('grace/ui/focus_manager').FocusManager;
    Context.registerContext(
        'resource',
        'glob',
        'The resource context is set by some file actions based on the path of the resource being handled.'
    );
    Context.registerContext(
        'resourceMode',
        'mode',
        'The resourceMode context the language mode of the resource context and depends on documents.defaultMode.'
    );
    /** @override */
    Config.forPath = function (resource, ns, key) {
        if (ns) assert(Config.allConfigs[ns], 'Invalid namespace ' + ns);
        return Context.withContext('resource', resource, function (conf) {
            var type = conf.documents.defaultMode;
            return Context.withContext(
                'resourceMode',
                type === 'auto'
                    ? modelist.getModeForPath(resource || '').mode
                    : type,
                function (conf) {
                    return key
                        ? ns === 'documents' && // premature optimization
                          key === 'defaultMode' &&
                          conf[ns][key] === 'auto'
                            ? Context.getContext('resourceMode')
                            : conf[ns][key]
                        : ns
                        ? conf[ns]
                        : conf;
                }
            );
        });
    };

    Context.registerContext(
        'editorDoc',
        'filename|glob',
        'Set based on the filepath of the active document.'
    );
    Context.registerContext(
        'editorMode',
        'mode',
        'Set based on the language mode of the active document.'
    );
    Context.registerContext(
        'editorFocus',
        'boolean',
        'Is when the editor is focused ie. cursor is blinking.'
    );
    Context.registerContext(
        'inDiffEditor',
        'boolean',
        'Set when the current editor is a diff editor.'
    );
    Context.registerContext(
        'keyboardVisible',
        'boolean',
        'Set based on the visibility of the soft keyboard.'
    );
    (function () {
        function _updateEditor(e, ed) {
            ed = ed && ed.session ? ed : e.editor;
            if (ed === getActiveEditor()) {
                Context.setContext('editorMode', ed.session.getModeName());
                Context.setContext('editorFocus', ed.isFocused());
                Context.setContext('inDiffEditor', !!ed.isDiffEditor);
            }
        }
        function _updateDoc(e) {
            Context.setContext('editorDoc', e.doc ? e.doc.getSavePath() : null);
            //Optimization that will likely be abused
            if (e.doc) {
                Context.setContext('resource', e.doc.getSavePath());
                Context.setContext('resourceMode', e.doc.session.getModeName());
            }
        }
        function _updateKbVisibility(e) {
            Context.setContext('keyboardVisible', e.visible);
        }
        Editors.onEach(function trackMode(e) {
            e.on('changeMode', _updateEditor, true);
            e.on('focus', _updateEditor);
            e.on('blur', _updateEditor);
        });
        appEvents.on('keyboardChanged', _updateKbVisibility);
        appEvents.on('changeEditor', _updateEditor, true);
        appEvents.on('changeDoc', _updateDoc, true);
        _updateEditor({editor: getActiveEditor()});
        _updateDoc({doc: getActiveDoc()});
        _updateKbVisibility({visible: FocusManager.keyboardVisible});
    })();

    var store = Config.registerAll(null, '_triggers');
    appEvents.on('showDocInfo', function (e) {
        e.data['Enabled Options'] = JSON.stringify(
            store.rules
                .map(function (e) {
                    e.bound || e.options;
                })
                .filter(Boolean)
        );
    });
    Actions.addAction({
        caption: 'Show contexts',
        icon: 'settings_applications',
        subIcon: 'debug',
        showIn: 'actionbar.settings',
        handle: function () {
            var Notify = require('grace/ui/notify').Notify;
            var Schema = require('grace/core/schema').Schema;
            var printSchema = require('grace/ext/print_schema').printSchema;
            var table = require('grace/ui/ui_utils').tabulate;
            var types = Config.getConfigInfo('_triggers.rules').contexts;
            var data = {};
            for (var i in types) {
                data[i] = {
                    Type: printSchema(Schema.parse(types[i])),
                    'Current Value': String(Context.getContext(i)),
                };
            }
            data['Any configuration path e.g files.projectName'] = 'any';
            Notify.modal({
                header: 'Configuration Contexts',
                body: table(data),
            });
        },
    });
});