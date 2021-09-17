/* jshint esversion: 6, esnext:false*/
//Git utilities
_Define(function(global) {
    var Utils = global.Utils;
    var GitCommands = global.GitCommands = Object.create(null);
    var Notify = global.Notify;
    var UiThread = global.UiThread;
    var padStart = typeof String.prototype.padStart === 'undefined' ? function(str, len, pad) {
        var t = Utils.repeat(Math.floor((len - str.length) / pad.length), pad);
        return t + pad.substring(0, (len - str.length - t.length)) + str;
    } : (str, len, pad) => str.padStart(len, pad);
    GitCommands.padStart = padStart;
    GitCommands.testPlain = function(str) {
        if (!str) return false;
        return /^[A-Za-z][-A-Za-z_0-9]+$/.test(str);
    };
    GitCommands.testUrl = function(str) {
        if (!str) return false;
        return /^([A-Za-z]+\:\/+)?([0-9\.]+(\:[0-9]+)?|[A-Za-z][-\.A-Za-z_0-9]+)(\/+[A-Za-z][A-Za-z_0-9]*)*(\.([a-zA-Z]+))?\/?$/
            .test(str);
    };
    GitCommands.success = function() {
        Notify.info('Done');
    };

    GitCommands.createProgress = function(status) {
        var el = $(Notify.modal({
            header: status || 'Starting....',
            body: "<span class='progress'><span class='determinate'></span></span>",
            footers: ['Cancel'],
            className: 'modal-alert',
            dismissible: true
        }, function() {
            el = null;
        }));
        el.find('.modal-cancel').text('Hide');
        return {
            update: function(event) {
                if (el) {
                    el.find('.modal-header').text(event.phase);
                    if (event.total) {
                        if (el.find('.progress').children('.determinate').length < 1) {
                            el.find('.progress').html("<span class='determinate'></span>");
                        }
                        el.find('.progress').children('.determinate').css("width", ((event.loaded /
                                event
                                .total) * 100) + "%");
                    } else {
                        if (el.find('.progress').children('.indeterminate').length < 1) {
                            el.find('.progress').html("<span class='indeterminate'></span>");
                        }
                    }
                }
                return UiThread.awaitIdle();
            },
            dismiss: function() {
                if (el) {
                    el.modal('close');
                    el = null;
                }
            },
            error: function(e) {
                if (el) {
                    el.modal('close');
                    el = null;
                }
                GitCommands.failure(e);
            }
        };
    };
    GitCommands.handleError = function(e, data) {
        switch (e.code) {
            case 'CheckoutConflictError':
                Notify.modal({
                    header: 'Unable To Checkout ' + (data ? data.ref : ""),
                    body: e.message +
                        "</br><span><i class='material-icons'>info</i></span>Commit your unsaved changes or revert the changes to continue",
                });
                return true;
            default:
                console.error(e);
        }
    };
    GitCommands.failure = function(e) {
        GitCommands.handleError(e);
        if (e.toString == {}.toString) e = e.message || e.code;
        Notify.error("Error: " + e.toString());
    };
}); /*_EndDefine*/
//Git Commands Init 
_Define(function(global) {
    var Notify = global.Notify;
    var appConfig = global.registerAll({}, "git");
    var GitCommands = global.GitCommands;
    var createProgress = GitCommands.createProgress;
    var failure = GitCommands.failure;
    var testUrl = GitCommands.testUrl;
    /*basic tasks*/
    GitCommands.writeFile = function(name, content, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.mkdir(dir + "/grace", function() {
            fs.writeFile(dir + "/grace/" + name, content, cb);
        });
    };
    GitCommands.readFile = function(name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.readFile(dir + "/grace/" + name, 'utf8', cb);
    };
    GitCommands.removeFile = function(name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.unlink(dir + "/grace/" + name, cb);
    };
    GitCommands.init = function(ev, prov) {
        prov.init().then(function() {
            Notify.info("New repository created");
            ev.browser.reload(true);
        }, failure);
    };
    GitCommands.clone = function(ev, prov) {
        var progress = createProgress();
        var el = $(Notify.modal({
            header: "Clone Repository",
            form: [{
                    caption: 'Enter repository url',
                    type: 'text',
                    name: 'repoUrl',
                    value: "https://github.com/"
                },
                {
                    caption: 'Shallow clone',
                    type: 'accept',
                    name: 'cloneShallow'
                },
                {
                    caption: 'Single branch',
                    type: 'accept',
                    name: 'singleBranch'
                },
                {
                    type: "div",
                    name: "singleBranchDiv",
                    children: [{
                        caption: 'Branch to clone',
                        type: 'text',
                        name: 'branchToClone'
                    }]
                }
            ],
            footers: ['Cancel', 'Clone'],
            dismissible: false
        }));
        el.find("#singleBranchDiv").hide();
        el.find('#singleBranch').change(function() {
            el.find("#singleBranchDiv").toggle(this.checked);
        });
        el.on("submit", function(e) {
            e.preventDefault();
            var result = global.Form.parse(el[0]);
            if (!testUrl(result.repoUrl)) {
                return Notify.error("Invalid Url");
            }
            el.modal("close");
            prov.clone({
                onAuth: function() {
                    return new Promise(function(resolve) {
                        resolve({
                            username: appConfig.gitEmail,
                            password: appConfig.gitPassword
                        });
                    });
                },
                url: result.repoUrl,
                ref: result.singleBranch ? result.branchToClone : undefined,
                onProgress: progress.update,
                singleBranch: result.singleBranch,
                depth: result.cloneShallow ? 1 : undefined
            }).then(function() {
                progress.dismiss();
                Notify.info("Clone complete");
                ev.browser.reload();
            }, function(e) {
                failure(e);
                progress.dismiss();
                ev.browser.reload();
            });
        });
    };
}); /*_EndDefine*/
//Git command log
_Define(function(global) {
    var Notify = global.Notify;
    var GitCommands = global.GitCommands;
    var failure = GitCommands.failure;
    GitCommands.log = function(ev, prov) {
        prov.log().then(function(logs) {
            $(Notify.modal({
                header: 'History',
                body: logs.map(print).join("")
            }));
            //to do goto specific commits
            function entry(arr, key, value) {
                arr.push("<tr><td>" + key + "</td><td>" + value + "</td></tr>");
            }

            function print(item) {
                var log = item.commit;
                var a = ["<table style='margin-bottom:20px'>"];
                var date;
                entry(a, "commit", "<span class='commit-sha'>" + item.oid + "</span>");
                if (log.committer) {
                    date = log.committer.timestamp;
                    if (date) {
                        if (!isNaN(log.committer.timezoneOffset)) {
                            date += (new Date().getTimezoneOffset() - log.committer
                                .timezoneOffset) * 60;
                        }
                    }
                    entry(a, "committer", (log.committer.name || "") + (" (" + (log.committer
                        .email || "no-email") + ")"));
                }
                if (log.author) {
                    if (!date) {
                        date = log.author.timestamp;
                        if (date) {
                            if (!isNaN(log.author.timezoneOffset)) {
                                date += (new Date().getTimezoneOffset() - log.author
                                    .timezoneOffset) * 60;
                            }
                        }
                    }
                    entry(a, "author", (log.author.name || "") + (" (" + (log.author.email ||
                        "no-email") + ")"));
                }
                if (date) {
                    entry(a, "date", new Date(date * 1000));
                }
                entry(a, "message", log.message);
                a.push("</table>");
                return a.join("");
            }
        }, failure);
    };
}); /*_EndDefine*/
//Setup
_Define(function(global) {
    "use strict";
    var Dropdown = global.Dropdown;
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var Imports = global.Imports;
    var Notify = global.Notify;
    var appConfig = global.registerAll({
        "gitdir": "***",
        "gitEmail": "",
        "gitUsername": "",
        "gitPassword": "*******",
        "gitUseCachedStatus": true,
        "enableMergeMode": true,
        "formatConflict": "diff3",
        "gitCorsProxy": Env.isWebView ? undefined : Env._server + "/git",
        "gitSkipGitIgnore": true,
        "gitIgnore": ["logs", "*.log", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*",
            "firebase-debug.log*",
            "firebase-debug.*.log*", ".firebase/", "*.pid", "*.seed", "*.pid.lock", "lib-cov",
            "coverage", ".nyc_output",
            ".grunt", "bower_components", ".lock-wscript", "build/Release", "node_modules/", ".npm",
            ".eslintcache",
            ".node_repl_history", "*.tgz", ".yarn-integrity", ".env**/.*", ".git", ".*-git",
            ".git-status", "*~[123]",
        ],
        "defaultRemote": undefined,
        "defaultRemoteBranch": undefined,
        "forceShowStagedDeletes": true
    }, "git");
    var configure = global.configure;
    var join = FileUtils.join;
    var dirname = FileUtils.dirname;
    global.registerValues({
        "formatConflict": {
            values: ["diff3", "diff"]
        },
        "defaultRemote": {
            type: "string|null"
        },
        "defaultRemoteBranch": {
            type: "string|null"
        },
        "enableMergeMode": "Try to highlight open documents as merge conflicts",
        "gitCorsProxy": Env.isWebView?"no-user-config":{
            type: "?string",
            doc: "Proxy to use for cross origin requests. For simple testing, you can try https://cors.isomorphic-git.org/ \nSee isomorphic-git.com/issues"
        },
        "gitPassword": "It is advised you use an app password for this. Passwords are stored as plain text.",
        "gitdir": "The name of the git dir. Git support especially(merging/pulling) is still largely experimental.\n Using '.git' might corrupt your local repository.",
        "gitIgnore": "ignore",
        "gitSkipGitIgnore": "Ignore .gitignore files. Useful in speeding up status operation when there are a lot of untracked files by using 'appConfig.gitIgnore' instead",
        "gitUseCachedStatus": "Enables caching to speed up the status operation of large repositiories",
        "forceShowStagedDeletes": "Set to 'false' if viewStage operation seems too slow"
    }, "git");

    function findRoot(rootDir, fs) {
        return new Promise(function(resolve, reject) {
            var dir = appConfig.gitdir;
            if (dir == "***") {
                return Notify.ask(
                    "Git support is still experimental. Use .grit instead of .git as git directory?",
                    function() {
                        configure("gitdir", ".grit", "git");
                        findRoot(rootDir, fs).then(resolve, reject);
                    },
                    function() {
                        configure("gitdir", ".git", "git");
                        findRoot(rootDir, fs).then(resolve, reject);
                    });
            }
            var check = function(root) {
                fs.readdir(join(root, dir), function(e) {
                    if (!e) {
                        resolve(root);
                    } else {
                        if (e.code == 'ENOENT') {
                            if (root != '/') {
                                return check(dirname(root));
                            }
                            return resolve(false);
                        } else return reject(e);
                    }
                });
            };
            check(rootDir);
        });
    }
    //FileUtils guarantees only one browser will
    //use overflow at a time
    //global variables are allowed
    var lastEvent;
    var detectRepo = Imports.define([
        "./core/cache_fs.js", "./tools/git/libs/isomorphic-http.js",
        "./tools/git/libs/isomorphic-git-mod.js", "./tools/git/git_interface.js",
        "./tools/git/git_status.js", "./tools/git/git_branch.js",
        "./tools/git/git_commit.js", "./tools/git/git_config.js",
        "./tools/git/git_merge.js", "./tools/git/git_remote.js",
        "./tools/git/git_fs.js", "./tools/git/git_diff.js", "./tools/git/merge3highlight.js"
    ], function() {
        return (detectRepo = function(ev, btn, yes, no) {
            if (!ev) return;
            var dir = ev.rootDir;
            lastEvent = ev;
            findRoot(dir, ev.browser.fileServer).then(function(path) {
                var fs = lastEvent.browser.fileServer;
                var GitImpl = fs.$gitImpl || global.Git;
                prov = new GitImpl(path || dir, join(path || dir, appConfig.gitdir),
                    fs);
                if (path) {
                    yes.show(btn);
                    if (yes == GitOverflow) {
                        prov.currentBranch().then(GitMenu.currentBranch.update,
                            GitCommands.failure);
                    }
                } else no.show(btn);
            }, GitCommands.failure);
        });
    });
    var GitCommands = global.GitCommands;
    var prov;
    var detectHierarchyRepo = function(ev, btn, yes, no) {
        ev.browser.menu && ev.browser.menu.hide();
        ev.browser.expandFolder(ev.filename, function(cb) {
            detectRepo(Object.assign({}, ev, {
                browser: cb,
                rootDir: ev.filepath
            }), ev.browser.getElement(ev.filename)[0], yes, no);
        });
    };
    var GitFileMenu = {
        "show-file-status": {
            caption: "Show file status",
            command: "status"
        },
        "stage-file": {
            caption: "Stage File",
            command: "add"
        },
        "unstage-file": {
            caption: "Unstage File",
            command: "remove"
        },
        "delete-from-tree": {
            caption: "Delete and Stage",
            command: "delete"
        },
        "diff-index": {
            caption: "Show diff",
            command: "diff",
            sortIndex: 500
        },
        "checkout-4": Dropdown.defaultLabel('Force Checkout'),
        "do-revert-index-file": {
            icon: 'warning',
            caption: "Checkout file from index",
            className: "git-warning-text",
            command: "doRevertINDEX"
        },
        "do-revert-commit-file": {
            icon: 'warning',
            caption: "Checkout file from ref",
            className: "git-warning-text",
            command: "doRevertCommit"
        },
    };
    var GitMenu = {
        "currentBranch": {
            isHeader: true,
            icon: true,
            currentBranch: "",
            caption: "",
            update: function(branch) {
                if (branch != GitMenu.currentBranch.currentBranch) {
                    GitMenu.currentBranch.currentBranch = branch;
                    GitMenu.currentBranch.caption =
                        "<span class='dot green'></span><i class='grey-text'>" + branch + "</i>";
                    GitOverflow.update(GitMenu);
                }
            }
        },
        "do-commit": {
            icon: 'save',
            caption: "Commit",
            command: "doCommit"
        },
        "view-stage": {
            icon: 'view_headline',
            caption: "Repository Status",
            command: "showStage"
        },
        "show-status": {
            icon: 'view_headline',
            caption: "Folder Status",
            command: "statusAll"
        },
        "branches": Dropdown.defaultLabel('Branches'),
        "create-branch": {
            icon: "add",
            caption: "Create Branch",
            command: "createBranch"
        },
        "switch-branch": {
            icon: "swap_horiz",
            caption: "Checkout Branch",
            command: "switchBranch"
        },
        "switch-branch-nocheckout": {
            icon: "home",
            caption: "Set HEAD branch",
            command: "switchBranchNoCheckout"
        },
        "do-merge": {
            icon: 'swap_vert',
            caption: "Merge Branches",
            command: "doMerge"
        },
        "close-branch": {
            icon: "delete",
            caption: "Delete Branch",
            command: "deleteBranch"
        },
        "git-remotes": Dropdown.defaultLabel('Remotes'),
        "do-pull": {
            icon: 'vertical_align_bottom',
            caption: "Pull Changes",
            command: "doPull"
        },
        "do-push": {
            icon: 'vertical_align_top',
            caption: "Push Changes",
            command: "doPush"
        },
        "manage-remote": {
            icon: "link",
            caption: "Remotes",
            command: "manageRemotes"
        },
        "repo-actions": {
            icon: "more_vert",
            caption: "More...",
            sortIndex: 100000,
            subTree: {
                "histpry": Dropdown.defaultLabel('History'),
                "show-logs": {
                    icon: 'history',
                    caption: "History",
                    command: "log"
                },
                "browse-logs": {
                    icon: 'history',
                    caption: "Browse Ref/Commit",
                    command: "browseCommit"
                },
                "configure-op": Dropdown.defaultLabel('authentication'),
                "authentication": {
                    icon: "account_circle",
                    caption: "Add Authentication",
                    command: "doConfig"
                },
                "checkout-5": Dropdown.defaultLabel('Force Checkout'),
                "do-revert-index": {
                    icon: 'warning',
                    caption: "Checkout index",
                    className: "git-warning-text",
                    command: "doRevertINDEX"
                },
                "do-revert-commit": {
                    icon: 'warning',
                    caption: "Checkout ref",
                    className: "git-warning-text",
                    command: "doRevertCommit"
                }
            }
        }
    };
    var NoGitMenu = {
        "init-repo": {
            caption: "Initialize Repository",
            command: "init"
        },
        "clone-repo": {
            caption: "Clone Existing Repository",
            command: "clone"
        }
    };
    var GitFileOverflow = new Dropdown();
    var GitOverflow = new Dropdown();
    var NoGitOverflow = new Dropdown();
    GitFileOverflow.setData(GitFileMenu);
    GitOverflow.setData(GitMenu);
    NoGitOverflow.setData(NoGitMenu);
    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function(e, id, span, data) {
        prov = prov.cached(id);
        if (data.command) {
            GitCommands[data.command](lastEvent, prov);
        } else if (data.onclick) data.onclick(lastEvent, prov);
        return true;
    };
    GitOverflow.ondismiss = GitFileOverflow.ondismiss = NoGitOverflow.ondismiss = function(e) {
        var parent = lastEvent.browser.menu;
        if (parent) {
            if (e) {
                if (!e.navigation) parent.onOverlayClick(e);
            } else {
                parent.hide();
            }
        }
    };
    //don't dismiss parent
    var superClose = GitOverflow.close;
    GitOverflow.close = function() {
        superClose.apply(this, {
            navigation: true
        });
    };
    var GitFileOption = {
        caption: "Git...",
        onclick: function(ev) {
            detectRepo(ev, GitFileOption.anchor, GitFileOverflow, NoGitOverflow);
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
    var GitProjectOption = {
        caption: "Git..",
        sortIndex: 200,
        onclick: function(ev) {
            detectHierarchyRepo(ev, GitProjectOption.anchor, GitOverflow, NoGitOverflow);
            ev.stopPropagation();
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
    var GitOption = {
        sortIndex: 200,
        caption: "Git...",
        onclick: function(ev) {
            lastEvent = ev;
            detectRepo(ev, GitOption.anchor, GitOverflow, NoGitOverflow);
            ev.preventDefault();
            ev.stopPropagation();
        },
        hasChild: true,
        close: false
    };
    FileUtils.registerOption("files", ["create"], "git-opts", GitOption);
    FileUtils.registerOption("files", ["file", "folder"], "git-file-opts", GitFileOption);
    FileUtils.registerOption("project", ["project"], "git-opts", GitProjectOption);
    FileUtils.registerOption("project", ["project"], "git-file-opts", "");

    //AutoLoad 
    if (
        FileUtils.channelHasPending("servers-!gitfs") ||
        FileUtils.channelHasPending("diffs-git") ||
        FileUtils.channelHasPending("docs-git-merge")) {
        detectRepo();
    } else if (appConfig.enableMergeMode) {
        Imports.define(["./tools/git/merge3highlight.js"])(Utils.noop);
    }

}); /*_EndDefine*/