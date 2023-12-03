({
  baseUrl: '../src/client',
  waitSeconds: 0,
  map: {
    '*': {
      text: 'libs/js/text/text',
      css: 'libs/js/require-css/css',
      'grace/core': 'core',
      'grace/ext': 'ext',
      'grace/docs': 'docs',
      'grace/ui': 'ui',
      'grace/libs': 'libs',
      'grace/setup': 'setup',
      'grace/themes': 'themes',
      'grace/editor': 'editor',
      ace: 'core/ace_loader',
    },
  },
  shim: {
    //To build for android, we must use
    //ext/android/setup_android in place
    //of ext/fs/browser_fs
    'ext/android/setup_android': {
      deps: [
        'core/logs',
        'libs/ace/ace',
        'core/jquery_compat',
        'libs/js/materialize',
        // 'ext/fs/browser_fs',
        // './setup/setup_console',
        // './ext/dev/runtime_info',
      ],
    },
    'setup/index': {
      deps: ['ext/android/setup_android'],
    },
    'libs/ace/ace': {
      init: function () {
        ace.config.set('basePath', './libs/ace');
      },
    },
    'core/jquery_compat': {
      deps: ['libs/js/cash-dom.min'],
    },
    'libs/js/materialize': {
      deps: ['libs/js/cash-dom.min'],
    },
  },
  dir: '../dist',
  modules: [
    {
      name: 'index',
    },
    {
      name: 'ext/all',
      exclude: ['index'],
    },
    {
      //Speed up theme loading
      name: 'ui/themes/theme_gen',
      exclude: ['index'],
      include: 'ext/json_ext'
    }
  ],
  // optimize: 'none',
  bundlesConfigOutFile: './index.js',
  keepBuildDir: false,
  optimizeCss: "standard",
  removeCombined: true,
});
