var fs = require("fs");
var path = require("path");
var createCounter = require('./counter');
var overwrite = { flags: "w" };
var safewrite = { flags: "wx" };
// var inspect = require("util").inspect;
//overwrite_conf controls overwrite behaviour for multiple folders
//allowing you to fix errors per file in one request
//0 means don't overwrite
//1 means overwrite file or directory but not contents
//2 means overwrite directory and contents
//allowOver means 2 for all subdirectories
//This turns my head

function copyFileInto(
    from,
    to,
    callback,
    allowOver,
    overwrite_conf = {},
    base = "."
) {
    let basename = path.basename(from);
    to = path.join(to, base, basename);
    copyFile(from, to, callback, allowOver, overwrite_conf);
}

function copyFile(from, to, callback, allowOver, overwrite_conf = {}) {
    var r, w;
    try {
        r = fs.createReadStream(from);
    } catch (e) {
        callback(e);
        return;
    }
    var ops = allowOver || overwrite_conf[from] ? overwrite : safewrite;
    try {
        w = fs.createWriteStream(to, ops);
    } catch (e) {
        callback(e);
        return;
    }

    r.pipe(w);
    var done = false;
    let once = function () {
        if (!done) {
            callback.apply(this, arguments);
            done = true;
        }
    };
    r.on("error", function (e) {
        once(e);
        return;
    });
    w.on("error", function (e) {
        once(e);
        return;
    });
    r.on("end", function () {
        callback();
    });
}

function moveFileInto(
    from,
    to,
    callback,
    allowOver,
    overwrite_conf = {},
    base = "."
) {
    let basename = path.basename(from);
    to = path.join(to, base, basename);
    moveFile(from, to, callback, allowOver, overwrite_conf);
}
function moveFile(from, to, callback, allowOver, overwrite_conf = {}) {
    let oldPath = from,
        newPath = to;
    if (!(allowOver || (overwrite_conf && overwrite_conf[oldPath]))) {
        fs.access(newPath, function (e) {
            if (e) {
                moveFile(oldPath, newPath, callback, true);
            } else {
                callback &&
                    callback({ from: oldPath, to: newPath, code: "EEXIST" });
            }
        });
        return;
    }
    fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === "EXDEV") {
                fs.stat(oldPath, function (e, s) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (s.isFile()) {
                        copyFile(
                            oldPath,
                            newPath,
                            function (e) {
                                if (!e) fs.unlink(from, callback);
                                else callback(e);
                            },
                            allowOver,
                            overwrite_conf
                        );
                    } else {
                        copyFolder(
                            oldPath,
                            newPath,
                            function (e) {
                                if (!e) {
                                    deleteFolder(from, callback);
                                } else {
                                    callback(e);
                                }
                            },
                            allowOver,
                            overwrite_conf
                        );
                    }
                });
            } else if (err.code === "ENOTEMPTY") {
                //try to merge directories
                var counter = createCounter(function (e) {
                    if (!e) deleteFolder(from, callback);
                    else callback(e);
                });
                counter.increment(from); //1

                fs.readdir(from, function (e, r) {
                    if (e) {
                        counter.error({ from: from, to: to, code: e.code });
                        return;
                    } else {
                        for (let i in r) {
                            var stat = fs.statSync(from + "/" + r[i]);
                            var p = path.join(from, r[i]);
                            counter.increment(p); //2
                            var callback2 = (function (counter, p, to) {
                                return function (e) {
                                    if (e)
                                        counter.error({
                                            from: p,
                                            to: to,
                                            code: e.code,
                                        });
                                    else counter.decrement(p); //2
                                };
                            })(counter, p, to);
                            if (stat.isDirectory()) {
                                //giving a counter and a callback is confusing
                                //the counter takes precedence for now
                                //ignoring the callback
                                moveFileInto(
                                    p + "/",
                                    to,
                                    callback2,
                                    allowOver || overwrite_conf[from] > 1,
                                    overwrite_conf,
                                    "."
                                );
                            } else if (stat.isFile()) {
                                moveFileInto(
                                    p,
                                    to,
                                    callback2,
                                    allowOver || overwrite_conf[from] > 1,
                                    overwrite_conf,
                                    "."
                                );
                            } else {
                                counter.error({
                                    from: p,
                                    to: to,
                                    code: "unable to handle symbolic link",
                                });
                                continue;
                            }
                        }
                        counter.decrement(from); //1
                    }
                });
            } else {
                //EISDIR - file trying to overwrite folder
                //ENOTDIR - folder trying to overwrite file
                callback(err);
            }
            return;
        }
        /*else*/
        callback();
    });
}
function copyFolderInto(
    from,
    to,
    callback,
    allowOver,
    overwrite_conf = {},
    base = "."
) {
    let basename = path.basename(from);
    let newFolder = path.join(to, base, basename);
    copyFolder(from, newFolder, callback, allowOver, overwrite_conf);
}

function copyFolder(from, to, callback, allowOver, overwrite_conf = {}) {
    var counter = createCounter(callback);
    counter.increment(); //3

    fs.realpath(from, function (e, d) {
        if (e) {
            counter.error({ from: from, to: to, code: e.code });
            return;
        } else {
            fs.realpath(path.dirname(to), function (e, c) {
                if (e) {
                    counter.error({ from: from, to: to, code: e.code });
                    return;
                }
                let pos = path.relative(d, path.join(c, path.basename(to)));
                if (!(pos.startsWith(".." + path.sep) || pos == "..")) {
                    counter.error({
                        from: from,
                        to: to,
                        code: "Cannot copy into subdirectory",
                    });
                    return;
                } else {
                    doCopy();
                }
            });
        }
    });
    var doCopy = function () {
        fs.mkdir(to, function (e) {
            if (e) {
                if (
                    !(e.code == "EEXIST" && (allowOver || overwrite_conf[from]))
                ) {
                    counter.error({ from: from, to: to, code: e.code });
                    return;
                }
            }
            fs.readdir(from, function (e, r) {
                if (e) {
                    counter.error({ from: from, to: to, code: e.code });
                    return;
                } else {
                    for (let i in r) {
                        var stat = fs.statSync(from + "/" + r[i]);
                        var p = path.join(from, r[i]);
                        counter.increment(); //4
                        var callback2 = (function (counter, p, to) {
                            return function (e) {
                                if (e)
                                    counter.error({
                                        from: p,
                                        to: to,
                                        code: e.code,
                                    });
                                else counter.decrement(p); //4
                            };
                        })(counter, p, to);
                        if (stat.isDirectory()) {
                            copyFolderInto(
                                p + "/",
                                to,
                                callback2,
                                allowOver || overwrite_conf[from] > 1,
                                overwrite_conf,
                                "."
                            );
                        } else if (stat.isFile()) {
                            copyFileInto(
                                p,
                                to,
                                callback2,
                                allowOver || overwrite_conf[from] > 1,
                                overwrite_conf,
                                "."
                            );
                        } else {
                            console.log("Unable to handle content" + p);
                            counter.error({
                                from: p,
                                to: to,
                                code: "No symlinks",
                            });
                            continue;
                        }
                    }
                    counter.decrement(from); //3
                }
            });
        });
    };
}
function deleteFolder(p, callback) {
    let counter = createCounter(function (e) {
        if (!e) {
            fs.rmdir(p, callback);
        } else callback(e);
    });
    counter.increment(p); //5
    fs.readdir(p, function (e, l) {
        if (e) {
            callback(e);
            return;
        }
        for (var m in l) {
            let k = path.join(p, l[m]);
            counter.increment(k); //6

            fs.lstat(
                k,
                (function (counter, k, fs, deleteFolder) {
                    return function (e, s) {
                        if (e) {
                            counter.error(e);
                        } else {
                            let callback2 = function (e) {
                                if (e) counter.error(e);
                                else counter.decrement(k); //6
                            };
                            if (s.isDirectory()) deleteFolder(k, callback2);
                            else {
                                fs.unlink(k, callback2);
                            }
                        }
                    };
                })(counter, k, fs, deleteFolder)
            );
        }
        counter.decrement(p); //5
    });
}
exports.deleteFolder = deleteFolder;
exports.copyFile = copyFile;
exports.copyFolder = copyFolder;
exports.moveFile = moveFile;
exports.copyFileInto = copyFileInto;
exports.moveFileInto = moveFileInto;
exports.copyFolderInto = copyFolderInto;

//exports.copyFolder('/sdcard/Alarms/break3','/sdcard/Alarms/break3/pop',console.log,true);