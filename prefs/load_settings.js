_Define(function(global) {
    var Docs = global.Docs;
    var Doc = global.Doc;
    var allConfigs = global.allConfigs;
    var getInfo = global.getConfigInfo;
    var configure = global.configure;
    var configEvents = global.configEvents;
    var appStorage = global.appStorage;
    var Notify = global.Notify;
    var MainMenu = global.MainMenu;
    var setBinding = global.setBinding;
    var addDoc = global.addDoc;
    var getBindings = global.getBindings;
    var getBeautifier = global.getBeautifier;
    var NO_USER_CONFIG = "no-user-config";
    global.registerValues({
        "resetAllValues": "Clear all values to initial(needs restart)\nYou can specify <true> to clear all values or a comma separated list of namespaces eg search,editor"
    });

    function getSettingsJson(editor) {
        var doc_settings = {};
        for (var i in allConfigs) {
            if (getInfo(i) === NO_USER_CONFIG)
                continue;
            doc_settings[i] = {};
            var values = allConfigs[i];
            for (var j in values) {
                if (getInfo(j,i) == NO_USER_CONFIG)
                    continue;
                doc_settings[i][j] = values[j];
            }
        }
        doc_settings.editor = Object.assign({}, editor.getOptions(), Docs.$defaults);
        doc_settings.resetAllValues = false;
        doc_settings.keyBindings = getBindings(editor, true);
        var a = JSON.stringify(doc_settings, keepUndefined);
        return a;
    }

    function keepUndefined(key, value) {
        if (value === undefined) {
            return null;
        }
        return value;
    }

    function insertComments(str) {
        var lines = [];
        var re = /(\s*)\"(.+)\"\s*\:/;
        var strl = str.split("\n");
        for (var i in strl) {
            var key = re.exec(strl[i]);
            lines.push(strl[i]);
            var info = key && getInfo(key[2]);
            if (info) {
                var comments = info.split("\n");
                if (comments.length > 1) {
                    for (var j in comments) {
                        lines.push(key[1] + "/*" + comments[j]);
                    }
                    lines.push(key[1] + "*/\n");
                } else lines.push(key[1] + "/*" + info + "*/\n");
            }
        }
        return lines.join("\n");
    }

    function stripComments(str) {
        var re = /(\\)|(\"|\')|(\/\*)|(\*\/)|(\/\/)|(\n)/g;
        var lines = [];
        var comments = [];
        var inComment = false;
        var inString = false;
        var escaped = false;
        var inLineComment = false;
        var i = 0;
        var j = 0;
        var k = 0;
        for (;;) {
            i = re.exec(str);
            if (i) {
                //open comment
                if (i[3]) {
                    if (!inComment && !inString) {
                        k = i.index;
                        lines.push(str.substring(j, k));
                        inComment = true;
                    }
                }
                //close comment
                else if (i[4]) {
                    if (inComment) {
                        j = i.index + 2;
                        comments.push(str.substring(k, j));
                        inComment = false;
                    } else if (!inString) {
                        //regex
                        //throw new Error('Error: Parse Error ' + i);
                    }
                } else if (inComment) {
                    continue;
                }
                //open line comment
                else if (i[5]) {
                    if (!(inLineComment || inString)) {
                        k = i.index;
                        lines.push(str.substring(j, k));
                        inLineComment = true;
                    }
                } else if (i[6]) {
                    if (inLineComment) {
                        j = i.index;
                        comments.push(str.substring(k, j));
                        inLineComment = false;
                    } else if (inString) {
                        //throw error
                    }
                } else if (i[2]) {
                    if (escaped != i.index) {
                        if (i[2] == inString)
                            inString = false;
                        else inString = i[2];
                    }
                } else if (i[1]) {
                    if (inString && escaped != i.index)
                        escaped = i.index + 1;
                }
            } else {
                if (!inComment)
                    lines.push(str.substring(j));
                break;
            }
        }
        return lines.join("");
    }

    function isValid(key) {
        var s = key.split("|");
        return s.every(function(e) {
            return /^(Ctrl-)?(Alt-)?(Shift-)?(((Page)?(Down|Up))|Left|Right|Delete|Tab|Home|End|Insert|Esc|Backspace|Space|.|F1?[0-9])$/i.test(e);
        });
    }

    function setSettingsJson(text, editor) {
        text = stripComments(text);
        var failed = false;
        var doc_settings = JSON.parse(text);
        if (doc_settings.resetAllValues) {
            var toReset, caption;
            if (doc_settings.resetAllValues == true) {
                toReset = Object.keys(doc_settings);
                caption = "all your configuration";
            } else {
                toReset = doc_settings.resetAllValues.split(",");
                caption = "all your configurations in\n" + toReset.join(",\n");
            }
            Notify.ask("This will reset " + caption + "\n   Continue?", function() {
                for (var y in toReset) {
                    var l = toReset[y];
                    if (l == "resetAllValues") {
                        continue;
                    }
                    if (l == "keyBindings") {
                        appStorage.removeItem("keyBindings");
                    } else
                        for (var m in doc_settings[l]) {
                            appStorage.removeItem(m);
                        }
                }
                Notify.info('Restart Immediately to Apply Changes');
            });
            return;
        }
        for (var i in doc_settings) {
            if (i == "editor" || i == "keyBindings" || i == "resetAllValues") {
                continue;
            }
            var newValue = doc_settings[i];
            var oldValue = allConfigs[i];
            if (!oldValue) {
                Notify.warn('Unknown group ' + i);
                failed = true;
                continue;
            }
            for (var j in newValue) {
                if (!oldValue.hasOwnProperty(j)) {
                    Notify.warn('Unknown option ' + i + ' in group ' + j);
                    failed = true;
                    continue;
                }
                if (newValue[j] != oldValue[j]) {
                    configure(j, newValue[j], i);
                    if (configEvents.trigger(i, {
                            config: j,
                            old: oldValue[j],
                            newValue: newValue[j]
                        }).defaultPrevented)
                        failed = true;
                }
            }
        }
        for (i in doc_settings.editor) {
            //no global mode
            if (i == "mode") continue;
            if (editor.getOption(i) != doc_settings.editor[i])
                failed = (editor.setOption(i, doc_settings.editor[i]) === false) || failed;
        }
        var bindings = getBindings(editor);
        for (i in doc_settings.keyBindings) {
            if (i == "$shadowed" || !doc_settings.keyBindings[i]) continue;
            if (!bindings.hasOwnProperty(i)) {
                Notify.warn('Unknown command ' + i);
                failed = true;
            }
            if (!isValid(doc_settings.keyBindings[i])) {
                Notify.warn('Unknown keystring ' + doc_settings.keyBindings[i]);
                failed = true;
                continue;
            }
            if (bindings[i] != doc_settings.keyBindings[i])
                setBinding(i, doc_settings.keyBindings[i], editor);
        }
        return failed;
    }
    var editor;

    function SettingsDoc() {
        var t = arguments;
        Docs.apply(this, ["", "config.json", "ace/mode/javascript", t[3], t[4], t[5]]);
        if (editor && !t[3] /*id*/ ) {
            this.refresh(null, true);
        }
    }
    SettingsDoc.prototype = Object.create(Doc.prototype);

    SettingsDoc.prototype.save = function() {
        this.dirty = setSettingsJson(this.getValue(), editor);
        if (!this.dirty) {
            this.setClean();
        }
    };
    SettingsDoc.prototype.refresh = function(callback, force, ignoreDirty) {
        //ignore autorefresh
        if (force !== false) {
            var doc = this;
            var val = getSettingsJson(editor);

            getBeautifier("json")(val, {
                "end-expand": true,
                "wrap_line_length": 20
            }, function(val) {
                val = insertComments(val);
                if (editor) {
                    Docs.setValue(doc, val, callback, force, ignoreDirty);
                } else callback && callback(this);
            });
            return true;
        }

    };
    SettingsDoc.prototype.getSavePath = function() {
        return null;
    };
    MainMenu.addOption("load-settings", {
        icon: "settings",
        caption: "Configuration",
        close: true,
        onclick: function() {
            addDoc(new SettingsDoc());
        }
    }, true);
    SettingsDoc.prototype.factory = 'settings9';
    Docs.registerFactory('settings9', SettingsDoc);
    global.SettingsDoc = SettingsDoc;
    global.stripComments = stripComments;
    SettingsDoc.setEditor = function(edit) {
        editor = edit;
    };
}) /*_EndDefine*/