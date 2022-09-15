define(function (require, exports, module) {
  "use strict";
  require('./basic_completion');
  var Snippets = require("ace!snippets").snippetManager;
  var Utils = require("grace/core/utils").Utils;
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var Notify = require("grace/ui/notify").Notify;
  var Config = require("grace/core/config").Config;
  var appEvents = require("grace/core/app_events").AppEvents;
  var debug = console;
  var appConfig = Config.registerAll(
    {
      loadSnippetFiles: "grace.snippets",
    },
    "intellisense"
  );
  Config.registerInfo({
    loadSnippetFiles:
      "Load tmsnippet files. Example files are on ace github repository. Specify snippets as filepath followed by optional list of scopes. path[:scope[,scope]] eg main.snippets:javascript,typescript",
  });
  Config.on("intellisense", function (e) {
    if (e.config === "loadSnippetFiles") {
      loadSnippets();
    }
  });
  appEvents.on("reloadProject", function () {
    var snippets = Snippets.files;
    for (var i in snippets) {
      snippets[i].isStale = true;
    }
    loadSnippets();
  });
  function loadSnippets() {
    var files = Utils.parseList(appConfig.loadSnippetFiles);
    var fs = FileUtils.getProject().fileServer || FileUtils.getFileServer();
    if (!fs) return;
    if (!Snippets.files) return;
    var error = function (path, action) {
      Notify.info("Failed to " + action + " snippet file: " + path);
    };
    Utils.asyncForEach(
      files,
      function (name, i, n) {
        var parts = name.split(":");
        var path = parts[0];
        if (Snippets.files[path] && !Snippets.files[path].isStale) return n();
        fs.readFile(
          FileUtils.resolve(FileUtils.getProject().rootDir, path),
          "utf8",
          function (e, r) {
            n();
            if (e && e.code != "ENOENT") {
              error(path, "load");
            }
            if (e) return;
            try {
              var m = {
                name: path,
              };
              m.snippets = Snippets.parseSnippetFile(r);
              Snippets.files[path] = m;
              if (parts.length > 1) {
                var scopes = parts[1].split(",");
                scopes.forEach(function (scope) {
                  Snippets.register(m.snippets || [], scope);
                });
              } else Snippets.register(m.snippets || []);
            } catch (e) {
              debug.error(e);
              error(path, "parse");
            }
          }
        );
      },
      null
    );
  }
  appEvents.on("fullyLoaded", loadSnippets);
});