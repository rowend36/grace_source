define(function (require, exports, module) {
    'use strict';
    var history = require('grace/docs/history_saver');
    var patch = require('grace/ext/docs/doc_patch'); //also needed to make onRemoteChange synchronous
    var Doc = require('grace/docs/document').Doc;
    var expect = require('chai').expect;
    describe('Synchronize docs', function () {
        var local, remote;
        before(function () {
            local = new Doc(); //prevent clearing history
            local.setHistory(local.createHistory());
            remote = local.fork();
        });
        after(function () {
            local.destroy();
            remote.destroy();
        });
        function sync(from, to, result) {
            expect(from.getValue()).to.equal(result);
            expect(history.onRemoteChange(to, from.serialize())).to.equal(true);
            expect(to.getValue()).to.equal(from.getValue());
            from.getRevision();
            to.getRevision();
        }
        it('should work', function () {
            local.insert({row: 0, column: 0}, 'Abc');
            local.insert({row: 0, column: 3}, ' Hi');
            sync(local, remote, 'Abc Hi');
        });
        it('should handle swap transition', function () {
            local.setValue('');
            local.getRevision();
            local.insert({row: 0, column: 0}, 'Intro: ');
            var rev = local.getRevision();
            local.insert({row: 0, column: 11}, 'Edith');
            local.session.getUndoManager().markIgnored(rev);
            sync(local, remote, 'Intro: Edith');
            local.session.getUndoManager().undo(local.session);
            sync(local, remote, 'Edith');
        });
        it('should handle no common history', function () {
            local.clearHistory();
            remote.clearHistory();
            local.insert({row: 0, column: 0}, 'New: ');
            sync(local, remote, 'New: Edith');
        });
        it('should transform patches', function () {
            local.setValue('Common.');
            local.getRevision();
            local.setValue('');
            sync(local, remote, '');
            var origin = local.fork();
            local.session.getUndoManager().undo(local.session);
            local.insert({row: 0, column: 7}, ' Local change.');
            remote.session.getUndoManager().undo(remote.session);
            remote.insert({row: 0, column: 7}, ' Remote change.');
            var patch1 = patch.getPatch(
                origin.session.getUndoManager(),
                local.session.getUndoManager(),
                'local'
            ); //Also adds origin property to deltas
            var patch2 = patch.getPatch(
                origin.session.getUndoManager(),
                remote.session.getUndoManager()
            );
            var patch3 = patch.transform(
                patch2,
                patch1,
                origin.session.getUndoManager()
            );
            sync(local, remote, 'Common. Local change.');
            patch.applyPatch(
                patch3,
                local.session.getUndoManager(),
                local.session
            );
            sync(local, remote, 'Common. Local change. Remote change.');
        });
        it('should transform patches 2', function () {
            local.setValue('Common.');
            local.getRevision();
            local.setValue('');
            sync(local, remote, '');
            var origin = local.fork();
            local.session.getUndoManager().undo(local.session);
            local.insert({row: 0, column: 7}, ' Local change.');
            remote.session.getUndoManager().undo(remote.session);
            remote.insert({row: 0, column: 7}, ' Remote change.');
            var patch1 = patch.getPatch(
                origin.session.getUndoManager(),
                local.session.getUndoManager(),
                'local'
            ); //Also adds origin property to deltas
            var patch2 = patch.getPatch(
                origin.session.getUndoManager(),
                remote.session.getUndoManager()
            );
            var patch3 = patch.transform(
                patch1,
                patch2,
                origin.session.getUndoManager()
            );

            patch.applyPatch(
                patch3,
                remote.session.getUndoManager(),
                remote.session
            );
            sync(remote, local, 'Common. Remote change. Local change.');
        });
    });
});