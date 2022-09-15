define(function (require, exports, module) {
  require('grace/ext/file_utils/glob');
  var Docs = require('grace/docs/docs').Docs;
  var getProject = require('grace/core/file_utils').FileUtils.getProject;
  var Utils = require('grace/core/utils').Utils;
  var relative = require('grace/core/file_utils').FileUtils.relative;
  var JSONExt = require('grace/ext/json_ext').JSONExt;
  var extname = require('grace/core/file_utils').FileUtils.extname;
  var BaseClient = require('grace/ext/language/base_client').BaseClient;
  var getAllProps = require('./find_props').inferProps;
  var scopeSolvers = require('./scope').ScopeSolvers;
  var DocStream = require('./scope').DocStream;
  var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
  var TextStream = require('./scope').TextStream;
  var scopeIterator = require('./scope').scopeIterator;
  var lang = ace.require('ace/lib/lang');
  var config = ace.require('ace/config');
  var debug = console;
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
            modes[i].$keywordList.filter(Utils.notIn(keywords))
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
  var Tags = function () {
    Tags.super(this, arguments);
    this.clear();
  };
  /*
    * ScopeFormat{
        start: number,
        end: number,
        depth: number,
        parent?: number corresponding to index in list |ScopeFormat
    }
    * Header{
        !scopes: [ScopeFormat],
        !mode: string
        !lib: string - the filename this header was parsed from if it is a library
    }
    * Tag Format {
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
  Tags.prototype = {
    constructor: Tags,
    //provided in setup_tags,
    tagFilePattern: /.*/,
    isOptionEnabled: Utils.noop,
    isOptionMatching: Utils.noop,
    //manage tags
    importTags: function (res) {
      if (res.getValue) {
        res = res.getValue();
      }
      try {
        res = JSONExt.parse(res);
      } catch (e) {
        debug.error(e);
        return null;
      }
      var header = {
        '!preparsed': true,
      };
      var filename = res.file;
      header['!mode'] = res.mode;
      header['!lib'] = res.isLibrary ? filename : undefined;
      if (res.scopes) {
        header['!scopes'] = res.scopes.filter(Boolean);
        header['!scopes'].forEach(function (e) {
          //hehehe eslint would be appalled
          if ((e.parent = res.scopes[e.parent]))
            (e.parent.children || (e.parent.children = [])).push(e);
        });
      } else header['!scopes'] = [];
      var tags = res.tags;

      function extend(child) {
        child.isProperty = true;
        tags.push(child);
      }
      for (var i = 0; i < tags.length; i++) {
        var tag = tags[i];
        if (tag.children) {
          tag.children.forEach(extend);
        }
      }
      this.loadParsedTags(filename, header, tags);
    },
    exportTags: function (fs, folder, cb) {
      Utils.asyncForEach(
        Object.keys(this.files),
        function (a, i, next) {
          var file = a.replace(/[^A-Za-z\-_0-9]/g, '_');
          var tagFile = this.files[a];
          var header =
            '//Grace-Tags version 1.0\n' +
            JSON.stringify({
              file: a,
              mode: tagFile['!mode'],
              isLibrary: false,
              scopes: tagFile['!scopes'].map(function (e, i, arr) {
                var a = Object.assign({}, e);
                if (a.parent) a.parent = arr.indexOf(a.parent);
                a.children = undefined;
                return a;
              }),
              tags: tagFile.tags
                .map(function (a) {
                  if (a.scope) {
                    a.scope = undefined;
                  }
                  return a;
                })
                .filter(Boolean),
            });
          fs.writeFile(folder + '/' + file + '.gtag', header, next);
        }.bind(this),
        cb
      );
    },
    loadTags: function (
      filename,
      doc_or_string /*Doc or string*/,
      noOverwrite /*false*/,
      mode
    ) {
      var files = this.files;
      var doc;
      if (typeof doc_or_string == 'object') {
        doc = doc_or_string;
      }
      if (!mode) {
        if (extname(filename) == 'gtag') {
          return this.importTags(doc_or_string);
        } else if (
          typeof doc_or_string == 'string' &&
          this.tagFilePattern.test(filename)
        ) {
          return require(['./ctags'], function (mod) {
            mod.Ctags.findAll(doc_or_string, filename, false, Utils.noop);
          });
        }
        if (doc) {
          mode = doc.session.getModeName();
        } else mode = Docs.autoMode(filename);
      }
      if (noOverwrite && files[filename] && files[filename]['!mode'] == mode)
        return;
      if (!files[filename] && !this.isOptionEnabled('loadFileTypes', mode))
        return;

      var allowText = this.isOptionEnabled('enableWordsGathering', mode);
      var completions = {};
      var tagger = tagFinders[mode] || tagFinders.text;
      var tags;
      var stream;
      if (doc) {
        doc.$lastTagUpdate = doc.getRevision();
        stream = new DocStream(doc);
        if (tagger.findAllDoc) {
          tags = tagger.findAllDoc(doc, filename, allowText);
          doc = null;
        } else doc = doc.getValue();
      } else stream = new TextStream(doc);
      if (!doc) return;
      tags = (tagger.findAll || tagger)(
        doc,
        filename,
        allowText,
        function (tags) {
          if (!tags && tags.length) return;
          completions['!scopes'] = scopeSolvers[mode]
            ? scopeSolvers[mode](stream)
            : [];
          completions['!mode'] = mode;
          this.loadParsedTags(filename, completions, tags);
        }.bind(this)
      );
    },
    loadParsedTags: function (filename, header, tags) {
      var iter = scopeIterator(header['!scopes']);
      var maxDup = Infinity;
      //tags.length < 500 ? spaces.length : tags.length < 1000 ? 3 : 0;
      tags.forEach(function (a) {
        if (a.caption) {
          a.scope = iter.find(a);
          if (a.isParam) {
            var next = iter.findNext(a);
            if (next) a.scope = next;
          }
        }
      });
      //in future, we could check if tags were already sorted
      tags.sort(function (a, b) {
        //ascending alphabetical order
        return (
          (a.caption || a || '').localeCompare(b.caption || b || '') ||
          //more data first
          (b.scope ? 3 : 0) +
            (b.signature ? 3 : 0) +
            (b.caption ? 1 : 0) -
            ((a.scope ? 3 : 0) + (a.signature ? 3 : 0) + (a.caption ? 1 : 0))
        );
      });
      var last = '',
        // duplicates=[],
        hasData = false;
      var numDupl = 0;
      //remove duplicates
      if (header['!lib']) header.tags = tags.filter(Boolean);
      else
        header.tags = tags
          .map(function (a) {
            var caption;
            if (!a) return false; //null match
            if (typeof a == 'string') {
              caption = a;
              a = undefined;
            } else {
              caption = a.caption;
            }
            if (!caption || caption[0] == '!') return false;
            if (last == caption) {
              if (!a) return false; //string match but a better match is already available
              if (numDupl > maxDup) return false; //if we later decide to use this again
              if (
                hasData &&
                !(
                  (a.scope && a.scope !== hasData.scope) ||
                  (a.signature && a.signature !== hasData.signature)
                )
              )
                //duplicates.length)
                return false;
              /*var dup;
                    if (duplicates.some(function(b) {
                            return (!a.scope || b.scope == a.scope) &&
                                (!a.signature || a.signature == b.signature) && (dup = b);
                        })) {
                            //not worth the effort, if there are many of these, it's a problem with the tag finder
                        }*/
              //duplicates.push(a);
              hasData = a;
              numDupl++;
              return a;
            } else {
              last = caption;
              hasData = a;
              //duplicates.length = 0;
              //if (a)
              //duplicates.push(a);
              numDupl = 0;
              return a || caption;
            }
          })
          .filter(Boolean);
      header.tags.forEach(function (a) {
        //add children for tags with isClass
        if (!a.isClass || a.children) return;
        var next = iter.findNext(a);
        if (next) {
          a.children = [];
          this.flatWalk(header, function (i, e) {
            if (e && e.scope == next) {
              a.children.push(e);
            }
          });
        }
      }, this);
      this.files[filename] = header;
    },
    //walk our flattened tree
    flatWalk: function (tagFile, each, opts) {
      var i = (opts && opts.start) || 0;
      var tags = tagFile.tags;
      var end = tags.length;
      if (end && opts && opts.name) {
        //binary search
        var name = opts.name;
        var start = 0;
        end = end - 1;
        do {
          i = (start + end) >> 1;
          var current = (tags[i].caption || tags[i]).localeCompare(name);
          if (current > 0) {
            end = i - 1;
          } else if (current < 0) {
            start = i + 1;
          } else {
            break;
          }
        } while (start <= end);
        if (start <= end) {
          //found match
          //Find the boundaries of the region we are looking with linear search
          var j = i,
            test;
          while (j > start) {
            test = tags[j - 1].caption || tags[j - 1];
            if (test.localeCompare(name) !== 0) break;
            j--;
          }
          start = j;
          j = i + 1;
          while (j < end) {
            test = tags[j].caption || tags[j];
            if (test.localeCompare(name) !== 0) break;
            j++;
          }
          end = j;
        }
        i = start;
      }
      if (opts && opts.end) end = Math.min(tags.length, opts.end);
      if (opts && opts.limit) end = Math.min(i + opts.limit, end) || 0;
      //currently, we'd have to throw to get out of this
      for (; i < end; i++) {
        var e = tags[i];
        if (e[0] == '!') continue;
        each(e.caption || e, e.caption && e, i);
      }
    },
    //A dummy query service
    //Rather than resolve the name to a symbol using a
    //position provided, it simply gathers all the instances of said name
    //in the tag lists then sorts them using scope information
    //if available
    query: function (name, pos, file, fnOnly, allowGlobal) {
      this.updateTags(file);
      var data = this.files[file];

      function allWords(ctx, tags, name) {
        var words = [];
        //var duplicates = name + " ";
        ctx.flatWalk(
          tags,
          function (i, data) {
            if (!data) return true;
            if (fnOnly && !data.isFunction) {
              return true;
            }
            words.push(data);
            //if (i == name){// || i.startsWith(duplicates)) {
            //}
          },
          {
            name: name,
            //limit: 50
            //end: Infinity //needed when we had space delimited duplicates
          }
        );
        return words;
      }
      var locals, hasLocal;
      if (data) {
        var scopes = [false].concat(
          (data['!scopes'] || [])
            .filter(function (el) {
              return el.start <= pos && el.end >= pos;
            })
            .reverse()
        );
        locals = allWords(this, data, name)
          .map(function (a) {
            //in the same scope > lexically closer;
            //can't choose 1
            var scope,
              index = -1;
            var posStart = a.locStart || a.loc || 0;
            if (a.scope == undefined) {
              var posEnd = a.locEnd || posStart;
              //find the nearest scope
              scopes.some(function (el, i) {
                if (el.start <= posStart && el.end >= posEnd) {
                  scope = el;
                  index = i;
                  return true;
                }
              });
            } else {
              index = scopes.indexOf(a.scope);
              if (index > -1) scope = a.scope;
            }
            var score = 0;
            if (index > -1) {
              //items that share a scope have better chances
              score = 10000 * (index + 1);
            }
            //but we do not ditch any item cus of properties etc
            score += Math.abs(posStart - pos);
            if (!hasLocal && scope) hasLocal = true;
            return {
              score: score,
              scope: scope,
              item: a,
              file: data['!lib'] || file,
            };
          })
          .sort(function (a, b) {
            return b.score - a.score;
          });
      } else locals = [];

      if (allowGlobal !== false) {
        var files = Array.isArray(allowGlobal) ? allowGlobal : this.files;
        for (var i in files) {
          if (i !== file) {
            var result = this.query(name, 0, i, false, false);
            if (result) locals.push.apply(locals, result);
          }
        }
      }
      if (locals.length) return locals;
      return null;
    },

    //the base provider interface
    hasArgHints: true,
    priority: 10,
    name: 'tagsClient',
    init: function (editor, cb) {
      this.attachToEditor(editor, this.instance || (this.instance = this), cb);
    },
    triggerRegex: /(?:\.|\-\>|\:\:)$/,
    addDocToInstance: function (doc) {
      if (
        this.isOptionEnabled(
          'autoUpdateTags',
          doc.session.getModeName(),
          doc.getSavePath()
        )
      ) {
        this.loadTags(doc.getPath(), doc);
      }
    },

    //base client interface
    normalizeName: function (name) {
      return name;
    },
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
    requestDefinition: function (editor, cb) {
      var args = this.getQueryArgs(editor);
      if (!args) return this.ui.showInfo(editor, 'No name found at position');

      var tags = this.query(args.name, args.pos, args.file, false, true);
      if (tags) {
        // var safeTags = tags.filter(function(e) {
        //     return e.scope || e.item.isProperty;
        // });
        // if (safeTags.length)
        //     tags = safeTags;
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
          })
        );
      } else {
        if (!this.files[args.file])
          return this.ui.showError(editor, 'No tags loaded for this file');
        this.ui.showInfo(editor, 'No tag found');
        cb();
      }
    },
    requestType: function (editor, pos, cb) {
      var args = this.getQueryArgs(editor);
      if (!args) return this.ui.showInfo(editor, 'No name found at position');

      var tags = this.query(args.name, args.pos, args.file, false, true);
      if (tags) {
        cb(null, tags);
      } else {
        if (!this.files[args.file])
          return this.ui.showError(editor, 'No tags loaded for this file');
        this.ui.showInfo(editor, 'No tag found');
      }
    },
    requestArgHints: function (editor, cursor, cb) {
      var args = this.getQueryArgs(editor, cursor);
      if (!args) return;

      var tags = this.query(args.name, args.pos, args.file, true, true);
      if (tags) {
        cb(tags);
      } else {
        if (!this.files[args.file])
          return this.ui.showError(editor, 'No tags loaded for this file');
      }
    },
    getCompletions: function (editor, session, pos, prefix, callback) {
      this.ui.closeAllTips();
      var mode = session.getInnerMode();
      var doc = Docs.forSession(session);
      var path = (doc && doc.getSavePath()) || doc.getPath();
      if (!this.isOptionEnabled('enableTagsCompletion', mode))
        return callback();
      var files = this.files;
      var paths = Object.keys(files);
      var propStrings, props;

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
        var line = session.getLine(pos.row).substring(0, pos.column);
        //basically the name or function call before the ./->
        var word = /(\w+)(?:\s*\((?:[^\(\)]+|\((?:[^\(\)])\))*\))?\s*(?:\.|->)$/.exec(
          line
        );
        if (word && isNaN(word)) {
          propStrings = getAllProps(
            this.propCache,
            word[1],
            path,
            session,
            paths
          );
          //Gather properties as much as possible
          props = [];
          var results = [word[1]];
          var addItem = function (e) {
            if (e.item.children) {
              e.item.children.forEach(function (p) {
                propStrings[p.caption || p] = 100;
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
            var items = this.query(e, index, path, false, true);
            items && items.forEach(addItem);
          }
        }
      }

      var projectRoot = getProject().rootDir;
      var completions = [];
      var uniq = {};
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
        var current = filename == path;
        var rel = relative(projectRoot, filename) || filename;
        var tagsForFile = files[filename];

        var allowsText = this.isOptionEnabled(
          'showLocalWords',
          tagsForFile['!mode']
        );
        this.flatWalk(tagsForFile, function (tag, data) {
          if (!data) {
            if (current) return;
            if (uniq[tag]) {
              return;
            }
            uniq[tag] = true;
          }
          //prefilter
          if (tag.indexOf(prefix) < 0) return;
          var score = 0;
          //based on scope 150 # -400
          var scope = data && data.scope;
          var inScope = false;
          if (current) score += 50;
          if (!data) {
            //words from other files
            score -= 300;
          } else if (!scope) {
            //global scope
          } else if (current) {
            if (scope.start <= index && scope.end >= index) {
              inScope = true;
              score += 100;
            }
          } else {
            if (scope.start != 0) {
              score -= 400;
            }
          }
          //props ~ -200
          if (propStrings) {
            if (propStrings[tag]) {
              uniq[tag] = true;
              score += propStrings[tag] * 5;
            } else score -= 200;
          }
          //final addition +600
          if (data) {
            if (data.getScore) {
              score += data.getScore(prefix, index);
            } else score += data.score || 1;
            if (propStrings && data.isProperty) score += 100;
          } else if (allowsText) {
            score = BaseClient.PRIORITY_LOW;
          }
          completions.push({
            type: T,
            caption: (data && data.caption) || tag,
            meta: rel,
            value: (data && data.caption) || tag,
            message:
              inScope && data.isParam
                ? (data && data.type ? data.type + ' ' : '') + 'parameter'
                : (data && data.signature) ||
                  (propStrings && propStrings[tag] && 'property'),
            doc: data && data.doc,
            score: score,
          });
        });
        if (completions.length > 10000) return true;
      }, this);
      for (var prop in propStrings) {
        if (!uniq[prop]) {
          completions.push({
            value: prop,
            type: T,
            message: 'property',
            score: 300 + Math.min(propStrings[prop] * 5, 200),
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
              pos === i ? 'active' : ''
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
    clear: function () {
      this.docs = {};
      this.files = {};
      this.propCache = {};
      this.lastUpdate = 0;
    },
    destroy: function () {
      this.clear();
    },
    updateTags: function (path) {
      var doc = Docs.forPath(path);
      if (!doc) return;
      if (doc.$lastTagUpdate === doc.getRevision()) return;
      doc.$lastTagUpdate = doc.getRevision();
      if (
        this.isOptionEnabled('autoUpdateTags', doc.session.getModeName(), path)
      )
        this.loadTags(path, doc);
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
        for (var filename in this.files) {
          this.updateTags(filename);
        }
        this.lastUpdate = now;
      }
      if (!this.files[file]) {
        this.updateTags(file);
      }
      return {
        pos: pos,
        name: name,
        file: file,
      };
    },
  };
  Utils.inherits(Tags, BaseClient, BaseProvider);
  exports.TagsCompleter = Tags;
}); /*_EndDefine*/
