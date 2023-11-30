define(function (require, exports, module) {
  /*Extensions used by grace editor extensions*/
  require('./emmet');
  require('./error_marker');
  require('./menu_tools/get_editor_keyboard_shortcuts');
  require('./language_tools');
  require('./options');
  require('./searchbox');
  require('./statusbar');
  require('./whitespace');
});