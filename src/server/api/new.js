var fs = require("fs");
var doError = require("../lib/error");

module.exports = function (req, res) {
  fs.mkdir(req.body.path, function (e) {
    if (e) {
      return doError(e, res);
    } else {
      res.send(200);
    }
  });
};