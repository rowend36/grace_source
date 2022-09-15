define(function (require, exports, module) {
  "use strict";
  var Notify = require("grace/ui/notify").Notify;
  var jsBeautifyConfig = require("grace/core/config").Config.registerAll(
    {
      brace_style: "collapse",
      break_chained_methods: false,
      comma_first: false,
      content_unformatted: ["pre"],
      e4x: false,
      end_with_newline: false,
      eval_code: false,
      extra_liners: ["head", "body", "html"],
      indent_empty_lines: false,
      indent_inner_html: false,
      indent_level: 0,
      indent_scripts: "normal",
      inline: undefined,
      jslint_happy: false,
      keep_array_indentation: false,
      max_preserve_newlines: 3,
      operator_position: "before-newline",
      preserve_newlines: true,
      space_after_anon_function: false,
      space_after_named_function: false,
      space_before_conditional: true,
      space_in_empty_paren: false,
      space_in_paren: false,
      unescape_strings: false,
      unformatted: "",
      unformatted_content_delimiter: "",
      unindent_chained_methods: false,
      wrap_attributes: "auto",
      wrap_attributes_indent_size: undefined,
      wrap_line_length: 0,
    },
    "formatting.js_beautify"
  );
  require("grace/core/config").Config.registerInfo(
    {
      brace_style:
        "(collapse|expand|end_expand)[,preserve-inline]|none (default:collapse)",
      indent_scripts:
        "Sets indent level inside script tags keep|separate|normal (default:normal)",
      wrap_line_length: " Maximum characters per line (0 disables) [250]",
      wrap_attributes:
        "Wrap attributes to new lines [auto|force|force_aligned|force_expand_multiline|aligned_multiple|preserve|preserve_aligned] (default:auto)",
      wrap_attributes_indent_size: {
        values: [[null, "indent_size"], "<number>"],
        doc:
          'Indent wrapped attributes to after N characters (default:[indent_size]) (ignored if wrap_attributes is "aligned")',
      },
      inline: {
        values: [
          [null, "An exhaustive default list of html inline elements"],
          "<array<string>>",
        ],
        doc: "List of tags to be considered inline tags",
      },
      unformatted:
        "List of tags (defaults to inline) that should not be reformatted",
      content_unformatted:
        "List of tags (defaults to pre) whose content should not be reformatted",
      extra_liners:
        "List of tags (defaults to [head,body,/html] that should have an extra newline before them.",
      unformatted_content_delimiter:
        'Keep text content together between this string [default:""]',
      indent_empty_lines: "Keep indentation on empty lines",
    },
    "formatting.js_beautify"
  );

  function beautifier(files, name) {
    return function (val, opts, cb, flags) {
      require(files, function (mod) {
        console.log(arguments);
        opts = Object.assign({}, jsBeautifyConfig, opts);
        if (typeof val === "object") {
          val = val.getValue();
        }
        //jsbeautify keeps indent if it is not yet trimmed
        var err = null;
        try {
          val = mod[name](val, opts);
        } catch (e) {
          err = e;
          Notify.error(e);
        }
        cb(val, null, err ? false : flags ? !flags.textContainsIndent : false);
      });
    };
  }
  require("./formatters").registerFormatter(
    "JSBeautify",
    ["javascript", "json", "jsoniq", "json5"],
    beautifier(["./libs/beautify"], "js_beautify")
  );
  require("./formatters").registerFormatter(
    "JSBeautify(HTML)",
    ["html", "xml", "elixir", "handlebars", "django"],
    beautifier(["./libs/beautify-html"], "html_beautify")
  );
  require("./formatters").registerFormatter(
    "JSBeautify(CSS)",
    ["css", "sass", "less"],
    beautifier(["./libs/beautify-css"], "css_beautify")
  );
});