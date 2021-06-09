_Define(function(global) {
  var args = {
    /*The ones we're still falling back to isogit for*/
    analyze: ["?force", "?onProgress"],
    completeMerge: ["ourOid", "theirOid", "ours", "theirs", "author", "committer", "signingKey", "message"],
    merge: ["theirs", "author", "name", "email", "dryRun", "fastForwardOnly", "onProgress"],
    setDir: ["dir", "gitdir"],
    init: [],
    clone: ["singleBranch", "url", "onAuth", "?onProgress"],
    fetch: ["singleBranch", "url", "onAuth", "?onProgress"],
    checkout: ["?filepaths", "ref", "?force", "onProgress", "?noCheckout"],
    commit: ["message", "author"],
    setConfig: ["path", "value"],
    getConfig: ["path"],
    addRemote: ["remote", "url"],
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
          if (!/\b(dir|gitdir|corsProxy|cache|http|fs)\b/.test(i)) throw new Error(i + " not part of git interface for " +
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
  var mergeHelper = global.requireMerge();
  var analyze = global.analyze;
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
      return window.git[name](this.getOpts(opts));
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
  Git.prototype.statusAll = function(opts) {
    igit.assert('statusAll', opts);
    return window.git.statusMatrix(this.getOpts(opts)).then(function(e) {
      return e.forEach(function(t, i) {
        return opts.onEach(t[0], getStatus(t));
      });
    });
  };
  Git.prototype.merge = function(opts) {
    return mergeHelper.merge(this.getOpts(opts));
  };
  Git.prototype.completeMerge = function(opts) {
    igit.assert('completeMerge', opts);
    return mergeHelper.completeMerge(this.getOpts(opts));
  };
  Git.prototype.analyze = function(opts) {
    igit.assert('analyze', opts);
    return analyze(this.getOpts(opts));
  };
  Git.prototype.setDir = Git;
  Git.prototype.cached = function() {
    var fs = pleaseCache(this.fs);
    if (fs !== this.fs) {
      var a = new Git(this.dir, this.gitdir, fs);
      return a;
    }
    return this;
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
  var JGit = function(dir, gitdir, fs, cache) {
    JGit.super(this, arguments); //until we can imolement all methods
    call("setDir", [dir, gitdir || null]);
  };
  var AppFileServer = FileUtils.defaultServer.constructor;
  AppFileServer.prototype.$gitImpl = JGit;
  Utils.inherits(JGit, Git);

  function wrap(f) {
    var temp = {
      func: f
    };
    return Utils.wrap(temp), temp.f;
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
  var createCb = app.createCallback;

  function clearCb(o) {
    return function() {
      app.clearCallback(o);
    };
  }

  function person(t) {
    return JSON.stringify(t);
  }
  var jsonParse = JSON.parse.bind(JSON);
  var currentOp = null;
  var apply = Utils.batch(function(methodName, args, cb, parse) {
    var result, error;
    try {
      result = jgit[methodName].apply(jgit, args ? args.$getter ? args.$getter() : args : []);
      if (parse) {
        result = parse(result);
      }
    } catch (e) {
      console.error(jgit.getError());
      console.log(e);
      error = e;
    }
    cb(error, result);
  });
  function batchCall(methodName, arr) {
    if (currentOp && currentOp.type == methodName) {
      currentOp.list.push(arr[0]);
      return currentOp.promise;
    } else {
      var i = {
        type: methodName,
        list: arr
      };
      currentOp =i;
      var promise = currentOp.promise = call(methodName, {
        $getter: function() {
          if (i == currentOp) currentOp = null;
          return [array(arr)];
        }
      });
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
  JGit.prototype.init = function(gitdir) {
    return call("init");
  };
  JGit.prototype.batchSize = 1000;
  JGit.prototype.clone = function(opts) {
    var onProgress = opts.onProgress && createCb(wrap(opts.onProgress));
    return new Promise(function(resolve, reject) {
      opts.onAuth().then(function(data) {
        apply("clone", [opts.singleBranch ? "HEAD" : null, opts.url, data.username, data.password, onProgress],
          function(e, r) {
            clearCb(onProgress);
            if (e) reject(e);
            else resolve(r);
          });
      });
    });
  };
  JGit.prototype.fetch = function(opts) {
    var onProgress = opts.onProgress && createCb(wrap(opts.onProgress));
    return new Promise(function(resolve, reject) {
      opts.onAuth().then(function(data) {
        apply("fetch", [opts.singleBranch ? "HEAD" : null, opts.url, data.username, data.password, onProgress],
          function(e, r) {
            clearCb(onProgress);
            if (e) reject(e);
            else resolve(r);
          });
      });
    });
  };
  JGit.prototype.checkout = function(opts) {
    if (opts.noCheckout) return Git.prototype.checkout.apply(this, arguments);
    var onProgress = opts.onProgress && createCb(wrap(opts.onProgress));
    return call("checkout", [array(opts.filepaths),
      opts.ref, bool(opts.force), onProgress
    ]).finally(clearCb(onProgress));
  };
  JGit.prototype.cached = function(willMerge) {
    if (willMerge) {
      return Git.prototype.cached.call(this);
    }
    return this;
  };
  JGit.prototype.commit = function(opts) {
    return call("commit", [string(opts.message), person(opts.author)]);
  };
  JGit.prototype.setConfig = function(opts) {
    return call("setConfig", [opts.path, opts.value]);
  };
  JGit.prototype.getConfig = function(opts) {
    return call("getConfig", [opts.path]);
  };
  JGit.prototype.addRemote = function(opts) {
    return call("addRemote", [opts.remote, opts.url]);
  };
  JGit.prototype.listRemotes = function(opts) {
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
    return call("writeRef", [opts.ref, opts.oid]);
  };

  function parseStatus(list, all) {
    var paths = {};

    function put(name) {
      return function(file) {
        paths[file] = paths[file] ? paths[file] + name : name;
      };
    }
    list && list.map(put(''));
    all.added.length && all.added.map(put("Ad"));
    all.changed.length && all.changed.map(put("Ch"));
    all.removed.length && all.removed.map(put("Rm"));
    all.modified.length && all.modified.map(put("Mod"));
    all.missing.length && all.missing.map(put("Mi"));
    all.untracked.length && all.untracked.map(put("Un"));
    all.conflicting.length && all.conflicting.map(put("Con")); //not used
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
          console.log(status);
          return '*unknown';
      }
    }
    return paths;
  }
  JGit.prototype.status = function(opts) {
    return call("status", [opts.filepath], jsonParse).then(function(status) {
      return parseStatus([opts.filepath], status)[opts.filepath];
    });
  };
  JGit.prototype.statusAll = function(opts) {
    return call("statusAll", [array(opts.filepaths)], jsonParse).then(function(all) {
      all = parseStatus(opts.filepaths, all);
      for (var i in all) {
        opts.onEach(i, all[i]);
      }
    });
  };
  JGit.prototype.add = function(opts) {
    return batchCall("add", [opts.filepath]);
  };
  JGit.prototype.remove = function(opts) {
    return batchCall("remove", [opts.filepath]);
  };
  JGit.prototype.resetIndex = function(opts) {
    return batchCall("resetIndex", [opts.filepath]);
  };
  JGit.prototype.listFiles = function(opts) {
    return call("listFiles", [string(opts && opts.ref)], jsonParse);
  };
  JGit.prototype.log = function(opts) {
    return call("log", null, jsonParse);
  };
  JGit.prototype.branch = function(opts) {
    return call("branch", [opts.ref]);
  };
  JGit.prototype.deleteBranch = function(opts) {
    return call("deleteBranch", [opts.ref]);
  };
  JGit.prototype.listBranches = function(opts) {
    return call("listBranches", [string(opts && opts.remote)], jsonParse);
  };
  JGit.prototype.currentBranch = function() {
    return call("currentBranch");
  };
  // function isoGitCall(name) {
  //     var t = JGit.prototype[name];
  //     return function(opts) {
  //         igit.assert(name, opts);
  //         return t.call(this, opts);
  //     };
  // }
  // for (var i in igit.args) {
  //     if (JGit.prototype.hasOwnProperty(i)) {
  //         JGit.prototype[i] = isoGitCall(i);
  //     } else JGit.prototype[i] = function(){
  //         if[this.cached]
  //             throw 'Error: Unsupported operation'
  //     };
  // }
}); /*_EndDefine*/