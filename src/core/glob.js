_Define(function(global) {
    var FileUtils = global.FileUtils;
    var braceExpand = window.braceExpand;
    var regEscape = global.Utils.regEscape;
    var appConfig = global.registerAll({}, 'files');
    var Utils = global.Utils;

    /**
     * @typedef DataObj
           {cancelled:?any,initialValue:?any,errors:(?Error)[],results:[string]}
     *
     * @callback WalkMapCallback
           If {opts.fs} is passed, the {present} and {error} arguments are skipped.
     * @param {string} path - Relative path
     * @param {boolean} ...present - One for each tree in {opts.trees}
     * @param {Error} ...error - The error, if any that caused a file not to be present,
           Repeated for each tree in {opts.trees}
     * @param {function} next - function([result[,dontVisit]]) Used for asynchronous functions,
           Returning a value other than {WalkOpt.stopSignal} calls this automatically
     * @param {function} stop - function([reason]) Stops traversing the current directory
     * @param {boolean} isDirectory
     * @param {string[]} children - list of all the files in current directory for all trees
     * @param {DataObj} data
     * 
     * 
     * @typedef {Object} WalkOpt
     * @property {WalkMapCallback} [map]
     * @property {function} [reduce] - Called at the end of each folder traversal
            function(path,data[],DataObj data,next)
     * @property {function} [finish]
     * @property {function} [onError] - function(path,error,fs,index,startValue) called when any readdir fails, return true to continue or false to stop
     * @property {function} [iterate] - function(iterate,path,mergedPaths,{cancelled:?any,initialValue:?any,errors:(?Error)[]} data) called after readir,
     * @property {FileServer} [fs]
     * @property {FileServer[]} [trees]
     * @property {string} [path]
     * @property {string[]} [dirs]
     * @property {boolean} breadthFirst - Can be changed dynamically to have walks that go both depthwise and breadthwise. But keeping track of position might become tricky
     * @property {boolean} initalValue
     * @property {any} [stopSignal=false] - A value that when returned from {opts.map,opts.reduce} stops iteration,
           Note It is ignored when returned from opts.reduce with opts.breadthFirst set, use opts.breakSignal to stop iteration totally
     * @property {any} [waitSignal=undefined] - A value that when returned from {opts.map,opts.reduce},
           Set this to something other than undefined if next/stop callbacks are not used
           Returning this without ever calling next/stop can also be usedto stop iteration early
           since the only references to the walk are the map/reduce callbacks
           but opts.finish will not be called.
     * @property {any} [breakSignal] - Return this from {opts.map,opts.reduce} to stop iteration completely,
           all opts.reduce callbacks will be called as well as opts.finish callback
     * 
     * Powerful tree walking function
     * @param {WalkOpt} opts
     * @returns {function} stop
     */
    function walk(opts) {
        opts = opts || {};
        var multiTree = !!opts.trees;
        var isDir = FileUtils.isDirectory;
        var join = FileUtils.join;
        var merge = Utils.mergeList;
        var forEach = Utils.asyncForEach;
        //Iteration start
        opts.iterate = opts.iterate || function(iterate, path, children, _data, finish) {
            iterate(path, children, _data, finish);
        };
        //Collect data from each file
        opts.map = opts.map || function(path) {
            return path; //always fails inequality test
        };
        //Iteration end
        opts.reduce = opts.reduce || function(path, children, data, next) {
            next(children.filter(Boolean));
            return SYNC_WAIT;
        };
        //getFiles failed
        opts.onError = opts.onError || function( /*folder, error, fs, index*/ ) {
            return opts.failOnError ? false : true;
        };
        //Done done
        opts.finish = opts.finish || Utils.noop;
        var dir = opts.dirs || [opts.dir];
        dir.forEach(function(e, i) {
            if (!isDir(e)) {
                dir[i] += "/";
            }
        });
        opts.trees = opts.trees || dir.map(function() {
            return opts.fs || FileUtils.defaultServer;
        });
        var SYNC_WAIT = opts.waitSignal;
        var SYNC_STOP = opts.hasOwnProperty("stopSignal") ? opts.stopSignal : false;
        var SYNC_BREAK = opts.hasOwnProperty("breakSignal") ? opts.breakSignal : {};
        if (SYNC_WAIT === SYNC_STOP || SYNC_BREAK === SYNC_WAIT)
            throw "Wait signal cannot be the same with break/stop signal";
        var toWalk = opts.trees;
        var numTrees = toWalk.length;
        var stack = [],
            stopped;
        //3 async callbacks,
        //map,reduce and readdir
        //We check <stopped> after
        //each of them is called
        var parallel = parseInt(opts.parallel) || 1;
        //traverse down a tree - called synchronously
        function step(filter, finish, initial) {
            var folder = filter[0];
            var errors = new Array(numTrees);
            var results = new Array(numTrees);
            //get results for each path
            forEach(toWalk, function(fs, i, done, cancel) {
                if (!filter[i + 1]) return done();
                fs.getFiles(dir[i] + folder, function(e, res) {
                    if (e) {
                        if (e.code !== 'ENOENT') {
                            if (!opts.onError(folder, e, toWalk[i], i, initial))
                                return cancel(res);
                        }
                        errors[i] = e;
                    } else results[i] = res;
                    done();
                });
            }, function(err) {
                if (err) return finish(err);
                /*asynchronous but iterate is usually synchronous so don't check stopped*/
                var merged = [];
                results.forEach(function(res) {
                    if (res) merge(merged, res.sort());
                });
                opts.iterate(iterate, folder, merged, {
                    data: new Array(merged.length),
                    initialValue: initial,
                    results: results, //[[string]|undefined]
                    errors: errors, //[errors|undefined]
                }, finish);
            }, numTrees, false, true);
        }

        function iterate(folder, merged, _data, finish) {
            /*asynchronous*/
            if (stopped) return finish(undefined, stopped);
            var returned = _data.data;
            var results = _data.results;
            var errors = _data.errors;
            var running = 0;
            forEach(merged, function(path, k, next, cancel) {
                //map
                parallel--;
                running++;
                var args = [join(folder, path)];
                if (multiTree) {
                    //add present and errors data
                    for (var i = 0; i < toWalk.length; i++) {
                        args.push(
                            (results[i] && results[i].indexOf(path) > -1) || null);
                    }
                    args.push.apply(args, errors);
                }
                var called = false;
                var doNext = function(res, dontVisit) {
                    if (called) throw 'Error: next called twice';
                    /*asynchronous*/
                    running--;
                    if (res === SYNC_BREAK) {
                        stop(SYNC_BREAK);
                    }
                    if (stopped) {
                        parallel++;
                        cancel(stopped);
                    } else {
                        if (!dontVisit && isDir(path)) {
                            //folder and present arguments serve as filter
                            if (opts.breadthFirst) {
                                stack.push(multiTree ? args.slice(0, numTrees + 1) : {
                                    0: args[0],
                                    1: true,
                                });
                            } else {
                                step(args, function(after, doCancel) {
                                    /*asynchronous*/
                                    parallel++;
                                    if (after === SYNC_BREAK) {
                                        stop(SYNC_BREAK);
                                    } else returned[k] = after;
                                    if (stopped) cancel(stopped);
                                    else if (doCancel) cancel(doCancel);
                                    else next();
                                }, res);
                                return SYNC_WAIT;
                            }
                        }
                        parallel++;
                        returned[k] = res;
                        next();
                    }
                    return SYNC_WAIT;
                };
                args.push(doNext, cancel, isDir(path), merged, _data);
                var res = opts.map.apply(null, args);
                if (res !== SYNC_WAIT) {
                    doNext(res, res === SYNC_STOP);
                }
            }, function(cancelled) {
                /*synchronous*/
                //reduce
                if (cancelled) {
                    _data.cancelled = cancelled;
                    parallel += running;
                } else if (running) throw new Error("Counter errror: Expected 0 got " +
                    running);
                var res = opts.reduce(folder, returned, _data, finish);
                if (res !== SYNC_WAIT) {
                    finish(res, res === SYNC_STOP);
                }
            }, parallel > 0 ? parallel : 1, false, true);
        }

        function nextStack(res) {
            //asysynchronous
            if (res == SYNC_BREAK) stop(SYNC_BREAK);
            if (stack.length && !stopped) {
                step(stack.shift(), nextStack, res);
            } else opts.finish(res, stopped);
        }

        function stop(reason) {
            stopped = reason || true;
        }
        step([""].concat(opts.trees), nextStack, opts.initialValue);
        return stop;
    }
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
                start = "/";
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
                        // start += "[^/]*";
                        first = true;
                        segments[j + 1] = segments[j] + FileUtils.sep + segments[j + 1];
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
            start += '/?'; //but we just match any trailing slash
            for (; j-- > 0;) {
                start += "|/?)";
            }
            a.push(start);
        }
        return new RegExp("^(?:\\./)?(?:" + a.join("|") + ")$");
    }
    var alwaysTrue = {
        test: function() {
            return true;
        },
        source: ".*",
    };

    function preprocess(g) {
        var globs;

        if (typeof g == "object") {
            globs = g.reduce(function(a, i) {
                a.push.apply(a, braceExpand(i));
                return a;
            }, []);
        } else {
            if (/\{|\}/.test(g)) {
                g = braceExpand("{" + g + ",}").join(",");
            }
            globs = g.split(",");
        }
        return globs.map(FileUtils.normalize).sort().filter(isNotSpace).filter(function(e, i,
            arr) {
            return e !== arr[i - 1];
        });
    }
    var isNotSpace = function(t) {
        return /\S/.test(t);
    };

    //This was one area, I really tried to use micromatch
    /*
    Supported globs, *, ?, **, brace-expansion, [A-Z],[!A-Z],!a
    //Could return a function object.test that tests each glob but this is more convenient
    */
    var globParts = /\\(?:(\\\\?(.))|(\*\\\*)(\/|$)|((?:\*)+)|(\?(?:(?:\\\?)+(?=\\\*))?)|(\[!)|(\[)|(\]))/g;
    var singleLetter = "[^/]";
    var star = singleLetter + "*";
    var doublestar = "(?:" + star + "/)*";

    function parseSegment(seg) {
        var dotstar = appConfig.dotStar ? star : "(?:[^/\\.][^/]*)?";
        globParts.lastIndex = 0;
        var lastIndex = -1,
            //not foolproof but should stop someone from accidentally breaking this.
            //Not like it ever happened except during tests specifically designed to cause it
            starHeight;
        return regEscape(seg)
            .replace(globParts,
                function(match, escaped_char, char, 
                    double_star, isDirectory, anyStar,one_or_zero,
                    negBracket, posBracket, closeBracket, index) {
                    var isAdjacent = index == lastIndex;
                    lastIndex = index + match.length;

                    if (!isAdjacent) {
                        starHeight = -1;
                    }
                    if (one_or_zero) {
                        if (starHeight < 1)
                            return singleLetter + '?';
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
                            if (isDirectory) {
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
                    if (escaped_char) {
                        return "\\"+char;
                    }
                    if (negBracket) return "[^\\/";
                    if (posBracket) return "[";
                    if (closeBracket) return "]";
                    return "";
                }
            );
    }


    function tryParseSegment(g) {
        return new RegExp(parseSegment(g));
    }

    function globToRegex(g) {
        var globs = preprocess(g).map(parseSegment);
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
        for (var i = 0, n = Math.min(path1.length, path2.length); i < n;) {
            if (path1[i] === path2[i]) i++;
            else break;
        }
        return path1.substring(0, i);
    }

    function fastGlob(g) {
        var globs = preprocess(g);
        //characters we cannot optimize out
        var META = /[^\\\.a-z\/A-Z0-9\_\-\?\*]/;
        //We convert segments in chunks from right to left. This shows where we stopped last.
        var transformIndex = Infinity;
        //Used to lookahead for better chunks
        var nextHead = null;

        //Walks a list converting head/part1,head/part2 -> head/(?:part1|part2)
        function shrink(prev, next, i) {
            //find common head
            var head = nextHead === null ? commonHead(prev.substring(0, transformIndex), next) : nextHead;
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
                else part1 = transform(prev.substring(mergeStart, transformIndex)).source + prev
                    .substring(
                        transformIndex);
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
            var escapedPath = path.substring(0, path.lastIndexOf("/") + 1);
            return escapedPath.replace(/\\(.)/g, "$1");
        }
        if (options.length < 2) {
            if (options.length == 0) return {
                regex: null,
                commonRoot: ""
            };
            commonRoot = options[0];
            var meta = META.exec(commonRoot);
            if (meta) commonRoot = commonRoot.substring(0, meta.index);
            return {
                commonRoot: lastDir(commonRoot),
                regex: tryParseSegment(options[0])
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

    FileUtils.walk = walk;
    FileUtils.globToRegex = globToRegex;
    FileUtils.genQuickFilter = genQuickFilter;
    FileUtils.globToWalkParams = function(glob) {
        var a = fastGlob(glob);
        var b = genQuickFilter(glob);
        return {
            root: a.commonRoot, //the root directory that contains all the matches
            canMatch: b, //matches directories that could contain possible matches
            matches: a.regex, //matches files that match the glob
        };
    };
});