/* jshint esversion: 6 */

(function(global) {
    var http = global.http;
    var git = window.git;
    var Overflow = global.Overflow;
    var FileUtils = global.FileUtils;
    var ItemList = global.ItemList;
    var Utils = global.Utils;
    var Notify = global.Notify;
    var AutoCloseable = global.AutoCloseable;
    var configEvents = global.configEvents;
    var appConfig = global.registerAll({
        "gitdir": ".grace-git",
        "gitName": "",
        "gitEmail": "",
        "gitPassword": "*******",
        "gitCorsProxy": Env.isWebView ? undefined : Env._server + "/git",
        "defaultRemote": undefined,
        "defaultRemoteBranch": undefined,
        "useDiskConfig": false,
        "forceShowStagedDeletes": true
    }, "git");
    var configure = global.configure;

    function mergeList(original, update, copy) {
        var list = copy ? original.slice(0) : original;
        var last = 0;
        var changed;
        for (var i = 0; i < update.length; i++) {
            var pos = list.indexOf(update[i], last);
            if (pos < 0) {
                list.splice(last, 0, update[i]);
                last = last + 1;
            }
            else last = pos + 1;
        }
        return list;
    }
    global.registerValues({
        "gitCorsProxy": "Possible value: https://cors.isomorphic-git.org/ \nSee isomorphic-git.com/issues",
        "gitName": "The name that will be used in commits",
        "gitdir": "The name of the git dir. Grace git support(branching,pulling) is still experimental.\n Using '.git' might corrupt your data.",
        "useDiskConfig": "Load/Save email and password from/to hard drive",
        "forceShowStagedDeletes": "Set to 'false' if viewStage operation seems too slow"
    });
    var pleaseCache = global.createCacheFs;
    var clean = FileUtils.cleanFileList;
    var relative = FileUtils.relative;
    var normalize = FileUtils.normalize;
    var isDirectory = FileUtils.isDirectory;
    var join = FileUtils.join;
    var dirname = FileUtils.dirname;
    var checkBox = global.styleCheckbox;
    var cache = {},
        fileCache;
    /*caching*/
    var clearCache = Utils.debounce(function() {
        cache = {};
        fileCache = null;
    }, 10000);

    function getCache() {
        clearCache();
        return cache;
    }

    function findRoot(rootDir, fs) {
        return new Promise(function(resolve, reject) {
            var dir = appConfig.gitdir;
            var check = function(root) {
                fs.readdir(join(root, dir), function(e) {
                    if (!e) {
                        resolve(root);
                    }
                    else {
                        if (e.code == 'ENOENT') {
                            if (root != '/') {
                                return check(dirname(root));
                            }
                            return reject(new Error('Not found'));
                        }
                        else return reject(e);
                    }
                });
            };
            check(rootDir);
        });
    }

    function getStatus(item) {
        var status = {
            0: "absent",
            //1: "*deleted",
            110: "*undeleted",
            120: "*undeletemodified",
            3: "*deleted",
            20: "*added",
            22: "added",
            23: "*modified", // added, staged, with unstaged changes
            111: "unmodified",
            121: "*modified", //unstaged
            122: "modified",
            123: "*modified", //modified, staged, with unstaged changes
            101: "*deleted",
            100: "deleted"
        };
        var head = item[1] * 100;
        var dir = item[2] * 10;
        var index = item[3];
        return status[head + dir + index] || "unknown";
    }

    var credentials = {
        username: "",
        password: ""
    };

    /*basic tasks*/
    function initRepo(ev, root, fs) {
        git.init({
            fs: fs,
            cache: cache,
            dir: root,
            gitdir: join(root, appConfig.gitdir)
        }).then(function(a) {
            Notify.info("New repository created");
            ev.browser.reload(true);
        }, failure);
    }

    function cloneRepo(ev, root, fs) {
        var html = ["<form>",
            "<label>Enter repository url</label>",
            "<input style='margin-bottom:10px' id=inputName name=inputName type=text value='https://github.com/'/>",
            "<input type='checkbox' name='cloneShallow' id='cloneShallow'/>",
            "<span style='margin-right:30px'>Shallow clone</span>",
            "<input type='checkbox' name='singleBranch' id='singleBranch'/>",
            "<span>Single branch</span></br>",
            "<input style='margin:10px' class='red btn right modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit'/>",
            "</form>",
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
            var p = git.clone({
                fs: fs,
                cache: cache,
                http: http,
                gitdir: join(root, appConfig.gitdir),
                dir: root,
                onAuth: function() {
                    return new Promise(function(resolve) {
                        resolve({
                            username: appConfig.gitEmail,
                            password: appConfig.gitPassword
                        });
                    });
                },
                corsProxy: appConfig.gitCorsProxy,
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
    }
    //force checkout
    const padStart =
        typeof String.prototype.padStart === 'undefined' ?
        function(str, len, pad) {
            var t = Utils.repeat(Math.floor((len - str.length)/pad.length), pad);
            return t+pad.substring(0,(len-str.length-t.length)) + str;
        } :
        (str, len, pad) => str.padStart(len, pad);

    function doRevert(ev, root, fs) {
        fs_ = pleaseCache(fs);
        var progress = createProgress('Analyzing directory');
        var cache = getCache();
        var opts = {
            fs: fs_,
            cache: cache,
            dir: root,
            onProgress: progress.update,
            ref: 'HEAD',
            force: true,
            gitdir: join(root, appConfig.gitdir),
        };
        analyze(opts).then(function(ops) {
            progress.dismiss();
            var safeString = padStart("" + Math.floor((Math.random() * 999999)) + "", 6, "0");
            Notify.prompt("This will revert all changes in working directory to last commit.\n It will:\n" + ops.map(
                function(e) {
                    return e[0] + " " + e[1] + "\n";
                }).join("") + " To confirm operation, type '" + safeString + "'", function(ans) {
                if (ans == safeString) {
                    progress = createProgress('Reverting...');
                    git.checkout({
                        fs: fs_,
                        cache: cache,
                        dir: root,
                        onProgress: progress.update,
                        filepaths: ops.map(function(e) {
                            return e[1];
                        }),
                        ref: 'HEAD',
                        force: true,
                        gitdir: join(root, appConfig.gitdir),
                    }).then(function() {
                        progress.dismiss();
                        success();
                    }, function(e) {
                        progress.dismiss();
                        failure(e);
                    });
                }
                else if (ans) {
                    return false;
                }
            });
        }, function(e) {
            progress.dismiss();
            failure(e);
        });
    }

    function doCommit(ev, root, fs) {
        var commit = function(ans) {
            if (!ans) return;
            git.commit({
                fs: fs,
                cache: cache,
                dir: root,
                gitdir: join(root, appConfig.gitdir),
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
                }
                else failure(e);
            });
        };
        Notify.prompt("Enter Commit Message", commit);

    }

    function createProgress(status) {
        var el = $(Notify.modal({
            header: status || 'starting....',
            body: "<span class='progress'></span><div class='modal-footer'><button class='modal-close btn right'>Hide</button></div>",
            dismissible: true
        }, function() { el = null }));
        return {
            update: function(event) {
                if (el) {
                    el.find('.modal-header').text(event.phase);
                    if (event.total) {
                        el.find('.progress').css("right", ((1 - (event.loaded / event.total)) * 100) + "%").children().remove();
                    }
                    else {
                        console.log(event);
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
            }
        };
    }

    function doConfig(ev, root, fs, done) {
        var html = ["<form>",
            "<label>Author Name(used in commits)</label>",
            "<input name=userName' id='userName' placeholder='Leave empty'></input>",
            "<label>Email</label>",
            "<input name=userEmail' id='userEmail'></input>",
            "<label>Password</label>",
            "<span class='material-icons'>visibility_on</span>",
            "<input name=userPass' id='userPass' type='text'/>",
            "<input type='checkbox' name='saveToDisk' id='saveToDisk'/>",
            "<span style='margin-right:30px'>Save To Disk</span></br>",
            "<input style='margin:10px' class='red btn right modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Done'/>",
            "</form>",
        ].join("");
        var el = $(Notify.modal({
            header: "Configure",
            body: html,
            dismissible: true
        }, function() {
            el.find('form').off('submit');
        }));
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
                    git.setConfig({
                        fs: fs,
                        cache: cache,
                        dir: root,
                        gitdir: join(root, appConfig.gitdir),
                        path: i,
                        value: appConfig[dict[i]]
                    });
                }
            }
        });
    }

    function doPull(ev, root, fs, isPush) {
        //todo find changed files efficiently
        var allStaged = true;
        var method = isPush ? "push" : "pull";
        var html = ["<form>",
            "<label>Select Remote</label>",
            "<select></select></br>",
            "<label>Remote Branch Name</label>",
            "<input name=branchName' id='branchName' placeholder='default'></input>",
            "<input type='checkbox' name='fastForward' id='fastForward'/>",
            "<span style='margin-right:30px'>Fast Forward Only</span>",
            "<input style='margin:10px' class='red btn right modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='" + method.replace("p", "P") + "'/>",
            "</form>",
        ].join("");
        git.listRemotes({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(function(b) {
            if (b.length == 0) {
                addRemote(ev, root, fs, function() {
                    git.listRemotes({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(function(b) {
                        b.forEach(function(remote) {
                            el.find('select').append("<option value='" + remote.remote + "'>" + remote.remote + ": " + remote.url.split("/").slice(-2).join("/") + "</option>");
                        });
                        el.find('select').val(appConfig.defaultRemote || b[0].remote);
                    });
                });
            }
            b.forEach(function(remote) {
                el.find('select').append("<option value='" + remote.remote + "'>" + remote.remote + ": " + remote.url.split("/").slice(-2).join("/") + "</option>");
            });
            el.find('select').val(appConfig.defaultRemote || b[0].remote);
        });
        var defaultBranch;
        git.currentBranch({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(function(a) {
            defaultBranch = a;
            el.find("#branchName").attr('placeholder', a);
        });
        if (appConfig.defaultRemoteBranch) {
            el.find("#branchName").val(defaultRemoteBranch);
        }
        var el = $(Notify.modal({
            header: "Pull Changes",
            body: html,
            dismissible: false
        }, function() {
            el.find('select').off();
            el.find('form').off();
        }));

        el.find('select').on('change', function(e) {
            configure('defaultRemote', el.find('select').val(), "git");
        });
        checkBox(el);
        el.find("form").on("submit", function(e) {
            el.modal("close");
            var t = el.find("#branchName").val()
            if (t) configure("defaultRemoteBranch", t, "git");
            if (isPush || allStaged) {
                retry(config);
            }
            return false;
        });
        var config;
        if (appConfig.useDiskConfig) {
            config = { 'username': appConfig.gitName, 'default': true };
            ["user.email", "user.password"].forEach(function(i) {
                git.getConfig({
                    fs: fs,
                    cache: cache,
                    dir: root,
                    gitdir: join(root, appConfig.gitdir),
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
                })
            });
        }

        function retry(config) {
            var progress = createProgress(method);
            var p = git[method]({
                fs: fs,
                cache: cache,
                http: http,
                gitdir: join(root, appConfig.gitdir),
                dir: root,
                remote: el.find('select').val(),
                remoteRef: el.find("#branchName").val() || defaultBranch,
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
                                git.setConfig({
                                    fs: fs,
                                    cache: cache,
                                    dir: root,
                                    gitdir: join(root, appConfig.gitdir),
                                    path: i,
                                    value: appConfig[dict[i]]
                                });
                            }
                        }
                    });

                },
                onProgress: progress.update,
                onAuthFailure: function() {
                    doConfig(ev, root, fs, retry);
                },
                corsProxy: appConfig.gitCorsProxy,
            }).then(function() {
                progress.dismiss();
                Notify.info(method.replace("p", "P") + " Successful");
                ev.browser.reload();
            }, function(e) {
                progress.dismiss();
                if ((e + "").indexOf("No name was provided") > -1) {
                    Notify.prompt("Enter Author name", function(name) {
                        if (name) {
                            configure("gitName", name, "git");
                            retry(config);
                        }
                    });
                }
                else {
                    failure(e);
                    ev.browser.reload();
                }
            });
            return false;
        }
    }

    function doPush(ev, root, fs) {
        doPull(ev, root, fs, true);
    }

    function doMergeInteractive(ev, root, fs) {
        doMerge(ev, root, fs, true);
    }

    function ensureWorkTreeClean(opts, cb) {

    }

    function startMerge(opts) {

    }

    function doMerge(ev, root, fs, interactive) {
        var html = ["<form>",
            "<label>Select Remote</label>",
            "<select value='$local' style='margin-left:50px'><option value='local'>No remote</option></select></br>",
            "<label>Select Branch </label>",
            "<select></select></br>",
            "<input type='checkbox' name='fastForward' id='fastForward'/>",
            "<span style='margin-right:30px'>Fast Forward Only</span></br>",
            "<span style='margin-right:30px'>Current Branch: </span><i id='currentBranch'></i></br>",
            "<input style='margin:10px' class='red btn right modal-close' type='button' value='Cancel' />",
            "<input style='margin:10px' class='btn right' name=doSubmit type='submit' value='Merge'/>",
            "</form>"
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
        git.currentBranch({
            fs: fs,
            cache: cache,
            dir: root,
            gitdir: join(root, appConfig.gitdir)
        }).then(function(b) {
            currentBranch = b;
            el.find('#currentBranch').html(currentBranch);
        })
        git.listRemotes({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(function(b) {
            b.forEach(function(remote) {
                branchSelect.append("<option value='" + remote.remote + "'>" + remote.remote + ": " + remote.url.split("/").slice(-2).join("/") + "</option>");
            });
            if (appConfig.defaultRemote)
                branchSelect.val(appConfig.defaultRemote || b[0].remote);
        });
        var remoteSelect = el.find('select').eq(0);
        var branchSelect = el.find('select').eq(1);
        var remote;

        function updateBranches() {
            remote = remoteSelect.val();
            branchSelect.html("");
            if (remote == '$local') {
                remote = undefined;
            }
            git.listBranches({
                fs: fs,
                cache: cache,
                dir: root,
                gitdir: join(root, appConfig.gitdir),
                ref: remote
            }).then(function(list) {
                list.forEach(function(remote) {
                    branchSelect.append("<option value='" + remote + "'>" + remote + ": " + remote + "</option>");
                })
            });
        }
        updateBranches()

        remoteSelect.on('change', updateBranches);

        el.find('form').on('submit', function(e) {
            e.preventDefault();
            var ref = branchSelect.val();
            var progress = createProgress("Merging " + currentBranch + " with " + ref);
            if (!remote) {
                if (currentBranch == ref) {
                    return Notify.error('Cannot merge branch to itself');
                }
            }
            var fastForwardOnly = el.find('#fastForward')[0].checked;
            var opts = {
                fs: fs,
                cache: cache,
                http: http,
                gitdir: join(root, appConfig.gitdir),
                dir: root,
                remote: remote,
                theirs: branchSelect.val(),
                author: {
                    name: appConfig.gitName,
                    email: appConfig.gitEmail,
                },
                fastForwardOnly: fastForwardOnly,
                onProgress: progress.update,
                dryRun: true
            }
            if (!fastForwardOnly || interactive) {
                var merge = global.requireMerge().merge;
                merge(opts).then(finish, failure);
            }
            else {
                git.merge(opts).then(finish, failure);
            }
            el.modal("close");
        });
    }


    /*File Ops*/
    function update(view) {
        return function(status) {
            var name = clean(view.attr("filename"));
            var text = "";
            if (status == "unmodified" || status == "ignored") {
                text = "<span class= 'status'>" + status + "</span>";
            }
            else {
                if (status[0] == "*") {
                    status = status.substring(1);
                    text = "<span class= 'status'>unstaged</span>";
                }
                if (status == "deleted") {
                    view.attr("deleted", true);
                }
            }
            text = "<span class='git-" + status + "'>" + name + "</span>" + text;
            view.find(".filename").html(text);
        };
    }

    function stageFile(ev, root, fs) {
        var r = [ev.filepath];
        var stub = ev.browser;
        var cache = getCache();
        if (stub.marked) {
            fs = pleaseCache(fs);
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitdir: join(root, appConfig.gitdir),
                cache: cache
            };

            var end = function() {
                if (stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    git.status(a).then(update(view));
                }
            };
            if (ev.browser.getElement(ev.browser.filename(p)).attr('deleted')) {
                git.remove(a).then(end);
            }
            else git.add(a).then(end);
        });
    }

    function unstageFile(ev, root, fs) {
        var r = [ev.filepath];
        var stub = ev.browser;
        var cache = getCache();
        if (stub.marked) {
            fs = pleaseCache(fs);
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                fs: fs,
                dir: root,
                cache: cache,
                filepath: clean(relative(root, p)),
                gitdir: join(root, appConfig.gitdir)
            };
            var s = git.status(a).then(
                function() {
                    var end = function() {
                        if (stub.rootDir == ev.rootDir) {
                            var view = ev.browser.getElement(ev.browser.filename(p));
                            git.status(a).then(update(view));
                        }
                    };
                    if (s == "added" || s == "*added") {
                        git.remove(a).then(end);
                    }
                    else {
                        git.resetIndex(a).then(end);
                    }
                });
        });
    }

    function deleteFromTree(ev, root, fs) {
        var r = [ev.filepath];
        var stub = ev.browser;
        var reload = Utils.delay(function() {
            ev.browser.reload();
        }, 200)
        var cache = getCache();
        if (stub.marked) {
            fs = pleaseCache(fs);
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Notify.ask('Delete ' + r.join("\n") + ' permanently and stage?', function() {
            Utils.asyncForEach(r, function(p) {
                var a = {
                    fs: fs,
                    dir: root,
                    cache: cache,
                    filepath: clean(relative(root, p)),
                    gitdir: join(root, appConfig.gitdir),
                };
                git.remove(a).then(function() {
                    Notify.info("Delete staged");
                });
                fs.unlink(p, function() {
                    Notify.info("Deleted " + p);
                    reload();
                });
            }, null, 5);
        });
    }

    function showStatusAll(ev, root, fs, next) {
        var stub = ev.browser;
        var cache = getCache();
        var fs = pleaseCache(fs);
        var r = stub.hier.slice(stub.pageStart, stub.pageEnd).map(function(t) {
            return stub.rootDir + t;
        });
        Utils.asyncForEach(r.filter(function(e) {
            return !FileUtils.isDirectory(e);
        }), function(p, i, next, cancel) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitdir: join(root, appConfig.gitdir),
                cache: cache
            };
            var end = function(status) {
                if (stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    update(view)(status);
                    next();
                }
                else cancel(true);
            };

            git.status(a).then(end);
        }, nested, 15, false, true);

        function nested(e) {
            if (e && e !== true) return failure(e);
            var stubs = stub.childStubs;
            if (!stubs) {
                return (next || success)()
            }
            var folders = Object.keys(stubs)
            Utils.asyncForEach(folders, function(a, i, next) {
                if (stubs[a].stub.css('display') == 'none') next();
                else showStatusAll({
                    browser: stubs[a],
                    rootDir: stubs[a].rootDir
                }, root, fs, next)
            }, next || success);
        }

    }

    function showStatus(ev, root, fs) {
        var r = [ev.filepath];
        var stub = ev.browser;
        var cache = getCache();
        if (stub.marked) {
            fs = pleaseCache(fs);
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Utils.asyncForEach(r, function(p, i, next, cancel) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitdir: join(root, appConfig.gitdir),
                cache: cache
            };
            var end = function(status) {
                if (stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    update(view)(status);
                    next();
                }
                else cancel(true);
            };

            git.status(a).then(end);
        }, function(e) {
            if (!e) success()
        }, 15, false, true);
    }

    /*Status*/
    var unmodified;
    //had to come up with something faster than statusMatrix
    /*The steps for status from bottom to top
    //1 Compare shasums
    //2 To get shasum, you must parse index, parse a tree, get file shasum
    //3 To get file shasum, you must stat the file to check if it has changed, if it has, readFile and then compute 
    //4 else use parse index and use value if present else do above
    //Advantage of statusMatrix: 
        1 Files in the same tree can get shasum together
        2 Less error prone
    //Disadvantage: 
        1 It parses deep trees unnecessarily
    //Finally stats can slightly differ in different fs
    //RESTFileServer makes stats small for speed increase
    //while APPFileServer does not have inodes
    //Both fs invalidate step 3
    //On the other side cached status
    //fails when files are moved ie their
    //content changes but date is less than last check
    //A final solution might be to just put a preference for unmodified
    //files, but that will be pending when we can cache stats
    //as the result will be two stat calls
    //or to check the index for actual difference in stats
    //but for now, it works so I'm cool
    */

    function loadCachedStatus(dir, commit, fs, files, cb, error, progress) {
        if (!progress) {
            progress = function() {};
        }
        var genList = function() {
            var cache = unmodified;
            time = cache.time;
            newlist = [];
            modified = [];
            t = files.length;
            files.forEach(function(name) {
                if (cache.indexOf(name) < 0) {
                    modified.push(name);
                }
                else newlist.push(name);
            });
            a = modified.length;
            cb(modified, false);
            progress(100 * a / files.length);
            if (cache.commit != commit) {
                //the cache will not be invalidated until
                //the first call to pushUnmodified
                cb(newlist, true);
                progress(100);
            }
            else {
                Utils.asyncForEach(newlist, each,
                    function() {
                        cb([], true);
                        cb = null;
                    }, 5, false, true);
            }
        };
        var time, newlist, t, a;
        var each = function(name, i, next, cancel) {
            //to do cancel
            fs.stat(join(dir, name), function(e, s) {
                if (!e && (time > s.mtime)) {
                    //pass
                }
                else {
                    var t = unmodified.indexOf(name);
                    if (t > -1) {
                        unmodified.splice(t, 1);
                        if (unmodified.clean) unmodified.clean = false;
                    }
                    cb([name], false);
                }
                progress(100 * (i + a) / files.length);
                next();
            });
        }


        if (unmodified) {
            if (unmodified.fs != fs || unmodified.dir != dir) {
                saveStatusToCache();
                unmodified = null;
            }
        }
        if (!unmodified) {
            fs.readFile(join(dir, appConfig.gitdir + "-status"), "utf8", function(e, s) {
                if (s) {
                    unmodified = s.split("\n");
                    unmodified.time = new Date(parseInt(unmodified.shift()));
                    unmodified.commit = unmodified.shift();
                    unmodified.fs = fs;
                    unmodified.dir = dir;
                    unmodified.clean = true;
                    genList();
                }
                else {
                    cb(files, true);
                }
            });
        }
        else genList();
    }

    function saveStatusToCache() {
        if (unmodified && !unmodified.clean) {
            var a = unmodified.time.getTime() + "\n" + unmodified.commit + "\n" + unmodified.join("\n");
            unmodified.fs.writeFile(join(unmodified.dir, appConfig.gitdir + "-status"), a, "utf8", function() {});
        }
    }

    function pushUnmodified(dir, fs, name, commit) {
        if (unmodified && (unmodified.fs != fs || unmodified.dir != dir)) {
            saveStatusToCache();
            unmodified = null;
        }
        if (!unmodified || unmodified.commit != commit) {
            unmodified = [];
            unmodified.fs = fs;
            unmodified.dir = dir;
            unmodified.commit = commit;
        }
        else if (unmodified.clean) {
            unmodified.clean = false;
        }
        unmodified.time = new Date();
        unmodified.push(name)
    }


    function getUntracked(dir, curdir, fs, list, cb, finished, deep, precheck) {
        curdir = normalize(curdir);
        if (!isDirectory(curdir)) curdir = curdir + "/";
        fs.getFiles(curdir, function(e, l) {
            if (e) return finished(e)
            if (precheck)
                l = l.filter(precheck)
            var folders = l.filter(isDirectory);
            var untracked = l.filter(function(e) {
                return !isDirectory(e)
            }).map(function(file) {
                return relative(dir, curdir + file)
            }).filter(function(y) {
                var a = list.indexOf(y);
                if (a < 0) {
                    return true;
                }
                else {
                    //list.splice(a, 1);
                    return false;
                }
            });
            var toCheck;
            if (deep)
                toCheck = folders;
            else {
                toCheck = [];
                folders.forEach(function(e) {
                    var a = relative(dir, curdir + e);
                    for (var i = 0; i < list.length; i++) {
                        if (list[i].startsWith(a) && list[i] != a) {
                            toCheck.push(e);
                            return;
                        }
                    }
                    untracked.push(a);
                });
            }
            if (cb(untracked) !== false) {
                Utils.asyncForEach(toCheck,
                    function(folder, i, next) {
                        getUntracked(dir, join(curdir, folder), fs, list, function(list) {
                            return cb(list);
                        }, next, deep, precheck);
                    }, finished);
            }
        });
    }

    function showStage(ev, root, fs) {
        var stopped = false;
        var html = "<span class='progress' >Done</span><h6>Staged</h6><ul class='group-staged fileview'></ul>" +
            "<h6>Unstaged</h6><ul class='group-unstaged fileview'></ul>" +
            "<h6>Untracked</h6><ul class='group-untracked fileview'></ul>";
        var modal = $(Notify.modal({
            header: 'Git Status',
            body: html
        }, function() {
            modal.off('click', '.file-item', handleClick);
            stopped = true;
            saveStatusToCache();

        }));
        modal.addClass('grey')
        var branchName;
        var addName = function(name, status) {
            if (status == 'unmodified') {
                pushUnmodified(root, fs, name, branchName);
                return;
            }
            var staged = true;
            if (!status || status[0] == "*") {
                status = status.substring(1);
                staged = false;
            }
            var el = "<li class='file-item git-" + status + "' >" + name + "(" + status + ")</li>";
            modal.find(staged ? '.group-staged' : '.group-unstaged').append(el);
        }
        var addUntracked = function(name) {
            var el = "<li class='file-item git-untracked' >" + name + "(untracked)</li>";
            modal.find('.group-untracked').append(el);
        }
        var handleClick = function(e) {
            var a = e.target;
            var staged = $(e.target).closest('ul').hasClass('group-staged');
            var s = /git-(\w+)/.exec(a.className)[1];
            var name = a.innerText.substring(0, a.innerText.lastIndexOf("("))
            Notify.ask((staged ? 'Unstage file ' : 'Stage file (') + name + ':' + s + ')', function() {
                var end = function() {
                    if (!stopped) {
                        git.status({
                            dir: root,
                            fs: fs,
                            cache: cache,
                            filepath: name,
                            gitdir: join(root, appConfig.gitdir)
                        }).then(function(s) {
                            if (s == "absent") addUntracked(name);
                            else
                                addName(name, s);
                        }, function(e) {
                            console.error(e);
                        });
                    }
                    $(a).detach();
                }
                var method;
                if (staged) {
                    if (s == "added") {
                        method = 'remove';
                    }
                    else method = 'resetIndex';
                }
                else {
                    if (s == "deleted" || s == "absent") {
                        method = "remove";
                    }
                    else method = 'add';
                }
                if (name.endsWith('/')) {
                    var list = [];
                    getUntracked(root, join(root, name), fs, fulllist.slice(0), function(names) {
                        list.push.apply(list, names);
                    }, function() {
                        var sample = list.slice(0, 20).join(' ,');
                        Notify.ask('Add all files in ' + name + "?\n   " + (sample.length > 100 ? sample.substring(0, 100) + '....' : sample) + "(" + list.length + " files)", function() {
                            $(a).detach();
                            Utils.asyncForEach(list, function(name, i, next, cancel) {
                                git.add({
                                    dir: root,
                                    fs: fs,
                                    cache: cache,
                                    filepath: name,
                                    gitdir: join(root, appConfig.gitdir),
                                }).then(next, function(e) {
                                    Notify.error('Failed to add ' + name);
                                    cancel(e);
                                });
                            }, function(e) {
                                if (e) failure(e);
                                else {
                                    success();
                                }
                            }, (list.length > 100 ? 4 : 1), false, true)
                        });
                    }, true);

                }
                else git[method]({
                    dir: root,
                    fs: fs,
                    cache: cache,
                    filepath: name,
                    gitdir: join(root, appConfig.gitdir)
                }).then(end, failure);

            });
        }
        modal.on('click', '.file-item', handleClick);

        var percent = function(text) {
            modal.find('.progress').css('width', text + "%");
        }
        var multiple = 100;
        var each = function(name, i, next) {
            percent(Math.floor((i / files.length) * multiple));
            git.status({
                dir: root,
                fs: fs,
                filepath: name,
                gitdir: join(root, appConfig.gitdir),
                cache: cache
            }).then(function(s) {
                addName(name, s);
                if (!stopped) {
                    next();
                }
            }, function(e) {
                console.error(e);
                if (!stopped) {
                    next()
                }
            });
        };

        fs = pleaseCache(fs);
        var fulllist;
        var files;
        var iter;
        //not really needed
        //but we need all the juice we can get
        var cache = getCache();
        git.listFiles({
            dir: root,
            fs: fs,
            gitdir: join(root, appConfig.gitdir),
            cache: cache
        }).then(function(list) {
            if (appConfig.forceShowStagedDeletes) {
                git.listFiles({
                    dir: root,
                    fs: fs,
                    gitdir: join(root, appConfig.gitdir),
                    ref: 'HEAD',
                    cache: cache
                }).then(function(headList) {
                    var pos = list;
                    mergeList(list, headList);
                    startList(list);
                }, failure);
            }
            else {
                startList(list);
            }
        }, failure);

        function startList(list) {
            if (list.length > 15) {
                Notify.info('This might take some time');
            }
            fulllist = list;
            getUntracked(root, root + "/", fs, list.slice(0), function(names) {
                names.forEach(addUntracked);
                return !stopped;
            });
            var go = function() {
                files = list;
                iter = Utils.asyncForEach(files, each, function() {
                    modal.find('.progress').addClass('white');
                    percent(100);
                }, 3);
            }
            if (false) {
                //in a future where cached status is unnecessary
                go();
            }
            else {
                git.currentBranch({
                    dir: root,
                    fs: fs,
                    gitdir: join(root, appConfig.gitdir),
                    cache: cache
                }).then(function(branch) {
                        branchName = branch;
                        loadCachedStatus(root, branch, fs, list, function(s, finished) {
                            if (iter) {
                                files.push.apply(files, s);
                                return iter(finished)
                            }
                            files = s;
                            iter = Utils.asyncForEach(files, each, function() {
                                modal.find('.progress').addClass('white');
                                percent(100);
                            }, 3, !finished);
                        }, failure, function(t) {
                            if (files.length < 5)
                                percent(multiple);
                            multiple = t;
                        });
                    },
                    go);
            }
        }
    }

    /*refs and remotes*/
    function addRemote(ev, root, fs, done) {
        var html = ["<form>",
            "<label>Enter remote name</label>",
            "<input style='margin-bottom:10px' id=inputName name=inputName type=text></input>",
            "<label>Enter remote url</label>",
            "<input style='margin-bottom:10px' id=inputUrl name=inputUrl type=text></input>",
            "<input style='margin:10px' class='btn right' name=doSubmit type=submit></input>",
            "<button style='margin:10px' class='red btn right' class='modal-close'>Cancel</button>",
            "</form>"
        ].join("")
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
            }
            else if (!testUrl(url)) {
                Notify.error('Invalid remote url');
            }
            else {
                $(el).modal('close');
                git.addRemote({
                    fs: fs,
                    cache: cache,
                    dir: root,
                    remote: name,
                    url: url,
                    gitdir: join(root, appConfig.gitdir)
                }).then(done || success, failure);
            }
        }).find('button').click(function(e) {
            e.preventDefault();
            e.stopPropagation();
            $(el).modal('close');
        });

    }

    function gotoRef(ev, root, fs, ref, noCheckout) {
        var progress = createProgress("Checking out " + ref);
        fs = pleaseCache(fs);
        git.checkout({
            fs: fs,
            dir: root,
            ref: ref,
            cache: cache,
            onProgress: progress.update,
            gitdir: join(root, appConfig.gitdir),
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

    var branchList;

    function switchBranch(ev, root, fs, noCheckout) {
        var branches;

        function showModal(currentBranch) {
            if (!branchList) {
                branchList = new ItemList('git-branches', branches);
                branchList.on('select', function(item) {
                    if (item == branchList.current) {
                        return;
                    }
                    gotoRef(ev, root, fs, item, noCheckout);
                    branchList.$el.modal('close');
                });
                branchList.footer = ["Cancel"];
                branchList.$cancel = function() {
                    branchList.$el.modal('close');
                };
                branchList.createElement();
                branchList.$el.modal(AutoCloseable);
            }
            branchList.current = currentBranch;
            branchList.items = branches;
            branchList.render();
            $(branchList.getElementAtIndex(branches.indexOf(currentBranch))).removeClass('tabbable').addClass('yellow');
            $(branchList.$el).modal('open');
        }
        git.listBranches({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(
            function(b) {
                branches = b;
                git.currentBranch({ fs, dir: root, gitdir: join(root, appConfig.gitdir) }).then(showModal);
            });
    }

    function createBranch(ev, root, fs) {
        Notify.prompt('Enter Branch Name', function(name) {
            if (name) {
                git.branch({
                    dir: root,
                    fs: fs,
                    cache: cache,
                    ref: name,
                    gitdir: join(root, appConfig.gitdir)
                }).then(success, failure);
            }
        });
    }

    function switchBranchNoCheckout(ev, root, fs) {
        switchBranch(ev, root, fs, true);
    }

    function testPlain(str) {
        if (!str) return false;
        return /^[A-Za-z][-A-Za-z_0-9]+$/.test(str);
    }

    function testUrl(str) {
        if (!str) return false;
        return /^([A-Za-z]+\:\/+)?([0-9\.]+(\:[0-9]+)?|[A-Za-z][-\.A-Za-z_0-9]+)(\/+[A-Za-z][A-Za-z_0-9]*)*(\.([a-zA-Z]+))?\/?$/.test(str);
    }

    function success() {
        Notify.info('Done');
    }

    function handleError(e, data) {
        switch (e.code) {
            case 'CheckoutConflictError':
                Notify.modal({
                    header: 'Unable To Checkout ' + (data ? data.ref : ""),
                    body: e.message + "</br><span><i class='material-icons'>info</i></span>Commit your unsaved changes or revert the changes to continue",
                });
                return true;
            default:
                console.error(e);
        }
    }

    function failure(e) {
        handleError(e);
        Notify.error("Error: " + e.toString());
    }

    //FileUtils guarantees only one browser will
    //use overflow at a time
    //global variables are allowed
    var gitRoot = "";
    var lastEvent;
    var detectRepo = function(ev, btn, yes, no) {
        var dir;
        dir = ev.rootDir;
        lastEvent = ev;
        findRoot(dir, ev.browser.fileServer)
            .then(function(path) {
                gitRoot = path;
                yes.show(btn);
            }, function(e) {
                gitRoot = ev.rootDir;
                no.show(btn);
            });
    };
    var detectHierarchyRepo = function(ev, btn, yes, no) {
        ev.browser.menu && ev.browser.menu.hide();
        ev.browser.expandFolder(ev.filename, function(cb) {
            detectRepo(Object.assign({}, ev, {
                browser: cb,
                rootDir: ev.filepath
            }), ev.browser.getElement(ev.filename)[0], yes, no)
        });
    }
    var TREE = git.TREE;
    var WORKDIR = git.WORKDIR;
    var STAGE = git.STAGE;
    const flat =
        typeof Array.prototype.flat === 'undefined' ?
        entries => entries.reduce((acc, x) => acc.concat(x), []) :
        entries => entries.flat()

    async function analyze({
        fs,
        cache,
        onProgress,
        dir,
        gitdir,
        ref,
        force,
        filepaths,
    }) {
        let count = 0
        return git.walk({
            fs,
            cache,
            dir,
            gitdir,
            trees: [TREE({ ref }), WORKDIR(), STAGE()],
            map: async function(fullpath, [commit, workdir, stage]) {
                if (fullpath === '.') return
                // match against base paths
                if (filepaths && !filepaths.some(base => worthWalking(fullpath, base))) {
                    return null
                }
                // Emit progress event
                if (onProgress) {
                    await onProgress({ phase: 'Analyzing workdir', loaded: ++count })
                }

                // This is a kind of silly pattern but it worked so well for me in the past
                // and it makes intuitively demonstrating exhaustiveness so *easy*.
                // This checks for the presense and/or absense of each of the 3 entries,
                // converts that to a 3-bit binary representation, and then handles
                // every possible combination (2^3 or 8 cases) with a lookup table.
                const key = [!!stage, !!commit, !!workdir].map(Number).join('')
                if (fullpath.indexOf("tools/git.js") > -1) {
                    console.log(key);
                }

                switch (key) {
                    // Impossible case.
                    case '000':
                        return
                        // Ignore workdir files that are not tracked and not part of the new commit.
                    case '001':
                        // OK, make an exception for explicitly named files.
                        if (force && filepaths && filepaths.includes(fullpath)) {
                            return ['delete', fullpath]
                        }
                        return null;
                        // New entries
                    case '010':
                        {
                            switch (await commit.type()) {
                                case 'tree':
                                    {
                                        return ['mkdir', fullpath]
                                    }
                                case 'blob':
                                    {
                                        return [
                                            'create',
                                            fullpath,
                                            await commit.oid(),
                                            await commit.mode(),
                                        ]
                                    }
                                case 'commit':
                                    {
                                        return [
                                            'mkdir-index',
                                            fullpath,
                                            await commit.oid(),
                                            await commit.mode(),
                                        ]
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `new entry Unhandled type ${await commit.type()}`,
                                        ]
                                    }
                            }
                        }
                        // New entries but there is already something in the workdir there.
                    case '011':
                        {
                            switch (`${await commit.type()}-${await workdir.type()}`) {
                                case 'tree-tree':
                                    {
                                        return // noop
                                    }
                                case 'tree-blob':
                                case 'blob-tree':
                                    {
                                        return ['conflict', fullpath]
                                    }
                                case 'blob-blob':
                                    {
                                        // Is the incoming file different?
                                        if ((await commit.oid()) !== (await workdir.oid())) {
                                            if (force) {
                                                return [
                                                    'update',
                                                    fullpath,
                                                    await commit.oid(),
                                                    await commit.mode(),
                                                    (await commit.mode()) !== (await workdir.mode()),
                                                ]
                                            }
                                            else {
                                                return ['conflict', fullpath]
                                            }
                                        }
                                        else {
                                            // Is the incoming file a different mode?
                                            if ((await commit.mode()) !== (await workdir.mode())) {
                                                if (force) {
                                                    return [
                                                        'update',
                                                        fullpath,
                                                        await commit.oid(),
                                                        await commit.mode(),
                                                        true,
                                                    ]
                                                }
                                                else {
                                                    return ['conflict', fullpath]
                                                }
                                            }
                                            else {
                                                return [
                                                    'create-index',
                                                    fullpath,
                                                    await commit.oid(),
                                                    await commit.mode(),
                                                ]
                                            }
                                        }
                                    }
                                case 'commit-tree':
                                    {
                                        // TODO: submodule
                                        // We'll ignore submodule directories for now.
                                        // Users prefer we not throw an error for lack of submodule support.
                                        // gitlinks
                                        return
                                    }
                                case 'commit-blob':
                                    {
                                        // TODO: submodule
                                        // But... we'll complain if there is a *file* where we would
                                        // put a submodule if we had submodule support.
                                        return ['conflict', fullpath]
                                    }
                                default:
                                    {
                                        return ['error', `new entry Unhandled type ${commit.type}`]
                                    }
                            }
                        }
                        // Something in stage but not in the commit OR the workdir.
                        // Note: I verified this behavior against canonical git.
                    case '100':
                        {
                            return ['delete-index', fullpath]
                        }
                        // Deleted entries
                        // TODO: How to handle if stage type and workdir type mismatch?
                    case '101':
                        {
                            switch (await stage.type()) {
                                case 'tree':
                                    {
                                        return ['rmdir', fullpath]
                                    }
                                case 'blob':
                                    {
                                        // Git checks that the workdir.oid === stage.oid before deleting file
                                        if ((await stage.oid()) !== (await workdir.oid())) {
                                            if (force) {
                                                return ['delete', fullpath]
                                            }
                                            else {
                                                return ['conflict', fullpath]
                                            }
                                        }
                                        else {
                                            return ['delete', fullpath]
                                        }
                                    }
                                case 'commit':
                                    {
                                        return ['rmdir-index', fullpath]
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `delete entry Unhandled type ${await stage.type()}`,
                                        ]
                                    }
                            }
                        }
                        /* eslint-disable no-fallthrough */
                        // File missing from workdir
                    case '110':
                        // Possibly modified entries
                    case '111':
                        {
                            /* eslint-enable no-fallthrough */
                            switch (`${await stage.type()}-${await commit.type()}`) {
                                case 'tree-tree':
                                    {
                                        return
                                    }
                                case 'blob-blob':
                                    {
                                        // If the file hasn't changed, there is no need to do anything.
                                        // Existing file modifications in the workdir can be be left as is.
                                        // Check for local changes that would be lost
                                        if (workdir) {
                                            // Note: canonical git only compares with the stage. But we're smart enough
                                            // to compare to the stage AND the incoming commit.
                                            if (
                                                (await workdir.oid()) !== (await stage.oid()) &&
                                                (await workdir.oid()) !== (await commit.oid())
                                            ) {
                                                if (force) {
                                                    return [
                                                        'update',
                                                        fullpath,
                                                        await commit.oid(),
                                                        await commit.mode(),
                                                        (await commit.mode()) !== (await workdir.mode()),
                                                    ]
                                                }
                                                else {
                                                    return ['conflict', fullpath]
                                                }
                                            }
                                        }
                                        else {
                                            if (force) {
                                                return [
                                                    'update',
                                                    fullpath,
                                                    await commit.oid(),
                                                    await commit.mode(),
                                                    (await commit.mode()) !== (await stage.mode()),
                                                ]
                                            }
                                            else if (
                                                (await stage.oid()) === (await commit.oid()) &&
                                                (await stage.mode()) === (await commit.mode())
                                            ) {
                                                return
                                            }
                                        }
                                        // Has file mode changed?
                                        if ((await commit.mode()) !== (await stage.mode())) {
                                            return [
                                                'update',
                                                fullpath,
                                                await commit.oid(),
                                                await commit.mode(),
                                                true,
                                            ]
                                        }
                                        // TODO: HANDLE SYMLINKS
                                        // Has the file content changed?
                                        if ((await commit.oid()) !== (await stage.oid())) {
                                            return [
                                                'update',
                                                fullpath,
                                                await commit.oid(),
                                                await commit.mode(),
                                                false,
                                            ]
                                        }
                                        else {
                                            return
                                        }
                                    }
                                case 'tree-blob':
                                    {
                                        return ['update-dir-to-blob', fullpath, await commit.oid()]
                                    }
                                case 'blob-tree':
                                    {
                                        return ['update-blob-to-tree', fullpath]
                                    }
                                case 'commit-commit':
                                    {
                                        return [
                                            'mkdir-index',
                                            fullpath,
                                            await commit.oid(),
                                            await commit.mode(),
                                        ]
                                    }
                                default:
                                    {
                                        return [
                                            'error',
                                            `update entry Unhandled type ${await stage.type()}-${await commit.type()}`,
                                        ]
                                    }
                            }
                        }
                }
            },
            // Modify the default flat mapping
            reduce: async function(parent, children) {
                children = flat(children)
                if (!parent) {
                    return children
                }
                else if (parent && parent[0] === 'rmdir') {
                    children.push(parent)
                    return children
                }
                else {
                    children.unshift(parent)
                    return children
                }
            },
        })
    }
    var GitFileMenu = {
        "show-file-status": {
            caption: "Show file status",
            onclick: showStatus
        },
        "stage-file": {
            caption: "Stage File",
            onclick: stageFile
        },
        "unstage-file": {
            caption: "Unstage File",
            onclick: unstageFile
        },
        "delete-from-tree": {
            caption: "Delete and Stage",
            onclick: deleteFromTree
        }
    };
    var GitMenu = {
        "view-stage": {
            icon: 'view_headline',
            caption: "View Stage",
            onclick: showStage
        },
        "show-status": {
            icon: 'view_headline',
            caption: "Show Changed Files",
            onclick: showStatusAll
        },
        "branches": {
            icon: "usb",
            caption: "Branches",
            childHier: {
                "create-branch": {
                    icon: "add",
                    caption: "Create Branch",
                    onclick: createBranch
                },
                "switch-branch": {
                    icon: "swap_horiz",
                    caption: "Checkout Branch",
                    onclick: switchBranch
                },
                "switch-branch-nocheckout": {
                    icon: "swap_horiz",
                    caption: "Set HEAD branch",
                    onclick: switchBranchNoCheckout
                },
                "close-branch": "Close Branch"
            }
        },
        "remotes": {
            icon: "cloud",
            caption: "Remote",
            childHier: {
                "add-remote": {
                    icon: "add",
                    caption: "Add Remote",
                    onclick: addRemote
                },
                "delete-remote": "Remove Remote"
            }
        },
        "do-commit": {
            icon: 'save',
            caption: "Commit",
            onclick: doCommit
        },
        "do-pull": {
            icon: 'vertical_align_bottom',
            caption: "Pull Changes",
            onclick: doPull
        },
        "do-push": {
            icon: 'vertical_align_top',
            caption: "Push Changes",
            onclick: doPush
        },
        "do-merge": {
            icon: 'swap_vert',
            caption: "Merge Branches",
            onclick: doMerge
        },
        "do-revert": {
            icon: 'warning',
            caption: "Revert",
            className: "red-text",
            onclick: doRevert
        },
        "configure": {
            caption: "..Authentication",
            onclick: doConfig
        }
    };
    var NoGitMenu = {
        "init-repo": {
            caption: "Initialize Repository",
            onclick: initRepo
        },
        "clone-repo": {
            caption: "Clone Existing Repository",
            onclick: cloneRepo
        }
    };

    var GitFileOverflow = new Overflow();
    var GitOverflow = new Overflow();
    var NoGitOverflow = new Overflow();

    GitFileOverflow.setHierarchy(GitFileMenu);
    GitOverflow.setHierarchy(GitMenu);
    NoGitOverflow.setHierarchy(NoGitMenu);

    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function(e, id, span, data) {
        data.onclick && data.onclick(lastEvent, gitRoot, lastEvent.browser.fileServer);
        return true;
    };
    GitOverflow.ondismiss = GitFileOverflow.ondismiss = NoGitOverflow.ondismiss = function(e) {
        var parent = lastEvent.browser.menu;
        if (parent) {
            if (e) { parent.onOverlayClick(e); }
            else {
                parent.hide()
            }
        }
    };
    var GitFileOption = {
        caption: "Git...",
        onclick: function(ev) {
            detectRepo(ev, ev.element, GitFileOverflow, NoGitOverflow);
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
    var GitProjectOption = {
        caption: "Git..",
        onclick: function(ev) {
            detectHierarchyRepo(ev, ev.element, GitOverflow, NoGitOverflow);
            ev.stopPropagation();
            ev.preventDefault()
        },
        hasChild: true,
        close: false,
    }
    var GitOption = {
        caption: "Git...",
        onclick: function(ev) {
            lastEvent = ev;
            detectRepo(ev, ev.element, GitOverflow, NoGitOverflow);
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
})(Modules);
(function(global) {
    var relative = global.FileUtils.relative;
    var normalize = global.FileUtils.normalize;
    var clean = global.FileUtils.cleanFileList;
    var dirname = global.FileUtils.dirname;

    function GitFileServer(opts) {
        this.opts = {
            fs: opts.fs,
            dir: opts.dir,
            gitdir: opts.gitdir,
            cache: opts.cache
        };
        this.ref = this.opts.ref;
    }
    (function() {
        this.getOpts = function(d) {
            return Object.assign({
                fs: this.opts.fs,
                dir: this.opts.dir,
                gitdir: this.opts.gitdir,
                cache: this.opts.cache,
            }, d);
        };
        this.resolve = function(cb) {
            git.resolveRef(this.getOpts({ ref: this.ref })).then(function(sha) {
                git.readCommit(this.getOpts({ oid: sha })).then(function(obj) {
                    if (!this.trees) {
                        this.trees = {};
                        this.trees["!oid"] = obj.commit.tree;
                        this.trees["!isDir"] = true
                    }
                    cb();
                }, cb);
            }, cb);
        };
        this.readFile = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }
            var enc = !opts || typeof opts == 'string' ? opts : opts.encoding;
            this.readdir(dirname(path), function(e) {
                if (e) cb(e);
                else {
                    var cache = this.trees;
                    var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
                    while (segments.length) {
                        cache = cache[segments.shift()];
                    }
                    if (!cache) {
                        cb({ code: 'ENOENT' });
                    }
                    else if (cache["!isDir"]) {
                        cb({ code: 'EISDIR' });
                    }
                    git.readBlob(this.getOpts({ oid: cache["!oid"] })).then(function(t) {
                        var res = t.blob;
                        if (!enc) {
                            cb(null, res);
                        }
                        else {
                            var error;
                            try {
                                res = new TextDecoder(enc).decode(res);
                            }
                            catch (e) {
                                error = e;
                            }
                            cb(error, error ? undefined : res);
                        }
                    }, cb);
                }
            });
        };
        this.writeFile = function(path, content, opts, cb) {
            setTimeout(function() {
                cb({ code: 'EUNSUPPORTED' });
            });
        };
        this.readdir = function(path, opts, cb) {
            if (typeof opts == "function") {
                cb = opts;
                opts = null;
            }

            // Read a commit object
            var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
            var treeOid = null;
            console.log(segments);
            var cache = this.trees;
            if (!cache) {
                this.resolve(function(e) {
                    if (e) cb(e);
                    else {
                        cache = this.trees;
                        dip();
                    }
                });
            }
            else {
                while (segments.length) {
                    if ((cache[segments[0]])) {
                        cache = cache[segments.shift()];
                    }
                    else break;
                }
                console.log(cache, segments);
                if (!segments.length) {
                    if (cache["!loaded"]) {
                        cb(null, Object.keys(cache).filter(function(i) {
                            return i != "!oid" && i != "!isDir" && i != "!loaded";
                        }));
                    }
                }
                dip();
            }

            function dip() {
                git.readTree(this.getOpts({ oid: cache["!oid"] })).then(function(res) {
                    for (var i = 0; i < res.tree.length; i++) {
                        cache[res.tree[i].path] = {
                            "!oid": res.tree[i].oid,
                            "!isDir": res.tree[i].type == 'tree'
                        };
                    }
                    cache["!loaded"] = true;
                    if (segments.length === 0) {
                        cb(null, res.tree.map(function(e) { return e.path }));
                    }
                    else {
                        var name = segments.shift();
                        var tree = res.tree[name];
                        if (!tree) {
                            return cb({ code: 'ENOENT' });
                        }
                        else if (!tree["!isDir"]) {
                            return cb({ code: 'ENOTDIR' });
                        }
                        else {
                            cache = tree;
                            dip();
                        }
                    }
                }, cb);
            }
        };
        this.getFiles = function(path, cb) {
            var segments = relative(this.opts.dir, clean(normalize(path))).split("/");
            this.readdir(path, function(e, res) {
                if (e) cb(e);
                var cache = this.trees;
                while (segments.length) {
                    cache = cache[segments.shift()];
                }
                cb(null, res.map(function(e) {
                    if (cache[e]["!isDir"]) {
                        return e + "/";
                    }
                    return e;
                }));
            });
        };
        this.stat = function() {
            this.opts.fs.stat.apply(fs, arguments);
        };
        this.lstat = function() {
            this.opts.fs.lstat.apply(fs, arguments);
        };
        this.href = null;
        this.isEncoding = function() {
            this.opts.fs.isEncoding.apply(fs, arguments);
        };
        this.getEncodings = function() {
            this.opts.fs.getEncodings.apply(fs, arguments);
        };
        this.getDisk = function() {
            this.opts.fs.getDisk.apply(fs, arguments);
        };
        this.getRoot = function() {
            return this.opts.dir; //.apply(fs, arguments);
        };
        this.copyFile = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.moveFile = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.mkdir = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.rename = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.delete = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.rmdir = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.unlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.symlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
        this.readlink = function() {
            var cb = this.arguments[this.arguments.length - 1];
            cb({ code: 'UNSUPORTED' })
        };
    }).apply(GitFileServer.prototype);
    global.GitFileServer = GitFileServer;
})(Modules);
