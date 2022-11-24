define(function (require, exports, module) {
  var args = {
    /*The ones we're still falling back to isogit for*/
    add: ['filepath'],
    addRemote: ['remote', 'url'],
    analyze: ['?force', '?onProgress'],
    branch: ['ref'],
    checkout: [
      '?filepaths',
      'ref',
      '?force',
      'onProgress',
      '?noCheckout',
      '?noUpdateHead',
    ],
    clone: ['?singleBranch', '?depth', 'url', 'onAuth', '?onProgress'],
    commit: ['message', 'author'],
    completeMerge: [
      '?href',
      'baseOid',
      '?base',
      '?message',
      'ourOid',
      'theirOid',
      'ours',
      'theirs',
      'author',
      'committer',
      '?signingKey',
      'tree',
    ],
    currentBranch: [],
    deleteBranch: ['ref'],
    deleteRemote: ['remote', 'url'],
    ensureIndex: [],
    fetch: ['singleBranch', 'url', 'onAuth', '?onProgress'],
    getConfig: ['path'],
    init: [],
    listBranches: ['?remote'],
    listFiles: ['?ref'],
    listRemotes: [],
    log: [],
    merge: [
      'theirs',
      '?ours',
      'author',
      '?committer',
      '?name',
      '?email',
      '?dryRun',
      '?fastForwardOnly',
      'onProgress',
    ],
    pull: [
      'remote',
      'branch',
      'author',
      '?fastForwardOnly',
      'onAuth',
      'onAuthSuccess',
      'onProgress',
      'onAuthFailure',
    ],
    push: [
      'remote',
      'branch',
      'author',
      '?fastForwardOnly',
      'onAuth',
      'onAuthSuccess',
      'onProgress',
      'onAuthFailure',
    ],
    remove: ['filepath'],
    resetIndex: ['filepath'],
    resolveRef: ['ref'],
    setConfig: ['path', 'value'],
    setDir: ['dir', 'gitdir'],
    status: ['filepath'],
    statusAll: ['?filepaths', 'onEach'],
    writeRef: ['ref', 'oid'],
  };
  var returnTypes = {
    commit: ['oid'],
  };
  exports.IGitProvider = {
    args: args,
    optionalArgs: args,
    returns: returnTypes,
    assert: function (name, opts) {
      opts = opts || {};
      var args = this.args;
      for (var i in opts) {
        if (args[name].indexOf(i) < 0 && args[name].indexOf('?' + i) < 0) {
          if (!/\b(dir|gitdir|corsProxy|cache|http|fs)\b/.test(i))
            throw new Error(i + ' not part of git interface for ' + name);
        }
      }
      for (var k in args[name]) {
        var j = args[name][k];
        if (j.startsWith('?')) continue;
        if (!opts.hasOwnProperty(j))
          throw new Error('Missing interface value ' + j + ' for ' + name);
      }
    },
  };
}); /*_EndDefine*/
