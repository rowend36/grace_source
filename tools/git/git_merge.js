/*Merge Doc*/
_Define(function(global) {
    "use strict";
    var Utils = global.Utils;
    var Docs = global.Docs;
    var Notify = global.Notify;
    var closeDoc = global.closeDoc;
    var Doc = global.Doc;
    var normalize = global.FileUtils.normalize;
    var join = global.FileUtils.join;

    function MergeDoc() {
        MergeDoc.super(this, arguments);
    }
    Utils.inherits(MergeDoc, Doc);
    MergeDoc.require = (function() {
        var loaded = {};
        var loading = {};
        return function load(url, fs, cb) {
            var path = fs.getDisk() + ":" + normalize(url);
            if (loaded[path]) {
                cb(loaded[path]);
            } else {
                if (loading[path]) {
                    loading[path].push(cb);
                } else {
                    loading[path] = [cb];
                    fs.readFile(url, "utf8", function(e, res) {
                        var waiting = loading[path];
                        loading[path] = null;
                        var result;
                        if (!e) {
                            result = loaded[path] = JSON.parse(res);
                        }
                        waiting.forEach(function(t) {
                            try {
                                t(result, e);
                            } catch (e) {
                                console.error(e);
                            }
                        });
                    });
                }
            }
        };
    })();
    //get the conflict item corresponding to this document
    MergeDoc.prototype.getItem = function() {
        var path = this.getPath().substring(this.mergeTree.href.length);
        var tree = this.mergeTree.tree;
        var length = tree.length;
        for (var i = 0; i < length; i++) {
            if (tree[i].path == path) return tree[i];
        }
    };
    //revert all the changes in the doc
    MergeDoc.prototype.refresh = function(cb, force, ignoreDirty) {
        if (!this.mergeTree) {
            var dir = this.dir;
            var gitdir = this.gitdir;
            MergeDoc.require(join(dir, gitdir + "-merge"), this.getFileServer(), (function(c) {
                var path = this.getPath();
                if ((c && path.startsWith(c.href))) {
                    this.mergeTree = c;
                    Docs.setValue(this, this.getItem().mergedText, cb, force, ignoreDirty);
                } else cb && cb(this, "stale");
            }).bind(this));
        } else {
            Docs.setValue(this, this.getItem().mergedText, cb, force, ignoreDirty);
        }
        return true;
    };
    MergeDoc.prototype.serialize = function() {
        var obj = Doc.prototype.serialize.apply(this, arguments);
        obj.dir = this.dir;
        obj.gitdir = this.gitdir;
        return obj;
    };
    MergeDoc.prototype.unserialize = function(obj) {
        Doc.prototype.unserialize.apply(this, arguments);
        this.dir = obj.dir;
        this.gitdir = obj.gitdir;
    };
    MergeDoc.prototype.save = function(cb) {
        if (!this.mergeTree) {
            return Notify.error('Merge no longer in progress');
        }
        var doc = this;
        Notify.ask("Mark as resolved?", function() {
            var item = doc.getItem();
            if (item) {
                item.conflict = false;
                item.mergedText = doc.getValue();
                cb && cb(doc);
                closeDoc(doc.id);
                MergeDoc.previewTree(doc.mergeTree, doc.prov);
            } else {
                cb && cb(doc, 'No such item');
                Notify.error('Error: Path not in merge tree');
            }
        });
    };
    MergeDoc.prototype.factory = 'git-merge';
    Docs.registerFactory("git-merge", MergeDoc);
    global.MergeDoc = MergeDoc;
}); /*_EndDefine*/
//Git Commands Merging
_Define(function(global) {
    var Notify = global.Notify;
    var GitCommands = global.GitCommands;
    var doConfig = GitCommands.doConfig;
    var testPlain = GitCommands.testPlain;
    var testUrl = GitCommands.testUrl;
    var success = GitCommands.success;
    var failure = GitCommands.failure;
    var createProgress = GitCommands.createProgress;
    var appConfig = global.allConfigs.git;
    var configure = global.configure;
    var Docs = global.Docs;
    var docs = global.docs;
    var addDoc = global.addDoc;
    var MergeDoc = global.MergeDoc;
    var filename = global.FileUtils.filename;
    var checkBox = global.styleCheckbox;

    function previewTree(opts, prov) {
        //preview the current results of the merge
        var ourHref = opts.href;

        function gatherConflicts() {
            return opts.tree.filter(function(e) {
                return e.conflict || e.result;
            });
        }

        function gatherMods(t, side) {
            return opts.tree.filter(function(e) {
                return e.head == side;
            });
        }
        var changes = gatherMods(opts, opts.theirs);
        var conflicts = gatherConflicts(opts);
        var noConflict = !opts.tree.some(e => e.conflict);
        var el = $(Notify.modal({
            header: ' Merge ' + opts.theirs + ' to ' + opts.ours,
            body: (noConflict ? "<h6 class='green-text'>Automatic merge is possible</h6>" :
                    "<h6 class='git-warning-text'>Automatic merge failed</h6>") +
                "<ul class='fileview'></ul><div class='modal-footer'><button class='modal-close btn git-warning'>Cancel</button></div>",
        }));
        var ul = el.find('ul')[0];
        changes.map(createChangeListItem);
        conflicts.map(createConflictCard);
        if (noConflict) {
            el.find('.modal-footer').append("<button class='right modal-close btn' style='margin-left:10px'>Proceed</button>")
                .children().last().on('click', function() {
                    var progress = createProgress('Merging....');
                    prov.completeMerge(opts).then(function() {
                        progress.dismiss();
                        Notify.info('Merge completed');
                    }, progress.error);
                });
        }

        function createConflictCard(item, i) {
            var card = $(document.createElement('li'));
            card.addClass('conflict-item');
            card.attr('merge-index', i);
            //show icon???
            //card.append("<i class='h-30 material-icons" + (item.conflict ? " git-warning-text'>warning" : " '>done)")+"</i>");
            var path = card.append("<span class='h-30 conflict-path'></span>").children().last();
            path.text(item.path);
            card.append("<button merge-index=" + i + " class='btn btn-flat right review-btn'>Review</button></br>");
            if (item.mergedText) {
                card.append("<i class='h-30'>" + (item.conflict ? "Failed to merge" : "Successfully merged") + "</i>");
            } else card.append("<i><i class='material-icons git-warning-text'>error</i>Unresolvable Conflict</i>");
            ul.appendChild(card[0]);
        }

        function createChangeListItem(item) {
            var card = $(document.createElement('li'));
            var text = item.isDelete ? "Deleted " : item.isAdd ? "Added " : (item.head != opts.ours) ? "Updated " + (item.mode ?
                "and changed mode to " + item.mode : "") : item.mode ? "Changed mode to " + item.mode : "Change " + JSON.stringify(
                item);
            card.text(text + " " + item.path);
            ul.appendChild(card[0]);
        }

        function reviewConflict(mergeIndex) {
            var item = conflicts[mergeIndex];
            var docPath = ourHref + item.path;
            var doc;
            if ((doc = Docs.forPath(docPath))) {
                Docs.swapDoc(doc.id);
                if (!doc.mergeTree) {
                    doc.dir = opts.dir;
                    doc.gitdir = filename(opts.gitdir);
                    doc.mergeTree = opts;
                    doc.prov = prov;
                    doc.setValue(item.mergedText, true);
                }
            } else {
                doc = docs[addDoc(null, new MergeDoc(item.mergedText, ourHref + item.path))];
                //save somewhere else
                doc.dir = opts.dir;
                doc.gitdir = filename(opts.gitdir);
                doc.mergeTree = opts;
                doc.prov = prov;
                doc.setClean();
            }
        }
        el.on('click', '.review-btn', function() {
            reviewConflict(this.getAttribute("merge-index"));
        });
    }
    //TODO A way to automatically run this on start
    GitCommands.doMerge = function(ev, prov) {
        var html = ["<form>", "<label>Select Branch </label>", "<select></select></br>",
            "<input type='checkbox' name='fastForward' id='fastForward'/>",
            "<span style='margin-right:30px'>Fast Forward Only</span></br>",
            "<input type='checkbox' name='review' id='review'/>",
            "<span style='margin-right:30px'>Dry Run(only attempt)</span></br>",
            "<span style='margin-right:30px'>Current Branch: </span><i id='currentBranch'></i></br>",
            "<input style='margin:10px' class='git-warning btn modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Merge'/>", "</form>"
        ].join("");
        var el = $(Notify.modal({
            header: "Merge Changes",
            body: html,
            dismissible: false
        }, function() {
            el.find('select').off();
            el.find('form').off();
        }));
        checkBox(el);
        var currentBranch;
        prov.currentBranch().then(function(b) {
            currentBranch = b;
            el.find('#currentBranch').html(currentBranch);
        });
        var branchSelect = el.find('select');

        function updateBranches() {
            prov.listBranches().then(function(list) {
                list.forEach(function(branch) {
                    branchSelect.append("<option value='" + branch + "'>" + branch + ": " + branch + "</option>");
                });
            });
        }
        updateBranches();
        el.find('form').on('submit', function(e) {
            e.preventDefault();
            var ref = branchSelect.val();
            var progress = createProgress("Merging " + currentBranch + " with " + ref);
            var fastForwardOnly = el.find('#fastForward')[0].checked;
            var interactive = el.find('#review')[0].checked;
            var opts = {
                theirs: ref,
                author: {
                    name: appConfig.gitName,
                    email: appConfig.gitEmail,
                },
                dryRun: interactive,
                fastForwardOnly: fastForwardOnly,
                onProgress: progress.update,
            };

            function finish(result) {
                progress.dismiss();
                if (result.sameRef) {
                    Notify.info('Both branches are identical');
                } else if (result.alreadyMerged) {
                    Notify.info('Target branch has already merged into this branch');
                } else if (result.fastForward) {
                    if (!interactive) {
                        el.modal('close');
                    }
                    Notify.info('Fast Forward merge ' + (interactive ? 'possible' : 'successful'));
                } else if (result.tree) {
                    //interactive merge
                    el.modal('close');
                    result.href = "git-merge:/" + result.ourOid.substring(0, 5) + "." + result.theirOid.substring(0, 5) + "/";
                    result.dir = prov.dir;
                    for (var id in docs) {
                        if (docs[id].getPath().startsWith(result.href)) {
                            docs[id].mergeTree = result;
                            docs[id].prov = prov;
                        }
                    }
                    //todo save merge
                    previewTree(result, prov);
                } else success();//Other git implementations
            }
            prov.merge(opts).then(finish, progress.error);
        });
    };
    /*refs and remotes*/
    GitCommands.addRemote = function(ev, prov, done) {
        var html = ["<form>", "<label>Enter remote name</label>",
            "<input style='margin-bottom:10px' id=inputName name=inputName type=text></input>",
            "<label>Enter remote url</label>", "<input style='margin-bottom:10px' id=inputUrl name=inputUrl type=text></input>",
            "<button style='margin:10px' class='git-warning btn' class='modal-close'>Cancel</button>",
            "<input style='margin:10px' class='btn right' name=doSubmit type=submit></input>", "</form>"
        ].join("");
        var el = Notify.modal({
            header: "Add Remote",
            body: html
        }, function() {
            $(el).find('form').off();
        });
        $(el).find('form').on('submit', function(e) {
            e.preventDefault();
            var name = $(this).find('#inputName')[0].value;
            var url = $(this).find('#inputUrl')[0].value;
            if (!testPlain(name)) {
                Notify.error('Invalid remote name');
            } else if (!testUrl(url)) {
                Notify.error('Invalid remote url');
            } else {
                $(el).modal('close');
                prov.addRemote({
                    remote: name,
                    url: url,
                }).then(done || success, failure);
            }
        }).find('button').click(function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(el).modal('close');
        });
    };
    GitCommands.doPush = function(ev, prov) {
        GitCommands.doPull(ev, prov, true);
    };
    GitCommands.doPull = function(ev, prov, isPush) {
        //todo find changed files efficiently
        var allStaged = true;
        var method = isPush ? "push" : "pull";
        var html = ["<form>", "<label>Select Remote</label>", "<select></select></br>", "<label>Remote Branch Name</label>",
            "<input name=branchName' id='branchName' placeholder='default'></input>",
            "<input type='checkbox' name='fastForward' id='fastForward'/>",
            "<span style='margin-right:30px'>Fast Forward Only</span>",
            "<input style='margin:10px' class='git-warning btn modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='" + method.replace("p", "P") +
            "'/>", "</form>",
        ].join("");
        var el = $(Notify.modal({
            header: method.replace("p", "P") + " Changes",
            body: html,
            dismissible: false
        }, function() {
            el.find('select').off();
            el.find('form').off();
        }));
        prov.listRemotes().then(function(b) {
            if (!b.length) {
                GitCommands.addRemote(ev, prov, function() {
                    prov.listRemotes().then(function(b) {
                        b.forEach(function(remote) {
                            el.find('select').append("<option value='" + remote.remote + "'>" + remote.remote + ": " +
                                remote.url.split("/").slice(-2).join("/") + "</option>");
                        });
                        el.find('select').val(appConfig.defaultRemote || b[0].remote);
                    });
                });
            }
            b.forEach(function(remote) {
                el.find('select').append("<option value='" + remote.remote + "'>" + remote.remote + ": " + remote.url.split(
                    "/").slice(-2).join("/") + "</option>");
            });
            el.find('select').val(b[0] ? appConfig.defaultRemote || b[0].remote : appConfig.defaultRemote);
        });
        prov.currentBranch().then(function(a) {
            el.find("#branchName").attr('placeholder', a);
        });
        if (appConfig.defaultRemoteBranch) {
            el.find("#branchName").val(appConfig.defaultRemoteBranch);
        }
        el.find('select').on('change', function() {
            configure('defaultRemote', el.find('select').val(), "git");
        });
        checkBox(el);
        el.find("form").on("submit", function(e) {
            e.preventDefault();
            el.modal("close");
            var t = el.find("#branchName").val();
            if (t) configure("defaultRemoteBranch", t, "git");
            if (isPush || allStaged) {
                retry(config);
            }
            return false;
        });
        var config;
        if (appConfig.useDiskConfig) {
            config = {
                'username': appConfig.gitName,
                'default': true
            };
            ["user.email", "user.password"].forEach(function(i) {
                prov.getConfig({
                    path: i
                }).then(function(a) {
                    switch (i) {
                        case "user.email":
                            config.email = a;
                            break;
                        case "user.password":
                            config.password = a;
                            break;
                    }
                });
            });
        }

        function retry(config) {
            var progress = createProgress(method);
            var branch = el.find("#branchName").val();
            var remote = el.find('select').val();
            prov[method]({
                remote,
                remoteRef: branch,
                author: {
                    name: appConfig.gitName,
                    email: appConfig.gitEmail,
                },
                fastForwardOnly: el.find('#fastForward')[0].checked,
                onAuth: function() {
                    return new Promise(function(resolve) {
                        resolve({
                            username: config ? config.email : appConfig.gitEmail,
                            password: config ? config.password : appConfig.gitPassword
                        });
                    });
                },
                onAuthSuccess: function() {
                    if (!config || config.default) return;
                    Notify.ask('Save password', function() {
                        configure("gitEmail", config.email, "git");
                        configure("gitPassword", config.password, "git");
                        if (config.username) configure("gitName", config.username, "git");
                        if (appConfig.useDiskConfig) {
                            var dict = {
                                "user.email": "gitEmail",
                                "user.password": "gitPassword"
                            };
                            for (var i in dict) {
                                prov.setConfig({
                                    path: i,
                                    value: appConfig[dict[i]]
                                });
                            }
                        }
                    });
                },
                onProgress: progress.update,
                onAuthFailure: function() {
                    doConfig(ev, prov, retry);
                }
            }).then(function() {
                progress.dismiss();
                Notify.info(method.replace("p", "P") + " Successful");
                ev.browser.reload();
            }, function(e) {
                if ((e + "").indexOf("No name was provided") > -1) {
                    progress.dismiss();
                    Notify.prompt("Enter Author name", function(name) {
                        if (name) {
                            configure("gitName", name, "git");
                            retry(config);
                        }
                    });
                } else {
                    if (isPush || (e.code != 'MergeNotSupportedError' && e.code != 'FastForwardError')) {
                        progress.error(e);
                        return ev.browser.reload();
                    }
                    manualMerge(prov, progress, branch, remote);
                }
            });
        }

        function manualMerge(prov, progress, branch, remote) {
            Notify.ask('Unresolvable Conflicts found.\n Proceed to create new branch and resolve ?', function() {
                var remoteRef = remote + "/" + branch;
                var randomBranch;

                function doMerge() {
                    var opts = {
                        theirs: randomBranch,
                        author: {
                            name: appConfig.gitName,
                            email: appConfig.gitEmail,
                        },
                        onProgress: progress.update,
                    };
                    prov.merge(opts).then(function(tree) {
                        progress.dismiss();
                        if (tree.alreadyMerged) {
                            Notify.info('Branches are already merged');
                        } else if (tree.fastForward) {
                            Notify.info('Merge successful');
                        } else {
                            tree.href = "git-merge:/" + tree.ourOid.substring(0, 5) + "." + tree.theirOid.substring(0, 5) + "/";
                            tree.dir = prov.dir;
                            restartMerge(tree);
                            //todo save merge
                            previewTree(tree, prov);
                        }
                    }, progress.error);
                }
                prov.resolveRef({
                    ref: remoteRef,
                }).then(function(oid) {
                    // Create a new branch that points at that same commit
                    randomBranch = "_temp_" + oid;
                    prov.writeRef({
                        ref: "refs/heads/" + randomBranch,
                        value: oid,
                    }).then(doMerge, progress.error);
                }, progress.error);
            }, progress.dismiss);
        }
    };

    function restartMerge(tree) {
        for (var id in docs) {
            if (docs[id].constructor == MergeDoc && docs[id].getPath().startsWith(tree.href)) {
                docs[id].mergeTree = tree;
            }
        }
    }
    MergeDoc.previewTree = previewTree;
}); /*_EndDefine*/
