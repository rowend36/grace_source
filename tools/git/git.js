/* jshint esversion: 6, esnext:false*/
//Git utilities
_Define(function(global) {
    var Utils = global.Utils;
    var GitCommands = global.GitCommands = Object.create(null);
    var Notify = global.Notify;
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
            body: "<span class='progress'><span class='determinate'></span></span><div class='modal-footer'><button class='modal-close btn right'>Hide</button></div>",
            dismissible: true
        }, function() {
            el = null;
        }));
        return {
            update: function(event) {
                if (el) {
                    el.find('.modal-header').text(event.phase);
                    if (event.total) {
                        el.find('.progress').children('determinate').css("width", ((event.loaded / event.total) * 100) + "%")
                            .children().remove();
                    } else {
                        if (el.find('.progress').children('.indeterminate').length < 1) {
                            el.find('.progress').html("<span class='indeterminate'></span>");
                        }
                    }
                }
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
        Notify.error("Error: " + e.toString());
    };
}); /*_EndDefine*/
//Git Commands Init 
_Define(function(global) {
    var Notify = global.Notify;
    var appConfig = global.registerAll({}, "git");
    var GitCommands = global.GitCommands;
    var checkBox = global.styleCheckbox;
    var failure = GitCommands.failure;
    var testUrl = GitCommands.testUrl;
    /*basic tasks*/
    GitCommands.init = function(ev, prov) {
        prov.init().then(function(a) {
            Notify.info("New repository created");
            ev.browser.reload(true);
        }, failure);
    };
    GitCommands.clone = function(ev, prov) {
        var html = ["<form>", "<label>Enter repository url</label>",
            "<input style='margin-bottom:10px' id=inputName name=inputName type=text value='https://github.com/'/>",
            "<input type='checkbox' name='cloneShallow' id='cloneShallow'/>",
            "<span style='margin-right:30px'>Shallow clone</span>",
            "<input type='checkbox' name='singleBranch' id='singleBranch'/>", "<span>Single branch</span></br>",
            "<input style='margin:10px' class='git-warning btn modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Clone'/>", "</form>",
        ].join("");
        var el = $(Notify.modal({
            header: "Clone Repository",
            body: html,
            dismissible: false
        }));
        checkBox(el);
        el.find("form").on("submit", function(e) {
            e.preventDefault();
            var url = el.find("#inputName").val();
            if (!testUrl(url)) {
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
                url: url,
                singleBranch: el.find("#singleBranch")[0].checked,
                depth: el.find("#cloneShallow")[0].checked ? 1 : undefined
            }).then(function() {
                Notify.info("Clone complete");
                ev.browser.reload();
            }, function(e) {
                failure(e);
                ev.browser.reload();
            });
        });
    };
}); /*_EndDefine*/
//Git Commands Commit
_Define(function(global) {
    var Notify = global.Notify;
    var appConfig = global.registerAll({}, "git");
    var GitCommands = global.GitCommands;
    var configure = global.configure;
    var failure = GitCommands.failure;
    var success = GitCommands.success;
    var createProgress = GitCommands.createProgress;
    var padStart = GitCommands.padStart;
    GitCommands.doCommit = function(ev, prov) {
        var commit = function(ans) {
            if (ans == "") return false;
            else if (!ans) return;
            prov.commit({
                author: {
                    name: appConfig.gitName,
                    email: appConfig.gitEmail,
                },
                message: ans
            }).then(function() {
                Notify.info("Commit Successful");
            }, function(e) {
                if ((e + "").indexOf("No name was provided") > -1) {
                    Notify.prompt("Enter Author name", function(name) {
                        if (name) {
                            configure("gitName", name, "git");
                            commit(ans);
                        }
                    });
                } else failure(e);
            });
        };
        Notify.prompt("Enter Commit Message", commit);
    };
    //force checkout
    GitCommands.doRevert = function(ev, prov) {
        var _prov = prov.cached();
        var progress = createProgress('Analyzing directory');
        var opts = {
            onProgress: progress.update,
            force: true,
        };
        prov.analyze(opts).then(function(ops) {
            progress.dismiss();
            if (ops.length == 0) {
                return Notify.info('Workspace already checked out');
            }
            var safeString = padStart("" + Math.floor((Math.random() * 999999)) + "", 6, "0");
            Notify.prompt("This will revert all changes in working directory to last commit.\n It will:\n" + ops.map(function(
                e) {
                return e[0] + " " + e[1] + "\n";
            }).join("") + " To confirm operation, type '" + safeString + "'", function(ans) {
                if (ans == safeString) {
                    progress = createProgress('Reverting...');
                    _prov.checkout({
                        onProgress: progress.update,
                        filepaths: ops.map(function(e) {
                            return e[1];
                        }),
                        force: true,
                    }).then(function() {
                        progress.dismiss();
                        success();
                    }, progress.error);
                } else if (ans) {
                    return false;
                }
            });
        }, progress.error);
    };

});
//Git Commands Configuration
_Define(function(global) {
    var GitCommands = global.GitCommands;
    var appConfig = global.registerAll(null,"git");
    var configure = global.configure;
    var Notify = global.Notify;
    var checkBox = global.styleCheckbox;
    function doConfig(ev, prov, done) {
        var html = ["<form>", "<label>Author Name(used in commits)</label>",
            "<input name=userName' id='userName' placeholder='Leave empty'></input>", "<label>Email</label>",
            "<input name=userEmail' id='userEmail'></input>", "<label>Password</label>",
            "<span class='material-icons'>visibility_on</span>", "<input name=userPass' id='userPass' type='text'/>",
            "<input type='checkbox' name='saveToDisk' id='saveToDisk'/>",
            "<span style='margin-right:30px'>Save To Disk</span></br>",
            "<input style='margin:10px' class='git-warning btn modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Done'/>", "</form>",
        ].join("");
        var el = $(Notify.modal({
            header: "Configure",
            body: html,
            dismissible: true
        }, function() {
            el.find('form').off('submit');
        }));
        checkBox(el);
        el.find("#userPass").val(appConfig.gitPassword);
        el.find("#userName").val(appConfig.gitName);
        el.find("#userEmail").val(appConfig.gitEmail);
        el.find('form').on('submit', function(e) {
            e.preventDefault();
            el.modal('close');
            if (done && done({
                    email: el.find("#userEmail").val(),
                    username: el.find("#userName").val(),
                    password: el.find("#userPass").val()
                }) == false) {
                return;
            }
            configure("gitEmail", el.find("#userEmail").val(), "git");
            configure("gitPassword", el.find("#userPass").val(), "git");
            configure("gitName", el.find("#userName").val(), "git");
            if (el.find("#saveToDisk")[0].checked) {
                var dict = {
                    "user.email": "gitEmail",
                    "user.password": "gitPassword",
                    "user.name": "gitName"
                };
                for (var i in dict) {
                    prov.setConfig({
                        path: i,
                        value: appConfig[dict[i]]
                    });
                }
            }
        });
    }
    GitCommands.doConfig = doConfig;
});
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
                            date += (new Date().getTimezoneOffset() - log.committer.timezoneOffset) * 60;
                        }
                    }
                    entry(a, "committer", (log.committer.name || "") + (" (" + (log.committer.email || "no-email") + ")"));
                }
                if (log.author) {
                    if (!date) {
                        date = log.author.timestamp;
                        if (date) {
                            if (!isNaN(log.author.timezoneOffset)) {
                                date += (new Date().getTimezoneOffset() - log.author.timezoneOffset) * 60;
                            }
                        }
                    }
                    entry(a, "author", (log.author.name || "") + (" (" + (log.author.email || "no-email") + ")"));
                }
                if (date) {
                    entry(a, "date", new Date(date * 1000));
                }
                entry(a, "message", log.message);
                a.push("</table>");
                return a.join("");
            }
        },failure);
    };
}); /*_EndDefine*/
//Setup
_Define(function(global) {
    "use strict";
    var Overflow = global.Overflow;
    var FileUtils = global.FileUtils;
    var Imports = global.Imports;
    var Notify = global.Notify;
    var appConfig = global.registerAll({
        "gitdir": "***",
        "gitName": "",
        "gitEmail": "",
        "gitPassword": "*******",
        "gitUseCachedStatus": true,
        "gitCorsProxy": Env.isWebView ? undefined : Env._server + "/git",
        "gitSkipGitIgnore": true,
        "gitIgnore": ["logs", "*.log", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "firebase-debug.log*",
            "firebase-debug.*.log*", ".firebase/", "*.pid", "*.seed", "*.pid.lock", "lib-cov", "coverage", ".nyc_output",
            ".grunt", "bower_components", ".lock-wscript", "build/Release", "node_modules/", ".npm", ".eslintcache",
            ".node_repl_history", "*.tgz", ".yarn-integrity", ".env**/.*", ".git", ".*-git", ".git-status"
        ],
        "defaultRemote": undefined,
        "defaultRemoteBranch": undefined,
        "useDiskConfig": false,
        "forceShowStagedDeletes": true
    }, "git");
    var configure = global.configure;
    var join = FileUtils.join;
    var dirname = FileUtils.dirname;
    global.registerValues({
        "gitCorsProxy": "Possible value: https://cors.isomorphic-git.org/ \nSee isomorphic-git.com/issues",
        "gitName": "The name that will be used in commits",
        "gitdir": "The name of the git dir. Git support especially(merging/pulling) is still largely experimental.\n Using '.git' might corrupt your local repository.",
        "gitIgnore": "ignore",
        "gitSkipGitIgnore": "Ignore .gitignore files. Useful in speeding up status operation when there are a lot of untracked files by using 'appConfig.gitIgnore' instead",
        "gitUseCachedStatus": "Enables caching to speed up the status operation of large repositiories",
        "useDiskConfig": "Load/Save email and password from/to hard drive",
        "forceShowStagedDeletes": "Set to 'false' if viewStage operation seems too slow"
    }, "git");

    function findRoot(rootDir, fs) {
        return new Promise(function(resolve, reject) {
            var dir = appConfig.gitdir;
            if (dir == "***") {
                return Notify.ask("Git support is still experimental. Use custom git directory?", function() {
                    configure("gitdir", ".grit", "git");
                    findRoot(rootDir, fs).then(resolve, reject);
                }, function() {
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
        "./core/cachefileserver.js", "./tools/git/libs/isomorphic-http.js",
        "./tools/git/libs/inhouse-git.js", "./tools/git/git_interface.js",
        "./tools/git/git_status.js", "./tools/git/git_branch.js",
         "./tools/git/git_merge.js"
    ], function() {
        return (detectRepo = function(ev, btn, yes, no) {
            var dir = ev.rootDir;
            lastEvent = ev;
            findRoot(dir, ev.browser.fileServer).then(function(path) {
                var fs = lastEvent.browser.fileServer;
                var GitImpl = fs.$gitImpl || global.Git;
                prov = new GitImpl(path || dir, join(path || dir, appConfig.gitdir), fs);
                if (path) {
                    yes.show(btn);
                    if (yes == GitOverflow) {
                        prov.currentBranch().then(GitMenu.currentBranch.update, GitCommands.failure);
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
        }
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
                    GitMenu.currentBranch.caption = "<span class='dot green'></span><i class='grey-text'>" + branch + "</i>";
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
        "branches": Overflow.defaultLabel('Branches'),
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
        "close-branch": {
            icon: "delete",
            caption: "Delete Branch",
            command: "deleteBranch"
        },
        "git-remotes": Overflow.defaultLabel('Remotes'),
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
        "add-remote": {
            icon: "add",
            caption: "Add Remote",
            command: "addRemote"
        },
        "delete-remote": "Remove Remote",
        "configure-op": Overflow.defaultLabel('authentication'),
        "configure": {
            caption: "Add Authentication",
            command: "doConfig"
        },
        "repo-actions": {
            icon: "more_vert",
            caption: "More...",
            sortIndex: 100000,
            childHier: {
                "do-merge": {
                    icon: 'swap_vert',
                    caption: "Merge Branches",
                    command: "doMerge"
                },
                "do-revert": {
                    icon: 'warning',
                    caption: "Revert to last commit",
                    className: "git-warning-text",
                    command: "doRevert"
                },
                "show-logs": {
                    icon: 'history',
                    caption: "History",
                    command: "log"
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
    var GitFileOverflow = new Overflow();
    var GitOverflow = new Overflow();
    var NoGitOverflow = new Overflow();
    GitFileOverflow.setHierarchy(GitFileMenu);
    GitOverflow.setHierarchy(GitMenu);
    NoGitOverflow.setHierarchy(NoGitMenu);
    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function(e, id, span, data) {
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
}); /*_EndDefine*/