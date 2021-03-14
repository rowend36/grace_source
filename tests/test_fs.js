var asyncForEach = GRACE.Utils.asyncForEach;
var compare_props = function(e1, e2, props) {
    props.forEach(function(code) {
        if (e1[code] != e2[code]) {
            throw 'Unequal property ' + code + ' got ' + e2[code] + ' in 2 instead of ' + e1[code];
        }
        return true;
    });
};
var compare_stat = function(s1, s2) {
    compare_props(s1, s2, ["size", "mtimeMs", "atimeMs"]);
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
        console.log([e, e2]);
        throw err;
    }
    else if (e2 && !e) {
        err = new Error(type + ' in 2 but not 1');
        console.log([e, e2]);
        throw err;
    }
}
var compare_result = function(e, r, e2, r2, compare) {
    compare_exist(e, e2, 'Error');
    compare_exist(r, r2, 'Result');
    if (e) {
        compare_error(e, e2);
        console.log(e);
    }
    else if(r!==null && r!==undefined){
        compare(r, r2);
        console.log(r);
    }
};
var test_equal_fs = function(fs1, fs2, tests) {
    var testDir = "/sdcard/testFs";
    var files = ["index.html", "main.js", "pop.css"];
    var testData = [
        "fkdkdkdk\n\r\ndkdkdkdkdd\r\n",
        test_equal_fs.toString()
    ];
    var cases;
    console.log('BootStrapping');
    fs1.mkdir('/sdcard/', function(e, r) {
        fs1.delete(testDir, function() {
            fs1.mkdir(testDir, start);
        });
    });
    fs2.mkdir('/sdcard/', function(e, r) {
        fs2.delete(testDir, function() {
            fs2.mkdir(testDir, start);
        });
    });
    var doTests = function(Case, i, next) {
        console.debug('Testing ' + Case.name);
        Case.exec(fs1, function(e, r) {
            Case.exec(fs2, function(e2, r2) {
                try {
                    compare_result(e, r, e2, r2, Case.compare);
                }
                catch (e) {
                    console.error(e);
                }
                next();
            });
        });
    };
    var init;
    var start = function() {
        if (init) {
            asyncForEach(cases, doTests);
        }
        else init = true;
    }
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
                fs.mkdir(testDir + '/notexists/notexists', cb);
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
                fs.readFile(testDir + '/' + files[0], cb);
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
                fs.writeFile(testDir + '/' + files[0], testData[0], cb);
            },
            compare: compare_equal
        },
        {
            name: 'readFile',
            exec: function(fs, cb) {
                fs.readFile(testDir + '/' + files[0], cb);
            },
            compare: compare_buffer
        },
        {
            name: 'writeFile readFile',
            exec: function(fs, cb) {
                fs.writeFile(testDir + '/' + files[0], testData[0], function() {
                    fs.readFile(testDir + '/' + files[0], cb);
                });
            },
            compare: compare_buffer
        },
        {
            name: 'writeFile readFile',
            exec: function(fs, cb) {
                fs.writeFile(testDir + '/' + files[1], testData[1], function() {
                    fs.readFile(testDir + '/' + files[1], cb);
                });
            },
            compare: compare_buffer
        },
        {
            name: 'writeFile readFile utf16',
            exec: function(fs, cb) {
                fs.writeFile(testDir + '/' + files[0],  testData[0],'utf16', function() {
                    fs.readFile(testDir + '/' + files[0], cb);
                });
            },
            compare: compare_buffer
        },
        {
            name: 'writeFile readFile utf8 content',
            exec: function(fs, cb) {
                fs.writeFile(testDir + '/' + files[0], testData[0],'utf8', function() {
                    fs.readFile(testDir + '/' + files[0],'utf8' ,cb);
                });
            },
            compare: function(r,r2){
                console.log('integrity 1');
                compare_array(testData[0],r);
                console.log('integrity 2');
                compare_array(testData[0],r2);
            }
        }

    ].concat(tests || []);
};