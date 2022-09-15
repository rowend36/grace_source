define(function (require, exports, module) {
  var app = window.Application;
  var jgit = window.jgit;
  if (!(app && jgit)) return;
  var Git = require("grace/ext/git/iso_git").Git;
  var Utils = require("grace/core/utils").Utils;
  var AndroidFs = require("./android_fs").AndroidFs;
  var gitConfig = require("grace/core/config").Config.registerAll({}, "git");
  AndroidFs.prototype.$gitImpl = GitWrapper;

  function GitWrapper(dir, gitdir) {
    GitWrapper.super(this, arguments); //until we can imolement all methods
    call("setDir", [dir, gitdir || null]);
  }
  Utils.inherits(GitWrapper, Git);

  function wrap(f) {
    return function (phase, loaded, total) {
      return f({
        phase: phase,
        loaded: loaded,
        total: total,
      });
    };
  }

  function array(t) {
    if (!t) return null;
    if (Array.isArray(t)) return JSON.stringify(t);
    throw Error("Invalid array prop " + (t.toString ? t.toString() : typeof t));
  }

  function string(t) {
    if (t === undefined || t === null) return null;
    if (typeof t === "string") return t;
    throw Error(
      "Invalid string prop " + (t.toString ? t.toString() : typeof t)
    );
  }

  function bool(t) {
    return !!t;
  }
  //Allows asynchronous calls between javascript
  //and java
  var createCb = app.createCallback;

  function clearCb(o) {
    return function () {
      app.clearCallback(o);
    };
  }

  function person(t) {
    return JSON.stringify(t);
  }
  var jsonParse = JSON.parse.bind(JSON);
  var currentOp = null;
  var apply = Utils.spread(function apply(methodName, args, cb, parse) {
    var result, error;
    try {
      args = args ? (args.$getter ? args.$getter() : args) : [];
      result = jgit[methodName].apply(jgit, args);
      if (parse) {
        result = parse(result);
      }
    } catch (e) {
      error = jgit.getError();
      if (error) {
        error = JSON.parse(error);
        var el = new Error(error[0]);
        el.stack = error.slice(1).join("\n");
        el.cause = e;
        error = el;
      } else error = e;
      console.error(error);
    }
    cb(error, result);
  });

  function batchCall(methodName, arr, parse) {
    if (currentOp && currentOp.type === methodName) {
      currentOp.list.push(arr[0]);
      return currentOp.promise;
    } else {
      var i = {
        type: methodName,
        list: arr,
      };
      currentOp = i;
      var promise = (currentOp.promise = call(
        methodName,
        {
          $getter: function () {
            if (i == currentOp) currentOp = null;
            return [array(arr)];
          },
        },
        parse
      ));
      return promise;
    }
  }

  function call(methodName, args, parse) {
    return new Promise(function (resolve, reject) {
      apply(
        methodName,
        args,
        function (e, r) {
          if (e) reject(e);
          else resolve(r);
        },
        parse
      );
    });
  }
  GitWrapper.prototype.init = function () {
    modified = true;
    return call("init");
  };
  GitWrapper.prototype.batchSize = 1000;
  GitWrapper.prototype.clone = function (opts, u1, u2, isFetch) {
    if (opts.depth) {
      return Git.prototype[isFetch ? "fetch" : "clone"].call(this, opts);
    }
    modified = true;
    return new Promise(function (resolve, reject) {
      opts.onAuth().then(function (data) {
        var onProgress = createCb(opts.onProgress && wrap(opts.onProgress));

        function done(e, r) {
          clearCb(onProgress);
          clearCb(onComplete);
          if (e) reject(e);
          else resolve(r);
        }
        var onComplete = createCb(done);
        try {
          apply(
            isFetch == true ? "fetch" : "clone",
            [
              opts.singleBranch ? gitConfig.defaultBranch : null,
              string(opts.url),
              string(data.username),
              string(data.password),
              onProgress,
              onComplete,
            ],
            Utils.noop
          );
        } catch (e) {
          done(e);
        }
      });
    });
  };
  GitWrapper.prototype.fetch = function (opts) {
    return this.clone(opts, null, null, true);
  };

  GitWrapper.prototype.checkout = function (opts) {
    //Unsupported options
    if (
      //force checkout only works from index
      (opts.ref !== null && opts.force) ||
      (opts.ref &&
        opts.noUpdateHead &&
        (opts.ref.length !== 40 || opts.ref.startsWith("refs/"))) || //always updates head when given a name
      opts.noCheckout //no equivalent option
    ) {
      return safeCall("checkout").apply(this, arguments);
    }
    modified = true;
    if (opts.ref === undefined) opts.ref = "HEAD";
    if (opts.noUpdateHead && !opts.filepaths) opts.filepaths = ["."];
    var onProgress = opts.onProgress && createCb(wrap(opts.onProgress));
    return call("checkout", [
      array(opts.filepaths),
      opts.ref,
      bool(!opts.noUpdateHead),
      onProgress,
    ]).finally(clearCb(onProgress));
  };
  GitWrapper.prototype.cached = function (op) {
    if (op === "doMerge") {
      return Git.prototype.cached.call(this);
    }
    return this;
  };
  GitWrapper.prototype.commit = function (opts) {
    modified = true;
    return call("commit", [string(opts.message), person(opts.author)]);
  };
  GitWrapper.prototype.setConfig = function (opts) {
    modified = true;
    return call("setConfig", [opts.path, opts.value]);
  };
  GitWrapper.prototype.getConfig = function (opts) {
    return call("getConfig", [opts.path]);
  };
  // GitWrapper.prototype.addRemote = function(opts) {
  //   return call("addRemote", [opts.remote, opts.url, bool(opts.force)]);
  // };
  GitWrapper.prototype.listRemotes = function () {
    return call("listRemotes", null, jsonParse);
  };
  GitWrapper.prototype.resolveRef = function (opts) {
    return call("resolveRef", [opts.ref], function (ref) {
      if (ref == "0000000000000000000000000000000000000000") {
        throw new Error("NoSuchRefException");
      }
      return ref;
    });
  };
  GitWrapper.prototype.writeRef = function (opts) {
    modified = true;
    return call("writeRef", [opts.ref, opts.oid]);
  };

  function parseStatus(list, all) {
    var paths = {};

    function put(name) {
      return function (file) {
        paths[file] = paths[file] ? paths[file] + name : name;
      };
    }
    //add unmodified files
    list && list.map(put(""));
    all.added.length && all.added.map(put("Ad"));
    all.changed.length && all.changed.map(put("Ch"));
    all.removed.length && all.removed.map(put("Rm"));
    all.modified.length && all.modified.map(put("Mod"));
    all.missing.length && all.missing.map(put("Mi"));
    all.untracked.length && all.untracked.map(put("Un"));
    all.conflicting.length && all.conflicting.map(put("Con"));
    all.ignored.length && all.ignored.map(put("Ign")); //not used
    for (var i in paths) {
      paths[i] = transform(paths[i]);
    }

    function transform(status) {
      switch (status) {
        case "": //111
          return "unmodified";
        case "Ad": //22
          return "added";
        case "AdMod": //23
        case "Mod": //121
        case "ChMod": //123,113
          return "*modified";
        case "Ch": //122
          return "modified";
        case "ChMi": //103
          return "*deletedmodified";
        case "AdMi": //3
        case "Mi": //101
          return "*deleted";
        case "Rm": //100
          return "deleted";
        case "RmUn": //120,110
          return "*undeleted";
        case "Un": //20
          return "*added";
        case "Ign":
          return "ignored";
        default:
          if (status.indexOf("Con") > -1) {
            return "*conflict";
          }
          return "*unknown";
      }
    }
    return paths;
  }
  GitWrapper.prototype.status = function (opts) {
    return batchCall("statusAll", [opts.filepath], function (strList) {
      return parseStatus([opts.filepath], jsonParse(strList));
    }).then(function (map) {
      return map[opts.filepath] || "unmodified";
    });
  };
  GitWrapper.prototype.statusAll = function (opts) {
    return call("statusAll", [array(opts.filepaths)], jsonParse).then(function (
      list
    ) {
      list = parseStatus(opts.filepaths, list);
      for (var i in list) {
        opts.onEach(i, list[i]);
      }
    });
  };
  GitWrapper.prototype.add = function (opts) {
    modified = true;
    return batchCall("add", [opts.filepath]);
  };
  GitWrapper.prototype.remove = function (opts) {
    modified = true;
    return batchCall("remove", [opts.filepath]);
  };
  GitWrapper.prototype.resetIndex = function (opts) {
    return batchCall("resetIndex", [opts.filepath]);
  };
  GitWrapper.prototype.listFiles = function (opts) {
    return call("listFiles", [string(opts && opts.ref)], jsonParse);
  };
  GitWrapper.prototype.log = function () {
    return call("log", null, jsonParse);
  };
  GitWrapper.prototype.branch = function (opts) {
    modified = true;
    return call("branch", [opts.ref]);
  };
  GitWrapper.prototype.deleteBranch = function (opts) {
    modified = true;
    return call("deleteBranch", [opts.ref]);
  };
  GitWrapper.prototype.listBranches = function (opts) {
    if (opts && opts.remote) {
      return Git.prototype.listBranches.call(this, opts);
    }
    return call("listBranches", [string(opts && opts.remote)], jsonParse);
  };
  GitWrapper.prototype.currentBranch = function () {
    return call("currentBranch");
  };

  var modified = true;

  function safeCall(i) {
    return function () {
      //Make sure Git uses updated information
      //but we really want to call when we switch
      //b/w Git and GitWrapper, Git can detect cache changes
      //but not filesystem changes
      //regardless switching b/w two impl regularly will
      //lead to some race situations when it comes to saves
      //particularly the index, hopefully the user isn't faster
      //than the 1 second save buster
      if (this.fs.synchronize && modified) {
        this.fs.synchronize();
        modified = false;
      }
      return Git.prototype[i].apply(this, arguments);
    };
  }
  var igit = require("grace/ext/git/git_interface").IGitProvider;
  for (var i in igit.args) {
    if (!GitWrapper.prototype.hasOwnProperty(i)) {
      GitWrapper.prototype[i] = safeCall(i);
    }
  }
  // }
}); /*_EndDefine*/