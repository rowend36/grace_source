define(function (require, exports, module) {
    var openDoc = require('./docs').openDoc;
    var Docs = require('./docs').Docs;
    var Notify = require('../ui/notify').Notify;
    var FocusManager = require('../ui/focus_manager').FocusManager;

    function getDoc(editor) {
        return Docs.forSession(editor.session);
    }
    var checkpointsLoaded = function () {
        return getDoc() && getDoc().$loadCheckpoints;
    };
    var partialUndoLoaded = function () {
        return getDoc() && getDoc().session.partialUndo;
    };
    exports.DocumentCommands = [
        {
            name: 'refreshFile',
            bindKey: {
                win: 'Ctrl-R',
                mac: 'Command-Alt-R',
            },
            exec: function (editor) {
                var mainDoc = getDoc(editor);
                mainDoc && mainDoc.refresh();
            },
        },
        {
            name: 'openFile',
            bindKey: {
                win: 'Ctrl-O',
                mac: 'Command-O',
            },
            exec: function () {
                require(['../ext/fileview/fileviews'], function (mod) {
                    mod.Fileviews.pickFile(
                        null,
                        require('../core/utils').Utils.noop
                    );
                });
            },
        },
        {
            name: 'newFile',
            bindKey: {
                win: 'Ctrl-N',
                mac: 'Command-Alt-N',
            },
            exec: function newDoc(editor) {
                return openDoc('unsaved*', '', {
                    mode: editor ? editor.getOption('mode') : null,
                });
            },
        },
        {
            name: 'undoAllChanges',
            isAvailable: checkpointsLoaded,
            exec: function (editor) {
                var mainDoc = getDoc(editor);
                if (mainDoc) {
                    mainDoc.saveCheckpoint('last undo', function (pass) {
                        if (pass) {
                            Notify.info('Added checkpoint automatically');
                        } else Notify.error('Unable to add checkpoint');
                        mainDoc.abortChanges();
                    });
                }
            },
        },
        {
            name: 'partialUndo',
            isAvailable: partialUndoLoaded,
            multiSelectAction: 'forEach',
            exec: function (editor) {
                var mainDoc = getDoc(editor);
                if (mainDoc) mainDoc.session.partialUndo();
            },
        },
        {
            name: 'redoAllChanges',
            isAvailable: checkpointsLoaded,
            exec: function (editor) {
                var mainDoc = getDoc(editor);
                if (mainDoc) mainDoc.redoChanges();
            },
        },
        {
            name: 'saveState',
            isAvailable: checkpointsLoaded,
            exec: function (editor, args) {
                var mainDoc = getDoc(editor);
                if (!mainDoc) return;
                mainDoc.$clearRevertStack();

                function saveState(name) {
                    mainDoc.saveCheckpoint(name, function (obj) {
                        if (obj) Notify.info('Saved');
                        else Notify.info('Could not save state');
                        if (args && args.cb) args.cb(obj && obj.key);
                    });
                }
                if (args && args.name) {
                    saveState(args.name);
                } else
                    Notify.prompt(
                        'Enter name',
                        saveState,
                        (mainDoc.$loadCheckpoints()[0] || {}).name,
                        null,
                        mainDoc.$loadCheckpoints().map(function (e) {
                            return e.name;
                        })
                    );
            },
        },
        {
            name: 'restoreState',
            isAvailable: checkpointsLoaded,
            exec: function (editor, args) {
                var doc = getDoc(editor);
                doc.$clearRevertStack();
                if (doc.$loadCheckpoints().length < 1)
                    return Notify.info('No states saved for this file');

                function restore(name) {
                    var res = doc.gotoCheckpoint(name, function () {
                        if (args && args.cb) args.cb(res);
                    });
                }
                if (!doc.stateID) Notify.warn('Current state not saved');
                if (args && args.name) {
                    restore(name);
                } else
                    Notify.pick(
                        'Select checkpoint',
                        doc.$loadCheckpoints().map(function (e) {
                            return e.name;
                        }),
                        restore
                    );
            },
        },
        {
            name: 'deleteState',
            isAvailable: checkpointsLoaded,
            exec: function (editor, args) {
                var doc = getDoc(editor);
                if (!doc) return;
                doc.$clearRevertStack();
                if (doc.$loadCheckpoints().length < 1)
                    return Notify.info('No states saved for this file');

                function restore(name) {
                    doc.deleteCheckpoint(name);
                    if (args && args.cb) args.cb();
                }
                if (args && args.name) {
                    restore(name);
                } else
                    Notify.pick(
                        'Select state',
                        doc.$loadCheckpoints().map(function (e) {
                            return e.name;
                        }),
                        restore
                    );
            },
        },
        {
            name: 'returnFromState',
            isAvailable: checkpointsLoaded,
            bindKey: 'Ctrl-Alt-J',
            exec: function (editor) {
                getDoc(editor).returnFromCheckpoint(
                    require('../core/utils').Utils.noop
                );
            },
        },
        {
            name: 'save',
            bindKey: {
                win: 'Ctrl-S',
                mac: 'Command-S',
            },
            exec: function save(editor) {
                var mainDoc = getDoc(editor);
                if (mainDoc) {
                    if (mainDoc.isTemp()) {
                        FocusManager.hintChangeFocus();
                        require(['../ext/fileview/fileviews'], function (mod) {
                            mod.Fileviews.saveAs(mainDoc.id);
                        });
                    } else {
                        Docs.saveDocs(mainDoc.id);
                    }
                }
            },
        },
        {
            name: 'saveAs',
            bindKey: {
                win: 'Ctrl-Shift-S',
                mac: 'Command-Shift-S',
            },
            exec: function (editor) {
                var doc = getDoc(editor);
                if (doc) {
                    FocusManager.hintChangeFocus();
                    require(['../ext/fileview/fileviews'], function (mod) {
                        mod.Fileviews.saveAs(doc.id);
                    });
                }
            },
        },
    ];
});