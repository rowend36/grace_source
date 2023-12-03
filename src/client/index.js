/* globals requirejs*/
var Env = {
  isBrowser: true,
  isWebView: false,
  getClipboard: null,
  setClipboard: null,
  isLocalHost: false,
  canLocalHost: false,
  isHardwareKeyboard: false,
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
  baseUrl: ".",
  waitSeconds: 0,
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
      ace: "core/ace_loader",
    },
  },
  shim: {
    //To build for android, we must use
    //ext/android/setup_android in place
    //of ext/fs/browser_fs
    "ext/android/setup_android": {
      deps: [
        "core/logs",
        "libs/ace/ace",
        "core/jquery_compat",
        "libs/js/materialize",
        // 'ext/fs/browser_fs',
        // './setup/setup_console',
        // './ext/dev/runtime_info',
      ],
    },
    "setup/index": {
      deps: ["ext/android/setup_android"],
    },
    "libs/ace/ace": {
      init: function () {
        ace.config.set("basePath", "./libs/ace");
      },
    },
    "core/jquery_compat": {
      deps: ["libs/js/cash-dom.min"],
    },
    "libs/js/materialize": {
      deps: ["libs/js/cash-dom.min"],
    },
  },
});

requirejs.onError = function (err) {
  if (err.requireType === "scripterror" || err.requireType === "timeout") {
    setTimeout(function () {
      err.requireModules.forEach(function (moduleId) {
        if (requirejs.specified(moduleId) && !requirejs.defined(moduleId))
          requirejs.undef(moduleId);
      });
    }, 3000);
  }
  throw err;
};

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
require(["./setup/index"]);