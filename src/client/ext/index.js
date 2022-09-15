define(function (require, exports, module) {
    //Extra files in a simple import format
    //Such that bundling is also very easy
    'use strict';
    var appEvents = require('../core/app_events').AppEvents;
    var b = performance.now();
    appEvents.on('documentsLoaded', function () {
        require([
            './editor/setup_character_bar',
            './fs/httpfs',
            //saving checkpoints
            './docs/setup_doc_exts',
            //editting preferences
            './config/key_binding',
            './config/linter_options',
            './config/editor_contexts',
            './format/format',
            './format/fmt_js_beautify',
            './format/fmt_prettier',
            //file colors
            'css!grace/libs/css/materialize-colors',
            './file_utils/glob',

            //Extensions
            //runManager
            './run/run_button',
            './run/node',
            './run/svg',
            './run/markdown',

            './editor/enhanced_clipboard',

            //autocompletion
            './language/setup_services',
            './language/misc/filename',
            './language/misc/colors',

            //FileBrowsers
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
        ], function () {
            appEvents.triggerForever('fullyLoaded');
            console.debug('Extensions: ' + (performance.now() - b));
        });
    });
});