define(function (require, exports, module) {
  var UI = require('./lsp_ui').LspUI;
  var debugCompletions = false;
  var Utils = require('grace/core/utils').Utils;
  var TokenIterator = require('ace!token_iterator').TokenIterator;
  var EventsEmitter = require('grace/core/events_emitter').EventsEmitter;
  var debug = console;
  var Notify = require('grace/ui/notify').Notify;
  var modelist = require('ace!ext/modelist');
  /** @namespace base_client */
  //TODO handle rename of documents
  
  var FAILED = 'Operation failed';
  function BaseClient(options, iconClass) {
    BaseClient.super(this);
    this.docs = Object.create(null);
    this.options = options || {};
    this.ui = this.options.ui || new UI(null, iconClass);
    if (!this.options.hasOwnProperty('switchToDoc'))
      this.options.switchToDoc = function (name, start) {
        debug.log(
          'tern.switchToDoc called but not defined (need to specify this in options to enable jumping between documents). name=' +
            name +
            '; start=',
          start,
        );
      };
    this.$onDestroySession = this.$onDestroySession.bind(this);
    this.trackChange = this.trackChange.bind(this);
  }
  //properties if accurate
  BaseClient.PRIORITY_HIGH = 2000;
  //functions, close vars,
  BaseClient.PRIORITY_MEDIUM = 400;
  //garbage
  BaseClient.PRIORITY_LOW = 200;
  BaseClient.prototype = {
    maxSize: 1000000,
    functionHintTrigger: null,
    /*Abstract methods*/
    getCompletions: null,
    requestDefinition: null,
    requestReferences: null,
    requestRenameLocations: null,
    requestAnnotations: null,
    requestArgHints: null,
    requestType: null,
    normalizeName: function (name) {
      //0 issues with unknown names
      return name;
    },
    genInfoHtml: null,
    genArgHintHtml: null,
    sendDoc: null,
    releaseDoc: null,
    restart: null,
    /*Core API*/
    //Provider.hasDefinition
    currentJumpList: null,
    lastJumpPosition: null,
    jumpToDef: function (editor, cb) {
      var ts = this;
      if (ts.currentJumpList) {
        var lastJump = ts.lastJumpPosition;
        var currentPos = editor.getSelectionRange();
        if (lastJump && lastJump.intersects(currentPos)) {
          var index = ts.currentJumpList.indexOf(lastJump.data) + 1;
          if (index > 0) {
            if (index == ts.currentJumpList.length) {
              index = 0; //continue reusing jumpList in case sorting has changed
            }
            ts.markPos(editor);
            ts.goto(editor, ts.currentJumpList[index], cb);
            return;
          }
        }
        ts.currentJumpList = null;
      }
      this.requestDefinition(editor, function (err, pos) {
        if (!pos) {
          err = err || 'Could not find a definition.';
          return cb ? cb(err) : ts.ui.showError(editor, err);
        } else if (pos.url) {
          if (Env.newWindow)
            Notify.ask(
              'Open ' + pos.url + '?',
              function () {
                Env.newWindow(pos.url);
                cb();
              },
              cb,
            );
          else cb(FAILED);
        } else {
          ts.markPos(editor);
          if (Array.isArray(pos)) {
            if (pos.length < 1) return;
            ts.currentJumpList = pos;
            pos = pos[0];
          }
          ts.goto(editor, pos, cb);
        }
      });
    },
    jumpBack: function (editor, cb) {
      if (editor.jumpStack) {
        var pos = editor.jumpStack.pop();
        if (pos) {
          //In case, this client did not put it there
          pos.file = this.normalizeName(pos.file);
          return this.goto(editor, pos, cb, true);
        }
      }
      cb(FAILED);
    },
    markPos: function (editor) {
      var data = getDoc(this, editor.session);
      if (!editor.jumpStack) editor.jumpStack = [];
      editor.jumpStack.push({
        file: data.name,
        start: editor.getSelectionRange().start,
        end: editor.getSelectionRange().end,
      });
    },
    goto: function (editor, ref, cb, keepTips, ignoreClosed) {
      var data = this.docs[ref.file];
      if (ignoreClosed && (!data || !data.doc)) return cb && cb(FAILED);
      var current = getDoc(this, editor.session);
      if (current.name == ref.file) {
        setSelection(this, editor, ref);
        return cb();
      }
      if (!keepTips) {
        this.ui.closeAllTips();
      }
      //hack for tern relative paths till we fix it
      return this.options.switchToDoc(
        ref.file,
        null,
        null,
        data && data.doc,
        function (err, editor) {
          if (editor) setSelection(this, editor, ref);
          cb(err || (!editor && FAILED));
        }.bind(this),
      );
    },
    //Provider.hasAnnotations
    updateAnnotations: function (editor, cb) {
      var ts = this;
      var session = editor.session;
      this.requestAnnotations(editor, function (e, r) {
        if (e && !r) r = [];
        if (r)
          ts.trigger('annotate', {
            data: r,
            session: session,
          });
        if (cb) cb(e);
      });
    },
    //Provider.hasReferences
    findRefs: function (editor, cb) {
      var ts = this;
      this.requestReferences(editor, function (err, data) {
        if (err) ts.ui.showError(editor, err);
        else if (!data) {
          ts.ui.showError(
            editor,
            'Unable to find references at current position.',
          );
        } else {
          ts.loadFiles(data, function (err, data) {
            ts.ui.referenceDialog(ts, editor, data);
          });
          return cb && cb();
        }
        if (typeof cb === 'function') {
          cb(err || FAILED);
        }
      });
    },
    loadFiles: function (data, cb) {
      var ts = this;
      data.files = {};
      Utils.asyncForEach(
        data.refs,
        function (ref, i, next) {
          if (data.files[ref.file] || ts.docs[ref.file]) return next();
          data.files[ref.file] = true;
          ts.options.readFile(name, function (err, res) {
            data.files[ref.file] = res;
          });
        },
        function () {
          cb(null, data);
        },
      );
    },
    //Provider.hasArgHints
    cachedArgHints: null,
    updateArgHints: function (editor) {
      showHoverTooltip(this, editor);
    },
    /**
     * @param {Editor} editor
     * @param {AcePosition} pos
     * @param {(err:any,callpos:(CallPosition|null))=>void} cb
     */
    getCallPos: function (editor, pos, cb) {
      return cb(null, getCallPos(editor, pos));
    },
    //Provider.hasTypeInformation
    showType: function (editor, pos, calledFromCursorActivity, _cb) {
      if (calledFromCursorActivity) {
        if (
          editor.completer &&
          editor.completer.popup &&
          editor.completer.popup.isOpen
        )
          return _cb && _cb();
      }
      var ts = this;
      if (ts.cachedArgHints && ts.cachedArgHints.isClosed)
        ts.cachedArgHints.isClosed = false;
      var cb = function (error, data) {
        if (error) {
          if (!calledFromCursorActivity) {
            ts.ui.showError(editor, error);
          }
          return _cb(true);
        }
        if (!data) return;
        ts.ui.closeAllTips();
        var tip = ts.genInfoHtml(data, false, calledFromCursorActivity);
        //server is still busy
        if (tip === '?') tip = ts.ui.tempTooltip(editor, '?', 1000);
        else if (tip) ts.ui.makeTooltip(null, null, tip, editor, true);
        if (_cb) _cb();
      };
      try {
        ts.requestType(editor, pos, cb, calledFromCursorActivity);
      } catch (e) {
        debug.error(e);
      }
    },
    //Provider.hasRename
    /** Start rename by showing a dialog**/
    rename: function (editor, cb) {
      var ts = this;
      this.requestRenameLocations(editor, null, function (e, r) {
        if (!r || r.refs.length === 0) {
          ts.ui.showError(editor, e || 'No references were found.');
          return cb && cb(e || FAILED);
        }
        ts.ui.renameDialog(ts, editor, r);
        if (cb) cb();
      });
    },
    /**Prepare a document for renaming. Can also find additional refs.*/
    setupForRename: function (editor, newName, cb, cache) {
      var ts = this;
      Utils.waterfall([
        function (n) {
          if (!cache) ts.requestRenameLocations(editor, newName, n);
          else n(null, cache);
        },
        function (n, err, data) {
          if (!data) return n(err, data);
          ts.openFiles(data, n);
        },
        true,
        cb,
      ]);
    },
    /*Load all referenced documents into the editor*/
    openFiles: function (data, cb) {
      var ts = this;
      var refs = data.refs;
      var opened = {};
      Utils.asyncForEach(
        refs,
        function (ref, i, next, cancel) {
          var file = ref.file;
          var data = ts.docs[file] || ts.addDoc(file, '');
          if (data && data.doc) return next();
          if (opened[file]) return next();
          opened[file] = true;
          //File might be deleted or renamed
          ts.options.switchToDoc(
            file,
            null,
            null,
            null,
            function (err, editor) {
              if (!editor)
                Notify.warn('Failed to open ' + data.name + ' for rename.');
              else if (data.name != getDoc(ts, editor.session).name)
                cancel(
                  'Internal error: Switch to Document ' +
                    data.name +
                    ' failed.',
                );
              else next();
            },
          );
        },
        cb.bind(null, null, data),
        5, //parallel
      );
    },
    executeRename: function (editor, newName, cache) {
      var self = this;
      Utils.waterfall([
        function (n) {
          self.setupForRename(editor, newName, n, cache);
        },
        function (n, error, data) {
          if (error) return self.ui.showError(editor, error);
          applyChanges(self, data.refs, newName, n);
        },
        function (result) {
          //ts.ui.refsTooltip(editor,result)
          var infoMsg =
            'Replaced ' + result.replaced + ' references sucessfully';
          var errorMsg = '';
          if (result.replaced != result.total) {
            errorMsg =
              ' WARNING! Replaced only ' +
              result.replaced +
              ' out of ' +
              result.total +
              ' locations ';
          }
          if (result.errors !== '') {
            errorMsg += ' \n Errors encountered:' + result.errors;
          }
          if (errorMsg !== '') {
            self.ui.showError(editor, errorMsg);
          } else {
            self.ui.showInfo(editor, infoMsg);
          }
        },
        function (error) {
          if (error) debug.error(error);
        },
      ]);
    },
    /*Document Management*/
    addDoc: function (name, session_or_text, preferSession) {
      name = this.normalizeName(name);
      var session =
        session_or_text.constructor.name === 'String' ? null : session_or_text;
      var text = session ? null : session_or_text;
      var data = {
        name: name,
        changed: null,
      };
      if (this.docs[name] && this.docs[name].doc) {
        if (!session && preferSession !== false) return this.docs[name];
        this.closeDoc(name);
      }
      if (session) {
        data.doc = session;
        if (session.getValue().length > this.maxSize) {
          //todo add getSize to EditSession
          data.fragOnly = true;
        } else {
          session.on('change', this.trackChange);
        }
        session.on('destroy', this.$onDestroySession);
      } else if (text.length > this.maxSize) data.fragOnly = true;
      //for now we handle large docs by not loading them
      if (!data.fragOnly)
        this.sendDoc(session ? data : Object.assign({text: text}, data));
      return (this.docs[name] = data);
    },
    refreshDoc: function (editor, full) {
      if (full) {
        this.resetDocs(editor);
        return this.ui.showInfo(editor, 'Full refresh completed.');
      }
      var data = getDoc(this, editor.session);
      //for now we handle large docs by not loading them
      if (data.fragOnly) return this.ui.showError(editor, 'Document Too Large');
      this.sendDoc(data);
      this.ui.showInfo(editor, 'Document refreshed');
    },
    closeDoc: function (name) {
      name = this.normalizeName(name);
      var data = this.docs[name];
      if (data && data.doc) {
        data.doc.off('change', this.trackChange);
        data.doc.off('destroy', this.$onDestroySession);
        data.changed = true;
        data.doc = null;
      }
    },
    removeDoc: function (name) {
      name = this.normalizeName(name);
      var found = this.docs[name];
      if (!found) return;
      this.closeDoc(name);
      delete this.docs[name];
      this.releaseDoc(name);
    },
    hasDoc: function (name_or_session) {
      if (typeof name_or_session == 'string') {
        return this.docs[this.normalizeName(name_or_session)];
      } else return findData(this, name_or_session);
    },
    resetDocs: function (editor) {
      var session, oldData;
      if (editor) {
        session = editor.session;
        oldData = findData(this, session);
      }
      for (var p in this.docs) {
        this.removeDoc(p);
      }
      if (session) getDoc(this, session, oldData && oldData.name);
    },
    $onDestroySession: function (session) {
      var data = findData(this, session);
      if (data) this.closeDoc(data.name);
    },
    getChanges: function (doc) {
      var changes = doc.changes;
      doc.changes = null;
      doc.changed = null;
      return changes;
    },
    invalidateDoc: function (doc) {
      if (doc) {
        doc.changed = true;
        doc.changes = null;
      }
    },
    trackChange: function (change, session) {
      if (change.action === 'remove' || change.action == 'insert') {
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
      if (
        argHints &&
        argHints.doc == session &&
        cmpPos(argHints.start, change.end) <= 0
      ) {
        this.cachedArgHints = null;
      }
    },
    destroy: function () {
      this.resetDocs();
      this.trigger('destroy');
    },
  };
  Utils.inherits(BaseClient, EventsEmitter);

  var debounce_updateArgHints = null;
  /**
   * @param {BaseClient} ts
   * @param {Editor} editor
   */
  function showHoverTooltip(ts, editor) {
    clearTimeout(debounce_updateArgHints);
    var cursor = editor.getSelectionRange().start;
    if (
      somethingIsSelected(editor) ||
      (editor.completer && editor.completer.activated)
    ) {
      return ts.ui.closeAllTips();
    }
    if (ts.functionHintTrigger) {
      var trigger = ts.functionHintTrigger;
      var token = editor.session.getTokenAt(cursor);
      if (token && /string|comment/.test(token.type)) {
        return ts.ui.closeArgHints(ts);
      }
      token = editor.session.getTextRange({
        start: cursor,
        end: {
          row: cursor.row + 1,
          column: cursor.column,
        },
      });
      //get character next to cursor ignore space
      var b = token.replace(/^\s+/, '')[0];
      if (!b || trigger.indexOf(b) < 0) {
        token = editor.session.getTextRange({
          end: cursor,
          start: {
            row: cursor.row - 1,
            column: cursor.column,
          },
        });
        b = token.replace(/\s+$/, '');
        if (!b || trigger.indexOf(b.substring(b.length - 1)) < 0)
          return ts.ui.closeArgHints(ts);
      }
    }
    //First request call position to know if we need new arg hints
    ts.getCallPos(editor, cursor, function (err, callPos) {
      if (!callPos) return ts.ui.closeArgHints(ts);
      var cachedArgs = ts.cachedArgHints;
      if (
        cachedArgs &&
        cachedArgs.doc == editor.session &&
        cmpPos(callPos.start, cachedArgs.start) === 0 &&
        cachedArgs.name == callPos.name
      ) {
        return ts.ui.showArgHints(ts, editor, callPos.activeIndex);
      } else {
        ts.ui.closeArgHints(ts);
        debounce_updateArgHints = setTimeout(function () {
          if (debugCompletions) {
            debug.time('get definition');
          }
          var session = editor.session;
          ts.requestArgHints(editor, callPos.start, function (err, argHints) {
            ts.cachedArgHints = argHints;
            if (!argHints) return;
            argHints.doc = argHints.doc || session;
            argHints.start = argHints.start || callPos.start;
            argHints.name = argHints.name || callPos.name;
            argHints.activeIndex =
              argHints.activeIndex || callPos.activeIndex || 0;
            if (editor.session === session)
              ts.ui.showArgHints(ts, editor, argHints.activeIndex);
            if (debugCompletions) debug.timeEnd('get definition');
          });
        }, 500);
      }
    });
  }

  function findData(ts, session) {
    for (var n in ts.docs) {
      var cur = ts.docs[n];
      if (cur.doc === session) return cur;
    }
    return null;
  }

  function getDoc(ts, session, name) {
    var data = findData(ts, session);
    if (data) return data;
    if (!name)
      if (ts.options.getFileName) {
        name = ts.options.getFileName(session);
      }
    var n;
    if (!name) {
      for (var i = 0; ; ++i) {
        n = '[doc' + (i || '') + ']'; //name not passed for new doc, so auto generate it
        if (!ts.docs[n]) {
          name = n;
          break;
        }
      }
    }
    return ts.addDoc(name, session);
  }

  function getCallPos(editor, pos) {
    if (!pos) pos = editor.getSelectionRange().start;
    var iterator = new TokenIterator(editor.session, pos.row, pos.column);
    var timeOut = new Date().getTime() + 1000;
    var token = iterator.getCurrentToken();
    if (!token) return null;
    //todo detect boundaries from syntax
    var maxLine = pos.row - 20;
    var start,
      numCommas = 0,
      depth = 0;
    var end = iterator.getCurrentTokenPosition();
    if (end.row == pos.row && end.column + token.value.length > pos.column) {
      token = {
        type: token.type,
        value: token.value.substring(0, pos.column - end.column),
      };
    }
    var type;

    function is(o) {
      return type.indexOf('.' + o + '.') > -1;
    }
    var a = 0;

    function time() {
      if (++a % 10) {
        var t = new Date().getTime();
        if (t > timeOut) throw new Error('Timed Out getting call pos');
      }
      return true;
    }
    while (token && iterator.getCurrentTokenRow() > maxLine && time()) {
      type = '.' + token.type + '.';
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
            type = name && '.' + name.type + '.';
            //test only works in jscript
            if (type && !(is('entity') || is('storage') || is('type'))) {
              start = iterator.getCurrentTokenPosition();
              if (start)
                return {
                  name: name.value,
                  start: start,
                  activeIndex: numCommas,
                };
            }
            return null;
          } else {
            return null;
          }
        } else if (depth === 0) {
          if (token.value[i] == ',') numCommas++;
        }
      }
      token = iterator.stepBackward();
    }
    return null;
  }

  function docValue(ts, data) {
    var val = data.doc ? data.doc.getValue() : data.text;
    if (val && ts.options.fileFilter)
      val = ts.options.fileFilter(val, data.name, data.doc);
    return val || '';
  }

  function somethingIsSelected(editor) {
    return editor.getSession().getTextRange(editor.getSelectionRange()) !== '';
  }

  function setSelection(ts, editor, pos) {
    var start, end, address;
    if (pos.hasOwnProperty('row')) {
      //AcePosition
      start = pos;
      end = pos;
    } else if (pos.hasOwnProperty('end')) {
      //Range
      start = pos.start;
      end = pos.end;
    } else if (pos.span) {
      //TextSpan
      var doc = editor.getSession().getDocument();
      start = doc.indexToPosition(pos.span.start);
      end = doc.indexToPosition(pos.span.start + pos.span.length);
    } else if (pos.address) {
      //ExCommand
      address = pos.address;
      address.forEach(function (e) {
        if (typeof e == 'number') {
          editor.gotoLine(e);
        } else editor.find(e);
      });
    }
    if (start) {
      editor.gotoLine(start.row, start.column || 0); //this will make sure that the line is expanded
      editor.session.unfold(start); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded
      var sel = editor.session.getSelection();
      sel.setSelectionRange({
        start: start,
        end: end,
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

  function getCurrentToken(editor) {
    try {
      var pos = editor.getSelectionRange().end;
      return editor.session.getTokenAt(pos.row, pos.column);
    } catch (ex) {
      return null;
    }
  }

  function applyChanges(ts, changes, defaultText, cb) {
    //TODO accept preorganised changes
    var perFile = Object.create(null);
    for (var i = 0; i < changes.length; ++i) {
      var ch = changes[i];
      (perFile[ch.file] || (perFile[ch.file] = [])).push(ch);
    }
    var result = {
      replaced: 0,
      status: '',
      errors: '',
      total: changes.length,
    };

    function compareRange(a, b) {
      return cmpPos(b.start, a.start);
    }
    for (var file in perFile) {
      var known = ts.docs[file],
        chs = perFile[file];
      if (!known) {
        result.errors += '\nCould not open ' + file;
      } //User has been warned in Notify.warn
      chs.sort(compareRange);
      for (var i2 = 0; i2 < chs.length; ++i2) {
        try {
          var ch2 = chs[i2];
          known.doc.replace(ch2, ch2.text || defaultText || '');
          result.replaced++;
        } catch (ex) {
          result.errors += '\n ' + file + ' - ' + ex.toString();
          debug.log('Error applying changes', ex);
        }
      }
    }
    if (typeof cb === 'function') {
      cb(result);
    }
  }

  function cmpPos(a, b) {
    return a.row - b.row || a.column - b.column;
  }

  var ClientUtils = {
    /**
     * @param {AcePosition} pos1
     * @param {AcePosition} pos2
     * @returns {number} - negative if first is before second
     **/
    cmpPos: cmpPos,

    /**
     * @param {BaseClient} client
     * @param {EditSession} session
     * @param {string} [name]
     * @returns {ClientData} - finds or creates a ClientData on session
     **/
    getDoc: getDoc,

    /**
         * @typedef {{
             name: string,
             start: AcePosition,
             activeIndex: number
         }} CallPosition
         * @param {Editor} editor
         * @param {CallPosition} cursor
         * @returns {CallPosition}
         **/
    getCallPos: getCallPos,

    /**
     * @param {BaseClient} ts
     * @param {ClientData} doc
     * @returns {string}
     **/
    docValue: docValue,

    /**
     * @typedef TextEdit
     * @extends Range
     * @property {string} text
     *
     * @param {BaseClient} ts
     * @param {Array<(TextEdit|Range)>} changes
     * @param {string} [text]
     * @param {callback{result:{replaced:number,status:"",errors:""}}} cb
     */
    applyChanges: applyChanges,

    /**
     * @param {Editor} editor
     * @returns {boolean}
     **/
    somethingIsSelected: somethingIsSelected,

    /**
     * @param {Editor} editor
     * @returns {AceToken}
     **/
    getCurrentToken: getCurrentToken,

    /**
     * @param {BaseClient} ts
     * @param {Editor} editor
     * @param {AcePosition|Range|TextSpan|ExCommand}
     * Also sets lastJumpPosition
     */
    setSelection: setSelection,

    getExtension: function (mode) {
      var m = modelist.modesByName[mode];
      if (!m) return '';
      return m.extensions ? m.extensions.split('|').shift() : '';
    },
  };
  exports.BaseClient = BaseClient;
  exports.ClientUtils = ClientUtils;
}); /*_EndDefine*/