define(function (require, exports, module) {
    var completionSettings = [
        'enableSnippets',
        'enableLiveAutocompletion',
        'enableBasicAutocompletion',
        'enableIntelligentAutocompletion',
        'enableArgumentHints',
    ];
    var themelist = ace.require('ace/ext/themelist');
    var themes = themelist.themes.map(function (t) {
        return t.theme;
    });
    var Schema = require('../core/schema').Schema;
    var IsString = Schema.IsString,
        IsNumber = Schema.IsNumber,
        IsBoolean = Schema.IsBoolean,
        XOneOf = Schema.XOneOf,
        XEnum = Schema.XEnum;
    var Docs = require('../docs/docs').Docs;
    var Notify = require('../ui/notify').Notify;
    var configure = require('../core/config').Config.configure;
    var setHandler = require('../core/config').Config.setHandler;
    var register = require('../core/config').Config.register;

    var editorConfig = require('../core/config').Config.registerAll(
        {
            sharedTheming: true,
            sharedCompletion: true,
        },
        'editor'
    );
    require('../core/config').Config.registerInfo(
        {
            theme: {
                doc: 'Editor syntax highlight theme.',
                values: themes,
            },
            wrap: {
                values: [
                    ['free', 'use windowWidth as limit'],
                    'printMargin',
                    'off',
                    '[number]',
                ],
            },
            cursorStyle: {
                values: ['ace', 'smooth', 'slim', 'smooth slim', 'wide'],
            },
            foldStyle: {
                values: ['markbegin', 'markbeginend', 'manual'],
            },
            lineSpacing: {
                values: ['normal', 'wide', 'wider', 'narrow'],
            },
            sharedTheming:
                'Allow dialog/splits editors to have separate themes',
            sharedCompletion:
                'Allow dialog/splits editors to have separate completion settings',
        },
        'editor'
    );

    //default settings for docs
    var sessionDefaults = {
        firstLineNumber: 1,
        foldStyle: 'markbegin',
        indentedSoftWrap: true,
        navigateWithinSoftTabs: false,
        newLineMode: 'auto',
        overwrite: false,
        tabSize: 4,
        useSoftTabs: true,
        useWorker: true,
        wrap: 'off',
    };
    //default settings for editors
    var editorDefaults = {
        theme: 'ace/theme/cobalt',
        hideNonLatinChars: false,
        readOnly: false,
        annotateScrollbar: true,
        wrap: false,
        autoBeautify: true,
        enableSnippets: true,
        useNativeContextMenu: true,
        enableLiveAutocompletion: false,
        enableArgumentHints: true,
        enableBasicAutocompletion: true,
        enableIntelligentAutocompletion: true,
    };
    //runtime class
    //there is only a single instance of this class
    //you need to remove its dependency on Docs
    Docs.$defaults = sessionDefaults;
    var aceOptions = ace.Editor.prototype.$options;
    exports.add = function (edit) {
        edit.setOptions(editorDefaults);
    };
    exports.editors = null;
    exports.editor = null;
    exports.$options = aceOptions; //needed by settings menu
    exports.$defaults = editorDefaults;
    exports.setOption = function (key, val) {
        var isForSession;
        if (key.startsWith('session-')) {
            key = key.substring(8);
            isForSession = true;
        }
        if (!optionsValidator[key]) {
            this.editor.setOption(key, val);
            return;
        }
        if (optionsValidator[key].validate(val)) {
            //Perhaps, user is still typing
            if (!Number.isNaN(val))
                Notify.warn(key + ': ' + optionsValidator[key].validate(val));
            return false;
        }

        var isSessionValue =
            aceOptions[key] && aceOptions[key].forwardTo === 'session';
        var doc;
        if (isSessionValue) {
            if (val === 'default') val = sessionDefaults[key];
            doc = Docs.forSession(this.editor.session);
            if (!doc) {
                this.editor.session.setOption(key, val);
            } else if (isForSession) {
                doc.setOption(
                    key,
                    val === sessionDefaults[key] ? undefined : val
                );
            } else {
                sessionDefaults[key] = val;
                configure(key, val, 'editor');
                Docs.forEach(function (doc) {
                    if (!doc.options.hasOwnProperty(key)) {
                        doc.setOption(key, undefined);
                    }
                });
            }
        } else if (isForSession) {
            if (!editorDefaults.hasOwnProperty(key)) return false;
            doc = Docs.forSession(this.editor.session);
            this.editor.setOption(key, val);
            if (!doc) return;
            doc.setOption(key, val === editorDefaults[key] ? undefined : val);
        } else {
            var isForAllEditors =
                this.editors.length == 1 ||
                !(
                    key == 'mode' ||
                    (!editorConfig.sharedCompletion &&
                        completionSettings.indexOf(key) > -1) ||
                    (!editorConfig.sharedTheming && key === 'theme')
                );
            if (isForAllEditors || this.editor === this.editors[0]) {
                editorDefaults[key] = val;
                configure(key, val, 'editor');
            }
            if (isForAllEditors) {
                this.editors.forEach(function (e) {
                    e.setOption(key, val);
                });
            }
            if (!isForAllEditors || this.editors.indexOf(this.editor) < 0)
                this.editor.setOption(key, val);
        }
    };
    exports.getOption = function (key) {
        if (key.startsWith('session-')) {
            key = key.substring(8);
            return this.editor.getOption(key);
        } else if (key == 'mode') {
            return this.editor.session.getOption(key);
        } else if (sessionDefaults.hasOwnProperty(key)) {
            return sessionDefaults[key];
        } else if (editorDefaults.hasOwnProperty(key)) {
            return editorDefaults[key];
        }
        return this.editor.getOption(key);
    };
    exports.getOptions = function () {
        return this.editor.getOptions();
    };
    exports.setOptions = function (optList) {
        Object.keys(optList).forEach(function (key) {
            this.setOption(key, optList[key]);
        }, this);
    };

    var THEME = IsString;
    var SELECTION_STYLE = new XEnum(['line', 'text', 'fullLine', 'screenLine']);
    var NEW_LINE_MODE = new XEnum(['auto', 'windows', 'unix', 'default']);
    var CURSOR_STYLE = IsString;
    var WRAP_MODE = new XOneOf([
        new XEnum(['off', 'free', 'printMargin', 'default']),
        IsNumber,
    ]);
    var FOLD_STYLE = new XEnum(['markbegin', 'markbeginend', 'manual']);
    var LINE_SPACING = new XEnum(['wide', 'wider', 'normal', 'narrow']);
    var SCROLL_PAST_END = new Schema.XValidIf(function (val) {
        return val >= 0 && val <= 1;
    }, 'number between 0 and 1');
    var UNDO_DELTAS = new XOneOf([IsBoolean, new XEnum(['always'])]);
    var optionsValidator = {
        animatedScroll: IsBoolean,
        autoBeautify: IsBoolean,
        annotateScrollbar: IsBoolean,
        behavioursEnabled: IsBoolean,
        copyWithEmptySelection: IsBoolean,
        cursorStyle: CURSOR_STYLE,
        displayIndentGuides: IsBoolean,
        dragDelay: IsNumber,
        dragEnabled: IsBoolean,
        enableAutoIndent: IsBoolean,
        enableBasicAutocompletion: IsBoolean,
        enableBlockSelect: IsBoolean,
        enableIntelligentAutocompletion: IsBoolean,
        enableLiveAutocompletion: IsBoolean,
        enableArgumentHints: IsBoolean,
        enableMultiselect: IsBoolean,
        enableSnippets: IsBoolean,
        enableTabCompletion: IsBoolean,
        fadeFoldWidgets: IsBoolean,
        firstLineNumber: IsNumber,
        fixedWidthGutter: IsBoolean,
        focusTimeout: IsNumber,
        foldStyle: FOLD_STYLE,
        fontFamily: IsString,
        fontSize: IsNumber,
        hideNonLatinChars: IsBoolean,
        highlightActiveLine: IsBoolean,
        highlightGutterLine: IsBoolean,
        highlightSelectedWord: IsBoolean,
        hScrollBarAlwaysVisible: IsBoolean,
        indentedSoftWrap: IsBoolean,
        keyboardHandler: IsString,
        highlightErrorRegions: IsBoolean,
        keepRedoStack: IsBoolean,
        showErrorOnClick: IsBoolean,
        lineSpacing: LINE_SPACING,
        maxPixelHeight: IsNumber,
        mergeUndoDeltas: UNDO_DELTAS,
        navigateWithinSoftTabs: IsBoolean,
        newLineMode: NEW_LINE_MODE,
        overwrite: IsBoolean,
        printMargin: IsNumber,
        printMarginColumn: IsNumber,
        readOnly: IsBoolean,
        relativeLineNumbers: IsBoolean,
        scrollableGutter: IsBoolean,
        scrollPastEnd: SCROLL_PAST_END,
        scrollSpeed: IsNumber,
        selectionStyle: SELECTION_STYLE,
        showFoldWidgets: IsBoolean,
        showGutter: IsBoolean,
        showInvisibles: IsBoolean,
        showLineNumbers: IsBoolean,
        showPrintMargin: IsBoolean,
        tabSize: IsNumber,
        theme: THEME,
        tooltipFollowsMouse: IsBoolean,
        useNativeContextMenu: IsBoolean,
        useSoftTabs: IsBoolean,
        useTextareaForIME: IsBoolean,
        useWorker: IsBoolean,
        vScrollBarAlwaysVisible: IsBoolean,
        wrap: WRAP_MODE,
        wrapBehavioursEnabled: IsBoolean,
    };
    exports.validator = optionsValidator;
    
    setHandler('editor', {
        update: function (newValue, oldValue, path) {
            var success;
            for (var i in newValue) {
                if (!optionsValidator[i]) {
                    configure(newValue[i], oldValue[i], 'editor');
                    if (i === 'sharedTheming' && i === 'sharedCompletion') {
                        continue;
                    }
                }
                else if (newValue[i] === undefined && oldValue[i] === undefined) {
                    continue; //fix for undefined as default value
                } else if (exports.getOption(i) != newValue[i]) {
                    if (exports.setOption(i, newValue[i]) === false)
                        success = false;
                }
            }
            return success;
        },
        toJSON: exports.getOptions,
    });
    //Does not listen for events.
    //Plugins should use getSettingsEditor
    (function () {
        //All ace options must be loaded before this file is parsed
        //for autoBeautify option
        require('../ext/format/format_on_type');
        //for enableArgHint option
        require('../ext/language/services/hover');
        for (var i in optionsValidator) {
            if (i === 'mode') continue;
            var defaults;
            if (aceOptions[i] && aceOptions[i].forwardTo === 'session') {
                defaults = sessionDefaults;
            } else {
                defaults = editorDefaults;
            }
            register(i, 'editor');
            if (
                editorConfig.hasOwnProperty(i) &&
                editorConfig[i] !== defaults[i]
            ) {
                if (optionsValidator[i].validate(editorConfig[i])) {
                    //reset to original value or undefined
                    configure(i, defaults[i], 'editor');
                } else defaults[i] = editorConfig[i];
            }
        }
    })();
}); /*_EndDefine*/