/* jshint esversion: 6, esnext:false*/
//Setup
define(function (require, exports, module) {
    'use strict';
    var Dropdown = require('grace/ui/dropdown').Dropdown;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Notify = require('grace/ui/notify').Notify;
    var appConfig = require('grace/core/config').Config.registerAll(
        {
            gitdir: '***',
            disableGit: false,
            gitEmail: '',
            gitUsername: '',
            gitPassword: '*******',
            gitUseCachedStatus: true,
            enableMergeMode: true,
            formatConflict: 'diff3',
            gitCorsProxy: Env.isWebView ? undefined : Env.server + '/git',
            gitSkipGitIgnore: true,
            gitIgnore: [
                'logs',
                '*.log',
                'npm-debug.log*',
                'yarn-debug.log*',
                'yarn-error.log*',
                'firebase-debug.log*',
                'firebase-debug.*.log*',
                '.firebase/',
                '*.pid',
                '*.seed',
                '*.pid.lock',
                'lib-cov',
                'coverage',
                '.nyc_output',
                '.grunt',
                'bower_components',
                '.lock-wscript',
                'build/Release',
                'node_modules/',
                '.npm',
                '.eslintcache',
                '.node_repl_history',
                '*.tgz',
                '.yarn-integrity',
                '.env**/.*',
                '.git',
                '.*-git',
                '.git-status',
                '*~[123]',
            ],
            defaultRemote: undefined,
            defaultRemoteBranch: undefined,
            forceShowStagedDeletes: true,
        },
        'git'
    );

    var configure = require('grace/core/config').Config.configure;
    var join = FileUtils.join;
    var dirname = FileUtils.dirname;
    var isDirectory = FileUtils.isDirectory;
    require('grace/core/config').Config.registerInfo(
        {
            disableGit: 'Hide Git Option in the files menu',
            formatConflict: {
                values: ['diff3', 'diff'],
            },
            defaultRemote: {
                type: 'string|null',
            },
            defaultRemoteBranch: {
                type: 'string|null',
            },
            enableMergeMode: 'Highlight/lint open documents as merge conflicts',
            gitCorsProxy: Env.isWebView
                ? 'no-user-config'
                : {
                      type: '?string',
                      doc:
                          'Proxy to use for cross origin requests. For simple testing, you can try https://cors.isomorphic-git.org/ \nSee isomorphic-git.com/issues',
                  },
            gitPassword:
                'It is advised you use an app password for this. Passwords are stored as plain text.',
            gitdir:
                "The name of the git dir. Git support especially(merging/pulling) is still largely experimental.\n Using '.git' might corrupt your local repository.",
            gitIgnore: 'ignore',
            gitSkipGitIgnore:
                "Ignore .gitignore files. Useful in speeding up status operation when there are a lot of untracked files by using 'appConfig.gitIgnore' instead",
            gitUseCachedStatus:
                'Enables caching to speed up the status operation of large repositiories',
            forceShowStagedDeletes:
                "Set to 'false' if viewStage operation seems too slow",
        },
        'git'
    );

    function findRoot(rootDir, fs) {
        return new Promise(function (resolve, reject) {
            var dir = appConfig.gitdir;
            if (dir == '***') {
                return Notify.ask(
                    'Git support is still experimental. Use .grit instead of .git as git directory?',
                    function () {
                        configure('gitdir', '.grit', 'git', true);
                        findRoot(rootDir, fs).then(resolve, reject);
                    },
                    function () {
                        configure('gitdir', '.git', 'git', true);
                        findRoot(rootDir, fs).then(resolve, reject);
                    }
                );
            }
            var check = function (root) {
                fs.readdir(join(root, dir), function (e) {
                    if (!e) {
                        resolve(root);
                    } else {
                        if (e.code == 'ENOENT') {
                            if (root != '/') {
                                return check(dirname(root));
                            }
                            return resolve(false);
                        } else return reject(e);
                    }
                });
            };
            check(rootDir);
        });
    }
    //FileUtils guarantees only one browser will
    //use overflow at a time
    //global variables are allowed
    var lastEvent;

    function detectRepo(ev, btn, yes, no) {
        require([
            './iso_git',
            './cache_fs',
            './libs/isomorphic-http',
            './libs/isomorphic-git-mod.js',
            './git_interface',
            './git_init',
            './git_status',
            './git_branch',
            './git_commit',
            './git_log',
            './git_config',
            './git_merge',
            'grace/ui/itemlist',
            './git_remote',
            './git_fs',
            './git_diff',
            './merge3highlight',
        ], function (git) {
            if (!ev) return;
            var dir = ev.rootDir;
            lastEvent = ev;
            findRoot(dir, ev.browser.fileServer).then(function (path) {
                var fs = lastEvent.browser.fileServer;
                var GitImpl = fs.$gitImpl || git.Git;
                prov = new GitImpl(
                    path || dir,
                    join(path || dir, appConfig.gitdir),
                    fs
                );
                if (path) {
                    yes.show(btn);
                    if (yes == GitOverflow) {
                        prov.currentBranch().then(
                            GitMenu.currentBranch.update,
                            GitCommands.failure
                        );
                    }
                } else no.show(btn);
            }, GitCommands.failure);
        });
    }
    var GitCommands = require('./git_commands').GitCommands;
    var prov;
    var detectHierarchyRepo = function (ev, btn, yes, no) {
        ev.browser.menu && ev.browser.menu.hide();
        ev.browser.expandFolder(ev.filename, function (cb) {
            detectRepo(
                Object.assign({}, ev, {
                    browser: cb,
                    rootDir: ev.filepath,
                }),
                ev.browser.getElement(ev.filename)[0],
                yes,
                no
            );
        });
    };
    var GitFileMenu = {
        '!update': [
            function (self, update) {
                update(
                    self,
                    isDirectory(lastEvent.filepath || '')
                        ? null
                        : self['!show-file-status']
                );
            },
        ],
        '!show-file-status': {
            caption: 'Show file status',
            command: 'status',
        },
        'stage-file': {
            caption: 'Stage File',
            command: 'add',
        },
        'unstage-file': {
            caption: 'Unstage File',
            command: 'remove',
        },
        'delete-from-tree': {
            caption: 'Delete and Stage',
            command: 'delete',
        },
        'diff-index': {
            caption: 'Show diff',
            command: 'diff',
            sortIndex: 500,
        },
        'checkout-4': Dropdown.defaultLabel('Force Checkout'),
        'do-revert-index-file': {
            icon: 'warning',
            caption: 'Checkout file from index',
            className: 'git-warning-text',
            command: 'doRevertINDEX',
        },
        'do-revert-commit-file': {
            icon: 'warning',
            caption: 'Checkout file from ref',
            className: 'git-warning-text',
            command: 'doRevertCommit',
        },
    };
    var GitFileOverflow = new Dropdown();
    GitFileOverflow.setData(GitFileMenu);

    var NoGitMenu = {
        'init-repo': {
            caption: 'Initialize Repository',
            command: 'init',
        },
        'clone-repo': {
            caption: 'Clone Existing Repository',
            command: 'clone',
        },
    };
    var NoGitOverflow = new Dropdown();
    NoGitOverflow.setData(NoGitMenu);

    var GitMenu = {
        currentBranch: {
            isHeader: true,
            icon: true,
            currentBranch: '',
            caption: '',
            update: function (branch) {
                if (branch != GitMenu.currentBranch.currentBranch) {
                    GitMenu.currentBranch.currentBranch = branch;
                    GitMenu.currentBranch.caption =
                        "<span class='dot green'></span><i class='grey-text'>" +
                        branch +
                        '</i>';
                    GitOverflow.update(GitMenu);
                }
            },
        },
        'do-commit': {
            icon: 'save',
            caption: 'Commit',
            command: 'doCommit',
        },
        'view-stage': {
            icon: 'view_headline',
            caption: 'Repository Status',
            command: 'showStage',
        },
        'show-status': {
            icon: 'view_headline',
            caption: 'Folder Status',
            command: 'statusAll',
        },
        branches: Dropdown.defaultLabel('Branches'),
        'create-branch': {
            icon: 'add',
            caption: 'Create Branch',
            command: 'createBranch',
        },
        'switch-branch': {
            icon: 'swap_horiz',
            caption: 'Checkout Branch',
            command: 'switchBranch',
        },
        'switch-branch-nocheckout': {
            icon: 'home',
            caption: 'Set HEAD branch',
            command: 'switchBranchNoCheckout',
        },
        'do-merge': {
            icon: 'swap_vert',
            caption: 'Merge Branches',
            command: 'doMerge',
        },
        'close-branch': {
            icon: 'delete',
            caption: 'Delete Branch',
            command: 'deleteBranch',
        },
        'git-remotes': Dropdown.defaultLabel('Remotes'),
        'do-pull': {
            icon: 'vertical_align_bottom',
            caption: 'Pull Changes',
            command: 'doPull',
        },
        'do-push': {
            icon: 'vertical_align_top',
            caption: 'Push Changes',
            command: 'doPush',
        },
        'manage-remote': {
            icon: 'link',
            caption: 'Remotes',
            command: 'manageRemotes',
        },
        'repo-actions': {
            icon: 'more_vert',
            caption: 'More...',
            sortIndex: 100000,
            subTree: {
                histpry: Dropdown.defaultLabel('History'),
                'show-logs': {
                    icon: 'history',
                    caption: 'History',
                    command: 'log',
                },
                'browse-logs': {
                    icon: 'history',
                    caption: 'Browse Ref/Commit',
                    command: 'browseCommit',
                },
                'configure-op': Dropdown.defaultLabel('authentication'),
                authentication: {
                    icon: 'account_circle',
                    caption: 'Add Authentication',
                    command: 'doConfig',
                },
                'checkout-5': Dropdown.defaultLabel('Force Checkout'),
                'do-revert-index': {
                    icon: 'warning',
                    caption: 'Checkout index',
                    className: 'git-warning-text',
                    command: 'doRevertINDEX',
                },
                'do-revert-commit': {
                    icon: 'warning',
                    caption: 'Checkout ref',
                    className: 'git-warning-text',
                    command: 'doRevertCommit',
                },
            },
        },
    };
    var GitOverflow = new Dropdown();
    GitOverflow.setData(GitMenu);

    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function (
        e,
        id,
        span,
        data
    ) {
        prov = prov.cached(id);
        if (data.command) {
            GitCommands[data.command](lastEvent, prov);
        } else if (data.onclick) data.onclick(lastEvent, prov);
        return true;
    };
    GitOverflow.ondismiss = GitFileOverflow.ondismiss = NoGitOverflow.ondismiss = function (
        e
    ) {
        var parent = lastEvent.browser.menu;
        if (parent) {
            if (e) {
                if (!e.navigation) parent.onOverlayClick(e);
            } else {
                parent.hide();
            }
        }
    };

    //don't dismiss parent
    var superClose = GitOverflow.close;
    GitOverflow.close = function () {
        superClose.apply(this, {
            navigation: true,
        });
    };

    var GitFileOption = {
        caption: 'Git...',
        id: '!git-file-opts',
        '!update': function (self, update) {
            update(this.id.slice(1), appConfig.disableGit ? null : this);
        },
        onclick: function (ev) {
            detectRepo(
                ev,
                GitFileOption.anchor,
                GitFileOverflow,
                NoGitOverflow
            );
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
    var GitOption = {
        sortIndex: 200,
        caption: 'Git...',
        id: '!git-opts',
        '!update': GitFileOption['!update'],
        onclick: function (ev) {
            lastEvent = ev;
            detectRepo(ev, GitOption.anchor, GitOverflow, NoGitOverflow);
            ev.preventDefault();
            ev.stopPropagation();
        },
        hasChild: true,
        close: false,
    };
    var GitProjectOption = {
        caption: 'Git...',
        id: '!git-project-opts', //overwrites GitOption
        '!update': GitFileOption['!update'],
        sortIndex: 200,
        onclick: function (ev) {
            detectHierarchyRepo(
                ev,
                GitProjectOption.anchor,
                GitOverflow,
                NoGitOverflow
            );
            ev.stopPropagation();
            ev.preventDefault();
        },
        hasChild: true,
        close: false,
    };
    //Add Git option for top bar
    FileUtils.registerOption(['header'], GitOption.id, GitOption);
    //Add Git option for files
    FileUtils.registerOption(
        ['file', 'folder'],
        GitFileOption.id,
        GitFileOption
    );
    //Add Git Opton for project view
    FileUtils.registerOption(
        ['project'],
        GitProjectOption.id,
        GitProjectOption
    );
    //Remove default Git option from project
    FileUtils.registerOption(['project'], GitOption.id, '');

    //AutoLoad
    if (
        FileUtils.channelHasPending('servers-!gitfs') ||
        FileUtils.channelHasPending('diffs-git') ||
        FileUtils.channelHasPending('docs-git-merge')
    ) {
        detectRepo();
    } else if (appConfig.enableMergeMode) {
        require(['./merge3highlight']);
    }
}); /*_EndDefine*/