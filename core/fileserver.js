(function(global) {
    "use strict";
    var FileUtils = global.FileUtils;
    var Utils = global.Utils;
    var createCounter = global.Utils.createCounter;

    function upgradeFs(fs) {
        fs.delete = fs.delete || function(path, cb, error) {
            error = error || { error: false };
            fs.stat(path, function(e, st) {
                if (error.error) return cb();
                if (e) {
                    error.error = e;
                    return cb(e);
                }
                if (st.type == "dir") {
                    var counter = Utils.createCounter(function(e) {
                        if (error.error) return cb(error.error);
                        //ignore errors
                        fs.rmdir(path, cb);
                    });
                    counter.increment();
                    fs.readdir(path, function(e, li) {
                        if (error.error) return cb();
                        if (e) {
                            error.error = e;
                            return cb(e);
                        }
                        li.forEach(function(el) {
                            counter.increment();
                            fs.delete(path + "/" + el, counter.decrement, error);
                        });
                        counter.decrement();
                    });
                }
                else fs.unlink(path, cb);
            });
        };
        fs.moveFile = fs.moveFile || function(path, newpath, cb, overwrite) {
            fs.rename(path, newpath, function(err) {
                if (err) {
                    FileUtils.copyFile(path, newpath, fs, null, function(e) {
                        if (!e) fs.delete(path);
                        cb && cb(e);
                    });
                }
                else cb();
            });
        };
        fs.getRoot = fs.getRoot || function() {
            return "/";
        };

        fs.getFiles = fs.getFiles || function(path, cb) {
            fs.readdir(path, function(err, res) {
                if (!cb) return;
                if (err) return cb(err);
                if (!res.length) return cb(null, res);
                var dest = [];

                var each = function(path) {
                    return function(err, stat) {
                        if (stat && stat.type == "dir" && path[path.length - 1] != "/") {
                            path = path + "/";
                        }
                        dest.push(path);
                        counter.decrement();
                    };
                };
                var final = function() {
                    cb(null, dest);
                };
                var counter = createCounter(final, each);
                counter.increment();
                for (var i in res) {
                    counter.increment();
                    fs.stat(path + res[i], each(res[i]));
                }
                counter.decrement();
            });
        };
        fs.getDisk = fs.getDisk || function() {
            return this.id;
        };
        fs.isEncoding = fs.isEncoding || function(e) {
            var a = e.toLowerCase().replace("-", "");
            if (a === "utf8") return a;
        };
    }
    var InAppFileServer;
    global.getBrowserFileServer = function() {
        var fs = InAppFileServer;
        if (!fs) {
            if (window.LightningFS) {
                fs = InAppFileServer = new LightningFS('grace');
                upgradeFs(fs);
            }
            else {
                fs = new StubFileServer("./libs/js/lightning-fs.js", global.getBrowserFileServer);
            }
            fs.id = "inApp";
        }
        return fs;
    };
    var errors = {
        404: 'ENOENT',
        401: "EEXIST",
        403: "ENOTEMPTY",
        402: "EISDIR",
        405: 'ENOTDIR',
        406: 'EXDEV',
        412: 'ETOOLARGE',
        413: 'ENOTENCODING'
    };
    var getError = function(xhr, url, path) {
        var code = errors[xhr.status] || xhr.responseText || 'EUNKNOWN';
        if (xhr.status === 0 && !code) global.Notify.error('SERVER DOWN!!!');
        return {
            code: code,
            message: code,
            syscall: url,
            path: path
        };
    };
    var request = function(url, data, callback, processed, retryCount, stack) {
        retryCount = retryCount || 0;
        $.ajax({
            url: url,
            type: 'POST',
            data: data,
            processData: !processed,
            success: function(res) {
                callback && callback(null, res);
            },
            error: function(xhr, status, message) {
                if ((xhr.status === 0 || (xhr.status === 501 && !xhr.responseText)) && retryCount < 3) {
                    request(url, data, callback, processed, ++retryCount, stack);
                }
                else callback && callback(getError(xhr, url, data.path || data.dir || data.file));
            }
        });
    };
    var requestBuffer;

    if (window.XMLHttpRequest && window.FormData && window.ArrayBuffer) {
        requestBuffer = function(url, path, callback, retryCount, stack) {
            retryCount = retryCount || 0;
            stack = retryCount;
            $.ajax({
                url: url,
                type: 'POST',
                data: {
                    file: path
                },
                success: function(res) {
                    callback && callback(null, res);
                },
                error: function(xhr, status, message) {
                    if ((xhr.status === 0 || (xhr.status === 501 && !xhr.responseText)) && retryCount < 3) {
                        requestBuffer(url, path, callback, ++retryCount, stack);
                    }
                    else callback && callback(getError(xhr, stack, path));
                },
                xhr: function() {
                    var a = new XMLHttpRequest();
                    a.responseType = "arraybuffer";
                    return a;
                }
            });
        };
    }
    else {
        var MAX_SIZE = 1000000;
        //this size will take 4mb of memory
        //bfs buffer impl can use readUint method
        //And thus, save half the memory
        //besides inbrowser fileserver 
        //the other two servers
        //use base64 as intermediate value
        //this could make room for some
        //optimization later
        //but for now, we'll ignore it
        var UintArrayImpl = function(binaryStr) {
            if (binaryStr.length > MAX_SIZE) {
                throw 'Error: File Too Large';
            }
            for (var i = 0; i < max; i++) {
                this[i] = binaryStr.charCodeAt(i) && 0xff;
            }
            this.length = this.byteLength = binaryStr.length;
            this.buffer = this;
        };
        UintArrayImpl.prototype = Object.create(Array.prototype);
        UintArrayImpl.prototype.byteOffset = 0;

        requestBuffer = function(url, path, callback, retryCount) {
            retryCount = retryCount || 0;
            $.ajax({
                url: url,
                type: 'POST',
                data: {
                    file: path
                },
                success: function(data) {
                    var buffer = new UintArrayImpl(data);
                    callback && callback(null, buffer);
                },
                error: function(xhr, status, message) {
                    if ((xhr.status === 0 || (xhr.status === 501 && !xhr.responseText)) && retryCount < 3) {
                        requestBuffer(url, path, callback, retry, ++retryCount);
                    }
                    else callback && callback(getError(xhr));
                },
                xhr: function() {
                    var a = new XMLHttpRequest();
                    xhr.overrideMimeType('text/plain; charset=x-user-defined');
                    return a;
                }
            });
        };
    }

    function RESTFileServer(address, rootDir) {
        var server = address;
        rootDir = rootDir || "/";
        var encodings = ["utf8"];
        request(server + "/encodings", "", function(e, f) {
            this.$encodingList = null;
            if (!e) encodings = f;
        }.bind(this));
        this.readFile = function(path, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                }
                else encoding = opts.constructor === String ? opts : opts.encoding;
            }
            if (!encoding) {
                requestBuffer(server + "/open", path, callback);
            }
            else request(server + "/open", {
                file: path,
                encoding: encoding
            }, callback);
        };
        this.getDisk = function() {
            return "local";
        };
        this.getFiles = function(path, callback) {
            request(server + "/files", {
                dir: path,
                appendSlash: true
            }, callback);
        };
        this.readdir = function(path, callback) {
            request(server + "/files", {
                dir: path
            }, callback);
        };
        this.writeFile = function(path, content, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                    encoding = null;
                }
                else if(typeof opts=="string"){
                    encoding = opts;
                }
                else{
                    encoding = opts.encoding;
                }
            }
            // if (FileUtils.isBuffer(content)) {

            // }
            var data = new FormData();
            data.set("encoding", encoding);
            data.set("content", new Blob([content]), path);
            var req = new XMLHttpRequest();
            req.open('POST', server + "/save?path="+path.replace('/','%2F'), true);
            req.send(data);
            req.onload = function() {
                if (req.status == 200)
                    callback();
                else {
                    callback(getError(req, null, path));
                }
            };
            req.onerror = function() {
                callback(getError(req));
            };
        };
        this.mkdir = function(path, callback) {
            request(server + "/new", {
                path: path,
            }, callback);
        };
        this.delete = function(path, callback) {
            request(server + "/delete", {
                path: path,
            }, callback);
        };
        this.unlink = this.rmdir = this.delete;
        this.rename = function(path, dest, callback) {
            request(server + "/rename", {
                path: path,
                dest: dest
            }, callback);
        };

        this.copyFile = function(path, dest, callback, overwrite) {
            request(server + "/copy", {
                path: path,
                dest: dest,
                overwrite: overwrite
            }, callback);
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            request(server + "/move", {
                path: path,
                dest: dest,
                overwrite: overwrite
            }, callback);
        };
        this.getRoot = function() {
            return rootDir;
        };

        this.stat = function(path, opts, callback) {
            if (!callback && opts && typeof opts === "function") {
                callback = opts;
                opts = null;
            }
            request(server + "/info", {
                path: path,
                isLstat: !!opts
            }, callback && function(e, s) {
                if (s) {
                    s = FileUtils.createStats(s);
                }
                callback(e, s);
            });

        };
        this.isEncoding = function(e) {
            if (encodings.indexOf(e) > -1) return e;
            if (e.toLowerCase() == "utf-8") return 'utf8';
            return false;
        };
        this.getEncodings = function() {
            return encodings;
        };
        this.symlink = function(path, dest, callback) {
            this.copyFile(path, dest, callback, false);
        };
        this.readlink = function(path, callback) {
            setTimeout(function() {
                callback(path);
            });
            //path,dest,callback,false);
        };
        this.lstat = function(path, callback) {
            this.stat(path, true, callback);
        };
        this.href = server + "/root/";
    }
    //the core props of a file server
    var propsToEnqueue = ['getFiles', 'readFile', 'writeFile', 'stat', 'lstat', 'mkdir'];

    function StubFileServer(url, resolve) {
        var queuedOps = [];
        propsToEnqueue.forEach(function(e) {
            this[e] = function() {
                queuedOps.push({ method: e, args: Array.prototype.slice.apply(arguments, [0]) });
                this.load();
            };
        }, this);
        this.$isStub = true;
        //override this method if you will have multiple
        //instances eg
        /*
        this.load = function(){
            if(loaded)inject()
            if(loading)loader.on('loaded',inject)
            else {
            loader.load();
            loader.on('load',inject);
            }
            //toprevent more calls to inject
            this.load = function(){}
        }
        */
        this.load = function() {
            var script = document.createElement('script');
            script.setAttribute("type", "text/javascript");
            script.setAttribute('id', this.id);
            script.src = url;
            script.onload = function() {
                this.inject();
            }.bind(this);
            document.body.appendChild(script);
            this.load = function() {};
        };
        this.getRoot = function() {
            return '/';
        };
        this.getDisk = function() {
            return this.id;
        };
        this.inject = function() {
            var server = resolve();
            server.id = this.id;
            //optional if you stick propsToEnqueue
            FileUtils.replaceServer(this, server);
            this.$isStub = server;
            queuedOps.forEach(function(e) {
                server[e.method].apply(server, e.args);
            });
            queuedOps = null;
            this.inject = null;
            propsToEnqueue.forEach(function(e) {
                this[e] = server[e].bind(server);
            }, this);
        };
    }

    function FindFileServer(fileServer) {
        var filter = null;
        var b = fileServer;
        var self = Object.create(fileServer);
        self.setFilter = function(glob, re) {
            if (!glob) {
                filter = null;
                return;
            }
            if (typeof(glob) == 'string') {
                if (re) {
                    filter = function(i) {
                        return FileUtils.isDirectory(i) || i.match(glob);
                    };
                }
                else filter = function(i, folder) {
                    return (FileUtils.isDirectory(i) || ('^' + folder + i + '$').indexOf(glob) > -1);
                };
                return;
            }
            filter = glob;
        };
        self.getFiles = function(path, callback) {
            if (filter)
                b.getFiles(path, function(err, res) {
                    if (!filter) return callback(err, []);
                    var filtered = [];
                    for (var i of res) {
                        if (filter(i, path)) {
                            filtered.push(i);
                        }
                    }

                    if (callback)
                        callback(err, !err && filtered);
                });
            else b.getFiles(path, callback);
        };
        return self;
    }

    global.RESTFileServer = RESTFileServer;
    global.FindFileServer = FindFileServer;
    global.StubFileServer = StubFileServer;
    if (Env.canLocalHost) {
        FileUtils.registerFileServer("rest", "REST HTTP Fileserver", function(conf) {
            var address = Env._server;
            var root = "/";
            if (conf) {
                if (conf.address) {
                    address = conf.address;
                    if (!address.startsWith("http"))
                        address = "http://" + address;
                }
                if (conf.root) {
                    root = conf.root;
                }
            }
            return new RESTFileServer(address, root);
        }, [{
                name: "address",
                caption: "Address",
                type: "text",
                value: Env._server || ""
            },
            {
                name: "root",
                caption: "Root Directory",
                value: '/',
                type: "text"
            }
        ]);
    }
    FileUtils.registerFileServer('inApp', "In-Memory FileSystem", global.getBrowserFileServer);
})(Modules);