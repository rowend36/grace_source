define(function (require, exports, module) {
    exports.load = function (path, require, onload, config) {
        if (config.isBuild) {
            return onload();
        } else {
            ace.config.loadModule(path, onload);
        }
    };
});