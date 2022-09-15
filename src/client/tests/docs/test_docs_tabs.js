define(function (require, exports, module) {
  var expect = require('chai').expect;
  var Docs = require('grace/docs/docs').Docs;
  var storage = require('grace/core/config').storage;
  describe('Setup', function () {
    /**
     * What you get on setup
     */
    it('should load documents', function (done) {
      expect(
        Docs.numDocs(),
        'To run this test you must not load docs'
      ).to.equal(0);
      var store = storage.getItem('docs');
      if (store) {
        store = JSON.parse(store);
      } else store = {};
      require(['grace/setup/setup_docs'], function () {
        try {
          for (var i in store) {
            expect(Docs.has(i) || !Docs.canDiscard(i)).to.equal(true);
          }
          done();
        } catch (e) {
          done(e);
        }
      }, done);
    });
  });
});