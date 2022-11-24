define(function (require, exports, module) {
    var join = require('grace/core/file_utils').FileUtils.join;
    var JSONExt = require('grace/ext/json_ext').JSONExt;
    var Utils = require('grace/core/utils').Utils;
    var scopeIterator = require('./scope').scopeIterator;
    var debug = console;
    /** @constructor */
    function QueryTags() {
        this.files = {};
    }
    QueryTags.prototype = {
        constructor: QueryTags,
        //manage tags
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
                    (a.caption || a || '').localeCompare(
                        b.caption || b || ''
                    ) ||
                    //more data first
                    (b.scope ? 3 : 0) +
                        (b.signature ? 3 : 0) +
                        (b.caption ? 1 : 0) -
                        ((a.scope ? 3 : 0) +
                            (a.signature ? 3 : 0) +
                            (a.caption ? 1 : 0))
                );
            });
            var last = '',
                // duplicates=[],
                hasData = null;
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
                                    (a.signature &&
                                        a.signature !== hasData.signature)
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
                            scopes: tagFile['!scopes'].map(function (
                                e,
                                i,
                                arr
                            ) {
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
                    fs.writeFile(join(folder, file + '.gtag'), header, next);
                }.bind(this),
                cb
            );
        },
        //walk our flattened tree
        flatWalk: function (tagFile, each, opts) {
            var i = (opts && opts.start) || 0;
            var tags = tagFile.tags;
            var end = tags.length;
            if (opts && opts.end !== undefined)
                end = Math.min(tags.length, opts.end || 0);
            if (end > 0 && opts && opts.name) {
                //binary search
                var name = opts.name;
                var start = 0;
                end = end - 1;
                do {
                    i = (start + end) >> 1;
                    var current = (tags[i].caption || tags[i]).localeCompare(
                        name
                    );
                    if (current > 0) {
                        end = i - 1;
                    } else if (current < 0) {
                        start = i + 1;
                    } else {
                        break;
                    }
                } while (start <= end);
                if (start <= end) {
                    //Found one match out of possibly more than one
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
                /**
                 * @type {Array<any>} scopes
                 */
                var scopes = [false].concat(
                    (data['!scopes'] || [])
                        .filter(function (e) {
                            return e.start <= pos && e.end >= pos;
                        })
                        .reverse()
                );
                locals = allWords(this, data, name)
                    .map(function (a) {
                        //in the same scope > lexically closer;
                        var scope,
                            index = -1;
                        //can't choose 1
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
                var files = Array.isArray(allowGlobal)
                    ? allowGlobal
                    : this.files;
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
    };
    exports.QueryTags = QueryTags;
});