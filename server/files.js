fs = require("fs");
path = require("path");
overwrite = { flags: "w" }
safewrite = { flags: "wx" }
inspect = require('util').inspect
exports.getFiles = function(rootFile, cb) {
    fs.readdir(rootFile, function(e, files) {
        if (e) {
            return cb(e);
        }
        var map = function(file) {
            try{
                if (fs.statSync(rootFile + "/" + file).isDirectory()) {
                    file += "/";
                }
                return file;
            }
            catch(e){
                return file;
            }
        };
        files = files.map(map);
        return cb(null, files);
    });
};
//overwrite_conf controls overwrite behaviour for multiple folders
//allowing you to fix errors per file in one request
//0 means don't overwrite
//1 means overwrite file or directory but not contents
//2 means overwrite directory and contents
//allowOver means 2 for all subdirectories
var createCounter = function(callback) {
    var counter = {};
    counter.callback = callback;
    counter.count = 0;
    counter.errors = [];
    counter.error = function(e) {
        counter.errors.push(e);
    };
    counter.increment = function(name) {
        counter.count++;
        console.log("-" + counter.count + "->" + name);
    }
    counter.decrement = function(name) {
        console.log("<-" + counter.count + "-" + name);
        counter.count--;
        //console.log(counter.count);
        if (counter.count === 0 && counter.callback) {
            if (counter.errors.length < 1) counter.callback();
            else this.callback(counter.errors);
        }
        else if (counter.count < 0) {
            throw new Error("Counter error less than 0");
        }
    };
    return counter;
}
var copyFileInto = exports.copyFileInto = function(from, to, callback, allowOver, overwrite_conf = {}, base = ".") {
    let basename = path.basename(from);
    to = path.join(to, base, basename);
    copyFile(from, to, callback, allowOver, overwrite_conf);
}
var copyFile = exports.copyFile = function(from, to, callback, allowOver, overwrite_conf = {}) {
    var r, w;
    try {
        r = fs.createReadStream(from);
    }
    catch (e) {
        callback(e);
        return;
    }
    var ops = (allowOver || overwrite_conf[from]) ? overwrite : safewrite;
    try {
        w = fs.createWriteStream(to, ops);
    }
    catch (e) {
        callback(e);
        return;
    }

    r.pipe(w);
    done = false;
    let once = function() {
        if (!done) {
            callback.apply(this, arguments);
            done = true;
        }
    }
    r.on('error', function(e) {
        once(e);
        return;
    });
    w.on('error', function(e) {
        once(e);
        return;
    });
    r.on('end', function(e) {
        callback();
    });
}

var moveFileInto = exports.moveFileInto = function(from, to, callback, allowOver, overwrite_conf = {}, base = ".", counter = undefined) {
    let basename = path.basename(from);
    to = path.join(to, base, basename);
    moveFile(from, to, callback, allowOver, overwrite_conf);
}
var moveFile = exports.moveFile = function(from, to, callback, allowOver, overwrite_conf = {}, counter = undefined) {
    let oldPath = from,
        newPath = to;
    if (counter) {
        //This is a recursive move
        if (callback) throw new Error("Callback and counter given");
        else callback = function(e) {
            counter.error({ from: from, to: to, code: e.code });
            counter.decrement(from);
        };
    }
    if (!(allowOver || (overwrite_conf && overwrite_conf[oldPath]))) {
        fs.access(newPath, function(e) {
            if (e) {
                moveFile(oldPath, newPath, callback, true);
            }
            else {
                callback && callback({ from: oldPath, to: newPath, code: 'EEXIST' });
            }
        });
        return;
    }
    fs.rename(oldPath, newPath, function(err) {
        if (err) {
            if (err.code === 'EXDEV') {
                fs.stat(oldPath, function(e, s) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (s.isFile()) {
                        copyFile(oldPath, newPath, function(e) {
                            if (!e)
                                fs.unlink(from, callback);
                            else
                                callback(e)

                        }, allowOver, overwrite_conf)
                    }
                    else {
                        copyFolder(oldPath, newPath, function(e) {
                            if (!e) {
                                deleteFolder(from, callback)
                            }
                            else {
                                callback(e)
                            }
                        }, allowOver, overwrite_conf)

                    }

                });
            }
            else if (err.code === 'ENOTEMPTY') {
                //try to merge directories
                if (counter === undefined) {
                    counter = createCounter(function(e) {
                        if (!e)
                            deleteFolder(from, callback)
                        else
                            callback(e)
                    })
                    counter.increment(from)
                }

                fs.readdir(from, function(e, r) {
                    if (e) {
                        counter.error({ from: from, to: to, code: e.code });
                        counter.decrement(from);
                        return;
                    }
                    else {
                        for (let i in r) {

                            var stat = fs.statSync(from + "/" + r[i]);
                            var p = path.join(from, r[i]);
                            counter.increment(p)
                            var callback2 = function(e) {
                                if (e)
                                    counter.error({ from: p, to: to, code: e.code });
                                counter.decrement()
                            }
                            if (stat.isDirectory()) {
                                //giving a counter and a callback is confusing
                                //the counter takes precedence for now
                                //ignoring the callback
                                moveFileInto(p + "/", to, callback2, allowOver || overwrite_conf[from] > 1, overwrite_conf, ".", counter);
                            }
                            else if (stat.isFile()) {
                                moveFileInto(p, to, callback2, allowOver || overwrite_conf[from] > 1, overwrite_conf, ".");
                            }
                            else {
                                counter.error({ from: p, to: to, code: 'unable to handle symbolic link' });
                                counter.decrement(p)
                                continue;
                            }
                        }
                        counter.decrement(from);
                    }
                });
            }
            else {
                //EISDIR - file trying to overwrite folder
                //ENOTDIR - folder trying to overwrite file
                callback(err);
            }
            return;
        }
        /*else*/
        callback();
    })
}
var copyFolderInto = exports.copyFolderInto = function(from, to, callback, allowOver, overwrite_conf = {}, base = ".", counter) {
    let basename = path.basename(from);
    let newFolder = path.join(to, base, basename);
    copyFolder(from, newFolder, callback, allowOver, overwrite_conf, counter);
}
var copyFolder = exports.copyFolder = function(from, to, callback, allowOver, overwrite_conf = {}, counter) {
    if (counter === undefined) {
        counter = createCounter(callback);
        counter.increment(from);
    }
    console.log("copying folder" + from + " as " + to);
    fs.realpath(from, function(e, d) {
        if (e) {
            counter.error({ from: from, to: to, code: e.code });
            counter.decrement(from);
            return;
        }
        else {
            fs.realpath(path.dirname(to), function(e, c) {
                if (e) {
                    counter.error({ from: from, to: to, code: e.code });
                    counter.decrement(from);
                    return;
                }
                let pos = path.relative(d, path.join(c, path.basename(to)));
                console.log(pos);
                if (!(pos.startsWith(".." + path.sep) || pos == "..")) {
                    counter.error({ from: from, to: to, code: 'Cannot copy into subdirectory' });
                    counter.decrement(from);
                    return;
                }
                else {
                    doCopy();
                }
            });
        }
    });
    var doCopy = function() {
        fs.mkdir(to, function(e) {
            if (e) {
                if (!((e.code == 'EEXIST') && (allowOver || overwrite_conf[from]))) {
                    counter.error({ from: from, to: to, code: e.code });
                    counter.decrement(from);
                    return;
                }
            }
            fs.readdir(from, function(e, r) {
                if (e) {
                    counter.error({ from: from, to: to, code: e.code });
                    counter.decrement(from);
                    return;
                }
                else {
                    for (let i in r) {

                        var stat = fs.statSync(from + "/" + r[i]);
                        var p = path.join(from, r[i]);
                        counter.increment()
                        var callback2 = function(e) {
                            if (e)
                                counter.error({ from: p, to: to, code: e.code });
                            counter.decrement()
                        }
                        if (stat.isDirectory()) {
                            copyFolderInto(p + "/", to, callback2, allowOver || overwrite_conf[from] > 1, overwrite_conf, ".", counter);
                        }
                        else if (stat.isFile()) {
                            copyFileInto(p, to, callback2, allowOver || overwrite_conf[from] > 1, overwrite_conf, ".");
                        }
                        else {
                            console.log("Unable to handle content" + p);
                            counter.error({ from: p, to: to, code: "No symlinks" });
                            continue;
                        }
                    }
                    counter.decrement(from);
                }
            });
        });
    }
}
var deleteFolder = exports.deleteFolder = function(p, callback) {
    let counter = createCounter(function(e) {
        if (!e) {
            fs.rmdir(p, callback);
        }
        else callback(e);
    });
    counter.increment(p);
    fs.readdir(p, function(e, l) {
        if (e) {
            callback(e);
            return;
        }
        for (m in l) {
            let k = path.join(p, l[m]);
            counter.increment(k);
            let callback2 = function(e) {
                if (e)
                    counter.error(e);
                counter.decrement(k);
            }
            fs.lstat(k, function(e, s) {
                if (e) {
                    counter.error(e);
                    counter.decrement(k);
                }
                else {
                    if (s.isDirectory())
                        deleteFolder(k, callback2);
                    else {
                        fs.unlink(k, callback2);
                    }
                }
            });
        }
        counter.decrement(p);
    });
}

//exports.copyFolder('/sdcard/Alarms/break3','/sdcard/Alarms/break3/pop',console.log,true); 