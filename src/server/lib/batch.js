var createCounter = require('../lib/counter');
var doError = require('./error');

module.exports = function (handleArg) {
  return function (req, res) {
    var results;
    var counter = createCounter(function () {
      res.status(200);
      res.json(results || "");
      res.end();
    });
    counter.increment();
    var args = req.body.args;
    if (!args) {
      counter.increment();
      handleArg(req.body, function (e, r) {
        if (e) doError(e, res);
        else {
          results = r;
          counter.decrement();
        }
      });
    } else {
      results = [];
      args.forEach(function (arg, i) {
        counter.increment();
        handleArg(arg, function (err, res) {
          results[i] = {e: err && err.code, r: res};
          counter.decrement();
        });
      });
    }
    counter.decrement();
  };
};