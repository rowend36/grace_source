define(function (require, exports, module) {
  'use strict';
  var getEditor = require('grace/setup/setup_editors').getEditor;
  var Utils = require('grace/core/utils').Utils;
  var FileUtils = require('grace/core/file_utils').FileUtils;
  var StopSignal = require('grace/ext/stop_signal').StopSignal;
  var debug = console;
  var truncate = function (str) {
    return str.length > 50 ? '...' + str.slice(str.lastIndexOf('/', 50)) : str;
  };
  exports.addDependencies = function (ts, dir, missing, cb) {
    var added = false;
    var isClassic = ts.options.compilerOptions.moduleResolution == 1;
    var roots = [''];
    if (dir === '/') dir = '';
    dir.split('/').forEach(function (segment, i) {
      roots.push(roots[i] + segment + '/');
    });
    roots.reverse().pop();
    var task = new StopSignal();
    /** Read a single file in a directory trying all possible extensions
     * @param path - resolved path
     * @callback cb {(err,found)}
     **/
    function readFile(path, cb) {
      if (path.indexOf('//') > -1)
        debug.error(new Error('unnormalized path ' + path));
      var paths;
      if (FileUtils.filename(path).indexOf('.') < 0) {
        paths = [
          path + '.d.ts',
          path + '.tsx',
          path + '.js',
          path + '.ts',
          path + '.jsx',
          path,
        ];
      } else paths = [path];
      Utils.asyncForEach(
        paths,
        function (path, i, n, x) {
          n = task.control(n, x);
          if (ts.hasDoc(path)) {
            return x(true);
          }
          Utils.waterfall([
            function (n) {
              ts.options.readFile(path, n);
            },
            function (n, e, r) {
              if (!e || e === 'binary') {
                added = true;
                ts.addDoc(path, r || '');
                n(null, true);
              } else n(e);
            },
            true,
            function (e, added) {
              if (added) {
                x(true);
              } else if (e && e.code !== 'ENOENT') {
                if (e.reason == 'size') {
                  task.stop();
                  debug.warn('Size limit exceeded');
                } else if (e !== 'binary') debug.warn(path, e.message || e);
                x(e);
              } else n();
            },
          ]);
        },
        function (err) {
          if (err !== true) debug.warn('Could not find ' + truncate(path));
          cb(err == true ? undefined : err, err == true);
        },
        0,
        0,
        true,
      );
    }

    /* Read a package's main module 
       # Arguments
       root: grace/node_modules
       path: minimatch/poco
      
    */
    function readModule(root, path, cb) {
      //minimatch
      var name = path.substring(0, path.indexOf('/')) || path;
      //poco
      path = path.substring(name.length + 1);
      //grace/node_modules/minimatch
      root = root + '/' + name;
      //read package.json
      var types = '';
      var main = '';
      var dir = '';
      Utils.waterfall([
        function (n) {
          if (path && name[0] === '@') return n();
          //grace/node_modules/minimatch/package.json
          var packageJson = root + '/package.json';
          main = 'index';
          ts.options.readFile(packageJson, function (err, res) {
            if (!err) {
              ts.addDoc(packageJson, res);
              try {
                var json = JSON.parse(res);
                //load types or main
                if (json.types) {
                  types = json.types;
                } else if (json.main) {
                  main = json.main;
                  if (path) {
                    dir = FileUtils.dirname(main);
                  }
                }
              } catch (e) {
                debug.warn(path, e.message);
              }
            }
            n(err);
          });
        },
        function (n, err) {
          if (!types && path) {
            Utils.waterfall([
              function (n) {
                //@minimatch/poco/index.d.ts
                if (!main) {
                  readModule(root, path, n);
                } else n(true);
              },
              function (n, err, res) {
                if (!err) return n(err, res);
                //minimatch/poco.d.ts
                readFile(root + '/' + path, n);
              },
              function (n, err, res) {
                //minimatch/src/poco.d.ts
                if (!dir || res) return n(err, res);
                return readFile(root + '/' + dir + '/' + path, n);
              },
              true,
              n,
            ]);
          } else if (types || main) {
            readFile(FileUtils.normalize(root + '/' + (types || main)), n);
          }
          //else not possible
        },
        true,
        cb,
      ]);
    }

    //read type definitions for a given module
    function readTypes(root, path, cb) {
      root = root + 'node_modules/@types';
      var name = path.substring(0, path.indexOf('/')) || path;
      dirExists(root + '/' + name, function (exists) {
        if (exists) {
          readModule(root, path, cb);
        } else cb();
      });
    }

    function dirExists(dir, cb) {
      ts.options.readFile(dir, function (e) {
        if (e && e.code == 'EISDIR') cb(true);
        else cb(false);
      });
    }
    Utils.asyncForEach(
      missing,
      function (mod, i, next, stop) {
        next = task.control(next, stop);
        switch (mod.type) {
          case 'source':
            //read sourcefile
            return readFile(mod.path, function (err) {
              if (err && err.code == 'EISDIR') {
                //should only happen in classic
                readModule(dir, mod.path, next);
              } else next();
            });
          case 'module':
            //Try roots from deepest to shallowest
            Utils.asyncForEach(
              roots,
              function (root, i, done, stop) {
                Utils.waterfall([
                  function (n) {
                    //Look for @types definitions first
                    readTypes(root, mod.path, n);
                  },
                  function (n, err, added) {
                    if (added) done();
                    else n();
                  },
                  function (n) {
                    if (!isClassic) return n();
                    //check using classic module resolution
                    readFile(root + mod.path, function (err, added) {
                      if (added) stop();
                      else done();
                    });
                  },
                  function (n) {
                    var plainPath = FileUtils.join(
                      root,
                      'node_modules',
                      mod.name,
                    );
                    //check if directory exists
                    dirExists(plainPath, n);
                  },
                  function (n, nodeModuleExists) {
                    //not really possible
                    if (!nodeModuleExists) return n();
                    readModule(
                      root + 'node_modules',
                      mod.path,
                      function (err, added) {
                        if (err) stop();
                        else if (added) stop();
                        else n();
                      },
                    );
                  },
                  true,
                  done,
                ]);
              },
              next,
              null,
              null,
              true,
            );
        }
      },
      function () {
        if (cb) cb(added);
        else if (added) ts.updateAnnotations(getEditor());
      },
      5,
      false,
      true,
    );
  };
});