_Define(function(global) {
    var Docs = global.Docs;
    var Functions = global.Functions;
    var Notify = global.Notify;
    var docs = global.docs;
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Editors = global.Editors;
    var getEditor = global.getEditor;
    var addDoc = global.addDoc;
    var SettingsDoc = global.SettingsDoc;
    var FocusManager = global.FocusManager;
    var State = global.State;
    var appConfig = global.appConfig;
    var DocsTab;
    var currentDoc;
    /*
     * @method switchToDoc
     * Switch to a document
     * @param {String} name Path to the document
     * @param {Object} [pos] Selection start or cursor position
     * @param {Object} [end] Selection end
     * @param {EditSession|String|Boolean|undefined} [autoload] How to handle path not found
     * @param {Function} [callback]
     * @param {FileServer} [server] The server to use in loading the file 
     * @related Docs#openDoc
     * @related FileUtils#getDoc
     */
    Functions.switchToDoc = function(name, pos, end, autoload, cb, server) {
        var doc;
        if (autoload && (typeof autoload == 'object')) {
            //autoload is a session
            doc = Docs.forSession(autoload);
        }
        if (!doc)
            doc = Docs.forPath(name, server) || Docs.forPath("/" + name, server);

        if (!doc) {
            var servers;
            if (server) {
                servers = [server];
            } else {
                servers = [FileUtils.getProject().fileServer];
                if (docs[currentDoc] && docs[currentDoc].getFileServer() != servers[
                        0]) {
                    servers.unshift(docs[currentDoc].getFileServer());
                }
            }
            if (autoload && autoload !== true) {
                if (typeof autoload !== 'string') autoload = autoload.getValue();
                doc = docs[addDoc(null, autoload, name, {
                    data: {
                        fileServer: servers[0].id,
                        encoding: FileUtils.encodingFor(name, servers[0])
                    }
                })];
                doc.setDirty();
                doc.refresh();
            } else {
                if (doc === false) return;
                var getFile = function() {
                    var server = servers.pop();
                    if (!server) return;
                    Docs.openDoc("/" + name, server, open);
                };
                var open = function(err, doc) {
                    if (doc)
                        Functions.switchToDoc(doc.getPath(), pos, end, null, cb);
                    else getFile();
                };
                if (autoload) getFile();
                else Notify.ask("Open " + name, getFile);
                return;
            }
        }
        if (!(global.SplitEditors && global.SplitEditors.hasEditor(doc))) {
            Docs.swapDoc(doc.id);
        } else State.ensure(appConfig.disableBackButtonTabSwitch ? "tabs" : doc.id);
        if (pos) {
            var edit = getEditor();
            edit.exitMultiSelectMode && edit.exitMultiSelectMode();
            edit.getSession().unfold(
                pos); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
            var sel = edit.getSelection();
            if (end) {
                edit.getSession().unfold(
                    end); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
                sel.setSelectionRange({
                    start: pos,
                    end: end
                });
            } else {
                sel.moveCursorToPosition(pos);
            }
            edit.centerSelection();
        }
        cb && cb(doc.session);
    };

    function save(e) { ///TODO
        // Utils.assert(docs[currentDoc],'assert1-'+currentDoc);
        if (docs[currentDoc].isTemp()) {
            FocusManager.hintChangeFocus();
            FileUtils.saveAs(currentDoc);
        } else {
            Docs.saveDocs(currentDoc);
        }
    }

    function setDoc(id) {
        if (docs[id]) {
            currentDoc = id;
            if (docs[id] != Docs.forSession(getEditor().session))
                Editors.setSession(docs[id]);
            return true;
        }
        return false;
    }


    global.DocumentCommands = [{
        name: "newFile",
        bindKey: {
            win: "Ctrl-N",
            mac: "Command-Alt-N"
        },
        exec: Functions.newDoc
    }, {
        name: 'Undo All Changes',
        exec: function() {
            docs[currentDoc].saveCheckpoint('last undo');
            docs[currentDoc].abortChanges();
            Notify.info('Automatic checkpoint added');
        }
    }, {
        name: 'Redo All Changes',
        exec: function() {
            docs[currentDoc].redoChanges();
        }
    }, {
        name: 'Save Checkpoint',
        exec: function(editor, args) {
            doc.$clearRevertStack();

            function save(name) {
                var obj = docs[currentDoc].saveCheckpoint(name);
                if (obj.key) Notify.info('Saved');
                else Notify.info("Could not save checkpoint");
                if (args && args.cb) args.cb(obj.key);
            }
            if (args && args.name) {
                save(args.name);
            } else Notify.prompt('Enter name', save, doc
                .$loadCheckpoints()[0], null, doc
                .$loadCheckpoints().map(function(e) {
                    return e.name;
                }));
        },
    }, {
        name: 'Goto Checkpoint',
        exec: function(editor, args) {
            doc.$clearRevertStack();

            function restore(name) {
                var res = docs[currentDoc].gotoCheckpoint(name);
                if (args && args.cb) args.cb(res);
            }
            var warning = "";
            if (!doc.stateID)
                Notify.warn("Current state not saved");
            if (args && args.name) {
                restore(name);
            } else Notify.prompt('Enter name', restore, doc
                .$loadCheckpoints()[0], doc
                .$loadCheckpoints().map(function(e) {
                    return e.name;
                }));
        }
    }, {
        name: 'Toggle Checkpoint',
        exec: function() {
            var name = "auto-checkpoint-";
            var lastBlob = doc.stateID == "cp-" + name + 1 || Docs.hasBlob(
                currentDoc, "cp-" + name + 1) ? 1 : 2;
            docs[currentDoc].saveCheckpoint(name + (3 - lastBlob));
            docs[currentDoc].gotoCheckpoint(name + lastBlob);
            docs[currentDoc].deleteCheckpoint(name + lastBlob);
        }
    }, {
        name: 'Goto Checkpoint and Delete',
        exec: function(editor, args) {
            doc.$clearRevertStack();

            function restore(name) {
                var res = docs[currentDoc].gotoCheckpoint(name);
                docs[currentDoc].deleteCheckpoint(name);
                if (args && args.cb) args.cb(res);
            }
            var warning = "";
            if (args && args.name) {
                restore(name);
            } else {
                if (!doc.stateID)
                    Notify.warn("Current state not saved");
                Notify.prompt('Enter name', restore, "checkpoint", doc
                    .$loadCheckpoints().map(function(e) {
                        return e.name;
                    }));
            }
        }
    }, {
        name: 'Delete Checkpoint',
        exec: function(editor, args) {
            doc.$clearRevertStack();

            function restore(name) {
                docs[currentDoc].deleteCheckpoint(name);
                if (args && args.cb) args.cb(res);
            }
            var warning = "";
            if (args && args.name) {
                restore(name);
            } else Notify.prompt('Enter name', restore, docs[currentDoc]
                .stateID, doc.$loadCheckpoints().map(function(e) {
                    return e.name;
                }));
        }
    }, {
        name: 'Return from Checkpoint',
        bindKey: 'Ctrl-Alt-J',
        exec: function() {
            docs[currentDoc].returnFromCheckpoint();
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
        exec: function(editor) {
            FileUtils.saveAs(currentDoc);
        }
    }];

    //Overflow menu
    var menuItems = {
        "save": {
            icon: "save",
            caption: "Save",
            close: true,
            sortIndex: 1,
            onclick: function() {
                save();
            }
        },
        "refresh": {
            icon: "refresh",
            sortIndex: 10,
            caption: "Refresh file",
            close: true,
            onclick: function() {
                docs[currentDoc].refresh(function(doc) {
                    if (doc && !doc.dirty)
                        Notify.info('refreshed');
                });
            }
        },
        "find": {
            icon: "search",
            sortIndex: 9,
            caption: "Find",
            childHier: {
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
                "find-refs": {
                    caption: "Find References",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.smartCompleter;
                        completer = editor[completer.name] || completer;
                        if(completer.findRefs){
                            completer.findRefs(editor);
                        }
                    }
                },
                "rename": {
                    caption: "Rename Variable",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.smartCompleter;
                        completer = editor[completer.name] || completer;
                        if(completer.rename){
                            completer.rename(editor);
                        }
                    }
                }, "jumpToDef": {
                    caption: "Jump To Definition",
                    close: true,
                    onclick: function() {
                        var editor = getEditor();
                        var completer = editor.smartCompleter;
                        completer = editor[completer.name] || completer;
                        if(completer.jumpToDef){
                            completer.jumpToDef(editor);
                        }
                    }
                }

            }
        },
        "format":{
            caption: "Format",
            icon: "edit",
            close: true,
            onclick: function() {
                getEditor().execCommand('beautify');
            }
        }
    };
    var menu = global.MainMenu;
    for (var i in menuItems) {
        menu.addOption(i, menuItems[i]);
    }
    menu.addOption(
        "console",{
            caption: "Show Console",
            icon: "bug_report",
            close: true,
            sortIndex: 1000,
            onclick: function() {
                eruda._entryBtn.show();
                eruda._devTools.toggle();
            }
        },true);
    Editors.addCommands(global.DocumentCommands);
    global.getActiveDoc = function() {
        return docs[currentDoc];
    };
    global.setDoc = setDoc;
}) /*_EndDefine*/ ;