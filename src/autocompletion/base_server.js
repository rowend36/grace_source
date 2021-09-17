_Define(function(global) {
    var UI = global.LspUI;
    var debugCompletions = false;
    var config = global.registerAll({
        "jumpToDef": "Alt-.",
        "rename": "Ctrl-Shift-E",
        "findRefs": "Ctrl-E",
        "markPosition": "Alt-M",
        "showType": "Ctrl-I",
        "refresh": 'Alt-R',
        "jumpBack": "Alt-,"
    }, "keyBindings.intellisense");
    var Utils = global.Utils;
    var getEditor = global.getEditor;
    var rebind = Utils.debounce(function() {
        var editor = global.getEditor();
        var ts = editor.getMainCompleter();
        if (ts.unbindAceKeys) {
            ts.unbindAceKeys(editor);
            for (var i in ts.aceCommands) {
                ts.aceCommands[i].bindKey = config[i];
            }
            ts.bindAceKeys(editor);
        }
    }, 30);
    var IsKey = global.Schema.IsKey;
    global.ConfigEvents.on("keyBindings.intellisense", function(ev) {
        var key = ev.newValue;
        if (IsKey.invalid(key)) {
            rebind();
        } else {
            global.Notify.info('Bad Key string for ' + ev.config);
            ev.preventDefault();
        }
    });
    /**@constructor*/
    function BaseServer(options, iconClass) {
        this.docs = Object.create(null);
        this.options = options || {};
        this.ui = this.options.ui || new UI(null, iconClass);
        if (!this.options.hasOwnProperty('switchToDoc')) this.options.switchToDoc = function(name, start) {
            console.log(
                'tern.switchToDoc called but not defined (need to specify this in options to enable jumping between documents). name=' +
                name + '; start=', start);
        };
        this.onDestroy = this.onDestroy.bind(this);
        this.trackChange = this.trackChange.bind(this);
    }
    //properties if accurate
    BaseServer.PRIORITY_HIGH = 2000;
    //functions, close vars,
    BaseServer.PRIORITY_MEDIUM = 400;
    //garbage
    BaseServer.PRIORITY_LOW = 200;
    BaseServer.prototype = {
        aceCommands: null,
        maxSize: 1000000,
        sendDoc: null,
        requestDefinition: null,
        findRefs: null,
        normalizeName: null,
        removeDoc: null,
        requestType: null,
        cachedArgHints: null,
        bindAceKeys: function(editor) {
            var aceCommands = this.aceCommands;
            for (var p in aceCommands) {
                var obj = aceCommands[p];
                editor.commands.addCommand(obj);
            }
        },
        unbindAceKeys: function(editor) {
            var aceCommands = this.aceCommands;
            for (var p in aceCommands) {
                var obj = aceCommands[p];
                editor.commands.removeCommand(obj);
            }
        },
        rename: function(editor) {
            var ts = this;
            this.findRefs(editor, function(r) {
                if (!r || r.refs.length === 0) {
                    ts.ui.showError(editor,
                        "Cannot rename as no references were found for this variable");
                    return;
                }
                ts.ui.renameDialog(ts, editor, r);
            });
        },
        jumpBack: function(editor) {
            if (editor.jumpStack) {
                var pos = editor.jumpStack.pop();
                if (pos) {
                    //In case, this client did not put it there
                    pos.file = this.normalizeName(pos.file);
                    this.goto(editor, pos, null, true);
                }
            }
        },
        markPos: function(editor) {
            var doc = getDoc(this, editor.session);
            if (!editor.jumpStack) editor.jumpStack = [];
            editor.jumpStack.push({
                file: doc.name,
                start: editor.getSelectionRange().start,
                end: editor.getSelectionRange().end
            });
        },
        currentJumpList: null,
        lastJumpPosition: null,
        jumpToDef: function(editor) {
            var ts = this;
            if (ts.currentJumpList) {
                var lastJump = ts.lastJumpPosition;
                var currentPos = editor.getSelectionRange();
                if (lastJump && Math.abs(lastJump.compareRange(currentPos)) < 2) {
                    var index = ts.currentJumpList.indexOf(lastJump.data) + 1;
                    if (index > 0) {
                        if (index == ts.currentJumpList.length) {
                            index = 0; //continue reusing jumpList in case sorting has changed
                        }
                        ts.markPos(editor);
                        ts.goto(editor, ts.currentJumpList[index]);
                        return;
                    }
                }
                ts.currentJumpList = null;
            }
            this.requestDefinition(editor, function(pos) {
                console.log(pos);
                ts.markPos(editor);
                if (Array.isArray(pos)) {
                    if (pos.length < 1) return;
                    ts.currentJumpList = pos;
                    pos = pos[0];
                }
                ts.goto(editor, pos);
            });
        },
        getChanges: function(doc) {
            var changes = doc.changes;
            doc.changes = null;
            doc.changed = null;
            return changes;
        },
        onDestroy: function(session) {
            var doc = this.findDoc(session);
            if (doc)
                this.closeDoc(doc.name);
        },
        invalidateDoc: function(doc) {
            if (doc) {
                doc.changed = true;
                doc.changes = null;
            }
        },
        trackChange: function(change, session) {
            if (change.action === "remove" || change.action == "insert") {
                var data = getDoc(this, session);
                if (data.changes) {
                    data.changes.push(change);
                    if (data.changes.length > session.getLength()) {
                        this.invalidateDoc(data);
                    }
                } else if (!data.changed) {
                    data.changed = true;
                    data.changes = [change];
                }
            }
            var argHints = this.cachedArgHints;
            if (argHints && argHints.doc == session && cmpPos(argHints.start, change.end) <= 0) {
                this.cachedArgHints = null;
            }
        },
        addDoc: function(name, session_or_text, preferSession) {
            name = this.normalizeName(name);
            var data = {
                doc: session_or_text,
                name: name,
                changed: null
            };
            if (this.docs[name]) {
                if (this.docs[name].doc.getLine && !session_or_text.getLine) {
                    if (preferSession !== false) return this.docs[name];
                }
                this.closeDoc(name);
            }
            if (session_or_text.constructor.name !== 'String') {
                if (session_or_text.getValue().length > this.maxSize) {
                    data.fragOnly = true;
                } else {
                    session_or_text.on("change", this.trackChange);
                }
                session_or_text.on("destroy", this.onDestroy);
            } else if (session_or_text.length > this.maxSize) data.doc = "";
            //for now we handle large docs by not loading them
            if (!data.fragOnly) this.sendDoc(data);
            return (this.docs[name] = data);
        },
        triggerUpdateAnnotations: function() {
            var editor = getEditor();
            var docId = editor.session.id;
            this.updateAnnotations(editor, function(res) {
                editor.$errorsProvider.update(docId, res);
            });
        },
        refreshDoc: function(editor, full) {
            if (full) {
                this.docChanged(editor);
                this.ui.showInfo(editor, 'Fully refreshed (reloaded current doc and all refs)');
                return;
            }
            var doc = getDoc(this, editor.session);
            //for now we handle large docs by not loading them
            if (doc.fragOnly) return this.ui.showError(editor, 'Document Too Large');
            this.sendDoc(doc);
            this.ui.showInfo(editor, 'Document refreshed');
        },
        getCallPos: function(editor, pos) {
            return getCallPos(editor, pos);
        },
        goto: function(editor, data, cb, keepTips, ignoreClosed) {
            var doc = getDoc(this, editor.session);
            var localDoc = this.docs[data.file];
            if (ignoreClosed && (!localDoc || typeof(localDoc.doc) == 'string')) return cb && cb();
            moveTo(this, editor, doc, (localDoc && localDoc.doc.getLine) ? localDoc : {
                name: data.file,
                doc: localDoc && localDoc.doc //optional if we want to use document res
            }, data, keepTips);
            if (cb) setTimeout(cb, localDoc ? 300 : 100);
        },
        delDoc: function(name) {
            name = this.normalizeName(name);
            var found = this.docs[name];
            if (!found) return;
            this.closeDoc(name);
            delete this.docs[name];
            this.removeDoc(name);
        },
        closeDoc: function(name) {
            name = this.normalizeName(name);
            if (this.docs[name].doc.constructor.name != 'String') {
                this.docs[name].doc.off("change", this.trackChange);
                this.docs[name].doc.off("destroy", this.onDestroy);
                this.docs[name].changed = true;
            }
            this.docs[name] = {
                doc: "",
                name: name
            };
        },
        hasDoc: function(name_or_session) {
            if (typeof name_or_session == 'string') {
                return this.docs[this.normalizeName(name_or_session)];
            } else return findDoc(this, name_or_session);
        },
        docChanged: function(editor) {
            var session = editor.session;
            var oldDoc = findDoc(this, session);
            for (var p in this.docs) {
                this.delDoc(p);
            }
            getDoc(this, session, oldDoc && oldDoc.name);
        },
        updateArgHints: function(editor) {
            showHoverTooltip(this, editor);
        },
        requestRename: function(editor, newName, cb, refs) {
            //load all referenced documents into the editor
            var i = 0,
                doc;
            var ts = this;
            var load = function() {
                if (i == refs.length) return cb(null, refs);
                var ref = refs[i++];
                var file = ref.file;
                doc = ts.docs[file];
                //File might be deleted or renamed
                if (!doc) return load();
                if (typeof doc.doc == 'string') {
                    return ts.options.switchToDoc(file, null, null, doc.doc, function() {
                        if (doc.name != getDoc(ts, editor.session).name) return cb(
                            'SwitchToDoc internal error: expected current document to be - ' +
                            doc.name);
                        else load();
                    });
                } else {
                    load();
                }
            };
            load();
        },
        showType: function(editor, pos, calledFromCursorActivity) {
            if (calledFromCursorActivity) {
                if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) return;
            }
            var ts = this;
            if (ts.cachedArgHints && ts.cachedArgHints.isClosed) ts.cachedArgHints.isClosed = false;
            var cb = function(error, data) {
                if (error) {
                    if (calledFromCursorActivity) {
                        return;
                    }
                    return ts.ui.showError(editor, error);
                }
                if (!data) return;
                var tip = ts.genInfoHtml(data, false, calledFromCursorActivity);
                ts.ui.closeAllTips();
                ts.ui.makeTooltip(null, null, tip, editor, true);
            };
            try {
                this.requestType(editor, pos, cb, calledFromCursorActivity);
            } catch (e) {
                console.error(e);
            }
        },
        executeRename: function(editor, newName, r) {
            var self = this;
            this.requestRename(editor, newName, function(error, changes) {
                if (error) return self.ui.showError(editor, error);
                applyChanges(self, changes, newName, function(result) {
                    //ts.ui.refsTooltip(editor,result)
                    var infoMsg = "Replaced " + result.replaced +
                        " references sucessfully";
                    var errorMsg = "";
                    if (result.replaced != r.refs.length) {
                        errorMsg = " WARNING! original refs: " + r.refs.length +
                            ", replaced refs: " + result.replaced;
                    }
                    if (result.errors !== "") {
                        errorMsg += " \n Errors encountered:" + result.errors;
                    }
                    if (errorMsg !== "") {
                        self.ui.showError(editor, errorMsg);
                    } else {
                        self.ui.showInfo(editor, infoMsg);
                    }
                });
            }, r);
        },
        genInfoHtml: function(doc /*, fromCompletion, fromCursorActivity*/ ) {
            var createToken = this.ui.createToken.bind(this.ui);
            var html = [];
            for (var i in doc.displayParts) {
                html.push(createToken(doc.displayParts[i]));
            }
            for (var j in doc.documentation) {
                html.push("<div>" + doc.documentation[j].text + "</div>");
            }
            return html.join("");
        },
        genArgHintHtml: function(args, argpos) {
            var createToken = this.ui.createToken.bind(this.ui);
            var doc = args.items[args.selectedItemIndex];
            var html = [];
            for (var i in doc.prefixDisplayParts) {
                html.push(createToken(doc.prefixDisplayParts[i]));
            }
            for (var j = 0; j < doc.parameters.length; j++) {
                for (var m = 0; m < doc.parameters[j].displayParts.length; m++) {
                    html.push(createToken(doc.parameters[j].displayParts[m], j == argpos ? "active" :
                        null));
                }
                if (j < doc.parameters.length - 1)
                    for (var k in doc.separatorDisplayParts) {
                        html.push(createToken(doc.separatorDisplayParts[k]));
                    }
            }
            for (var l in doc.suffixDisplayParts) {
                html.push(createToken(doc.suffixDisplayParts[l]));
            }
            /*
            Show in infotooltip instead
            html.push(doc.documentation.map(function(e) {
                return e[e.kind]
            }).join("</br>"));*/
            if (doc.tags[argpos]) {
                html.push("<div>");
                var e = doc.tags[argpos];
                html.push("</br>" + createToken({
                    kind: "paramName",
                    text: e.name
                }) + ":" + createToken({
                    kind: "paramDoc",
                    text: e.text
                }));
                html.push("</div>");
            }
            return html.join("");
        }
    };
    var debounce_updateArgHints = null;

    function showHoverTooltip(ts, editor) {
        clearTimeout(debounce_updateArgHints);
        if (editor.completer && editor.completer.activated) {
            return ts.ui.closeAllTips();
        }
        if (ts.functionHintTrigger) {
            var trigger = ts.functionHintTrigger;
            var cursor = editor.getSelectionRange().start;
            var token = editor.session.getTokenAt(cursor);
            if (token && /string|comment/.test(token.type)) {
                return ts.ui.closeArgHints(ts);
            }
            token = editor.session.getTextRange({
                start: cursor,
                end: {
                    row: cursor.row + 1,
                    column: cursor.column
                }
            });
            //get character next to cursor ignore space
            var b = token.replace(/^\s+/, "")[0];
            if (!b || trigger.indexOf(b) < 0) {
                token = editor.session.getTextRange({
                    end: cursor,
                    start: {
                        row: cursor.row - 1,
                        column: cursor.column
                    }
                });
                b = token.replace(/\s+$/, "");
                if (!b || trigger.indexOf(b.substring(b.length - 1)) < 0)
                    return ts.ui.closeArgHints(ts);
            }
        }
        var callPos = ts.getCallPos(editor);
        if (!callPos) {
            return ts.ui.closeArgHints(ts);
        }
        var start = callPos.start;
        var argpos = callPos.argpos;
        var cache = ts.cachedArgHints;
        if (cache && cache.doc == editor.session && cmpPos(start, cache.start) === 0 && cache.name == callPos
            .name) {
            return ts.ui.showArgHints(ts, editor, argpos);
        } else ts.ui.closeArgHints(ts);
        debounce_updateArgHints = setTimeout(inner, 500);

        function inner() {
            if (debugCompletions) {
                console.time('get definition');
            }
            ts.requestArgHints(editor, start, function(cache) {
                ts.cachedArgHints = cache;
                //warning race situation
                cache.doc = cache.doc || editor.session;
                cache.start = cache.start || callPos.start;
                cache.name = cache.name || callPos.name;
                ts.ui.showArgHints(ts, editor, argpos);
                if (debugCompletions) console.timeEnd('get definition');
            });
        }
    }

    // function resolveFilePath(ts, path, cb) {
    //     if (ts.options.resolveFilePath) {
    //         ts.options.resolveFilePath(path, cb);
    //     } else {
    //         cb(path); //return original name
    //     }
    // }
    function findDoc(ts, session) {
        for (var n in ts.docs) {
            var cur = ts.docs[n];
            if (cur.doc === session) return cur;
        }
        return null;
    }


    function getDoc(ts, session, name) {
        var doc = findDoc(ts, session);
        if (doc) return doc;
        if (!name)
            if (ts.options.getFileName) {
                name = ts.options.getFileName(session);
            }
        var n;
        if (!name) {
            for (var i = 0;; ++i) {
                n = "[doc" + (i || "") + "]"; //name not passed for new doc, so auto generate it
                if (!ts.docs[n]) {
                    name = n;
                    break;
                }
            }
        }
        return ts.addDoc(name, session);
    }

    function getCallPos(editor, pos) {
        if (somethingIsSelected(editor)) return;
        if (!pos) pos = editor.getSelectionRange().start;
        var iterator = new global.TokenIterator(editor.session, pos.row, pos.column);
        var timeOut = new Date().getTime() + 1000;
        var token = iterator.getCurrentToken();
        if (!token) return;
        //todo detect boundaries from syntax
        var maxLine = pos.row - 20;
        var start, numCommas = 0,
            depth = 0;
        var end = iterator.getCurrentTokenPosition();
        if (end.row == pos.row && end.column + token.value.length > pos.column) {
            token = {
                type: token.type,
                value: token.value.substring(0, pos.column - end.column)
            };
        }
        var type;

        function is(o) {
            return type.indexOf("." + o + ".") > -1;
        }
        var a = 0;

        function time() {
            if (++a % 10) {
                var t = new Date().getTime();
                if (t > timeOut) throw new Error("Timed Out getting call pos");
            }
            return true;
        }
        while (token && iterator.getCurrentTokenRow() > maxLine && time()) {
            type = "." + token.type + ".";
            if (is('string') || is('comment')) {
                token = iterator.stepBackward();
                continue;
            }
            for (var i = token.value.length - 1; i >= 0; i--) {
                var ch = token.value[i];
                if (ch === '}' || ch === ')' || ch === ']') {
                    depth += 1;
                } else if (ch === '{' || ch === '(' || ch === '[') {
                    if (depth > 0) {
                        depth -= 1;
                    } else if (ch === '(') {
                        var name;
                        do {
                            name = iterator.stepBackward();
                        } while (name && /^\s+$/.test(name.value));
                        type = name && "." + name.type + ".";
                        //test only works in jscript
                        if (type && !(is('entity') || is('storage') || is('type'))) {
                            start = iterator.getCurrentTokenPosition();
                            if (start) return {
                                name: name.value,
                                start: start,
                                argpos: numCommas
                            };
                        }
                        return;
                    } else {
                        return;
                    }
                } else if (depth === 0) {
                    if (token.value[i] == ',') numCommas++;
                }
            }
            token = iterator.stepBackward();
        }
        return null;
    }

    function docValue(ts, doc) {
        if (!doc.doc.getLines) return doc.doc;
        var val = doc.doc.getValue();
        if (ts.options.fileFilter) val = ts.options.fileFilter(val, doc.name, doc.doc);
        return val;
    }

    function somethingIsSelected(editor) {
        return editor.getSession().getTextRange(editor.getSelectionRange()) !== '';
    }

    function moveTo(ts, editor, curDoc, doc, pos, doNotCloseTips) {
        if (curDoc != doc) {
            if (ts.options.switchToDoc) {
                if (!doNotCloseTips) {
                    ts.ui.closeAllTips();
                }
                //hack for tern relative paths till we fix it
                ts.options.switchToDoc(('/' + doc.name).replace("//", "/"), null, null, doc.doc,
                    function( /*session*/ ) {
                        setSelection(ts, editor, pos);
                    });
            } else {
                ts.ui.showError(editor,
                    'Need to add editor.ternClient.options.switchToDoc to jump to another document');
            }
            return;
        }
        setSelection(ts, editor, pos);
    }
    //Handles the multiple data formats
    //span: {start: number,length: number}
    //pos: {row: number,column:number}
    //range: {start:pos,end:pos}
    //excommandlist: {address:[{re:re,needle:needle,backwards:boolean}]}//search options|line number
    function setSelection(ts, editor, pos) {
        var start, end, address;
        if (pos.hasOwnProperty('row')) {
            start = pos;
            end = pos;
        } else if (pos.hasOwnProperty('end')) {
            start = pos.start;
            end = pos.end;
        } else if (pos.span) {
            var doc = editor.getSession().getDocument();
            start = doc.indexToPosition(pos.span.start);
            end = doc.indexToPosition(pos.span.start + pos.span.length);
        } else if (pos.address) {
            address = pos.address;
            address.forEach(function(e) {
                console.log(e);
                if (typeof e == 'number') {
                    editor.gotoLine(e);
                } else editor.find(e);
            });
        }
        if (start) {
            editor.gotoLine(start.row, start.column || 0); //this will make sure that the line is expanded
            editor.session.unfold(
                start
            ); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
            var sel = editor.session.getSelection();
            sel.setSelectionRange({
                start: start,
                end: end
            });
        }
        ts.lastJumpPosition = editor.getSelectionRange();
        ts.lastJumpPosition.data = pos;
        if (ts.lastJumpPosition.isEmpty()) {
            var wordRange = editor.selection.getWordRange();
            ts.lastJumpPosition.extend(wordRange.start.row, wordRange.start.column);
            ts.lastJumpPosition.extend(wordRange.end.row, wordRange.end.column);
        }
    }

    function isOnFunctionCall(editor) {
        //if (!inJavascriptMode(editor)) return false;
        if (somethingIsSelected(editor)) return false;
        if (isInCall(editor)) return false;
        var tok = getCurrentToken(editor);
        if (!tok) return; //No token at current location
        if (!tok.start)
            return; //sometimes this is missing... not sure why but makes it impossible to do what we want
        if (tok.type.indexOf('entity.name.function') !== -1) return false; //function definition
        if (tok.type.indexOf('storage.type') !== -1)
            return false; // could be 'function', which is start of an anon fn
        var nextTok = editor.session.getTokenAt(editor.getSelectionRange().end.row, (tok.start + tok.value
            .length + 1));
        if (!nextTok || nextTok.value !== "(") return false;
        return true;
    }

    function isInCall(editor, pos) {
        var callPos = getCallPos(editor, pos);
        if (callPos) {
            return true;
        }
        return false;
    }

    function getCurrentToken(editor) {
        try {
            var pos = editor.getSelectionRange().end;
            return editor.session.getTokenAt(pos.row, pos.column);
        } catch (ex) {
            return null;
        }
    }

    function applyChanges(ts, changes, text, cb) {
        var perFile = Object.create(null);
        for (var i = 0; i < changes.length; ++i) {
            var ch = changes[i];
            (perFile[ch.file] || (perFile[ch.file] = [])).push(ch);
        }
        var result = {
            replaced: 0,
            status: "",
            errors: ""
        };

        function compareRange(a, b) {
            return cmpPos(b.start, a.start);
        }
        for (var file in perFile) {
            var known = ts.docs[file],
                chs = perFile[file];
            if (!known) continue;
            chs.sort(compareRange);
            for (var i2 = 0; i2 < chs.length; ++i2) {
                try {
                    var ch2 = chs[i2];
                    known.doc.replace(ch2, ch2.text || text);
                    result.replaced++;
                } catch (ex) {
                    result.errors += '\n ' + file + ' - ' + ex.toString();
                    console.log('error applying rename changes', ex);
                }
            }
        }
        if (typeof cb === "function") {
            cb(result);
        }
    }

    function cmpPos(a, b) {
        return a.row - b.row || a.column - b.column;
    }

    function createCommands(proto, prefix) {
        var commands = {};
        prefix = prefix || "";
        var name = proto.name;
        commands.markPosition = {
            name: prefix + "MarkPosition",
            exec: function(editor) {
                editor[name].markPos(editor);
            },
            bindKey: config.markPosition
        };
        commands.jumpBack = {
            name: prefix + "JumpBack",
            exec: function(editor) {
                editor[name].jumpBack(editor);
            },
            bindKey: config.jumpBack
        };
        if (proto.requestDefinition) commands.jumpToDef = {
            name: prefix + "JumpToDef",
            exec: function(editor) {
                editor[name].jumpToDef(editor);
            },
            bindKey: config.jumpToDef
        };
        if (proto.showType) commands.showType = {
            name: prefix + "ShowType",
            exec: function(editor) {
                editor[name].showType(editor);
            },
            bindKey: config.showType
        };
        if (proto.findRefs) commands.findRefs = {
            name: prefix + "FindRefs",
            exec: function(editor) {
                editor[name].findRefs(editor);
            },
            bindKey: config.findRefs
        };
        if (proto.rename) commands.rename = {
            name: prefix + "Rename",
            exec: function(editor) {
                editor[name].rename(editor);
            },
            bindKey: config.rename
        };
        if (proto.refresh) commands.refresh = {
            name: prefix + "Refresh",
            exec: function(editor) {
                var full = false;
                if (editor[name].refreshDocLastCalled != null) {
                    if (new Date().getTime() - editor.tsClient.refreshDocLastCalled <
                        1000) { //less than 1 second
                        full = true;
                    }
                }
                editor[name].refreshDocLastCalled = new Date().getTime();
                editor[name].refreshDoc(editor, full);
            },
            bindKey: config.refresh
        };
        var noConf = {};
        //hide them from normal keybindings since they change depending on client
        for (var i in commands) {
            noConf[commands[i].name] = "no-user-config";
        }
        global.registerValues(noConf, "keyBindings");
        proto.aceCommands = commands;
        return commands;
    }

    var ServerUtils = {
        cmpPos: cmpPos,
        getDoc: getDoc,
        isOnFunctionCall: isOnFunctionCall,
        getCallPos: getCallPos,
        docValue: docValue,
        somethingIsSelected: somethingIsSelected,
        moveTo: moveTo,
        getCurrentToken: getCurrentToken,
        createCommands: createCommands,
    };
    global.BaseServer = BaseServer;
    global.ServerUtils = ServerUtils;
}); /*_EndDefine*/