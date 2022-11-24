define(function (require) {
  require('../libs/ace/ext-grace');
  require('./parse_schema');
  require('./file_utils/glob');
  require('./config/editor_contexts');
  require('./config/action_context');
  //Delayed setup
  require('../setup/setup_menu_items');
  require('../setup/setup_sideview');
  require('../setup/setup_statusbar');
  //character bar
  require('./editor/setup_character_bar');
  require('./editor/enhanced_clipboard');
  //emmet
  require('./editor/setup_emmet');
  //saving checkpoints
  require('./docs/setup_doc_exts');
  //user preferences
  require('./config/key_binding');
  require('./config/linter_options');
  //formatting
  require('./format/format');
  require('./format/format_on_type');
  require('./format/fmt_js_beautify');
  require('./format/fmt_prettier');
  //file icon colors
  require('css!grace/libs/css/materialize-colors');

  //run
  require('./run/run_button');
  require('./run/node');
  require('./run/svg');
  require('./run/markdown');

  require('./editor/enhanced_clipboard');

  //intellisense
  require('./language/setup_services');
  require('./language/misc/filename');
  require('./language/misc/colors');

  //Fileviews
  require('./fileview/setup_fileview');

  require('./ui/swipe_n_drag');

  //Split Editors
  require('./ui/split_editors');

  //Settings Menu
  require('./config/settings_menu');

  //git
  require('./git/git');

  //show diff
  require('./diff/diff');

  //tools fxmising
  require('./fix_missing_colons');

  //Search
  require('./search/search_tab');
  require('./search/search_box');
  require('./ui/import_theme');
  require('./preview_file');

  //Fileservers can come last since we provide !requireURL in registerFsExtension
  require('./fs/httpfs');
  require("../ext/fs/browser_fs");
});