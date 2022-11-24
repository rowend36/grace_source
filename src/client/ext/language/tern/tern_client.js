define(function (require, exports, module) {
    /*globals tern,tern_Defs*/
    /*jshint newcap:false*/
    var BaseClient = require('grace/ext/language/base_client').BaseClient;
    var customDataTip = require('./tern_tooltips').customDataTip;
    var parseFnType = require('./tern_tooltips').parseFnType;
    var parseJsDocParams = require('./tern_tooltips').parseJsDocParams;
    var S = require('grace/ext/language/base_client').ClientUtils;
    var getDoc = S.getDoc;
    var docValue = S.docValue;
    var debug = console;

    /*The initial code that served as a reference for lspClient*/
    var TernServer = function (options) {
        BaseClient.call(this, options);
        var self = this;
        var plugins = this.options.plugins || (this.options.plugins = {});
        if (!plugins.hasOwnProperty('doc_comment')) plugins.doc_comment = {};
        if (
            plugins.doc_comment &&
            !plugins.doc_comment.hasOwnProperty('fullDocs')
        ) {
            if (typeof plugins.doc_comment == 'object')
                plugins.doc_comment.fullDocs = true;
            //default to true if not specified
            else
                plugins.doc_comment = {
                    fullDocs: true,
                };
        }
        if (!this.options.hasOwnProperty('defs'))
            this.options.defs = [/*'jquery',*/ 'browser', 'ecmascript'];
        if (this.options.useWorker != false) this.options.useWorker = true;
        if (this.options.useWorker) {
            this.server = new WorkerServer(this, this.options.workerClass);
        } else {
            this.restart();
        }
        this.trackChange = function (change, doc) {
            trackChange(self, doc, change);
        };
        this.cachedArgHints = null;
        this.queryTimeout = 3000;
        if (
            this.options.queryTimeout &&
            !isNaN(parseInt(this.options.queryTimeout))
        )
            this.queryTimeout = parseInt(this.options.queryTimeout);
    };
    var Pos = function (line, ch) {
        return {
            line: line,
            ch: ch,
        };
    };
    var bigDoc = 250;
    var debugCompletions = false;
    var TMP_DIR = '/tmp_tern/';
    TernServer.prototype = Object.assign(Object.create(BaseClient.prototype), {
        getCompletions: function (editor, session, pos, prefix, callback) {
            getCompletions(this, editor, session, pos, prefix, callback);
        },
        name: 'Tern',
        getDocTooltip: function (item) {
            if (item.__type == this) item.docHTML = customDataTip(item);
        },
        requestType: function (editor, pos, cb, calledFromCursorActivity) {
            if (calledFromCursorActivity && isOnFunctionCall(editor)) {
                return cb(null, null);
            }
            this.request(editor, 'type', cb, pos, !calledFromCursorActivity);
        },
        //Avoid modifying tern, we have no support for project directory
        $fixName: function (name) {
            if (!name.startsWith('/') && !name.startsWith('temp:/'))
                name = TMP_DIR + name;
            return name;
        },
        //Revert changes due to fixName and tern returning relative paths
        $unfixName: function (name) {
            if (!name.startsWith('/') && !name.startsWith('temp:/'))
                name = '/' + name;
            if (name.startsWith(TMP_DIR))
                name = name.substring(TMP_DIR.length);
            return name;
        },
        genInfoHtml: function (data, fromCompletion, fromCursorActivity) {
            if (this.options.typeTip) {
                //dont know when this is ever entered... was in code mirror plugin...
                return this.options.typeTip(data);
            } else {
                if (fromCursorActivity) {
                    if (data.hasOwnProperty('guess') && data.guess === true)
                        return; //dont show guesses on auto activity as they are not accurate
                    if (
                        data.type == '?' ||
                        data.type == 'string' ||
                        data.type == 'number' ||
                        data.type == 'bool' ||
                        data.type == 'date' ||
                        data.type == 'fn(document: ?)' ||
                        data.type == 'fn()'
                    ) {
                        return;
                    }
                }
                if (data.hasOwnProperty('type')) {
                    //type query (first try)
                    if (data.type == '?') {
                        return '?';
                    }
                }
            }
            return customDataTip(data);
        },
        genArgHintHtml: function (cache, pos) {
            var comments = cache.comments; //added by morgan to include document comments
            if (!cache.hasOwnProperty('params')) {
                if (!comments) {
                    cache.params = null;
                } else {
                    var params = parseJsDocParams(comments);
                    if (!params || params.length === 0) {
                        cache.params = null;
                    } else {
                        cache.params = params;
                    }
                }
            }
            var data = {
                name: cache.name,
                guess: cache.guess,
                fnArgs: cache.type,
                doc: comments,
                params: cache.params,
            };
            return customDataTip(data, pos);
        },
        requestReferences: function (editor, cb) {
            var ts = this;
            this.request(
                editor,
                {
                    type: 'refs',
                    fullDocs: true,
                },
                function (error, data) {
                    if (!error)
                        data.refs = data.refs.map(function (e) {
                            return {
                                file: ts.$unfixName(e.file),
                                start: toAceLoc(e.start),
                                end: toAceLoc(e.end),
                            };
                        });
                    cb(error, data);
                }
            );
        },
        request: function (editor, query, c, pos, forcePushChangedfile) {
            var self = this;
            var doc = getDoc(this, editor.session);
            var request = buildRequest(
                this,
                doc,
                query,
                pos,
                forcePushChangedfile
            );
            this.server.request(request, function (error, data) {
                if (error) doRecovery(self, error);
                else if (self.options.responseFilter)
                    data = self.options.responseFilter(
                        doc,
                        query,
                        request,
                        error,
                        data
                    );
                c(error, data);
            });
        },
        requestArgHints: function (editor, start, cb) {
            this.request(
                editor,
                {
                    type: 'type',
                    preferFunction: true,
                    end: toTernLoc(start),
                },
                function (error, data) {
                    if (debugCompletions) debug.timeEnd('get definition');
                    if (error) {
                        if (
                            error
                                .toString()
                                .toLowerCase()
                                .indexOf('no expression at') === -1 &&
                            error
                                .toString()
                                .toLowerCase()
                                .indexOf('no type found at') === -1
                        ) {
                            return cb(error);
                        }
                        return;
                    }
                    if (!data.type || !/^fn\(/.test(data.type)) {
                        return cb(null, null);
                    }
                    cb(null, {
                        type: parseFnType(data.type),
                        name: data.exprName || data.name || 'fn',
                        guess: data.guess,
                        comments: data.doc, //added by morgan- include comments with arg hints
                    });
                }
            );
        },
        requestDefinition: function (editor, cb, varName) {
            var ts = this;
            this.request(
                editor,
                {
                    type: 'definition',
                    variable: varName || null,
                },
                function (error, data) {
                    if (error) cb(error);
                    else if (data.file) {
                        cb(null, {
                            file: ts.$unfixName(data.file),
                            start: toAceLoc(data.start),
                            end: toAceLoc(data.end),
                        });
                    } else if (data.url) {
                        cb(null, {
                            url: data.url,
                        });
                    } else cb(null);
                },
                null,
                true
            );
        },
        setupForRename: function (editor, newName, cb /*, olddata*/) {
            //Don't use the references data
            BaseClient.prototype.setupForRename.call(
                this,
                editor,
                newName,
                cb,
                null
            );
        },
        requestRenameLocations: function (editor, newName, cb) {
            var ts = this;
            if (!newName) return this.requestReferences(editor, cb);
            this.request(
                editor,
                {
                    type: 'rename',
                    newName: newName,
                    fullDocs: true,
                },
                function (error, data) {
                    if (data && data.changes) {
                        data.changes.forEach(function (e) {
                            e.start = toAceLoc(e.start);
                            e.end = toAceLoc(e.end);
                            e.file = ts.$unfixName(e.file);
                        });
                    }
                    cb(error, data && {refs: data.changes});
                }
            );
        },
        sendDoc: function (doc, cb) {
            this.server.request(
                {
                    files: [
                        {
                            type: 'full',
                            name: this.$fixName(doc.name),
                            text: docValue(this, doc),
                        },
                    ],
                },
                function (error) {
                    if (error) debug.error(error);
                    else doc.changed = null;
                    if (cb) cb();
                }
            );
        },
        releaseDoc: function (name) {
            this.server.delFile(name);
        },
        restart: function (defs, plugins) {
            for (var name in this.docs) {
                this.invalidateDoc(this.docs[name]);
            }
            if (defs) this.options.defs = defs;
            if (plugins) this.options.plugins = plugins;
            if (this.options.useWorker) return this.server.restart(this);
            if (this.options.defs && this.options.defs.length > 0) {
                var tmp = [];
                for (var i = 0; i < this.options.defs.length; i++) {
                    var a = this.options.defs[i];
                    if (typeof a == 'object') {
                        tmp.push(a);
                    } else if (tern_Defs[a]) {
                        tmp.push(tern_Defs[a]);
                    } else debug.warn('unknown def ' + a);
                }
                this.options.defs = tmp;
            }
            var self = this;
            this.server = new tern.Server({
                getFile: function (file, c) {
                    return getFile(self, self.$unfixName(file), c);
                },
                async: true,
                defs: this.options.defs,
                plugins: this.options.plugins,
            });
        },
        destroy: function () {
            BaseClient.prototype.destroy.call(this);
            if (this.options.useWorker) this.server.terminate();
            else this.server.reset();
        },
        debug: function (message) {
            if (!message) {
                debug.log('debug commands: files, filecontents');
                return;
            }
            if (!this.options.useWorker) return;
            this.server.sendDebug(message);
        },
        debugCompletions: function (value) {
            if (value) debugCompletions = true;
            else debugCompletions = false;
        },
        addDefs: function (defs, infront) {
            var server = this.server;
            if (!this.options.useWorker && Array.isArray(defs)) {
                defs.forEach(function (def) {
                    server.addDefs(def, infront);
                });
            } else server.addDefs(defs, infront);
        },
        deleteDefs: function (defs) {
            var server = this.server;
            if (this.options.useWorker) {
                return server.deleteDefs(name, module);
            }
            if (!this.options.useWorker && Array.isArray(defs)) {
                defs.forEach(function (def) {
                    server.deleteDefs(def);
                });
            } else server.deleteDefs(defs);
        },
    });

    function toTernLoc(pos) {
        if (typeof pos.row !== 'undefined') {
            return {
                line: pos.row,
                ch: pos.column,
            };
        }
        return pos;
    }

    function buildRequest(ts, doc, query, pos, forcePushChangedfile) {
        var files = [],
            allowFragments = !query.fullDocs;
        if (!allowFragments) {
            delete query.fullDocs;
        }
        if (typeof query == 'string') {
            query = {
                type: query,
            };
        }
        query.lineCharPositions = true;
        if (query.end == null) {
            //this is null for get completions
            var currentSelection = doc.doc.getSelection().getRange(); //returns range: start{row,column}, end{row,column}
            query.end = toTernLoc(pos || currentSelection.end);
            if (currentSelection.start != currentSelection.end) {
                query.start = toTernLoc(currentSelection.start);
            }
        }

        var startPos = query.start || query.end;

        if (doc.changed) {
            if (
                doc.fragOnly ||
                (!forcePushChangedfile &&
                    doc.doc.getLength() > bigDoc &&
                    allowFragments !== false &&
                    doc.changed.to - doc.changed.from < 100 &&
                    doc.changed.from <= startPos.line &&
                    doc.changed.to > query.end.line)
            ) {
                files.push(
                    getFragmentAround(
                        doc,
                        startPos,
                        query.end,
                        ts.$fixName(doc.name)
                    )
                );
                query.file = '#0';
                var offsetLines = files[0].offsetLines;
                if (query.start != null)
                    query.start = Pos(
                        query.start.line - -offsetLines,
                        query.start.ch
                    );
                query.end = Pos(query.end.line - offsetLines, query.end.ch);
            } else {
                files.push({
                    type: 'full',
                    name: ts.$fixName(doc.name),
                    text: docValue(ts, doc),
                });
                query.file = ts.$fixName(doc.name);
                doc.changed = null;
            }
        } else {
            query.file = ts.$fixName(doc.name);
        }
        for (var name in ts.docs) {
            var cur = ts.docs[name];
            if (cur.changed && cur != doc && !doc.fragOnly) {
                files.push({
                    type: 'full',
                    name: ts.$fixName(cur.name),
                    text: docValue(ts, cur),
                });
                cur.changed = null;
            }
        }
        return {
            query: query,
            files: files,
            timeout: ts.queryTimeout,
        };
    }
    function doRecovery(ts, error) {
        console.log(error);
    }
    //todo use scope finders
    function getFragmentAround(data, start, end, name) {
        var doc = data.doc;
        var minIndent = null,
            minLine = null,
            endLine,
            tabSize = doc.$tabSize;
        for (var p = start.line - 1, min = Math.max(0, p - 50); p >= min; --p) {
            var line = doc.getLine(p),
                fn = line.search(/\bfunction\b/);
            if (fn < 0) continue;
            var indent = countColumn(line, null, tabSize);
            if (minIndent != null && minIndent <= indent) continue;
            minIndent = indent;
            minLine = p;
        }
        if (minLine == null) minLine = min;
        var max = Math.min(doc.getLength() - 1, end.line + 20);
        if (
            minIndent == null ||
            minIndent == countColumn(doc.getLine(start.line), null, tabSize)
        )
            endLine = max;
        else
            for (endLine = end.line + 1; endLine < max; ++endLine) {
                var indent = countColumn(doc.getLine(endLine), null, tabSize);
                if (indent <= minIndent) break;
            }
        var from = Pos(minLine, 0);

        return {
            type: 'part',
            name: name,
            offsetLines: from.line,
            offset: from,
            text: doc.getTextRange({
                start: toAceLoc(from),
                end: toAceLoc(Pos(endLine, 0)),
            }),
        };
    }

    function countColumn(string, end, tabSize, startIndex, startValue) {
        if (end == null) {
            end = string.search(/[^\s\u00a0]/);
            if (end == -1) end = string.length;
        }
        for (var i = startIndex || 0, n = startValue || 0; i < end; ++i) {
            if (string.charAt(i) == '\t') n += tabSize - (n % tabSize);
            else ++n;
        }
        return n;
    }

    function typeToIcon(type, property) {
        if (type == '?') return 'text';
        if (type == 'number' || type == 'string' || type == 'bool')
            return property ? 'property' : 'var';
        if (/^fn\(/.test(type)) return property ? 'method' : 'function';
        if (/^\[/.test(type)) return property ? 'property' : 'var'; //array
        if (type == undefined) return 'keyword';
        return property ? 'property' : 'var'; //object
    }

    function getCompletions(ts, editor, session, pos, prefix, callback) {
        var groupName = '';
        if (debugCompletions) {
            groupName = Math.random().toString(36).slice(2);
            debug.group(groupName);
            debug.time('get completions from tern server');
        }
        ts.ui.closeAllTips();
        ts.request(
            editor,
            {
                type: 'completions',
                types: true,
                origins: true,
                docs: true,
                filter: false,
                omitObjectPrototype: false,
                sort: false,
                includeKeywords: true,
                guess: true,
                expandWordForward: false,
            },

            function (error, data) {
                if (debugCompletions)
                    debug.timeEnd('get completions from tern server');
                if (error) {
                    ts.ui.showError(editor, error);
                    return callback();
                }
                var SCORE = data.isProperty
                    ? BaseClient.PRIORITY_HIGH
                    : BaseClient.PRIORITY_MEDIUM;
                var ternCompletions = data.completions.map(function (item) {
                    return {
                        iconClass: ts.ui.iconClass(
                            item.guess
                                ? 'text'
                                : typeToIcon(item.type, data.isProperty)
                        ),
                        doc: item.doc,
                        type: item.type,
                        caption: item.name,
                        value: item.displayName || item.name,
                        score: SCORE,
                        __type: ts,
                        meta: item.origin
                            ? '  (' + item.origin.replace(/^.*[\\\/]/, '') + ')'
                            : '',
                    };
                });
                callback(null, ternCompletions);
                if (debugCompletions) debug.groupEnd(groupName);
            }
        );
    }

    function trackChange(ts, doc, change) {
        var _change = {};
        _change.from = toTernLoc(change.start);
        _change.to = toTernLoc(change.end);
        _change.text = change.lines;

        var data = getDoc(ts, doc);
        var changed = data.changed; //data is the tern server doc, which keeps a changed property, which is null here
        if (changed === null) {
            data.changed = changed = {
                from: _change.from.line,
                to: _change.from.line,
            };
        }

        var end = _change.from.line + (_change.text.length - 1);
        if (_change.from.line < changed.to) {
            changed.to = changed.to - (_change.to.line - end);
        }
        if (end >= changed.to) {
            changed.to = end + 1;
        }
        if (changed.from > _change.from.line) {
            changed.from = changed.from.line;
        }
        if (doc.getLength() > bigDoc && _change.to - changed.from > 100) {
            setTimeout(function () {
                if (data.changed && data.changed.to - data.changed.from > 100) {
                    ts.sendDoc(ts, data);
                }
            }, 200);
        }
    }
    function getFile(ts, name, cb) {
        var buf = ts.docs[name];
        if (buf) cb(docValue(ts, buf));
        else if (ts.options.readFile) ts.options.readFile(name, cb);
        //no filtering
        else cb(null);
    }
    function toAceLoc(pos) {
        if (pos.line > -1) {
            return {
                row: Number(pos.line),
                column: Number(pos.ch),
            };
        }
        return pos;
    }

    function isOnFunctionCall(editor) {
        //if (!inJavascriptMode(editor)) return false;
        if (S.somethingIsSelected(editor)) return false;
        if (isInCall(editor)) return false;
        var tok = S.getCurrentToken(editor);
        if (!tok) return; //No token at current location
        if (!tok.start) return; //sometimes this is missing... not sure why but makes it impossible to do what we want
        if (tok.type.indexOf('entity.name.function') !== -1) return false; //function definition
        if (tok.type.indexOf('storage.type') !== -1) return false; // could be 'function', which is start of an anon fn
        var nextTok = editor.session.getTokenAt(
            editor.getSelectionRange().end.row,
            tok.start + tok.value.length + 1
        );
        if (!nextTok || nextTok.value !== '(') return false;
        return true;
    }

    function isInCall(editor, pos) {
        var callPos = S.getCallPos(editor, pos);
        if (callPos) {
            return true;
        }
        return false;
    }

    // function findContext(doc, data) {
    //     //I'm guessing this was to make up for
    //     //discrepancies in file position
    //     return data;
    // }

    // function atInterestingExpression(editor) {
    //     var pos = editor.getSelectionRange().end; //editor.getCursor("end"),
    //     var tok = editor.session.getTokenAt(pos.row, pos.column); // editor.getTokenAt(pos);
    //     if (
    //         tok &&
    //         tok.start < pos.column &&
    //         (tok.type == "comment" || tok.type == "string")
    //     ) {
    //         return false;
    //     }
    //     return true; ///\w/.test(editor.session.getLine(pos.line).slice(Math.max(pos. - 1, 0), pos.ch + 1));
    // }

    exports.TernServer = TernServer;

    function WorkerServer(ts, WorkerClass) {
        var worker = WorkerClass
            ? new WorkerClass()
            : new Worker(ts.options.workerScript);
        var startServer = function (ts) {
            worker.postMessage({
                type: 'init',
                defs: ts.options.defs,
                plugins: ts.options.plugins,
                scripts: ts.options.workerDeps,
            });
        };

        startServer(ts); //start

        var msgId = 0,
            pending = {};

        function send(data, c) {
            if (c) {
                data.id = ++msgId;
                pending[msgId] = c;
            }
            worker.postMessage(data);
        }
        worker.onmessage = function (e) {
            var data = e.data;
            if (data.type == 'getFile') {
                getFile(ts, ts.$unfixName(data.name), function (err, text) {
                    send({
                        type: 'getFile',
                        err: String(err),
                        text: text,
                        id: data.id,
                    });
                });
            } else if (data.type == 'debug') {
                debug.log('(worker debug) ', data.message);
            } else if (data.id && pending[data.id]) {
                pending[data.id](data.err, data.body);
                delete pending[data.id];
            }
        };
        worker.onerror = function (e) {
            for (var id in pending) pending[id](e);
            pending = {};
        };

        this.addFile = function (name, text) {
            send({
                type: 'add',
                name: name,
                text: text,
            });
        };
        this.delFile = function (name) {
            send({
                type: 'del',
                name: name,
            });
        };
        this.request = function (body, c) {
            send(
                {
                    type: 'req',
                    body: body,
                },
                c
            );
        };
        this.restart = function (ts) {
            startServer(ts);
        };
        this.sendDebug = function (message) {
            send({
                type: 'debug',
                body: message,
            });
        };
        this.addDefs = function (defs /*, infront*/) {
            send({
                type: 'addDefs',
                defs: defs,
            });
        };
        this.deleteDefs = function (defs) {
            send({
                type: 'delDefs',
                defs: defs,
            });
        };
        this.terminate = function () {
            worker.terminate();
            pending = {};
        };
    }
}); /*_EndDefine*/