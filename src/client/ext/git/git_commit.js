//Git Commands Commit
define(function (require, exports, module) {
    var Notify = require("grace/ui/notify").Notify;
    var appConfig = require("grace/core/config").Config.registerAll({}, "git");
    var GitUtils = require("./git_utils").GitUtils;
    var configure = require("grace/core/config").Config.configure;
    var failure = GitUtils.failure;
    var success = GitUtils.success;
    var createProgress = GitUtils.createProgress;
    var padStart = GitUtils.padStart;
    var join = require("grace/core/file_utils").FileUtils.join;
    var forEach = require("grace/core/utils").Utils.asyncForEach;
    var relative = require("grace/core/file_utils").FileUtils.relative;

    function getRepoMergeState(prov, cb) {
        prov.fs.readFile(
            join(prov.gitdir, "MERGE_HEAD"),
            "utf8",
            function (e, mergeHead) {
                if (e && e.code == "ENOENT") {
                    cb(null, false);
                } else if (e) {
                    cb(e);
                } else {
                    prov.fs.readFile(
                        join(prov.gitdir, "MERGE_MSG"),
                        "utf8",
                        function (e, res) {
                            cb(null, {
                                msg: res || "",
                                head: mergeHead,
                            });
                        }
                    );
                }
            }
        );
    }

    function clearRepoMergeState(prov, cb) {
        forEach(
            ["MERGE_HEAD", "MERGE_MSG", "MERGE_MODE"],
            function (file, i, next, stop) {
                prov.fs.unlink(join(prov.gitdir, file), function (e) {
                    if (e && e.code != "ENOENT") stop(e);
                    else next();
                });
            },
            cb,
            1,
            0,
            true
        );
    }

    exports.doCommit = function (ev, prov) {
        var commit = function (ans) {
            if (ans == "") return false;
            else if (!ans) return;
            prov.commit({
                author: {
                    name: appConfig.gitUsername,
                    email: appConfig.gitEmail || "no-email",
                },
                message: ans,
            }).then(
                function () {
                    Notify.info("Commit Successful");
                    if (hasPending) {
                        clearRepoMergeState(prov);
                    }
                },
                function (e) {
                    if ((e + "").indexOf("No name was provided") > -1) {
                        Notify.prompt("Enter Author name", function (name) {
                            if (name) {
                                configure("gitUsername", name, "git", true);
                                commit(ans);
                            }
                        });
                    } else failure(e);
                }
            );
        };
        var hasPending = false;
        getRepoMergeState(prov, function (err, merge) {
            hasPending = true;
            var defText = merge
                ? merge.msg || "Merge " + merge.head + " into HEAD"
                : "";
            Notify.prompt("Enter Commit Message", commit, defText);
        });
    };
    //force checkout
    exports.revertChanges = function (ev, prov) {
        doRevert(ev, prov, null);
    };
    exports.promptCommit = function (prov, message, cb) {
        var values = [
            {
                caption: "HEAD",
                value: "HEAD",
            },
        ];
        prov.log().then(function (commits) {
            commits.forEach(function (e) {
                values.push({
                    caption: "commit: " + e.commit.message.replace(/\s+/g, " "),
                    value: e.oid,
                });
            });
            commits.forEach(function (e) {
                values.push({
                    caption: e.oid,
                    value: e.oid,
                    sortIndex: 10000,
                });
            });
        });
        prov.listBranches().then(function (branches) {
            branches.forEach(function (e) {
                values.push({
                    caption: "branch: " + e,
                    value: e,
                });
            });
        });
        Notify.prompt(
            message,
            function (val) {
                if (!val || val === undefined) return;
                var ref = val;
                values.reverse().some(function (e) {
                    if (e.caption == val) {
                        ref = e.value;
                    }
                });
                if (cb) return cb(ref);
            },
            null,
            {
                complete: function (text) {
                    text = text.toLowerCase();
                    return values.filter(function (e) {
                        return e.caption.toLowerCase().indexOf(text) > -1;
                    });
                },
                update: function (input, e) {
                    return (input.value = e.value);
                },
            }
        );
    };

    exports.checkoutRef = function (ev, prov) {
        exports.promptCommit(prov, "Enter ref to checkout", function (ref) {
            doRevert(ev, prov, ref);
        });
    };

    function doRevert(ev, prov, ref) {
        var progress = createProgress("Analyzing directory");
        var filepaths = ev.marked
            ? ev.marked
            : ev.filepath
            ? [ev.filepath]
            : undefined;
        if (filepaths) filepaths = filepaths.map(relative.bind(null, prov.dir));
        var opts = {
            onProgress: progress.update,
            force: true,
            ref: ref,
            filepaths: filepaths,
        };
        prov.analyze(opts).then(function (ops) {
            progress.dismiss();
            if (ops.length == 0) {
                return Notify.info("Workspace already checked out");
            }
            var safeString = padStart(
                "" + Math.floor(Math.random() * 999999) + "",
                6,
                "0"
            );
            Notify.prompt(
                "About to checkout " +
                    ref +
                    ".\n Changes to be made: \n" +
                    ops
                        .map(function (e) {
                            return e[0] + " " + e[1] + "\n";
                        })
                        .join("") +
                    " To confirm operation, type '" +
                    safeString +
                    "'",
                function (ans) {
                    if (ans == safeString) {
                        progress = createProgress("Checking out...");
                        prov.checkout({
                            onProgress: progress.update,
                            filepaths: ops.map(function (e) {
                                return e[1];
                            }),
                            ref: ref,
                            force: true,
                            noUpdateHead: true,
                        }).then(function () {
                            ev.fileview.reload();
                            progress.dismiss();
                            success();
                        }, progress.error);
                    } else if (ans) {
                        return false;
                    }
                }
            );
        }, progress.error);
    }
});
