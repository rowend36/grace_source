define(function (require, exports, module) {
  'use strict';
  var Config = require('grace/core/config').Config;
  var appEvents = require('grace/core/app_events').AppEvents;
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var modelist = ace.require('ace/ext/modelist');
  var getActiveEditor = require('grace/setup/setup_editors').getEditor;
  var getActiveDoc = require('grace/setup/setup_editors').getActiveDoc;
  var Editors = require('grace/editor/editors').Editors;
  var Context = require('grace/ext/config/context').Context;
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
    return Context.withContext('resource', resource, function (conf) {
      var type = conf.documents.defaultMode;
      return Context.withContext(
        'resourceMode',
        type === 'auto' ? modelist.getModeForPath(resource || '').mode : type,
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

  Context.DOC = function (op, path, doc, cache, event) {
    if (op != '=~') path = FileUtils.normalize(path);
    return Context.COMPARE(op, path, doc.getSavePath(), cache, event);
  };
  Context.registerContext(
    'editorDoc',
    'file|glob',
    Context.DOC,
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
    'mode',
    'Set based on the visibility of the soft keyboard.'
  );
  (function () {
    function _updateEditor(e, ed) {
      ed = ed && ed.session ? ed : e.editor;
      if (ed === getActiveEditor()) {
        Context.setContext('editorMode', ed.session.getModeName());
        Context.setContext('editorFocus', ed.isFocused());
        Context.setContext('inDiffEditor', ed.isDiffEditor);
      }
    }
    function _updateDoc(e) {
      Context.setContext('editorDoc', e.doc);
      //Optimization that will likely be abused
      if (e.doc) {
        Context.setContext('resource', e.doc.getSavePath());
        Context.setContext('resourceMode', e.doc.session.getModeName());
      }
    }
    function _updateKbVisibility(e) {
      Context.setContext('keyboardVisible', e.visible);
    }
    function trackMode(e) {
      (e.editor || e).on('changeMode', _updateEditor);
      (e.editor || e).on('focus', _updateEditor);
      (e.editor || e).on('blur', _updateEditor);
    }
    Editors.forEach(trackMode);
    appEvents.on('createEditor', trackMode);
    appEvents.on('keyboardChanged', _updateKbVisibility);
    appEvents.on('changeEditor', _updateEditor);
    appEvents.on('changeDoc', _updateDoc);
    _updateEditor(getActiveEditor());
    _updateDoc({doc: getActiveDoc()});
    _updateKbVisibility({visible: FocusManager.keyboardVisible});
  })();

  (function () {
    var store = Config.registerAll(null, '_triggers');
    var MainMenu = require('grace/setup/setup_main_menu').MainMenu;
    appEvents.on('showDocInfo', function (e) {
      e.data['Enabled Options'] = JSON.stringify(
        store.rules
          .map(function (e) {
            e.bound || e.options;
          })
          .filter(Boolean)
      );
    });

    MainMenu.extendOption(
      'load-settings',
      {
        caption: 'Configuration',
        icon: 'settings_applications',
        subTree: {
          'list-contexts': {
            caption: 'Show contexts',
            icon: 'settings_applications',
            subIcon: 'debug',
            onclick: function () {
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
          },
        },
      },
      true,
      true
    );
  })();
});