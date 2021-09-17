define("ace/ext/statusbar",["require","exports","module","ace/lib/dom","ace/lib/lang"], function(require, exports, module) {
"use strict";
var dom = require("../lib/dom");
var lang = require("../lib/lang");

var StatusBar = function(editor, parentNode) {
    this.element = dom.createElement("div");
    this.element.className = "ace_status-indicator";
    this.element.style.cssText = "display: inline-block;";
    parentNode.appendChild(this.element);

    var statusUpdate = (this.statusUpdate = lang.delayedCall(function() {
        this.updateStatus(this.editor);
    }.bind(this))).schedule.bind(null, 100);
    this.editor = editor;
    this.editor.on("changeStatus", statusUpdate);
    this.editor.on("changeSelection", statusUpdate);
    this.editor.on("keyboardActivity", statusUpdate);
};

(function() {
    this.setEditor = function(edit) {
        this.statusUpdate.cancel();
        this.editor.off("changeStatus", this.statusUpdate);
        this.editor.off("changeSelection", this.statusUpdate);
        this.editor.off("keyboardActivity", this.statusUpdate);
        if (edit) {
            var statusUpdate = this.statusUpdate;
            this.editor = edit;
            edit.on("changeStatus", statusUpdate);
            edit.on("changeSelection", statusUpdate);
            edit.on("keyboardActivity", statusUpdate);
        }
    
    }
    this.updateStatus = function(editor) {
        var status = [];

        function add(str, separator) {
            str && status.push(str, separator || "|");
        }

        add(editor.keyBinding.getStatusText(editor));
        if (editor.commands.recording)
            add("REC");

        var sel = editor.selection;
        var c = sel.lead;

        if (!sel.isEmpty()) {
            var r = editor.getSelectionRange();
            add("(" + (r.end.row - r.start.row) + ":" + (r.end.column - r.start.column) + ")", " ");
        }
        add(c.row + ":" + c.column, " ");
        if (sel.rangeCount)
            add("[" + sel.rangeCount + "]", " ");
        status.pop();
        this.element.textContent = status.join("");
    };
}).call(StatusBar.prototype);

exports.StatusBar = StatusBar;

});                (function() {
                    window.require(["ace/ext/statusbar"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            