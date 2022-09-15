var fs = require('fs');
var batch = require('../lib/batch');
var crypto = require('crypto');
module.exports = batch(function (arg, cb) {
  const filename = arg.path;
  fs.stat(filename, function (e, stat) {
    if (e && e.code != 'ENOENT') {
      cb(e);
    } else if (e) {
      cb(null, null);
      return;
    }
    const hash = crypto.createHash('sha1');
    let input;
    try {
      input = fs.createReadStream(filename);
    } catch (e) {
      cb(e);
      return;
    }
    hash.update('blob ' + stat.size + '\x00');
    input.on('readable', function () {
      const data = input.read();
      if (data) hash.update(data);
      else {
        cb(null, hash.digest('hex'));
      }
    });
  });
});