define(function (require, exports, module) {
  "use strict";
  var Utils = require("grace/core/utils").Utils;
  var S = require("grace/ext/language/base_client").ClientUtils;
  var docValue = S.docValue;
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var debug = console;
  exports.addDependencies = function (ts, dir, missing, cb) {
    var added = false;
    var isClassic = ts.options.compilerOptions.moduleResolution == 1;
    var roots = [""];
    dir.split("/").forEach(function (segment, i) {
      roots.push(roots[i] + segment + "/");
    });
    roots.reverse().pop();
    var abort = new Utils.AbortSignal();
    /** Read a single file in a directory trying all possible extensions
     * @param path - resolved path
     * @callback cb {(err,found)}
     **/
    function readFile(path, cb) {
      var paths;
      if (path.indexOf(".") < 0) {
        paths = [
          path + ".d.ts",
          path + ".ts",
          path + ".tsx",
          path + ".js",
          path + ".jsx",
          path,
        ];
      } else paths = [path];
      Utils.asyncForEach(
        paths,
        function (path, i, n, x) {
          n = abort.control(n, x);
          debug.log("reading: " + path);
          if (ts.hasDoc(path)) {
            return x();
          }
          ts.options.readFile(path, function (e, r) {
            try {
              if (!e) {
                added = true;
                ts.addDoc(path, r);
                x();
              } else if (e.code !== "ENOENT") {
                if (e.reason == "size") {
                  abort.abort();
                }
                x(e);
              } else n();
            } catch (e) {
              debug.log(e);
            }
          });
        },
        function (err) {
          cb(err == true ? undefined : err, err == true);
        },
        0,
        0,
        true
      );
    }

    /* Read a package's main module */
    function readModule(root, path, cb) {
      var name = path.substring(0, path.indexOf("/")) || path;
      root = root + "/" + name;
      var packageJson = root + "/package.json";
      //read package.json
      readFile(packageJson, function (err, added) {
        var main = "index";
        var dir = "";
        if (added) {
          var doc = ts.hasDoc(packageJson);
          try {
            var json = JSON.parse(docValue(ts, doc));
            //load types or main
            if (json.types) {
              main = json.types;
            } else if (json.main) {
              main = json.main;
              if (path !== name) {
                dir = "/" + FileUtils.dirname(main);
              }
            }
          } catch (e) {
            debug.error(e);
            cb(e);
          }
        }
        if (dir) {
          //read source file
          readSourceFile(root + "/" + dir + "/" + path, cb);
        } else readFile(root + "/" + main, cb);
      });
    }

    //read type definitions for a given module
    function readType(root, path, cb) {
      root = root + "node_modules/@types";
      var name = path.substring(0, path.indexOf("/")) || path;
      dirExists(root + "/" + name, function (exists) {
        if (exists) {
          readModule(root, path, cb);
        } else cb();
      });
    }

    function readSourceFile(path, cb) {
      readFile(path, function (err) {
        if (err && err.code == "EISDIR") {
          //should only happen in classic
          readModule(dir, path, cb);
        } else cb();
      });
    }

    function dirExists(dir, cb) {
      ts.options.readFile(dir, function (e) {
        if (e && e.code == "EISDIR") cb(true);
        else cb(false);
      });
    }
    Utils.asyncForEach(
      missing,
      function (mod, i, next, stop) {
        next = abort.control(next, stop);
        switch (mod.type) {
          case "source":
            //read sourcefile
            return readSourceFile(mod.path, next);
          case "module":
            //Try roots from deepest to shallowest
            Utils.asyncForEach(
              roots,
              function (root, i, next, stop) {
                //Look for @types definitions first
                readType(root, mod.path, function (err, added) {
                  if (added) return next();
                  if (isClassic) {
                    //check using classic module resolution
                    readFile(root + mod.path, function (err, added) {
                      if (added) stop();
                      else next();
                    });
                  } else {
                    var plainPath = root + "node_modules/" + mod.name;
                    //check if directory exists
                    dirExists(plainPath, function (yes) {
                      //not really possible
                      if (yes) {
                        readModule(
                          root + "node_modules",
                          mod.path,
                          function (err, added) {
                            if (err) stop();
                            else if (added) stop();
                            else next();
                          }
                        );
                      } else next();
                    });
                  }
                });
              },
              next,
              null,
              null,
              true
            );
        }
      },
      function () {
        if (cb) cb(added);
        else if (added) ts.triggerUpdateAnnotations();
      },
      5,
      false,
      true
    );
  };
});