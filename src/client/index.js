/* globals requirejs*/
var Env = {
  isBrowser: true,
  isWebView: false,
  getClipboard: null,
  setClipboard: null,
  isLocalHost: false,
  canLocalHost: false,
  getCorsProxyUrl: null //used by android application to provide git support
  // delayStorage: false
};

Env.newWindow = window.open && function(path) {
  window.open(path);
};
if (/^localhost/i.test(window.location.host)) {
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env._server = window.location.origin;
} else {
  //while developing
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env._server = "http:///localhost:3000";
}
requirejs.config({
  //By default load any module IDs from js/lib
  baseUrl: '.',
  //except, if the module ID starts with "app",
  //load it from the js/app directory. paths
  //config is relative to the baseUrl, and
  //never includes a ".js" extension since
  //the paths config could be for a directory.
  map: {
    "*": {
      "text": "libs/js/text/text",
      "css": "libs/js/require-css/css",
      "grace/core": "core",
      "grace/ext": "ext",
      "grace/docs": "docs",
      "grace/ui": "ui",
      "grace/libs": "libs",
      "grace/prefs": "prefs",
      "grace/setup": "setup",
      "grace/themes": "themes",
      "grace/editor": "editor",
    }
  }
});
var b;
window.Env = Env;
// Snippets.detectGlobals.exec(window);
// document.getElementById('eruda-script').onload = 
// function() {
if (!window.eruda) {
  window.eruda = require("eruda");
}
window.eruda.init({
  tool: ["console",
    'elements',
    'network',
    'resources'
  ]
});
if (window.Application)
  window.eruda._entryBtn.hide();
//hide on android
// }
// console.log(Snippets.getUnusedCss.exec(window));
//TODO get rid of materialize.js jquery api and make it a normal dependency like sidenav for modal,toast
//TODO Make anime.js a separate dependency also
//TODO move grace/libs/js/base64
//TODO make core/polyfills to be loaded with cash-dom
console.debug("Html: " + (b = performance.now()));
require(["./core/polyfills", "./setup/index"], function() {
  console.debug("Main: " + (performance.now() - b));
});
