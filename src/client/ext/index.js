define(function(require, exports, module) {
    //Extra files in a simple import format
    //Such that bundling is also very easy
    "use strict";
    require("./fileserver/httpfs");
    //saving checkpoints
    require("./checkpoints/setup_checkpoints");
    //editting preferences
    require("./prefs/key_binding");
    require("./prefs/linter_options");
    require("./prefs/auto_settings");
    //file colors
    require("css!./libs/css/materialize-colors");
    require("./glob/glob");

    //Extensions
    //runManager
    require("./run/run_button");
    require("./run/node");
    require("./run/svg");
    require("./run/markdown");
    
    require("./clipboard/enhanced_clipboard");
    
    //autocompletion
    require(
        "./autocompletion/manager");
    require(
        "./autocompletion/misc/filename");
    require(
        "./autocompletion/misc/colors");


    //FileBrowsers

    require("./fileview/setup_fileview");

    //StatusBar SearchBox

    require("./searchbox");

    require("./swipe_n_drag/swipe_n_drag");

    //Split Editors

    require("./split_editors");
    //Settings Menu

    require("./prefs/settings-menu");
    //git
    require("./git/git");

    //show diff

    require("./diff/diff");
    //tools fxmising

    require("./fix_colons");


    //SearchPanel
    require("./search/search_tab");
    require("./preview_file");
});