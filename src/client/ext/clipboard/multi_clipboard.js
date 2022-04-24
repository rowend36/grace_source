define(function(require,exports,module) {
    "use strict";
    exports.MultiClipboard = function() {
        if (this) {
            this._clip = [];
        }
    };
    exports.MultiClipboard.prototype = {
        _clip: [],
        set: function(text, isPaste) {
            //we detect paste events for
            //environments where Env.getClipboard
            //is hacky or unavailable
            if (!text) return;
            if (Env.setClipboard && !isPaste) {
                //might be asynchronous
                Env.setClipboard(text);
            }
            if (text != this._clip[0]) {
                this._clip.unshift(text);
                if (this.onchange) {
                    this.onchange(this._clip, "add");
                }
            }
        },
        delete: function(index) {
            var it = this._clip.splice(index || 0, 1);
            if (!index) this.set(this._clip[0], true);

            if (this.onchange) this.onchange(this._clip, "delete", index || 0);
            return it[0];
        },
        get: function(index, cb) {
            //update value of clipboard
            if (!index && Env.getClipboard) {
                //might be called synchronously
                Env.getClipboard(
                    function(e, r) {
                        if (r && r !== this._clip[0]) this.clip.unshift(r);
                        cb && cb(this._clip[0] || "");
                    }.bind(this)
                );
            } else if (cb) {
                cb(this._clip[index || 0] || "");
                return;
            }
            //return current value
            return this._clip[index || 0] || "";
        },
        clear: function() {
            this._clip.length = 0;
            if (this.onchange) this.onchange(this._clip, "clear");
        },
        set text(text) {
            this.set(text);
        },
        get text() {
            return this.get();
        },
        set length(i) {
            this._clip.length = i;
        },
        get length() {
            return this._clip.length;
        },
    };
}); /*_EndDefine*/
