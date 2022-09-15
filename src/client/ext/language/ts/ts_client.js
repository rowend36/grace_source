define(function (require, exports, module) {
  var Utils = require('grace/core/utils').Utils;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var BaseClient = require('grace/ext/language/base_client').BaseClient;
  var S = require('grace/ext/language/base_client').ClientUtils;
  var debug = console;
  var getDoc = S.getDoc;
  var docValue = S.docValue;
  var Depend = require('grace/core/depend');
  var Docs = require('grace/docs/docs').Docs;
  var modelist = require('ace!ext/modelist');
  var Autocomplete = require('ace!autocomplete').Autocomplete;

  var FileUtils = require('grace/core/file_utils').FileUtils;
  /**@constructor*/
  var TsClient = function (options) {
    BaseClient.call(this, options);
    var Transport = options.useWorker ? WorkerTransport : BasicTransport;
    this.transport =
      options.transport || new Transport(this.requestFile.bind(this));
    this.restart(this.options.compilerOptions);
    this.provider = options.provider;
  };

  var debugCompletions = false;
  var TEMP_DIR = '/tmp_0/';
  function sum(doc) {
    var a = doc.getLength();
    if (a < 1) return 0;
    var sum = doc.getLine(0).length;
    for (var i = 1; i < a; i++) {
      sum += doc.getLine(i).length + 1;
    }
    return sum;
  }
  TsClient.prototype = Object.assign(Object.create(BaseClient.prototype), {
    queryTimeout: 4000,
    sendFragments: true,
    //Hacks to make Ts Server happy
    fixFilename: /^config\.json(?:~+\d+)?$/,
    $fixName: function (name) {
      return name.startsWith('temp:')
        ? getTempFileName(this, name)
        : getValidFile(this, name);
    },
    $unfixName: function (name, o) {
      if (this.docs[name]) return name;
      if (name.startsWith(TEMP_DIR))
        return 'temp:' + name.slice(TEMP_DIR.length, name.lastIndexOf('.'));
      else {
        var fixed = name.slice(0, name.lastIndexOf('.'));
        return this.fixFilename.test(fixed) ? fixed : name;
      }
    },
    sendDoc: function (doc, cb) {
      var ts = this;
      var changes = ts.getChanges(doc);
      var message;
      if (doc.version && changes) {
        changes[changes.length - 1].checksum = sum(doc.doc);
        message = {
          type: 'updateDoc',
          args: [this.$fixName(doc.name), changes, doc.version],
        };
        doc.version++;
      } else {
        doc.version = Math.floor(Math.random() * 10000000);
        message = {
          type: 'addDoc',
          args: [this.$fixName(doc.name), docValue(ts, doc), doc.version],
        };
      }
      //Coordinating this is work, but figured it out eventually,
      var expected = doc.version;
      ts.transport.postMessage(message, function (error, version) {
        if (error || (version != expected && ts.docs[name])) {
          //possible corruption, force full refresh
          ts.invalidateDoc(ts.docs[name]);
        }
        cb && cb(error);
      });
    },
    releaseDoc: function (name) {
      this.transport.postMessage({
        type: 'delDoc',
        args: [this.$fixName(name)],
      });
    },
    destroy: function () {
      BaseClient.prototype.destroy.call(this);
      this.transport.terminate();
    },
    insertMatch: function (editor, match) {
      var completions = editor.completer.completions;
      if (completions.filterText) {
        editor.execCommand(Autocomplete.$deletePrefix, completions.filterText);
      }
      editor.execCommand('insertstring', match.data.label);
    },
    $getPos: function (editor, pos) {
      return editor.session
        .getDocument()
        .positionToIndex(pos || editor.getSelection().getCursor());
    },
    $toAceRefs: function (data) {
      var failed = false;
      var name;
      data = {
        refs: data.map(function (e) {
          name = name || e.name;
          var file = this.$unfixName(e.fileName);
          var data = this.docs[file],
            session;
          if (data && typeof data.doc == 'object') {
            session = data.doc;
          }

          failed = failed || !session;
          return {
            file: file,
            start: session && toAceLoc(session, e.textSpan.start),
            end:
              session &&
              toAceLoc(session, e.textSpan.start + e.textSpan.length),
            //used in setupForRename
            span: session ? null : e.textSpan,
          };
        }, this),
      };
      data.name = name;
      data.loaded = !failed;
      return data;
    },
    requestFile: function (path) {
      this.options.readFile(
        path,
        function (e, res) {
          if (!e && res) {
            this.sendDoc(
              this.addDoc(path, res, true),
              function () {
                this.updateAnnotations(getEditor());
              }.bind(this),
            );
          }
        }.bind(this),
      );
    },
    requestArgHints: function (editor, start, cb) {
      var ts = this;
      var doc = getDoc(ts, editor.session);
      ts.send(
        'getSignatureHelpItems',
        [doc.name, ts.$getPos(editor)],
        function (e, res) {
          if (debugCompletions) debug.timeEnd('get definition');
          if (e) {
            debug.log(e);
            cb(e);
          } else {
            if (res) res.activeIndex = res.selectedItemIndex;
            cb(null, res);
          }
        },
      );
    },
    requestDefinition: function (editor, cb) {
      var ts = this;
      this.send('getDefinitionAtPosition', editor, function (e, res) {
        cb(e, res && ts.$toAceRefs(res).refs);
      });
    },
    requestType: function (editor, pos, cb) {
      this.send(
        'getQuickInfoAtPosition',
        [getDoc(this, editor.session).name, this.$getPos(editor, pos)],
        cb,
      );
    },
    getCompletions: function (editor, session, pos, prefix, callback) {
      var self = this;
      this.ui.closeAllTips();
      this.send('getCompletions', editor, function (e, r) {
        if (r) {
          callback(e, buildCompletions(r, self));
        } else callback(e);
      });
    },
    genArgHintHtml: function (args, activeIndex) {
      var createToken = this.ui.createToken.bind(this.ui);
      var doc = args.items[activeIndex];
      var html = [];
      for (var i in doc.prefixDisplayParts) {
        html.push(createToken(doc.prefixDisplayParts[i]));
      }
      for (var j = 0; j < doc.parameters.length; j++) {
        for (var m = 0; m < doc.parameters[j].displayParts.length; m++) {
          html.push(
            createToken(
              doc.parameters[j].displayParts[m],
              j == activeIndex ? 'active' : null,
            ),
          );
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
      if (doc.tags[activeIndex]) {
        html.push('<div>');
        var e = doc.tags[activeIndex];
        html.push(
          '</br>' +
            createToken({
              kind: 'paramName',
              text: e.name,
            }) +
            ':' +
            createToken({
              kind: 'paramDoc',
              text: e.text,
            }),
        );
        html.push('</div>');
      }
      return html.join('');
    },
    getDocTooltip: function (item) {
      var editor = getEditor();
      var ts = this;
      if (item.__type == ts && !item.docHTML && !item.hasDoc) {
        item.hasDoc = true;
        item.docHTML = this.send(
          'getCompletionEntryDetails',
          [getDoc(ts, editor.session).name, ts.$getPos(editor), item.data],
          function (e, r) {
            if (r) {
              item.docHTML = ts.genInfoHtml(r, true);
              editor.completer.updateDocTooltip();
            }
          },
        );
      }
    },
    genInfoHtml: function (doc /*, fromCompletion, fromCursorActivity*/) {
      var createToken = this.ui.createToken.bind(this.ui);
      var html = [];
      for (var i in doc.displayParts) {
        html.push(createToken(doc.displayParts[i]));
      }
      for (var j in doc.documentation) {
        html.push('<div>' + doc.documentation[j].text + '</div>');
      }
      return html.join('');
    },
    loadDependenciesFromErrors: function (file, annotations, cb) {
      /**
       * @typedef {{type:string,path:string,name?:string}} Dep
       *
       * @type {Array<Dep>} missing
       */
      var missing = [];
      var dir = file.startsWith('temp:/')
        ? '/'
        : FileUtils.normalize(FileUtils.dirname(file));
      if (dir === FileUtils.NO_PROJECT) {
        cb && cb();
        return false;
      }
      var uniq = {};
      annotations.forEach(function (e) {
        if (uniq[e.text]) return;
        uniq[e.text] = true;
        if (e.text.startsWith('Cannot find module')) {
          var res = /\'((?:[^']|\\.)*)\'/.exec(e.text);
          if (res) {
            var module = res[1];
            if (/^\.\.?\//.test(module)) {
              missing.push({
                type: 'source',
                path: FileUtils.resolve(dir, module),
              });
            } else {
              var nameIdx = module.lastIndexOf('/');
              missing.push({
                type: 'module',
                path: module,
                name: nameIdx > -1 ? module.substring(0, nameIdx) : module,
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
    resolveDependencies: function (dir, missing, cb) {
      require('./add_dependencies').addDependencies(this, dir, missing);
    },
    requestAnnotations: function (editor, cb) {
      var file = getDoc(this, editor.session).name;
      var ts = this;
      this.send('getAnnotations', editor, function (e, r) {
        if (r) {
          ts.loadDependenciesFromErrors(file, r);
          cb(e, r);
        } else cb(e, []);
      });
    },
    requestReferences: function (editor, cb) {
      var ts = this;
      this.send('getReferencesAtPosition', editor, function (e, refs) {
        cb(null, refs && ts.$toAceRefs(refs));
      });
    },
    requestRenameLocations: function (editor, newName, cb) {
      var ts = this;
      var doc = getDoc(this, editor.session);
      var data = {};
      Utils.waterfall([
        function (n) {
          ts.send('getRenameInfo', [doc.name, ts.$getPos(editor)], n);
        },
        function (n, e, res) {
          if (e) return n(e);
          if (!res.canRename) return n(res.localizedErrorMessage);
          data.name = res.displayName;
          ts.send('findRenameLocations', [doc.name, ts.$getPos(editor)], n);
        },
        function (n, e, refs) {
          n(e, refs && ts.$toAceRefs(refs));
        },
        true,
        cb,
      ]);
    },
    setupForRename: function (editor, newName, cb, cache) {
      var ts = this;
      Utils.waterfall([
        function (n) {
          BaseClient.prototype.setupForRename.call(
            ts,
            editor,
            newName,
            n,
            cache,
          );
        },
        function (n, e, data) {
          if (data) {
            data.refs.forEach(function (e) {
              if (e.start) return;
              var data = ts.docs[e.file];
              var doc = data && data.doc;
              e.start = doc && toAceLoc(doc, e.span.start);
              e.end = doc && toAceLoc(doc, e.span.start + e.span.length);
            });
          }
          return n(e, data);
        },
        true,
        cb,
      ]);
    },
    restart: function (compilerOpts) {
      this.options.compilerOptions = compilerOpts;
      for (var i in this.docs) {
        this.invalidateDoc(this.docs[i]);
      }
      this.send('restart', [compilerOpts]);
    },
    debugCompletions: function (value) {
      if (value) debugCompletions = true;
      else debugCompletions = false;
    },
    send: function (type, args, cb) {
      var transport = this.transport;
      if (args && args.session) {
        var doc = getDoc(this, args.session);
        var pos = this.$getPos(args);
        if (doc.fragOnly && this.sendFragments) {
          this.sendDoc({name: doc.name, text: ''});
          pos = 0;
        }
        args = [this.$fixName(doc.name), pos];
      } else if (type !== 'restart') {
        args[0] = this.$fixName(args[0]);
      }
      var counter = Utils.createCounter(function () {
        transport.postMessage(
          {
            type: type,
            args: args,
          },
          cb,
        );
      });
      counter.increment();
      if (type !== 'restart') {
        for (var i in this.docs) {
          if (this.docs[i].changed) {
            counter.increment();
            this.sendDoc(this.docs[i], counter.decrement);
          }
        }
      }
      counter.decrement();
    },
  });
  //Most Language Service Providers have problems
  //dealing with non-local files, but can handle
  //non-existent local files all right
  function getTempFileName(ts, name) {
    var doc = Docs.forPath(name);
    if (!doc) return name;
    if (doc.$lspName) {
      return doc.$lspName;
    }
    var t = doc.session.getModeName();
    var ext = S.getExtension(
      ts.provider.modes.indexOf(t) < 0 ? ts.provider.modes[0] : t,
    );
    return ext ? name.replace('temp:/', TEMP_DIR) + '.' + ext : name;
  }

  function getValidFile(ts, name) {
    if (!ts.$validExtensions)
      ts.$validExtensions = ts.provider.modes.map(S.getExtension);
    var ext = FileUtils.extname(name);
    if (ts.$validExtensions.indexOf(ext) > -1) return name;
    if (!ts.fixFilename.test(name)) return name;
    var mode = modelist.getModeForPath(name).name;
    if (ts.provider.modes.indexOf(mode) < 0) {
      return name + '.' + ts.$validExtensions[0];
    } else {
      ts.$validExtensions.push(ext);
      return name;
    }
  }

  function toAceLoc(session, index) {
    return session.getDocument().indexToPosition(index);
  }

  function buildCompletions(completions, ts) {
    var entries;
    if (completions && completions.entries) {
      var MAX = completions.isMemberCompletion
        ? BaseClient.PRIORITY_HIGH
        : BaseClient.PRIORITY_MEDIUM;
      entries = completions.entries.map(function (e) {
        return {
          value: e.name,
          data: e.name, //Used to resolve documentation
          caption: e.name,
          message: e.kindModifiers + ' ' + e.kind,
          iconClass: ts.ui.iconClass(e.kind || 'unknown', e.kindModifiers),
          score: MAX - parseInt(e.sortText),
          __type: ts,
        };
      });
    }
    return entries;
  }

  var BasicTransport = function (onRequestFile) {
    /*globals TsServer*/
    var instance;
    this.postMessage = Depend.after(
      function (cb) {
        require(['./libs/ts_worker'], function () {
          instance = new TsServer(onRequestFile);
          cb();
        });
      },
      function (data, cb) {
        var res, error;
        try {
          res = (instance[data.type] || instance.getLSP()[data.type]).apply(
            instance,
            data.args,
          );
        } catch (e) {
          error = e;
          debug.error(error);
        }
        cb && cb(error, res);
      },
    );
  };
  var WorkerTransport = function (onRequestFile) {
    var waiting = {};
    var lastId = 1;
    var worker = new Worker(
      FileUtils.resolve(FileUtils.dirname(module.uri), './libs/ts_worker.js'),
    );
    this.postMessage = function (data, cb) {
      if (cb) {
        data.id = lastId;
        waiting[lastId++] = cb;
      } else data.id = 0;
      worker.postMessage(data);
    };
    worker.onmessage = function (e) {
      var data = e.data;
      if (data.type == 'getFile') {
        return onRequestFile(data.path);
      }
      var cb = waiting[data.id];
      var error = data.error && Object.assign(new Error(), data.error);
      if (error) debug.error(error);
      if (cb) {
        delete waiting[data.id];
        cb(error, data.res);
      }
    };
    worker.onerror = function (e) {
      for (var i in waiting) {
        waiting[i](e);
      }
      console.log(e);
      debug.error(e);
      waiting = {};
    };
    this.terminate = function () {
      worker.terminate();
      waiting = {};
    };
  };

  exports.TsClient = TsClient;
}); /*_EndDefine*/