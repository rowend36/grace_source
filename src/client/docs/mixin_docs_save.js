define(function (require, exports, module) {
  "use strict";
  var appEvents = require("../core/app_events").AppEvents;
  var Notify = require("../ui/notify").Notify;
  var FileUtils = require("../core/file_utils").FileUtils;
  var Docs = require("./docs_base").Docs;
  var finishLoad = require("./mixin_docs_persist").$finishLoad;
  var openDoc = require("./mixin_docs_tabs").openDoc;
  var forEachDoc = Docs.forEach;
  var getDoc = Docs.get;
  var Config = require("../core/config").Config;
  var Utils = require("../core/utils").Utils;

  var appConfig = Config.registerAll(
    {
      autoSave: false,
      autoSaveInterval: "1min",
    },
    "documents"
  );
  Config.registerInfo(
    {
      autoSave:
        "Enable saving on change once a document has been saved once. Uses resource context.",
      autoSaveInterval: {
        type: "time",
      },
    },
    "documents"
  );

  Config.on("documents", function (ev) {
    switch (ev.config) {
      case "autoSaveInterval":
        Docs.$autoSave = Utils.delay(
          exports.saveDocs,
          Math.max(Utils.parseTime(appConfig.autoSaveInterval), 5000)
        );
        break;
      case "autoSave":
        forEachDoc(function (doc) {
          if (doc.allowAutoSave !== undefined) {
            doc.toggleAutosave(
              Config.forPath(doc.getSavePath(), "documents", "autoSave")
            );
          }
        });
    }
  });
  exports.$updateStatus = function (id) {
    if (Docs.has(id))
      appEvents.trigger("docStatusChanged", {
        doc: getDoc(id),
      });
  };

  /** Save all non shadow documents
   or specified doc
   */
  exports.saveDocs = function (id, callback, force) {
    if (id === undefined) {
      Docs.$autoSave.cancel();
      forEachDoc(function (doc) {
        if ((doc.dirty || force) && doc.allowAutoSave && !doc.duplicateId)
          exports.saveDocs(doc.id, callback);
      });
    } else {
      var doc = getDoc(id);
      appEvents.asyncTrigger("saveDoc", {doc: doc}, function (ev) {
        if (ev.defaultPrevented) return;
        if (doc.duplicateId) {
          var savePath = doc.getSavePath();
          //Make this doc the mainDoc - the doc which matches the file on disk
          var mainDoc = Docs.forPath(savePath, doc.getFileServer());

          if (mainDoc) {
            mainDoc.duplicateId = doc.duplicateId;
            //Warn that autosave will no longer work in the  mainDoc
            if (mainDoc.allowAutoSave && !mainDoc.warned) {
              mainDoc.warned = true;
              Notify.warn(
                "Autosave disabled for duplicates of this document.",
                1000
              );
            }
          }
          doc.duplicateId = false;

          //Set all the other documents as dirty
          forEachDoc(function (doc) {
            if (doc.duplicateId && doc.getSavePath() == savePath) {
              doc.setDirty();
            }
          });
        }

        //Enable autosave if not explicitly disabled
        if (doc.allowAutoSave === undefined) {
          doc.toggleAutosave(
            Config.forPath(doc.getSavePath(), "documents", "autoSave")
          );
          if (doc.allowAutoSave) Notify.info("Autosave enabled");
        }
        doc.save(callback);
      });
    }
  };
  Docs.$autoSave = Utils.delay(
    exports.saveDocs,
    Math.max(Utils.parseTime(appConfig.autoSaveInterval), 5000)
  );
  exports.saveAs = function (id, newpath, fileServer, callback) {
    var doc = getDoc(id);
    fileServer = fileServer || FileUtils.getFileServer();
    if (doc.isTemp()) {
      doc.setPath(newpath);
      appEvents.trigger("renameDoc", {
        doc: getDoc(id),
      });
    } else {
      id = openDoc("", "", newpath);
      getDoc(id).restoreState(doc.saveState());
    }
    getDoc(id).fileServer = fileServer.id;
    if (doc.encoding) {
      var alias = fileServer.isEncoding(doc.encoding);
      if (!alias) {
        getDoc(id).encoding = FileUtils.detectEncoding(newpath, fileServer);
        Notify.info("Encoding reset to default");
      } else
        getDoc(id).encoding = typeof alias == "string" ? alias : doc.encoding;
    }
    exports.saveDocs(id, callback);
  };

  exports.filterWithin = function (path, fs) {
    var sep = FileUtils.sep;
    var affected = [];
    forEachDoc(function (doc) {
      var save = doc.getSavePath();
      if (save && (save == path || save.startsWith(path + sep))) {
        if (!fs || doc.getFileServer().getDisk() == fs.getDisk())
          affected.push(doc);
      }
    });
    return affected;
  };
  exports.rename = function (path, newpath, fs) {
    path = FileUtils.removeTrailingSlash(path);
    newpath = FileUtils.removeTrailingSlash(newpath);
    var affected = exports.filterWithin(path, fs);
    if (!affected.length) return;
    if (affected.length == 1 && affected[0].getSavePath() === path) {
      doRename();
    } else {
      Notify.modal(
        {
          header: "Update documents to match new path?",
          dismissible: false,
          form: affected.map(function (doc, i) {
            return {
              name: "doc" + i,
              type: "accept",
              value: true,
              caption: doc.getPath(),
            };
          }),
          footers: ["Rename All", "Proceed"],
          onCreate: function (el) {
            require("../ui/ui_utils").styleClip(
              el.find("label").addClass("clipper")
            );
            el.find(".modal-rename_all")
              .addClass("error")
              .click(function () {
                el.modal("close");
                doRename();
              });
            el.find(".modal-proceed").click(function () {
              var els = el.find("input");
              for (var i = els.length; i-- > 0; ) {
                if (!els[i].checked) {
                  affected.splice(i, 1);
                }
              }
              el.modal("close");
              doRename();
            });
          },
        },
        function (el) {
          el.find("input").off();
          el.find(".modal-rename_all").off();
          el.find(".modal-proceed").off();
        }
      );
    }
    function doRename() {
      affected.forEach(function (doc) {
        var docpath = (doc && doc.getSavePath()) || "";
        if (docpath.startsWith(path)) {
          doc.setPath(newpath + docpath.substring(path.length));
          appEvents.trigger("renameDoc", {
            doc: doc,
          });
        }
      });
    }
  };
  exports.delete = function (path, fs) {
    path = FileUtils.removeTrailingSlash(path);
    exports.filterWithin(path, fs).forEach(function (doc) {
      doc.setDirty();
      appEvents.trigger("deleteDoc", {
        doc: doc,
      });
    });
  };

  exports.setEncoding = function (id, encoding) {
    ///TODO not quite working yet
    var doc = getDoc(id);
    var alias = doc.getFileServer().isEncoding(encoding);
    if (alias) {
      if (typeof alias == "string") doc.setEncoding(alias);
      else doc.setEncoding(encoding);
      if (!doc.isTemp()) {
        Notify.ask(
          "Reload file with new encoding " + encoding + "?",
          function () {
            doc.refresh(
              function () {
                Notify.info("Refreshed");
              },
              true,
              false
            );
          }
        );
      }
    } else {
      Notify.error(
        "Encoding " + encoding + " not supported by this storage backend"
      );
    }
  };
  exports.onRefresh = function (doc, err, res, callback, ignoreDirty, confirm) {
    callback = callback || Utils.noop;
    var name = FileUtils.filename(doc.getPath());
    if (err) {
      doc.setDirty();
      if (err.code === "ENOENT") {
        Notify.info("File deleted " + name);
      } else {
        Notify.error("Failed to read " + doc.getPath() + " " + err.code);
      }
      return callback(err, false);
    }
    if (doc.$needsRefreshToCompleteLoad) finishLoad(doc, res);

    if (res.length === doc.getSize() && res === doc.getValue()) {
      if (doc.dirty) doc.setClean();
      return callback(null, true);
    } else if (ignoreDirty && doc.dirty && doc.isLastSavedValue(res)) {
      //ignoreDirty :ignore docs whose changes are
      //known/created by the user
      return callback(null, false);
    } else if (confirm === false) {
      //force: do not ask confirmation
      doc.updateValue(res, true);
      return callback(null, true);
    } else {
      //The !ignoreDirty check is to prevent calling isLastSavedValue twice
      var known = !ignoreDirty && doc.dirty && doc.isLastSavedValue(res);
      if (!known) doc.setDirty(); //Doc no longer knows which revision matches the stored file.
      Notify.ask(
        "File changed. Reload " + name + "?",
        function () {
          doc.updateValue(res, true);
          callback(null, true);
        },
        function () {
          if (!known) {
            //Mark this as the lastSavedValue
            doc.setClean(null, res);
            //But keep Doc as dirty
            doc.setDirty();
          }
          callback(null, false);
        }
      );
    }
  };
  exports.dirty = function (id) {
    getDoc(id).setDirty();
  };
});