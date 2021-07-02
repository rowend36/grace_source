//Git Commands Branching
_Define(function(global) {
    var GitCommands = (global.GitCommands || (global.GitCommands = Object.create(null)));
    var handleError = GitCommands.handleError;
    var createProgress = GitCommands.createProgress;
    var padStart = GitCommands.padStart;
    var success = GitCommands.success;
    var failure = GitCommands.failure;
    var ItemList = global.ItemList;
    var AutoCloseable = global.AutoCloseable;
    var appConfig = global.allConfigs.git;
    var checkBox = global.styleCheckbox;
    var testPlain = GitCommands.testPlain;
    var configure = global.configure;
    var Notify = global.Notify;
    var branchList;

    function pickBranch(prov, onSelect) {
        var branches;

        function showModal(currentBranch) {
            if (!branchList) {
                branchList = new ItemList('git-branches', branches);
                branchList.headerText = "Select Branch";
                branchList.footer = ["Cancel"];
                branchList.$cancel = function() {
                    branchList.$el.modal('close');
                };
                branchList.createElement();
                branchList.$el.modal(AutoCloseable);
                branchList.on('select', function(ev) {
                    branchList.sendResult(ev.item);
                });
            }
            //
            branchList.sendResult = onSelect;
            branchList.current = currentBranch;
            branchList.items = branches;
            branchList.render();
            $(branchList.getElementAtIndex(branches.indexOf(currentBranch))).removeClass('tabbable').addClass('marked-file');
            $(branchList.$el).modal('open');
        }
        prov.listBranches().then(function(b) {
            branches = b;
            prov.currentBranch().then(showModal);
        });
    }

    function gotoRef(prov, ref, noCheckout) {
        var progress = createProgress("Checking out " + ref);
        if (!noCheckout) prov = prov.cached();
        prov.checkout({
            ref: ref,
            onProgress: progress.update,
            noCheckout: noCheckout
        }).then(function() {
            progress.dismiss();
            Notify.info((noCheckout ? 'Updated HEAD to point at ' : 'Checked out files from ') + ref);
        }, function(e) {
            progress.dismiss();
            if (!handleError(e)) {
                Notify.error('Error while switching branch');
            }
        });
    }
    GitCommands.switchBranch = function(ev, prov) {
        pickBranch(prov, function(item) {
            if (item == branchList.current) {
                return;
            }
            gotoRef(prov, item, false);
            branchList.$el.modal('close');
        });
    };
    GitCommands.switchBranchNoCheckout = function(ev, prov) {
        pickBranch(prov, function(item) {
            if (item == branchList.current) {
                return;
            }
            gotoRef(prov, item, true);
            branchList.$el.modal('close');
        });
    };
    GitCommands.deleteBranch = function(ev, prov) {
        pickBranch(prov, function(item) {
            if (item == branchList.current) {
                return;
            }
            branchList.$el.modal('close');
            var key = padStart("" + Math.floor((Math.random() * 99999999)) + "", 8, "0");
            Notify.prompt('Delete branch ' + item + '?. This operation is irreversible. To proceed, enter ' + key, function(
                ans) {
                if (ans == key) {
                    prov.deleteBranch({
                        ref: item,
                    }).then(success, failure);
                } else {
                    return false;
                }
            });
        });
    };
    GitCommands.createBranch = function(ev, prov) {
        var html = ["<form>", "<label>Select Remote</label>",
            "<select id='selectRemote'><option value='$local'>No Remote</option></select></br>",
            "<div id='pickRemoteBranchDiv' style='display:none'>", "<label>Select Remote Branch</label>",
            "<input type='checkbox' name='cloneShallow' id='cloneShallow'/>",
            "<span style='margin-right:30px'>Shallow fetch</span>",
            "<select id='pickRemoteBranch'><option id='current' value='$input'>Enter Value</option></select>", "</div>",
            "<label for='branchName'>Enter branch name</label>",
            "<input name=branchName' id='branchName' placeholder='default'></input>",
            "<input style='margin:10px' class='git-warning btn modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Create'/>", "</form>",
        ].join("");
        var el = $(Notify.modal({
            header: "Create Branch",
            body: html,
            dismissible: true
        }, function() {
            el.find('form').off();
            el.find('select').off();
        }));
        var remoteSelect = el.find('#selectRemote');
        var branchSelect = el.find('#pickRemoteBranch');
        var pickRemoteBranchDiv = el.find("#pickRemoteBranchDiv");
        var branchName = el.find("#branchName");
        prov.listRemotes().then(function(b) {
            b.forEach(function(remote) {
                remoteSelect.append("<option value='" + remote.remote + "'>" + remote.remote + ": " + remote.url.split("/")
                    .slice(-2).join("/") + "</option>");
            });
            if (appConfig.defaultRemote) {
                remoteSelect.val(appConfig.defaultRemote);
            }
        });
        var lastRemote = null;
        remoteSelect.change(function() {
            if (this.value == "$local") {
                pickRemoteBranchDiv.hide();
            } else {
                pickRemoteBranchDiv.show();
                if (this.value != lastRemote) {
                    branchSelect.children().not("#current").detach();
                    branchSelect.val("$input");
                    prov.listBranches({
                        remote: this.value
                    }).then(function(b) {
                        b.forEach(function(remote) {
                            branchSelect.append("<option value='" + remote + "'>" + remote + "</option>");
                        });
                    });
                }
            }
        });
        checkBox(el);
        el.find("form").on("submit", function(e) {
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
                        failure("Cannot create branch on empty repository");
                    });
                }
                var remoteRef = branchSelect.val();
                if (!remoteRef || remoteRef == "$input") {
                    remoteRef = remote + "/" + ref;
                } else {
                    remoteRef = remote + "/" + remoteRef;
                }

                function retry(retried) {
                    prov.resolveRef({
                        ref: remoteRef,
                    }).then(function(oid) {
                        // Create a new branch that points at that same commit
                        prov.writeRef({
                            ref: "refs/heads/" + ref,
                            value: oid,
                        }).then(function() {
                            el.modal('close');
                            configure("defaultRemoteBranch", remoteRef, "git");
                            // Set up remote tracking branch
                            prov.setConfig({
                                path: "branch." + ref + ".remote",
                                value: remote
                            });
                            prov.setConfig({
                                path: "branch." + ref + ".merge",
                                value: "refs/heads/" + ref
                            });
                            success();
                        }, failure);
                    }, function(e) {
                        if (!retried) {
                            var progress = createProgress('Fetching remote branch......');
                            prov.fetch({
                                remote: remote,
                                singleBranch: true,
                                ref: ref,
                                depth: el.find("#cloneShallow").val() ? 2 : undefined,
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
