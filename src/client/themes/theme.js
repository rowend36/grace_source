define(function(require, exports, module) {
    /*Theming - Spent a lot of time on this.*/
    "use strict";
    require("./fonts");
    /* globals $ */
    var configEvents = require("../core/config").ConfigEvents;
    var appEvents = require("../core/events").AppEvents;
    var JSONExt = require("../core/json_ext").JSONExt;
    var ThemeGen = require("./colors").ThemeGen;
    var DocsTab = require("../setup/setup_tab_host").DocsTab;
    var appConfig = require("../core/config").Config.registerAll({
        appUITheme: "classic",
        appFontSize: "normal",
        customThemes: [],
        singleTabLayout: false,
    });
    var configureArr = require("../core/config").Config.configureArr;
    var getSettingsEditor = require("../editor/editors").Editors
        .getSettingsEditor;

    require("../core/config").Config.registerValues({
        appUITheme: {
            doc: "Choose UI theme",
            values: themes,
        },
        appFontSize: {
            doc: "Font size for UI",
            values: ["small", "normal", "big"],
        },
        customThemes: {
            //Until we can delete themes
            type: [{
                name: "string",
                filepath: "filename",
                isDark: "?boolean",
                server: "?string",
            }, ],
        },
    });
    var themes = ["classic", "auto"];

    function onChange(ev) {
        switch (ev.config) {
            case "appUITheme":
                if (ev.newValue != "auto" && ev.newValue !==
                    "classic") {
                    for (var i in appConfig.customThemes) {
                        if (appConfig.customThemes[i].name == i) {
                            getSettingsEditor().setOption(
                                "theme",
                                _id(appConfig.customThemes[i].name)
                            );
                            return;
                        }
                    }
                    require("../ui/notify").Notify.error(
                        "Unknown theme " + ev.newValue);
                    ev.preventDefault();
                } else updateTheme($(".editor-primary"), true);
                break;
            case "customThemes":
                var themes = appConfig.customThemes;
                themes.length = 2;
                appConfig.customThemes = [];
                themes.forEach(addTheme);
                themes.push.apply(
                    themes,
                    ev.newValue.map(function(e) {
                        return e.name;
                    })
                );
                updateList();
                break;
            case "appFontSize":
                switch (ev.newValue) {
                    case "small":
                    case "normal":
                    case "big":
                        clearClass($(document.body.parentElement),
                            /font$/);
                        document.body.parentElement.className += " " +
                            ev.newValue + "font";
                        break;
                    default:
                        ev.preventDefault();
                }
                break;
            case "singleTabLayout":
                DocsTab.setSingleTabs(ev.newValue);
                break;
        }
    }
    configEvents.on("application", onChange);
    //App Theming
    var removeSplashScreen = require("../core/utils").Utils.delay(
        function() {
            document.body.parentElement.className += " " + appConfig
                .appFontSize + "font";
            $(".splash-screen").animate({
                paddingLeft: 200,
                opacity: 0,
                easing: "linear"
            }, 500, function() {
                $(".splash-screen").detach();
            });
            removeSplashScreen = null;
        }, 100);
    appEvents.once("appLoaded", function() {
        removeSplashScreen();
    });

    //Themes that can be used with a tweak of contrast/tint.
    //Only the best 10/23 were chosen
    var autoTheme = {
        "ace-dracula": "theme-dark-bg",
        "ace-idle-fingers": "theme-dark-bg",
        "ace-solarized-dark": "theme-dark-bg theme-contrast",
        "ace-nord-dark": "theme-dark-bg theme-contrast",
        "ace-pastel-on-dark": "theme-contrast",
        "ace-cobalt": "theme-ace-cobalt",
        "ace-gruvbox": "theme-ace-gruvbox",
        "ace-gob": "theme-ace-gob",
        "ace-tomorrow-night": "theme-ace-tomorrow-night",
    };
    var themelist = ace.require("ace/ext/themelist");
    var themeData = {
        className: "ace-tm",
        aceTheme: {},
    };
    exports.setTheme = function(ace_theme) {
        themeData = {
            aceTheme: ace_theme,
            className: ace_theme.cssClass,
            isDark: ace_theme.isDark,
        };
        appEvents.trigger("themeChange", {
            theme: themeData,
        });
        var els = $(".editor-primary");
        updateTheme(els, true);
    };
    appEvents.on("editorThemeLoaded", function(e) {
        exports.setTheme(e.theme);
    });

    function clearClass(els, regex) {
        els.each(function() {
            this.className = this.className
                .split(" ")
                .filter(function(e) {
                    return !regex.test(e);
                })
                .join(" ");
        });
    }

    function updateTheme(els, added) {
        if (!added) {
            els.addClass("editor-primary");
        }
        var ev = themeData;
        var currentTheme = appConfig.appUITheme;
        clearClass(els, /theme|^ace/);
        if (themeData.aceTheme.isappUITheme) {
            if (ev.isDark) {
                els.addClass("theme-dark");
            }
            els.addClass(themeData.aceTheme.rootClassName);
        } else if (currentTheme == "auto" && autoTheme[ev.className]) {
            els.addClass(ev.className);
            els.addClass("theme-dark");
            els.addClass("theme-auto");
            els.addClass(autoTheme[ev.className]);
        } else {
            /*fallback to classic*/
            clearClass(els, /theme|^ace/);
            if (ev.isDark) {
                els.addClass("theme-dark");
                els.addClass("app-theme-dark");
            } else els.addClass("app-theme-light");
        }
    }

    function addTheme(data, theme) {
        if (typeof theme !== "object") theme = null;
        for (var i in appConfig.customThemes) {
            if (appConfig.customThemes[i].name == data.name) {
                appConfig.customThemes[i] = data;
                break;
            }
        }
        if (appConfig.customThemes.indexOf(data) < 0) {
            appConfig.customThemes.push(data);
        }
        // if (themes.indexOf(data.name) < 0)
        //     themes.push(data.name);

        var id = _id(data.name);
        /*Shouldn't really bother trying to keep this in sync*/
        var themeData = themelist.themesByName[data.name];
        if (themelist.themes.indexOf(themeData) > -1) {
            themelist.themes.splice(themelist.themes.indexOf(themeData),
                1);
        }
        themeData = {
            theme: id,
            name: data.name,
            isDark: data.isDark,
            caption: data.name,
        };
        themelist.themesByName[data.name] = themeData;
        themelist.themes.push(themeData);
        if (ace.define.modules) {
            ace.define.modules[id] = null;
        } else {
            window.require.undef(id);
            //not sure how safe this is
        }
        ace.config.$loading[id] = null;
        ace.define(id, [], function(req, exports) {
            try {
                exports.cssClass = "ace_vs_theme";
                exports.cssText = "";
                exports.isappUITheme = true;
                exports.isDark = data.isDark;
                exports.rootClassName = "theme-" + id;
                if (theme) {
                    ThemeGen.vs(theme, id);
                } else {
                    appEvents.on("appLoaded", function() {
                        removeSplashScreen &&
                            removeSplashScreen.cancel();
                        var server = FileUtils
                            .getFileServer(data.server,
                                true);
                        FileUtils.getDoc(
                            data.filepath,
                            server,
                            function(res, err) {
                                removeSplashScreen
                                    &&
                                    removeSplashScreen();
                                try {
                                    if (!err) {
                                        var p =
                                            JSONExt
                                            .parse(
                                                res
                                            );
                                        ThemeGen.vs(
                                            p,
                                            id);
                                        return;
                                    }
                                } catch (e) {
                                    err = e;
                                }
                                require(
                                        "../ui/notify"
                                    )
                                    .Notify.error(
                                        "Failed to load theme " +
                                        data.name +
                                        ": " +
                                        (err.code ||
                                            err
                                            .toString()
                                        )
                                    );
                                return getSettingsEditor()
                                    .setOption(
                                        "theme",
                                        "ace/theme/cobalt"
                                    );
                            },
                            true
                        );
                    });
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    //configure an element to use application theme class
    exports.watchTheme = updateTheme;
    var prevThemes = appConfig.customThemes;
    appConfig.customThemes = [];
    prevThemes.forEach(addTheme);
    prevThemes = null;

    function _id(t) {
        return String(t).replace(/ /g, "_").replace(/\W/g, "-");
    }
    var FileUtils = require("../core/file_utils").FileUtils;
    var MainMenu = require("../setup/setup_main_menu").MainMenu;
    MainMenu.extendOption(
        "load-settings", {
            caption: "Configuration",
            subTree: {
                "import-theme": {
                    caption: "Import theme",
                    icon: "file_download",
                    onclick: function() {
                        require(["../ext/fileview/fileviews"],
                            function(module) {
                                var Fileviews = module
                                    .Fileviews;
                                Fileviews.pickFile(
                                    "Select theme file",
                                    function(ev) {
                                        ev
                                            .preventDefault();
                                        FileUtils
                                            .getDocFromEvent(
                                                ev,
                                                function(
                                                    val,
                                                    err
                                                ) {
                                                    if (!
                                                        val ||
                                                        err
                                                    ) {
                                                        return require(
                                                                "../ui/notify"
                                                            )
                                                            .Notify
                                                            .error(
                                                                "Error loading file"
                                                            );
                                                    }
                                                    try {
                                                        //Verify theme syntax
                                                        var theme =
                                                            JSONExt
                                                            .parse(
                                                                val
                                                            );
                                                        var data = {
                                                            filepath: ev
                                                                .filepath,
                                                            name: theme
                                                                .name ?
                                                                theme
                                                                .name :
                                                                ev
                                                                .filename
                                                                .replace(
                                                                    /([^\.]+)\..*/,
                                                                    "$1"
                                                                ),
                                                            isDark: theme
                                                                .type ==
                                                                "dark",
                                                        };
                                                        if (!
                                                            /dark|light/i
                                                            .test(
                                                                data
                                                                .name
                                                            )
                                                        ) {
                                                            data.name +=
                                                                theme
                                                                .type ==
                                                                "dark" ?
                                                                " Dark" :
                                                                " Light";
                                                        }
                                                        if (ev
                                                            .browser
                                                            .fileServer !==
                                                            FileUtils
                                                            .defaultServer
                                                        ) {
                                                            data.server =
                                                                ev
                                                                .browser
                                                                .fileServer
                                                                .id;
                                                        }
                                                        addTheme
                                                            (data,
                                                                theme
                                                            );
                                                        configureArr
                                                            ("customThemes",
                                                                appConfig
                                                                .customThemes
                                                            );
                                                        updateList
                                                            ();
                                                        require
                                                            (
                                                                "../ui/notify"
                                                            )
                                                            .Notify
                                                            .ask(
                                                                "Apply theme now?",
                                                                function() {
                                                                    getSettingsEditor
                                                                        ()
                                                                        .setOption(
                                                                            "theme",
                                                                            _id(data
                                                                                .name
                                                                            )
                                                                        );
                                                                }
                                                            );
                                                    } catch (
                                                        e
                                                    ) {
                                                        console
                                                            .log(
                                                                e
                                                            );
                                                        return require(
                                                                "../ui/notify"
                                                            )
                                                            .Notify
                                                            .error(
                                                                "Error parsing " +
                                                                ev
                                                                .filepath
                                                            );
                                                    }
                                                },
                                                false,
                                                true
                                            );
                                    });
                            });
                    },
                },
            },
        },
        true
    );

    function updateList() {
        require(["./ext/prefs/settings-menu"], function(mod) {
            var themeOption = mod.SettingsPanel.optionGroups
                .Appearance.Theme;
            var themes = {
                Bright: [],
                Dark: [],
            };
            themelist.themes.forEach(function(x) {
                themes[x.isDark ? "Dark" : "Bright"]
                    .push({
                        caption: x.caption,
                        value: x.theme,
                    });
            });
            themeOption.items = themes;
        });
    }
});