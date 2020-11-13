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
    var pleaseCache = global.createCacheFs;
    var appConfig = global.registerAll({
        "gitDir": ".git",
        "gitUsername": "",
        "gitName": "",
        "gitEmail": "",
        "gitPassword": "*******",
        "gitCorsProxy": Env._server + "/git"
    }, "git");
    var configure = global.configure;
    global.registerValues({
        "gitCorsProxy": "Possible value: https://cors.isomorphic-git.org/ \nSee isomorphic-git.com/issues",
        "gitName": "The name that will be used in commits",
    });

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

    var clean = FileUtils.cleanFileList;
    var relative = FileUtils.relative;
    var normalize = FileUtils.normalize;
    var isDirectory = FileUtils.isDirectory;

    function initRepo(ev, root, fs) {
        git.init({
            fs: fs,
            dir: root,
            gitDir: appConfig.gitDir
        }).then(function(a) {
            Notify.info("New repository created");
            ev.browser.reload(true);
        }, function(e) {
            Notify.error("Failed to create repository");
        });
    }

    function doCommit(ev, root, fs) {
        Notify.prompt("Enter Commit Message", function(ans) {
            git.commit({
                fs: fs,
                dir: root,
                gitDir: appConfig.gitDir,
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
                        configure("gitName", name, "git");
                        doCommit(ev, root, fs);
                    });
                }
                else Notify.error(e);
            });
        });
    }

    function cloneRepo(ev, root, fs) {
        Notify.prompt("Enter Repository Url", function(url) {
            if (url) {
                var p = git.clone({
                    fs: fs,
                    http: http,
                    gitDir: appConfig.gitDir,
                    dir: root,
                    onAuth: function() {
                        return new Promise(function(resolve) {
                            resolve({
                                username: appConfig.gitUsername,
                                password: appConfig.gitPassword
                            });
                        });
                    },
                    corsProxy: appConfig.gitCorsProxy,
                    url: url,
                    singleBranch: true,
                    depth: 1
                }).then(function() {
                    Notify.info("Clone complete");
                });
            }
        });
    }


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
        if (stub.marked) {
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitDir: appConfig.gitDir,
            };
            var end = function() {
                var view = ev.browser.getElement(ev.browser.filename(p));
                git.status(a).then(update(view));
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
        if (stub.marked) {
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitDir: appConfig.gitDir,
            };
            var s = git.status(a).then(
                function() {
                    var end = function() {
                        var view = ev.browser.getElement(ev.browser.filename(p));
                        git.status(a).then(update(view));
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
        if (stub.marked) {
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Notify.ask('Delete ' + r.join("\n") + ' permanently and stage?', function() {
            r.forEach(function(p) {
                var a = {
                    fs: fs,
                    dir: root,
                    filepath: clean(relative(root, p)),
                    gitDir: appConfig.gitDir,
                };
                git.remove(a).then(function() {
                    Notify.info("Delete staged");
                });
                fs.unlink(p, function() {
                    Notify.info("Deleted " + p);
                    reload();
                });
            });
        });
    }

    function showStatus(ev, root, fs) {
        var r = [ev.filepath];
        var stub = ev.browser;
        var reload = Utils.delay(function() {
            ev.browser.reload();
        }, 200)
        if (stub.marked) {
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                fs: fs,
                dir: root,
                filepath: clean(relative(root, p)),
                gitDir: appConfig.gitDir,
            };
            var view = ev.browser.getElement(ev.browser.filename(p));

            git.status(a).then(update(view));
        });
    }

    var unmodified;
    //had to come up with something faster than statusMatrix
    function loadCachedStatus(dir, fs, files, cb, error, progress) {
        if (!progress) {
            progress = function() {};
        }
        var genList = function() {
            time = unmodified.time;
            newlist = [];
            modified = [];
            files.forEach(function(name) {
                if (unmodified.indexOf(name) < 0) {
                    modified.push(name);
                }
                else newlist.push(name);
            });
            cb(modified, false);
            progress(100 * (modified.length) / files.length);
            Utils.asyncForEach(newlist, each,
                function() {
                    cb([], true);
                    cb = null;
                }, 5);
        };
        var time, newlist;
        var each = function(name, i, next) {
            fs.stat(name, function(e, s) {
                if (s && (time > s.mtime)) {
                    //pass
                }
                else {
                    var t = unmodified.indexOf(name);
                    if (t > -1) {
                        unmodified.splice(t, 1);
                    }
                    cb([name], false);
                }
                progress(100 * (i + 1 + modified.length) / files.length);
                next();
            });
        }


        if (unmodified && (unmodified.fs != fs || unmodified.dir != dir)) {
            saveStatusToCache();
            unmodified = null;
        }
        if (!unmodified) {
            fs.readFile(dir + "/.git-status", "utf8", function(e, s) {
                if (s) {
                    unmodified = s.split("\n");
                    unmodified.time = new Date(parseInt(unmodified.shift()));
                    unmodified.fs = fs;
                    unmodified.dir = dir;
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
        if (unmodified) {
            var a = unmodified.time.getTime() + "\n" + unmodified.join("\n");
            unmodified.fs.writeFile(unmodified.dir + '/.git-status', a, "utf8");
        }
    }

    function pushUnmodified(dir, fs, name) {
        if (unmodified && (unmodified.fs != fs || unmodified.dir != dir)) {
            saveStatusToCache();
            unmodified = null;
        }
        if (!unmodified) {
            unmodified = [];
            unmodified.fs = fs;
            unmodified.dir = dir;
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
            if (cb(untracked)) {
                Utils.asyncForEach(toCheck,
                    function(folder, i, next) {
                        getUntracked(dir, curdir + folder, fs, list, function(list) {
                            return cb(list);
                        }, next);
                    });
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
        var addName = function(name, status) {
            if (status == 'unmodified') {
                pushUnmodified(root, fs, name)
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
                            filepath: name
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
                    if (s == "deleted") {
                        method = "remove";
                    }
                    else method = 'add';
                }
                if (name.endsWith('/')) {
                    Notify.error('Cannot add folder.');
                }
                else git[method]({
                    dir: root,
                    fs: fs,
                    filepath: name
                }).then(end, failure);

            });
        }
        modal.on('click', '.file-item', handleClick);

        var percent = function(text) {
            modal.find('.progress').css('width', text + "%");
        }
        var files;
        fs = pleaseCache(fs);
        var iter;
        git.listFiles({
            dir: root,
            fs: fs
        }).then(function(list) {
            if (list.length > 15) {
                Notify.info('This might take some time');
            }

            getUntracked(root, root + "/", fs, list.slice(0), function(names) {
                names.forEach(addUntracked);
                return !stopped;
            }, function() {});
            var multiple = 100;
            loadCachedStatus(root, fs, list, function(s, finished) {
                if (iter) {
                    files.push.apply(files, s);
                    return iter(finished)
                }
                files = s;
                var each = function(name, i, next) {
                    percent(Math.floor((i / files.length) * multiple));
                    git.status({
                        dir: root,
                        fs: fs,
                        filepath: name
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
                iter = Utils.asyncForEach(files, each, function() {
                    modal.find('.progress').addClass('white');
                    percent(100);
                }, 3, !finished);
            }, failure, function(t) {
                multiple = t;
            });
        }, failure);
    }


    function addRemote(ev, root, fs) {
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
        });
        $(el).find('form').on('submit', function(e) {
            e.preventDefault();
            var name = $(this).find('#inputName')[0].value;
            var url = $(this).find('#inputUrl')[0].value;
            if(name && url){
                git.addRemote({
                    fs,
                    dir: root,
                    remote: name,
                    url: url
                }).then(success, failure);
            }
            else{
                Notify.error((name?"Name ":"Url ")+'cannot be empty');
            }
        }).find('button').click(function(e){
            e.preventDefault();
            e.stopPropagation();
            $(el).modal('close');
        });

    }

    function gotoRef(ev, root, fs, ref, noCheckout) {
        git.checkout({
            fs: fs,
            dir: root,
            ref: ref,
            noCheckout: noCheckout
        }).then(function() {
            Notify.info((noCheckout?'Updated HEAD to point at ':'Checked out files from ' )+ ref);
        }, function() {
            Notify.error('Error: switching branch');
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
            $(branchList.getElementAtIndex(branches.indexOf(currentBranch))).removeClass('tabbable').addClass('selected');
            $(branchList.$el).modal('open');
        }
        git.listBranches({ fs, dir: root }).then(
            function(b) {
                branches = b;
                git.currentBranch({ fs, dir: root }).then(showModal);
            });
    }

    function success() {
        Notify.info('Done');
    }

    function failure(e) {
        Notify.error("Error: " + e.toString());
    }

    function createBranch(ev, root, fs) {
        Notify.prompt('Enter Branch Name', function(name) {
            git.branch({
                dir: root,
                fs: fs,
                ref: name
            }).then(success, failure);
        });
    }

    function switchBranchNoCheckout(ev, root, fs) {
        switchBranch(ev, root, fs, true);
    }

    var gitRoot = "";
    var detectRepo = function(ev, btn, yes, no) {
        var dir;
        dir = ev.rootDir;
        lastEvent = ev;
        git.findRoot({
            fs: ev.browser.fileServer,
            filepath: dir
        }).then(function(path) {
            gitRoot = path;
            yes.show(btn);
        }, function(e) {
            console.log(e);
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
    var GitMenu = {
        "view-stage": {
            icon: 'view_headline',
            caption: "View Stage",
            onclick: showStage
        },
        "do-commit": {
            icon: 'save',
            caption: "Commit",
            onclick: doCommit
        },
    };
    var NoGitMenu = {
        "init-repo": {
            caption: "Initialize Repository",
            onclick: initRepo
        }
    };
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
    var GitFileOverflow = new Overflow();
    GitFileOverflow.setHierarchy(GitFileMenu);
    var GitOverflow = new Overflow();
    GitOverflow.setHierarchy(GitMenu);
    var NoGitOverflow = new Overflow();
    NoGitOverflow.setHierarchy(NoGitMenu);
    var lastEvent;
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
    var colors = {
        //file ignored by a .gitignore rule
        "ignored": "done",
        //file unchanged from HEAD commit
        "unmodified": "done",
        //file has modifications, not yet staged
        "*modified": "done",
        //file has been removed, but the removal is not yet staged
        "*deleted": "",
        //file is untracked, not yet staged
        "*added": "done",
        //file not present in HEAD commit, staging area, or working dir
        "absent": "",
        //file has modifications, staged
        "modified": "done",
        //file has been removed, staged
        "deleted": "",
        //previously untracked file, staged
        "added": "done",
        //working dir and HEAD commit match, but index differs
        "*unmodified": "done",
        //file not present in working dir or HEAD commit, but present in the index
        "*absent": "",
        //file was deleted from the index, but is still in the working dir
        "*undeleted": "",
        "*undeletemodified": ""
    };

    FileUtils.registerOption("files", ["create"], "git-opts", GitOption);
    FileUtils.registerOption("files", ["file", "folder"], "git-file-opts", GitFileOption);
    FileUtils.registerOption("project", ["project"], "git-opts", GitProjectOption);
    FileUtils.registerOption("project", ["project"], "git-file-opts", "");
})(Modules);