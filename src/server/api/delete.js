var fs = require('fs');
var doError = require("../lib/error");
var utils = require('../lib/file_utils');
module.exports = function (req, res) {
  fs.stat(req.body.path, function (e, s) {
    if (e) {
      return doError(e, res);
    } else {
      let callback = function (e) {
        if (e) {
          return doError(e, res);
        } else {
          res.status(200);
          res.end();
        }
      };
      if (s.isDirectory()) {
        if (req.body.recursive) {
          utils.deleteFolder(req.body.path, callback);
        } else fs.rmdir(req.body.path, callback);
      } else fs.unlink(req.body.path, callback);
    }
  });
};