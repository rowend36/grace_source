/*globals ace*/
var Env = {
  isBrowser: true,
  //When false, Grace tries to detect and maintain softkeyboard visibility
  //related appConfig.allowSoftKeyboardFeatures
  isHardwareKeyboard: false,
  isLocalHost: false,
  canLocalHost: false,
  getCorsProxyUrl: null//used by android application to provide git support
  // delayStorage: false
};
//Fulfil our target of es5 compatible core with polyfills from mdn
if (!String.prototype.startsWith) {
  Object.defineProperty(String.prototype, 'startsWith', {
    value: function(search, rawPos) {
      var pos = rawPos > 0 ? rawPos | 0 : 0;
      return this.substring(pos, pos + search.length) === search;
    }
  });
}
if (!String.prototype.endsWith) {
  Object.defineProperty(String.prototype, 'endsWith', {
    value: function(search, this_len) {
      if (this_len === undefined || this_len > this.length) {
        this_len = this.length;
      }
      return this.substring(this_len - search.length, this_len) === search;
    },
    writable: true,
    configurable: true
  });
}
if (typeof Object.assign !== 'function') {
  /*jshint unused:vars*/
  Object.defineProperty(Object, "assign", {
    value: function assign(target, varArg) { // .length of function is 2
      'use strict';
      if (target === null || target === undefined) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var to = Object(target);

      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];

        if (nextSource !== null && nextSource !== undefined) {
          for (var nextKey in nextSource) {
            // Avoid bugs when hasOwnProperty is shadowed
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true
  });
}

Env.newWindow = window.open && function(path) {
  window.open(path);
};
if (/^localhost/i.test(window.location.host)) {
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env._server = window.location.origin;
} else {
  //while developing
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env._server = "http:///localhost:3000";
}
var Grace = {
  _debugFail: 2,
  dom: ace.require("ace/lib/dom"),
  Annotations: ace.require("ace/annotations").Annotations,
  libConfig: ace.require("ace/config"),
  Range: ace.require("ace/range").Range,
  Editor: ace.require("ace/editor").Editor,
  Autocomplete: ace.require("ace/autocomplete").Autocomplete,
  TokenIterator: ace.require("ace/token_iterator").TokenIterator,
  Completions: ace.require("ace/ext/completions"),
  modelist: ace.require("ace/ext/modelist"),
  EditSession: ace.require("ace/edit_session").EditSession,
  event: ace.require("ace/lib/event"),
  keys: ace.require("ace/lib/keys"),
  Document: ace.require("ace/document").Document,
  HashHandler: ace.require("ace/keyboard/hash_handler").HashHandler,
  libLang: ace.require("ace/lib/lang"),
  Tokenizer: ace.require("ace/tokenizer").Tokenizer,
  Snippets: ace.require("ace/snippets").snippetManager
};
/** @callback Define
 *  @param global {Grace}
 */
/**
 * @param {Define} func
 * @param {any} [name]
 */
//Simple iife for where too many dependencies are not needed

function _Define(func) {
  //inlineable function
  try {
    func(Grace);
    // console.timeEnd("load");
  } catch (e) {
    if (Grace._debugFail) {
      console.error(e);
    }
  }
}
_Define(function(global) {
  var appStorage = window.appStorage || window.localStorage;
  window.appStorage = null;
  var appConfig = {};
  var appDocs = {};
  var namespaces = {
    application: appConfig,
  };

  function createNamespace(name) {
    var namespace = namespaces[name];
    if (namespace) return namespaces[name];
    else namespace = namespaces[name] = {};
    var idx = name.lastIndexOf(".");
    if (idx > 0) {
      Object.defineProperty(createNamespace(name.slice(0, idx)), name.substring(idx + 1), {
        value: namespace,
        enumerable: false
      });
    }
    return namespace;
  }

  function registerAll(configs, namespace) {
    var config;
    var prefix = "";
    if (namespace && namespace != "application") {
      config = createNamespace(namespace);
      prefix = namespace + ".";
    } else {
      config = appConfig;
    }
    for (var i in configs) {
      if (Array.isArray(configs[i])) {
        config[i] = getObj(prefix + i, configs[i]);
      } else if (configs[i] && typeof configs[i] == 'object') {
        registerAll(configs[i], prefix + i);
      } else {
        config[i] = configs[i];
        register(i, namespace);
      }
    }
    return config;
  }

  function registerValues(configs, namespace) {
    var prefix = "application.";
    if (namespace) prefix = namespace + ".";
    for (var i in configs) {
      if (i == "!root") appDocs[namespace] = configs[i];
      else {
        appDocs[prefix + i] = configs[i];
      }
    }
  }

  function getConfigInfo(i) {
    return appDocs[i];
  }

  function register(i, namespace) {
    var key =
      (namespace && namespace != "application" ? namespace + "." : "") + i;
    var s = appStorage.getItem(key);
    var store = (namespace ? namespaces[namespace] : appConfig);
    if (s) {
      if (s == "true") s = true;
      else if (s == "false") s = false;
      else if (s == "undefined") s = undefined;
      else if (s == "null") s = null;
      else if (!isNaN(s)) s = parseFloat(s);
      else if (s == ":EMPTY:") s = "";
      if (store[i] == s) {
        appStorage.removeItem(key);
      } else store[i] = s;
    }
  }

  function configure(key, value, namespace) {
    if (key.indexOf(".") > -1) {
      var parts = key.split(".");
      key = parts.pop();
      if (parts.length) {
        namespace = namespace ? namespace + "." + parts.join(".") : parts.join(".");
      }
    }
    var config = namespace ? namespaces[namespace] : appConfig;
    config[key] = value;
    if (save) appStorage.setItem((namespace && namespace != "application" ? namespace + "." : "") + key, "" +
      value ||
      ":EMPTY:");
  }

  function configureArr(key, obj, namespace) {
    var config = namespace ? namespaces[namespace] : appConfig;
    config[key] = obj;
    if (save) putObj((namespace && namespace != "application" ? namespace + "." : "") + key, obj);
  }
  var save = true;

  function withoutStorage(func) {
    var original = save;
    save = false;
    try {
      func();
    } finally {
      save = original;
    }
  }

  function putObj(key, obj) {
    appStorage.setItem(key, JSON.stringify(obj));
  }

  function getObj(key, def) {
    var obj = appStorage.getItem(key);
    if (obj) {
      try {
        def = JSON.parse(obj);
        if (typeof def !== 'object') def = null;
      } catch (e) {}
    }
    return def || {};
  }
  var unimplemented = function() {
    alert("Unimplemented");
  };

  //namespacing
  global.createError = function(obj) {
    if (!obj.message || obj.message == obj.code) {
      switch (obj.code) {
        case 'ENOENT':
          obj.message = 'File does not exist';
          break;
        case 'EACCESS':
          obj.message = 'Permission denied';
          break;
        case 'ETOOLARGE':
          obj.message = 'File Too Large';
          break;
        default:
          obj.message = 'Encountered error: ' + obj.code;
      }
    }
    var err = new Error(obj.message);
    if (err.stack) err.stack = err.stack.split("\n").splice(1).join("\n");
    Object.assign(err, obj);
    return err;
  };
  global.appStorage = appStorage;
  global.putObj = putObj;
  global.withoutStorage = withoutStorage;
  global.getObj = getObj;
  global.appConfig = appConfig;
  global.getConfigInfo = getConfigInfo;
  global.allConfigs = namespaces;
  global.register = register;
  global.configure = configure;
  global.configureArr = configureArr;
  global.unimplemented = unimplemented;
  global.registerAll = registerAll;
  global.registerValues = registerValues;
}); /*_EndDefine*/