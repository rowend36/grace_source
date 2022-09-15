define(function (require, exports, module) {
  'use strict';
  /* globals ace */
  var expect = require('chai').expect;
  describe('Ace Undomanager', function () {
    var session, um, sel;

    before(function () {
      session = ace.createEditSession('');
      um = session.getUndoManager();
      sel = session.selection;
    });
    after(function () {
      session.destroy();
    });
    it('should undo changes', function () {
      session.setValue('Abc ');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), 'Hello');
      expect(session.getValue()).to.equal('Abc Hello');
      um.undo(session);
      expect(session.getValue()).to.equal('Abc ');
      um.redo(session);
      expect(session.getValue()).to.equal('Abc Hello');
    });
    it('should rearrange undos', function () {
      session.setValue('Abc ');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), 'Hi ');
      expect(session.getValue()).to.equal('Abc Hi ');
      var start = um.startNewGroup();
      session.insert(sel.getAnchor(), 'Hello');
      expect(session.getValue()).to.equal('Abc Hi Hello');
      um.markIgnored(start);
      um.undo(session);
      expect(session.getValue()).to.equal('Abc Hello');
      um.redo(session);
      expect(session.getValue()).to.equal('Abc Hi Hello');
    });
    it('should rebase redos', function () {
      session.setValue('Abc');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), '1');
      expect(session.getValue()).to.equal('Abc1');
      um.undo(session);
      expect(session.getValue()).to.equal('Abc');
      um.$keepRedoStack = true;
      session.insert(sel.getAnchor(), '2');
      expect(session.getValue()).to.equal('Abc2');
      um.redo(session);
      expect(session.getValue()).to.equal('Abc21');
    });

    it('should not modify deltas when rearranging', function () {
      session.setValue('Abc');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), '1');
      var deltas = um.getDeltas();
      var checksum = JSON.stringify(deltas);
      var start = um.startNewGroup();
      session.insert(sel.getAnchor(), '2');
      um.markIgnored(start);
      um.undo(session);
      expect(JSON.stringify(deltas)).to.equal(checksum);
    });
    it('should give correct deltas after rearranging', function () {
      session.setValue('Abc');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), '1');
      var start = um.startNewGroup();
      expect(um.getDeltas(start).length).to.equal(0);
      session.insert(sel.getAnchor(), '2');
      um.markIgnored(start);
      um.undo(session);
      expect(um.getDeltas(start).length).to.equal(1);
      um.redo(session); //Now in front of start
      expect(um.getDeltas(start).length).to.equal(0);
    });
    it('should not modify deltas when rebasing', function () {
      session.setValue('Abc');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), '1');
      var deltas = um.getDeltas();
      var checksum = JSON.stringify(deltas);
      um.undo(session);
      um.$keepRedoStack = true;
      session.insert(sel.getAnchor(), '2');
      um.redo(session);
      expect(JSON.stringify(deltas)).to.equal(checksum);
    });
    it('should give correct deltas after rebasing', function () {
      session.setValue('Abc');
      sel.moveCursorLineEnd();
      session.insert(sel.getAnchor(), '1');
      var start = um.startNewGroup();
      expect(um.getDeltas(start).length).to.equal(0);
      um.undo(session);
      um.$keepRedoStack = true;
      session.insert(sel.getAnchor(), '2');
      um.redo(session);
      expect(um.getDeltas(start).length).to.equal(2);
    });
  });
});