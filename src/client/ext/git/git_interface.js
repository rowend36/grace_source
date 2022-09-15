define(function(require,exports,module) {
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
  exports.IGitProvider = {
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
      for (var k in args[name]) {
        var j = args[k];
        if (j.startsWith("?")) continue;
        if (!opts.hasOwnProperty(j)) throw new Error('Missing interface value ' + j + ' for ' + name);
      }
    }
  };
}); /*_EndDefine*/
