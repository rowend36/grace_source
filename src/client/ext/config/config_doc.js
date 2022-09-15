define(function (require, exports, module) {
  var Docs = require('grace/docs/docs').Docs;
  var Doc = require('grace/docs/document').Doc;
  var Config = require('grace/core/config');
  var Configs = require('grace/ext/config/configs');
  var Utils = require('grace/core/utils').Utils;
  var MainMenu = require('grace/setup/setup_main_menu').MainMenu;
  var openDoc = require('grace/docs/docs').openDoc;
  var app = require('grace/core/app_events').AppEvents;
  var JSONExt = require('grace/ext/json_ext').JSONExt;
  var Notify = require('grace/ui/notify').Notify;
  var getFormatter = require('grace/ext/format/formatters').getFormatter;
  var regex = /(.{50})(.{0,30}$|.{0,20}([\.,]|(?= ))) ?/g;
  var wrap = function (text) {
    return text.replace(regex, '$1$2\n');
  };
  var INFO_START_TEXT = 'var _CONFIG_ = ';
  var INFO_END_TEXT = wrap(
    "/**\n\
    Specify options as either a single path e.g application.applicatonTheme or as nested objects.\n\
    List data can be extended using (+/- syntax e.g 'paths+':[additional values])\n\
    Except when specified otherwise, all relative filepaths are resolved relative to the current project while\
absolute paths are left as they are.\n\
    Note: Modifications made in this document will be overriden by any loaded configuration files on application start.\n*/"
  );
  /**
   * Grace stores configuration in the form of a single multilevel tree.
   * Any configuration you load is automatically used to update the tree.
   * Nested subtrees are merged recusrsively while other data types including arrays overwrite any existing values in the tree.
   */

  function format(info) {
    var result = '';
    if (info.doc) {
      result = wrap(info.doc);
    }
    if (info.default) {
      var default_ = 'Default: ' + info.default;
      if (result) {
        result = result + '    .' + default_;
      } else result = default_;
    }
    if (info.values) {
      var valueHasInfo = false;
      var values = info.values.map(function (e) {
        if (typeof e == 'object') {
          valueHasInfo = true;
          return e.join(' - ');
        }
        return e;
      });

      values =
        'Possible values: ' + wrap(values.join(valueHasInfo ? '\n  ' : ','));
      if (valueHasInfo) values = '\n  ' + values;
      if (result) {
        result =
          result +
          (valueHasInfo || result.length + values.length > 15 ? '\n' : '. ') +
          values;
      } else result = values;
    }
    return result;
  }

  function insertComments(str) {
    str = JSONExt.addComments(str, function (path) {
      var info = Config.getConfigInfo(path);
      if (info) {
        if (typeof info == 'object') {
          info = format(info);
        } else info = wrap(info);
      }
      return info;
    });
    return INFO_START_TEXT + str + ';\n' + INFO_END_TEXT;
  }

  function ConfigDoc() {
    var t = arguments;
    ConfigDoc.super(this, [
      '',
      'config.json',
      'javascript',
      t[3],
      t[4],
      t[5],
    ]);
    if (!t[3] /*id*/) {
      //no editor yet
      this.refresh(null, true);
    }
  }
  Utils.inherits(ConfigDoc, Doc);
  ConfigDoc.prototype.save = function () {
    app.on(
      'fullyLoaded',
      function () {
        var json;
        try {
          json = JSONExt.parse(this.getValue(), null, false);
        } catch (e) {
          Notify.error('Syntax Error ' + e.message);
          return;
        }
        Configs.withErrorHandler(Notify.error, function () {
          this.dirty = !Configs.apply(json);
        });
        if (!this.dirty) {
          this.setClean();
        }
      }.bind(this)
    );
  };
  ConfigDoc.prototype.refresh = function (callback, force, ignoreDirty) {
    //ignore autorefresh
    // this.setDirty(true);
    // if (force !== false) {
    var doc = this;
    app.on('fullyLoaded', function () {
      var val = JSONExt.stringify(Configs.toJSON());
      getFormatter('json')(
        val,
        {
          mode: 'json',
          'end-expand': true,
          wrap_line_length: 20,
        },
        function (val) {
          val = insertComments(val);
          if (val != doc.getValue() && force == false) {
            doc.setDirty();
          } else Docs.refreshValue(doc, val, callback, true, ignoreDirty);
        }
      );
    });
    //Notify caller that this is an async op
    //and you will be calling callback if provided
    return true;
    // }
  };
  ConfigDoc.prototype.getSavePath = function () {
    return null;
  };
  MainMenu.extendOption(
    'load-settings',
    {
      subTree: {
        'app-settings': {
          icon: 'edit',
          subIcon: 'settings',
          caption: 'Edit Settings',
          onclick: function () {
            openDoc(null, new ConfigDoc());
          },
        },
      },
    },
    true
  );
  ConfigDoc.prototype.factory = 'settings-doc';
  Docs.registerFactory('settings-doc', ConfigDoc);
  exports.ConfigDoc = ConfigDoc;
}); /*_EndDefine*/