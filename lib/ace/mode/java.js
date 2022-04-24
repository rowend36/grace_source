define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var JavaScriptMode = require("./javascript").Mode;
var JavaHighlightRules = require("./java_highlight_rules").JavaHighlightRules;
var JavaFoldMode = require("./folding/java").FoldMode;
var WorkerClient = require("../worker/worker_client").WorkerClient;
var Annotations = require("../annotations").Annotations;

var Mode = function() {
    JavaScriptMode.call(this);
    this.HighlightRules = JavaHighlightRules;
    this.foldingRules = new JavaFoldMode();
};
oop.inherits(Mode, JavaScriptMode);

(function() {
    
    this.createWorker = function(session) {
        var worker = new WorkerClient(["ace"], "ace/mode/java_worker", "JavaWorker");
        return worker;
    };

    this.$id = "ace/mode/java";
    this.snippetFileId = "ace/snippets/java";
    Annotations.registerProvider(this);
}).call(Mode.prototype);

exports.Mode = Mode;
});
