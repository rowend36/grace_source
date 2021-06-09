_Define(function(global) {
  var Imports = global.Imports;
  var Utils = global.Utils;
  var Notify = global.Notify;
  var Docs = global.Docs;
  var js_beautify_opts = {
    "brace_style": "collapse",
    "break_chained_methods": false,
    "comma_first": false,
    "content_unformatted": ["pre"],
    "e4x": false,
    "end_with_newline": false,
    "eval_code": false,
    "extra_liners": ["head", "body", "html"],
    "indent_empty_lines": false,
    "indent_inner_html": false,
    "indent_level": 0,
    "indent_scripts": "normal",
    "inline": undefined,
    "jslint_happy": false,
    "keep_array_indentation": false,
    "max_preserve_newlines": 3,
    "operator_position": "before-newline",
    "preserve_newlines": true,
    "space_after_anon_function": false,
    "space_after_named_function": false,
    "space_before_conditional": true,
    "space_in_empty_paren": false,
    "space_in_paren": false,
    "unescape_strings": false,
    "unformatted": "",
    "unformatted_content_delimiter": "",
    "unindent_chained_methods": false,
    "wrap_attributes": "auto",
    "wrap_attributes_indent_size": undefined,
    "wrap_line_length": 0
  };
  var prettier_opts = {
    "arrowParens": "always",
    "bracketSpacing": false,
    "embeddedLanguageFormatting": "auto",
    "insertPragma": false,
    "jsxBracketSameLine": false,
    "jsxSingleQuote": false,
    "proseWrap": "preserve",
    "printWidth": 80,
    "quoteProps": "as-needed",
    "semi": true,
    "singleQuote": false,
    "trailingComma": "es5",
    "vueIndentScriptAndStyle": false
  };
  var appConfig = global.registerAll({
    "js_beautify_modes": "json,javascript,jsoniq",
    "css_beautify_modes": "css",
    "html_beautify_modes": "html,xml,elixir,handlebars,django",
    "prettier_js_modes": "jsx,typescript,tsx,jssm,jsp",
    "prettier_css_modes": "less,sass",
    "prettier_md_modes": "markdown",
    "prettier_php_modes": "php",
    "autoIndentFallback": true,
    js_beautify: js_beautify_opts,
    prettier: prettier_opts
  }, "formatting");
  global.registerValues({
    "!root": "Configure how your code is formatted. You can also add flags fl-formatter, fl-formatOptions control how each document is formatted. See document.flags",
    "autoIndentFallback": "Allows the editor to attempt auto indentation if no formatter is found"
  }, "formatting");
  global.registerValues({
    "brace_style": "(collapse|expand|end_expand)[,preserve-inline]|none (default:collapse)",
    "indent_scripts": "Sets indent level inside script tags keep|separate|normal (default:normal)",
    "wrap_line_length": " Maximum characters per line (0 disables) [250]",
    "wrap_attributes": "Wrap attributes to new lines [auto|force|force_aligned|force_expand_multiline|aligned_multiple|preserve|preserve_aligned] (default:auto)",
    "wrap_attributes_indent_size": "Indent wrapped attributes to after N characters (default:[indent_size]) (ignored if wrap_attributes is \"aligned\")",
    "inline": "List of tags to be considered inline tags",
    "unformatted": "List of tags (defaults to inline) that should not be reformatted",
    "content_unformatted": "List of tags (defaults to pre) whose content should not be reformatted",
    "extra_liners": "List of tags (defaults to [head,body,/html] that should have an extra newline before them.",
    "unformatted_content_delimiter": "Keep text content together between this string [default:\"\"]",
    "indent_empty_lines": "Keep indentation on empty lines"
  }, "formatting.js_beautify");
  global.registerValues({
    "arrowParens": "Include parentheses around a sole arrow function parameter.\n--->always\nAlways include parens. Example: `(x) => x`\n--->avoid\nOmit parens when possible. Example: `x => x`",
    "bracketSpacing": "Include spaces in object literals",
    "embeddedLanguageFormatting": "Control how Prettier formats quoted code embedded in the file.\n--->auto\nFormat embedded code if Prettier can automatically identify it.\n--->off\nNever automatically format embedded code.",
    "insertPragma": "Insert @format pragma into file's first docblock comment.",
    "jsxBracketSameLine": "Put > on the last line instead of at a new line.",
    "jsxSingleQuote": "Use single quotes in JSX.",
    "printWidth": "Specify how long you want your lines to be",
    "proseWrap": "How to wrap prose.\n--->always\nWrap prose if it exceeds the print width.\n--->never\nDo not wrap prose.\n--->preserve\nWrap prose as-is.",
    "quoteProps": "Change when properties in objects are quoted.\n--->as-needed\nOnly add quotes around object properties where required.\n--->consistent\nIf at least one property in an object requires quotes, quote all properties.\n--->preserve\nRespect the input use of quotes in object properties.",
    "singleQuote": "Use single quotes instead of double quotes.",
    "semi": "Print semicolons.",
    "trailingComma": "Print trailing commas wherever possible when multi-line.\n--->es5\nTrailing commas where valid in ES5 (objects, arrays, etc.)\n--->none\nNo trailing commas.\n--->all\nTrailing commas wherever possible (including function arguments).",
    "vueIndentScriptAndStyle": "Indent script and style tags in Vue files.",
    "editorconfig": "no-user-config"
    // "templating": "no-user-config"
  }, "formatting.prettier");
  var sharedPrettier = {
    script: "./tools/format/prettier.js",
    ignoreIf: window.prettier
  };

  function pretty(val, opts, cb, data) {
    var mode = this.mode || (data && data.session.$mode.$id || "").split("/").pop();
    var config = appConfig.prettier;
    var pOpts = Object.assign({
      filepath: "a." + (mode === "javascript" ? "js" : mode == "markdown" ? "md" : mode),
      endOfLine: opts.eol,
      tabWidth: opts.indent_size,
      useTabs: opts.indent_char == '\t',
      plugins: prettierPlugins,
    }, config, opts.options);
    try {
      val = prettier.format(val, pOpts);
      cb(val);
    } catch (e) {
      cb(val, null, false);
      Notify.error(e);
    }
  }

  function beautifier(name) {
    return function(val, opts, cb, data) {
      opts = Object.assign(opts, appConfig.js_beautify, opts.options);
      opts.options = undefined;
      try {
        cb(window[name](val, opts), null, data && data.trimmed);
      } catch (e) {
        cb(val, null, false);
        Notify.error(e);
      }
    };
  }
  var beautifiers = {
    "prettier_js": Imports.define([sharedPrettier, "./tools/format/parser-babel.js"], null, pretty),
    "prettier_css": Imports.define([sharedPrettier, "./tools/format/parser-postcss.js"], null, pretty),
    "prettier_md": Imports.define([sharedPrettier, "./tools/format/parser-markdown.js"], null, pretty),
    "prettier_php": Imports.define([sharedPrettier, "./tools/format/parser-php.js"], null, pretty),
    "js_beautify": Imports.define(["./tools/format/beautify.min.js"], null, beautifier("js_beautify")),
    "html_beautify": Imports.define([{
      script: "./tools/format/beautify.min.js",
      ignoreIf: window.js_beautify
    }, {
      script: "./tools/format/beautify-css.min.js",
      ignoreIf: window.css_beautify
    }, "./tools/format/beautify-html.min.js"], null, beautifier("html_beautify")),
    "css_beautify": Imports.define(["./tools/format/beautify-css.min.js"], null, beautifier("css_beautify"))
  };
  sharedPrettier = null;
  var config = global.libConfig;
  var Range = global.Range;
  var Editor = global.Editor;
  /**
   * @returns {string} mode at cursor position (examples: javascript|html|css)
   * @param {editor} editor - editor instance
   * @param {bool} [allowNestedMode=false] - pass true return nested mode if in mixed html mode
   */
  function getCurrentMode(editor, allowNestedMode) {
    var scope = editor.session.$mode.$id || "";
    scope = scope.split("/").pop();
    if (allowNestedMode) {
      var temp = getNestedModeforRow(editor.getCursorPosition().row);
      if (temp !== '') return temp;
    }
    return scope;
  }

  function getBeautifier(mode) {
    for (var j in beautifiers) {
      var modes = Utils.parseList(appConfig[j + "_modes"]);
      if (modes.indexOf(mode) > -1) {
        return beautifiers[j].bind({
          mode: mode
        });
      }
    }
    return null;
  }
  /**
   * @returns {string} nested mode for passed row (if any) or empty string
   * @param {int} rowNum - row number
   * @note for css and javascript nested in html only
   */
  function getNestedModeforRow(rowNum) {
    var state = editor.session.getState(rowNum);
    if (typeof state === "object") state = state[0];
    if (state.substring) {
      if (state.substring(0, 3) == "js-") return "javascript";
      else if (state.substring(0, 4) == "css-") return "css";
    }
    return '';
  }

  function clone(obj) {
    if (null === obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
  }

  function setValue(session, value, sel, originalRangeStart, range, formatAll, unselect) {
    var deltas;
    if (typeof value == 'object') {
      if (!value[0] || value[0].start) {
        deltas = value;
      } else deltas = Docs.diffToAceDeltas(value, formatAll ? 0 : originalRangeStart.row, formatAll ? 0 : originalRangeStart
        .column);
    } else deltas = Docs.generateDiff(formatAll ? session.getValue() : session.getTextRange(range), value, formatAll ? 0 :
      originalRangeStart.row, formatAll ? 0 : originalRangeStart.column);
    var end = range.start;
    session.markUndoGroup();
    for (var i = 0; i < deltas.length; i++) {
      session.doc.applyDelta(deltas[i]);
    }
    if (0 < deltas.length) {
      end = deltas[deltas.length - 1].end;
    }
    if (!formatAll) {
      if (unselect) {
        sel.setSelectionRange(Range.fromPoints(sel.cursor, sel.cursor));
      }
      /*else {
                sel.setSelectionRange(Range.fromPoints(range.start, end));
            }
        }
        else {
            sel.setSelectionRange(Range.fromPoints(originalRangeStart, originalRangeStart));
        */
    }
  }
  /**
   * executes beautify on currently selected code or all code if nothing is selected
   * @param {editor} editor
   * @param {bool} [unselect=false] - pass true to unselect the selection after execution
   * @param {bool} [removeBlanks=false] - pass true to remove unnecessary blank and EOL space instead of beautify (same as NotePad++ command)
   * @param {object} [overrideOptions] - beautify options to override for this call
   */
  function beautify(editor, unselect, removeBlanks, overrideOptions) {
    //#region determine range to beautify
    var sel = editor.getSelection();
    var session = editor.session;
    var range = sel.getRange();
    //if nothing is selected, then select all
    var formatAll = false;
    var originalRangeStart = range.start;
    if (range.start.row === range.end.row && range.start.column === range.end.column) {
      range.start.row = 0;
      range.start.column = 0;
      var lastLine = editor.session.getLength() - 1;
      range.end.row = lastLine;
      range.end.column = editor.session.getLine(lastLine).length;
      formatAll = true;
    }
    //#endregion
    //#region beautify options
    var needsAlign = false;
    var indent;
    var options = {};
    if (!removeBlanks) {
      if (session.getUseSoftTabs()) {
        options.indent_char = " ";
        options.indent_size = session.getTabSize();
      } else {
        options.indent_char = "\t";
        options.indent_size = 1;
      }
      var line = session.getLine(range.start.row);
      indent = line.match(/^\s*/)[0];
      if (range.start.column < indent.length) range.start.column = 0;
      else needsAlign = true;
    }
    //override options for this call
    if (overrideOptions != null) {
      for (var k in overrideOptions) {
        options[k] = overrideOptions[k];
      }
    }
    //#endregion
    //#region get value, set mode
    var value = session.getTextRange(range);
    var originalValue = value; //for debugging
    var type = null;
    if (removeBlanks) {
      //remove multiple blank lines, trailing spaces and multispace between words
      value = value.replace(/ +$|(\S ) +(\S)/gm, "$1$2").replace(/((?:\r\n|\n|\r){3})(?:\r\n|\n|\r)*/g, "$1");
      setValue(session, value, sel, originalRangeStart, range, formatAll, unselect);
      return true;
    }
    //#region execute beautify
    var standardNewLineChar = '\n',
      editorNewLineChar = session.doc.getNewLineCharacter(),
      needToNormalize = standardNewLineChar != editorNewLineChar;
    var detectedMode = getCurrentMode(editor, false);
    //for html, allow using a nested formatter if the entire range is nested (css and javascript only)
    if (detectedMode == "html" || detectedMode == "php" || detectedMode == "svg") {
      if (!formatAll) { //if formatting all then entire thing wont be the nested mode
        var nestedMode = getCurrentMode(editor, true);
        if (['javascript', 'css'].indexOf(nestedMode) !== -1) {
          var useNested = true;
          for (var i = range.start.row; i < range.end.row; i++) {
            if (getNestedModeforRow(i) != nestedMode) {
              useNested = false;
              break;
            }
          }
          if (useNested) detectedMode = nestedMode;
        }
      }
    }
    //#endregion
    var beautifier;
    var doc = Docs.forSession(session);
    if (doc && doc.flags && doc.flags.formatter) {
      beautifier = beautifiers[doc.flags.formatter];
      options.options = doc.flags.formatOptions;
    } else beautifier = getBeautifier(detectedMode);
    if (!beautifier) {
      if (appConfig.autoIndentFallback) return editor.autoIndent();
      else Notify.warn('Unable to find beautifier for this file');
      return false;
    };
    beautifier(value, options, function(value, pos, trimmed) {
      if (trimmed !== false) {
        value = value.replace(/\r\n|\r|\n/g, '$&' + indent).trim();
      }
      if (range.end.column === 0) {
        value += editorNewLineChar + indent;
      }
      setValue(session, value, sel, pos || originalRangeStart, range, formatAll, unselect);
    }, {
      baseIndent: indent,
      trimmed: needsAlign,
      cursor: originalRangeStart,
      editor: editor,
      session: session,
      range: range,
      isSegment: !formatAll
    });
    return true;
  }
  /**
   * handlers for onAfterExec to auto beautify
   */
  function onAfterExec_Beautify(e) {
    var editor = e.editor;
    if (e.command.name === "insertstring" && e.args === "}") {
      var m = getCurrentMode(editor, true);
      if (m !== 'javascript' && m !== 'css') {
        return;
      }
      var sel = editor.getSelection();
      var range = sel.getRange();
      var pos = range.end;
      var tok = editor.session.getTokenAt(pos.row, pos.column);
      if (tok) {
        if (tok.type.indexOf('paren') > -1 && tok.type.toString().indexOf('comment') === -1) {
          //bracket just inserted - move back one character before jumpting to matching or it wont work correctly (executing it after the newly inserted char can cause issues in some instances)
          var start = range.start;
          start.column--;
          sel.setSelectionRange(Range.fromPoints(start, start));
          editor.jumpToMatching(true); //jumpto and select
          //now move end of selection back one char, to include the newly inserted bracket, and start of selection one char to include start bracket
          var newRange = sel.getRange();
          var end = newRange.end;
          end.column++;
          start = newRange.start;
          start.column--;
          sel.setSelectionRange(Range.fromPoints(start, end));
          //now beautify the selection
          editor.execCommand('beautify', true);
        }
      }
    }
  }
  config.defineOptions(Editor.prototype, "editor", {
    autoBeautify: {
      set: function(val) {
        if (val) this.commands.on('afterExec', onAfterExec_Beautify);
        else this.commands.off('afterExec', onAfterExec_Beautify);
      },
      value: false
    },
    htmlBeautify: {
      set: function(val) {
        if (!val) {
          this.commands.removeCommand('beautify');
          this.commands.removeCommand('removeBlank');
          return;
        }
        this.commands.addCommand({
          name: 'beautify',
          bindKey: {
            mac: "Command-B",
            win: "Ctrl-B"
          },
          exec: beautify,
          readOnly: false,
        });
        this.commands.addCommand({
          name: 'removeBlank',
          bindKey: {
            mac: "Command-Shift-B",
            win: "Ctrl-Shift-B"
          },
          exec: function(editor) {
            beautify(editor, false, true);
          },
          readOnly: false
        });
      },
      value: false
    }
  });
  global.beautifiers = beautifiers;
  global.Beautify = beautify;
  global.getBeautifier = getBeautifier;
}) /*_EndDefine*/