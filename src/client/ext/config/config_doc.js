define(function (require, exports, module) {
    var Docs = require('grace/docs/docs').Docs;
    var Doc = require('grace/docs/document').Doc;
    var Config = require('grace/core/config').Config;
    var Configs = require('grace/ext/config/configs');
    var Context = require('grace/ext/config/context').Context;
    var Utils = require('grace/core/utils').Utils;
    var Actions = require('grace/core/actions').Actions;
    var openDoc = require('grace/docs/docs').openDoc;
    var app = require('grace/core/app_events').AppEvents;
    var JSONExt = require('grace/ext/json_ext').JSONExt;
    var Notify = require('grace/ui/notify').Notify;
    var getFormatter = require('grace/ext/format/formatters').getFormatter;
    //On a line greater than 40 characters
    //After the first 40 characters ->.{40}
    //If still more than 40 characters ->.(?!.{0,40}$)
    //Then read 0 to 30 characters and a breaker ->([\.,|$]|\S(?= ))
    //Collect any whitespace after the breaker -> *(?! )
    //Prevent breaking at the end of a line ->(?!(?:\. *)?$)
    //If no opportunity to break. Break at the nearest opportunity ->[^\.,|$ ]*
    var regex = /.{40}(?!.{0,40}$)(?:.{0,30}(\.(?![a-z])|[,|$]|\S(?= )) *(?! )(?=([A-Z]?))(?!(?:\. *)?$)|[^\.,|$ ]*)/g;
    var wrap = function (text) {
        if (text.indexOf('\n') > -1)
            return text.split('\n').map(wrap).join('\n');
        // @ts-ignore
        var indent = /^ */.exec(text)[0];
        var mightBeKey = /^.{1,40}:/.test(text);
        return text.replace(regex, function (match, breaker, caps, index) {
            return (
                match +
                '\n' +
                indent +
                (breaker === '.' && !mightBeKey && caps ? '' : ' ')
            );
        });
    };
    var INFO_START_TEXT = '//Grace Config File\n';
    var INFO_END_TEXT = wrap(
        '\n/*\n\
  Specify options as either a single path e.g application.applicatonTheme or as nested objects.\n\
  List data can be extended using (+/- syntax e.g \'paths+\':[additional values])\n\
  Settings can be scoped to context using selectors e.g\n\
    "[editorMode == javascript]wrap": "free"\n\
  Except when specified otherwise, all relative filepaths are resolved relative to the current project while\
absolute paths are left as they are.\n\
  Note: Modifications made in this document can be overriden by any loaded configuration files on application start.\n*/'
    );
    /**
     * Grace stores configuration in the form of a single multilevel tree.
     * Any configuration you load is automatically used to update the tree.
     * Nested subtrees are merged recusrsively while other data types including arrays overwrite any existing values in the tree.
     */

    function format(info) {
        var result = '';
        if (info.doc) {
            result = wrap(info.doc);
        }
        if (info.default) {
            var default_ = 'Default: ' + info.default;
            if (result) {
                result = result + '. ' + default_;
            } else result = default_;
        }
        if (info.values) {
            var valueHasInfo = false;
            var values = info.values.map(function (e) {
                if (Array.isArray(e)) {
                    valueHasInfo = true;
                    return e.join(' - ');
                }
                return e + '';
            });

            values = wrap(values.join(valueHasInfo ? '\n - ' : ', '));
            if (valueHasInfo) values = '\n - ' + values;
            values = 'Possible values: ' + values;
            if (result) {
                result =
                    result +
                    (valueHasInfo || result.length + values.length > 15
                        ? '\n'
                        : '. ') +
                    values;
            } else result = values;
        }
        return result;
    }

    function insertComments(str) {
        str = JSONExt.addComments(str, function (path) {
            var info = Config.getConfigInfo(path);
            if (info) {
                if (typeof info == 'object') {
                    info = format(info);
                } else info = wrap(info);
            }
            return info;
        });
        return INFO_START_TEXT + str + INFO_END_TEXT;
    }

    function ConfigDoc() {
        var t = arguments;
        ConfigDoc.super(this, [
            '',
            'config.json',
            'ace/mode/json5',
            t[3],
            t[4],
            t[5],
        ]);
        if (!t[3] /*id*/) {
            //no editor yet
            this.refresh(null, false);
        }
    }
    Utils.inherits(ConfigDoc, Doc);
    ConfigDoc.prototype.save = function () {
        app.on(
            'fullyLoaded',
            function () {
                var json;
                try {
                    json = JSONExt.parse(this.getValue(), null, false);
                } catch (e) {
                    console.error(e);
                    Notify.error('Syntax Error ' + e.message);
                    return;
                }
                if (
                    Configs.withErrorHandler(
                        Notify.error,
                        Configs.apply.bind(Configs, json)
                    )
                )
                    this.setClean();
                else if (!this.dirty) this.setDirty();
            }.bind(this)
        );
    };
    ConfigDoc.prototype.refresh = function (callback, ignoreDirty, confirm) {
        //ignore autorefresh
        // this.setDirty(true);
        // if (force !== false) {
        var doc = this;
        app.on('fullyLoaded', function () {
            var val = insertComments(
                JSONExt.stringify(Context.toJSON(Configs.toJSON()), null, 2)
            );
            getFormatter('json')(
                val,
                {
                    mode: 'json5',
                    'end-expand': true,
                    wrap_line_length: 20,
                },
                function (val) {
                    Docs.onRefresh(
                        doc,
                        undefined /*error*/,
                        val,
                        false, //callback,
                        ignoreDirty,
                        (confirm &&
                            doc.dirty &&
                            (doc.getLength() > 1 || doc.getSize())) ||
                            false /*confirm*/
                    );
                }
            );
        });
        //Notify caller that this is an async op
        //and you will be calling callback if provided
        return true;
        // }
    };
    ConfigDoc.prototype.getSavePath = function () {
        return null;
    };
    ConfigDoc.prototype.factory = 'settings-doc';
    Docs.registerFactory('settings-doc', ConfigDoc);
    Actions.addAction({
        icon: 'edit',
        subIcon: 'settings',
        showIn: 'actionbar.settings',
        caption: 'Edit settings',
        handle: function () {
            openDoc('config.json', new ConfigDoc());
        },
    });
    exports.ConfigDoc = ConfigDoc;
}); /*_EndDefine*/