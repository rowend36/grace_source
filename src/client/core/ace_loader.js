define(function (require, exports, module) {
    exports.load = function (path, require, onload, config) {
        if (config.isBuild) {
            //TODO: bundle ace extensions
            return onload();
        } else {
            ace.config.loadModule('ace/' + path, onload);
        }
    };
});