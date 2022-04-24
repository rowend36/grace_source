define(function(require, exports, module) {
    var completionSettings = ['enableSnippets',
        'enableLiveAutocompletion', 'enableBasicAutocompletion',
        'enableIntelligentAutocompletion', 'enableArgumentHints'
    ];
    var appStorage = require("../core/config").appStorage;
    var themelist = ace.require("ace/ext/themelist");
    var themes = themelist.themes.map(function(t) {
        return t.theme;
    });
    var Schema = require("../core/schema").Schema;
    var IsString = Schema.IsString,
        IsNumber = Schema.IsNumber,
        IsBoolean = Schema.IsBoolean,
        XOneOf = Schema.XOneOf,
        XEnum = Schema.XEnum;
    var docs = require("../docs/document").docs;
    var Docs = require("../docs/docs").Docs;
    var Notify = require("../ui/notify").Notify;
    require("../ext/format/format");
    var appConfig = require("../core/config").Config.registerAll({
        'perEditorTheming': true,
        'perEditorCompletion': false
    }, "splitEditors");
    require("../core/config").Config.registerValues({
            "theme": {
                doc: "Editor syntax highlight theme.",
                values: themes
            },
            "wrap": {
                values: [
                    ["free", "use windowWidth as limit"],
                    "printMargin", "off", "[number]"
                ]
            },
            "cursorStyle": {
                values: ["ace", "smooth", "slim", "smooth slim",
                    "wide"
                ]
            },
            "foldStyle": {
                values: ["markbegin", "markbeginend", "manual"]
            },
            "lineSpacing": {
                values: ["normal", "wide", "wider", "narrow"]
            },
        },
        "editor");
    require("../core/config").Config.registerValues({
        "perEditorTheming": "Allow dialog/splits editors to have separate themes",
        "perEditorCompletion": "Allow dialog/splits editors to have separate completion settings"
    }, "splitEditors");
    //default settings for docs
    var sessionDefaults = {
        firstLineNumber: 1,
        foldStyle: "markbegin",
        indentedSoftWrap: true,
        navigateWithinSoftTabs: false,
        newLineMode: "auto",
        overwrite: false,
        tabSize: 4,
        useSoftTabs: true,
        useWorker: true,
        wrap: "off",
    };
    //default settings for editors
    var editorDefaults = {
        theme: "ace/theme/cobalt",
        hideNonLatinChars: false,
        readOnly: false,
        annotateScrollbar: true,
        wrap: false,
        htmlBeautify: true,
        autoBeautify: true,
        enableSnippets: true,
        enableLiveAutocompletion: false,
        enableArgumentHints: true,
        enableBasicAutocompletion: true,
        enableIntelligentAutocompletion: true
    };
    var editors;
    //runtime class
    //there is only a single instance of this class
    //you need to remove its dependence 
    //tightly interwoven with Editors
    //on Docs and use of appStorage to go around that
    function EditorSettings(editor_list) {
        this.$options = ace.Editor.prototype.$options;
        this.editor = null;
        editors = editor_list;
    }
    EditorSettings.prototype.add = function(edit) {
        edit.setOptions(this.options);
    };
    EditorSettings.prototype.options = editorDefaults;
    EditorSettings.prototype.setOption = function(key, val, noSave) {
        var isForSession;
        if (key.startsWith("session-")) {
            key = key.substring(8);
            isForSession = true;
        }
        if (!optionsValidator[key]) {
            this.editor.setOption(key, val);
            return;
        }
        if (optionsValidator[key].invalid(val)) {
            if (Number.isNaN(val) || val != "") //Still typing
                Notify.warn(optionsValidator[key].invalid(val));
            return false;
        }
        var isSessionValue = this.$options[key] && this.$options[
            key].forwardTo === "session";
        var doc;
        if (isSessionValue) {
            if (val === "default") val = sessionDefaults[key];
            this.editor.session.setOption(key, val);
            if (isForSession) {
                doc = Docs.forSession(this.editor.session);
                if (!doc) return;
                if (val === sessionDefaults[key]) {
                    delete doc.options[key];
                } else doc.options[key] = val;
                Docs.tempSave(doc.id);
                return;
            } else {
                if (!noSave)
                    appStorage.setItem(key, val);
                sessionDefaults[key] = val;
                for (var i in docs) {
                    doc = docs[i];
                    if (!doc.options.hasOwnProperty(key)) {
                        doc.session.setOption(key, val);
                        //for(var k in doc.clones){
                        //not handled   
                        //}
                    }
                }
                return;
            }
        } else if (isForSession) {
            if (!editorDefaults.hasOwnProperty(key)) return false;
            this.editor.setOption(key, val);
            doc = Docs.forSession(this.editor.session);
            if (!doc) return;
            if (val == editorDefaults[key]) {
                if (doc.editorOptions) delete doc.editorOptions[
                    key];
            } else {
                if (!doc.editorOptions) {
                    doc.editorOptions = {};
                    this.editor.editorOptions = doc.editorOptions;
                }
                doc.editorOptions[key] = val;
            }
            Docs.tempSave(doc.id);
            return;
        } else {
            var isForAllEditors = (editors.length == 1 || !(key ==
                "mode" || (appConfig
                    .perEditorCompletion &&
                    completionSettings.indexOf(key) > -1) ||
                (appConfig.perEditorTheming && key ===
                    "theme")));
            if (isForAllEditors || this.editor === editors[0]) {
                if (!noSave)
                    appStorage.setItem(key, val);
                editorDefaults[key] = val;
            }
            if (isForAllEditors) {
                editors.forEach(function(e) {
                    e.setOption(key, val);
                });
            } //should use indexof
            if (this.editor !== editors[0]) this.editor.setOption(
                key, val);
        }
    };
    EditorSettings.prototype.getOption = function(key) {
        if (key.startsWith("session-")) {
            key = key.substring(8);
            return this.editor.getOption(key);
        } else if (key == "mode") {
            return this.editor.session.getOption(key);
        } else if (sessionDefaults.hasOwnProperty(key)) {
            return sessionDefaults[key];
        } else if (editorDefaults.hasOwnProperty(key)) {
            return editorDefaults[key];
        }
        return this.editor.getOption(key);
    };
    EditorSettings.prototype.getOptions = function() {
        return this.editor.getOptions();
    };
    EditorSettings.prototype.setOptions = function(optList) {
        Object.keys(optList).forEach(function(key) {
            this.setOption(key, optList[key]);
        }, this);
    };

    var THEME = IsString;
    var SELECTION_STYLE = new XEnum(['line', 'text', 'fullLine',
        'screenLine'
    ]);
    var NEW_LINE_MODE = new XEnum(['auto', 'windows', 'unix',
        'default'
    ]);
    var CURSOR_STYLE = IsString;
    var WRAP_MODE = new XOneOf([new XEnum(['off', 'free', 'printMargin',
        'default'
    ]), IsNumber]);
    var FOLD_STYLE = new XEnum(['markbegin', 'markbeginend', 'manual']);
    var LINE_SPACING = new XEnum(['wide', 'wider', 'normal', 'narrow']);
    var SCROLL_PAST_END = {
        invalid: function(val) {
            return val !== 0 && !(val > 0 && val <= 1);
        }
    };
    var UNDO_DELTAS = new XOneOf([IsBoolean, new XEnum(['always'])]);
    var optionsValidator = {
        "animatedScroll": IsBoolean,
        "autoBeautify": IsBoolean,
        "htmlBeautify": IsBoolean,
        "annotateScrollbar": IsBoolean,
        "behavioursEnabled": IsBoolean,
        "copyWithEmptySelection": IsBoolean,
        "cursorStyle": CURSOR_STYLE,
        "displayIndentGuides": IsBoolean,
        "dragDelay": IsNumber,
        "dragEnabled": IsBoolean,
        "enableAutoIndent": IsBoolean,
        "enableBasicAutocompletion": IsBoolean,
        "enableBlockSelect": IsBoolean,
        "enableIntelligentAutocompletion": IsBoolean,
        "enableLiveAutocompletion": IsBoolean,
        "enableArgumentHints": IsBoolean,
        "enableMultiselect": IsBoolean,
        "enableSnippets": IsBoolean,
        "enableTabCompletion": IsBoolean,
        "fadeFoldWidgets": IsBoolean,
        "firstLineNumber": IsNumber,
        "fixedWidthGutter": IsBoolean,
        "focusTimeout": IsNumber,
        "foldStyle": FOLD_STYLE,
        "fontFamily": IsString,
        "fontSize": IsNumber,
        "hideNonLatinChars": IsBoolean,
        "highlightActiveLine": IsBoolean,
        "highlightGutterLine": IsBoolean,
        "highlightSelectedWord": IsBoolean,
        "hScrollBarAlwaysVisible": IsBoolean,
        "indentedSoftWrap": IsBoolean,
        "keyboardHandler": IsString,
        'highlightErrorRegions': IsBoolean,
        'keepRedoStack': IsBoolean,
        'showErrorOnClick': IsBoolean,
        'lineSpacing': LINE_SPACING,
        "maxPixelHeight": IsNumber,
        "mergeUndoDeltas": UNDO_DELTAS,
        "navigateWithinSoftTabs": IsBoolean,
        "newLineMode": NEW_LINE_MODE,
        "overwrite": IsBoolean,
        "printMargin": IsNumber,
        "printMarginColumn": IsNumber,
        "readOnly": IsBoolean,
        "relativeLineNumbers": IsBoolean,
        "scrollableGutter": IsBoolean,
        "scrollPastEnd": SCROLL_PAST_END,
        "scrollSpeed": IsNumber,
        "selectionStyle": SELECTION_STYLE,
        "showFoldWidgets": IsBoolean,
        "showGutter": IsBoolean,
        "showInvisibles": IsBoolean,
        "showLineNumbers": IsBoolean,
        "showPrintMargin": IsBoolean,
        "tabSize": IsNumber,
        "theme": THEME,
        "tooltipFollowsMouse": IsBoolean,
        "useSoftTabs": IsBoolean,
        "useTextareaForIME": IsBoolean,
        "useWorker": IsBoolean,
        "vScrollBarAlwaysVisible": IsBoolean,
        "wrap": WRAP_MODE,
        "wrapBehavioursEnabled": IsBoolean
    };
    /*Manage some inbuilt options*/
    //Currently requires all options are loaded before this file is parsed
    for (var i in optionsValidator) {
        var s = appStorage.getItem(i);

        if (s !== null && s !== undefined) {
            if (s == "true") s = true;
            else if (s == "false") s = false;
            else if (s == "undefined") s = undefined;
            else if (s == "null") s = null;
            else if (!isNaN(s)) s = parseFloat(s);
            if (!optionsValidator[i].invalid(s)) {
                if (ace.Editor.prototype.$options[i] && ace.Editor
                    .prototype.$options[i].forwardTo ===
                    "session") {
                    sessionDefaults[i] = s;
                } else {
                    editorDefaults[i] = s;
                }
            } else {
                console.log(i, s, optionsValidator[i].invalid(s));
                appStorage.removeItem(i);
            }
        }
    }
    var debug = console;
    if (sessionDefaults.hasOwnProperty('mode')) {
        debug.error('mode set in defaults');
        delete sessionDefaults.mode;
    }
    EditorSettings.prototype.validator = optionsValidator;
    Docs.$defaults = sessionDefaults;
    exports.EditorSettings = EditorSettings;
}); /*_EndDefine*/