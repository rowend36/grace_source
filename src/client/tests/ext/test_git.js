define(function (require, exports, module) {
    'use strict';
    var expect = require('chai').expect;
    var createEvent = require('grace/core/actions').createEvent;
    var FileUtils = require('grace/core/file_utils').FileUtils;
    var waterfall = require('grace/core/utils').Utils.waterfall;
    var Git = require('grace/ext/git/iso_git').Git;
    require('grace/setup/setup_editors');
    require('../docs/test_docs_tabs');
    // require('grace/ext/git/git');
    function call(method, args, cb, timeout) {}
    var fs = FileUtils.getFileServer();
    var ROOT_DIR = fs.getRoot() + 'git';
    function file(path, cb) {
        fs.writeFile(FileUtils.join(ROOT_DIR, path), '', cb);
    }
    describe('Git', function () {
        var GitImpl = fs.$gitImpl || Git;
        var prov = new GitImpl(ROOT_DIR, FileUtils.join(ROOT_DIR, '.git'), fs);

        before(function (done) {
            this.timeout(5000);
            waterfall([
                function (n) {
                    require(['grace/setup/setup_docs'], n);
                },
                function (n) {
                    fs.delete(ROOT_DIR, n);
                },
                function (n) {
                    fs.mkdir(ROOT_DIR, n);
                },
                function (n) {
                    file('main.js', n);
                },
                function (n) {
                    FileUtils.openDoc(ROOT_DIR + '/main.js', null, n);
                },
                true,
                done,
            ]);
        });
        describe('Git: init', function () {
            it('should create new repository from commands', function (done) {
                waterfall([
                    function (n) {
                        var event = createEvent();
                        //This is also in charge of loading some needed files
                        event.editor.execCommand('git.init', event);
                        return setTimeout(n, 1000);
                    },
                    function (n) {
                        fs.readFile(ROOT_DIR + '/.git/index', n);
                    },
                    function (n, e) {
                        expect(e).to.not.be.ok;
                    },
                    done,
                ]);
            });
        });
        describe.skip('Git: clone', function () {
            it('should clone', function (done) {
                waterfall([
                    function (n) {
                        prov.clone({
                            url:
                                'https://github.com/Krafalski/git-submodule-test.git',
                            onAuth: null,
                        }).then(n);
                    },
                    true,
                    done,
                ]);
            });
            it('should clone shallow and singleBranch', function (done) {
                waterfall([
                    function (n) {
                        prov.clone({
                            url:
                                'https://github.com/Krafalski/git-submodule-test.git',
                            singleBranch: 'main',
                            depth: 1,
                            onAuth: null,
                        }).then(n);
                    },
                    true,
                    done,
                ]);
            });
        });
        describe('Git: add', function () {
            it('should ', function (done) {
                waterfall([
                    function (n) {
                        fs.writeFile(ROOT_DIR + '/main.js', 'branch: main', n);
                    },
                    function (n) {
                        prov.add({filepath: ROOT_DIR + '/main.js'}).then(
                            n.bind(null, null),
                            n
                        );
                    },
                    true,
                    done,
                ]);
            });
        });
        describe('Git: status', function () {
            it('should ', function (done) {
                waterfall([
                    function (n) {
                        prov.status({filepath: ROOT_DIR + '/main.js'}).then(
                            n.bind(null, null),
                            n
                        );
                    },
                    function (n, err, status) {
                        expect(status).to.be('added');
                    },
                    true,
                    done,
                ]);
            });
        });
        // describe('Git: remove', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('remove', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: delete', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('delete', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: diff', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('diff', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: doCommit', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('doCommit', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: revertChanges', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('revertChanges', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: checkoutRef', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('checkoutRef', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: showStage', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('showStage', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: statusAll', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('statusAll', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: createBranch', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('createBranch', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: switchBranch', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('switchBranch', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: switchBranchNoCheckout', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('switchBranchNoCheckout', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: doMerge', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('doMerge', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: deleteBranch', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('deleteBranch', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: doPull', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('doPull', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: doPush', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('doPush', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: manageRemotes', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('manageRemotes', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: log', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('log', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: browseCommit', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('browseCommit', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
        // describe('Git: doConfig', function () {
        //     it('should ', function (done) {
        //         waterfall([
        //             function () {
        //                 call('doConfig', {});
        //             },
        //             true,
        //             done,
        //         ]);
        //     });
        // });
    });
});