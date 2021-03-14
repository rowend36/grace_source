_Define(function(global) {
    var Utils = global.Utils;
    var DelayedStorage = function(backend,delay) {
        var __queue = {};
        var syncDelay = Utils.parseTime(delay);
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
        this.setDelay = function(delay){
            syncDelay = Utils.parseTime(delay);
            if(syncTimeout){
                clearTimeout(syncTimeout);
                syncTimeout = null;
                schedule();
            }
        };
        var syncTimeout = null;
        var schedule = function() {
            if (!syncTimeout) {
                syncTimeout = setTimeout(function() {
                    syncTimeout = null;
                    doSync();
                }, syncDelay);
            }
        };
        var doSync = this.__doSync = function() {
            if(syncTimeout){
                clearTimeout(syncTimeout);
                syncTimeout = null;
            }
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
})/*_EndDefine*/