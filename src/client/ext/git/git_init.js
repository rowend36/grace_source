define(function(require,exports,module) {
    var Notify = require("grace/ui/notify").Notify;
    var appConfig = require("grace/core/config").Config.registerAll({}, "git");
    var GitCommands = require("./git_commands").GitCommands;
    var createProgress = GitCommands.createProgress;
    var failure = GitCommands.failure;
    var testUrl = GitCommands.testUrl;
    /*basic tasks*/
    GitCommands.writeFile = function(name, content, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.mkdir(dir + "/grace", function() {
            fs.writeFile(dir + "/grace/" + name, content, cb);
        });
    };
    GitCommands.readFile = function(name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.readFile(dir + "/grace/" + name, 'utf8', cb);
    };
    GitCommands.removeFile = function(name, prov, cb) {
        var fs = prov.fs;
        var dir = prov.gitdir;
        fs.unlink(dir + "/grace/" + name, cb);
    };
    GitCommands.init = function(ev, prov) {
        prov.init().then(function() {
            Notify.info("New repository created");
            ev.browser.reload(true);
        }, failure);
    };
    GitCommands.clone = function(ev, prov) {
        var progress = createProgress();
        var el = $(Notify.modal({
            header: "Clone Repository",
            form: [{
                    caption: 'Enter repository url',
                    type: 'text',
                    name: 'repoUrl',
                    value: "https://github.com/"
                },
                {
                    caption: 'Shallow clone',
                    type: 'accept',
                    name: 'cloneShallow'
                },
                {
                    caption: 'Single branch',
                    type: 'accept',
                    name: 'singleBranch'
                },
                {
                    type: "div",
                    name: "singleBranchDiv",
                    children: [{
                        caption: 'Branch to clone',
                        type: 'text',
                        name: 'branchToClone'
                    }]
                }
            ],
            footers: ['Cancel', 'Clone'],
            dismissible: false
        }));
        el.find("#singleBranchDiv").hide();
        el.find('#singleBranch').change(function() {
            el.find("#singleBranchDiv").toggle(this.checked);
        });
        el.on("submit", function(e) {
            e.preventDefault();
            var result = require("grace/ui/forms").Forms.parse(el[0]);
            if (!testUrl(result.repoUrl)) {
                return Notify.error("Invalid Url");
            }
            el.modal("close");
            prov.clone({
                onAuth: function() {
                    return new Promise(function(resolve) {
                        resolve({
                            username: appConfig.gitEmail,
                            password: appConfig.gitPassword
                        });
                    });
                },
                url: result.repoUrl,
                ref: result.singleBranch ? result.branchToClone : undefined,
                onProgress: progress.update,
                singleBranch: result.singleBranch,
                depth: result.cloneShallow ? 1 : undefined
            }).then(function() {
                progress.dismiss();
                Notify.info("Clone complete");
                ev.browser.reload();
            }, function(e) {
                failure(e);
                progress.dismiss();
                ev.browser.reload();
            });
        });
    };
}); /*_EndDefine*/
