(function(global) {
    "use strict";
    global.Clipboard = function() {
        if (this) {
            var obj = Object.create(clipboard)
            obj._clip = []
            return obj;
        }
        return Object.create(clipboard);
    }
    var clipboard = {
        '_clip': [],
        'set': function(text, soft) {
            if (text && soft && Env.setClipboard) {
                Env.setClipboard(text);
            }
            if (text && text != this._clip[0]) {
                this._clip.unshift(text);
                if (this.onchange) {
                    this.onchange(this._clip, 'add');
                }
            }
        },
        'get': function(index) {
            if (Env.getClipboard && !index) {
               this.set(Env.getClipboard());
            }
            return this._clip[index || 0];
        },
        'clear': function() {
            this._clip = [];
            if (this.onchange)
                this.onchange(this._clip, 'clear');
        },
        set text(i) {
            this.set(i, true);
        },
        get text() {
            return this.get();
        },
        set length(i) {
            this._clip.length = i
        },
        get length() {
            return this._clip.length;
        }
    }
})(Modules);