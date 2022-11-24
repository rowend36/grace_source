/* jshint esversion: 6, esnext:false*/
//Setup
define(function (require, exports, module) {
    'use strict';
    var Dropdown = require('grace/ui/dropdown').Dropdown;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var Notify = require('grace/ui/notify').Notify;
    var appEvents = require('grace/core/app_events').AppEvents;
    var noop = require('grace/core/utils').Utils.noop;
    var Actions = require('grace/core/actions').Actions;
    var configure = require('grace/core/config').Config.configure;
    var join = FileUtils.join;
    var dirname = FileUtils.dirname;
    var GitUtils = require('./git_utils').GitUtils;
    var isDirectory = FileUtils.isDirectory;
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
    //FileUtils guarantees only one fileview  will
    //use overflow at a time
    //global variables are allowed
    var rootEvent;
    /** @type {import('ui/dropdown').DropdownData} */
    var GitFileMenu = {
        '!update': [
            function (self, update) {
                update(
                    'show-file-status',
                    isDirectory(rootEvent.filepath || '')
                        ? null
                        : self['!show-file-status']
                );
            },
        ],
        '!show-file-status': {
            caption: 'Show file status',
            action: 'status',
        },
        'stage-file': {
            caption: 'Stage File',
            group: 'status',
            action: 'add',
        },
        'unstage-file': {
            caption: 'Unstage File',
            group: 'status',
            action: 'remove',
        },
        'delete-from-tree': {
            caption: 'Delete and Stage',
            group: 'status',
            action: 'delete',
        },
        'diff-index': {
            caption: 'Show diff',
            action: 'diff',
            sortIndex: 500,
        },
        'checkout-4': Dropdown.defaultLabel('Force Checkout'),
        'do-revert-index-file': {
            icon: 'warning',
            caption: 'Checkout file from index',
            className: 'git-warning-text',
            group: 'commit',
            action: 'revertChanges',
        },
        'do-revert-commit-file': {
            icon: 'warning',
            caption: 'Checkout file from ref',
            className: 'git-warning-text',
            group: 'commit',
            action: 'checkoutRef',
        },
    };
    /** @type {import('ui/dropdown').DropdownData} */
    var NoGitMenu = {
        'init-repo': {
            caption: 'Initialize Repository',
            action: 'init',
        },
        'clone-repo': {
            caption: 'Clone Existing Repository',
            group: 'init',
            action: 'clone',
        },
    };

    /** @type {import('ui/dropdown').DropdownData} */
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
            group: 'commit',
            action: 'doCommit',
        },
        'view-stage': {
            icon: 'view_headline',
            caption: 'Repository Status',
            group: 'status',
            action: 'showStage',
        },
        'show-status': {
            icon: 'view_headline',
            caption: 'Folder Status',
            group: 'status',
            action: 'statusAll',
        },
        branches: Dropdown.defaultLabel('Branches'),
        'create-branch': {
            icon: 'add',
            caption: 'Create Branch',
            group: 'branch',
            action: 'createBranch',
        },
        'switch-branch': {
            icon: 'swap_horiz',
            caption: 'Checkout Branch',
            group: 'branch',
            action: 'switchBranch',
        },
        'switch-branch-nocheckout': {
            icon: 'home',
            caption: 'Set HEAD branch',
            group: 'branch',
            action: 'switchBranchNoCheckout',
        },
        'do-merge': {
            icon: 'swap_vert',
            caption: 'Merge Branches',
            group: 'merge',
            action: 'doMerge',
        },
        'close-branch': {
            icon: 'delete',
            caption: 'Delete Branch',
            group: 'branch',
            action: 'deleteBranch',
        },
        'git-remotes': Dropdown.defaultLabel('Remotes'),
        'do-pull': {
            icon: 'vertical_align_bottom',
            caption: 'Pull Changes',
            group: 'merge',
            action: 'doPull',
        },
        'do-push': {
            icon: 'vertical_align_top',
            caption: 'Push Changes',
            group: 'merge',
            action: 'doPush',
        },
        'manage-remote': {
            icon: 'link',
            caption: 'Remotes',
            group: 'remote',
            action: 'manageRemotes',
        },
        'repo-actions': {
            icon: 'more_vert',
            caption: 'More...',
            sortIndex: 100000,
            subTree: {
                historyLabel: Dropdown.defaultLabel('History'),
                'show-logs': {
                    icon: 'history',
                    caption: 'History',
                    action: 'log',
                },
                'browse-logs': {
                    icon: 'history',
                    caption: 'Browse Ref/Commit',
                    group: 'fs',
                    action: 'browseCommit',
                },
                'configure-op': Dropdown.defaultLabel('authentication'),
                authentication: {
                    icon: 'account_circle',
                    caption: 'Add Authentication',
                    group: 'config',
                    action: 'doConfig',
                },
                'checkout-5': Dropdown.defaultLabel('Force Checkout'),
                'do-revert-index': {
                    icon: 'warning',
                    caption: 'Checkout index',
                    className: 'git-warning-text',
                    group: 'commit',
                    action: 'revertChanges',
                },
                'do-revert-commit': {
                    icon: 'warning',
                    caption: 'Checkout ref',
                    group: 'commit',
                    className: 'git-warning-text',
                    action: 'checkoutRef',
                },
            },
        },
    };

    function findRoot(rootDir, fs) {
        return new Promise(function (resolve, reject) {
            var dir = appConfig.gitdir;
            if (dir == '***') {
                return Notify.ask(
                    'Git support is still experimental. Use .grace instead of .git as git directory?',
                    function () {
                        configure('gitdir', '.grace', 'git', true);
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

    //Detect Repositiory When Triggered In Fileview
    function detectRepo(ev, yes, no) {
        require(['./iso_git'], function (git) {
            if (!ev) return;
            var dir = ev.rootDir;
            rootEvent = ev;
            findRoot(dir, ev.fs).then(function (path) {
                var fs = rootEvent.fs;
                var GitImpl = fs.$gitImpl || git.Git;
                prov = new GitImpl(
                    path || dir,
                    join(path || dir, appConfig.gitdir),
                    fs
                );
                if (path) {
                    yes.show(ev.anchor);
                    if (yes == GitOverflow) {
                        prov.currentBranch().then(
                            GitMenu.currentBranch.update,
                            GitUtils.failure
                        );
                    }
                } else no.show(ev.anchor);
            }, GitUtils.failure);
        });
    }

    var prov;

    //Detect Repositiory When Triggered In Projectview
    var detectProjectRepo = function (ev, yes, no) {
        ev.fileview.menu && ev.fileview.menu.hide();
        ev.fileview.expandFolder(ev.filename, function (cb) {
            detectRepo(
                Object.assign({}, ev, {
                    fileview: cb,
                    rootDir: ev.filepath,
                    anchor: ev.fileview.getElement(ev.filename)[0],
                }),
                yes,
                no
            );
        });
    };

    //Detect Repository when triggered by Command
    var detectExecRepo = function (ev) {
        var item = this;
        if (!ev.fileview)
            ev.fileview = {
                reload: noop,
            };
        if (!ev.rootDir) {
            return false;
        }
        var dir = ev.rootDir;
        var file = './git_' + (item.group || item.action);
        require(['./iso_git', file], function (git, mod) {
            findRoot(dir, ev.fs).then(function (path) {
                var fs = ev.fs;
                if (!path) {
                    path = FileUtils.getProject().rootDir;
                    if (
                        !dir.startsWith(path) &&
                        (item.id === 'git.init' || item.id === 'git.clone')
                    ) {
                        path = dir;
                    } else {
                        fs = FileUtils.getProject().fileServer;
                    }
                }
                var GitImpl = fs.$gitImpl || git.Git;
                prov = new GitImpl(path, join(path, appConfig.gitdir), fs);
                mod[item.action](ev, prov);
            });
        });
    };
    var GitFileOverflow = new Dropdown();
    var NoGitOverflow = new Dropdown();
    var GitOverflow = new Dropdown();

    GitFileOverflow.setData(GitFileMenu);
    NoGitOverflow.setData(NoGitMenu);
    GitOverflow.setData(GitMenu);

    GitOverflow.onclick = GitFileOverflow.onclick = NoGitOverflow.onclick = function (
        e,
        id,
        span,
        data
    ) {
        prov = prov.cached(id);
        if (!data.action) return false;
        var file = './git_' + (data.group || data.action);
        require([file], function (mod) {
            mod[data.action](rootEvent, prov);
        });
        return true; //Not used
    };
    GitOverflow.ondismiss = GitFileOverflow.ondismiss = NoGitOverflow.ondismiss = function (
        e
    ) {
        var parent = rootEvent.fileview.menu;
        rootEvent = null;
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
    //Add the Actions
    (function () {
        function createAction(item) {
            if (item.action) {
                item.description = 'Git: ' + item.caption;
                item.name = 'git.' + item.action;
                item.handle = detectExecRepo;
                item.showIn = 'editor';
                Actions.addAction(item);
            }
            if (item.subTree) {
                for (var i in item.subTree) {
                    createAction(item.subTree[i]);
                }
            }
        }
        for (var i in GitMenu) {
            createAction(GitMenu[i]);
        }
        for (i in GitFileMenu) {
            createAction(GitFileMenu[i]);
        }
        for (i in NoGitMenu) {
            createAction(NoGitMenu[i]);
        }
    })();
    Actions.addAction({
        caption: 'Git...',
        name: 'gitFileOption',
        isAvailable: function (self, update) {
            return !appConfig.disableGit;
        },
        showIn: ['fleview.file', 'fileview.folder'],
        handle: function (ev) {
            detectRepo(ev, GitFileOverflow, NoGitOverflow);
            ev.preventDefault();
        },
        hasChild: true,
        dontClose: true,
    });
    Actions.addAction({
        sortIndex: 200,
        caption: 'Git...',
        name: 'gitProjectOption',
        isAvailable: function (self, update) {
            return !appConfig.disableGit;
        },
        showIn: 'fileview.header',
        handle: function (ev) {
            (ev.fileview.isProjectView ? detectProjectRepo : detectRepo)(
                ev,
                GitOverflow,
                NoGitOverflow
            );
            ev.preventDefault();
        },
        hasChild: true,
        dontClose: true,
    });

    //AutoLoad
    if (FileUtils.channelHasPending('servers-!gitfs')) require(['./git_fs']);
    appEvents.on('documentsLoaded', function () {
        if (FileUtils.channelHasPending('diffs-git')) require(['./git_diff']);
        if (FileUtils.channelHasPending('docs-git-merge'))
            require(['./merge_doc']);
    });
    if (appConfig.enableMergeMode) {
        require(['./merge3highlight']);
    }
}); /*_EndDefine*/