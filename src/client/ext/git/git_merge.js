//Git Commands Merging
define(function(require,exports,module) {
    var Notify = require("grace/ui/notify").Notify;
    var GitCommands = require("./git_commands").GitCommands;
    var doConfig = GitCommands.doConfig;
    var testPlain = GitCommands.testPlain;
    var success = GitCommands.success;
    var createProgress = GitCommands.createProgress;
    var appConfig = require("grace/core/config").Config.allConfigs.git;
    var configure = require("grace/core/config").Config.configure;
    var Docs = require("grace/docs/docs").Docs;
    var docs = require("grace/docs/document").docs;
    var addDoc = require("grace/docs/docs").addDoc;
    var MergeDoc = require("./merge_doc").MergeDoc;
    var setTab = require("grace/setup/setup_tab_host").setTab;
    var debug = console;
    
    function completeMerge(prov, tree, cb) {
        var progress = createProgress('Merging....');
        return prov.completeMerge(tree).then(function(oid) {
            return checkout(prov, oid, progress).then(function() {
                progress.update({
                    phase: 'Cleaning up',
                    loaded: 1,
                    total: 1
                });
                MergeDoc.deleteTree(prov, tree, function(e) {
                    progress.dismiss();
                    cb(e);
                });
            }, progress.error);
        }, progress.error);
    }

    function previewTree(opts, prov) {
        //preview the current results of the merge
        var ourHref = opts.href;
        appConfig.enableMergeMode = true;
        GitCommands.highlightMerge3();

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
        var noConflict = !opts.tree.some(function(e) {
            return e.conflict;
        });
        var el = $(Notify.modal({
            header: ' Merge ' + opts.theirs + ' to ' + opts.ours,
            body: (noConflict ? "<h6 class='green-text'>Automatic merge is possible</h6>" :
                    "<h6 class='git-warning-text'>Automatic merge failed</h6>") +
                "<ul class='fileview'></ul>",
            footers: ['Cancel', 'Proceed']
        }));
        var ul = el.find('ul')[0];
        changes.map(createChangeListItem);
        conflicts.map(createConflictCard);
        if (noConflict) {
            el.find('.modal-cancel').on('click', function() {
                MergeDoc.deleteTree(prov, opts);
                el.modal('close');
                return false;
            });
            el.find('.modal-proceed').on('click', function() {
                completeMerge(prov, opts, function() {
                    Notify.info('Merge completed');
                    el.modal('close');
                });
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
            card.append("<button merge-index=" + i +
                " class='btn btn-flat right review-btn'>Review</button></br>");
            if (item.mergedText) {
                card.append("<i class='h-30'>" + (item.conflict ? "Failed to merge" : "Successfully merged") +
                    "</i>");
            } else card.append(
                "<i><i class='material-icons git-warning-text'>error</i>Unresolvable Conflict</i>");
            ul.appendChild(card[0]);
        }

        function createChangeListItem(item) {
            var card = $(document.createElement('li'));
            var text = item.isDelete ? "Deleted " : item.isAdd ? "Added " : (item.head != opts.ours) ?
                "Updated " + (item.mode ?
                    "and changed mode to " + item.mode : "") : item.mode ? "Changed mode to " + item.mode :
                "Change " + JSON.stringify(
                    item);
            card.text(text + " " + item.path);
            ul.appendChild(card[0]);
        }

        function reviewConflict(mergeIndex) {
            var item = conflicts[mergeIndex];
            var docPath = ourHref + item.path;
            var doc;
            if ((doc = Docs.forPath(docPath))) {
                setTab(doc.id);
                if (!doc.mergeTree) {
                    doc.fileServer = opts.fs.id;
                    doc.gitdir = opts.gitdir;
                    doc.mergeTree = opts;
                    doc.setValue(item.mergedText, true);
                }
            } else {
                doc = docs[addDoc(null, new MergeDoc(item.mergedText, ourHref + item.path))];
                //save somewhere else
                doc.fileServer = opts.fs.id;
                doc.gitdir = opts.gitdir;
                doc.mergeTree = opts;
                doc.setClean();
            }
        }
        el.on('click', '.review-btn', function() {
            reviewConflict(this.getAttribute("merge-index"));
        });
    }

    function checkout(prov, oid, progress) {
        var expandedRef = null;
        //Due to an inaccurate way of using merge
        //We need to go about this circumspectly the way we did with gitpull
        const git = window.git;
        //get current branch
        return prov.currentBranch().
        then(function(branch) {
            return git.expandRef({
                fs: prov.fs,
                gitdir: prov.gitdir,
                ref: branch
            });
        }).
        //expand branch name unnecessary with jgit
        then(function(branch) {
            expandedRef = branch;
            return git.writeRef({
                fs: prov.fs,
                gitdir: prov.gitdir,
                ref: 'grace/ORIG_HEAD',
                symbolic: true,
                force: true,
                value: branch
            });
        }).
        //checkout new tree
        //If the checkout fails halfway
        //Then the stage will match oid,
        //But head will be on current branch
        //since both jgit and git do not update head 
        ///until after the checkout
        then(function() {
            return prov.checkout({
                onProgress: progress.update,
                ref: oid,
                noUpdateHead: true
            });
        }).
        //update branch pointer 
        then(function() {
            //STAGE 2 update branch pointer to current branch
            return git.writeRef({
                fs: prov.fs,
                gitdir: prov.gitdir,
                ref: expandedRef,
                force: true,
                value: oid
            });
        }).
        //Stage 3: if for any reason noUpdate head was ignored
        //set current branch
        then(function() {
            return git.writeRef({
                fs: prov.fs,
                gitdir: prov.gitdir,
                symbolic: true,
                force: true,
                ref: 'HEAD',
                value: expandedRef,
            });
        }).
        catch(progress.error);
    }
    //TODO A way to automatically run this on start
    GitCommands.doMerge = function(ev, prov) {
        MergeDoc.getTree(prov, function(err, tree) {
            if (err || !tree) {
                startMerge(ev, prov);
            } else previewTree(tree, prov);
        });
    };

    function startMerge(ev, prov) {
        var el = $(Notify.modal({
            header: "Merge Changes",
            form: [{
                    caption: 'Select Branch',
                    type: 'select',
                    name: 'branchSelect'
                },
                {
                    caption: 'Fast forward only',
                    type: 'accept',
                    name: 'fastForward'
                },
                {
                    caption: 'Dry run (only attempt merge)',
                    type: 'accept',
                    name: 'review'
                },
                "<span style='margin-right:30px'>Current Branch: </span><i id='currentBranch'></i>"
            ],
            footers: ['Cancel', 'Merge'],
            dismissible: false
        }));
        var currentBranch;
        prov.currentBranch().then(function(b) {
            currentBranch = b;
            el.find('#currentBranch').html(currentBranch);
        });

        function updateBranches() {
            prov.listBranches().then(function(list) {
                list.forEach(function(branch) {
                    var branchSelect = el.find('select');
                    branchSelect.append("<option value='" + branch + "'>" + branch + ": " +
                        branch + "</option>");
                });
            });
        }
        updateBranches();
        
        el.on('submit', function() {
            var result = require("grace/ui/form").Form.parse(el);
            var ref = result.branchSelect;
            var progress = createProgress("Merging " + currentBranch + " with " + ref);
            var fastForwardOnly = result.fastForward;
            var dryRun = result.review;
            var opts = {
                theirs: ref,
                author: {
                    name: appConfig.gitUsername,
                    email: appConfig.gitEmail,
                },
                committer: {
                    name: appConfig.gitUsername,
                    email: appConfig.gitEmail,
                },
                dryRun: dryRun,
                fastForwardOnly: fastForwardOnly,
                onProgress: progress.update,
                diffFormat: appConfig.diffFormat
            };

            function finish(result) {
                if (!result.fastForward)
                    progress.dismiss();
                if (result.sameRef) {
                    Notify.info('Both branches are identical');
                } else if (result.alreadyMerged) {
                    Notify.info('Target branch has already merged into this branch');
                } else if (result.fastForward) {
                    if (dryRun) {
                        progress.dismiss();
                        Notify.info('Fast forward merge possible');
                    } else {
                        el.modal('close');
                        checkout(prov, result.oid, progress).then(function() {
                            Notify.info('Fast Forward merge successful');
                        }, progress.error);
                    }
                } else if (result.tree) {
                    //Interactive in-memory merge
                    el.modal('close');
                    return restartMerge(result, prov);
                }
                //Any oother git implementations
                else success();
                if (!dryRun) {
                    el.modal('close');
                }
            }
            prov.merge(opts).then(finish, progress.error);
        });
    }
    /*refs and remotes*/
    GitCommands.doPush = function(ev, prov) {
        GitCommands.doPull(ev, prov, true);
    };
    GitCommands.doPull = function(ev, prov, isPush) {
        //todo find changed files efficiently
        var allStaged = true;
        var method = isPush ? "push" : "pull";
        var el = $(Notify.modal({
            header: method.replace("p", "P") + " Changes",
            form: [{
                    caption: 'Select remote',
                    type: 'select',
                    name: 'remote'
                },
                {
                    caption: 'Enter remote branch name',
                    type: 'text',
                    name: 'branchName',
                },
                {
                    caption: 'Fast forward only',
                    type: 'accept',
                    name: 'fastForward'
                }
            ],
            footers: ['Cancel', 'Proceed'],
            dismissible: false
        }));
        prov.listRemotes().then(function(b) {
            if (!b.length) {
                GitCommands.addRemote(ev, prov, function() {
                    prov.listRemotes().then(function(b) {
                        b.forEach(function(remote) {
                            el.find('select').append("<option value='" +
                                remote.remote + "'>" + remote.remote +
                                ": " +
                                remote.url.split("/").slice(-2).join(
                                    "/") + "</option>");
                        });
                        el.find('select').val(appConfig.defaultRemote || b[0]
                            .remote);
                    });
                });
            }
            b.forEach(function(remote) {
                el.find('select').append("<option value='" + remote.remote + "'>" + remote
                    .remote + ": " + remote.url.split(
                        "/").slice(-2).join("/") + "</option>");
            });
            el.find('select').val(b[0] ? appConfig.defaultRemote || b[0].remote : appConfig
                .defaultRemote);
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
        //Load stored authentication
        var config;
        var configPromise = Promise.all([
            ["user.email", "gitEmail"],
            ["user.name", "gitUsername"],
            ["user.password", "gitPassword"]
        ].map(function(i) {
            var key = i[0],
                val = i[1];
            if (appConfig[val]) {
                return;
            } else {
                return prov.getConfig({
                    path: key
                }).then(function(a) {
                    appConfig[val] = a;
                });
            }
        })).then(function() {
            config = {
                'username': appConfig.gitUsername,
                'password': appConfig.gitPassword,
                'default': true
            };
        });

        function retry(config) {
            var progress = createProgress(method);
            var result = require("grace/ui/form").Form.parse(el);
            var branch = result.branchName;
            var remote = result.remote;
            prov[method]({
                remote,
                remoteRef: branch,
                author: {
                    name: appConfig.gitUsername,
                    email: appConfig.gitEmail,
                },
                fastForwardOnly: result.fastForward,
                onAuth: function() {
                    return {
                        username: config.username,
                        password: config.password
                    };
                },
                onAuthSuccess: function() {
                    if (config.default) return;
                    Notify.ask('Save login details?', function() {
                        configure("gitUsername", config.username, "git");
                        configure("gitPassword", config.password, "git");
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
                        if (!testPlain(name)) {
                            Notify.error('Invalid name');
                            return false;
                        }
                        if (name) {
                            configure("gitUsername", name, "git");
                            retry(config);
                        }
                    });
                } else {
                    if (isPush || (e.code != 'MergeNotSupportedError' && e.code !=
                            'FastForwardError')) {
                        progress.error(e);
                        debug.log(e);
                        return ev.browser.reload();
                    }
                    manualMerge(prov, progress, branch, remote);
                }
            });
        }
        el.on("submit", function(e) {
            e.preventDefault();
            el.modal("close");
            var t = el.find("#branchName").val();
            if (t) configure("defaultRemoteBranch", t, "git");
            //don't pull unless everything is staged
            if (isPush || allStaged) {
                configPromise.then(function() {
                    retry(config);
                });
            }
            return false;
        });

    };

    function manualMerge(prov, progress, branch, remote) {
        Notify.ask('Unresolvable Conflicts found.\n Proceed to create temporary branch and resolve ?',
            function() {
                var remoteRef = remote + "/" + branch;
                var randomBranch;

                function doMerge() {
                    var opts = {
                        theirs: randomBranch,
                        author: {
                            name: appConfig.gitUsername,
                            email: appConfig.gitEmail,
                        },
                        committer: {
                            name: appConfig.gitUsername,
                            email: appConfig.gitEmail,
                        },
                        onProgress: progress.update,
                        diffFormat: appConfig.diffFormat
                    };
                    prov.merge(opts).then(function(tree) {
                        progress.dismiss();
                        if (tree.alreadyMerged) {
                            Notify.info('Branches are already merged');
                        } else if (tree.fastForward) {
                            Notify.info('Merge successful');
                        } else if (tree.tree) {
                            restartMerge(tree, prov);
                        } else success();
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

    function restartMerge(tree, prov) {
        tree.href = "git-merge:/" + tree.ourOid.substring(0, 5) + "." + tree
            .theirOid.substring(0, 5) + "/";
        tree.dir = prov.dir;
        for (var id in docs) {
            if (docs[id].constructor == MergeDoc && docs[id].getPath().startsWith(tree.href)) {
                docs[id].mergeTree = tree;
                docs[id].gitdir = tree.gitdir;
            }
        }
        //todo save merge
        MergeDoc.saveTree(prov, tree);
        previewTree(tree, prov);
    }
    MergeDoc.previewTree = previewTree;
}); /*_EndDefine*/
