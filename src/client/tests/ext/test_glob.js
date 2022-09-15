define(function (require, exports, module) {
    var expect = require("chai").expect;
    require("grace/ext/file_utils/glob");
    var globToRegex = require("grace/core/file_utils").FileUtils.globToRegex;
    var tests = {
        "./main.js": [["./main.js", true]],
        "main.js": [
            "./main.js",
            ["main.js", true],
            ["main.css", false],
            ["main/main.js", false],
        ],
        "**": [
            ["main.js", true],
            ["/main.js", true],
            ["main/hello/main.js/", true],
        ],
        "*.js": [
            "main.js",
            ["main.js.js", true],
            ["main.js.css", false],
            ["main", false],
        ],
        "./**/main.js": ["./main.js"],
        "./**/**/main.js": ["./main.js"],
        "./**/main.js/**": [
            ["./main.js", false],
            ["./main.js/", true],
        ],
        "ma?n.js": ["main.js", ["mapn.js", true], ["mappn.js", false]],
        "ma(n).js": [
            ["ma(n).js", true],
            // ["man.js", false],
        ],
        "**/**/**": [
            ["main.js", true],
            ["man().js", true],
        ],
        ".*": [
            [".main.js", true],
            ["main.js", false],
        ],
        "*": [
            [".main.js", false],
            ["main.js", true],
        ],
        "ma*ster": [
            ["master", true],
            ["masster", true],
            ["maspster", true],
            ["mastser", false],
        ],
        "mas[^opq]ter": [
            //"mas[!opq]ter": [
            ["master", false],
            ["masster", true],
            ["maspter", false],
            ["massster", false],
        ],
        "mas[opq]ter": [
            ["master", false],
            ["masster", false],
            ["maspter", true],
            ["massster", false],
        ],
    };
    var quicks = {
        "**": [
            ["hello/", true],
            ["hello/hello", true],
        ],
        "main/main.js": [
            ["main/", true],
            ["mon/", false],
            ["main/main/", false],
            ["main/main.js", false], //quickfilter does not match files
        ],
        "*/main.js": [
            ["main/", true],
            ["mon/", true],
            ["main/main/", false],
        ],
        "**/main.js": [
            ["main", true],
            ["main/main", true],
            ["mon/main.js", true], //treats main.js as a directory
        ],
        "./main/**": [
            ["main/mon.js", true],
            ["main/main/mon.js", true],
            ["map/main/main.js", false],
        ],
        "ma[/o]p/*": [
            ["ma/", true],
            ["maop/", true],
            ["ma/op/", false],
            ["ma/p/", true],
            ["pa/op/", false],
            ["map/", false],
            ["ma/op/op/", false],
        ],
        "**/main.js/**": [
            ["**/main.js", true],
            ["**/main.js/pp", true],
        ],
    };
    var ddos = [
        ["******", "***"],
        ["**/**/**", "**"],
        // ["**/*","**"], depends on dotStar configuration
        ["*?", "*"],
        ["*a*", "*a*"],
        ["a/*[]*", "a/*[]*"],
    ];
    describe("Glob 2 Regex", function () {
        var glob;
        Object.keys(tests).forEach(function (e) {
            it("should parse " + e, function () {
                glob = globToRegex(e);
            });
            var cases = tests[e];
            //Import test cases from test[i][0]
            if (typeof cases[0] == "string") {
                cases.splice.apply(cases, [0, 1].concat(tests[cases[0]]));
            }
            cases.forEach(function ($case, i) {
                it(
                    (i ? "and" : "which") +
                        " should " +
                        ($case[1] ? "" : "not ") +
                        "match " +
                        $case[0],
                    function () {
                        expect(glob.test($case[0])).to.equal($case[1]);
                    }
                );
            });
        });
    });
    describe("Directory filter", function () {
        var directoryFilter = require("grace/core/file_utils").FileUtils
            .genQuickFilter;
        var glob;
        Object.keys(quicks).forEach(function (e) {
            it("should parse " + e, function () {
                glob = directoryFilter(e);
            });
            var cases = quicks[e];
            //Import test cases from test[i][0]
            if (typeof cases[0] == "string") {
                cases.splice.apply(cases, [0, 1].concat(quicks[cases[0]]));
            }
            cases.forEach(function ($case) {
                it(
                    "should " + ($case[1] ? "" : "not ") + "match " + $case[0],
                    function () {
                        expect(glob.test($case[0])).to.equal($case[1]);
                    }
                );
            });
        });
    });
    describe("DDOS Filter", function () {
        it("should transform to safer forms", function () {
            ddos.forEach(function ($case) {
                var basis = globToRegex($case[0]);
                var control = globToRegex($case[1]);
                expect(basis.source).to.equal(control.source);
            });
        });
        it("should not block", function () {
            expect(
                globToRegex(
                    "??????????????????????????****************p*"
                ).test(
                    "bbbbbbbvbbbbbvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccçcccccccccccccccccccccccccccccccccccccccccccccçccccccq"
                )
            ).to.equal(false);
        });
    });
});