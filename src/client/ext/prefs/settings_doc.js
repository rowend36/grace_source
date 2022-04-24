define(function(require,exports,module) {
  var Docs = require("grace/docs/docs").Docs;
  var Doc = require("grace/docs/document").Doc;
  var getInfo = require("grace/core/config").Config.getConfigInfo;
  var Utils = require("grace/core/utils").Utils;
  var MainMenu = require("grace/setup/setup_main_menu").MainMenu;
  var addDoc = require("grace/docs/docs").addDoc;
  var app = require("grace/core/events").AppEvents;
  var JSONExt = require("grace/core/json_ext").JSONExt;
  var Config = require("./edit_config");
  var getBeautifier = require("grace/ext/format/format").getBeautifier;
  var regex = /(.{50})(.{0,30}$|.{0,20}([\.,]|(?= ))) ?/g;
  var wrap = function(text) {
    return text.replace(regex, "$1$2\n");
  };
  var INFO_START_TEXT = "var _CONFIG_ = ";
  var INFO_END_TEXT = wrap(
    "/*\n You can specify options as either a single path e.g application.applicatonTheme or as nested objects.\n \
Grace stores configuration in the form of a single multilevel tree. Any configuration you load is automatically used to update the tree.\n \
Nested subtrees are merged recusrsively while other data types including arrays overwrite any existing values in the tree.\n \
You can however, extend list data using (+/- syntax e.g 'arrayData+':[additional values])\n \
Once a configuration file is loaded, it cannot be unloaded, only overwritten. However, in exchange, multiple configuration files can be loaded. Opening or closing a project causes all configuration files to be reread. So the user can add a configuration file for options that must be reset when a project is closed.\n \
Except when specified otherwise. All paths are resolved relative to the current project. Absolute paths are left as they are.\n Note: All configuration will be kept as long as the editor is running even if you close the active project. Modifications you make in this document will be saved in application memory and are loaded first before the application starts.\n*/"
  );

  function format(doc) {
    var result = "";
    if (doc.doc) {
      result = wrap(doc.doc);
    }
    if (doc.default) {
      var default_ = "Default: " + doc.default;
      if (result) {
        result = result + "    ." + default_;
      } else result = default_;
    }
    if (doc.values) {
      var valueHasInfo = false;
      var values = doc.values.map(function(e) {
        if (typeof e == "object") {
          valueHasInfo = true;
          return e.join(" - ");
        }
        return e;
      });

      values = "Possible values: " + wrap(values.join(valueHasInfo ? "\n  " : ","));
      if (valueHasInfo) values = "\n  " + values;
      if (result) {
        result = result + (valueHasInfo || result.length + values.length > 15 ? "\n" : ". ") + values;
      } else result = values;
    }
    return result;
  }

  function keepUndefined(key, value) {
    if (value === undefined) {
      return "undefined";
    }
    return value;
  }

  function reviveUndefined(key, value) {
    if (value === "undefined") {
      return null;
    }
    return value;
  }

  function insertComments(str) {
    str = JSONExt.addComments(str, function(path) {
      var info = getInfo(path);
      if (info) {
        if (typeof info == "object") {
          info = format(info);
        } else info = wrap(info);
      }
      return info;
    });
    return INFO_START_TEXT + str + ";\n" + INFO_END_TEXT;
  }

  function SettingsDoc() {
    var t = arguments;
    SettingsDoc.super(this, ["", "config.json", "ace/mode/javascript",
      t[3],
      t[4],
      t[5],
    ]);
    if (!t[3] /*id*/ ) { //no editor yet
      this.refresh(null, true);
    }
  }
  Utils.inherits(SettingsDoc, Doc);
  SettingsDoc.prototype.save = function() {
    app.on("fullyLoaded", function() {
      var json;
      try {
        json = JSONExt.parse(this.getValue(), reviveUndefined, false);
      } catch (e) {
        require("grace/ui/notify").Notify.error("Syntax Error " + e.message);
        return;
      }
      this.dirty = !Config.apply(json, null, null, true);
      if (!this.dirty) {
        this.setClean();
      }
    }.bind(this));
  };
  SettingsDoc.prototype.refresh = function(callback, force, ignoreDirty) {
    //ignore autorefresh
    // this.setDirty(true);
    // if (force !== false) {
    var doc = this;
    app.on("fullyLoaded", function() {
      var val = JSON.stringify(Config.getJson(), keepUndefined);
      getBeautifier("json")(val, {
        "end-expand": true,
        wrap_line_length: 20,
      }, function(val) {
        val = insertComments(val);
        if (val != doc.getValue() && force == false) {
          doc.setDirty();
        } else Docs.setValue(doc, val, callback, true, ignoreDirty);
      });
    });
    //Notify caller that this is an async op
    //and you will be calling callback if provided
    return true;
    // }
  };
  SettingsDoc.prototype.getSavePath = function() {
    return null;
  };
  MainMenu.extendOption("load-settings", {
    subTree: {
      "app-settings": {
        icon: "edit",
        subIcon: "settings",
        caption: "Edit Settings",
        onclick: function() {
          addDoc(null, new SettingsDoc());
        }
      }
    }
  }, true);
  SettingsDoc.prototype.factory = "settings-doc";
  Docs.registerFactory("settings-doc", SettingsDoc);
  exports.SettingsDoc =
    SettingsDoc;
}); /*_EndDefine*/