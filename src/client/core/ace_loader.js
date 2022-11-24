define(function (require, exports, module) {
    /* globals ace */
    exports.load = function (path, localRequire, onload, config) {
        if (config.isBuild) {
            //TODO: bundle ace extensions
            return onload();
        } else {
            var m = ace.require(path);
            if (m) return onload(m);
            //load ace so that the basePath will be set.
            require(['../libs/ace/ace','../libs/ace/ext-grace'], function () {
                var m = ace.require(path);
                if (m) return onload(m);
                ace.config.loadModule('ace/' + path, onload);
            });
        }
    };
});