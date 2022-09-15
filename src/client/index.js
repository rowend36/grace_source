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
  Env.server = "http:///localhost:3000";
} else {
  Env.isLocalHost = true;
  Env.canLocalHost = true;
  Env.server = window.location.origin;
}
requirejs.config({
  //By default load any module IDs from js/lib
  baseUrl: ".",
  //except, if the module ID starts with "app",
  //load it from the js/app directory. paths
  //config is relative to the baseUrl, and
  //never includes a ".js" extension since
  //the paths config could be for a directory.
  waitSeconds: 30,
  map: {
    "*": {
      text: "libs/js/text/text",
      css: "libs/js/require-css/css",
      "grace/core": "core",
      "grace/ext": "ext",
      "grace/docs": "docs",
      "grace/ui": "ui",
      "grace/libs": "libs",
      "grace/setup": "setup",
      "grace/themes": "themes",
      "grace/editor": "editor",
      "ace": "core/ace_loader"
    },
  },
});
var b;
window.Env = Env;
// Snippets.detectGlobals.exec(window);
// document.getElementById('eruda-script').onload =
// function() {

//hide on android
// }
// console.log(Snippets.getUnusedCss.exec(window));
//TODO get rid of materialize.js jquery api and make it a normal dependency like sidenav for modal,toast
//TODO Make anime.js a separate dependency also
//TODO move grace/libs/js/base64
//TODO make core/polyfills to be loaded with cash-dom
console.debug("Html: " + (b = performance.now()));
require(["./libs/js/eruda.min.js", "./core/polyfills"], function (e) {
  require(["./setup/index"], function () {
    console.debug("Main: " + (performance.now() - b));
  });
  window.eruda = e;
  window.eruda.init({
    tool: ["console", "elements", "network", "resources"],
  });

  // window.eruda._entryBtn.hide();
  //we rarely have issues on first run now
});