_Define(function(global) {
    var Docs = global.Docs;
    var Notify = global.Notify;
    var FileUtils = global.FileUtils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var addDoc = global.addDoc;
    var FocusManager = global.FocusManager;
    var AppEvents = global.AppEvents;
    var activeDoc;

    function updateActiveDoc() {
        var doc = Docs.forSession(getEditor().session);
        if (doc !== activeDoc) {
            var oldDoc = activeDoc;
            activeDoc = doc;
            AppEvents.trigger('changeDoc', {
                doc: activeDoc,
                oldDoc: oldDoc
            });
        }
    }
    AppEvents.on('changeEditor', function(e) {
        if (!e.editor.$updateActiveDoc) {
            e.editor.on('changeSession', updateActiveDoc);
        }
        updateActiveDoc();
    });
    var getActiveDoc = function() {
        return activeDoc;
    };

    function save() { ///TODO
        // Utils.assert(mainDoc,'assert1-'+currentDoc);
        var mainDoc = getActiveDoc();
        if (mainDoc) {
            if (mainDoc.isTemp()) {
                FocusManager.hintChangeFocus();
                FileUtils.saveAs(mainDoc.id);
            } else {
                Docs.saveDocs(mainDoc.id);
            }
        }
    }

    function doCopy() {
        var editor = getEditor();
        editor.once("copy", function(e) {
            global.clipboard.set(e.text);
        });
        editor.getCopyText();
    }
    global.DocumentCommands = [{
        name: "refreshFile",
        bindKey: {
            win: "Ctrl-R",
            mac: "Command-Alt-R"
        },
        exec: function() {
            var mainDoc = getActiveDoc();
            mainDoc && mainDoc.refresh();
        }
    }, {
        name: "openFile",
        bindKey: {
            win: "Ctrl-O",
            mac: "Command-O"
        },
        exec: function() {
            FileUtils.pickFile(null, global.Utils.noop);
        }
    }, {
        name: "newFile",
        bindKey: {
            win: "Ctrl-N",
            mac: "Command-Alt-N"
        },
        exec: function newDoc(editor) {
            return addDoc("unsaved*", "", {
                mode: editor ? editor.getOption('mode') : null
            });
        }
    }, {
        name: 'Undo All Changes',
        isAvailable: getActiveDoc,
        exec: function() {
            var mainDoc = getActiveDoc();
            if (mainDoc) {
                if (mainDoc.saveCheckpoint('last undo')) {
                    Notify.info('Added checkpoint automatically');
                } else Notify.error('Unable to add checkpoint');
                mainDoc.abortChanges();
            }
        }
    }, {
        name: 'Redo All Changes',
        isAvailable: getActiveDoc,
        exec: function() {
            var mainDoc = getActiveDoc();
            if (mainDoc) mainDoc.redoChanges();
        }
    }, {
        name: 'Save Current State',
        exec: function(editor, args) {
            var mainDoc = getActiveDoc();
            if (!mainDoc) return;
            mainDoc.$clearRevertStack();

            function save(name) {
                var obj = mainDoc.saveCheckpoint(name);
                if (obj) Notify.info('Saved');
                else Notify.info("Could not save checkpoint");
                if (args && args.cb) args.cb(obj && obj.key);
            }
            if (args && args.name) {
                save(args.name);
            } else Notify.prompt('Enter name', save, (mainDoc
                    .$loadCheckpoints()[0] || {}).name, null, mainDoc
                .$loadCheckpoints().map(function(e) {
                    return e.name;
                }));
        },
    }, {
        name: 'Go to Saved State',
        exec: function(editor, args) {
            var doc = getActiveDoc();
            doc.$clearRevertStack();
            if (doc
                .$loadCheckpoints().length < 1) return Notify.info(
                'No states saved for this file');

            function restore(name) {
                var res = doc.gotoCheckpoint(name);
                if (args && args.cb) args.cb(res);
            }
            if (!doc.stateID)
                Notify.warn("Current state not saved");
            if (args && args.name) {
                restore(name);
            } else Notify.pick('Select checkpoint', doc
                .$loadCheckpoints().map(function(e) {
                    return e.name;
                }), restore);
        }
    }, {
        name: 'Delete State',
        exec: function(editor, args) {
            var doc = getActiveDoc();
            if (!doc) return;
            doc.$clearRevertStack();
            if (doc
                .$loadCheckpoints().length < 1) return Notify.info('No states saved for this file');

            function restore(name) {
                doc.deleteCheckpoint(name);
                if (args && args.cb) args.cb();
            }
            if (args && args.name) {
                restore(name);
            } else Notify.pick('Select state', doc
                .$loadCheckpoints().map(function(e) {
                    return e.name;
                }), restore);
        }
    }, {
        name: 'Return from Checkpoint',
        bindKey: 'Ctrl-Alt-J',
        exec: function() {
            getActiveDoc().returnFromCheckpoint();
        }
    }, {
        name: "save",
        bindKey: {
            win: "Ctrl-S",
            mac: "Command-S"
        },
        exec: save
    }, {
        name: "saveAs",
        bindKey: {
            win: "Ctrl-Shift-S",
            mac: "Command-Shift-S"
        },
        exec: function() {
            var doc = getActiveDoc();
            if (doc) {
                FileUtils.saveAs(doc.id);
            }
        }
    }];

    //Dropdown menu
    var menuItems = {
        "!update": [function(self, update) {
            var doc = getActiveDoc();
            update('save', doc ? self["!save"] : null);
        }],
        "!save": {
            icon: "save",
            caption: "Save",
            close: true,
            sortIndex: 1,
            onclick: function() {
                save();
            }
        },
        "file": {
            caption: "File",
            sortIndex: 2,
            icon: "insert_drive_file",
            subTree: {
                "!update": [function(self, update) {
                    var doc = getActiveDoc();
                    update('refresh', doc ? self["!refresh"] : null);
                    update('refresh-all', doc ? self["!refresh-all"] : null);
                }],
                "!refresh": {
                    icon: "refresh",
                    caption: "Refresh",
                    close: true,
                    onclick: function() {
                        var doc = global.getActiveDoc();
                        doc && doc.refresh(function(doc) {
                            if (doc && !doc.dirty)
                                Notify.info('Refreshed');
                        });
                    }
                },
                "!refresh-all": {
                    icon: "refresh",
                    caption: "Refresh All",
                    close: true,
                    onclick: function() {
                        var docs = global.docs;
                        global.Utils.asyncForEach(Object.keys(docs), function(doc, i, next) {
                            if (docs[doc]) docs[doc].refresh(next);
                            else next();
                        }, function() {
                            Notify.info('Refreshed');
                        }, 3);
                    }
                }
            }
        },
        "Jump to": {
            icon: "call_made",
            caption: "Navigation",
            subTree: {
                "find-in-file": {
                    caption: "Find in File",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("find");
                    }
                },
                "goto-file": {
                    caption: "Goto Line",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand("gotoline");
                    }
                },
                "next-error": {
                    caption: "Goto Next Error",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('goToNextError');
                    }
                },
                "find-refs": {
                    caption: "Find References",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.getMainCompleter();
                        if (completer.findRefs) {
                            completer.findRefs(editor);
                        }
                    }
                },
                "jumpToDef": {
                    caption: "Jump To Definition",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.getMainCompleter();
                        if (completer.jumpToDef) {
                            completer.jumpToDef(editor);
                        }
                    }
                }

            }
        },
        "edit": {
            icon: "edit",
            caption: "Edit",
            subTree: {
                "undo": {
                    icon: "undo",
                    caption: "Undo",
                    close: false,
                    onclick: function() {
                        getEditor().execCommand('undo');
                    }
                },
                "redo": {
                    caption: "Redo",
                    icon: "redo",
                    close: false,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('redo');
                    }
                },
                "increase-indent": {
                    caption: "Increase Indent",
                    icon: "format_indent_increase",
                    close: false,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('indent');
                    },
                },
                "decrease-indent": {
                    caption: "Decrease Indent",
                    icon: "format_indent_decrease",
                    close: false,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('outdent');
                    }
                },
                "rename": {
                    icon: "find_replace",
                    caption: "Rename Variable",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.getMainCompleter();
                        if (completer.rename) {
                            completer.rename(editor);
                        }
                    }
                },
                "format": {
                    caption: "Format",
                    icon: "format_align_justify",
                    close: true,
                    onclick: function() {
                        getEditor().execCommand('beautify');
                    }
                },
                "paste": {
                    caption: "Paste",
                    icon: "content_paste",
                    close: true,
                    onclick: function() {
                        global.clipboard.get(0, function(text) {
                            getEditor().execCommand("paste", text);
                        });
                    }
                },
                "copy": {
                    caption: "Copy",
                    icon: "content_copy",
                    onclick: doCopy
                },
                "cut": {
                    caption: "Cut",
                    icon: "content_cut",
                    onclick: function doCut() {
                        var editor = getEditor();
                        doCopy();
                        editor.execCommand("cut");
                    }
                }
            }
        }
    };

    var menu = global.MainMenu;
    for (var i in menuItems) {
        menu.addOption(i, menuItems[i]);
    }
    menu.addOption(
        "state-5", {
            caption: "State",
            icon: "bookmark",
            subTree: {
                "save-state": {
                    icon: "bookmark_border",
                    caption: "Save state",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('Save Current State');
                    }
                },
                "restore-state": {
                    icon: "restore_page",
                    caption: "Restore state",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        editor.execCommand('Go to Saved State');
                    }
                }
            }
        }, true);

    Editors.addCommands(global.DocumentCommands);
    global.getActiveDoc = getActiveDoc;
}) /*_EndDefine*/ ;