define(function (require, exports, module) {
  'use strict';
  /* globals $, ace */
  /*Theming - Spent a lot of time on this before I decided to just 
  port VSCode themes..*/
  require('css!../libs/css/materialize-grace');
  require('css!../index.css');
  require('css!./themes/base');
  var configEvents = require('../core/config').Config;
  var appEvents = require('../core/app_events').AppEvents;
  var FileUtils = require('../core/file_utils').FileUtils;
  var Utils = require('../core/utils').Utils;
  var appConfig = require('../core/config').Config.registerAll({
    appFontSize: 'normal',
    adaptiveTheme: true,
    customThemes: [],
  });
  var getSettingsEditor = require('../editor/editors').Editors
    .getSettingsEditor;
  var themelist = require('ace!ext/themelist');

  require('../core/config').Config.registerInfo({
    adaptiveTheme: {
      doc: 'Allow Editor theme to control application UI',
      values: [true, 'force', false],
    },
    appFontSize: {
      doc: 'Font size for UI',
      values: ['small', 'normal', 'big'],
    },
    customThemes: {
      //Until we can delete themes
      type: [
        {
          name: 'string',
          filepath: 'filename',
          isDark: '?boolean',
          server: '?string',
        },
      ],
    },
  });

  function onChange(ev) {
    switch (ev.config) {
      case 'adaptiveTheme':
        applyTheme($('.editor-primary'), true);
        break;
      case 'customThemes':
        appConfig.customThemes.forEach(addThemeToAce);
        break;
      case 'appFontSize':
        switch (ev.value()) {
          case 'small':
          case 'normal':
          case 'big':
            clearClass($(document.body.parentElement), /font$/);
            document.body.parentElement.className += ' ' + ev.value() + 'font';
            break;
          default:
            ev.preventDefault();
        }
        break;
    }
  }
  onChange({config: 'customThemes'});
  configEvents.on('ui', onChange);
  //App Theming
  var removeSplashScreen = Utils.delay(function () {
    document.body.parentElement.className +=
      ' ' + appConfig.appFontSize + 'font';
    $('#splash-screen').animate(
      {
        paddingLeft: 200,
        opacity: 0.5,
        easing: 'linear',
      },
      500,
      function () {
        $('#splash-screen').detach();
        $('#splash-screen-css').detach();
      }
    );
    removeSplashScreen = null;
  }, 100);
  appEvents.once('appLoaded', removeSplashScreen);

  //Themes that can be used with a tweak of contrast/tint.
  //Only the best 7/23 were chosen
  var autoTheme = {
    'ace-dracula': 'theme-dark-bg',
    'ace-solarized-dark': 'theme-dark-bg theme-contrast',
    'ace-pastel-on-dark': 'theme-contrast',
    'ace-cobalt': 'theme-ace-cobalt',
    'ace-gruvbox': 'theme-ace-gruvbox',
    'ace-gob': 'theme-ace-gob',
    'ace-tomorrow-night': 'theme-ace-tomorrow-night',
  };
  var themeData = {
    rootClassName: 'ace-tm',
  };
  appEvents.on('editorThemeLoaded', function (e) {
    var ace_theme = e.theme;
    themeData = {
      rootClassName:
        ace_theme.rootClassName ||
        ace_theme.cssClass +
          (ace_theme.isDark ? ' theme-auto ' : '') +
          (autoTheme[ace_theme.cssClass] || ''),
      isAppUITheme:
        ace_theme.isAppUITheme || autoTheme.hasOwnProperty(ace_theme.cssClass),
      isDark: ace_theme.isDark,
    };
    var els = $('.editor-primary');
    applyTheme(els, true);
    appEvents.trigger('themeChanged', {
      theme: themeData,
    });
  });

  function clearClass(els, regex) {
    els.each(function () {
      this.className = this.className
        .split(' ')
        .filter(function (e) {
          return !regex.test(e);
        })
        .join(' ');
    });
  }

  function applyTheme(els, addClass) {
    if (!addClass) {
      els.addClass('editor-primary');
    }
    var ev = themeData;
    clearClass(els, /theme|^ace/);
    if (
      appConfig.adaptiveTheme == 'force' ||
      (appConfig.adaptiveTheme == true && ev.isAppUITheme)
    ) {
      if (ev.isDark) {
        els.addClass('theme-dark');
      }
      els.addClass(ev.rootClassName);
    } else {
      /*fallback to classic*/
      clearClass(els, /theme|^ace/);
      if (ev.isDark) {
        els.addClass('theme-dark');
        els.addClass('app-theme-dark');
      } else els.addClass('app-theme-light');
    }
  }

  function _id(t) {
    return String(t).replace(/ /g, '_').replace(/\W/g, '-').toLowerCase();
  }

  function addThemeToAce(data) {
    //Remove duplicates
    //Shouldn't really bother trying to keep this in sync
    Utils.removeFrom(themelist.themes, themelist.themesByName[data.name]);
    var id = _id(data.name);
    themelist.themes.push(
      (themelist.themesByName[data.name] = {
        theme: id,
        name: data.name,
        isDark: data.isDark,
        caption: data.name,
      })
    );
    ace.define(id, [], function (req, exports) {
      exports.cssClass = 'ace-' + id + '-theme';
      exports.cssText = '';
      exports.isAppUITheme = true;
      exports.isDark = data.isDark;
      exports.rootClassName = 'theme-' + id;
      appEvents.on('appLoaded', function () {
        var JSONExt,
          ThemeGen,
          err,
          res,
          c = 0;
        try {
          removeSplashScreen && removeSplashScreen.cancel();
          var server = FileUtils.getFileServer(data.server, true);
          require([
            './themes/theme_gen',
            'grace/ext/json_ext',
          ], function (mod1, mod) {
            ThemeGen = mod1.ThemeGen;
            JSONExt = mod.JSONExt;
            if (c++) _parseTheme();
          });
          FileUtils.readFile(data.filepath, server, function (e, r) {
            err = e;
            res = r;
            if (c++) _parseTheme();
          });
        } catch (e) {
          console.error(e);
          removeSplashScreen && removeSplashScreen();
        }
        function _parseTheme() {
          removeSplashScreen && removeSplashScreen();
          try {
            if (!err) {
              var p = JSONExt.parse(res);
              ThemeGen.vs(p, id);
              return;
            }
          } catch (e) {
            err = e;
          }
          require('../ui/notify').Notify.error(
            'Failed to load theme ' +
              data.name +
              ': ' +
              (err.code || err.toString())
          );
          return getSettingsEditor().setOption('theme', 'ace/theme/cobalt');
        }
      });
    });
  }

  //configure an element to use application theme class
  exports.watchTheme = applyTheme;
});