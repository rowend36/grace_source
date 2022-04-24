define(function(require,exports,module) {
    var Utils = require("grace/core/utils").Utils;
    var getEditor = require("grace/setup/setup_editors").getEditor;
    var BaseServer = require("grace/ext/autocompletion/base_server").BaseServer;
    var S = require("grace/ext/autocompletion/base_server").ServerUtils;
    var debug = console;
    var getDoc = S.getDoc;
    var createCommands = S.createCommands;
    var docValue = S.docValue;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    /**@constructor*/
    var TsServer = function(transport, options) {
        BaseServer.call(this, options);
        this.transport = transport;
        this.docs = Object.create(null);
        this.cachedArgHints = null;
        this.lastAutoCompleteFireTime = null;
        this.queryTimeout = 3000;
        this.errorCount = 0;
        this.restart(this.options.compilerOptions);
        // this.$gatherPaths = this.gatherPaths.bind(this);
        // FileUtils.on('change-project', this.$gatherPaths);
        // this.gatherPaths();
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
        name: 'tsClient',
        sendDoc: function(doc, cb) {
            var ts = this;
            var changes = ts.getChanges(doc);
            var message;
            if (doc.version && changes) {
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
            ts.transport.postMessage(message, function(error, version) {
                if (error || version != expected) {
                    //possible corruption, force full refresh
                    ts.invalidateDoc(ts.docs[name]);
                }
                cb && cb(error);
            });
        },
        removeDoc: function(name) {
            this.transport.postMessage({
                type: "delDoc",
                args: [name]
            });
        },
        destroy: function() {
            FileUtils.off('change-project', this.$gatherPaths);
            if (this.$stopWalk) {
                this.$stopWalk();
            }
        },
        requestArgHints: function(editor, start, cb) {
            var ts = this;
            var doc = getDoc(ts, editor.session);
            ts.send("getSignatureHelpItems", [doc.name, getPos(editor)], function(e, res) {
                if (debugCompletions) debug.timeEnd('get definition');
                if (e) {
                    return debug.log(e);
                } else if (!res) return;
                cb(res);
            });
        },
        requestDefinition: function(editor, cb) {
            this.send("getDefinitionAtPosition", editor, function(e, res) {
                if (!e && res) {
                    cb(res.map(function(def) {
                        return {
                            file: def.fileName,
                            span: def.textSpan
                        };
                    }));
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
            if (!/[^\.\/]\.([tj]sx?)+$/.test(name)) return name + '.js';
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
                item.docHTML = this.send("getCompletionEntryDetails", [getDoc(ts, editor.session)
                    .name,
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
        loadDependenciesFromErrors: function(file, annotations, cb) {
            /**
             * @typedef {{type:string,path:string,name?:string}} Dep
             * 
             * @type {Array<Dep>} missing
             */
            var missing = [];
            var dir = FileUtils.normalize(FileUtils.dirname(file));
            annotations.forEach(function(e) {
                if (e.text.startsWith('Cannot find')) {
                    var res = /\'(.*)\'/.exec(e.text);
                    if (res) {
                        var module = res[1];
                        if (/\.?\.?\//.test(module))
                            missing.push({
                                type: 'source',
                                path: FileUtils.resolve(dir, module)
                            });
                        else {
                            var name = module.lastIndexOf("/");
                            missing.push({
                                type: 'module',
                                path: module,
                                name: module.substring(0, name > -1 ? name - 1 : module.length)
                            });
                        }
                    }
                }
            });
            if (!missing.length) {
                cb && cb();
                return false;
            } else this.resolveDependencies(dir, missing, cb);
        },
        //todo parse and load dependencies
        resolveDependencies: function(dir, missing, cb) {
            var ts = this;
            var added = false;
            var isClassic = (ts.options.compilerOptions.moduleResolution == 1);
            var roots = [""];
            dir.split("/").forEach(function(segment, i) {
                roots.push(roots[i] + segment + "/");
            });
            roots.reverse().pop();
            var abort = new Utils.AbortSignal();
            /** Read a single file in a directory trying all possible extensions
             * @param path - resolved path
             * @callback cb {(err,found)}
             **/
            function readFile(path, cb) {
                var paths;
                if (path.indexOf(".") < 0) {
                    paths = [path + ".d.ts", path + ".ts", path + ".tsx", path + ".js", path + ".jsx", path];
                } else paths = [path];
                Utils.asyncForEach(paths, function(path, i, n, x) {
                    n = abort.control(n,x);
                    if (debugCompletions)
                        debug.log('reading: ' + path);
                    if (ts.hasDoc(path)) {
                        return x();
                    }
                    ts.options.readFile(path, function(e, r) {
                        try {
                            if (!e) {
                                added = true;
                                ts.addDoc(path, r);
                                x();
                            } else if (e.code !== 'ENOENT') {
                                if(e.reason == 'size'){
                                    abort.abort();
                                }
                                x(e);
                            } else n();
                        } catch (e) {
                            debug.log(e);
                        }
                    });
                }, function(err) {
                    cb(err == true ? undefined : err, err == true);
                }, 0, 0, true);
            }

            /* Read a package's main module */
            function readModule(root, path, cb) {
                var name = path.substring(0, path.indexOf("/")) || path;
                root = root + '/' + name;
                var packageJson = root + '/package.json';
                //read package.json
                readFile(packageJson, function(err, added) {
                    var main = 'index';
                    var dir = '';
                    if (added) {
                        var doc = ts.hasDoc(packageJson);
                        try {
                            var json = JSON.parse(docValue(ts, doc));
                            //load types or main
                            if (json.types) {
                                main = json.types;
                            } else if (json.main) {
                                main = json.main;
                                if (path !== name) {
                                    dir = '/' + FileUtils.dirname(main);
                                }
                            }
                        } catch (e) {
                            debug.error(e);
                            cb(e);
                        }
                    }
                    if (dir) {
                        //read source file
                        readSourceFile(root + '/' + dir + '/' + path, cb);
                    } else readFile(root + '/' + main, cb);
                });
            }

            //read type definitions for a given module
            function readType(root, path, cb) {
                root = root + "node_modules/@types";
                var name = path.substring(0, path.indexOf("/")) || path;
                dirExists(root + '/' + name, function(exists) {
                    if (exists) {
                        readModule(root, path, cb);
                    } else cb();
                });
            }

            function readSourceFile(path, cb) {
                readFile(path, function(err) {
                    if (err && err.code == 'EISDIR') {
                        //should only happen in classic
                        readModule(dir, path, cb);
                    } else cb();
                });
            }

            function dirExists(dir, cb) {
                ts.options.readFile(dir, function(e) {
                    if (e && e.code == 'EISDIR') cb(true);
                    else cb(false);
                });
            }
            Utils.asyncForEach(missing,
                function(mod, i, next,stop) {
                    next = abort.control(next,stop);
                    switch (mod.type) {
                        case 'source':
                            //read sourcefile
                            return readSourceFile(mod.path, next);
                        case 'module':
                            //Try roots from deepest to shallowest
                            Utils.asyncForEach(roots, function(root, i, next, stop) {
                                //Look for @types definitions first
                                readType(root, mod.path, function(err, added) {
                                    if (added) return next();
                                    if (isClassic) {
                                        //check using classic module resolution
                                        readFile(root + mod.path, function(err, added) {
                                            if (added) stop();
                                            else next();
                                        });
                                    } else {
                                        var plainPath = root + 'node_modules/' + mod.name;
                                        //check if directory exists
                                        dirExists(plainPath, function(yes) {
                                            //not really possible
                                            if (yes) {
                                                readModule(root + 'node_modules', mod.path, function(err, added) {
                                                    if (err) stop();
                                                    else if (added) stop();
                                                    else next();
                                                });
                                            } else next();
                                        });
                                    }
                                });
                            }, next, null, null, true);
                    }
                },
                function() {
                    if (cb) cb(added);
                    else if (added)
                        ts.triggerUpdateAnnotations();

                }, 5,false,true);
        },
        updateAnnotations: function(editor, setAnnotations) {
            var file = getDoc(this, editor.session).name;
            var ts = this;
            this.send("getAnnotations", editor, function(e, r) {
                if (r) {
                    ts.loadDependenciesFromErrors(file, r);
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
            this.options.compilerOptions = compilerOpts;
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
    createCommands(TsServer.prototype, "ts");

    function toAceLoc(session, index) {
        return session.getDocument().indexToPosition(index);
    }

    function buildCompletions(completions, ts) {
        var entries;
        if (completions && completions.entries) {
            var MAX = completions.isMemberCompletion ? BaseServer.PRIORITY_HIGH : BaseServer.PRIORITY_MEDIUM;
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
                };
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
            if (e) return debug.error(e);
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