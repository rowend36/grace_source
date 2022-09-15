/*Merge Doc*/
define(function (require, exports, module) {
    'use strict';
    var Utils = require('grace/core/utils').Utils;
    var Docs = require('grace/docs/docs').Docs;
    var Notify = require('grace/ui/notify').Notify;
    var closeDoc = require('grace/docs/docs').closeDoc;
    var Doc = require('grace/docs/document').Doc;
    var join = require('grace/core/file_utils').FileUtils.join;
    var GitUtils = require('./git_utils').GitUtils;
    var FileUtils = require('grace/core/file_utils').FileUtils;

    function MergeDoc() {
        MergeDoc.super(this, arguments);
    }
    Utils.inherits(MergeDoc, Doc);
    //get the conflict item corresponding to this document
    MergeDoc.prototype.getItem = function () {
        var path = this.getPath().substring(this.mergeTree.href.length);
        var tree = this.mergeTree.tree;
        var length = tree.length;
        for (var i = 0; i < length; i++) {
            if (tree[i].path == path) return tree[i];
        }
    };
    //revert all the changes in the doc
    MergeDoc.prototype.refresh = function (cb, ignoreDirty, confirm) {
        if (this.mergeTree) {
            Docs.onRefresh(
                this,
                null,
                this.getItem().mergedText,
                cb,
                ignoreDirty,
                confirm,
            );
        } else {
            var gitdir = this.gitdir;
            MergeDoc.getTree(
                {
                    gitdir: gitdir,
                    fs: this.getFileServer(),
                },
                function (err, c) {
                    var path = this.getPath();
                    if (c && path.startsWith(c.href)) {
                        this.mergeTree = c;
                    } else err = err || 'stale';
                    Docs.onRefresh(
                        this,
                        err,
                        this.getItem().mergedText,
                        cb,
                        ignoreDirty,
                        confirm,
                    );
                }.bind(this),
            );
        }
        return true;
    };
    MergeDoc.prototype.serialize = function () {
        var obj = Doc.prototype.serialize.apply(this, arguments);
        obj.gitdir = this.gitdir;
        return obj;
    };
    MergeDoc.prototype.unserialize = function (obj) {
        Doc.prototype.unserialize.apply(this, arguments);
        this.gitdir = obj.gitdir;
        this.refresh(Utils.noop, false, true);
    };

    MergeDoc.prototype.save = function (cb) {
        if (!this.mergeTree) {
            return Notify.error('Merge no longer in progress');
        }
        var doc = this;
        Notify.ask('Mark as resolved?', function () {
            var item = doc.getItem();
            if (item) {
                item.conflict = false;
                item.mergedText = doc.getValue();
                cb && cb(doc);
                closeDoc(doc.id);

                MergeDoc.saveTree(
                    {
                        gitdir: doc.gitdir,
                        fs: doc.getFileServer(),
                    },
                    doc.mergeTree,
                );
                MergeDoc.previewTree(
                    doc.mergeTree,
                    MergeDoc.getProv(doc.mergeTree),
                );
            } else {
                cb && cb(doc, 'No such item');
                Notify.error('Error: Path not in merge tree');
            }
        });
    };

    var trees = {};
    MergeDoc.getProv = function (tree) {
        var GitImpl = tree.fs.$gitImpl || require('./git_interface').Git;
        return new GitImpl(tree.dir, tree.gitdir, tree.fs);
    };
    var loading = {};
    MergeDoc.getTree = function load(opts, cb) {
        var path = join(
            opts.gitdir + '-merge-index-' + opts.fs.getDisk() + '.json',
        );
        if (trees[path] !== undefined) cb(null, trees[path]);
        else {
            if (loading[path]) {
                loading[path].push(cb);
            } else {
                loading[path] = [cb];
                GitUtils.readFile(
                    'merge-index-' + opts.fs.getDisk(),
                    opts,
                    function (err, res) {
                        var tree;
                        if (err) {
                            if (err.code === 'ENOENT') {
                                tree = null;
                                err = undefined;
                            }
                        } else {
                            try {
                                tree = JSON.parse(res);
                                tree.fs = FileUtils.getFileServer(tree.fs);
                                trees[path] = tree;
                            } catch (e) {
                                err = e;
                            }
                        }
                        loading[path].forEach(function (op) {
                            op(err, tree);
                        });
                    },
                );
            }
        }
    };
    MergeDoc.saveTree = function (opts, tree) {
        trees[id] = tree;
        tree = Object.assign({}, tree);
        tree.fs = tree.fs.id;
        var res = JSON.stringify(tree);
        var id = join(
            opts.gitdir + '-merge-index-' + opts.fs.getDisk() + '.json',
        );
        GitUtils.writeFile(
            'merge-index-' + opts.fs.getDisk(),
            res,
            opts,
            function (err) {
                if (err)
                    Notify.error('Error while saving tree:' + err.toString());
            },
        );
    };
    MergeDoc.deleteTree = function (opts, tree, cb) {
        var id = join(
            opts.gitdir + '-merge-index-' + opts.fs.getDisk() + '.json',
        );
        trees[id] = undefined;
        GitUtils.removeFile('merge-index-' + opts.fs.getDisk(), opts, cb);
    };

    MergeDoc.prototype.factory = 'git-merge';
    Docs.registerFactory('git-merge', MergeDoc);
    exports.MergeDoc = MergeDoc;
}); /*_EndDefine*/