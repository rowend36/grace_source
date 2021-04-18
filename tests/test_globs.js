var tests = {
    "./main.js": [
        ["./main.js", true]
    ],
    "main.js": [
        "./main.js", ["main.js", true],
        ["main.css", false],
        ["main/main.js", false],
    ],
    "*.js": [
        "main.js", ["main.js.js", true],
        ["main.js.css", false],
        ["main", false]
    ],
    "./**/main.js": ["./main.js"],
    "./**/**/main.js": ["./main.js"],
    "./**/main.js/**": [
        ["./main.js", false],
        ["./main.js/", true]
    ],
    "ma?n.js": ["main.js", ["mapn.js", true],
        ["mappn.js", false]
    ],
    "ma(n).js": [
        ["ma(n).js", true],
        ["man.js", false]
    ],
    "**/**/**": [
        ["main.js", true],
        ["man().js", true]
    ],
    ".*": [
        [".main.js", true],
        ["main.js", false]
    ],
    "*": [
        [".main.js", false],
        ["main.js", true]
    ],
    "ma*ster": [
        ["master", true],
        ["masster", true],
        ["maspster", true],
        ["mastser", false]
    ],
    "mas[!opq]ter": [
        ["master", false],
        ["masster", true],
        ["maspter", false],
        ["massster", false]
    ],
    "mas[opq]ter": [
        ["master", false],
        ["masster", false],
        ["maspter", true],
        ["massster", false]
    ]
};
var quicks = {
    "main/main.js": [
        ["main/", true],
        ["mon/", false],
        ["main/main/", false],
        ["main/main.js", true]
    ],
    "*/main.js": [
        ["main/", true],
        ["mon/", true],
        ["main/main/", false]
    ],
    "**/main.js": [
        ["main", true],
        ['main/main', true],
        ["mon/main.js", true]
    ],
    "./main/**": [
        ["main/mon.js", true],
        ["main/main/mon.js", true],
        ["map/main/main.js", false]
    ],
    "ma[/o]p/*": [
        ["maop/main.js", true],
        ["ma/op/main.js", false],
        ["ma/p/main.js", true],
        ["pa/op/main.js", false],
        // ["map/main.js",false],
        ["ma/op/op/main.js", false]
    ],
    "**/main.js/**": [
        ["**/main.js", true],
        ["**/main.js/pp", true]
    ]
};

for (var i in tests) {
    var glob = globToRegex(i);
    if (typeof tests[i][0] == "string") {
        tests[i].splice.apply(tests[i], [0, 1].concat(tests[tests[i][0]]));
    }
    for (var j in tests[i]) {
        Utils.assert(glob.test(tests[i][j][0]) == tests[i][j][1], i + ":" + tests[i][j][0] + "(" + glob + ")");
    }
}
for (var l in quicks) {
    var quick = genQuickFilter(l);
    if (typeof quicks[l][0] == "string") {
        quicks[l].splice.apply(quicks[l], [0, 1].concat(quicks[quicks[l][0]]));
    }
    for (var o in quicks[l]) {
        Utils.assert(quick.test(quicks[l][o][0]) == quicks[l][o][1], l + ":" + quicks[l][o][0] + "(" + quick + ")");
    }
}
