define(function (require, exports, module) {
  //Add the bulk of the menu items
  var getActiveEditor = require('./setup_editors').getEditor;
  var getActiveDoc = require('./setup_editors').getActiveDoc;
  var Docs = require('../docs/docs').Docs;
  var Notify = require('../ui/notify').Notify;
  var menu = require('./setup_main_menu').MainMenu;
  var closeTab = require('./setup_tab_host').closeTab;
  var DocsTab = require('./setup_tab_host').DocsTab;
  var Utils = require('../core/utils').Utils;
  var table = require('../ui/ui_utils').tabulate;
  var appEvents = require('../core/app_events').appEvents;
  var Config = require('../core/config').Config;
  var appConfig = Config.registerAll(
    {
      inactiveFileDelay: '5min',
    },
    'documents'
  );
  Config.registerInfo(
    {
      inactiveFileDelay:
        'Configures the duration of time used for determining inactive documents. Uses resource context.',
    },
    'documents'
  );
  function doCopy() {
    var editor = getActiveEditor();
    editor.once('copy', function (e) {
      require('../ext/editor/enhanced_clipboard').clipboard.set(e.text);
    });
    editor.getCopyText();
  }

  var menuItems = {
    '!update': [
      function (self, update) {
        var doc = getActiveDoc();
        update('save', doc ? self['!save'] : null);
      },
    ],
    '!save': {
      icon: 'save',
      caption: 'Save',
      close: true,
      sortIndex: 1,
      onclick: function () {
        getActiveEditor().execCommand('save');
      },
    },
    file: {
      caption: 'File',
      sortIndex: 2,
      icon: 'insert_drive_file',
      subTree: {
        '!update': [
          function (self, update) {
            var doc = getActiveDoc();
            update('refresh', doc ? self['!refresh'] : null);
            update('refresh-all', doc ? self['!refresh-all'] : null);
          },
        ],
        'close-current': {
          icon: 'close',
          sortIndex: -1,
          caption: 'Close current tab',
          close: true,
          onclick: function () {
            closeTab(DocsTab.active);
          },
        },
        'close-except': {
          icon: 'clear_all',
          caption: 'Close others',
          close: true,
          onclick: function () {
            var tab = DocsTab;
            for (var i = tab.tabs.length; i-- > 0; ) {
              if (tab.tabs[i] != DocsTab.active) {
                closeTab(tab.tabs[i]);
              }
            }
          },
        },
        'close-all': {
          icon: 'clear_all',
          caption: 'Close all',
          close: true,
          onclick: function () {
            var tab = DocsTab;
            for (var i = tab.tabs.length; i-- > 0; ) {
              closeTab(tab.tabs[i]);
            }
          },
        },
        'close-inactive': {
          icon: 'timelapse',
          caption: 'Close inactive tabs',
          close: true,
          onclick: function () {
            Utils.asyncForEach(
              DocsTab.tabs.slice(0),
              function (e, i, n) {
                if (
                  e == DocsTab.active ||
                  !Docs.has(e) ||
                  Docs.get(e).dirty ||
                  Docs.get(e).isTemp() //||
                  //e == lastTab
                )
                  return n();
                var inactiveTime =
                  new Date().getTime() -
                  Utils.parseTime(
                    Config.forPath(e, appConfig, 'inactiveFileDelay')
                  );

                if (Utils.getCreationDate(e) >= inactiveTime) return n();
                Docs.get(e)
                  .getFileServer()
                  .stat(Docs.get(e).getSavePath(), function (err, s) {
                    if (
                      s &&
                      s.mtimeMs < inactiveTime &&
                      s.size === Docs.get(e).getSize()
                    ) {
                      closeTab(e);
                    }
                    n();
                  });
              },
              null,
              5
            );
          },
        },

        '!refresh': {
          icon: 'refresh',
          caption: 'Refresh',
          close: true,
          onclick: function () {
            var doc = getActiveDoc();
            doc &&
              doc.refresh(function (err,refreshed) {
                if (refreshed) Notify.info('Refreshed');
              });
          },
        },
        '!refresh-all': {
          icon: 'refresh',
          caption: 'Refresh All',
          close: true,
          onclick: function () {
            Docs.refreshDocs();
          },
        },
      },
    },
    'Jump to': {
      icon: 'call_made',
      caption: 'Navigation',
      subTree: {
        '!update': [
          function (self, update) {
            var c = getActiveEditor().getMainCompleter();
            update('jump-to-def', c ? self['!jump-to-def'] : null);
            update('find-refs', c ? self['!find-refs'] : null);
          },
        ],
        'find-in-file': {
          caption: 'Find in File',
          close: true,
          onclick: function () {
            getActiveEditor().execCommand('find');
          },
        },
        'goto-file': {
          caption: 'Go to Line',
          close: true,
          onclick: function () {
            getActiveEditor().execCommand('gotoline');
          },
        },
        'next-error': {
          caption: 'Go to Next Error',
          close: true,
          onclick: function () {
            getActiveEditor().execCommand('goToNextError');
          },
        },
        '!find-refs': {
          caption: 'Find References',
          close: true,
          onclick: function () {
            var editor = getActiveEditor();
            var completer = editor.getMainCompleter();
            if (completer.findRefs) {
              completer.findRefs(editor);
            }
          },
        },
        '!jump-to-def': {
          caption: 'Jump To Definition',
          close: true,
          onclick: function () {
            var editor = getActiveEditor();
            var completer = editor.getMainCompleter();
            if (completer.jumpToDef) {
              completer.jumpToDef(editor);
            }
          },
        },
      },
    },
    edit: {
      icon: 'edit',
      caption: 'Edit',
      subTree: {
        '!update': [
          function (self, update) {
            var c = getActiveEditor().getMainCompleter();
            update('rename', c ? self['!rename'] : null);
          },
        ],
        undo: {
          icon: 'undo',
          caption: 'Undo',
          close: false,
          onclick: function () {
            getActiveEditor().execCommand('undo');
          },
        },
        redo: {
          caption: 'Redo',
          icon: 'redo',
          close: false,
          onclick: function () {
            getActiveEditor().execCommand('redo');
          },
        },
        'increase-indent': {
          caption: 'Increase Indent',
          icon: 'format_indent_increase',
          close: false,
          onclick: function () {
            getActiveEditor().execCommand('indent');
          },
        },
        'decrease-indent': {
          caption: 'Decrease Indent',
          icon: 'format_indent_decrease',
          close: false,
          onclick: function () {
            getActiveEditor().execCommand('outdent');
          },
        },
        '!rename': {
          icon: 'find_replace',
          caption: 'Rename Variable',
          close: true,
          onclick: function () {
            var editor = getActiveEditor();
            var completer = editor.getMainCompleter();
            if (completer.rename) {
              completer.rename(editor);
            }
          },
        },
        format: {
          caption: 'Format',
          icon: 'format_align_justify',
          close: true,
          onclick: function () {
            getActiveEditor().execCommand('beautify');
          },
        },
        paste: {
          caption: 'Paste',
          icon: 'content_paste',
          close: true,
          onclick: function () {
            require('../ext/editor/enhanced_clipboard').clipboard.get(
              0,
              function (text) {
                getActiveEditor().execCommand('paste', text);
              }
            );
          },
        },
        copy: {
          caption: 'Copy',
          icon: 'content_copy',
          onclick: doCopy,
        },
        cut: {
          caption: 'Cut',
          icon: 'content_cut',
          onclick: function doCut() {
            var editor = getActiveEditor();
            doCopy();
            editor.execCommand('cut');
          },
        },
      },
    },
  };
  for (var i in menuItems) {
    menu.extendOption(i, menuItems[i]);
  }
  menu.addOption(
    'quick-info',
    {
      icon: 'info',
      caption: 'Show Document Info',
      onclick: function () {
        var doc = getActiveDoc();

        var data;
        if (doc)
          data = {
            Size: doc.getSize(),
            Opened: Utils.getCreationDate(doc.id),
            Lines: doc.session.getLength(),
            Encoding: doc.getEncoding(),
            'Line Mode': doc.session.getNewLineMode(),
            'Detected New Line': JSON.stringify(
              doc.session.getDocument().$autoNewLine
            ),
            'Autosave Enabled': doc.allowAutoSave,
            'Annotation Providers': doc.session.listWorkers().map(function (m) {
              return m.id;
            }),
          };
        else data = {};

        appEvents.asyncTrigger('showDocInfo', {data: data}, function (e) {
          if (!e.defaultPrevented)
            Notify.modal({
              header: 'Document Info',
              body: table(data),
              footers: ['close'],
            });
        });
      },
    },
    true
  );
});