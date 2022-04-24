define(function(require,exports,module) {
  //A plugin to get options based on a path
  var Schema = require("grace/core/schema").Schema;
  var config = require("grace/core/config").Config.registerAll({
    'rules': [{
        glob: "*.gtag",
        output: {
          mode: "ace/mode/json5"
        }
      },
      {
        glob: "*.min.js",
        output: {
          mode: "ace/mode/text"
        }
      },
      {
        glob: "**.{js,html}",
        output: {
          "fl-allowTagsFrom": ["*.css", "*.json"]
        }
      }
    ],
    'debugRules': false
  }, "documents.optionRules");
  require("grace/core/config").Config.registerValues({
    "!root": "Get default options for a document based on a list of rules.\n\
Each rule takes the form of \n\
  {\n\
    glob?: <glob_string>|null,\n\
    where?: Map<key,value>,\n\
    output: Map<key,value>,\n\
    minSize: <number>,\n\
    maxSize: <number>,\n\
  }\n\
}\
When a document is first opened. The glob is matched against the absolute path of the file(null which matches new documents). If it succeeds, all the options in output are enabled for that document\
Any of the editor options can be added. Additional options include 'encoding' and 'autosave'.\
Some application settings also support flags of the form fl-<flag> e.g fl-formatter.\
\nThe optional third argument filtering files based on the already computed attributes.\
To facilitate this, data- attributes eg \'data-valid\' can be added to be matched by later matches.\
Note: The rules are only used when the file is first opened so to see any changes, you have to reopen the document.\
Possible usage could be to match a list of modes eg\
\{where: {mode: 'ace/mode/javascript'} output: {'data-js':true}\
\{where: {mode: 'ace/mode/jsx'} output: {'data-js': true}\
\{where: {'data-js': true} output: {'fl-formatter':'prettier','autosave':false}",
    "rules": {
      "schema": new Schema.XArray(Schema.parse({
        "glob": "?<null|string>",
        "output": "object",
        "where": "?object",
        "minSize": "?size",
        "maxSize": "?size"
      }))
    }
  }, "documents.optionRules");
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var table = require("grace/ui/ui_utils").tabulate;
  var Settings = require("grace/editor/editors").Editors.getSettingsEditor().validator;
  var appEvents = require("grace/core/events").AppEvents;
  var Notify = require("grace/ui/notify").Notify;
  var basename = FileUtils.filename;
  var Docs = require("grace/docs/docs").Docs;

  function setOptions(doc) {
    var options = doc.options;
    var editorOptions = doc.editorOptions;
    var resolved = {
      mode: doc.session.$modeId,
      "data-size": doc.getSize()
    };

    function fail(reason) {
      if (config.debugRules) {
        Notify.info(reason);
      }
    }
    var path = doc.getSavePath();
    config.rules.forEach(function(item, i) {
      var rule = item.glob;
      if (rule === null && path) return fail(i + ")Null glob cannot match path: " + path);
      if (rule) {
        if (!path) return fail(i + ")Unsaved doc cannot match glob " + rule);
        var glob;
        try {
          glob = FileUtils.globToRegex(rule);
        } catch (e) {
          Notify.error('Bad Regex in rule ' + rule);
          return;
        }
        if (!(glob.test(path) || glob.test(basename(path)))) {
          fail("Failed glob " + rule + " " + path);
          return;
        }
      }
      if (item.minSize) {
        if (resolved["data-size"] < item.minSize) return fail('Minimum check size failed ' + path);
      }
      if (item.maxSize) {
        if (resolved["data-size"] > item.maxSize) return fail('Maxiimum check size failed ' + path);
      }
      var tests = item.where;
      for (var j in tests) {
        if (resolved.hasOwnProperty(j)) {
          if (resolved[j] == tests[j]) {
            continue;
          } else {
            fail("Mismatched property " + j + " " + path);
          }
        } else if (options.hasOwnProperty(j)) {
          if (options[j] == tests[j]) {
            continue;
          }
          fail("Mismatched default property " + j + " " + path);
        } else if (editorOptions && editorOptions.hasOwnProperty(j)) {
          if (editorOptions[j] == tests[j]) {
            continue;
          }
          fail("Mismatched default property " + j + " " + path);
        } else fail("No property " + j + " " + path);
        return;
      }
      Object.assign(resolved, item.output);
    });
    for (var k in resolved) {
      switch (k) {
        case "mode":
          doc.session.setMode(resolved[k]);
          continue;
        case "autosave":
          doc.allowAutoSave = resolved[k] && (doc.allowAutoSave || undefined);
          continue;
        case "encoding":
          Docs.setEncoding(doc.id, resolved[k]);
          continue;
        default:
          if (Settings.hasOwnProperty(k)) {
            if (!Settings[k].test(resolved[k])) {
              if (resolved[k] !== undefined)
                Notify.warn("Bad property value " + resolved[k]);
              continue;
            }
            if (Docs.$defaults.hasOwnProperty(k)) {
              doc.options[k] = resolved[k];
              doc.session.setOption(k, resolved[k]);
            } else {
              if (!doc.editorOptions) doc.editorOptions = {};
              doc.editorOptions[k] = resolved[k];
            }
          } else if (k.startsWith("data-")) {
            continue;
          } else if (k.startsWith("fl-")) {
            Docs.addFlag(doc.id, k.substring(3), resolved[k]);
          } else Notify.warn("Unknown property " + k);
      }
    }
  }
  appEvents.on("createDoc", function(e) {
    setOptions(e.doc);
  });
  var Utils = require("grace/core/utils").Utils;
  var menu = require("grace/setup/setup_main_menu").MainMenu;
  menu.addOption(
    "quick-info", {
      icon: "info",
      caption: "Show Document Info",
      onclick: function() {
        var doc = require("grace/docs/active_doc").getActiveDoc();
        var editor = require("grace/setup/setup_editors").getEditor();
        var instance = editor.getMainCompleter();
        if (!doc) Notify.info("No active documment");
        Notify.modal({
          header: "Document Info",
          body: table({
            "Size": doc.getSize(),
            "Opened": Utils.getCreationDate(doc.id),
            "Lines": doc.session.getLength(),
            "Encoding": doc.getEncoding(),
            "Line Mode": doc.session.getNewLineMode(),
            "Detected New Line": JSON.stringify(doc.session.getDocument().$autoNewLine),
            "Autosave": doc.allowAutoSave || false,
            "Enabled flags": JSON.stringify(doc.flags),
            "Completion Providers": editor.completers && editor.completers.map(function(e) {
              return e.name || e.constructor.name;
            }),
            "Loaded Documents": instance ? Object.keys(instance.docs) : "",
            "Annotation Providers": doc.session.listWorkers().map(function(m) {
              return m.id;
            })
          }),
          footers: ["close"]
        });
      }
    }, true);
});
