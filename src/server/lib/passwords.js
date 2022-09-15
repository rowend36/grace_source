var url = require("url");
var doError = require("./error");
var _password;
exports.verify = function (password) {
  return !_password || _password == password;
};
exports.setPassword = function (password) {
  _password = password;
};
exports.middleware = function (req, res, next) {
  if (exports.verify(req.body && req.body.password)) {
    return next();
  }
  var parsed = url.parse(req.url);
  if (parsed.pathname == "/save") {
    return next();
  }
  doError(
    {
      code: "EACCESS",
    },
    res
  );
};