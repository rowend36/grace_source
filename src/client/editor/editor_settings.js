define(function (require, exports, module) {
    /* globals ace */
    var themelist = require('ace!ext/themelist');
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
    var config = require('ace!config');
    var Config = require('grace/core/config').Config;
    var Editor = require('ace!editor').Editor;

    var editorConfig = require('../core/config').Config.registerAll(
        {
            sharedTheming: true,
        },
        'editor',
    );
    require('../core/config').Config.registerInfo(
        {
            '!root': {
                type: new Schema.XMap(IsString, Schema.IsPlain),
            },
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
            maxLines: 'no-user-config',
            minLines: 'no-user-config',
            maxPixelHeight: 'no-user-config',
            autoScrollEditorIntoView: 'no-user-config',
            placeholder: 'no-user-config',
            hasCssTransforms: 'no-user-config',
            mode: 'no-user-config',
        },
        'editor',
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
        fontSize: 12,
        annotateScrollbar: true,
        wrap: false,
        useNativeContextMenu: true,
    };
    //runtime class
    //there is only a single instance of this class
    //you need to remove its dependency on Docs
    Docs.$defaults = sessionDefaults;
    var aceOptions = ace.Editor.prototype.$options;
    var Settings = exports;
    Settings.add = function (edit) {
        edit.setOptions(editorDefaults);
    };
    Settings.options = editorDefaults;
    Settings.editors = null;
    Settings.editor = null;
    Settings.$options = aceOptions; //needed by settings menu
    Settings.$defaults = editorDefaults;

    Settings.addOption = function (key, option, type) {
        if (!option) {
            option = Editor.prototype.$options[key];
        } else {
            //Add to Ace Config
            var temp = {};
            temp[key] = option;
            config.defineOptions(Editor.prototype, 'editor', temp);
        }
        //Add to Config
        Config.register(key, 'editor', option.value);
        editorDefaults[key] = editorConfig.hasOwnProperty(key)
            ? editorConfig[key]
            : option.value;

        //Setup for optionsValidator
        optionsValidator[key] = type ? Schema.parse(type) : IsBoolean;
        if (!Settings.editors) return;
        Settings.editors.forEach(function (e) {
            var doc = Docs.forSession(e.session);
            var val =
                doc &&
                doc.editorOptions &&
                doc.editorOptions.hasOwnProperty(key)
                    ? doc.editorOptions[key]
                    : editorDefaults[key];
            e.setOption(key, val);
        });
    };
    Settings.setOption = function (key, val) {
        var isForSession;
        if (key.startsWith('session-')) {
            key = key.substring(8);
            isForSession = true;
        }
        if (!optionsValidator[key]) {
            Settings.editor.setOption(key, val);
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
            doc = Docs.forSession(Settings.editor.session);
            if (!doc) {
                Settings.editor.session.setOption(key, val);
            } else if (isForSession) {
                doc.setOption(
                    key,
                    val === sessionDefaults[key] ? undefined : val,
                );
            } else {
                sessionDefaults[key] = val;
                configure(key, val, 'editor', true);
                Docs.forEach(function (doc) {
                    if (!doc.options.hasOwnProperty(key)) {
                        doc.setOption(key, undefined);
                    }
                });
            }
        } else if (isForSession) {
            if (!editorDefaults.hasOwnProperty(key)) return false;
            doc = Docs.forSession(Settings.editor.session);
            Settings.editor.setOption(key, val);
            if (!doc) return;
            doc.setOption(key, val === editorDefaults[key] ? undefined : val);
        } else {
            var isForAllEditors =
                Settings.editors.length == 1 ||
                !(
                    key == 'mode' ||
                    (!editorConfig.sharedTheming && key === 'theme')
                );
            if (isForAllEditors || Settings.editor === Settings.editors[0]) {
                editorDefaults[key] = val;
                configure(key, val, 'editor', true);
            }
            if (isForAllEditors) {
                Settings.editors.forEach(function (e) {
                    e.setOption(key, val);
                });
            }
            if (
                !isForAllEditors ||
                Settings.editors.indexOf(Settings.editor) < 0
            )
                Settings.editor.setOption(key, val);
        }
    };
    Settings.getOption = function (key) {
        if (key.startsWith('session-')) {
            key = key.substring(8);
            return Settings.editor.getOption(key);
        } else if (key == 'mode') {
            return Settings.editor.session.getOption(key);
        } else if (sessionDefaults.hasOwnProperty(key)) {
            return sessionDefaults[key];
        } else if (editorDefaults.hasOwnProperty(key)) {
            return editorDefaults[key];
        }
        return Settings.editor.getOption(key);
    };
    Settings.getOptions = function () {
        return Settings.editor.getOptions();
    };
    Settings.setOptions = function (optList) {
        Object.keys(optList).forEach(function (key) {
            Settings.setOption(key, optList[key]);
        });
    };

    var THEME = IsString;
    var SELECTION_STYLE = new XEnum(['line', 'text', 'fullLine', 'screenLine']);
    var NEW_LINE_MODE = new XEnum(['auto', 'windows', 'unix', 'default']);
    var CURSOR_STYLE = IsString;
    var WRAP_MODE = new XOneOf([
        new XEnum(['off', 'free', 'printMargin', 'default']),
        IsNumber,
    ]);
    var KBHANDLER = new XOneOf([IsString, Schema.IsNull], 'undefined');
    var FOLD_STYLE = new XEnum(['markbegin', 'markbeginend', 'manual']);
    var LINE_SPACING = new XEnum(['wide', 'wider', 'normal', 'narrow']);
    var SCROLL_PAST_END = new Schema.XValidIf(function (val) {
        return val >= 0 && val <= 1;
    }, 'number between 0 and 1');
    var UNDO_DELTAS = new XOneOf([IsBoolean, new XEnum(['always'])]);
    var optionsValidator = {
        animatedScroll: IsBoolean,
        annotateScrollbar: IsBoolean,
        behavioursEnabled: IsBoolean,
        copyWithEmptySelection: IsBoolean,
        cursorStyle: CURSOR_STYLE,
        displayIndentGuides: IsBoolean,
        dragDelay: IsNumber,
        dragEnabled: IsBoolean,
        enableAutoIndent: IsBoolean,
        enableBlockSelect: IsBoolean,
        enableMultiselect: IsBoolean,
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
        keyboardHandler: KBHANDLER,
        highlightErrorRegions: IsBoolean,
        keepRedoStack: IsBoolean,
        showErrorOnClick: IsBoolean,
        lineSpacing: LINE_SPACING,
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
    Settings.validator = optionsValidator;
    Config.getConfigInfo('editor').type.schemas = optionsValidator;

    setHandler('editor', {
        update: function (newValue, oldValue, path) {
            var success;
            for (var i in newValue) {
                if (i === 'sharedTheming') {
                    configure(i, newValue[i], 'editor');
                    continue;
                } else if (
                    newValue[i] === undefined &&
                    oldValue[i] === undefined
                ) {
                    continue; //fix for undefined as default value
                } else if (!optionsValidator[i])
                    Notify.inform('Unknown editor option ' + i);
                else if (Settings.getOption(i) != newValue[i]) {
                    if (
                        Settings.setOption(
                            i,
                            newValue[i] === undefined
                                ? editorDefaults[i]
                                : newValue[i],
                        ) === false
                    )
                        success = false;
                }
            }
            return success;
        },
        toJSON: Settings.getOptions.bind(Settings),
    });
    //Does not listen for events.
    //Plugins should use getSettingsEditor
    (function () {
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