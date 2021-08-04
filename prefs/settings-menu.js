_Define(function(global) {
    var FileUtils = global.FileUtils;
    var Docs = global.Docs;
    var docs = global.docs;
    var Editors = global.Editors;
    var getActiveDoc = global.getActiveDoc;

    var settingsMenu = $("#settings");

    var OptionsPanel = ace.require("ace/ext/options").OptionPanel;
    var SettingsPanel = new OptionsPanel(null, settingsMenu[0]);
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
                    var doc = getActiveDoc();
                    Docs.setEncoding(doc && doc.id, val);
                },
                getValue: function() {
                    var doc = getActiveDoc();
                    return (doc && doc.encoding) || 'utf8';
                },
                get items() {
                    var doc = getActiveDoc();
                    return FileUtils.availableEncodings(doc ? doc.getFileServer() : FileUtils
                        .defaultServer);
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
            "Annotate Scrollbar": {
                type: "checkbox",
                path: "annotateScrollbar"
            },
            "Hide Non-Latin Chars": {
                type: "checkbox",
                path: "hideNonLatinChars"
            },
        }
    });
    SettingsPanel.renderOption = function(key, option) {
        if (option.path && !this.editor.$options[option.path] && !option.onchange)
            return;
        this.options[option.path] = option;
        var safeKey = "-" + option.path;
        key = key[0].toUpperCase() + key.slice(1).toLowerCase();
        var control = this.renderOptionControl(safeKey, option);
        if (option.type !== "checkbox" && option.type || Array.isArray(option) || option.items) {
            return ["tr", {
                    class: "ace_optionsMenuEntry"
                },
                ["td",
                    {
                        'colspan': 2,
                        class: "ace_optionsMenuFloat"
                    },
                    ["span", {
                        for: safeKey
                    }, key],
                    ["div", {
                        class: 'right'
                    }, control]
                ]
            ];
        } else return ["tr", {
                class: "ace_optionsMenuEntry"
            },
            ["td",
                ["span", {
                    for: safeKey
                }, key]
            ],
            ["td", control]
        ];
    };
    SettingsPanel.setEditor(Editors.getSettingsEditor());
    SettingsPanel.on("setOption", function() {
        for (var i in docs) {
            if (docs[i].constructor == global.SettingsDoc) {
                docs[i].setDirty();
            }
        }
    });
    global.SettingsPanel = SettingsPanel;

    function updateSettings() {
        SettingsPanel.render();
        settingsMenu.find(".header").attr('class',
            'sub-header option_header edge_box-1').append("<span class='side-1 material-icons-b4 unfold-icon'></span>");
        settingsMenu.find('tr').addClass('border-inactive');
        global.styleCheckbox(settingsMenu);
    }
    global.SideViewTabs["owner-#settings"] = {
        update: updateSettings,
    };
    $("#settings_tab").show();
}); /*_EndDefine*/