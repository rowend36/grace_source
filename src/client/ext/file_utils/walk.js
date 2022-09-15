define(function (require, exports, module) {
  "use strict";
  var FileUtils = require("grace/core/file_utils").FileUtils;
  var Utils = require("grace/core/utils").Utils;
  var SEP = FileUtils.sep;

  /**
     * @typedef DataObj
           {cancelled:?any,initialValue:?any,errors:(?Error)[],results:[string]}
     *
     * @callback WalkMapCallback
           If no fs or a single fs is passed, the {present} and {error} arguments are skipped.
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
    opts.iterate =
      opts.iterate ||
      function (iterate, path, children, _data, finish) {
        iterate(path, children, _data, finish);
      };
    //Collect data from each file
    opts.map =
      opts.map ||
      function (path) {
        return path; //always fails inequality test
      };
    //Iteration end
    opts.reduce =
      opts.reduce ||
      function (path, children, data, next) {
        next(children.filter(Boolean));
        return SYNC_WAIT;
      };
    //getFiles failed
    opts.onError =
      opts.onError ||
      function (/*folder, error, fs, index*/) {
        return opts.failOnError ? false : true;
      };
    //Done done
    opts.finish = opts.finish || Utils.noop;
    var dir = opts.dirs || [opts.dir];
    dir.forEach(function (e, i) {
      if (!isDir(e)) {
        dir[i] += SEP;
      }
    });
    opts.trees =
      opts.trees ||
      dir.map(function () {
        return opts.fs || FileUtils.getFileServer();
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
      forEach(
        toWalk,
        function (fs, i, done, cancel) {
          if (!filter[i + 1]) return done();
          fs.getFiles(dir[i] + folder, function (e, res) {
            if (e) {
              if (e.code !== "ENOENT") {
                if (!opts.onError(folder, e, toWalk[i], i, initial))
                  return cancel(res);
              }
              errors[i] = e;
            } else results[i] = res;
            done();
          });
        },
        function (err) {
          if (err) return finish(err);
          /*asynchronous but iterate is usually synchronous so don't check stopped*/
          var merged = [];
          results.forEach(function (res) {
            if (res) merge(merged, res.sort());
          });
          opts.iterate(
            iterate,
            folder,
            merged,
            {
              data: new Array(merged.length),
              initialValue: initial,
              results: results, //[[string]|undefined]
              errors: errors, //[errors|undefined]
            },
            finish
          );
        },
        numTrees,
        false,
        true
      );
    }

    function iterate(folder, merged, _data, finish) {
      /*asynchronous*/
      if (stopped) return finish(undefined, stopped);
      var returned = _data.data;
      var results = _data.results;
      var errors = _data.errors;
      var running = 0;
      forEach(
        merged,
        function (path, k, next, cancel) {
          //map
          parallel--;
          running++;
          var args = [join(folder, path)];
          if (multiTree) {
            //add present and errors data
            for (var i = 0; i < toWalk.length; i++) {
              args.push((results[i] && results[i].indexOf(path) > -1) || null);
            }
            args.push.apply(args, errors);
          }
          var called = false;
          var doNext = function (res, dontVisit) {
            if (called) throw "Error: next called twice";
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
                  stack.push(
                    multiTree
                      ? args.slice(0, numTrees + 1)
                      : {
                          0: args[0],
                          1: true,
                        }
                  );
                } else {
                  step(
                    args,
                    function (after, doCancel) {
                      /*asynchronous*/
                      parallel++;
                      if (after === SYNC_BREAK) {
                        stop(SYNC_BREAK);
                      } else returned[k] = after;
                      if (stopped) cancel(stopped);
                      else if (doCancel) cancel(doCancel);
                      else next();
                    },
                    res
                  );
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
        },
        function (cancelled) {
          /*synchronous*/
          //reduce
          if (cancelled) {
            _data.cancelled = cancelled;
            parallel += running;
          } else if (running)
            throw new Error("Counter errror: Expected 0 got " + running);
          var res = opts.reduce(folder, returned, _data, finish);
          if (res !== SYNC_WAIT) {
            finish(res, res === SYNC_STOP);
          }
        },
        parallel > 0 ? parallel : 1,
        false,
        true
      );
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
  exports.walk = FileUtils.walk = walk;
  exports.copyFolder = FileUtils.copyFolder = function (
    path,
    newpath,
    server,
    newServer,
    cb,
    onConflict,
    onEach
  ) {
    FileUtils.moveFolder(
      path,
      newpath,
      server,
      newServer,
      cb,
      onConflict,
      onEach,
      true
    );
  };
  exports.moveFolder = FileUtils.moveFolder = function (
    path,
    newpath,
    server,
    newServer,
    cb,
    onConflict,
    onEach,
    isCopy
  ) {
    newServer = newServer || server;
    path = FileUtils.normalize(path + SEP);
    newpath = FileUtils.normalize(newpath + SEP);
    if (newpath == path || newpath.startsWith(path)) {
      return cb(
        FileUtils.createError({
          code: "EUNSUPPORTED",
        })
      );
    }
    var moveFile = isCopy ? FileUtils.copyFile : FileUtils.moveFile;

    function copyMove(path, dest, done) {
      newServer.mkdir(dest, function (e) {
        if (e) {
          if (onConflict && e.code == "EEXIST") {
            if (onConflict === true) done();
            else onConflict(path, newpath, server, newServer, done, true);
          } else if (done == start) {
            cb(e);
          } else {
            stopped = true;
            done(e, false);
          }
        } else done();
      });
    }
    var tries = 3;
    var tryMove =
      isCopy || server != newServer
        ? copyMove
        : function (path, dest, done) {
            if (tries > 0) {
              newServer.rename(path, dest, function (e) {
                if (e) {
                  tries--;
                  console.error(e);
                } else done(null, true);
              });
            } else {
              tryMove = copyMove;
              copyMove(path, dest, done);
            }
          };
    var stopped = false;
    var start = function () {
      FileUtils.walk({
        trees: [server, newServer],
        dirs: [path, newpath],
        map: function (file, src, dest, err1, err2, n, c, isDir) {
          if (!src || stopped) return false;
          else if (dest) {
            if (!onConflict) {
              stopped = true;
              cb(
                FileUtils.createError({
                  code: "EEXIST",
                  path: newpath + file,
                })
              );
              c();
            } else if (onConflict !== true) {
              return onConflict(
                path + file,
                newpath + file,
                server,
                newServer,
                n,
                isDir
              );
            }
          } else if (isDir) {
            tryMove(path + file, newpath + file, function (e, moved) {
              onEach && onEach(newpath + file, e);
              if (e) {
                console.error(e);
              } else n(null, moved || !!e);
            });
            return;
          }
          moveFile(
            path + file,
            newpath + file,
            server,
            newServer,
            function (e) {
              onEach && onEach(newpath + file, e);
              n(e);
            }
          );
        },
        reduce: function (file, errs, data, finish) {
          var errors = errs.filter(Boolean);
          if (errors.length > 0) {
            return errors;
          } else if (!isCopy) {
            var todelete = path + file;
            server.readdir(todelete, function (err, res) {
              if (res && res.length < 1) {
                server.rmdir(todelete, finish);
              } else finish(err);
            });
            return;
          }
          return null;
        },
        finish: function () {
          cb();
        },
      });
    };
    tryMove(path, newpath, start);
    return function () {
      stopped = true;
    };
  };
});