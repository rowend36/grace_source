define(function (require, exports, module) {
  require('grace/ext/file_utils/glob');
  var Docs = require('grace/docs/docs').Docs;
  var getProject = require('grace/core/file_utils').FileUtils.getProject;
  var Utils = require('grace/core/utils').Utils;
  var relative = require('grace/core/file_utils').FileUtils.relative;
  var extname = require('grace/core/file_utils').FileUtils.extname;
  var BaseClient = require('grace/ext/language/base_client').BaseClient;
  var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
  var QueryTags = require('./query_tags').QueryTags;
  var getAllProps = require('./find_props').inferProps;
  var scopeSolvers = require('./scope').ScopeSolvers;
  var DocStream = require('./scope').DocStream;
  var TextStream = require('./scope').TextStream;
  var lang = require('ace!lib/lang');
  var config = require('ace!config');
  var resolvers = (exports.ImportResolvers = {});
  var WORD_RE = /[a-zA-Z\$\-\u00C0-\u1FFF\u2C00-\uD7FF][a-zA-Z_0-9\$\-\u00C0-\u1FFF\u2C00-\uD7FF\w]*/g;
  var tagFinders = (exports.TagFinders = {
    text: function (res) {
      var matches = res.match(WORD_RE);
      return (
        matches &&
        matches.map(function (e) {
          return (' ' + e).substring(1);
        })
      );
    },
  });

  var added = [];
  var keywords = [];

  function pretty(text) {
    var modes = config.$modes;
    for (var i in modes) {
      if (added.indexOf(i) < 0) {
        added.push(i);
        if (modes[i].$keywordList) {
          keywords.push.apply(
            keywords,
            modes[i].$keywordList.filter(Utils.notIn(keywords)),
          );
        }
      }
    }
    //dumbass syntax highlighting
    return typeof text == 'string'
      ? lang.escapeHTML(text).replace(/\w+/g, function (match) {
          if (keywords.indexOf(match) > -1) {
            return '<span class="blue-text">' + match + '</span>';
          }
          return match;
        })
      : '';
  }

  var T = 'tags';
  /** @constructor */
  function TagsClient() {
    TagsClient.super(this, arguments);
    BaseProvider.call(this);
    this.tags = new QueryTags();
    this.propCache = {};
    this.lastUpdate = 0;
  }
  /*
    * ScopeFormat{
        start: number,
        end: number,
        depth: number,
        parent?: number|ScopeFormat // number corresponding to index in list
    }
    * Header{
        !scopes: [ScopeFormat],
        !mode: string
        !lib: string - the filename this header was parsed from if it is a library
    }
    * TagFormat {
        caption: string
        doc: string
        loc: number,
        scope: ?, - for convenience this is generated from loc and scopes
                to save memory and also for object equality test
                If need arises, I might add the number index support
                but for now, nah
        score: number
        type: string,
        types: [string],
        signature: string,
        address: [{re:re,needle:needle,backwards:boolean}|number] used by ctags,
        isFunction: boolean //provides argument hints with it's signature
        isParam: boolean //used when the scope of a tag is in front of the match rather than around it
    }
    //Exported tag format
    {
        mode: string
        file: optional - used for jump to def,
        isLibrary: stops updates to this tagfile, as well as filtering
        scopes: optional
        tags: [TagFormat]
    }
    */
  TagsClient.prototype = {
    constructor: TagsClient,
    clear: function () {
      this.tags.files = {};
      this.propCache = {};
      this.lastUpdate = 0;
    },
    //provided in setup_tags,
    tagFilePattern: /.*/,
    triggerRegex: /(?:\.|\-\>|\:\:)$/,
    isOptionEnabled: Utils.noop,
    isOptionMatching: Utils.noop,
    //the base provider interface
    hasArgHints: true,
    priority: 10,
    name: 'tagsClient',
    init: function (editor, cb) {
      this.attachToEditor(editor, this.instance || (this.instance = this), cb);
    },
    addDocToInstance: function (doc) {
      if (
        this.isOptionEnabled(
          'autoUpdateTags',
          doc.session.getModeName(),
          doc.getSavePath(),
        )
      ) {
        this.loadTags(doc.getPath(), doc);
      }
    },
    loadTags: function (
      filename,
      doc_or_string /*Doc or string*/,
      noOverwrite /*false*/,
      mode,
    ) {
      var doc, text;
      if (typeof doc_or_string == 'object') {
        doc = doc_or_string;
      } else {
        text = doc_or_string || '';
      }
      if (!mode) {
        if (extname(filename) == 'gtag') {
          return this.tags.importTags(doc || text);
        } else if (text !== undefined && this.tagFilePattern.test(filename)) {
          return require(['./ctags'], function (mod) {
            mod.Ctags.findAll(text, filename, false, Utils.noop);
          });
        }
        if (doc) {
          mode = doc.session.getModeName();
        } else mode = Docs.autoMode(filename);
      }
      var files = this.tags.files;
      if (noOverwrite && files[filename] && files[filename]['!mode'] == mode)
        return;
      if (!files[filename] && !this.isOptionEnabled('loadFileTypes', mode))
        return;

      var allowText = this.isOptionEnabled('enableWordsGathering', mode);
      var tagger = tagFinders[mode] || tagFinders.text;
      var stream;
      if (doc) {
        doc.$lastTagUpdate = doc.getRevision();
        stream = new DocStream(doc);
        if (!tagger.findAllDoc) {
          text = doc.getValue();
          doc = null;
        }
      } else stream = new TextStream(text);
      (doc ? tagger.findAllDoc : tagger.findAll || tagger)(
        doc || text,
        filename,
        allowText,
        function (tags) {
          if (!tags && tags.length) return;
          this.tags.loadParsedTags(filename,
            {
              '!scopes': scopeSolvers[mode] ? scopeSolvers[mode](stream) : [],
              '!mode': mode,
            },
            tags,
          );
        }.bind(this),
      );
    },
    //Base client interface
    rename: null,
    releaseDoc: Utils.noop,
    sendDoc: Utils.noop,
    refreshDoc: Utils.noop,
    docChanged: Utils.noop,
    trackChange: Utils.noop,
    addDoc: function (name, session) {
      this.docs = {};
      return (this.docs[name] = {
        name: name,
        doc: session,
      });
    },
    $handleFailure: function (editor, args, cb, silent) {
      if (!this.tags.files[args.file])
        this.ui.showError(editor, 'No tags loaded for this file');
      else if (!silent) this.ui.showInfo(editor, 'No tag found');
      cb();
    },
    requestDefinition: function (editor, cb) {
      var args = this.getQueryArgs(editor);
      if (!args) return this.ui.showInfo(editor, 'No name found at position');
      
      this.updateTags(args.file);
      var tags = this.tags.query(args.name,
        args.pos,
        args.file,
        false,
        true,
      );
      if (!tags) return this.$handleFailure(editor, args, cb);
      cb(
        null,
        tags.map(function (tag) {
          return {
            file: tag.file,
            span: tag.item.address
              ? undefined
              : {
                  start: tag.item.locStart || tag.item.loc || 0,
                  length: 0,
                },
            address: tag.item.address,
          };
        }),
      );
    },
    requestType: function (editor, pos, cb) {
      var args = this.getQueryArgs(editor);
      if (!args) {
        this.ui.showInfo(editor, 'No name found at position');
        return cb();
      }
      this.updateTags(args.file);
      var tags = this.tags.query(args.name,
        args.pos,
        args.file,
        false,
        true,
      );
      if (!tags) return this.$handleFailure(editor, args, cb);
      cb(null, tags);
    },
    requestArgHints: function (editor, cursor, cb) {
      var args = this.getQueryArgs(editor, cursor);
      if (!args) return cb();

      this.updateTags(args.file);
      var tags = this.tags.query(args.name,
        args.pos,
        args.file,
        true,
        true,
      );
      if (!tags) return this.$handleFailure(editor, args, cb, true);
      cb(null, tags);
    },
    getCompletions: function (editor, session, pos, prefix, callback) {
      this.ui.closeAllTips();
      var mode = session.getInnerMode();
      var doc = Docs.forSession(session);
      var path = doc && (doc.getSavePath() || doc.getPath());
      if (!this.isOptionEnabled('enableTagsCompletion', mode))
        return callback();
      var files = this.tags.files;
      var paths = Object.keys(files);
      var propertyNames;

      if (path) {
        var resolver = resolvers[mode];
        if (resolver) {
          paths = resolver.filter(paths, doc) || paths;
        } else {
          paths = paths.filter(function (e) {
            var tagMode = files[e]['!mode'];
            if (
              (tagMode === mode ||
                this.isOptionEnabled('includeFileTypes', mode)) &&
              this.isOptionMatching('includeTagFiles', e)
            )
              return true;
            return false;
          });
        }
        this.updateTags(path);
      }
      if (!prefix) {
        //Property completion
        var line = session.getLine(pos.row).substring(0, pos.column);
        //basically the name or function call before the ./->
        var word = /(\w+)\s*(?:\((?:[^\(\)]|\((?:[^\(\)])\))*\)\s*)?(?:\.|->)$/.exec(
          line,
        );
        if (word && isNaN(+word)) {
          propertyNames = getAllProps(
            this.propCache,
            word[1],
            path,
            session,
            paths,
          );
          //Gather properties as much as possible
          var results = [word[1]];
          var addItem = function (e) {
            if (e.item.children) {
              e.item.children.forEach(function (p) {
                propertyNames[p.caption || p] = 100;
              });
            }
            var types = e.item.types || [];
            if (e.item.type) {
              types.push(e.item.type);
              var anno = e.item.type.indexOf('<');
              if (anno > -1) {
                types.push(e.item.type.slice(0, anno));
              }
            }
            types.forEach(function (type) {
              if (type && results.indexOf(type) < 0) {
                results.push(type);
              }
            });
          };
          for (var i = 0; i < results.length; i++) {
            var e = results[i];
            var items = this.tags.query(e, index, path, false, true);
            items && items.forEach(addItem);
          }
        }
      }

      var projectRoot = getProject().rootDir;
      var completions = [];
      var uniq = Object.create(null);

      var now = new Date().getTime();
      if (now - this.lastUpdate > 5000) {
        for (var j in paths) {
          this.updateTags(paths[j]);
        }
        this.lastUpdate = now;
      }
      var index = session.getDocument().positionToIndex(pos);
      //How does this scale with thousands of tags
      paths.some(function (filename) {
        var isSameFile = filename === path;
        var rel = relative(projectRoot, filename) || filename;
        var tagsForFile = files[filename];

        var allowsText = this.isOptionEnabled(
          'showLocalWords',
          tagsForFile['!mode'],
        );
        this.tags.flatWalk(tagsForFile, function (name, data) {
          var isText = !data;
          if (isText) {
            if (isSameFile) return;
            if (uniq[name]) {
              return;
            }
            uniq[name] = true;
          }
          //prefilter
          if (name.indexOf(prefix) < 0) return;
          var score = 0;
          //based on scope 150 # -400
          var scope = data && data.scope;
          var inScope = false;
          if (isSameFile) score += 50;
          if (isText) {
            //words from other files
            score -= 300;
          } else if (!scope) {
            //global scope
          } else if (isSameFile) {
            if (scope.start <= index && scope.end >= index) {
              inScope = true;
              score += 100;
            }
          } else {
            if (scope.start != 0) {
              //out of scope
              score -= 400;
            }
          }
          //props ~ -200
          if (propertyNames) {
            if (propertyNames[name]) {
              uniq[name] = true;
              score += propertyNames[name] * 5;
            } else score -= 200;
          }
          //final addition +600
          if (data) {
            if (data.getScore) {
              score += data.getScore(prefix, index);
            } else score += data.score || 1;
            if (propertyNames && data.isProperty) score += 100;
          } else if (allowsText) {
            score = BaseClient.PRIORITY_LOW;
          }
          completions.push({
            type: T,
            caption: (data && data.caption) || name,
            meta: rel,
            value: (data && data.caption) || name,
            message:
              inScope && data.isParam
                ? (data && data.type ? data.type + ' ' : '') + 'parameter'
                : (data && data.signature) ||
                  (propertyNames && propertyNames[name] && 'property'),
            doc: data && data.doc,
            score: score,
          });
        });
        if (completions.length > 10000) return true;
      }, this);
      for (var prop in propertyNames) {
        if (!uniq[prop]) {
          completions.push({
            value: prop,
            type: T,
            message: 'property',
            score: 300 + Math.min(propertyNames[prop] * 5, 200),
          });
        }
      }
      callback(null, completions);
    },
    getDocTooltip: function (item) {
      if (item.type == T && !item.docHTML && item.doc) {
        item.docHTML = [
          "<h6 class='tag-tooltip-header'>" + pretty(item.value) + '</h6>',
          item.doc
            ? "<span class='tag-doc'>" + pretty(item.doc) + '</span>'
            : '',
          "   <p class='tag-path'><i>" + item.meta + '</i></p>',
        ].join('');
      }
    },
    genArgHintHtml: function (tip, pos) {
      return tip
        .map(function (e) {
          //works 90% of the time
          var text = e.item.signature;
          var head = text.substring(0, text.indexOf('(') + 1);
          var tail = text.substring(text.lastIndexOf(')'));
          var parts = text
            .substring(head.length, text.length - tail.length)
            .split(',');
          parts = parts.map(function (e, i) {
            return this.ui.createToken(
              {
                kind: pos === i ? 'parameterName' : 'localName',
                text: Utils.htmlEncode(e),
              },
              pos === i ? 'active' : '',
            );
          }, this);
          return pretty(head) + parts.join(',') + pretty(tail);
        }, this)
        .join('</br>');
    },
    genInfoHtml: function (tip) {
      var prev;

      var info = tip
        .map(function (e) {
          return e.item.doc;
        })
        .sort()
        .filter(function (b) {
          if (!b) return false;
          if (b == prev) return false;
          prev = b;
          return true;
        });
      if (info.length)
        return (
          "<p class='tag-tooltip'>" + info.map(pretty).join('</br>') + '</p>'
        );
      else return '?';
    },

    //utility functions
    destroy: function () {
      this.clear();
    },
    updateTags: function (path) {
      var doc = Docs.forPath(path);
      if (!doc) return;
      if (doc.$lastTagUpdate === doc.getRevision()) return;
      if (
        this.isOptionEnabled('autoUpdateTags', doc.session.getModeName(), path)
      )
        this.loadTags(path, doc);
      else doc.$lastTagUpdate = doc.getRevision();
      if (this.propCache[path]) {
        this.propCache[path] = null;
      }
    },
    getQueryArgs: function (editor, cursor, name) {
      cursor = cursor || editor.getSelection().cursor;
      var pos = editor.session.getDocument().positionToIndex(cursor);
      if (!name) {
        name = editor.session.getTokenAt(cursor.row, cursor.column);
        if (!name || !/\w/.test(name.value))
          name = editor.session.getTokenAt(cursor.row, cursor.column + 1);
        if (!name || !/\w/.test(name.value)) return null;
        name = name.value;
        if (name[0] == '"') {
          name = name.replace(/\"/g, '');
        } else if (name[0] == "'") {
          name = name.replace(/\'/g, '');
        }
      }
      var file = this.options.getFileName(editor.session);
      var now = new Date().getTime();
      if (now - this.lastUpdate > 5000) {
        for (var filename in this.tags.files) {
          this.updateTags(filename);
        }
        this.lastUpdate = now;
      }
      if (!this.tags.files[file]) {
        this.updateTags(file);
      }
      return {
        pos: pos,
        name: name,
        file: file,
      };
    },
  };
  Utils.inherits(TagsClient, BaseClient, BaseProvider);
  exports.TagsClient = TagsClient;
}); /*_EndDefine*/
