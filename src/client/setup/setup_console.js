define(function (require, exports, module) {
  var eruda = require('../libs/js/eruda.min.js');
  var messages = require('../core/logs').Logs.getArray();
  window.eruda = eruda;
  eruda.init({
    tool: ['console', 'elements', 'network', 'resources'],
  });
  messages.slice(-50).forEach(function (e) {
    this[e.type](e.data);
    if (e.type === 'error' && !(e.data instanceof Error)) this.error(e.stack.join('\n') || '<no stack>');
  }, eruda.get('console'));
  messages = null;
  module.exports = eruda;
});