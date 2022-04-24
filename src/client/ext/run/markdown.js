define(function(require, exports, module) {
    var Preview = require("./run").Execute.BasePreview;
    var Depend = require("grace/core/depend");
    var MarkdownPreview = new Preview("md", "Markdown", function(
        value) {
        return this.md.render(value);
    });
    MarkdownPreview.extensions = {
        'md': true,
        'markdown': true
    };
    MarkdownPreview.modes = {
        'ace/mode/markdown': true
    };
    MarkdownPreview.run = Depend.define(function(cb) {
        require(["grace/ext/run/libs/markdown-it"],
            function(markdownit) {
                MarkdownPreview.md = markdownit();
                cb();
            });
    }, Preview.prototype.run);
    require("./run").Execute.registerRunMode('md', MarkdownPreview);
});
