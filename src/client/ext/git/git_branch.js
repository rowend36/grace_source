//Git Commands Branching
define(function (require, exports, module) {
    var GitUtils = require('./git_utils').GitUtils;
    var createProgress = GitUtils.createProgress;
    var padStart = GitUtils.padStart;
    var success = GitUtils.success;
    var failure = GitUtils.failure;
    var gitConfig = require('grace/core/config').Config.registerAll({}, 'git');
    var checkBox = require('grace/ui/ui_utils').styleCheckbox;
    var testPlain = GitUtils.testPlain;
    var configure = require('grace/core/config').Config.configure;
    var Notify = require('grace/ui/notify').Notify;

    function pickBranch(prov, onSelect) {
        var branches;

        function showModal(currentBranch) {
            Notify.pick('Select Branch', branches, function (branch) {
                return onSelect(branch, branch == currentBranch);
            });
        }
        prov.listBranches().then(function (b) {
            branches = b;
            prov.currentBranch().then(showModal);
        });
    }

    function gotoRef(prov, ref, noCheckout, cb) {
        var progress = createProgress('Checking out ' + ref);
        prov.checkout({
            ref: ref,
            onProgress: progress.update,
            noCheckout: noCheckout,
        })
            .then(function () {
                Notify.info(
                    (noCheckout
                        ? 'Updated HEAD to point at '
                        : 'Checked out files from ') + ref
                );
                cb && cb();
            }, failure)
            .finally(progress.dismiss);
    }
    exports.switchBranch = function (ev, prov) {
        pickBranch(prov, function (item, isCurrent) {
            if (isCurrent) {
                return;
            }
            gotoRef(prov, item, false, function () {
                ev.fileview.reload();
            });
            return true;
        });
    };
    exports.switchBranchNoCheckout = function (ev, prov) {
        pickBranch(prov, function (item, isCurrent) {
            if (isCurrent) {
                return;
            }
            gotoRef(prov, item, true);
            return true;
        });
    };

    exports.deleteBranch = function (ev, prov) {
        pickBranch(prov, function (item, isCurrent) {
            if (isCurrent) {
                return;
            }
            var key = padStart(
                '' + Math.floor(Math.random() * 99999999) + '',
                8,
                '0'
            );
            Notify.prompt(
                'Delete branch ' +
                    item +
                    '?. This operation is irreversible. To proceed, enter ' +
                    key,
                function (ans) {
                    if (ans == key) {
                        prov.deleteBranch({
                            ref: item,
                        }).then(success, failure);
                    } else {
                        return false;
                    }
                }
            );
            return true;
        });
    };
    exports.createBranch = function (ev, prov) {
        Notify.modal({
            header: 'Create Branch',
            large: true,
            form: [
                {
                    caption: 'Select Remote',
                    name: 'selectRemote',
                    type: 'select',
                },
                {
                    type: 'div',
                    name: 'remoteOptions',
                    children: [
                        {
                            caption: 'Shallow fetch',
                            type: 'accept',
                            name: 'cloneShallow',
                        },
                        {
                            caption: 'Select remote branch',
                            type: 'select',
                            name: 'pickRemoteBranch',
                        },
                    ],
                },
                {
                    caption: 'Branch name',
                    type: 'text',
                    name: 'branchName',
                },
            ],
            onCreate: function (el) {
                checkBox(el);
                //Pick remote to track
                var remoteSelect = el.find('#selectRemote');
                remoteSelect.append(
                    "<option value='$local'>No Remote</option>"
                );
                //Add saved remotes
                prov.listRemotes().then(function (b) {
                    b.forEach(function (remote) {
                        remoteSelect.append(
                            "<option value='" +
                                remote.remote +
                                "'>" +
                                remote.remote +
                                ': ' +
                                remote.url.split('/').slice(-2).join('/') +
                                '</option>'
                        );
                        if (remote.remote === gitConfig.defaultRemote) {
                            remoteSelect.val(remote);
                        }
                    });
                });
                //Pick remote branch to track
                var branchSelect = el.find('#pickRemoteBranch');
                branchSelect.append(
                    "<option value='$input' id='current'>Default</option>"
                );
                var remoteOptions = el.find('#remoteOptions');
                remoteOptions.hide();

                var lastRemote = null;
                //Fetch available branches on the remote
                function updateBranches() {
                    if (this.value == '$local') {
                        remoteOptions.hide();
                    } else {
                        remoteOptions.show();
                        if (this.value != lastRemote) {
                            branchSelect.children().not('#current').remove();
                            branchSelect.val('$input');
                            prov.listBranches({
                                remote: this.value,
                            }).then(function (b) {
                                b.forEach(function (branch) {
                                    branchSelect.append(
                                        "<option value='" +
                                            branch +
                                            "'>" +
                                            branch +
                                            '</option>'
                                    );
                                });
                            });
                        }
                    }
                }
                remoteSelect.change(updateBranches);
                updateBranches.call(remoteSelect[0]);

                var branchName = el.find('#branchName');
                el.on('submit', function handleSubmit(e) {
                    e.preventDefault();
                    var ref = branchName.val();
                    if (!testPlain(ref)) {
                        branchName.focus();
                        return;
                    }
                    createBranch(
                        remoteSelect.val(),
                        branchSelect.val(),
                        ref,
                        el.find('#cloneShallow').val()
                    ).then(function () {
                        el.modal('close');
                        success();
                    }, failure);
                });
            },

            footers: ['Cancel', 'Create'],
            dismissible: true,
        });

        function createBranch(remote, remoteRef, name, cloneShallow) {
            return prov
                .resolveRef({
                    ref: name,
                })
                .then(
                    function () {
                        throw 'Branch name is already in use';
                    },
                    function () {
                        if (!remote || remote == '$local') {
                            return createLocalBranch(name);
                        }
                        if (!remoteRef || remoteRef == '$input') {
                            remoteRef = name;
                        }
                        remoteRef = remoteRef.replace('refs/heads/', '');

                        return createRemoteBranch(
                            remote,
                            name,
                            remoteRef,
                            true,
                            cloneShallow ? 2 : undefined
                        );
                    }
                );
        }

        function createLocalBranch(name) {
            return prov
                .resolveRef({
                    ref: 'HEAD',
                })
                .then(
                    function () {
                        return prov.branch({
                            ref: name,
                        });
                    },
                    function () {
                        throw 'Failed to resolve HEAD. Note: You cannot create a branch on an empty repository.';
                    }
                );
        }
        function createRemoteBranch(
            remote,
            name,
            remoteRef,
            allowFetch,
            fetchDepth
        ) {
            function writeRef(oid) {
                // Create a new branch that points at that same commit
                prov.writeRef({
                    ref: 'refs/heads/' + remote + '/' + remoteRef,
                    value: oid,
                }).then(function () {
                    configure('defaultRemoteBranch', remoteRef, 'git', true);
                    // Set up remote tracking branch
                    return Promise.all([
                        prov.setConfig({
                            path: 'branch.' + name + '.remote',
                            value: remote,
                        }),
                        prov.setConfig({
                            path: 'branch.' + name + '.merge',
                            value: 'refs/heads/' + remoteRef,
                        }),
                    ]);
                });
            }
            function fetchRef() {
                var progress = createProgress('Fetching remote branch......');
                return prov
                    .fetch({
                        remote: remote,
                        singleBranch: true,
                        ref: remoteRef,
                        depth: fetchDepth,
                    })
                    .then(function () {
                        progress.dismiss();
                        createRemoteBranch(remote, name, remoteRef, false);
                    }, progress.error);
            }

            return prov
                .resolveRef({
                    ref: remoteRef,
                })
                .then(writeRef, allowFetch && fetchRef);
        }
    };
}); /*_EndDefine*/
