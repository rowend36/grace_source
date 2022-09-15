define(function (require, exports, module) {
    var Notify = require('grace/ui/notify').Notify;
    var appConfig = require('grace/core/config').Config.registerAll({}, 'git');
    var GitUtils = require('./git_utils').GitUtils;
    var createProgress = GitUtils.createProgress;
    var failure = GitUtils.failure;
    var testUrl = GitUtils.testUrl;
    /*globals $*/
    /*basic tasks*/
    exports.init = function (ev, prov) {
        prov.init().then(function () {
            Notify.info('New repository created');
            ev.fileview.reload(true);
        }, failure);
    };
    exports.clone = function (ev, prov) {
        var el;
        var progress = createProgress();
        Notify.modal({
            header: 'Clone Repository',
            form: [
                {
                    caption: 'Enter repository url',
                    type: 'text',
                    name: 'repoUrl',
                    value: 'https://github.com/',
                },
                {
                    caption: 'Shallow clone',
                    type: 'accept',
                    name: 'cloneShallow',
                },
                {
                    caption: 'Single branch',
                    type: 'accept',
                    name: 'singleBranch',
                },
                {
                    type: 'div',
                    name: 'singleBranchDiv',
                    children: [
                        {
                            caption: 'Branch to clone',
                            type: 'text',
                            name: 'branchToClone',
                        },
                    ],
                },
            ],
            onCreate: setupModal,
            footers: ['Cancel', 'Clone'],
            dismissible: false,
        });
        function setupModal(modal) {
            el = modal;
            el.find('#singleBranchDiv').hide();
            el.find('#singleBranch').change(function () {
                el.find('#singleBranchDiv').toggle(this.checked);
            });
            el.once('submit', handleSubmit);
        }
        function handleSubmit(ev) {
            var el = $(ev.target);
            ev.preventDefault();
            var result = require('grace/ui/forms').Forms.parse(el[0]);
            if (!testUrl(result.repoUrl)) {
                return Notify.error('Invalid Url');
            } else el.modal('close');
            prov.clone({
                onAuth: function () {
                    return new Promise(function (resolve) {
                        resolve({
                            username: appConfig.gitEmail,
                            password: appConfig.gitPassword,
                        });
                    });
                },
                url: result.repoUrl,
                ref: result.singleBranch ? result.branchToClone : undefined,
                onProgress: progress.update,
                singleBranch: result.singleBranch,
                depth: result.cloneShallow ? 1 : undefined,
            }).then(finish.bind(null, null), finish);
        }
        function finish(e) {
            progress.dismiss();
            if (e) {
                failure(e);
            } else {
                Notify.info('Clone complete');
            }
            ev.fileview.reload();
        }
    };
}); /*_EndDefine*/
