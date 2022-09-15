module.exports = function (req, res) {
  var encodings = require("iconv-lite/encodings");
  res.json(Object.keys(encodings));
};