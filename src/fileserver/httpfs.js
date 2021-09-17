_Define(function(global) {
    "use strict";
    var BaseFs = global.BaseFs;
    var FileUtils = global.FileUtils;
    var request = global.request;
    var requestBuffer = global.requestBuffer;
    var sendBuffer = global.sendBuffer;
    var normalizeEncoding = FileUtils.normalizeEncoding;
    /*TODO implement streams and symlinks, or leave symlinks*/
    function RESTFileServer(address, rootDir,password) {
        var server = address;
        rootDir = rootDir || "/";
        var encodings = ["utf8"];
        request(
            server + "/encodings",
            {
                password: password
            },
            function(e, f) {
                this.$encodingList = null;
                if (!e) encodings = f;
            }.bind(this)
        );
        this.icon = "storage";
        this.readFile = function(path, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                } else
                    encoding =
                    opts.constructor === String ? opts : opts.encoding;
            }
            if (!encoding) {
                requestBuffer(server + "/open", {
                    path: path,
                    password: password
                }, callback);
            } else
                request(
                    server + "/open", {
                        path: path,
                        password: password,
                        encoding: encoding,
                    },
                    callback
                );
        };
        this.getDisk = function() {
            return "local";
        };
        this.getFiles = function(path, callback) {
            request(
                server + "/files", {
                    path: path,
                    password: password,
                    appendSlash: true,
                },
                callback
            );
        };
        this.$gitBlobOid = function(path, callback) {
            request(
                server + "/fastGetOid", {
                    path: path,
                    password: password,
                },
                callback
            );
        };
        this.readdir = function(path, callback) {
            request(
                server + "/files", {
                    path: path,
                    password: password,
                },
                callback
            );
        };
        this.writeFile = function(path, content, opts, callback) {
            var encoding;
            if (opts) {
                if (typeof opts === "function") {
                    callback = opts;
                    opts = null;
                    encoding = null;
                } else if (typeof opts == "string") {
                    encoding = opts;
                } else {
                    encoding = opts.encoding;
                }
            }
            var blob = new FormData();
            blob.set("encoding", encoding);
            blob.set("password",password);
            blob.set("content", new Blob([content]), path);
            sendBuffer(
                server + "/save?path=" + path.replace(/\//g, "%2F"),
                blob,
                callback
            );
        };
        this.mkdir = function(path, callback) {
            request(
                server + "/new", {
                    path: path,
                    password: password,
                },
                callback
            );
        };
        this.delete = function(path, callback) {
            request(
                server + "/delete", {
                    path: path,
                    password: password,
                    recursive: true
                },
                callback
            );
        };
        this.unlink = this.rmdir = function(path, callback) {
            request(
                server + "/delete", {
                    path: path,
                    password: password,
                },
                callback
            );
        };
        this.rename = function(path, dest, callback) {
            request(
                server + "/rename", {
                    path: path,
                    dest: dest,
                    password: password,
                },
                callback
            );
        };
        this.copyFile = function(path, dest, callback, overwrite) {
            request(
                server + "/copy", {
                    path: path,
                    dest: dest,
                    password: password,
                    overwrite: overwrite || null,
                },
                callback
            );
        };
        this.moveFile = function(path, dest, callback, overwrite) {
            request(
                server + "/move", {
                    path: path,
                    dest: dest,
                    password: password,
                    overwrite: overwrite || null,
                },
                callback
            );
        };
        this.getRoot = function() {
            return rootDir;
        };
        this.stat = function(path, opts, callback) {
            if (!callback && opts && typeof opts === "function") {
                callback = opts;
                opts = null;
            }
            var isLstat = (opts === true || (opts && opts.isLstat));
            request(
                server + "/info", {
                    path: path,
                    password: password,
                    isLstat: isLstat || null,
                },
                callback &&
                function(e, s) {
                    if (s) {
                        s = FileUtils.createStats(s);
                    }
                    callback(e, s);
                }
            );
        };
        this.isEncoding = function(e) {
            if (encodings.indexOf(e) > -1) return e;
            //inefficient op
            var i = encodings
                .map(normalizeEncoding)
                .indexOf(normalizeEncoding(e));
            if (i > -1) return encodings[i];
            return false;
        };
        this.getEncodings = function() {
            return encodings;
        };
        this.lstat = function(path, callback) {
            this.stat(path, true, callback);
        };
        this.href = server + "/root/";
        BaseFs.call(this);
    }
    global.RESTFileServer = RESTFileServer;
    if (Env.canLocalHost) {
        FileUtils.registerFsExtension(
            "rest",
            "REST HTTP Fileserver",
            function(conf) {
                var address = Env._server;
                var root = "/";
                var password;
                if (conf) {
                    conf.icon = "storage";
                    if (conf.address) {
                        address = conf.address;
                        if (!address.startsWith("http"))
                            address = "http://" + address;
                    }
                    if (conf.root) {
                        root = conf.root;
                    }
                    if (conf.password) {
                        password = conf.password;
                    }
                }
                return (window.rfs = new RESTFileServer(address, root,password));
            },
            [{
                    name: "address",
                    caption: "Address",
                    type: "text",
                    value: Env._server || "http://localhost:8000",
                },
                {
                    name: "root",
                    caption: "Root Directory",
                    value: "/",
                    type: "text",
                },{
                    name: "password",
                    caption: "Password",
                    value: "",
                    type: "text",
                }
            ]
        );
    }
}); /*_EndDefine*/ 