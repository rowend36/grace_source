define(function (require, exports, module) {
  'use strict';
  var ConfigEvents = require('grace/core/config').Config;
  var Utils = require('grace/core/utils').Utils;
  var Notify = require('grace/ui/notify').Notify;
  var Actions = require('grace/core/actions').Actions;
  var ServerHost = require('grace/ext/language/server_host').ServerHost;
  var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
  var join = require('grace/core/file_utils').FileUtils.join;
  var supportedModes = ['java', 'python', 'javascript', 'c_cpp', 'json'];
  var completion = require('../misc/basic_completion');
  var TagsClient = require('./tags_client').TagsClient;
  var globToRegex = require('grace/core/file_utils').FileUtils.globToRegex;
  var Config = require('grace/core/config').Config;
  var appConfig = Config.registerAll(
    {
      ctagsFilePattern: '**/tags,**/.ctags,**/.ctags.d/*',
      loadFileTypes: ['text', 'css'].concat(supportedModes),
      includeTagFiles: '**/**',
      autoUpdateTags: true,
      includeFileTypes: ['css', 'text'],
      showLocalWords: ['text', 'css'],
      enableTagsCompletion: ['css'].concat(supportedModes),
      enableWordsGathering: ['python', 'json'],
    },
    'intellisense.tags',
  );
  require('grace/core/config').Config.registerInfo(
    {
      '!root':
        'Use ctags for language support.\
You can either load ctag files (with intellisense.tags.ctagsFilePattern),\
json tag files exported from the application( with .gtag extension)\
or actual source files( will be parsed.',
      ctagsFilePattern: {
        type: 'glob',
        isList: true,
        doc:
          'A wildcard used to determine is a file specified in intellisense.loadConfigs is a ctags file.',
      },
      loadFileTypes: {
        doc:
          'Allow parsing of tags from files of this mode. Available parsers include ' +
          supportedModes.join(', ') +
          '. If a parser is not available, #enableWordsGathering is force enabled for the file.',
      },
      enableWordsGathering: {
        type: 'boolean|array<mode>',
        doc:
          'Notifies the parser to gather all words in a file while parsing the file.',
      },
      includeFileTypes: {
        type: 'boolean|array<mode>',
        doc:
          'Used when providing completions to load files of different languages/modes from the current document.',
      },
      includeTagFiles: {
        type: 'glob',
        isList: true,
        doc:
          'Like includeFileTypes, filter completions by their sourcefile paths.',
      },
      showLocalWords: {
        type: 'boolean|array<mode>',
        doc:
          'Control whether gathered words show up in completions when #enableTagsCompletion is enabled.',
      },
      enableTagsCompletion: {
        type: 'boolean|array<mode>',
        doc:
          'Control whether tags such as functions,properties,etc to show up in completions in files of these types.',
      },
      autoUpdateTags: {
        type: 'boolean|array<mode>',
        doc:
          'Allow the engine to update tags from the current file automatically on load and whenever changes are made. Uses resource context.',
      },
    },
    'intellisense.tags',
  );

  Actions.addAction({
    bindKey: 'Ctrl-Alt-.',
    name: 'jumpToTag',
    exec: function (editor) {
      Tags.jumpToDef(editor);
    },
  });
  Actions.addAction({
    name: 'exportTags',
    caption: 'Export tags',
    showIn: 'fileview.language',
    handle: function (ev) {
      ev.preventDefault();
      var folder = join(ev.filepath, Utils.genID('tags'));
      ev.fs.mkdir(folder, function () {
        Tags.tags.exportTags(
          ev.fs,
          folder,
          Notify.info.bind(null, 'Done'),
        );
      });
    },
  });

  var Tags = new TagsClient(ServerHost);

  var memo = {};
  function isOptionEnabled(_option, mode, path) {
    var value = appConfig[_option];
    switch (_option) {
      case 'autoUpdateTags':
        value = Config.forPath(path, 'intellisense.tags', _option);
      /*fall through*/
      default:
        return value === false
          ? false
          : value === true
          ? true
          : value.indexOf(mode) > -1;
    }
  }
  function isOptionMatching(_option, value, path) {
    var m = memo[_option] || (memo[_option] = globToRegex(appConfig[_option]));
    return m.test(value);
  }
  ConfigEvents.on('intellisense.tags', function (e) {
    switch (e.config) {
      case 'loadFileTypes':
      case 'enableWordsGathering':
        Tags.clear(); //TODO make this more efficient
        ServerHost.loadFiles(Utils.noop, Tags);
        break;
      case 'ctagsFilePattern':
        Tags.tagFilePattern = globToRegex(appConfig.ctagsFilePattern);
        break;
      case 'enableTagsCompletion':
        updateModes();
        break;
      default:
        memo = {};
    }
  });
  function updateModes(m) {
    Tags.modes = supportedModes.filter(function (e) {
      return isOptionEnabled('enableTagsCompletion', e);
    });
    ServerHost.registerProvider(Tags);
    completion.removeCompleter(Tags);
    //so that init can be called
    completion.addCompleter(Tags);
    ServerHost.unregisterProvider(Tags);
  }

  Tags.tagFilePattern = globToRegex(appConfig.ctagsFilePattern);
  Tags.isOptionEnabled = isOptionEnabled;
  Tags.isOptionMatching = isOptionMatching;
  updateModes();
  //Although, Tags keeps tags anyway
  BaseProvider.keepDocumentsOnClose(Tags, false);
  BaseProvider.addDocumentsOnOpen(Tags);
  BaseProvider.setupLifeCycle(Tags);

  exports.TagCompleter = Tags;
});