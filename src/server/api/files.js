var fs = require('fs');
var doError = require("../lib/error");
var getFiles = function(rootFile, cb) {
    fs.readdir(rootFile, function(e, files) {
        if (e) {
            return cb(e);
        }
        var map = function(file) {
            try{
                if (fs.statSync(rootFile + "/" + file).isDirectory()) {
                    file += "/";
                }
                return file;
            }
            catch(e){
                return file;
            }
        };
        files = files.map(map);
        return cb(null, files);
    });
};
module.exports = function (req, res) {
  try {
    (req.body.appendSlash ? getFiles : fs.readdir)(
      req.body.path,
      function (err, files) {
        if (err) {
          return doError(err, res);
        }
        res.json(files);
        res.end();
      }
    );
  } catch (e) {
    doError(e, res);
  }
};