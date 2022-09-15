var fs = require("fs");
var iconv = require("iconv-lite");
var doError = require("../lib/error");
module.exports = function (req, res) {
  fs.lstat(req.body.path, function (e, stat) {
    if (e) {
      return doError(e, res);
    } else if (stat.size > (req.body.maxSize || 20000000)) {
      return doError(
        {
          code: "ETOOLARGE",
        },
        res
      );
    } else {
      var encoding = req.body.encoding;
      if (!encoding || Buffer.isEncoding(encoding)) {
        fs.readFile(req.body.path, encoding, function (e, str) {
          if (e) {
            return doError(e, res);
          }
          res.send(str);
        });
      } else if (iconv.encodingExists(encoding)) {
        fs.readFile(req.body.path, null, function (e, buf) {
          if (e) {
            return doError(e, res);
          }
          var str = iconv.decode(buf, encoding, {
            stripBom: req.body.stripBom != true,
          });
          res.send(str);
        });
      } else {
        doError(
          {
            code: "ENOTENCODING",
          },
          res
        );
      }
    }
  });
};