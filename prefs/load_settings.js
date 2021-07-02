_Define(function(global) {
  var Utils = global.Utils;
  var configure = global.configure;
  var configureArr = global.configureArr;
  var configEvents = global.ConfigEvents;
  var appStorage = global.appStorage;
  var Notify = global.Notify;
  var setBinding = global.setBinding;
  var allConfigs = global.allConfigs;
  var MainMenu = global.MainMenu;
  var NO_USER_CONFIG = "no-user-config";
  var Docs = global.Docs;
  var getEditor = global.Editors.getSettingsEditor;
  var appEvents = global.AppEvents;
  var getBindings = global.getBindings;
  var getInfo = global.getConfigInfo;
  var FileUtils = global.FileUtils;
  var appConfig = global.appConfig;
  var JSONExt = global.JSONExt;

  MainMenu.addOption("clear-settings", {
    icon: "warning",
    caption: "Reset Configuration",
    sortIndex: 1000,
    onclick: function() {
      var Notify = global.Notify;
      Notify.prompt("<h6 class='sub-header'>CLEAR ALL CONFIGURATION VALUES FROM DISK</h6>\
        <small><span class='blue-text'>Warning:</span> This operation is mostly harmless if you know what you are doing.</small>\
        <p style='font-size:1rem'>In the textbox below, you can either specify\
        <ol> <li><span class='error-text'>true</span> to clear all values or</li><li>A comma separated string list of namespaces. Nested namespaces must be specified separately. Example\n<small><code>search, editor, keyBindings.intellisense</code></small></li></ol></p><p style='font-size:1rem'> <span class='error-text'>Restart</span> immediately after unless previous configuration might be rewritten back.</p>",
        function resetAll(value) {
          if (!value) return;
          var options = allConfigs;
          var toReset, caption;
          if (value == 'true') {
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
                  data = setters.editor.getValue();
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

      //only works on sorted lists
      var configs = Utils.mergeList(Object.keys(allConfigs), Object.keys(setters));
    }
  }, true);

  function loadProjectConfig() {
    var i = Utils.parseList(appConfig.projectConfigFile);
    Utils.asyncForEach(i, function(path, i, next) {
      FileUtils.getConfig(path, function(err, res) {
        next();
        if (res) {
          var a = JSONExt.parse(res);
          global.withoutStorage(_default.bind(null, a));
        }
      });
    });
  }
  appEvents.on("fully-loaded", function() {
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
          global.withoutStorage(_default.bind(null, a));
        }
      }, true, true);
    }
  });

  function isValid(key) {
    var s = key.split("|");
    return s.every(function(e) {
      return /^(Ctrl-)?(Alt-)?(Shift-)?(((Page)?(Down|Up))|Left|Right|Delete|Tab|Home|End|Insert|Esc|Backspace|Space|Enter|.|F1?[0-9])$/i
        .test(e);
    });
  }
  global.validateKey = isValid;

  function arrEquals(a, b) {
    return a.length == b.length && !a.some(function(e, i) {
      return e !== b[i];
    });
  }

  function type(value) {
    if (Array.isArray(value)) {
      return "array";
    }
    if (value && typeof value == "object") {
      return "object";
    }
    return "plain value";
  }

  var notIn = Utils.notIn;
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
        j = j.slice(0,-1);
      } else if (j[j.length - 1] == "-") {
        isReduce = true;
        j = j.slice(0,-1);
      }
      if (setters[prefix + j]) {
        if (isExtend || isReduce && !setters[prefix + j].allowExtensions) {
          Notify.error("Cannot use +/- operator on subtree, string or boolean values");
          failed = true;
          continue;
        }
        setters[prefix + j].updateValue(obj, saveToMemory, {
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
      var type1 = type(oldValue[j]);
      if (type(obj) != type1) {
        Notify.error("Invalid value type for " + prefix+j+". Expected "+type1+" got " + (pathDepth?"path selector":type(obj)));
        failed = true;
        continue;
      }
      var old = oldValue[j];
      if (type1 == 'array') {
        if (isExtend) {
          obj = old.filter(notIn(obj)).concat(obj);
        } else if (isReduce) {
          obj = old.filter(notIn(obj));
        }
        if (arrEquals(obj, old)) continue;
        configureArr(j, obj, path);
      } else {
        if (isExtend || isReduce) {
          Notify.error("Cannot use +/- operator on subtree, string or boolean values");
          failed = true;
          continue;
        }
        if (type1 == "object") {
          if (!_default(obj, old, prefix + j, saveToMemory, pathDepth ? pathDepth - 1 : isDeepPath ? isDeepPath - 1 : undefined)) failed = true;
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
      if (type1 == 'array') configureArr(j, old, path);
      else configure(j, old, path);
    }
    return !failed;
  }
  var setters = {
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
    }, //todo rename overwrite
    keyBindings: {
      updateValue: function(from, saveToMemory) {
        var failed = false;
        var editor = getEditor();
        var bindings = getBindings(editor);
        for (var i in from) {
          var value = from[i];
          if (i == "$shadowed") continue;
          if (typeof value == 'object') {
            _default(value, null, "keyBindings." + i);
            continue;
          }
          if (!bindings.hasOwnProperty(i)) {
            continue;
            // Notify.warn('Unknown command ' + i);
            // failed = true;
          }
          if (!value) {
            setBinding("", bindings[i], editor, !saveToMemory, i);
          } else {
            if (!isValid(value)) {
              Notify.warn("Unknown keystring " + value);
              failed = true;
            }
            if (bindings[i] != value) setBinding(i, value, editor, !saveToMemory);
          }
        }
        return failed;
      },
      getValue: function() {
        return getBindings(getEditor(), true);
      }
    }
  };

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
    for (var k in setters) {
      var setterPath = k.split(".");
      /*
        Merge the value with any already registered values allowing nested setters.
      */
      var value = Object.assign(deepGet(doc_settings, setterPath) || {}, setters[k].getValue());
      deepSet(doc_settings, setterPath, value);
    }
    return doc_settings;
  }

  //Todo function overlay() {
  //   //todo make configuration runtime editable  
  // }
  var Config = {
    apply: _default,
    getJson: getSettingsJson,
    setHandler: function(namespace, handler) {
      setters[namespace] = handler;
    }
  };
  global.Config = Config;
});
_Define(function(global) {
  var Docs = global.Docs;
  var Doc = global.Doc;
  var getInfo = global.getConfigInfo;
  var Utils = global.Utils;
  var MainMenu = global.MainMenu;
  var addDoc = global.addDoc;
  var app = global.AppEvents;
  var JSONExt = global.JSONExt;
  var JSONWalker = global.JSONWalker;
  var Config = global.Config;
  var getBeautifier = global.getBeautifier;
  var regex = /(.{50})(.{0,30}$|.{0,20}([\.,]|(?= ))) ?/g;
  var wrap = function(text) {
    return text.replace(regex, "$1$2\n");
  };
  var INFO_START_TEXT = "var _CONFIG_ = ";
  var INFO_END_TEXT = wrap(
    "/*\nThe accepted syntax for this file is a variant of Javascript Object Notation(JSON) with comments. Besides comments, any other text you insert before the first brace ({) or after the last brace(}) is ignored (so configuration can be commonjs modules). Single line and block comments are allowed. Besides that, the only supported syntax is JSON primitives(keys must be wrapped with double quotes). You can specify options as either a single path e.g application.applicatonTheme or as nested objects.\n \
Grace stores configuration in the form of a single tree consisting of smaller subtrees. Any configuration you load is automatically used to update the tree.\n \
Nested subtrees are merged recusrsively while other data types including arrays overwrite any existing values in the tree.\n \
You can however, extend array data using (+/- syntax e.g 'arrayData+':[additional values])\n \
Once a configuration file is loaded, it cannot be unloaded, only overwritten. However, in exchange, multiple configuration files can be loaded. Opening or closing a project causes all configuration files to be reread. So the user can add a configuration file for options that must be reset when a project is closed.\n \
Except when specified otherwise. All paths are resolved relative to the current project. Absolute paths are left as they are.\n Note: All configuration will be kept as long as the editor is running even if you close the active project. Modifications you make in this document will be saved in application memory and are loaded first before the application starts. Besides the paths specified in files.projectConfig, other files are loaded in a project include:\n Loader files such as autocompletion.filesToLoad, autocompletion.tagsToLoad.\n Snippet files used by autocompletion.snippetsToLoad which use Textmate snippets syntax.\n Json theme files for application.theme.\n*/");

  function template(doc) {
    var head = wrap(doc.doc || "");
    var values = doc.values ? "Possible values: " + wrap(doc.values.join(",")) : "";
    var default_ = doc.default ? "Default: " + doc.default : "";
    head = head && default_ ? head + "    " : head + default_;
    return (head + (head.length + values.length > 15 ? "\n" : ". ") + values);
  }

  function keepUndefined(key, value) {
    if (value === undefined) {
      return "undefined";
    }
    return value;
  }

  function reviveUndefined(key, value) {
    if (value === "undefined") {
      return undefined;
    }
    return value;
  }

  function insertComments(str) {
    /**@type {Array<{type:string,pos:number,indent:string,name?:string}>}*/
    var ctx = [];
    var next = "",
      key;

    function postInfo(fullName) {
      var info = getInfo(fullName);
      if (info) {
        if (typeof info == "object") {
          info = template(info);
        } else info = wrap(info);
        var comments = info.split("\n");
        if (comments.length > 1) {
          var lines = [];
          for (var j in comments) {
            lines.push(key.indent + "/*" + comments[j]);
          }
          lines.push(key.indent + "*/\n");
          next = "\n" + lines.join("\n");
        } else next = "\n" + key.indent + "/*" + info + "*/\n";
      }
    }
    var walker = new JSONWalker(str, function(tag, pos, str) {
      switch (tag) {
        case "KEY":
          //start a key
          var indent = str.lastIndexOf("\n", pos) + 1;
          ctx.push({
            type: "key",
            pos: pos,
            indent: Utils.repeat(pos - indent),
          });
          break;
        case "OBJECT":
          if (!ctx.length) return;
          var fullName = ctx.map(function(e) {
            return e.name;
          }).join(".");
          key = ctx[ctx.length - 1];
          key.handled = true;
          postInfo(fullName);
          break;
      }
    }, function(tag, pos, text) {
      switch (tag) {
        case "KEY":
          //get key name
          key = ctx[ctx.length - 1];
          key.name = text.slice(key.pos + 1, pos - 1);
          return;
        case "OBJ_VALUE":
          //get the value of the key to insert after , { or [
          //or before ] } hopefully all possible tokens
          if (!ctx.length) return;
          var fullName = ctx.map(function(e) {
            return e.name;
          }).join(".");
          key = ctx.pop();
          if (key.handled) return;
          postInfo(fullName);
      }
    }, function(token, pos, text) {
      if (!next) return;
      switch (token) {
        case "]":
        case "}":
          var indent = text.lastIndexOf("\n", pos);
          walker.insert(next, indent);
          next = "";
          break;
        case ",":
        case "{":
        case "[":
          walker.insertAfter(next, true);
          next = "";
      }
    });
    try {
      walker.walk();
    } catch (e) {
      console.error(e);
      var a = walker.getState();
      console.error(e.message + "\n" + a.json.substring(Math.max(0, a.pos - 10), a.pos) + "<!here>" + a.json.substring(a.pos,
        a.pos + 10));
    }
    return INFO_START_TEXT + walker.getState().json + ";" + INFO_END_TEXT;
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
    app.on("fully-loaded", function() {
      var json;
      try {
        json = JSONExt.parse(this.getValue(), reviveUndefined, false);
      } catch (e) {
        global.Notify.error("Syntax Error " + e.message);
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
    app.on("fully-loaded", function() {
      var val = JSON.stringify(Config.getJson(), keepUndefined);
      getBeautifier("json")(val, {
        "end-expand": true,
        wrap_line_length: 20,
      }, function(val) {
        val = insertComments(val);
        if (val != doc.getValue() && force == false) {
          doc.setDirty();
        } else Docs.setValue(doc, val, callback, force, ignoreDirty !== false);
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
  MainMenu.addOption("load-settings", {
    icon: "settings",
    caption: "Global Configuration",
    close: true,
    onclick: function() {
      addDoc(null, new SettingsDoc());
    },
  }, true);
  SettingsDoc.prototype.factory = "settings-doc";
  Docs.registerFactory("settings-doc", SettingsDoc);
  global.SettingsDoc =
    SettingsDoc;
}); /*_EndDefine*/