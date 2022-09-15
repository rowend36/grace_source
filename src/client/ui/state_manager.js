define(function(require,exports,module) {
    "use strict";
    //runtime class
    //manageState is a small utility to detect backpresses
    //in mobile devices
    //you can either add state change listeners
    //or use the AutoCloseables interface
    //TODO disable in iframes
    function StateManager(win) {
        if (exports.State) return exports.State;
        var obj = {};
        var _history = win.history;
        var _location = win.location;
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
            if (back) {
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
            if (back == undefined) {
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
            win.addEventListener("popstate", back);
            if (now)
                back();
            else return function() {
                win.removeEventListener("popstate", back);
                obj.attach();
            };
        };

        function stateTracker() {
            var hash = ("" + _location.hash).substring(1);
            if (back === false) {
                if (hash)
                    back = undefined;
                oldhash && obj.ensure(oldhash, true);
                return;
            } else if (back && hash) {
                back = undefined;
            }
            if (hash == oldhash)
                return;
            var result = obj.onChange(hash, oldhash);
            if(result ===true) {
                oldhash = hash;
            } else if(result){
                obj.ensure(result);
            } else obj.back();
        }
        obj.detach = function() {
            win.removeEventListener('popstate', stateTracker);
        };
        obj.attach = function() {
            stateTracker();
            win.addEventListener('popstate', stateTracker);
        };
        //the current state
        var oldhash = ("" + _location.hash).substring(1);
        win.addEventListener('popstate', stateTracker);

        return obj;
    }
    exports.StateManager = StateManager;
}); /*_EndDefine*/