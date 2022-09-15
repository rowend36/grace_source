define(function (require, exports, module) {
  //TODO runtime class
  var EventsEmitter = require('./events_emitter').EventsEmitter;
  var backend;
  var debug = console;
  if (window.appStorage) {
    //Android
    window.appStorage = null;
    backend = window.appStorage;
    var a = backend.getKeys;
    backend.getKeys = function () {
      return JSON.parse(a.call(backend));
    };
  } else {
    backend = window.localStorage;
  }
  var configInfo = {};
  var namespaces = {};
  var DEFAULT_NS = 'ui';
  function createNamespace(name) {
    if (namespaces[name]) return namespaces[name];

    //Add virtual property for value in default or saved value
    var namespace = {};
    var __memory = {};
    Object.defineProperty(namespace, '__memory', {
      value: __memory,
      enumerable: false,
    });

    //Create virtual property in parent namespace
    var idx = name.lastIndexOf('.');
    if (idx > 0) {
      Object.defineProperty(
        createNamespace(name.slice(0, idx)),
        name.substring(idx + 1),
        {
          value: namespace,
          enumerable: false,
        }
      );
    }
    return (namespaces[name] = namespace);
  }

  //register a namespace
  function registerAll(configs, namespace) {
    if (!namespace) namespace = DEFAULT_NS;
    var config = createNamespace(namespace);

    for (var i in configs) {
      if (Array.isArray(configs[i])) {
        registerObj(i, namespace, configs[i]);
      } else if (configs[i] && typeof configs[i] == 'object') {
        registerAll(configs[i], namespace + '.' + i);
      } else {
        register(i, namespace, configs[i]);
      }
    }
    return config;
  }

  //register an object value
  function registerObj(name, namespace, defaultValue) {
    if (!namespace) namespace = DEFAULT_NS;
    var store = namespaces[namespace];
    return (store[name] = store.__memory[name] = getObj(
      namespace + '.' + name,
      defaultValue
    ));
  }

  //register a plain value
  function register(name, namespace, defaultValue) {
    if (!namespace) namespace = DEFAULT_NS;
    var store = namespaces[namespace];
    var s = backend.getItem(namespaces + '.' + name);
    if (s) {
      if (s == 'true') s = true;
      else if (s == 'false') s = false;
      else if (s == 'undefined') s = undefined;
      else if (s == 'null') s = null;
      else if (!isNaN(s)) s = parseFloat(s);
      else if (s == ':EMPTY:') s = '';
      if (defaultValue === s) {
        backend.removeItem(namespaces + '.' + name);
      } else defaultValue = s;
    } else if (arguments.length === 2) return;
    return (store[name] = store.__memory[name] = defaultValue);
  }
  function unregister(name, namespace) {
    if (!namespace) namespace = DEFAULT_NS;
    // var store = namespaces[namespace];
    // delete store[name];
    // delete store._memory[name];
    backend.removeItem(namespace + '.' + name);
  }
  function registerInfo(info, namespace) {
    if (!namespace) namespace = DEFAULT_NS;
    if (typeof namespace === 'string' && typeof info === 'string') {
      configInfo[namespace] = info;
    } else {
      var prefix = namespace + '.';
      if (!namespaces[namespace])
        throw new Error('Unknown namespace ' + namespace);
      for (var i in info) {
        if (i == '!root') configInfo[namespace] = info[i];
        else {
          configInfo[prefix + i] = info[i];
        }
      }
    }
  }

  function getConfigInfo(i) {
    return configInfo[i];
  }
  function _configure(key, value, namespace, fireEvents) {
    var t = key.lastIndexOf('.');
    if (t > -1) {
      var prefix = key.slice(0, t);
      key = key.slice(t + 1);
      namespace = namespace ? namespace + '.' + prefix : prefix;
    }
    var config = namespaces[namespace];
    var oldValue = config[key];
    config[key] = value;
    if (saveToStorage) config.__memory[key] = value;
    if (fireEvents && sendEvent(key, value, namespace, oldValue)) {
      return true;
    }
    return !fireEvents;
  }

  function configure(key, value, namespace, fireEvents) {
    if (key.indexOf('.') < 0 && !namespace) namespace = DEFAULT_NS;
    var passed = _configure(key, value, namespace, fireEvents);
    if (passed && saveToStorage) {
      backend.setItem(
        (namespace ? namespace + '.' : '') + key,
        '' + value || ':EMPTY:'
      );
    }
    return passed;
  }

  function configureObj(key, obj, namespace, fireEvents) {
    if (key.indexOf('.') < 0 && !namespace) namespace = DEFAULT_NS;
    var passed = _configure(key, obj, namespace, fireEvents);
    if (passed && saveToStorage) {
      putObj((namespace ? namespace + '.' : '') + key, obj);
    }
    return passed;
  }

  //Returns updated value
  var _value = function () {
    return namespaces[this.namespace][this.config];
  };
  var handlingError;
  function sendEvent(key, value, namespace, oldValue, isArr) {
    var failed = true;
    try {
      /*prevent default or throw error to revert configuration*/
      failed = Config.trigger(namespace, {
        config: key,
        namespace: namespace,
        value: _value,
        saved: saveToStorage,
      }).defaultPrevented;
      return !failed;
    } catch (e) {
      if (!handlingError) {
        throw e;
      } else debug.error(e);
    } finally {
      if (failed) {
        handlingError = true;
        if (isArr) configureObj(key, oldValue, namespace);
        else configure(key, oldValue, namespace);
        handlingError = false;
      }
    }
  }
  var saveToStorage = true;

  function withoutStorage(func, _v, _p, _m) {
    var original = saveToStorage;
    saveToStorage = false;
    try {
      return func(_v, _p, _m);
    } finally {
      saveToStorage = original;
    }
  }

  function putObj(key, obj) {
    backend.setItem(key, JSON.stringify(obj));
  }

  function getObj(key, def) {
    var obj = backend.getItem(key);
    if (obj) {
      try {
        def = JSON.parse(obj);
        if (typeof def !== 'object') def = null;
      } catch (e) {}
    }
    return def || {};
  }

  //Placeholder functions implemented in grace/ext/config.
  var Config = new EventsEmitter();
  Config.forPath = function (path, ns, key) {
    return ns ? (key ? namespaces[ns][key] : namespaces[ns]) : namespaces; //placeholder function
  };

  /**
   * @typedef {{
      //display the configuration values in namespace 
      //e.g to add virtual keys, hide keys
      toJSON?: ()=>Object,
      
      //Implementations can apply key:value pairs themselves
      update?: function(newValue,oldValue,path)=> boolean
   }} ConfigHandler
   //They should also check for nested namespaces.
   */
  var handlers = Object.create(null);
  Config.setHandler = function (namespace, handler) {
    if (!namespaces[namespace])
      throw new Error('Unknown namespace: ' + namespace);
    handlers[namespace] = handler;
  };

  Config.frozen = true;

  Config.putObj = putObj;
  Config.getObj = getObj;
  Config.registerAll = registerAll;
  Config.register = register;
  Config.registerObj = registerObj;
  Config.configure = configure;
  Config.configureObj = configureObj;
  Config.registerInfo = registerInfo;
  Config.unregister = unregister;
  Config.withoutStorage = withoutStorage;
  Config.getConfigInfo = getConfigInfo;
  Config.allConfigs = namespaces;
  Config.$handlers = handlers;
  exports.Config = Config;
  exports.storage = backend;
}); /*_EndDefine*/