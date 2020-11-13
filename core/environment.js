var Env = {
    isBrowser: false,
    isDesktop: false,
    isLocalHost: false,
    canLocalHost: false,
    // delayStorage: false
};
if (window) {
    Env.isBrowser = true;
    if (/^localhost/i.test(window.location.host)) {
        Env.isLocalHost = true;
        Env.canLocalHost = true;
        Env._server = window.location.origin;
    }
    else {
        Env.isLocalHost = true;
        Env.canLocalHost = true;
        Env._server = 'http:///localhost:3000';
    }
}
var Modules = {};
(function(global) {
    var appStorage = window.appStorage || window.localStorage;
    window.appStorage = null;
    var appConfig = {};
    var appDocs = {};
    var namespaces = {
        "application":appConfig
    };
    
    function createNamespace(name){
        return namespaces[name] || (namespaces[name]={});
    }
    function registerAll(configs,namespace) {
        var config =  namespace?createNamespace(namespace):appConfig;
        for (var i in configs) {
            config[i] = configs[i];
            register(i,namespace);
        }
        return config;
    }

    function registerValues(configs,namespace) {
        var values = appDocs;
        for (var i in configs) {
            values[i] = configs[i];
        }
    }
    function getConfigInfo(i,namespace){
        return appDocs[i];
    }
    function register(i,namespace) {
        if (appStorage.getItem(i)) {
            var s = appStorage.getItem(i);
            if (s == "true") s = true;
            else if (s == "false") s = false;
            else if (s == "undefined") s = undefined;
            else if (s == "null") s = null;
            else if (!isNaN(s)) s = parseInt(s);
            else if(s == ":EMPTY:")s="";
            (namespace?namespaces[namespace]:appConfig)[i] = s;
        }
    }
    
    function configure(key, value,namespace) {
        var config =  namespace?namespaces[namespace]:appConfig;
        config[key] = value;
        appStorage.setItem("" + key, "" + value||":EMPTY:");
    }

    function configureObj(key, obj,namespace) {
        configure(key, JSON.stringify(obj),namespace);
    }
    function putObj(key,obj){
        appStorage.setItem(key, JSON.stringify(obj));
    }
    function getObj(key, def) {
        var obj = appStorage.getItem(key);
        if(obj){
            try {
                def = JSON.parse(obj);
            }
            catch (e) {}
        }
        return def || {};
    }
    const unimplemented = function() {
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
})(Modules);