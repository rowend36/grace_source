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
        function (start) {
            appEvents.on('documentsLoaded', start);
        },
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
            require([
                //Delayed setup
                '../setup/setup_menu_items',
                '../setup/setup_sideview',
                '../setup/setup_statusbar',
                //character bar
                './editor/setup_character_bar',
                './editor/enhanced_clipboard',
                //emmet
                './editor/setup_emmet',
                //saving checkpoints
                './docs/setup_doc_exts',
                //user preferences
                './config/key_binding',
                './config/linter_options',
                //formatting
                './format/format',
                './format/fmt_js_beautify',
                './format/fmt_prettier',
                //file icon colors
                'css!grace/libs/css/materialize-colors',

                //run
                './run/run_button',
                './run/node',
                './run/svg',
                './run/markdown',

                './editor/enhanced_clipboard',

                //intellisense
                './language/setup_services',
                './language/misc/filename',
                './language/misc/colors',

                //Fileviews
                './fileview/setup_fileview',

                './ui/swipe_n_drag',

                //Split Editors
                './ui/split_editors',

                //Settings Menu
                './config/settings_menu',

                //git
                './git/git',

                //show diff
                './diff/diff',

                //tools fxmising
                './fix_missing_colons',

                //Search
                './search/search_tab',
                './search/search_box',
                './ui/import_theme',
                './preview_file',

                //Fileservers can come last since we provide !requireURL in registerFsExtension
                './fs/httpfs',
            ], n);
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
                    (performance.now() - b),
            );
        },
    ]);
});