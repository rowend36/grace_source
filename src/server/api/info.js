var fs = require('fs');
var batch = require('../lib/batch');
module.exports = batch(function (arg, cb) {
  var method = arg.isLstat ? 'lstat' : 'stat';
  fs[method](arg.path, function (e, st) {
    if (st) {
      st = {
        size: st.size,
        mode: st.mode,
        ino: st.ino,
        mtimeMs: st.mtime.getTime(),
        type:
          arg.isLstat && st.isSymbolicLink()
            ? 'symlink'
            : st.isDirectory()
            ? 'dir'
            : 'file',
      };
    }
    cb(e, st);
  });
});