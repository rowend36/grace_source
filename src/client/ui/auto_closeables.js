define(function (require, exports, module) {
    ///The listener interface was a bit too much
    //wrapped it with this
    var mngr = require('../setup/setup_state').State;
    var ids = [];
    var values = [];
    var changeWatcher = function (newD, old, fromCode) {
        if (mngr.isValidState(newD)) {
            var index2 = ids.indexOf(newD);
            for (var i = ids.length - 1; i > index2; i--) {
                var value = values.pop();
                if (
                    (fromCode && value.$preventSpoof !== false) ||
                    value.$preventDismiss
                ) {
                    values.push(value);
                    return ids[i];
                }
                ids.pop();
                value.close();
                fromCode = true;
            }
            return index2 > -1;
        }
    };
    mngr.addListener(changeWatcher, function (state) {
        return ids.indexOf(state) > -1;
    });
    exports.AutoCloseables = {
        add: function (id, closeable) {
            if (!closeable || !closeable.close)
                throw new Error(
                    'Error: expected a Closeable object, got ' + closeable
                );
            exports.AutoCloseables.remove(id);
            ids.push(id);
            values.push(closeable);
            mngr.ensure(id, true);
        },
        close: function (id) {
            exports.AutoCloseables.remove(id);
            if (mngr.is(id)) {
                mngr.back();
            }
        },
        remove: function (id) {
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
        onOpenEnd: function () {
            exports.AutoCloseables.add('' + this.id, this);
        },
        onCloseEnd: function () {
            exports.AutoCloseables.close('' + this.id);
        },
    };
}) /*_EndDefine*/;