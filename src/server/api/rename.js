var utils = require("../lib/file_utils");
var doError = require("../lib/error");

module.exports = function (req, res) {
  utils.moveFile(req.body.path, req.body.dest, function (e) {
    if (e) {
      return doError(e, res);
    } else {
      res.status(200);
      res.end();
    }
  });
};