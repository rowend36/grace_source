define(function (require, exports, module) {
  var expect = require('chai').expect;
  var Docs = require('grace/docs/docs').Docs;
  require('../docs/test_docs');
  describe('Setup', function () {
    /**
     * What you get on setup
     */
    var DocsTab,State,getEditor;
    before(function (done) {
      require([
        'grace/setup/setup_tab_host',
        'grace/setup/setup_editors',
        'grace/setup/setup_state',
        'grace/setup/setup_docs',
      ], function (t,e,s) {
        DocsTab = t.DocsTab;
        getEditor = e.getEditor;
        State = s.State;
        done();
      });
    });
    it('should have set the active tab', function () {
      expect(DocsTab.active).to.be.ok;
      expect(Docs.get(DocsTab.active)).be.ok;
    });
    it('should have set the active editor', function () {
      expect(getEditor()).to.be.ok;
    });
    it('should have set state', function () {
      expect(State.is(DocsTab.active)).to.be.true;
    });
  });
});