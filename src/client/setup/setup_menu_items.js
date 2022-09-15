define(function (require, exports, module) {
  //Add the bulk of the menu items
  var getActiveEditor = require('./setup_editors').getEditor;
  var getActiveDoc = require('./setup_editors').getActiveDoc;
  var Docs = require('../docs/docs').Docs;
  var Notify = require('../ui/notify').Notify;
  var Actions = require('../core/actions').Actions;
  var closeTab = require('./setup_tab_host').closeTab;
  var DocsTab = require('./setup_tab_host').DocsTab;
  var Utils = require('../core/utils').Utils;
  var table = require('../ui/ui_utils').tabulate;
  var FocusManager = require('../ui/focus_manager').FocusManager;
  var appEvents = require('../core/app_events').AppEvents;
  var Config = require('../core/config').Config;
  var appConfig = Config.registerAll(
    {
      inactiveFileDelay: '5min',
    },
    'documents',
  );
  Config.registerInfo(
    {
      inactiveFileDelay:
        'Configures the duration of time used for determining inactive documents. Uses resource context.',
    },
    'documents',
  );
  function doCopy() {
    var editor = getActiveEditor();
    editor.once('copy', function (e) {
      require('../ext/editor/enhanced_clipboard').clipboard.set(e.text);
    });
    editor.getCopyText();
  }

  var menuItems = {
    file: {
      caption: 'File',
      sortIndex: 2,
      icon: 'insert_drive_file',
      subTree: {
        'close-current': {
          icon: 'close',
          sortIndex: -3,
          caption: 'Close current tab',
          handle: function () {
            closeTab(DocsTab.active);
          },
        },
        'close-except': {
          icon: 'clear_all',
          caption: 'Close others',
          handle: function () {
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
          handle: function () {
            var tab = DocsTab;
            for (var i = tab.tabs.length; i-- > 0; ) {
              closeTab(tab.tabs[i]);
            }
          },
        },
        'close-inactive': {
          icon: 'timelapse',
          caption: 'Close inactive tabs',
          handle: function () {
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
                    Config.forPath(e, 'documents', 'inactiveFileDelay'),
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
              5,
            );
          },
        },
      },
    },
    go: {
      icon: 'call_made',
      caption: 'Go..',
      subTree: {
        'find-in-file': {
          caption: 'Find in file',
          handle: function () {
            FocusManager.hintChangeFocus();
            getActiveEditor().execCommand('find');
          },
        },
        'goto-file': {
          caption: 'Go to line',
          handle: function () {
            FocusManager.hintChangeFocus();
            getActiveEditor().execCommand('gotoline');
          },
        },
        'next-error': {
          caption: 'Go to next error',
          command: 'goToNextError',
        },
      },
    },
    edit: {
      icon: 'edit',
      caption: 'Edit',
      subTree: {
        undo: {
          icon: 'undo',
          caption: 'Undo',
          dontClose: true,
          handle: function () {
            getActiveEditor().execCommand('undo');
          },
        },
        redo: {
          caption: 'Redo',
          icon: 'redo',
          dontClose: true,
          handle: function () {
            getActiveEditor().execCommand('redo');
          },
        },
        'increase-indent': {
          caption: 'Increase indent',
          icon: 'format_indent_increase',
          dontClose: true,
          handle: function () {
            getActiveEditor().execCommand('indent');
          },
        },
        'decrease-indent': {
          caption: 'Decrease indent',
          icon: 'format_indent_decrease',
          dontClose: true,
          handle: function () {
            getActiveEditor().execCommand('outdent');
          },
        },
        paste: {
          caption: 'Paste',
          icon: 'content_paste',
          handle: function () {
            require('../ext/editor/enhanced_clipboard').clipboard.get(
              0,
              function (text) {
                getActiveEditor().execCommand('paste', text);
              },
            );
          },
        },
        copy: {
          caption: 'Copy',
          icon: 'content_copy',
          handle: doCopy,
        },
        cut: {
          caption: 'Cut',
          icon: 'content_cut',
          handle: function doCut() {
            var editor = getActiveEditor();
            doCopy();
            editor.execCommand('cut');
          },
        },
      },
    },
  };
  Actions.addActions(menuItems, {showIn: 'actionbar'});
  Actions.addAction({
    icon: 'info',
    caption: 'Show document info',
    showIn: 'actionbar.settings',
    handle: function () {
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
            doc.session.getDocument().$autoNewLine,
          ),
          'Autosave Enabled': doc.allowAutoSave,
          'Annotation Providers': doc.session.listWorkers().map(function (e) {
            return e.provider.name || e.id;
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
  });
});