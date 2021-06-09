_Define(function(global) {
  /**@constructor*/
  var JSONWalker = function(json, onEnter, onLeave, onToken) {
    var ARRAY = 1,
      OBJ = 2,
      VALUE = 4,
      jSON = 5,
      END = 7,
      ITEM = 9,
      CLOSE_OBJ = 6,
      CLOSE_ARR = 10,
      END_VALUE = 11;
    // var ch = 0;
    // var line = 0;
    var pos = 0;
    var end = json.length;
    var state = jSON;
    var stack = [];
    var NUMBER = /^\d+(?:\.\d*)?/;
    var STRING = /^(\")(?:[^\"\n\\]|\\.)*(\1)/;
    var BOOLEAN = /^(?:true|false)/;
    var NULL = /^null/;

    function read(re) {
      var t = json.substring(pos);
      var b = re.exec(t);
      if (b) {
        pos += b[0].length;
        return true;
      }
      return false;
    }

    function notify(start) {
      var a = (function() {
        switch (state) {
          case END:
          case jSON:
            return "JSON";
          case CLOSE_OBJ:
          case OBJ:
            return "OBJECT";
          case ITEM:
            return "KEY";
          case CLOSE_ARR:
          case ARRAY:
            return "ARRAY";
          case VALUE:
          case END_VALUE:
            switch (stack[stack.length - 1]) {
              case CLOSE_ARR:
                return "ARR_VALUE";
              case CLOSE_OBJ:
                return "OBJ_VALUE";
              case END:
                return "ROOT_VALUE";
            }
            throw "Bad State";
        }
      })();
      start ? onEnter(a, pos, json) : onLeave(a, pos, json);
    }

    function advance() {
      notify();
      if (stack.length) {
        state = stack.pop();
      } else throw new Error("Unexpected end of state");
      eatSpace();
    }
    var SPACE = /\s/;

    function eatSpace() {
      while (SPACE.test(json[pos])) pos++;
    }

    function la(ch) {
      return json[pos] == ch;
    }
    this.getState = function() {
      return {
        stack: stack.slice(0),
        pos: pos,
        json: json,
      };
    };
    this.setState = function(s) {
      stack = s.stack.slice(0);
      pos = s.pos;
      json = s.json;
    };
    this.insertAfter = function(text, advance) {
      json = json.slice(0, pos) + text + json.slice(pos);
      end += text.length;
      if (advance) pos += text.length;
    };
    this.insert = function(text, index) {
      json = json.slice(0, index) + text + json.slice(index);
      pos += text.length;
      end += text.length;
    };

    function eat(token) {
      pos++;
      onToken(token, pos, json);
    }

    function call(op, after) {
      state = op;
      stack.push(after);
      if (pos == end) throw "Unexpected end of input";
    }
    this.walk = function() {
      while (pos <= end) {
        switch (state) {
          case END_VALUE:
            advance();
            continue;
          case VALUE:
            notify(true);
            if (read(NUMBER) || read(STRING) || read(NULL) || read(BOOLEAN)) {
              advance();
              continue;
            } else if (la("{")) {
              call(OBJ, END_VALUE);
              continue;
            } else if (la("[")) {
              call(ARRAY, END_VALUE);
              continue;
            } else throw new Error("Unexpected token " + json[pos]);
          case jSON:
            notify(true);
            call(VALUE, END);
            continue;
          case END:
            if (pos != end) throw "Unexpected tokens " + json.substr(pos, 10);
            else {
              pos += 1;
              break;
            }
            case OBJ:
              notify(true);
              eat("{");
              eatSpace();
              if (la("}")) {
                state = CLOSE_OBJ;
              } else state = ITEM;
              continue;
            case ITEM:
              notify(true);
              if (!read(STRING)) throw "Expected string";
              notify();
              eatSpace();
              if (!la(":")) throw "Expected colon";
              eat(":");
              eatSpace();
              call(VALUE, CLOSE_OBJ);
              continue;
            case CLOSE_OBJ:
              if (la(",")) {
                eat(",");
                onToken("SEP", pos);
                eatSpace();
                if (la('"')) {
                  state = ITEM;
                  continue;
                }
              }
              if (!la("}")) throw "Expected }";
              eat("}");
              advance();
              continue;
            case ARRAY:
              notify(true);
              eat("[");
              eatSpace();
              if (la("]") || la[","]) {
                state = CLOSE_ARR;
              } else call(VALUE, CLOSE_ARR);
              continue;
            case CLOSE_ARR:
              if (la(",")) {
                eat(",");
                eatSpace();
                if (!la("]")) {
                  call(VALUE, CLOSE_ARR);
                  continue;
                }
              }
              if (!la("]")) throw "Expected ]";
              eat("]");
              advance();
              continue;
            default:
              throw "Unknown state " + state;
        }
      }
      if (state != END) throw "Counter Erorr";
      notify();
    };
  };
  JSONWalker.stripComments = function(str) {
    var re = /(\\)|(\"|\')|(\/\*)|(\*\/)|(\/\/)|(\n)/g;
    var lines = [];
    var comments = [];
    var inComment = false;
    var inString = "";
    var escaped = -1;
    var inLineComment = false;
    var i = null;
    var j = str.indexOf("{");
    re.lastIndex = j;
    var k = 0;
    for (;;) {
      i = re.exec(str);
      if (i) {
        //open comment
        if (i[3]) {
          if (!inComment && !inString) {
            k = i.index;
            lines.push(str.substring(j, k));
            inComment = true;
          }
        }
        //close comment
        else if (i[4]) {
          if (inComment) {
            j = i.index + 2;
            comments.push(str.substring(k, j));
            inComment = false;
          } else if (!inString) {
            //regex
            //throw new Error('Error: Parse Error ' + i);
          }
        } else if (inComment) {
          continue;
        }
        //open line comment
        else if (i[5]) {
          if (!(inComment || inLineComment || inString)) {
            k = i.index;
            lines.push(str.substring(j, k));
            inLineComment = true;
          }
          //leave line comment
        } else if (i[6]) {
          if (inLineComment) {
            j = i.index;
            comments.push(str.substring(k, j));
            inLineComment = false;
          } else if (inString) {
            //throw error
          }
          //enter string
        } else if (i[2]) {
          if (escaped != i.index) {
            if (i[2] == inString) inString = "";
            else inString = i[2];
          }
          //leave string
        } else if (i[1]) {
          if (inString && escaped != i.index) escaped = i.index + 1;
        }
      } else {
        if (!inComment) {
          var colon = str.lastIndexOf("}");
          if (colon > -1)
            lines.push(str.slice(j, colon + 1));
        }
        break;
      }
    }
    return lines.join("");
  };
  global.JSONWalker = JSONWalker;
});
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
  var stripComments = global.JSONWalker.stripComments;

  MainMenu.addOption("clear-settings", {
    icon: "warning",
    caption: "Reset Configuration",
    sortIndex: 1000,
    onclick: function() {
      var Notify = global.Notify;
      Notify.prompt("<h6>CLEAR ALL CONFIGURATION VALUES FROM DISK</h6>\
        <small><span class='blue-text'>Warning:</span> This operation is mostly harmless if you know what you are doing.</small>\
        <p style='font-size:1rem'>You can either specify\
        <ol> <li><span class='red-text'>true</span> to clear all values or</li><li>A comma separated string list of namespaces. Nested namespaces must be specified separately. Example\n<small><code>search, editor, keyBindings.intellisense</code></small></li></ol></p><p style='font-size:1rem'> <span class='red-text'>Restart</span> immediately after unless previous configuration might be rewritten back.</p>",
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
      FileUtils.getConfig(path, function(res) {
        next();
        if (res) {
          var config = stripComments(res);
          var a = JSON.parse(config);
          global.withoutStorage(_default.bind(null, a));
        }
      });
    });
  }
  appEvents.on("fully-loaded", function(){
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
    icon: "build",
    onclick: function(e) {
      e.preventDefault();
      FileUtils.getDocFromEvent(e, function(res) {
        if (res) {
          var config = stripComments(res);
          var a = JSON.parse(config);
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
      return "arr";
    }
    if (value && typeof value == "object") {
      return "obj";
    }
    return "primitive";
  }
  //todo remove overwrite parameter, add a lock appStorage.setzitem
  function _default(newValue, oldValue, path, overwrite) {
    if (!oldValue) {
      if (path) oldValue = allConfigs[path];
      else oldValue = allConfigs;
    }
    if (!oldValue) {
      Notify.warn("Unknown group " + path);
      return true;
    }
    var prefix = path ? path + "." : (path = "");
    var failed = false;
    for (var j in newValue) {
      var obj = newValue[j];
      var p = j.lastIndexOf(".");
      if (p > -1) {
        var k = j.split(".");
        do {
          var t = {};
          t[k.pop()] = obj;
          obj = t;
        } while (k.length > 1);
        j = k[0];
      }
      if (setters[prefix + j]) {
        setters[prefix + j].updateValue(obj, overwrite);
        continue;
      }
      if (!oldValue.hasOwnProperty(j)) {
        Notify.warn("Unknown option " + j + " in group " + path);
        failed = true;
        continue;
      }
      var type1 = type(oldValue[j]);
      if (type(obj) != type1) {
        Notify.error("Invalid Value Type " + (type(obj)) + " for " + oldValue[j] + " " + prefix + j);
        failed = true;
        continue;
      }
      var old = oldValue[j];
      if (type1 == 'arr') {
        if (arrEquals(obj, old)) continue;
        configureArr(j, obj, path);
      } else if (type1 == "obj") {
        if (_default(obj, old, prefix + j, overwrite)) failed = true;
        //only trigger events for non objects
        continue;
      } else if (obj != old) {
        configure(j, obj, path);
      } else continue;
      try {
        if (!configEvents.trigger(path, {
            config: j,
            oldValue: old,
            newValue: obj,
            overwrite: overwrite
          }).defaultPrevented)
          continue;
      } catch (e) {
        Notify.error('Unknown error setting ' + j);
      }
      failed = true;
      if (type1 == 'arr') configureArr(j, old, path);
      else configure(j, old, path);
    }
    return failed;
  }
  var setters = {
    editor: {
      getValue: function() {
        return Object.assign({}, getEditor().getOptions(), Docs.$defaults);
      },
      updateValue: function(from, overwrite) {
        var failed;
        var editor = getEditor();
        for (var i in from) {
          //no global mode
          if (i == "mode") continue;
          if (editor.getOption(i) != from[i]) {
            if (editor.setOption(i, from[i], !overwrite) === false) failed = true;
          }
        }
        return failed;
      }
    }, //todo rename overwrite
    keyBindings: {
      updateValue: function(from, overwrite) {
        var failed = false;
        var editor = getEditor();
        var bindings = getBindings(editor);
        for (var i in from) {
          var value = from[i];
          if (i == "$shadowed") continue;
          if (typeof value == 'object') {
            global.Config.apply(value, null, "keyBindings." + i);
            continue;
          }
          if (!bindings.hasOwnProperty(i)) {
            continue;
            // Notify.warn('Unknown command ' + i);
            // failed = true;
          }
          if (!value) {
            setBinding("", bindings[i], editor, !overwrite, i);
          } else {
            if (!isValid(value)) {
              Notify.warn("Unknown keystring " + value);
              failed = true;
            }
            if (bindings[i] != value) setBinding(i, value, editor, !overwrite);
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
        if(errObj)errObj.lastPathSegment = i;
        return errObj;
      }
      ++i;
    } while (i < paths.length);
    return obj;
  }

  function deepSet(obj, paths, value) {
      
      for(var i = 0;i < paths.length - 1;++i) {
        obj = obj[paths[i]] || (obj[paths[i]] = {});
      }
      obj[paths[i]]=value;
  }

  function getSettingsJson() {
    var doc_settings = {};
    var keys = Object.keys(allConfigs).sort();
    doc_settings.application = undefined;
    doc_settings.documents = undefined;
    doc_settings.editor = undefined;
    doc_settings.files = undefined;
    var error = {},parent;
    for (var i = 0; i < keys.length; i++) {
      var path = keys[i];
      var key;
      if (getInfo(path) === NO_USER_CONFIG) continue;
      if (path.indexOf(".") > 0) {
        var parts = path.split(".");
        key = parts.pop();
        parent = deepGet(doc_settings, parts, error);
        if (parent == error) {
          Notify.warn("Orphaned group " + path);
          continue;
        }
      } else {
        key = path;
        parent = doc_settings;
      }
      var values = allConfigs[path];
      parent[key] = {};
      for (var j in values) {
        if (getInfo(path + "." + j) == NO_USER_CONFIG) continue;
        parent[key][j] = values[j];
      }
    }
    for (var k in setters) {
      deepSet(doc_settings, k.split("."), Object.assign(deepGet(doc_settings, k.split("."))||{},setters[k].getValue()));
    }
    return doc_settings;
  }

  function overlay() {
    //todo make configuration runtime editable  
  }
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
  var JSONWalker = global.JSONWalker;
  var stripComments = JSONWalker.stripComments;
  var Config = global.Config;
  var getBeautifier = global.getBeautifier;
  var regex = /(.{50})(.{0,30}$|.{0,20}([\.,]|(?= ))) ?/g;
  var wrap = function(text) {
    return text.replace(regex, "$1$2\n");
  };
  var INFO_TEXT = wrap(
    "/** Grace configuration is in the form of a single tree. Any configuration you load is automatically used to update the tree. Arrays are overwritten. Any thing you add before the first brace and after the last brace is ignored (to allow eslint javascript syntax checks). Comments are allowed. Beside that, the only supported syntax is JSON primitives(keys must be wrapped with double quotes). You can specify options as either single path e.g application.applicatonTheme or as nested objects. Since the configuration does not remember history except by reset or overwrite, it is more easier to just add a project configuration for options you expect to change often. Note: The options will be kept as long as the editor is open even if you close the project. Beside the projectConfig, 3 other files are loaded by grace, autocompletion.filesToLoad, autocompletion.tagsToLoad and application.lintFilter. None is compulsory. */\nvar _CONFIG_ = "
  );

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
    return INFO_TEXT + walker.getState().json + ";";
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
        json = JSON.parse(stripComments(this.getValue()), reviveUndefined);
      } catch (e) {
        global.Notify.error("Syntax Error " + e.message);
        return;
      }
      this.dirty = Config.apply(json, null, null, true);
      if (!this.dirty) {
        this.setClean();
      }
    }.bind(this));
  };
  SettingsDoc.prototype.refresh = function(callback, force, ignoreDirty) {
    //ignore autorefresh
    if (force !== false) {
      var doc = this;
      app.on("fully-loaded", function() {
        var val = JSON.stringify(Config.getJson(), keepUndefined);
        getBeautifier("json")(val, {
          "end-expand": true,
          wrap_line_length: 20,
        }, function(val) {
          val = insertComments(val);
          Docs.setValue(doc, val, callback, force, ignoreDirty);
        });
      });
      //Notify caller that this is an async op
      //and you will be calling callback if provided
      return true;
    }
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
  SettingsDoc.prototype.factory = "settings9";
  Docs.registerFactory("settings9", SettingsDoc);
  global.SettingsDoc =
    SettingsDoc;
  global.stripComments = stripComments;
}); /*_EndDefine*/