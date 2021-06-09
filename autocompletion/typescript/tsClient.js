_Define(function(exports) {
    var Utils = exports.Utils;
    var getEditor = exports.getEditor;
    var BaseServer = exports.BaseServer;
    var S = exports.ServerUtils;
    var getDoc = S.getDoc;
    var createCommands = S.createCommands;
    var docValue = S.docValue;
    var TsServer = function(transport, options) {
        var self = this;
        BaseServer.call(this, options);
        this.transport = transport;
        this.docs = Object.create(null);
        this.cachedArgHints = null;
        this.lastAutoCompleteFireTime = null;
        this.queryTimeout = 3000;
        this.errorCount = 0;
        this.restart(this.options.compilerOptions);
    };

    function getPos(editor, pos) {
        return editor.session.getDocument().positionToIndex(pos || editor.getSelection().getCursor());
    }
    var debugCompletions = false;

    function sum(doc) {
        var a = doc.getLength();
        if (a < 1) return 0;
        var sum = doc.getLine(0).length;
        for (var i = 1; i < a; i++) {
            sum += doc.getLine(i).length + 1;
        }
        return sum;
    }
    TsServer.prototype = Object.assign(Object.create(BaseServer.prototype), {
        sendDoc: function(doc, cb) {
            var ts = this;
            var changes = ts.getChanges(doc);
            var message;
            if (doc.version && changes && changes.length < doc.doc.getLength()) {
                changes[changes.length - 1].checksum = sum(doc.doc);
                message = {
                    type: "updateDoc",
                    args: [doc.name, changes, doc.version]
                };
                doc.version++;
            } else {
                doc.version = Math.floor(Math.random() * 10000000);
                message = {
                    type: "addDoc",
                    args: [doc.name, docValue(ts, doc), doc.version]
                };
            }
            //Coordinating this is work, but figured it out eventually,
            var expected = doc.version;
            // console.log('expecting :'+expected);
            ts.transport.postMessage(message, function(error, version) {
                if (error || version != expected) {
                    //possible corruption, force full refresh
                    ts.invalidateDoc(this.docs[i]);
                }
                // console.log('got '+version+' instead of '+expected+' doc iz '+doc.version)
                cb && cb(error);
            });
        },
        removeDoc: function(name) {
            this.transport.postMessage({
                type: "delDoc",
                args: [name]
            });
        },
        requestArgHints: function(editor, start, cb) {
            var ts = this;
            var doc = getDoc(ts, editor.session);
            ts.send("getSignatureHelpItems", [doc.name, getPos(editor)], function(e, res) {
                if (debugCompletions) console.timeEnd('get definition');
                if (e) {
                    return console.log(e);
                } else if (!res) return;
                cb(res);
            });
        },
        requestDefinition: function(editor, cb) {
            var ts = this;
            this.send("getDefinitionAtPosition", editor, function(e, res) {
                if (!e && res && res[0]) {
                    var def = res[0];
                    cb({
                        file: def.fileName,
                        span: def.textSpan
                    });
                }
            });
        },
        requestRename: function(editor, newName, cb, data) {
            if (data.loaded) return cb(null, data.refs);
            var ts = this;
            BaseServer.prototype.requestRename.call(this, editor, newName, function(e, refs) {
                if (refs) {
                    refs.forEach(function(e) {
                        if (e.span) {
                            var doc = ts.docs[e.file].doc;
                            e.start = toAceLoc(doc, e.span.start);
                            e.end = toAceLoc(doc, e.span.start + e.span.length);
                        }
                    });
                }
                cb(e, refs);
            }, data.refs);
        },
        requestType: function(editor, pos, cb) {
            this.send('getQuickInfoAtPosition', [getDoc(this, editor.session)
                .name, getPos(editor, pos)
            ], cb);
        },
        normalizeName: function(name) {
            if (!/\.(ts|tsx|js|jsx)$/.test(name)) return name + '.js';
            return name;
        },
        getCompletions: function(editor, session, pos, prefix, callback) {
            var self = this;
            this.ui.closeAllTips();
            this.send("getCompletions", editor, function(e, r) {
                if (r) {
                    callback(e, buildCompletions(r, self));
                } else callback(e);
            });
        },
        getDocTooltip: function(item) {
            var editor = getEditor();
            var ts = this;
            if (item.__type == "ts" && !item.docHTML && !item.hasDoc) {
                item.hasDoc = true;
                item.docHTML = this.send("getCompletionEntryDetails", [getDoc(ts, editor.session).name,
                    getPos(editor), item
                    .value
                ], function(e, r) {
                    if (r) {
                        item.docHTML = ts.genInfoHtml(r, true);
                        editor.completer.updateDocTooltip();
                    }
                });
            }
        },
        updateAnnotations: function(editor, setAnnotations) {
            this.send("getAnnotations", editor, function(e, r) {
                if (r) {
                    setAnnotations(r);
                } else setAnnotations([]);
            });
        },
        rename: function(editor) {
            rename(this, editor);
        },
        findRefs: function(editor) {
            findRefs(this, editor);
        },
        restart: function(compilerOpts) {
            for (var i in this.docs) {
                this.invalidateDoc(this.docs[i]);
            }
            this.send("restart", [compilerOpts]);
        },
        debugCompletions: function(value) {
            if (value) debugCompletions = true;
            else debugCompletions = false;
        },
        send: function(type, args, cb) {
            var transport = this.transport;
            if (args && args.session) {
                args = [getDoc(this, args.session).name, getPos(args)];
            }
            var counter = Utils.createCounter(function() {
                transport.postMessage({
                    type: type,
                    args: args
                }, cb);
            });
            counter.increment();
            for (var i in this.docs) {
                if (this.docs[i].changed) {
                    counter.increment();
                    this.sendDoc(this.docs[i], counter.decrement);
                }
            }
            counter.decrement();
        }
    });
    createCommands(TsServer.prototype, "tsServer", "ts");

    function toAceLoc(session, index) {
        return session.getDocument().indexToPosition(index);
    }

    function buildCompletions(completions, ts) {
        var entries;
        if (completions && completions.entries) {
            var MAX = completions.isMemberCompletion ? 5000 : 500;
            entries = completions.entries.map(function(e) {
                return {
                    value: e.name,
                    caption: e.name,
                    message: e.kindModifiers + " " + e.kind,
                    iconClass: ts.ui.iconClass(e.kind || "unknown", e.kindModifiers),
                    score: MAX - parseInt(e.sortText),
                    __type: "ts"
                };
            });
        }
        return entries;
    }
    //3 issues
    // has doc but is a string: computepos, getDoc before rename
    // done has doc but name changed so temp doc wont work: use session
    // ignored lib :ignore??
    function findRefs(ts, editor, cb) {
        ts.send("getReferencesAtPosition", editor, function(error, data) {
            if (error) return ts.ui.showError(editor, error);
            if (!data) return ts.ui.showError(editor, 'Unable to find References');
            if (typeof cb === "function") {
                cb(toAceRefs(ts, data));
                return;
            }
            ts.ui.referenceDialog(ts, editor, toAceRefs(ts, data));
        });
    }

    function toAceRefs(ts, data) {
        var failed = false;
        var name;
        data = {
            refs: data.map(function(e) {
                name = name || e.name;
                var session = ts.docs[e.fileName];
                if (session) {
                    if (typeof session.doc == "string") session = null;
                    else session = session.doc;
                }
                failed = failed || !session;
                return {
                    file: e.fileName,
                    start: session && toAceLoc(session, e.textSpan.start),
                    end: session && toAceLoc(session, e.textSpan.start + e.textSpan.length),
                    //used in requestRename
                    span: session ? null : e.textSpan
                }
            })
        };
        data.name = name;
        data.loaded = !failed;
        return data;
    }

    function rename(ts, editor) {
        var doc = getDoc(ts, editor.session);
        var data = {};

        function finish(e, refs) {
            if (refs) ts.ui.renameDialog(ts, editor, toAceRefs(ts, refs));
        }

        function begin(e, res) {
            if (e) return console.error(e);
            if (res) {
                if (res.canRename) {
                    data.name = res.displayName;
                    ts.send("findRenameLocations", [doc.name, getPos(editor)], finish);
                } else {
                    ts.ui.showError(editor, res.localizedErrorMessage);
                }
            }
        }
        ts.send("getRenameInfo", [doc.name, getPos(editor)], begin);
    }
    exports.TsServer = TsServer;
}); /*_EndDefine*/