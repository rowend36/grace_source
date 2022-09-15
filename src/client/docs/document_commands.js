define(function (require, exports, module) {
    var openDoc = require('./docs').openDoc;
    var Docs = require('./docs').Docs;
    var Actions = require('../core/actions').Actions;
    var Notify = require('../ui/notify').Notify;
    var FocusManager = require('../ui/focus_manager').FocusManager;
    var debug = console;
    var asyncEach = require('../core/utils').Utils.asyncForEach;
    function getDoc(editor) {
        return Docs.forSession(editor.session);
    }
    exports.DocumentCommands = [
        {
            name: 'save',
            icon: 'save',
            bindKey: {
                win: 'Ctrl-S',
                mac: 'Command-S',
            },
            sortIndex: -1,
            showIn: 'actionbar',
            isAvailable: getDoc,
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
            name: 'newFile',
            sortIndex: -2,
            icon: 'add_file',
            caption: 'New',
            bindKey: {
                win: 'Ctrl-N',
                mac: 'Command-Alt-N',
            },
            exec: function newDoc(editor) {
                return openDoc('unsaved*', '','', {
                    mode: editor ? editor.getOption('mode') : null,
                });
            },
        },
        {
            name: 'saveAs',
            icon: 'save',
            bindKey: {
                win: 'Ctrl-Shift-S',
                mac: 'Command-Shift-S',
            },
            isAvailable: getDoc,
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
        {
            icon: 'refresh',
            name: 'refreshFile',
            sortIndex: -1,
            caption: 'Refresh',
            bindKey: {
                win: 'Ctrl-R',
                mac: 'Command-Alt-R',
            },
            isAvailable: getDoc,
            exec: function (editor) {
                var mainDoc = getDoc(editor);
                mainDoc.refresh(function (err, refreshed) {
                    if (refreshed) Notify.info('Refreshed');
                });
            },
        },
        {
            icon: 'refresh',
            sortIndex: -1,
            caption: 'Refresh all',
            handle: function () {
                asyncEach(
                    Docs.ids(),
                    function (id, i, next) {
                        try {
                            var doc = getDoc(i);
                            if (!doc) return next();
                            doc.refresh(
                                next,
                                true, //ignoreDirty
                                true, //confirm
                            );
                        } catch (e) {
                            debug.error(e);
                            next();
                        }
                    },
                    null,
                    3,
                );
            },
        },
        {
            name: 'openFile',
            icon: 'open',
            caption: 'Open...',
            bindKey: {
                win: 'Ctrl-O',
                mac: 'Command-O',
            },
            exec: function () {
                require(['../ext/fileview/fileviews'], function (mod) {
                    mod.Fileviews.pickFile(
                        null,
                        require('../core/utils').Utils.noop,
                    );
                });
            },
            showIn: ['editor']
        },
    ];
    Actions.addActions(exports.DocumentCommands, {
        showIn: ['editor', 'actionbar.file'],
    });
});