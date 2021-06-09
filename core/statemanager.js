_Define(function(global) {
    "use strict";
    //manageState is a small utility to detect backpresses
    //in mobile devices
    //you can either add state change listeners
    //or use the AutoCloseable interface
    global.manageState = function(window) {
        if (global.State) return global.State;
        var obj = {};
        var _history = window.history;
        var _location = window.location;
        var listeners = [];
        //used to show if there is a pending popstate event
        //false-pending but will ignore
        //true-pending and will handle it
        //undefined-not pending
        var back;
        obj.onChange = function(newState, oldState, dir) {
            var handled = false;
            for (var j in listeners) {
                handled = handled || listeners[j](newState, oldState, dir);
            }
            return handled;
        };
        obj.isValidState = function(state) {
            for (var j in listeners) {
                if (listeners[j].preCheck && listeners[j].preCheck(state)) {
                    return true;
                }
            }
        };
        obj.is = function(tag) {
            return _location.hash == '#' + tag;
        };
        obj.ensure = function(tag, handled) {
            if (back){
                back = false;
            } 
            if (!obj.is(tag)) {
                var a = oldhash;
                oldhash = tag;
                _history.pushState(null, "", "#" + tag);
                if (!handled)
                    obj.onChange(tag, a, true);
            }
        };
        obj.removeListener = function(func) {
            listeners.filter(function(e) {
                return func != e;
            });
        };
        obj.addListener = function(func, preCheck) {
            listeners.push(func);
            if (preCheck)
                func.preCheck = preCheck;
        };
        obj.back = function() {
            if (back) return;
            if (back == undefined){
                _history.back();
            }
            back = true;
        };
        obj.forward = function() {
            _history.forward();
        };
        obj.exit = function(now) {
            //On browsers users might have loads of
            //history on the page from refreshes
            //this gets rid of them automatically
            //On webwiew, it behaves a bit differently
            //so noexit is only used in browsers
            obj.detach();
            var back = function() {
                _history.back();
            };
            window.addEventListener("popstate", back);
            if (now)
                back();
            else return function() {
                window.removeEventListener("popstate", back);
                obj.attach();
            };
        };

        function stateTracker() {
            var hash = ("" + _location.hash).substring(1);
            if (back === false) {
                if(hash)
                    back = undefined;
                oldhash && obj.ensure(oldhash, true);
                return;
            }
            else if(back && hash){
                back = undefined;   
            }
            if (hash == oldhash)
                return;
            if (obj.onChange(hash, oldhash)) {
                oldhash = hash;
            } else obj.back();
        }
        obj.detach = function() {
            window.removeEventListener('popstate', stateTracker);
        };
        obj.attach = function() {
            stateTracker();
            window.addEventListener('popstate', stateTracker);
        };
        //the current state
        var oldhash = ("" + _location.hash).substring(1);
        window.addEventListener('popstate', stateTracker);
        global.State = obj;

        return obj;
    };
}); /*_EndDefine*/
_Define(function(global) {
    var mngr = global.manageState(window);
    var ids = [];
    var values = [];
    var changeWatcher = function(newD) {
        if (mngr.isValidState(newD)) {
            var index2 = ids.indexOf(newD);
            for (var i = ids.length - 1; i > index2; i--) {
                var value = values.pop();
                ids.pop();
                value.close();
            }
            return index2 > -1;
        }
    };
    mngr.addListener(changeWatcher, function(state) {
        return ids.indexOf(state) > -1;
    });
    global.AutoCloseable = {
        add: function(id, closeable) {
            if (!closeable || !closeable.close) throw new Error('Error: expected a Closeable object, got', closeable);
            global.AutoCloseable.remove(id);
            ids.push(id);
            values.push(closeable);
            mngr.ensure(id, true);
        },
        close: function(id) {
            global.AutoCloseable.remove(id);
            if (mngr.is(id)) {
                mngr.back();
            }
        },
        remove: function(id) {
            //useful if you want to prevent the
            //closing of a particular closeable
            //see closeTab main.js
            var index;
            while ((index = ids.indexOf(id)) > -1) {
                ids.splice(index, 1);
                values.splice(index, 1);
            }
        },
        //used by modals
        onOpenEnd: function() {
            global.AutoCloseable.add("" + this.id, this);
        },
        onCloseEnd: function() {
            global.AutoCloseable.close("" + this.id);
        }
    };
}) /*_EndDefine*/ ;