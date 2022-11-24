define(function (require, exports, module) {
    var formatters = new (require('grace/core/registry').Registry)(
        'format',
        'formatting'
    );
    require('grace/core/config').Config.registerInfo(
        {
            '!root': 'Configure how your code is formatted.',
            defaultProvider:
                'Map language modes to their default formatters. Uses resource context.',
        },
        'formatting'
    );

    /**
   * @callback onFormatFinished
   * @param {(Array<(AceDelta|dmp.Delta)>|string)} result
   * @param {Position} [newCursorPos]
   * @param {boolean} clientShouldFixSelectionIndent
   * 
   * @typedef {{
       baseIndent: string,
       //When in partial formatting, shows whether text starts
       //from beginning of line
       rangeContainsIndent: boolean,
       cursor: Position,
       editor: Editor,
       range: Range,
       isPartialFormat: boolean,
     }} FormatInfo
   *
   * @typedef {{
       eol: string,
       indent_char: string,
       indent_size: number
     }}
   *
   * @callback onFormatRequested
   * @param {EditSession|string} val
   * @param {FormatOpts} opts
   * @param {onFormatFinished} cb
   * @param {FormatInfo} data
   **/

    formatters.register('ignore', [], function (value, options, cb) {
        cb(value);
    });
    formatters.register('autoindent', [], function (value, options, cb, data) {
        if (data && data.editor) data.editor.autoIndent();
        cb(value);
    });
    exports.getFormatter = function (mode, path) {
        //Check for configured formatter
        var m = formatters.getForPath(path, mode);
        if (m) return m.format.bind(m);
    };
    exports.getFormatterByName = formatters.getByName;
    exports.registerFormatter = formatters.register;
    exports.unregisterFormatter = formatters.unregister;
}); /*_EndDefine*/