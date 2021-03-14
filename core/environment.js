var Env = {
    isBrowser: false,
    isDesktop: false,//when false, grace tries to detect and maintain soft Keyboard state
    isLocalHost: false,
    canLocalHost: false,
    // delayStorage: false 
};
Env.isBrowser = true;
Env.newWindow = function(path) {
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
    Env._server = 'http:///localhost:3000';
}
var GRACE = {
    _debugFail: 2,
    libConfig: ace.require("ace/config"),
    Range: ace.require("ace/range").Range,
    Editor: ace.require("ace/editor").Editor,
    Autocomplete: ace.require("ace/autocomplete").Autocomplete,
    TokenIterator: ace.require("ace/token_iterator").TokenIterator,
    Completions: ace.require("ace/ext/completions"),
    modelist: ace.require("ace/ext/modelist"),
    EditSession: ace.require("ace/edit_session").EditSession,
    event: ace.require('ace/lib/event'),
    keys: ace.require('ace/lib/keys'),
    Document: ace.require('ace/document').Document,
    HashHandler: ace.require('ace/keyboard/hash_handler').HashHandler,
    libLang: ace.require('ace/lib/lang')
};

function _Define(func, name) {
    try {
        if (name) {
            //async possible but no point
            //see BootList.define
            GRACE[name] = func(GRACE);
        } else func(GRACE);
    } catch (e) {
        if (GRACE._debugFail) {
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
        "application": appConfig
    };

    function createNamespace(name) {
        return namespaces[name] || (namespaces[name] = {});
    }

    function registerAll(configs, namespace) {
        var config = namespace ? createNamespace(namespace) : appConfig;
        for (var i in configs) {
            config[i] = configs[i];
            register(i, namespace);
        }
        return config;
    }

    function registerValues(configs, namespace) {
        var values = appDocs;
        for (var i in configs) {
            values[i] = configs[i];
        }
    }

    function getConfigInfo(i, namespace) {
        return appDocs[i];
    }

    function register(i, namespace) {
        if (appStorage.getItem(i)) {
            var s = appStorage.getItem(i);
            if (s == "true") s = true;
            else if (s == "false") s = false;
            else if (s == "undefined") s = undefined;
            else if (s == "null") s = null;
            else if (!isNaN(s)) s = parseInt(s);
            else if (s == ":EMPTY:") s = "";
            (namespace ? namespaces[namespace] : appConfig)[i] = s;
        }
    }

    function configure(key, value, namespace) {
        var config = namespace ? namespaces[namespace] : appConfig;
        config[key] = value;
        appStorage.setItem("" + key, "" + value || ":EMPTY:");
    }

    function configureObj(key, obj, namespace) {
        configure(key, JSON.stringify(obj), namespace);
    }

    function putObj(key, obj) {
        appStorage.setItem(key, JSON.stringify(obj));
    }

    function getObj(key, def) {
        var obj = appStorage.getItem(key);
        if (obj) {
            try {
                def = JSON.parse(obj);
            } catch (e) {}
        }
        return def || {};
    }
    var unimplemented = function() {
        alert("Unimplemented");
    };
    //namespacing
    global.appStorage = appStorage;
    global.putObj = putObj;
    global.getObj = getObj;
    global.appConfig = appConfig;
    global.getConfigInfo = getConfigInfo;
    global.allConfigs = namespaces;
    global.register = register;
    global.configure = configure;
    global.configureObj = configureObj;
    global.unimplemented = unimplemented;
    global.registerAll = registerAll;
    global.registerValues = registerValues;
    global.Functions = {};
}); /*_EndDefine*/