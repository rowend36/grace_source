define(function(require,exports,module) {
    /*globals $*/
    exports.TextEdit = {
        cursorPos: 0,
        data: 0,
        selectionStart: 0,
        selectionEnd: 0,
        indent: "",
        target: null,
        commit: function() {
            this.target.value = this.data;
            this.target.selectionStart = this.selectionStart;
            this.target.selectionEnd = this.selectionEnd;
            if (window.InputEvent) {
                this.target.dispatchEvent(
                    new window.InputEvent("input", {
                        data: this.data /*unneeded*/ ,
                    })
                );
            } else {
                $(this.target).trigger('input');
            }
        },
        wordBefore: function() {
            var word = /[\w\$\-]+$/.exec(this.data.substring(0, this.selectionStart));
            if (word) return word[0];
            return "";
        },
        selection: function() {
            return this.data.substring(this.selectionStart, this.selectionEnd);
        },
        moveAnchor: function(offset) {
            this.selectionStart = Math.min(Math.max(0, this.selectionStart + offset), this.data.length);
        },
        moveCursor: function(offset, collapse) {
            this.selectionEnd = Math.min(Math.max(0, this.selectionEnd + offset), this.data.length);
            if (collapse) this.selectionEnd = this.selectionStart;
        },
        insert: function(text) {
            this.data = this.data.substring(0, this.selectionStart) +
                text +
                this.data.substring(this.selectionEnd);
            this.selectionEnd = this.selectionStart = this.selectionStart + text.length;
        },
        delete: function(numChars) {
            numChars = Math.min(numChars, this.selectionStart);
            this.data = this.data.substring(0, this.selectionStart - numChars) +
                this.data.substring(this.selectionEnd);
            this.selectionEnd = this.selectionStart = this.selectionStart - numChars;
        },
        from: function(textArea) {
            var env = textArea.parentElement.env;
            var edit;
            if (env) {
                edit = Object.create(AceTextEdit);
                edit.editor = env.editor;
                edit.doc = env.editor.session.getDocument();
            } else {
                edit = Object.create(this);
                edit.selectionStart = textArea.selectionStart;
                edit.selectionEnd = textArea.selectionEnd;
                edit.data = textArea.value || "";
                edit.target = textArea;
            }
            return edit;
        }
    };

    var AceTextEdit = {};
    AceTextEdit._insert = function(text, pasted) {
        this.editor.insert(text, pasted);
    };
    AceTextEdit._delete = function(num) {
        //dont allow behaviours here
        var selection = this.editor.getSelection();
        var range = selection.getRange();
        range.start.column -= num;
        this.doc.remove(range);
    };
    AceTextEdit._moveCursor = function(num, collapse) {
        var selection = this.editor.getSelection();
        var range = selection.getRange();
        var pos = range.end;
        var endOfLine = this.doc.getLine(pos.row).length;
        var dir = Math.sign(num);
        num = Math.abs(num);
        while (num > 0) {
            pos.column += dir;
            num--;
            if (pos.column > 0 && pos.column < endOfLine) continue;
            if (pos.column < 0) {
                pos.row--;
            }
            if (pos.column > endOfLine) {
                pos.row++;
            }
            endOfLine = this.doc.getLine(pos.row);
            pos.column = dir > 0 ? 0 : endOfLine;
        }
        if (collapse)
            selection.setRange({
                start: pos,
                end: pos
            });
        else selection.setRange(range);
    };
    AceTextEdit._moveAnchor = function(num) {
        var selection = this.editor.getSelection();
        var range = selection.getRange();
        var pos = range.start;
        var endOfLine = this.doc.getLine(pos.row).length;
        var dir = Math.sign(num);
        num = Math.abs(num);
        while (num > 0) {
            pos.column += dir;
            num--;
            if (pos.column > 0 && pos.column < endOfLine) continue;
            if (pos.column < 0) {
                pos.row--;
            }
            if (pos.column > endOfLine) {
                pos.row++;
            }
            endOfLine = this.doc.getLine(pos.row);
            pos.column = dir > 0 ? 0 : endOfLine;
        }
        selection.setRange(range);
    };
    AceTextEdit.insert = function(text, pasted) {
        this.editor.forEachSelection(this._insert.bind(this, text, pasted));
    };
    AceTextEdit.delete = function(num) {
        this.editor.forEachSelection(this._delete.bind(this, num));
    };
    AceTextEdit.moveCursor = function(num, collapse) {
        this.editor.forEachSelection(this._moveCursor.bind(this, num, collapse));
    };
    AceTextEdit.moveAnchor = function(num) {
        this.editor.forEachSelection(this._moveAnchor.bind(this, num));
    };
    AceTextEdit.wordBefore = function() {
        var range = this.editor.getSelection().getRange();
        var line = this.doc.getLine(range.start.row).substring(0, range.start.column);
        var word = /[\w\$\-]+$/.exec(line);
        if (word) return word[0];
        return "";
    };
    AceTextEdit.selection = function() {
        return this.doc.getTextRange(this.editor.getSelection().getRange());
    };
    AceTextEdit.commit = require("grace/core/utils").Utils.noop;
});
