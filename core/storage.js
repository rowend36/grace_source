(function(global) {
    var backend = global.appStorage || global.localStorage;
    var DelayedStorage = function() {
        var __queue = {};
        this.setItem = function(key, value) {
            __queue[key] = value;
            schedule();
        };
        this.getItem = function(key) {
            if (__queue.hasOwnProperty(key)) {
                return __queue[key];
            }
            else {
                return backend.getItem(key);
            }
        };
        this.removeItem = function(key) {
            this.setItem(key, undefined);
        };
        this.clear = function(){
            __queue = {};
            backend.clear();
        };
        var syncTimeout = null;
        var syncDelay = Utils.parseTime(Env.storageSyncTime);
        var schedule = function() {
            if (!syncTimeout) {
                syncTimeout = setTimeout(function() {
                    syncTimeout = null;
                    doSync();
                }, syncDelay);
            }
        };
        var doSync = this.__doSync = function() {
            for (var i in __queue) {
                try {
                    if (__queue[i] === undefined)
                        backend.removeItem(i);
                    else backend.setItem(i, __queue[i]);
                }
                catch (nothing) {

                }
            }
            __queue = {};
        };
    };
    if(Env.storageSyncTime)
        global.appStorage = new DelayedStorage();
})(Modules);