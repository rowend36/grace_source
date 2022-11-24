define(function (require, exports, module) {
  var igit = require('./git_interface').IGitProvider;
  var appConfig = require('grace/core/config').Config.registerAll(null, 'git');
  var pleaseCache = require('./cache_fs').createCacheFs;
  var mergeHelper = function () {
    return new Promise(function (resolve, reject) {
      require([
        './libs/diff3/diff3',
        './interactive_merge',
      ], function (diff3, merge) {
        resolve(merge.InteractiveMerge);
      }, reject);
    });
  };
  var loadGit = function () {
    return new Promise(function (resolve, reject) {
      require(['./libs/isomorphic-git-mod.js'], function () {
        resolve(window.git);
      }, reject);
    });
  };
  var gc = require('grace/core/app_events').AppEvents;
  var Utils = require('grace/core/utils').Utils;
  var http = require('./libs/isomorphic-http').http;
  var cache;
  // fileCache;
  /*caching*/
  function clear() {
    if (cache) cache = null;
    // fileCache = null;
  }
  var clearCache = Utils.debounce(clear, 10000);
  gc.on('appPaused', clear);

  function getCache() {
    clearCache();
    return cache || (cache = {});
  }
  var Git = function (dir, gitdir, fs) {
    this.dir = dir;
    this.gitdir = gitdir;
    this.fs = fs;
    this.cache = getCache();
  };

  function isoGitCall(name) {
    return function (opts) {
      igit.assert(name, opts);
      opts = this.getOpts(opts);
      return loadGit()
        .then(function (git) {
          return git[name](opts);
        })
        .catch(function (err) {
          throw err;
        });
    };
  }
  for (var i in igit.args) {
    Git.prototype[i] = isoGitCall(i);
  }
  Git.prototype.getOpts = function (opts) {
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
      0: 'absent', //might be ignored
      //002 invalid since 2 implies same with workdir
      3: '*deleted',
      4: '*conflict',
      24: '*conflict',
      104: '*conflict',
      114: '*conflict',
      124: '*conflict',
      //001,010,011,012,013,021'invalid since 1 implies head exists',
      20: '*added',
      22: 'added',
      23: '*modified', // added, staged, with unstaged changes
      100: 'deleted',
      101: '*deleted',
      //102 invalid as 2 implies workdir exists
      103: '*deletedmodified',
      110: '*undeleted',
      111: 'unmodified',
      113: '*unmodified',
      120: '*undeletedmodified',
      121: '*modified', //unstaged
      122: 'modified',
      123: '*modified', //modified, staged, with unstaged changes
    };
    //status matrix completely skips ignored files
    //by using walk. it also ignores directories
    //but who am i to complain
    var head = item[1] * 100;
    var dir = item[2] * 10;
    var index = item[3];
    return status[head + dir + index] || '*unknown';
  }
  Git.prototype.batchSize = 100;
  Git.prototype.statusAll = function (opts) {
    igit.assert('statusAll', opts);
    return window.git.statusMatrix(this.getOpts(opts)).then(function (e) {
      return e.forEach(function (t) {
        return opts.onEach(t[0], getStatus(t));
      });
    });
  };
  Git.prototype.analyze = isoGitCall('showCheckout');
  Git.prototype.merge = function (opts) {
    igit.assert('merge', opts);
    opts = this.getOpts(opts);
    return mergeHelper().then(
      function (helper) {
        return helper.merge(opts);
      }.bind(this)
    );
  };
  Git.prototype.completeMerge = function (opts) {
    igit.assert('completeMerge', opts);
    opts = this.getOpts(opts);
    return mergeHelper().then(function (helper) {
      return helper.completeMerge(opts);
    });
  };
  Git.prototype.setDir = Git;
  Git.prototype.cached = function () {
    var fs = pleaseCache(this.fs);
    fs.postDiscard && fs.postDiscard();
    if (fs !== this.fs) {
      var a = new Git(this.dir, this.gitdir, fs);
      return a;
    }
    return this;
  };
  Git.prototype.clearCache = function () {
    clear();
    if (this.fs.synchronize) {
      this.fs.synchronize();
    }
  };
  exports.Git = Git;
}); /*_EndDefine*/
