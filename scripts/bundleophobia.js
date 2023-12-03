#!/usr/bin/env node
/**
 * Redefine removes dependencies from a dependency array
 * That are guaranteed to be defined at runtime.
 */
var path = require('path');
var fs = require('fs');
var RE = /[^\.]\bdefine\(\"([^\"]+)\",(\[\"[^\]]*\"\])/g;
var ACE_RE = /\bace\.define\(\"ace\/([^\"]+)\"/g;
exports.redefine = function redefine(source, knownModules = null) {
  var T = findVariable(source);
  var DEFAULT = '["require","exports","module"]';
  var HEADER = 'var ' + T + '=' + DEFAULT + ';';
  var FOOTER = ';' + T + '=void 0';
  knownModules = Object.create(knownModules);
  source.replace(RE, function (match, moduleName) {
    if (!moduleName.indexOf) console.log(moduleName);
    if (moduleName.indexOf('!') < 0) knownModules[moduleName] = true;
  });
  source.replace(ACE_RE, function (match, moduleName) {
    knownModules['ace!' + moduleName] = true;
  });
  return (
    HEADER +
    source.replace(RE, function (match, moduleName, deps) {
      var filtered =
        '["' +
        deps
          .slice(2, -2)
          .split('","')
          .filter(function (e) {
            if (e[0] === '.') {
              e = path.resolve(path.dirname(moduleName), e);
              e = path.relative('', e);
            }
            e = e.replace('grace/', '');
            return !knownModules[e];
          })
          .join('","') +
        '"]';
      if (filtered === DEFAULT) {
        filtered = T;
      }
      return match.slice(0, moduleName.length + 11) + filtered;
    }) +
    FOOTER
  );
};
var chars = 'xqzywvtjklbcdfghmnopsuiear';
chars =
  chars.slice(0, 13).toUpperCase() +
  chars.slice(0, 13) +
  '_$' +
  chars.slice(13).toUpperCase() +
  chars.slice(13);
function _findVariable(source, depth, prefix = '') {
  if (depth === 0) {
    for (var i = 0; i < chars.length; i++) {
      if (source.indexOf(prefix + chars[i]) < 0) {
        return prefix + chars[i];
      }
    }
  } else {
    for (var k = 0; k < chars.length; k++) {
      var t = _findVariable(source, depth - 1, prefix + chars[k]);
      if (t) return t;
    }
  }
}
function findVariable(source) {
  for (var i = 0, m; !(m = _findVariable(source, i)); i++);
  return m;
}
var RE2 = /\.([_\$A-Za-z]{4,})/g;
var blackList = Object.create(null);
[
  Array.prototype,
  Function.prototype,
  Object.prototype,
  String.prototype,
  RegExp.prototype,
  Object,
  String,
  Array,
  Math,
  Number,
  Function,
].forEach(function (e) {
  var keys = Object.getOwnPropertyDescriptors(e);
  for (var i in keys) {
    blackList[i] = true;
  }
});
[
  'createElement',
  'preventDefault',
  'stopPropagation',
  'addEventListener',
  'removeEventListener',
  'getBoundingClientRect',
  'addEventListener',
  'appendChild',
  'className',
].forEach(function (e) {
  blackList[e] = true;
});
function wordCount(source) {
  var words = Object.create(null);
  source.replace(RE2, function (o, match) {
    if (!blackList[match]) words[match] = (words[match] | 0) + match.length - 3;
  });
  var sorted = Object.create(null);
  var sum = 0;
  Object.keys(words)
    .sort(function (a, b) {
      return words[b] - words[a];
    })
    .forEach(function (e) {
      sorted[e] = words[e];
      sum += sorted[e];
    });
  return {sum, sorted};
}
if (require.main === module) {
  var file = process.argv[2];
  var src = fs.readFileSync(file, 'utf8');
  var shrunk = exports.redefine(src);
  console.log('Source', src.length);
  console.log('Stripping defines gains', src.length - shrunk.length);
  var {sum, sorted} = wordCount(src);
  console.log('Maximum prop wrangling gain ', sum);
  console.log(sorted);
}
