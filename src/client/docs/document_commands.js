define(function(require, exports, module) {
    var getActiveDoc = require("./active_doc").getActiveDoc;
    var addDoc = require("./docs").addDoc;
    var Docs = require("./docs").Docs;
    var Notify = require("../ui/notify").Notify;
    var FocusManager = require("../core/focus_manager").FocusManager;
    var Fileviews = require("../ext/fileview/fileviews").Fileviews;

    function save() {
        var mainDoc = getActiveDoc();
        if (mainDoc) {
            if (mainDoc.isTemp()) {
                FocusManager.hintChangeFocus();
                Fileviews.saveAs(mainDoc.id);
            } else {
                Docs.saveDocs(mainDoc.id);
            }
        }
    }

    exports.DocumentCommands = [{
            name: "refreshFile",
            bindKey: {
                win: "Ctrl-R",
                mac: "Command-Alt-R",
            },
            exec: function() {
                var mainDoc = getActiveDoc();
                mainDoc && mainDoc.refresh();
            },
        },
        {
            name: "openFile",
            bindKey: {
                win: "Ctrl-O",
                mac: "Command-O",
            },
            exec: function() {
                //Fileviews.pickFile(null, require("../core/utils").Utils.noop);
            },
        },
        {
            name: "newFile",
            bindKey: {
                win: "Ctrl-N",
                mac: "Command-Alt-N",
            },
            exec: function newDoc(editor) {
                return addDoc("unsaved*", "", {
                    mode: editor ? editor.getOption(
                        "mode") : null,
                });
            },
        },
        {
            name: "Undo All Changes",
            isAvailable: getActiveDoc,
            exec: function() {
                var mainDoc = getActiveDoc();
                if (mainDoc) {
                    if (mainDoc.saveCheckpoint("last undo")) {
                        Notify.info(
                            "Added checkpoint automatically"
                        );
                    } else Notify.error(
                        "Unable to add checkpoint");
                    mainDoc.abortChanges();
                }
            },
        },
        {
            name: "Redo All Changes",
            isAvailable: getActiveDoc,
            exec: function() {
                var mainDoc = getActiveDoc();
                if (mainDoc) mainDoc.redoChanges();
            },
        },
        {
            name: "Save Current State",
            exec: function(editor, args) {
                var mainDoc = getActiveDoc();
                if (!mainDoc) return;
                mainDoc.$clearRevertStack();

                function save(name) {
                    var obj = mainDoc.saveCheckpoint(name);
                    if (obj) Notify.info("Saved");
                    else Notify.info(
                        "Could not save checkpoint");
                    if (args && args.cb) args.cb(obj && obj
                        .key);
                }
                if (args && args.name) {
                    save(args.name);
                } else
                    Notify.prompt(
                        "Enter name",
                        save,
                        (mainDoc.$loadCheckpoints()[0] || {})
                        .name,
                        null,
                        mainDoc.$loadCheckpoints().map(function(
                            e) {
                            return e.name;
                        })
                    );
            },
        },
        {
            name: "Go to Saved State",
            exec: function(editor, args) {
                var doc = getActiveDoc();
                doc.$clearRevertStack();
                if (doc.$loadCheckpoints().length < 1)
                    return Notify.info(
                        "No states saved for this file");

                function restore(name) {
                    var res = doc.gotoCheckpoint(name);
                    if (args && args.cb) args.cb(res);
                }
                if (!doc.stateID) Notify.warn(
                    "Current state not saved");
                if (args && args.name) {
                    restore(name);
                } else
                    Notify.pick(
                        "Select checkpoint",
                        doc.$loadCheckpoints().map(function(e) {
                            return e.name;
                        }),
                        restore
                    );
            },
        },
        {
            name: "Delete State",
            exec: function(editor, args) {
                var doc = getActiveDoc();
                if (!doc) return;
                doc.$clearRevertStack();
                if (doc.$loadCheckpoints().length < 1)
                    return Notify.info(
                        "No states saved for this file");

                function restore(name) {
                    doc.deleteCheckpoint(name);
                    if (args && args.cb) args.cb();
                }
                if (args && args.name) {
                    restore(name);
                } else
                    Notify.pick(
                        "Select state",
                        doc.$loadCheckpoints().map(function(e) {
                            return e.name;
                        }),
                        restore
                    );
            },
        },
        {
            name: "Return from Checkpoint",
            bindKey: "Ctrl-Alt-J",
            exec: function() {
                getActiveDoc().returnFromCheckpoint();
            },
        },
        {
            name: "save",
            bindKey: {
                win: "Ctrl-S",
                mac: "Command-S",
            },
            exec: save,
        },
        {
            name: "saveAs",
            bindKey: {
                win: "Ctrl-Shift-S",
                mac: "Command-Shift-S",
            },
            exec: function() {
                var doc = getActiveDoc();
                if (doc) {
                    //Fileviews.saveAs(doc.id);
                }
            },
        },
    ];

});