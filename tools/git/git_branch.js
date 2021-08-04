//Git Commands Branching
_Define(function(global) {
    var GitCommands = (global.GitCommands || (global.GitCommands = Object.create(null)));
    var createProgress = GitCommands.createProgress;
    var padStart = GitCommands.padStart;
    var success = GitCommands.success;
    var failure = GitCommands.failure;
    // var ItemList = global.ItemList;
    // var appConfig = global.allConfigs.git;
    var checkBox = global.styleCheckbox;
    var testPlain = GitCommands.testPlain;
    var configure = global.configure;
    var Notify = global.Notify;

    function pickBranch(prov, onSelect) {
        var branches;

        function showModal(currentBranch) {
            Notify.pick('Select Branch', branches, function(branch) {
                return onSelect(branch, branch == currentBranch);
            });
        }
        prov.listBranches().then(function(b) {
            branches = b;
            prov.currentBranch().then(showModal);
        });
    }

    function gotoRef(prov, ref, noCheckout, cb) {
        var progress = createProgress("Checking out " + ref);
        prov.checkout({
            ref: ref,
            onProgress: progress.update,
            noCheckout: noCheckout
        }).then(function() {
            progress.dismiss();
            Notify.info((noCheckout ? 'Updated HEAD to point at ' : 'Checked out files from ') + ref);
            cb && cb();
        }, function(e) {
            progress.dismiss();
            failure(e);
        });
    }
    GitCommands.switchBranch = function(ev, prov) {
        pickBranch(prov, function(item, isCurrent) {
            if (isCurrent) {
                return;
            }
            gotoRef(prov, item, false, function() {
                ev.browser.reload();
            });
            return true;
        });
    };
    GitCommands.switchBranchNoCheckout = function(ev, prov) {
        pickBranch(prov, function(item, isCurrent) {
            if (isCurrent) {
                return;
            }
            gotoRef(prov, item, true);
            return true;
        });
    };

    GitCommands.deleteBranch = function(ev, prov) {
        pickBranch(prov, function(item, isCurrent) {
            if (isCurrent) {
                return;
            }
            var key = padStart("" + Math.floor((Math.random() * 99999999)) + "", 8, "0");
            Notify.prompt('Delete branch ' + item +
                '?. This operation is irreversible. To proceed, enter ' + key,
                function(
                    ans) {
                    if (ans == key) {
                        prov.deleteBranch({
                            ref: item,
                        }).then(success, failure);
                    } else {
                        return false;
                    }
                });
            return true;
        });
    };
    GitCommands.createBranch = function(ev, prov) {
        var el = $(Notify.modal({
            header: "Create Branch",
            large: true,
            form: [{
                    caption: 'Select Remote',
                    name: 'selectRemote',
                    type: 'select'
                },
                {
                    type: 'div',
                    name: 'remoteOptions',
                    children: [{
                            caption: 'Shallow fetch',
                            type: 'accept',
                            name: 'cloneShallow',
                        },
                        {
                            caption: 'Select remote branch',
                            type: 'select',
                            name: 'pickRemoteBranch'
                        }
                    ],
                },
                {
                    caption: 'Branch name',
                    type: 'text',
                    name: 'branchName',
                }
            ],
            footers: ['Cancel', 'Create'],
            dismissible: true
        }));
        var remoteSelect = el.find('#selectRemote');
        var branchSelect = el.find('#pickRemoteBranch');
        var branchName = el.find("#branchName");
        var remoteOptions = el.find("#remoteOptions");
        remoteSelect.append("<option value='$local'>No Remote</option>");
        branchSelect.append("<option value='$input' id='current'>Default</option>");
        remoteOptions.hide();

        //add remotes
        prov.listRemotes().then(function(b) {
            b.forEach(function(remote) {
                remoteSelect.append("<option value='" + remote.remote + "'>" +
                    remote
                    .remote + ": " + remote.url.split("/")
                    .slice(-2).join("/") + "</option>");
            });
            // if (appConfig.defaultRemote) {
            //     remoteSelect.val(appConfig.defaultRemote);
            // }
        });

        var lastRemote = null;

        function updateBranches() {
            if (this.value == "$local") {
                remoteOptions.hide();
            } else {
                remoteOptions.show();
                if (this.value != lastRemote) {
                    branchSelect.children().not("#current").remove();
                    branchSelect.val("$input");
                    prov.listBranches({
                        remote: this.value
                    }).then(function(b) {
                        b.forEach(function(remote) {
                            branchSelect.append("<option value='" + remote + "'>" +
                                remote + "</option>");
                        });
                    });
                }
            }
        }
        updateBranches.call(remoteSelect[0]);
        remoteSelect.change(updateBranches);
        checkBox(el);
        el.on("submit", function(e) {
            e.preventDefault();
            var ref = branchName.val();
            if (!testPlain(ref)) {
                branchName.focus();
                return;
            }
            prov.resolveRef({
                ref
            }).then(function() {
                Notify.error('Branch name is already in use');
            }, function() {
                var remote = remoteSelect.val();
                if (!remote || remote == '$local') {
                    el.modal('close');
                    return prov.resolveRef({
                        ref: 'HEAD',
                    }).then(function() {
                        prov.branch({
                            ref: ref,
                        }).then(success, failure);
                    }, function() {
                        failure(
                            "Failed to resolve HEAD. Note: You cannot create a branch on an empty repository"
                            );
                    });
                }
                var remoteRef = branchSelect.val();
                if (!remoteRef || remoteRef == "$input") {
                    remoteRef = ref;
                }
                remoteRef.replace('refs/heads/', '');

                function retry(retried) {
                    prov.resolveRef({
                        ref: remoteRef,
                    }).then(function(oid) {
                        // Create a new branch that points at that same commit
                        prov.writeRef({
                            ref: "refs/heads/" + remote + '/' + remoteRef,
                            value: oid,
                        }).then(function() {
                            el.modal('close');
                            configure("defaultRemoteBranch", remoteRef,
                                "git");
                            // Set up remote tracking branch
                            prov.setConfig({
                                path: "branch." + ref + ".remote",
                                value: remote
                            });
                            prov.setConfig({
                                path: "branch." + ref + ".merge",
                                value: "refs/heads/" + remoteRef
                            });
                            success();
                        }, failure);
                    }, function(e) {
                        if (!retried) {
                            var progress = createProgress(
                                'Fetching remote branch......');
                            prov.fetch({
                                remote: remote,
                                singleBranch: true,
                                ref: ref,
                                depth: el.find("#cloneShallow").val() ? 2 :
                                    undefined,
                            }).then(function() {
                                progress.dismiss();
                                retry();
                            }, progress.error);
                        } else failure(e);
                    });
                }
                retry();
            });
        });
    };
}); /*_EndDefine*/
