var utils = require('../lib/file_utils');
var batch = require('../lib/batch');
module.exports = batch(function (arg, cb) {
  utils.copyFile(arg.path, arg.dest, cb, arg.overwrite);
});