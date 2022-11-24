define(function(require, exports, module) {
    var asyncForEach = require("grace/core/utils").Utils.asyncForEach;
    var debug = console;
    var compare_props = function(e1, e2, props) {
        props.forEach(function(code) {
            if (e1[code] != e2[code]) {
                throw 'Unequal property ' + code + ' got ' +
                    e2[code] +
                    ' in 2 instead of ' + e1[
                        code];
            }
            return true;
        });
    };
    var compare_equal = function(a, b) {
        if (a != b) {
            throw 'Unequal got ' + b + ' instead of ' + a;
        }
    };
    var compare_error = function(s1, s2) {
        compare_props(s1, s2, ["code"]);
    };
    var compare_array = function(a1, a2) {
        compare_props(a1, a2, ["length"]);
        compare_props(a1, a2, Object.keys(a1));
    };
    var compare_buffer = function(a1, a2) {
        compare_array(new Uint8Array(a1), new Uint8Array(a2));
    };


    var compare_exist = function(e, e2, type) {
        var err;
        if (e && !e2) {
            err = new Error(type + ' in 1 but not 2');
            debug.log([e, e2]);
            throw err;
        } else if (e2 && !e) {
            err = new Error(type + ' in 2 but not 1');
            debug.log([e, e2]);
            throw err;
        }
    };
    var compare_result = function(e, r, e2, r2, compare) {
        compare_exist(e, e2, 'Error');
        compare_exist(r, r2, 'Result');
        if (e) {
            compare_error(e, e2);
        } else if (r !== null && r !== undefined) {
            compare(r, r2);
        }
    };
    var test_equal_fs = function(fs1, fs2, cb) {
        var testDir = "/sdcard/testFs";
        var files = ["index.html", "main.js", "pop.css"];
        var testData = [
            "fkdkdkdk\n\r\ndkdkdkdkdd\r\n",
            test_equal_fs.label
        ];
        var cases;
        var assert_good_callback = function(cb, name) {
            var r = setTimeout(function() {
                debug.error(name + " not called");
                cb("Not called");
                r = -1;
            }, 1000);
            return function() {
                if (r == 0) throw name + " called twice";
                if (r == -1) throw name + " later called";
                clearTimeout(r);
                r = 0;
                cb.apply(this, arguments);
            };
        };
        var doTests = function(Case, i, next) {
            if (Case.skip && (Case.skip(fs1) || Case.skip(
                    fs2))) {
                it.skip(Case.name);
                return next();
            }
            it(Case.name, function(done) {
                done = assert_good_callback(done,
                    "done");
                Case.exec(fs1, assert_good_callback(
                    function(e, r) {
                        Case.exec(fs2,
                            assert_good_callback(
                                function(e2,
                                    r2) {
                                    setTimeout
                                        (
                                            done
                                        );
                                    compare_result
                                        (
                                            e,
                                            r,
                                            e2,
                                            r2,
                                            Case
                                            .compare
                                        );
                                }, "case2"));
                    }, "case1"));
            });
            next();
        };
        cases = [{
                name: 'mkdir eexists',
                exec: function(fs, cb) {
                    fs.mkdir(testDir, cb);
                },
                compare: compare_exist
            },
            {
                name: 'mkdir enoent',
                exec: function(fs, cb) {
                    fs.mkdir(testDir +
                        '/notexists/notexists', cb);
                },
                compare: compare_exist
            },
            {
                name: 'mkdir',
                exec: function(fs, cb) {
                    fs.mkdir(testDir + '/newdir', cb);
                },
                compare: compare_exist
            },
            {
                name: 'readFile enoent',
                exec: function(fs, cb) {
                    fs.readFile(testDir + '/' + files[0],
                        cb);
                },
                compare: compare_equal
            },
            {
                name: 'readFile eisdir',
                exec: function(fs, cb) {
                    fs.readFile(testDir, cb);
                },
                compare: compare_equal
            },
            {
                name: 'writeFile',
                exec: function(fs, cb) {
                    fs.writeFile(testDir + '/' + files[0],
                        testData[0], cb);
                },
                compare: compare_equal
            },
            {
                name: 'readFile',
                exec: function(fs, cb) {
                    fs.readFile(testDir + '/' + files[0],
                        cb);
                },
                compare: compare_buffer
            },
            {
                name: 'writeFile readFile',
                exec: function(fs, cb) {
                    fs.writeFile(testDir + '/' + files[0],
                        testData[0],
                        function() {
                            fs.readFile(testDir + '/' +
                                files[0], cb);
                        });
                },
                compare: compare_buffer
            },
            {
                name: 'writeFile readFile',
                exec: function(fs, cb) {
                    fs.writeFile(testDir + '/' + files[1],
                        testData[1],
                        function() {
                            fs.readFile(testDir + '/' +
                                files[1], cb);
                        });
                },
                compare: compare_buffer
            },
            {
                name: 'writeFile readFile utf16',
                skip: function(fs) {
                    return !fs.isEncoding("utf-16");
                },
                exec: function(fs, cb) {
                    fs.writeFile(testDir + '/' + files[0],
                        testData[0], 'utf16',
                        function() {
                            fs.readFile(testDir + '/' +
                                files[0], cb);
                        });
                },
                compare: compare_buffer
            },
            {
                name: 'writeFile readFile utf8 content',
                exec: function(fs, cb) {
                    fs.writeFile(testDir + '/' + files[0],
                        testData[0], 'utf8',
                        function() {
                            fs.readFile(testDir + '/' +
                                files[0], 'utf8', cb
                            );
                        });
                },
                compare: compare_equal
            }
        ];
        it("Setup " + fs1.id, function(done) {
            fs1.mkdir('/sdcard/', function() {
                fs1.delete(testDir, function() {
                    fs1.mkdir(testDir,
                        done);
                });
            });
        });
        it("Setup fs2" + fs2.id, function(done) {
            fs2.mkdir('/sdcard/', function() {
                fs2.delete(testDir, function() {
                    fs2.mkdir(testDir,
                        done);
                });
            });
        });

        asyncForEach(cases, doTests, cb);
    };
    describe("FileServer", function(done) {
        if (!require.defined("../libs/js/browserfs.min.js")) {
            it("ignored",function(){});
            return;
        }
        var BrowserFS = (require)("./libs/js/browserfs.min.js");
        var impl = new BrowserFS
            .FileSystem.InMemory();
        BrowserFS.initialize(impl);
        var bfs = BrowserFS.BFSRequire(
            "fs");
        require("grace/core/base_fs").BaseFs.call(bfs);
        bfs.label = 'Browser FS';

        var lfs = require("grace/core/file_utils").FileUtils
            .createServer("inApp");
        var fs = require("grace/core/file_utils").FileUtils
            .getFileServer();
        var pairs = [
            lfs,
            fs,
            window.rfs
        ];
        asyncForEach(pairs, function(p, i, n) {
            if (p && pairs.indexOf(p) == i) {
                describe(p.id, function(done) {
                    test_equal_fs(bfs, p, done);
                });
                n();
            } else n();
        }, done);
    });
});