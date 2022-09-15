define(function (require, exports, module) {
    /*globals $*/
    /*
        Already, there are a lot of runtime tests embedded in the code using Utils.assert
        Only the more expensive tests are kept separate
    */
    var splits = require("grace/ui/split_manager").SplitManager;
    require("grace/setup/setup_editors");
    var getEditor = require("grace/setup/setup_editors").getEditor;
    var editEl = getEditor().container;
    var container = splits.add($(editEl), "vertical");
    $(container).append("<div id='mocha'></div>");
    define("revert", function () {
        return function (o, prop) {
            if (o["no-prop-" + prop]) {
                delete o["no-prop-" + prop];
                delete o[prop];
            } else if (o.hasOwnProperty("default-" + prop)) {
                o[prop] = o["default-" + prop];
                delete o["default-" + prop];
            }
        };
    });
    define("override", function () {
        return function (o, prop, value) {
            var d = o[prop];
            if (!o["no-prop-" + prop] && !o.hasOwnProperty("default-" + prop)) {
                if (!o.hasOwnProperty(prop)) o["no-prop-" + prop] = true;
                else o["default-" + prop] = o[prop];
            }
            o[prop] = value;
            return d;
        };
    });

    require([
        "require",
        "css!./libs/mocha.css",
        "./libs/chai.js",
        "./libs/mocha.min.js",
    ], function (require, css, chai, mocha) {
        define("chai", chai);
        mocha.setup("bdd");
        mocha.checkLeaks();
        require([
            // "./tests/docs/test_docs",
            // "./tests/core/test_core",
            // "./tests/core/test_ajax",
            // "./tests/core/test_schema",
            // "./tests/core/test_fs",
            // "./tests/setup/test_setup",
            // "./tests/ext/test_shared_store",
            // "./tests/ext/test_glob",
            // "./tests/ext/test_config",
            // "./tests/ext/test_tab_window",
            // "./tests/ext/test_language",
            "./tests/ext/test_diff"
        ], function () {
            mocha.run();
        });
    });
});