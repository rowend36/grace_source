define(function (require, exports, module) {
  var ServerHost = require('grace/ext/language/server_host').ServerHost;
  var Utils = require('grace/core/utils').Utils;

  var loadFiles = ServerHost.loadAutocompleteFiles;
  var BaseProvider = require('grace/ext/language/base_provider').BaseProvider;
  var modules = [
    'none',
    'commonjs',
    'amd',
    'umd',
    'system',
    'es2015',
    'esnext',
  ];
  var tsLibs = [
    'default',
    'dom',
    'dom.iterable',
    'es2015.collection',
    'es2015.core',
    'es2015',
    'es2015.generator',
    'es2015.iterable',
    'es2015.promise',
    'es2015.proxy',
    'es2015.reflect',
    'es2015.symbol',
    'es2015.symbol.wellknown',
    'es2016.array.include',
    'es2016',
    'es2016.full',
    'es2017',
    'es2017.full',
    'es2017.intl',
    'es2017.object',
    'es2017.sharedmemory',
    'es2017.string',
    'es5',
    'es6',
    'esnext.asynciterable',
    'esnext',
    'esnext.full',
    'scripthost',
    'webworker',
  ];
  var config = require('grace/core/config').Config.registerAll(
    null,
    'intellisense.typescript',
  );
  require('grace/core/config').Config.registerAll(
    {
      enableTypescriptLSP: true,
      useWebWorkerForTs: true,
      tsPriority: 900,
      tsModuleKind: 'commonjs',
      tsModuleResolution:
        config.tsModuleKind == 'commonjs' ? 'node' : 'classic',
      tsLibs: 'default,dom,es5',
      noImplicitAny: false,
      allowUnreachableCode: false,
      allowUnusedLabels: false,
      alwaysStrict: true,
      noFallthroughCasesInSwitch: true,
      noImplicitUseStrict: true,
      noUnusedLocals: true,
      noUnusedParameters: false,
      strict: true,
      strictNullChecks: true,
      suppressExcessPropertyErrors: true,
      suppressImplicitAnyIndexErrors: true,
      jsxFactory: undefined,
      jsxFragmentFactory: undefined,
      baseUrl: undefined,
    },
    'intellisense.typescript',
  );
  require('grace/core/config').Config.registerInfo(
    {
      enableTypescriptLSP:
        'Enable inbuilt typescript language support. Supports js,jsx,ts,tsx files. \nWarning: May slow down application. Avoid loading too many files at once.\n For best performance, load files from only node_modules/@types and src folders',
      tsModuleKind: {
        values: modules,
      },
      tsModuleResolution: {values: ['classic', 'node']},
      tsLibs: {
        values: tsLibs,
        isList: true,
      },
      tsPriorty: {
        type: 'number',
      },
      jsxFactory: {
        type: 'string|null',
      },
      jsxFragmentFactory: {
        type: 'string|null',
      },
      baseUrl: {
        type: 'string|null',
      },
    },
    'intellisense.typescript',
  );

  var restart = Utils.delay(function () {
    updateOptions();
  }, 1000);

  require('grace/core/config').Config.on(
    'intellisense.typescript',
    function (ev) {
      if (ev.config === 'tsPriority') {
        TS.priority = ev.value();
        return ServerHost.toggleProvider(TS);
      } else if (ev.config === 'useWebWorkerForTs') TS.destroyInstance();
      restart();
    },
  );

  var TS = Object.assign(new BaseProvider(), {
    init: function (editor, cb) {
      var prov = this;
      require(['./ts_client'], function (mod) {
        var initOptions = Object.assign(
          {useWorker: config.useWebWorkerForTs, provider: TS},
          prov.options,
        );
        var reuse = editor.tsClient || prov.instance;
        if (reuse) {
          prov.attachToEditor(editor, reuse, cb);
        } else {
          var instance = new mod.TsClient(initOptions);
          prov.instance = instance;
          prov.attachToEditor(editor, instance, cb);
          loadFiles(function () {
            instance.updateAnnotations(editor);
          }, instance);
        }
      });
    },
    isEnabled: function () {
      return config.enableTypescriptLSP;
    },
    triggerRegex: /[^\.]\.$/,
    hasArgHints: true,
    priority: config.tsPriority,
    hasAnnotations: true,
    hasRename: true,
    name: 'tsClient',
    modes: ['javascript', 'jsx', 'typescript', 'tsx'],
  });
  BaseProvider.setupLifeCycle(TS);
  BaseProvider.keepDocumentsOnClose(TS, true);

  function updateOptions() {
    TS.options.compilerOptions = {
      module: Math.max(0, modules.indexOf(config.tsModuleKind)),
      moduleResolution: config.tsModuleResolution == 'node' ? 2 : 1,
      lib: Utils.parseList(config.tsLibs).map(function (e) {
        if (e == 'default') return 'lib.d.ts';
        else return 'lib.' + e + '.d.ts';
      }),
      noImplicitAny: config.noImplicitAny,
      allowUnreachableCode: config.allowUnreachableCode,
      allowUnusedLabels: config.allowUnusedLabels,
      alwaysStrict: config.alwaysStrict,
      jsxFactory: config.jsxFactory,
      jsxFragmentFactory: config.jsxFragmentFactory,
      baseUrl: config.baseUrl,
      noFallthroughCasesInSwitch: config.noFallthroughCasesInSwitch,
      noImplicitUseStrict: config.noImplicitUseStrict,
      noUnusedLocals: config.noUnusedLocals,
      noUnusedParameters: config.noUnusedParameters,
      strict: config.strict,
      strictNullChecks: config.strictNullChecks,
      suppressExcessPropertyErrors: config.suppressExcessPropertyErrors,
      suppressImplicitAnyIndexErrors: config.suppressImplicitAnyIndexErrors,
    };
    if (TS.instance) {
      TS.instance.restart(TS.options.compilerOptions);
    }
  }
  exports.tsCompletionProvider = TS;
  updateOptions();
}); /*_EndDefine*/
