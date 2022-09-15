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

    //Create virtual property in parent ns
    var idx = name.lastIndexOf('.');
    if (idx > 0) {
      Object.defineProperty(
        createNamespace(name.slice(0, idx)),
        name.substring(idx + 1),
        {
          value: namespace,
          enumerable: false,
        },
      );
    }
    return (namespaces[name] = namespace);
  }

  //register a ns
  function registerAll(configs, ns) {
    if (!ns) ns = DEFAULT_NS;
    var config = createNamespace(ns);

    for (var i in configs) {
      if (Array.isArray(configs[i])) {
        registerObj(i, ns, configs[i]);
      } else if (configs[i] && typeof configs[i] == 'object') {
        registerAll(configs[i], ns + '.' + i);
      } else {
        register(i, ns, configs[i]);
      }
    }
    return config;
  }

  //register an object value
  function registerObj(name, ns, defaultValue) {
    if (!ns) ns = DEFAULT_NS;
    var store = namespaces[ns];
    return (store[name] = store.__memory[name] = getObj(
      ns + '.' + name,
      defaultValue,
    ));
  }

  //register a plain value
  function register(name, ns, defaultValue) {
    if (!ns) ns = DEFAULT_NS;
    var store = namespaces[ns];
    var s = backend.getItem(ns + '.' + name);
    if (s) {
      if (s == 'true') s = true;
      else if (s == 'false') s = false;
      else if (s == 'undefined') s = undefined;
      else if (s == 'null') s = null;
      else if (!isNaN(s)) s = parseFloat(s);
      else if (s == ':EMPTY:') s = '';
      if (defaultValue === s) {
        backend.removeItem(ns + '.' + name);
      } else defaultValue = s;
    } else if (arguments.length === 2) return;
    return (store[name] = store.__memory[name] = defaultValue);
  }
  function unregister(name, ns) {
    if (!ns) ns = DEFAULT_NS;
    // var store = namespaces[ns];
    // delete store[name];
    // delete store._memory[name];
    backend.removeItem(ns + '.' + name);
  }
  function registerInfo(info, ns) {
    if (!ns) ns = DEFAULT_NS;
    if (typeof ns === 'string' && typeof info === 'string') {
      configInfo[ns] && typeof configInfo[ns] === 'object'
        ? (configInfo[ns].doc = info)
        : (configInfo[ns] = info);
    } else {
      var prefix = ns + '.';
      if (!namespaces[ns]) console.warn('Unknown namespace ' + ns);
      for (var i in info) {
        var t;
        if (i == '!root') t = ns;
        else t = prefix + i;
        if (typeof info[i] === 'string') registerInfo(info[i], t);
        else configInfo[t] = info[i];
      }
    }
  }

  function getConfigInfo(i) {
    return configInfo[i];
  }
  function _configure(key, value, ns, fireEvents) {
    var t = key.lastIndexOf('.');
    if (t > -1) {
      var prefix = key.slice(0, t);
      key = key.slice(t + 1);
      ns = ns ? ns + '.' + prefix : prefix;
    }
    var config = namespaces[ns];
    var oldValue = config[key];
    config[key] = value;
    if (saveToStorage) config.__memory[key] = value;
    if (fireEvents && sendEvent(key, value, ns, oldValue)) {
      return true;
    }
    return !fireEvents;
  }

  function configure(key, value, ns, fireEvents) {
    if (key.indexOf('.') < 0 && !ns) ns = DEFAULT_NS;
    var passed = _configure(key, value, ns, fireEvents);
    if (passed && saveToStorage) {
      if (value && typeof value == 'object')
        console.warn('Invalid value for ' + ns + '.' + key);
      backend.setItem((ns ? ns + '.' : '') + key, '' + value || ':EMPTY:');
    }
    return passed;
  }

  function configureObj(key, obj, ns, fireEvents) {
    if (key.indexOf('.') < 0 && !ns) ns = DEFAULT_NS;
    var passed = _configure(key, obj, ns, fireEvents);
    if (passed && saveToStorage) {
      putObj((ns ? ns + '.' : '') + key, obj);
    }
    return passed;
  }

  //Returns updated value
  var _value = function () {
    return namespaces[this.ns][this.config];
  };
  var handlingError;
  function sendEvent(key, value, ns, oldValue, isArr) {
    var failed = true;
    try {
      /*prevent default or throw error to revert configuration*/
      failed = Config.trigger(ns, {
        config: key,
        ns: ns,
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
        if (isArr) configureObj(key, oldValue, ns);
        else configure(key, oldValue, ns);
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
  /** @type {EventsEmitter & Any} */
  var Config = new EventsEmitter();
  Config.forPath = function (path, ns, key) {
    return ns ? (key ? namespaces[ns][key] : namespaces[ns]) : namespaces; //placeholder function
  };

  /**
   * @typedef {{
      //display the configuration values in ns 
      //e.g to add virtual keys, hide keys
      toJSON?: ()=>Object,
      
      //Implementations can apply key:value pairs themselves
      update?: (newValue,oldValue,path)=> boolean
   }} ConfigHandler
   //They should also check for nested namespaces.
   */
  var handlers = Object.create(null);
  /**
   * @param {string} ns
   * @param {ConfigHandler} handler
   */
  Config.setHandler = function (ns, handler) {
    if (!namespaces[ns]) throw new Error('Unknown ns: ' + ns);
    handlers[ns] = handler;
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