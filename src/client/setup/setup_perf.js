define(function (require, exports, module) {
  "use strict";
  /* globals ace */
  var perf = require("../ext/dev/profiler");
  //Document
  perf.profileObject(require("ace!document").Document.prototype);
  //Editor
  perf.profileObject(ace.EditSession.prototype);
  perf.profileObject(ace.Editor.prototype);
  var prop = ace.Editor.prototype;
  prop._emit = perf.profileEvents(prop._emit);
  perf.profileListeners(prop);
  prop.addEventListener = prop.on;
  prop.removeEventListener = prop.removeListener = prop.off;
  // ace.Editor.prototype.$useTouchScroller = false;3
  perf.profileObject(
    require("../editor/ace_helpers").ScrollbarMarker.prototype
  );
  perf.profileObject(
    require("ace!virtual_renderer").VirtualRenderer.prototype
  );
  perf.profileObject(require("ace!layer/text").Text.prototype);
});