define(function (require, exports, module) {
  'use strict';
  var Config = require('./config').Config;
  var path = require('./path').path;
  var Utils = require('./utils').Utils;
  var Notify = require('../ui/notify').Notify;
  var configureObj = Config.configureObj;
  var cyclicRequire = require;

  /*Dynamic dependencies Notify,Form,Docs,Doc,docs,FileBrowser*/
  /*
    Warning: Assumes that all paths are android ie linux paths.
    If you supply windows paths, the results are undefined.
    */
  var appConfig = Config.registerAll(
    {
      maxRecentFolders: 7,
      recentFolders: [],
      bookmarks: ['/sdcard/'],
      codeFileExts: [
        '.css',
        '.html',
        '.js',
        '.json',
        '.jsx',
        '.less',
        '.py',
        '.sass',
        '.scss',
        '.ts',
        '.tsx',
      ],
      binaryFileExts: [
        '.zip',
        '.mp4',
        '.mp3',
        '.rar',
        '.tar.gz',
        '.tgz',
        '.iso',
        '.bz2',
        '.3gp',
        '.avi',
        '.mkv',
        '.exe',
        '.apk',
        '.tar',
        '.jar',
        '.png',
        '.jpg',
        '.jpeg',
        '.ttf',
        '.otf',
        '.woff',
        '.woff2',
      ],
    },
    'files'
  );
  Config.registerInfo(
    {
      recentFolders: {
        type: 'array<filename>',
      },
      codeFileExts:
        'The extensions in codeFileExts are shown at the top of the file lists.',
      binaryFilesExts:
        'The extensions in binaryFileExts are disabled for editting.',
    },
    'files'
  );
  var codeFileExts = appConfig.codeFileExts;
  var binaryFileExts = appConfig.binaryFileExts;

  function test(a, b, next, i, custom) {
    var testfunc = sort_funcs[next[i]] || custom[next[i]];
    var res = testfunc(a, b);
    if (res) return res;
    if (next[i + 1] === undefined) return 0;
    else return test(a, b, next, i + 1, custom);
  }

  var sort_funcs = {
    folder: function (a, b) {
      var x = path.isDirectory(a);
      return x == path.isDirectory(b) ? 0 : x ? -1 : 1;
    },
    notfolder: function (a, b) {
      var x = path.isDirectory(a);
      return x == path.isDirectory(b) ? 0 : x ? 1 : -1;
    },
    code: function (a, b) {
      var x = isCode(a);
      return x == isCode(b) ? 0 : x ? -1 : 1;
    },
    notbinary: function (a, b) {
      var x = FileUtils.isBinaryFile(a);
      return x == FileUtils.isBinaryFile(b) ? 0 : x ? 1 : -1;
    },
    name: function (a, b) {
      var x = b.toLowerCase();
      var y = a.toLowerCase();
      return x > y ? -1 : x < y ? 1 : 0;
    },
  };
  var isCode = function (a) {
    for (var i in codeFileExts) {
      if (a.endsWith(codeFileExts[i])) return true;
    }
    return false;
  };

  function sort(files, mode, custom) {
    var modes = mode.split(',');
    return files.sort(function (a, b) {
      return test(a, b, modes, 0, custom);
    });
  }
  //var needsRecreate;
  var FileUtils = {
    /*fileview helpers*/
    addToRecents: function (folder) {
      var recentFolders = appConfig.recentFolders;
      var index = recentFolders.indexOf(folder);
      if (index > -1) {
        recentFolders = recentFolders
          .slice(0, index)
          .concat(recentFolders.slice(index + 1));
      }
      recentFolders.unshift(folder);
      if (recentFolders.length > appConfig.maxRecentFolders)
        recentFolders.pop();
      configureObj('recentFolders', recentFolders, 'files', true);
    },
    fileBookmarks: appConfig.bookmarks,
    getBookmarks: function () {
      return appConfig.bookmarks;
    },
    setBookmarks: function (bookmarks) {
      configureObj('bookmarks', bookmarks.slice(0), 'files', true);
    },
    sort: sort,
    isBinaryFile: function (name) {
      var match = 0;
      while ((match = name.indexOf('.', match) + 1) > 0) {
        if (
          match > 1 &&
          binaryFileExts.indexOf(name.substring(match - 1)) > -1
        ) {
          return true;
        }
      }
    },
    isBuffer: function (buf) {
      return buf && (buf.buffer || buf.constructor.name == 'ArrayBuffer');
    },
    readFile: function (path, server, cb) {
      server = server || FileUtils.getFileServer();
      //This method call is the reason this method is not in file_servers.js
      if (FileUtils.isBinaryFile(path)) {
        return cb('binary');
      }
      FileUtils.detectEncoding(path, server, function (enc) {
        server.readFile(path, enc, function (err, res) {
          cb(err, res, enc);
        });
      });
    },
    getDoc: function (path, server, callback, factory) {
      var Factory = factory || cyclicRequire('../docs/document').Doc;
      server = server || FileUtils.getFileServer();
      FileUtils.readFile(path, server, function (err, res, encoding) {
        if (err) return callback(err);
        var doc = new Factory(res, path);
        doc.fileServer = server.id;
        doc.encoding = encoding;
        callback(null, doc);
      });
    },
    openDoc: function (path, server, callback, factory) {
      var openDoc = cyclicRequire('../docs/docs').openDoc;
      FileUtils.getDoc(
        path,
        server,
        function (error, doc) {
          if (error) {
            var et;
            if (callback) return callback(error);
            else if (error == 'binary') et = 'Binary file';
            else et = error.message;
            return Notify.error(et);
          }
          openDoc(null, doc, null, {autoClose: true});
          doc.setClean();
          callback && callback(null, doc);
        },
        factory
      );
    },
    getDocFromEvent: function (ev, callback, forceNew, justText) {
      var Docs = cyclicRequire('../docs/docs').Docs;
      var doc;
      if (!forceNew && (doc = Docs.forPath(ev.filepath, ev.fs))) {
        Utils.setImmediate(function () {
          callback(null, justText ? doc.getValue() : doc);
        });
      } else {
        FileUtils[justText ? 'readFile' : 'getDoc'](
          ev.filepath,
          ev.fs,
          callback
        );
      }
    },
  };

  /*Add legacy APIs*/
  exports.FileUtils = Object.assign(
    FileUtils,
    path,
    require('./project_manager').ProjectManager,
    require('./file_servers').FileServers,
    require('./register_fs_extension'),
    require('./channels').Channels
  );
}); /*_EndDefine*/