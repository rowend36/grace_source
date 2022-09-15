define(function (require, exports, module) {
  'use strict';
  var Notify = require('grace/ui/notify').Notify;
  var Utils = require('grace/core/utils').Utils;
  var prettierConfig = require('grace/core/config').Config.registerAll(
    {
      arrowParens: 'always',
      bracketSpacing: false,
      embeddedLanguageFormatting: 'auto',
      insertPragma: false,
      jsxBracketSameLine: false,
      jsxSingleQuote: false,
      proseWrap: 'preserve',
      printWidth: 80,
      quoteProps: 'as-needed',
      semi: true,
      singleQuote: false,
      trailingComma: 'es5',
      vueIndentScriptAndStyle: false,
    },
    'formatting.prettier',
  );

  require('grace/core/config').Config.registerInfo(
    {
      arrowParens:
        'Include parentheses around a sole arrow function parameter.\n--->always\nAlways include parens. Example: `(x) => x`\n--->avoid\nOmit parens when possible. Example: `x => x`',
      bracketSpacing: 'Include spaces in object literals',
      embeddedLanguageFormatting:
        'Control how Prettier formats quoted code embedded in the file.\n--->auto\nFormat embedded code if Prettier can automatically identify it.\n--->off\nNever automatically format embedded code.',
      insertPragma: "Insert @format pragma into file's first docblock comment.",
      jsxBracketSameLine: 'Put > on the last line instead of at a new line.',
      jsxSingleQuote: 'Use single quotes in JSX.',
      printWidth: 'Specify how long you want your lines to be',
      proseWrap:
        'How to wrap prose.\n--->always\nWrap prose if it exceeds the print width.\n--->never\nDo not wrap prose.\n--->preserve\nWrap prose as-is.',
      quoteProps:
        'Change when properties in objects are quoted.\n--->as-needed\nOnly add quotes around object properties where required.\n--->consistent\nIf at least one property in an object requires quotes, quote all properties.\n--->preserve\nRespect the input use of quotes in object properties.',
      singleQuote: 'Use single quotes instead of double quotes.',
      semi: 'Print semicolons.',
      trailingComma:
        'Print trailing commas wherever possible when multi-line.\n--->es5\nTrailing commas where valid in ES5 (objects, arrays, etc.)\n--->none\nNo trailing commas.\n--->all\nTrailing commas wherever possible (including function arguments).',
      vueIndentScriptAndStyle: 'Indent script and style tags in Vue files.',
      editorconfig: 'no-user-config',
      // "templating": "no-user-config"
    },
    'formatting.prettier',
  );

  function pretty(deps, defaultMode) {
    return function (val, opts, cb, data) {
      require(deps, function (prettier, plugin) {
        var session;
        if (typeof val === 'object') {
          session = val;
          val = session.getValue();
        }
        var mode =
          opts.mode ||
          (session
            ? session.getModeName()
            : defaultMode);
        var pOpts = Object.assign(
          {
            filepath:
              'a.' +
              (mode === 'javascript' ? 'js' : mode == 'markdown' ? 'md' : mode),
            endOfLine: opts.eol,
            tabWidth: opts.indent_size,
            useTabs: opts.indent_char == '\t',
            eol: undefined,
            indent_size: undefined,
            indent_char: undefined,
            plugins: [plugin],
          },
          prettierConfig,
          opts,
        );
        var err = null;
        try {
          val = prettier.format(val, pOpts);
        } catch (e) {
          err = e;
          if (data && data.isPartialFormat && val[0] == '{') {
            try {
              val = prettier.format('a=' + val, pOpts).replace(/^[^\{}]+/, '');
              err = null;
            } catch (e) {}
          }
          if (err)
            Notify.error(
              '<pre style="font-size:12px">' +
                Utils.htmlEncode(e.toString()) +
                '</pre>',
            );
        }
        cb(val, null, !err);
      });
    };
  }

  require('./formatters').registerFormatter(
    'Prettier(Javascript)',
    ['javascript', 'json', 'jsx', 'typescript', 'tsx', 'jssm', 'jsp'],
    pretty(['./libs/prettier', './libs/parser-babel'], 'tsx'),
  );
  require('./formatters').registerFormatter(
    'Prettier(CSS)',
    ['less', 'sass', 'css'],
    pretty(['./libs/prettier', './libs/parser-postcss'], 'sass'),
  );
  require('./formatters').registerFormatter(
    'Prettier(PHP)',
    ['php'],
    pretty(['./libs/prettier', './libs/parser-php'], 'php'),
  );
  require('./formatters').registerFormatter(
    'Prettier(Markdown)',
    ['markdown'],
    pretty(['./libs/prettier', './libs/parser-markdown'], 'markdown'),
  );
});