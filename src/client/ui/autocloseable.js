
define(function(require,exports,module) {
    ///The listener interface was a bit too much
    //wrapped it with this
    var mngr = require("../core/state_manager").State;
    var ids = [];
    var values = [];
    var changeWatcher = function(newD) {
        if (mngr.isValidState(newD)) {
            var index2 = ids.indexOf(newD);
            for (var i = ids.length - 1; i > index2; i--) {
                var value = values.pop();
                if (value.$preventDismiss) {
                    values.push(value);
                    return ids[i];
                }
                ids.pop();
                value.close();
            }
            return index2 > -1;
        }
    };
    mngr.addListener(changeWatcher, function(state) {
        return ids.indexOf(state) > -1;
    });
    exports.AutoCloseable = {
        add: function(id, closeable) {
            if (!closeable || !closeable.close) throw new Error(
                'Error: expected a Closeable object, got', closeable);
            exports.AutoCloseable.remove(id);
            ids.push(id);
            values.push(closeable);
            mngr.ensure(id, true);
        },
        close: function(id) {
            exports.AutoCloseable.remove(id);
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
            exports.AutoCloseable.add("" + this.id, this);
        },
        onCloseEnd: function() {
            exports.AutoCloseable.close("" + this.id);
        }
    };
}) /*_EndDefine*/ ;