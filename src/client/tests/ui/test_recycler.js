define(function (require, exports, module) {
  'use strict';
  var strictdom = require('./libs/strictdom');
  var Recycler = require('grace/ui/recycler').RecyclerRenderer;
  strictdom.enable();
  var _compute = Recycler.prototype.compute;
  Recycler.prototype.compute = function (a, b, c) {
    return strictdom.phase('measure', _compute.bind(this, a, b, c));
  };
  var _render = Recycler.prototype.render;
  Recycler.prototype.render = function (a, b, c) {
    return strictdom.phase('mutate', _render.bind(this, a, b, c));
  };
  require(['../../ext/fileview/setup_fileview']);
});