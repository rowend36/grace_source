define(function (require, exports, module) {
    //Extra files in a simple import format
    //Such that bundling is also very easy
    'use strict';
    var appEvents = require('../core/app_events').AppEvents;
    var waterfall = require('../core/utils').Utils.waterfall;
    var core = 0;
    var b;
    /*globals requirejs*/
    waterfall([
        // function (start) {
        //     appEvents.on('documentsLoaded', start);
        // },
        function (n) {
            core = Object.keys(requirejs.s.contexts._.defined).length;
            b = performance.now();
            require([
                //Modules which extend core modules with methods only extensions use.
                './parse_schema',
                './file_utils/glob',
                './config/editor_contexts',
                './config/action_context',
            ], n);
        },
        function (n) {
            require(['./all'], n);
        },
        true,
        function () {
            var extensions =
                Object.keys(requirejs.s.contexts._.defined).length - core;

            appEvents.triggerForever('fullyLoaded');
            console.debug(
                'Extensions ( ' +
                    extensions +
                    ' modules): ' +
                    (performance.now() - b)
            );
        },
    ]);
});