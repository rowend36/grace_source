_Define(function(global) {
    function getStatus(item) {
        var status = {
            0: "absent",
            //1: "*deleted",
            110: "*undeleted",
            120: "*undeletemodified",
            3: "*deleted",
            20: "*added",
            22: "added",
            23: "*modified", // added, staged, with unstaged changes
            111: "unmodified",
            121: "*modified", //unstaged
            122: "modified",
            123: "*modified", //modified, staged, with unstaged changes
            101: "*deleted",
            100: "deleted"
        };
        var head = item[1] * 100;
        var dir = item[2] * 10;
        var index = item[3];
        return status[head + dir + index] || "unknown";
    }
    var calls = {
        
    }
    var args = {
        setDir: ["dir", "gitdir"],
        cached: [],
        analyze: [],
        completeMerge: ["ourOid","theirOid","ours","theirs","author","committer","signingKey","message"],
        merge: ["ourOid","theirOid","ours","theirs","author","committer","signingKey","message"],
        init: ["gitdir"],
        clone: ["singleBranch", "url", "onAuth", "onProgress"],
        fetch: ["singleBranch", "url", "onAuth", "onProgress"],
        checkout: ["filepaths", "force", "onProgress"],
        commit: ["message", "author"],
        setConfig: ["path", "value"],
        getConfig: ["path"],
        addRemote: ["ref", "url"],
        listRemotes: [],
        currentBranch: [],
        resolveRef: ["ref"],
        writeRef: ["ref", "oid"],
        merge: ["theirs", "author", "name", "email", "dryRun", "fastForwardOnly", "onProgress"],
        status: ["filepath"],
        add: ["filepath"],
        remove: ["filepath"],
        resetIndex: ["filepath"],
        listFiles: ["ref"],
        log: [],
        branch: ["ref"],
        deleteBranch: ["ref"],
        listBranches: ["remote"],
    };
    var returnTypes = {
        commit: ["oid"]
    };
    global.IGitProvider = {
        args: args,
        returns: returnTypes
    };
});
_Define(function(global) {
    var igit = global.IGitProvider;
    var appConfig = global.allConfigs.git;
    var pleaseCache = global.createCacheFs;
    var mergeHelper = global.requireMerge();
    var analyze = global.analyze;
    var http = global.http;
    var Git = function(dir, gitdir, fs) {
        this.dir = dir;
        this.gitdir = gitdir;
        this.fs = fs;
    };
    function assertMeetsInterface(name,opts){
        opts = opts || {};
        for(var i in opts){
            if(igit.args[name].indexOf(i)<0){
                console.warn(i+" not part of git interface for "+name);
            }
        }
        for(var j of igit.args[name]){
            if(!opts.hasOwnProperty(j))console.warn('Missing interface value '+j+' for '+name);
        }
    }
    function isoGitCall(name) {
        return function(opts) {
            assertMeetsInterface(name,opts);
            return window.git[name](this.getOpts(opts));
        };
    }
    for (var i in igit.args) {
        Git.prototype[i] = isoGitCall(i);
    }
    Git.prototype.getOpts = function(opts){
        if (opts) {
            opts.dir = this.dir;
            opts.fs = this.fs;
            opts.gitdir = this.gitdir;
            opts.http = http;
            opts.cache = this.cache;
            opts.corsProxy = appConfig.gitCorsProxy;
        }
        else return this;
        return opts;
    };
    Git.prototype.merge = function(opts) {
        return mergeHelper.merge(this.getOpts(opts));
    };
    Git.prototype.completeMerge = function(opts) {
        assertMeetsInterface('completeMerge',opts);
        return mergeHelper.completeMerge(this.getOpts(opts));
    };
    Git.prototype.analyze = function(opts){
        assertMeetsInterface('analyze',opts);
        return analyze(this.getOpts(opts));
    };
    Git.prototype.setDir = Git;
    Git.prototype.cached = function() {
        var fs = pleaseCache(this.fs);
        if (fs !== this.fs) {
            var a = new Git(this.dir, this.gitdir, fs);
            a.cache = this.cache;
            return a;
        }
        return this;
    };
    global.Git = Git;
});