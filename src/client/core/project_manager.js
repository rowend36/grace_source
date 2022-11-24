define(function (require, exports, module) {
  'use strict';
  var Config = require('./config').Config;
  var paths = require('./path').path;
  var appEvents = require('./app_events').AppEvents;
  var Utils = require('./utils').Utils;
  var FileServers = require('./file_servers').FileServers;
  var NO_PROJECT = '**no-project**';
  var debug = console;
  var appConfig = Config.registerAll(
    {
      projectName: '',
      projectConfigFile: 'grace.json',
    },
    'files'
  );

  Config.registerInfo(
    {
      projectName: '',
      projectConfigFile: {
        doc:
          "The filepath to the user's configuration file relative to project folder or as an absolute path.",
        isList: true,
      },
      projectFileServer: 'no-user-config',
    },
    'files'
  );

  var project = {
    fileServer: null,
    rootDir: NO_PROJECT,
    name: '',
  };
  var loadConfigsTask = null;

  var ProjectManager = {
    NO_PROJECT: NO_PROJECT,
    getProject: function () {
      return project;
    },
    getConfig: function (name, cb, _project) {
      var fs, rootDir;
      if (_project) {
        fs = _project.fileServer;
        if (!fs) throw new Error('Missing parameter: fileServer');
        rootDir = _project.rootDir;
      } else if (name[0] == paths.sep) {
        fs = FileServers.getFileServer();
      } else {
        fs = project.fileServer;
        rootDir = project.rootDir;
      }
      if (!fs) {
        //app not yet loaded
        return appEvents.once('changeProject', function () {
          ProjectManager.getConfig(name, cb);
        });
      }
      if (name[0] !== paths.sep) {
        if (rootDir == NO_PROJECT) {
          return cb(null, '');
        } else name = paths.resolve(rootDir, name);
      }
      fs.readFile(name, 'utf8', function (e, res) {
        if (e && e.code == 'ENOENT') {
          cb(null, '');
        } else if (res) cb(null, res);
        else cb(e, '');
      });
    },
    saveConfig: function (name, content, cb, project) {
      project = project || ProjectManager.getProject();
      project.fileServer.writeFile(
        paths.resolve(project.rootDir, name),
        content,
        'utf8',
        cb
      );
    },

    openProject: function (path, fileServer, name) {
      if (path !== project.rootDir || fileServer != project.fileServer) {
        project.rootDir = path;
        project.fileServer = fileServer;
        project.name =
          name || (path.length > 50 ? '...' + path.substring(-45) : path);
        appEvents.trigger('changeProject', {project: project});
        appEvents.trigger('renameProject');
        Config.putObj(
          'project',
          {rootDir: path, fileServer: fileServer.id}
        );
        if (loadConfigsTask) loadConfigsTask.stop();
        require(['../ext/config/configs'], function (mod) {
          if (old.length) {
            old.forEach(mod.Configs.removeConfig);
            old = [];
            mod.Configs.commit();
          } else appEvents.once('fullyLoaded', loadConfigs);
        });
      }
      Config.configure('projectName', project.name, 'files');
    },
  };
  exports.ProjectManager = ProjectManager;
  appEvents.on('replaceFileServer', function (e) {
    if (project.fileServer == e.server) {
      project.fileServer = e.replacement;
      appEvents.trigger('changeProject', {project: project});
    }
  });
  appEvents.on('deleteFileServer', function (e) {
    if (project.fileServer == e.server) {
      ProjectManager.openProject(
        ProjectManager.NO_PROJECT,
        FileServers.$getDefaultServer()
      );
    }
  });
  appEvents.on('appLoaded', function () {
    appEvents.on('fileServersLoaded', function () {
      var data = Config.getObj('project', {});
      ProjectManager.openProject(
        data.rootDir || NO_PROJECT,
        FileServers.getFileServer(data.fileServer, true),
        appConfig.projectName
      );
    });
  });

  Config.on('files', function (e) {
    switch (e.config) {
      case 'projectName':
        if (e.value() !== project.name) {
          project.name = e.value();
          appEvents.trigger('renameProject');
        }
        break;
      case 'projectConfigFile':
        loadConfigsTask
          ? loadConfigs()
          : appEvents.once('fullyLoaded', loadConfigs);
        break;
    }
  });
  var old = [];
  function loadConfigs() {
    var m = Utils.parseList(appConfig.projectConfigFile);
    var removed = m.filter(Utils.notIn(old));
    var added = old.filter(Utils.notIn(m));
    old = m;
    require([
      '../ext/config/configs',
      '../ext/json_ext',
      '../ext/stop_signal',
    ], function (mod1, mod, mod2) {
      if (!loadConfigsTask) {
        var loaded = [];
        var task = new mod2.StopSignal();
        var each = task.control(function (path, i, next) {
          if (path !== null) {
            ProjectManager.getConfig(path, function (err, res) {
              if (!res) return;
              try {
                loaded.push({path: path, data: mod.JSONExt.parse(res)});
              } catch (e) {}
              next();
            });
          } else {
            loadConfigsTask.toRemove.forEach(mod1.Configs.removeConfig);
            loaded.forEach(function (e) {
              if (loadConfigsTask.toRemove.indexOf(e.path) > -1) {
                mod1.Configs.setConfig(e.path, e.data, false);
              }
            });
            mod1.Configs.commit();
            next(); //might have added new configs
          }
        });
        task.subscribe(function (e) {
          //Don't execute any loaded files
          loadConfigsTask = null;
          if (e == 'timeout')
            debug.error('Timeout while loading project configuration');
        });
        setTimeout(task.stop.bind(task, 'timeout'), 10000);
        loadConfigsTask = {
          toAdd: added,
          toRemove: removed,
          stop: task.stop,
          resume: Utils.asyncForEach(added, each, task.stop, 1, true),
        };
      } else {
        added = added.filter(Utils.notIn(loadConfigsTask.toAdd));
        loadConfigsTask.toRemove.push.apply(loadConfigsTask.toRemove, removed);
        loadConfigsTask.toAdd.push.apply(loadConfigsTask.toAdd, added);
      }
      loadConfigsTask.toAdd.push(null);
      loadConfigsTask.resume(true);
    });
  }
});