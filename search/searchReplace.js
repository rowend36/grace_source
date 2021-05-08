_Define(function(global) {
    var Utils = global.Utils;
    var Notify = global.Notify;
    var FileUtils = global.FileUtils;
    var Docs = global.Docs;
    var Doc = global.Doc;
    var closeDoc = global.closeDoc;

    function SearchReplace(opts, _server) {
        var undoDeltas = [];
        opts = Object.assign({}, SearchReplace.$defaultOpts, opts);

        function revertDelta(doc, info) {
            opts.beforeUndo && opts.beforeUndo(info, doc);
            if (doc.getChecksum() != info.checksum) {
                return opts.onChecksumFail && opts.onChecksumFail(info, doc) || false;
            }
            var deltas = info.deltas;
            var $doc = doc.session.getDocument();
            try {
                for (var i = deltas.length; i-- > 0;) {
                    var delta = deltas[i];
                    for (var j = delta.length; j-- > 0;) {
                        if(delta[j].action=="insert" || delta[j].action=="remove")
                            $doc.revertDelta(delta[j]);
                    }
                }
                return true;
            }
            catch (e) {
                return opts.onUndoFail && opts.onUndoFail(info, doc, e);
            }
        }

        function undoReplace(deltas) {
            var refs = 0;
            var toReplace = deltas || undoDeltas;
            undoDeltas = [];

            function next() {
                if (toReplace.length < 1) {
                    opts.onUndoFinished && opts.onUndoFinished(refs);
                    return;
                }
                var info = toReplace.pop();
                var e = info.path;
                var server = FileUtils.getFileServer(info.server);
                if (!server) {
                    opts.onReadFail(info, { code: SearchReplace.SERVER_DELETED });
                    return next();
                }
                var doc = Docs.forPath(e, server);
                if (doc) {
                    if (revertDelta(doc, info)) {
                        refs++;
                    }
                    next();
                }
                else {
                    server.readFile(e, FileUtils.encodingFor(e, server), function(err, res) {
                        if (err) {
                            opts.onReadFail && opts.onReadFail(info, err);
                            return next();
                        }
                        doc = new Doc(res, e);
                        doc.fileServer = server.id;

                        if (revertDelta(doc, info)) {
                            doc.save(function(doc, err) {
                                //no recovery after this
                                if (err) opts.onSaveFail && opts.onSaveFail(info, doc, err);
                                else refs++;
                                if (!doc.bound) closeDoc(doc.id);
                                next();
                            });
                        }
                    });
                }
            }
            next();
        }

        function replaceRanges(doc, replacement, path, server) {
            var ranges = opts.getRanges(doc, path);
            var replacements = 0;
            var manager = doc.session.$undoManager;
            if (!manager) {
                manager = new ace.UndoManager();
                doc.session.setUndoManager(manager);
            }
            var rev = manager.startNewGroup();
            for (var i = ranges.length - 1; i >= 0; --i) {
                var session = doc.session;
                var range = ranges[i];
                var input = session.getTextRange(range);
                var replacer = opts.getReplacer(input, replacement, range.match);
                if (replacer !== null) {
                    range.end = session.replace(range, replacer);
                    replacements++;
                }
            }
            var deltas = manager.getDeltas(rev);
            //to do if deltas.length
            if (deltas) {
                undoDeltas.push({
                    path: path,
                    server: server.id,
                    checksum: doc.getChecksum(),
                    deltas: deltas
                });
            }
            return replacements;
        }

        function replace(paths, replacement) {
            undoDeltas = [];
            var replaced = 0;
            var refs = 0;
            var defaultServer = _server || FileUtils.defaultServer;
            Utils.asyncForEach(paths, function(e, i, next) {
                var doc = Docs.forPath(e, _server);
                if (doc) {
                    replaced += replaceRanges(doc, replacement, e, doc.getFileServer());
                    refs++;
                    return next();
                }
                defaultServer.readFile(e, FileUtils.encodingFor(e, defaultServer), function(err, res) {
                    if (err) {
                        opts.onReadFail && opts.onReadFail({ path: e }, err, true);
                        return next();
                    }
                    doc = new Doc(res, e);
                    doc.fileServer = defaultServer.id;
                    replaced += replaceRanges(doc, replacement, e, defaultServer);
                    refs++;
                    var id = doc.id;
                    doc.save(function(doc, err) {
                        if (err) opts.onSaveFail({ path: e, server: defaultServer.id }, doc, err, true);
                        if (!doc.bound) closeDoc(id);
                        next();
                    });
                });

            }, function() {
                opts.onReplaceFinished && opts.onReplaceFinished(refs, replaced);
            });
        }
        this.undo = undoReplace;
        this.revertDelta = revertDelta;
        this.replace = replace;
        this.getDeltas = function() {
            return undoDeltas;
        };
        this.setServer = function(s) {
            _server = s;
        };
    }

    SearchReplace.$defaultOpts = {
        onChecksumFail: function(info, doc) {
            Notify.error("Document " + info.path + " has changed, cannot undo");
        },
        onUndoFail: function(info, doc, e) {
            Notify.error('Failed to undo changes ' + info.path);
        },
        onUndoFinished: function(refs) {
            Notify.info('Undone changes in ' + refs + ' files');
        },
        onReadFail: function(info, err, replacing) {
            Notify.error('Unable to read file ', info.path);
        },
        onSaveFail: function(info, doc, err, replacing) {
            Notify.error("Unable to save file ", info.path);
        },
        getRanges: function(doc) {
            throw 'getRanges not defined';
        },
        onReplaceFinished: function(refs, replaced) {
            Notify.info('Replaced ' + replaced + ' instances in ' + refs + ' files');
        },
        getReplacer: function(input, replacement, range) {
            return replacement
        }
    };
    global.SearchReplace = SearchReplace;
}); /*_EndDefine*/