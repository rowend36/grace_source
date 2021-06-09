_Define(function(exports) {
  //todo
  var BaseServer = exports.BaseServer;
  var htmlEncode = exports.Functions.htmlEncode;
  var TernServer = function(options) {
    BaseServer.call(this, options, cls);
    var self = this;
    var plugins = this.options.plugins || (this.options.plugins = {});
    if (!plugins.hasOwnProperty('doc_comment')) plugins.doc_comment = {};
    if (plugins.doc_comment && !plugins.doc_comment.hasOwnProperty('fullDocs')) {
      if (typeof(plugins.doc_comment) == 'object')
        plugins.doc_comment.fullDocs = true; //default to true if not specified
      else plugins.doc_comment = {
        fullDocs: true
      };
    }
    if (!this.options.hasOwnProperty('defs'))
      this.options.defs = [ /*'jquery',*/ 'browser', 'ecmascript'];
    if (this.options.useWorker != false)
      this.options.useWorker = true;
    if (this.options.useWorker) {
      this.server = new WorkerServer(this, this.options.workerClass);
    } else {
      this.restart();
    }
    this.trackChange = function(change, doc) {
      trackChange(self, doc, change);
    };
    this.cachedArgHints = null;
    this.queryTimeout = 3000;
    if (this.options.queryTimeout && !isNaN(parseInt(this.options.queryTimeout))) this.queryTimeout = parseInt(this.options.queryTimeout);

  };
  var S = exports.ServerUtils;
  var cmpPos = S.cmpPos;
  var getDoc = S.getDoc;
  var createCommands = S.createCommands;
  var isOnFunctionCall = S.isOnFunctionCall;
  var docValue = S.docValue;
  var somethingIsSelected = S.somethingIsSelected;
  var toAceLoc = S.toAceLoc;
  var getFile = S.getFile;
  var Pos = function(line, ch) {
    return {
      "line": line,
      "ch": ch
    };
  };
  var bigDoc = 250;
  var cls = 'Ace-Tern-';
  var debugCompletions = false;

  TernServer.prototype = Object.assign(
    Object.create(BaseServer.prototype), {
      normalizeName: function(name) {
        if (name[0] == '/') return name.substring(1);
        return name;
      },
      getCompletions: function(editor, session, pos, prefix, callback) {
        getCompletions(this, editor, session, pos, prefix, callback);
      },
      getDocTooltip: function(item) {
        if (item.__type == "tern")
          item.docHTML = customDataTip(item);
      },
      showType: function(editor, pos, calledFromCursorActivity) {
        showType(this, editor, pos, calledFromCursorActivity);
      },
      rename: function(editor) {
        var ts = this;
        ts.findRefs(editor, function(r) {
          if (!r || r.refs.length === 0) {
            ts.ui.showError(editor, "Cannot rename as no references were found for this variable");
            return;
          }
          ts.ui.renameDialog(ts, editor, r);
        });
      },
      findRefs: function(editor, cb) {
        findRefs(this, editor, cb);
      },
      request: function(editor, query, c, pos, forcePushChangedfile) {
        var self = this;
        var doc = getDoc(this, editor.session);
        var request = buildRequest(this, doc, query, pos, forcePushChangedfile);

        this.server.request(request, function(error, data) {
          if (!error && self.options.responseFilter) data = self.options.responseFilter(doc, query, request, error, data);
          c(error, data);
        });
      },
      requestArgHints: function(editor, start, cb) {
        var ts = this;
        this.request(editor, {
          type: "type",
          preferFunction: true,
          end: toTernLoc(start)
        }, function(error, data) {
          if (debugCompletions)
            console.timeEnd('get definition');
          if (error) {
            if (error.toString().toLowerCase().indexOf('no expression at') === -1 && error.toString().toLowerCase().indexOf('no type found at') === -1) {
              return ts.ui.showError(editor, error);
            }
            return;
          }
          if (!data.type || !(/^fn\(/).test(data.type)) {
            return;
          }
          cb({
            type: parseFnType(data.type),
            name: data.exprName || data.name || "fn",
            guess: data.guess,
            comments: data.doc //added by morgan- include comments with arg hints
          });
        });
      },
      requestDefinition: function(editor, cb, varName) {
        var doc = getDoc(this, editor.session);
        var req = {
          type: "definition",
          variable: varName || null
        };
        var ts = this;
        this.server.request(buildRequest(ts, doc, req, null, true), function(error, data) {
          if (error) return ts.ui.showError(editor, error);
          if (!data.file && data.url) {
            if (Env.newWindow)
              Notify.ask("Open " + data.url + "?", function() {
                Env.newWindow(data.url);
              });
            return;
          }
          if (data.file) {
            cb({
              file: data.file,
              start: toAceLoc(data.start),
              end: toAceLoc(data.end)
            });
          } else if (data.url) {
            cb({
              url: data.url
            });
          } else ts.ui.showError(editor, "Could not find a definition.");
        });
      },
      requestRename: function(editor, newName, cb) {
        var ts = this;
        this.request(editor, {
          type: "rename",
          newName: newName,
          fullDocs: true
        }, function(error, data) {
          var isAsync = false;
          if (!error && data.changes) {
            data.changes.forEach(function(e) {
              e.start = toAceLoc(e.start);
              e.end = toAceLoc(e.end);
              if (!ts.docs[e.file]) {
                isAsync = true;
              }
            });
            if (isAsync) {
              return BaseServer.prototype.requestRename.call(ts, editor, cb, data.changes);
            }
          }
          cb(error, data.changes);
        });
      },
      sendDoc: function(doc, cb) {
        this.server.request({
          files: [{
            type: "full",
            name: doc.name,
            text: docValue(this, doc)
          }]
        }, function(error) {
          if (error) console.error(error);
          else doc.changed = null;
          if (cb) cb();
        });
      },
      removeDoc: function(name) {
        this.server.delFile(name);
      },
      enabledAtCurrentLocation: function(editor) {
        return /*inJavascriptMode(editor) && */ atInterestingExpression(editor);
      },
      restart: function(defs, plugins) {
        if (defs) this.options.defs = defs;
        if (plugins) this.options.plugins = plugins;
        if (this.options.useWorker)
          return this.server.restart(this);
        if (this.options.defs && this.options.defs.length > 0) {
          var tmp = [];
          for (var i = 0; i < this.options.defs.length; i++) {
            var a = this.options.defs[i];
            if (typeof(a) == "object") {
              tmp.push(a);
            } else if (tern_Defs[a]) {
              tmp.push(tern_Defs[a]);
            } else console.warn("unknown def " + a);
          }
          this.options.defs = tmp;
        }
        var self = this;
        this.server = new tern.Server({
          getFile: function(name, c) {
            return getFile(self, name, c);
          },
          async: true,
          defs: this.options.defs,
          plugins: this.options.plugins
        });
      },
      debug: function(message) {
        if (!message) {
          console.log('debug commands: files, filecontents');
          return;
        }
        if (!this.options.useWorker) return;
        this.server.sendDebug(message);
      },
      debugCompletions: function(value) {
        if (value) debugCompletions = true;
        else debugCompletions = false;
      },
      addDefs: function(defs, infront) {
        var server = this.server;
        if (!this.options.useWorker && Array.isArray(defs)) {
          defs.forEach(function(def) {
            server.addDefs(def, infront);
          });
        } else server.addDefs(defs, infront);
      },
      deleteDefs: function(defs) {
        var server = this.server;
        if (this.options.useWorker) {
          return server.deleteDefs(name, module);
        }
        if (!this.options.useWorker && Array.isArray(defs)) {
          defs.forEach(function(def) {
            server.deleteDefs(def);
          });
        } else server.deleteDefs(defs);
      },
      genArgHintHtml: function(cache, pos) {
        var tp = cache.type,
          comments = cache.comments; //added by morgan to include document comments
        if (!cache.hasOwnProperty('params')) {
          if (!cache.comments) {
            cache.params = null;
          } else {
            var params = parseJsDocParams(cache.comments);
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
          doc: cache.comments,
          params: cache.params,
        };
        return customDataTip(data, pos);
      }
    });
  createCommands(TernServer.prototype, "ternServer", "tern")

  function toTernLoc(pos) {
    if (typeof(pos.row) !== 'undefined') {
      return {
        line: pos.row,
        ch: pos.column
      };
    }
    return pos;
  }

  function buildRequest(ts, doc, query, pos, forcePushChangedfile) {
    var files = [],
      offsetLines = 0,
      allowFragments = !query.fullDocs;
    if (!allowFragments) {
      delete query.fullDocs;
    }
    if (typeof query == "string") {
      query = {
        type: query
      };
    }
    query.lineCharPositions = true;
    if (query.end == null) { //this is null for get completions
      var currentSelection = doc.doc.getSelection().getRange(); //returns range: start{row,column}, end{row,column}
      query.end = toTernLoc(pos || currentSelection.end);
      if (currentSelection.start != currentSelection.end) {
        query.start = toTernLoc(currentSelection.start);
      }
    }

    var startPos = query.start || query.end;

    if (doc.changed) {
      if (!forcePushChangedfile && doc.doc.getLength() > bigDoc && allowFragments !== false && doc.changed.to - doc.changed.from < 100 && doc.changed.from <= startPos.line && doc.changed.to > query.end.line) {
        files.push(getFragmentAround(doc, startPos, query.end));
        query.file = "#0";
        var offsetLines = files[0].offsetLines;
        if (query.start != null) query.start = Pos(query.start.line - -offsetLines, query.start.ch);
        query.end = Pos(query.end.line - offsetLines, query.end.ch);
      } else {
        files.push({
          type: "full",
          name: doc.name,
          text: docValue(ts, doc)
        });
        query.file = doc.name;
        doc.changed = null;
      }
    } else {
      query.file = doc.name;
    }
    for (var name in ts.docs) {
      var cur = ts.docs[name];
      if (cur.changed && cur != doc) {
        files.push({
          type: "full",
          name: cur.name,
          text: docValue(ts, cur)
        });
        cur.changed = null;
      }
    }
    return {
      query: query,
      files: files,
      timeout: ts.queryTimeout
    };
  }

  function getFragmentAround(data, start, end) {
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
    if (minIndent == null || minIndent == countColumn(doc.getLine(start.line), null, tabSize)) endLine = max;
    else
      for (endLine = end.line + 1; endLine < max; ++endLine) {
        var indent = countColumn(doc.getLine(endLine), null, tabSize);
        if (indent <= minIndent) break;
      }
    var from = Pos(minLine, 0);

    return {
      type: "part",
      name: data.name,
      offsetLines: from.line,
      offset: from,
      text: doc.getTextRange({
        start: toAceLoc(from),
        end: toAceLoc(Pos(endLine, 0))
      })
    };
  }

  function countColumn(string, end, tabSize, startIndex, startValue) {
    if (end == null) {
      end = string.search(/[^\s\u00a0]/);
      if (end == -1) end = string.length;
    }
    for (var i = startIndex || 0, n = startValue || 0; i < end; ++i) {
      if (string.charAt(i) == "\t") n += tabSize - (n % tabSize);
      else ++n;
    }
    return n;
  }

  function typeToIcon(type, property) {
    if (type == "?") return "unknown";
    if (type == "number" || type == "string" || type == "bool") return type;
    if (/^fn\(/.test(type)) return property ? "method" : "function";
    if (/^\[/.test(type)) return "array";
    if (type == undefined) return "keyword"
    return property ? "property" : "object";
  }

  function getCompletions(ts, editor, session, pos, prefix, callback) {
    var groupName = '';
    if (debugCompletions) {
      groupName = Math.random().toString(36).slice(2);
      console.group(groupName);
      console.time('get completions from tern server');
    }
    ts.ui.closeAllTips();
    ts.request(editor, {
        type: "completions",
        types: true,
        origins: true,
        docs: true,
        filter: false,
        omitObjectPrototype: false,
        sort: false,
        includeKeywords: true,
        guess: true,
        expandWordForward: false
      },

      function(error, data) {
        if (debugCompletions) console.timeEnd('get completions from tern server');
        if (error) {
          return ts.ui.showError(editor, error);
        }
        var SCORE = data.isProperty ? 5000 : 400;
        var ternCompletions = data.completions.map(function(item) {
          return {
            iconClass: ts.ui.iconClass(item.guess ? "guess" : typeToIcon(item.type, data.isProperty)),
            doc: item.doc,
            type: item.type,
            caption: item.name,
            value: item.displayName || item.name,
            score: SCORE,
            __type: "tern",
            message: item.type + (item.origin ? "  (" + item.origin.replace(/^.*[\\\/]/, "") + ")" : ""),
            meta: "tern"
          };
        });
        callback(null, ternCompletions);
        if (debugCompletions) console.groupEnd(groupName);
      });
  }

  function showType(ts, editor, pos, calledFromCursorActivity) {
    if (calledFromCursorActivity) { //check if currently in call, if so, then exit
      if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) return;
      if (!isOnFunctionCall(editor)) return;
    } else { //run this check here if not from cursor as this is run in isOnFunctionCall() above if from cursor
      /*if (!inJavascriptMode(editor)) {
          return;
      }*/
    }
    var cb = function(error, data, typeData) {
      var tip = '';
      if (error) {
        if (calledFromCursorActivity) {
          return;
        }
        return ts.ui.showError(editor, error);
      }
      if (ts.options.typeTip) { //dont know when this is ever entered... was in code mirror plugin...
        tip = ts.options.typeTip(data);
      } else {
        if (calledFromCursorActivity) {
          if (data.hasOwnProperty('guess') && data.guess === true) return; //dont show guesses on auto activity as they are not accurate
          if (data.type == "?" || data.type == "string" || data.type == "number" || data.type == "bool" || data.type == "date" || data.type == "fn(document: ?)" || data.type == "fn()") {
            return;
          }
        }
        if (data.hasOwnProperty('type')) { //type query (first try)
          if (data.type == "?") {
            tip = ts.ui.tempTooltip(editor, "?", 1000);
            return;
          }
          /*if (data.type.toString().length > 1 && data.type.toString().substr(0, 2) !== 'fn') {
              var innerCB = function(error, definitionData) {
                  cb(error, definitionData, data);
              };
              ts.request(editor, "definition", innerCB, pos, false, null);
              return;
          }*/
        } else { //data is a definition request
          if (typeData && typeData.hasOwnProperty('type')) {
            data.type = typeData.type;
            data.name = typeData.name;
            data.exprName = typeData.exprName;
          }
        }
      }
      tip = customDataTip(data);
      ts.ui.makeTooltip(null, null, tip, editor, true);
    };
    if (ts.cachedArgHints && ts.cachedArgHints.isClosed)
      ts.cachedArgHints.isClosed = false;

    ts.request(editor, "type", cb, pos, !calledFromCursorActivity);
  }


  function findRefs(ts, editor, cb) {
    /*if (!inJavascriptMode(editor)) {
        return;
    }*/
    ts.request(editor, {
      type: "refs",
      fullDocs: true
    }, function(error, data) {
      if (error) return ts.ui.showError(editor, error);
      data.refs = data.refs.map(function(e) {
        return {
          file: e.file,
          start: toAceLoc(e.start),
          end: toAceLoc(e.end)
        }
      });
      if (typeof cb === "function") {
        cb(data);
        return;
      }
      ts.ui.referenceDialog(ts, editor, data);
    });
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
        to: _change.from.line
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
      setTimeout(function() {
        if (data.changed && data.changed.to - data.changed.from > 100) {
          sendDoc(ts, data);
        }
      }, 200);
    }
  }


  function findContext(doc, data) {
    //I'm guessing this was to make up for
    //discrepancies in file position
    return data;
  }

  function atInterestingExpression(editor) {
    var pos = editor.getSelectionRange().end; //editor.getCursor("end"),
    var tok = editor.session.getTokenAt(pos.row, pos.column); // editor.getTokenAt(pos);
    if (tok && tok.start < pos.column && (tok.type == "comment" || tok.type == "string")) {
      return false;
    }
    return true; ///\w/.test(editor.session.getLine(pos.line).slice(Math.max(pos. - 1, 0), pos.ch + 1));
  }

  function parseFnType(text) {
    if (text.substring(0, 2) !== 'fn') return null; //not a function
    if (text.indexOf('(') === -1) return null;

    var args = [],
      pos = 3;

    function skipMatching(upto) {
      var depth = 0,
        start = pos;
      for (;;) {
        var next = text.charAt(pos);
        if (upto.test(next) && !depth) return text.slice(start, pos);
        if (/[{\[\(]/.test(next)) ++depth;
        else if (/[}\]\)]/.test(next)) --depth;
        ++pos;
      }
    }
    if (text.charAt(pos) != ")")
      for (;;) {
        var name = text.slice(pos).match(/^([^, \(\[\{]+): /);
        if (name) {
          pos += name[0].length;
          name = name[1];
        }
        args.push({
          name: name,
          type: skipMatching(/[\),]/)
        });
        if (text.charAt(pos) == ")") break;
        pos += 2;
      }

    var rettype = text.slice(pos).match(/^\) -> (.*)$/);
    return {
      args: args,
      rettype: rettype && rettype[1]
    };
  }

  function parseJsDocParams(ts, str) {
    if (!str) return [];
    str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
    var params = [];
    while (str.indexOf('@param') !== -1) {
      str = str.substring(str.indexOf('@param') + 6); //starting after first param match
      var nextTagStart = str.indexOf('@'); //split on next param (will break if @symbol inside of param, like a link... dont have to time fullproof right now)

      var paramStr = nextTagStart === -1 ? str : str.substr(0, nextTagStart);
      var thisParam = {
        name: "",
        parentName: "",
        type: "",
        description: "",
        optional: false,
        defaultValue: ""
      };
      var re = /\s{[^}]{1,50}}\s/;
      var m;
      while ((m = re.exec(paramStr)) !== null) {
        if (m.index === re.lastIndex) {
          re.lastIndex++;
        }
        thisParam.type = m[0];
        paramStr = paramStr.replace(thisParam.type, '').trim(); //remove type from param string
        thisParam.type = thisParam.type.replace('{', '').replace('}', '').replace(' ', '').trim(); //remove brackets and spaces
      }
      paramStr = paramStr.trim(); //we now have a single param string starting after the type, next string should be the parameter name
      if (paramStr.substr(0, 1) === '[') {
        thisParam.optional = true;
        var endBracketIdx = paramStr.indexOf(']');
        if (endBracketIdx === -1) {
          rror('failed to parse parameter name; Found starting \'[\' but missing closing \']\'');
          continue; //go to next
        }
        var nameStr = paramStr.substring(0, endBracketIdx + 1);
        paramStr = paramStr.replace(nameStr, '').trim(); //remove name portion from param str
        nameStr = nameStr.replace('[', '').replace(']', ''); //remove brackets
        if (nameStr.indexOf('=') !== -1) {
          var defaultValue = nameStr.substr(nameStr.indexOf('=') + 1);
          if (defaultValue.trim() === '') {
            thisParam.defaultValue = "undefined";
          } else {
            thisParam.defaultValue = defaultValue.trim();
          }
          thisParam.name = nameStr.substring(0, nameStr.indexOf('=')).trim(); //set name
        } else {
          thisParam.name = nameStr.trim();
        }
      } else { //not optional
        var nextSpace = paramStr.indexOf(' ');
        if (nextSpace !== -1) {
          thisParam.name = paramStr.substr(0, nextSpace);
          paramStr = paramStr.substr(nextSpace).trim(); //remove name portion from param str
        } else { //no more spaces left, next portion of string must be name and there is no description
          thisParam.name = paramStr;
          paramStr = '';
        }
      }
      var nameDotIdx = thisParam.name.indexOf('.');
      if (nameDotIdx !== -1) {
        thisParam.parentName = thisParam.name.substring(0, nameDotIdx);
        thisParam.name = thisParam.name.substring(nameDotIdx + 1);
      }
      paramStr = paramStr.trim();
      if (paramStr.length > 0) {
        thisParam.description = paramStr.replace('-', '').trim(); //optional hiphen specified before start of description
      }
      thisParam.name = htmlEncode(thisParam.name);
      thisParam.parentName = htmlEncode(thisParam.parentName);
      thisParam.description = htmlEncode(thisParam.description);
      thisParam.type = htmlEncode(thisParam.type);
      thisParam.defaultValue = htmlEncode(thisParam.defaultValue);
      params.push(thisParam);
    }
    return params;
  }


  var customDataTip = function(data, activeArg) {
    var html = [];

    var d = data.doc;
    var params = data.params || parseJsDocParams(d); //parse params
    var fnArgs = data.fnArgs ? data.fnArgs : data.type ? parseFnType(data.type) : null; //will be null if parseFnType detects that this is not a function

    if (fnArgs) {
      var getParam = function(arg, getChildren) {
        if (params === null) return null;
        if (!arg.name) return null;
        var children = [];
        for (var i = 0; i < params.length; i++) {
          if (getChildren === true) {
            if (params[i].parentName.toLowerCase().trim() === arg.name.toLowerCase().trim()) {
              children.push(params[i]);
            }
          } else {
            if (params[i].name.toLowerCase().trim() === arg.name.toLowerCase().trim()) {
              return params[i];
            }
          }
        }
        if (getChildren === true) return children;
        return null;
      };
      var getParamDetailedName = function(param) {
        var name = param.name;
        if (param.optional === true) {
          if (param.defaultValue) {
            name = "[" + name + "=" + param.defaultValue + "]";
          } else {
            name = "[" + name + "]";
          }
        }
        return name;
      };
      var useDetailedArgHints = params.length === 0 || !isNaN(parseInt(activeArg));
      var typeStr = '';
      typeStr += htmlEncode(data.exprName || data.name || "fn");
      typeStr += "(";
      var activeParam = null,
        activeParamChildren = []; //one ore more child params for multiple object properties

      for (var i = 0; i < fnArgs.args.length; i++) {
        var paramStr = '';
        var isCurrent = !isNaN(parseInt(activeArg)) ? i === activeArg : false;
        var arg = fnArgs.args[i]; //name,type
        var name = arg.name || "?";
        if (name.length > 1 && name.substr(name.length - 1) === '?') {
          name = name.substr(0, name.length - 1);
          arg.name = name; //update the arg var with proper name for use below
        }

        if (!useDetailedArgHints) {
          paramStr += htmlEncode(name);
        } else {
          var param = getParam(arg, false);
          var children = getParam(arg, true);
          var type = arg.type;
          var optional = false;
          var defaultValue = '';
          if (param !== null) {
            name = param.name;
            if (param.type) {
              type = param.type;
            }
            if (isCurrent) {
              activeParam = param;
            }
            optional = param.optional;
            defaultValue = param.defaultValue.trim();
          }
          if (children && children.length > 0) {
            if (isCurrent) {
              activeParamChildren = children;
            }
            type = "{";
            for (var c = 0; c < children.length; c++) {
              type += children[c].name;
              if (c + 1 !== children.length && children.length > 1) type += ", ";
            }
            type += "}";
          }
          paramStr += type ? '<span class="' + cls + 'type">' + htmlEncode(type) + '</span> ' : '';
          paramStr += '<span class="' + cls + (isCurrent ? "farg-current" : "farg") + '">' + (htmlEncode(name) || "?") + '</span>';
          if (defaultValue !== '') {
            paramStr += '<span class="' + cls + 'jsdoc-param-defaultValue">=' + htmlEncode(defaultValue) + '</span>';
          }
          if (optional) {
            paramStr = '<span class="' + cls + 'jsdoc-param-optionalWrapper">' + '<span class="' + cls + 'farg-optionalBracket">[</span>' + paramStr + '<span class="' + cls + 'jsdoc-param-optionalBracket">]</span>' + '</span>';
          }
        }
        if (i > 0) paramStr = ', ' + paramStr;
        typeStr += paramStr;
      }

      typeStr += ")";
      if (fnArgs.rettype) {
        if (useDetailedArgHints) {
          typeStr += ' -> <span class="' + cls + 'type">' + htmlEncode(fnArgs.rettype) + '</span>';
        } else {
          typeStr += ' -> ' + htmlEncode(fnArgs.rettype);
        }
      }
      typeStr = '<span class="' + cls + (useDetailedArgHints ? "typeHeader" : "typeHeader-simple") + '">' + typeStr + '</span>'; //outer wrapper
      if (useDetailedArgHints) {
        if (activeParam && activeParam.description) {
          typeStr += '<div class="' + cls + 'farg-current-description"><span class="' + cls + 'farg-current-name">' + activeParam.name + ': </span>' + activeParam.description + '</div>';
        }
        if (activeParamChildren && activeParamChildren.length > 0) {
          for (var i = 0; i < activeParamChildren.length; i++) {
            var t = activeParamChildren[i].type ? '<span class="' + cls + 'type">{' + activeParamChildren[i].type + '} </span>' : '';
            typeStr += '<div class="' + cls + 'farg-current-description">' + t + '<span class="' + cls + 'farg-current-name">' + getParamDetailedName(activeParamChildren[i]) + ': </span>' + activeParamChildren[i].description + '</div>';
          }
        }
      }
      html.push(typeStr);
    } else {
      if (!data.type && !data.doc) return "";
      if (data.type)
        html.push("<span>" + data.type + "<span></br>");
    }
    if (isNaN(parseInt(activeArg))) {
      if (data.doc) {
        var replaceParams = function(str, params) {
          if (params.length === 0) {
            return str;
          }
          str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
          var beforeParams = str.substr(0, str.indexOf('@param'));
          while (str.indexOf('@param') !== -1) {
            str = str.substring(str.indexOf('@param') + 6); //starting after first param match
          }
          if (str.indexOf('@') !== -1) {
            str = str.substr(str.indexOf('@')); //start at next tag that is not a param
          } else {
            str = ''; //@param was likely the last tag, trim remaining as its likely the end of a param description
          }
          var paramStr = '';
          for (var i = 0; i < params.length; i++) {
            paramStr += '<div>';
            if (params[i].parentName.trim() === '') {
              paramStr += ' <span class="' + cls + 'jsdoc-tag">@param</span> ';
            } else {
              paramStr += '<span class="' + cls + 'jsdoc-tag-param-child">&nbsp;</span> '; //dont show param tag for child param
            }
            paramStr += params[i].type.trim() === '' ? '' : '<span class="' + cls + 'type">{' + params[i].type + '}</span> ';

            if (params[i].name.trim() !== '') {
              var name = params[i].name.trim();
              if (params[i].parentName.trim() !== '') {
                name = params[i].parentName.trim() + '.' + name;
              }
              var pName = '<span class="' + cls + 'jsdoc-param-name">' + name + '</span>';
              if (params[i].defaultValue.trim() !== '') {
                pName += '<span class="' + cls + 'jsdoc-param-defaultValue">=' + params[i].defaultValue + '</span>';
              }
              if (params[i].optional) {
                pName = '<span class="' + cls + 'jsdoc-param-optionalWrapper">' + '<span class="' + cls + 'farg-optionalBracket">[</span>' + pName + '<span class="' + cls + 'jsdoc-param-optionalBracket">]</span>' + '</span>';
              }
              paramStr += pName;
            }
            paramStr += params[i].description.trim() === '' ? '' : ' - <span class="' + cls + 'jsdoc-param-description">' + params[i].description + '</span>';
            paramStr += '</div>';
          }
          if (paramStr !== '') {
            str = '<span class="' + cls + 'jsdoc-param-wrapper">' + paramStr + '</span>' + str;
          }

          return beforeParams + str;
        };
        var highlighTags = function(str) {
          try {
            str = ' ' + str + ' '; //add white space for regex
            var re = / ?@\w{1,50}\s ?/gi;
            var m;
            while ((m = re.exec(str)) !== null) {
              if (m.index === re.lastIndex) {
                re.lastIndex++;
              }
              str = str.replace(m[0], ' <span class="' + cls + 'jsdoc-tag">' + m[0].trim() + '</span> ');
            }
          } catch (ex) {
            this.showError(editor, ex);
          }
          return str.trim();
        };
        var highlightTypes = function(str) {
          str = ' ' + str + ' '; //add white space for regex
          try {
            var re = /\s{[^}]{1,50}}\s/g;
            var m;
            while ((m = re.exec(str)) !== null) {
              if (m.index === re.lastIndex) {
                re.lastIndex++;
              }
              str = str.replace(m[0], ' <span class="' + cls + 'type">' + m[0].trim() + '</span> ');
            }
          } catch (ex) {
            this.showError(editor, ex);
          }
          return str.trim();
        };
        var createLinks = function(str) {
          try {
            var httpProto = 'HTTP_PROTO_PLACEHOLDER';
            var httpsProto = 'HTTPS_PROTO_PLACEHOLDER';
            var re = /\bhttps?:\/\/[^\s<>"`{}|\^\[\]\\]+/gi;
            var m;
            while ((m = re.exec(str)) !== null) {
              if (m.index === re.lastIndex) {
                re.lastIndex++;
              }
              var withoutProtocol = m[0].replace(/https/i, httpsProto).replace(/http/i, httpProto);
              var text = m[0].replace(new RegExp('https://', 'i'), '').replace(new RegExp('http://', 'i'), '');
              str = str.replace(m[0], '<a class="' + cls + 'tooltip-link" href="' + withoutProtocol + '" target="_blank">' + text + ' </a>');
            }
            str = str.replace(new RegExp(httpsProto, 'gi'), 'https').replace(new RegExp(httpProto, 'gi'), 'http');
          } catch (ex) {
            this.showError(editor, ex);
          }
          return str;
        };

        if (d.substr(0, 1) === '*') {
          d = d.substr(1); //tern leaves this for jsDoc as they start with /**, not exactly sure why...
        }
        d = htmlEncode(d.trim());
        d = replaceParams(d, params);
        d = highlighTags(d);
        d = highlightTypes(d);
        d = createLinks(d);
        html.push(d);
      }
      /*if (data.url) {
          tip.appendChild(document.createTextNode(" "));
          var link = elt("a", null, "[docs]");
          link.target = "_blank";
          link.href = data.url;
          tip.appendChild(link);
      }
      if (data.origin) {
          tip.appendChild(elt("div", null, elt("em", null, "source: " + data.origin)));
      }*/
    }
    return html.join("");
  };

  exports.TernServer = TernServer;


  function WorkerServer(ts, workerClass) {
    var worker = workerClass ? new workerClass() : new Worker(ts.options.workerScript);
    var startServer = function(ts) {
      worker.postMessage({
        type: "init",
        defs: ts.options.defs,
        plugins: ts.options.plugins,
        scripts: ts.options.workerDeps
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
    worker.onmessage = function(e) {
      var data = e.data;
      if (data.type == "getFile") {
        getFile(ts, data.name, function(err, text) {
          send({
            type: "getFile",
            err: String(err),
            text: text,
            id: data.id
          });
        });
      } else if (data.type == "debug") {
        console.log('(worker debug) ', data.message);
      } else if (data.id && pending[data.id]) {
        pending[data.id](data.err, data.body);
        delete pending[data.id];
      }
    };
    worker.onerror = function(e) {
      for (var id in pending) pending[id](e);
      pending = {};
    };

    this.addFile = function(name, text) {
      send({
        type: "add",
        name: name,
        text: text
      });
    };
    this.delFile = function(name) {
      send({
        type: "del",
        name: name
      });
    };
    this.request = function(body, c) {
      send({
        type: "req",
        body: body
      }, c);
    };
    this.restart = function(ts) {
      startServer(ts);
    };
    this.sendDebug = function(message) {
      send({
        type: "debug",
        body: message
      });
    };
    this.addDefs = function(defs, infront) {
      send({
        type: "addDefs",
        defs: defs
      });
    };
    this.deleteDefs = function(defs) {
      send({
        type: "delDefs",
        defs: defs
      });
    };
    this.terminate = function() {
      worker.terminate();
      pending = {};
    }
  }
}); /*_EndDefine*/