var exec = require("child_process").exec;
var env = Object.create(process.env);
env.PATH =
  "/data/user/0/io.tempage.dorynode/files/usr/sbin:/data/user/0/io.tempage.dorynode/files/usr/bin:/data/user/0/io.tempage.dorynode/files/sbin:/data/user/0/io.tempage.dorynode/files/bin:/sbin:/system/sbin:/system/bin:/system/xbin:/odm/bin:/vendor/bin:/vendor/xbin";

module.exports = function (req, res) {
  exec(
    req.body.command,
    {
      cwd: req.body.currentDir,
      env: env,
    },
    (error, stdout, stderr) => {
      var result = {};
      result.error = (error ? error + "\n" : "") + (stderr || "");
      result.output = stdout;
      res.send(JSON.stringify(result));
    }
  );
};