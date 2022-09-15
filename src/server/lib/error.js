var errors = {
  401: "EACCESS",
  402: "EISDIR",
  403: "ENOTEMPTY",
  404: "ENOENT",
  405: "ENOTDIR",
  406: "EXDEV",
  410: "EEXIST",
  412: "ETOOLARGE",
  413: "ENOTENCODING",
};

var errorCodes = {};
for (var i in errors) {
  errorCodes[errors[i]] = Number(i);
}

module.exports = function doError(err, res) {
  res.status(errorCodes[err.code] || 501);
  res.send(err.code || err.message || "SERVER_ERROR");
};