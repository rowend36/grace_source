_Define(function(global) {
    var FileUtils = global.FileUtils;
    var Docs = global.Docs;
    var docs = global.docs;
    var Editors = global.Editors;
    var getActiveDoc = global.getActiveDoc;

    function createSettingsMenu(el) {
        var OptionsPanel = ace.require("ace/ext/options").OptionPanel;
        var SettingsPanel = new OptionsPanel(null, el[0]);
        var sessionOption = function(obj) {
            obj.getValue = function(editor) {
                return editor.getOption('session-' + obj.path);
            };
            obj.onchange = function(val, editor) {
                editor.setOption("session-" + obj.path, val);
            };
            return obj;
        };
        SettingsPanel.add({
            "Session": {
                "Soft Wrap": sessionOption({
                    type: "buttonBar",
                    path: "wrap",
                    items: [{
                            caption: "Off",
                            value: "off"
                        },
                        {
                            caption: "View",
                            value: "free"
                        },
                        {
                            caption: "margin",
                            value: "printMargin"
                        },
                        {
                            caption: "40",
                            value: "40"
                        },
                        {
                            caption: "Default",
                            value: "default"
                        }
                    ]
                }),
                "Soft Tabs": [sessionOption({
                    path: "useSoftTabs"
                }), sessionOption({
                    path: "tabSize",
                    type: "number",
                    values: [2, 3, 4, 8, 16]
                })],
                "Encoding": {
                    type: "select",
                    onchange: function(val) {
                        Docs.setEncoding(getActiveDoc().id, val);
                    },
                    getValue: function() {
                        return getActiveDoc().encoding || 'utf8';
                    },
                    get items() {
                        return FileUtils.availableEncodings(getActiveDoc().getFileServer());
                    }
                },
                "New Line Mode": sessionOption({
                    path: "newLineMode",
                    type: "buttonBar",
                    items: [{
                            caption: "Auto",
                            value: "auto"
                        },
                        {
                            caption: "Unix",
                            value: "unix"
                        }, {
                            caption: "Windows",
                            value: "windows"
                        }
                    ]
                }),
                "Read Only": sessionOption({
                    type: "checkbox",
                    path: "readOnly"
                }),
                "Hide Non-Latin Chars": sessionOption({
                    type: "checkbox",
                    path: "hideNonLatinChars"
                }),
                "Live Autocompletion": sessionOption({
                    path: "enableLiveAutocompletion"
                }),
                "Intellisense": sessionOption({
                    path: "enableIntelligentAutocompletion"
                }),
                "Show Function Parameters Hints": sessionOption({
                    path: "enableArgumentHints"
                }),

            },
            "General": {
                "Read Only": {
                    type: "checkbox",
                    path: "readOnly"
                }
            },
            "Interaction": {

                "Intellisense": {
                    path: "enableIntelligentAutocompletion"
                },
                "Show Function Parameters Hints": {
                    path: "enableArgumentHints"
                },
            },
            "Appearance": {
                "Scrollable Gutters": {
                    type: "checkbox",
                    path: "scrollableGutter"
                },
                "Hide Non-Latin Chars": {
                    type: "checkbox",
                    path: "hideNonLatinChars"
                },
            }
        });
        SettingsPanel.setEditor(Editors.getSettingsEditor());
        return SettingsPanel;
    }
    global.createSettingsMenu = createSettingsMenu;
}) /*_EndDefine*/