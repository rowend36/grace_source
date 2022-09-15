/* globals requirejs*/
var Env = {
  isBrowser: true,
  isWebView: false,
  getClipboard: null,
  setClipboard: null,
  isLocalHost: false,
  canLocalHost: false,
  getCorsProxyUrl: null, //used by android application to provide git support
  // delayStorage: false
};
Env.newWindow =
  window.open &&
  function (path) {
    window.open(path);
  };
if (/^file/i.test(window.location.host)) {
  //while developing
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env.server = 'http:///localhost:3000';
} else {
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env.server = window.location.origin;
}
requirejs.config({
  baseUrl: '.',
  waitSeconds: 60,
  map: {
    '*': {
      text: 'libs/js/text/text',
      css: 'libs/js/require-css/css',
      'grace/core': 'core',
      'grace/ext': 'ext',
      'grace/docs': 'docs',
      'grace/ui': 'ui',
      'grace/libs': 'libs',
      'grace/setup': 'setup',
      'grace/themes': 'themes',
      'grace/editor': 'editor',
      ace: 'core/ace_loader',
    },
  },
  paths: {
    fastdom: 'libs/js/fastdom.min',
  },
  shim: {
    fastdom: {
      exports: 'fastdom',
    },
    'setup/index': {
      deps: ['libs/ace/ace', 'core/jquery_compat', 'libs/js/materialize'],
    },
    'core/jquery_compat': {
      deps: ['libs/js/cash-dom.min'],
    },
    'libs/js/materialize':{
      deps: ['libs/js/cash-dom.min']
    }
  },
});
window.Env = Env;
// require(['ext/dev/snippets'], function (e) {
//   e.Snippets.detectGlobals.exec(window);
//   require(['grace/core/app_events'], function (f) {
//     f.AppEvents.on('fullyLoaded', function () {
//       console.log(e.Snippets.getUnusedCss.exec(window));
//     });
//   });
// });
//TODO get rid of materialize.js jquery api and make it a normal dependency like sidenav for modal,toast
//TODO Make anime.js a separate dependency also
//TODO move grace/libs/js/base64
require([
  './core/logs',
  // './setup/setup_console',
  // './ext/dev/runtime_info',
], function (e) {
  require(['./setup/index']);
});