define(function(require, exports, module) {
    /*
        Already, there are a lot of runtime tests embedded in the code using Utils.assert
        Only the more expensive tests are kept separate
    */
    var splits = require("grace/ui/splits")
        .SplitManager;
    require("grace/setup/setup_editors");
    var getEditor = require(
            "grace/setup/setup_editors")
        .getEditor;
    var editEl = getEditor().container;
    var container = splits.add($(editEl),
        'vertical');
    $(container).append(
        "<div id='mocha'></div>");

    require([
            "require",
            "css!./libs/mocha.css",
            "./libs/chai.js",
            "./libs/mocha.min.js",
            "grace/core/events"
        ],

        function(require, css, chai, mocha, events) {
            var app = events.AppEvents;
            app.once("fullyLoaded", function() {
                define("chai", chai);
                define("revert", function() {
                    return function(o, prop) {
                        if (o["emptyProp" +
                                prop]) {
                            delete o[
                                "emptyProp" +
                                prop];
                            delete o[prop];
                        } else if (o
                            .hasOwnProperty(
                                "default" + prop
                            )) {
                            o[prop] = o[
                                "default" +
                                prop];
                            delete o["default" +
                                prop];
                        }
                    };
                });
                define("override", function() {
                    return function(o, prop,
                        value) {
                        var d = o[prop];
                        if (!o["emptyProp" +
                                prop] && !(o
                                .hasOwnProperty(
                                    "default" +
                                    prop))) {

                            if (!o
                                .hasOwnProperty(
                                    prop)) o[
                                    "emptyProp" +
                                    prop] =
                                true;
                            else o["default" +
                                prop] = o[
                                prop];
                        }
                        o[prop] = value;
                        return d;
                    };
                });
                mocha.setup('bdd');
                mocha
                    .checkLeaks();
                require([
                    "./tests/core/test_core",
                    "./tests/core/test_ajax",
                    "./tests/core/test_schema",
                    "./tests/core/test_fs",
                    "./tests/ext/test_glob",
                    "./tests/docs/test_doc",
                    "./tests/ext/test_tab_window"
                ], function() {
                    mocha.run();
                });
            });
        });
});