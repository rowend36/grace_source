define(function (require, exports, module) {
    require("./brace-expansion");
    var braceExpand = window.braceExpand;
    var regEscape = require("grace/core/utils").Utils.regEscape;
    var appConfig = require("grace/core/config").Config.registerAll(
        {
            dotStar: false,
        },
        "files"
    );
    require("grace/core/config").Config.registerValues(
        {
            dotStar:
                "Enable dotstar matching for globs.eg main/* matches main/.tmp",
        },
        "files"
    );
    var FileUtils = require("grace/core/file_utils").FileUtils;
    var SEP = FileUtils.sep;
    //A regex that matches any of the parent directories of a path
    function genQuickFilter(g) {
        var globs = preprocess(g);
        var a = [];
        for (var i in globs) {
            var start = "";
            var segments = FileUtils.normalize(globs[i]).split(FileUtils.sep);
            if (segments[0] == ".") segments.shift();
            var base = segments[segments.length - 1];
            //remove file matches
            if (!base.endsWith("**")) {
                segments.pop();
            }
            if (!segments[0]) {
                segments.shift();
                start = SEP;
            }
            var j;
            //retrieve the part of the regex that is plain
            var first = true;
            for (j = 0; j < segments.length; j++) {
                var stop = segments[j].indexOf("**") + 1;
                if (stop === 1) {
                    if (j > 0) {
                        start += ".*";
                        break;
                    } else return alwaysTrue;
                } else {
                    if (first) {
                        start += "(?:";
                        first = false;
                    } else start += "(?:\\/";
                    try {
                        start += tryParseSegment(segments[j]).source;
                    } catch (e) {
                        //we might be breaking a group
                        //e.g [! , / , ]*";
                        //Better to have false positives than true negatives
                        var letters = /\w+/.exec(segments[j]);
                        start += (letters ? letters[0] : "") + "[^/]*/|";
                        segments[j + 1] =
                            segments[j] + FileUtils.sep + segments[j + 1];
                        first = true;
                    }
                    //since we allowed it @globToRegex, non-standard glob
                    //handle the /path** -> \/path.*
                    if (stop) {
                        start += ".*";
                        j++;
                        break;
                    }
                }
            }
            /*As a bonus, we could match all files in the directory
                start += "(?:\/[^/]*|\/?)$";
            */
            start += "/?"; //but we just match any trailing slash
            for (; j-- > 0; ) {
                start += "|/?)";
            }
            a.push(start);
        }
        return new RegExp("^(?:\\./)?(?:" + a.join("|") + ")$");
    }
    var alwaysTrue = {
        test: function () {
            return true;
        },
        source: ".*",
    };

    function preprocess(g) {
        var globs;

        if (typeof g == "object") {
            globs = g.reduce(function (a, i) {
                a.push.apply(a, braceExpand(i));
                return a;
            }, []);
        } else {
            if (/\{|\}/.test(g)) {
                g = braceExpand("{" + g + ",}").join(",");
            }
            globs = g.split(",");
        }
        return globs
            .map(FileUtils.normalize)
            .sort()
            .filter(isNotSpace)
            .filter(function (e, i, arr) {
                return e !== arr[i - 1];
            });
    }
    var isNotSpace = function (t) {
        return /\S/.test(t);
    };

    //This was one area, I really tried to use micromatch
    /*
    Supported globs, *, ?, **, brace-expansion, [A-Z],[!A-Z],!a
    //Could return a function object.test that tests each glob but this is more convenient
    */
    var globParts = /\\(?:(\\\\?(.))|(\*\\\*+)(\/|$)|((?:\*)+)|(\?(?:(?:\\\?)+(?=\\\*))?)|(\[(?:!|\\\^))|(\[)|(\]))/g;
    var singleLetter = "[^/]";
    var star = singleLetter + "*";
    var doublestar = "(?:" + star + "/)*";

    function parseGlob(seg) {
        var dotstar = appConfig.dotStar ? star : "(?:[^/\\.][^/]*)?";
        globParts.lastIndex = 0;
        var lastIndex = -1,
            //not foolproof but should stop someone from accidentally breaking this.
            //Not like it ever happened except during tests specifically designed to cause it
            starHeight;
        var p = regEscape(seg).replace(
            globParts,
            function (
                match,
                escaped_sequence,
                escaped_char,
                double_star,
                double_star_is_directory,
                anyStar,
                one_or_zero,
                negBracket,
                posBracket,
                closeBracket,
                index
            ) {
                var isAdjacent = index == lastIndex;
                lastIndex = index + match.length;

                if (!isAdjacent) {
                    starHeight = -1;
                }
                if (one_or_zero) {
                    if (starHeight < 1) return singleLetter + "?";
                }
                if (anyStar) {
                    if (starHeight < 1) {
                        starHeight = 1;
                        return dotstar;
                    }
                    if (starHeight == 2) {
                        starHeight = 3;
                        return dotstar;
                    }
                }
                if (double_star) {
                    if (starHeight < 2) {
                        if (double_star_is_directory) {
                            starHeight = 2;
                            return doublestar;
                        }
                        starHeight = 3;
                        return doublestar + star;
                    } else if (starHeight < 3) {
                        starHeight = 3;
                        return star;
                    }
                }
                if (escaped_sequence) {
                    return "\\" + escaped_char;
                }
                if (negBracket) return "[^\\/";
                if (posBracket) return "[";
                if (closeBracket) return "]";
                return "";
            }
        );

        return p;
    }

    function tryParseSegment(g) {
        return new RegExp(parseGlob(g));
    }

    function globToRegex(g) {
        var globs = preprocess(g).map(parseGlob);
        if (!globs.length) return null;
        var curdir = "^(?:\\./)?(?:";
        var tail = ")/?$";
        return new RegExp(curdir + globs.join("|") + tail);
    }

    function doNothing(e) {
        return {
            source: e,
        };
    }
    //Allows us to extract common directory roots from a set of globs, for now however it returns just 1
    //Exactly how much speed this gives us is uncertain
    function commonHead(path1, path2) {
        for (var i = 0, n = Math.min(path1.length, path2.length); i < n; ) {
            if (path1[i] === path2[i]) i++;
            else break;
        }
        return path1.substring(0, i);
    }

    function fastGlob(g) {
        var globs = preprocess(g);
        //escaped_characters we cannot optimize out
        var META = /[^\\\.a-z\/A-Z0-9\_\-\?\*]/;
        //We convert segments in chunks from right to left. This shows where we stopped last.
        var transformIndex = Infinity;
        //Used to lookahead for better chunks
        var nextHead = null;

        //Walks a list converting head/part1,head/part2 -> head/(?:part1|part2)
        function shrink(prev, next, i) {
            //find common head
            var head =
                nextHead === null
                    ? commonHead(prev.substring(0, transformIndex), next)
                    : nextHead;
            //Remove any globbed parts
            //as we cannot merge them
            var meta = META.exec(head);
            if (meta) head = head.substring(0, meta.index);
            //a common unglobbed path
            var mergeStart = head.length;
            if (mergeStart < 3)
                //Not worth it
                mergeStart = 0;
            //Check if this will spoil next reduction ie collecting a/ from a/b a/d/c is not good when the next path is a/d/c/e
            else if (mergeStart > 0 && i != LAST_INDEX) {
                nextHead = commonHead(next, globs[i + 1]);
                if (mergeStart < nextHead.length) mergeStart = 0;
            } else nextHead = null;
            var part1;
            //Update regexed part
            if (mergeStart < transformIndex) {
                if (transformIndex > prev.length) {
                    //Unconverted, start convert
                    part1 = transform(prev.substring(mergeStart)).source;
                } //convert next chunk
                else
                    part1 =
                        transform(prev.substring(mergeStart, transformIndex))
                            .source + prev.substring(transformIndex);
            } else {
                //newStart = start, no need to update
                part1 = prev.substring(mergeStart);
            }
            //Add pieces together
            if (mergeStart > 0) {
                //We are stll at the last group
                if (mergeStart == transformIndex) {
                    //Not always detected
                    part1 = part1.substring(3, part1.length - 1); //remove extra (?:)
                }
                commonRoot = head;
                var part2 = transform(next.substring(mergeStart)).source;
                transformIndex = mergeStart;
                return head + "(?:" + part1 + "|" + part2 + ")";
            } else {
                //Or discard the chunk
                transformIndex = Infinity;
                nextHead = null;
                //Since newStart==0,regex1 is fully converted
                options.push(part1);
                return next;
            }
        }
        var LAST_INDEX;
        /*To use reduce instead of reduceRight
            unshift with push
            ,START = chunks.length-1 instead of 0
            nextHead = i+1 instead of i-1
            reduce seems to handle better
        */
        var options = globs;
        var commonRoot = "";

        function lastDir(path) {
            var star = path.lastIndexOf("*");
            if (star > -1) path = path.substring(0, star);
            star = path.lastIndexOf("?");
            if (star > -1) path = path.substring(0, star);
            var escapedPath = path.substring(0, path.lastIndexOf(SEP) + 1);
            return escapedPath.replace(/\\(.)/g, "$1");
        }
        if (options.length < 2) {
            if (options.length == 0)
                return {
                    regex: null,
                    commonRoot: "",
                };
            commonRoot = options[0];
            var meta = META.exec(commonRoot);
            if (meta) commonRoot = commonRoot.substring(0, meta.index);
            return {
                commonRoot: lastDir(commonRoot),
                regex: tryParseSegment(options[0]),
            };
        }
        var transform = tryParseSegment;
        do {
            LAST_INDEX = options.length - 1;
            globs = options;
            globs.push(""); //so final path always gets converted
            options = [];
            globs.reduce(shrink);
            transform = doNothing; //don't repeat tryParseSegment
        } while (globs.length > options.length + 1);
        //Validate commonRoot
        if (options.length > 1) commonRoot = "";
        else commonRoot = lastDir(commonRoot);
        //todo remove commonRoot from regex
        //so we don't have to join it back in walk
        return {
            commonRoot: commonRoot,
            regex: new RegExp("^(?:\\./)?(?:" + options.join("|") + ")/?$"),
        };
    }

    FileUtils.globToRegex = globToRegex;
    FileUtils.genQuickFilter = genQuickFilter;
    FileUtils.globToWalkParams = function (glob) {
        var a = fastGlob(glob);
        var b = genQuickFilter(glob);
        return {
            root: a.commonRoot, //the root directory that contains all the matches
            canMatch: b, //matches directories that could contain possible matches
            matches: a.regex, //matches files that match the glob
        };
    };

    //Legacy ApI -
    require("../walk");
});