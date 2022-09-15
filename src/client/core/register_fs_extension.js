define(function (require, exports, module) {
  "use strict";
  var BaseFs = require("./base_fs").BaseFs;
  var FileServers = require("./file_servers").FileServers;
  var Utils = require("./utils").Utils;
  var Channels = require("./channels").Channels;
  var factories = {};

  function StubFileServer(resolve) {
    //the core async methods of a file server
    var propsToEnqueue = [
      "readFile",
      "getFiles", //not core, but massive optimization oppurtunity
      "writeFile",
      "readdir",
      "stat",
      "lstat",
      "mkdir",
      "unlink",
      "rmdir",
      "rename",
      "symlink",
      "readlink",
    ];
    var queuedOps = [];
    propsToEnqueue.forEach(function (e) {
      this[e] = function () {
        queuedOps.push({
          method: e,
          args: Array.prototype.slice.apply(arguments, [0]),
        });
        this.load();
      };
    }, this);
    StubFileServer.super(this);
    this.$inject = function () {
      var server = resolve();
      server.id = this.id;
      //Update so new calls get to use fs directly
      FileServers.replaceServer(this, server);
      this.$isStub = server;
      this.$inject = null;
      propsToEnqueue.forEach(function (e) {
        this[e] = server[e].bind(server);
      }, this);
      this.getDisk = server.getDisk.bind(server);
      queuedOps.forEach(function (e) {
        server[e.method].apply(server, e.args);
      });
      resolve = propsToEnqueue = queuedOps = null;
    }.bind(this);
  }
  Utils.inherits(StubFileServer, BaseFs);
  /*Calls when the first request comes in*/
  StubFileServer.prototype.load = Utils.noop;
  StubFileServer.prototype.$isStub = true;
  exports.StubFileServer = StubFileServer;
  function createOrStubFileServer(params) {
    if (factories[params.factoryId]) {
      return factories[params.factoryId](params);
    } else {
      var stub = new StubFileServer(createOrStubFileServer.bind(null, params));
      stub.icon = params.icon;
      Channels.postChannel("servers-" + params.factoryId, stub);
      if (params["!requireURL"]) {
        require([params["!requireURL"]]);
      }
      return stub;
    }
  }

  FileServers.registerFileServer(
    "!extensions",
    "Extension",
    createOrStubFileServer
  );
  exports.registerFsExtension = function (
    id,
    caption,
    factory,
    config
  ) {
    FileServers.registerFileServer(
      id,
      caption,
      function (params) {
        params.type = "!extensions";
        params.factoryId = id;
        return factory(params);
      },
      config
    );
    if (factory) {
      factories[id] = factory;
      Channels.ownChannel("servers-" + id, function (stub) {
        stub.$inject();
      });
    }
  };
});