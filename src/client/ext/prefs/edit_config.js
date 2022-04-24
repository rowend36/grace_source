define(function(require, exports, module) {
  var Utils = require("grace/core/utils").Utils;
  var configure = require("grace/core/config").Config.configure;
  var configureArr = require("grace/core/config").Config.configureArr;
  var configEvents = require("grace/core/config").ConfigEvents;
  var appStorage = require("grace/core/config").appStorage;
  var Notify = require("grace/ui/notify").Notify;
  var allConfigs = require("grace/core/config").Config.allConfigs;
  var MainMenu = require("grace/setup/setup_main_menu").MainMenu;
  var NO_USER_CONFIG = "no-user-config";
  var Docs = require("grace/docs/docs").Docs;
  var getEditor = require("grace/editor/editors").Editors.getSettingsEditor;
  var appEvents = require("grace/core/events").AppEvents;
  var getInfo = require("grace/core/config").Config.getConfigInfo;
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var appConfig = require("grace/core/config").Config.appConfig;
  var JSONExt = require("grace/core/json_ext").JSONExt;
  var Schema = require("grace/core/schema").Schema;
  var XArray = Schema.XArray;
  MainMenu.extendOption("load-settings", {
    caption: "Configuration",
    icon: "settings_applications",
    subTree: {
      "clear-settings": {
        icon: "warning",
        caption: "Reset Configuration",
        sortIndex: 1000,
        onclick: function() {
          var Notify = require("grace/ui/notify").Notify;
          Notify.prompt(
            "<h6>Clear All Configuration</h6>\
                <p style='font-size:1rem'>In the textbox below, you can either specify\
                <ol> <li><span class='error-text'>all</span> to clear all values or</li><li>A comma separated string list of namespaces. Nested namespaces must be specified separately. Example\n<small><code>search, editor, keyBindings.intellisense</code></small></li></ol></p><p style='font-size:1rem'> <span class='error-text'>Restart</span> immediately after unless previous configuration might be rewritten back.</p>",
            function resetAll(value) {
              if (!value) return;
              var options = allConfigs;
              var toReset, caption;
              if (value == 'all') {
                toReset = configs;
                caption = "all your configuration";
              } else {
                toReset = Utils.parseList(value);
                caption = "all your configurations in\n" + toReset.join(",\n");
              }
              Notify.ask("This will reset " + caption + "\n   Continue?", function() {
                for (var y in toReset) {
                  var l = toReset[y];
                  if (l == "keyBindings") {
                    appStorage.removeItem("keyBindings");
                  } else {
                    var prefix = l + ".";
                    var data = options[l];
                    if (l == "editor") {
                      prefix = "";
                      data = handlers.editor.getValue();
                    } else if (l == "application") {
                      prefix = "";
                    }
                    for (var m in data) {
                      appStorage.removeItem(prefix + m);
                    }

                  }
                }
                Notify.info("Restart Immediately to Apply Changes");
              });
            }, true, {
              complete: function(value) {
                var name = value.split(",").pop();
                return configs.filter(function(e) {
                  return e.toLowerCase().indexOf(name.toLowerCase()) > -1;
                });
              },
              update: function(input, value) {
                var prec = input.value.lastIndexOf(",") + 1;
                input.value = input.value.substring(0, prec) + value;
              }
            });

          //only works on sorted lists or unique lists
          var configs = Utils.mergeList(Object.keys(allConfigs), Object.keys(handlers)).concat(['all']);
        }
      }
    }
  }, true, true);

  function loadProjectConfig() {
    var i = Utils.parseList(appConfig.projectConfigFile);
    Utils.asyncForEach(i, function(path, i, next) {
      FileUtils.getConfig(path, function(err, res) {
        next();
        if (res) {
          var a = JSONExt.parse(res);
          require("grace/core/config").Config.withoutStorage(_default.bind(null, a));
        }
      });
    });
  }
  appEvents.on("fullyLoaded", function() {
    loadProjectConfig();
    FileUtils.on("change-project", loadProjectConfig);
  });
  configEvents.on("application", function(ev) {
    switch (ev.name) {
      case "projectConfigFile":
        if (ev.newValue) {
          loadProjectConfig();
        }
    }
  });
  FileUtils.registerOption("files", ["file"], "load-config-file", {
    caption: "Load As Configuration",
    extension: "json",
    icon: "settings",
    onclick: function(e) {
      e.preventDefault();
      FileUtils.getDocFromEvent(e, function(res) {
        if (res) {
          var a = JSONExt.parse(res);
          require("grace/core/config").Config.withoutStorage(_default.bind(null, a));
        }
      }, true, true);
    }
  });

  function arrEquals(a, b) {
    return a.length == b.length && !a.some(function(e, i) {
      return JSON.stringify(e) != JSON.stringify(b[i]);
    });
  }

  //deep compare using json stringify
  var notIn = function(arr) {
    arr = arr.map(JSON.stringify);
    return function(o) {
      return arr.indexOf(JSON.stringify(o)) == -1;
    };
  };

  //Get schema for an appconfig
  function inferSchema(key, value) {
    var info = getInfo(key);
    if (typeof info == "object") {
      if (info.invalid) return info;
      if (info.schema) return info.schema;
      if (info.type) return Schema.parse(info.type);
      if (info.values) {
        var values = [];
        var props = [];
        info.values.forEach(function(e) {
          if (typeof e == "object") {
            e = e[0];
          }
          if (typeof e == "string" && e[0] == "<") {
            props.push(Schema.parse(e));
          } else values.push(e);
        });
        var schema = new Schema.XEnum(values);
        if (props.length) {
          props.push(schema);
          schema = new Schema.XOneOf(props);
        }
        if (value && typeof value == "object")
          schema = new XArray(schema);
        else if (info.multiple)
          schema = new StringList(schema);
        return schema;
      }
    }
    var res = Schema.fromValue(value);
    return res;
  }
  var StringList = function(schema) {
    XArray.call(this, schema);
  };
  StringList.prototype.invalid = function(list) {
    if (typeof list !== "string") return "Invalid type, expected string";
    return XArray.prototype.invalid.call(this, Utils.parseList(list));
  };

  //todo remove overwrite parameter, add a lock appStorage.setItem also
  function _default(newValue, oldValue, path, saveToMemory, pathDepth) {
    if (!oldValue) {
      if (path) oldValue = allConfigs[path];
      else oldValue = allConfigs;
    }
    if (!oldValue) {
      Notify.warn("Unknown group " + path);
      return false;
    }
    var prefix = path ? path + "." : (path = "");
    var failed = false;
    for (var j in newValue) {
      var obj = newValue[j];
      var isDeepPath = 0;
      var isExtend = false;
      var isReduce = false;
      var isDeep = j.indexOf(".") > -1;
      if (isDeep) {
        //should be impossible unless we were given pathdepth value
        if (pathDepth) {
          /*We need to start documenting these errors*/
          Notify.error('Plugin Error 304: Contact Plugin Maintainer');
          return false;
        }
        var k = j.split(".");
        isDeepPath = k.length - 1;
        while (k.length > 1) {
          var t = {};
          t[k.pop()] = obj;
          obj = t;
        }
        j = k[0];
      }
      if (j[j.length - 1] == "+") {
        isExtend = true;
        j = j.slice(0, -1);
      } else if (j[j.length - 1] == "-") {
        isReduce = true;
        j = j.slice(0, -1);
      }
      if (oldValue[j] === obj && !isExtend && !isReduce) continue;
      if (handlers[prefix + j]) {
        //setters should validate their values themselves
        if (isExtend || isReduce && !handlers[prefix + j].allowExtensions) {
          Notify.error("Error:" + prefix + j + " does not support +/- operator");
          failed = true;
          continue;
        }
        handlers[prefix + j].updateValue(obj, saveToMemory, {
          depth: pathDepth || isDeepPath || 0,
          extend: isExtend,
          reduce: isReduce
        });
        continue;
      }
      if (!oldValue.hasOwnProperty(j)) {
        Notify.warn("Unknown option " + j + " in group " + path);
        failed = true;
        continue;
      }
      var schema = inferSchema(prefix + j, oldValue[j]);
      var error = schema.invalid(obj);
      if (error) {
        Notify.error("Invalid value for " + prefix + j + ": " + error);
        failed = true;
        continue;
      }
      var type1 = schema.constructor;
      var old = oldValue[j];
      if (type1 == XArray) {
        if (isExtend) {
          obj = old.filter(notIn(obj)).concat(obj);
        } else if (isReduce) {
          obj = old.filter(notIn(obj));
        }
        if (arrEquals(obj, old)) continue;
        configureArr(j, obj, path);
      } else {
        if (isExtend || isReduce) {
          Notify.error("Error:" + prefix + j + " does not support +/- operator");
          failed = true;
          continue;
        }
        if (type1 == Schema.XObject) {
          if (!_default(obj, old, prefix + j, saveToMemory, pathDepth ? pathDepth - 1 : isDeepPath ? isDeepPath -
              1 : undefined)) failed = true;
          //only trigger events for non objects
          continue;
        } else if (obj != old) {
          configure(j, obj, path);
        } else continue;
      }
      try {
        /*prevent default or throw error to revert configuration*/
        if (!configEvents.trigger(path, {
            config: j,
            oldValue: old,
            newValue: obj,
            overwrite: saveToMemory
          }).defaultPrevented)
          continue;
      } catch (e) {
        console.error(e);
        Notify.error('Unknown error setting ' + j);
      }
      failed = true;
      if (type1 == XArray) configureArr(j, old, path);
      else configure(j, old, path);
    }
    return !failed;
  }

  function deepGet(obj, paths, errObj) {
    var i = 0;
    do {
      obj = obj[paths[i]];
      if (!obj) {
        if (errObj) errObj.missingPathIndex = i;
        return errObj;
      }
      ++i;
    } while (i < paths.length);
    return obj;
  }

  function deepSet(obj, paths, value) {
    for (var i = 0; i < paths.length - 1; ++i) {
      obj = obj[paths[i]] || (obj[paths[i]] = {});
    }
    obj[paths[i]] = value;
  }

  function getSettingsJson() {
    var doc_settings = {};
    var keys = Object.keys(allConfigs).sort();
    /*Guarantee the following keys come first*/
    doc_settings.application = undefined;
    doc_settings.documents = undefined;
    doc_settings.editor = undefined;
    doc_settings.files = undefined;
    var error = {},
      parent;
    for (var i = 0; i < keys.length; i++) {
      var path = keys[i];
      var key;
      if (getInfo(path) === NO_USER_CONFIG) continue;
      if (path.indexOf(".") > 0) {
        /*Add nested configuration*/
        var parts = path.split(".");
        key = parts.pop();
        parent = deepGet(doc_settings, parts, error);
        if (parent == error) {
          Notify.warn("Unknown configuration " + parts.slice(0, parent.missingPathIndex + 1).join("."));
          continue;
        }
      } else {
        key = path;
        parent = doc_settings;
      }
      var values = allConfigs[path];
      parent[key] = {};
      /*Copy values from global configuration*/
      for (var j in values) {
        if (getInfo(path + "." + j) == NO_USER_CONFIG) continue;
        parent[key][j] = values[j];
      }
    }
    /*Add the values for setters*/
    for (var k in handlers) {
      var setterPath = k.split(".");
      /*
        Merge the value with any already registered values allowing nested setters.
      */
      var value = Object.assign(deepGet(doc_settings, setterPath) || {}, handlers[k].getValue());
      deepSet(doc_settings, setterPath, value);
    }
    return doc_settings;
  }

  var handlers = {
    editor: {
      getValue: function() {
        return Object.assign({}, getEditor().getOptions(), Docs.$defaults);
      },
      updateValue: function(from, saveToMemory) {
        var failed;
        var editor = getEditor();
        for (var i in from) {
          //no global mode
          if (i == "mode") continue;
          if (editor.getOption(i) != from[i]) {
            if (editor.setOption(i, from[i], !saveToMemory) === false) failed = true;
          }
        }
        return failed;
      }
    }
  };

  var EditConfig = {
    apply: _default,
    getJson: getSettingsJson,
    setHandler: function(namespace, handler) {
      handlers[namespace] = handler;
    }
  };
  module.exports = Object.assign(EditConfig, require("grace/core/config").Config);
});
