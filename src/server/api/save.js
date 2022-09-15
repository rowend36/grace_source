var ArgsCounter = require("../lib//args_counter");
var iconv = require('iconv-lite');
var doError = require('../lib/error');
var fs = require('fs');
var multiparty = require("multiparty");
var passwords = require("../lib/passwords");
module.exports = function (req, res) {
  var form = new multiparty.Form();
  var ended;
  var end = function (e) {
    if (!ended) {
      ended = true;
      if (e) {
        console.error("Error saving form " + JSON.stringify(e));
        doError(e, res);
      } else {
        res.status(200);
        res.end();
      }
    } else {
      console.error(["End called twice", e]);
    }
  };
  var batch = new ArgsCounter(4, function (stream, path, encoding, pass) {
    try {
      if (!passwords.verify(pass)) {
        return end({
          code: "EACCESS",
        });
      }
      if (encoding && encoding != "undefined" && encoding != "null") {
        if (!iconv.encodingExists(encoding)) {
          stream.resume();
          return end({
            code: "ENOTENCODING",
          });
        } else {
          stream = stream
            .pipe(iconv.decodeStream("utf8"))
            .pipe(iconv.encodeStream(encoding));
        }
      }
      var fd = fs.createWriteStream(path);
      fd.on("error", function (err) {
        fd.end();
        end(err);
      });
      fd.on("close", function () {
        fd.end();
        end();
      });
      stream.pipe(fd);
    } catch (e) {
      end(e);
    }
  });
  form.on("field", function (name, value) {
    if (name == "encoding") {
      batch.push(2, value);
    } else if (name == "password") {
      batch.push(3, value);
    }
  });
  form.on("part", function (part) {
    if (part.filename) {
      if (part.name == "content") {
        batch.push(0, part);
        batch.push(1, part.filename);
        return batch.end();
      }
    }
    part.resume();
  });
  form.on("close", batch.end);
  form.on("error", end);
  form.parse(req);
};