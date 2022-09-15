var utils = require("../lib/file_utils");
var doError = require("../lib/error");

module.exports = function (req, res) {
  utils.copyFolder(
    req.body.path,
    req.body.dest,
    function (err) {
      if (err) {
        return doError(err, res);
      } else {
        res.send(200);
      }
    },
    req.body.overwrite,
    req.body.forcelist
  );
};