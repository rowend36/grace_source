/* jshint esversion: 6, esnext:false*/
//Git utilities
_Define(function(global) {
    var Utils = global.Utils;
    var GitCommands = global.GitCommands = Object.create(null);
    var Notify = global.Notify;
    const padStart = typeof String.prototype.padStart === 'undefined' ? function(str, len, pad) {
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
//Git Commands Stage
_Define(function(global) {
    var Notify = global.Notify;
    var appConfig = global.registerAll({}, "git");
    var clean = global.FileUtils.removeTrailingSlash;
    var GitCommands = (global.GitCommands || (global.GitCommands = Object.create(null)));
    var Utils = global.Utils;
    var FileUtils = global.FileUtils;
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
            if (status == "unmodified" || status == "ignored") {
                text = "<span class= 'status'>" + status + "</span>";
            } else {
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
    GitCommands.add = function(ev, prov) {
        var r = [ev.filepath];
        var stub = ev.browser;
        if (stub.marked) {
            prov = prov.cached();
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var end = function() {
                if (stub.rootDir == ev.rootDir) {
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
        if (stub.marked) {
            prov = prov.cached();
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        r.forEach(function(p) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var s = prov.status(a).then(function() {
                var end = function() {
                    if (stub.rootDir == ev.rootDir) {
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
        var stub = ev.browser;
        var reload = Utils.delay(function() {
            ev.browser.reload();
        }, 200);
        if (stub.marked) {
            prov = prov.cached();
            r = stub.marked.map(function(t) {
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
        prov = prov.cached();
        var r = stub.hier.slice(stub.pageStart, stub.pageEnd).map(function(t) {
            return stub.rootDir + t;
        });
        var startRootDir = stub.rootDir;
        var all = r.filter(function(e) {
            return !FileUtils.isDirectory(e);
        }).map(function(p) {
            return relative(prov.dir, p)
        });
        batchStatus(prov, all, function(p, status) {
            if (stub.rootDir == startRootDir) {
                var view = stub.getElement(stub.filename(join(prov.dir, p)));
                updateView(view)(status);
            } else all.length = 0;
        }, nested);

        function nested(e) {
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
    }
    GitCommands.status = function(ev, prov) {
        var r = [ev.filepath];
        var stub = ev.browser;
        if (stub.marked) {
            prov = prov.cached();
            r = stub.marked.map(function(t) {
                return ev.rootDir + t;
            });
        }
        Utils.asyncForEach(r, function(p, i, next, cancel) {
            var a = {
                filepath: clean(relative(prov.dir, p)),
            };
            var end = function(status) {
                if (stub.rootDir == ev.rootDir) {
                    var view = ev.browser.getElement(ev.browser.filename(p));
                    updateView(view)(status);
                    next();
                } else cancel(true);
            };
            prov.status(a).then(end, next);
        }, function(e) {
            if (!e) success();
        }, 15, false, true);
    }
    /*Status*/
    var statusCache;

    function JSONIndex(fs, dir, commit) {
        this.entries = Object.create(null);
        this.fs = fs;
        this.dir = dir;
        this.commit = commit;
        this.clean = true; //has pending changes
    }
    JSONIndex.prototype.set = function(filename, data) {
        this.clean = false;
        this.entries[filename] = true;
    }
    JSONIndex.prototype.get = function(filename) {
        return this.entries[filename];
    }
    JSONIndex.prototype.remove = function(filename) {
        delete this.entries[filename];
    }
    JSONIndex.from = function(str, fs, dir) {
        var t = new JSONIndex(fs, dir);
        try {
            var l = JSON.parse(str);
            Object.assign(t, l);
            return t;
        } catch (e) {}
        return null;
    }
    JSONIndex.prototype.toString = function() {
        var start = ["{"];
        //start.push('\n  "commit":"' + this.commit + '"')
        start.push('\n  "entries":{')
        for (var t in this.entries) start.push('\n    "' + t + '":' + JSON.stringify(this.entries[t]), ",")
        start.pop()
        if (start.length > 1) {
            start.push("\n  }")
        }
        start.push("\n}")
        return start.join("");
    }
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
    function cleanCachedStatus(dir, fs) {
        if (!appConfig.gitUseCachedStatus) return;
        if (statusCache && (statusCache.fs != fs || statusCache.dir != dir)) {
            saveStatusCache();
            statusCache = null;
        }
    }

    function splitStatus(dir, batchSize, fs, files, sendBatch, progress) {
        if (batchSize > files.length) {
            return sendBatch(files.slice(0), true);
        }
        cleanCachedStatus(dir, fs);
        if (!statusCache) {
            FileUtils.getConfig(appConfig.gitdir + "-status", function(s, e) {
                if (s && (statusCache = JSONIndex.from(s, fs, dir))) {
                    genList();
                } else {
                    sendBatch(files.slice(0), true);
                    progress(100);
                }
            }, {
                rootDir: dir,
                fileServer: fs
            });
        } else genList();

        function genList() {
            var baseProgress;
            //send the changed files first
            var newlist = [];
            var modified = [];
            files.forEach(function(name) {
                (statusCache.get(name) ? newlist : modified).push(name);
            });
            baseProgress = modified.length;
            sendBatch(modified, false);
            modified = null;
            progress(100 * baseProgress / files.length);
            sendBatch(newlist, true);
            progress(100);
        }
    }

    function saveStatusCache() {
        if (statusCache && !statusCache.clean) {
            var a = statusCache.toString()
            FileUtils.saveConfig(appConfig.gitdir + "-status", a, Utils.noop, {
                rootDir: statusCache.dir,
                fileServer: statusCache.fs
            });
            statusCache.clean = true;
        }
    }

    function pushUnmodified(dir, fs, name, commit) {
        cleanCachedStatus(dir, fs);
        if (!statusCache /*|| statusCache.commit != commit*/ ) {
            statusCache = new JSONIndex(fs, dir);
        }
        statusCache.set(name);
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
            if (status == "deleted" || status == "absent") {
                method = "remove";
            } else method = 'add';
        }
        prov[method](opts).then(cb, fail);
    }
    //WARNING, modufies the list passed to it
    function batchStatus(prov, paths, onEach, cb) {
        // prov.resolveRef({
        //     ref: 'HEAD'
        // }).then(function(commit) {
        //     self.currentRef = commit;
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

    function StageModal(prov) {
        this.signal = new Utils.AbortSignal();
        this.prov = prov;
        var modal = this.modal = $(Notify.modal({
            header: 'Git Status',
            body: ["<span class='progress' ><span class='determinate'></span></span>",
                "<h6 class='stage-group-header'>Staged<button id='removeAllButton' class='btn btn-flat right'>Remove all</button></h6>",
                "<ul class='group-staged fileview'></ul>",
                "<h6 class='stage-group-header'>Unstaged<button id='addAllButton' class='btn btn-flat right'>Add all</button></h6>",
                "<ul class='group-unstaged fileview'></ul>", "<h6 class='stage-group-header'>Untracked</h6>",
                "<ul class='group-untracked fileview'></ul>"
            ].join(""),
        }, this.signal.abort));
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
        this.finish = function(text) {
            this.modal.find('.progress').addClass('progress-finished');
            this.percent(100);
        }
        this.percent = function(pos) {
            pos = 100 - Math.ceil((100 - pos) * (100 - pos) / 100);
            this.modal.find('.progress').children().css('width', pos + "%");
        }
        this.onDismiss = function() {
            saveStatusCache();
            this.modal.off('click', '.git-item');
            this.modal.find('button').off('click');
            this.modal = null;
        }
        this.handleButtonClick = function(e) {
            var els, staged;
            var self = this;
            switch (e.target.id) {
                case 'addAllButton':
                    //TODO search in modal not document
                    els = $('.group-unstaged').children();
                    break;
                case 'removeAllButton':
                    els = $('.group-staged').children();
                    staged = true;
                    break;
                default:
                    return;
            }
            var files = Array.prototype.map.apply(els, [function(a) {
                return [a.getAttribute('data-status'), a.innerText.substring(0, a.innerText.lastIndexOf(":") - 1)];
            }]);
            if (files.length) Notify.ask((staged ? 'Unstage all files?' : 'Stage all files?'), function() {
                Utils.asyncForEach(files, function(e, i, n) {
                    n = self.signal.control(n);
                    changeStatus(self.prov, e[0], staged, {
                        filepath: e[1],
                    }, function() {
                        self.updateName(e[1], els[i]);
                        n();
                    }, n);
                }, success, files.length > 100 ? 4 : 10);
            });
        }
        this.handleClick = function(e) {
            var a = e.target;
            var name = a.innerText.substring(0, a.innerText.lastIndexOf(":") - 1);
            var prov = this.prov;
            var self = this;
            if (isDirectory(name)) {
                var list;

                function addAll() {
                    var sample = list.slice(0, 20).join(' ,');
                    Notify.ask('Add all files in ' + name + "?\n   " + (sample.length > 100 ? sample.substring(0, 100) + '....' :
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
                        }, (list.length > 100 ? 4 : 10), false, true);
                    });
                }
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
                Notify.ask((staged ? 'Unstage file ' : 'Stage file (') + name + ':' + s + ')', function() {
                    changeStatus(prov, s, staged, {
                        filepath: name
                    }, function() {
                        self.updateName(name, e.target);
                    }, failure);
                });
            }
        }
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
        }
        this.addName = function(name, status) {
            if (status == 'unmodified') {
                var prov = this.prov;
                pushUnmodified(prov.dir, prov.fs, name, this.currentRef);
                return;
            }
            var staged = true;
            if (!status || status[0] == "*") {
                status = status.substring(1);
                staged = false;
            }
            var el = "<li class='file-item git-item git-" + status + "' data-status='" + status + "' >" + name + "  :" +
                status + "</li>";
            this.modal.find(staged ? '.group-staged' : '.group-unstaged').append(el);
        };
        this.addUntracked = function(name) {
            var el = "<li class='file-item git-item git-untracked' >" + name + "  :untracked</li>";
            this.modal.find('.group-untracked').append(el);
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
                            return
                        }
                        return self.addUntracked(name);
                    default:
                        self.addName(name, item.status);
                }
            });
            self.percent(100);
            self.modal.find('.indeterminate').attr('class', 'determinate');
            self.finish();
        }
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
                        if (opened[folder] || (opened[folder] = (status !== "*added"))) break;
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
                    }, new Array()) //TADA
                }
                //condense
                self.collate(dirs, names);
            }));
        }
        this.statusList = function(list) {
            var percentMultiplier = 0;
            var self = this;
            var toCheck //the reduced set of list to update
                , prov = self.prov;
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
                    var skipRe = FileUtils.globToRegex(appConfig.gitIgnore.join(","));
                    return getUntracked(prov.dir, prov.dir + "/", prov.fs, list, self.safe(function(names) {
                        names.filter(function(e) {
                            return !(skipRe.test(e) || skipRe.test(basename(e)))
                        }).forEach(self.addUntracked, self);
                    }, false), self.finish, false);
                }
                var all = [];
                //this needs caching, but thats the users fault
                self.modal.find('.determinate').attr('class', 'indeterminate');
                getUntracked(prov.dir, prov.dir + "/", prov.fs, list, self.safe(function(names) {
                    names.forEach(function(e) {
                        all.push(e)
                    });
                    return true;
                }, false), self.safe(function() {
                    var folded = self.folded = {};
                    var dirs = all.filter(isDirectory);
                    //TODO the correct method is filter ignored
                    self.prov.statusAll({
                        filepaths: all,
                        onEach: function(name, status) {
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
                                self.addUntracked(name)
                            }
                        }
                    }).finally(function() {
                        self.modal.find('.indeterminate').attr('class', 'determinate');
                        self.finish();
                    });
                }));
            }
            var notifyQueue;
            splitStatus(prov.dir, prov.batchSize, prov.fs, list, function(dirty, finished) {
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
                }
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
        prov = prov.cached();
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
    }
}); /*_EndDefine*/
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
    }
    GitCommands.switchBranchNoCheckout = function(ev, prov) {
        pickBranch(prov, function(item) {
            if (item == branchList.current) {
                return;
            }
            gotoRef(prov, item, true);
            branchList.$el.modal('close');
        });
    }
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
    }
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
                    return prov.branch({
                        ref: ref,
                    }).then(success, failure);
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
    }
}); /*_EndDefine*/
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

    function MergeDoc(content, path, mode, id) {
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
    //get the conflict item corresponding to this merge
    MergeDoc.prototype.getItem = function() {
        var path = global.getActiveDoc().getPath().substring(this.mergeTree.href.length);
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
    var testPlain = GitCommands.testPlain;
    var testUrl = GitCommands.testUrl;
    var success = GitCommands.success;
    var failure = GitCommands.failure;
    var createProgress = GitCommands.createProgress;
    var padStart = GitCommands.padStart;
    var appConfig = global.allConfigs.git;
    var configure = global.configure;
    var Docs = global.Docs;
    var docs = global.docs;
    var addDoc = global.addDoc;
    var MergeDoc = global.MergeDoc;
    var filename = global.FileUtils.filename;
    var checkBox = global.styleCheckbox;
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
    }
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
    }

    function previewTree(opts, prov) {
        //preview the current results of the merge
        var ourHref = opts.href;

        function gatherConflicts(t) {
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

        function createChangeListItem(item, i) {
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

            function finish() {
                progress.dismiss();
                success();
            }
            if (!fastForwardOnly) {
                prov.merge(opts).then(function(tree) {
                    progress.dismiss();
                    if (tree.alreadyMerged) {
                        Notify.info('Branches are already merged');
                    } else if (tree.fastForward) {
                        Notify.info('Fast Forward merge successful');
                    } else {
                        if (interactive) {
                            el.modal('close');
                        }
                        tree.href = "git-merge:/" + tree.ourOid.substring(0, 5) + "." + tree.theirOid.substring(0, 5) + "/";
                        tree.dir = prov.dir;
                        for (var id in docs) {
                            if (docs[id].getPath().startsWith(tree.href)) {
                                docs[id].mergeTree = tree;
                                docs[id].prov = prov;
                            }
                        }
                        //todo save merge
                        previewTree(tree, prov);
                    }
                }, progress.error);
            } else {
                prov.merge(opts).then(finish, progress.error);
            }
            if (!interactive) el.modal("close");
        });
    }
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
    }
    GitCommands.doPush = function(ev, prov) {
        GitCommands.doPull(ev, prov, true);
    }
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
        el.find('select').on('change', function(e) {
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
                            for (var id in docs) {
                                if (docs[id].getPath().startsWith(tree.href)) {
                                    docs[id].mergeTree = tree;
                                }
                            }
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
    }

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
    MergeDoc.previewTree = previewTree;
}); /*_EndDefine*/
//Git command log
_Define(function(global) {
    var Notify = global.Notify;
    var GitCommands = global.GitCommands;
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
        });
    }
}); /*_EndDefine*/
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
    var detectRepo = Imports.define(["./core/cachefileserver.js", "./tools/git/libs/inhouse-git.js",
        "./tools/git/libs/isomorphic-http.js", "./tools/git/libs/diff3/diff3.js", "./tools/git/interactive_merge.js",
        "./tools/git/analyze.js", "./tools/git/git_interface.js"
    ], function() {
        return (detectRepo = function(ev, btn, yes, no) {
            var dir = ev.rootDir;
            lastEvent = ev;
            findRoot(dir, ev.browser.fileServer).then(function(path) {
                var fs = lastEvent.browser.fileServer;
                var GitImpl = fs.$gitImpl || global.Git;
                prov = new GitImpl(path || dir, join(path||dir, appConfig.gitdir), fs);
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
            onclick: GitCommands.status
        },
        "stage-file": {
            caption: "Stage File",
            onclick: GitCommands.add
        },
        "unstage-file": {
            caption: "Unstage File",
            onclick: GitCommands.remove
        },
        "delete-from-tree": {
            caption: "Delete and Stage",
            onclick: GitCommands.delete
        }
    };
    var GitMenu = {
        "currentBranch": {
            isHeader: true,
            icon: true,
            close: false,
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
        "branches": {
            icon: "usb",
            caption: "Branches",
            childHier: {
                "create-branch": {
                    icon: "add",
                    caption: "Create Branch",
                    onclick: GitCommands.createBranch
                },
                "switch-branch": {
                    icon: "swap_horiz",
                    caption: "Checkout Branch",
                    onclick: GitCommands.switchBranch
                },
                "switch-branch-nocheckout": {
                    icon: "home",
                    caption: "Set HEAD branch",
                    onclick: GitCommands.switchBranchNoCheckout
                },
                "close-branch": {
                    icon: "delete",
                    caption: "Delete Branch",
                    onclick: GitCommands.deleteBranch
                }
            }
        },
        "do-commit": {
            icon: 'save',
            caption: "Commit",
            onclick: GitCommands.doCommit
        },
        "do-pull": {
            icon: 'vertical_align_bottom',
            caption: "Pull Changes",
            onclick: GitCommands.doPull
        },
        "do-push": {
            icon: 'vertical_align_top',
            caption: "Push Changes",
            onclick: GitCommands.doPush
        },
        "view-stage": {
            icon: 'view_headline',
            caption: "Status",
            onclick: GitCommands.showStage
        },
        "show-status": {
            icon: 'view_headline',
            caption: "Mark Changed Files",
            onclick: GitCommands.statusAll
        },
        "show-logs": {
            icon: 'history',
            caption: "History",
            onclick: GitCommands.log
        },
        "repo-actions": {
            icon: "more_vert",
            caption: "More...",
            sortIndex: 100000,
            childHier: {
                "do-merge": {
                    icon: 'swap_vert',
                    caption: "Merge Branches",
                    onclick: GitCommands.doMerge
                },
                "do-revert": {
                    icon: 'warning',
                    caption: "Reset",
                    className: "git-warning-text",
                    onclick: GitCommands.doRevert
                },
                "remotes": {
                    icon: "cloud",
                    caption: "Remote",
                    childHier: {
                        "add-remote": {
                            icon: "add",
                            caption: "Add Remote",
                            onclick: GitCommands.addRemote
                        },
                        "delete-remote": "Remove Remote"
                    }
                },
                "configure": {
                    caption: "..Authentication",
                    onclick: GitCommands.doConfig
                }
            }
        }
    };
    var NoGitMenu = {
        "init-repo": {
            caption: "Initialize Repository",
            onclick: GitCommands.init
        },
        "clone-repo": {
            caption: "Clone Existing Repository",
            onclick: GitCommands.clone
        }
    };
    var GitFileOverflow = new Overflow();
    var GitOverflow = new Overflow();
    var NoGitOverflow = new Overflow();
    GitFileOverflow.setHierarchy(GitFileMenu);
    GitOverflow.setHierarchy(GitMenu);
    NoGitOverflow.setHierarchy(NoGitMenu);
    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function(e, id, span, data) {
        data.onclick && data.onclick(lastEvent, prov);
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
        })
    }
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
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
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
}); /*_EndDefine*/