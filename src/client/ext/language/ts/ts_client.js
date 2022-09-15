define(function (require, exports, module) {
  var Utils = require('grace/core/utils').Utils;
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var BaseClient = require('grace/ext/language/base_client').BaseClient;
  var S = require('grace/ext/language/base_client').ClientUtils;
  var debug = console;
  var getDoc = S.getDoc;
  var docValue = S.docValue;
  var Depend = require('grace/core/depend');

  var FileUtils = require('grace/core/file_utils').FileUtils;
  /**@constructor*/
  var TsClient = function (options) {
    BaseClient.call(this, options);
    var Transport = options.useWorker ? WorkerTransport : BasicTransport;
    this.transport =
      options.transport || new Transport(this.requestFile.bind(this));
    this.restart(this.options.compilerOptions);
  };

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
  TsClient.prototype = Object.assign(Object.create(BaseClient.prototype), {
    name: 'tsClient',
    sendDoc: function (doc, cb) {
      var ts = this;
      var changes = ts.getChanges(doc);
      var message;
      if (doc.version && changes) {
        changes[changes.length - 1].checksum = sum(doc.doc);
        message = {
          type: 'updateDoc',
          args: [doc.name, changes, doc.version],
        };
        doc.version++;
      } else {
        doc.version = Math.floor(Math.random() * 10000000);
        message = {
          type: 'addDoc',
          args: [doc.name, docValue(ts, doc), doc.version],
        };
      }
      //Coordinating this is work, but figured it out eventually,
      var expected = doc.version;
      ts.transport.postMessage(message, function (error, version) {
        if (error || version != expected) {
          //possible corruption, force full refresh
          ts.invalidateDoc(ts.docs[name]);
        }
        cb && cb(error);
      });
    },
    releaseDoc: function (name) {
      this.transport.postMessage({
        type: 'delDoc',
        args: [name],
      });
    },
    destroy: function () {
      this.transport.terminate();
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
          var data = this.docs[e.fileName],
            session;
          if (data && typeof data.doc == 'object') {
            session = data.doc;
          }

          failed = failed || !session;
          return {
            file: e.fileName,
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
              }.bind(this)
            );
          }
        }.bind(this)
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
            return debug.log(e);
          } else if (!res) return;
          cb(res);
        }
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
        cb
      );
    },
    normalizeName: function (name) {
      if (!/[^\.\/]\.([tj]sx?)+$/.test(name)) return name + '.js';
      return name;
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
    genArgHintHtml: function (args, argpos) {
      var createToken = this.ui.createToken.bind(this.ui);
      var doc = args.items[args.selectedItemIndex];
      var html = [];
      for (var i in doc.prefixDisplayParts) {
        html.push(createToken(doc.prefixDisplayParts[i]));
      }
      for (var j = 0; j < doc.parameters.length; j++) {
        for (var m = 0; m < doc.parameters[j].displayParts.length; m++) {
          html.push(
            createToken(
              doc.parameters[j].displayParts[m],
              j == argpos ? 'active' : null
            )
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
      if (doc.tags[argpos]) {
        html.push('<div>');
        var e = doc.tags[argpos];
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
            })
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
          }
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
      var dir = FileUtils.normalize(FileUtils.dirname(file));
      annotations.forEach(function (e) {
        if (e.text.startsWith('Cannot find')) {
          var res = /\'(.*)\'/.exec(e.text);
          if (res) {
            var module = res[1];
            if (/\.?\.?\//.test(module))
              missing.push({
                type: 'source',
                path: FileUtils.resolve(dir, module),
              });
            else {
              var name = module.lastIndexOf('/');
              missing.push({
                type: 'module',
                path: module,
                name: module.substring(0, name > -1 ? name - 1 : module.length),
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
      require('./add_dependencies').addDependencies(this, dir, missing, cb);
    },
    requestAnnotations: function (editor, cb) {
      var file = getDoc(this, editor.session).name;
      var ts = this;
      this.send('getAnnotations', editor, function (e, r) {
        if (r) {
          ts.loadDependenciesFromErrors(file, r);
          cb(r);
        } else cb([]);
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
            cache
          );
        },
        function (n, e, data) {
          if (data) {
            data.refs.forEach(function (e) {
              if (e.start) return;
              var doc = ts.docs[e.file].doc;
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
        args = [getDoc(this, args.session).name, this.$getPos(args)];
      }
      var counter = Utils.createCounter(function () {
        transport.postMessage(
          {
            type: type,
            args: args,
          },
          cb
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
            data.args
          );
        } catch (e) {
          error = e;
          debug.error(error);
        }
        cb && cb(error, res);
      }
    );
  };
  var WorkerTransport = function (onRequestFile) {
    var waiting = {};
    var lastId = 1;
    var worker = new Worker(FileUtils.resolve(module.uri, './libs/ts_worker'));
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
      if (data.error) debug.error(data.error);
      if (cb) {
        delete waiting[data.id];
        cb(data.error, data.res);
      }
    };
    worker.onerror = function (e) {
      for (var i in waiting) {
        waiting[i](e);
      }
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