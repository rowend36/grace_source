var fs = require("fs");
var express = require("express");
var exec = require('child_process').exec;
var debug_static = require("./static");
var files = require("./files");
var url = require('url');
var multiparty = require("multiparty");
var body = require("body-parser");
var iconv = require("iconv-lite");
var app = express();
var corsProxy = require("./cors-proxy-es5/middleware.js");
var cors = require('micro-cors')({
    allowMethods: ['POST'],
    origin: ["http://grace.androidplatform.net"]
});

app.use("/git", corsProxy());
var password, port = process.env.GRACE_PORT;
//app.set('port',process.env.PORT || 0)
app.use(body());
app.use(cors(function(req, res, next) {
    if (!password || (req.body && req.body.password == password)) {
        return next();
    }
    var parsed = url.parse(req.url);
    if (parsed.pathname == "/save") {
        return next();
    }
    doError({
        code: 'EACCESS'
    }, res);
}));
var sendHtml = function(res, html) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Length', Buffer.byteLength(html));
    res.end(html);
};

//args dir
var errors = {
    404: 'ENOENT',
    401: "EEXIST",
    403: "ENOTEMPTY",
    402: "EISDIR",
    405: 'ENOTDIR',
    406: 'EXDEV',
    410: 'EACCESS',
    412: 'ETOOLARGE',
    413: 'ENOTENCODING'
};
var errorCodes = {};
for (var i in errors) {
    errorCodes[errors[i]] = Number(i);
}

function doError(err, res) {
    res.status(errorCodes[err.code] || 501);
    res.send(err.code || err.message || 'SERVER_ERROR');
}

app.get("/", function(req, res) {
    sendHtml(res, fs.readFileSync("./index.html"));
});
app.post("/files", function(req, res) {
    try {
        (req.body.appendSlash ? files.getFiles : fs.readdir)(req.body.path, function(err, files) {
            if (err) {
                return doError(err, res);
            }
            res.json(files);
            res.end();
        });
    } catch (e) {
        doError(e, res);
    }
});
//args path
app.post("/new", function(req, res) {
    fs.mkdir(req.body.path, function(e) {
        if (e) {
            return doError(e, res);
        } else {
            res.send(200);
        }
    });
});
//args path dest overwrite
app.post("/copy", function(req, res) {
    files.copyFile(req.body.path, req.body.dest, function(err) {
        if (err) {
            return doError(err, res);
        } else {
            res.send(200);
        }
    }, req.body.overwrite);
});
app.post("/info", function(req, res) {
    var path = req.body.path;
    fs[req.body.isLstat ? "lstat" : "stat"](path, function(err, st) {
        if (err) {
            return doError(err, res);
        } else {
            var stat = {
                size: st.size,
                mode: st.mode,
                ino: st.ino,
                mtimeMs: st.mtime.getTime(),
                type: req.body.isLstat && st.isSymbolicLink() ? "symlink" : st.isDirectory() ?
                    "dir" : "file"
            };
            res.status(200);
            res.json(stat);
            res.end();
        }
    });
});

//args path dest overwrite forcelist(list of files to overwrite)
app.post("/copy-folder", function(req, res) {
    files.copyFolder(req.body.path, req.body.dest, function(err) {
        if (err) {
            return doError(err, res);
        } else {
            res.send(200);
        }
    }, req.body.overwrite, req.body.forcelist);
});
const crypto = require('crypto');
app.post("/fastGetOid", function(req, res) {
    const filename = req.body.path;
    fs.stat(filename, function(e, stat) {
        if (e && e.code != 'ENOENT') {
            doError(e, res);
        } else if (e) {
            res.send(null);
            return;
        }
        const hash = crypto.createHash('sha1');
        let input;
        try {
            input = fs.createReadStream(filename);
        } catch (e) {
            res.send(null);
            return;
        }
        hash.update("blob " + stat.size + "\x00");
        input.on('readable', function() {
            const data = input.read();
            if (data)
                hash.update(data);
            else {
                res.send(hash.digest('hex'));
            }
        });
    });
});
//args path dest overwrite forcelist
app.post("/move", function(req, res) {
    files.moveFile(req.body.path, req.body.dest, function(e) {
        if (e) {
            return doError(e, res);
        } else {
            res.status(200);
            res.end();
        }
    }, req.body.overwrite, req.body.forcelist);
});
//args path dest
app.post("/rename", function(req, res) {
    files.moveFile(req.body.path, req.body.dest, function(e) {
        if (e) {
            return doError(e, res);
        } else {
            res.status(200);
            res.end();
        }
    });
});
app.post("/encodings", function(req, res) {
    var encodings = require('iconv-lite/encodings');
    res.json(Object.keys(encodings));
});
//args command currentDir
var env = Object.create(process.env);
env.PATH =
    "/data/user/0/io.tempage.dorynode/files/usr/sbin:/data/user/0/io.tempage.dorynode/files/usr/bin:/data/user/0/io.tempage.dorynode/files/sbin:/data/user/0/io.tempage.dorynode/files/bin:/sbin:/system/sbin:/system/bin:/system/xbin:/odm/bin:/vendor/bin:/vendor/xbin";
app.post("/run", function(req, res) {
    exec(req.body.command, {
        cwd: req.body.currentDir,
        env: env
    }, (error, stdout, stderr) => {
        var result = {};
        result.error = (error ? error + "\n" : "") + (stderr || "");
        result.output = stdout;
        res.send(JSON.stringify(result));
    });
});
//args path
app.post("/delete", function(req, res) {
    fs.stat(req.body.path, function(e, s) {
        if (e) {
            return doError(e, res);
        } else {
            let callback = function(e) {
                if (e) {
                    return doError(e, res);
                } else {
                    res.status(200);
                    res.end();
                }

            };
            if (s.isDirectory()) {
                if (req.body.recursive) {
                    files.deleteFolder(req.body.path, callback);
                } else
                    fs.rmdir(req.body.path, callback);
            } else fs.unlink(req.body.path, callback);
        }
    });
});
//args file
app.post("/open", function(req, res) {
    fs.lstat(req.body.path, function(e, stat) {
        if (e) {
            return doError(e, res);
        } else if (stat.size > (req.body.maxSize || 20000000)) {
            return doError({
                code: "ETOOLARGE"
            }, res);
        } else {
            var encoding = req.body.encoding;
            if (!encoding || Buffer.isEncoding(encoding)) {
                fs.readFile(req.body.path, encoding, function(e, str) {
                    if (e) {
                        return doError(e, res);
                    }
                    res.send(str);
                });
            } else if (iconv.encodingExists(encoding)) {
                fs.readFile(req.body.path, null, function(e, buf) {
                    if (e) {
                        return doError(e, res);
                    }
                    var str = iconv.decode(buf, encoding, {
                        stripBom: req.body.stripBom != true
                    });
                    res.send(str);
                });
            } else {
                doError({
                    code: 'ENOTENCODING'
                }, res);
            }
        }
    });

});
//args path text
/**/
/*/
function parseData(req, cb) {
    var enc = req.body.encoding;
    var content = req.body.content;
    if (enc) {
        content = Buffer.from(content, enc);
    }
    cb(null, content, req.body.path);
}
//*/
var ArgsCounter = function(icount, callback) {
    var args = {};
    args.length = icount;
    var count = icount;
    this.push = function(index, value) {
        args[index] = value;
        if (--count === 0) {
            count = icount;
            callback.apply(this, args);
        }
    };
    this.end = function() {
        if (count < icount && count > 0) {
            count = 0;
            callback.apply(this, args);
        }
    };
};
app.post("/save", function(req, res) {
    var form = new multiparty.Form();
    var ended;
    var end = function(e) {
        if (!ended) {
            ended = true;
            if (e) {
                console.error('Error saving form ' + JSON.stringify(e));
                doError(e, res);
            } else {
                res.status(200);
                res.end();
            }
        } else {
            console.error(['End called twice', e]);
        }
    };
    var batch = new ArgsCounter(4, function(stream, path, encoding, pass) {
        try {
            if (password && password !== pass) {
                return end({
                    code: 'EACCESS'
                });
            }
            if (encoding && encoding != "undefined" && encoding != "null") {
                if (!iconv.encodingExists(encoding)) {
                    stream.resume();
                    return end({
                        code: 'ENOTENCODING'
                    });
                } else {
                    stream = stream.pipe(iconv.decodeStream("utf8")).pipe(iconv.encodeStream(encoding));
                }
            }
            var fd = fs.createWriteStream(path);
            fd.on('error', function(err) {
                fd.end();
                end(err);
            });
            fd.on('close', function() {
                fd.end();
                end();
            });
            stream.pipe(fd);
        } catch (e) {
            end(e);
        }
    });
    form.on('field', function(name, value) {
        if (name == "encoding") {
            batch.push(2, value);
        } else if (name == "password") {
            batch.push(3, value);
        }
    });
    form.on('part', function(part) {
        if (part.filename) {
            if (part.name == "content") {
                batch.push(0, part);
                batch.push(1, part.filename);
                return batch.end();
            }
        }
        part.resume();
    });
    form.on('close', batch.end);
    form.on('error', end);
    form.parse(req);
});
app.use(debug_static.static(".", "/root/"));

//app.use(express.static(__dirname));
// custom 500 page
app.use(function(err, req, res, next) {
    console.error(err);
});
var args = process.argv;
var isHelp = false;
for (var i = 2; i < args.length && !isHelp; i++) {
    switch (args[i]) {
        case "--port":
            port = parseInt(args[++i]);
            continue;
        case "--pass":
            password = String(args[++i]);
            continue;
        case "--help":
        case "-h":
            isHelp = true;
            /*falls through*/
        default:
            if (!isHelp) {
                isHelp = true;
                console.error('Unknown option ' + args[i]);
            }
            console.log(
                "Usage server.js [--port PORT][--pass PASSWORD]\nStart a file system server from specified path");
            break;
    }
}
if (!isHelp) {
    const server = app.listen(port || 0, function() {
        console.log('Grace express file server started on http://localhost:' +
            server.address().port + '; press Ctrl-C to terminate.');
    });
}