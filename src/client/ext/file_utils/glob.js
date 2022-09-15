define(function (require, exports, module) {
  "use strict";
  /**
   * Decided to try micromatch again driven by the smaller bundle size
   * with webpack 5, dynamic loading with requirejs and (very)+ rare bugs in old_glob.js.
   * Thanks to my prior tests , in 5 mins, I knew what worked and what didn't.
   * 1. (Fixed)old_glob dealt with ./ (micromatch fails to for unknown reasons)
   * 2. old_glob required you to escape brackets \(\) to get special meaning
   * 3. old_glob used [!] not [^] to negate character sets
   * 4. (Fixed)we lost genQuickFilter.
   * In return, we gained extglobs, 1 additional pass in the tests, and peace of mind.
   * The loss in speed was negligible(10-5%). Although size went up by >30kb(12kb -> 50kb)
   * Plus we can always go back,...
      return require("./libs/old_glob");
   **/
  var micromatch = require("./libs/micromatch");
  var braceExpand = micromatch.braceExpand;
  var appConfig = require("grace/core/config").Config.registerAll(
    {
      dotStar: false,
    },
    "files"
  );
  require("grace/core/config").Config.registerInfo(
    {
      dotStar: "Enable dotstar matching for globs.eg main/* matches main/.tmp",
    },
    "files"
  );
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var isDirectory = FileUtils.isDirectory;

  function globToRegex(s) {
    return {
      test: micromatch.matcher(preprocess(s), {
        strictSlashes: true,
        dot: appConfig.dotStar,
        format: FileUtils.normalize,
        basename: false,
      }),
    };
  }
  function preprocess(g) {
    var globs;
    if (!g) return [];
    if (typeof g == "object") {
      globs = g.reduce(function (a, i) {
        a.push.apply(a, braceExpand(i));
        return a;
      }, []);
    } else {
      if (/\{|\}/.test(g)) {
        g = braceExpand("{" + g + ",}")
          .slice(0, -1)
          .join(",");
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
  /**
   * Converts a/b/c to a(?:/b(?:/c|\/?)|\/?)\/?
   * returns a regex that tells if this directory
   * can contain a match. Works well with braceExpand.
   * Works fairly with extglobs.
   **/
  function genQuickFilter(s) {
    var options = preprocess(s).reduce(function (arr, e) {
      arr.push.apply(
        arr,
        micromatch.parse(e, {
          strictSlashes: true,
          dot: appConfig.dotStar,
          format: FileUtils.normalize,
          basename: false,
        })
      );
      return arr;
    }, []);
    var a = [];
    options.forEach(function (parsed) {
      var segments = [];
      var accumulator = [];
      var segCount = 0;
      function addSegment() {
        segments.push((segCount ? "(?:/" : "") + accumulator.join(""));
        accumulator = [];
        segCount++;
      }
      function addPart(e) {
        accumulator.push(e);
      }
      parsed.tokens.some(function (e) {
        switch (e.type) {
          case "text":
            addPart(e.value);
            break;
          case "slash":
            addSegment();
            break;
          case "bracket":
            if (e.value.indexOf(FileUtils.sep) > -1) {
              addSegment();
              addPart("{0}" + e.value);
            } else addPart(e.value);
            break;
          case "maybe_slash":
          case "bos":
            break;
          case "paren":
          case "globstar":
            addPart(".*");
            //why you should just keep your globs simple
            return true;
          default:
            addPart(e.output === undefined ? e.value : e.output);
        }
        return false;
      });
      addPart("$");
      addSegment();
      while (--segCount > 0) {
        segments.push("|/$)");
      }
      a.push(segments.join(""));
    });
    return {
      re: new RegExp("^(?:" + a.join("|") + ")"),
      test: function (m) {
        return this.re.test(isDirectory(m) ? m : m + "/");
      },
    };
  }
  function isNotSpace(t) {
    return /\S/.test(t);
  }
  FileUtils.globToRegex = globToRegex;
  FileUtils.genQuickFilter = genQuickFilter;
  FileUtils.globToWalkParams = function (glob) {
    var a = globToRegex(glob);
    var b = genQuickFilter(glob);
    return {
      root: a.commonRoot, //the root directory that contains all the matches
      canMatch: b, //matches directories that could contain possible matches
      matches: a.regex, //matches files that match the glob
    };
  };

  //Legacy ApI -
  require("./walk");
});