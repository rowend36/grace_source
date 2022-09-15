define(function (require, exports, module) {
    /* globals ace */
    exports.load = function (path, require, onload, config) {
        if (config.isBuild) {
            //TODO: bundle ace extensions
            return onload();
        } else if (path !== 'autocomplete' && path !== 'snippets') {
            ace.config.loadModule('ace/' + path, onload);
        } else {
            ace.config.loadModule('ace/ext/language_tools', function () {
                onload(ace.require('ace/' + path));
            });
        }
    };
});