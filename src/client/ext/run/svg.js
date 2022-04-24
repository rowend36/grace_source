define(function(require,exports,module) {
    var Preview = require("./run").Execute.BasePreview;
    require("grace/core/config").Config.registerAll({
        commandServer: Env._server && Env._server + "/run",
        commandServerPassphrase: '',
    });
    var SvgPreview = new Preview("svg", "Svg", function(code) {
        return "<html>" + code + "</html>";
    });
    SvgPreview.extensions = {
        'svg': true
    };
    require("./run").Execute.registerRunMode('svg', SvgPreview);
});