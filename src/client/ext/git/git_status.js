define(function(require,exports,module) {
    /*globals $*/
    require('grace/ext/glob/glob');
    var Notify = require("grace/ui/notify").Notify;
    var appConfig = require("grace/core/config").Config.registerAll({}, "git");
    var clean = require("grace/core/file_utils").FileUtils.removeTrailingSlash;
    var GitCommands = require("./git_commands").GitCommands;
    var Utils = require("grace/core/utils").Utils;
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var relative = FileUtils.relative;
    var basename = FileUtils.filename;
    var failure = GitCommands.failure;
    var success = GitCommands.success;
    var join = FileUtils.join;
    var normalize = FileUtils.normalize;
    var isDirectory = FileUtils.isDirectory;
    var mergeList = Utils.mergeList;
    /*File Ops*/
    function updateView(view) {
        return function(status) {
            var name = clean(view.attr("filename"));
            var text = "";
            if (status == "*conflict") {
                text = "<span class= 'status red'>" + status + "</span>";
            } else if (status == "conflict" || status == "unmodified" || status == "ignored") {
                text = "<span class= 'status'>" + status + "</span>";
            } else {
                if (status[0] == "*") {
                    status = status.substring(1);
                    text = "<span class= 'status'>unstaged</span>";
                }
                if (status == "deleted" || status == "deletedmodified") {
                    view.attr("deleted", true);
                }
            }
            text = "<span class='git-" + status + "'>" + name + "</span>" + text;
            view.find(".filename").html(text);
        };
    }
    GitCommands.add = function(ev, prov) {
        var r = [ev.filepath];
        var stub = ev.browser;
        if (ev.marked) {
            r = ev.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var end = function() {
                if (!isDirectory(p) && stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    prov.status(a).then(updateView(view));
                }
            };
            if (ev.browser.getElement(ev.browser.filename(p)).attr('deleted')) {
                prov.remove(a).then(end);
            } else prov.add(a).then(end);
        });
    };
    GitCommands.remove = function(ev, prov) {
        var r = [ev.filepath];
        var stub = ev.browser;
        if (ev.marked) {
            r = ev.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var s = prov.status(a).then(function() {
                var end = function() {
                    if (!isDirectory(p) && stub.rootDir == ev.rootDir) {
                        var view = ev.browser.getElement(ev.browser.filename(p));
                        prov.status(a).then(updateView(view));
                    }
                };
                if (s == "added") {
                    prov.remove(a).then(end);
                } else {
                    prov.resetIndex(a).then(end);
                }
            });
        });
    };
    GitCommands.delete = function(ev, prov) {
        var r = [ev.filepath];
        var reload = Utils.delay(function() {
            ev.browser.reload();
        }, 200);
        if (ev.marked) {
            r = ev.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Notify.ask('Delete ' + r.join("\n") + ' permanently and stage?', function() {
            Utils.asyncForEach(r, function(p) {
                var a = {
                    filepath: clean(relative(prov.dir, p))
                };
                prov.remove(a).then(function() {
                    Notify.info("Delete staged");
                });
                prov.fs.unlink(p, function() {
                    Notify.info("Deleted " + p);
                    reload();
                });
            }, null, 5);
        });
    };

    function statusFiles(prov, stub, next) {
        var r = stub.names.slice(stub.pageStart, stub.pageEnd).map(function(t) {
            return stub.rootDir + t;
        });
        var startRootDir = stub.rootDir;
        var all = r.filter(function(e) {
            return !FileUtils.isDirectory(e);
        }).map(function(p) {
            return relative(prov.dir, p);
        });
        batchStatus(prov, all, function(p, status) {
            if (stub.rootDir == startRootDir) {
                var view = stub.getElement(stub.filename(join(prov.dir, p)));
                updateView(view)(status);
            } else all.length = 0;
        }, nested);

        function nested() {
            if (stub.rootDir !== startRootDir) return;
            var stubs = stub.childStubs;
            if (!stubs) {
                return (next || success)();
            }
            var folders = Object.keys(stubs);
            Utils.asyncForEach(folders, function(a, i, next) {
                if (stubs[a].stub.css('display') == 'none') next();
                else statusFiles(prov, stubs[a], next);
            }, next);
        }
    }
    GitCommands.statusAll = function(ev, prov) {
        statusFiles(prov, ev.browser, success);
    };
    GitCommands.status = function(ev, prov) {
        var r = [ev.filepath];
        var stub = ev.browser;
        if (ev.marked) {
            r = ev.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Utils.asyncForEach(r, function(p, i, next, cancel) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var end = function(status) {
                if (!isDirectory(p) && stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    updateView(view)(status);
                    next();
                } else cancel(true);
            };
            prov.status(a).then(end, next);
        }, function(e) {
            if (!e) success();
        }, 15, false, true);
    };
    /*Status*/
    var unmodifiedCache;
    
    /**@constructor*/
    function JSONIndex(fs, gitdir, commit) {
        this.entries = Object.create(null);
        this.fs = fs;
        this.gitdir = gitdir;
        this.commit = commit;
        this.clean = true; //has pending changes
    }
    JSONIndex.prototype.set = function(filename) {
        if (!this.entries[filename]) {
            this.clean = false;
            this.entries[filename] = true;
        }
    };
    JSONIndex.prototype.get = function(filename) {
        return this.entries[filename];
    };
    JSONIndex.prototype.remove = function(filename) {
        if (this.entries[filename]) {
            this.clean = false;
            delete this.entries[filename];
        }
    };
    JSONIndex.from = function(str, fs, dir) {
        var t = new JSONIndex(fs, dir);
        try {
            var l = JSON.parse(str);
            Object.assign(t, l);
            return t;
        } catch (e) {}
        return null;
    };
    JSONIndex.prototype.toString = function() {
        var start = ["{"];
        //start.push('\n  "commit":"' + this.commit + '"')
        start.push('\n  "entries":{');
        for (var t in this.entries) start.push('\n    "' + t + '":' + JSON.stringify(this.entries[t]), ",");
        start.pop();
        if (start.length > 1) {
            start.push("\n  }");
        }
        start.push("\n}");
        return start.join("");
    };
    //had to come up with something faster than statusMatrix
    /*The steps for status from bottom to top
    //1 Compare shasums
    //2 To get shasum, you must parse index, parse a tree, get file shasum
    //3 To get file shasum, you must stat the file to check if it has changed, if it has, readFile and then compute or use fastGetOid
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
    //A final solution might be to just put a preference for statusCache
    //files, but that will be pending when we can cache stats
    //as the result will be two stat calls
    //or to check the index for actual difference in stats
    //but for now, it works so I'm cool
    */
    function cleanCachedStatus(gitdir, fs) {
        if (!appConfig.gitUseCachedStatus) return;
        if (unmodifiedCache && (unmodifiedCache.fs != fs || unmodifiedCache.gitdir != gitdir)) {
            saveStatusCache();
            unmodifiedCache = null;
        }
    }

    function splitStatus(gitdir, batchSize, fs, files, sendBatch, progress) {
        if (batchSize > files.length) {
            return sendBatch(files.slice(0), true);
        }
        cleanCachedStatus(gitdir, fs);
        if (!unmodifiedCache) {
            GitCommands.readFile("status", {
                gitdir: gitdir,
                fs: fs
            }, function(err, s) {
                if (s && (unmodifiedCache = JSONIndex.from(s, fs, gitdir))) {
                    genList();
                } else {
                    sendBatch(files.slice(0), true);
                    progress(100);
                }
            });
        } else genList();

        function genList() {
            var baseProgress;
            //send the likely changed files first
            var newlist = [];
            var modified = [];
            files.forEach(function(name) {
                (unmodifiedCache.get(name) ? newlist : modified).push(name);
            });
            baseProgress = modified.length;
            sendBatch(modified, false);
            progress(100 * baseProgress / files.length);
            sendBatch(newlist, true);
            progress(100);
        }
    }

    function saveStatusCache() {
        if (unmodifiedCache && !unmodifiedCache.clean) {
            var a = unmodifiedCache.toString();
            GitCommands.writeFile("status", a, unmodifiedCache, Utils.noop, );
            unmodifiedCache.clean = true;
        }
    }

    function pushUnmodified(gitdir, fs, name /*, commit*/ ) {
        cleanCachedStatus(gitdir, fs);
        if (!unmodifiedCache /*|| statusCache.commit != commit*/ ) {
            unmodifiedCache = new JSONIndex(fs, gitdir);
        }
        unmodifiedCache.set(name);
    }

    function removeUnmodified(gitdir, fs, name /*, commit*/ ) {
        cleanCachedStatus(gitdir, fs);
        if (!unmodifiedCache /*|| statusCache.commit != commit*/ ) {
            unmodifiedCache = new JSONIndex(fs, gitdir);
        }
        unmodifiedCache.remove(name);
    }

    function getUntracked(rootDir, curDir, fs, tracked, onBatch, onDone, asFiles) {
        curDir = normalize(curDir);
        if (!isDirectory(curDir)) curDir = curDir + "/";
        fs.getFiles(curDir, function(e, l) {
            if (e) return onDone(e);
            var folders = l.filter(isDirectory);
            var untracked = l.filter(function(e) {
                return !isDirectory(e);
            }).map(function(file) {
                return relative(rootDir, curDir + file);
            });
            if (tracked.length) {
                untracked = untracked.filter(function(y) {
                    return tracked.indexOf(y) < 0;
                });
                //splice out y, nah, If the list is long enough for it to matter,
                //splicing would be stupid slow
            }
            var toCheck;
            if (asFiles) toCheck = folders;
            else {
                toCheck = [];
                folders.forEach(function(e) {
                    var a = relative(rootDir, curDir + e);
                    //find if any tracked files are in this folder
                    for (var i = 0; i < tracked.length; i++) {
                        if (tracked[i].startsWith(a) && tracked[i] != a) {
                            toCheck.push(e);
                            return;
                        }
                    }
                    untracked.push(a);
                });
            }
            if (onBatch(untracked) !== false) {
                Utils.asyncForEach(toCheck, function(folder, i, next) {
                    getUntracked(rootDir, join(curDir, folder), fs, tracked, function(tracked) {
                        return onBatch(tracked);
                    }, next, asFiles);
                }, onDone);
            }
        });
    }

    function changeStatus(prov, status, staged, opts, cb, fail) {
        var method;
        if (staged) {
            if (status == "added") {
                method = 'remove';
            } else method = 'resetIndex';
        } else {
            /*status absent actually means the file does not exist anywhere so removing it is unnecessary*/
            if (status == "deletedmodified" || status == "deleted" || status == "absent") {
                method = "remove";
            } else method = 'add';
        }
        prov[method](opts).then(cb, fail);
    }
    //WARNING, modifies the list passed to it
    function batchStatus(prov, paths, onEach, cb) {
        var opts = {
            onEach: onEach
        };
        var batchSize = prov.batchSize || 100;
        (function go() {
            if (paths.length === 0) return cb();
            opts.filepaths = paths.splice(0, batchSize);
            prov.statusAll(opts).finally(go);
        })();
    }
    
    /**@constructor*/
    function StageModal(prov) {
        this.signal = new Utils.AbortSignal();
        this.prov = prov;
        var modal = this.modal = $(Notify.modal({
            header: 'Git Status',
            large: true,
            body: ["<span class='progress' ><span class='determinate'></span></span>",
                "<h6 class='stage-group-header'>Staged<button id='removeAllButton' class='btn btn-flat right'>Remove all</button></h6>",
                "<ul class='part group-staged fileview'></ul>",
                "<h6 class='stage-group-header'>Unstaged<button id='addAllButton' class='btn btn-flat right'>Add all</button></h6>",
                "<ul class='part group-unstaged fileview'></ul>",
                "<h6 class='stage-group-header'>Untracked</h6>",
                "<ul class='part group-untracked fileview'></ul>"
            ].join(""),
            footers: ['Commit']
        }, this.signal.abort));
        modal.addClass('modal-large');
        this.safe = this.signal.control.bind(this.signal);
        this.signal.notify(this.onDismiss.bind(this));
        this.updateName = this.safe(this.updateName.bind(this));
        this.addUntracked = this.safe(this.addUntracked.bind(this));
        this.addName = this.safe(this.addName.bind(this));
        this.finish = this.safe(this.finish.bind(this));
        this.percent = this.safe(this.percent.bind(this));
        modal.on('click', '.git-item', this.handleClick.bind(this));
        modal.find('button').on('click', this.handleButtonClick.bind(this));
    }
    (function() {
        this.finish = function() {
            this.modal.find('.progress').addClass('progress-finished');
            this.percent(100);
        };
        this.percent = function(pos) {
            pos = 100 - Math.ceil((100 - pos) * (100 - pos) / 100);
            this.modal.find('.progress').children().css('width', pos + "%");
        };
        this.onDismiss = function() {
            saveStatusCache();
            this.modal.off('click', '.git-item');
            this.modal.find('button').off('click');
            this.modal = null;
        };
        this.handleButtonClick = function(e) {
            var els, staged;
            var self = this;
            switch (e.target.id) {
                case 'addAllButton':
                    els = this.modal.find('.group-unstaged').children();
                    break;
                case 'removeAllButton':
                    els = this.modal.find('.group-staged').children();
                    staged = true;
                    break;
                default:
                    if (e.target.className.indexOf("modal-commit") > -1) {
                        GitCommands.doCommit(null, self.prov);
                        self.modal.modal('close');
                    }
                    return;
            }
            var files = Array.prototype.map.apply(els, [function(a) {
                return [a.getAttribute('data-status'), a.getAttribute('data-file')];
            }]);
            els.remove();
            if (files.length) Notify.ask((staged ? 'Unstage all files?' : 'Stage all files?'),
                function() {
                    var prov = self.prov;
                    Utils.asyncForEach(files, function(e, i, n) {
                        n = self.signal.control(n);

                        function next() {
                            self.updateName(e[1], els[i]);
                            n();
                        }
                        changeStatus(self.prov, e[0], staged, {
                            filepath: e[1],
                        }, next, next);
                    }, success, (files.length > prov.batchSize ? prov.batchSize / 5 : prov
                        .batchSize));
                });
        };
        this.handleClick = function(e) {
            var a = e.target;
            var name = a.getAttribute('data-file');
            var prov = this.prov;
            var self = this;
            if (isDirectory(name)) {
                var list;

                var addAll = function() {
                    var sample = list.slice(0, 20).join(' ,');
                    Notify.ask('Add all files in ' + name + "?\n   " + (sample.length > 100 ? sample
                        .substring(0, 100) + '....' :
                        sample) + "(" + list.length + " files)", function() {
                        $(a).detach();
                        Utils.asyncForEach(list, function(item, i, next, cancel) {
                            next = self.signal.control(next, cancel);
                            prov.add({
                                filepath: item
                            }).then(function() {
                                self.updateName(item);
                                next();
                            }, function(e) {
                                Notify.error('Failed to add ' + item);
                                cancel(e);
                            });
                        }, function(e) {
                            if (e && e != true) failure(e);
                            else {
                                success();
                            }
                        }, (list.length > prov.batchSize ? prov.batchSize / 5 : prov
                            .batchSize), false, true);
                    });
                };
                if (self.folded) { //we used statusAll
                    list = self.folded[name];
                    addAll();
                } else {
                    list = [];
                    getUntracked(prov.dir, join(prov.dir, name), prov.fs, [], function(names) {
                        list.push.apply(list, names);
                    }, addAll, true);
                }
            } else {
                var staged = $(e.target).closest('ul').hasClass('group-staged');
                var s = a.getAttribute('data-status');
                Notify.ask((staged ? 'Unstage file ' : 'Stage file (') + name + ':' + s + ')',
                    function() {
                        changeStatus(prov, s, staged, {
                            filepath: name
                        }, function() {
                            self.updateName(name, e.target);
                        }, failure);
                    });
            }
        };
        this.updateName = function(name, a) {
            var self = this;
            this.prov.status({
                filepath: name
            }).then(function(s) {
                if (s == "absent") this.addUntracked(name);
                else self.addName(name, s);
            }, function(e) {
                console.error(e);
            });
            if (a) $(a).detach();
        };
        this.addName = function(name, status) {
            var prov = this.prov;
            if (status == 'unmodified') {
                pushUnmodified(prov.gitdir, prov.fs, name, this.currentRef);
                return;
            } else removeUnmodified(prov.gitdir, prov.fs, name, this.currentRef);
            var staged = true;
            if (!status || status[0] == "*") {
                status = status.substring(1);
                staged = false;
            }
            var el = this.modal.find(staged ? '.group-staged' : '.group-unstaged').append(
                "<li class='git-item git-" + status + "' data-status='" + status + "' >" +
                Utils.htmlEncode(name) + "  :" +
                status + "</li>").children().last();
            el.attr('data-file', name);
        };
        this.addUntracked = function(name) {
            var el = this.modal.find('.group-untracked').append("<li class='git-item git-" +
                status + "'>" + Utils.htmlEncode(name) + "  :" +
                'untracked' + "</li>").children().last();
            el.attr('data-file', name);
        };
        this.collate = function(dirs, names) {
            var self = this;
            var folded = self.folded;
            names.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            }).forEach(function(item) {
                var name = item.name;
                switch (item.status) {
                    case 'ignored':
                        return;
                    case '*added':
                        if (dirs.some(function(e) {
                                if (name.startsWith(e)) return folded[e].push(name);
                            })) {
                            return;
                        }
                        return self.addUntracked(name);
                    default:
                        self.addName(name, item.status);
                }
            });
            self.percent(100);
            self.modal.find('.indeterminate').attr('class', 'determinate');
            self.finish();
        };
        this.statusAll = function() {
            var self = this;
            self.modal.find('.determinate').attr('class', 'indeterminate');
            //all results
            var names = [];
            //track folders that have tracked files
            var opened = {};
            //map folded folders to contained files save us a walk
            self.prov.statusAll({
                onEach: function(name, status) {
                    for (var i = name.length;
                        (i = name.lastIndexOf("/", i - 1)) > 0;) {
                        var folder = name.substring(0, i + 1);
                        if (opened[folder] || (opened[folder] = (status !== "*added")))
                            break;
                    }
                    names.push({
                        name: name,
                        status: status
                    });
                }
            }).then(self.safe(function() {
                //filter
                var dirs = Object.keys(opened).filter(function(i) {
                    return !opened[i];
                }).sort();
                var folded = self.folded = [];
                if (dirs.length > 0) {
                    var i = 0;
                    dirs = dirs.reduce(function(e, o) {
                        if (!o.startsWith(e[i])) {
                            e[++i] = o;
                            self.addUntracked(o);
                            folded[o] = [];
                        }
                        return e;
                    }, []); //TADA
                }
                //condense
                self.collate(dirs, names);
            }));
        };
        this.statusList = function(list) {
            // prov.resolveRef({
            //     ref: 'HEAD'
            // }).then(function(commit) {
            //     self.currentRef = commit;
            var percentMultiplier = 0;
            var self = this;
            var toCheck, //the reduced set of list to update
                prov = self.prov;
            //get untracked files quickly,
            //does not use ignore for now
            var total = 0,
                progress = 0;
            var each = self.safe(function(name, status) {
                self.percent(Math.floor(++progress / total * percentMultiplier));
                self.addName(name, status);
                return true;
            }, false);

            function loadUntracked() {
                if (appConfig.gitSkipGitIgnore) {
                    var skipRe = FileUtils.globToRegex(appConfig.gitIgnore);
                    return getUntracked(prov.dir, prov.dir + "/", prov.fs, list, self.safe(function(
                        names) {
                        names.filter(function(e) {
                            return !(skipRe.test(e) || skipRe.test(basename(e)));
                        }).forEach(self.addUntracked, self);
                    }, false), self.finish, false);
                }
                var all = [];
                self.modal.find('.determinate').attr('class', 'indeterminate');
                //todo - perhaps add cache or allow user to
                getUntracked(prov.dir, prov.dir + "/", prov.fs, list, self.safe(function(names) {
                    names.forEach(function(e) {
                        all.push(e);
                    });
                    return true;
                }, false), self.safe(function() {
                    var folded = self.folded = {};
                    var dirs = all.filter(isDirectory);
                    //TODO create a method filterIgnored
                    //get the status for the file
                    //if there is a status ie not ignored
                    //check if there is a parent folder
                    self.prov.statusAll({
                        filepaths: all,
                        onEach: function(name /*, status*/ ) {
                            if (!dirs.some(function(e) {
                                    if (name.startsWith(e)) {
                                        if (!folded[e]) {
                                            self.addUntracked(e);
                                            folded[e] = [];
                                        }
                                        folded[e].push(name);
                                        return true;
                                    }
                                })) {
                                self.addUntracked(name);
                            }
                        }
                    }).finally(function() {
                        self.modal.find('.indeterminate').attr('class',
                            'determinate');
                        self.finish();
                    });
                }));
            }
            var notifyQueue;
            splitStatus(prov.gitdir, prov.batchSize, prov.fs, list, function(dirty, finished) {
                if (notifyQueue) {
                    toCheck.push(dirty);
                    total += dirty.length;
                    return notifyQueue(finished);
                }
                toCheck = [dirty];
                total = dirty.length;
                var current = dirty;
                var cancel = function() {
                    current.length = 0;
                };
                self.signal.notify(cancel);
                notifyQueue = Utils.asyncForEach(toCheck, function(e, i, next) {
                    current = e;
                    batchStatus(prov, e, each, self.safe(next));
                }, loadUntracked, null, !finished);
            }, function(t, c, n) {
                percentMultiplier = t;
                if (toCheck.length < 1) self.percent(percentMultiplier);
                self.safe(n || Utils.noop, c)();
            });
        };
    }).call(StageModal.prototype);
    GitCommands.showStage = function(ev, prov) {
        var stage = new StageModal(prov);
        //todo use batches
        prov.listFiles().then(function(list) {
            if (appConfig.gitSkipGitIgnore || prov.batchSize < list.length) {
                prov.listFiles({
                    ref: 'HEAD'
                }).then(function(headList) {
                    mergeList(list, headList);
                    stage.statusList(list);
                }, function() {
                    //new repos throw error
                    stage.statusList(list);
                });
            } else stage.statusAll();
        }, failure);
    };
}); /*_EndDefine*/