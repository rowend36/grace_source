_Define(function(global) {
  var args = {
    /*The ones we're still falling back to isogit for*/
    analyze: ["?force", "?onProgress"],
    completeMerge: ["?href", "baseOid", "?base", "?message", "ourOid", "theirOid", "ours", "theirs", "author",
      "committer", "?signingKey", "tree"
    ],
    merge: ["theirs", "?ours", "author", "?committer", "?name", "?email", "?dryRun", "?fastForwardOnly",
      "onProgress"
    ],
    setDir: ["dir", "gitdir"],
    init: [],
    pull: ["remote", "branch",
      "author",
      "?fastForwardOnly",
      "onAuth",
      "onAuthSuccess",
      "onProgress",
      "onAuthFailure"
    ],
    push: ["remote", "branch",
      "author",
      "?fastForwardOnly",
      "onAuth",
      "onAuthSuccess",
      "onProgress",
      "onAuthFailure"
    ],
    ensureIndex: [],
    clone: ["singleBranch", "url", "onAuth", "?onProgress"],
    fetch: ["singleBranch", "url", "onAuth", "?onProgress"],
    checkout: ["?filepaths", "ref", "?force", "onProgress", "?noCheckout", "?noUpdateHead"],
    commit: ["message", "author"],
    setConfig: ["path", "value"],
    getConfig: ["path"],
    addRemote: ["remote", "url"],
    deleteRemote: ["remote", "url"],
    listRemotes: [],
    currentBranch: [],
    resolveRef: ["ref"],
    writeRef: ["ref", "oid"],
    status: ["filepath"],
    statusAll: ["?filepaths", "onEach"],
    add: ["filepath"],
    remove: ["filepath"],
    resetIndex: ["filepath"],
    listFiles: ["?ref"],
    log: [],
    branch: ["ref"],
    deleteBranch: ["ref"],
    listBranches: ["?remote"],
  };
  var returnTypes = {
    commit: ["oid"]
  };
  global.IGitProvider = {
    args: args,
    optionalArgs: args,
    returns: returnTypes,
    assert: function(name, opts) {
      opts = opts || {};
      var args = this.args;
      for (var i in opts) {
        if (args[name].indexOf(i) < 0 && args[name].indexOf('?' + i) < 0) {
          if (!/\b(dir|gitdir|corsProxy|cache|http|fs)\b/.test(i)) throw new Error(i +
            " not part of git interface for " +
            name);
        }
      }
      for (var j of args[name]) {
        if (j.startsWith("?")) continue;
        if (!opts.hasOwnProperty(j)) throw new Error('Missing interface value ' + j + ' for ' + name);
      }
    }
  };
}); /*_EndDefine*/
_Define(function(global) {
  var igit = global.IGitProvider;
  var appConfig = global.allConfigs.git;
  var pleaseCache = global.createCacheFs;
  //The wacky nature of Imports.define is seeping through
  var Imports = global.Imports;
  var mergeHelper = Imports.promise.bind(null, [
    "./tools/git/libs/diff3/diff3.js", {
      script: "./tools/git/interactive_merge.js",
      returns: "InteractiveMerge"
    }
  ]);
  var gc = global.AppEvents;
  var Utils = global.Utils;
  var http = global.http;
  var cache;
  // fileCache;
  /*caching*/
  function clear() {
    if (cache) cache = null;
    // fileCache = null;
  }
  var clearCache = Utils.debounce(clear, 10000);
  gc.on("app-paused", clear);

  function getCache() {
    clearCache();
    return cache || (cache = {});
  }
  var Git = function(dir, gitdir, fs) {
    this.dir = dir;
    this.gitdir = gitdir;
    this.fs = fs;
    this.cache = getCache();
  };

  function isoGitCall(name) {
    return function(opts) {
      // igit.assert(name, opts);
      return window.git[name](this.getOpts(opts)).then(function(res) {
        // console.log(res);
        return res;
      }, function(err) {
        throw err;
      });
    };
  }
  for (var i in igit.args) {
    Git.prototype[i] = isoGitCall(i);
  }
  Git.prototype.getOpts = function(opts) {
    if (opts) {
      opts.dir = this.dir;
      opts.fs = this.fs;
      opts.gitdir = this.gitdir;
      opts.http = http;
      opts.cache = this.cache;
      opts.corsProxy = appConfig.gitCorsProxy;
      return opts;
    } else {
      return this;
    }
  };

  function getStatus(item) {
    var status = {
      0: "absent", //might be ignored
      //002 invalid since 2 implies same with workdir
      3: "*deleted",
      4: "*conflict",
      24: "*conflict",
      104: "*conflict",
      114: "*conflict",
      124: "*conflict",
      //001,010,011,012,013,021'invalid since 1 implies head exists',
      20: "*added",
      22: "added",
      23: "*modified", // added, staged, with unstaged changes
      100: "deleted",
      101: "*deleted",
      //102 invalid as 2 implies workdir exists
      103: "*deletedmodified",
      110: "*undeleted",
      111: "unmodified",
      113: "*unmodified",
      120: "*undeletedmodified",
      121: "*modified", //unstaged
      122: "modified",
      123: "*modified" //modified, staged, with unstaged changes
    };
    //status matrix completely skips ignored files
    //by using walk. it also ignores directories
    //but who am i to complain
    var head = item[1] * 100;
    var dir = item[2] * 10;
    var index = item[3];
    return status[head + dir + index] || "*unknown";
  }
  Git.prototype.batchSize = 100;
  Git.prototype.statusAll = function(opts) {
    igit.assert('statusAll', opts);
    return window.git.statusMatrix(this.getOpts(opts)).then(function(e) {
      return e.forEach(function(t) {
        return opts.onEach(t[0], getStatus(t));
      });
    });
  };
  Git.prototype.analyze = isoGitCall('showCheckout');
  Git.prototype.merge = function(opts) {
    igit.assert('merge', opts);
    opts = this.getOpts(opts);
    return mergeHelper().then((function(helper) {
      return helper.merge(opts);
    }).bind(this));
  };
  Git.prototype.completeMerge = function(opts) {
    igit.assert('completeMerge', opts);
    opts = this.getOpts(opts);
    return mergeHelper().then((function(helper) {
      return helper.completeMerge(opts);
    }));
  };
  Git.prototype.setDir = Git;
  Git.prototype.cached = function() {
    var fs = pleaseCache(this.fs);
    fs.postDiscard && fs.postDiscard();
    if (fs !== this.fs) {
      var a = new Git(this.dir, this.gitdir, fs);
      return a;
    }
    return this;
  };
  Git.prototype.clearCache = function() {
    clear();
    if (this.fs.synchronize) {
      this.fs.synchronize();
    }
  };
  global.Git = Git;
}); /*_EndDefine*/
_Define(function(global) {
  var app = window.Application;
  var jgit = window.jgit;
  if (!(app && jgit)) return;
  var Git = global.Git;
  var Utils = global.Utils;
  var FileUtils = global.FileUtils;
  var JGit = function(dir, gitdir) {
    JGit.super(this, arguments); //until we can imolement all methods
    call("setDir", [dir, gitdir || null]);
  };
  var AppFileServer = FileUtils.defaultServer.constructor;
  AppFileServer.prototype.$gitImpl = JGit;
  Utils.inherits(JGit, Git);

  function wrap(f) {
    return function(phase, loaded, total) {
      return f({
        phase: phase,
        loaded: loaded,
        total: total
      });
    };
  }

  function array(t) {
    if (!t) return null;
    if (Array.isArray(t)) return JSON.stringify(t);
    throw Error('Invalid array prop ' + (t.toString ? t.toString() : typeof t));
  }

  function string(t) {
    if (t === undefined || t === null) return null;
    if (typeof t === 'string') return t;
    throw Error('Invalid string prop ' + (t.toString ? t.toString() : typeof t));
  }

  function bool(t) {
    return !!t;
  }
  //Allows asynchronous calls between javascript
  //and java
  var createCb = app.createCallback;

  function clearCb(o) {
    return function() {
      app.clearCallback(o);
    };
  }

  function person(t) {
    return JSON.stringify(t);
  }
  var appConfig = global.registerAll({}, "git");
  var jsonParse = JSON.parse.bind(JSON);
  var currentOp = null;
  var apply = Utils.spread(
    function apply(methodName, args, cb, parse) {
      var result, error;
      try {
        args = args ? args.$getter ? args.$getter() : args : [];
        console.log(args);
        result = jgit[methodName].apply(jgit, args);
        if (parse) {
          result = parse(result);
        }
      } catch (e) {
        console.log(methodName, args, e);
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
    }
  );

  function batchCall(methodName, arr, parse) {
    if (currentOp && currentOp.type == methodName) {
      currentOp.list.push(arr[0]);
      return currentOp.promise;
    } else {
      var i = {
        type: methodName,
        list: arr
      };
      currentOp = i;
      var promise = currentOp.promise = call(methodName, {
        $getter: function() {
          if (i == currentOp) currentOp = null;
          return [array(arr)];
        }
      }, parse);
      return promise;
    }
  }

  function call(methodName, args, parse) {
    return new Promise(function(resolve, reject) {
      apply(methodName, args, function(e, r) {
        if (e) reject(e);
        else resolve(r);
      }, parse);
    });
  }
  JGit.prototype.init = function() {
    modified = true;
    return call("init");
  };
  JGit.prototype.batchSize = 1000;
  JGit.prototype.clone = function(opts, u1, u2, isFetch) {
    if (opts.depth) {
      return Git.prototype[isFetch ? "fetch" : "clone"].call(this, opts);
    }
    modified = true;
    return new Promise(function(resolve, reject) {
      opts.onAuth().then(function(data) {
        var onProgress = createCb(opts.onProgress && wrap(opts.onProgress));

        function done(e, r) {
          clearCb(onProgress);
          clearCb(onComplete);
          if (e) reject(e);
          else resolve(r);
        }
        var onComplete = createCb(done);
        try {
          apply(isFetch == true ? "fetch" : "clone", [opts.singleBranch ? appConfig.defaultBranch : null,
            string(opts.url),
            string(data.username),
            string(data.password),
            onProgress,
            onComplete
          ], Utils.noop);
        } catch (e) {
          done(e);
        }
      });
    });
  };
  JGit.prototype.fetch = function(opts) {
    return this.clone(opts, null, null, true);
  };

  JGit.prototype.checkout = function(opts) {
    //Unsupported options
    if (
      //force checkout only works from index
      (opts.ref !== null && opts.force) ||
      (opts.ref && opts.noUpdateHead &&
        (opts.ref.length !== 40 ||
          opts.ref.startsWith('refs/'))) || //always updates head when given a name
      opts.noCheckout //no equivalent option
    ) {
      return safeCall('checkout').apply(this, arguments);
    }
    modified = true;
    if (opts.ref === undefined) opts.ref = 'HEAD';
    if (opts.noUpdateHead && !opts.filepaths)
      opts.filepaths = ['.'];
    var onProgress = opts.onProgress && createCb(wrap(opts.onProgress));
    return call("checkout", [array(opts.filepaths),
      opts.ref, bool(!opts.noUpdateHead), onProgress
    ]).finally(clearCb(onProgress));
  };
  JGit.prototype.cached = function(op) {
    if (op === 'doMerge') {
      return Git.prototype.cached.call(this);
    }
    return this;
  };
  JGit.prototype.commit = function(opts) {
    modified = true;
    return call("commit", [string(opts.message), person(opts.author)]);
  };
  JGit.prototype.setConfig = function(opts) {
    modified = true;
    return call("setConfig", [opts.path, opts.value]);
  };
  JGit.prototype.getConfig = function(opts) {
    return call("getConfig", [opts.path]);
  };
  // JGit.prototype.addRemote = function(opts) {
  //   return call("addRemote", [opts.remote, opts.url, bool(opts.force)]);
  // };
  JGit.prototype.listRemotes = function() {
    return call("listRemotes", null, jsonParse);
  };
  JGit.prototype.resolveRef = function(opts) {
    return call("resolveRef", [opts.ref], function(ref) {
      if (ref == '0000000000000000000000000000000000000000') {
        throw new Error('NoSuchRefException');
      }
      return ref;
    });
  };
  JGit.prototype.writeRef = function(opts) {
    modified = true;
    return call("writeRef", [opts.ref, opts.oid]);
  };

  function parseStatus(list, all) {
    var paths = {};

    function put(name) {
      return function(file) {
        paths[file] = paths[file] ? paths[file] + name : name;
      };
    }
    //add unmodified files
    list && list.map(put(''));
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
        case '': //111
          return 'unmodified';
        case 'Ad': //22
          return 'added';
        case 'AdMod': //23
        case 'Mod': //121
        case 'ChMod': //123,113
          return '*modified';
        case 'Ch': //122
          return 'modified';
        case 'ChMi': //103
          return '*deletedmodified';
        case 'AdMi': //3
        case 'Mi': //101
          return '*deleted';
        case 'Rm': //100
          return 'deleted';
        case 'RmUn': //120,110
          return '*undeleted';
        case 'Un': //20
          return '*added';
        case 'Ign':
          return 'ignored';
        default:
          if (status.indexOf('Con') > -1) {
            return '*conflict';
          }
          console.log(status);
          return '*unknown';
      }
    }
    return paths;
  }
  JGit.prototype.status = function(opts) {
    return batchCall("statusAll", [opts.filepath], function(strList) {
      return parseStatus([opts.filepath], jsonParse(strList));
    }).then(function(map) {
      return map[opts.filepath] || 'unmodified';
    });
  };
  JGit.prototype.statusAll = function(opts) {
    return call("statusAll", [array(opts.filepaths)], jsonParse).then(function(list) {
      list = parseStatus(opts.filepaths, list);
      for (var i in list) {
        opts.onEach(i, list[i]);
      }
    });
  };
  JGit.prototype.add = function(opts) {
    modified = true;
    return batchCall("add", [opts.filepath]);
  };
  JGit.prototype.remove = function(opts) {
    modified = true;
    return batchCall("remove", [opts.filepath]);
  };
  JGit.prototype.resetIndex = function(opts) {
    return batchCall("resetIndex", [opts.filepath]);
  };
  JGit.prototype.listFiles = function(opts) {
    return call("listFiles", [string(opts && opts.ref)], jsonParse);
  };
  JGit.prototype.log = function() {
    return call("log", null, jsonParse);
  };
  JGit.prototype.branch = function(opts) {
    modified = true;
    return call("branch", [opts.ref]);
  };
  JGit.prototype.deleteBranch = function(opts) {
    modified = true;
    return call("deleteBranch", [opts.ref]);
  };
  JGit.prototype.listBranches = function(opts) {
    if (opts && opts.remote) {
      return Git.prototype.listBranches.call(this, opts);
    }
    return call("listBranches", [string(opts && opts.remote)], jsonParse);
  };
  JGit.prototype.currentBranch = function() {
    return call("currentBranch");
  };

  var modified = true;

  function safeCall(i) {
    return function() {
      //Make sure Git uses updated information
      //but we really want to call when we switch
      //b/w Git and JGit, Git can detect cache changes
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
  var igit = global.IGitProvider;
  for (var i in igit.args) {
    if (!JGit.prototype.hasOwnProperty(i)) {
      JGit.prototype[i] = safeCall(i);
    }
  }
  // }
}); /*_EndDefine*/