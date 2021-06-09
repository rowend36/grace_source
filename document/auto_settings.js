_Define(function(global) {
  //A plugin to get options based on a path
  var config = global.registerAll({
    'rules': [],
    'debugRules': false
  }, "documents.optionRules");
  global.registerValues({
    "!root": "Get default options for a document based on a list of rules.\n Each rule takes consist of a glob (or null which matches unsaved documents) and a set of options e.g ['*.js',{mode:'ace/mode/javascript'},{}] Any of the editor options can be added. Additional options include encoding and autosave. Flags of the form fl-<flag> e.g fl-formatter are also   supported. *Note paths are matched as absolute paths.  \nThe optional third argument allows exact matching based on the already computed attributes. Data attributes eg \'data-valid\' can be added to be matched by later matches.  This rules are only used when the file is first opened so to see any changes, you have to reopen the document."
  }, "documents.optionRules");
  var FileUtils = global.FileUtils;
  var Settings = global.Editors.getSettingsEditor().validator;
  var appEvents = global.AppEvents;
  var Notify = global.Notify;
  var basename = FileUtils.filename;
  var Docs = global.Docs;

  function setOptions(doc) {
    var options = doc.options;
    var editorOptions = doc.editorOptions;
    var resolved = {};
    var path = doc.getSavePath();
    for (var i in config.rules) {
      var item = config.rules[i];
      var rule = item[0];
      if (rule) {
        if (!path) continue;
        var glob;
        try {
          glob = FileUtils.globToRegex(rule);
        } catch (e) {
          Notify.error('Bad Regex in rule ' + rule);
          continue;
        }
        if (!(glob.test(path) || glob.test(basename(path)))) {
          if (config.debugRules) Notify.info("Failed glob " + rule + " " + path);
          continue;
        }
      }
      var tests = item[2];
      var failed = false;
      for (var j in tests) {
        if (resolved.hasOwnProperty(j)) {
          if (resolved[j] == tests[j]) {
            continue;
          } else {
            if (config.debugRules) Notify.info("Mismatched property " + j + " " + path);
          }
        }
        else if (options.hasOwnProperty(j)) {
          if (options[j] == tests[j]) {
            continue;
          }
          if (config.debugRules) Notify.info("Mismatched default property " + j + " " + path);
        } else if (editorOptions && editorOptions.hasOwnProperty(j)) {
          if (editorOptions[j] == tests[j]) {
            continue;
          }
          if (config.debugRules) Notify.info("Mismatched default property " + j + " " + path);
        }
        else if (config.debugRules) Notify.info("No property property " + j + " " + path);
        failed = true;
        break;
      }
      if (failed) {
        continue;
      }
      Object.assign(resolved, item[1]);
    }
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
              Notify.warn("Bad property value " + resolved[k]);
              continue;
            }
            if (Docs.$defaults.hasOwnProperty(k)) {
              doc.options[k] = reolved[k];
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
  var Utils = global.Utils;
  var menu = global.MainMenu;
    menu.addOption(
        "quick-info",
        {
          icon: "info",
          caption: "Show Document Info",
          onclick: function(){
            var doc = global.getActiveDoc();
            if(!doc)Notify.info("No active documment");
            var table = function (data) {
                    var str = "<table>";
                    for (var i in data) {
                        str +=
                            "<tr><td>" +
                            i +
                            "</td><td>" +
                            data[i] +
                            "</td></tr>";
                    }
                    return str + "</table>";
                };
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
                "Flags": JSON.stringify(doc.flags),
              }),
              footers: ["close"]
            });
          }
        },true);
});
_Define(function(global) {
  var appEvents = global.AppEvents;
  var Docs = global.Docs;
  var config = global.registerAll({
    "detectIndentation": true
  },"documents");
  appEvents.on("createDoc", function(e) {
    var doc = e.doc;
    if(config.detectIndentation){
      ace.config.loadModule("ace/ext/whitespace",function(e){
        e.detectIndentation(doc.session);
        doc.options.useSoftTabs = doc.session.getUseSoftTabs();
        doc.options.tabSize = doc.session.getTabSize();
        Docs.tempSave(doc.id);
      });
    }
  });
});
