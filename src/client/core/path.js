define(function (require, exports, module) {
  "use strict";
  /* 
      Path manipulation with little but substantial differences from nodejs path
    */
  var SEP = "/";
  var paths = {
    sep: SEP,
    normalize: function (path) {
      if (!path) return "";
      var a = 0,
        start,
        end;
      path = path.split(SEP);
      var p = path.length;
      if (path[0] === "") {
        start = SEP;
        a = 1;
      } else start = "";
      if (path[p - 1] === "") {
        end = SEP;
      } else end = "";
      var t = -1;
      var newpath = [];
      for (; a < p; a++) {
        if (path[a] === "" || path[a] === ".") {
          continue;
        } else if (path[a] === "..") {
          if (t > -1 && newpath[t] !== "..") {
            newpath.pop();
            t--;
            continue;
          }
        }
        newpath[++t] = path[a];
      }
      return t > -1 ? start + newpath.join(SEP) + end : start;
    },
    //expects normalized path, clears trailing slash for uniformity
    dirname: function (path) {
      if (!path || path == SEP) return null;
      path = paths.removeTrailingSlash(path);
      return (
        path.split(SEP).slice(0, -1).join(SEP) || (path[0] == SEP ? SEP : "")
      );
    },
    join: function (base) {
      var a = 1,
        path;
      while ((path = arguments[a++]) !== undefined) {
        base =
          (base ? base.replace(/\/+$/, "") + SEP : "") +
          path.replace(/^\/+/, "");
      }
      return base;
    },
    /*extname("man.m.txt")=txt*/
    extname: function (name) {
      var ext = name.lastIndexOf(".");
      if (ext > 0) {
        return name.substring(ext + 1);
      } else return "";
    },
    //does nothing to '/'
    removeTrailingSlash: function (e) {
      return e[e.length - 1] == SEP ? e.substring(0, e.length - 1) || SEP : e;
    },
    resolve: function (from, path) {
      if (path[0] == SEP) {
        return paths.normalize(path);
      }
      return paths.normalize(from + SEP + path);
    },
    //expects normalized paths
    relative: function (from, path, forceKeepSlash, noBackTrace) {
      //absolute to relative
      if (from[0] != SEP && path[0] == SEP) return null;
      //relative to absolute
      if (from[0] == SEP && path[0] != SEP) return null;
      if (from === "") return path;
      from = from == SEP ? "" : paths.removeTrailingSlash(from);
      if (path === from) return "";
      if (path.startsWith(from + SEP)) {
        return path.substring(from.length + 1) || (forceKeepSlash ? "./" : "");
      }
      if (noBackTrace) return null;
      var child = path.split(SEP);
      var parent = from.split(SEP);
      var i = 0;
      while (i < child.length && i < parent.length && parent[i] == child[i]) {
        i++;
      }
      var relative = "";
      for (var j = i; j < parent.length; j++) {
        relative += forceKeepSlash || j < parent.length - 1 ? "../" : "..";
      }
      for (j = i; j < child.length; j++) {
        relative += (forceKeepSlash && j == i ? "" : SEP) + child[j];
      }
      return relative;
    },
    //expects normalized path
    filename: function (e) {
      var isFolder = false;
      if (e.endsWith(SEP)) isFolder = true;
      while (e.endsWith(SEP)) e = e.slice(0, e.length - 1);
      return (
        e.substring(e.lastIndexOf(SEP) + 1, e.length) + (isFolder ? SEP : "")
      );
    },
    isDirectory: function (name) {
      return name.endsWith(SEP);
    },
  };
  exports.path = paths;
});