_Define(function(global) {
    var completionSettings = [
        'enableSnippets',
        'enableLiveAutocompletion',
        'enableBasicAutocompletion',
        'enableIntelligentAutocompletion',
        'enableArgumentHints'
    ];
    var appStorage = global.appStorage;
    var themes = ace.require("ace/ext/themelist").themes.map(function(t) { return t.theme });
    
    var docs = global.docs;
    var Doc = global.Doc;
    
    var appConfig = global.registerAll({
        'perEditorTheming': true,
        'perEditorCompletion': false
    },"multieditors");
    global.registerValues({
        "editor": "Configuration for ace editor",
        "theme": themes.join(",").replace(/(.{50,60})\,/g, "$1\n,"),
        "wrap": "free(use windowWidth as limit), printMargin, off, [number]",
        "cursorStyle": "ace, smooth, slim, smooth slim, wide",
        "foldStyle": "markbegin, markbeginend, manual",
        "perEditorTheming": "Allow dialog/splits editors to have separate themes",
        "perEditorCompletion": "Allow dialog/splits editors to have separate completion settings"
    });

    //default settings for docs
    var sessionSettings = {
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
        wrapMethod: "auto"
    };
    //default settings for editors
    var options = {
        theme: "ace/theme/monokai",
        hideNonLatinChars: false,
        readOnly:false,
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
    //there is only a single instance of this class
    //you need to remove its dependence 
    //on Doc and use of appStorage to go around that
    function EditorSettings(editor_list) {
        this.$options = ace.Editor.prototype.$options;
        this.editor = null;
        editors = editor_list;
    }

    EditorSettings.prototype.add = function(edit) {
        edit.setOptions(this.options);
    };
    EditorSettings.prototype.options = options;
    EditorSettings.prototype.setOption = function(key, val) {
        var isForSession;
        if (key.startsWith("session-")) {
            key = key.substring(8);
            isForSession = true;
        }
        if (!optionsValidator[key]) {
            this.editor.setOption(key, val);
            return;
        }
        if (!optionsValidator[key].test(val)) {
            console.warn('Invalid Value ' + val + ' for ' + key);
            return false;
        }
        var isSessionValue = this.$options[key] && this.$options[key].forwardTo === "session";
        var doc;
        if (isSessionValue) {
            if (val === "default")
                val = sessionSettings[key];
            this.editor.session.setOption(key, val);
            if (isForSession) {
                doc = Doc.forSession(this.editor.session);
                if (!doc)
                    return;
                if (val === sessionSettings[key]) {
                    delete doc.options[key];
                }
                else doc.options[key] = val;

                Doc.tempSave(doc.id);
                return;
            }
            else {
                appStorage.setItem(key, val);
                sessionSettings[key] = val;
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
        }
        else if (isForSession) {
            if(!options.hasOwnProperty(key))return;
            this.editor.setOption(key, val);
            doc = Doc.forSession(this.editor.session);
            if (!doc) return;
            if (val == options[key]) {
                if (doc.editorOptions)
                    delete doc.editorOptions[key];
            }
            else {
                if (!doc.editorOptions)
                    doc.editorOptions = {};
                doc.editorOptions[key] = val;
            }
            Doc.tempSave(doc.id);
            return;
        }
        else {
            var isForAllEditors = (editors.length == 1 || !(key == "mode" ||
                (appConfig.perEditorCompletion && completionSettings.indexOf(key) > -1) ||
                (appConfig.perEditorTheming && key === "theme")));
            if (isForAllEditors || this.editor === editors[0]) {
                appStorage.setItem(key, val);
                options[key] = val;
            }
            if (isForAllEditors) {
                editors.forEach(function(e) {
                    e.setOption(key, val);
                });
            }
            else this.editor.setOption(key, val);
        }
    };
    EditorSettings.prototype.getOption = function(key) {
        if (key.startsWith("session-")) {
            key = key.substring(8);
            return this.editor.getOption(key);
        }
        else if(key == "mode"){
            return this.editor.session.getOption(key);
        }
        else if (sessionSettings.hasOwnProperty(key)) {
            return sessionSettings[key];
        }
        else if (options.hasOwnProperty(key)) {
            return options[key];
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

    var BOOL = /^true|false$/;
    var NUMBER = /^\d+(\.\d+)?$/;
    var STRING = /[^'"\n\r]+/;
    var THEME = {
        test: function(val) {
            return STRING.test(val);
        }
    };
    var SELECTION_STYLE = /(line|text|fullLine|screenLine)/;
    var CURSOR_STYLE = Object.assign({}, THEME);
    var NEW_LINE_MODE = /(auto|windows|linux|default)/;
    var WRAP_MODE = /(off|free|printMargin|\d+|default)/;
    var FOLD_STYLE = /(markbegin|markbeginend|manual)/;
    var SCROLL_PAST_END = {
        test: function(val) {
            return val === 0 || (val > 0 && val < 1);
        }
    };
    var optionsValidator = {
        "animatedScroll": BOOL,
        "autoBeautify": BOOL,
        "htmlBeautify": BOOL,
        "behavioursEnabled": BOOL,
        "copyWithEmptySelection": BOOL,
        "cursorStyle": CURSOR_STYLE,
        "displayIndentGuides": BOOL,
        "dragDelay": NUMBER,
        "dragEnabled": BOOL,
        "enableAutoIndent": BOOL,
        "enableBasicAutocompletion": BOOL,
        "enableBlockSelect": BOOL,
        "enableIntelligentAutocompletion": BOOL,
        "enableLiveAutocompletion": BOOL,
        "enableArgumentHints": BOOL,
        "enableMultiselect": BOOL,
        "enableSnippets": BOOL,
        "enableTabCompletion": BOOL,
        "fadeFoldWidgets": BOOL,
        "firstLineNumber": NUMBER,
        "fixedWidthGutter": BOOL,
        "focusTimeout": NUMBER,
        "foldStyle": FOLD_STYLE,
        "fontFamily": STRING,
        "fontSize": NUMBER,
        "hideNonLatinChars": BOOL,
        "highlightActiveLine": BOOL,
        "highlightGutterLine": BOOL,
        "highlightSelectedWord": BOOL,
        "hScrollBarAlwaysVisible": BOOL,
        "indentedSoftWrap": BOOL,
        "keyboardHandler": STRING,
        "maxPixelHeight": NUMBER,
        "mergeUndoDeltas": BOOL,
        "navigateWithinSoftTabs": BOOL,
        "newLineMode": NEW_LINE_MODE,
        "overwrite": BOOL,
        "printMargin": NUMBER,
        "printMarginColumn": NUMBER,
        "readOnly": BOOL,
        "relativeLineNumbers": BOOL,
        "scrollableGutter": BOOL,
        "scrollPastEnd": SCROLL_PAST_END,
        "scrollSpeed": NUMBER,
        "selectionStyle": SELECTION_STYLE,
        "showFoldWidgets": BOOL,
        "showGutter": BOOL,
        "showInvisibles": BOOL,
        "showLineNumbers": BOOL,
        "showPrintMargin": BOOL,
        "tabSize": NUMBER,
        "theme": THEME,
        "tooltipFollowsMouse": BOOL,
        "useSoftTabs": BOOL,
        "useTextareaForIME": BOOL,
        "useWorker": BOOL,
        "vScrollBarAlwaysVisible": BOOL,
        "wrap": WRAP_MODE,
        "wrapBehavioursEnabled": BOOL
    };
    
    for (var i in optionsValidator) {
        var s = appStorage.getItem(i);
        if (s !== null && s !== undefined && s != "undefined" && s !== "null") {
            if (optionsValidator[i].test(s)) {
                if (s == "true") s = true;
                else if (s == "false") s = false;
                else if (s == "undefined") s = undefined;
                else if (s == "null") s = null;
                else if (!isNaN(s)) s = parseInt(s);
                if (ace.Editor.prototype.$options[i] && ace.Editor.prototype.$options[i].forwardTo === "session") {
                    sessionSettings[i] = s;
                }
                else {
                    options[i] = s;
                }
            }
            else {
                appStorage.removeItem(i);
            }
        }
    }
    if(sessionSettings.hasOwnProperty('mode')){
        console.error('mode set in defaults');
        delete sessionSettings.mode;
    }
    Doc.$defaults = sessionSettings;
    global.MultiEditor = EditorSettings;
})/*_EndDefine*/