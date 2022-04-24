define(function(require, exports, module) {
  //TODO runtime class
  var EventsEmitter = require("../core/events").EventsEmitter;
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
      Object.defineProperty(createNamespace(name.slice(0, idx)), name
        .substring(idx + 1), {
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
        namespace = namespace ? namespace + "." + parts.join(".") : parts
          .join(".");
      }
    }
    var config = namespace ? namespaces[namespace] : appConfig;
    config[key] = value;
    if (save) appStorage.setItem((namespace && namespace != "application" ?
        namespace + "." : "") + key, "" +
      value ||
      ":EMPTY:");
  }

  function configureArr(key, obj, namespace) {
    var config = namespace ? namespaces[namespace] : appConfig;
    config[key] = obj;
    if (save) putObj((namespace && namespace != "application" ? namespace +
      "." : "") + key, obj);
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


  //namespacing
  exports.createError = function(obj) {
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
  var Config = {};
  
  Config.putObj = putObj;
  Config.withoutStorage = withoutStorage;
  Config.getObj = getObj;
  Config.appConfig = appConfig;
  Config.getConfigInfo = getConfigInfo;
  Config.allConfigs = namespaces;
  Config.register = register;
  Config.configure = configure;
  Config.configureArr = configureArr;
  Config.registerAll = registerAll;
  Config.registerValues = registerValues;
  exports.Config = Config;
  exports.appStorage = appStorage;
  exports.ConfigEvents = new EventsEmitter();
  exports.ConfigEvents.frozen = true;

}); /*_EndDefine*/