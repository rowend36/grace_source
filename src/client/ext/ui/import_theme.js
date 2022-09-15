define(function (require, exports, module) {
  'use strict';
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var MainMenu = require('grace/setup/setup_main_menu').MainMenu;
  var uiConfig = require('grace/core/config').Config.registerAll(null, 'ui');
  var configureObj = require('grace/core/config').Config.configureObj;
  var themelist = ace.require('ace/ext/themelist');
  var getSettingsEditor = require('grace/editor/editors').Editors
    .getSettingsEditor;
  MainMenu.extendOption(
    'load-settings',
    {
      caption: 'Configuration',
      subTree: {
        'import-theme': {
          caption: 'Import theme',
          icon: 'file_download',
          onclick: function () {
            var c = 0,
              val,
              ev,
              JSONExt;
            require(['grace/ext/json_ext'], function (mod) {
              JSONExt = mod.JSONExt;
              if (c++) _parseTheme2();
            });
            require(['grace/ext/fileview/fileviews'], function (mod) {
              mod.Fileviews.pickFile('Select theme file', function (ev) {
                ev.preventDefault();
                FileUtils.getDocFromEvent(
                  ev,
                  function (val, err) {
                    if (!val || err) {
                      return require('grace/ui/notify').Notify.error(
                        'Error loading theme file.'
                      );
                    }
                    val = val;
                    ev = ev;
                    if (c++) _parseTheme2();
                  },
                  false,
                  true
                );
              });
            });
            function _parseTheme2() {
              try {
                //Verify theme syntax
                var theme = JSONExt.parse(val);
                var data = {
                  filepath: ev.filepath,
                  name: theme.name
                    ? theme.name
                    : ev.filename.replace(/([^\.]+)\..*/, '$1'),
                  isDark: theme.type == 'dark',
                };
                if (!/dark|light/i.test(data.name)) {
                  data.name += theme.type == 'dark' ? ' Dark' : ' Light';
                }
                data.server = ev.browser.fileServer.id;
                configureObj(
                  'customThemes',
                  uiConfig.customThemes.concat(data),
                  true
                );
                require('grace/ui/notify').Notify.ask(
                  'Apply theme now?',
                  function () {
                    var module = themelist.themesByName[data.name];
                    if (module) {
                      getSettingsEditor().setOption('theme', module.theme);
                    } else
                      require('grace/ui/notify').Notify.error(
                        'Failed to import theme'
                      );
                  }
                );
              } catch (e) {
                console.log(e);
                return require('grace/ui/notify').Notify.error(
                  'Error parsing ' + ev.filepath
                );
              }
            }
          },
        },
      },
    },
    true
  );
});